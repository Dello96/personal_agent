/**
 * 역할(Role) 관련 유틸리티 함수
 */

export const getRoleLabel = (role: string): string => {
  const roleMap: Record<string, string> = {
    MEMBER: "팀원",
    TEAM_LEAD: "팀장",
    MANAGER: "매니저",
    DIRECTOR: "이사",
  };
  return roleMap[role] || role;
};

