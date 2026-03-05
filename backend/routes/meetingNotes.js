const express = require("express");
const router = express.Router();
const prisma = require("../db/prisma");
const authenticate = require("../middleware/auth");

router.use(authenticate);

const MEETING_TYPES = ["MEETING", "MEETING_ROOM"];

const getAuthorizedMeetingEvent = async (eventId, teamName) => {
  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      teamId: true,
      type: true,
    },
  });

  if (!event) return { error: "일정을 찾을 수 없습니다.", status: 404 };
  if (event.teamId !== teamName)
    return { error: "권한이 없습니다.", status: 403 };
  if (!MEETING_TYPES.includes(event.type))
    return { error: "회의 일정만 회의록을 작성할 수 있습니다.", status: 400 };

  return { event };
};

// 단일 회의록 조회 (현재 로그인한 사용자 기준)
router.get("/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId, teamName } = req.user;

    const check = await getAuthorizedMeetingEvent(eventId, teamName);
    if (check.error) {
      return res.status(check.status).json({ error: check.error });
    }

    const note = await prisma.meetingNote.findUnique({
      where: {
        eventId_authorId: {
          eventId,
          authorId: userId,
        },
      },
      select: {
        id: true,
        eventId: true,
        authorId: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({ note: note || null });
  } catch (error) {
    console.error("회의록 조회 오류:", error);
    return res.status(500).json({ error: "회의록 조회에 실패했습니다." });
  }
});

// 회의록 저장/수정 (현재 로그인한 사용자 기준)
router.put("/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;
    const { userId, teamName } = req.user;
    const { content } = req.body || {};

    if (typeof content !== "string") {
      return res.status(400).json({ error: "content는 문자열이어야 합니다." });
    }

    const check = await getAuthorizedMeetingEvent(eventId, teamName);
    if (check.error) {
      return res.status(check.status).json({ error: check.error });
    }

    const saved = await prisma.meetingNote.upsert({
      where: {
        eventId_authorId: {
          eventId,
          authorId: userId,
        },
      },
      update: {
        content,
      },
      create: {
        eventId,
        authorId: userId,
        content,
      },
      select: {
        id: true,
        eventId: true,
        authorId: true,
        content: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({ note: saved });
  } catch (error) {
    console.error("회의록 저장 오류:", error);
    return res.status(500).json({ error: "회의록 저장에 실패했습니다." });
  }
});

module.exports = router;
