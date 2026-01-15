const express = require("express");
const router = express.Router();
const prisma = require("../db/prisma");
const authenticate = require("../middleware/auth");

// 모든 라우트에 인증 미들웨어 적용
router.use(authenticate);

// 팀 채팅방 조회 또는 생성
router.get("/room", async (req, res) => {
  try {
    const { teamName } = req.user;

    if (!teamName) {
      return res.status(400).json({ error: "팀에 속해있지 않습니다." });
    }

    // 채팅방 조회 또는 생성
    let chatRoom = await prisma.chatRoom.findUnique({
      where: { teamId: teamName },
    });

    if (!chatRoom) {
      // 채팅방이 없으면 생성
      chatRoom = await prisma.chatRoom.create({
        data: {
          teamId: teamName,
        },
      });
    }

    res.json(chatRoom);
  } catch (error) {
    console.error("채팅방 조회 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// 메시지 목록 조회
router.get("/messages", async (req, res) => {
  try {
    const { teamName } = req.user;
    const { limit = 50, cursor } = req.query;

    if (!teamName) {
      return res.status(400).json({ error: "팀에 속해있지 않습니다." });
    }

    // 채팅방 조회 또는 생성
    let chatRoom = await prisma.chatRoom.findUnique({
      where: { teamId: teamName },
    });

    if (!chatRoom) {
      chatRoom = await prisma.chatRoom.create({
        data: {
          teamId: teamName,
        },
      });
    }

    // 메시지 조회 (커서 기반 페이지네이션)
    const where = {
      chatRoomId: chatRoom.id,
      ...(cursor && {
        createdAt: {
          lt: new Date(cursor),
        },
      }),
    };

    const messages = await prisma.message.findMany({
      where,
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            picture: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: parseInt(limit),
    });

    // 최신 메시지가 먼저 오도록 역순 정렬
    const sortedMessages = messages.reverse();

    res.json({
      messages: sortedMessages,
      hasMore: messages.length === parseInt(limit),
      nextCursor:
        messages.length > 0
          ? messages[messages.length - 1].createdAt.toISOString()
          : null,
    });
  } catch (error) {
    console.error("메시지 조회 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// 메시지 전송
router.post("/messages", async (req, res) => {
  try {
    const { content } = req.body;
    const { userId, teamName } = req.user;

    if (!teamName) {
      return res.status(400).json({ error: "팀에 속해있지 않습니다." });
    }

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "메시지 내용을 입력해주세요." });
    }

    // 채팅방 조회 또는 생성
    let chatRoom = await prisma.chatRoom.findUnique({
      where: { teamId: teamName },
    });

    if (!chatRoom) {
      chatRoom = await prisma.chatRoom.create({
        data: {
          teamId: teamName,
        },
      });
    }

    // 메시지 생성
    const message = await prisma.message.create({
      data: {
        chatRoomId: chatRoom.id,
        senderId: userId,
        content: content.trim(),
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            picture: true,
          },
        },
      },
    });

    res.status(201).json(message);
  } catch (error) {
    console.error("메시지 전송 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// 메시지 삭제 (본인이 보낸 메시지만)
router.delete("/messages/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId, teamName } = req.user;

    if (!teamName) {
      return res.status(400).json({ error: "팀에 속해있지 않습니다." });
    }

    // 메시지 조회
    const message = await prisma.message.findUnique({
      where: { id },
      include: {
        chatRoom: true,
      },
    });

    if (!message) {
      return res.status(404).json({ error: "메시지를 찾을 수 없습니다." });
    }

    // 팀 채팅방인지 확인
    if (message.chatRoom.teamId !== teamName) {
      return res.status(403).json({ error: "권한이 없습니다." });
    }

    // 본인이 보낸 메시지인지 확인
    if (message.senderId !== userId) {
      return res.status(403).json({ error: "본인이 보낸 메시지만 삭제할 수 있습니다." });
    }

    // 메시지 삭제
    await prisma.message.delete({
      where: { id },
    });

    res.json({ message: "메시지가 삭제되었습니다." });
  } catch (error) {
    console.error("메시지 삭제 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

module.exports = router;
