// lib/utils/systemSettings.js

import { supabase } from "@/lib/supabase";

/**
 * 현재 유효한 설정 값 가져오기
 *
 * @param {string} category - 설정 카테고리 (예: 'tax_rate', 'insurance_rate', 'deduction_limit' 등)
 * @param {string} key - 설정 키 (카테고리 내 고유한 설정 이름)
 * @param {Date} [date=new Date()] - 특정 날짜에 유효한 설정을 가져오기 위한 기준일
 * @returns {Promise<string|number|null>} 설정 값 (숫자형으로 변환 가능한 경우 숫자로 반환)
 */
export const getSystemSetting = async (category, key, date = new Date()) => {
  try {
    const formattedDate = date.toISOString().split("T")[0]; // YYYY-MM-DD 형식

    const { data, error } = await supabase
      .from("system_settings")
      .select("setting_value, effective_from")
      .eq("setting_category", category)
      .eq("setting_key", key)
      .lte("effective_from", formattedDate)
      .or(`effective_to.is.null,effective_to.gte.${formattedDate}`)
      .order("effective_from", { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      // 숫자 형식이면 숫자로 변환
      const value = data[0].setting_value;
      if (!isNaN(value)) {
        return parseFloat(value);
      }
      return value;
    }

    // 기본값 정의 (설정이 없는 경우 사용)
    const defaults = {
      // 소득세 관련
      income_tax_rate: 0.06, // 일용근로자 기본 소득세율 6%
      local_income_tax_rate: 0.1, // 지방소득세율 (소득세의 10%)
      income_tax_reduction_rate: 0.45, // 소득세 감면율 (55% 감면 = 45% 적용)
      minimum_tax_exemption: 1000, // 소액부징수 기준액 (1,000원 미만)

      // 공제 한도 관련
      daily_income_deduction: 150000, // 일용근로자 1일 근로소득공제 한도 (15만원)

      // 국민연금 관련
      national_pension_employee_rate: 0.045, // 국민연금 근로자 부담 요율 (4.5%)
      national_pension_min_income: 390000, // 국민연금 기준 소득월액 하한액
      national_pension_max_income: 6170000, // 국민연금 기준 소득월액 상한액

      // 건강보험 관련
      health_insurance_employee_rate: 0.03545, // 건강보험 근로자 부담 요율 (3.545%)
      long_term_care_employee_rate: 0.004591, // 장기요양보험 근로자 부담 요율 (0.4591%)
      health_insurance_min_income: 279266, // 건강보험 보수월액 하한액
      health_insurance_max_income: 127056982, // 건강보험 보수월액 상한액

      // 고용보험 관련
      employment_insurance_unemployment_employee: 0.009, // 실업급여 근로자 부담 요율 (0.9%)

      // 산재보험 관련
      industrial_accident_commute: 0.006, // 출퇴근재해 보험료율 (0.6%)
      industrial_accident_construction: 0.035, // 건설업 산재보험료율 (3.5%)

      // 보험 적용 기준 관련
      work_days_threshold: 8, // 보험 적용 근무일수 기준 (8일)
      work_hours_threshold: 60, // 보험 적용 근무시간 기준 (60시간)
      national_pension_age_limit: 60, // 국민연금 연령 상한 (60세)
      national_pension_wage_threshold: 2200000, // 국민연금 급여 기준 (220만원)
      employment_insurance_age_limit: 65, // 고용보험 특례 연령 기준 (65세)
    };

    return defaults[key] || null;
  } catch (error) {
    console.error(`설정 조회 오류 (${category}.${key}):`, error);
    return null;
  }
};

/**
 * 여러 설정을 한 번에 가져오기
 *
 * @param {Array<{category: string, key: string}>} settingsConfig - 가져올 설정 목록
 * @param {Date} [date=new Date()] - 설정 적용 기준일
 * @returns {Promise<Object>} 설정 값으로 구성된 객체
 */
export const getSystemSettings = async (settingsConfig, date = new Date()) => {
  try {
    const settings = {};

    // settingsConfig = [{ category: 'tax_rate', key: 'income_tax_rate' }, ...]
    for (const config of settingsConfig) {
      const value = await getSystemSetting(config.category, config.key, date);

      // 결과를 중첩 객체로 구성 (category.key 형태)
      if (!settings[config.category]) {
        settings[config.category] = {};
      }
      settings[config.category][config.key] = value;
    }

    return settings;
  } catch (error) {
    console.error("설정 일괄 조회 오류:", error);
    return {};
  }
};

/**
 * 계산에 필요한 모든 요율 한 번에 가져오기
 *
 * @param {Date} [date=new Date()] - 설정 적용 기준일
 * @returns {Promise<Object>} 모든 세율, 보험요율 등을 포함한 객체
 */
export const getAllRates = async (date = new Date()) => {
  // 필요한 모든 설정 목록
  const settingsConfig = [
    // 소득세 관련
    { category: "tax_rate", key: "income_tax_rate" }, // 일용근로자 기본 소득세율
    { category: "tax_rate", key: "local_income_tax_rate" }, // 지방소득세율
    { category: "tax_rate", key: "income_tax_reduction_rate" }, // 소득세 감면율
    { category: "tax_rate", key: "minimum_tax_exemption" }, // 소액부징수 기준액

    // 공제 한도 관련
    { category: "deduction_limit", key: "daily_income_deduction" }, // 일당 소득공제 한도

    // 국민연금 관련
    { category: "insurance_rate", key: "national_pension_employee_rate" }, // 국민연금 근로자 요율
    { category: "insurance_criteria", key: "national_pension_min_income" }, // 국민연금 하한액
    { category: "insurance_criteria", key: "national_pension_max_income" }, // 국민연금 상한액

    // 건강보험 관련
    { category: "insurance_rate", key: "health_insurance_employee_rate" }, // 건강보험 근로자 요율
    { category: "insurance_rate", key: "long_term_care_employee_rate" }, // 장기요양보험 근로자 요율
    { category: "insurance_criteria", key: "health_insurance_min_income" }, // 건강보험 하한액
    { category: "insurance_criteria", key: "health_insurance_max_income" }, // 건강보험 상한액

    // 고용보험 관련
    { category: "insurance_rate", key: "employment_insurance_unemployment_employee" }, // 고용보험 근로자 요율

    // 보험 적용 기준 관련
    { category: "insurance_criteria", key: "work_days_threshold" }, // 보험 적용 근무일수 기준
    { category: "insurance_criteria", key: "work_hours_threshold" }, // 보험 적용 근무시간 기준
    { category: "insurance_criteria", key: "national_pension_age_limit" }, // 국민연금 연령 상한
    { category: "insurance_criteria", key: "national_pension_wage_threshold" }, // 국민연금 급여 기준
    { category: "insurance_criteria", key: "employment_insurance_age_limit" }, // 고용보험 특례 연령 기준
  ];

  return await getSystemSettings(settingsConfig, date);
};

/**
 * 캐싱된 시스템 설정 가져오기 (클라이언트에서만 사용 가능)
 *
 * @param {Date} [date=new Date()] - 설정 적용 기준일
 * @returns {Promise<Object>} 캐싱된 설정 값
 */
export const getCachedSystemSettings = async (date = new Date()) => {
  // 브라우저 환경에서만 작동
  if (typeof window === "undefined") {
    return await getAllRates(date);
  }

  const cacheKey = "system_settings_cache";
  const cacheExpiry = "system_settings_expiry";

  // 캐시 확인
  const cachedData = localStorage.getItem(cacheKey);
  const expiryTime = localStorage.getItem(cacheExpiry);

  if (cachedData && expiryTime && new Date().getTime() < parseInt(expiryTime)) {
    return JSON.parse(cachedData);
  }

  // 캐시 만료 또는 없을 경우 새로 로드
  const settings = await getAllRates(date);

  // 1시간 캐싱
  const expiry = new Date().getTime() + 60 * 60 * 1000;
  localStorage.setItem(cacheKey, JSON.stringify(settings));
  localStorage.setItem(cacheExpiry, expiry.toString());

  return settings;
};

/**
 * 특정 업종의 산재보험 요율 가져오기
 *
 * @param {string} industryCode - 업종코드
 * @param {Date} [date=new Date()] - 설정 적용 기준일
 * @returns {Promise<number|null>} 산재보험 요율
 */
export const getIndustryInsuranceRate = async (industryCode, date = new Date()) => {
  try {
    const formattedDate = date.toISOString().split("T")[0]; // YYYY-MM-DD 형식

    const { data, error } = await supabase
      .from("industry_insurance_rates")
      .select("rate")
      .eq("industry_code", industryCode)
      .eq("insurance_type", "industrial_accident")
      .lte("effective_from", formattedDate)
      .or(`effective_to.is.null,effective_to.gte.${formattedDate}`)
      .order("effective_from", { ascending: false })
      .limit(1);

    if (error) throw error;

    if (data && data.length > 0) {
      return parseFloat(data[0].rate);
    }

    // 기본 산재보험 요율 (건설업 기준)
    return 0.035; // 3.5%
  } catch (error) {
    console.error(`업종별 산재보험 요율 조회 오류 (${industryCode}):`, error);
    return null;
  }
};
