"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/app/stores/authStore";
import { getTask, Task } from "@/lib/api/tasks";

export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const loginStatus = searchParams.get("login");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);

  const login = useAuthStore((state) => state.login);
  const [tasks, setTasks] = useState<Task[]>([]);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const user = useAuthStore((state) => state.user);
  const [tasksError, setTasksError] = useState<string | null>(null);

  const goToTeamJoin = () => {
    router.push("/team/join");
  };

  const goToTeamCreate = () => {
    router.push("/team/create");
  };

  useEffect(() => {
    const fetchTasks = async () => {
      // 로그인하지 않았으면 초기화
      if (!isLoggedIn) {
        setTasks([]);
        setTasksLoading(false);
        return;
      }

      if (!user?.teamName) {
        setTasks([]);
        setTasksLoading(false);
        return;
      }

      try {
        setTasksLoading(true);
        setTasksError(null);
        const data = await getTask(user.id);
        setTasks(data);
      } catch (error) {
        console.error("업무 조회 실패:", error);
        setTasksError("업무를 불러오는데 실패했습니다.");
      } finally {
        setTasksLoading(false);
      }
    };

    fetchTasks();
  }, [isLoggedIn, user?.teamName]);

  useEffect(() => {
    if (loginStatus === "success") {
      const token = searchParams.get("token");
      const userInfo = searchParams.get("user"); // JSON 문자열로 전달된 경우

      if (token) {
        // 사용자 정보 파싱 (백엔드에서 JSON으로 전달하는 경우)
        let user = null;
        if (userInfo) {
          try {
            user = JSON.parse(decodeURIComponent(userInfo));
          } catch (e) {
            console.error("Failed to parse user info", e);
          }
        }

        // Zustand Store에 로그인 정보 저장
        if (user) {
          // role 타입 단언으로 타입 호환성 확보
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
          // 사용자 정보가 없으면 기본값으로 저장
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

        // 성공 메시지 표시
        setShowSuccessMessage(true);

        // URL 정리
        router.replace("/");
        if (window.location.pathname.includes("/auth/login")) {
          router.back(); // 또는 router.push('/');
        }

        // 3초 후 메시지 자동 숨김
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

  return (
    <div>
      {isLoggedIn ? (
        // 로그인된 경우
        user?.teamName ? (
          // 팀에 가입된 경우 - 기존 업무 표시 로직
          <div className="flex flex-col w-full h-[600px] bg-sky-50">
            frame
            <div className="flex flex-row bg-blue-100">
              <div className="flex flex-col bg-red-100 w-[300px] h-[200px]">
                <button>진행중인 업무</button>
                <button>완료된 업무</button>
                <button>요청사항</button>
              </div>
              {tasksLoading ? (
                <div className="flex flex-col w-full h-[200px] pt-10 text-center justify-center">
                  업무를 불러오는 중...
                </div>
              ) : tasks.length === 0 ? (
                <div className="flex flex-col w-full h-[200px] pt-10 text-center justify-center">
                  업무가 없습니다.
                  <button onClick={workAssignment}>업무 전달하기</button>
                </div>
              ) : (
                <div className="flex flex-col w-full h-[200px] pt-10 text-center justify-center">
                  <ul>
                    {tasks.map((task) => (
                      <li key={task.id}>{task.title}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : (
          // 팀에 가입되지 않은 경우 - 팀 가입 안내 메시지
          <div className="flex flex-col w-full h-[400px] pt-20 text-center justify-center items-center bg-yellow-50">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-2">
                팀 가입이 필요합니다
              </h2>
              <p className="text-gray-600 mb-4">
                업무를 확인하고 관리하려면 먼저 팀에 가입해주세요.
              </p>
            </div>
            <button
              onClick={goToTeamJoin}
              className="px-6 py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
            >
              팀 가입하기
            </button>
            <p className="text-gray-600 mt-4 mb-4">
              팀을 새로 생성해야 한다면?
            </p>
            <button
              onClick={goToTeamCreate}
              className="px-6 py-3 bg-red-500 text-white rounded-md hover:bg-red-300 transition-colors"
            >
              팀 생성하기
            </button>
          </div>
        )
      ) : (
        // 로그인하지 않은 경우
        <div>
          <div className="flex flex-col w-full h-[200px] pt-10 text-center justify-center items-center bg-gray-300">
            환영합니다! 로그인을 하시면 오늘의 업무를 확인할 수 있습니다.
            <button
              onClick={loginAction}
              className="flex flex-col w-[100px] m-5 border rounded-md border-blue-400 justify-center"
            >
              로그인하기
            </button>
          </div>
        </div>
      )}

      {/* 성공 메시지 */}
      {showSuccessMessage && (
        <div className="fixed top-20 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-in">
          로그인이 완료되었습니다!
        </div>
      )}
    </div>
  );
}
