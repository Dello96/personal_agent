"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/app/stores/authStore";

export default function Header() {
  const router = useRouter();

  // Zustand에서 로그인 상태와 사용자 정보 직접 가져오기
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);
  const setHasHydrated = useAuthStore((state) => state.setHasHydrated);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const getRoleLabel = (role: string) => {
    const roleMap: Record<string, string> = {
      INTERN: "인턴",
      STAFF: "사원",
      ASSOCIATE: "주임",
      ASSISTANT_MANAGER: "대리",
      TEAM_LEAD: "팀장",
    };
    return roleMap[role] || role;
  };

  // 하이드레이션 체크 (브라우저에서만 실행)
  useEffect(() => {
    if (typeof window !== "undefined" && !hasHydrated) {
      setHasHydrated(true);
    }
  }, [hasHydrated, setHasHydrated]);

  return (
    <header>
      <div className="bg-blue-100 flex flex-row justify-between items-center">
        <Link href="/" className="m-8">
          Home
        </Link>

        <div className="bg-red-100 flex flex-row items-center gap-4">
          {hasHydrated ? (
            isLoggedIn && user ? (
              <>
                {/* 로그인된 경우 */}
                <Link href="/mypage" className="m-8">
                  마이페이지
                </Link>
                <span className="m-8 px-3 py-1 bg-blue-500 text-white rounded text-sm">
                  {getRoleLabel(user.role)}
                </span>

                {/* 로그아웃 버튼 (가장 오른쪽) */}
                <button
                  onClick={handleLogout}
                  className="m-8 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  로그아웃
                </button>
              </>
            ) : (
              /* 로그인 안 된 경우 */
              <Link href="/auth/login" className="m-8">
                Login
              </Link>
            )
          ) : (
            /* 하이드레이션 중 */
            <div className="m-8">로딩 중...</div>
          )}
        </div>
      </div>
    </header>
  );
}
