// 업무 상세 페이지
"use client";

import { useRouter, useParams } from "next/navigation";
import { useState } from "react";
import { useAuthStore } from "@/app/stores/authStore";
import TaskDetail, {
  type TaskDetailTab,
} from "@/app/components/features/task/TaskDetail";
import AppLayout from "@/app/components/shared/AppLayout";

export default function TasksDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);
  const [activeTaskDetailMenu, setActiveTaskDetailMenu] =
    useState<TaskDetailTab>("overview");

  const tabLabelMap: Record<string, TaskDetailTab> = {
    개요: "overview",
    "작업 내용": "work",
    참여자: "members",
    "댓글 · 논의": "discussion",
    "첨부파일 · 링크": "resources",
    "AI 요약 · 다음 액션": "ai",
    "활동 로그": "activity",
  };

  const activeMenuLabelMap: Record<TaskDetailTab, string> = {
    overview: "개요",
    work: "작업 내용",
    members: "참여자",
    discussion: "댓글 · 논의",
    resources: "첨부파일 · 링크",
    ai: "AI 요약 · 다음 액션",
    activity: "활동 로그",
  };

  const handleTaskDetailSidebarMenu = (menu: string) => {
    const nextTab = tabLabelMap[menu];
    if (nextTab) {
      setActiveTaskDetailMenu(nextTab);
    }
  };

  // 로딩 중
  if (!hasHydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center">
        <div className="text-[#7F55B1] text-lg">로딩 중...</div>
      </div>
    );
  }

  // 로그인 안 된 경우
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl p-6 md:p-12 text-center max-w-md w-full">
          <p className="text-gray-500 mb-4 text-sm md:text-base">로그인이 필요합니다.</p>
          <button
            onClick={() => router.push("/auth/login")}
            className="px-4 md:px-6 py-2.5 md:py-3 bg-gradient-to-r from-[#7F55B1] to-purple-400 text-white rounded-xl text-sm md:text-base"
          >
            로그인하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <AppLayout
      activeMenu={activeMenuLabelMap[activeTaskDetailMenu]}
      onMenuClick={handleTaskDetailSidebarMenu}
      sidebarVariant="task-detail"
      headerProps={{
        showBackButton: true,
        onBackClick: () => router.back(),
      }}
    >
      {/* 컨텐츠 영역 - TaskDetail 컴포넌트 */}
      <TaskDetail
        taskId={params.id}
        activeTab={activeTaskDetailMenu}
        onTabChange={setActiveTaskDetailMenu}
      />
    </AppLayout>
  );
}
