"use client";

import { useState, useEffect } from "react";
import {
  getPendingCalendarEvents,
  approveCalendarEvent,
  rejectCalendarEvent,
  CalendarEvent,
} from "@/lib/api/calendar";
import { formatRelativeTime } from "@/lib/utils/dateFormat";
import { useNotificationStore } from "@/app/stores/notificationStore";

interface LeaveRequestApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApproved?: () => void;
}

const LeaveRequestApprovalModal = ({
  isOpen,
  onClose,
  onApproved,
}: LeaveRequestApprovalModalProps) => {
  const [pendingEvents, setPendingEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { clearPendingLeaveRequest, setPendingLeaveRequestCount } =
    useNotificationStore();

  // 승인 대기 중인 일정 조회
  const fetchPendingEvents = async () => {
    setLoading(true);
    try {
      const events = await getPendingCalendarEvents();
      setPendingEvents(events);
      // 알림 카운트 업데이트
      setPendingLeaveRequestCount(events.length);
    } catch (error) {
      console.error("승인 대기 일정 조회 실패:", error);
      setPendingEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPendingEvents();
    }
  }, [isOpen]);

  // 승인 처리
  const handleApprove = async (eventId: string) => {
    setProcessingId(eventId);
    try {
      await approveCalendarEvent(eventId);
      // 목록에서 제거
      setPendingEvents((prev) => prev.filter((e) => e.id !== eventId));
      // 알림 카운트 업데이트
      const newCount = pendingEvents.length - 1;
      setPendingLeaveRequestCount(newCount);
      if (newCount === 0) {
        clearPendingLeaveRequest();
      }
      if (onApproved) {
        onApproved();
      }
    } catch (error: any) {
      console.error("일정 승인 실패:", error);
      alert(error.message || "일정 승인에 실패했습니다.");
    } finally {
      setProcessingId(null);
    }
  };

  // 거절 처리
  const handleReject = async (eventId: string, comment?: string) => {
    if (!confirm("정말 거절하시겠습니까?")) {
      return;
    }

    setProcessingId(eventId);
    try {
      await rejectCalendarEvent(eventId, comment);
      // 목록에서 제거
      setPendingEvents((prev) => prev.filter((e) => e.id !== eventId));
      // 알림 카운트 업데이트
      const newCount = pendingEvents.length - 1;
      setPendingLeaveRequestCount(newCount);
      if (newCount === 0) {
        clearPendingLeaveRequest();
      }
      if (onApproved) {
        onApproved();
      }
    } catch (error: any) {
      console.error("일정 거절 실패:", error);
      alert(error.message || "일정 거절에 실패했습니다.");
    } finally {
      setProcessingId(null);
    }
  };

  const getEventTypeLabel = (type: string) => {
    return type === "LEAVE" ? "연차" : "휴가";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">
            연차/휴가 신청 승인
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl"
          >
            ×
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <p className="text-gray-500">로딩 중...</p>
          </div>
        ) : pendingEvents.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">승인 대기 중인 신청이 없습니다.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingEvents.map((event) => (
              <div
                key={event.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-semibold">
                        {getEventTypeLabel(event.type)}
                      </span>
                      <span className="text-lg font-semibold text-gray-800">
                        {event.title}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>
                        <span className="font-medium">신청자:</span>{" "}
                        {event.requester?.name || "알 수 없음"}
                      </p>
                      <p>
                        <span className="font-medium">기간:</span>{" "}
                        {new Date(event.startDate).toLocaleDateString("ko-KR")}{" "}
                        ~ {new Date(event.endDate).toLocaleDateString("ko-KR")}
                      </p>
                      {event.description && (
                        <p>
                          <span className="font-medium">사유:</span>{" "}
                          {event.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-400">
                        신청일: {formatRelativeTime(event.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleApprove(event.id)}
                      disabled={processingId === event.id}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      {processingId === event.id ? "처리 중..." : "승인"}
                    </button>
                    <button
                      onClick={() => handleReject(event.id)}
                      disabled={processingId === event.id}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      {processingId === event.id ? "처리 중..." : "거절"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

export default LeaveRequestApprovalModal;
