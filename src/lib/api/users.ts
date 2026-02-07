// users.ts - 사용자 API 함수

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

const getToken = () => {
  if (typeof window === "undefined") return null;
  const authStore = require("@/app/stores/authStore").useAuthStore.getState();

  console.log("AuthStore state:", authStore); // 전체 상태 확인
  console.log("Token from store:", authStore.token); // 토큰 확인
  return authStore.token;
};

const apiRequestForm = async (endpoint: string, formData: FormData) => {
  const token = getToken();
  const headers = {
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  const response = await fetch(`${API_URL}${endpoint}`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    let errorMessage = `API Error: ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch (e) {}
    throw new Error(errorMessage);
  }

  return response.json();
};

export const apiRequest = async (
  endpoint: string,
  options: RequestInit = {}
) => {
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
    // 에러 응답 본문도 함께 확인
    let errorMessage = `API Error: ${response.statusText}`;
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch (e) {}
    throw new Error(errorMessage);
  }

  return response.json();
};

export interface User {
  id: string;
  email: string;
  name: string;
  picture: string | null;
  role: string;
  teamName: string | null;
  createdAt: string;
  updatedAt: string;
  team?: {
    id: string;
    name: string;
  } | null;
}

// 현재 사용자 정보 조회
export const getCurrentUser = async (): Promise<User> => {
  return apiRequest("/api/users/me");
};

// 현재 사용자 정보 업데이트 (닉네임/프로필 이미지)
export const updateCurrentUser = async (payload: {
  name?: string;
  picture?: string | null;
}): Promise<User> => {
  return apiRequest("/api/users/me", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
};

// users.ts에 추가
export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

// 팀원 목록 조회
export const getTeamMembers = async () => {
  return apiRequest("/api/users/team-members");
};

// 프로필 이미지 업로드
export const uploadProfileImage = async (file: File) => {
  const formData = new FormData();
  formData.append("image", file);
  return apiRequestForm("/api/upload/profile", formData);
};
