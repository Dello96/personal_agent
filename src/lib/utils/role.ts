// role.ts - 직급 체크 유틸

export const isTeamLeadOrAbove = (role: string): boolean => {
  return role === "TEAM_LEAD";
};

export const canAssignTask = (role: string): boolean => {
  return isTeamLeadOrAbove(role);
};
