"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const loginStatus = searchParams.get("login");

  useEffect(() => {
    if (loginStatus === "success") {
      // 로그인 성공 시 URL에서 쿼리 파라미터 제거
      router.replace("/");
      // 여기서 추가 처리 가능 (예: 사용자 정보 저장, 토스트 메시지 등)
      console.log("로그인 성공!");
    }
  }, [loginStatus, router]);

  return (
    <div>
      <h1>HomePage</h1>
      {loginStatus === "success" && (
        <div className="mt-4 p-4 bg-green-100 text-green-800 rounded">
          로그인에 성공했습니다!
        </div>
      )}
    </div>
  );
}
