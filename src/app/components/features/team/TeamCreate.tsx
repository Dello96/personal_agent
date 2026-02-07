"use client";

import { useAuthStore } from "@/app/stores/authStore";
import { createTeam } from "@/lib/api/team";
import { getCurrentUser } from "@/lib/api/users";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function TeamCreate() {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. 팀 이름 검증
    if (!teamName || teamName.trim().length === 0) {
      setError("팀 이름을 입력해주세요.");
      return;
    }

    if (teamName.trim().length > 50) {
      setError("팀 이름은 50자 이하여야 합니다.");
      return;
    }

    try {
      setLoading(true);

      // 2. API 호출
      await createTeam(teamName.trim());

      // 3. 사용자 정보 업데이트 (팀 생성 시 자동으로 teamName이 업데이트됨)
      const updatedUser = await getCurrentUser();
      const login = useAuthStore.getState().login;
      const token = useAuthStore.getState().token;

      if (updatedUser && token) {
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

      // 4. 성공 메시지
      alert("팀이 성공적으로 생성되었습니다!");

      // 5. 홈화면으로 이동
      router.push("/");
    } catch (error: any) {
      // 6. 에러 처리
      console.error("팀 생성 실패:", error);

      // 백엔드 에러 메시지 추출
      const errorMessage =
        error?.message || "팀 생성에 실패했습니다. 다시 시도해주세요.";
      setError(errorMessage);
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex flex-col items-center">
      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <div className="flex flex-col gap-4 m-7">
          <h2 className="text-2xl font-bold text-center mb-4">팀 생성</h2>

          <div className="flex flex-col gap-2">
            <label htmlFor="teamName" className="text-sm font-medium">
              팀 이름
            </label>
            <input
              id="teamName"
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="팀 이름을 입력해주세요"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              maxLength={50}
              disabled={loading}
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <p className="text-gray-500 text-xs">{teamName.length}/50자</p>
          </div>

          <button
            type="submit"
            disabled={loading || !teamName.trim()}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "생성 중..." : "팀 생성하기"}
          </button>
        </div>
      </form>
    </div>
  );
}
