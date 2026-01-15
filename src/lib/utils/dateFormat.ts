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
