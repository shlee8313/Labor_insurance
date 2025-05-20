// file: app/dashboard/work_time/components/CalendarWorkTime.js
"use client";
import React, { useState, useEffect } from "react";

const CalendarWorkTime = ({
  yearMonth,
  workDetails,
  isReportLoading,
  handleChange,
  formatNumber,
}) => {
  // 해당 월의 일수와 첫 날의 요일 계산
  const [calendarData, setCalendarData] = useState([]);
  const [holidays, setHolidays] = useState({});

  // 양력 고정 공휴일 (매년 날짜 고정)
  const fixedHolidays = {
    "01-01": "신정",
    "03-01": "삼일절",
    "05-05": "어린이날",
    "06-06": "현충일",
    "08-15": "광복절",
    "10-03": "개천절",
    "10-09": "한글날",
    "12-25": "크리스마스",
  };

  // 음력 공휴일의 양력 날짜 매핑 (2024-2050)
  const lunarHolidaysMapping = {
    2024: { 설날: "2024-02-10", 추석: "2024-09-17", 석가탄신일: "2024-05-15" },
    2025: { 설날: "2025-01-29", 추석: "2025-10-06", 석가탄신일: "2025-05-05" },
    2026: { 설날: "2026-02-17", 추석: "2026-09-25", 석가탄신일: "2026-05-24" },
    2027: { 설날: "2027-02-07", 추석: "2027-09-15", 석가탄신일: "2027-05-13" },
    2028: { 설날: "2028-01-27", 추석: "2028-10-03", 석가탄신일: "2028-05-02" },
    2029: { 설날: "2029-02-13", 추석: "2029-09-22", 석가탄신일: "2029-05-20" },
    2030: { 설날: "2030-02-03", 추석: "2030-09-12", 석가탄신일: "2030-05-09" },
    2031: { 설날: "2031-01-23", 추석: "2031-10-01", 석가탄신일: "2031-05-28" },
    2032: { 설날: "2032-02-11", 추석: "2032-09-19", 석가탄신일: "2032-05-16" },
    2033: { 설날: "2033-01-31", 추석: "2033-09-08", 석가탄신일: "2033-05-06" },
    2034: { 설날: "2034-02-19", 추석: "2034-09-28", 석가탄신일: "2034-05-25" },
    2035: { 설날: "2035-02-08", 추석: "2035-09-17", 석가탄신일: "2035-05-15" },
    2036: { 설날: "2036-01-29", 추석: "2036-10-05", 석가탄신일: "2036-05-03" },
    2037: { 설날: "2037-02-15", 추석: "2037-09-25", 석가탄신일: "2037-05-22" },
    2038: { 설날: "2038-02-04", 추석: "2038-09-14", 석가탄신일: "2038-05-11" },
    2039: { 설날: "2039-01-24", 추석: "2039-10-03", 석가탄신일: "2039-05-01" },
    2040: { 설날: "2040-02-12", 추석: "2040-09-21", 석가탄신일: "2040-05-19" },
    2041: { 설날: "2041-02-01", 추석: "2041-09-10", 석가탄신일: "2041-05-08" },
    2042: { 설날: "2042-01-22", 추석: "2042-09-29", 석가탄신일: "2042-05-27" },
    2043: { 설날: "2043-02-10", 추석: "2043-09-18", 석가탄신일: "2043-05-16" },
    2044: { 설날: "2044-01-30", 추석: "2044-10-06", 석가탄신일: "2044-05-05" },
    2045: { 설날: "2045-02-17", 추석: "2045-09-26", 석가탄신일: "2045-05-24" },
    2046: { 설날: "2046-02-06", 추석: "2046-09-15", 석가탄신일: "2046-05-13" },
    2047: { 설날: "2047-01-26", 추석: "2047-10-04", 석가탄신일: "2047-05-02" },
    2048: { 설날: "2048-02-14", 추석: "2048-09-22", 석가탄신일: "2048-05-20" },
    2049: { 설날: "2049-02-02", 추석: "2049-09-12", 석가탄신일: "2049-05-09" },
    2050: { 설날: "2050-01-23", 추석: "2050-10-01", 석가탄신일: "2050-05-28" },
  };

  // 음력 휴일을 기준으로 전날, 당일, 다음날 3일의 날짜를 반환
  function getLunarHolidayRange(baseDate, name) {
    // 기준일 파싱
    const base = new Date(baseDate);

    // 전날과 다음날 계산
    const prevDay = new Date(base);
    prevDay.setDate(base.getDate() - 1);

    const nextDay = new Date(base);
    nextDay.setDate(base.getDate() + 1);

    // YYYY-MM-DD 형식으로 변환
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    // 휴일 범위 반환
    return [
      { date: formatDate(prevDay), name: `${name} 전날` },
      { date: formatDate(base), name },
      { date: formatDate(nextDay), name: `${name} 다음날` },
    ];
  }

  // 특정 연도와 월의 공휴일을 객체 형태로 반환 (날짜를 키로 사용)
  function getHolidaysForYearMonth(year, month) {
    // 월은 1-12 사이의 숫자여야 함
    if (month < 1 || month > 12) {
      return {};
    }

    // 월 문자열 (01, 02, ..., 12)
    const monthStr = String(month).padStart(2, "0");

    // 해당 월의 고정 공휴일 (양력)
    let holidaysMap = {};

    // 양력 고정 공휴일 추가
    Object.entries(fixedHolidays).forEach(([mmdd, name]) => {
      if (mmdd.startsWith(monthStr)) {
        holidaysMap[`${year}-${mmdd}`] = name;
      }
    });

    // 음력 공휴일 추가
    if (lunarHolidaysMapping[year]) {
      const yearLunarData = lunarHolidaysMapping[year];

      // 설날 3일 추가
      if (yearLunarData["설날"]) {
        getLunarHolidayRange(yearLunarData["설날"], "설날").forEach((holiday) => {
          // 월에 해당하는 날짜만 추가
          if (holiday.date.substring(5, 7) === monthStr) {
            holidaysMap[holiday.date] = holiday.name;
          }
        });
      }

      // 추석 3일 추가
      if (yearLunarData["추석"]) {
        getLunarHolidayRange(yearLunarData["추석"], "추석").forEach((holiday) => {
          if (holiday.date.substring(5, 7) === monthStr) {
            holidaysMap[holiday.date] = holiday.name;
          }
        });
      }

      // 석가탄신일 추가
      if (yearLunarData["석가탄신일"] && yearLunarData["석가탄신일"].substring(5, 7) === monthStr) {
        holidaysMap[yearLunarData["석가탄신일"]] = "석가탄신일";
      }
    }

    return holidaysMap;
  }

  // 해당 월의 공휴일 정보 가져오기
  useEffect(() => {
    if (!yearMonth) return;

    const [year, month] = yearMonth.split("-").map((num) => parseInt(num, 10));

    // 휴일 정보 가져오기
    const holidaysMap = getHolidaysForYearMonth(year, month);
    setHolidays(holidaysMap);
  }, [yearMonth]);

  // 달력 데이터 생성
  useEffect(() => {
    if (!yearMonth) return;

    // 해당 월의 첫날
    const firstDay = new Date(`${yearMonth}-01`);
    // 해당 월의 마지막 날
    const lastDay = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0);
    const lastDate = lastDay.getDate();

    // 첫날의 요일 (0: 일요일, 1: 월요일, ...)
    let firstDayOfWeek = firstDay.getDay();
    // 달력에서는 월요일부터 시작하도록 조정 (1: 월요일, ..., 0: 일요일 -> 7: 일요일)
    firstDayOfWeek = firstDayOfWeek === 0 ? 7 : firstDayOfWeek;

    // 달력 데이터 생성
    const tempCalendarData = [];

    // 첫 주 시작 전 빈 칸 추가 (월요일부터 시작)
    for (let i = 1; i < firstDayOfWeek; i++) {
      tempCalendarData.push(null);
    }

    // 날짜 데이터 추가
    for (let i = 1; i <= lastDate; i++) {
      tempCalendarData.push(i);
    }

    setCalendarData(tempCalendarData);
  }, [yearMonth]);

  // 요일 확인 함수
  const getDayOfWeek = (index) => {
    if (!yearMonth || !calendarData[index]) return -1;
    const date = new Date(`${yearMonth}-${String(calendarData[index]).padStart(2, "0")}`);
    return date.getDay(); // 0: 일요일, 1: 월요일, ...
  };

  // 일요일 확인 함수
  const isSunday = (index) => {
    return getDayOfWeek(index) === 0;
  };

  // 휴일 확인 함수
  const isHoliday = (index) => {
    if (!yearMonth || !calendarData[index]) return false;

    const day = calendarData[index];
    const dateStr = `${yearMonth}-${String(day).padStart(2, "0")}`;

    // 공휴일 목록에서 확인
    if (holidays[dateStr]) return true;

    // 일요일 확인
    return isSunday(index);
  };

  // 날짜 셀 렌더링
  // CalendarWorkTime.js의 renderDateCell 함수 수정
  const renderDateCell = (index) => {
    if (calendarData[index] === null) {
      return <div key={`empty-${index}`} className="border p-2 rounded shadow-sm bg-gray-50"></div>;
    }

    const day = calendarData[index];
    const dayIndex = day - 1; // workDetails 배열 인덱스는 0부터 시작
    const dayData = workDetails[dayIndex] || {
      hours: "",
      extended: false,
      holiday: false,
      night: false,
      wage: "",
    };

    // 지급 상태 확인 - payment_status 필드 추가 필요
    const isPaid = dayData.payment_status === "paid";

    // 데이터가 입력되었는지 확인 (시간이나 임금 중 하나라도 입력되었는지)
    const hasData = dayData.hours || dayData.wage;

    // 데이터가 모두 입력되었는지 확인 (시간과 임금 모두 입력되었는지)
    const isComplete = dayData.hours && dayData.wage;

    // 배경색 클래스 결정 - 지급상태 추가
    let bgColorClass = "";
    if (isPaid) {
      bgColorClass = "bg-gray-200"; // 지급완료된 기록은 회색 배경
    } else if (isComplete) {
      bgColorClass = "bg-green-50"; // 시간과 임금 모두 입력된 경우 연한 녹색
    } else if (hasData) {
      bgColorClass = "bg-yellow-50"; // 둘 중 하나만 입력된 경우 연한 노란색
    }

    // 공휴일 여부 확인 (기존 코드 유지)
    const dateStr = `${yearMonth}-${String(day).padStart(2, "0")}`;
    const holidayName = holidays[dateStr];
    const isHolidayDate = isHoliday(index);

    return (
      <div
        key={`day-${day}`}
        className={`border p-2 rounded shadow-sm space-y-2 text-sm transition-colors duration-200 
        ${bgColorClass} ${hasData ? "border-gray-300" : "border-gray-200"}
        ${isHolidayDate ? "border-red-200" : ""}
        ${isPaid ? "relative paid-record" : ""}`}
      >
        <div className="flex justify-between items-center">
          <div className={`font-semibold ${isHolidayDate ? "text-red-500" : ""}`}>{day}일</div>
          {holidayName && (
            <div className="text-xs text-red-500 truncate" title={holidayName}>
              {holidayName}
            </div>
          )}

          {/* 지급완료 표시 추가 */}
          {isPaid && <div className="text-xs bg-blue-500 text-white px-1 rounded">지급완료</div>}
        </div>

        <input
          type="number"
          placeholder="근로시간"
          className={`w-full px-2 py-1 border rounded placeholder:text-gray-300 ${
            isPaid ? "bg-gray-100 cursor-not-allowed" : ""
          }`}
          value={dayData.hours}
          onChange={(e) => !isPaid && handleChange(dayIndex, "hours", e.target.value)}
          disabled={isPaid} // 지급완료된 경우 비활성화
          title={isPaid ? "지급완료된 기록은 수정할 수 없습니다" : ""}
        />

        <div className="flex justify-between text-xs">
          <label className={`flex items-center gap-1 ${isPaid ? "opacity-50" : ""}`}>
            <input
              type="checkbox"
              checked={dayData.extended}
              onChange={(e) => !isPaid && handleChange(dayIndex, "extended", e.target.checked)}
              disabled={isPaid}
            />
            연장
          </label>
          <label className={`flex items-center gap-1 ${isPaid ? "opacity-50" : ""}`}>
            <input
              type="checkbox"
              checked={dayData.holiday}
              onChange={(e) => !isPaid && handleChange(dayIndex, "holiday", e.target.checked)}
              disabled={isPaid}
            />
            휴일
          </label>
          <label className={`flex items-center gap-1 ${isPaid ? "opacity-50" : ""}`}>
            <input
              type="checkbox"
              checked={dayData.night}
              onChange={(e) => !isPaid && handleChange(dayIndex, "night", e.target.checked)}
              disabled={isPaid}
            />
            야간
          </label>
        </div>

        <input
          type="text"
          inputMode="numeric"
          placeholder="임금(₩)"
          className={`w-full px-2 py-1 border rounded placeholder:text-gray-300 ${
            isPaid ? "bg-gray-100 cursor-not-allowed" : ""
          }`}
          value={dayData.wage}
          onChange={(e) => !isPaid && handleChange(dayIndex, "wage", formatNumber(e.target.value))}
          disabled={isPaid} // 지급완료된 경우 비활성화
          title={isPaid ? "지급완료된 기록은 수정할 수 없습니다" : ""}
        />

        {/* 오버레이 레이어 추가 (시각적 강화) */}
        {isPaid && (
          <style jsx>{`
            .paid-record::after {
              content: "";
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: repeating-linear-gradient(
                45deg,
                rgba(200, 200, 200, 0.1),
                rgba(200, 200, 200, 0.1) 10px,
                rgba(220, 220, 220, 0.1) 10px,
                rgba(220, 220, 220, 0.1) 20px
              );
              pointer-events: none;
            }
          `}</style>
        )}
      </div>
    );
  };

  // 요일 헤더
  const daysOfWeek = ["월", "화", "수", "목", "금", "토", "일"];

  return (
    <div className="w-full">
      {isReportLoading ? (
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          <span className="ml-3">근무 기록 로딩 중...</span>
        </div>
      ) : (
        <>
          {/* 요일 헤더 */}
          <div className="grid grid-cols-7 gap-4 mb-4">
            {daysOfWeek.map((day, index) => (
              <div
                key={day}
                className={`border p-2 rounded shadow-sm bg-gray-50 text-center font-medium ${
                  index === 6 ? "text-red-500" : ""
                }`}
              >
                {day}
              </div>
            ))}
          </div>

          {/* 달력 그리드 */}
          <div className="grid grid-cols-7 gap-4">
            {calendarData.map((_, index) => renderDateCell(index))}
          </div>

          {/* 범례 추가 */}
          {/* <div className="mt-6 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-yellow-50 border border-gray-300 rounded mr-2"></div>
              <span>일부 데이터 입력</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-50 border border-gray-300 rounded mr-2"></div>
              <span>데이터 입력 완료</span>
            </div>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-white border border-red-200 rounded mr-2"></div>
              <span className="text-red-500 font-medium">빨간 날짜</span>
              <span className="ml-1">: 공휴일 및 일요일</span>
            </div>
          </div> */}

          {/* 공휴일 목록 */}
          {/* {Object.keys(holidays).length > 0 && (
            <div className="mt-4 p-3 bg-gray-50 rounded-md border border-gray-200">
              <h3 className="font-medium mb-2">이번 달 공휴일</h3>
              <ul className="space-y-1 text-sm">
                {Object.entries(holidays).map(([date, name]) => (
                  <li key={date} className="flex">
                    <span className="text-gray-600 w-24">{date.substring(5)}</span>
                    <span className="text-red-500">{name}</span>
                  </li>
                ))}
              </ul>
            </div>
          )} */}
        </>
      )}
    </div>
  );
};

export default CalendarWorkTime;
