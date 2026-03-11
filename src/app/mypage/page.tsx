"use client";

import { useEffect, useMemo, useState } from "react";
import AppLayout from "@/app/components/shared/AppLayout";
import { useAuthStore } from "@/app/stores/authStore";
import {
  getCurrentUser,
  updateCurrentUser,
  uploadProfileImage,
  withdrawFromCurrentTeam,
} from "@/lib/api/users";
import { useRouter } from "next/navigation";

export default function MyPage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const logout = useAuthStore((state) => state.logout);
  const router = useRouter();

  const [name, setName] = useState("");
  const [pictureUrl, setPictureUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setPictureUrl(user.picture || null);
    }
  }, [user]);

  useEffect(() => {
    const refresh = async () => {
      try {
        const current = await getCurrentUser();
        setName(current.name || "");
        setPictureUrl(current.picture || null);
        setUser({
          ...current,
          role: current.role as
            | "INTERN"
            | "STAFF"
            | "ASSOCIATE"
            | "ASSISTANT_MANAGER"
            | "TEAM_LEAD",
        });
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          console.error("마이페이지 사용자 정보 갱신 실패:", err);
        }
      }
    };
    refresh();
  }, [setUser]);

  const previewUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleUpload = async () => {
    if (!file) {
      setError("업로드할 이미지를 선택해주세요.");
      return;
    }
    try {
      setUploading(true);
      setError(null);
      setSuccess(null);
      const result = await uploadProfileImage(file);
      setPictureUrl(result.imageUrl);
      setFile(null);
      setSuccess("프로필 이미지가 업로드되었습니다.");
    } catch (err: unknown) {
      const errorMessage = (err as { message?: string }).message;
      setError(errorMessage || "프로필 이미지 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      setError(null);
      setSuccess(null);
      const payload: { name?: string; picture?: string | null } = {};
      if (name.trim()) payload.name = name.trim();
      if (pictureUrl !== (user?.picture ?? null)) {
        payload.picture = pictureUrl ?? null;
      }
      if (Object.keys(payload).length === 0) {
        setSuccess("변경된 내용이 없습니다.");
        return;
      }
      setLoading(true);
      const updated = await updateCurrentUser(payload);
      setUser({
        ...updated,
        role: updated.role as
          | "INTERN"
          | "STAFF"
          | "ASSOCIATE"
          | "ASSISTANT_MANAGER"
          | "TEAM_LEAD",
      });
      setSuccess("프로필이 업데이트되었습니다.");
    } catch (err: unknown) {
      const errorMessage = (err as { message?: string }).message;
      setError(errorMessage || "프로필 업데이트에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleClearPicture = () => {
    setPictureUrl(null);
    setFile(null);
  };

  const handleWithdrawTeam = async () => {
    if (!confirm("정말 팀에서 탈퇴하시겠습니까?")) return;
    try {
      setWithdrawing(true);
      await withdrawFromCurrentTeam();
      logout();
      alert("회원 탈퇴가 완료되었습니다.");
      router.push("/");
    } catch (err: unknown) {
      const errorMessage = (err as { message?: string }).message;
      setError(errorMessage || "팀 탈퇴에 실패했습니다.");
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <AppLayout
      activeMenu=""
      sidebarVariant="default"
      headerProps={{ title: "Mypage" }}
    >
      <div className="max-w-3xl space-y-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">프로필 설정</h2>

          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          <div className="flex items-center gap-6 mb-6">
            <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center">
              {previewUrl || pictureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl || pictureUrl || ""}
                  alt="프로필 이미지"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl text-gray-400">👤</span>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-600"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading || !file}
                  className="px-4 py-2 bg-[#7F55B1] text-white rounded-lg text-sm hover:bg-[#6B479A] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? "업로드 중..." : "이미지 업로드"}
                </button>
                <button
                  type="button"
                  onClick={handleClearPicture}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:text-[#7F55B1]"
                >
                  사진 제거
                </button>
              </div>
              <p className="text-xs text-gray-500">
                JPG, PNG, GIF, WebP / 최대 5MB
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                닉네임
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="닉네임을 입력하세요"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="px-6 py-2 bg-[#7F55B1] text-white rounded-lg hover:bg-[#6B479A] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "저장 중..." : "저장"}
            </button>
          </div>
          <div className="mt-6 border-t border-gray-100 pt-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-2">팀 탈퇴</h3>
            <p className="text-xs text-gray-500 mb-3">
              팀에서 탈퇴하면 팀 기반 메뉴 접근이 제한됩니다.
            </p>
            <button
              type="button"
              onClick={handleWithdrawTeam}
              disabled={withdrawing || !user?.teamName}
              className="px-4 py-2 border border-red-200 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {withdrawing ? "탈퇴 처리 중..." : "회원 탈퇴"}
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
