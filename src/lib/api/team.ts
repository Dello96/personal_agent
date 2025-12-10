// team.ts - 팀 API 함수
import { apiRequest } from "./users";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface Team {
  id: string;
  createdAt: string;
  teamName: string;
}

// 팀 생성
export const createTeam = async (data: { teamName: string }) => {
  return apiRequest("/api/team/create", {
    method: "POST",
    body: JSON.stringify(data),
  });
};

export const joinTeam = async (teamName: string): Promise<Team> => {
  return apiRequest("/api/team/join", {
    method: "POST",
    body: JSON.stringify({ teamName: teamName }),
  });
};

// export const getTeams = async (): Promise<{ teams: Team[] }> => {
//   return apiRequest("/api/team");
// };
