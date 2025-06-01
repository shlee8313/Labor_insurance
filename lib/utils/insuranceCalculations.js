//file: lib/utils/insuranceCalculations.js

// 주민등록번호에서 나이 계산
/**
 * Insurance calculation utility functions for 4대보험 (Four Major Insurance) management system
 */

import { formatNumber } from "./formattingUtils";

/**
 * Calculate age from Korean resident registration number
 * @param {string} residentNumber - Resident registration number (13 digits)
 * @returns {number} Calculated age
 */
export const calculateAgeFromResidentNumber = (residentNumber) => {
  if (!residentNumber || residentNumber.length !== 13) return 0;

  const birthYear = parseInt(residentNumber.substring(0, 2), 10);
  const genderDigit = parseInt(residentNumber.charAt(6), 10);

  // Calculate full year based on gender digit
  let fullYear;
  if (genderDigit === 1 || genderDigit === 2) {
    fullYear = 1900 + birthYear;
  } else if (genderDigit === 3 || genderDigit === 4) {
    fullYear = 2000 + birthYear;
  } else if (genderDigit === 9 || genderDigit === 0) {
    fullYear = 1800 + birthYear;
  } else {
    // For foreign nationals or other cases, default to 1900s
    fullYear = 1900 + birthYear;
  }

  const currentYear = new Date().getFullYear();
  return currentYear - fullYear;
};

/**
 * 최초 근무일부터 1개월이 경과했는지 확인 (이번달 마지막 근무일 기준)
 * @param {string} firstWorkDate - 최초 근무일 (YYYY-MM-DD 형식)
 * @param {string} lastWorkDateThisMonth - 이번달 마지막 근무일 (YYYY-MM-DD 형식)
 * @returns {boolean} 1개월 경과 여부
 */
const isOneMonthPassedFromFirstWork = (firstWorkDate, lastWorkDateThisMonth) => {
  if (!firstWorkDate || !lastWorkDateThisMonth) return false;

  const firstWorkDateObj = new Date(firstWorkDate); // 최초 근무일
  const lastWorkDateObj = new Date(lastWorkDateThisMonth); // 이번달 마지막 근무일

  // 최초 근무일에서 1개월 후 날짜 계산
  const oneMonthLater = new Date(firstWorkDateObj);
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

  // 이번달 마지막 근무일이 1개월 후 날짜 이상인지 확인
  return lastWorkDateObj >= oneMonthLater;
};

/**
 * Determine insurance eligibility for all four major insurances
 * @param {Object} worker - Worker information
 * @param {Object} workHistory - Worker's work history
 * @param {Object} enrollmentStatus - Current enrollment status (optional)
 * @returns {Object} Insurance eligibility status for all four insurances
 */
export const determineInsuranceStatus = (worker, workHistory, enrollmentStatus = null) => {
  console.log(`보험상태 계산 시작 - 근로자ID: ${worker?.worker_id}`);

  // 기본 상태 객체 (모든 보험 제외 상태로 시작)
  const status = {
    nationalPension: { required: false, reason: "" },
    healthInsurance: { required: false, reason: "" },
    employmentInsurance: { required: true, reason: "일용근로자 당연 적용" },
    industrialAccident: { required: true, reason: "모든 근로자 당연 적용" },
  };

  // 근로자 정보나 근무 이력이 없으면 기본값 반환
  if (!worker || !workHistory) {
    console.log("근로자 또는 근무이력 정보 없음, 기본값 반환");
    return status;
  }

  // 주요 변수들 추출 및 초기화
  const age = worker.age || calculateAgeFromResidentNumber(worker.resident_number); // 근로자 나이
  const currentMonthWorkDays = workHistory.currentMonthWorkDays || 0; // 현재 월 근무일수
  const currentMonthWorkHours = workHistory.currentMonthWorkHours || 0; // 현재 월 근무시간
  const previousMonthWorkDays = workHistory.previousMonthWorkDays || 0; // 전월 근무일수
  const previousMonthWorkHours = workHistory.previousMonthWorkHours || 0; // 전월 근무시간
  const monthlyWage = workHistory.monthlyWage || 0; // 현재 월급여
  const firstWorkDate = workHistory.firstWorkDate; // 최초 근무일 (YYYY-MM-DD)
  const lastWorkDateThisMonth = workHistory.lastWorkDateThisMonth; // 이번달 마지막 근무일 (YYYY-MM-DD)
  const isRegisteredInCurrentMonth = workHistory.isRegisteredInCurrentMonth || false; // 현재 월 등록 여부

  console.log("보험 계산 입력값:", {
    age,
    currentMonthWorkDays,
    currentMonthWorkHours,
    previousMonthWorkDays,
    previousMonthWorkHours,
    monthlyWage,
    firstWorkDate,
    lastWorkDateThisMonth,
    isRegistered: isRegisteredInCurrentMonth,
  });

  // 1단계: 이미 가입된 근로자 확인 (enrollmentStatus가 제공된 경우)
  if (enrollmentStatus) {
    // 국민연금이 이미 가입되어 있으면 기존 상태 유지
    if (enrollmentStatus.nationalPension && enrollmentStatus.nationalPension.isEnrolled) {
      status.nationalPension.required = true;
      status.nationalPension.reason = "기존 가입자 (상태 유지)";
    }

    // 건강보험이 이미 가입되어 있으면 기존 상태 유지
    if (enrollmentStatus.healthInsurance && enrollmentStatus.healthInsurance.isEnrolled) {
      status.healthInsurance.required = true;
      status.healthInsurance.reason = "기존 가입자 (상태 유지)";
    }
  }

  // 2단계: 전월 근무가 없는 근로자는 가입 대상에서 제외
  const hasPreviousMonthWork = previousMonthWorkDays > 0 || previousMonthWorkHours > 0; // 전월 근무 여부

  if (!hasPreviousMonthWork && !enrollmentStatus) {
    console.log("전월 근무 없음, 신규 가입 대상 아님");
    status.nationalPension.reason = "전월 근무 없음 (신규 가입 불가)";
    status.healthInsurance.reason = "전월 근무 없음 (신규 가입 불가)";
    return status;
  }

  // 3단계: 1개월 경과 여부 확인 (이번달 마지막 근무일 기준)
  const isOneMonthPassed = isOneMonthPassedFromFirstWork(firstWorkDate, lastWorkDateThisMonth); // 최초 근무일부터 1개월 경과 여부 (마지막 근무일 기준)

  if (!isOneMonthPassed && !enrollmentStatus) {
    console.log("최초 근무일부터 1개월 미경과 (이번달 마지막 근무일 기준), 신규 가입 대상 아님");

    if (!lastWorkDateThisMonth) {
      status.nationalPension.reason = "이번달 마지막 근무일 정보 없음";
      status.healthInsurance.reason = "이번달 마지막 근무일 정보 없음";
    } else {
      status.nationalPension.reason = "최초 근무일부터 1개월 미경과 (마지막 근무일 기준)";
      status.healthInsurance.reason = "최초 근무일부터 1개월 미경과 (마지막 근무일 기준)";
    }

    return status;
  }

  // 4단계: 누적 근무일수 및 시간 계산 (최초 근무일부터 현재까지)
  const totalWorkDaysFromFirst = previousMonthWorkDays + currentMonthWorkDays; // 누적 근무일수 (전월 + 현재월)
  const totalWorkHoursFromFirst = previousMonthWorkHours + currentMonthWorkHours; // 누적 근무시간 (전월 + 현재월)

  console.log("누적 근무 현황:", {
    isOneMonthPassed,
    firstWorkDate,
    lastWorkDateThisMonth,
    totalWorkDaysFromFirst,
    totalWorkHoursFromFirst,
    hasPreviousMonthWork,
  });

  // 5단계: 국민연금 판단 로직 (이미 가입된 경우는 3단계에서 처리됨)
  if (!enrollmentStatus?.nationalPension?.isEnrolled) {
    // 나이 조건 확인 (18세 이상 60세 미만)
    if (age < 18) {
      status.nationalPension.required = false;
      status.nationalPension.reason = "18세 미만";
    } else if (age > 60) {
      status.nationalPension.required = false;
      status.nationalPension.reason = "60세 초과";
    }
    // 월급여 220만원 이상인 경우 (즉시 가입, 기간/누적 조건 무관)
    else if (monthlyWage >= 2200000) {
      status.nationalPension.required = true;
      status.nationalPension.reason = "월급여 220만원 이상 (즉시 가입)";
    }
    // 1개월 경과 + (누적 8일 이상 OR 누적 60시간 이상) 조건 - 수정된 부분
    else if (isOneMonthPassed && (totalWorkDaysFromFirst >= 8 || totalWorkHoursFromFirst >= 60)) {
      status.nationalPension.required = true;

      // 더 구체적인 사유 제공
      if (totalWorkDaysFromFirst >= 8 && totalWorkHoursFromFirst >= 60) {
        status.nationalPension.reason = `1개월 경과 + 누적 ${totalWorkDaysFromFirst}일 및 ${totalWorkHoursFromFirst}시간 (모든 조건 충족)`;
      } else if (totalWorkDaysFromFirst >= 8) {
        status.nationalPension.reason = `1개월 경과 + 누적 ${totalWorkDaysFromFirst}일 (8일 이상 조건 충족)`;
      } else {
        status.nationalPension.reason = `1개월 경과 + 누적 ${totalWorkHoursFromFirst}시간 (60시간 이상 조건 충족)`;
      }
    } else {
      status.nationalPension.required = false;

      // 구체적인 미달 사유 제공 - 수정된 부분
      if (!isOneMonthPassed) {
        status.nationalPension.reason = "1개월 미경과 (마지막 근무일 기준)";
      } else if (totalWorkDaysFromFirst < 8 && totalWorkHoursFromFirst < 60) {
        status.nationalPension.reason = `누적 근무 부족 (${totalWorkDaysFromFirst}일 < 8일, ${totalWorkHoursFromFirst}시간 < 60시간)`;
      } else {
        status.nationalPension.reason = "가입 조건 미달";
      }
    }
  }

  // 6단계: 건강보험 판단 로직 (이미 가입된 경우는 3단계에서 처리됨)
  if (!enrollmentStatus?.healthInsurance?.isEnrolled) {
    // 1개월 경과 + 누적 60시간 이상 조건
    if (isOneMonthPassed && totalWorkHoursFromFirst >= 60) {
      status.healthInsurance.required = true;
      status.healthInsurance.reason = `1개월 경과 + 누적 ${totalWorkHoursFromFirst}시간 (60시간 이상 조건 충족)`;
    } else {
      status.healthInsurance.required = false;

      // 구체적인 미달 사유 제공
      if (!isOneMonthPassed) {
        status.healthInsurance.reason = "1개월 미경과 (마지막 근무일 기준)";
      } else if (totalWorkHoursFromFirst < 60) {
        status.healthInsurance.reason = `누적 근무시간 부족 (${totalWorkHoursFromFirst}시간 < 60시간)`;
      } else {
        status.healthInsurance.reason = "가입 조건 미달";
      }
    }
  }

  // 7단계: 고용보험 및 산재보험 (변경 없음 - 일용근로자 당연 적용)
  status.employmentInsurance.required = true;
  status.employmentInsurance.reason = age >= 65 ? "65세 이상 특례 적용" : "일용근로자 당연 적용";

  status.industrialAccident.required = true;
  status.industrialAccident.reason = "모든 근로자 당연 적용";

  console.log("보험 계산 최종 결과:", status);
  return status;
};

/**
 * Calculate insurance premium based on wage and insurance type
 * @param {number} wage - Wage amount
 * @param {string} insuranceType - Insurance type code
 * @param {Object} rates - Insurance rates object
 * @returns {number} Calculated premium
 */
export const calculateInsurancePremium = (wage, insuranceType, rates = null) => {
  // Default rates if not provided
  const defaultRates = {
    national_pension: 0.045, // 4.5%
    health_insurance: 0.0323, // 3.23%
    employment_insurance: 0.008, // 0.8%
    industrial_accident: 0.009, // 0.9%
  };

  const applicableRates = rates || defaultRates;

  if (!wage || !insuranceType || !applicableRates[insuranceType]) {
    return 0;
  }

  // Calculate premium (round down to nearest integer)
  return Math.floor(parseFloat(wage) * applicableRates[insuranceType]);
};

/**
 * Calculate daily income tax
 * @param {number} dailyWage - Daily wage amount
 * @param {Object} rates - Tax rates settings
 * @returns {Object} Calculated tax information
 */
export const calculateDailyTax = (dailyWage, rates = {}) => {
  const dailyIncomeDeduction = rates.dailyIncomeDeduction || 150000; // Daily income deduction (default 150,000 KRW)
  const incomeTaxRate = rates.incomeTaxRate || 0.06; // Income tax rate (default 6%)
  const taxReductionRate = rates.taxReductionRate || 0.45; // Tax reduction rate (default 45%)

  let dailyTax = 0;
  let dailyTaxableAmount = 0;

  if (dailyWage > dailyIncomeDeduction) {
    dailyTaxableAmount = dailyWage - dailyIncomeDeduction; // Apply daily deduction
    dailyTax = Math.round(dailyTaxableAmount * incomeTaxRate * taxReductionRate); // Apply tax rate and reduction
  }

  return {
    dailyTax,
    dailyTaxableAmount,
    formula:
      dailyTaxableAmount > 0
        ? `(${formatNumber(dailyWage)} - ${formatNumber(dailyIncomeDeduction)}) × ${(
            incomeTaxRate * 100
          ).toFixed(1)}% × ${(taxReductionRate * 100).toFixed(1)}% = ${formatNumber(dailyTax)}`
        : `과세표준 없음 (일당 ≤ ${formatNumber(dailyIncomeDeduction)}원)`,
  };
};

/**
 * Apply minimum tax collection rule
 * @param {number} tax - Original tax amount
 * @param {number} minTaxExemption - Minimum tax threshold
 * @returns {number} Tax amount after applying minimum rule
 */
export const applyMinimumTaxRule = (tax, minTaxExemption = 1000) => {
  return tax < minTaxExemption ? 0 : tax;
};

/**
 * Check if worker is eligible for insurance based on worker type
 * @param {string} workerType - Worker type (daily, regular, etc.)
 * @param {string} insuranceType - Insurance type
 * @returns {boolean} Eligibility status
 */
export const isEligibleForInsurance = (workerType, insuranceType) => {
  // Daily workers are eligible for all insurances
  if (workerType === "daily") {
    return true;
  }

  // Regular workers eligibility varies by insurance type
  if (workerType === "regular") {
    // All regular workers are eligible for all insurance types
    return true;
  }

  // Default to false for unknown worker types
  return false;
};

/**
 * Determine if worker qualifies for permanent insurance acquisition
 * @param {Object} workHistory - Worker's work history
 * @returns {boolean} Whether worker qualifies for permanent acquisition
 */
export const qualifiesForPermanentAcquisition = (workHistory) => {
  if (!workHistory) return false;

  // Check for consecutive months of sufficient work
  const consecutiveMonths = workHistory.consecutiveEligibleMonths || 0;

  // If worker has worked more than 3 consecutive months with eligibility
  return consecutiveMonths >= 3;
};
