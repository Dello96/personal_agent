const express = require("express");
const router = express.Router();
const prisma = require("../db/prisma");
const authenticate = require("../middleware/auth");
const { createNotificationsForUsers } = require("../utils/notifications");

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
          type: "TEAM",
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

// 개인 채팅방 조회 또는 생성
router.get("/direct/:userId", async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const { userId: currentUserId } = req.user;

    if (targetUserId === currentUserId) {
      return res
        .status(400)
        .json({ error: "본인과는 개인 채팅을 할 수 없습니다." });
    }

    // 기존 개인 채팅방 찾기 (두 사용자가 모두 참여한 DIRECT 타입 채팅방)
    const existingRooms = await prisma.chatRoom.findMany({
      where: {
        type: "DIRECT",
        participants: {
          some: {
            userId: currentUserId,
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, picture: true },
            },
          },
        },
      },
    });

    // 두 사용자가 모두 참여한 채팅방 찾기
    const existingRoom = existingRooms.find((room) => {
      const participantIds = room.participants.map((p) => p.userId);
      return (
        participantIds.includes(currentUserId) &&
        participantIds.includes(targetUserId) &&
        participantIds.length === 2
      );
    });

    if (existingRoom) {
      return res.json(existingRoom);
    }

    // 없으면 새로 생성
    const chatRoom = await prisma.chatRoom.create({
      data: {
        type: "DIRECT",
        participants: {
          create: [{ userId: currentUserId }, { userId: targetUserId }],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true, picture: true },
            },
          },
        },
      },
    });

    res.json(chatRoom);
  } catch (error) {
    console.error("개인 채팅방 조회 오류:", error);
    res.status(500).json({ error: "서버 오류" });
  }
});

// 메시지 목록 조회 (최적화: 마지막 메시지 ID 기반 증분 조회 지원)
router.get("/messages", async (req, res) => {
  try {
    const { teamName, userId } = req.user;
    const {
      limit = 50,
      cursor,
      roomId,
      type = "TEAM",
      lastMessageId,
    } = req.query;

    let chatRoom;

    if (type === "TEAM") {
      // 팀 채팅
      if (!teamName) {
        return res.status(400).json({ error: "팀에 속해있지 않습니다." });
      }

      chatRoom = await prisma.chatRoom.findUnique({
        where: { teamId: teamName },
      });

      if (!chatRoom) {
        chatRoom = await prisma.chatRoom.create({
          data: {
            type: "TEAM",
            teamId: teamName,
          },
        });
      }
    } else if (type === "DIRECT" && roomId) {
      // 개인 채팅 - 권한 확인
      chatRoom = await prisma.chatRoom.findFirst({
        where: {
          id: roomId,
          type: "DIRECT",
          participants: {
            some: { userId },
          },
        },
      });

      if (!chatRoom) {
        return res.status(403).json({ error: "권한이 없습니다." });
      }
    } else {
      return res.status(400).json({ error: "잘못된 요청입니다." });
    }

    // 메시지 조회 조건 구성
    const where = {
      chatRoomId: chatRoom.id,
    };

    // 마지막 메시지 ID가 있으면 (증분 조회 - 새 메시지만)
    if (lastMessageId) {
      where.id = { gt: lastMessageId }; // ID가 더 큰 것만 (새 메시지)
      // createdAt으로 정렬 (오름차순 - 시간순)
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
          createdAt: "asc", // 시간순
        },
        take: parseInt(limit),
      });

      return res.json({
        messages,
        hasMore: false, // 증분 조회는 hasMore 없음
        nextCursor: null,
      });
    }

    // 기존 방식: 커서 기반 페이지네이션 (이전 메시지 로드)
    if (cursor) {
      where.createdAt = {
        lt: new Date(cursor),
      };
    }

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
    const { content, roomId, type = "TEAM" } = req.body;
    const { userId, teamName } = req.user;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "메시지 내용을 입력해주세요." });
    }

    let chatRoom;

    if (type === "TEAM") {
      // 팀 채팅
      if (!teamName) {
        return res.status(400).json({ error: "팀에 속해있지 않습니다." });
      }

      chatRoom = await prisma.chatRoom.findUnique({
        where: { teamId: teamName },
      });

      if (!chatRoom) {
        chatRoom = await prisma.chatRoom.create({
          data: {
            type: "TEAM",
            teamId: teamName,
          },
        });
      }
    } else if (type === "DIRECT" && roomId) {
      // 개인 채팅 - 권한 확인
      chatRoom = await prisma.chatRoom.findFirst({
        where: {
          id: roomId,
          type: "DIRECT",
          participants: {
            some: { userId },
          },
        },
      });

      if (!chatRoom) {
        return res.status(403).json({ error: "권한이 없습니다." });
      }
    } else {
      return res.status(400).json({ error: "잘못된 요청입니다." });
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

    // 팀 채팅일 때 팀원에게 알림 생성 (본인 제외)
    if (type === "TEAM" && teamName) {
      try {
        const members = await prisma.user.findMany({
          where: { teamName },
          select: { id: true },
        });
        const targets = members.map((m) => m.id).filter((id) => id !== userId);

        await createNotificationsForUsers(prisma, targets, {
          type: "chat",
          title: "새 팀 채팅 메시지",
          message: message.content,
          link: `/chat?roomId=${chatRoom.id}&type=TEAM`,
          chatRoomId: chatRoom.id,
          chatType: "TEAM",
        });

        const chatWSS = require("../server").chatWSS;
        if (chatWSS) {
          targets.forEach((targetId) => {
            chatWSS.broadcastToUser(targetId, { type: "notification_update" });
          });
        }
      } catch (notifyError) {
        console.error("채팅 알림 생성 오류:", notifyError);
      }
    } else if (type === "DIRECT" && chatRoom) {
      try {
        const participants = await prisma.chatRoomParticipant.findMany({
          where: { chatRoomId: chatRoom.id },
          select: { userId: true },
        });
        const targets = participants
          .map((p) => p.userId)
          .filter((id) => id !== userId);

        await createNotificationsForUsers(prisma, targets, {
          type: "chat",
          title: "새 개인 채팅 메시지",
          message: message.content,
          link: `/chat?roomId=${chatRoom.id}&type=DIRECT&userId=${userId}`,
          chatRoomId: chatRoom.id,
          chatType: "DIRECT",
        });

        const chatWSS = require("../server").chatWSS;
        if (chatWSS) {
          targets.forEach((targetId) => {
            chatWSS.broadcastToUser(targetId, { type: "notification_update" });
          });
        }
      } catch (notifyError) {
        console.error("개인 채팅 알림 생성 오류:", notifyError);
      }
    }

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
      return res
        .status(403)
        .json({ error: "본인이 보낸 메시지만 삭제할 수 있습니다." });
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
