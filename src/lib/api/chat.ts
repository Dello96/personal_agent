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

// 메시지 목록 조회
export const getMessages = async (
  limit?: number,
  cursor?: string
): Promise<MessagesResponse> => {
  const params = new URLSearchParams();
  if (limit) params.append("limit", limit.toString());
  if (cursor) params.append("cursor", cursor);

  const queryString = params.toString();
  return apiRequest(
    `/api/chat/messages${queryString ? `?${queryString}` : ""}`
  );
};

// 메시지 전송
export const sendMessage = async (content: string): Promise<Message> => {
  return apiRequest("/api/chat/messages", {
    method: "POST",
    body: JSON.stringify({ content }),
  });
};

// 메시지 삭제
export const deleteMessage = async (messageId: string): Promise<void> => {
  return apiRequest(`/api/chat/messages/${messageId}`, {
    method: "DELETE",
  });
};
