// RoleGuard 컴포넌트 (권한 체크 컴포넌트)

import React from "react";
import { useAuthStore } from "@/app/stores/authStore";

interface RoleGuardProps {
  allowedRoles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const RoleGuard = ({
  allowedRoles,
  children,
  fallback,
}: RoleGuardProps) => {
  const user = useAuthStore((state) => state.user);

  if (!user || !allowedRoles.includes(user.role)) {
    return <>{fallback || null}</>;
  }

  return <>{children}</>;
};
