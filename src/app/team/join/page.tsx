"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import AppLayout from "@/app/components/shared/AppLayout";
import { joinTeam } from "@/lib/api/team";
import { useAuthStore } from "@/app/stores/authStore";

export default function TeamJoinPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("팀에 가입 중입니다...");

  useEffect(() => {
    const teamName = searchParams.get("team");
    if (!teamName) {
      setStatus("error");
      setMessage("초대 링크가 유효하지 않습니다.");
      return;
    }

    const join = async () => {
      try {
        await joinTeam(teamName);
        setStatus("success");
        setMessage("팀에 성공적으로 가입했습니다. 대시보드로 이동합니다.");
        setTimeout(() => router.push("/"), 1200);
      } catch (err: unknown) {
        const errorMessage = (err as { message?: string }).message;
        setStatus("error");
        setMessage(errorMessage || "팀 가입에 실패했습니다.");
      }
    };

    if (!user) {
      setStatus("error");
      setMessage("로그인 후 초대 링크를 다시 열어주세요.");
      return;
    }

    join();
  }, [searchParams, router, user]);

  return (
    <AppLayout sidebarVariant="default" headerProps={{ title: "팀 가입" }}>
      <div className="max-w-xl bg-white rounded-2xl p-6 shadow-sm">
        <p
          className={`text-sm ${
            status === "error" ? "text-red-600" : "text-gray-700"
          }`}
        >
          {message}
        </p>
      </div>
    </AppLayout>
  );
}
import TeamJoin from "@/app/components/features/team/TeamJoin";

export default function TeamJoinPage() {
  return <TeamJoin />;
}
