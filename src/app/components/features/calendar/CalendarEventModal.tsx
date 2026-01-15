"use client";

import { useState, useEffect } from "react";
import {
  createCalendarEvent,
  CalendarEvent,
} from "@/lib/api/calendar";
import { dateToFormatString } from "@/lib/utils/dateFormat";
import { dayjsType } from "@/lib/utils/dateFormat";

interface CalendarEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate?: dayjsType;
  initialEventType?: "MEETING_ROOM" | "MEETING" | "LEAVE" | "VACATION";
  onEventCreated?: () => void;
}

const CalendarEventModal = ({
  isOpen,
  onClose,
  selectedDate,
  initialEventType,
  onEventCreated,
}: CalendarEventModalProps) => {
  const [eventType, setEventType] = useState<
    "MEETING_ROOM" | "MEETING" | "LEAVE" | "VACATION"
  >(initialEventType || "MEETING_ROOM");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // 선택된 날짜가 변경되면 폼 초기화
  useEffect(() => {
    if (selectedDate) {
      const dateStr = dateToFormatString(selectedDate, "YYYY-MM-DD");
      setStartDate(dateStr);
      setEndDate(dateStr);
      setStartTime("09:00");
      setEndTime("18:00");
    }
  }, [selectedDate]);

  // 모달이 열릴 때마다 폼 초기화
  useEffect(() => {
    if (isOpen) {
      setEventType(initialEventType || "MEETING_ROOM");
      setTitle("");
      setDescription("");
      setLocation("");
      setError("");
      if (selectedDate) {
        const dateStr = dateToFormatString(selectedDate, "YYYY-MM-DD");
        setStartDate(dateStr);
        setEndDate(dateStr);
        setStartTime("09:00");
        setEndTime("18:00");
      } else {
        const today = new Date();
        const todayStr = today.toISOString().split("T")[0];
        setStartDate(todayStr);
        setEndDate(todayStr);
        setStartTime("09:00");
        setEndTime("18:00");
      }
    }
  }, [isOpen, selectedDate, initialEventType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      // 필수 필드 검증
      if (!title.trim()) {
        setError("제목을 입력해주세요.");
        setIsSubmitting(false);
        return;
      }

      if (!startDate || !endDate) {
        setError("시작일과 종료일을 선택해주세요.");
        setIsSubmitting(false);
        return;
      }

      // 회의실/미팅 예약 시 장소 필수
      if (
        (eventType === "MEETING_ROOM" || eventType === "MEETING") &&
        !location.trim()
      ) {
        setError("장소를 입력해주세요.");
        setIsSubmitting(false);
        return;
      }

      // 날짜/시간 조합
      const startDateTime = `${startDate}T${startTime || "00:00"}:00`;
      const endDateTime = `${endDate}T${endTime || "23:59"}:59`;

      // 날짜 검증
      const start = new Date(startDateTime);
      const end = new Date(endDateTime);
      if (start >= end) {
        setError("종료일시는 시작일시보다 이후여야 합니다.");
        setIsSubmitting(false);
        return;
      }

      // API 호출
      await createCalendarEvent({
        type: eventType,
        title: title.trim(),
        description: description.trim() || undefined,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        location: location.trim() || undefined,
      });

      // 성공 시 콜백 호출 및 모달 닫기
      if (onEventCreated) {
        onEventCreated();
      }
      onClose();
    } catch (err: any) {
      setError(err.message || "일정 생성에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const getEventTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      MEETING_ROOM: "회의실 예약",
      MEETING: "미팅 예약",
      LEAVE: "연차 신청",
      VACATION: "휴가 신청",
    };
    return labels[type] || type;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">일정 등록</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 일정 타입 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              일정 유형
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["MEETING_ROOM", "MEETING", "LEAVE", "VACATION"] as const).map(
                (type) => (
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
                )
              )}
            </div>
          </div>

          {/* 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              제목 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
              placeholder="일정 제목을 입력하세요"
              required
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              설명
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
              rows={3}
              placeholder="일정 설명을 입력하세요"
            />
          </div>

          {/* 시작일시 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                시작일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                시작시간
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
              />
            </div>
          </div>

          {/* 종료일시 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                종료일 <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                종료시간
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
              />
            </div>
          </div>

          {/* 장소 (회의실/미팅만) */}
          {(eventType === "MEETING_ROOM" || eventType === "MEETING") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                장소 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F55B1]"
                placeholder="회의실 또는 미팅 장소를 입력하세요"
                required
              />
            </div>
          )}

          {/* 안내 메시지 */}
          {(eventType === "LEAVE" || eventType === "VACATION") && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                연차/휴가 신청은 팀장 이상의 승인이 필요합니다. 승인 후 캘린더에
                등록됩니다.
              </p>
            </div>
          )}

          {/* 에러 메시지 */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* 버튼 */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              취소
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-[#7F55B1] text-white rounded-lg hover:bg-[#6B479A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting ? "등록 중..." : "등록"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CalendarEventModal;
