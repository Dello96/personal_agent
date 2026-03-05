"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/app/stores/authStore";
import { getTasks, Task } from "@/lib/api/tasks";
import { TeamMember } from "@/lib/api/users";
import { getCurrentTeamMembers, getCurrentTeamMembersOnline } from "@/lib/api/team";
import Image from "next/image";
import AppLayout from "@/app/components/shared/AppLayout";
import LoginContent from "@/app/components/features/auth/LoginContent";
import { getRoleLabel, getRoleRank } from "@/lib/utils/roleUtils";
import GithubActivityWidget from "@/app/components/features/github/GithubActivityWidget";
import FigmaActivityWidget from "@/app/components/features/figma/FigmaActivityWidget";
import Weather from "./components/features/weather/Weather";

function HomeContent() {
  const leftMenus = ["진행중인 업무", "일정", "채팅"];
  const searchParams = useSearchParams();
  const router = useRouter();
  const loginStatus = searchParams.get("login");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [showEmailLogin, setShowEmailLogin] = useState(false);

  const login = useAuthStore((state) => state.login);
  const [tasks, setTasks] = useState<Task[]>([]);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);
  const formatRelativeTime = (
    dateString: string | null | undefined
  ): string => {
    if (!dateString) return "";

    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffDays > 0) return `${diffDays}일 전`;
    if (diffHours > 0) return `${diffHours}시간 전`;
    if (diffMinutes > 0) return `${diffMinutes}분 전`;
    return "방금 전";
  };

  // 팀원 목록 상태
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [teamMembersOnlineMap, setTeamMembersOnlineMap] = useState<
    Record<string, boolean>
  >({});

  // 사이드바 메뉴 선택 상태
  const [activeMenu, setActiveMenu] = useState("진행중인 업무");

  // 업무 상태 탭 (PENDING 제거 - 업무는 생성 시 바로 NOW로 시작)
  const [activeTab, setActiveTab] = useState<"NOW" | "REVIEW" | "COMPLETED">(
    "NOW"
  );
  const [taskSearch, setTaskSearch] = useState("");
  const [taskSort, setTaskSort] = useState<
    "new" | "old" | "due_asc" | "due_desc" | "priority"
  >("new");

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

  const handleOpenEmailLogin = () => {
    setShowEmailLogin(true);
  };

  const getMyRoleInTask = (task: Task): "담당자" | "참여자" | null => {
    if (task.assigneeId === user?.id) return "담당자";

    const isParticipant = task.participants?.some(
      (p) => p.userId === user?.id && p.role !== "OWNER"
    );
    if (isParticipant) return "참여자";

    return null;
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

  // 팀원 목록 조회 (Group 칸) — GET /api/users/team-members (현재 로그인 팀만 반환)
  useEffect(() => {
    const fetchTeamMembers = async () => {
      if (!isLoggedIn || !user?.teamName) {
        setTeamMembers([]);
        return;
      }

      try {
        setMembersLoading(true);
        const data = await getCurrentTeamMembers();
        const sorted = [...data].sort((a, b) => {
          const rankDiff = getRoleRank(b.role) - getRoleRank(a.role);
          if (rankDiff !== 0) return rankDiff;
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
        setTeamMembers(sorted);
      } catch (error) {
        setTeamMembers([]);
        if (process.env.NODE_ENV === "development") {
          console.error("[Group] 팀원 조회 실패:", error);
        }
      } finally {
        setMembersLoading(false);
      }
    };

    fetchTeamMembers();
  }, [isLoggedIn, user?.teamName]);

  // 팀원 온라인 상태 조회 (초록불 인디케이터용)
  useEffect(() => {
    if (!isLoggedIn || !user?.teamName) {
      setTeamMembersOnlineMap({});
      return;
    }

    let disposed = false;

    const fetchOnlineStatus = async () => {
      try {
        const map = await getCurrentTeamMembersOnline();
        if (!disposed) {
          setTeamMembersOnlineMap(map);
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("[Group] 팀원 온라인 상태 조회 실패:", error);
        }
      }
    };

    fetchOnlineStatus();
    const interval = setInterval(fetchOnlineStatus, 10000);

    return () => {
      disposed = true;
      clearInterval(interval);
    };
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
                | "INTERN"
                | "STAFF"
                | "ASSOCIATE"
                | "ASSISTANT_MANAGER"
                | "TEAM_LEAD",
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
              role: "INTERN",
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

  const handleLeftMenu = (menu: string) => {
    setActiveMenu(menu);
    if (menu === "일정") {
      router.push("/calendar");
    } else if (menu === "채팅") {
      router.push("/chat");
    } else if (menu === "회의록") {
      router.push("/meeting-notes");
    } else if (menu === "진행중인 업무") {
      router.push("/");
    } else if (menu === "팀 관리") {
      router.push("/manager/team");
    }
  };

  const workAssignment = () => {
    router.push("/manager/tasks");
  };

  // 상태별 업무 필터링 (PENDING 제거)
  const filteredTasks = tasks.filter((task) => {
    if (activeMenu === "진행중인 업무") return task.status === "IN_PROGRESS";
    if (activeMenu === "완료된 업무") return task.status === "COMPLETED";
    return true;
  });

  // 탭별 업무 필터링 (PENDING 제거)
  const nowTasks = tasks.filter((t) => t.status === "NOW"); // 진행중
  const completedTasks = tasks.filter((t) => t.status === "COMPLETED"); // 완료
  const reviewTasks = tasks.filter((t) => t.status === "REVIEW"); //리뷰
  const endingTasks = tasks.filter((t) => t.status === "ENDING"); //종료
  const baseTasks =
    activeTab === "NOW"
      ? nowTasks
      : activeTab === "REVIEW"
        ? reviewTasks
        : endingTasks;
  const normalizedSearch = taskSearch.trim().toLowerCase();
  const searchedTasks = normalizedSearch
    ? baseTasks.filter((task) => {
        const assignee = task.assignee?.name || "";
        const assigner = task.assigner?.name || "";
        const participants =
          task.participants?.map((p) => p.user?.name || "").join(" ") || "";
        const target =
          `${task.title} ${task.description ?? ""} ${assignee} ${assigner} ${participants}`.toLowerCase();
        return target.includes(normalizedSearch);
      })
    : baseTasks;

  const priorityRank: Record<string, number> = {
    URGENT: 4,
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };
  const displayTasks = [...searchedTasks].sort((a, b) => {
    if (taskSort === "new") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (taskSort === "old") {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (taskSort === "due_asc") {
      const aTime = a.dueDate
        ? new Date(a.dueDate).getTime()
        : Number.MAX_SAFE_INTEGER;
      const bTime = b.dueDate
        ? new Date(b.dueDate).getTime()
        : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    }
    if (taskSort === "due_desc") {
      const aTime = a.dueDate ? new Date(a.dueDate).getTime() : 0;
      const bTime = b.dueDate ? new Date(b.dueDate).getTime() : 0;
      return bTime - aTime;
    }
    if (taskSort === "priority") {
      return (priorityRank[b.priority] || 0) - (priorityRank[a.priority] || 0);
    }
    return 0;
  });

  // 로그인 안 된 경우
  if (!hasHydrated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center">
        <div className="text-[#7F55B1] text-lg">로딩 중...</div>
      </div>
    );
  }

  if (!isLoggedIn) {
    // 이메일 로그인: TaskFlow 흰 카드 안에 뒤로가기 포함, 가로 폭 넓게
    if (showEmailLogin) {
      return (
        <LoginContent
          showBackButton
          onBack={() => setShowEmailLogin(false)}
        />
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl p-6 sm:p-8 md:p-12 text-center max-w-md w-full">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-[#7F55B1] to-purple-400 rounded-xl md:rounded-2xl mx-auto mb-4 md:mb-6 flex items-center justify-center">
            <span className="text-white text-2xl md:text-3xl">📋</span>
          </div>
          <h1 className="text-xl md:text-2xl font-bold text-gray-800 mb-2 md:mb-3">
            Work Together
          </h1>
          <p className="text-gray-500 text-sm md:text-base mb-6 md:mb-8">
            로그인하시면 오늘의 업무를 확인할 수 있습니다.
          </p>

          <>
            <button
                onClick={handleOpenEmailLogin}
                className="w-full py-3 bg-gradient-to-r from-[#7F55B1] to-purple-400 text-white rounded-xl font-medium hover:from-[#6B479A] hover:to-purple-500 transition-all shadow-lg hover:shadow-xl mb-3 text-sm md:text-base"
              >
                이메일로 로그인하기
              </button>

              <button
                onClick={() => router.push("/auth/register")}
                className="w-full py-3 bg-white border-2 border-[#7F55B1] text-[#7F55B1] rounded-xl font-medium hover:bg-violet-50 transition-all mb-4 md:mb-6 text-sm md:text-base"
              >
                회원가입
              </button>

              {/* 구분선 */}
              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">또는</span>
                </div>
              </div>

              {/* 소셜 로그인 버튼 */}
              <div className="space-y-3">
                <button
                  onClick={() =>
                    (window.location.href = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/login`)
                  }
                  className="w-full py-3 bg-white border border-gray-200 rounded-xl font-medium hover:bg-gray-50 transition-all flex items-center justify-center gap-2"
                >
                  <Image
                    src="/images/web_light_sq_ctn@1x.png"
                    alt="google 로그인"
                    width={183}
                    height={45}
                  />
                </button>
                <button
                  onClick={() =>
                    (window.location.href = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/auth/kakao`)
                  }
                  className="w-full py-3 bg-[#FEE500] text-[#3C1E1E] rounded-xl font-medium hover:bg-[#F5DC00] transition-all flex items-center justify-center gap-2"
                >
                  <Image
                    src="/images/kakao_login_medium_narrow.png"
                    alt="kakao 로그인"
                    width={183}
                    height={45}
                  />
                </button>
              </div>
            </>
        </div>
      </div>
    );
  }

  // 팀에 가입되지 않은 경우
  if (!user?.teamName) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl p-6 sm:p-8 md:p-12 text-center max-w-md w-full">
          <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl md:rounded-2xl mx-auto mb-4 md:mb-6 flex items-center justify-center">
            <span className="text-white text-2xl md:text-3xl">👥</span>
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-2 md:mb-3">
            팀 가입이 필요합니다
          </h2>
          <p className="text-gray-500 text-sm md:text-base mb-6 md:mb-8">
            업무를 확인하고 관리하려면 먼저 팀에 가입해주세요.
          </p>
          <button
            onClick={goToTeamJoin}
            className="w-full py-3 bg-gradient-to-r from-[#7F55B1] to-purple-400 text-white rounded-xl font-medium hover:from-[#6B479A] hover:to-purple-500 transition-all shadow-lg hover:shadow-xl mb-4 text-sm md:text-base"
          >
            팀 가입하기
          </button>
          <p className="text-gray-400 text-xs md:text-sm mb-3">
            팀을 새로 만들어야 한다면?
          </p>
          <button
            onClick={goToTeamCreate}
            className="w-full py-3 bg-white border-2 border-[#7F55B1] text-[#7F55B1] rounded-xl font-medium hover:bg-violet-50 transition-all text-sm md:text-base"
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
    <AppLayout
      activeMenu={activeMenu}
      onMenuClick={handleLeftMenu}
      sidebarVariant="default"
    >
      {/* 컨텐츠 그리드: 모바일 1열, lg 이상 3열 */}
      <div className="h-auto w-full min-w-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 h-full min-h-0">
          {/* 좌측 컬럼 (2/3) */}
          <div className="lg:col-span-2 space-y-3 md:space-y-4 h-full min-h-0 overflow-hidden">
            {/* Today's Tasks 요약 카드 */}
            <div className="bg-gradient-to-br from-[#7F55B1] to-purple-400 rounded-2xl md:rounded-3xl p-4 md:p-6 text-white shadow-xl">
              <div className="flex justify-between items-start gap-2">
                <div>
                  <h2 className="text-purple-200 text-xs md:text-sm mb-1">
                    Today&apos;s Tasks
                  </h2>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl md:text-5xl font-bold">{`${nowTasks.length}`}</span>
                    <span className="text-base md:text-xl mb-1">건</span>
                  </div>
                </div>

                {user.role === "TEAM_LEAD" && (
                  <button
                    onClick={workAssignment}
                    className="px-3 md:px-4 py-1.5 md:py-2 bg-white text-[#7F55B1] rounded-lg md:rounded-xl font-medium hover:bg-purple-50 transition-colors text-xs md:text-sm whitespace-nowrap"
                  >
                    + 업무 만들기
                  </button>
                )}
              </div>
            </div>

            {/* 진행중/완료 탭 섹션 */}
            <div className="bg-white rounded-2xl md:rounded-3xl shadow-sm overflow-hidden">
              {/* 탭 헤더 */}
              <div className="flex border-b border-gray-100">
                {/* 1. 진행중 탭 */}
                <button
                  onClick={() => setActiveTab("NOW")}
                  className={`flex-1 py-3 md:py-4 px-3 md:px-6 text-center font-medium transition-all text-sm md:text-base ${
                    activeTab === "NOW"
                      ? "text-[#7F55B1] border-b-2 border-[#7F55B1] bg-purple-50"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>🔄</span>
                    <span>진행중</span>
                    <span className="px-2 py-0.5 bg-[#7F55B1] text-white text-xs rounded-full">
                      {nowTasks.length}
                    </span>
                  </div>
                </button>

                {/* 2. 리뷰중 탭 */}
                <button
                  onClick={() => setActiveTab("REVIEW")}
                  className={`flex-1 py-3 md:py-4 px-3 md:px-6 text-center font-medium transition-all text-sm md:text-base ${
                    activeTab === "REVIEW"
                      ? "text-[#7F55B1] border-b-2 border-[#7F55B1] bg-purple-50"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>📝</span>
                    <span>리뷰중</span>
                    <span className="px-2 py-0.5 bg-gray-500 text-white text-xs rounded-full">
                      {reviewTasks.length}
                    </span>
                  </div>
                </button>

                {/* 3. 완료 탭 */}
                <button
                  onClick={() => setActiveTab("COMPLETED")}
                  className={`flex-1 py-3 md:py-4 px-3 md:px-6 text-center font-medium transition-all text-sm md:text-base ${
                    activeTab === "COMPLETED"
                      ? "text-[#7F55B1] border-b-2 border-[#7F55B1] bg-purple-50"
                      : "text-gray-400 hover:text-gray-600"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>✅</span>
                    <span>종료</span>
                    <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                      {endingTasks.length}
                    </span>
                  </div>
                </button>
              </div>

              {/* 업무 목록 */}
              <div className="p-3 md:p-6 min-h-[180px] md:min-h-[220px] max-h-[clamp(180px,35vh,420px)] overflow-auto">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mb-4">
                  <input
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    placeholder="업무 검색 (제목/설명/담당자)"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
                  />
                  <select
                    value={taskSort}
                    onChange={(e) =>
                      setTaskSort(
                        e.target.value as
                          | "new"
                          | "old"
                          | "due_asc"
                          | "due_desc"
                          | "priority"
                      )
                    }
                    className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                  >
                    <option value="new">최신순</option>
                    <option value="old">오래된순</option>
                    <option value="due_asc">마감 임박순</option>
                    <option value="due_desc">마감 느린순</option>
                    <option value="priority">우선순위</option>
                  </select>
                </div>
                {tasksLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="text-gray-400">로딩 중...</div>
                  </div>
                ) : displayTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                    <span className="text-4xl mb-2">
                      {activeTab === "NOW" ? "📭" : "🎉"}
                    </span>
                    <p>
                      {activeTab === "NOW"
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
                                  activeTab === "NOW"
                                    ? "bg-yellow-100 text-yellow-700"
                                    : "bg-green-100 text-green-700"
                                }`}
                              >
                                <span className="text-gray-500 text-xs">
                                  {formatRelativeTime(task.createdAt)}
                                </span>
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 min-h-0">
              <div className="md:col-span-2 space-y-3 md:space-y-4">
                {user?.teamName === "개발팀" && <GithubActivityWidget />}
                {user?.teamName === "디자인팀" && <FigmaActivityWidget />}
              </div>

              <Weather />
              <div className="hidden lg:block" />
              <div className="hidden lg:block" />
            </div>
          </div>

          {/* 우측 컬럼 (1/3) */}
          <div className="space-y-3 md:space-y-4 h-full min-h-0 overflow-hidden">
            {/* 내 정보 카드 */}
            <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm">
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
            <div className="bg-white rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4">업무 현황</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span>🔄</span>
                    <span className="text-sm text-gray-600">진행중</span>
                  </div>
                  <span className="font-bold text-yellow-600">
                    {nowTasks.length}건
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span>📝</span>
                    <span className="text-sm text-gray-600">리뷰중</span>
                  </div>
                  <span className="font-bold text-blue-600">
                    {reviewTasks.length}건
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
                  <div className="flex items-center gap-2">
                    <span>✅</span>
                    <span className="text-sm text-gray-600">종료</span>
                  </div>
                  <span className="font-bold text-green-600">
                    {endingTasks.length}건
                  </span>
                </div>
              </div>
            </div>

            {/* 팀원 목록 (Team) */}
            <div className="bg-white rounded-3xl p-6 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-800">
                  {user?.teamName || "Team"}
                </h3>
              </div>

              {membersLoading ? (
                <p className="text-gray-400 text-sm">로딩 중...</p>
              ) : teamMembers.length === 0 ? (
                <p className="text-gray-400 text-sm">팀원이 없습니다.</p>
              ) : (
                <ul className="space-y-3 max-h-[clamp(140px,20vh,240px)] overflow-y-auto pr-1">
                  {teamMembers.map((member) => (
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
                      <span
                        className={`w-3 h-3 rounded-full ${
                          teamMembersOnlineMap[member.id]
                            ? "bg-green-500 shadow-[0_0_0_3px_rgba(34,197,94,0.15)]"
                            : "bg-gray-300"
                        }`}
                        title={teamMembersOnlineMap[member.id] ? "온라인" : "오프라인"}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 성공 메시지 */}
      {showSuccessMessage && (
        <div className="fixed top-16 md:top-20 right-2 left-2 md:left-auto md:right-4 bg-gradient-to-r from-[#7F55B1] to-purple-400 text-white px-4 md:px-6 py-2.5 md:py-3 rounded-xl shadow-lg z-50 text-sm md:text-base text-center">
          로그인이 완료되었습니다!
        </div>
      )}
    </AppLayout>
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
