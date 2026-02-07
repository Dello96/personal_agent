"use client";

import AppLayout from "@/app/components/shared/AppLayout";
import GithubRepositorySettings from "@/app/components/features/github/GithubRepositorySettings";
import FigmaConnectionSettings from "@/app/components/features/figma/FigmaConnectionSettings";
import FigmaActivityWidget from "@/app/components/features/figma/FigmaActivityWidget";
import { useAuthStore } from "@/app/stores/authStore";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  getCurrentTeamMembers,
  renameTeam,
  updateTeamMemberRole,
} from "@/lib/api/team";
import { getRoleLabel, getRoleRank } from "@/lib/utils/roleUtils";
import type { TeamMember } from "@/lib/api/users";

export default function TeamManagementPage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const router = useRouter();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [pendingRoleChange, setPendingRoleChange] = useState<{
    memberId: string;
    name: string;
    fromRole: string;
    toRole: string;
  } | null>(null);
  const [inviteLink, setInviteLink] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [roleUpdatingId, setRoleUpdatingId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const isTeamLeadOrAbove = user?.role === "TEAM_LEAD";

  const openPermissionModal = () => {
    setShowPermissionModal(true);
  };

  useEffect(() => {
    if (!user?.teamName) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const link = `${origin}/team/join?team=${encodeURIComponent(
      user.teamName
    )}`;
    setInviteLink(link);
  }, [user?.teamName]);

  useEffect(() => {
    const loadMembers = async () => {
      try {
        setLoadingMembers(true);
        const data = await getCurrentTeamMembers();
        const sorted = [...data].sort((a, b) => {
          const rankDiff = getRoleRank(b.role) - getRoleRank(a.role);
          if (rankDiff !== 0) return rankDiff;
          return (
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        });
        setMembers(sorted);
        setError(null);
      } catch (err: unknown) {
        const message = (err as { message?: string }).message;
        setError(message || "팀원 목록을 불러오는데 실패했습니다.");
      } finally {
        setLoadingMembers(false);
      }
    };
    loadMembers();
  }, []);

  const memberCountText = useMemo(
    () => `${members.length}명`,
    [members.length]
  );

  const handleCopyInvite = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      alert("초대 링크가 복사되었습니다.");
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("초대 링크 복사 실패:", err);
      }
      alert("초대 링크 복사에 실패했습니다.");
    }
  };

  const handleRename = async () => {
    if (!isTeamLeadOrAbove) {
      openPermissionModal();
      return;
    }
    if (!newTeamName.trim()) {
      setError("새 팀명을 입력해주세요.");
      return;
    }
    try {
      setIsRenaming(true);
      setError(null);
      const result = await renameTeam(newTeamName.trim());
      if (user) {
        setUser({
          ...user,
          teamName: result.team?.teamName || newTeamName.trim(),
        });
      }
      setNewTeamName("");
      alert("팀명이 변경되었습니다.");
    } catch (err: unknown) {
      const message = (err as { message?: string }).message;
      setError(message || "팀명 변경에 실패했습니다.");
    } finally {
      setIsRenaming(false);
    }
  };

  const handleRoleChange = async (memberId: string, role: string) => {
    if (!isTeamLeadOrAbove) {
      openPermissionModal();
      return;
    }
    try {
      setRoleUpdatingId(memberId);
      await updateTeamMemberRole(memberId, role);
      setMembers((prev) =>
        prev.map((member) =>
          member.id === memberId ? { ...member, role } : member
        )
      );
      setSuccessMessage("변경이 완료되었습니다!");
    } catch (err: unknown) {
      const message = (err as { message?: string }).message;
      setError(message || "역할 변경에 실패했습니다.");
    } finally {
      setRoleUpdatingId(null);
    }
  };

  const roleOptions = [
    { value: "INTERN", label: getRoleLabel("INTERN") },
    { value: "STAFF", label: getRoleLabel("STAFF") },
    { value: "ASSOCIATE", label: getRoleLabel("ASSOCIATE") },
    { value: "ASSISTANT_MANAGER", label: getRoleLabel("ASSISTANT_MANAGER") },
    { value: "TEAM_LEAD", label: getRoleLabel("TEAM_LEAD") },
  ];

  const requestRoleChange = (member: TeamMember, nextRole: string) => {
    if (!isTeamLeadOrAbove) {
      openPermissionModal();
      return;
    }
    if (member.role === nextRole) return;
    setPendingRoleChange({
      memberId: member.id,
      name: member.name,
      fromRole: member.role,
      toRole: nextRole,
    });
  };

  useEffect(() => {
    if (!user) {
      router.push("/");
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  return (
    <AppLayout
      activeMenu="팀 관리"
      sidebarVariant="default"
      headerProps={{ title: "팀 관리" }}
    >
      <div className="space-y-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800">팀 정보</h2>
            <span className="text-sm text-gray-500">{memberCountText}</span>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500 mb-2">현재 팀명</p>
              <p className="text-lg font-semibold text-gray-800">
                {user.teamName || "-"}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-500 mb-2">초대 링크</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={inviteLink}
                  className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600"
                />
                <button
                  type="button"
                  onClick={handleCopyInvite}
                  className="px-3 py-2 bg-[#7F55B1] text-white rounded-lg text-sm hover:bg-[#6B479A]"
                >
                  복사
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2">
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="새 팀명 입력"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
            />
            <button
              type="button"
              onClick={handleRename}
              disabled={isRenaming}
              className={`px-4 py-2 rounded-lg text-white ${
                isTeamLeadOrAbove
                  ? "bg-[#7F55B1] hover:bg-[#6B479A]"
                  : "bg-gray-300 cursor-not-allowed"
              } ${isRenaming ? "opacity-50" : ""}`}
            >
              {isRenaming ? "변경 중..." : "팀 변경"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-gray-800">팀원 리스트</h2>
            <span className="text-sm text-gray-500">{memberCountText}</span>
          </div>
          {loadingMembers ? (
            <p className="text-sm text-gray-500">로딩 중...</p>
          ) : members.length === 0 ? (
            <p className="text-sm text-gray-500">팀원이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 bg-gray-50 rounded-xl"
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800">
                      {member.name}
                    </p>
                    <p className="text-xs text-gray-500">{member.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={member.role}
                      onChange={(e) =>
                        requestRoleChange(member, e.target.value)
                      }
                      disabled={roleUpdatingId === member.id}
                      className="px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    >
                      {roleOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {roleUpdatingId === member.id && (
                      <span className="text-xs text-gray-400">변경 중...</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {user.teamName === "개발팀" && <GithubRepositorySettings />}

        {user.teamName === "디자인팀" && (
          <div className="space-y-6">
            <FigmaConnectionSettings />
            <FigmaActivityWidget />
          </div>
        )}
      </div>

      {showPermissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              권한이 없습니다
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              팀장 이상만 변경 가능합니다.
            </p>
            <button
              type="button"
              onClick={() => setShowPermissionModal(false)}
              className="w-full px-4 py-2 bg-[#7F55B1] text-white rounded-lg hover:bg-[#6B479A]"
            >
              확인
            </button>
          </div>
        </div>
      )}

      {pendingRoleChange && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              직급 변경 확인
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              {pendingRoleChange.name}님의 직급을{" "}
              {getRoleLabel(pendingRoleChange.fromRole)} →{" "}
              {getRoleLabel(pendingRoleChange.toRole)} 로 변경할까요?
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const { memberId, toRole } = pendingRoleChange;
                  setPendingRoleChange(null);
                  await handleRoleChange(memberId, toRole);
                }}
                className="flex-1 px-4 py-2 bg-[#7F55B1] text-white rounded-lg hover:bg-[#6B479A]"
              >
                예
              </button>
              <button
                type="button"
                onClick={() => setPendingRoleChange(null)}
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:text-[#7F55B1]"
              >
                아니오
              </button>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-sm">
            <h3 className="text-lg font-bold text-gray-800 mb-2">완료</h3>
            <p className="text-sm text-gray-600 mb-6">{successMessage}</p>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              className="w-full px-4 py-2 bg-[#7F55B1] text-white rounded-lg hover:bg-[#6B479A]"
            >
              확인
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
