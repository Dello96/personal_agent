// TaskForm 컴포넌트 (업무 생성/수정 폼)

"use client";

import { useEffect, useState } from "react";
import {
  createTask,
  parseTaskFromNaturalLanguage,
  type AiParsedTaskResult,
} from "@/lib/api/tasks";
import { TeamMember } from "@/lib/api/users";
import { getCurrentTeamMembers } from "@/lib/api/team";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/app/stores/authStore";
import { uploadImage, uploadMultipleImages } from "@/lib/api/upload";
import AppLayout from "@/app/components/shared/AppLayout";

export default function TaskForm() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [title, setTitle] = useState("");
  const [naturalLanguageInput, setNaturalLanguageInput] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [priority, setPriority] = useState<
    "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  >("MEDIUM");
  const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
  const [dueDate, setDueDate] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);
  const [isParticipantOpen, setIsParticipantOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiWarnings, setAiWarnings] = useState<string[]>([]);

  // 개발팀 업무 및 GitHub 레포지토리 관련 상태
  const [isDevelopmentTask, setIsDevelopmentTask] = useState(false);
  const [githubOwner, setGithubOwner] = useState("");
  const [githubRepo, setGithubRepo] = useState("");
  const [githubAccessToken, setGithubAccessToken] = useState("");

  const priorityLabels: Record<string, { label: string; color: string }> = {
    LOW: { label: "낮음", color: "bg-gray-400" },
    MEDIUM: { label: "보통", color: "bg-blue-400" },
    HIGH: { label: "높음", color: "bg-orange-400" },
    URGENT: { label: "긴급", color: "bg-red-500" },
  };

  const normalizeAiDateToInput = (aiDate: string | null): string => {
    if (!aiDate) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(aiDate)) return aiDate;
    const parsed = new Date(aiDate);
    if (Number.isNaN(parsed.getTime())) return "";
    return parsed.toISOString().slice(0, 10);
  };

  const resolveAssigneeIdFromAi = (
    parsedTask: AiParsedTaskResult,
    members: TeamMember[]
  ): string | null => {
    const byEmail = parsedTask.assigneeEmail
      ? members.find(
          (member) =>
            member.email?.toLowerCase() === parsedTask.assigneeEmail?.toLowerCase()
        )
      : undefined;
    if (byEmail) return byEmail.id;

    const byName = parsedTask.assigneeName
      ? members.find(
          (member) =>
            member.name?.toLowerCase() === parsedTask.assigneeName?.toLowerCase()
        )
      : undefined;
    if (byName) return byName.id;

    return null;
  };

  // 파일 선택 핸들러
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // 1. 파일 개수 제한 확인 (최대 5개)
    const newFiles = Array.from(files).slice(0, 5 - selectedImages.length);

    if (newFiles.length === 0) {
      alert("최대 5개의 이미지만 업로드할 수 있습니다.");
      return;
    }

    // 2. 파일 검증
    const validFiles: File[] = [];
    const invalidFiles: string[] = [];

    newFiles.forEach((file) => {
      // 파일 타입 검증
      if (!file.type.startsWith("image/")) {
        invalidFiles.push(`${file.name}: 이미지 파일만 가능합니다.`);
        return;
      }

      // 파일 크기 검증 (5MB)
      if (file.size > 5 * 1024 * 1024) {
        invalidFiles.push(
          `${file.name}: 파일 크기는 5MB를 초과할 수 없습니다.`
        );
        return;
      }

      validFiles.push(file);
    });

    // 3. 에러 메시지 표시
    if (invalidFiles.length > 0) {
      alert(invalidFiles.join("\n"));
    }

    // 4. 유효한 파일들 추가
    if (validFiles.length > 0) {
      setSelectedImages((prev) => [...prev, ...validFiles]);

      // 5. 미리보기 생성
      validFiles.forEach((file) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreviews((prev) => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }

    // 6. input 초기화 (같은 파일 다시 선택 가능하도록)
    e.target.value = "";
  };

  // 이미지 삭제 핸들러
  const handleImageRemove = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    // 업로드된 이미지도 삭제
    setUploadedImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  // 이미지 업로드 함수
  const uploadImages = async (): Promise<string[]> => {
    if (selectedImages.length === 0) {
      return [];
    }

    try {
      setUploadingImages(true);
      setUploadProgress(0);

      // 각 이미지를 순차적으로 업로드 (진행률 표시를 위해)
      const uploadedUrls: string[] = [];

      for (let i = 0; i < selectedImages.length; i++) {
        const url = await uploadImage(selectedImages[i]);
        uploadedUrls.push(url);
        setUploadProgress(((i + 1) / selectedImages.length) * 100);
      }

      setUploadedImageUrls(uploadedUrls);
      return uploadedUrls;
    } catch (error) {
      console.error("이미지 업로드 실패:", error);
      alert("이미지 업로드에 실패했습니다.");
      throw error;
    } finally {
      setUploadingImages(false);
      setUploadProgress(0);
    }
  };

  const toggleParticipant = (memberId: string) => {
    setParticipantIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  // useEffect로 팀원 목록 가져오기
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const members = await getCurrentTeamMembers();
        setTeamMembers(members);
      } catch (error) {
        console.error("팀원 목록 조회 실패:", error);
      }
    };
    fetchTeamMembers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assigneeId) {
      alert("담당자를 선택해주세요.");
      return;
    }
    if (!title.trim()) {
      alert("업무 제목을 입력해주세요.");
      return;
    }
    let imageUrls: string[] = [];

    try {
      setIsSubmitting(true);
      if (selectedImages.length > 0) {
        imageUrls = await uploadImages();
      }
      const isDevTeam = user?.teamName === "개발팀";
      await createTask({
        title,
        description: description || undefined,
        assigneeId,
        priority,
        dueDate: dueDate || undefined,
        participantIds,
        referenceImageUrls: imageUrls,
        isDevelopmentTask: isDevTeam ? isDevelopmentTask : false,
        githubOwner:
          isDevTeam && isDevelopmentTask && githubOwner
            ? githubOwner
            : undefined,
        githubRepo:
          isDevTeam && isDevelopmentTask && githubRepo ? githubRepo : undefined,
        githubAccessToken:
          isDevTeam && isDevelopmentTask && githubAccessToken
            ? githubAccessToken
            : undefined,
      });
      alert("업무가 생성되었습니다!");

      //기획서가 정상적으로 업로드 됐을 경우에만 초기화

      setTitle("");
      setDescription("");
      setAssigneeId("");
      setPriority("MEDIUM");
      setDueDate("");
      setParticipantIds([]);
      setSelectedImages([]);
      setImagePreviews([]);
      setUploadedImageUrls([]);
      setUploadProgress(0);
      setIsDevelopmentTask(false);
      setGithubOwner("");
      setGithubRepo("");
      setGithubAccessToken("");
      router.push("/");
    } catch (error) {
      console.error("업무 생성 실패:", error);
      alert("업무 생성에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleParseNaturalLanguage = async () => {
    const input = naturalLanguageInput.trim();
    if (!input) {
      alert("자연어 업무 요청을 입력해주세요.");
      return;
    }

    try {
      setIsAiParsing(true);
      setAiWarnings([]);

      const response = await parseTaskFromNaturalLanguage({
        text: input,
        teamMembers: teamMembers.map((member) => ({
          name: member.name,
          email: member.email,
        })),
      });

      const parsedTask = response?.parsedTask;
      if (!parsedTask) {
        alert("AI 파싱 결과를 가져오지 못했습니다.");
        return;
      }

      if (parsedTask.title?.trim()) setTitle(parsedTask.title.trim());
      if (parsedTask.description?.trim()) setDescription(parsedTask.description.trim());
      if (parsedTask.priority) setPriority(parsedTask.priority);

      const normalizedDate = normalizeAiDateToInput(parsedTask.dueDate);
      if (normalizedDate) setDueDate(normalizedDate);

      const resolvedAssigneeId = resolveAssigneeIdFromAi(parsedTask, teamMembers);
      if (resolvedAssigneeId) setAssigneeId(resolvedAssigneeId);

      const warnings = Array.isArray(parsedTask.warnings)
        ? parsedTask.warnings.filter(Boolean)
        : [];
      setAiWarnings(warnings);
    } catch (error) {
      console.error("자연어 업무 파싱 실패:", error);
      alert("AI 파싱에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsAiParsing(false);
    }
  };

  const selectedMember = teamMembers.find((m) => m.id === assigneeId);

  return (
    <AppLayout
      sidebarVariant="task-form"
      headerProps={{
        title: "업무 전달하기",
      }}
    >
      {/* 폼 영역 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 메인 폼 카드 */}
        <div className="col-span-2 bg-white rounded-3xl p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 업무 제목 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                한 문장으로 업무 생성하기!{" "}
                <div className="text-red-500">with AI</div>
              </label>
              <div className="space-y-3">
                <textarea
                  value={naturalLanguageInput}
                  onChange={(e) => setNaturalLanguageInput(e.target.value)}
                  placeholder="예: 오늘부터 4월 19일까지 진행되는 긴급 프로젝트를 생성하고 담당자는 김민수, 우선순위는 높음으로 설정해줘"
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7F55B1] focus:border-transparent transition-all resize-none"
                />
                <button
                  type="button"
                  onClick={handleParseNaturalLanguage}
                  disabled={isAiParsing}
                  className="w-full py-3 bg-violet-100 text-[#7F55B1] rounded-xl font-semibold hover:bg-violet-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isAiParsing ? "AI 파싱 중..." : "AI로 필드 자동 채우기"}
                </button>
                {aiWarnings.length > 0 && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
                    {aiWarnings.map((warning, idx) => (
                      <p key={`${warning}-${idx}`}>- {warning}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                업무 제목 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 프로젝트 기획서 작성"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7F55B1] focus:border-transparent transition-all"
                required
              />
            </div>

            {/* 담당자 선택 */}
            <div className="relative">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                담당자 <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsAssigneeOpen(!isAssigneeOpen)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl flex items-center justify-between hover:border-[#7F55B1] transition-all"
              >
                <div className="flex items-center gap-3">
                  {selectedMember ? (
                    <>
                      <div className="w-8 h-8 bg-gradient-to-br from-[#7F55B1] to-purple-400 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm">
                          {selectedMember.name?.charAt(0)}
                        </span>
                      </div>
                      <span className="text-gray-800">
                        {selectedMember.name}
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-gray-400">👤</span>
                      </div>
                      <span className="text-gray-400">담당자 선택</span>
                    </>
                  )}
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    isAssigneeOpen ? "rotate-180" : ""
                  }`}
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

              {isAssigneeOpen && (
                <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  {teamMembers.length === 0 ? (
                    <div className="px-4 py-3 text-gray-400 text-sm">
                      팀원이 없습니다.
                    </div>
                  ) : (
                    teamMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => {
                          setAssigneeId(member.id);
                          setIsAssigneeOpen(false);
                        }}
                        className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-violet-50 transition-colors ${
                          assigneeId === member.id ? "bg-violet-50" : ""
                        }`}
                      >
                        <div className="w-8 h-8 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center">
                          <span className="text-gray-600 text-sm">
                            {member.name?.charAt(0)}
                          </span>
                        </div>
                        <div className="text-left">
                          <p className="text-gray-800 font-medium text-sm">
                            {member.name}
                          </p>
                          <p className="text-gray-400 text-xs">
                            {member.email}
                          </p>
                        </div>
                        {assigneeId === member.id && (
                          <span className="ml-auto text-[#7F55B1]">✓</span>
                        )}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/*프로젝트 참여자 선택*/}
            <div className="relative">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                참여자 <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setIsParticipantOpen(!isParticipantOpen)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl flex items-center justify-between hover:border-[#7F55B1] transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                    <span className="text-gray-400">👥</span>
                  </div>
                  <span
                    className={
                      participantIds.length > 0
                        ? "text-gray-800"
                        : "text-gray-400"
                    }
                  >
                    {participantIds.length > 0
                      ? `${participantIds.length}명 선택됨`
                      : "참여자 선택 (다중 선택 가능)"}
                  </span>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    isParticipantOpen ? "rotate-180" : ""
                  }`}
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

              {/* 선택된 참여자 목록 표시 */}
              {participantIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {participantIds.map((id) => {
                    const member = teamMembers.find((m) => m.id === id);
                    return (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-violet-100 text-[#7F55B1] rounded-full text-sm"
                      >
                        {member?.name}
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleParticipant(id);
                          }}
                          className="hover:text-red-500 ml-1 cursor-pointer"
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleParticipant(id);
                            }
                          }}
                        >
                          ✕
                        </span>
                      </span>
                    );
                  })}
                </div>
              )}

              {isParticipantOpen && (
                <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
                  {/* 전체 선택/해제 버튼 */}
                  <div className="px-4 py-2 border-b flex justify-between bg-gray-50">
                    <button
                      type="button"
                      onClick={() => {
                        const allIds = teamMembers
                          .filter((m) => m.id !== assigneeId)
                          .map((m) => m.id);
                        setParticipantIds(allIds);
                      }}
                      className="text-xs text-[#7F55B1] hover:underline"
                    >
                      전체 선택
                    </button>
                    <button
                      type="button"
                      onClick={() => setParticipantIds([])}
                      className="text-xs text-gray-400 hover:underline"
                    >
                      전체 해제
                    </button>
                  </div>

                  {teamMembers.length === 0 ? (
                    <div className="px-4 py-3 text-gray-400 text-sm">
                      팀원이 없습니다.
                    </div>
                  ) : (
                    teamMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleParticipant(member.id)} // ✅ 토글 함수 사용
                        className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-violet-50 transition-colors ${
                          participantIds.includes(member.id)
                            ? "bg-violet-50"
                            : "" // ✅ 배열 확인
                        }`}
                      >
                        {/* 체크박스 */}
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            participantIds.includes(member.id)
                              ? "bg-[#7F55B1] border-[#7F55B1]"
                              : "border-gray-300"
                          }`}
                        >
                          {participantIds.includes(member.id) && (
                            <span className="text-white text-xs">✓</span>
                          )}
                        </div>

                        <div className="w-8 h-8 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center">
                          <span className="text-gray-600 text-sm">
                            {member.name?.charAt(0)}
                          </span>
                        </div>
                        <div className="text-left flex-1">
                          <p className="text-gray-800 font-medium text-sm">
                            {member.name}
                          </p>
                          <p className="text-gray-400 text-xs">
                            {member.email}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* 우선순위 선택 */}
            <div className="relative">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                우선순위
              </label>
              <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl flex items-center justify-between hover:border-[#7F55B1] transition-all"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`w-3 h-3 rounded-full ${priorityLabels[priority].color}`}
                  ></span>
                  <span className="text-gray-800">
                    {priorityLabels[priority].label}
                  </span>
                </div>
                <svg
                  className={`w-5 h-5 text-gray-400 transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
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

              {isOpen && (
                <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                  {priorities.map((prior) => (
                    <button
                      key={prior}
                      type="button"
                      onClick={() => {
                        setPriority(prior);
                        setIsOpen(false);
                      }}
                      className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-violet-50 transition-colors ${
                        priority === prior ? "bg-violet-50" : ""
                      }`}
                    >
                      <span
                        className={`w-3 h-3 rounded-full ${priorityLabels[prior].color}`}
                      ></span>
                      <span className="text-gray-800">
                        {priorityLabels[prior].label}
                      </span>
                      {priority === prior && (
                        <span className="ml-auto text-[#7F55B1]">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 마감일 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                마감일
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7F55B1] focus:border-transparent transition-all"
              />
            </div>

            {/* 개발팀에만 GitHub 레포지토리 연결 노출 */}
            {user?.teamName === "개발팀" && (
              <>
                <div>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDevelopmentTask}
                      onChange={(e) => setIsDevelopmentTask(e.target.checked)}
                      className="w-5 h-5 text-[#7F55B1] border-gray-300 rounded focus:ring-[#7F55B1]"
                    />
                    <span className="text-sm font-semibold text-gray-700">
                      개발팀 업무 (GitHub 레포지토리 연결)
                    </span>
                  </label>
                </div>

                {/* GitHub 레포지토리 정보 (개발팀 업무인 경우만 표시) */}
                {isDevelopmentTask && (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        GitHub Username 또는 Organization
                      </label>
                      <input
                        type="text"
                        value={githubOwner}
                        onChange={(e) => setGithubOwner(e.target.value)}
                        placeholder="예: octocat 또는 my-org"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7F55B1] focus:border-transparent transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Repository Name
                      </label>
                      <input
                        type="text"
                        value={githubRepo}
                        onChange={(e) => setGithubRepo(e.target.value)}
                        placeholder="예: my-repo"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7F55B1] focus:border-transparent transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        GitHub Personal Access Token
                      </label>
                      <input
                        type="password"
                        value={githubAccessToken}
                        onChange={(e) => setGithubAccessToken(e.target.value)}
                        placeholder="ghp_xxxxxxxxxxxx"
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7F55B1] focus:border-transparent transition-all"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        GitHub Settings → Developer settings → Personal access
                        tokens에서 생성하세요. (repo 권한 필요)
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 업무 설명 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                업무 설명
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="업무에 대한 상세 설명을 입력하세요"
                rows={5}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7F55B1] focus:border-transparent transition-all resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                레퍼런스 이미지 (선택사항)
              </label>

              {/* 파일 선택 input */}
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageSelect}
                disabled={uploadingImages || selectedImages.length >= 5}
                className="hidden"
                id="image-upload"
              />

              <label
                htmlFor="image-upload"
                className={`w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer flex items-center justify-center gap-2 transition-all ${
                  uploadingImages || selectedImages.length >= 5
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:border-[#7F55B1] hover:bg-violet-50"
                }`}
              >
                <span className="text-2xl">📷</span>
                <span className="text-gray-600 text-sm">
                  {selectedImages.length >= 5
                    ? "최대 5개까지 업로드 가능합니다"
                    : "이미지를 선택하거나 드래그하세요 (최대 5개)"}
                </span>
              </label>

              {/* 업로드 진행률 */}
              {uploadingImages && (
                <div className="mt-2">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-[#7F55B1] h-2 rounded-full transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    업로드 중... {Math.round(uploadProgress)}%
                  </p>
                </div>
              )}

              {/* 이미지 미리보기 */}
              {imagePreviews.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-4">
                  {imagePreviews.map((preview, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={preview}
                        alt={`미리보기 ${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border border-gray-200"
                      />
                      <button
                        type="button"
                        onClick={() => handleImageRemove(index)}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* 업로드된 이미지 개수 표시 */}
              {uploadedImageUrls.length > 0 && (
                <p className="text-xs text-green-600 mt-2">
                  ✓ {uploadedImageUrls.length}개의 이미지가 업로드되었습니다.
                </p>
              )}
            </div>

            {/* 제출 버튼 */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-gradient-to-r from-[#7F55B1] to-purple-400 text-white rounded-xl font-semibold hover:from-[#6B479A] hover:to-purple-500 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  처리 중...
                </span>
              ) : (
                "업무 만들기"
              )}
            </button>
          </form>
        </div>

        {/* 우측 정보 카드 */}
        <div className="space-y-4">
          {/* 미리보기 카드 */}
          <div className="bg-gradient-to-br from-[#7F55B1] to-purple-400 rounded-3xl p-6 text-white shadow-xl">
            <h3 className="text-purple-200 text-sm mb-3">업무 미리보기</h3>

            <div className="bg-white/10 rounded-xl p-4 space-y-3">
              <div>
                <p className="text-purple-200 text-xs">제목</p>
                <p className="font-semibold truncate">
                  {title || "업무 제목을 입력하세요"}
                </p>
              </div>

              <div>
                <p className="text-purple-200 text-xs">담당자</p>
                <p className="font-semibold">
                  {selectedMember?.name || "선택되지 않음"}
                </p>
              </div>

              <div>
                <p className="text-purple-200 text-xs">우선순위</p>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${priorityLabels[priority].color}`}
                  ></span>
                  <p className="font-semibold">
                    {priorityLabels[priority].label}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-purple-200 text-xs">마감일</p>
                <p className="font-semibold">{dueDate || "미설정"}</p>
              </div>
              <div>
                <p className="text-purple-200 text-xs">참여자</p>
                <p className="font-semibold">
                  {participantIds.length > 0
                    ? `${participantIds.length}명`
                    : "없음"}
                </p>
              </div>
            </div>
          </div>

          {/* 팀원 목록 카드 */}
          <div className="bg-white rounded-3xl p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-800">팀원 목록</h3>
              <span className="text-gray-400 text-sm">
                {teamMembers.length}명
              </span>
            </div>

            {teamMembers.length === 0 ? (
              <p className="text-gray-400 text-sm">팀원이 없습니다.</p>
            ) : (
              <ul className="space-y-3">
                {teamMembers.slice(0, 4).map((member) => (
                  <li
                    key={member.id}
                    onClick={() => {
                      setAssigneeId(member.id);
                    }}
                    className={`flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors ${
                      assigneeId === member.id
                        ? "bg-violet-50 border-2 border-[#7F55B1]"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-gray-200 to-gray-300 rounded-full flex items-center justify-center">
                      <span className="text-gray-600 text-sm">
                        {member.name?.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">
                        {member.name}
                      </p>
                      <p className="text-gray-400 text-xs truncate">
                        {member.email}
                      </p>
                    </div>
                    {assigneeId === member.id && (
                      <span className="text-[#7F55B1] text-lg">✓</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
