"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { login } from "@/lib/api/auth";
import { useAuthStore } from "@/app/stores/authStore";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function LoginContent() {
  const router = useRouter();
  const kakaoLoginImageUrl = "/images/kakao_login_medium_narrow.png";
  const googleLoginImageUrl = "/images/web_light_sq_ctn@1x.png";

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // 소셜 로그인 핸들러
  const handleGoogleLogin = () => {
    window.location.href = `${API_URL}/login`;
  };

  const handleKakaoLogin = () => {
    window.location.href = `${API_URL}/auth/kakao`;
  };

  // 입력값 변경 핸들러
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError("");
  };

  // 일반 로그인 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.email || !formData.password) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const result = await login({
        email: formData.email,
        password: formData.password,
      });

      // 로그인 상태 저장
      useAuthStore.getState().login(
        {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          picture: result.user.picture ?? null,
          role: result.user.role as
            | "MEMBER"
            | "TEAM_LEAD"
            | "MANAGER"
            | "DIRECTOR",
          teamName: result.user.teamName ?? null,
        },
        result.token
      );

      // 메인 페이지로 이동
      router.push("/");
    } catch (error) {
      if (error instanceof Error) {
        setError(error.message);
      } else {
        setError("로그인 중 오류가 발생했습니다.");
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
          <p className="text-gray-600 mt-2">로그인</p>
        </div>

        {/* 로그인 폼 */}
        <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          {/* 일반 로그인 폼 */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이메일
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="example@email.com"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7F55B1] focus:border-transparent transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="비밀번호를 입력하세요"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#7F55B1] focus:border-transparent transition-all"
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-4 rounded-xl font-semibold text-white transition-all ${
                isLoading
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-gradient-to-r from-[#7F55B1] to-[#9B6BC3] hover:shadow-lg hover:scale-[1.02]"
              }`}
            >
              {isLoading ? "로그인 중..." : "로그인"}
            </button>
          </form>

          {/* 구분선 */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">
                또는 소셜 계정으로 로그인
              </span>
            </div>
          </div>

          {/* 소셜 로그인 버튼 */}
          <div className="flex flex-col gap-3 items-center">
            <button
              onClick={handleGoogleLogin}
              className="relative rounded-lg overflow-hidden hover:opacity-90 transition-opacity shadow-md hover:shadow-lg"
            >
              <Image
                src={googleLoginImageUrl}
                alt="google 로그인"
                width={183}
                height={45}
                className="w-183 h-45"
              />
            </button>
            <button
              onClick={handleKakaoLogin}
              className="relative rounded-lg overflow-hidden hover:opacity-90 transition-opacity shadow-md hover:shadow-lg"
            >
              <Image
                src={kakaoLoginImageUrl}
                alt="kakao 로그인"
                width={183}
                height={45}
                className="w-183 h-45"
              />
            </button>
          </div>

          {/* 회원가입 링크 */}
          <div className="text-center pt-4 border-t border-gray-100">
            <p className="text-gray-600">
              계정이 없으신가요?{" "}
              <Link
                href="/auth/register"
                className="text-[#7F55B1] font-medium hover:underline"
              >
                회원가입
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
