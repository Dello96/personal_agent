"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/app/stores/authStore";
import { getTasks, Task } from "@/lib/api/tasks";

export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const loginStatus = searchParams.get("login");
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const login = useAuthStore((state) => state.login);
  const todayWork = true;
  const [tasks, setTasks] = useState<Task[]>([]);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const data = await getTasks();
        setTasks(data);
      } catch (error) {
        console.error("업무 조회 실패:", error);
      }
    };

    // 로그인된 경우에만 업무 조회
    if (isLoggedIn) {
      fetchTasks();
    }
  }, []);

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
          login(user, token);
        } else {
          // 사용자 정보가 없으면 기본값으로 저장
          login(
            {
              id: "temp-id",
              email: "user@example.com",
              name: "User",
              picture: "picture",
              role: "MEMBER",
              teamId: "TEAMID",
              teamName: "TEAMNAME",
            },
            token
          );
        }

        // 성공 메시지 표시
        setShowSuccessMessage(true);

        // URL 정리
        router.replace("/");

        // 3초 후 메시지 자동 숨김
        setTimeout(() => {
          setShowSuccessMessage(false);
        }, 3000);
      }
    }
  }, [loginStatus, router, login]);

  return (
    <div>
      <div className="flex flex-col w-full h-[600px] bg-sky-50">
        frame
        <div className="flex flex-row bg-blue-100">
          <div className="flex flex-col bg-red-100 w-[300px] h-[200px]">
            <button>진행중인 업무</button>
            <button>완료된 업무</button>
            <button>요청사항</button>
          </div>
          {todayWork ? (
            <div className="flex flex-col w-full h-[200px] pt-10 text-center justify-center">
              today's work
              <button>Work Start</button>
            </div>
          ) : (
            <div>Work Clear!</div>
          )}
        </div>
      </div>

      {/* 성공 메시지 */}
      {showSuccessMessage && (
        <div className="fixed top-20 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-slide-in">
          로그인이 완료되었습니다!
        </div>
      )}
    </div>
  );
}
