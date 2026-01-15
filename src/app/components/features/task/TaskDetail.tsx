// TaskDetail 컴포넌트 (업무 상세 보기)

"use client";

import { useAuthStore } from "@/app/stores/authStore";
import { getTask } from "@/lib/api/tasks";
import { useEffect, useState } from "react";
import { Task } from "@/lib/api/tasks";
import { updateTaskStatus } from "@/lib/api/tasks";

interface TaskDetailProps {
  taskId: string;
}

export default function TaskDetail({ taskId }: TaskDetailProps) {
  // 탭 상태
  const [activeTab, setActiveTab] = useState<"detail" | "history" | "members">(
    "detail"
  );
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const [taskStatus, setTaskStatus] = useState("OFF");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
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

  const taskStatusHandler = () => {
    if (taskStatus === "OFF") {
      setTaskStatus("ON");
    } else {
      setTaskStatus("완료");
    }
  };

  // OFF/ON 토글 핸들러
  const handleToggleStatus = async () => {
    if (!task) return;

    try {
      setIsUpdatingStatus(true);

      let newStatus: string;

      // 현재 상태에 따라 다음 상태 결정
      if (task.status === "PENDING") {
        // OFF → ON: PENDING → NOW
        newStatus = "NOW";
      } else if (task.status === "NOW") {
        // ON → COMPLETED: NOW → COMPLETED
        newStatus = "REVIEW";
      } else {
        // 이미 완료된 상태
        return;
      }

      // API 호출
      const updatedTask = await updateTaskStatus(task.id, newStatus);
      setTask(updatedTask);
    } catch (error) {
      console.error("상태 변경 실패:", error);
      alert("상태 변경에 실패했습니다.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // 리뷰 승인 핸들러 (ENDING으로 변경)
  const handleReviewApprove = async () => {
    if (!task) return;

    // 권한 확인
    if (!["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(user?.role || "")) {
      alert("리뷰 권한이 없습니다.");
      return;
    }

    try {
      setIsUpdatingStatus(true);
      const updatedTask = await updateTaskStatus(task.id, "ENDING");
      setTask(updatedTask);
      alert("리뷰를 승인했습니다, 업무를 종료처리 할까요?");
    } catch (error) {
      console.error("리뷰 승인 실패:", error);
      alert("리뷰 승인에 실패했습니다.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // 리뷰 반려 핸들러 (NOW로 변경 - 재작업)
  const handleReviewReject = async () => {
    if (!task) return;

    // 권한 확인
    if (!["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(user?.role || "")) {
      alert("리뷰 권한이 없습니다.");
      return;
    }

    const comment = prompt("반려 사유를 입력해주세요:");
    if (!comment) return;

    try {
      setIsUpdatingStatus(true);
      const updatedTask = await updateTaskStatus(task.id, "NOW", comment);
      setTask(updatedTask);
      alert("리뷰가 반려되어 재작업 상태로 변경되었습니다.");
    } catch (error) {
      console.error("리뷰 반려 실패:", error);
      alert("리뷰 반려에 실패했습니다.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // 취소 핸들러
  const handleCancel = async () => {
    if (!task) return;

    if (!confirm("정말 업무를 취소하시겠습니까?")) {
      return;
    }

    try {
      setIsUpdatingStatus(true);
      const updatedTask = await updateTaskStatus(task.id, "CANCELLED");
      setTask(updatedTask);
      alert("업무가 취소되었습니다.");
    } catch (error) {
      console.error("취소 실패:", error);
      alert("업무 취소에 실패했습니다.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // 종료 핸들러
  const handleEnd = async () => {
    if (!task) return;

    if (!confirm("업무를 최종 종료하시겠습니까?")) {
      return;
    }

    try {
      setIsUpdatingStatus(true);
      const updatedTask = await updateTaskStatus(task.id, "ENDING");
      setTask(updatedTask);
      alert("업무가 종료되었습니다.");
    } catch (error) {
      console.error("종료 실패:", error);
      alert("업무 종료에 실패했습니다.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

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
        {/* 상태 변경 버튼 영역 */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* 1. OFF/ON 토글 버튼 (담당자만, PENDING/NOW 상태일 때) */}
          {task?.assigneeId === user?.id &&
            (task?.status === "PENDING" || task?.status === "NOW") && (
              <button
                onClick={handleToggleStatus}
                disabled={isUpdatingStatus}
                className={`px-6 py-2 rounded-full font-medium transition-all ${
                  task.status === "PENDING"
                    ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    : "bg-[#7F55B1] text-white hover:bg-[#6B479A]"
                } disabled:opacity-50`}
              >
                {task.status === "PENDING" ? "OFF" : "ON"}
              </button>
            )}

          {/* 2. 리뷰 버튼 영역 (팀장 이상, COMPLETED 상태일 때) */}
          {["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(user?.role || "") &&
            task?.status === "COMPLETED" && (
              <div className="flex gap-2">
                <button
                  onClick={handleReviewApprove}
                  disabled={isUpdatingStatus}
                  className="px-6 py-2 bg-green-500 text-white rounded-full font-medium hover:bg-green-600 transition-all disabled:opacity-50"
                >
                  리뷰 승인
                </button>
                <button
                  onClick={handleReviewReject}
                  disabled={isUpdatingStatus}
                  className="px-6 py-2 bg-orange-500 text-white rounded-full font-medium hover:bg-orange-600 transition-all disabled:opacity-50"
                >
                  리뷰 반려
                </button>
              </div>
            )}

          {/* 3. REVIEW 상태 표시 (검토 중) */}
          {task?.status === "REVIEW" && (
            <div className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full font-medium">
              검토 중...
            </div>
          )}

          {/* 4. 취소 버튼 (CANCELLED, ENDING 상태가 아닐 때) */}
          {task?.status !== "CANCELLED" && task?.status !== "ENDING" && (
            <button
              onClick={handleCancel}
              disabled={isUpdatingStatus}
              className="px-6 py-2 bg-red-500 text-white rounded-full font-medium hover:bg-red-600 transition-all disabled:opacity-50"
            >
              취소
            </button>
          )}

          {/* 5. 종료 버튼 (COMPLETED 상태일 때, 팀장 이상만) */}
          {task?.status === "COMPLETED" &&
            ["TEAM_LEAD", "MANAGER", "DIRECTOR"].includes(user?.role || "") && (
              <button
                onClick={handleEnd}
                disabled={isUpdatingStatus}
                className="px-6 py-2 bg-gray-700 text-white rounded-full font-medium hover:bg-gray-800 transition-all disabled:opacity-50"
              >
                종료
              </button>
            )}

          {/* 6. 최종 상태 표시 (CANCELLED, ENDING) */}
          {task?.status === "CANCELLED" && (
            <div className="px-4 py-2 bg-red-100 text-red-800 rounded-full font-medium">
              취소됨
            </div>
          )}
          {task?.status === "ENDING" && (
            <div className="px-4 py-2 bg-gray-700 text-white rounded-full font-medium">
              종료됨
            </div>
          )}
        </div>
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
                {task?.assignee?.name}
              </p>
              <p className="text-gray-400 text-xs">{task?.assignee?.email}</p>
            </div>
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
            {task?.participants?.slice(0, 3).map((participant) => (
              <div key={participant.id} className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-gray-600 text-xs">
                    {participant.user.name}
                  </span>
                </div>
                <p className="text-gray-700 text-sm">{participant.user.name}</p>
              </div>
            ))}
          </div>
          {task?.participants && task.participants.length > 3 && (
            <p className="text-gray-400 text-xs mt-3">
              +{task.participants.length - 3}명 더 보기
            </p>
          )}
        </div>
        {task?.referenceImageUrls && task.referenceImageUrls.length > 0 && (
          <div className="mt-8">
            <h3 className="text-gray-800 font-semibold mb-4">
              레퍼런스 이미지
            </h3>
            <div className="grid grid-cols-3 gap-4">
              {task.referenceImageUrls.map(
                (imageUrl: string, index: number) => (
                  <div
                    key={index}
                    className="relative group cursor-pointer"
                    onClick={() => {
                      // 이미지 확대 모달 (선택사항)
                      window.open(imageUrl, "_blank");
                    }}
                  >
                    <img
                      src={imageUrl}
                      alt={`레퍼런스 이미지 ${index + 1}`}
                      className="w-full h-48 object-cover rounded-lg border border-gray-200 hover:border-[#7F55B1] transition-all"
                      onError={(e) => {
                        // 이미지 로드 실패 시 대체 이미지
                        e.currentTarget.src = "/images/placeholder.png";
                      }}
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all rounded-lg flex items-center justify-center">
                      <span className="text-white opacity-0 group-hover:opacity-100 text-sm">
                        클릭하여 확대
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
