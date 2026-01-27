"use client";

import { useState, useEffect, useCallback } from "react";
import { getTaskActivities, GitHubActivity } from "@/lib/api/github";
import { formatRelativeTime } from "@/lib/utils/dateFormat";

interface TaskGithubActivityWidgetProps {
  taskId: string;
}

export default function TaskGithubActivityWidget({
  taskId,
}: TaskGithubActivityWidgetProps) {
  const [activities, setActivities] = useState<GitHubActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      console.log(`[TaskGithubActivityWidget] 활동 조회 시작: taskId=${taskId}`);
      const data = await getTaskActivities(taskId, 10);
      console.log(`[TaskGithubActivityWidget] 활동 조회 완료: ${data.length}개`, data);
      setActivities(data);
      setError(null);
    } catch (error: any) {
      console.error(`[TaskGithubActivityWidget] 활동 조회 실패:`, error);
      if (error.message?.includes("404")) {
        setError("연결된 레포지토리가 없습니다.");
      } else {
        setError("활동 내역을 불러오는데 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    loadActivities();
    // 30초마다 새로고침
    const interval = setInterval(loadActivities, 30000);
    
    // GitHub 활동 WebSocket 이벤트 리스너
    const handleGitHubActivity = (event: CustomEvent) => {
      const eventData = event.detail;
      console.log(`[TaskGithubActivityWidget] GitHub 활동 이벤트 수신:`, eventData);
      
      // 이벤트의 taskId가 현재 위젯의 taskId와 일치하는 경우에만 새로고침
      if (eventData?.taskId === taskId) {
        console.log(`[TaskGithubActivityWidget] taskId 일치, 활동 목록 새로고침: ${taskId}`);
        loadActivities();
      } else {
        console.log(`[TaskGithubActivityWidget] taskId 불일치, 무시: 이벤트=${eventData?.taskId}, 위젯=${taskId}`);
      }
    };
    
    window.addEventListener("github_activity", handleGitHubActivity as EventListener);
    
    return () => {
      clearInterval(interval);
      window.removeEventListener("github_activity", handleGitHubActivity as EventListener);
    };
  }, [loadActivities, taskId]);

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

  if (activities.length === 0) {
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
        <button
          onClick={loadActivities}
          className="text-sm text-[#7F55B1] hover:text-[#6B479A] font-medium"
        >
          새로고침
        </button>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin">
        {activities.map((activity) => (
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
