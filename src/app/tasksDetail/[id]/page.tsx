// 업무 상세 페이지
"use client";

import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/app/stores/authStore";
import TaskDetail from "@/app/components/features/task/TaskDetail";
import AppLayout from "@/app/components/shared/AppLayout";

export default function TasksDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);

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
      sidebarVariant="task-detail"
      headerProps={{
        showBackButton: true,
        onBackClick: () => router.back(),
      }}
    >
      {/* 컨텐츠 영역 - TaskDetail 컴포넌트 */}
      <TaskDetail taskId={params.id} />
    </AppLayout>
  );
}
