import {
  dateToFormatString,
  dayjsType,
  getToday,
} from "../../../../lib/utils/dateFormat";
import React from "react";
import { CalendarEvent } from "@/lib/api/calendar";

interface CustomCalendar {
  today: dayjsType;
  week: string[];
  dayArray: { [x: number]: dayjsType[] }[];
  isHasSchedule?: boolean;
  schedule?: any;
  events?: CalendarEvent[];
  onDateClick?: (date: dayjsType) => void;
}

const CustomCalendar = ({
  today,
  week,
  dayArray,
  isHasSchedule = false,
  schedule,
  events = [],
  onDateClick,
}: CustomCalendar) => {
  schedule = isHasSchedule ? schedule : null;

  // 특정 날짜에 해당하는 이벤트 필터링
  const getEventsForDate = (date: dayjsType): CalendarEvent[] => {
    const dateStr = dateToFormatString(date, "YYYY-MM-DD");
    return events.filter((event) => {
      const eventStart = dateToFormatString(event.startDate, "YYYY-MM-DD");
      const eventEnd = dateToFormatString(event.endDate, "YYYY-MM-DD");
      return dateStr >= eventStart && dateStr <= eventEnd;
    });
  };

  // 이벤트 타입별 색상 반환
  const getEventColor = (
    type: CalendarEvent["type"],
    status: CalendarEvent["status"]
  ) => {
    if (status === "REJECTED") {
      return "bg-gray-300 text-gray-600";
    }
    if (status === "PENDING") {
      return "bg-yellow-200 text-yellow-800";
    }
    switch (type) {
      case "MEETING_ROOM":
        return "bg-blue-100 text-blue-800";
      case "MEETING":
        return "bg-purple-100 text-purple-800";
      case "LEAVE":
        return "bg-green-100 text-green-800";
      case "VACATION":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // 이벤트 타입별 라벨
  const getEventLabel = (type: CalendarEvent["type"]) => {
    const labels: Record<CalendarEvent["type"], string> = {
      MEETING_ROOM: "회의실",
      MEETING: "미팅",
      LEAVE: "연차",
      VACATION: "휴가",
    };
    return labels[type] || type;
  };

  return (
    <div className="w-full">
      <div className="box-border w-full border border-gray-400 divide-y divide-gray-400">
        <div className="grid grid-cols-7 divide-x divide-gray-400 bg-gray-100">
          {week.map((item) => (
            <div key={item}>
              <p
                className={`h-8 leading-8 text-center text-sm ${
                  item === "일"
                    ? "text-red-600"
                    : item === "토"
                      ? "text-blue-600"
                      : "text-gray-600"
                }`}
              >
                {item}
              </p>
            </div>
          ))}
        </div>
        {dayArray.map((week, row) => (
          <div key={row} className="grid grid-cols-7 divide-x divide-gray-400">
            {week[row].map((day, column) => {
              const todayCheck =
                dateToFormatString(getToday(), "YYYY-MM-DD") ===
                dateToFormatString(day, "YYYY-MM-DD");
              const monthCheck =
                dateToFormatString(today, "YYYY-MM") ===
                dateToFormatString(day, "YYYY-MM");
              const dayEvents = getEventsForDate(day);

              return (
                <div
                  key={day.unix()}
                  className="relative h-36 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => onDateClick?.(day)}
                >
                  <div
                    className={`pl-1 py-1 text-left text-xs ${
                      monthCheck ? "font-normal" : "font-light"
                    } ${
                      monthCheck && column === 0
                        ? "text-red-600"
                        : monthCheck && column === 6
                          ? "text-blue-600"
                          : monthCheck
                            ? "text-gray-600"
                            : "text-gray-400"
                    }`}
                  >
                    {todayCheck ? (
                      <p className="flex items-center justify-center w-6 h-6 bg-green-600 rounded-full text-white">
                        {dateToFormatString(day, "D")}
                      </p>
                    ) : (
                      <p className="flex items-center justify-center w-6 h-6 bg-white rounded-full">
                        {dateToFormatString(day, "D")}
                      </p>
                    )}
                  </div>
                  {/* 이벤트 표시 */}
                  <div className="px-1 mt-1 space-y-0.5 max-h-24 overflow-y-auto">
                    {dayEvents.slice(0, 3).map((event) => (
                      <div
                        key={event.id}
                        className={`text-xs px-1.5 py-0.5 rounded truncate ${getEventColor(
                          event.type,
                          event.status
                        )}`}
                        title={`${getEventLabel(event.type)}: ${event.title}`}
                      >
                        {getEventLabel(event.type)}: {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs px-1.5 py-0.5 text-gray-500">
                        +{dayEvents.length - 3}개 더
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomCalendar;
