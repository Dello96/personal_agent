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

export interface TaskDiscussionNote {
  id: string;
  taskId: string;
  authorId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskDiscussionNoteListItem extends TaskDiscussionNote {
  author: {
    id: string;
    name: string;
    email: string;
    picture: string | null;
  };
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

export interface AiTaskParseInputMember {
  name?: string;
  email?: string;
}

export interface AiParsedTaskResult {
  title: string;
  description: string;
  assigneeName: string | null;
  assigneeEmail: string | null;
  dueDate: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  confidence: number;
  warnings: string[];
}

export interface MostUrgentTaskHighlight {
  score: number;
  dueInHours: number | null;
  isOverdue: boolean;
  reason: string;
  generatedByAI: boolean;
}

export interface MostUrgentTaskResponse {
  ok: boolean;
  task: Task | null;
  highlight: MostUrgentTaskHighlight | null;
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

// 자연어 업무 파싱 (OpenAI)
export const parseTaskFromNaturalLanguage = async (data: {
  text: string;
  teamMembers?: AiTaskParseInputMember[];
}): Promise<{
  ok: boolean;
  model: string;
  parsedTask: AiParsedTaskResult;
}> => {
  return apiRequest("/api/ai/tasks/parse", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

// 업무 목록 조회
export const getTasks = async (): Promise<Task[]> => {
  return apiRequest("/api/tasks"); // GET /api/tasks/
};

// 가장 긴급한 업무 조회
export const getMostUrgentTask = async (): Promise<MostUrgentTaskResponse> => {
  return apiRequest("/api/tasks/most-urgent");
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

// 댓글/논의 조회 (로그인 사용자 기준)
export const getMyTaskDiscussionNote = async (
  taskId: string
): Promise<TaskDiscussionNote | null> => {
  const response = await apiRequest(`/api/tasks/${taskId}/discussion`);
  return response.note ?? null;
};

export const getTaskDiscussionNotes = async (
  taskId: string
): Promise<TaskDiscussionNoteListItem[]> => {
  const response = await apiRequest(`/api/tasks/${taskId}/discussion`);
  return response.notes ?? [];
};

// 댓글/논의 저장 (로그인 사용자 기준)
export const saveMyTaskDiscussionNote = async (
  taskId: string,
  content: string
): Promise<TaskDiscussionNote> => {
  const response = await apiRequest(`/api/tasks/${taskId}/discussion`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  });
  return response.note;
};

// 댓글/논의 삭제 (로그인 사용자 기준)
export const deleteMyTaskDiscussionNote = async (
  taskId: string
): Promise<{ ok: boolean }> => {
  return apiRequest(`/api/tasks/${taskId}/discussion`, {
    method: "DELETE",
  });
};
