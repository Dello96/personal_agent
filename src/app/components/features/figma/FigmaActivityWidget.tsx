"use client";

import { useState, useEffect, useCallback } from "react";
import { getFigmaConnection, FigmaActivity } from "@/lib/api/figma";
import { formatRelativeTime } from "@/lib/utils/dateFormat";

const FIGMA_FILE_URL = "https://www.figma.com/file";

function getEventIcon(eventType: string): string {
  switch (eventType) {
    case "FILE_UPDATE":
      return "📄";
    case "FILE_COMMENT":
      return "💬";
    case "FILE_VERSION_UPDATE":
      return "🏷️";
    case "FILE_DELETE":
      return "🗑️";
    case "LIBRARY_PUBLISH":
      return "📦";
    case "DEV_MODE_STATUS_UPDATE":
      return "🛠️";
    default:
      return "◇";
  }
}

function getEventLabel(eventType: string): string {
  const labels: Record<string, string> = {
    FILE_UPDATE: "업로드/파일 업데이트",
    FILE_COMMENT: "댓글",
    FILE_VERSION_UPDATE: "버전 생성",
    FILE_DELETE: "파일 삭제",
    LIBRARY_PUBLISH: "라이브러리 퍼블리시",
    DEV_MODE_STATUS_UPDATE: "Dev Mode",
  };
  return labels[eventType] ?? eventType;
}

export default function FigmaActivityWidget() {
  const [activities, setActivities] = useState<FigmaActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasConnection, setHasConnection] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [eventFilter, setEventFilter] = useState("all");

  const loadActivities = useCallback(async () => {
    try {
      setLoading(true);
      const conn = await getFigmaConnection();
      setActivities(conn.activities ?? []);
      setHasConnection(true);
      setError(null);
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (
        err.message?.includes("404") ||
        err.message?.includes("연결된 Figma")
      ) {
        setHasConnection(false);
        setActivities([]);
        setError("연결된 Figma가 없습니다. 팀 관리에서 연결해주세요.");
      } else {
        setError("Figma 활동을 불러오는데 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadActivities();
    const interval = setInterval(loadActivities, 30000);

    const handleFigmaActivity = () => {
      loadActivities();
    };
    window.addEventListener("figma_activity", handleFigmaActivity);

    return () => {
      clearInterval(interval);
      window.removeEventListener("figma_activity", handleFigmaActivity);
    };
  }, [loadActivities]);

  const normalizedSearch = searchTerm.trim().toLowerCase();
  const filteredActivities = activities.filter((a) => {
    if (eventFilter !== "all" && a.eventType !== eventFilter) return false;
    if (!normalizedSearch) return true;
    const target = `${a.message ?? ""} ${a.fileName ?? ""}`.toLowerCase();
    return target.includes(normalizedSearch);
  });

  if (loading && activities.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="text-[#A259FF]">◇</span>
          Figma 활동
        </h3>
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (error && !hasConnection && activities.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <span className="text-[#A259FF]">◇</span>
          Figma 활동
        </h3>
        <p className="text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span className="text-[#A259FF]">◇</span>
          Figma 활동
        </h3>
        <button
          type="button"
          onClick={loadActivities}
          className="text-sm text-[#A259FF] hover:text-[#8B3DFF] font-medium"
        >
          새로고침
        </button>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="검색 (파일명/내용)"
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A259FF]"
        />
        <select
          value={eventFilter}
          onChange={(e) => setEventFilter(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
        >
          <option value="all">전체</option>
          <option value="FILE_UPDATE">파일 업데이트</option>
          <option value="FILE_COMMENT">댓글</option>
          <option value="FILE_VERSION_UPDATE">버전 생성</option>
          <option value="FILE_DELETE">삭제</option>
          <option value="LIBRARY_PUBLISH">라이브러리</option>
          <option value="DEV_MODE_STATUS_UPDATE">Dev Mode</option>
        </select>
      </div>

      {filteredActivities.length === 0 ? (
        <p className="text-sm text-gray-500">최근 Figma 활동이 없습니다.</p>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto scrollbar-thin">
          {filteredActivities.map((activity) => (
            <a
              key={activity.id}
              href={
                activity.fileKey ? `${FIGMA_FILE_URL}/${activity.fileKey}` : "#"
              }
              target="_blank"
              rel="noopener noreferrer"
              className="block p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">
                  {getEventIcon(activity.eventType)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-[#A259FF]">
                      {getEventLabel(activity.eventType)}
                    </span>
                    {activity.fileName && (
                      <span className="text-xs text-gray-500 truncate">
                        {activity.fileName}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 font-medium truncate">
                    {activity.message ?? activity.eventType}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {formatRelativeTime(activity.createdAt)}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
