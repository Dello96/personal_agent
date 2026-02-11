"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { register, checkEmail } from "@/lib/api/auth";
import { useAuthStore } from "@/app/stores/authStore";
import { joinTeam } from "@/lib/api/team";
import { getCurrentUser } from "@/lib/api/users";

const PENDING_TEAM_KEY = "pendingInviteTeam";

const ROLES = [
  { value: "INTERN", label: "인턴", description: "프로젝트에 참여합니다" },
  { value: "STAFF", label: "사원", description: "프로젝트에 참여합니다" },
  { value: "ASSOCIATE", label: "주임", description: "프로젝트에 참여합니다" },
  {
    value: "ASSISTANT_MANAGER",
    label: "대리",
    description: "프로젝트에 참여합니다",
  },
  {
    value: "TEAM_LEAD",
    label: "팀장",
    description: "팀을 관리하고 업무를 배정합니다",
  },
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    passwordConfirm: "",
    role: "INTERN" as
      | "INTERN"
      | "STAFF"
      | "ASSOCIATE"
      | "ASSISTANT_MANAGER"
      | "TEAM_LEAD",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [emailChecked, setEmailChecked] = useState(false);
  const [inviteTeam, setInviteTeam] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const pendingTeam = localStorage.getItem(PENDING_TEAM_KEY);
    if (pendingTeam) {
      setInviteTeam(pendingTeam);
    }
  }, []);

  // 입력값 변경 핸들러
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // 에러 초기화
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }

    // 이메일 변경 시 중복 확인 초기화
    if (name === "email") {
      setEmailChecked(false);
    }
  };

  // 이메일 중복 확인
  const handleCheckEmail = async () => {
    if (!formData.email) {
      setErrors((prev) => ({ ...prev, email: "이메일을 입력해주세요." }));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setErrors((prev) => ({
        ...prev,
        email: "올바른 이메일 형식이 아닙니다.",
      }));
      return;
    }

    try {
      const result = await checkEmail(formData.email);
      if (result.available) {
        setEmailChecked(true);
        setErrors((prev) => ({ ...prev, email: "" }));
      } else {
        setErrors((prev) => ({ ...prev, email: "이미 가입된 이메일입니다." }));
      }
    } catch (error) {
      setErrors((prev) => ({
        ...prev,
        email: "이메일 확인 중 오류가 발생했습니다.",
      }));
    }
  };

  // 폼 유효성 검사
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "이름을 입력해주세요.";
    }

    if (!formData.email) {
      newErrors.email = "이메일을 입력해주세요.";
    } else if (!emailChecked) {
      newErrors.email = "이메일 중복 확인이 필요합니다.";
    }

    if (!formData.password) {
      newErrors.password = "비밀번호를 입력해주세요.";
    } else if (formData.password.length < 8) {
      newErrors.password = "비밀번호는 최소 8자 이상이어야 합니다.";
    }

    if (formData.password !== formData.passwordConfirm) {
      newErrors.passwordConfirm = "비밀번호가 일치하지 않습니다.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // 회원가입 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const result = await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });

      // 로그인 상태 저장
      useAuthStore.getState().login(
        {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          picture: result.user.picture ?? null,
          role: result.user.role as
            | "INTERN"
            | "STAFF"
            | "ASSOCIATE"
            | "ASSISTANT_MANAGER"
            | "TEAM_LEAD",
          teamName: result.user.teamName ?? null,
        },
        result.token
      );

      if (inviteTeam) {
        try {
          await joinTeam(inviteTeam);
          const updatedUser = await getCurrentUser();
          if (updatedUser) {
            useAuthStore.getState().setUser({
              ...updatedUser,
              role: updatedUser.role as
                | "INTERN"
                | "STAFF"
                | "ASSOCIATE"
                | "ASSISTANT_MANAGER"
                | "TEAM_LEAD",
            });
          }
          if (typeof window !== "undefined") {
            localStorage.removeItem(PENDING_TEAM_KEY);
          }
        } catch (joinError) {
          throw new Error("초대된 팀 가입에 실패했습니다. 다시 시도해주세요.");
        }
      }

      // 메인 페이지로 이동
      router.push("/");
    } catch (error) {
      if (error instanceof Error) {
        setErrors({ submit: error.message });
      } else {
        setErrors({ submit: "회원가입 중 오류가 발생했습니다." });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-purple-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 로고 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#7F55B1] flex items-center justify-center gap-2">
            <span className="text-4xl">📋</span>
            TaskFlow
          </h1>
          <p className="text-gray-600 mt-2">회원가입</p>
        </div>

        {/* 회원가입 폼 */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-xl p-8 space-y-5"
        >
          {inviteTeam && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-700">
              초대된 팀: <span className="font-semibold">{inviteTeam}</span>
              <span className="block text-xs text-violet-600 mt-1">
                회원가입 완료 후 자동으로 팀에 가입됩니다.
              </span>
            </div>
          )}
          {/* 이름 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="이름을 입력하세요"
              className={`w-full px-4 py-3 rounded-xl border ${
                errors.name ? "border-red-500" : "border-gray-200"
              } focus:outline-none focus:ring-2 focus:ring-[#7F55B1] focus:border-transparent transition-all`}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-500">{errors.name}</p>
            )}
          </div>

          {/* 이메일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              이메일 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="example@email.com"
                className={`flex-1 px-4 py-3 rounded-xl border ${
                  errors.email
                    ? "border-red-500"
                    : emailChecked
                      ? "border-green-500"
                      : "border-gray-200"
                } focus:outline-none focus:ring-2 focus:ring-[#7F55B1] focus:border-transparent transition-all`}
              />
              <button
                type="button"
                onClick={handleCheckEmail}
                className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors text-sm font-medium whitespace-nowrap"
              >
                중복 확인
              </button>
            </div>
            {errors.email && (
              <p className="mt-1 text-sm text-red-500">{errors.email}</p>
            )}
            {emailChecked && !errors.email && (
              <p className="mt-1 text-sm text-green-500">
                ✓ 사용 가능한 이메일입니다.
              </p>
            )}
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호 <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="8자 이상 입력하세요"
              className={`w-full px-4 py-3 rounded-xl border ${
                errors.password ? "border-red-500" : "border-gray-200"
              } focus:outline-none focus:ring-2 focus:ring-[#7F55B1] focus:border-transparent transition-all`}
            />
            {errors.password && (
              <p className="mt-1 text-sm text-red-500">{errors.password}</p>
            )}
          </div>

          {/* 비밀번호 확인 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              비밀번호 확인 <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              name="passwordConfirm"
              value={formData.passwordConfirm}
              onChange={handleChange}
              placeholder="비밀번호를 다시 입력하세요"
              className={`w-full px-4 py-3 rounded-xl border ${
                errors.passwordConfirm ? "border-red-500" : "border-gray-200"
              } focus:outline-none focus:ring-2 focus:ring-[#7F55B1] focus:border-transparent transition-all`}
            />
            {errors.passwordConfirm && (
              <p className="mt-1 text-sm text-red-500">
                {errors.passwordConfirm}
              </p>
            )}
          </div>

          {/* 역할 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              역할 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((role) => (
                <label
                  key={role.value}
                  className={`relative flex flex-col p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    formData.role === role.value
                      ? "border-[#7F55B1] bg-purple-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={role.value}
                    checked={formData.role === role.value}
                    onChange={handleChange}
                    className="sr-only"
                  />
                  <span
                    className={`font-medium ${
                      formData.role === role.value
                        ? "text-[#7F55B1]"
                        : "text-gray-700"
                    }`}
                  >
                    {role.label}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    {role.description}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 에러 메시지 */}
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* 가입 버튼 */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-4 rounded-xl font-semibold text-white transition-all ${
              isLoading
                ? "bg-gray-400 cursor-not-allowed"
                : "bg-gradient-to-r from-[#7F55B1] to-[#9B6BC3] hover:shadow-lg hover:scale-[1.02]"
            }`}
          >
            {isLoading ? "가입 중..." : "회원가입"}
          </button>

          {/* 로그인 링크 */}
          <div className="text-center pt-4 border-t border-gray-100">
            <p className="text-gray-600">
              이미 계정이 있으신가요?{" "}
              <Link
                href="/auth/login"
                className="text-[#7F55B1] font-medium hover:underline"
              >
                로그인
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
