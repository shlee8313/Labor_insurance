//file: lib/utils/dateUtils.js  (신설된 파일)

/**
 * Date and time utility functions for the 4대보험 (Four Major Insurance) management system
 */

/**
 * Get current year and month as a formatted string
 * @returns {string} Current year and month in YYYY-MM format
 */
export const getCurrentYearMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

/**
 * Get the number of days in a specified month
 * @param {string} yearMonth - Year and month in YYYY-MM format
 * @returns {number} Number of days in the month
 */
export const getDaysInMonth = (yearMonth) => {
  if (!yearMonth) return 31;

  const [year, month] = yearMonth.split("-").map(Number);
  return new Date(year, month, 0).getDate();
};

/**
 * Check if a specific day in a month is a Sunday
 * @param {number} day - Day of the month (1-31)
 * @param {string} yearMonth - Year and month in YYYY-MM format
 * @returns {boolean} True if the day is a Sunday
 */
export const isSundayByDate = (day, yearMonth) => {
  if (!yearMonth) return false;

  const date = new Date(`${yearMonth}-${String(day).padStart(2, "0")}`);
  return date.getDay() === 0; // 0: Sunday
};

/**
 * Check if a date is a public holiday
 * @param {string} dateStr - Date in YYYY-MM-DD format
 * @param {Array} holidaysList - List of holiday dates
 * @returns {boolean} True if the date is a holiday
 */
export const isHolidayByDate = (dateStr, holidaysList) => {
  if (!holidaysList) {
    // Default holiday list for 2024-2025
    holidaysList = [
      "2024-01-01", // New Year's Day
      "2024-02-09",
      "2024-02-10",
      "2024-02-11", // Lunar New Year
      "2024-03-01", // Independence Movement Day
      "2024-05-05", // Children's Day
      "2024-05-15", // Buddha's Birthday
      "2024-06-06", // Memorial Day
      "2024-08-15", // Liberation Day
      "2024-09-16",
      "2024-09-17",
      "2024-09-18", // Chuseok
      "2024-10-03", // National Foundation Day
      "2024-10-09", // Hangul Day
      "2024-12-25", // Christmas
      "2025-01-01", // New Year's Day
      "2025-01-28",
      "2025-01-29",
      "2025-01-30", // Lunar New Year
      "2025-03-01", // Independence Movement Day
      "2025-05-05", // Children's Day
      "2025-05-05", // Buddha's Birthday
      "2025-06-06", // Memorial Day
      "2025-08-15", // Liberation Day
      "2025-10-03", // National Foundation Day
      "2025-10-09", // Hangul Day
      "2025-12-25", // Christmas
    ];
  }

  return holidaysList.includes(dateStr);
};

/**
 * Calculate previous, current, and next year-month from selected values
 * @param {string|number} year - Year value
 * @param {string|number} month - Month value
 * @returns {Object} Object containing previous, current, and next year-month values
 */
export const getPreviousYearMonthFromSelected = (year, month) => {
  const selectedYear = parseInt(year);
  const selectedMonth = parseInt(month);

  // Previous month/year
  let prevMonth = selectedMonth - 1;
  let prevYear = selectedYear;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear = selectedYear - 1;
  }

  // Next month/year
  let nextMonth = selectedMonth + 1;
  let nextYear = selectedYear;
  if (nextMonth === 13) {
    nextMonth = 1;
    nextYear = selectedYear + 1;
  }

  return {
    currentYear: selectedYear.toString(),
    currentMonth: selectedMonth.toString().padStart(2, "0"),
    prevYear: prevYear.toString(),
    prevMonth: prevMonth.toString().padStart(2, "0"),
    nextYear: nextYear.toString(),
    nextMonth: nextMonth.toString().padStart(2, "0"),

    // Formatted strings for convenience
    currentYearMonth: `${selectedYear}-${selectedMonth.toString().padStart(2, "0")}`,
    prevYearMonth: `${prevYear}-${prevMonth.toString().padStart(2, "0")}`,
    nextYearMonth: `${nextYear}-${nextMonth.toString().padStart(2, "0")}`,

    // Date objects for calculations
    currentMonthStartDate: new Date(selectedYear, selectedMonth - 1, 1),
    prevMonthStartDate: new Date(prevYear, prevMonth - 1, 1),
    nextMonthStartDate: new Date(nextYear, nextMonth - 1, 1),
  };
};

/**
 * Format a date to a specific format
 * @param {Date|string} date - Date object or date string
 * @param {string} format - Format type ('yyyy-mm-dd', 'yyyy-mm', etc.)
 * @returns {string} Formatted date string
 */
export const formatDate = (date, format = "yyyy-mm-dd") => {
  if (!date) return "";

  const d = typeof date === "string" ? new Date(date) : date;

  if (isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  switch (format.toLowerCase()) {
    case "yyyy-mm-dd":
      return `${year}-${month}-${day}`;
    case "yyyy-mm":
      return `${year}-${month}`;
    case "mm-dd":
      return `${month}-${day}`;
    case "yyyy/mm/dd":
      return `${year}/${month}/${day}`;
    default:
      return `${year}-${month}-${day}`;
  }
};

/**
 * Extract day part from a date string
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {string} The day part (DD)
 */
export const formatDateToDayOnly = (dateString) => {
  if (!dateString) return "";
  const parts = dateString.split("-");
  if (parts.length === 3) {
    return parts[2]; // Day part only
  }
  return dateString;
};

/**
 * Calculate date range for a specific month
 * @param {string} yearMonth - Year and month in YYYY-MM format
 * @returns {Object} Start and end dates for the month
 */
export const getMonthDateRange = (yearMonth) => {
  if (!yearMonth) return { start: null, end: null };

  const [year, month] = yearMonth.split("-").map(Number);

  // Start date: first day of month
  const startDate = new Date(year, month - 1, 1);

  // End date: first day of next month
  const endDate = new Date(year, month, 1);

  return {
    start: formatDate(startDate),
    end: formatDate(endDate),
    startDate,
    endDate,
  };
};
