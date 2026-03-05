"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar, { SidebarVariant } from "./Sidebar";
import AppHeader, { AppHeaderProps } from "./AppHeader";
import { useAuthStore } from "@/app/stores/authStore";
import { useNotificationStore } from "@/app/stores/notificationStore";
import { chatWebSocketClient } from "@/lib/websocket/chatClient";
import {
  getNotifications,
  markNotificationRead,
  type Notification,
} from "@/lib/api/notifications";

interface AppLayoutProps {
  children: React.ReactNode;
  activeMenu?: string;
  onMenuClick?: (menu: string) => void;
  sidebarVariant?: SidebarVariant;
  headerProps?: AppHeaderProps;
}

export default function AppLayout({
  children,
  activeMenu,
  onMenuClick,
  sidebarVariant = "default",
  headerProps,
}: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [meetingReminderModal, setMeetingReminderModal] =
    useState<Notification | null>(null);
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const pathname = usePathname();
  const setHasNewMessage = useNotificationStore(
    (state) => state.setHasNewMessage
  );
  const wsClientRef = useRef(chatWebSocketClient);
  const messageHandlerRef = useRef<((message: any) => void) | null>(null);
  const connectHandlerRef = useRef<(() => void) | null>(null);
  const shownMeetingReminderIdsRef = useRef<Set<string>>(new Set());

  // 전역 WebSocket 연결 및 알림 처리
  useEffect(() => {
    if (!token || !user) {
      return;
    }

    const wsClient = wsClientRef.current;
    const isChatPage = pathname === "/chat";

    // 메시지 핸들러: 채팅 페이지가 아닐 때만 알림 표시
    const handleMessage = (message: any) => {
      if (message.type === "message" && message.data) {
        const newMsg = message.data;
        // 본인이 보낸 메시지가 아니고, 채팅 페이지가 아닐 때만 알림 표시
        if (newMsg.senderId !== user.id && !isChatPage) {
          setHasNewMessage(true);
        }
      } else if (message.type === "leave_request" && message.data) {
        // 연차/휴가 신청 알림 (팀장 이상만)
        const { role } = user;
        if (role === "TEAM_LEAD") {
          const store = useNotificationStore.getState();
          store.setHasPendingLeaveRequest(true);
          store.setPendingLeaveRequestCount(store.pendingLeaveRequestCount + 1);
        }
      } else if (message.type === "github_activity" && message.data) {
        // GitHub 활동 알림 (실시간 업데이트를 위해 이벤트 발생)
        window.dispatchEvent(
          new CustomEvent("github_activity", { detail: message.data })
        );
      } else if (message.type === "figma_activity" && message.data) {
        // Figma 활동 알림 (FigmaActivityWidget에서 구독)
        window.dispatchEvent(
          new CustomEvent("figma_activity", { detail: message.data })
        );
      } else if (message.type === "notification_update") {
        // 알림 센터 갱신 이벤트
        window.dispatchEvent(new CustomEvent("notification_update"));
      }
    };

    // 전역 알림 핸들러 등록
    wsClient.onMessage(handleMessage);
    messageHandlerRef.current = handleMessage;

    // 연결 콜백은 한 번만 등록 (중복 방지)
    if (!connectHandlerRef.current) {
      const connectHandler = () => {
        if (user.teamName) {
          // 팀 채팅방에 참여 (roomId는 빈 문자열, 서버에서 팀 ID로 찾음)
          wsClient.joinRoom("", "TEAM");
        }
      };
      wsClient.onConnect(connectHandler);
      connectHandlerRef.current = connectHandler;
    }

    // WebSocket 연결 (이미 연결되어 있으면 스킵)
    if (!wsClient.isConnected()) {
      wsClient.connect(token);
    } else {
      // 이미 연결되어 있으면 팀 채팅방 참여 확인
      if (user.teamName) {
        wsClient.joinRoom("", "TEAM");
      }
    }

    // 컴포넌트 언마운트 시 정리하지 않음 (전역 연결 유지)
    return () => {
      // 메시지 핸들러는 유지 (다른 컴포넌트에서도 사용할 수 있음)
    };
  }, [token, user, setHasNewMessage, pathname]);

  const handleMenuClick = (menu: string) => {
    setSidebarOpen(false);
    if (onMenuClick) {
      onMenuClick(menu);
      return;
    }

    // onMenuClick을 전달하지 않은 페이지에서도 기본 사이드바 라우팅이 동작하도록 fallback 제공
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
  };

  useEffect(() => {
    if (!token || !user) return;

    let disposed = false;

    const parseDateFromLink = (link: string | null | undefined, key: string) => {
      if (!link) return null;
      try {
        const fakeUrl = link.startsWith("http")
          ? link
          : `http://local${link.startsWith("/") ? "" : "/"}${link}`;
        const parsed = new URL(fakeUrl);
        const value = parsed.searchParams.get(key);
        if (!value) return null;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
      } catch {
        return null;
      }
    };

    const syncMeetingReminder = async () => {
      try {
        const unread = await getNotifications({ unread: true, limit: 30 });

        const meetingReminders = unread.filter(
          (item) => item.type === "meeting_reminder"
        );

        const now = new Date();
        const validReminders = [];
        const expiredReminders = [];

        for (const reminder of meetingReminders) {
          const endAt = parseDateFromLink(reminder.link, "endAt");
          if (endAt && endAt.getTime() <= now.getTime()) {
            expiredReminders.push(reminder);
          } else {
            validReminders.push(reminder);
          }
        }

        if (expiredReminders.length > 0) {
          await Promise.all(
            expiredReminders.map((reminder) => markNotificationRead(reminder.id))
          );
          window.dispatchEvent(new CustomEvent("notification_update"));
        }

        const meetingReminder = validReminders.find(
          (item) => !shownMeetingReminderIdsRef.current.has(item.id)
        );

        if (meetingReminder && !disposed) {
          shownMeetingReminderIdsRef.current.add(meetingReminder.id);
          setMeetingReminderModal(meetingReminder);
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("회의 리마인드 알림 조회 실패:", error);
        }
      }
    };

    syncMeetingReminder();
    const interval = setInterval(syncMeetingReminder, 15000);

    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, [token, user]);

  const closeMeetingReminderModal = async () => {
    if (!meetingReminderModal) return;
    try {
      await markNotificationRead(meetingReminderModal.id);
      window.dispatchEvent(new CustomEvent("notification_update"));
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("회의 알림 읽음 처리 실패:", error);
      }
    } finally {
      setMeetingReminderModal(null);
    }
  };

  const moveToMeetingRoom = async () => {
    if (!meetingReminderModal) return;

    const link = meetingReminderModal.link || "/calendar";
    await closeMeetingReminderModal();
    router.push(link);
  };

  return (
    <div className="bg-gradient-to-br from-violet-50 to-purple-100 flex flex-col md:flex-row min-h-screen">
      {/* 모바일: 사이드바 열릴 때 배경 오버레이 */}
      <div
        role="button"
        tabIndex={0}
        aria-label="메뉴 닫기"
        onClick={() => setSidebarOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setSidebarOpen(false)}
        className={`fixed inset-0 z-30 bg-black/50 md:hidden transition-opacity ${
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* 좌측 사이드바: 모바일에서 드로어, md 이상에서 항상 표시 */}
      <Sidebar
        activeMenu={activeMenu}
        onMenuClick={handleMenuClick}
        variant={sidebarVariant}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* 메인 컨텐츠 영역 */}
      <main className="flex-1 p-3 md:p-4 overflow-hidden flex flex-col min-h-0 w-full min-w-0">
        {/* 상단바 */}
        <AppHeader
          {...headerProps}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />

        {/* 컨텐츠 */}
        <div className="flex-1 min-h-0 overflow-hidden overflow-x-auto">
          {children}
        </div>
      </main>

      {meetingReminderModal && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {meetingReminderModal.title || "회의 알림"}
            </h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap mb-6">
              {meetingReminderModal.message ||
                "곧 회의가 시작됩니다. 회의실로 이동하시겠어요?"}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={moveToMeetingRoom}
                className="flex-1 px-4 py-2 bg-[#7F55B1] text-white rounded-lg hover:bg-[#6B479A] transition-colors"
              >
                회의실로 이동
              </button>
              <button
                type="button"
                onClick={closeMeetingReminderModal}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
