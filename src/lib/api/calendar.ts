// calendar.ts - 캘린더 이벤트 API 함수
import { apiRequest } from "./users";

export interface CalendarEvent {
  id: string;
  type: "MEETING_ROOM" | "MEETING" | "LEAVE" | "VACATION";
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  location: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedBy: string;
  approvedBy: string | null;
  teamId: string;
  createdAt: string;
  updatedAt: string;
  requester?: {
    id: string;
    name: string;
    email: string;
  };
  approver?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

// 일정 생성
export const createCalendarEvent = async (data: {
  type: "MEETING_ROOM" | "MEETING" | "LEAVE" | "VACATION";
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  location?: string;
}): Promise<CalendarEvent> => {
  return apiRequest("/api/calendar/events", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

// 일정 조회 (날짜 범위)
export const getCalendarEvents = async (
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> => {
  return apiRequest(
    `/api/calendar/events?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
  );
};

// 승인 대기 중인 일정 조회 (팀장 이상만)
export const getPendingCalendarEvents = async (): Promise<CalendarEvent[]> => {
  return apiRequest("/api/calendar/events/pending");
};

// 일정 승인 (팀장 이상만)
export const approveCalendarEvent = async (
  eventId: string
): Promise<CalendarEvent> => {
  return apiRequest(`/api/calendar/events/${eventId}/approve`, {
    method: "PUT",
  });
};

// 일정 거절 (팀장 이상만)
export const rejectCalendarEvent = async (
  eventId: string,
  comment?: string
): Promise<CalendarEvent> => {
  return apiRequest(`/api/calendar/events/${eventId}/reject`, {
    method: "PUT",
    body: JSON.stringify({ comment }),
  });
};

// 일정 삭제
export const deleteCalendarEvent = async (eventId: string): Promise<void> => {
  return apiRequest(`/api/calendar/events/${eventId}`, {
    method: "DELETE",
  });
};

// 단일 일정 조회
export const getCalendarEvent = async (
  eventId: string
): Promise<CalendarEvent> => {
  return apiRequest(`/api/calendar/events/${eventId}`);
};
