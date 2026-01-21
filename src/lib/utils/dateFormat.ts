// utils/dateFormat.ts

import "dayjs/locale/ko";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.locale("ko");

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Seoul");

export type dayjsType = dayjs.Dayjs;

// 오늘 날짜 구하기기
export const getToday = () => {
  return dayjs();
};

// DateType을 원하는 형식 String으로 변환
export const dateToFormatString = (date: dayjs.ConfigType, format: string) => {
  if (!date) return "";
  return dayjs(date).format(format);
};

// 시작 날짜 구하기
export const getStartDate = (
  date: dayjs.ConfigType,
  type: dayjs.OpUnitType
) => {
  return dayjs(date).startOf(type);
};

// 날짜 더하기
export const addDate = (
  date: dayjs.ConfigType,
  value: number,
  type: dayjs.ManipulateType
) => {
  return dayjs(date).add(value, type);
};

// 날짜 빼기
export const subtractDate = (
  date: dayjs.ConfigType,
  value: number,
  type: dayjs.ManipulateType
) => {
  return dayjs(date).subtract(value, type);
};

// 상대적 시간 표시 (예: "N분 전", "N시간 전", "N일 전")
export const formatRelativeTime = (
  dateString: string | null | undefined
): string => {
  if (!dateString) return "";

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  if (diffDays > 0) return `${diffDays}일 전`;
  if (diffHours > 0) return `${diffHours}시간 전`;
  if (diffMinutes > 0) return `${diffMinutes}분 전`;
  return "방금 전";
};

// 스마트 날짜 포맷 (상대적 시간 또는 절대 시간)
export const formatSmartDate = (
  dateString: string | null | undefined
): string => {
  if (!dateString) return "";

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // 오늘인 경우 상대적 시간 표시
  if (diffDays === 0) {
    return formatRelativeTime(dateString);
  }

  // 어제인 경우
  if (diffDays === 1) {
    return "어제";
  }

  // 일주일 이내인 경우
  if (diffDays < 7) {
    return `${diffDays}일 전`;
  }

  // 그 외의 경우 절대 날짜 표시
  return dateToFormatString(dateString, "YYYY년 MM월 DD일");
};
