// tasks.ts - 업무 API 함수
import { apiRequest } from "./users";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface TaskParticipant {
  id: string;
  userId: string;
  role: "OWNER" | "PARTICIPANT" | "REVIEWER";
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string;
  assignerId: string;
  teamName: string;
  createdAt: string;
  updatedAt: string;
  dueDate: string | null;
  completedAt: string | null;
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  assigner?: {
    id: string;
    name: string;
    email: string;
  };
  team?: {
    id: string;
    name: string;
  };
  participants?: TaskParticipant[];
}

// 업무 생성
export const createTask = async (data: {
  title: string;
  description?: string;
  assigneeId: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate?: string;
  participantIds?: string[];
}): Promise<Task> => {
  return apiRequest("/api/tasks", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

// 업무 목록 조회
export const getTasks = async (): Promise<Task[]> => {
  return apiRequest("/api/tasks"); // GET /api/tasks/
};

// 업무 상세 조회
export const getTask = async (id: string) => {
  return apiRequest(`/api/tasks/${id}`);
};

// 업무 상태 변경
export const updateTaskStatus = async (
  id: string,
  status: string
): Promise<Task> => {
  return apiRequest(`/api/tasks/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
};
