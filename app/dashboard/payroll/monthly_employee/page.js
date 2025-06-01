//file: app/dashboard/reports/payroll/monthly_employee/page.js
// worker 테이블 work_type: contract or permernent
// 월급받는 근로자 급여 테이블블
// 디비가 payroll임
"use client";
import { useState, useEffect } from "react";

export default function PayrollManagement() {
  const [yearMonth, setYearMonth] = useState("2025-05");
  const [selectedSite, setSelectedSite] = useState("1");
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeductionModal, setShowDeductionModal] = useState(false);

  // 근로자 데이터
  const workers = [
    {
      id: "1001",
      name: "김철수",
      job: "목수",
      workDays: 22,
      workHours: 176,
      baseSalary: 3200000,
      overtimePay: 320000,
      nightPay: 160000,
      holidayPay: 240000,
      mealAllowance: 150000,
      specialBonus: 0,
      incomeTax: 120000,
      nationalPension: 135000,
      healthInsurance: 98000,
      employmentInsurance: 34000,
      longTermCare: 12000,
    },
    {
      id: "1002",
      name: "이영희",
      job: "미장공",
      workDays: 20,
      workHours: 160,
      baseSalary: 2800000,
      overtimePay: 200000,
      nightPay: 0,
      holidayPay: 180000,
      mealAllowance: 150000,
      specialBonus: 300000,
      incomeTax: 98000,
      nationalPension: 121000,
      healthInsurance: 87000,
      employmentInsurance: 30000,
      longTermCare: 10000,
    },
    {
      id: "1003",
      name: "박민수",
      job: "전기공",
      workDays: 21,
      workHours: 168,
      baseSalary: 3000000,
      overtimePay: 280000,
      nightPay: 120000,
      holidayPay: 0,
      mealAllowance: 150000,
      specialBonus: 0,
      incomeTax: 105000,
      nationalPension: 126000,
      healthInsurance: 92000,
      employmentInsurance: 32000,
      longTermCare: 11000,
    },
  ];

  // 사이트 목록
  const sites = [
    { id: "1", name: "신도림 아파트 신축공사" },
    { id: "2", name: "강남역 복합상가 리모델링" },
    { id: "3", name: "판교 오피스빌딩 신축" },
  ];

  // 계산된 합계 및 요약 정보
  const calculateTotals = () => {
    return workers.reduce(
      (totals, worker) => {
        // 지급 항목 합계
        const totalPayment =
          worker.baseSalary +
          worker.overtimePay +
          worker.nightPay +
          worker.holidayPay +
          worker.mealAllowance +
          worker.specialBonus;

        // 공제 항목 합계
        const totalDeduction =
          worker.incomeTax +
          worker.nationalPension +
          worker.healthInsurance +
          worker.employmentInsurance +
          worker.longTermCare;

        // 실지급액
        const netPayment = totalPayment - totalDeduction;

        // 각 항목별 누적
        return {
          totalWorkers: totals.totalWorkers + 1,
          totalPayment: totals.totalPayment + totalPayment,
          totalDeduction: totals.totalDeduction + totalDeduction,
          totalNetPayment: totals.totalNetPayment + netPayment,
          totalBaseSalary: totals.totalBaseSalary + worker.baseSalary,
          totalOvertimePay: totals.totalOvertimePay + worker.overtimePay,
          totalNightPay: totals.totalNightPay + worker.nightPay,
          totalHolidayPay: totals.totalHolidayPay + worker.holidayPay,
          totalMealAllowance: totals.totalMealAllowance + worker.mealAllowance,
          totalSpecialBonus: totals.totalSpecialBonus + worker.specialBonus,
          totalIncomeTax: totals.totalIncomeTax + worker.incomeTax,
          totalNationalPension: totals.totalNationalPension + worker.nationalPension,
          totalHealthInsurance: totals.totalHealthInsurance + worker.healthInsurance,
          totalEmploymentInsurance: totals.totalEmploymentInsurance + worker.employmentInsurance,
          totalLongTermCare: totals.totalLongTermCare + worker.longTermCare,
        };
      },
      {
        totalWorkers: 0,
        totalPayment: 0,
        totalDeduction: 0,
        totalNetPayment: 0,
        totalBaseSalary: 0,
        totalOvertimePay: 0,
        totalNightPay: 0,
        totalHolidayPay: 0,
        totalMealAllowance: 0,
        totalSpecialBonus: 0,
        totalIncomeTax: 0,
        totalNationalPension: 0,
        totalHealthInsurance: 0,
        totalEmploymentInsurance: 0,
        totalLongTermCare: 0,
      }
    );
  };

  const totals = calculateTotals();

  // 현재 날짜로 yearMonth 초기화
  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    setYearMonth(`${year}-${month}`);
  }, []);

  // 포맷 함수 - 숫자를 천 단위 쉼표가 있는 문자열로 변환
  const formatNumber = (number) => {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };

  // 각 근로자의 지급 합계, 공제 합계, 실지급액 계산
  const calculateWorkerTotals = (worker) => {
    const totalPayment =
      worker.baseSalary +
      worker.overtimePay +
      worker.nightPay +
      worker.holidayPay +
      worker.mealAllowance +
      worker.specialBonus;

    const totalDeduction =
      worker.incomeTax +
      worker.nationalPension +
      worker.healthInsurance +
      worker.employmentInsurance +
      worker.longTermCare;

    const netPayment = totalPayment - totalDeduction;

    return { totalPayment, totalDeduction, netPayment };
  };

  // 인쇄 기능
  const handlePrint = () => {
    window.print();
  };

  // CSS 스타일 - 모바일 반응형 및 인쇄를 위한 스타일
  const styles = {
    stickyHeader: {
      position: "sticky",
      top: 0,
      backgroundColor: "#ffffff",
      zIndex: 10,
    },
    printHidden: {
      "@media print": {
        display: "none",
      },
    },
  };

  return (
    <div className="w-full bg-gray-50">
      <div className="w-full  mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">건설 현장 근로자 급여 관리</h1>

          {/* 컨트롤 패널 */}
          <div className="bg-white p-4 rounded-lg shadow-md mb-6 no-print">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div>
                  <label htmlFor="year-month" className="block text-sm font-medium text-gray-700">
                    급여 년월:
                  </label>
                  <input
                    type="month"
                    id="year-month"
                    name="year-month"
                    value={yearMonth}
                    onChange={(e) => setYearMonth(e.target.value)}
                    className="mt-1 block w-40 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label htmlFor="site-select" className="block text-sm font-medium text-gray-700">
                    현장 선택:
                  </label>
                  <select
                    id="site-select"
                    name="site-select"
                    value={selectedSite}
                    onChange={(e) => setSelectedSite(e.target.value)}
                    className="mt-1 block w-48 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                  >
                    {sites.map((site) => (
                      <option key={site.id} value={site.id}>
                        {site.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowPaymentModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  부정기 지급 항목 추가
                </button>
                <button
                  onClick={() => setShowDeductionModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  공제 항목 추가
                </button>
                <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                  일괄 계산
                </button>
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  인쇄
                </button>
              </div>
            </div>
          </div>

          {/* 현장 정보 및 요약 */}
          <div className="bg-white p-4 rounded-lg shadow-md mb-6 border border-gray-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">현장 정보</h2>
                <p className="text-gray-700">
                  현장명: {sites.find((site) => site.id === selectedSite)?.name}
                </p>
                <p className="text-gray-700">담당자: 김현장</p>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">지급 요약</h2>
                <p className="text-gray-700">근로자 수: {totals.totalWorkers}명</p>
                <p className="text-gray-700">총 지급액: {formatNumber(totals.totalPayment)}원</p>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">공제 요약</h2>
                <p className="text-gray-700">총 공제액: {formatNumber(totals.totalDeduction)}원</p>
                <p className="text-gray-700">순 지급액: {formatNumber(totals.totalNetPayment)}원</p>
              </div>
            </div>
          </div>
        </header>

        {/* 급여 데이터 테이블 */}
        <div className="overflow-x-auto bg-white rounded-lg shadow-md">
          <table className="min-w-full border-collapse border border-gray-300">
            <thead className="bg-white sticky-header">
              <tr>
                <th
                  colSpan={5}
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300"
                >
                  근로자 정보
                </th>
                <th
                  colSpan={7}
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300"
                >
                  지급 항목
                </th>
                <th
                  colSpan={6}
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300"
                >
                  공제 항목
                </th>
                <th
                  colSpan={2}
                  className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300"
                >
                  결과
                </th>
              </tr>
              <tr>
                {/* 근로자 정보 헤더 */}
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                  ID
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                  이름
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                  직종
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                  근무일수
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                  근무시간
                </th>

                {/* 지급 항목 헤더 */}
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                  기본급
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                  연장수당
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                  야간수당
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                  휴일수당
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                  식대
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                  특별상여
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                  지급 합계
                </th>

                {/* 공제 항목 헤더 */}
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                  소득세
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                  국민연금
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                  건강보험
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                  고용보험
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                  장기요양
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                  공제 합계
                </th>

                {/* 결과 헤더 */}
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300">
                  실지급액
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-300 no-print">
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {workers.map((worker) => {
                const { totalPayment, totalDeduction, netPayment } = calculateWorkerTotals(worker);

                return (
                  <tr key={worker.id}>
                    {/* 근로자 정보 */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                      {worker.id}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border border-gray-300">
                      {worker.name}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                      {worker.job}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                      {worker.workDays}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                      {worker.workHours}
                    </td>

                    {/* 지급 항목 */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                      {formatNumber(worker.baseSalary)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                      {formatNumber(worker.overtimePay)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                      {formatNumber(worker.nightPay)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                      {formatNumber(worker.holidayPay)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                      {formatNumber(worker.mealAllowance)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                      {formatNumber(worker.specialBonus)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-semibold text-green-600 border border-gray-300">
                      {formatNumber(totalPayment)}
                    </td>

                    {/* 공제 항목 */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                      {formatNumber(worker.incomeTax)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                      {formatNumber(worker.nationalPension)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                      {formatNumber(worker.healthInsurance)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                      {formatNumber(worker.employmentInsurance)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900 border border-gray-300">
                      {formatNumber(worker.longTermCare)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-semibold text-red-600 border border-gray-300">
                      {formatNumber(totalDeduction)}
                    </td>

                    {/* 결과 */}
                    <td className="px-3 py-4 whitespace-nowrap text-sm font-semibold text-indigo-600 border border-gray-300">
                      {formatNumber(netPayment)}
                    </td>
                    <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-500 border border-gray-300 no-print">
                      <button className="text-indigo-600 hover:text-indigo-900 mr-2">편집</button>
                      <button className="text-gray-500 hover:text-gray-700">명세서</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-white">
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-3 text-right text-sm font-semibold text-gray-900 border border-gray-300"
                >
                  합계
                </td>
                <td className="px-3 py-3 text-sm font-semibold text-gray-900 border border-gray-300">
                  {formatNumber(totals.totalBaseSalary)}
                </td>
                <td className="px-3 py-3 text-sm font-semibold text-gray-900 border border-gray-300">
                  {formatNumber(totals.totalOvertimePay)}
                </td>
                <td className="px-3 py-3 text-sm font-semibold text-gray-900 border border-gray-300">
                  {formatNumber(totals.totalNightPay)}
                </td>
                <td className="px-3 py-3 text-sm font-semibold text-gray-900 border border-gray-300">
                  {formatNumber(totals.totalHolidayPay)}
                </td>
                <td className="px-3 py-3 text-sm font-semibold text-gray-900 border border-gray-300">
                  {formatNumber(totals.totalMealAllowance)}
                </td>
                <td className="px-3 py-3 text-sm font-semibold text-gray-900 border border-gray-300">
                  {formatNumber(totals.totalSpecialBonus)}
                </td>
                <td className="px-3 py-3 text-sm font-semibold text-green-600 border border-gray-300">
                  {formatNumber(totals.totalPayment)}
                </td>

                <td className="px-3 py-3 text-sm font-semibold text-gray-900 border border-gray-300">
                  {formatNumber(totals.totalIncomeTax)}
                </td>
                <td className="px-3 py-3 text-sm font-semibold text-gray-900 border border-gray-300">
                  {formatNumber(totals.totalNationalPension)}
                </td>
                <td className="px-3 py-3 text-sm font-semibold text-gray-900 border border-gray-300">
                  {formatNumber(totals.totalHealthInsurance)}
                </td>
                <td className="px-3 py-3 text-sm font-semibold text-gray-900 border border-gray-300">
                  {formatNumber(totals.totalEmploymentInsurance)}
                </td>
                <td className="px-3 py-3 text-sm font-semibold text-gray-900 border border-gray-300">
                  {formatNumber(totals.totalLongTermCare)}
                </td>
                <td className="px-3 py-3 text-sm font-semibold text-red-600 border border-gray-300">
                  {formatNumber(totals.totalDeduction)}
                </td>

                <td className="px-3 py-3 text-sm font-semibold text-indigo-600 border border-gray-300">
                  {formatNumber(totals.totalNetPayment)}
                </td>
                <td className="px-3 py-3 text-sm text-gray-500 border border-gray-300 no-print">
                  -
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* 모달 - 부정기 지급 항목 추가 */}
      {showPaymentModal && (
        <div className="fixed inset-0 overflow-y-auto z-50">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
              &#8203;
            </span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      부정기 지급 항목 추가
                    </h3>
                    <div className="mt-4 space-y-4">
                      <div>
                        <label
                          htmlFor="payment-name"
                          className="block text-sm font-medium text-gray-700"
                        >
                          항목명
                        </label>
                        <input
                          type="text"
                          name="payment-name"
                          id="payment-name"
                          className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          placeholder="예: 명절상여금, 성과급"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="payment-amount"
                          className="block text-sm font-medium text-gray-700"
                        >
                          지급 금액
                        </label>
                        <input
                          type="number"
                          name="payment-amount"
                          id="payment-amount"
                          className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          placeholder="금액"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="payment-desc"
                          className="block text-sm font-medium text-gray-700"
                        >
                          설명 (선택사항)
                        </label>
                        <textarea
                          id="payment-desc"
                          name="payment-desc"
                          rows="3"
                          className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          placeholder="항목에 대한 설명"
                        ></textarea>
                      </div>
                      <div>
                        <label
                          htmlFor="payment-workers"
                          className="block text-sm font-medium text-gray-700"
                        >
                          적용 대상
                        </label>
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center">
                            <input
                              id="all-workers"
                              name="payment-workers"
                              type="radio"
                              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                              defaultChecked
                            />
                            <label
                              htmlFor="all-workers"
                              className="ml-3 block text-sm font-medium text-gray-700"
                            >
                              전체 근로자
                            </label>
                          </div>
                          <div className="flex items-center">
                            <input
                              id="select-workers"
                              name="payment-workers"
                              type="radio"
                              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                            />
                            <label
                              htmlFor="select-workers"
                              className="ml-3 block text-sm font-medium text-gray-700"
                            >
                              선택한 근로자
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  추가
                </button>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 모달 - 공제 항목 추가 */}
      {showDeductionModal && (
        <div className="fixed inset-0 overflow-y-auto z-50">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
              &#8203;
            </span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                      공제 항목 추가
                    </h3>
                    <div className="mt-4 space-y-4">
                      <div>
                        <label
                          htmlFor="deduction-name"
                          className="block text-sm font-medium text-gray-700"
                        >
                          항목명
                        </label>
                        <input
                          type="text"
                          name="deduction-name"
                          id="deduction-name"
                          className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          placeholder="예: 상조회비, 사내대출상환금"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="deduction-amount"
                          className="block text-sm font-medium text-gray-700"
                        >
                          공제 금액
                        </label>
                        <input
                          type="number"
                          name="deduction-amount"
                          id="deduction-amount"
                          className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          placeholder="금액"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="deduction-desc"
                          className="block text-sm font-medium text-gray-700"
                        >
                          설명 (선택사항)
                        </label>
                        <textarea
                          id="deduction-desc"
                          name="deduction-desc"
                          rows="3"
                          className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                          placeholder="항목에 대한 설명"
                        ></textarea>
                      </div>
                      <div>
                        <label
                          htmlFor="deduction-workers"
                          className="block text-sm font-medium text-gray-700"
                        >
                          적용 대상
                        </label>
                        <div className="mt-2 space-y-2">
                          <div className="flex items-center">
                            <input
                              id="all-workers-deduction"
                              name="deduction-workers"
                              type="radio"
                              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                              defaultChecked
                            />
                            <label
                              htmlFor="all-workers-deduction"
                              className="ml-3 block text-sm font-medium text-gray-700"
                            >
                              전체 근로자
                            </label>
                          </div>
                          <div className="flex items-center">
                            <input
                              id="select-workers-deduction"
                              name="deduction-workers"
                              type="radio"
                              className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-gray-300"
                            />
                            <label
                              htmlFor="select-workers-deduction"
                              className="ml-3 block text-sm font-medium text-gray-700"
                            >
                              선택한 근로자
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  추가
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeductionModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 인쇄 스타일 - Next.js에서는 styled-jsx나 global style을 사용할 수 있습니다 */}
      <style jsx global>{`
        .sticky-header th {
          position: sticky;
          top: 0;
          background-color: #ffffff;
          z-index: 10;
        }
        @media print {
          .no-print {
            display: none;
          }
          body {
            font-size: 11px;
          }
        }
      `}</style>
    </div>
  );
}
