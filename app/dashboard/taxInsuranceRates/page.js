"use client";

import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

// 실제 구현에서는 import { getAllRates } from "@/lib/utils/systemSettings"; 형태로 사용
// 데모를 위한 임시 함수
const getAllRates = async (date) => {
  // 실제 데이터 구조를 시뮬레이션
  return {
    tax_rate: {
      income_tax_rate: 0.06, // 일용근로자 기본 소득세율 6%
      local_income_tax_rate: 0.1, // 지방소득세율 (소득세의 10%)
      income_tax_reduction_rate: 0.45, // 소득세 감면율 (55% 감면 = 45% 적용)
      minimum_tax_exemption: 1000, // 소액부징수 기준액 (1,000원 미만)
    },
    deduction_limit: {
      daily_income_deduction: 150000, // 일용근로자 1일 근로소득공제 한도 (15만원)
    },
    insurance_rate: {
      national_pension_employee_rate: 0.045, // 국민연금 근로자 부담 요율 (4.5%)
      health_insurance_employee_rate: 0.03545, // 건강보험 근로자 부담 요율 (3.545%)
      long_term_care_employee_rate: 0.004591, // 장기요양보험 근로자 부담 요율 (0.4591%)
      employment_insurance_unemployment_employee: 0.009, // 실업급여 근로자 부담 요율 (0.9%)
    },
    insurance_criteria: {
      national_pension_min_income: 390000, // 국민연금 기준 소득월액 하한액
      national_pension_max_income: 6170000, // 국민연금 기준 소득월액 상한액
      health_insurance_min_income: 279266, // 건강보험 보수월액 하한액
      health_insurance_max_income: 127056982, // 건강보험 보수월액 상한액
      work_days_threshold: 8, // 보험 적용 근무일수 기준 (8일)
      work_hours_threshold: 60, // 보험 적용 근무시간 기준 (60시간)
      national_pension_age_limit: 60, // 국민연금 연령 상한 (60세)
      national_pension_wage_threshold: 2200000, // 국민연금 급여 기준 (220만원)
      employment_insurance_age_limit: 65, // 고용보험 특례 연령 기준 (65세)
    },
  };
};

// 산재보험 업종별 요율 목록 (데모용 데이터)
const industryRates = [
  { industry_code: "41", industry_name: "건설업", rate: 0.035 },
  { industry_code: "42", industry_name: "건물건설업", rate: 0.037 },
  { industry_code: "43", industry_name: "토목건설업", rate: 0.039 },
  { industry_code: "45", industry_name: "전기공사업", rate: 0.013 },
  { industry_code: "46", industry_name: "정보통신공사업", rate: 0.009 },
  { industry_code: "47", industry_name: "소방시설공사업", rate: 0.011 },
  { industry_code: "48", industry_name: "전문직별공사업", rate: 0.025 },
];

const TaxInsuranceRatesPage = () => {
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("tax");
  const [dateValue, setDateValue] = useState(new Date().toISOString().split("T")[0]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRates = async () => {
      try {
        setLoading(true);
        const data = await getAllRates(new Date(dateValue));
        setRates(data);
        setError(null);
      } catch (err) {
        setError("요율 정보를 불러오는 데 실패했습니다.");
        console.error("Error fetching rates:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRates();
  }, [dateValue]);

  // 숫자 형식화 함수
  const formatNumber = (value, isPercent = false) => {
    if (value == null) return "-";

    if (isPercent) {
      return `${(value * 100).toFixed(4).replace(/\.?0+$/, "")}%`;
    }

    return new Intl.NumberFormat("ko-KR").format(value);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">보험요율 및 세율 정보</h1>

      {/* 기준일자 선택 */}
      <div className="mb-6">
        <label htmlFor="date-select" className="block text-sm font-medium text-gray-700 mb-2">
          기준일자
        </label>
        <div className="flex items-center">
          <input
            type="date"
            id="date-select"
            value={dateValue}
            onChange={(e) => setDateValue(e.target.value)}
            className="border border-gray-300 rounded-md p-2 w-48"
          />
          <span className="ml-3 text-sm text-gray-600">
            {dateValue && format(new Date(dateValue), "yyyy년 M월 d일", { locale: ko })} 기준
          </span>
        </div>
      </div>

      {/* 탭 메뉴 */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === "tax"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("tax")}
        >
          소득세
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === "pension"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("pension")}
        >
          국민연금
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === "health"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("health")}
        >
          건강보험
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === "employment"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("employment")}
        >
          고용보험
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === "industrial"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("industrial")}
        >
          산재보험
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm ${
            activeTab === "criteria"
              ? "text-blue-600 border-b-2 border-blue-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("criteria")}
        >
          적용기준
        </button>
      </div>

      {/* 소득세 */}
      {activeTab === "tax" && rates?.tax_rate && (
        <div className="bg-white rounded-lg overflow-hidden">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">소득세 및 공제 관련 요율</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    항목
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    설명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    값
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    일용근로자 소득세율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    일용근로자에게 적용되는 기본 소득세율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(rates.tax_rate.income_tax_rate, true)}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    지방소득세율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    소득세액에 대한 지방소득세 비율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(rates.tax_rate.local_income_tax_rate, true)}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    근로소득세액공제
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    일용근로자 근로소득공제 (1-55% 감면)
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(rates.tax_rate.income_tax_reduction_rate, true)}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    소액부징수 기준액
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    이 금액 미만인 경우 소득세 징수하지 않음
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(rates.tax_rate.minimum_tax_exemption)}원
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    일용근로자 일일 소득공제액
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    일용근로자 1일당 근로소득공제 한도
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(rates.deduction_limit.daily_income_deduction)}원
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-md">
            <h3 className="font-medium text-blue-800 mb-2">일용근로자 소득세 계산 방법</h3>
            <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
              <li>일용근로소득 = 일당 - 일일 소득공제액 (공제액 초과분)</li>
              <li>소득세 = 일용근로소득 × 6% × 55%(감면율)</li>
              <li>지방소득세 = 소득세 × 10%</li>
              <li>공제세액 = 소득세 + 지방소득세</li>
              <li>1,000원 미만 소액 공제세액은 부징수</li>
            </ol>
          </div>
        </div>
      )}

      {/* 국민연금 */}
      {activeTab === "pension" && rates?.insurance_rate && rates?.insurance_criteria && (
        <div className="bg-white rounded-lg overflow-hidden">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">국민연금 요율 및 기준</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    항목
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    설명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    값
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    국민연금 근로자 부담 요율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    월 소득액에 적용되는 근로자 부담 요율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(rates.insurance_rate.national_pension_employee_rate, true)}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    국민연금 사업주 부담 요율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    월 소득액에 적용되는 사업주 부담 요율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(rates.insurance_rate.national_pension_employee_rate, true)}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    최저 기준소득월액
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    국민연금 보험료 산정의 하한선
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(rates.insurance_criteria.national_pension_min_income)}원
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    최고 기준소득월액
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    국민연금 보험료 산정의 상한선
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(rates.insurance_criteria.national_pension_max_income)}원
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    적용 연령 상한
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    국민연금이 적용되는 최대 연령
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {rates.insurance_criteria.national_pension_age_limit}세
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-md">
            <h3 className="font-medium text-blue-800 mb-2">국민연금 보험료 계산 방법</h3>
            <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
              <li>국민연금 보험료 = 기준소득월액 × 9.0% (근로자 4.5% + 사업주 4.5%)</li>
              <li>기준소득월액은 최저 39만원에서 최고 617만원 사이에서 결정</li>
              <li>월 8일 이상 또는 월 60시간 이상 근무 시 사업장가입자로 적용</li>
              <li>국민연금은 60세 미만인 경우에만 적용</li>
            </ol>
          </div>
        </div>
      )}

      {/* 건강보험 */}
      {activeTab === "health" && rates?.insurance_rate && rates?.insurance_criteria && (
        <div className="bg-white rounded-lg overflow-hidden">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">건강보험 요율 및 기준</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    항목
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    설명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    값
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    건강보험 근로자 부담 요율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    월 보수월액에 적용되는 근로자 부담 요율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(rates.insurance_rate.health_insurance_employee_rate, true)}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    건강보험 사업주 부담 요율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    월 보수월액에 적용되는 사업주 부담 요율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(rates.insurance_rate.health_insurance_employee_rate, true)}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    장기요양보험 근로자 부담 요율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    건강보험료에 추가 적용되는 요율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(rates.insurance_rate.long_term_care_employee_rate, true)}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    장기요양보험 사업주 부담 요율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    건강보험료에 추가 적용되는 요율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(rates.insurance_rate.long_term_care_employee_rate, true)}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    최저 보수월액
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    건강보험료 산정의 하한선
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(rates.insurance_criteria.health_insurance_min_income)}원
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    최고 보수월액
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    건강보험료 산정의 상한선
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(rates.insurance_criteria.health_insurance_max_income)}원
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-md">
            <h3 className="font-medium text-blue-800 mb-2">건강보험료 계산 방법</h3>
            <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
              <li>건강보험료 = 보수월액 × 7.09% (근로자 3.545% + 사업주 3.545%)</li>
              <li>장기요양보험료 = 건강보험료 × 12.81% (근로자와 사업주 각각 50% 부담)</li>
              <li>월 8일 이상 또는 월 60시간 이상 근무 시 직장가입자로 적용</li>
            </ol>
          </div>
        </div>
      )}

      {/* 고용보험 */}
      {activeTab === "employment" && rates?.insurance_rate && rates?.insurance_criteria && (
        <div className="bg-white rounded-lg overflow-hidden">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">고용보험 요율 및 기준</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    항목
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    설명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    값
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    실업급여 근로자 부담 요율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    월 보수월액에 적용되는 근로자 부담 요율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(
                      rates.insurance_rate.employment_insurance_unemployment_employee,
                      true
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    실업급여 사업주 부담 요율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    월 보수월액에 적용되는 사업주 부담 요율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatNumber(
                      rates.insurance_rate.employment_insurance_unemployment_employee,
                      true
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    고용안정/직업능력개발 요율
                    <br />
                    (150인 미만 기업)
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    사업주만 부담하는 요율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">0.25%</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    고용안정/직업능력개발 요율
                    <br />
                    (150인 이상 우선지원대상기업)
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    사업주만 부담하는 요율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">0.45%</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    고용안정/직업능력개발 요율
                    <br />
                    (150인 이상 ~ 1,000인 미만)
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    사업주만 부담하는 요율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">0.65%</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    고용안정/직업능력개발 요율
                    <br />
                    (1,000인 이상)
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    사업주만 부담하는 요율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">0.85%</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    고용보험 65세 이상 특례 기준
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    65세 이상 근로자 고용보험 적용 기준
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {rates.insurance_criteria.employment_insurance_age_limit}세
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-md">
            <h3 className="font-medium text-blue-800 mb-2">고용보험료 계산 방법</h3>
            <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
              <li>실업급여 보험료 = 월 보수액 × 1.8% (근로자 0.9% + 사업주 0.9%)</li>
              <li>고용안정/직업능력개발 보험료 = 월 보수액 × 사업장 규모별 요율 (사업주만 부담)</li>
              <li>일용근로자도 근무일수와 관계없이 고용보험 적용</li>
              <li>65세 이상 신규 취업자는 실업급여 제외, 고용안정/직업능력개발만 적용</li>
            </ol>
          </div>
        </div>
      )}

      {/* 산재보험 */}
      {activeTab === "industrial" && (
        <div className="bg-white rounded-lg overflow-hidden">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">산재보험 요율 및 기준</h2>

          <div className="mb-6">
            <h3 className="text-md font-medium mb-3 text-gray-700">산재보험 기본 정보</h3>
            <div className="p-4 bg-yellow-50 rounded-md text-sm text-yellow-800">
              <p className="mb-2">
                산재보험은 <strong>사업주가 전액 부담</strong>하는 보험으로, 업종별 위험도에 따라
                요율이 차등 적용됩니다.
              </p>
              <p>
                근로자의 업무상 재해를 보상하기 위한 제도로, <strong>모든 사업장</strong>과{" "}
                <strong>일용근로자</strong>에게 의무적으로 적용됩니다.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    업종코드
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    업종명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    산재보험 요율
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {industryRates.map((industry) => (
                  <tr key={industry.industry_code}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {industry.industry_code}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {industry.industry_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatNumber(industry.rate, true)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    공통
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    출퇴근재해 요율
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">0.6%</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-md">
            <h3 className="font-medium text-blue-800 mb-2">산재보험료 계산 방법</h3>
            <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
              <li>산재보험료 = 월 보수총액 × 해당 업종의 산재보험료율</li>
              <li>출퇴근재해 요율(0.6%)은 모든 업종에 공통 적용</li>
              <li>건설업의 경우 공사 규모와 종류에 따라 추가 요율 적용 가능</li>
              <li>산재보험료는 사업주가 전액 부담 (근로자 부담 없음)</li>
            </ol>
          </div>
        </div>
      )}

      {/* 적용기준 */}
      {activeTab === "criteria" && rates?.insurance_criteria && (
        <div className="bg-white rounded-lg overflow-hidden">
          <h2 className="text-lg font-semibold mb-4 text-gray-800">4대보험 적용 기준</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    항목
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    값
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    적용 보험
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    월 근무일수 기준
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {rates.insurance_criteria.work_days_threshold}일 이상
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    국민연금, 건강보험 (일용근로자가 사업장가입자로 적용되는 기준)
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    월 근무시간 기준
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {rates.insurance_criteria.work_hours_threshold}시간 이상
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    건강보험 (직장가입자 적용 기준)
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    국민연금 연령 상한
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {rates.insurance_criteria.national_pension_age_limit}세 미만
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    국민연금 (60세 이상은 적용 제외)
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    고용보험 연령 특례 기준
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {rates.insurance_criteria.employment_insurance_age_limit}세 이상
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    고용보험 (65세 이상 신규 취업자는 실업급여 제외)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-8">
            <h3 className="text-md font-medium mb-4 text-gray-700">
              보험별 일용근로자 적용 기준 비교
            </h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      보험 종류
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      적용 조건
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      근로자 부담
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      사업주 부담
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      국민연금
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      월 8일 이상 근무 시 사업장가입자
                      <br />
                      60세 미만인 경우에만 적용
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">4.5%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">4.5%</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      건강보험
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      월 8일 이상 또는
                      <br />월 60시간 이상 근무 시 직장가입자
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      3.545%
                      <br />
                      (장기요양 0.4591% 포함 시 총 4.0041%)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      3.545%
                      <br />
                      (장기요양 0.4591% 포함 시 총 4.0041%)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      고용보험
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      근무일수 상관없이 전체 적용
                      <br />
                      65세 이상 신규 취업자는 실업급여 제외
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      0.9% (실업급여만)
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      0.9% (실업급여)
                      <br />+ 0.25~0.85% (고용안정/직업능력개발)
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      산재보험
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      근무일수 상관없이 전체 적용
                      <br />
                      연령 제한 없음
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">없음</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      업종별 요율 (0.6%~18.5%)
                      <br />+ 출퇴근재해 0.6%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 기준일자 변경 안내 */}
      <div className="mt-8 p-4 bg-gray-50 rounded-md text-sm text-gray-600">
        <p>
          ※ 상기 요율 및 기준은{" "}
          {dateValue && format(new Date(dateValue), "yyyy년 M월 d일", { locale: ko })} 기준이며,
          법령 개정에 따라 변경될 수 있습니다.
        </p>
        <p>※ 정확한 최신 정보는 관련 공단 홈페이지에서 확인하시기 바랍니다.</p>
      </div>
    </div>
  );
};

export default TaxInsuranceRatesPage;
