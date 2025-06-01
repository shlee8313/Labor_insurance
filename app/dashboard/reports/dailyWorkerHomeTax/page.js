//file: app\dashboard\reports\dailyWorkerHomeTax\page.js
//일용근로자소득지급명세서
"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/store/authStore";
import useSiteStore from "@/lib/store/siteStore"; // 추가
import RoleGuard from "@/components/RoleGuard";
import { supabase } from "@/lib/supabase";
import { toast } from "react-hot-toast";
// 공통 유틸리티 임포트
import {
  calculateWorkerTotals,
  formatNumber,
  formatResidentNumber,
  formatPhoneNumber,
  formatBusinessNumber,
  formatDateToDayOnly,
} from "@/lib/utils/taxCalculations";
// 시스템 설정 임포트
import { getCachedSystemSettings } from "@/lib/utils/systemSettings";

function DailyWorkerHomeTax() {
  const { user } = useAuthStore();
  const {
    sites,
    companyName,
    userCompanyId,
    isLoading: isSiteLoading,
    initialize,
  } = useSiteStore();
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSite, setSelectedSite] = useState("");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(
    (new Date().getMonth() + 1).toString().padStart(2, "0")
  );
  // const [sites, setSites] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [workRecords, setWorkRecords] = useState({});
  const [companyInfo, setCompanyInfo] = useState({
    companyName: "",
    businessNumber: "",
    comNumber: "",
    representativeName: "",
    address: "",
    phoneNumber: "",
    email: "",
  });
  // 디버깅 상태 추가
  const [showTaxCalculation, setShowTaxCalculation] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState(null);
  // 세율 정보 상태 추가
  const [taxRates, setTaxRates] = useState(null);
  const [hoveredWorkerId, setHoveredWorkerId] = useState(null);

  const handleMouseEnter = (workerId) => {
    setHoveredWorkerId(workerId);
  };

  const handleMouseLeave = () => {
    setHoveredWorkerId(null);
  };
  /**
   * 초기 데이터 로드
   */
  useEffect(() => {
    if (user) {
      initialize(user.id); // siteStore 초기화
      loadTaxRates();
    }
  }, [user, initialize]);

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

  // 현장 데이터 로드
  // const loadSites = async () => {
  //   try {
  //     setIsLoading(true);

  //     // 사용자의 회사 ID와 회사 정보 가져오기
  //     const { data: userCompany } = await supabase
  //       .from("user_companies")
  //       .select(
  //         "company_id, company:companies(company_name, business_number, com_number, representative_name, address, phone_number)"
  //       )
  //       .eq("user_id", user.id)
  //       .maybeSingle();

  //     if (!userCompany?.company_id) {
  //       toast.error("회사 정보를 찾을 수 없습니다.");
  //       return;
  //     }

  //     // 회사 정보 상태 설정
  //     if (userCompany.company) {
  //       setCompanyInfo({
  //         companyName: userCompany.company.company_name || "",
  //         businessNumber: userCompany.company.business_number || "",
  //         comNumber: userCompany.company.com_number || "",
  //         representativeName: userCompany.company.representative_name || "",
  //         address: userCompany.company.address || "",
  //         phoneNumber: userCompany.company.phone_number || "",
  //         email: "", // 추후 이메일 정보가 필요하면 추가
  //       });
  //     }

  //     // 회사의 공사현장 가져오기
  //     const { data, error } = await supabase
  //       .from("location_sites")
  //       .select("site_id, site_name")
  //       .eq("company_id", userCompany.company_id)
  //       .order("site_name");

  //     if (error) throw error;

  //     setSites(data || []);
  //     if (data?.length > 0) {
  //       setSelectedSite(data[0].site_id);
  //     }
  //   } catch (error) {
  //     console.error("현장 데이터 로드 오류:", error);
  //     toast.error("현장 정보를 불러오는 중 오류가 발생했습니다.");
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

  // 근로자 데이터 로드
  const loadWorkers = async () => {
    if (!selectedSite) return;

    try {
      setIsLoading(true);

      // userCompanyId 체크
      if (!userCompanyId) {
        toast.error("회사 정보를 찾을 수 없습니다.");
        return;
      }

      // 회사 상세 정보 조회
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select(
          "company_name, business_number, com_number, representative_name, address, phone_number"
        )
        .eq("company_id", userCompanyId)
        .single();

      if (companyError) throw companyError;

      if (companyData) {
        setCompanyInfo({
          companyName: companyData.company_name || "",
          businessNumber: companyData.business_number || "",
          comNumber: companyData.com_number || "",
          representativeName: companyData.representative_name || "",
          address: companyData.address || "",
          phoneNumber: companyData.phone_number || "",
          email: "", // 추후 이메일 정보가 필요하면 추가
        });
      }

      // Declare yearMonth variable
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

      // 근로자 상세 정보 가져오기
      const { data: workersData, error: workersError } = await supabase
        .from("workers")
        .select(
          `
        worker_id, name, resident_number, contact_number, address, 
        nationality_code, worker_type
      `
        )
        .in("worker_id", uniqueWorkerIds)
        .eq("worker_type", "daily"); // daily 타입 근로자만 필터링

      if (workersError) throw workersError;

      setWorkers(workersData || []);
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

      if (error) throw error;

      // 근로자별, 날짜별 데이터 정리
      const recordsByWorker = {};

      data?.forEach((record) => {
        if (!recordsByWorker[record.worker_id]) {
          recordsByWorker[record.worker_id] = {};
        }

        // 날짜 문자열에서 일(day) 추출
        const dateString = record.work_date.split("T")[0];
        const day = parseInt(dateString.split("-")[2]);

        recordsByWorker[record.worker_id][day] = {
          hours: record.work_hours,
          wage: record.daily_wage,
          date: dateString,
        };
      });

      setWorkRecords(recordsByWorker);
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

  // 전체 합계 계산
  const calculateTotals = () => {
    let workerCount = 0;
    let recordCount = 0;
    let totalTaxableIncome = 0;
    let totalBiGwaSe = 0;
    let totalIncomeTax = 0;
    let totalLocalTax = 0;

    // 실제 근무 기록이 있는 근로자만 계산
    const workersWithRecords = workers.filter((worker) => {
      const workerTotals = calculateWorkerPayments(worker.worker_id);
      return workerTotals.workDays > 0;
    });

    workerCount = workersWithRecords.length;
    recordCount = workersWithRecords.length; // 제출자료건수는 근무일수의 행의 갯수

    workersWithRecords.forEach((worker) => {
      const workerTotals = calculateWorkerPayments(worker.worker_id);
      totalTaxableIncome += workerTotals.taxableIncome;
      totalBiGwaSe += workerTotals.biGwaSe;
      totalIncomeTax += workerTotals.incomeTax;
      totalLocalTax += workerTotals.localTax;
    });

    return {
      workerCount,
      recordCount,
      totalTaxableIncome,
      totalBiGwaSe,
      totalIncomeTax,
      totalLocalTax,
    };
  };

  // 현재 날짜 가져오기
  const getCurrentDateFormatted = () => {
    const now = new Date();
    return `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
  };

  // 총계 계산
  const totals = calculateTotals();

  return (
    <RoleGuard requiredPermission="VIEW_REPORTS">
      <div className="space-y-1 print:m-0 print:p-0">
        {(isLoading || isSiteLoading) && (
          <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50 print:hidden">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-white">처리 중...</span>
          </div>
        )}

        {/* 헤더 부분 */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 px-6">
          <div className="flex  gap-12 ">
            {/* 제목 */}
            <h1 className="text-xl font-bold text-gray-700">일용자 소득지급명세서</h1>
            <div className="flex flex-wrap items-center gap-4">
              {/* 현장 선택 */}
              <div className="flex flex-col">
                <label htmlFor="site-select" className="text-xs font-medium text-gray-700 mb-1">
                  현장 선택
                </label>
                <select
                  id="site-select"
                  className="h-6 px-1  border border-blue-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedSite || ""}
                  onChange={(e) => setSelectedSite(e.target.value)}
                >
                  <option value="">공사현장 선택</option>
                  {sites.map((site) => (
                    <option key={site.site_id} value={site.site_id}>
                      {site.site_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 조회 년월 */}
              <div className="flex flex-col">
                <label htmlFor="year-month" className="text-xs font-medium text-gray-700 mb-1">
                  조회 년월
                </label>
                <input
                  type="month"
                  id="year-month"
                  className="h-6 px-3 border border-blue-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={`${selectedYear}-${selectedMonth}`}
                  onChange={(e) => {
                    const [year, month] = e.target.value.split("-");
                    setSelectedYear(year);
                    setSelectedMonth(month);
                    loadTaxRates();
                  }}
                />
              </div>
            </div>
          </div>
          {/* 출력하기 버튼 */}
          <div className="flex flex-col justify-startpt-6">
            {" "}
            {/* 위 여백 맞추기 */}
            <button
              className="h-10 px-4 bg-gray-500 text-white text-sm rounded hover:bg-blue-500"
              onClick={handlePrint}
            >
              출력하기
            </button>
          </div>
        </div>
        {/* <div className="mb-6">
          <h2 className="text-xl font-bold">일용근로소득 지급명세서(지급자제출용)</h2>
        </div> */}

        <div className=" h-1/4 ">
          <div className="bg-green-500 w-1/4 h-1 inline-block"></div>
          <div className="bg-blue-500 w-1/4 h-1 inline-block"></div>
          <div className="bg-yellow-500 w-1/4 h-1 inline-block "></div>
          <div className="bg-red-500 w-1/4 h-1 inline-block "></div>
        </div>
        {/* 지급자 정보 */}
        <table className="w-full border-collapse mb-6">
          <tbody>
            <tr>
              <th
                rowSpan="3"
                className="border border-gray-300 bg-gray-100 text-center font-bold w-16"
              >
                지급자
              </th>
              <th className="border border-gray-300 bg-gray-100 text-left pl-2 w-50">
                ① 상호 (법인명)
              </th>
              <td className="border border-gray-300 p-2">{companyInfo.representativeName}</td>
              <th className="border border-gray-300 bg-gray-100 text-left pl-2 w-50">
                ③ 사업자 등록번호
              </th>
              <td className="border border-gray-300 p-2">
                {formatBusinessNumber(companyInfo.businessNumber)}
              </td>
            </tr>
            <tr>
              <th className="border border-gray-300 bg-gray-100 text-left pl-2">
                ④ 주민(법인) 등록번호
              </th>
              <td className="border border-gray-300 p-2">
                {formatResidentNumber(companyInfo.comNumber)}
              </td>
              <th className="border border-gray-300 bg-gray-100 text-left pl-2">⑤ 소재지 (주소)</th>
              <td colSpan="3" className="border border-gray-300 p-2">
                {companyInfo.address}
              </td>
            </tr>
            <tr>
              <th className="border border-gray-300 bg-gray-100 text-left pl-2">⑥ 전화번호</th>
              <td className="border border-gray-300 p-2">
                {formatPhoneNumber(companyInfo.phoneNumber)}
              </td>
              <th className="border border-gray-300 bg-gray-100 text-left pl-2">⑦ 전자우편주소</th>
              <td colSpan="3" className="border border-gray-300 p-2">
                {companyInfo.email}
              </td>
            </tr>
          </tbody>
        </table>

        {/* 월별 원천징수 집계현황 */}
        <h2 className="text-lg font-bold mb-2">➊ 월별 원천징수 집계현황</h2>
        <table className="w-full border-collapse mb-6">
          <tbody>
            <tr>
              <th className="border border-gray-300 bg-gray-100 text-center w-28">⑧ 귀속연도</th>
              <td className="border border-gray-300 p-2" style={{ width: "100px" }}>
                {selectedYear}
              </td>
              <th
                className="border border-gray-300 bg-gray-100 text-center"
                style={{ width: "180px" }}
              >
                ⑨ 지급월 (해당 월에 "○")
              </th>
              <td colSpan="3" className="border border-gray-300 p-2">
                <div className="flex flex-wrap justify-between">
                  <div>
                    {[1, 2, 3, 4, 5, 6].map((month) => (
                      <span
                        key={month}
                        className="month-checkbox mr-10 mt-1 whitespace-nowrap inline-block"
                        style={{ width: "70px" }}
                      >
                        [
                        {parseInt(selectedMonth) === month ? (
                          <strong className="text-md text-red-500">O</strong>
                        ) : (
                          "\u00A0\u00A0"
                        )}
                        ] {month}월
                      </span>
                    ))}
                  </div>
                  <div>
                    {[7, 8, 9, 10, 11, 12].map((month) => (
                      <span
                        key={month}
                        className="month-checkbox mr-10 mt-1 whitespace-nowrap inline-block"
                        style={{ width: "70px" }}
                      >
                        [
                        {parseInt(selectedMonth) === month ? (
                          <strong className="text-md">O</strong>
                        ) : (
                          "\u00A0\u00A0"
                        )}
                        ] {month}월
                      </span>
                    ))}
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        <table className="w-full border-collapse mb-6">
          <tbody>
            <tr>
              <th
                rowSpan="2"
                className="border border-gray-300 bg-gray-100 text-center"
                style={{ width: "16%" }}
              >
                ⑩ 일용근로자수
                <div className="text-xs">
                  (⑰ 번에 적은 칸의 개수. 다만, 동일인의 경우 1명으로 합계)
                </div>
              </th>
              <th
                rowSpan="2"
                className="border border-gray-300 bg-gray-100 text-center"
                style={{ width: "16%" }}
              >
                ⑪ 제출자료건수
                <div className="text-xs">(㉑번에 적은 칸의 개수)</div>
              </th>
              <th
                rowSpan="2"
                className="border border-gray-300 bg-gray-100 text-center"
                style={{ width: "16%" }}
              >
                ⑫ 과세소득 합계
                <div className="text-xs">(㉕번 합계)</div>
              </th>
              <th
                rowSpan="2"
                className="border border-gray-300 bg-gray-100 text-center"
                style={{ width: "16%" }}
              >
                ⑬ 비과세소득 합계
                <div className="text-xs">(㉖번 합계)</div>
              </th>
              <th colSpan="2" className="border border-gray-300 bg-gray-100 text-center">
                원천징수세액 합계
              </th>
            </tr>
            <tr>
              <th
                className="border border-gray-300 bg-gray-100 text-center"
                style={{ width: "18%" }}
              >
                ⑭ 소득세
                <div className="text-xs">(㉗번 합계)</div>
              </th>
              <th
                className="border border-gray-300 bg-gray-100 text-center"
                style={{ width: "18%" }}
              >
                ⑮ 지방소득세
                <div className="text-xs">(㉘번 합계)</div>
              </th>
            </tr>
            <tr>
              <td className="border border-gray-300 p-2 text-center">{totals.workerCount} 명</td>
              <td className="border border-gray-300 p-2 text-center">{totals.recordCount} 건</td>
              <td className="border border-gray-300 p-2 text-right">
                {formatNumber(totals.totalTaxableIncome)} 원
              </td>
              <td className="border border-gray-300 p-2 text-right">
                {formatNumber(totals.totalBiGwaSe)} 원
              </td>
              <td className="border border-gray-300 p-2 text-right">
                {formatNumber(totals.totalIncomeTax)} 원
              </td>
              <td className="border border-gray-300 p-2 text-right">
                {formatNumber(totals.totalLocalTax)} 원
              </td>
            </tr>
          </tbody>
        </table>

        {/* 디버깅 토글 버튼 */}
        <div className="print:hidden mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold">➋ 소득자 인적사항 및 일용근로소득 지급내용</h2>
        </div>

        {/* 소득자 인적사항 및 일용근로소득 지급내용 */}
        <table className="w-full border-collapse mb-6">
          <thead>
            <tr>
              <th rowSpan="2" className="border border-gray-300 bg-gray-100 text-center">
                번호
              </th>
              <th rowSpan="2" className="border border-gray-300 bg-gray-100 text-center">
                ⑰ 성명
              </th>
              <th rowSpan="2" className="border border-gray-300 bg-gray-100 text-center">
                ⑱ 전화번호
              </th>
              <th rowSpan="2" className="border border-gray-300 bg-gray-100 text-center">
                ⑲ 외국인여부
                <br />
                (외국인 "○")
              </th>
              <th rowSpan="2" className="border border-gray-300 bg-gray-100 text-center">
                ⑳ 주민등록번호
              </th>
              <th colSpan="3" className="border border-gray-300 bg-gray-100 text-center">
                귀속
              </th>
              <th rowSpan="2" className="border border-gray-300 bg-gray-100 text-center">
                ㉕ 과세소득
              </th>
              <th rowSpan="2" className="border border-gray-300 bg-gray-100 text-center">
                ㉖ 비과세소득
              </th>
              <th colSpan="2" className="border border-gray-300 bg-gray-100 text-center">
                원천징수세액
              </th>
            </tr>
            <tr>
              <th className="border border-gray-300 bg-gray-100 text-center">㉑ 근무월</th>
              <th className="border border-gray-300 bg-gray-100 text-center">㉒ 근무일수</th>
              <th className="border border-gray-300 bg-gray-100 text-center">㉓ 최종근무일</th>
              <th className="border border-gray-300 bg-gray-100 text-center">㉗ 소득세</th>
              <th className="border border-gray-300 bg-gray-100 text-center">㉘ 지방소득세</th>
            </tr>
          </thead>

          <tbody>
            {workers.length > 0 ? (
              (() => {
                // Filter workers with actual work days first
                const workersWithRecords = workers.filter((worker) => {
                  const workerTotals = calculateWorkerPayments(worker.worker_id);
                  return workerTotals.workDays > 0;
                });

                // If no workers have records for the selected month, show the empty message
                if (workersWithRecords.length === 0) {
                  return (
                    <tr>
                      <td colSpan="12" className="border border-gray-300 p-4 text-center">
                        근로자 또는 근로기록이 존재하지 않습니다.
                      </td>
                    </tr>
                  );
                }

                // Otherwise, render the workers with records
                return workersWithRecords.map((worker, index) => {
                  // Calculation code remains the same
                  const workerTotals = calculateWorkerPayments(worker.worker_id);

                  // Remainder of your rendering code...
                  const workerRecords = workRecords[worker.worker_id] || {};
                  const workDays = Object.keys(workerRecords).length;

                  // Last work day calculation
                  let lastWorkDay = 0;
                  Object.keys(workerRecords).forEach((day) => {
                    const dayNum = parseInt(day);
                    if (dayNum > lastWorkDay) lastWorkDay = dayNum;
                  });

                  const lastWorkDate = lastWorkDay
                    ? `${selectedYear}-${selectedMonth}-${String(lastWorkDay).padStart(2, "0")}`
                    : "";

                  // Foreign worker check
                  const isForeigner = worker.nationality_code && worker.nationality_code !== "100";

                  // 행 하이라이트를 위한 상태 확인
                  const isHighlighted = hoveredWorkerId === worker.worker_id;
                  const highlightClass = isHighlighted ? "bg-yellow-100" : "";

                  return (
                    <tr
                      key={worker.worker_id}
                      className={highlightClass}
                      onMouseEnter={() => handleMouseEnter(worker.worker_id)}
                      onMouseLeave={handleMouseLeave}
                    >
                      <td className={`border border-gray-300 p-2 text-center ${highlightClass}`}>
                        {index + 1}
                      </td>
                      <td
                        className={`border border-gray-300 p-2 text-center cursor-pointer hover:bg-blue-200 print:hover:bg-white ${highlightClass}`}
                        onClick={() => handleWorkerSelect(worker.worker_id)}
                        title="세금 계산 상세보기"
                      >
                        {worker.name}
                        {workerTotals.soakBuJingSu && (
                          <span className="ml-1 text-red-500 text-xs" title="소액부징수 적용">
                            *
                          </span>
                        )}
                        {selectedWorkerId === worker.worker_id && (
                          <span className="ml-1 text-blue-500 print:hidden">▼</span>
                        )}
                      </td>
                      <td className={`border border-gray-300 p-2 text-center ${highlightClass}`}>
                        {formatPhoneNumber(worker.contact_number)}
                      </td>
                      <td className={`border border-gray-300 p-2 text-center ${highlightClass}`}>
                        {isForeigner ? "○" : ""}
                      </td>
                      <td
                        className={`border border-gray-300 p-2 text-center ${highlightClass}`}
                        onMouseEnter={() => handleMouseEnter(worker.worker_id)}
                        onMouseLeave={handleMouseLeave}
                      >
                        {formatResidentNumber(worker.resident_number)}
                      </td>
                      <td className={`border border-gray-300 p-2 text-center ${highlightClass}`}>
                        {selectedMonth}
                      </td>
                      <td className={`border border-gray-300 p-2 text-center ${highlightClass}`}>
                        {workDays}
                      </td>
                      <td className={`border border-gray-300 p-2 text-center ${highlightClass}`}>
                        {formatDateToDayOnly(lastWorkDate)}
                      </td>
                      <td className={`border border-gray-300 p-2 text-right ${highlightClass}`}>
                        {formatNumber(workerTotals.taxableIncome)}
                      </td>
                      <td className={`border border-gray-300 p-2 text-right ${highlightClass}`}>
                        {formatNumber(workerTotals.biGwaSe)}
                      </td>
                      <td className={`border border-gray-300 p-2 text-right ${highlightClass}`}>
                        {formatNumber(workerTotals.incomeTax)}
                      </td>
                      <td className={`border border-gray-300 p-2 text-right ${highlightClass}`}>
                        {formatNumber(workerTotals.localTax)}
                      </td>
                    </tr>
                  );
                });
              })()
            ) : (
              <tr>
                <td colSpan="12" className="border border-gray-300 p-4 text-center">
                  근로자 또는 근로기록이 존재하지 않습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* 서명 부분 */}
        <div className="mt-4 text-right mb-4 print:block hidden">
          <p className="mt-2">위와 같이 일용근로소득 지급명세서를 제출합니다.</p>
          <p className="mt-4">{getCurrentDateFormatted()}</p>
          <p className="mt-2">제출자 : {companyInfo.representativeName} (서명 또는 인)</p>
        </div>

        {/* 세율 정보 표시 - 개발자용 */}
        <div className="text-sm text-blue-600 print:hidden">
          <p>ℹ️ 적용된 세율 정보:</p>
          <ul className="list-disc ml-5">
            <li>
              일일 소득공제:{" "}
              {formatNumber(taxRates?.deduction_limit?.daily_income_deduction || 150000)}원
            </li>
            <li>소득세율: {((taxRates?.tax_rate?.income_tax_rate || 0.06) * 100).toFixed(1)}%</li>
            <li>
              세액감면율:{" "}
              {((taxRates?.tax_rate?.income_tax_reduction_rate || 0.45) * 100).toFixed(1)}%
            </li>
            <li>
              소액부징수 기준: {formatNumber(taxRates?.tax_rate?.minimum_tax_exemption || 1000)}원
              미만
            </li>
          </ul>
          <p className="mt-2 ">
            ℹ️ 소득세 계산 디버깅:{" "}
            <span className="text-red-700 font-extrabold">근로자 이름을 클릭</span>하면 세부 계산
            과정을 볼 수 있습니다.
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
                        <span className="font-semibold">근무일수:</span> {workerTotals.workDays}일
                      </p>
                      <p>
                        <span className="font-semibold">총 근로시간:</span>{" "}
                        {workerTotals.totalHours}시간
                      </p>
                      <p>
                        <span className="font-semibold">총 급여액:</span>{" "}
                        {formatNumber(workerTotals.totalWage)}원
                      </p>
                      <p>
                        <span className="font-semibold">비과세소득:</span>{" "}
                        {formatNumber(workerTotals.biGwaSe)}원
                      </p>
                    </div>
                    <div>
                      <p>
                        <span className="font-semibold">소득세 계산 공식:</span>
                        <br />
                        [(일급여액 - 근로소득공제금액(
                        {formatNumber(appliedRates.dailyIncomeDeduction)}원)) ×{" "}
                        {(appliedRates.incomeTaxRate * 100).toFixed(1)}%] ×{" "}
                        {(appliedRates.taxReductionRate * 100).toFixed(1)}%
                      </p>
                      <p className="mt-2">
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
                          지방소득세({(taxRates?.tax_rate?.local_income_tax_rate || 0.1) * 100}%):
                        </span>{" "}
                        {formatNumber(workerTotals.localTax)}원
                      </p>
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
      </div>
    </RoleGuard>
  );
}

export default DailyWorkerHomeTax;
