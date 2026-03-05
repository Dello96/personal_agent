import { apiRequest } from "./users";

export interface MeetingNote {
  id: string;
  eventId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export const getMyMeetingNote = async (
  eventId: string
): Promise<MeetingNote | null> => {
  const response = await apiRequest(`/api/meeting-notes/${eventId}`);
  return response.note ?? null;
};

export const saveMyMeetingNote = async (
  eventId: string,
  content: string
): Promise<MeetingNote> => {
  const response = await apiRequest(`/api/meeting-notes/${eventId}`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
  return response.note;
};
