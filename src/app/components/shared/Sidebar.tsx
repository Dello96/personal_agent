"use client";

import { useRouter } from "next/navigation";
import { useAuthStore } from "@/app/stores/authStore";

export type SidebarVariant = "default" | "task-detail" | "task-form";

interface SidebarProps {
  activeMenu?: string;
  onMenuClick?: (menu: string) => void;
  variant?: SidebarVariant;
}

const defaultMenus = ["진행중인 업무", "일정", "채팅"];

const getMenuIcon = (menu: string): string => {
  if (menu === "진행중인 업무") return "📋";
  if (menu === "일정") return "🗓️";
  if (menu === "채팅") return "💬";
  if (menu === "대시보드") return "🏠";
  if (menu === "업무 상세") return "📄";
  if (menu === "완료된 업무") return "✅";
  return "";
};

export default function Sidebar({
  activeMenu,
  onMenuClick,
  variant = "default",
}: SidebarProps) {
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const handleDefaultMenuClick = (menu: string) => {
    if (onMenuClick) {
      onMenuClick(menu);
    } else {
      // 기본 동작
      if (menu === "진행중인 업무") {
        router.push("/");
      } else if (menu === "일정") {
        router.push("/calendar");
      }
    }
  };

  // 기본 사이드바 (메인 페이지, 캘린더 페이지)
  if (variant === "default") {
    return (
      <aside className="w-64 bg-gradient-to-b from-[#7F55B1] to-[#9B6BC3] rounded-3xl m-4 p-6 flex flex-col shadow-xl">
        {/* 로고 영역 */}
        <div className="mb-10">
          <h1 className="text-white text-2xl font-bold italic flex items-center gap-2">
            <span className="text-3xl">📋</span>
            TaskFlow
          </h1>
        </div>

        {/* 메뉴 리스트 */}
        <nav className="flex-1 space-y-2">
          {defaultMenus.map((menu) => (
            <button
              key={menu}
              onClick={() => handleDefaultMenuClick(menu)}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 ${
                activeMenu === menu
                  ? "bg-white text-[#7F55B1] shadow-lg font-semibold"
                  : "text-white/90 hover:bg-white/20"
              }`}
            >
              <span>{getMenuIcon(menu)}</span>
              {menu}
            </button>
          ))}
        </nav>

        {/* 하단 로그아웃 버튼 */}
        <button
          onClick={handleLogout}
          className="mt-auto w-full py-3 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-all flex items-center justify-center gap-2"
        >
          <span>🚪</span>
          Go Out
        </button>
      </aside>
    );
  }

  // 업무 상세 페이지 사이드바
  if (variant === "task-detail") {
    return (
      <aside className="w-64 bg-gradient-to-b from-[#7F55B1] to-[#9B6BC3] rounded-3xl m-4 p-6 flex flex-col shadow-xl">
        {/* 로고 영역 */}
        <div className="mb-10">
          <h1
            onClick={() => router.push("/")}
            className="text-white text-2xl font-bold italic flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <span className="text-3xl">📋</span>
            TaskFlow
          </h1>
        </div>

        {/* 메뉴 리스트 */}
        <nav className="flex-1 space-y-2">
          <button
            onClick={() => router.push("/")}
            className="w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 text-white/90 hover:bg-white/20"
          >
            <span>🏠</span>
            대시보드
          </button>
          <button className="w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 bg-white text-[#7F55B1] shadow-lg font-semibold">
            <span>📄</span>
            업무 상세
          </button>
          <button
            onClick={() => router.push("/")}
            className="w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 text-white/90 hover:bg-white/20"
          >
            <span>🔄</span>
            진행중인 업무
          </button>
          <button
            onClick={() => router.push("/")}
            className="w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 text-white/90 hover:bg-white/20"
          >
            <span>✅</span>
            완료된 업무
          </button>
        </nav>

        {/* 하단 로그아웃 버튼 */}
        <button
          onClick={handleLogout}
          className="mt-auto w-full py-3 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-all flex items-center justify-center gap-2"
        >
          <span>🚪</span>
          Go Out
        </button>
      </aside>
    );
  }

  // 업무 폼 페이지 사이드바
  if (variant === "task-form") {
    return (
      <aside className="w-64 bg-gradient-to-b from-[#7F55B1] to-[#9B6BC3] rounded-3xl m-4 p-6 flex flex-col shadow-xl">
        {/* 로고 영역 */}
        <div className="mb-10">
          <h1 className="text-white text-2xl font-bold italic flex items-center gap-2">
            <span className="text-3xl">📋</span>
            TaskFlow
          </h1>
        </div>

        {/* 메뉴 설명 */}
        <div className="flex-1">
          <div className="bg-white/20 rounded-xl p-4 mb-4">
            <h3 className="text-white font-semibold mb-2">업무 전달</h3>
            <p className="text-white/80 text-sm">
              팀원에게 새로운 업무를 할당하고 마감일과 우선순위를 설정할 수
              있습니다.
            </p>
          </div>

          <div className="space-y-2">
            <div className="px-4 py-3 text-white/70 text-sm flex items-center gap-3">
              <span>📝</span> 업무 제목 작성
            </div>
            <div className="px-4 py-3 text-white/70 text-sm flex items-center gap-3">
              <span>👤</span> 담당자 지정
            </div>
            <div className="px-4 py-3 text-white/70 text-sm flex items-center gap-3">
              <span>👥</span> 참여자 지정
            </div>
            <div className="px-4 py-3 text-white/70 text-sm flex items-center gap-3">
              <span>🎯</span> 우선순위 설정
            </div>
            <div className="px-4 py-3 text-white/70 text-sm flex items-center gap-3">
              <span>📅</span> 마감일 설정
            </div>
          </div>
        </div>

        {/* 하단 홈 버튼 */}
        <button
          onClick={() => router.push("/")}
          className="mt-auto w-full py-3 bg-white/20 text-white rounded-xl hover:bg-white/30 transition-all flex items-center justify-center gap-2"
        >
          <span>🏠</span>
          홈으로 돌아가기
        </button>
      </aside>
    );
  }

  return null;
}

