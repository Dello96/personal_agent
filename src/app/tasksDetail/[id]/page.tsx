// 업무 상세 페이지
"use client";

import { useRouter, useParams } from "next/navigation";
import { useAuthStore } from "@/app/stores/authStore";
import TaskDetail from "@/app/components/features/task/TaskDetail";

export default function TasksDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const getRoleLabel = (role: string) => {
    const roleMap: Record<string, string> = {
      MEMBER: "팀원",
      TEAM_LEAD: "팀장",
      MANAGER: "매니저",
      DIRECTOR: "임원",
    };
    return roleMap[role] || role;
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
  if (!isLoggedIn || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-xl p-12 text-center max-w-md">
          <p className="text-gray-500 mb-4">로그인이 필요합니다.</p>
          <button
            onClick={() => router.push("/auth/login")}
            className="px-6 py-3 bg-gradient-to-r from-[#7F55B1] to-purple-400 text-white rounded-xl"
          >
            로그인하기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex">
      {/* 좌측 사이드바 */}
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

      {/* 메인 컨텐츠 영역 */}
      <main className="flex-1 p-4 overflow-auto">
        {/* 상단바 */}
        <header className="bg-white rounded-2xl px-6 py-4 mb-4 shadow-sm flex items-center justify-between">
          {/* 좌측: 뒤로가기 + Home 버튼 */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-[#7F55B1] transition-colors"
            >
              <span className="text-xl">←</span>
              <span className="font-medium">뒤로</span>
            </button>
            <button
              onClick={() => router.push("/")}
              className="flex items-center gap-2 text-gray-600 hover:text-[#7F55B1] transition-colors"
            >
              <span className="text-xl">🏠</span>
              <span className="font-medium">Home</span>
            </button>
          </div>

          {/* 우측: 직급, 마이페이지, 로그아웃 */}
          <div className="flex items-center gap-4">
            {/* 직급 표시 */}
            <span className="px-4 py-2 bg-gradient-to-r from-[#7F55B1] to-purple-400 text-white rounded-full text-sm font-medium">
              {getRoleLabel(user.role)}
            </span>

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

        {/* 컨텐츠 영역 - TaskDetail 컴포넌트 */}
        <TaskDetail taskId={params.id} />
      </main>
    </div>
  );
}
