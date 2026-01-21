const { WebSocketServer } = require("ws");
const jwt = require("jsonwebtoken");
const prisma = require("../db/prisma");

// 채팅방별 연결된 클라이언트 관리
const chatRooms = new Map(); // roomId -> Set<WebSocket>

// 사용자별 연결 관리 (중복 연결 방지)
const userConnections = new Map(); // userId -> Set<WebSocket>

class ChatWebSocketServer {
  constructor(server) {
    this.wss = new WebSocketServer({ 
      server,
      path: "/ws/chat"
    });
    
    this.setup();
  }

  setup() {
    this.wss.on("connection", async (ws, req) => {
      // 인증 처리
      const user = await this.authenticate(ws, req);
      if (!user) {
        ws.close(1008, "인증 실패");
        return;
      }

      console.log(`✅ WebSocket 연결: ${user.name} (${user.userId})`);
      
      // 연결 정보 저장
      this.addConnection(user.userId, ws);

      // 메시지 수신 처리
      ws.on("message", async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await this.handleMessage(ws, user, message);
        } catch (error) {
          console.error("메시지 처리 오류:", error);
          ws.send(JSON.stringify({
            type: "error",
            message: "메시지 처리에 실패했습니다."
          }));
        }
      });

      // 연결 종료 처리
      ws.on("close", () => {
        console.log(`❌ WebSocket 연결 종료: ${user.name} (${user.userId})`);
        this.removeConnection(user.userId, ws);
      });

      // 에러 처리
      ws.on("error", (error) => {
        console.error("WebSocket 에러:", error);
        this.removeConnection(user.userId, ws);
      });

      // 연결 성공 알림
      ws.send(JSON.stringify({
        type: "connected",
        message: "WebSocket 연결이 성공했습니다."
      }));
    });
  }

  // WebSocket 인증
  async authenticate(ws, req) {
    try {
      // URL에서 토큰 추출 (ws://localhost:8080/ws/chat?token=xxx)
      let token = null;
      
      // req.url에서 직접 파싱
      if (req.url) {
        const urlMatch = req.url.match(/[?&]token=([^&]+)/);
        if (urlMatch) {
          token = decodeURIComponent(urlMatch[1]);
        }
      }

      // 헤더에서도 확인 (Authorization 헤더)
      if (!token && req.headers.authorization) {
        token = req.headers.authorization.replace("Bearer ", "");
      }

      if (!token) {
        console.error("❌ WebSocket 인증 실패: 토큰이 없습니다.");
        ws.send(JSON.stringify({
          type: "error",
          message: "인증 토큰이 필요합니다."
        }));
        return null;
      }

      // JWT 검증
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 사용자 정보 조회
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, name: true, role: true, teamName: true },
      });

      if (!user) {
        console.error("❌ WebSocket 인증 실패: 사용자를 찾을 수 없습니다.");
        ws.send(JSON.stringify({
          type: "error",
          message: "사용자를 찾을 수 없습니다."
        }));
        return null;
      }

      console.log(`✅ WebSocket 인증 성공: ${user.name} (${user.id})`);
      return {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        teamName: user.teamName,
      };
    } catch (error) {
      console.error("❌ WebSocket 인증 오류:", error.message);
      try {
        ws.send(JSON.stringify({
          type: "error",
          message: `인증에 실패했습니다: ${error.message}`
        }));
      } catch (sendError) {
        console.error("에러 메시지 전송 실패:", sendError);
      }
      return null;
    }
  }

  // 연결 추가
  addConnection(userId, ws) {
    if (!userConnections.has(userId)) {
      userConnections.set(userId, new Set());
    }
    userConnections.get(userId).add(ws);
  }

  // 연결 제거
  removeConnection(userId, ws) {
    if (userConnections.has(userId)) {
      userConnections.get(userId).delete(ws);
      if (userConnections.get(userId).size === 0) {
        userConnections.delete(userId);
      }
    }

    // 채팅방에서도 제거
    for (const [roomId, clients] of chatRooms.entries()) {
      clients.delete(ws);
      if (clients.size === 0) {
        chatRooms.delete(roomId);
      }
    }
  }

  // 채팅방에 참여
  joinRoom(roomId, ws) {
    if (!chatRooms.has(roomId)) {
      chatRooms.set(roomId, new Set());
    }
    chatRooms.get(roomId).add(ws);
  }

  // 채팅방에서 나가기
  leaveRoom(roomId, ws) {
    if (chatRooms.has(roomId)) {
      chatRooms.get(roomId).delete(ws);
      if (chatRooms.get(roomId).size === 0) {
        chatRooms.delete(roomId);
      }
    }
  }

  // 메시지 처리
  async handleMessage(ws, user, message) {
    switch (message.type) {
      case "join":
        // 채팅방 참여
        await this.handleJoin(ws, user, message);
        break;
      
      case "leave":
        // 채팅방 나가기
        await this.handleLeave(ws, user, message);
        break;
      
      case "send":
        // 메시지 전송
        await this.handleSend(ws, user, message);
        break;
      
      default:
        ws.send(JSON.stringify({
          type: "error",
          message: "알 수 없는 메시지 타입입니다."
        }));
    }
  }

  // 채팅방 참여
  async handleJoin(ws, user, message) {
    const { roomId, roomType } = message;

    // 권한 확인
    let chatRoom;
    if (roomType === "TEAM") {
      if (!user.teamName) {
        ws.send(JSON.stringify({
          type: "error",
          message: "팀에 속해있지 않습니다."
        }));
        return;
      }

      // 팀 채팅방 조회 또는 생성
      chatRoom = await prisma.chatRoom.findUnique({
        where: { teamId: user.teamName },
      });

      if (!chatRoom) {
        chatRoom = await prisma.chatRoom.create({
          data: {
            type: "TEAM",
            teamId: user.teamName,
          },
        });
      }
    } else if (roomType === "DIRECT") {
      if (!roomId) {
        ws.send(JSON.stringify({
          type: "error",
          message: "개인 채팅방 ID가 필요합니다."
        }));
        return;
      }

      chatRoom = await prisma.chatRoom.findFirst({
        where: {
          id: roomId,
          type: "DIRECT",
          participants: {
            some: { userId: user.userId }
          }
        }
      });

      if (!chatRoom) {
        ws.send(JSON.stringify({
          type: "error",
          message: "권한이 없습니다."
        }));
        return;
      }
    } else {
      ws.send(JSON.stringify({
        type: "error",
        message: "잘못된 채팅방 타입입니다."
      }));
      return;
    }

    // 채팅방 참여
    this.joinRoom(chatRoom.id, ws);

    ws.send(JSON.stringify({
      type: "joined",
      roomId: chatRoom.id,
      message: "채팅방에 참여했습니다."
    }));
  }

  // 채팅방 나가기
  async handleLeave(ws, user, message) {
    const { roomId } = message;
    if (roomId) {
      this.leaveRoom(roomId, ws);
    }
  }

  // 메시지 전송
  async handleSend(ws, user, message) {
    const { content, roomId, roomType } = message;

    if (!content || !content.trim()) {
      ws.send(JSON.stringify({
        type: "error",
        message: "메시지 내용을 입력해주세요."
      }));
      return;
    }

    let chatRoom;

    if (roomType === "TEAM") {
      if (!user.teamName) {
        ws.send(JSON.stringify({
          type: "error",
          message: "팀에 속해있지 않습니다."
        }));
        return;
      }

      chatRoom = await prisma.chatRoom.findUnique({
        where: { teamId: user.teamName },
      });

      if (!chatRoom) {
        chatRoom = await prisma.chatRoom.create({
          data: {
            type: "TEAM",
            teamId: user.teamName,
          },
        });
      }
    } else if (roomType === "DIRECT" && roomId) {
      chatRoom = await prisma.chatRoom.findFirst({
        where: {
          id: roomId,
          type: "DIRECT",
          participants: {
            some: { userId: user.userId }
          }
        }
      });

      if (!chatRoom) {
        ws.send(JSON.stringify({
          type: "error",
          message: "권한이 없습니다."
        }));
        return;
      }
    } else {
      ws.send(JSON.stringify({
        type: "error",
        message: "잘못된 요청입니다."
      }));
      return;
    }

    // 메시지 저장
    const savedMessage = await prisma.message.create({
      data: {
        chatRoomId: chatRoom.id,
        senderId: user.userId,
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

    // 채팅방에 참여한 모든 클라이언트에게 브로드캐스트
    const clients = chatRooms.get(chatRoom.id) || new Set();
    const messageData = {
      type: "message",
      data: savedMessage,
    };

    clients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
        client.send(JSON.stringify(messageData));
      }
    });

    // 전송자에게도 확인 메시지
    ws.send(JSON.stringify({
      type: "message_sent",
      messageId: savedMessage.id,
    }));
  }

  // 특정 채팅방에 메시지 브로드캐스트 (외부에서 호출 가능)
  broadcastToRoom(roomId, message) {
    const clients = chatRooms.get(roomId) || new Set();
    clients.forEach((client) => {
      if (client.readyState === 1) {
        client.send(JSON.stringify(message));
      }
    });
  }

  // 특정 사용자에게 메시지 전송 (외부에서 호출 가능)
  broadcastToUser(userId, message) {
    const userWsSet = userConnections.get(userId);
    if (userWsSet) {
      userWsSet.forEach((ws) => {
        if (ws.readyState === 1) {
          ws.send(JSON.stringify(message));
        }
      });
    }
  }
}

module.exports = ChatWebSocketServer;
