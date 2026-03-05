"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/app/stores/authStore";
import { getRoleLabel } from "@/lib/utils/roleUtils";
import NotificationCenter from "./NotificationCenter";

export interface AppHeaderProps {
  showBackButton?: boolean;
  title?: string;
  onBackClick?: () => void;
  /** 모바일에서 사이드바 토글 (햄버거 메뉴) */
  onToggleSidebar?: () => void;
}

export default function AppHeader({
  showBackButton = false,
  title,
  onBackClick,
  onToggleSidebar,
}: AppHeaderProps) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const handleBack = () => {
    if (onBackClick) {
      onBackClick();
    } else {
      router.back();
    }
  };

  return (
    <header className="bg-white rounded-2xl px-3 md:px-6 py-3 md:py-4 mb-3 md:mb-4 shadow-sm flex items-center justify-between gap-2 flex-wrap">
      {/* 좌측: 햄버거(모바일) + 뒤로가기 + Home 버튼 */}
      <div className="flex items-center gap-2 md:gap-4 min-w-0">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="메뉴 열기"
            className="md:hidden p-2 text-gray-600 hover:text-[#7F55B1] hover:bg-violet-50 rounded-lg transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        )}
        {showBackButton && (
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-gray-600 hover:text-[#7F55B1] transition-colors"
          >
            <span className="text-xl">←</span>
            <span className="font-medium">뒤로</span>
          </button>
        )}
        {title ? (
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          </div>
        ) : (
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-gray-600 hover:text-[#7F55B1] transition-colors"
          >
            <span className="text-xl">🏠</span>
            <span className="font-medium hidden sm:inline">HOME</span>
          </button>
        )}
      </div>

      {/* 우측: 직급, 알림, 마이페이지, 로그아웃 */}
      <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
        {user && (
          <span className="px-2 md:px-4 py-1.5 md:py-2 bg-gradient-to-r from-[#7F55B1] to-purple-400 text-white rounded-full text-xs md:text-sm font-medium whitespace-nowrap">
            {getRoleLabel(user.role)}
          </span>
        )}

        <NotificationCenter />

        <button
          onClick={() => router.push("/mypage")}
          className="flex items-center gap-1.5 md:gap-2 text-gray-600 hover:text-[#7F55B1] transition-colors p-1.5 md:p-0"
        >
          <span className="text-xl">👤</span>
          <span className="font-medium hidden sm:inline">Mypage</span>
        </button>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 md:gap-2 px-2 md:px-4 py-1.5 md:py-2 bg-red-100 text-red-500 rounded-xl hover:bg-red-200 transition-colors text-sm"
        >
          <span>🚪</span>
          <span className="font-medium hidden sm:inline">Logout</span>
        </button>
      </div>
    </header>
  );
}
