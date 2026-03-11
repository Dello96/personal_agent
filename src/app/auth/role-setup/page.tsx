"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/app/stores/authStore";
import { setupMyRole } from "@/lib/api/users";

const ROLES = [
  { value: "INTERN", label: "인턴", description: "프로젝트에 참여합니다" },
  { value: "STAFF", label: "사원", description: "프로젝트에 참여합니다" },
  { value: "ASSOCIATE", label: "주임", description: "프로젝트에 참여합니다" },
  {
    value: "ASSISTANT_MANAGER",
    label: "대리",
    description: "프로젝트 운영을 지원합니다",
  },
  {
    value: "TEAM_LEAD",
    label: "팀장",
    description: "팀을 관리하고 업무를 배정합니다",
  },
] as const;

type RoleValue = (typeof ROLES)[number]["value"];

export default function RoleSetupPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const setUser = useAuthStore((state) => state.setUser);
  const [selectedRole, setSelectedRole] = useState<RoleValue>("INTERN");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!isLoggedIn || !user) {
      router.replace("/auth/login");
      return;
    }
    if (user.roleSetupCompleted !== false) {
      router.replace("/");
    }
  }, [hasHydrated, isLoggedIn, user, router]);

  if (!hasHydrated || !isLoggedIn || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center">
        <div className="text-[#7F55B1] text-lg">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center p-4">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl p-6 md:p-8">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">직급 선택</h1>
        <p className="text-sm text-gray-500 mb-6">
          소셜 로그인 후 처음 한 번만 직급을 설정하면 됩니다.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {ROLES.map((role) => (
            <button
              key={role.value}
              type="button"
              onClick={() => setSelectedRole(role.value)}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                selectedRole === role.value
                  ? "border-[#7F55B1] bg-purple-50"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <p
                className={`font-semibold ${
                  selectedRole === role.value ? "text-[#7F55B1]" : "text-gray-800"
                }`}
              >
                {role.label}
              </p>
              <p className="text-xs text-gray-500 mt-1">{role.description}</p>
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            try {
              setSaving(true);
              setError(null);
              const updated = await setupMyRole(selectedRole);
              setUser({
                ...updated,
                role: updated.role as
                  | "INTERN"
                  | "STAFF"
                  | "ASSOCIATE"
                  | "ASSISTANT_MANAGER"
                  | "TEAM_LEAD",
              });
              router.replace("/");
            } catch (err: unknown) {
              const message = (err as { message?: string }).message;
              setError(message || "직급 저장에 실패했습니다.");
            } finally {
              setSaving(false);
            }
          }}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#7F55B1] to-purple-400 text-white font-semibold hover:from-[#6B479A] hover:to-purple-500 disabled:opacity-50"
        >
          {saving ? "저장 중..." : "직급 저장하고 시작하기"}
        </button>
      </div>
    </div>
  );
}
