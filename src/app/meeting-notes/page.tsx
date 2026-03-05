"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/app/components/shared/AppLayout";
import { useAuthStore } from "@/app/stores/authStore";
import { CalendarEvent, getCalendarEvents } from "@/lib/api/calendar";
import { getMyMeetingNote, saveMyMeetingNote } from "@/lib/api/meetingNotes";

export default function MeetingNotesPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [noteContent, setNoteContent] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [loadingNote, setLoadingNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    if (!user?.teamName) return;

    const loadMeetings = async () => {
      try {
        setLoading(true);
        const now = new Date();
        const start = new Date(now);
        start.setMonth(start.getMonth() - 1);
        const end = new Date(now);
        end.setMonth(end.getMonth() + 6);

        const data = await getCalendarEvents(start.toISOString(), end.toISOString());
        const meetingEvents = data
          .filter(
            (event) =>
              (event.type === "MEETING" || event.type === "MEETING_ROOM") &&
              event.status === "APPROVED"
          )
          .sort(
            (a, b) =>
              new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
          );
        setEvents(meetingEvents);
        if (meetingEvents.length > 0) {
          setSelectedEventId((prev) => prev || meetingEvents[0].id);
        }
      } catch (error) {
        console.error("회의 일정 조회 실패:", error);
      } finally {
        setLoading(false);
      }
    };

    loadMeetings();
  }, [user?.teamName]);

  useEffect(() => {
    if (!selectedEventId) {
      setNoteContent("");
      setSavedAt(null);
      return;
    }

    const loadNote = async () => {
      try {
        setLoadingNote(true);
        setSavedAt(null);
        const note = await getMyMeetingNote(selectedEventId);
        setNoteContent(note?.content || "");
        setSavedAt(
          note?.updatedAt
            ? new Date(note.updatedAt).toLocaleString("ko-KR")
            : null
        );
      } catch (error) {
        console.error("회의록 불러오기 실패:", error);
        setNoteContent("");
        setSavedAt(null);
      } finally {
        setLoadingNote(false);
      }
    };

    loadNote();
  }, [selectedEventId]);

  const selectedEvent = events.find((event) => event.id === selectedEventId);

  const saveMeetingNote = async () => {
    if (!selectedEventId) return;
    try {
      setSavingNote(true);
      const saved = await saveMyMeetingNote(selectedEventId, noteContent);
      setSavedAt(new Date(saved.updatedAt).toLocaleString("ko-KR"));
    } catch (error) {
      console.error("회의록 저장 실패:", error);
      alert("회의록 저장에 실패했습니다.");
    } finally {
      setSavingNote(false);
    }
  };

  const handleLeftMenu = (menu: string) => {
    if (menu === "진행중인 업무") {
      router.push("/");
    } else if (menu === "일정") {
      router.push("/calendar");
    } else if (menu === "채팅") {
      router.push("/chat");
    } else if (menu === "회의록") {
      router.push("/meeting-notes");
    } else if (menu === "팀 관리") {
      router.push("/manager/team");
    }
  };

  return (
    <AppLayout
      activeMenu="회의록"
      onMenuClick={handleLeftMenu}
      sidebarVariant="default"
      headerProps={{ title: "회의록" }}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full min-h-[500px]">
        <div className="bg-white rounded-2xl p-4 shadow-sm lg:col-span-1 overflow-y-auto">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            참석 회의 목록
          </h2>
          {loading ? (
            <p className="text-sm text-gray-500">불러오는 중...</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-gray-500">표시할 회의 일정이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {events.map((event) => {
                const selected = selectedEventId === event.id;
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => setSelectedEventId(event.id)}
                    className={`w-full text-left p-3 rounded-xl border transition ${
                      selected
                        ? "border-[#7F55B1] bg-violet-50"
                        : "border-gray-200 hover:border-violet-200"
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {event.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(event.startDate).toLocaleString("ko-KR")}
                    </p>
                    {event.location && (
                      <p className="text-xs text-gray-500 mt-1">
                        장소: {event.location}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm lg:col-span-2 flex flex-col">
          <div className="mb-3">
            <h2 className="text-lg font-semibold text-gray-800">
              {selectedEvent ? selectedEvent.title : "회의를 선택해주세요"}
            </h2>
            {selectedEvent && (
              <p className="text-xs text-gray-500 mt-1">
                {new Date(selectedEvent.startDate).toLocaleString("ko-KR")} ~{" "}
                {new Date(selectedEvent.endDate).toLocaleString("ko-KR")}
              </p>
            )}
          </div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              회의 내용을 자유롭게 작성하고 저장할 수 있습니다.
            </p>
          </div>

          <textarea
            value={noteContent}
            onChange={(e) => setNoteContent(e.target.value)}
            placeholder="회의 내용을 자유롭게 기록하세요. (안건 / 논의 내용 / 결정 사항 / 액션 아이템)"
            className="flex-1 min-h-[320px] w-full rounded-xl border border-gray-200 p-4 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#7F55B1] resize-none"
            disabled={!selectedEventId || loadingNote}
          />

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              onClick={saveMeetingNote}
              disabled={!selectedEventId || loadingNote || savingNote}
              className="px-4 py-2 bg-[#7F55B1] text-white rounded-lg hover:bg-[#6B479A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingNote ? "저장 중..." : "회의록 저장"}
            </button>
            <div className="flex items-center gap-2">
              {loadingNote && (
                <p className="text-xs text-gray-500">회의록 불러오는 중...</p>
              )}
              {savedAt && <p className="text-xs text-gray-500">저장됨: {savedAt}</p>}
              {selectedEvent && (
                <button
                  type="button"
                  onClick={() => router.push(`/calendar?eventId=${selectedEvent.id}`)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  일정 보기
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
