"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/app/stores/authStore";
import { getTasks, Task } from "@/lib/api/tasks";
import { getTeamMembers, TeamMember } from "@/lib/api/users";

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const loginStatus = searchParams.get("login");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);

  const login = useAuthStore((state) => state.login);
  const [tasks, setTasks] = useState<Task[]>([]);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);

  // 팀원 목록 상태
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  // 사이드바 메뉴 선택 상태
  const [activeMenu, setActiveMenu] = useState("진행중인 업무");

  // 업무 상태 탭
  const [activeTab, setActiveTab] = useState<"IN_PROGRESS" | "COMPLETED">(
    "IN_PROGRESS"
  );

  const goToTeamJoin = () => {
    router.push("/team/join");
  };

  const goToTeamCreate = () => {
    router.push("/team/create");
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const getMyRoleInTask = (task: Task): "담당자" | "참여자" | null => {
    if (task.assigneeId === user?.id) return "담당자";

    const isParticipant = task.participants?.some(
      (p) => p.userId === user?.id && p.role !== "OWNER"
    );
    if (isParticipant) return "참여자";

    return null;
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

  const getPriorityLabel = (priority: string) => {
    const priorityMap: Record<string, { label: string; color: string }> = {
      LOW: { label: "낮음", color: "bg-gray-400" },
      MEDIUM: { label: "보통", color: "bg-blue-400" },
      HIGH: { label: "높음", color: "bg-orange-400" },
      URGENT: { label: "긴급", color: "bg-red-500" },
    };
    return priorityMap[priority] || { label: priority, color: "bg-gray-400" };
  };

  // 업무 조회
  useEffect(() => {
    const fetchTasks = async () => {
      if (!isLoggedIn || !user?.teamName) {
        setTasks([]);
        setTasksLoading(false);
        return;
      }

      try {
        setTasksLoading(true);
        const data = await getTasks();
        setTasks(data);
      } catch (error) {
        setTasks([]);
        if (process.env.NODE_ENV === "development") {
          console.error("업무 조회 실패:", error);
        }
      } finally {
        setTasksLoading(false);
      }
    };

    fetchTasks();
  }, [isLoggedIn, user?.teamName]);

  // 팀원 목록 조회
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!isLoggedIn || !user?.teamName) {
        setTeamMembers([]);
        return;
      }

      try {
        setMembersLoading(true);
        const data = await getTeamMembers();
        setTeamMembers(data);
      } catch (error) {
        setTeamMembers([]);
        if (process.env.NODE_ENV === "development") {
          console.error("팀원 조회 실패:", error);
        }
      } finally {
        setMembersLoading(false);
      }
    };

    fetchTeamMembers();
  }, [isLoggedIn, user?.teamName]);

  // 로그인 처리
  useEffect(() => {
    if (loginStatus === "success") {
      const token = searchParams.get("token");
      const userInfo = searchParams.get("user");

      if (token) {
        let user = null;
        if (userInfo) {
          try {
            user = JSON.parse(decodeURIComponent(userInfo));
          } catch (e) {
            console.error("Failed to parse user info", e);
          }
        }

        if (user) {
          login(
            {
              ...user,
              role: user.role as
                | "MEMBER"
                | "TEAM_LEAD"
                | "MANAGER"
                | "DIRECTOR",
            },
            token
          );
        } else {
          login(
            {
              id: "temp-id",
              email: "user@example.com",
              name: "User",
              picture: "picture",
              role: "MEMBER",
              teamName: "TEAMNAME",
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            token
          );
        }

        setShowSuccessMessage(true);
        router.replace("/");

        setTimeout(() => {
          setShowSuccessMessage(false);
        }, 3000);
      }
    }
  }, [loginStatus, router, login]);

  const loginAction = () => {
    router.push("/auth/login");
  };

  const workAssignment = () => {
    router.push("/manager/tasks");
  };

  // 상태별 업무 필터링
  const filteredTasks = tasks.filter((task) => {
    if (activeMenu === "진행중인 업무") return task.status === "IN_PROGRESS";
    if (activeMenu === "완료된 업무") return task.status === "COMPLETED";
    if (activeMenu === "요청사항") return task.status === "PENDING";
    return true;
  });

  // 탭별 업무 필터링
  const inProgressTasks = tasks.filter(
    (t) => t.status === "IN_PROGRESS" || t.status === "PENDING"
  );
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED");
  const displayTasks =
    activeTab === "IN_PROGRESS" ? inProgressTasks : completedTasks;

  // 로그인 안 된 경우
  if (!hasHydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center">
        <div className="text-[#7F55B1] text-lg">로딩 중...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-xl p-12 text-center max-w-md">
          <div className="w-20 h-20 bg-gradient-to-br from-[#7F55B1] to-purple-400 rounded-2xl mx-auto mb-6 flex items-center justify-center">
            <span className="text-white text-3xl">📋</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-3">
            업무 관리 시스템
          </h1>
          <p className="text-gray-500 mb-8">
            로그인하시면 오늘의 업무를 확인할 수 있습니다.
          </p>
          <button
            onClick={loginAction}
            className="w-full py-3 bg-gradient-to-r from-[#7F55B1] to-purple-400 text-white rounded-xl font-medium hover:from-[#6B479A] hover:to-purple-500 transition-all shadow-lg hover:shadow-xl"
          >
            로그인하기
          </button>
        </div>
      </div>
    );
  }

  // 팀에 가입되지 않은 경우
  if (!user?.teamName) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center">
        <div className="bg-white rounded-3xl shadow-xl p-12 text-center max-w-md">
          <div className="w-20 h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl mx-auto mb-6 flex items-center justify-center">
            <span className="text-white text-3xl">👥</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">
            팀 가입이 필요합니다
          </h2>
          <p className="text-gray-500 mb-8">
            업무를 확인하고 관리하려면 먼저 팀에 가입해주세요.
          </p>
          <button
            onClick={goToTeamJoin}
            className="w-full py-3 bg-gradient-to-r from-[#7F55B1] to-purple-400 text-white rounded-xl font-medium hover:from-[#6B479A] hover:to-purple-500 transition-all shadow-lg hover:shadow-xl mb-4"
          >
            팀 가입하기
          </button>
          <p className="text-gray-400 text-sm mb-3">
            팀을 새로 만들어야 한다면?
          </p>
          <button
            onClick={goToTeamCreate}
            className="w-full py-3 bg-white border-2 border-[#7F55B1] text-[#7F55B1] rounded-xl font-medium hover:bg-violet-50 transition-all"
          >
            팀 생성하기
          </button>
          <button
            onClick={handleLogout}
            className="w-full py-3 bg-white border-2 border-[#7F55B1] text-[#FF4646] rounded-xl font-medium hover:bg-violet-50 transition-all"
          >
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  // 로그인 + 팀 가입된 경우 - 메인 대시보드
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex">
      {/* 좌측 사이드바 */}
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
          {["진행중인 업무", "완료된 업무", "요청사항"].map((menu) => (
            <button
              key={menu}
              onClick={() => setActiveMenu(menu)}
              className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 ${
                activeMenu === menu
                  ? "bg-white text-[#7F55B1] shadow-lg font-semibold"
                  : "text-white/90 hover:bg-white/20"
              }`}
            >
              <span>
                {menu === "진행중인 업무" && "🔄"}
                {menu === "완료된 업무" && "✅"}
                {menu === "요청사항" && "📝"}
              </span>
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

      {/* 메인 컨텐츠 영역 */}
      <main className="flex-1 p-4 overflow-auto">
        {/* 상단바 */}
        <header className="bg-white rounded-2xl px-6 py-4 mb-4 shadow-sm flex items-center justify-between">
          {/* 좌측: Home 버튼 */}
          <button
            onClick={() => router.push("/")}
            className="flex items-center gap-2 text-gray-600 hover:text-[#7F55B1] transition-colors"
          >
            <span className="text-xl">🏠</span>
            <span className="font-medium">Home</span>
          </button>

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

        {/* 컨텐츠 그리드 */}
        <div className="grid grid-cols-3 gap-4">
          {/* 좌측 컬럼 (2/3) */}
          <div className="col-span-2 space-y-4">
            {/* Today's Tasks 요약 카드 */}
            <div className="bg-gradient-to-br from-[#7F55B1] to-purple-400 rounded-3xl p-6 text-white shadow-xl">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-purple-200 text-sm mb-1">
                    Today&apos;s Tasks
                  </h2>
                  <div className="flex items-end gap-2">
                    <span className="text-5xl font-bold">{tasks.length}</span>
                    <span className="text-xl mb-1">건</span>
                  </div>
                </div>

                {/* 업무 전달 버튼 (팀장 이상만) */}
                {user.role !== "MEMBER" && (
                  <button
                    onClick={workAssignment}
                    className="px-4 py-2 bg-white text-[#7F55B1] rounded-xl font-medium hover:bg-purple-50 transition-colors text-sm"
                  >
                    + 업무 전달하기
                  </button>
                )}
              </div>
            </div>

            {/* 진행중/완료 탭 섹션 */}
            <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
              {/* 탭 헤더 */}
              <div className="flex border-b border-gray-100">
                <button
                  onClick={() => setActiveTab("IN_PROGRESS")}
                  className={`flex-1 py-4 px-6 text-center font-medium transition-all ${
                    activeTab === "IN_PROGRESS"
                      ? "text-[#7F55B1] border-b-2 border-[#7F55B1] bg-purple-50"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>🔄</span>
                    <span>진행중</span>
                    <span className="px-2 py-0.5 bg-[#7F55B1] text-white text-xs rounded-full">
                      {inProgressTasks.length}
                    </span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab("COMPLETED")}
                  className={`flex-1 py-4 px-6 text-center font-medium transition-all ${
                    activeTab === "COMPLETED"
                      ? "text-[#7F55B1] border-b-2 border-[#7F55B1] bg-purple-50"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>✅</span>
                    <span>완료</span>
                    <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                      {completedTasks.length}
                    </span>
                  </div>
                </button>
              </div>

              {/* 업무 목록 */}
              <div className="p-6 min-h-[400px] max-h-[500px] overflow-auto">
                {tasksLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="text-gray-400">로딩 중...</div>
                  </div>
                ) : displayTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                    <span className="text-4xl mb-2">
                      {activeTab === "IN_PROGRESS" ? "📭" : "🎉"}
                    </span>
                    <p>
                      {activeTab === "IN_PROGRESS"
                        ? "진행중인 업무가 없습니다."
                        : "완료된 업무가 없습니다."}
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {displayTasks.map((task) => {
                      const myRole = getMyRoleInTask(task);
                      return (
                        <li
                          onClick={() => router.push(`/tasksDetail/${task.id}`)}
                          key={task.id}
                          className="p-4 bg-gray-50 rounded-2xl hover:bg-purple-50 transition-colors cursor-pointer border border-gray-100"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    getPriorityLabel(task.priority).color
                                  }`}
                                ></span>
                                <h4 className="font-semibold text-gray-800">
                                  {task.title}
                                </h4>
                              </div>
                              {task.description && (
                                <p className="text-gray-500 text-sm mb-2 line-clamp-2">
                                  {task.description}
                                </p>
                              )}
                              <div className="flex items-center gap-4 text-xs text-gray-400">
                                {task.dueDate && (
                                  <span className="flex items-center gap-1">
                                    📅{" "}
                                    {new Date(
                                      task.dueDate
                                    ).toLocaleDateString()}
                                  </span>
                                )}
                                <span className="flex items-center gap-1">
                                  🏷️ {getPriorityLabel(task.priority).label}
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  activeTab === "IN_PROGRESS"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-green-100 text-green-700"
                                }`}
                              >
                                {activeTab === "IN_PROGRESS"
                                  ? "진행중"
                                  : "완료"}
                              </span>
                            </div>
                          </div>
                          {myRole && (
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                myRole === "담당자"
                                  ? "bg-purple-100 text-purple-700"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {myRole}
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* 우측 컬럼 (1/3) */}
          <div className="space-y-4">
            {/* 내 정보 카드 */}
            <div className="bg-white rounded-3xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-800">내 정보</h3>
                <span className="text-gray-400 text-sm">{user.teamName}</span>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 bg-gradient-to-br from-[#7F55B1] to-purple-400 rounded-full flex items-center justify-center mb-3">
                  <span className="text-white text-2xl">
                    {user.name?.charAt(0) || "U"}
                  </span>
                </div>
                <p className="font-semibold text-gray-800">{user.name}</p>
                <p className="text-gray-400 text-sm">{user.email}</p>
              </div>
            </div>
            {/* 업무 통계 카드 */}
            <div className="bg-white rounded-3xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4">업무 현황</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span>🔄</span>
                    <span className="text-sm text-gray-600">진행중</span>
                  </div>
                  <span className="font-bold text-yellow-600">
                    {inProgressTasks.length}건
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span>✅</span>
                    <span className="text-sm text-gray-600">완료</span>
                  </div>
                  <span className="font-bold text-green-600">
                    {completedTasks.length}건
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span>📝</span>
                    <span className="text-sm text-gray-600">요청</span>
                  </div>
                  <span className="font-bold text-blue-600">
                    {tasks.filter((t) => t.status === "PENDING").length}건
                  </span>
                </div>
              </div>
            </div>

            {/* 팀원 목록 (Group) */}
            <div className="bg-white rounded-3xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-800">Group</h3>
                <button className="text-gray-400 text-sm hover:text-[#7F55B1]">
                  ⋮
                </button>
              </div>

              {membersLoading ? (
                <p className="text-gray-400 text-sm">로딩 중...</p>
              ) : teamMembers.length === 0 ? (
                <p className="text-gray-400 text-sm">팀원이 없습니다.</p>
              ) : (
                <ul className="space-y-3">
                  {teamMembers.slice(0, 5).map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center">
                          <span className="text-gray-600 text-sm">
                            {member.name?.charAt(0) || "?"}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-800 text-sm">
                            {member.name}
                          </p>
                          <p className="text-gray-400 text-xs">
                            {getRoleLabel(member.role)}
                          </p>
                        </div>
                      </div>
                      <span className="w-6 h-6 bg-[#7F55B1] text-white text-xs rounded-full flex items-center justify-center">
                        1
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 성공 메시지 */}
      {showSuccessMessage && (
        <div className="fixed top-20 right-4 bg-gradient-to-r from-[#7F55B1] to-purple-400 text-white px-6 py-3 rounded-xl shadow-lg z-50">
          로그인이 완료되었습니다!
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center">
          <div className="text-[#7F55B1] text-lg">로딩 중...</div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
