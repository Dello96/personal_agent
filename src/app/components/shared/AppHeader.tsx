"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/app/stores/authStore";
import { getRoleLabel } from "@/lib/utils/roleUtils";

export interface AppHeaderProps {
  showBackButton?: boolean;
  title?: string;
  onBackClick?: () => void;
}

export default function AppHeader({
  showBackButton = false,
  title,
  onBackClick,
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
    <header className="bg-white rounded-2xl px-6 py-4 mb-4 shadow-sm flex items-center justify-between">
      {/* 좌측: 뒤로가기 + Home 버튼 */}
      <div className="flex items-center gap-4">
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
            <span className="font-medium">Home</span>
          </button>
        )}
      </div>

      {/* 우측: 직급, 마이페이지, 로그아웃 */}
      <div className="flex items-center gap-4">
        {/* 직급 표시 */}
        {user && (
          <span className="px-4 py-2 bg-gradient-to-r from-[#7F55B1] to-purple-400 text-white rounded-full text-sm font-medium">
            {getRoleLabel(user.role)}
          </span>
        )}

        {/* 마이페이지 */}
        <button
          onClick={() => router.push("/mypage")}
          className="flex items-center gap-2 text-gray-600 hover:text-[#7F55B1] transition-colors"
        >
          <span className="text-xl">👤</span>
          <span className="font-medium">Mypage</span>
        </button>

        {/* 로그아웃 */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-500 rounded-xl hover:bg-red-200 transition-colors"
        >
          <span>🚪</span>
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </header>
  );
}
