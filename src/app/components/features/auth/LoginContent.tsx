"use client";

import Image from "next/image";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function LoginContent() {
  const kakaoLoginImageUrl = "/images/kakao_login_medium_narrow.png";
  const googleLoginImageUrl = "/images/web_light_sq_ctn@1x.png";
  const handleGoogleLogin = () => {
    // 백엔드 서버의 Google OAuth 엔드포인트로 이동
    window.location.href = `${API_URL}/login`;
  };

  const handleKakaoLogin = () => {
    // 카카오 로그인 (추후 구현)
    console.log("Kakao login");
  };

  return (
    <div className="flex flex-col gap-4 justify-self-center">
      <button
        className="relative w-full max-w-sm rounded-lg overflow-hidden hover:opacity-90 transition-opacity shadow-md hover:shadow-lg"
        onClick={handleGoogleLogin}
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
        className="relative w-full max-w-sm rounded-lg overflow-hidden hover:opacity-90 transition-opacity shadow-md hover:shadow-lg"
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
  );
}
