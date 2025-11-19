"use client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export default function LoginContent() {
  const handleGoogleLogin = () => {
    window.location.href = `${API_URL}/login`;
  };
  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={handleGoogleLogin}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Google Login
      </button>
      <button className="px-4 py-2 bg-yellow-400 text-black rounded hover:bg-yellow-500">
        Kakao Login
      </button>
    </div>
  );
}
