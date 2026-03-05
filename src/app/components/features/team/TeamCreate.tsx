"use client";

import { useAuthStore } from "@/app/stores/authStore";
import { createTeam } from "@/lib/api/team";
import { getCurrentUser } from "@/lib/api/users";
import Link from "next/link";
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
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl md:rounded-3xl shadow-xl p-6 sm:p-8 md:p-10 max-w-md w-full">
        <div className="mb-6 text-center">
          <p className="text-xs font-medium text-violet-700/80">TEAM</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">
            팀 생성
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            팀 이름을 정하고 워크스페이스를 시작하세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="teamName" className="text-sm font-medium text-gray-900">
              팀 이름
            </label>
            <input
              id="teamName"
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="예) 프론트엔드팀"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              maxLength={50}
              disabled={loading}
            />
            <div className="flex items-center justify-between">
              {error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : (
                <span className="text-sm text-gray-500">
                  팀 이름은 1~50자 이내로 입력해 주세요.
                </span>
              )}
              <span className="text-xs text-gray-400">{teamName.length}/50</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !teamName.trim()}
            className={[
              "w-full rounded-xl px-4 py-3 text-sm font-semibold transition",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
              loading || !teamName.trim()
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-violet-600 text-white hover:bg-violet-700",
            ].join(" ")}
          >
            {loading ? "생성 중..." : "팀 생성하기"}
          </button>

          <Link
            href="/"
            className="block w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-center text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
          >
            홈으로 돌아가기
          </Link>
        </form>
      </div>
    </div>
  );
}
