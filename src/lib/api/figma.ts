import { apiRequest } from "./users";

export interface FigmaActivity {
  id: string;
  connectionId: string;
  eventType: string;
  fileKey: string | null;
  fileName: string | null;
  message: string | null;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export interface FigmaConnection {
  id: string;
  teamId: string;
  figmaWebhookId: number | null;
  context: string;
  contextId: string;
  eventType: string;
  eventTypes?: string[];
  subscriptions?: Array<{
    id: string;
    figmaWebhookId: number;
    eventType: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  activities: FigmaActivity[];
}

/** 팀 Figma 연결 정보 + 최근 활동 조회 */
export const getFigmaConnection = async (): Promise<FigmaConnection> => {
  return apiRequest("/api/figma/connection");
};

/** Figma 웹훅 연결 (팀장 이상) */
export const connectFigma = async (params: {
  accessToken: string;
  context: "team" | "project" | "file";
  contextId: string;
  eventTypes: string[];
}): Promise<FigmaConnection> => {
  return apiRequest("/api/figma/connection", {
    method: "POST",
    body: JSON.stringify(params),
  });
};

/** Figma 연결 해제 */
export const disconnectFigma = async (): Promise<{ message: string }> => {
  return apiRequest("/api/figma/connection", {
    method: "DELETE",
  });
};
