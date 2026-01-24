// tasks.ts - 업무 API 함수
import { apiRequest } from "./users";
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface TaskParticipant {
  id: string;
  userId: string;
  role: "OWNER" | "PARTICIPANT" | "REVIEWER";
  note?: string | null;
  startedAt?: string | null;
  updatedAt?: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export interface ParticipantNote {
  id: string;
  userId: string;
  userName: string;
  note: string;
  updatedAt: string;
  isOwn: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assigneeId: string;
  assignerId: string;
  teamName: string;
  createdAt: string;
  updatedAt: string;
  dueDate: string | null;
  completedAt: string | null;
  status:
    | "PENDING"
    | "NOW"
    | "IN_PROGRESS"
    | "REVIEW"
    | "COMPLETED"
    | "CANCELLED"
    | "ENDING";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  progress: number;
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
  referenceImageUrls?: string[];
  referenceLinks?: string[]; // 참고 링크
  isDevelopmentTask?: boolean;
  githubRepository?: {
    id: string;
    owner: string;
    repo: string;
    isActive: boolean;
  } | null;
}

// 업무 생성
export const createTask = async (data: {
  title: string;
  description?: string;
  assigneeId: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate?: string;
  participantIds?: string[];
  referenceImageUrls?: string[];
  isDevelopmentTask?: boolean;
  githubOwner?: string;
  githubRepo?: string;
  githubAccessToken?: string;
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
export const getTask = async (id: string | undefined) => {
  return apiRequest(`/api/tasks/${id}`);
};

// 업무 상태 변경
export const updateTaskStatus = async (
  id: string,
  status: string,
  comment?: string //리뷰 반려시 코멘트 추가기능
): Promise<Task> => {
  return apiRequest(`/api/tasks/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status, comment }),
  });
};

// 참여자 노트 저장/수정
export const updateParticipantNote = async (
  taskId: string,
  participantId: string,
  note: string
): Promise<TaskParticipant> => {
  return apiRequest(`/api/tasks/${taskId}/participants/${participantId}/note`, {
    method: "PUT",
    body: JSON.stringify({ note }),
  });
};

// 참여자 노트 조회
export const getParticipantNotes = async (
  taskId: string
): Promise<ParticipantNote[]> => {
  return apiRequest(`/api/tasks/${taskId}/participants/notes`);
};

// 참여자 업무 시작 상태 업데이트
export const updateParticipantStartStatus = async (
  taskId: string,
  participantId: string,
  started: boolean
): Promise<TaskParticipant> => {
  return apiRequest(`/api/tasks/${taskId}/participants/${participantId}/start`, {
    method: "PUT",
    body: JSON.stringify({ started }),
  });
};

// 참고 링크 업데이트
export const updateTaskLinks = async (
  taskId: string,
  links: string[]
): Promise<Task> => {
  return apiRequest(`/api/tasks/${taskId}/links`, {
    method: "PUT",
    body: JSON.stringify({ links }),
  });
};
