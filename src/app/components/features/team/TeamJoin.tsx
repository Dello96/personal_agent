"use client";

import { useAuthStore } from "@/app/stores/authStore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";
import { getTeams, joinTeam } from "@/lib/api/team";
import { getCurrentUser } from "@/lib/api/users";

export default function TeamJoin() {
  const router = useRouter();
  const [teams, setTeams] = useState<string[]>([]);
  const [teamName, setTeamName] = useState("");
  const handleOnClick = (team: string) => {
    setTeamName(team);
  };
  const handleSelectedSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. 팀 선택 여부 확인
    if (!teamName) {
      alert("팀을 선택해주세요.");
      return;
    }

    // 2. 로딩 상태 관리 (선택사항)
    // const [loading, setLoading] = useState(false);
    // setLoading(true);

    try {
      // 3. API 호출
      await joinTeam(teamName);

      const updatedUser = await getCurrentUser();
      const login = useAuthStore.getState().login;
      const token = useAuthStore.getState().token;

      if (updatedUser && token) {
        // role 타입 단언으로 타입 호환성 확보
        login(
          {
            ...updatedUser,
            role: updatedUser.role as
              | "INTERN"
              | "STAFF"
              | "ASSOCIATE"
              | "ASSISTANT_MANAGER"
              | "TEAM_LEAD",
          },
          token
        );
      }
      // 4. 성공 메시지 (선택사항)
      alert("팀 가입이 완료되었습니다!");

      // 5. 홈화면으로 이동
      router.push("/");

      // 또는 사용자 정보 새로고침 후 이동
      // router.refresh(); // Next.js 13+ App Router
      // router.push("/");
    } catch (error) {
      // 6. 에러 처리
      console.error("팀 가입 실패:", error);
      alert("팀 가입에 실패했습니다. 다시 시도해주세요.");
    } finally {
      // 7. 로딩 상태 해제 (선택사항)
      // setLoading(false);
    }
  };

  // DB에서 팀 목록 불러오기
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const data = await getTeams();
        // Team 객체 배열에서 teamName만 추출하여 문자열 배열로 변환
        const teamNames = data.teams.map((team) => team.teamName);
        setTeams(teamNames);
      } catch (error) {
        console.error("팀 목록 조회 실패:", error);
        alert("팀 목록을 불러오는데 실패했습니다.");
      }
    };
    fetchTeams();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl p-6 sm:p-8 md:p-10 max-w-md w-full">
        <div className="mb-6 text-center">
          <p className="text-xs font-medium text-violet-700/80">TEAM</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">
            팀에 가입하기
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            참여할 팀을 선택하면 바로 가입됩니다.
          </p>
        </div>

        <form onSubmit={handleSelectedSubmit}>
          <div className="space-y-3">
            <p className="text-sm font-medium text-gray-900">
              팀을 선택해주세요
            </p>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {teams.map((team) => {
                const selected = teamName === team;
                return (
                  <button
                    key={team}
                    type="button"
                    onClick={() => handleOnClick(team)}
                    aria-pressed={selected}
                    className={[
                      "w-full rounded-xl border px-4 py-3 text-sm font-medium transition",
                      "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
                      selected
                        ? "border-violet-300 bg-violet-600 text-white shadow-sm"
                        : "border-violet-200 bg-white text-violet-700 hover:bg-violet-50",
                    ].join(" ")}
                  >
                    {team}
                  </button>
                );
              })}
            </div>

            <button
              type="submit"
              disabled={!teamName}
              className={[
                "mt-2 w-full rounded-xl px-4 py-3 text-sm font-semibold transition",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
                teamName
                  ? "bg-violet-600 text-white hover:bg-violet-700"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed",
              ].join(" ")}
            >
              선택 완료
            </button>

            <Link
              href="/"
              className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
            >
              홈으로 돌아가기
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
