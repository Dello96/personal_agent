// hooks/useCalendar.ts

import {
  addDate,
  dayjsType,
  getStartDate,
  getToday,
  subtractDate,
} from "../../lib/utils/dateFormat";
import { useEffect, useState } from "react";

const useCalendar = () => {
  // 오늘 날짜를 기본값으로 가지는 today state
  const [today, setToday] = useState<dayjsType>(getToday());
  // 해당 월 날짜 배열
  const [dayArray, setDayArray] = useState<{ [x: number]: dayjsType[] }[]>([]);

  // 표시할 요일 텍스트용 배열
  // dayjs 요일 구하는 메소드를 활용해도 되지만 원하는 텍스트 배열로 표시하기 위해 생성
  const week = ["일", "월", "화", "수", "목", "금", "토"];

  // 캘린더 행과 열 지정
  const calendarColumns = 7; // 위에 요일 배열 length를 활용해도 됨(일치만 하면 된다.)
  const calendarRows = 6;

  // 해당 월에 일 수 계산 (ex. 1월이면 31일)
  const daysInMonth = today.daysInMonth();
  // 오늘 날짜가 속한 월의 시작 일 구하기
  const startDayOfMonth = getStartDate(today, "month");

  // 이전 달 계산
  const preMonth = today.subtract(1, "month");
  // 이전 달의 마지막 날짜 구하기
  const endDayOfPreMonth = preMonth.endOf("month");

  // 다음 달 계산
  const nextMonth = today.add(1, "month");
  // 다음 달의 첫번째 날짜 구하기
  const startDayOfNextMonth = nextMonth.startOf("month");

  // today 값에 따른 dayArray 설정
  useEffect(() => {
    // 해당 월의 일 수 만큼 시작 날짜에 하루씩 더해서 배열 생성
    const days = Array.from({ length: daysInMonth }, (_, index) =>
      addDate(startDayOfMonth, index, "day")
    );
    // 해당 월 캘린더에 표현될 이전 달 날짜 배열 생성
    // (ex. 2월 달력에 1월 마지막 주 며칠이 그려지는 부분)
    // 담길 배열 수는 해당 월 시작 요일의 index만큼만 필요
    const preEmptyDates = Array.from(
      { length: startDayOfMonth.day() },
      (_, index) => subtractDate(endDayOfPreMonth, index, "day")
    ).sort((a, b) => -1);

    // 이전 달 날짜 일부를 포함하여 1차 캘린더 생성
    const preCalendar = [...preEmptyDates, ...days];

    // 전체 캘린더 길이
    const calendarLength = calendarColumns * calendarRows;
    // 현재 캘린더(이전 달 일부 + 현재 달 전체) 길이
    const currentDayLength = preCalendar.length;
    // 현재 월 캘린더에 표시되야할 다음 달 날짜 길이
    const nextDayLength = calendarLength - currentDayLength;

    // 해당 월 캘린더에 표현될 다음 달 날짜 배열 생성
    // (ex. 2월 달력에 3월 첫 번째 주 며칠이 그려지는 부분)
    const nextEmptyDates = Array.from({ length: nextDayLength }, (_, index) =>
      addDate(startDayOfNextMonth, index, "day")
    );

    // 다음 달 날짜 일부를 포함하여 그려진 2차 캘린더 생성
    const nextCalendar = [...preCalendar, ...nextEmptyDates];
    const result = [];

    // 생성된 날짜 배열을 열(요일)을 기준으로 나누고 state에 최종 캘린더 배열 담기
    // 그리기 편하게끔 데이터를 가공
    for (let i = 0; i < calendarColumns; i++) {
      result.push({
        [i]: nextCalendar.slice(
          i * calendarColumns,
          i * calendarColumns + calendarColumns
        ),
      });
    }

    setDayArray(result);
  }, [today]);

  // 이전 달 버튼
  const setPreMonth = () => {
    let date = subtractDate(today, 1, "month");
    date = getStartDate(date, "M");
    setToday(date);
  };

  // 다음 달 버튼
  const setNextMonth = () => {
    let date = addDate(today, 1, "month");
    date = getStartDate(date, "M");
    setToday(date);
  };

  // 오늘 날짜 버튼
  const setPresentMonth = () => {
    setToday(getToday());
  };

  return {
    today,
    setToday,
    dayArray,
    setDayArray,
    week,
    setPreMonth,
    setNextMonth,
    setPresentMonth,
  };
};

export default useCalendar;
