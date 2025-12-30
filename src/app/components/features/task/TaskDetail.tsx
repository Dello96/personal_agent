// TaskDetail 컴포넌트 (업무 상세 보기)

"use client";

import { useAuthStore } from "@/app/stores/authStore";
import { getTask } from "@/lib/api/tasks";
import { useEffect, useState } from "react";

// 임시 타입 정의 (나중에 실제 데이터로 교체)
interface TaskData {
  id: string;
  title: string;
  description: string;
  status: "PENDING" | "IN_PROGRESS" | "REVIEW" | "COMPLETED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  progress: number;
  dueDate: string;
  assignee: {
    name: string;
    email: string;
  };
  assigner: {
    name: string;
    email: string;
  };
  participants: {
    id: string;
    name: string;
  }[];
  createdAt: string;
}

interface TaskDetailProps {
  taskId: string;
}

export default function TaskDetail({ taskId }: TaskDetailProps) {
  // 탭 상태
  const [activeTab, setActiveTab] = useState<"detail" | "history" | "members">(
    "detail"
  );
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<TaskData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "";
    return new Date(dateString).toISOString().slice(0, 10);
  };

  useEffect(() => {
    const fetchTask = async () => {
      try {
        setLoading(true);
        const data = await getTask(taskId);
        setTask(data);
        setError(null);
      } catch (err) {
        console.error("업무 조회 실패:", err);
        setError("업무를 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchTask();
  }, [isLoggedIn, user?.teamName]);
  // 상태 라벨
  const statusLabels: Record<string, { label: string; color: string }> = {
    PENDING: { label: "대기중", color: "bg-gray-400" },
    IN_PROGRESS: { label: "진행중", color: "bg-blue-500" },
    REVIEW: { label: "검토중", color: "bg-yellow-500" },
    COMPLETED: { label: "완료", color: "bg-green-500" },
  };

  // 우선순위 라벨
  const priorityLabels: Record<string, { label: string; color: string }> = {
    LOW: { label: "낮음", color: "bg-gray-400" },
    MEDIUM: { label: "보통", color: "bg-blue-400" },
    HIGH: { label: "높음", color: "bg-orange-400" },
    URGENT: { label: "긴급", color: "bg-red-500" },
  };

  // 진행률 바 데이터 (일별 진행 상황 - 임시)
  const progressData = [
    { day: "월", value: 20 },
    { day: "화", value: 35 },
    { day: "수", value: 45 },
    { day: "목", value: 55 },
    { day: "금", value: 65 },
    { day: "토", value: 65 },
    { day: "일", value: 65 },
  ];

  return (
    <div className="bg-white rounded-3xl p-8 shadow-sm">
      {/* 상단 헤더 영역 */}
      <div className="mb-6">
        {/* <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-gray-800">{task}</h1>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-white text-sm ${
                statusLabels[task]
              }`}
            >
              {statusLabels[task]}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-white text-sm ${
                priorityLabels[task].color
              }`}
            >
              {priorityLabels[task]}
            </span>
          </div>
        </div> */}
        <p className="text-gray-500 text-sm">
          생성일: {formatDate(task?.createdAt)} · 마감일:{" "}
          {formatDate(task?.dueDate)}
        </p>
      </div>

      {/* 탭 버튼 + 드롭다운 영역 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex bg-gray-100 rounded-full p-1">
          <button
            onClick={() => setActiveTab("detail")}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === "detail"
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            상세 정보
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === "history"
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            히스토리
          </button>
          <button
            onClick={() => setActiveTab("members")}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === "members"
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            참여자
          </button>
        </div>

        {/* 드롭다운 (상태 변경용) */}
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-full text-sm text-gray-600 hover:border-[#7F55B1] transition-all">
          상태 변경
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>

      {/* 진행률 표시 영역 */}
      <div className="mb-8">
        <div className="flex items-baseline gap-3 mb-2">
          <span className="text-4xl font-bold text-gray-800">
            {task?.progress || 0}%
          </span>
          <span className="text-green-500 text-sm flex items-center gap-1">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
            +15% 이번 주
          </span>
        </div>
        <p className="text-gray-400 text-sm mb-4">전체 진행률</p>

        {/* 진행률 바 */}
        <div className="w-full bg-gray-100 rounded-full h-3 mb-6">
          <div
            className="bg-gradient-to-r from-[#7F55B1] to-purple-400 h-3 rounded-full transition-all"
            style={{ width: `${task?.progress || 0}%` }}
          ></div>
        </div>
      </div>

      {/* 막대 그래프 영역 */}
      <div className="mb-8">
        <div className="flex items-end justify-between h-40 gap-4 px-4">
          {progressData.map((data, index) => (
            <div key={index} className="flex flex-col items-center flex-1">
              <div
                className="w-full bg-gradient-to-t from-[#7F55B1] to-purple-300 rounded-t-lg transition-all hover:from-[#6B479A] hover:to-purple-400"
                style={{ height: `${data.value}%` }}
              ></div>
              <span className="text-xs text-gray-400 mt-2">{data.day}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-[#7F55B1] rounded-full"></span>
            <span className="text-gray-500">이번 주</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-gray-300 rounded-full"></span>
            <span className="text-gray-500">지난 주</span>
          </div>
        </div>
      </div>

      {/* 하단 3개 카드 영역 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 담당자 정보 카드 */}
        <div className="bg-gray-50 rounded-2xl p-5">
          <h3 className="text-gray-800 font-semibold mb-4">담당자 정보</h3>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-br from-[#7F55B1] to-purple-400 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-medium">
                {task?.assignee?.name}
              </span>
            </div>
            <div>
              <p className="text-gray-800 font-medium text-sm">
                {task?.assignee.name}
              </p>
              <p className="text-gray-400 text-xs">{task?.assignee?.email}</p>
            </div>
          </div>
          <div className="border-t border-gray-200 pt-3">
            <p className="text-gray-400 text-xs mb-1">업무 지시자</p>
            <p className="text-gray-600 text-sm">{task?.assigner?.name}</p>
          </div>
        </div>

        {/* 업무 설명 카드 */}
        <div className="bg-gray-50 rounded-2xl p-5">
          <h3 className="text-gray-800 font-semibold mb-4">업무 설명</h3>
          <p className="text-gray-600 text-sm leading-relaxed line-clamp-4">
            {task?.description}
          </p>
          <button className="text-[#7F55B1] text-sm mt-3 hover:underline">
            자세히 보기
          </button>
        </div>

        {/* 참여자 카드 */}
        <div className="bg-gray-50 rounded-2xl p-5">
          <h3 className="text-gray-800 font-semibold mb-4">참여자</h3>
          <div className="space-y-3">
            {task?.participants.slice(0, 3).map((participant) => (
              <div key={participant.id} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-gray-600 text-xs">
                    {participant.name}
                  </span>
                </div>
                <p className="text-gray-700 text-sm">{participant.name}</p>
              </div>
            ))}
          </div>
          {task?.participants && task.participants.length > 3 && (
            <p className="text-gray-400 text-xs mt-3">
              +{task.participants.length - 3}명 더 보기
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
