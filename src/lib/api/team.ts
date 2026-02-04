// team.ts - 팀 API 함수
import { apiRequest, getTeamMembers } from "./users";
import type { TeamMember } from "./users";

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

/**
 * 현재 로그인한 사용자 팀의 팀원만 반환.
 * 백엔드 GET /api/users/team-members 사용 (JWT의 팀으로 DB에서 직접 필터, 다른 팀 데이터 노출 없음).
 */
export const getCurrentTeamMembers = async (): Promise<TeamMember[]> => {
  return getTeamMembers();
};

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
