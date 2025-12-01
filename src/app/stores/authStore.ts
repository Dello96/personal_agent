import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// 사용자 정보 타입 정의
interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: "MEMBER" | "TEAM_LEAD" | "MANAGER" | "DIRECTOR";
  teamId?: string;
  teamName?: string;
}

// Auth 상태 타입
interface AuthState {
  isLoggedIn: boolean;
  user: User | null;
  token: string | null;
  login: (user: User, token: string) => void;
  logout: () => void;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

// Zustand Store 생성 (persist 미들웨어로 localStorage 자동 저장)
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      user: null,
      token: null,
      _hasHydrated: false,
      setHasHydrated: (state) => {
        set({
          _hasHydrated: state,
        });
      },

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
      storage: createJSONStorage(() => localStorage), // 명시적으로 localStorage 사용
      // 하이드레이션 완료 후 콜백
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHasHydrated(true);
        }
      },
    }
  )
);
