/**
 * 역할(Role) 관련 유틸리티 함수
 */

export const getRoleLabel = (role: string): string => {
  const roleMap: Record<string, string> = {
    INTERN: "인턴",
    STAFF: "사원",
    ASSOCIATE: "주임",
    ASSISTANT_MANAGER: "대리",
    TEAM_LEAD: "팀장",
  };
  return roleMap[role] || role;
};

export const getRoleRank = (role: string): number => {
  const roleRank: Record<string, number> = {
    TEAM_LEAD: 5,
    ASSISTANT_MANAGER: 4,
    ASSOCIATE: 3,
    STAFF: 2,
    INTERN: 1,
  };
  return roleRank[role] ?? 0;
};
