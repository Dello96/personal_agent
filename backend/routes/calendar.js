const express = require("express");
const router = express.Router();
const prisma = require("../db/prisma");
const authenticate = require("../middleware/auth");
const { createNotificationsForUsers } = require("../utils/notifications");

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticate);

// 일정 목록 조회 (날짜 범위로 필터링)
router.get("/events", async (req, res) => {
  try {
    const { userId, role, teamName } = req.user;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        error: "시작일과 종료일을 입력해주세요.",
      });
    }

    // 팀별 일정 조회
    const events = await prisma.calendarEvent.findMany({
      where: {
        teamId: teamName,
        startDate: {
          gte: new Date(startDate),
        },
        endDate: {
          lte: new Date(endDate),
        },
        // 연차/휴가는 승인된 것만 표시, 회의실/미팅은 모두 표시
        OR: [
          { status: "APPROVED" },
          { type: { in: ["MEETING_ROOM", "MEETING"] } },
        ],
      },
      include: {
        requester: {
          select: { id: true, name: true, email: true },
        },
        approver: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { startDate: "asc" },
    });

    res.json(events);
  } catch (error) {
    console.error("일정 조회 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// 승인 대기 중인 일정 조회 (팀장 이상만)
router.get("/events/pending", async (req, res) => {
  try {
    const { userId, role, teamName } = req.user;

    // 팀장 이상만 조회 가능
    if (!["TEAM_LEAD"].includes(role)) {
      return res.status(403).json({ error: "권한이 없습니다." });
    }

    const pendingEvents = await prisma.calendarEvent.findMany({
      where: {
        teamId: teamName,
        status: "PENDING",
        type: { in: ["LEAVE", "VACATION"] }, // 연차/휴가만
      },
      include: {
        requester: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(pendingEvents);
  } catch (error) {
    console.error("승인 대기 일정 조회 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// 일정 생성
router.post("/events", async (req, res) => {
  try {
    const { type, title, description, startDate, endDate, location } = req.body;
    const { userId, teamName } = req.user;

    // 필수 필드 검증
    if (!type || !title || !startDate || !endDate) {
      return res.status(400).json({
        error: "필수 정보를 모두 입력해주세요.",
      });
    }

    // 타입 검증
    const validTypes = ["MEETING_ROOM", "MEETING", "LEAVE", "VACATION"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: "유효하지 않은 일정 타입입니다." });
    }

    // 날짜 검증
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (start >= end) {
      return res.status(400).json({
        error: "종료일시는 시작일시보다 이후여야 합니다.",
      });
    }

    // 회의실/미팅 예약 시 장소 필수
    if ((type === "MEETING_ROOM" || type === "MEETING") && !location) {
      return res.status(400).json({
        error: "회의실/미팅 예약 시 장소를 입력해주세요.",
      });
    }

    // 회의실 예약 중복 체크 (선택사항)
    if (type === "MEETING_ROOM") {
      const conflictingEvent = await prisma.calendarEvent.findFirst({
        where: {
          type: "MEETING_ROOM",
          location: location,
          status: "APPROVED",
          OR: [
            {
              startDate: { lte: start },
              endDate: { gte: start },
            },
            {
              startDate: { lte: end },
              endDate: { gte: end },
            },
            {
              startDate: { gte: start },
              endDate: { lte: end },
            },
          ],
        },
      });

      if (conflictingEvent) {
        return res.status(409).json({
          error: "해당 시간대에 이미 예약된 회의실입니다.",
        });
      }
    }

    // 상태 결정: 회의실/미팅은 APPROVED, 연차/휴가는 PENDING
    const status =
      type === "MEETING_ROOM" || type === "MEETING" ? "APPROVED" : "PENDING";

    // 일정 생성
    const event = await prisma.calendarEvent.create({
      data: {
        type,
        title,
        description,
        startDate: start,
        endDate: end,
        location: location || null,
        status,
        requestedBy: userId,
        teamId: teamName,
      },
      include: {
        requester: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // 연차/휴가 신청인 경우 팀장 이상에게 WebSocket 알림 전송
    if ((type === "LEAVE" || type === "VACATION") && status === "PENDING") {
      try {
        // 팀의 팀장 이상 사용자 조회
        const teamLeads = await prisma.user.findMany({
          where: {
            teamName: teamName,
            role: { in: ["TEAM_LEAD"] },
          },
          select: { id: true },
        });

        // WebSocket 서버 인스턴스 가져오기
        const ChatWebSocketServer = require("../websocket/chatServer");
        const chatWSS = require("../server").chatWSS;

        if (chatWSS) {
          // 각 팀장 이상 사용자에게 알림 전송
          teamLeads.forEach((lead) => {
            chatWSS.broadcastToUser(lead.id, {
              type: "leave_request",
              data: {
                eventId: event.id,
                type: event.type,
                title: event.title,
                requesterName: event.requester.name,
                startDate: event.startDate,
                endDate: event.endDate,
              },
            });
          });
        }

        const leadIds = teamLeads.map((lead) => lead.id);
        await createNotificationsForUsers(prisma, leadIds, {
          type: "leave_request",
          title: "연차/휴가 승인 요청",
          message: `${event.requester.name}님의 ${event.title}`,
          link: `/calendar?eventId=${event.id}`,
        });

        if (chatWSS) {
          leadIds.forEach((leadId) => {
            chatWSS.broadcastToUser(leadId, {
              type: "notification_update",
            });
          });
        }
      } catch (error) {
        console.error("연차/휴가 신청 알림 전송 오류:", error);
        // 알림 전송 실패해도 일정 생성은 성공으로 처리
      }
    }

    res.status(201).json(event);
  } catch (error) {
    console.error("일정 생성 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// 일정 승인 (팀장 이상만, 연차/휴가만)
router.put("/events/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role, teamName } = req.user;

    // 팀장 이상만 승인 가능
    if (!["TEAM_LEAD"].includes(role)) {
      return res.status(403).json({ error: "승인 권한이 없습니다." });
    }

    // 일정 조회
    const event = await prisma.calendarEvent.findUnique({
      where: { id },
    });

    if (!event) {
      return res.status(404).json({ error: "일정을 찾을 수 없습니다." });
    }

    // 팀 일정인지 확인
    if (event.teamId !== teamName) {
      return res.status(403).json({ error: "권한이 없습니다." });
    }

    // 연차/휴가만 승인 가능
    if (event.type !== "LEAVE" && event.type !== "VACATION") {
      return res.status(400).json({
        error: "연차/휴가만 승인할 수 있습니다.",
      });
    }

    // 이미 승인되었거나 거절된 경우
    if (event.status !== "PENDING") {
      return res.status(400).json({
        error: `이미 ${event.status === "APPROVED" ? "승인" : "거절"}된 일정입니다.`,
      });
    }

    // 일정 승인
    const updatedEvent = await prisma.calendarEvent.update({
      where: { id },
      data: {
        status: "APPROVED",
        approvedBy: userId,
      },
      include: {
        requester: {
          select: { id: true, name: true, email: true },
        },
        approver: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    try {
      await createNotificationsForUsers(prisma, [event.requestedBy], {
        type: "leave_approved",
        title: "연차/휴가 승인",
        message: `${event.title} 승인됨`,
        link: `/calendar?eventId=${event.id}`,
      });

      const chatWSS = require("../server").chatWSS;
      if (chatWSS) {
        chatWSS.broadcastToUser(event.requestedBy, {
          type: "notification_update",
        });
      }
    } catch (notifyError) {
      console.error("승인 알림 생성 오류:", notifyError);
    }

    res.json(updatedEvent);
  } catch (error) {
    console.error("일정 승인 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// 일정 거절 (팀장 이상만, 연차/휴가만)
router.put("/events/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role, teamName } = req.user;
    const { comment } = req.body;

    // 팀장 이상만 거절 가능
    if (!["TEAM_LEAD"].includes(role)) {
      return res.status(403).json({ error: "거절 권한이 없습니다." });
    }

    // 일정 조회
    const event = await prisma.calendarEvent.findUnique({
      where: { id },
    });

    if (!event) {
      return res.status(404).json({ error: "일정을 찾을 수 없습니다." });
    }

    // 팀 일정인지 확인
    if (event.teamId !== teamName) {
      return res.status(403).json({ error: "권한이 없습니다." });
    }

    // 연차/휴가만 거절 가능
    if (event.type !== "LEAVE" && event.type !== "VACATION") {
      return res.status(400).json({
        error: "연차/휴가만 거절할 수 있습니다.",
      });
    }

    // 이미 승인되었거나 거절된 경우
    if (event.status !== "PENDING") {
      return res.status(400).json({
        error: `이미 ${event.status === "APPROVED" ? "승인" : "거절"}된 일정입니다.`,
      });
    }

    // 일정 거절
    const updatedEvent = await prisma.calendarEvent.update({
      where: { id },
      data: {
        status: "REJECTED",
        approvedBy: userId,
        description: comment
          ? `${event.description || ""}\n[거절 사유] ${comment}`.trim()
          : event.description,
      },
      include: {
        requester: {
          select: { id: true, name: true, email: true },
        },
        approver: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    try {
      await createNotificationsForUsers(prisma, [event.requestedBy], {
        type: "leave_rejected",
        title: "연차/휴가 반려",
        message: `${event.title} 반려됨`,
        link: `/calendar?eventId=${event.id}`,
      });

      const chatWSS = require("../server").chatWSS;
      if (chatWSS) {
        chatWSS.broadcastToUser(event.requestedBy, {
          type: "notification_update",
        });
      }
    } catch (notifyError) {
      console.error("반려 알림 생성 오류:", notifyError);
    }

    res.json(updatedEvent);
  } catch (error) {
    console.error("일정 거절 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// 일정 수정 (본인이 요청한 일정 또는 팀장 이상만)
router.put("/events/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role, teamName } = req.user;
    const { type, title, description, startDate, endDate, location } = req.body;

    const event = await prisma.calendarEvent.findUnique({
      where: { id },
    });

    if (!event) {
      return res.status(404).json({ error: "일정을 찾을 수 없습니다." });
    }

    if (event.teamId !== teamName) {
      return res.status(403).json({ error: "권한이 없습니다." });
    }

    const canEdit =
      event.requestedBy === userId || ["TEAM_LEAD"].includes(role);
    if (!canEdit) {
      return res.status(403).json({ error: "수정 권한이 없습니다." });
    }

    if (!type || !title || !startDate || !endDate) {
      return res.status(400).json({ error: "필수 정보가 누락되었습니다." });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return res.status(400).json({ error: "날짜 형식이 올바르지 않습니다." });
    }

    if (start >= end) {
      return res.status(400).json({
        error: "종료일시는 시작일시보다 이후여야 합니다.",
      });
    }

    if ((type === "MEETING_ROOM" || type === "MEETING") && !location) {
      return res.status(400).json({
        error: "회의실/미팅 예약 시 장소를 입력해주세요.",
      });
    }

    if (type === "MEETING_ROOM") {
      const conflictingEvent = await prisma.calendarEvent.findFirst({
        where: {
          id: { not: id },
          type: "MEETING_ROOM",
          location: location,
          status: "APPROVED",
          OR: [
            {
              startDate: { lte: start },
              endDate: { gte: start },
            },
            {
              startDate: { lte: end },
              endDate: { gte: end },
            },
            {
              startDate: { gte: start },
              endDate: { lte: end },
            },
          ],
        },
      });

      if (conflictingEvent) {
        return res.status(409).json({
          error: "해당 시간대에 이미 예약된 회의실입니다.",
        });
      }
    }

    const status =
      type === "MEETING_ROOM" || type === "MEETING" ? "APPROVED" : event.status;

    const updatedEvent = await prisma.calendarEvent.update({
      where: { id },
      data: {
        type,
        title,
        description: description || null,
        startDate: start,
        endDate: end,
        location: location || null,
        status,
      },
      include: {
        requester: {
          select: { id: true, name: true, email: true },
        },
        approver: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json(updatedEvent);
  } catch (error) {
    console.error("일정 수정 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// 일정 삭제 (본인이 요청한 일정만)
router.delete("/events/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, role, teamName } = req.user;

    // 일정 조회
    const event = await prisma.calendarEvent.findUnique({
      where: { id },
    });

    if (!event) {
      return res.status(404).json({ error: "일정을 찾을 수 없습니다." });
    }

    // 본인이 요청한 일정이거나 팀장 이상만 삭제 가능
    const canDelete =
      event.requestedBy === userId || ["TEAM_LEAD"].includes(role);

    if (!canDelete) {
      return res.status(403).json({ error: "삭제 권한이 없습니다." });
    }

    // 팀 일정인지 확인
    if (event.teamId !== teamName) {
      return res.status(403).json({ error: "권한이 없습니다." });
    }

    // 일정 삭제
    await prisma.calendarEvent.delete({
      where: { id },
    });

    res.json({ message: "일정이 삭제되었습니다." });
  } catch (error) {
    console.error("일정 삭제 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// 단일 일정 조회
router.get("/events/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { teamName } = req.user;

    const event = await prisma.calendarEvent.findUnique({
      where: { id },
      include: {
        requester: {
          select: { id: true, name: true, email: true },
        },
        approver: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!event) {
      return res.status(404).json({ error: "일정을 찾을 수 없습니다." });
    }

    // 팀 일정인지 확인
    if (event.teamId !== teamName) {
      return res.status(403).json({ error: "권한이 없습니다." });
    }

    res.json(event);
  } catch (error) {
    console.error("일정 조회 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

module.exports = router;
