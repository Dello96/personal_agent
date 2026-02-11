"use client";

import CustomCalendar from "../../app/components/features/calendar/Calendar";
import useCalendar from "../../app/stores/useCalendar";
import { dateToFormatString } from "../../lib/utils/dateFormat";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/app/components/shared/AppLayout";
import CalendarEventModal from "@/app/components/features/calendar/CalendarEventModal";
import LeaveRequestApprovalModal from "@/app/components/features/calendar/LeaveRequestApprovalModal";
import CalendarEventDetailModal from "@/app/components/features/calendar/CalendarEventDetailModal";
import {
  getCalendarEvents,
  CalendarEvent,
  getPendingCalendarEvents,
} from "@/lib/api/calendar";
import { getToday } from "@/lib/utils/dateFormat";
import { useAuthStore } from "@/app/stores/authStore";
import { useNotificationStore } from "@/app/stores/notificationStore";
import { isTeamLeadOrAbove } from "@/lib/utils/role";

const CalendarPage = () => {
  const { today, week, dayArray, setPreMonth, setNextMonth, setPresentMonth } =
    useCalendar();
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(getToday());
  const [initialEventType, setInitialEventType] = useState<
    "MEETING_ROOM" | "MEETING" | "LEAVE" | "VACATION" | undefined
  >(undefined);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(
    null
  );
  const user = useAuthStore((state) => state.user);
  const hasPendingLeaveRequest = useNotificationStore(
    (state) => state.hasPendingLeaveRequest
  );
  const clearPendingLeaveRequest = useNotificationStore(
    (state) => state.clearPendingLeaveRequest
  );

  const activeMenu = "일정";

  const handleLeftMenu = (menu: string) => {
    if (menu === "진행중인 업무") {
      router.push("/");
    } else if (menu === "일정") {
      router.push("/calendar");
    } else if (menu === "채팅") {
      router.push("/chat");
    } else if (menu === "팀 관리") {
      router.push("/manager/team");
    }
  };

  // 캘린더 이벤트 조회
  const fetchEvents = async () => {
    setEventsLoading(true);
    try {
      // 현재 월의 시작일과 종료일 계산
      const startOfMonth = today.startOf("month").toISOString();
      const endOfMonth = today.endOf("month").toISOString();
      const fetchedEvents = await getCalendarEvents(startOfMonth, endOfMonth);
      setEvents(fetchedEvents);
    } catch (error) {
      console.error("일정 조회 실패:", error);
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  // 월이 변경되거나 컴포넌트가 마운트될 때 이벤트 조회
  useEffect(() => {
    fetchEvents();
  }, [today]);

  // 캘린더 페이지 진입 시 승인 대기 중인 신청이 없으면 알림 제거
  useEffect(() => {
    if (isTeamLeadOrAbove(user?.role || "")) {
      // 승인 대기 중인 신청 조회하여 알림 상태 동기화
      const syncNotificationState = async () => {
        try {
          const pendingEvents = await getPendingCalendarEvents();
          const store = useNotificationStore.getState();
          if (pendingEvents.length === 0) {
            store.clearPendingLeaveRequest();
          } else {
            store.setHasPendingLeaveRequest(true);
            store.setPendingLeaveRequestCount(pendingEvents.length);
          }
        } catch (error) {
          console.error("승인 대기 일정 조회 실패:", error);
        }
      };
      syncNotificationState();
    }
  }, [user?.role]);

  const handleOpenModal = (
    type?: "MEETING_ROOM" | "MEETING" | "LEAVE" | "VACATION"
  ) => {
    setSelectedDate(today);
    setInitialEventType(type);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleEventCreated = () => {
    fetchEvents(); // 이벤트 목록 새로고침
  };

  const handleApprovalModalClose = () => {
    setIsApprovalModalOpen(false);
    // 일정 목록 새로고침
    fetchEvents();
  };

  const handleOpenDetailModal = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedEvent(null);
  };

  return (
    <AppLayout
      activeMenu={activeMenu}
      onMenuClick={handleLeftMenu}
      sidebarVariant="default"
    >
      {/* 캘린더 컨텐츠 */}
      <div className="h-full flex flex-col min-h-0">
        <div className="bg-white rounded-3xl shadow-sm p-6 flex flex-col">
          <div className="flex items-center justify-between w-full py-4 mb-4 shrink-0">
            <div className="flex items-center justify-center">
              <button
                className="w-6 h-6 text-gray-600 hover:text-[#7F55B1] transition-colors"
                type="button"
                onClick={setPreMonth}
              >
                ⬅️
              </button>
              <p className="mx-4 mt-1 text-gray-600 font-medium text-lg">
                {dateToFormatString(today, "YYYY년 MM월")}
              </p>
              <button
                className="w-6 h-6 text-gray-600 hover:text-[#7F55B1] transition-colors"
                type="button"
                onClick={setNextMonth}
              >
                ➡️
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                onClick={() => handleOpenModal("MEETING_ROOM")}
              >
                회의실예약
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                onClick={() => handleOpenModal("MEETING")}
              >
                미팅예약
              </button>
              <button
                type="button"
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                onClick={() => handleOpenModal("LEAVE")}
              >
                연차 및 휴가 요청
              </button>
              {isTeamLeadOrAbove(user?.role || "") && (
                <button
                  type="button"
                  className="px-3 py-1.5 text-sm bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors font-medium relative"
                  onClick={() => setIsApprovalModalOpen(true)}
                >
                  승인 대기
                  {hasPendingLeaveRequest && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 text-white rounded-full text-xs flex items-center justify-center">
                      !
                    </span>
                  )}
                </button>
              )}
              <button
                type="button"
                className="px-4 py-2 bg-[#7F55B1] text-white rounded-xl hover:bg-[#6B479A] transition-colors font-medium"
                onClick={setPresentMonth}
              >
                오늘
              </button>
            </div>
          </div>
          <div className="mt-2">
            <CustomCalendar
              today={today}
              week={week}
              dayArray={dayArray}
              isHasSchedule={true}
              events={events}
              onEventClick={handleOpenDetailModal}
              onDateClick={(date) => {
                setSelectedDate(date);
                setIsModalOpen(true);
              }}
            />
          </div>
        </div>
      </div>

      {/* 일정 등록 모달 */}
      <CalendarEventModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        selectedDate={selectedDate}
        initialEventType={initialEventType}
        onEventCreated={handleEventCreated}
      />

      {/* 연차/휴가 승인 모달 */}
      {isTeamLeadOrAbove(user?.role || "") && (
        <LeaveRequestApprovalModal
          isOpen={isApprovalModalOpen}
          onClose={handleApprovalModalClose}
          onApproved={() => {
            fetchEvents();
            handleApprovalModalClose();
          }}
        />
      )}

      {/* 일정 상세 모달 */}
      <CalendarEventDetailModal
        isOpen={isDetailModalOpen}
        event={selectedEvent}
        onClose={handleCloseDetailModal}
        onUpdated={fetchEvents}
        onDeleted={fetchEvents}
      />
    </AppLayout>
  );
};

export default CalendarPage;
