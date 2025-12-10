// TaskForm 컴포넌트 (업무 생성/수정 폼)

"use client";

import { useEffect, useState } from "react";
import { createTask } from "@/lib/api/tasks";
import { getTeamMembers, TeamMember } from "@/lib/api/users";

export default function TaskForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [priority, setPriority] = useState<
    "LOW" | "MEDIUM" | "HIGH" | "URGENT"
  >("MEDIUM");
  const priorities = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
  type Priority = (typeof priorities)[number];
  const [dueDate, setDueDate] = useState("");
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isAssigneeOpen, setIsAssigneeOpen] = useState(false);

  // useEffect로 팀원 목록 가져오기
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const members = await getTeamMembers();
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
    try {
      await createTask({
        title,
        description: description || undefined,
        assigneeId,
        priority,
        dueDate: dueDate || undefined,
      });
      alert("업무가 생성되었습니다!");
      // 폼 초기화 또는 페이지 새로고침
      setTitle("");
      setDescription("");
      setAssigneeId("");
      setPriority("MEDIUM");
      setDueDate("");
    } catch (error) {
      console.error("업무 생성 실패:", error);
      alert("업무 생성에 실패했습니다.");
    }
    console.log(title, description);
  };

  return (
    <div className="flex flex-row items-center justify-center m-20">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 업무 제목 - input */}
        <div>
          <label className="block text-sm font-medium mb-2">업무 제목 *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 프로젝트 기획서 작성"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label>담당자 *</label>
          <button
            type="button"
            onClick={() => setIsAssigneeOpen(!isAssigneeOpen)}
          >
            <span>
              {teamMembers.find((m) => m.id === assigneeId)?.name ||
                "담당자 선택"}
            </span>
          </button>
          {isAssigneeOpen && (
            <div>
              {teamMembers.map((member) => (
                <button
                  onClick={() => {
                    setAssigneeId(member.id); // assigneeId 설정
                    setIsAssigneeOpen(false);
                  }}
                >
                  {member.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative flex-row">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-full px-4 py-2 border rounded flex items-center justify-between"
          >
            <span>{priority || "중요도"}</span>
            <svg
              className="w-5 h-5"
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
            <div className="absolute z-10 w-[300px] mt-1 bg-white border rounded shadow-lg">
              {priorities.map((prior) => (
                <button
                  key={prior}
                  onClick={() => {
                    setPriority(prior);
                    setIsOpen(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100"
                >
                  {prior}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* 업무 설명 - textarea */}
        <div className="flex flex-col w-[300px] h-[250px]">
          <label className="block text-sm font-medium mb-2">업무 설명</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="업무에 대한 상세 설명을 입력하세요"
            rows={5}
            className="w-full h-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        {/* 마감일 - date input */}
        <div>
          <label className="block text-sm font-medium mb-2">마감일</label>
          <input
            type="date"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        {/* 제출 버튼 */}
        <button
          type="submit"
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          업무 생성
        </button>
      </form>
    </div>
  );
}
