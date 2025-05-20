//file: app\dashboard\reports\dailyWorkerGongdan\page.js
//일용노무비지급명세서
"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/store/authStore";
import RoleGuard from "@/components/RoleGuard";
import { supabase } from "@/lib/supabase";
import { toast } from "react-hot-toast";
// 공통 유틸리티 임포트
import {
  calculateWorkerTotals,
  formatNumber,
  formatResidentNumber,
  formatPhoneNumber,
} from "@/lib/utils/taxCalculations";
// 시스템 설정 임포트
import { getCachedSystemSettings } from "@/lib/utils/systemSettings";

function DailyWorkerGongdanPage() {
  // 기존 상태 변수들...
  const { user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSite, setSelectedSite] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(
    (new Date().getMonth() + 1).toString().padStart(2, "0")
  );
  const [sites, setSites] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [workRecords, setWorkRecords] = useState({});
  const [companyName, setCompanyName] = useState("");
  // 디버깅 관련 상태 추가
  const [showTaxCalculation, setShowTaxCalculation] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState(null);
  // 세율 정보 상태 추가
  const [taxRates, setTaxRates] = useState(null);
  const [hoveredWorkerId, setHoveredWorkerId] = useState(null);

  // 마우스 이벤트 핸들러 추가
  const handleMouseEnter = (workerId) => {
    setHoveredWorkerId(workerId);
  };

  const handleMouseLeave = () => {
    setHoveredWorkerId(null);
  };
  // 날짜 생성
  const getDaysInMonth = (year, month) => {
    return new Date(year, month, 0).getDate();
  };

  const daysInMonth = getDaysInMonth(parseInt(selectedYear), parseInt(selectedMonth));
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // 초기 데이터 로드
  useEffect(() => {
    if (user) {
      loadSites();
      loadTaxRates();
    }
  }, [user]);

  // 세율 정보 로드
  const loadTaxRates = async () => {
    try {
      // 현재 날짜를 기준으로 세율 정보 가져오기
      const date = new Date(`${selectedYear}-${selectedMonth}-01`);
      const rates = await getCachedSystemSettings(date);
      setTaxRates(rates);
      console.log("세율 정보 로드됨:", rates);
    } catch (error) {
      console.error("세율 정보 로드 오류:", error);
      toast.error("세율 정보를 불러오는 중 오류가 발생했습니다.");
    }
  };

  // 현장 변경 시 근로자 및 출역 데이터 로드
  useEffect(() => {
    if (selectedSite) {
      loadWorkers();
      loadWorkRecords();
      // 근로자 선택 초기화
      setSelectedWorkerId(null);
      setShowTaxCalculation(false);
    }
  }, [selectedSite, selectedYear, selectedMonth]);

  // 디버깅용 로그
  useEffect(() => {
    console.log("현재 근로자:", workers);
    console.log("현재 근로기록:", workRecords);
    console.log("현재 세율 정보:", taxRates);
  }, [workers, workRecords, taxRates]);

  // 현장 데이터 로드
  const loadSites = async () => {
    try {
      setIsLoading(true);

      // 사용자의 회사 ID와 회사 이름 가져오기
      const { data: userCompany } = await supabase
        .from("user_companies")
        .select("company_id, company:companies(company_name)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!userCompany?.company_id) {
        toast.error("회사 정보를 찾을 수 없습니다.");
        return;
      }

      // 회사 이름 상태 설정
      if (userCompany.company) {
        setCompanyName(userCompany.company.company_name);
      }

      // 회사의 공사현장 가져오기
      const { data, error } = await supabase
        .from("construction_sites")
        .select("site_id, site_name")
        .eq("company_id", userCompany.company_id)
        .order("site_name");

      if (error) throw error;

      setSites(data || []);
      if (data?.length > 0) {
        setSelectedSite(data[0].site_id);
      }
    } catch (error) {
      console.error("현장 데이터 로드 오류:", error);
      toast.error("현장 정보를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 근로자 데이터 로드
  // 근로자 데이터 로드
  const loadWorkers = async () => {
    if (!selectedSite) return;

    try {
      setIsLoading(true);

      // yearMonth 변수 추가 - 이 부분이 필요합니다
      const yearMonth = `${selectedYear}-${selectedMonth}`;

      // 먼저 현장에 등록된 모든 근로자 ID 가져오기
      const { data: recordsData, error: recordsError } = await supabase
        .from("work_records")
        .select("worker_id")
        .eq("site_id", selectedSite)
        .eq("registration_month", yearMonth) // 등록 월로 필터링 추가
        .or(`status.eq.confirmed,status.eq.registration`);

      if (recordsError) throw recordsError;

      if (!recordsData || recordsData.length === 0) {
        setWorkers([]);
        return;
      }

      // 중복 제거
      const uniqueWorkerIds = [...new Set(recordsData.map((record) => record.worker_id))];

      console.log("현장에 등록된 근로자 IDs:", uniqueWorkerIds);

      // 근로자 상세 정보 가져오기 - worker_type이 "daily"인 근로자만 필터링
      const { data: workersData, error: workersError } = await supabase
        .from("workers")
        .select(
          `
        worker_id, name, resident_number, contact_number, address, job_code,
        nationality_code, worker_type
      `
        )
        .in("worker_id", uniqueWorkerIds)
        .eq("worker_type", "daily"); // daily 타입 근로자만 필터링

      if (workersError) throw workersError;

      // 직종 코드 정보 가져오기 (있는 경우만)
      const jobCodes = workersData.filter((w) => w.job_code).map((w) => w.job_code);

      let jobCodeMap = {};

      if (jobCodes.length > 0) {
        const { data: jobCodeData, error: jobCodeError } = await supabase
          .from("code_masters")
          .select("code_value, code_name")
          .eq("code_type", "JOB_CODE")
          .in("code_value", jobCodes);

        if (jobCodeError) throw jobCodeError;

        jobCodeMap = jobCodeData.reduce((acc, item) => {
          acc[item.code_value] = item.code_name;
          return acc;
        }, {});
      }

      // 근로자 데이터 정리
      const workersWithJobName = workersData.map((worker) => ({
        ...worker,
        jobName: worker.job_code ? jobCodeMap[worker.job_code] || "미지정" : "미지정",
      }));

      console.log("로드된 근로자:", workersWithJobName);
      setWorkers(workersWithJobName);
    } catch (error) {
      console.error("근로자 데이터 로드 오류:", error);
      toast.error("근로자 정보를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 근로 기록 로드
  const loadWorkRecords = async () => {
    if (!selectedSite) return;

    try {
      setIsLoading(true);

      // 다음 달 계산
      let nextMonth = parseInt(selectedMonth);
      let nextYear = parseInt(selectedYear);
      if (nextMonth === 12) {
        nextMonth = 1;
        nextYear += 1;
      } else {
        nextMonth += 1;
      }
      const nextYearMonth = `${nextYear}-${nextMonth.toString().padStart(2, "0")}`;

      const yearMonth = `${selectedYear}-${selectedMonth}`;

      console.log("로드된 근로 기록 쿼리 파라미터:", {
        site_id: selectedSite,
        date_from: `${yearMonth}-01`,
        date_to: `${nextYearMonth}-01`,
      });

      // 해당 현장의 근로 기록 가져오기 - 날짜 범위 사용
      const { data, error } = await supabase
        .from("work_records")
        .select("worker_id, work_date, work_hours, daily_wage, status")
        .eq("site_id", selectedSite)
        .eq("registration_month", yearMonth) // 등록 월로 필터링 추가
        .gte("work_date", `${yearMonth}-01`) // 해당 월의 시작일
        .lt("work_date", `${nextYearMonth}-01`) // 다음 달의 시작일
        .neq("status", "registration") // 실제 작업 기록만 가져오기
        .order("work_date");

      if (error) {
        console.error("Supabase 쿼리 오류 상세:", error);
        throw error;
      }

      console.log("로드된 근로 기록:", data);

      // 근로자별, 날짜별 데이터 정리
      const recordsByWorker = {};

      data?.forEach((record) => {
        if (!recordsByWorker[record.worker_id]) {
          recordsByWorker[record.worker_id] = {};
        }

        // 날짜 문자열에서 일(day) 추출 - 보다 안정적인 방법
        const dateString = record.work_date.split("T")[0]; // '2025-04-01'과 같은 형식 얻기
        const day = parseInt(dateString.split("-")[2]); // 일자만 추출

        recordsByWorker[record.worker_id][day] = {
          hours: record.work_hours,
          wage: record.daily_wage,
          date: dateString, // 날짜 문자열 저장
        };
      });

      setWorkRecords(recordsByWorker);
      console.log("정리된 근로 기록:", recordsByWorker);
    } catch (error) {
      console.error("근로 기록 로드 오류:", error);
      toast.error("근로 기록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 근로자별 급여 및 세금 계산 함수
  const calculateWorkerPayments = (workerId) => {
    // 세율 정보가 아직 로드되지 않았다면 기본값으로 계산
    if (!taxRates) {
      return calculateWorkerTotals(workRecords, workerId);
    }

    // 세율 정보 추출
    const rates = {
      dailyIncomeDeduction: taxRates.deduction_limit?.daily_income_deduction || 150000,
      incomeTaxRate: taxRates.tax_rate?.income_tax_rate || 0.06,
      taxReductionRate: taxRates.tax_rate?.income_tax_reduction_rate || 0.45,
      localTaxRate: taxRates.tax_rate?.local_income_tax_rate || 0.1,
      minTaxExemption: taxRates.tax_rate?.minimum_tax_exemption || 1000,
      employmentInsuranceRate:
        taxRates.insurance_rate?.employment_insurance_unemployment_employee || 0.008,
      healthInsuranceRate: taxRates.insurance_rate?.health_insurance_employee_rate || 0.0323,
      nationalPensionRate: taxRates.insurance_rate?.national_pension_employee_rate || 0.045,
    };

    // 업데이트된 세율로 계산
    return calculateWorkerTotals(workRecords, workerId, rates);
  };

  // 인쇄 기능
  const handlePrint = () => {
    // 인쇄 전에 디버깅 패널 숨기기
    setShowTaxCalculation(false);
    window.print();
  };

  // 출력용 파일 생성
  const handleExport = () => {
    // 구현 예정
    toast.info("파일 생성 기능은 구현 예정입니다.");
  };

  // 근로자 선택하여 세금 계산 디버그 보기
  const handleWorkerSelect = (workerId) => {
    if (selectedWorkerId === workerId && showTaxCalculation) {
      // 같은 근로자를 다시 클릭하면 패널 닫기
      setShowTaxCalculation(false);
      setSelectedWorkerId(null);
    } else {
      setSelectedWorkerId(workerId);
      setShowTaxCalculation(true);
    }
  };

  return (
    <RoleGuard requiredPermission="VIEW_DAILY_REPORTS">
      <div className="space-y-4 print:m-0 print:p-0">
        {isLoading && (
          <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50 print:hidden">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-white">처리 중...</span>
          </div>
        )}

        {/* 헤더 부분 */}
        <div className="flex items-center justify-end gap-2 mb-4 print:hidden">
          <select
            className="px-3 py-2 border border-gray-300 rounded bg-white"
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
          >
            <option value="">공사현장 선택</option>
            {sites.map((site) => (
              <option key={site.site_id} value={site.site_id}>
                {site.site_name}
              </option>
            ))}
          </select>

          <input
            type="month"
            className="px-3 py-2 border rounded bg-white"
            value={`${selectedYear}-${selectedMonth}`}
            onChange={(e) => {
              const [year, month] = e.target.value.split("-");
              setSelectedYear(year);
              setSelectedMonth(month);
              // 날짜 변경 시 세율 정보도 다시 로드
              loadTaxRates();
            }}
          />

          <button
            className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            onClick={handlePrint}
          >
            출력하기
          </button>

          <button
            className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            onClick={handleExport}
          >
            파일생성
          </button>
        </div>

        {/* 상단 기본 정보 테이블 */}
        <table className="w-full border-collapse border border-gray-300">
          <tbody>
            <tr>
              <th className="border border-gray-300 p-2 text-left font-medium">상호명</th>
              <td className="border border-gray-300 p-2">{companyName || "(주)회사명"}</td>
              <td colSpan={9} className="border border-gray-300 p-2 text-center text-xl font-bold">
                일용노무비지급명세서
              </td>
              <th className="border border-gray-300 p-2 text-left font-medium">기간</th>
              <td className="border border-gray-300 p-2">
                <div>
                  {selectedYear}년 {selectedMonth}월 1일
                </div>
                <div>
                  {selectedYear}년 {selectedMonth}월 {daysInMonth}일
                </div>
              </td>
              <th className="border border-gray-300 p-2 text-left font-medium">현장명</th>
              <td className="border border-gray-300 p-2">
                {sites.find((s) => s.site_id === selectedSite)?.site_name || "현장명"}
              </td>
            </tr>
          </tbody>
        </table>
        {/* 상상단 색상 표시 */}
        <div className=" h-1 pb-3 ">
          <div className="bg-green-500 w-1/4 h-1 inline-block"></div>
          <div className="bg-blue-500 w-1/4 h-1 inline-block"></div>
          <div className="bg-yellow-500 w-1/4 h-1 inline-block "></div>
          <div className="bg-red-500 w-1/4 h-1 inline-block "></div>
        </div>
        {/* 메인 급여 테이블 */}
        <table className="w-full border-collapse text-xs">
          <thead className="bg-gray-200">
            <tr>
              <th rowSpan={3} className="border border-gray-400 p-1">
                직종
              </th>
              <th rowSpan={3} className="border border-gray-400 p-1">
                성명
              </th>
              <th rowSpan={3} className="border border-gray-400 p-1">
                주민등록번호
              </th>
              <th rowSpan={3} className="border border-gray-400 p-1">
                연락처
              </th>
              <th rowSpan={3} className="border border-gray-400 p-1">
                주소
              </th>
              <th colSpan={16} className="border border-gray-400 p-1 text-center">
                출근일자
              </th>
              <th rowSpan={2} className="border border-gray-400 p-1 text-center">
                출역시간
              </th>
              <th rowSpan={3} className="border border-gray-400 p-1 text-center">
                총지급액
              </th>
              <th colSpan={2} className="border border-gray-400 p-1 text-center">
                소득세
              </th>
              <th colSpan={3} className="border border-gray-400 p-1 text-center">
                공제
              </th>
              <th rowSpan={3} className="border border-gray-400 p-1 text-center">
                차감지급액
              </th>
              <th rowSpan={3} className="border border-gray-400 p-1 text-center">
                영수
              </th>
            </tr>
            <tr>
              <th className="border border-gray-400 p-1 text-center">1</th>
              <th className="border border-gray-400 p-1 text-center">2</th>
              <th className="border border-gray-400 p-1 text-center">3</th>
              <th className="border border-gray-400 p-1 text-center">4</th>
              <th className="border border-gray-400 p-1 text-center">5</th>
              <th className="border border-gray-400 p-1 text-center">6</th>
              <th className="border border-gray-400 p-1 text-center">7</th>
              <th className="border border-gray-400 p-1 text-center">8</th>
              <th className="border border-gray-400 p-1 text-center">9</th>
              <th className="border border-gray-400 p-1 text-center">10</th>
              <th className="border border-gray-400 p-1 text-center">11</th>
              <th className="border border-gray-400 p-1 text-center">12</th>
              <th className="border border-gray-400 p-1 text-center">13</th>
              <th className="border border-gray-400 p-1 text-center">14</th>
              <th className="border border-gray-400 p-1 text-center">15</th>
              <th className="border border-gray-400 p-1 text-center">/</th>
              <th rowSpan={2} className="border border-gray-400 p-1 text-center">
                소득세
              </th>
              <th rowSpan={2} className="border border-gray-400 p-1 text-center">
                주민세
              </th>
              <th rowSpan={2} className="border border-gray-400 p-1 text-center">
                고용보험
              </th>
              <th rowSpan={2} className="border border-gray-400 p-1 text-center">
                건강보험
              </th>
              <th rowSpan={2} className="border border-gray-400 p-1 text-center">
                국민연금
              </th>
            </tr>
            <tr>
              <th className="border border-gray-400 p-1 text-center">16</th>
              <th className="border border-gray-400 p-1 text-center">17</th>
              <th className="border border-gray-400 p-1 text-center">18</th>
              <th className="border border-gray-400 p-1 text-center">19</th>
              <th className="border border-gray-400 p-1 text-center">20</th>
              <th className="border border-gray-400 p-1 text-center">21</th>
              <th className="border border-gray-400 p-1 text-center">22</th>
              <th className="border border-gray-400 p-1 text-center">23</th>
              <th className="border border-gray-400 p-1 text-center">24</th>
              <th className="border border-gray-400 p-1 text-center">25</th>
              <th className="border border-gray-400 p-1 text-center">26</th>
              <th className="border border-gray-400 p-1 text-center">27</th>
              <th className="border border-gray-400 p-1 text-center">28</th>
              <th className="border border-gray-400 p-1 text-center">29</th>
              <th className="border border-gray-400 p-1 text-center">30</th>
              <th className="border border-gray-400 p-1 text-center">31</th>
              <th className="border border-gray-400 p-1 text-center">노임시급</th>
            </tr>
          </thead>
          <tbody>
            {workers.length > 0 ? (
              workers.map((worker) => {
                // 업데이트된 세율로 계산
                const totals = calculateWorkerPayments(worker.worker_id);
                // 현재 근로자가 마우스 오버 상태인지 확인
                const isHighlighted = hoveredWorkerId === worker.worker_id;
                // 강조 표시용 CSS 클래스
                const highlightClass = isHighlighted ? "bg-yellow-100" : "";

                return (
                  <React.Fragment key={`worker-group-${worker.worker_id}`}>
                    <tr className={highlightClass}>
                      <td
                        rowSpan={2}
                        className={`border border-gray-300 p-1 ${highlightClass}`}
                        onMouseEnter={() => handleMouseEnter(worker.worker_id)}
                        onMouseLeave={handleMouseLeave}
                      >
                        {worker.jobName}
                      </td>
                      <td
                        rowSpan={2}
                        className={`border border-gray-300 p-1 cursor-pointer hover:bg-blue-50 print:hover:bg-transparent ${highlightClass}`}
                        onClick={() => handleWorkerSelect(worker.worker_id)}
                        title="소득세 계산 상세보기"
                        onMouseEnter={() => handleMouseEnter(worker.worker_id)}
                        onMouseLeave={handleMouseLeave}
                      >
                        {worker.name}
                        {totals.soakBuJingSu && (
                          <span className="text-xs text-red-500" title="소액부징수 적용">
                            *
                          </span>
                        )}
                        {selectedWorkerId === worker.worker_id && (
                          <span className="ml-1 text-blue-500 print:hidden">▼</span>
                        )}
                      </td>
                      <td
                        rowSpan={2}
                        className={`border border-gray-300 p-1 ${highlightClass}`}
                        onMouseEnter={() => handleMouseEnter(worker.worker_id)}
                        onMouseLeave={handleMouseLeave}
                      >
                        {formatResidentNumber(worker.resident_number)}
                      </td>
                      <td
                        rowSpan={2}
                        className={`border border-gray-300 p-1 ${highlightClass}`}
                        onMouseEnter={() => handleMouseEnter(worker.worker_id)}
                        onMouseLeave={handleMouseLeave}
                      >
                        {formatPhoneNumber(worker.contact_number)}
                      </td>
                      <td
                        rowSpan={2}
                        className={`border border-gray-300 p-1 text-left ${highlightClass}`}
                        onMouseEnter={() => handleMouseEnter(worker.worker_id)}
                        onMouseLeave={handleMouseLeave}
                      >
                        {worker.address}
                      </td>

                      {/* 1일부터 15일까지 출근기록 */}
                      {[...Array(15)].map((_, index) => {
                        const day = index + 1;
                        const record = workRecords[worker.worker_id]?.[day];
                        return (
                          <td
                            key={`work-first-half-${worker.worker_id}-${day}`}
                            className={`border h-6 border-gray-400 p-1 text-center ${highlightClass}`}
                            onMouseEnter={() => handleMouseEnter(worker.worker_id)}
                            onMouseLeave={handleMouseLeave}
                          >
                            {record?.hours ? record.hours : ""}
                          </td>
                        );
                      })}

                      {/* 빈 칸 (15일과 16일 사이) */}
                      <td
                        className={`border border-gray-300 p-1 text-center ${highlightClass}`}
                        onMouseEnter={() => handleMouseEnter(worker.worker_id)}
                        onMouseLeave={handleMouseLeave}
                      ></td>

                      {/* 출역시간 - 수정된 부분: 총 근무시간(일수) 형식으로 표시 */}
                      <td
                        rowSpan={2}
                        className={`border border-gray-300 p-1 text-center ${highlightClass}`}
                      >
                        <div>
                          {formatNumber(totals.totalHours)}({totals.workDays}일)
                        </div>
                        <div className="border-b border-gray-400 my-1"></div> {/* 밑줄만 */}
                        <div>{formatNumber(totals.hourlyRate)}</div>
                      </td>

                      {/* 총지급액 */}
                      <td
                        rowSpan={2}
                        className={`border border-gray-300 p-1 text-center ${highlightClass}`}
                        onMouseEnter={() => handleMouseEnter(worker.worker_id)}
                        onMouseLeave={handleMouseLeave}
                      >
                        {formatNumber(totals.totalWage)}
                      </td>

                      {/* 소득세 */}
                      <td
                        rowSpan={2}
                        className={`border border-gray-300 p-1 text-center ${highlightClass}`}
                        onMouseEnter={() => handleMouseEnter(worker.worker_id)}
                        onMouseLeave={handleMouseLeave}
                      >
                        {formatNumber(totals.incomeTax)}
                      </td>

                      {/* 주민세 */}
                      <td
                        rowSpan={2}
                        className={`border border-gray-300 p-1 text-center ${highlightClass}`}
                        onMouseEnter={() => handleMouseEnter(worker.worker_id)}
                        onMouseLeave={handleMouseLeave}
                      >
                        {formatNumber(totals.localTax)}
                      </td>

                      {/* 고용보험 */}
                      <td
                        rowSpan={2}
                        className={`border border-gray-300 p-1 text-center ${highlightClass}`}
                        onMouseEnter={() => handleMouseEnter(worker.worker_id)}
                        onMouseLeave={handleMouseLeave}
                      >
                        {formatNumber(totals.employmentInsurance)}
                      </td>

                      {/* 건강보험 */}
                      <td
                        rowSpan={2}
                        className={`border border-gray-300 p-1 text-center ${highlightClass}`}
                        onMouseEnter={() => handleMouseEnter(worker.worker_id)}
                        onMouseLeave={handleMouseLeave}
                      >
                        {formatNumber(totals.healthInsurance)}
                      </td>

                      {/* 국민연금 */}
                      <td
                        rowSpan={2}
                        className={`border border-gray-300 p-1 text-center ${highlightClass}`}
                        onMouseEnter={() => handleMouseEnter(worker.worker_id)}
                        onMouseLeave={handleMouseLeave}
                      >
                        {formatNumber(totals.nationalPension)}
                      </td>

                      {/* 차감지급액 */}
                      <td
                        rowSpan={2}
                        className={`border border-gray-300 p-1 text-center ${highlightClass}`}
                        onMouseEnter={() => handleMouseEnter(worker.worker_id)}
                        onMouseLeave={handleMouseLeave}
                      >
                        {formatNumber(totals.netPay)}
                      </td>

                      {/* 영수 */}
                      <td
                        rowSpan={2}
                        className={`border border-gray-300 p-1 text-center ${highlightClass}`}
                        onMouseEnter={() => handleMouseEnter(worker.worker_id)}
                        onMouseLeave={handleMouseLeave}
                      ></td>
                    </tr>
                    <tr className={highlightClass}>
                      {/* 16일부터 31일까지 출근기록 */}
                      {[...Array(16)].map((_, index) => {
                        const day = index + 16;
                        // 현재 월에 존재하는 일자인지 확인 (31일까지가 아닌 달도 있으므로)
                        if (day <= daysInMonth) {
                          const record = workRecords[worker.worker_id]?.[day];
                          return (
                            <td
                              key={`work-second-half-${worker.worker_id}-${day}`}
                              className={`border h-6 border-gray-400 p-1 text-center ${highlightClass}`}
                              onMouseEnter={() => handleMouseEnter(worker.worker_id)}
                              onMouseLeave={handleMouseLeave}
                            >
                              {record?.hours ? record.hours : ""}
                            </td>
                          );
                        } else {
                          // 존재하지 않는 일자(예: 2월 30, 31일)는 빈 셀로
                          return (
                            <td
                              key={`work-second-half-${worker.worker_id}-${day}`}
                              className={`border border-gray-300 p-1 text-center ${highlightClass}`}
                            ></td>
                          );
                        }
                      })}
                    </tr>
                  </React.Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan={30} className="border border-gray-300 p-4 text-center text-gray-500">
                  {selectedSite ? "등록된 근로자가 없습니다." : "공사현장을 선택해주세요."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {/* 하단 색상 표시 */}
        {/* <div className="mt-2 h-1 print:mt-8">
          <div className="bg-green-500 w-24 h-1 inline-block"></div>
          <div className="bg-blue-500 w-72 h-1 inline-block"></div>
          <div className="bg-red-500 w-48 h-1 inline-block float-right"></div>
        </div> */}

        {/* 하단 주석 영역 */}
        <div className="mt-2 text-xs print:mt-4">
          <p className="text-gray-600">
            * 소득세 계산 참고: [(일급여액 - 근로소득공제금액(1일 15만원)) × 6%] × 45%, 1,000원 미만
            소액부징수
          </p>
          <p className="text-gray-600">* 소액부징수가 적용된 근로자는 이름 옆에 * 표시됨</p>
          <p className="text-blue-600 print:hidden">
            ℹ️ 소득세 계산 디버깅: 근로자 이름을 클릭하면 세부 계산 과정을 볼 수 있습니다.
          </p>
        </div>

        {/* 세금 계산 정보 패널 */}
        {showTaxCalculation && selectedWorkerId && (
          <div className="mt-8 border border-blue-300 bg-blue-50 p-4 rounded-lg print:hidden">
            <h3 className="text-lg font-bold text-blue-800 mb-4">
              {workers.find((w) => w.worker_id === selectedWorkerId)?.name} - 소득세 계산 상세
            </h3>

            {(() => {
              const workerTotals = calculateWorkerPayments(selectedWorkerId);

              // 실제 적용된 세율 정보 추출
              const appliedRates = {
                dailyIncomeDeduction: taxRates?.deduction_limit?.daily_income_deduction || 150000,
                incomeTaxRate: taxRates?.tax_rate?.income_tax_rate || 0.06,
                taxReductionRate: taxRates?.tax_rate?.income_tax_reduction_rate || 0.45,
                employmentInsuranceRate:
                  taxRates?.insurance_rate?.employment_insurance_unemployment_employee || 0.008,
                healthInsuranceRate:
                  taxRates?.insurance_rate?.health_insurance_employee_rate || 0.0323,
                nationalPensionRate:
                  taxRates?.insurance_rate?.national_pension_employee_rate || 0.045,
              };

              return (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p>
                        <span className="font-semibold">원천징수 소득세:</span>{" "}
                        {formatNumber(workerTotals.incomeTax)}원
                        {workerTotals.soakBuJingSu && (
                          <span className="text-red-500 ml-2">
                            (소액부징수: 원래 {formatNumber(workerTotals.originalIncomeTax)}원)
                          </span>
                        )}
                      </p>
                      <p>
                        <span className="font-semibold">
                          지방소득세({(appliedRates.localTaxRate || 0.1) * 100}%):
                        </span>{" "}
                        {formatNumber(workerTotals.localTax)}원
                      </p>
                    </div>

                    <div>
                      <p>
                        <span className="font-semibold">적용된 계산 기준:</span>
                      </p>
                      <ul className="text-sm text-gray-600 list-disc pl-5 mt-1">
                        <li>일일 소득공제: {formatNumber(appliedRates.dailyIncomeDeduction)}원</li>
                        <li>소득세율: {(appliedRates.incomeTaxRate * 100).toFixed(1)}%</li>
                        <li>감면율 적용: {(appliedRates.taxReductionRate * 100).toFixed(1)}%</li>
                        <li>소액부징수 기준: 1,000원 미만</li>
                      </ul>
                    </div>
                  </div>

                  <div className="mt-4">
                    <h4 className="font-bold text-blue-700 mb-2">일별 계산 내역</h4>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-blue-100">
                          <th className="border border-blue-300 p-2">날짜</th>
                          <th className="border border-blue-300 p-2">일당</th>
                          <th className="border border-blue-300 p-2">과세표준</th>
                          <th className="border border-blue-300 p-2">세금 계산식</th>
                          <th className="border border-blue-300 p-2">소득세</th>
                        </tr>
                      </thead>
                      <tbody>
                        {workerTotals.dailyTaxCalcDetails.map((detail) => (
                          <tr key={detail.day}>
                            <td className="border border-blue-300 p-2">{detail.date}</td>
                            <td className="border border-blue-300 p-2 text-right">
                              {formatNumber(detail.dailyWage)}원
                            </td>
                            <td className="border border-blue-300 p-2 text-right">
                              {formatNumber(detail.dailyTaxableAmount)}원
                            </td>
                            <td className="border border-blue-300 p-2">{detail.formula}</td>
                            <td className="border border-blue-300 p-2 text-right">
                              {formatNumber(detail.dailyTax)}원
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-blue-100">
                          <td
                            colSpan="4"
                            className="border border-blue-300 p-2 font-bold text-right"
                          >
                            세금 합계:{" "}
                            {workerTotals.soakBuJingSu
                              ? formatNumber(workerTotals.originalIncomeTax)
                              : formatNumber(workerTotals.incomeTax)}
                            원{workerTotals.soakBuJingSu && " (소액부징수 적용 전)"}
                          </td>
                          <td className="border border-blue-300 p-2 font-bold text-right">
                            {formatNumber(workerTotals.incomeTax)}원
                          </td>
                        </tr>
                      </tfoot>
                    </table>

                    {workerTotals.soakBuJingSu && (
                      <div className="mt-4 text-red-600 bg-red-50 p-3 rounded border border-red-200">
                        <p className="font-bold">소액부징수 적용됨</p>
                        <p>원천징수세액이 1,000원 미만이므로 소액부징수로 0원 처리됩니다.</p>
                      </div>
                    )}
                  </div>

                  <div className="mt-4">
                    <h4 className="font-bold text-blue-700 mb-2">사회보험 계산 내역</h4>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="bg-blue-100">
                          <th className="border border-blue-300 p-2">보험 종류</th>
                          <th className="border border-blue-300 p-2">계산식</th>
                          <th className="border border-blue-300 p-2">금액</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border border-blue-300 p-2">
                            고용보험 ({(appliedRates.employmentInsuranceRate * 100).toFixed(1)}%)
                          </td>
                          <td className="border border-blue-300 p-2">
                            {formatNumber(workerTotals.totalWage)} ×{" "}
                            {(appliedRates.employmentInsuranceRate * 100).toFixed(1)}%
                          </td>
                          <td className="border border-blue-300 p-2 text-right">
                            {formatNumber(workerTotals.employmentInsurance)}원
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-blue-300 p-2">
                            건강보험 ({(appliedRates.healthInsuranceRate * 100).toFixed(2)}%)
                          </td>
                          <td className="border border-blue-300 p-2">
                            {formatNumber(workerTotals.totalWage)} ×{" "}
                            {(appliedRates.healthInsuranceRate * 100).toFixed(2)}%
                          </td>
                          <td className="border border-blue-300 p-2 text-right">
                            {formatNumber(workerTotals.healthInsurance)}원
                          </td>
                        </tr>
                        <tr>
                          <td className="border border-blue-300 p-2">
                            국민연금 ({(appliedRates.nationalPensionRate * 100).toFixed(1)}%)
                          </td>
                          <td className="border border-blue-300 p-2">
                            {formatNumber(workerTotals.totalWage)} ×{" "}
                            {(appliedRates.nationalPensionRate * 100).toFixed(1)}%
                          </td>
                          <td className="border border-blue-300 p-2 text-right">
                            {formatNumber(workerTotals.nationalPension)}원
                          </td>
                        </tr>
                      </tbody>
                      <tfoot>
                        <tr className="bg-blue-100">
                          <td
                            colSpan="2"
                            className="border border-blue-300 p-2 font-bold text-right"
                          >
                            총 공제액:
                          </td>
                          <td className="border border-blue-300 p-2 font-bold text-right">
                            {formatNumber(workerTotals.totalDeduction)}원
                          </td>
                        </tr>
                        <tr className="bg-green-100">
                          <td
                            colSpan="2"
                            className="border border-blue-300 p-2 font-bold text-right"
                          >
                            실 지급액 (총지급액 - 총공제액):
                          </td>
                          <td className="border border-blue-300 p-2 font-bold text-right">
                            {formatNumber(workerTotals.netPay)}원
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              );
            })()}

            <div className="mt-4 flex justify-end">
              <button
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                onClick={() => setShowTaxCalculation(false)}
              >
                닫기
              </button>
            </div>
          </div>
        )}

        {/* 하단 색상 표시 */}
        <div className="mt-2 h-1 print:mt-8">
          <div className="bg-green-500 w-24 h-1 inline-block"></div>
          <div className="bg-blue-500 w-72 h-1 inline-block"></div>
          <div className="bg-red-500 w-48 h-1 inline-block float-right"></div>
        </div>
      </div>
    </RoleGuard>
  );
}

export default DailyWorkerGongdanPage;
