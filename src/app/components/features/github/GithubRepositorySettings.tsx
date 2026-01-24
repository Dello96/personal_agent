"use client";

import { useState, useEffect } from "react";
import {
  connectRepository,
  getRepository,
  disconnectRepository,
  GitHubRepository,
} from "@/lib/api/github";
import { useAuthStore } from "@/app/stores/authStore";

export default function GithubRepositorySettings() {
  const user = useAuthStore((state) => state.user);
  const [repository, setRepository] = useState<GitHubRepository | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // 폼 상태
  const [owner, setOwner] = useState("");
  const [repo, setRepo] = useState("");
  const [accessToken, setAccessToken] = useState("");

  // 레포지토리 정보 로드
  useEffect(() => {
    loadRepository();
  }, []);

  const loadRepository = async () => {
    try {
      setLoading(true);
      const repo = await getRepository();
      setRepository(repo);
      setOwner(repo.owner);
      setRepo(repo.repo);
    } catch (error: any) {
      if (error.message?.includes("404")) {
        setRepository(null);
      } else {
        console.error("레포지토리 조회 실패:", error);
        setError("레포지토리 정보를 불러오는데 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!owner || !repo || !accessToken) {
      setError("모든 필드를 입력해주세요.");
      return;
    }

    try {
      setIsConnecting(true);
      const newRepo = await connectRepository(owner, repo, accessToken);
      setRepository(newRepo);
      setAccessToken(""); // 보안을 위해 토큰 필드 초기화
      alert("레포지토리가 성공적으로 연결되었습니다!");
    } catch (error: any) {
      console.error("레포지토리 연결 실패:", error);
      setError(error.message || "레포지토리 연결에 실패했습니다.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!repository) return;

    if (!confirm("정말 레포지토리 연결을 해제하시겠습니까?")) {
      return;
    }

    try {
      setIsDisconnecting(true);
      await disconnectRepository(repository.id);
      setRepository(null);
      setOwner("");
      setRepo("");
      alert("레포지토리 연결이 해제되었습니다.");
    } catch (error: any) {
      console.error("레포지토리 연결 해제 실패:", error);
      setError(error.message || "레포지토리 연결 해제에 실패했습니다.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <span>🔗</span>
          GitHub 레포지토리 연결
        </h2>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {repository ? (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800 font-medium mb-2">
              ✅ 레포지토리가 연결되어 있습니다
            </p>
            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">레포지토리:</span>{" "}
                {repository.owner}/{repository.repo}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">상태:</span>{" "}
                {repository.isActive ? "활성" : "비활성"}
              </p>
              {repository.webhookId && (
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Webhook ID:</span>{" "}
                  {repository.webhookId}
                </p>
              )}
            </div>
          </div>

          <button
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDisconnecting ? "연결 해제 중..." : "연결 해제"}
          </button>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              GitHub Username 또는 Organization
            </label>
            <input
              type="text"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
              placeholder="예: octocat 또는 my-org"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Repository Name
            </label>
            <input
              type="text"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="예: my-repo"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              GitHub Personal Access Token
            </label>
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="ghp_xxxxxxxxxxxx"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              GitHub Settings → Developer settings → Personal access tokens에서
              생성하세요. (repo 권한 필요)
            </p>
          </div>

          <button
            type="submit"
            disabled={isConnecting}
            className="w-full px-4 py-2 bg-[#7F55B1] text-white rounded-lg hover:bg-[#6B479A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? "연결 중..." : "레포지토리 연결"}
          </button>
        </form>
      )}
    </div>
  );
}
