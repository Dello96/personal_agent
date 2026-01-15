// team.ts - 팀 API 함수
import { apiRequest } from "./users";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export interface Team {
  id: string;
  createdAt: string;
  teamName: string;
  members?: {
    id: string;
    name: string;
    picture: string | null;
    email: string;
    role: string;
    teamName: string | null;
  }[];
}

// 팀 생성
export const createTeam = async (teamName: string): Promise<Team> => {
  const response = (await apiRequest("/api/team/create", {
    method: "POST",
    body: JSON.stringify({ name: teamName }), // ✅ 백엔드가 기대하는 name 필드
  })) as { message: string; team: Team };

  return response.team;
};

export const joinTeam = async (teamName: string): Promise<Team> => {
  const response = await apiRequest("/api/team/join", {
    method: "POST",
    body: JSON.stringify({ teamName: teamName }),
  });
  if (response.team) {
    return response.team;
  }
  return response;
};

export const getTeams = async (): Promise<{
  teams: Team[];
  currentTeamName: string | null;
}> => {
  const response = await apiRequest("/api/team/getTeam", {
    method: "GET",
  });
  return response as { teams: Team[]; currentTeamName: string | null };
};
