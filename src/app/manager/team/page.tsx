"use client";

import AppLayout from "@/app/components/shared/AppLayout";
import GithubRepositorySettings from "@/app/components/features/github/GithubRepositorySettings";
import { useAuthStore } from "@/app/stores/authStore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function TeamManagementPage() {
  const user = useAuthStore((state) => state.user);
  const router = useRouter();

  useEffect(() => {
    // 팀장 이상만 접근 가능
    if (
      user &&
      !["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(user.role || "")
    ) {
      router.push("/");
    }
  }, [user, router]);

  if (
    !user ||
    !["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(user.role || "")
  ) {
    return null;
  }

  return (
    <AppLayout
      activeMenu="팀 관리"
      sidebarVariant="default"
      headerProps={{ title: "팀 관리" }}
    >
      <div className="space-y-6">
        <GithubRepositorySettings />
      </div>
    </AppLayout>
  );
}
