// WebSocket 클라이언트 유틸리티

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8080";

export type ChatMessageType = "join" | "leave" | "send";
export type ChatRoomType = "TEAM" | "DIRECT";

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface ChatWebSocketClient {
  connect: (token: string) => void;
  disconnect: () => void;
  joinRoom: (roomId: string, type: ChatRoomType) => void;
  leaveRoom: (roomId: string) => void;
  sendMessage: (content: string, roomId: string | null, type: ChatRoomType) => void;
  onMessage: (callback: (message: any) => void) => void;
  onError: (callback: (error: Error) => void) => void;
  onConnect: (callback: () => void) => void;
  onDisconnect: (callback: () => void) => void;
  isConnected: () => boolean;
}

class ChatWebSocketClientImpl implements ChatWebSocketClient {
  private ws: WebSocket | null = null;
  private token: string | null = null;
  private messageCallbacks: Array<(message: any) => void> = [];
  private errorCallbacks: Array<(error: Error) => void> = [];
  private connectCallbacks: Array<() => void> = [];
  private disconnectCallbacks: Array<() => void> = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // 1초
  private reconnectTimer: NodeJS.Timeout | null = null;

  connect(token: string) {
    // 이미 연결되어 있거나 연결 중이면 스킵
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log("WebSocket이 이미 연결되어 있습니다.");
      return;
    }

    // 연결 중이면 기존 연결 정리
    if (this.ws?.readyState === WebSocket.CONNECTING) {
      console.log("WebSocket 연결 중... 기존 연결 정리");
      this.ws.close();
      this.ws = null;
    }

    // 기존 연결이 있으면 정리
    if (this.ws) {
      console.log("기존 WebSocket 연결 정리");
      this.ws.close();
      this.ws = null;
    }

    this.token = token;
    const url = `${WS_URL}/ws/chat?token=${encodeURIComponent(token)}`;
    console.log("🔌 WebSocket 연결 시도:", url.replace(token, "***"));

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log("✅ WebSocket 연결 성공");
        this.reconnectAttempts = 0;
        this.connectCallbacks.forEach((callback) => callback());
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("📨 WebSocket 메시지 수신:", message.type);
          this.messageCallbacks.forEach((callback) => callback(message));
        } catch (error) {
          console.error("메시지 파싱 오류:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("❌ WebSocket 에러:", error);
        console.error("WebSocket URL:", url.replace(token, "***"));
        this.errorCallbacks.forEach((callback) => callback(new Error("WebSocket 연결 오류")));
      };

      this.ws.onclose = (event) => {
        console.log("🔌 WebSocket 연결 종료:", event.code, event.reason);
        this.disconnectCallbacks.forEach((callback) => callback());
        
        // 정상 종료가 아니면 재연결 시도
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          console.log(`재연결 시도 (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
          this.scheduleReconnect();
        } else if (event.code !== 1000) {
          console.error("❌ 최대 재연결 시도 횟수 초과");
          this.errorCallbacks.forEach((callback) => callback(new Error("WebSocket 연결에 실패했습니다. 페이지를 새로고침해주세요.")));
        }
      };
    } catch (error) {
      console.error("❌ WebSocket 연결 실패:", error);
      this.errorCallbacks.forEach((callback) => callback(error as Error));
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1); // 지수 백오프

    console.log(`${delay}ms 후 재연결 시도 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      if (this.token) {
        this.connect(this.token);
      }
    }, delay);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      // 연결 상태에 따라 적절히 종료
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(1000, "정상 종료");
      }
      this.ws = null;
    }
    this.token = null;
    
    // 콜백은 초기화하지 않음 (재연결 시 재사용)
  }

  joinRoom(roomId: string, roomType: ChatRoomType) {
    if (!this.isConnected()) {
      console.error("WebSocket이 연결되어 있지 않습니다.");
      return;
    }

    this.send({
      type: "join",
      roomId: roomId || null, // 빈 문자열이면 null로 전송
      roomType: roomType, // 채팅방 타입 (TEAM 또는 DIRECT)
    });
  }

  leaveRoom(roomId: string) {
    if (!this.isConnected()) {
      return;
    }

    this.send({
      type: "leave",
      roomId,
    });
  }

  sendMessage(content: string, roomId: string | null, roomType: ChatRoomType) {
    if (!this.isConnected()) {
      console.error("WebSocket이 연결되어 있지 않습니다.");
      return;
    }

    this.send({
      type: "send",
      content,
      roomId,
      roomType: roomType, // 채팅방 타입 (TEAM 또는 DIRECT)
    });
  }

  private send(message: WebSocketMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error("WebSocket이 열려있지 않습니다.");
    }
  }

  onMessage(callback: (message: any) => void) {
    this.messageCallbacks.push(callback);
  }

  onError(callback: (error: Error) => void) {
    this.errorCallbacks.push(callback);
  }

  onConnect(callback: () => void) {
    this.connectCallbacks.push(callback);
  }

  onDisconnect(callback: () => void) {
    this.disconnectCallbacks.push(callback);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// 싱글톤 인스턴스 생성
export const chatWebSocketClient: ChatWebSocketClient = new ChatWebSocketClientImpl();
