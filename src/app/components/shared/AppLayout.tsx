"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Sidebar, { SidebarVariant } from "./Sidebar";
import AppHeader, { AppHeaderProps } from "./AppHeader";
import { useAuthStore } from "@/app/stores/authStore";
import { useNotificationStore } from "@/app/stores/notificationStore";
import { chatWebSocketClient } from "@/lib/websocket/chatClient";

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
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const pathname = usePathname();
  const setHasNewMessage = useNotificationStore(
    (state) => state.setHasNewMessage
  );
  const wsClientRef = useRef(chatWebSocketClient);
  const messageHandlerRef = useRef<((message: any) => void) | null>(null);
  const connectHandlerRef = useRef<(() => void) | null>(null);

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
        if (["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(role)) {
          const store = useNotificationStore.getState();
          store.setHasPendingLeaveRequest(true);
          store.setPendingLeaveRequestCount(store.pendingLeaveRequestCount + 1);
        }
      } else if (message.type === "github_activity" && message.data) {
        // GitHub 활동 알림 (실시간 업데이트를 위해 이벤트 발생)
        // GitHubActivityWidget에서 처리하도록 이벤트 발생
        console.log("[AppLayout] GitHub 활동 이벤트 dispatch:", message.data);
        window.dispatchEvent(
          new CustomEvent("github_activity", { detail: message.data })
        );
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex">
      {/* 좌측 사이드바 */}
      <Sidebar
        activeMenu={activeMenu}
        onMenuClick={onMenuClick}
        variant={sidebarVariant}
      />

      {/* 메인 컨텐츠 영역 */}
      <main className="flex-1 p-4 overflow-auto">
        {/* 상단바 */}
        <AppHeader {...headerProps} />

        {/* 컨텐츠 */}
        {children}
      </main>
    </div>
  );
}
