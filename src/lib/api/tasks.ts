// tasks.ts - 업무 API 함수

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigneeId: string;
  assignerId: string;
  teamId: string;
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
}

// 토큰 가져오기 (authStore에서)
const getToken = () => {
  if (typeof window === "undefined") return null;
  // authStore에서 토큰 가져오기
  const authStore = require("@/app/stores/authStore").useAuthStore.getState();
  return authStore.token;
};

// API 요청 헬퍼
const apiRequest = async (endpoint: string, options: RequestInit = {}) => {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API Error: ${response.statusText}`);
  }

  return response.json();
};

// 업무 목록 조회
export const getTasks = async (): Promise<Task[]> => {
  return apiRequest("/api/tasks");
};

// 업무 생성
export const createTask = async (data: {
  title: string;
  description?: string;
  assigneeId: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  dueDate?: string;
}) => {
  return apiRequest("/api/tasks", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

// 업무 상세 조회
export const getTask = async (id: string) => {
  return apiRequest(`/api/tasks/${id}`);
};

// 업무 상태 변경
export const updateTaskStatus = async (id: string, status: string) => {
  return apiRequest(`/api/tasks/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
};
