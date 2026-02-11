"use client";

import { useEffect, useState } from "react";
import {
  CalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from "@/lib/api/calendar";

interface CalendarEventDetailModalProps {
  isOpen: boolean;
  event: CalendarEvent | null;
  onClose: () => void;
  onUpdated?: () => void;
  onDeleted?: () => void;
}

const getEventTypeLabel = (type: CalendarEvent["type"]) => {
  const labels: Record<CalendarEvent["type"], string> = {
    MEETING_ROOM: "회의실 예약",
    MEETING: "미팅 예약",
    LEAVE: "연차 신청",
    VACATION: "휴가 신청",
  };
  return labels[type] || type;
};

const getStatusLabel = (status: CalendarEvent["status"]) => {
  const labels: Record<CalendarEvent["status"], string> = {
    PENDING: "대기",
    APPROVED: "승인",
    REJECTED: "반려",
  };
  return labels[status] || status;
};

const getStatusStyle = (status: CalendarEvent["status"]) => {
  switch (status) {
    case "APPROVED":
      return "bg-green-100 text-green-700";
    case "REJECTED":
      return "bg-gray-200 text-gray-600";
    default:
      return "bg-yellow-100 text-yellow-700";
  }
};

const formatDateTime = (value: string) => {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

const CalendarEventDetailModal = ({
  isOpen,
  event,
  onClose,
  onUpdated,
  onDeleted,
}: CalendarEventDetailModalProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [eventType, setEventType] = useState<
    "MEETING_ROOM" | "MEETING" | "LEAVE" | "VACATION"
  >("MEETING_ROOM");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toLocalDate = (value: string) => {
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
  };

  const toLocalTime = (value: string) => {
    const date = new Date(value);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(11, 16);
  };

  useEffect(() => {
    if (!event || !isOpen) return;
    setIsEditing(false);
    setError("");
    setEventType(event.type);
    setTitle(event.title || "");
    setDescription(event.description || "");
    setLocation(event.location || "");
    setStartDate(toLocalDate(event.startDate));
    setEndDate(toLocalDate(event.endDate));
    setStartTime(toLocalTime(event.startDate));
    setEndTime(toLocalTime(event.endDate));
  }, [event, isOpen]);
  if (!isOpen || !event) return null;

  const handleUpdate = async () => {
    if (!event) return;
    setError("");

    if (!title.trim()) {
      setError("제목을 입력해주세요.");
      return;
    }
    if (!startDate || !endDate) {
      setError("시작일과 종료일을 선택해주세요.");
      return;
    }
    if (
      (eventType === "MEETING_ROOM" || eventType === "MEETING") &&
      !location.trim()
    ) {
      setError("장소를 입력해주세요.");
      return;
    }

    const start = new Date(`${startDate}T${startTime || "00:00"}:00`);
    const end = new Date(`${endDate}T${endTime || "23:59"}:59`);
    if (start >= end) {
      setError("종료일시는 시작일시보다 이후여야 합니다.");
      return;
    }

    setIsSubmitting(true);
    try {
      await updateCalendarEvent(event.id, {
        type: eventType,
        title: title.trim(),
        description: description.trim() || undefined,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        location: location.trim() || undefined,
      });
      setIsEditing(false);
      if (onUpdated) onUpdated();
    } catch (err: any) {
      setError(err.message || "일정 수정에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    if (!confirm("일정을 삭제하시겠습니까?")) return;
    setIsSubmitting(true);
    try {
      await deleteCalendarEvent(event.id);
      if (onDeleted) onDeleted();
      onClose();
    } catch (err: any) {
      setError(err.message || "일정 삭제에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold text-gray-800">{event.title}</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">
                {getEventTypeLabel(event.type)}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusStyle(
                  event.status
                )}`}
              >
                {getStatusLabel(event.status)}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing && (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  수정
                </button>
                <button
                  onClick={handleDelete}
                  className="text-sm px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                >
                  삭제
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500 mb-2">일정 유형</p>
              <div className="grid grid-cols-2 gap-2">
                {(
                  ["MEETING_ROOM", "MEETING", "LEAVE", "VACATION"] as const
                ).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setEventType(type)}
                    className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                      eventType === type
                        ? "border-[#7F55B1] bg-[#7F55B1] text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:border-[#7F55B1]"
                    }`}
                  >
                    {getEventTypeLabel(type)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">제목</p>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
              />
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">설명</p>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-2">시작일</p>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
                />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-2">시작시간</p>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-2">종료일</p>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
                />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-2">종료시간</p>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
                />
              </div>
            </div>

            {(eventType === "MEETING_ROOM" || eventType === "MEETING") && (
              <div>
                <p className="text-xs text-gray-500 mb-2">장소</p>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
                />
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">신청자</p>
                <p className="text-sm text-gray-800">
                  {event.requester?.name || "알 수 없음"}
                </p>
                {event.requester?.email && (
                  <p className="text-xs text-gray-400">
                    {event.requester.email}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500">승인자</p>
                <p className="text-sm text-gray-800">
                  {event.approver?.name || "미지정"}
                </p>
                {event.approver?.email && (
                  <p className="text-xs text-gray-400">
                    {event.approver.email}
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                disabled={isSubmitting}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleUpdate}
                className="px-6 py-2 bg-[#7F55B1] text-white rounded-lg hover:bg-[#6B479A]"
                disabled={isSubmitting}
              >
                {isSubmitting ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">시작</p>
                <p className="text-sm text-gray-800">
                  {formatDateTime(event.startDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">종료</p>
                <p className="text-sm text-gray-800">
                  {formatDateTime(event.endDate)}
                </p>
              </div>
            </div>

            {event.location && (
              <div>
                <p className="text-xs text-gray-500">장소</p>
                <p className="text-sm text-gray-800">{event.location}</p>
              </div>
            )}

            {event.description && (
              <div>
                <p className="text-xs text-gray-500">설명</p>
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {event.description}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">신청자</p>
                <p className="text-sm text-gray-800">
                  {event.requester?.name || "알 수 없음"}
                </p>
                {event.requester?.email && (
                  <p className="text-xs text-gray-400">
                    {event.requester.email}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500">승인자</p>
                <p className="text-sm text-gray-800">
                  {event.approver?.name || "미지정"}
                </p>
                {event.approver?.email && (
                  <p className="text-xs text-gray-400">
                    {event.approver.email}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarEventDetailModal;
