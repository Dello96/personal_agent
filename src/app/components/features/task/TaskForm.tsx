// TaskForm 컴포넌트 (업무 생성/수정 폼)

"use client";

import { useState } from "react";
import { createTask } from "@/lib/api/tasks";

export default function TaskForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createTask({
        title,
        description,
        assigneeId,
        priority: "MEDIUM",
      });
      alert("업무가 생성되었습니다!");
      // 폼 초기화 또는 페이지 새로고침
      setTitle("");
      setDescription("");
      setAssigneeId("");
    } catch (error) {
      console.error("업무 생성 실패:", error);
      alert("업무 생성에 실패했습니다.");
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="업무 제목"
        required
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="업무 설명"
      />
      <button type="submit">업무 생성</button>
    </form>
  );
}
