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
} from "@/lib/api/tasks";
import { useEffect, useState } from "react";
import { Task } from "@/lib/api/tasks";
import TaskGithubActivityWidget from "@/app/components/features/github/TaskGithubActivityWidget";

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
  const [participantNotes, setParticipantNotes] = useState<ParticipantNote[]>(
    []
  );
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState<{ [key: string]: string }>({});
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isEditingLinks, setIsEditingLinks] = useState(false);
  const [linkInputs, setLinkInputs] = useState<string[]>([]);
  const [isSavingLinks, setIsSavingLinks] = useState(false);

  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return "";
    return new Date(dateString).toISOString().slice(0, 10);
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

    if (taskId) {
      fetchTask();
      fetchNotes();
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

      {/* 참여자별 업무 작성 영역 (members 탭) */}
      {activeTab === "members" && (
        <div className="mb-8">
          <h3 className="text-xl font-bold text-gray-800 mb-4">
            참여자별 업무 작성
          </h3>
          <div className="space-y-4">
            {!task?.participants || task.participants.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                참여자가 없습니다.
              </div>
            ) : (
              task.participants.map((participant) => {
                if (!participant.user) {
                  console.warn("참여자에 user 정보가 없습니다:", participant);
                  return null;
                }
                const isCurrentUser = participant.userId === user?.id;
                const currentNote = noteContent[participant.id] || "";
                const isEditing = editingNoteId === participant.id;

                return (
                  <div
                    key={participant.id}
                    className="bg-gray-50 rounded-2xl p-5 border-2 border-transparent hover:border-[#7F55B1]/20 transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#7F55B1] to-purple-400 rounded-full flex items-center justify-center">
                          <span className="text-white text-sm font-medium">
                            {participant.user.name.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-gray-800 font-semibold">
                              {participant.user.name}
                            </p>
                            {/* 업무 시작 여부 인디케이터 */}
                            {participant.startedAt ? (
                              <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                진행중
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                                <span className="w-2 h-2 bg-gray-300 rounded-full"></span>
                                대기중
                              </span>
                            )}
                          </div>
                          <p className="text-gray-400 text-xs">
                            {participant.user.email}
                          </p>
                        </div>
                      </div>
                      {isCurrentUser && (
                        <div className="flex items-center gap-2">
                          {/* 시작 버튼 (note가 있고 startedAt이 없을 때만 표시) */}
                          {participant.note && !participant.startedAt && (
                            <button
                              onClick={() =>
                                handleParticipantStart(participant.id)
                              }
                              disabled={isUpdatingStatus}
                              className="px-4 py-2 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                          onChange={(e) => {
                            setNoteContent({
                              ...noteContent,
                              [participant.id]: e.target.value,
                            });
                          }}
                          placeholder="업무 내용을 작성해주세요..."
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1] resize-none"
                          rows={5}
                        />
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={async () => {
                              try {
                                setIsSavingNote(true);
                                await updateParticipantNote(
                                  taskId,
                                  participant.id,
                                  currentNote
                                );
                                // 노트 목록 새로고침
                                const notes = await getParticipantNotes(taskId);
                                setParticipantNotes(notes);
                                setEditingNoteId(null);
                                // 업무 정보도 새로고침
                                const updatedTask = await getTask(taskId);
                                setTask(updatedTask);
                              } catch (error: any) {
                                console.error("노트 저장 실패:", error);
                                alert(
                                  error.message || "노트 저장에 실패했습니다."
                                );
                              } finally {
                                setIsSavingNote(false);
                              }
                            }}
                            disabled={isSavingNote}
                            className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {isSavingNote ? "저장 중..." : "저장"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white rounded-lg p-4 min-h-[100px]">
                        {participant.note ? (
                          <p className="text-gray-700 text-sm whitespace-pre-wrap">
                            {participant.note}
                          </p>
                        ) : (
                          <p className="text-gray-400 text-sm italic">
                            {isCurrentUser
                              ? "작성된 내용이 없습니다. '작성/수정' 버튼을 클릭하여 업무 내용을 작성해주세요."
                              : "작성된 내용이 없습니다."}
                          </p>
                        )}
                        {participant.updatedAt && (
                          <p className="text-gray-400 text-xs mt-2">
                            마지막 수정:{" "}
                            {new Date(participant.updatedAt).toLocaleString(
                              "ko-KR"
                            )}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 하단 카드 영역 */}
      {activeTab === "detail" && (
        <div className="space-y-6">
          {/* 본인이 작성한 할일 표시 */}
          {task?.participants?.find((p) => p.userId === user?.id) && (
            <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-6 border-2 border-[#7F55B1]/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <span>📝</span>
                  내가 작성한 할일
                </h3>
                <button
                  onClick={() => setActiveTab("members")}
                  className="text-sm text-[#7F55B1] hover:text-[#6B479A] font-medium hover:underline"
                >
                  수정하기 →
                </button>
              </div>
              <div className="bg-white rounded-lg p-4 min-h-[120px]">
                {(() => {
                  const myParticipant = task.participants.find(
                    (p) => p.userId === user?.id
                  );
                  return myParticipant?.note ? (
                    <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
                      {myParticipant.note}
                    </p>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full py-8">
                      <p className="text-gray-400 text-sm italic mb-2">
                        아직 작성된 내용이 없습니다.
                      </p>
                      <button
                        onClick={() => setActiveTab("members")}
                        className="px-4 py-2 bg-[#7F55B1] text-white rounded-lg hover:bg-[#6B479A] transition-colors text-sm font-medium"
                      >
                        할일 작성하기
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* 레퍼런스 이미지 미리보기 */}
          {task?.referenceImageUrls && task.referenceImageUrls.length > 0 && (
            <div className="bg-gray-50 rounded-2xl p-6">
              <h3 className="text-gray-800 font-semibold mb-4 text-lg">
                레퍼런스 이미지 ({task.referenceImageUrls.length}개)
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {task.referenceImageUrls.map(
                  (imageUrl: string, index: number) => (
                    <div
                      key={index}
                      className="relative group cursor-pointer bg-white rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all"
                      onClick={() => {
                        window.open(imageUrl, "_blank");
                      }}
                    >
                      <div className="aspect-square relative">
                        <img
                          src={imageUrl}
                          alt={`레퍼런스 이미지 ${index + 1}`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = "/images/placeholder.png";
                          }}
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-all flex items-center justify-center">
                          <span className="text-white opacity-0 group-hover:opacity-100 text-sm font-medium bg-black/50 px-3 py-1 rounded">
                            클릭하여 확대
                          </span>
                        </div>
                      </div>
                      <div className="p-2 bg-white">
                        <p className="text-xs text-gray-500 text-center truncate">
                          이미지 {index + 1}
                        </p>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* GitHub 활동 위젯 (개발팀 업무인 경우만) */}
          {task?.isDevelopmentTask && task?.githubRepository ? (
            <TaskGithubActivityWidget taskId={task.id} />
          ) : (
            task?.isDevelopmentTask && (
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <span>🔗</span>
                  GitHub 활동
                </h3>
                <p className="text-sm text-gray-500">
                  GitHub 레포지토리가 연결되지 않았습니다.
                </p>
              </div>
            )
          )}

          {/* 참고 링크 섹션 */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border-2 border-blue-200/30">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <span>🔗</span>
                참고 링크
              </h3>
              {(() => {
                const isParticipant = task?.participants?.some(
                  (p) => p.userId === user?.id
                );
                const isAssignee = task?.assigneeId === user?.id;
                const isTeamLeadOrAbove = ["TEAM_LEAD"].includes(
                  user?.role || ""
                );
                const canEdit =
                  isParticipant || isAssignee || isTeamLeadOrAbove;

                if (!canEdit) return null;

                return (
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
                );
              })()}
            </div>

            {isEditingLinks ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  {linkInputs.map((link, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="url"
                        value={link}
                        onChange={(e) => {
                          const newLinks = [...linkInputs];
                          newLinks[index] = e.target.value;
                          setLinkInputs(newLinks);
                        }}
                        placeholder="https://..."
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
                      />
                      <button
                        onClick={() => {
                          const newLinks = linkInputs.filter(
                            (_, i) => i !== index
                          );
                          setLinkInputs(newLinks);
                        }}
                        className="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setLinkInputs([...linkInputs, ""]);
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors text-sm"
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
                        const updatedTask = await updateTaskLinks(
                          taskId,
                          validLinks
                        );
                        setTask(updatedTask);
                        setIsEditingLinks(false);
                        alert("링크가 저장되었습니다.");
                      } catch (error: any) {
                        console.error("링크 저장 실패:", error);
                        alert(error.message || "링크 저장에 실패했습니다.");
                      } finally {
                        setIsSavingLinks(false);
                      }
                    }}
                    disabled={isSavingLinks}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSavingLinks ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {task?.referenceLinks && task.referenceLinks.length > 0 ? (
                  task.referenceLinks.map((link, index) => {
                    const getLinkIcon = (url: string) => {
                      if (url.includes("github.com")) return "🐙";
                      if (
                        url.includes("youtube.com") ||
                        url.includes("youtu.be")
                      )
                        return "📺";
                      return "🔗";
                    };

                    const getLinkLabel = (url: string) => {
                      try {
                        const urlObj = new URL(url);
                        if (url.includes("github.com")) {
                          const pathParts = urlObj.pathname
                            .split("/")
                            .filter(Boolean);
                          if (pathParts.length >= 2) {
                            return `${pathParts[0]}/${pathParts[1]}`;
                          }
                        }
                        return urlObj.hostname.replace("www.", "");
                      } catch {
                        return url;
                      }
                    };

                    return (
                      <a
                        key={index}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 bg-white rounded-lg hover:bg-blue-50 transition-colors border border-blue-100"
                      >
                        <span className="text-2xl">{getLinkIcon(link)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {getLinkLabel(link)}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {link}
                          </p>
                        </div>
                        <span className="text-gray-400">↗</span>
                      </a>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-gray-400 text-sm">
                    등록된 링크가 없습니다.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3개 카드 영역 */}
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
                  <p className="text-gray-400 text-xs">
                    {task?.assignee?.email}
                  </p>
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
              <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin">
                {task?.participants?.map((participant) => {
                  const hasStarted = !!participant.startedAt;
                  return (
                    <div
                      key={participant.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-8 h-8 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-gray-600 text-xs">
                            {participant.user.name}
                          </span>
                        </div>
                        <p className="text-gray-700 text-sm truncate">
                          {participant.user.name}
                        </p>
                      </div>
                      {/* 업무 시작 여부 인디케이터 */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {hasStarted ? (
                          <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                            진행중
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-gray-400 font-medium">
                            <span className="w-2 h-2 bg-gray-300 rounded-full"></span>
                            대기중
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
