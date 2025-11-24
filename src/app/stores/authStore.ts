import { create } from "zustand";
import { persist } from "zustand/middleware";

// 사용자 정보 타입 정의
interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

// Auth 상태 타입
interface AuthState {
  isLoggedIn: boolean;
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
}

// Zustand Store 생성 (persist 미들웨어로 localStorage 자동 저장)
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      user: null,
      token: null,

      // 로그인 함수
      login: (user, token) => {
        set({
          isLoggedIn: true,
          user,
          token,
        });
      },

      // 로그아웃 함수
      logout: () => {
        set({
          isLoggedIn: false,
          user: null,
          token: null,
        });
        // localStorage도 자동으로 비워짐 (persist 미들웨어)
      },
    }),
    {
      name: "auth-storage", // localStorage key 이름
    }
  )
);
