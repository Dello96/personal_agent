import { apiRequest } from "./users";

export interface GitHubRepository {
  id: string;
  owner: string;
  repo: string;
  isActive: boolean;
  webhookId: number | null;
  activities?: GitHubActivity[];
}

export interface GitHubActivity {
  id: string;
  repositoryId: string;
  type: "commit" | "push" | "pull_request";
  action?: string;
  author: string;
  message: string;
  sha?: string;
  branch?: string;
  url: string;
  createdAt: string;
}

// GitHub 레포지토리 연결
export const connectRepository = async (
  owner: string,
  repo: string,
  accessToken: string
): Promise<GitHubRepository> => {
  return apiRequest("/api/github/repositories", {
    method: "POST",
    body: JSON.stringify({ owner, repo, accessToken }),
  });
};

// 연결된 레포지토리 조회
export const getRepository = async (): Promise<GitHubRepository> => {
  return apiRequest("/api/github/repositories");
};

// 레포지토리 연결 해제
export const disconnectRepository = async (
  repositoryId: string
): Promise<{ message: string }> => {
  return apiRequest(`/api/github/repositories/${repositoryId}`, {
    method: "DELETE",
  });
};

// GitHub 활동 조회 (팀 레포지토리)
export const getActivities = async (
  limit?: number,
  type?: "commit" | "push" | "pull_request"
): Promise<GitHubActivity[]> => {
  const params = new URLSearchParams();
  if (limit) params.append("limit", limit.toString());
  if (type) params.append("type", type);

  return apiRequest(`/api/github/activities?${params.toString()}`);
};

// 업무별 GitHub 활동 조회
export const getTaskActivities = async (
  taskId: string,
  limit?: number,
  type?: "commit" | "push" | "pull_request"
): Promise<GitHubActivity[]> => {
  const params = new URLSearchParams();
  if (limit) params.append("limit", limit.toString());
  if (type) params.append("type", type);

  return apiRequest(
    `/api/github/task-activities/${taskId}?${params.toString()}`
  );
};
