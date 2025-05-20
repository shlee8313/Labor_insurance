//file: lib/utils/workTimeUtils.js(신설된 파일)

/**
 * Work time utility functions for the 4대보험 (Four Major Insurance) management system
 */

import { isSundayByDate, isHolidayByDate } from "./dateUtils";

/**
 * Calculate total working hours from work records
 * @param {Object} workRecords - Work records object
 * @returns {number} Total working hours
 */
export const calculateTotalWorkHours = (workRecords) => {
  if (!workRecords) return 0;

  return Object.values(workRecords).reduce((total, record) => {
    return total + (parseFloat(record.hours) || 0);
  }, 0);
};

/**
 * Calculate total working days from work records
 * @param {Object} workRecords - Work records object
 * @returns {number} Number of working days
 */
export const calculateWorkDays = (workRecords) => {
  if (!workRecords) return 0;

  // Count days with non-zero hours
  return Object.values(workRecords).filter((record) => (parseFloat(record.hours) || 0) > 0).length;
};

/**
 * Calculate total wage from work records
 * @param {Object} workRecords - Work records object
 * @returns {number} Total wage amount
 */
export const calculateTotalWage = (workRecords) => {
  if (!workRecords) return 0;

  return Object.values(workRecords).reduce((total, record) => {
    // Handle both string and number wage values
    const wage =
      typeof record.wage === "string"
        ? parseFloat(record.wage.replace(/,/g, ""))
        : record.wage || 0;

    return total + wage;
  }, 0);
};

/**
 * Calculate hourly wage rate
 * @param {number} totalWage - Total wage amount
 * @param {number} totalHours - Total working hours
 * @returns {number} Hourly wage rate
 */
export const calculateHourlyRate = (totalWage, totalHours) => {
  if (!totalHours || totalHours === 0) return 0;
  return Math.round(totalWage / totalHours);
};

/**
 * Determine work type based on work day and conditions
 * @param {number} day - Day of month
 * @param {string} yearMonth - Year and month in YYYY-MM format
 * @param {boolean} isExtended - Whether it's extended hours
 * @param {boolean} isNight - Whether it's night work
 * @returns {string} Work type code
 */
export const determineWorkType = (day, yearMonth, isExtended, isNight) => {
  const date = `${yearMonth}-${String(day).padStart(2, "0")}`;
  const isSunday = isSundayByDate(day, yearMonth);
  const isHoliday = isHolidayByDate(date);

  // Determine primary work type
  if (isHoliday || isSunday) {
    return "holiday"; // Holiday work takes precedence
  } else if (isNight) {
    return "night"; // Night work
  } else if (isExtended) {
    return "overtime"; // Overtime
  } else {
    return "regular"; // Regular work
  }
};

/**
 * Create work type metadata object
 * @param {boolean} isExtended - Extended hours flag
 * @param {boolean} isHoliday - Holiday work flag
 * @param {boolean} isNight - Night work flag
 * @returns {Object} Work type metadata
 */
export const createWorkTypeMetadata = (isExtended, isHoliday, isNight) => {
  return {
    extended: isExtended || false,
    holiday: isHoliday || false,
    night: isNight || false,
  };
};

/**
 * Parse work type metadata from string or object
 * @param {string|Object} metadata - Work type metadata
 * @returns {Object} Parsed metadata object
 */
export const parseWorkTypeMetadata = (metadata) => {
  if (!metadata) {
    return { extended: false, holiday: false, night: false };
  }

  if (typeof metadata === "string") {
    try {
      return JSON.parse(metadata);
    } catch (e) {
      console.error("Error parsing work type metadata:", e);
      return { extended: false, holiday: false, night: false };
    }
  }

  return metadata;
};

/**
 * Group work records by month
 * @param {Array} workRecords - Array of work records
 * @returns {Object} Work records grouped by YYYY-MM
 */
export const groupWorkRecordsByMonth = (workRecords) => {
  if (!workRecords || !Array.isArray(workRecords)) return {};

  return workRecords.reduce((grouped, record) => {
    if (!record.work_date) return grouped;

    const date = new Date(record.work_date);
    const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    if (!grouped[yearMonth]) {
      grouped[yearMonth] = [];
    }

    grouped[yearMonth].push(record);
    return grouped;
  }, {});
};

/**
 * Calculate consecutive months with sufficient work days
 * @param {Object} monthlyWorkDays - Object mapping months to work days
 * @param {number} threshold - Minimum days threshold (default: 8)
 * @returns {number} Number of consecutive months meeting threshold
 */
export const calculateConsecutiveEligibleMonths = (monthlyWorkDays, threshold = 8) => {
  if (!monthlyWorkDays) return 0;

  // Convert to array of months sorted chronologically
  const sortedMonths = Object.keys(monthlyWorkDays).sort();
  let maxConsecutive = 0;
  let currentConsecutive = 0;

  for (let i = 0; i < sortedMonths.length; i++) {
    const month = sortedMonths[i];

    if (monthlyWorkDays[month] >= threshold) {
      currentConsecutive++;
    } else {
      currentConsecutive = 0;
    }

    maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
  }

  return maxConsecutive;
};

/**
 * 데이터 변경을 기록하여 다른 컴포넌트에 알림
 * @param {number|string} workerId - 근로자 ID
 * @param {number|string} siteId - 현장 ID
 * @param {string} yearMonth - YYYY-MM 형식의 년월
 * @param {string} action - 수행된 작업(예: 'save', 'delete' 등)
 */
export const recordDataChange = (workerId, siteId, yearMonth, action = "save") => {
  try {
    const changeData = {
      workerId,
      siteId,
      yearMonth,
      timestamp: Date.now(),
      action,
    };

    // 로컬 스토리지에 저장
    localStorage.setItem("worktime_data_updated", JSON.stringify(changeData));

    // 커스텀 이벤트 발생 (페이지 간 통신)
    if (typeof window !== "undefined") {
      const event = new CustomEvent("worktime_data_updated", { detail: changeData });
      window.dispatchEvent(event);
    }

    return true;
  } catch (error) {
    console.error("데이터 변경 기록 오류:", error);
    return false;
  }
};

/**
 * 데이터 변경이 있는지 확인
 * @param {number|string} siteId - 현장 ID
 * @param {string} yearMonth - YYYY-MM 형식의 년월
 * @param {number} lastCheckedTimestamp - 마지막으로 확인한 타임스탬프
 * @returns {boolean} 변경 여부
 */
export const hasDataChanged = (siteId, yearMonth, lastCheckedTimestamp = 0) => {
  try {
    if (typeof window === "undefined") return false;

    const lastUpdateStr = localStorage.getItem("worktime_data_updated");
    if (!lastUpdateStr) return false;

    const lastUpdate = JSON.parse(lastUpdateStr);

    // 현장과 년월이 일치하고, 타임스탬프가 최신인 경우
    if (
      lastUpdate.siteId == siteId &&
      lastUpdate.yearMonth === yearMonth &&
      lastUpdate.timestamp > lastCheckedTimestamp
    ) {
      return true;
    }

    return false;
  } catch (error) {
    console.error("데이터 변경 확인 오류:", error);
    return false;
  }
};
