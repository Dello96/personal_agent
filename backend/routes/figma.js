const express = require("express");
const router = express.Router();
const prisma = require("../db/prisma");
const authenticate = require("../middleware/auth");
const { createNotificationsForUsers } = require("../utils/notifications");

/**
 * Figma 웹훅 수신 (Figma 서버가 직접 호출, 인증 없음)
 * - Figma는 JSON body + passcode로 검증 (GitHub처럼 raw body/서명 불필요)
 */
router.post("/webhook", async (req, res) => {
  const requestId = Date.now().toString();
  try {
    const payload = req.body;
    if (!payload || typeof payload !== "object") {
      console.error(`[${requestId}] Figma webhook: body 없음 또는 비객체`);
      return res.status(400).json({ error: "Invalid payload" });
    }

    const eventType = payload.event_type;
    const webhookId = payload.webhook_id;
    const passcode = payload.passcode;

    console.log(
      `[${requestId}] 📥 Figma webhook 수신: event_type=${eventType}, webhook_id=${webhookId}`
    );

    // PING: 웹훅 생성 시 Figma가 보내는 검증 이벤트 → 바로 200
    if (eventType === "PING") {
      console.log(`[${requestId}] ✅ PING 이벤트 수신`);
      return res.status(200).json({ message: "Webhook is active" });
    }

    // 우리 DB에 등록된 웹훅인지 확인 (webhook_id로 연결 조회)
    const connection = await prisma.figmaTeamConnection.findFirst({
      where: { figmaWebhookId: webhookId ?? undefined },
      include: { team: true },
    });

    if (!connection) {
      console.warn(
        `[${requestId}] ⚠️ 알 수 없는 webhook_id: ${webhookId}, 200 반환 (재시도 방지)`
      );
      return res.status(200).json({ message: "Received" });
    }

    if (connection.passcode && passcode !== connection.passcode) {
      console.error(`[${requestId}] ❌ passcode 불일치`);
      return res.status(401).json({ error: "Invalid passcode" });
    }

    // 활동 요약 메시지 생성
    const fileKey = payload.file_key ?? null;
    const fileName = payload.file_name ?? null;
    let message = `${eventType}`;
    if (fileName) message += `: ${fileName}`;
    if (eventType === "FILE_COMMENT" && payload.triggered_by?.handle) {
      message += ` (${payload.triggered_by.handle})`;
    }
    if (eventType === "FILE_VERSION_UPDATE" && payload.label) {
      message += ` - ${payload.label}`;
    }

    await prisma.figmaActivity.create({
      data: {
        connectionId: connection.id,
        eventType: eventType,
        fileKey,
        fileName,
        message,
        payload: payload,
      },
    });

    console.log(
      `[${requestId}] ✅ Figma 활동 저장: ${connection.teamId}, ${eventType}`
    );

    // 실시간 알림 (WebSocket)
    try {
      const { chatWSS } = require("../server");
      if (chatWSS && connection.teamId) {
        await chatWSS.broadcastToTeam(connection.teamId, {
          type: "figma_activity",
          data: {
            eventType,
            fileKey,
            fileName,
            message,
          },
        });
      }
      const members = await prisma.user.findMany({
        where: { teamName: connection.teamId },
        select: { id: true },
      });
      const memberIds = members.map((m) => m.id);
      await createNotificationsForUsers(prisma, memberIds, {
        type: "figma_activity",
        title: "Figma 활동",
        message,
        link: "/",
      });
      if (chatWSS) {
        memberIds.forEach((id) => {
          chatWSS.broadcastToUser(id, { type: "notification_update" });
        });
      }
    } catch (wsErr) {
      console.error(`[${requestId}] WebSocket 알림 실패:`, wsErr.message);
    }

    return res.status(200).json({ message: "OK" });
  } catch (error) {
    console.error(`[${requestId}] Figma webhook 오류:`, error);
    if (!res.headersSent) {
      return res.status(500).json({ error: "Server error" });
    }
  }
});

// 이하 인증 필요 라우트
router.use(authenticate);

/**
 * 팀 Figma 연결 정보 조회
 */
router.get("/connection", async (req, res) => {
  try {
    const { teamName } = req.user;
    const connection = await prisma.figmaTeamConnection.findUnique({
      where: { teamId: teamName },
      include: {
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });
    if (!connection) {
      return res.status(404).json({ error: "연결된 Figma가 없습니다." });
    }
    // accessToken은 반환하지 않음
    const { accessToken: _, ...safe } = connection;
    return res.json(safe);
  } catch (error) {
    console.error("Figma 연결 조회 오류:", error);
    return res.status(500).json({ error: "서버 오류" });
  }
});

/**
 * 팀 Figma 웹훅 연결 (Figma API로 웹훅 생성 후 DB 저장)
 * Body: { accessToken, context, contextId, eventType }
 * - context: "team" | "project" | "file"
 * - contextId: Figma 팀/프로젝트/파일 ID
 * - eventType: FILE_UPDATE, FILE_COMMENT, FILE_VERSION_UPDATE 등
 */
router.post("/connection", async (req, res) => {
  try {
    const { teamName, role } = req.user;
    if (!["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(role)) {
      return res
        .status(403)
        .json({ error: "팀장급 이상만 Figma를 연결할 수 있습니다." });
    }

    const { accessToken, context, contextId, eventType } = req.body;
    if (!accessToken || !context || !contextId || !eventType) {
      return res.status(400).json({
        error: "accessToken, context, contextId, eventType 은 필수입니다.",
      });
    }

    const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";
    const endpoint = `${BACKEND_URL}/api/figma/webhook`;
    const passcode = require("crypto").randomBytes(24).toString("hex");

    const figmaRes = await fetch("https://api.figma.com/v2/webhooks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        event_type: eventType,
        context,
        context_id: contextId,
        endpoint,
        passcode,
        description: `Team ${teamName}`,
      }),
    });

    if (!figmaRes.ok) {
      const errText = await figmaRes.text();
      console.error("Figma webhook 생성 실패:", figmaRes.status, errText);
      return res.status(figmaRes.status >= 500 ? 502 : 400).json({
        error: "Figma 웹훅 생성에 실패했습니다.",
        details: process.env.NODE_ENV === "development" ? errText : undefined,
      });
    }

    const figmaWebhook = await figmaRes.json();

    const connection = await prisma.figmaTeamConnection.upsert({
      where: { teamId: teamName },
      update: {
        figmaWebhookId: figmaWebhook.id,
        passcode,
        accessToken,
        context,
        contextId,
        eventType,
        isActive: true,
      },
      create: {
        teamId: teamName,
        figmaWebhookId: figmaWebhook.id,
        passcode,
        accessToken,
        context,
        contextId,
        eventType,
        isActive: true,
      },
    });

    const { accessToken: _, ...safe } = connection;
    return res.status(201).json(safe);
  } catch (error) {
    console.error("Figma 연결 생성 오류:", error);
    return res.status(500).json({
      error: "서버 오류",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * 팀 Figma 연결 해제 (Figma API에서 웹훅 삭제 후 DB 삭제)
 */
router.delete("/connection", async (req, res) => {
  try {
    const { teamName, role } = req.user;
    if (!["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(role)) {
      return res.status(403).json({ error: "권한이 없습니다." });
    }

    const connection = await prisma.figmaTeamConnection.findUnique({
      where: { teamId: teamName },
    });
    if (!connection) {
      return res.status(404).json({ error: "연결된 Figma가 없습니다." });
    }

    if (connection.figmaWebhookId != null && connection.accessToken) {
      const delRes = await fetch(
        `https://api.figma.com/v2/webhooks/${connection.figmaWebhookId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${connection.accessToken}` },
        }
      );
      if (!delRes.ok) {
        console.warn("Figma webhook 삭제 실패:", delRes.status);
      }
    }

    await prisma.figmaTeamConnection.delete({
      where: { id: connection.id },
    });
    return res.json({ message: "Figma 연결이 해제되었습니다." });
  } catch (error) {
    console.error("Figma 연결 해제 오류:", error);
    return res.status(500).json({ error: "서버 오류" });
  }
});

module.exports = router;
