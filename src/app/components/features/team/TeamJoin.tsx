"use client";

import { useAuthStore } from "@/app/stores/authStore";
import { useRouter } from "next/navigation";
import { MouseEventHandler, useEffect, useState } from "react";
import { getTeams, joinTeam } from "@/lib/api/team";
import { getCurrentUser } from "@/lib/api/users";

export default function TeamJoin() {
  const router = useRouter();
  const [selectedTeam, setSelectedTeam] = useState("팀을 선택해주세요");
  const [teams, setTeams] = useState<string[]>([]);
  const [teamName, setTeamName] = useState("");
  const user = useAuthStore((state) => state.user); // authStore에서 사용자 정보 다시 가져오기
  const handleOnClick = (team: string) => {
    setTeamName(team);
    setSelectedTeam(team);
    console.log(team);
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
              | "MEMBER"
              | "TEAM_LEAD"
              | "MANAGER"
              | "DIRECTOR",
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
    <div className="flex flex-col items-center">
      <form onSubmit={handleSelectedSubmit}>
        <div className="grid grid-col-2 gap-4 justify-center m-7">
          팀을 선택해주세요.
          {teams.map((team) => (
            <div key={team} className="border border-indigo-600 text-center">
              <button
                type="button"
                onClick={() => handleOnClick(team)}
                value={team}
                className={`w-full p-4 ${
                  teamName === team
                    ? "bg-blue-500 text-white font-bold"
                    : "hover:bg-indigo-50"
                }`}
              >
                {team}
              </button>
            </div>
          ))}
        </div>
        <div className="w-[100px] border rounded-md border-indigo-600 text-center">
          <button type="submit">선택완료</button>
        </div>
        <button
          type="button"
          onClick={() => router.push("/")}
          className={"w-full p-4"}
        >
          홈으로 돌아가기
        </button>
      </form>
    </div>
  );
}
