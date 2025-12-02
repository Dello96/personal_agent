// users.ts - 사용자 API 함수

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const getToken = () => {
  if (typeof window === "undefined") return null;
  const authStore = require("@/app/stores/authStore").useAuthStore.getState();
  return authStore.token;
};

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

// 현재 사용자 정보 조회
export const getCurrentUser = async () => {
  return apiRequest("/api/users/me");
};

// 팀원 목록 조회
export const getTeamMembers = async () => {
  return apiRequest("/api/users/team-members");
};
