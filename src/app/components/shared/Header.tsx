"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/app/stores/authStore";

export default function Header() {
  const router = useRouter();

  // Zustand에서 로그인 상태와 함수 가져오기
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <header>
      <div className="bg-blue-100 flex flex-row justify-between">
        <Link href="/" className="m-8">
          Home
        </Link>
        <div className="bg-red-100 flex flex-row justify-between items-center gap-4">
          {isLoggedIn ? (
            <>
              {/* 로그인된 경우 */}
              <Link href="/mypage" className="m-8">
                마이페이지
              </Link>
              <button
                onClick={handleLogout}
                className="m-8 px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                로그아웃
              </button>
            </>
          ) : (
            /* 로그인 안 된 경우 */
            <Link href="/auth/login" className="m-8">
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
