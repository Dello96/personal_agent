// chat.ts - 채팅 API 함수
import { apiRequest } from "./users";

export interface ChatRoom {
  id: string;
  teamId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  chatRoomId: string;
  senderId: string;
  content: string;
  clientMessageId?: string;
  attachments?: Array<{
    url: string;
    type: "image" | "video";
    name?: string;
    size?: number;
  }> | null;
  links?: Array<{
    url: string;
    title?: string | null;
    description?: string | null;
    image?: string | null;
  }> | null;
  createdAt: string;
  updatedAt: string;
  sender?: {
    id: string;
    name: string;
    email: string;
    picture: string | null;
  };
}

export interface MessagesResponse {
  messages: Message[];
  hasMore: boolean;
  nextCursor: string | null;
}

// 채팅방 조회 또는 생성
export const getChatRoom = async (): Promise<ChatRoom> => {
  return apiRequest("/api/chat/room");
};

// 개인 채팅방 조회 또는 생성
export const getDirectChatRoom = async (userId: string): Promise<ChatRoom> => {
  return apiRequest(`/api/chat/direct/${userId}`);
};

// 메시지 목록 조회
export const getMessages = async (
  limit?: number,
  cursor?: string,
  roomId?: string,
  type: "TEAM" | "DIRECT" = "TEAM",
  lastMessageId?: string
): Promise<MessagesResponse> => {
  const params = new URLSearchParams();
  if (limit) params.append("limit", limit.toString());
  if (cursor) params.append("cursor", cursor);
  if (roomId) params.append("roomId", roomId);
  if (lastMessageId) params.append("lastMessageId", lastMessageId);
  params.append("type", type);

  const queryString = params.toString();
  return apiRequest(
    `/api/chat/messages${queryString ? `?${queryString}` : ""}`
  );
};

// 메시지 전송
export const sendMessage = async (
  content: string,
  roomId?: string,
  type: "TEAM" | "DIRECT" = "TEAM"
): Promise<Message> => {
  return apiRequest("/api/chat/messages", {
    method: "POST",
    body: JSON.stringify({ content, roomId, type }),
  });
};

export const uploadChatFiles = async (files: File[]) => {
  const token =
    typeof window === "undefined"
      ? null
      : require("@/app/stores/authStore").useAuthStore.getState().token;
  const formData = new FormData();
  files.forEach((file) => formData.append("files", file));

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/upload/chat`,
    {
      method: "POST",
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    }
  );

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "파일 업로드에 실패했습니다.");
  }
  return result as {
    files: Array<{
      url: string;
      type: "image" | "video";
      name?: string;
      size?: number;
    }>;
  };
};

// 메시지 삭제
export const deleteMessage = async (messageId: string): Promise<void> => {
  return apiRequest(`/api/chat/messages/${messageId}`, {
    method: "DELETE",
  });
};
