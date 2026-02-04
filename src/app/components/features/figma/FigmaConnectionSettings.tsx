"use client";

import { useState, useEffect } from "react";
import {
  getFigmaConnection,
  connectFigma,
  disconnectFigma,
  FigmaConnection,
} from "@/lib/api/figma";

const CONTEXT_OPTIONS = [
  { value: "team", label: "팀 (Team)" },
  { value: "project", label: "프로젝트 (Project)" },
  { value: "file", label: "파일 (File)" },
] as const;

const EVENT_TYPE_OPTIONS = [
  { value: "FILE_UPDATE", label: "파일 업데이트 (편집 후 30분 무활동)" },
  { value: "FILE_COMMENT", label: "댓글" },
  { value: "FILE_VERSION_UPDATE", label: "버전 생성" },
  { value: "FILE_DELETE", label: "파일 삭제" },
  { value: "LIBRARY_PUBLISH", label: "라이브러리 퍼블리시" },
  { value: "DEV_MODE_STATUS_UPDATE", label: "Dev Mode 상태 변경" },
];

export default function FigmaConnectionSettings() {
  const [connection, setConnection] = useState<FigmaConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const [accessToken, setAccessToken] = useState("");
  const [context, setContext] = useState<"team" | "project" | "file">("team");
  const [contextId, setContextId] = useState("");
  const [eventType, setEventType] = useState("FILE_UPDATE");

  const loadConnection = async () => {
    try {
      setLoading(true);
      const data = await getFigmaConnection();
      setConnection(data);
      setContext(data.context as "team" | "project" | "file");
      setContextId(data.contextId);
      setEventType(data.eventType);
      setError(null);
    } catch (e: unknown) {
      const err = e as { message?: string };
      if (
        err.message?.includes("404") ||
        err.message?.includes("연결된 Figma")
      ) {
        setConnection(null);
      } else {
        setError("Figma 연결 정보를 불러오는데 실패했습니다.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConnection();
  }, []);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!accessToken || !contextId || !eventType) {
      setError("토큰, Context ID, 이벤트 타입을 모두 입력해주세요.");
      return;
    }
    try {
      setIsConnecting(true);
      const result = await connectFigma({
        accessToken,
        context,
        contextId: contextId.trim(),
        eventType,
      });
      setConnection(result);
      setAccessToken("");
      alert("Figma 웹훅이 연결되었습니다.");
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message || "Figma 연결에 실패했습니다.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!connection || !confirm("Figma 연결을 해제하시겠습니까?")) return;
    try {
      setIsDisconnecting(true);
      await disconnectFigma();
      setConnection(null);
      setContextId("");
      alert("Figma 연결이 해제되었습니다.");
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message || "연결 해제에 실패했습니다.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <span className="text-[#A259FF]">◇</span>
          Figma 웹훅 연결
        </h2>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {connection ? (
        <div className="space-y-4">
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800 font-medium mb-2">
              ✅ Figma 웹훅이 연결되어 있습니다
            </p>
            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Context:</span>{" "}
                {connection.context} / {connection.contextId}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">이벤트:</span>{" "}
                {connection.eventType}
              </p>
              <p className="text-sm text-gray-700">
                <span className="font-semibold">상태:</span>{" "}
                {connection.isActive ? "활성" : "비활성"}
              </p>
              {connection.figmaWebhookId != null && (
                <p className="text-sm text-gray-700">
                  <span className="font-semibold">Webhook ID:</span>{" "}
                  {connection.figmaWebhookId}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleDisconnect}
            disabled={isDisconnecting}
            className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isDisconnecting ? "해제 중..." : "연결 해제"}
          </button>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Figma Personal Access Token
            </label>
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="figd_xxxxxxxxxxxx"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#A259FF]"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              Figma → Settings → Personal access tokens. scope에 webhooks:write
              포함
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Context
            </label>
            <select
              value={context}
              onChange={(e) =>
                setContext(e.target.value as "team" | "project" | "file")
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#A259FF]"
            >
              {CONTEXT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Context ID (팀/프로젝트/파일 ID)
            </label>
            <input
              type="text"
              value={contextId}
              onChange={(e) => setContextId(e.target.value)}
              placeholder="예: 1170245155647481265 (팀 URL의 team/ 뒤 숫자)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#A259FF]"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              팀: figma.com/files/team/숫자 → 숫자만 입력. 파일: URL의 file/ 뒤
              키
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              구독할 이벤트
            </label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#A259FF]"
            >
              {EVENT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={isConnecting}
            className="w-full px-4 py-2 bg-[#A259FF] text-white rounded-lg hover:bg-[#8B3DFF] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isConnecting ? "연결 중..." : "Figma 웹훅 연결"}
          </button>
        </form>
      )}
    </div>
  );
}
