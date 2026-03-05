// TaskDetail 컴포넌트 (업무 상세 보기)

"use client";

import { useAuthStore } from "@/app/stores/authStore";
import {
  getTask,
  updateTaskStatus,
  updateParticipantNote,
  getParticipantNotes,
  updateParticipantStartStatus,
  updateTaskLinks,
  ParticipantNote,
  getMyTaskDiscussionNote,
  getTaskDiscussionNotes,
  saveMyTaskDiscussionNote,
  TaskDiscussionNoteListItem,
  deleteMyTaskDiscussionNote,
} from "@/lib/api/tasks";
import { useEffect, useState } from "react";
import { Task } from "@/lib/api/tasks";
import TaskGithubActivityWidget from "@/app/components/features/github/TaskGithubActivityWidget";
import { getDirectChatRoom } from "@/lib/api/chat";
import { useRouter } from "next/navigation";

interface TaskDetailProps {
  taskId: string;
  activeTab?: TaskDetailTab;
  onTabChange?: (tab: TaskDetailTab) => void;
}

export type TaskDetailTab =
  | "overview"
  | "work"
  | "members"
  | "discussion"
  | "resources"
  | "ai"
  | "activity";

export default function TaskDetail({
  taskId,
  activeTab: controlledActiveTab,
  onTabChange,
}: TaskDetailProps) {
  // 탭 상태
  const [internalActiveTab, setInternalActiveTab] =
    useState<TaskDetailTab>("overview");
  const activeTab = controlledActiveTab ?? internalActiveTab;
  const setActiveTab = (tab: TaskDetailTab) => {
    if (onTabChange) {
      onTabChange(tab);
      return;
    }
    setInternalActiveTab(tab);
  };
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const user = useAuthStore((state) => state.user);
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const [taskStatus, setTaskStatus] = useState("OFF");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [participantNotes, setParticipantNotes] = useState<ParticipantNote[]>(
    []
  );
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState<{ [key: string]: string }>({});
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isEditingLinks, setIsEditingLinks] = useState(false);
  const [linkInputs, setLinkInputs] = useState<string[]>([]);
  const [isSavingLinks, setIsSavingLinks] = useState(false);
  const [discussionInput, setDiscussionInput] = useState("");
  const [isDiscussionLoading, setIsDiscussionLoading] = useState(false);
  const [isDiscussionSaving, setIsDiscussionSaving] = useState(false);
  const [discussionNotes, setDiscussionNotes] = useState<
    TaskDiscussionNoteListItem[]
  >([]);
  const [editingDiscussionId, setEditingDiscussionId] = useState<string | null>(
    null
  );
  const [editingDiscussionContent, setEditingDiscussionContent] = useState("");
  const router = useRouter();

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "";
    return new Date(dateString).toISOString().slice(0, 10);
  };

  const refreshDiscussion = async () => {
    const [note, notes] = await Promise.all([
      getMyTaskDiscussionNote(taskId),
      getTaskDiscussionNotes(taskId),
    ]);
    setDiscussionInput(note?.content || "");
    setDiscussionNotes(notes);
  };

  useEffect(() => {
    const fetchTask = async () => {
      try {
        setLoading(true);
        const data = await getTask(taskId);
        console.log("업무 데이터:", data);
        console.log("참여자 데이터:", data?.participants);
        setTask(data);
        setError(null);
        // 링크 입력 필드 초기화
        setLinkInputs(data.referenceLinks || []);
      } catch (err) {
        console.error("업무 조회 실패:", err);
        setError("업무를 불러오는데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    const fetchNotes = async () => {
      try {
        const notes = await getParticipantNotes(taskId);
        setParticipantNotes(notes);
      } catch (err) {
        console.error("참여자 노트 조회 실패:", err);
      }
    };

    const fetchDiscussion = async () => {
      try {
        setIsDiscussionLoading(true);
        await refreshDiscussion();
      } catch (err) {
        console.error("댓글/논의 조회 실패:", err);
        setDiscussionInput("");
        setDiscussionNotes([]);
      } finally {
        setIsDiscussionLoading(false);
      }
    };

    if (taskId) {
      fetchTask();
      fetchNotes();
      fetchDiscussion();
    }
  }, [isLoggedIn, user?.teamName, taskId]);

  // task가 로드된 후 노트 내용 초기화
  useEffect(() => {
    if (task && participantNotes.length > 0) {
      const noteMap: { [key: string]: string } = {};
      participantNotes.forEach((note) => {
        if (note.isOwn) {
          const participant = task.participants?.find(
            (p) => p.userId === note.userId
          );
          if (participant) {
            noteMap[participant.id] = note.note;
          }
        }
      });
      setNoteContent(noteMap);
    }
  }, [task, participantNotes]);

  const taskStatusHandler = () => {
    if (taskStatus === "OFF") {
      setTaskStatus("ON");
    } else {
      setTaskStatus("완료");
    }
  };

  // ON 버튼 핸들러 (팀장급 이상은 NOW 상태에서 상태 변경 안 함)
  const handleToggleStatus = async () => {
    if (!task || !user) return;

    // 팀장급 이상은 NOW 상태에서 ON 버튼을 눌러도 상태 변경 안 함
    const isTeamLeadOrAbove = ["TEAM_LEAD"].includes(user.role || "");
    if (isTeamLeadOrAbove && task.status === "NOW") {
      // 상태 변경 없이 그냥 반환
      return;
    }
  };

  // 참여자별 업무 시작 핸들러 (note 작성 후 시작 버튼 클릭 시)
  const handleParticipantStart = async (participantId: string) => {
    if (!task || !user) return;

    try {
      setIsUpdatingStatus(true);

      // 참여자 시작 상태 업데이트
      await updateParticipantStartStatus(task.id, participantId, true);

      // 업무 정보 새로고침
      const refreshedTask = await getTask(taskId);
      setTask(refreshedTask);

      alert("업무를 시작했습니다.");
    } catch (error: any) {
      console.error("업무 시작 실패:", error);
      alert(error.message || "업무 시작에 실패했습니다.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // 검토요청 핸들러 (참여자만 사용 가능, NOW → REVIEW)
  const handleRequestReview = async () => {
    if (!task || !user) return;

    try {
      setIsUpdatingStatus(true);

      // 참여자만 검토 요청 가능
      const isParticipant = task.participants?.some(
        (p) => p.userId === user.id
      );
      const isAssignee = task.assigneeId === user.id;

      if (!isParticipant && !isAssignee) {
        alert("참여자만 검토를 요청할 수 있습니다.");
        return;
      }

      // 팀장급 이상은 검토 요청 불가
      const isTeamLeadOrAbove = ["TEAM_LEAD"].includes(user.role || "");
      if (isTeamLeadOrAbove) {
        alert("팀장급 이상은 검토 요청을 할 수 없습니다.");
        return;
      }

      // NOW → REVIEW 전이
      if (task.status !== "NOW") {
        alert("진행중인 업무만 검토를 요청할 수 있습니다.");
        return;
      }

      const updatedTask = await updateTaskStatus(task.id, "REVIEW");
      setTask(updatedTask);
      alert("검토가 요청되었습니다.");
    } catch (error: any) {
      console.error("검토 요청 실패:", error);
      alert(error.message || "검토 요청에 실패했습니다.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // 검토완료 핸들러 (REVIEW → ENDING)
  const handleReviewApprove = async () => {
    if (!task) return;

    // 권한 확인
    if (!["TEAM_LEAD"].includes(user?.role || "")) {
      alert("검토 권한이 없습니다.");
      return;
    }

    // REVIEW 상태에서만 검토완료 가능
    if (task.status !== "REVIEW") {
      alert("검토 중인 업무만 완료 처리할 수 있습니다.");
      return;
    }

    if (!confirm("검토를 완료하고 업무를 종료하시겠습니까?")) {
      return;
    }

    try {
      setIsUpdatingStatus(true);
      const updatedTask = await updateTaskStatus(task.id, "ENDING");
      setTask(updatedTask);
      alert("검토를 완료하고 업무를 종료했습니다.");
    } catch (error) {
      console.error("검토 완료 실패:", error);
      alert("검토 완료에 실패했습니다.");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // 검토 반려 핸들러 (REVIEW → NOW)
  const handleReviewReject = async () => {
    if (!task) return;

    // 권한 확인
    if (!["TEAM_LEAD"].includes(user?.role || "")) {
      alert("검토 권한이 없습니다.");
      return;
    }

    // REVIEW 상태에서만 반려 가능
    if (task.status !== "REVIEW") {
      alert("검토 중인 업무만 반려할 수 있습니다.");
      return;
    }

    const comment = prompt("반려 사유를 입력해주세요:");
    if (!comment) return;

    try {
      setIsUpdatingStatus(true);
      const updatedTask = await updateTaskStatus(task.id, "NOW", comment);
      setTask(updatedTask);
      alert("검토가 반려되어 재작업 상태로 변경되었습니다.");
    } catch (error) {
      console.error("검토 반려 실패:", error);
      alert("검토 반려에 실패했습니다.");
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

  const statusTextMap: Record<string, string> = {
    NOW: "진행중",
    IN_PROGRESS: "작업중",
    REVIEW: "검토중",
    COMPLETED: "완료",
    CANCELLED: "취소됨",
    ENDING: "종료됨",
    PENDING: "대기중",
  };

  const statusColorMap: Record<string, string> = {
    NOW: "bg-violet-100 text-violet-700",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    REVIEW: "bg-yellow-100 text-yellow-800",
    COMPLETED: "bg-green-100 text-green-700",
    CANCELLED: "bg-red-100 text-red-700",
    ENDING: "bg-gray-700 text-white",
    PENDING: "bg-gray-100 text-gray-700",
  };

  const priorityTextMap: Record<string, string> = {
    LOW: "낮음",
    MEDIUM: "보통",
    HIGH: "높음",
    URGENT: "긴급",
  };

  const activityLogs = [
    task?.createdAt
      ? {
          id: `created-${task.id}`,
          text: "업무가 생성되었습니다.",
          at: task.createdAt,
        }
      : null,
    task?.updatedAt
      ? {
          id: `updated-${task.id}`,
          text: "업무 정보가 업데이트되었습니다.",
          at: task.updatedAt,
        }
      : null,
    ...(task?.participants || [])
      .filter((participant) => participant.updatedAt)
      .map((participant) => ({
        id: `participant-${participant.id}-${participant.updatedAt}`,
        text: `${participant.user?.name || "참여자"}님의 작성 내용이 갱신되었습니다.`,
        at: participant.updatedAt as string,
      })),
  ]
    .filter(Boolean)
    .sort(
      (a, b) =>
        new Date((b as { at: string }).at).getTime() -
        new Date((a as { at: string }).at).getTime()
    ) as Array<{ id: string; text: string; at: string }>;

  const completedParticipantCount =
    task?.participants?.filter((participant) => Boolean(participant.startedAt))
      .length || 0;
  const totalParticipantCount = task?.participants?.length || 0;

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

      {/* 상태 변경 버튼 영역 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`px-3 py-1 rounded-full font-medium ${
              statusColorMap[task?.status || "PENDING"] || "bg-gray-100 text-gray-700"
            }`}
          >
            {statusTextMap[task?.status || "PENDING"] || task?.status || "대기중"}
          </span>
          <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 font-medium">
            중요도 {priorityTextMap[task?.priority || "MEDIUM"] || "보통"}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {(() => {
            const isParticipant = task?.participants?.some(
              (p) => p.userId === user?.id
            );
            const isAssignee = task?.assigneeId === user?.id;
            const isTeamLeadOrAbove = ["TEAM_LEAD"].includes(user?.role || "");
            const canToggle = isParticipant || isAssignee;

            // NOW 상태: 팀장급 이상은 ON, 취소 버튼 / 참여자는 ON, 검토요청 버튼
            if (task?.status === "NOW") {
              return (
                <>
                  {canToggle && (
                    <button
                      onClick={handleToggleStatus}
                      disabled={isUpdatingStatus}
                      className="px-6 py-2 bg-[#7F55B1] text-white rounded-full font-medium hover:bg-[#6B479A] transition-all disabled:opacity-50"
                    >
                      ON
                    </button>
                  )}
                  {!isTeamLeadOrAbove && canToggle && (
                    <button
                      onClick={handleRequestReview}
                      disabled={isUpdatingStatus}
                      className="px-6 py-2 bg-blue-500 text-white rounded-full font-medium hover:bg-blue-600 transition-all disabled:opacity-50"
                    >
                      검토요청
                    </button>
                  )}
                  {isTeamLeadOrAbove && (
                    <button
                      onClick={handleCancel}
                      disabled={isUpdatingStatus}
                      className="px-6 py-2 bg-red-500 text-white rounded-full font-medium hover:bg-red-600 transition-all disabled:opacity-50"
                    >
                      취소
                    </button>
                  )}
                </>
              );
            }

            // REVIEW 상태: 팀장급 이상만 검토완료/반려 버튼
            if (task?.status === "REVIEW" && isTeamLeadOrAbove) {
              return (
                <>
                  <div className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full font-medium">
                    검토 중...
                  </div>
                  <button
                    onClick={handleReviewApprove}
                    disabled={isUpdatingStatus}
                    className="px-6 py-2 bg-green-500 text-white rounded-full font-medium hover:bg-green-600 transition-all disabled:opacity-50"
                  >
                    검토완료
                  </button>
                  <button
                    onClick={handleReviewReject}
                    disabled={isUpdatingStatus}
                    className="px-6 py-2 bg-orange-500 text-white rounded-full font-medium hover:bg-orange-600 transition-all disabled:opacity-50"
                  >
                    반려
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isUpdatingStatus}
                    className="px-6 py-2 bg-red-500 text-white rounded-full font-medium hover:bg-red-600 transition-all disabled:opacity-50"
                  >
                    취소
                  </button>
                </>
              );
            }

            // REVIEW 상태: 참여자는 검토 중 표시만
            if (task?.status === "REVIEW" && !isTeamLeadOrAbove) {
              return (
                <div className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full font-medium">
                  검토 중...
                </div>
              );
            }

            // CANCELLED, ENDING 상태 표시
            if (task?.status === "CANCELLED") {
              return (
                <div className="px-4 py-2 bg-red-100 text-red-800 rounded-full font-medium">
                  취소됨
                </div>
              );
            }

            if (task?.status === "ENDING") {
              return (
                <div className="px-4 py-2 bg-gray-700 text-white rounded-full font-medium">
                  종료됨
                </div>
              );
            }

            return null;
          })()}
        </div>
      </div>

      <section className="space-y-6">
          {activeTab === "overview" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-2xl p-5">
                  <h3 className="text-gray-800 font-semibold mb-3">담당자</h3>
                  <p className="text-sm font-medium text-gray-800">
                    {task?.assignee?.name || "-"}
                  </p>
                  <p className="text-xs text-gray-500">{task?.assignee?.email || "-"}</p>
                </div>
                <div className="bg-gray-50 rounded-2xl p-5">
                  <h3 className="text-gray-800 font-semibold mb-3">우선순위</h3>
                  <p className="text-sm text-gray-700">
                    {priorityTextMap[task?.priority || "MEDIUM"] || "보통"}
                  </p>
                </div>
                <div className="bg-gray-50 rounded-2xl p-5">
                  <h3 className="text-gray-800 font-semibold mb-3">마감일</h3>
                  <p className="text-sm text-gray-700">
                    {task?.dueDate ? formatDate(task.dueDate) : "미설정"}
                  </p>
                </div>
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl p-5">
                <h3 className="font-semibold text-gray-800 mb-3">업무 개요</h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {task?.description || "업무 설명이 없습니다."}
                </p>
              </div>
            </>
          )}

          {activeTab === "work" && (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-6 border border-[#7F55B1]/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#7F55B1] text-white">
                    1. 작업 설명
                  </span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {task?.description || "등록된 작업 내용이 없습니다."}
                </p>
              </div>
              <div className="rounded-2xl border border-gray-100 bg-white p-5">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                    2. 진행 현황
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-xs text-gray-500 mb-1">현재 상태</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {statusTextMap[task?.status || "PENDING"]}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-xs text-gray-500 mb-1">중요도</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {priorityTextMap[task?.priority || "MEDIUM"]}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-xs text-gray-500 mb-1">참여 진행률</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {completedParticipantCount} / {totalParticipantCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-xs text-gray-500 mb-1">생성일</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {formatDate(task?.createdAt) || "-"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-xs text-gray-500 mb-1">마감일</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {formatDate(task?.dueDate) || "미설정"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-xs text-gray-500 mb-1">최종 수정일</p>
                    <p className="text-sm font-semibold text-gray-800">
                      {formatDate(task?.updatedAt) || "-"}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
                      3. 내 작업 메모
                    </span>
                    <h3 className="text-lg font-semibold text-gray-800">
                      내가 작성한 할일
                    </h3>
                  </div>
                  <button
                    onClick={() => setActiveTab("members")}
                    className="text-sm text-[#7F55B1] hover:text-[#6B479A] font-medium"
                  >
                    참여자 탭에서 수정
                  </button>
                </div>
                {(() => {
                  const myParticipant = task?.participants?.find(
                    (participant) => participant.userId === user?.id
                  );
                  return myParticipant?.note ? (
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {myParticipant.note}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400">
                      아직 작성된 할일이 없습니다.
                    </p>
                  );
                })()}
              </div>
            </div>
          )}

          {activeTab === "members" && (
            <div className="space-y-4">
              {!task?.participants || task.participants.length === 0 ? (
                <div className="text-center py-8 text-gray-500">참여자가 없습니다.</div>
              ) : (
                task.participants.map((participant) => {
                  if (!participant.user) return null;
                  const isCurrentUser = participant.userId === user?.id;
                  const currentNote = noteContent[participant.id] || "";
                  const isEditing = editingNoteId === participant.id;

                  return (
                    <div
                      key={participant.id}
                      className="bg-gray-50 rounded-2xl p-5 border-2 border-transparent hover:border-[#7F55B1]/20 transition-all"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-gray-800 font-semibold">{participant.user.name}</p>
                          <p className="text-gray-400 text-xs">{participant.user.email}</p>
                        </div>
                        {isCurrentUser && (
                          <div className="flex items-center gap-2">
                            {participant.note && !participant.startedAt && (
                              <button
                                onClick={() => handleParticipantStart(participant.id)}
                                disabled={isUpdatingStatus}
                                className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                              >
                                시작
                              </button>
                            )}
                            <button
                              onClick={() => {
                                if (isEditing) {
                                  setEditingNoteId(null);
                                } else {
                                  setEditingNoteId(participant.id);
                                  setNoteContent({
                                    ...noteContent,
                                    [participant.id]:
                                      participant.note || currentNote || "",
                                  });
                                }
                              }}
                              className="px-4 py-2 text-sm bg-[#7F55B1] text-white rounded-lg hover:bg-[#6B479A] transition-colors"
                            >
                              {isEditing ? "취소" : "작성/수정"}
                            </button>
                          </div>
                        )}
                      </div>

                      {isEditing && isCurrentUser ? (
                        <div className="space-y-3">
                          <textarea
                            value={currentNote}
                            onChange={(e) =>
                              setNoteContent({
                                ...noteContent,
                                [participant.id]: e.target.value,
                              })
                            }
                            placeholder="업무 내용을 작성해주세요..."
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1] resize-none"
                            rows={5}
                          />
                          <div className="flex justify-end">
                            <button
                              onClick={async () => {
                                try {
                                  setIsSavingNote(true);
                                  await updateParticipantNote(
                                    taskId,
                                    participant.id,
                                    currentNote
                                  );
                                  const notes = await getParticipantNotes(taskId);
                                  setParticipantNotes(notes);
                                  setEditingNoteId(null);
                                  const updatedTask = await getTask(taskId);
                                  setTask(updatedTask);
                                } catch (error: any) {
                                  alert(error.message || "노트 저장에 실패했습니다.");
                                } finally {
                                  setIsSavingNote(false);
                                }
                              }}
                              disabled={isSavingNote}
                              className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50"
                            >
                              {isSavingNote ? "저장 중..." : "저장"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-white rounded-lg p-4 min-h-[80px]">
                          {participant.note ? (
                            <p className="text-gray-700 text-sm whitespace-pre-wrap">
                              {participant.note}
                            </p>
                          ) : (
                            <p className="text-gray-400 text-sm italic">작성된 내용이 없습니다.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === "discussion" && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">댓글 · 논의</h3>
              <p className="text-sm text-gray-500 mb-4">
                로그인한 계정 기준으로 댓글/논의가 DB에 저장됩니다.
              </p>
              {isDiscussionLoading ? (
                <div className="text-sm text-gray-400">불러오는 중...</div>
              ) : (
                <>
                  <textarea
                    value={discussionInput}
                    onChange={(e) => setDiscussionInput(e.target.value)}
                    placeholder="회의 결정사항, 블로커, 질문 등을 작성해두세요."
                    className="w-full min-h-[160px] px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1] resize-y"
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setIsDiscussionSaving(true);
                          await saveMyTaskDiscussionNote(taskId, discussionInput);
                          await refreshDiscussion();
                          alert("댓글/논의가 저장되었습니다.");
                        } catch (error: any) {
                          console.error("댓글/논의 저장 실패:", error);
                          alert(
                            error?.message || "댓글/논의 저장에 실패했습니다."
                          );
                        } finally {
                          setIsDiscussionSaving(false);
                        }
                      }}
                      disabled={isDiscussionSaving}
                      className="px-4 py-2 bg-[#7F55B1] text-white rounded-lg hover:bg-[#6B479A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDiscussionSaving ? "저장 중..." : "저장"}
                    </button>
                  </div>
                  <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
                    <p className="text-sm font-semibold text-gray-800 mb-3">
                      댓글/논의 목록
                    </p>
                    {discussionNotes.length > 0 ? (
                      <ul className="space-y-3">
                        {discussionNotes.map((note) => (
                          <li
                            key={note.id}
                            className="rounded-lg bg-white border border-gray-100 p-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    const room = await getDirectChatRoom(
                                      note.author.id
                                    );
                                    router.push(
                                      `/chat?roomId=${room.id}&type=DIRECT&userId=${note.author.id}`
                                    );
                                  } catch (error) {
                                    console.error("직접 채팅 이동 실패:", error);
                                    alert("채팅방 이동에 실패했습니다.");
                                  }
                                }}
                                className="text-sm font-semibold text-[#7F55B1] hover:underline"
                              >
                                {note.author.name}
                              </button>
                              {note.authorId === user?.id ? (
                                <div className="flex items-center gap-2 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingDiscussionId(note.id);
                                      setEditingDiscussionContent(note.content);
                                    }}
                                    className="text-xs px-2 py-1 rounded bg-violet-100 text-violet-700 hover:bg-violet-200"
                                  >
                                    수정
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (
                                        !confirm(
                                          "내 댓글/논의를 삭제하시겠어요?"
                                        )
                                      ) {
                                        return;
                                      }
                                      try {
                                        setIsDiscussionSaving(true);
                                        await deleteMyTaskDiscussionNote(taskId);
                                        setDiscussionInput("");
                                        await refreshDiscussion();
                                        alert("댓글/논의가 삭제되었습니다.");
                                      } catch (error: any) {
                                        console.error("댓글/논의 삭제 실패:", error);
                                        alert(
                                          error?.message ||
                                            "댓글/논의 삭제에 실패했습니다."
                                        );
                                      } finally {
                                        setIsDiscussionSaving(false);
                                      }
                                    }}
                                    className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200"
                                  >
                                    삭제
                                  </button>
                                </div>
                              ) : null}
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5 mb-2">
                              {new Date(note.updatedAt).toLocaleString("ko-KR")}
                            </p>
                            {editingDiscussionId === note.id ? (
                              <div className="space-y-2">
                                <textarea
                                  value={editingDiscussionContent}
                                  onChange={(e) =>
                                    setEditingDiscussionContent(e.target.value)
                                  }
                                  className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#7F55B1] resize-y"
                                />
                                <div className="flex justify-end gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingDiscussionId(null);
                                      setEditingDiscussionContent("");
                                    }}
                                    className="text-xs px-3 py-1.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                                  >
                                    취소
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        setIsDiscussionSaving(true);
                                        await saveMyTaskDiscussionNote(
                                          taskId,
                                          editingDiscussionContent
                                        );
                                        setEditingDiscussionId(null);
                                        setEditingDiscussionContent("");
                                        await refreshDiscussion();
                                        alert("댓글/논의가 수정되었습니다.");
                                      } catch (error: any) {
                                        console.error(
                                          "댓글/논의 수정 실패:",
                                          error
                                        );
                                        alert(
                                          error?.message ||
                                            "댓글/논의 수정에 실패했습니다."
                                        );
                                      } finally {
                                        setIsDiscussionSaving(false);
                                      }
                                    }}
                                    disabled={isDiscussionSaving}
                                    className="text-xs px-3 py-1.5 rounded bg-[#7F55B1] text-white hover:bg-[#6B479A] disabled:opacity-50"
                                  >
                                    {isDiscussionSaving ? "저장 중..." : "수정 저장"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                {note.content}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-400">
                        아직 저장된 댓글/논의가 없습니다.
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "resources" && (
            <div className="space-y-6">
              {task?.referenceImageUrls && task.referenceImageUrls.length > 0 ? (
                <div className="bg-gray-50 rounded-2xl p-6">
                  <h3 className="text-gray-800 font-semibold mb-4 text-lg">
                    레퍼런스 이미지 ({task.referenceImageUrls.length}개)
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {task.referenceImageUrls.map((imageUrl: string, index: number) => (
                      <button
                        key={`${imageUrl}-${index}`}
                        type="button"
                        className="bg-white rounded-lg overflow-hidden border border-gray-100"
                        onClick={() => window.open(imageUrl, "_blank")}
                      >
                        <img
                          src={imageUrl}
                          alt={`레퍼런스 이미지 ${index + 1}`}
                          className="w-full h-28 object-cover"
                        />
                        <p className="text-xs text-gray-500 py-2">이미지 {index + 1}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border-2 border-blue-200/30">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <span>🔗</span>
                    참고 링크
                  </h3>
                  <button
                    onClick={() => {
                      if (isEditingLinks) {
                        setIsEditingLinks(false);
                        setLinkInputs(task?.referenceLinks || []);
                      } else {
                        setIsEditingLinks(true);
                        setLinkInputs(task?.referenceLinks || []);
                      }
                    }}
                    className="text-sm text-[#7F55B1] hover:text-[#6B479A] font-medium hover:underline"
                  >
                    {isEditingLinks ? "취소" : "편집"}
                  </button>
                </div>
                {isEditingLinks ? (
                  <div className="space-y-3">
                    {linkInputs.map((link, index) => (
                      <div key={`${index}-${link}`} className="flex items-center gap-2">
                        <input
                          type="url"
                          value={link}
                          onChange={(e) => {
                            const newLinks = [...linkInputs];
                            newLinks[index] = e.target.value;
                            setLinkInputs(newLinks);
                          }}
                          placeholder="https://..."
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                        />
                        <button
                          onClick={() =>
                            setLinkInputs(linkInputs.filter((_, i) => i !== index))
                          }
                          className="px-3 py-2 bg-red-500 text-white rounded-lg text-sm"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setLinkInputs([...linkInputs, ""])}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm"
                      >
                        + 링크 추가
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            setIsSavingLinks(true);
                            const validLinks = linkInputs.filter(
                              (link: string) => link.trim() !== ""
                            );
                            const updatedTask = await updateTaskLinks(taskId, validLinks);
                            setTask(updatedTask);
                            setIsEditingLinks(false);
                          } catch (error: any) {
                            alert(error.message || "링크 저장에 실패했습니다.");
                          } finally {
                            setIsSavingLinks(false);
                          }
                        }}
                        disabled={isSavingLinks}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm disabled:opacity-50"
                      >
                        {isSavingLinks ? "저장 중..." : "저장"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {task?.referenceLinks?.length ? (
                      task.referenceLinks.map((link, index) => (
                        <a
                          key={`${link}-${index}`}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-3 bg-white rounded-lg border border-blue-100 text-sm text-gray-700 hover:bg-blue-50"
                        >
                          <span>🔗</span>
                          <span className="truncate">{link}</span>
                        </a>
                      ))
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-4">
                        등록된 링크가 없습니다.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "ai" && (
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-6 border border-violet-200/40">
              <h3 className="text-lg font-bold text-gray-800 mb-3">AI 요약 · 다음 액션</h3>
              <p className="text-sm text-gray-700 mb-3">
                현재 업무는 <b>{statusTextMap[task?.status || "PENDING"]}</b> 상태이며,
                중요도는 <b>{priorityTextMap[task?.priority || "MEDIUM"]}</b>입니다.
              </p>
              <p className="text-sm text-gray-700 mb-4">
                참여자 {totalParticipantCount}명 중 {completedParticipantCount}명이 작성을 시작했습니다.
              </p>
              <ul className="list-disc ml-5 text-sm text-gray-700 space-y-1">
                <li>마감일({formatDate(task?.dueDate) || "미설정"}) 기준으로 우선순위를 재확인하세요.</li>
                <li>참여자 탭에서 미작성 멤버의 진행 상태를 점검하세요.</li>
                <li>필요한 레퍼런스는 첨부파일 · 링크 탭에서 최신화하세요.</li>
              </ul>
            </div>
          )}

          {activeTab === "activity" && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">활동 로그</h3>
              <ul className="space-y-3">
                {activityLogs.length > 0 ? (
                  activityLogs.map((log) => (
                    <li key={log.id} className="flex items-start gap-3">
                      <span className="mt-1 w-2 h-2 rounded-full bg-[#7F55B1]" />
                      <div>
                        <p className="text-sm text-gray-700">{log.text}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(log.at).toLocaleString("ko-KR")}
                        </p>
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="text-sm text-gray-400">표시할 활동 로그가 없습니다.</li>
                )}
              </ul>
              {task?.isDevelopmentTask && task?.githubRepository && (
                <div className="mt-6">
                  <TaskGithubActivityWidget taskId={task.id} />
                </div>
              )}
            </div>
          )}
      </section>
    </div>
  );
}
