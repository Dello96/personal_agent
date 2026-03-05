"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/app/stores/authStore";
import { useNotificationStore } from "@/app/stores/notificationStore";
import { getNotifications } from "@/lib/api/notifications";

export type SidebarVariant = "default" | "task-detail" | "task-form";

interface SidebarProps {
  activeMenu?: string;
  onMenuClick?: (menu: string) => void;
  variant?: SidebarVariant;
  /** 모바일에서 드로어 열림 여부 */
  isOpen?: boolean;
  /** 모바일에서 드로어 닫기 (메뉴 클릭·닫기 버튼 시) */
  onClose?: () => void;
}

const defaultMenus = ["진행중인 업무", "일정", "채팅", "회의록"];

const getMenuIcon = (menu: string): string => {
  if (menu === "진행중인 업무") return "📋";
  if (menu === "일정") return "🗓️";
  if (menu === "채팅") return "💬";
  if (menu === "회의록") return "📝";
  if (menu === "대시보드") return "🏠";
  if (menu === "업무 상세") return "📄";
  if (menu === "완료된 업무") return "✅";
  if (menu === "팀 관리") return "⚙️";
  return "";
};

const sidebarBaseClass =
  "w-64 bg-gradient-to-b from-[#7F55B1] to-[#9B6BC3] p-4 md:p-6 flex flex-col shadow-xl transition-transform duration-200 ease-out z-40 " +
  "fixed md:relative inset-y-0 left-0 rounded-none md:rounded-3xl m-0 md:m-4";

export default function Sidebar({
  activeMenu,
  onMenuClick,
  variant = "default",
  isOpen = false,
  onClose,
}: SidebarProps) {
  const router = useRouter();
  const translateClass = isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0";
  const logout = useAuthStore((state) => state.logout);
  const user = useAuthStore((state) => state.user);
  const hasNewMessage = useNotificationStore((state) => state.hasNewMessage);
  const setHasNewMessage = useNotificationStore(
    (state) => state.setHasNewMessage
  );
  const unreadChatCount = useNotificationStore(
    (state) => state.unreadChatCount
  );
  const setUnreadChatCount = useNotificationStore(
    (state) => state.setUnreadChatCount
  );
  const hasPendingLeaveRequest = useNotificationStore(
    (state) => state.hasPendingLeaveRequest
  );
  const pendingLeaveRequestCount = useNotificationStore(
    (state) => state.pendingLeaveRequestCount
  );
  const isTeamLeadOrAbove = user?.role === "TEAM_LEAD";

  // 알림 센터 기준으로 채팅 New 배지 동기화
  useEffect(() => {
    const refreshChatBadge = async () => {
      try {
        const data = await getNotifications({ unread: true, limit: 50 });
        const hasUnreadChat = data.some((n) => n.type === "chat");
        const chatUnreadCount = data.filter((n) => n.type === "chat").length;
        setHasNewMessage(hasUnreadChat);
        setUnreadChatCount(chatUnreadCount);
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("채팅 알림 배지 동기화 실패:", error);
        }
      }
    };

    refreshChatBadge();
    const handler = () => refreshChatBadge();
    const interval = setInterval(refreshChatBadge, 30000);
    window.addEventListener("notification_update", handler);
    return () => {
      clearInterval(interval);
      window.removeEventListener("notification_update", handler);
    };
  }, [setHasNewMessage]);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const handleDefaultMenuClick = (menu: string) => {
    onClose?.();
    if (onMenuClick) {
      onMenuClick(menu);
    } else {
      // 기본 동작
      if (menu === "진행중인 업무") {
        router.push("/");
      } else if (menu === "일정") {
        router.push("/calendar");
      } else if (menu === "채팅") {
        router.push("/chat");
      } else if (menu === "회의록") {
        router.push("/meeting-notes");
      } else if (menu === "팀 관리") {
        router.push("/manager/team");
      }
    }
  };

  // 기본 사이드바 (메인 페이지, 캘린더 페이지)
  if (variant === "default") {
    return (
      <aside className={`${sidebarBaseClass} ${translateClass}`}>
        {/* 모바일 전용 닫기 버튼 */}
        <button
          type="button"
          onClick={onClose}
          aria-label="메뉴 닫기"
          className="md:hidden absolute top-4 right-4 text-white/90 hover:text-white p-1"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {/* 로고 영역 */}
        <div className="mb-6 md:mb-10">
          <h1 className="text-white text-xl md:text-2xl font-bold italic flex items-center gap-2 pr-8 md:pr-0">
            <span className="text-3xl"></span>
            Work Together
          </h1>
        </div>

        {/* 메뉴 리스트 */}
        <nav className="flex-1 space-y-2">
          {[...defaultMenus, ...(isTeamLeadOrAbove ? ["팀 관리"] : [])].map(
            (menu) => (
              <button
                key={menu}
                onClick={() => handleDefaultMenuClick(menu)}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between ${
                  activeMenu === menu
                    ? "bg-white text-[#7F55B1] shadow-lg font-semibold"
                    : "text-white/90 hover:bg-white/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span>{getMenuIcon(menu)}</span>
                  {menu}
                </div>
                <div className="flex items-center gap-2">
                  {menu === "채팅" && unreadChatCount > 0 && (
                    <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-semibold animate-pulse flex-shrink-0">
                      {unreadChatCount}
                    </span>
                  )}
                  {menu === "일정" &&
                    isTeamLeadOrAbove &&
                    hasPendingLeaveRequest && (
                      <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full font-semibold animate-pulse flex-shrink-0">
                        {pendingLeaveRequestCount > 0
                          ? pendingLeaveRequestCount
                          : ""}
                      </span>
                    )}
                </div>
              </button>
            )
          )}
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
    const taskDetailMenus = [
      { label: "개요", icon: "📌" },
      { label: "작업 내용", icon: "📝" },
      { label: "참여자", icon: "👥" },
      { label: "댓글 · 논의", icon: "💬" },
      { label: "첨부파일 · 링크", icon: "📎" },
      { label: "AI 요약 · 다음 액션", icon: "✨" },
      { label: "활동 로그", icon: "🕒" },
    ];

    return (
      <aside className={`${sidebarBaseClass} ${translateClass}`}>
        <button type="button" onClick={onClose} aria-label="메뉴 닫기" className="md:hidden absolute top-4 right-4 text-white/90 hover:text-white p-1">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        {/* 로고 영역 */}
        <div className="mb-6 md:mb-10 pr-8 md:pr-0">
          <h1
            onClick={() => router.push("/")}
            className="text-white text-2xl font-bold italic flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
          >
            <span className="text-3xl"></span>
            Work Together
          </h1>
        </div>

        {/* 메뉴 리스트 */}
        <nav className="flex-1 space-y-2">
          {taskDetailMenus.map((menu) => (
            <button
              key={menu.label}
              onClick={() => {
                onClose?.();
                onMenuClick?.(menu.label);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 ${
                activeMenu === menu.label
                  ? "bg-white text-[#7F55B1] shadow-lg font-semibold"
                  : "text-white/90 hover:bg-white/20"
              }`}
            >
              <span>{menu.icon}</span>
              {menu.label}
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

  // 업무 폼 페이지 사이드바
  if (variant === "task-form") {
    return (
      <aside className={`${sidebarBaseClass} ${translateClass}`}>
        <button type="button" onClick={onClose} aria-label="메뉴 닫기" className="md:hidden absolute top-4 right-4 text-white/90 hover:text-white p-1">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        {/* 로고 영역 */}
        <div className="mb-6 md:mb-10 pr-8 md:pr-0">
          <h1 className="text-white text-2xl font-bold italic flex items-center gap-2">
            <span className="text-3xl"></span>
            Work Together
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
