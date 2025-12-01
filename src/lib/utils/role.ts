// role.ts - 직급 체크 유틸

export const isTeamLeadOrAbove = (role: string): boolean => {
  return ["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(role);
};

export const canAssignTask = (role: string): boolean => {
  return isTeamLeadOrAbove(role);
};
