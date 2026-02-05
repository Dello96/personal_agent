const express = require("express");
const router = express.Router();
const prisma = require("../db/prisma");
const authenticate = require("../middleware/auth");
const { createNotificationsForUsers } = require("../utils/notifications");

const ALLOWED_EVENT_TYPES = new Set([
  "FILE_UPDATE",
  "FILE_COMMENT",
  "FILE_VERSION_UPDATE",
  "FILE_DELETE",
  "LIBRARY_PUBLISH",
  "DEV_MODE_STATUS_UPDATE",
]);

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

    // 우리 DB에 등록된 웹훅인지 확인 (webhook_id로 구독 조회)
    let connection = null;
    let subscription = null;
    if (webhookId != null) {
      subscription = await prisma.figmaWebhookSubscription.findUnique({
        where: { figmaWebhookId: webhookId },
        include: { connection: true },
      });
    }

    if (subscription) {
      connection = subscription.connection;
    } else {
      connection = await prisma.figmaTeamConnection.findFirst({
        where: { figmaWebhookId: webhookId ?? undefined },
        include: { team: true },
      });
    }

    if (!connection) {
      console.warn(
        `[${requestId}] ⚠️ 알 수 없는 webhook_id: ${webhookId}, 200 반환 (재시도 방지)`
      );
      return res.status(200).json({ message: "Received" });
    }

    const expectedPasscode = subscription?.passcode ?? connection.passcode;
    if (expectedPasscode && passcode !== expectedPasscode) {
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
        subscriptions: true,
      },
    });
    if (!connection) {
      return res.status(404).json({ error: "연결된 Figma가 없습니다." });
    }
    // accessToken/passcode는 반환하지 않음
    const { accessToken: _, passcode: __, ...safe } = connection;
    const eventTypes =
      connection.subscriptions?.length > 0
        ? Array.from(
            new Set(connection.subscriptions.map((s) => s.eventType))
          ).sort()
        : connection.eventType
          ? connection.eventType.split(",").map((t) => t.trim())
          : [];
    const subscriptions = (connection.subscriptions || []).map(
      ({ passcode: ___, ...rest }) => rest
    );
    return res.json({ ...safe, eventTypes, subscriptions });
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

    const { accessToken, context, contextId } = req.body;
    const rawEventTypes = Array.isArray(req.body.eventTypes)
      ? req.body.eventTypes
      : req.body.eventType
        ? [req.body.eventType]
        : [];
    const eventTypes = Array.from(
      new Set(
        rawEventTypes
          .map((t) => (typeof t === "string" ? t.trim() : ""))
          .filter(Boolean)
      )
    );

    if (!accessToken || !context || !contextId || eventTypes.length === 0) {
      return res.status(400).json({
        error: "accessToken, context, contextId, eventTypes 는 필수입니다.",
      });
    }
    const invalidTypes = eventTypes.filter((t) => !ALLOWED_EVENT_TYPES.has(t));
    if (invalidTypes.length > 0) {
      return res.status(400).json({
        error: `지원하지 않는 이벤트 타입: ${invalidTypes.join(", ")}`,
      });
    }

    const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8080";
    const endpoint = `${BACKEND_URL}/api/figma/webhook`;
    const passcode = require("crypto").randomBytes(24).toString("hex");

    const existing = await prisma.figmaTeamConnection.findUnique({
      where: { teamId: teamName },
      include: { subscriptions: true },
    });

    if (existing) {
      const tokenForDelete = existing.accessToken || accessToken;
      for (const sub of existing.subscriptions) {
        try {
          await fetch(
            `https://api.figma.com/v2/webhooks/${sub.figmaWebhookId}`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${tokenForDelete}` },
            }
          );
        } catch (err) {
          console.warn("기존 Figma webhook 삭제 실패:", sub.figmaWebhookId);
        }
      }
      if (existing.figmaWebhookId != null) {
        try {
          await fetch(
            `https://api.figma.com/v2/webhooks/${existing.figmaWebhookId}`,
            {
              method: "DELETE",
              headers: { Authorization: `Bearer ${tokenForDelete}` },
            }
          );
        } catch (err) {
          console.warn(
            "레거시 Figma webhook 삭제 실패:",
            existing.figmaWebhookId
          );
        }
      }
      await prisma.figmaWebhookSubscription.deleteMany({
        where: { connectionId: existing.id },
      });
    }

    const connection = await prisma.figmaTeamConnection.upsert({
      where: { teamId: teamName },
      update: {
        passcode,
        accessToken,
        context,
        contextId,
        eventType: eventTypes.join(","),
        isActive: true,
      },
      create: {
        teamId: teamName,
        passcode,
        accessToken,
        context,
        contextId,
        eventType: eventTypes.join(","),
        isActive: true,
      },
    });

    const createdWebhooks = [];
    for (const type of eventTypes) {
      const figmaRes = await fetch("https://api.figma.com/v2/webhooks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          event_type: type,
          context,
          context_id: contextId,
          endpoint,
          passcode,
          description: `Team ${teamName} - ${type}`,
        }),
      });

      if (!figmaRes.ok) {
        const errText = await figmaRes.text();
        console.error("Figma webhook 생성 실패:", figmaRes.status, errText);
        for (const created of createdWebhooks) {
          try {
            await fetch(`https://api.figma.com/v2/webhooks/${created.id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${accessToken}` },
            });
          } catch (cleanupErr) {
            console.warn("Figma webhook 롤백 실패:", created.id);
          }
        }
        return res.status(figmaRes.status >= 500 ? 502 : 400).json({
          error: "Figma 웹훅 생성에 실패했습니다.",
          details: process.env.NODE_ENV === "development" ? errText : undefined,
        });
      }

      const figmaWebhook = await figmaRes.json();
      createdWebhooks.push({ id: figmaWebhook.id, eventType: type });
    }

    if (createdWebhooks.length > 0) {
      await prisma.figmaWebhookSubscription.createMany({
        data: createdWebhooks.map((w) => ({
          connectionId: connection.id,
          figmaWebhookId: w.id,
          passcode,
          eventType: w.eventType,
          isActive: true,
        })),
      });
      await prisma.figmaTeamConnection.update({
        where: { id: connection.id },
        data: { figmaWebhookId: createdWebhooks[0].id },
      });
    }

    const updatedConnection = await prisma.figmaTeamConnection.findUnique({
      where: { id: connection.id },
      include: {
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        subscriptions: true,
      },
    });
    const { accessToken: _, passcode: __, ...safe } = updatedConnection;
    const eventTypesResponse =
      updatedConnection.subscriptions?.length > 0
        ? Array.from(
            new Set(updatedConnection.subscriptions.map((s) => s.eventType))
          ).sort()
        : updatedConnection.eventType
          ? updatedConnection.eventType.split(",").map((t) => t.trim())
          : [];
    const subscriptions = (updatedConnection.subscriptions || []).map(
      ({ passcode: ___, ...rest }) => rest
    );
    return res.status(201).json({
      ...safe,
      eventTypes: eventTypesResponse,
      subscriptions,
    });
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
      include: { subscriptions: true },
    });
    if (!connection) {
      return res.status(404).json({ error: "연결된 Figma가 없습니다." });
    }

    if (connection.subscriptions.length > 0 && connection.accessToken) {
      for (const sub of connection.subscriptions) {
        const delRes = await fetch(
          `https://api.figma.com/v2/webhooks/${sub.figmaWebhookId}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${connection.accessToken}` },
          }
        );
        if (!delRes.ok) {
          console.warn("Figma webhook 삭제 실패:", delRes.status);
        }
      }
    } else if (connection.figmaWebhookId != null && connection.accessToken) {
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
