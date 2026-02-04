"use client";

import { useState, useEffect, useCallback } from "react";
import { getActivities, GitHubActivity } from "@/lib/api/github";
import { formatRelativeTime } from "@/lib/utils/dateFormat";

export default function GithubActivityWidget() {
  const [activities, setActivities] = useState<GitHubActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<
    "all" | "commit" | "push" | "pull_request"
  >("all");

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getActivities(
        50,
        typeFilter === "all" ? undefined : typeFilter
      );
      setActivities(data);
      setError(null);
    } catch (error: any) {
      if (error.message?.includes("404")) {
        setError("연결된 레포지토리가 없습니다.");
      } else {
        console.error("활동 조회 실패:", error);
        setError("활동 내역을 불러오는데 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }, [typeFilter]);

  useEffect(() => {
    loadActivities();
    // 30초마다 새로고침
    const interval = setInterval(loadActivities, 30000);

    // GitHub 활동 WebSocket 이벤트 리스너
    const handleGitHubActivity = (event: CustomEvent) => {
      // 실시간으로 활동 목록 새로고침
      loadActivities();
    };

    window.addEventListener(
      "github_activity",
      handleGitHubActivity as EventListener
    );

    return () => {
      clearInterval(interval);
      window.removeEventListener(
        "github_activity",
        handleGitHubActivity as EventListener
      );
    };
  }, [loadActivities]);

  const getActivityIcon = (type: string, action?: string) => {
    if (type === "commit") return "💾";
    if (type === "push") return "⬆️";
    if (type === "pull_request") {
      if (action === "opened") return "🔀";
      if (action === "closed" || action === "merged") return "✅";
      return "🔀";
    }
    return "📝";
  };

  const getActivityColor = (type: string, action?: string) => {
    if (type === "commit") return "text-blue-600";
    if (type === "push") return "text-green-600";
    if (type === "pull_request") {
      if (action === "opened") return "text-purple-600";
      if (action === "merged") return "text-green-600";
      return "text-gray-600";
    }
    return "text-gray-600";
  };

  if (loading && activities.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>🔗</span>
          GitHub 활동
        </h3>
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>🔗</span>
          GitHub 활동
        </h3>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredActivities = normalizedSearch
    ? activities.filter((a) => {
        const target =
          `${a.message} ${a.author} ${a.branch ?? ""}`.toLowerCase();
        return target.includes(normalizedSearch);
      })
    : activities;

  if (filteredActivities.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span>🔗</span>
          GitHub 활동
        </h3>
        <p className="text-sm text-gray-500">최근 활동이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span>🔗</span>
          GitHub 활동
        </h3>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="검색 (메시지/작성자/브랜치)"
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
        />
        <select
          value={typeFilter}
          onChange={(e) =>
            setTypeFilter(
              e.target.value as "all" | "commit" | "push" | "pull_request"
            )
          }
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="all">전체</option>
          <option value="commit">Commit</option>
          <option value="push">Push</option>
          <option value="pull_request">PR</option>
        </select>
        <button
          onClick={loadActivities}
          className="text-sm text-[#7F55B1] hover:text-[#6B479A] font-medium"
        >
          새로고침
        </button>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin">
        {filteredActivities.map((activity) => (
          <a
            key={activity.id}
            href={activity.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">
                {getActivityIcon(activity.type, activity.action)}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs font-medium ${getActivityColor(
                      activity.type,
                      activity.action
                    )}`}
                  >
                    {activity.type === "pull_request"
                      ? `PR ${activity.action}`
                      : activity.type === "push"
                        ? "Push"
                        : "Commit"}
                  </span>
                  {activity.branch && (
                    <span className="text-xs text-gray-500">
                      {activity.branch}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-800 font-medium truncate">
                  {activity.message}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">
                    {activity.author}
                  </span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-xs text-gray-500">
                    {formatRelativeTime(activity.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
