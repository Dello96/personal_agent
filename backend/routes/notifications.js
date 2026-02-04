const express = require("express");
const router = express.Router();
const prisma = require("../db/prisma");
const authenticate = require("../middleware/auth");

router.use(authenticate);

// 알림 목록 조회
// GET /api/notifications?unread=true&limit=20
router.get("/", async (req, res) => {
  try {
    const { userId } = req.user;
    const { unread, limit = 20 } = req.query;

    const where = { userId };
    if (unread === "true") {
      where.isRead = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(parseInt(limit, 10) || 20, 100),
    });

    res.json(notifications);
  } catch (error) {
    console.error("알림 조회 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// 채팅방별 미읽음 알림 조회
// GET /api/notifications/chat-unread
router.get("/chat-unread", async (req, res) => {
  try {
    const { userId } = req.user;
    const unread = await prisma.notification.findMany({
      where: { userId, type: "chat", isRead: false },
      select: { chatRoomId: true },
    });

    const counts = {};
    unread.forEach((n) => {
      if (!n.chatRoomId) return;
      counts[n.chatRoomId] = (counts[n.chatRoomId] || 0) + 1;
    });

    res.json({ counts });
  } catch (error) {
    console.error("채팅 미읽음 조회 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// 알림 읽음 처리
router.put("/:id/read", async (req, res) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;

    const notification = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notification || notification.userId !== userId) {
      return res.status(404).json({ error: "알림을 찾을 수 없습니다." });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json(updated);
  } catch (error) {
    console.error("알림 읽음 처리 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// 특정 채팅방 알림 읽음 처리
// PUT /api/notifications/read-by-room?roomId=xxx
router.put("/read-by-room", async (req, res) => {
  try {
    const { userId } = req.user;
    const { roomId } = req.query;
    if (!roomId || typeof roomId !== "string") {
      return res.status(400).json({ error: "roomId가 필요합니다." });
    }

    await prisma.notification.updateMany({
      where: { userId, chatRoomId: roomId, type: "chat", isRead: false },
      data: { isRead: true },
    });

    res.json({ message: "해당 채팅방 알림을 읽음 처리했습니다." });
  } catch (error) {
    console.error("채팅방 알림 읽음 처리 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// 알림 전체 읽음 처리
router.put("/read-all", async (req, res) => {
  try {
    const { userId } = req.user;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    res.json({ message: "모든 알림을 읽음 처리했습니다." });
  } catch (error) {
    console.error("알림 전체 읽음 처리 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

module.exports = router;
