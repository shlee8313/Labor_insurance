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
 * Determine insurance eligibility for all four major insurances
 * @param {Object} worker - Worker information
 * @param {Object} workHistory - Worker's work history
 * @returns {Object} Insurance eligibility status for all four insurances
 */
export const determineInsuranceStatus = (worker, workHistory) => {
  console.log(`보험상태 계산 시작 - 근로자ID: ${worker?.worker_id}`);

  // Default status object
  const status = {
    nationalPension: { required: false, reason: "" },
    healthInsurance: { required: false, reason: "" },
    employmentInsurance: { required: true, reason: "일용근로자 당연 적용" },
    industrialAccident: { required: true, reason: "모든 근로자 당연 적용" },
  };

  // Return default if no worker or work history
  if (!worker || !workHistory) {
    console.log("근로자 또는 근무이력 정보 없음, 기본값 반환");
    return status;
  }

  // 주요 값들 추출
  const age = worker.age || calculateAgeFromResidentNumber(worker.resident_number);
  const currentMonthWorkDays = workHistory.currentMonthWorkDays || 0;
  const currentMonthWorkHours = workHistory.currentMonthWorkHours || 0;
  const monthlyWage = workHistory.monthlyWage || 0;

  console.log("보험 계산 입력값:", {
    age,
    currentMonthWorkDays,
    currentMonthWorkHours,
    monthlyWage,
    isRegistered: workHistory.isRegisteredInCurrentMonth,
  });

  // 월 근무 없음 케이스 처리
  if (
    currentMonthWorkDays === 0 &&
    currentMonthWorkHours === 0 &&
    !workHistory.isRegisteredInCurrentMonth
  ) {
    console.log("현재 월 근무 없음, 제외 처리");
    return {
      nationalPension: { required: false, reason: "선택월 근무 없음" },
      healthInsurance: { required: false, reason: "선택월 근무 없음" },
      employmentInsurance: { required: true, reason: "일용근로자 당연 적용" },
      industrialAccident: { required: true, reason: "모든 근로자 당연 적용" },
    };
  }

  // 국민연금 판단 로직
  if (age > 60) {
    status.nationalPension.required = false;
    status.nationalPension.reason = "60세 초과";
  } else {
    if (monthlyWage >= 2200000) {
      status.nationalPension.required = true;
      status.nationalPension.reason = "월급여 220만원 이상";
    } else if (currentMonthWorkHours >= 60) {
      status.nationalPension.required = true;
      status.nationalPension.reason = "월 60시간 이상 근무";
    } else if (currentMonthWorkDays >= 8) {
      status.nationalPension.required = true;
      status.nationalPension.reason = "월 8일 이상 근무";
    } else {
      status.nationalPension.required = false;
      status.nationalPension.reason = "월 60시간 미만, 월 8일 미만 근무, 월급여 220만원 미만";
    }
  }

  // 건강보험 판단 로직
  if (currentMonthWorkHours >= 60) {
    status.healthInsurance.required = true;
    status.healthInsurance.reason = "월 60시간 이상 근무";
  } else {
    status.healthInsurance.required = false;
    status.healthInsurance.reason = "월 60시간 미만 근무";
  }

  // Employment Insurance (fixed for daily workers)
  status.employmentInsurance.required = true;
  status.employmentInsurance.reason = age >= 65 ? "65세 이상 특례 적용" : "일용근로자 당연 적용";
  console.log("보험 계산 결과:", status);
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
