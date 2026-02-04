import { apiRequest } from "./users";

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message?: string | null;
  link?: string | null;
  chatRoomId?: string | null;
  chatType?: string | null;
  isRead: boolean;
  createdAt: string;
}

export const getNotifications = async (params?: {
  unread?: boolean;
  limit?: number;
}): Promise<Notification[]> => {
  const query = new URLSearchParams();
  if (params?.unread) query.set("unread", "true");
  if (params?.limit) query.set("limit", params.limit.toString());
  const qs = query.toString();
  return apiRequest(`/api/notifications${qs ? `?${qs}` : ""}`);
};

export const getChatUnreadCounts = async (): Promise<{
  counts: Record<string, number>;
}> => {
  return apiRequest("/api/notifications/chat-unread");
};

export const markNotificationRead = async (
  id: string
): Promise<Notification> => {
  return apiRequest(`/api/notifications/${id}/read`, { method: "PUT" });
};

export const markAllNotificationsRead = async (): Promise<{
  message: string;
}> => {
  return apiRequest("/api/notifications/read-all", { method: "PUT" });
};

export const markChatRoomNotificationsRead = async (
  roomId: string
): Promise<{ message: string }> => {
  const qs = new URLSearchParams({ roomId }).toString();
  return apiRequest(`/api/notifications/read-by-room?${qs}`, {
    method: "PUT",
  });
};
