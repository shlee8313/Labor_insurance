//file: app\dashboard\reports\dailyWorkerDetailConfirm
// 근로내역확인서
"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/store/authStore";
import RoleGuard from "@/components/RoleGuard";
import { supabase } from "@/lib/supabase";
import { toast } from "react-hot-toast";
import { formatResidentNumber, formatPhoneNumber } from "@/lib/utils/taxCalculations";

function DailyWorkerDetailConfirm() {
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
  const [companyInfo, setCompanyInfo] = useState({
    company_name: "",
    business_number: "",
    workplace_id: "",
    address: "",
    phone_number: "",
    mobile_number: "",
    fax_number: "",
  });
  const [selectedSiteInfo, setSelectedSiteInfo] = useState({
    site_name: "",
    construction_manager: "",
    manager_resident_number: "",
    manager_position: "",
    manager_job_description: "",
  });

  // 현장 데이터 로드
  const loadSites = async () => {
    try {
      setIsLoading(true);

      // 사용자의 회사 ID와 회사 정보 가져오기
      const { data: userCompany } = await supabase
        .from("user_companies")
        .select("company_id, company:companies(*)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!userCompany?.company_id) {
        toast.error("회사 정보를 찾을 수 없습니다.");
        return;
      }

      // 회사 정보 상태 설정
      if (userCompany.company) {
        setCompanyInfo({
          company_name: userCompany.company.company_name || "",
          business_number: userCompany.company.business_number || "",
          workplace_id: userCompany.company.workplace_id || "",
          address: userCompany.company.address || "",
          phone_number: userCompany.company.phone_number || "",
          mobile_number: userCompany.company.mobile_number || "",
          fax_number: userCompany.company.fax_number || "",
        });
      }

      // 회사의 공사현장 가져오기
      const { data, error } = await supabase
        .from("construction_sites")
        .select("*")
        .eq("company_id", userCompany.company_id)
        .order("site_name");

      if (error) throw error;

      setSites(data || []);
      if (data?.length > 0) {
        setSelectedSite(data[0].site_id);
        setSelectedSiteInfo({
          site_name: data[0].site_name || "",
          construction_manager: data[0].construction_manager || "",
          manager_resident_number: data[0].manager_resident_number || "",
          manager_position: data[0].manager_position || "",
          manager_job_description: data[0].manager_job_description || "",
        });
      }
    } catch (error) {
      console.error("현장 데이터 로드 오류:", error);
      toast.error("현장 정보를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 근로자 데이터 로드
  const loadWorkers = async () => {
    if (!selectedSite) return;

    try {
      setIsLoading(true);
      const yearMonth = `${selectedYear}-${selectedMonth}`;
      // 먼저 현장에 등록된 모든 근로자 ID 가져오기
      const { data: recordsData, error: recordsError } = await supabase
        .from("work_records")
        .select("worker_id")
        .eq("site_id", selectedSite)
        .eq("registration_month", yearMonth) // 날짜 범위 대신 registration_month 사용
        .or(`status.eq.confirmed,status.eq.registration`);

      if (recordsError) throw recordsError;

      if (!recordsData || recordsData.length === 0) {
        setWorkers([]);
        return;
      }

      // 중복 제거
      const uniqueWorkerIds = [...new Set(recordsData.map((record) => record.worker_id))];

      // 근로자 상세 정보 가져오기 - worker_type이 "daily"인 근로자만 필터링
      const { data: workersData, error: workersError } = await supabase
        .from("workers")
        .select(
          `
          worker_id, name, resident_number, contact_number, address, job_code,
          nationality_code, residence_status_code, worker_type
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

      // 해당 현장의 근로 기록 가져오기 - 날짜 범위 사용
      const { data, error } = await supabase
        .from("work_records")
        .select("worker_id, work_date, work_hours, daily_wage, status")
        .eq("site_id", selectedSite)
        .gte("work_date", `${yearMonth}-01`) // 해당 월의 시작일
        .lt("work_date", `${nextYearMonth}-01`) // 다음 달의 시작일
        .order("work_date");

      if (error) throw error;

      // 근로자별, 날짜별 데이터 정리
      const recordsByWorker = {};

      data?.forEach((record) => {
        if (!recordsByWorker[record.worker_id]) {
          recordsByWorker[record.worker_id] = {};
        }

        // 날짜 문자열에서 일(day) 추출
        const dateString = record.work_date.split("T")[0]; // '2025-04-01'과 같은 형식 얻기
        const day = parseInt(dateString.split("-")[2]); // 일자만 추출

        recordsByWorker[record.worker_id][day] = {
          hours: record.work_hours,
          wage: record.daily_wage,
          date: dateString, // 날짜 문자열 저장
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

  // 현장 정보 불러오기
  const loadSiteInfo = async (siteId) => {
    try {
      const { data, error } = await supabase
        .from("construction_sites")
        .select("*")
        .eq("site_id", siteId)
        .single();

      if (error) throw error;

      setSelectedSiteInfo({
        site_name: data.site_name || "",
        construction_manager: data.construction_manager || "",
        manager_resident_number: data.manager_resident_number || "",
        manager_position: data.manager_position || "",
        manager_job_description: data.manager_job_description || "",
      });
    } catch (error) {
      console.error("현장 정보 로드 오류:", error);
      toast.error("현장 상세 정보를 불러오는 중 오류가 발생했습니다.");
    }
  };

  // 처음 렌더링시 사이트 로드
  useEffect(() => {
    if (user) {
      loadSites();
    }
  }, [user]);

  // 선택된 현장이 변경되면 근로자 및 근로기록 로드
  useEffect(() => {
    if (selectedSite) {
      loadSiteInfo(selectedSite);
      loadWorkers();
      loadWorkRecords();
    }
  }, [selectedSite, selectedYear, selectedMonth]);

  // 인쇄 기능
  const handlePrint = () => {
    window.print();
  };

  // 근로 일수 계산 함수
  const calculateWorkerStats = (workerId) => {
    const workerRecords = workRecords[workerId] || {};
    let workDays = 0;
    let totalHours = 0;
    let totalWage = 0;

    Object.values(workerRecords).forEach((record) => {
      if (record.hours) {
        workDays++;
        totalHours += record.hours;
        totalWage += record.wage || 0;
      }
    });

    // 일평균 근로시간 (소수점 한자리까지)
    const avgDailyHours = workDays > 0 ? parseFloat((totalHours / workDays).toFixed(1)) : 0;

    return {
      workDays,
      totalHours,
      avgDailyHours,
      totalWage,
    };
  };

  // 출력용 파일 생성
  const handleExport = () => {
    toast.info("파일 생성 기능은 구현 예정입니다.");
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
        <div className="flex items-center justify-between gap-2 mb-4 print:hidden">
          <h1 className="text-xl font-bold">일용근로자 근로확인신고서</h1>

          <div className="flex items-center gap-2">
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
        </div>

        {/* 근로내역확인서 내용 */}
        <div className="font-sans text-xs text-gray-800">
          {/* 단일 제목 테이블 */}
          <div className="w-full mb-4 border">
            <div className="p-2 font-bold text-base">근로내역확인서</div>
          </div>

          {/* 공통사업장 정보 */}
          <table className="w-full border-collapse mb-4 border border-gray-300">
            <tbody>
              <tr>
                <td
                  rowSpan="6"
                  className="border border-gray-300 w-1/16 text-center font-bold p-1.5"
                >
                  공통사업장
                </td>
                <td colSpan="4" className="border border-gray-300 p-1.5">
                  사업장관리번호: {companyInfo.workplace_id}
                </td>
                <td colSpan="4" className="border border-gray-300 p-1.5">
                  명칭: {companyInfo.company_name}
                </td>
              </tr>
              <tr>
                <td colSpan="4" className="border border-gray-300 p-1.5">
                  사업자등록번호: {companyInfo.business_number}
                  <span className="text-xs text-gray-500 ml-1">
                    (국세청에 의한 근로소득지급명세서 제출을 갈음하고자 할 때 기재)
                  </span>
                </td>
                <td colSpan="4" className="border border-gray-300 p-1.5">
                  하수급인관리번호
                  <span className="text-xs text-gray-500 ml-1">
                    (건설공사등 미승인 하수급인에 한함)
                  </span>
                </td>
              </tr>
              <tr>
                <td colSpan="3" className="border border-gray-300 p-1.5">
                  소재지: {companyInfo.address}
                </td>
                <td colSpan="2" className="border border-gray-300 p-1.5">
                  보험사무대행기관 번호
                </td>
                <td colSpan="2" className="border border-gray-300 p-1.5">
                  보험사무대행기관 명칭
                </td>
              </tr>
              <tr>
                <td colSpan="4" className="border border-gray-300 p-1.5">
                  전화번호 (유선): {companyInfo.phone_number}
                </td>
                <td colSpan="2" className="border border-gray-300 p-1.5">
                  (휴대전화): {companyInfo.mobile_number}
                </td>
                <td colSpan="2" className="border border-gray-300 p-1.5">
                  FAX번호: {companyInfo.fax_number}
                </td>
              </tr>
              <tr>
                <td rowSpan="2" className="border border-gray-300 p-1.5">
                  공사명: {selectedSiteInfo.site_name}
                </td>
                <td rowSpan="2" className="border border-gray-300 p-1.5">
                  고용관리 책임자
                  <span className="text-xs text-gray-500 ml-1">(표준건설업에 해당)</span>
                </td>
                <td className="border border-gray-300 p-1.5">
                  성명: {selectedSiteInfo.construction_manager}
                </td>
                <td colSpan="3" className="border border-gray-300 p-1.5">
                  (주민등록번호): {formatResidentNumber(selectedSiteInfo.manager_resident_number)}
                </td>
                <td colSpan="2" className="border border-gray-300 p-1.5">
                  (직위): {selectedSiteInfo.manager_position}
                </td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-1.5">
                  직무내용: {selectedSiteInfo.manager_job_description}
                </td>
                <td colSpan="4" className="border border-gray-300 p-1.5">
                  (근무지) [ ]본사 [ ]해당 사업장(현장) [ ]다른 사업장(현장)
                </td>
              </tr>
            </tbody>
          </table>

          <div className="flex flex-row gap-3 flex-wrap">
            {workers.length > 0 ? (
              (() => {
                const workersWithRecords = workers
                  .map((worker) => {
                    const stats = calculateWorkerStats(worker.worker_id);

                    // Only display workers who have work records in the selected month
                    if (stats.workDays === 0) {
                      return null; // Skip workers with no work days
                    }

                    // 근로일에 O 표시 만들기
                    const workDays = {};
                    if (workRecords[worker.worker_id]) {
                      Object.keys(workRecords[worker.worker_id]).forEach((day) => {
                        workDays[parseInt(day)] = true;
                      });
                    }

                    return (
                      <div key={worker.worker_id} className="w-60">
                        {/* 데이터 테이블: 개인정보 섹션 */}
                        <table className="w-full border-collapse mb-2 border border-gray-300">
                          <tbody>
                            <tr>
                              <td
                                colSpan="2"
                                className="border border-gray-300 bg-gray-100 p-1 font-semibold w-[60%]"
                              >
                                성명
                              </td>
                              <td
                                colSpan="2"
                                className="border border-gray-300 p-1 text-left pl-2 w-[40%]"
                              >
                                {worker.name}
                              </td>
                            </tr>
                            <tr>
                              <td
                                colSpan="2"
                                className="border border-gray-300 bg-gray-100 p-1 font-semibold w-[60%]"
                              >
                                주민(외국인)등록번호
                              </td>
                              <td
                                colSpan="2"
                                className="border border-gray-300 p-1 text-left pl-2 w-[40%]"
                              >
                                {formatResidentNumber(worker.resident_number)}
                              </td>
                            </tr>
                            <tr>
                              <td className="border border-gray-300 bg-gray-100 p-1 font-semibold w-[30%]">
                                국적
                              </td>
                              <td className="border border-gray-300 bg-gray-100 p-1 font-semibold w-[30%]">
                                체류자격
                              </td>
                              <td className="border border-gray-300 p-1 text-left pl-2 w-[20%]">
                                {worker.nationality_code}
                              </td>
                              <td className="border border-gray-300 p-1 text-left pl-2 w-[20%]">
                                {worker.residence_status_code}
                              </td>
                            </tr>
                            <tr>
                              <td
                                colSpan="2"
                                className="border border-gray-300 bg-gray-100 p-1 font-semibold w-[60%]"
                              >
                                전화번호(휴대전화)
                              </td>
                              <td
                                colSpan="2"
                                className="border border-gray-300 p-1 text-left pl-2 w-[40%]"
                              >
                                {formatPhoneNumber(worker.contact_number)}
                              </td>
                            </tr>
                            <tr>
                              <td
                                colSpan="2"
                                className="border border-gray-300 bg-gray-100 p-1 font-semibold w-[60%]"
                              >
                                직종 부호
                              </td>
                              <td
                                colSpan="2"
                                className="border border-gray-300 p-1 text-left pl-2 w-[40%]"
                              >
                                {worker.job_code}
                              </td>
                            </tr>
                          </tbody>
                        </table>

                        {/* 데이터 테이블: 근로일수 섹션 */}
                        <table className="w-full border-collapse mb-2 border border-gray-300">
                          <tbody>
                            <tr>
                              <td
                                rowSpan="3"
                                className="border border-gray-300 bg-gray-100 p-1 text-center font-semibold w-[15%] text-xs"
                              >
                                근로일수
                                <br />
                                ("O"표시)
                              </td>
                              <td colSpan="5" className="border border-gray-300 p-0">
                                <table className="w-full border-collapse table-fixed">
                                  <thead>
                                    <tr>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        1
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        2
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        3
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        4
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        5
                                      </td>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[1] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[2] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[3] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[4] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[5] ? "O" : ""}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                                <table className="w-full border-collapse table-fixed">
                                  <thead>
                                    <tr>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        6
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        7
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        8
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        9
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        10
                                      </td>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[6] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[7] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[8] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[9] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[10] ? "O" : ""}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                                <table className="w-full border-collapse table-fixed">
                                  <thead>
                                    <tr>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        11
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        12
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        13
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        14
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        15
                                      </td>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[11] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[12] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[13] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[14] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[15] ? "O" : ""}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                            <tr>
                              <td colSpan="5" className="border border-gray-300 p-0">
                                <table className="w-full border-collapse table-fixed">
                                  <thead>
                                    <tr>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        16
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        17
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        18
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        19
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        20
                                      </td>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[16] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[17] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[18] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[19] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[20] ? "O" : ""}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                                <table className="w-full border-collapse table-fixed">
                                  <thead>
                                    <tr>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        21
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        22
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        23
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        24
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        25
                                      </td>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[21] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[22] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[23] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[24] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[25] ? "O" : ""}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                                <table className="w-full border-collapse table-fixed">
                                  <thead>
                                    <tr>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        26
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        27
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        28
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        29
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        30
                                      </td>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[26] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[27] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[28] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[29] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[30] ? "O" : ""}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                            <tr>
                              <td colSpan="5" className="border border-gray-300 p-0">
                                <table className="w-full border-collapse table-fixed">
                                  <thead>
                                    <tr>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        31
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        /
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        /
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        /
                                      </td>
                                      <td className="border border-gray-300 bg-gray-100 p-0.5 text-center font-semibold w-1/5 text-xs">
                                        /
                                      </td>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center">
                                        {workDays[31] ? "O" : ""}
                                      </td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center"></td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center"></td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center"></td>
                                      <td className="border border-gray-300 p-0.5 h-4 text-center"></td>
                                    </tr>
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                            <tr>
                              <td
                                colSpan="2"
                                className="border border-gray-300 bg-gray-100 p-1 font-semibold text-xs"
                              >
                                근로
                                <br />
                                일수
                              </td>
                              <td
                                colSpan="2"
                                className="border border-gray-300 bg-gray-100 p-1 font-semibold text-xs"
                              >
                                일평균
                                <br />
                                근로시간
                              </td>
                              <td className="border border-gray-300 p-1 text-xs">
                                {stats.workDays}일
                              </td>
                              <td className="border border-gray-300 p-1 text-xs">
                                {stats.avgDailyHours}시간
                              </td>
                            </tr>
                          </tbody>
                        </table>
                        {/* 데이터 테이블: 급여 섹션 */}
                        <table className="w-full border-collapse mb-2 border border-gray-300">
                          <tbody>
                            <tr>
                              <td
                                colSpan="2"
                                className="border border-gray-300 bg-gray-100 p-1 font-semibold w-[60%] text-xs"
                              >
                                보수지급기초일수
                              </td>
                              <td
                                colSpan="2"
                                className="border border-gray-300 p-1 text-left pl-2 w-[40%] text-xs"
                              >
                                {stats.workDays}일
                              </td>
                            </tr>
                            <tr>
                              <td
                                colSpan="2"
                                className="border border-gray-300 bg-gray-100 p-1 font-semibold w-[60%] text-xs"
                              >
                                보수총액
                                <br />
                                (과세소득)
                              </td>
                              <td
                                colSpan="2"
                                className="border border-gray-300 p-1 text-left pl-2 w-[40%] text-xs"
                              >
                                {stats.totalWage.toLocaleString()}원
                              </td>
                            </tr>
                            <tr>
                              <td
                                colSpan="2"
                                className="border border-gray-300 bg-gray-100 p-1 font-semibold w-[60%] text-xs"
                              >
                                임금총액
                              </td>
                              <td
                                colSpan="2"
                                className="border border-gray-300 p-1 text-left pl-2 w-[40%] text-xs"
                              >
                                {stats.totalWage.toLocaleString()}원
                              </td>
                            </tr>
                            <tr>
                              <td
                                colSpan="2"
                                className="border border-gray-300 bg-gray-100 p-1 font-semibold w-[60%] text-xs"
                              >
                                이직사유 코드
                              </td>
                              <td
                                colSpan="2"
                                className="border border-gray-300 p-1 text-left pl-2 w-[40%] text-xs"
                              ></td>
                            </tr>
                            <tr>
                              <td
                                colSpan="2"
                                className="border border-gray-300 bg-gray-100 p-1 font-semibold w-[60%] text-xs"
                              >
                                보험료부과구분
                                <br />
                                (해당자만)
                              </td>
                              <td
                                colSpan="2"
                                className="border border-gray-300 p-1 text-left pl-2 w-[40%] text-xs"
                              ></td>
                            </tr>
                            <tr>
                              <td className="border border-gray-300 bg-gray-100 p-1 font-semibold w-[30%] text-xs">
                                부호
                              </td>
                              <td className="border border-gray-300 bg-gray-100 p-1 font-semibold w-[30%] text-xs">
                                사유
                              </td>
                              <td className="border border-gray-300 p-1 text-left pl-2 w-[20%] text-xs"></td>
                              <td className="border border-gray-300 p-1 text-left pl-2 w-[20%] text-xs"></td>
                            </tr>
                          </tbody>
                        </table>

                        {/* 데이터 테이블: 국세청 신고 섹션 */}
                        <table className="w-full border-collapse mb-3 border border-gray-300">
                          <tbody>
                            <tr>
                              <td
                                rowSpan="5"
                                className="border border-gray-300 bg-gray-100 p-1 font-semibold w-[10%] text-center text-xs"
                              >
                                <span>
                                  국세청
                                  <br />
                                  일용
                                  <br />
                                  급여
                                  <br />
                                  소득
                                  <br />
                                  신고
                                </span>
                              </td>
                              <td
                                colSpan="2"
                                className="border border-gray-300 bg-gray-100 p-1 font-semibold w-[30%] text-xs"
                              >
                                지급월
                              </td>
                              <td className="border border-gray-300 p-1 text-left pl-2 w-[60%] text-xs">
                                {selectedMonth}월
                              </td>
                            </tr>
                            <tr>
                              <td
                                colSpan="2"
                                className="border border-gray-300 bg-gray-100 p-1 font-semibold w-[40%] text-xs"
                              >
                                총지급액(과세소득)
                              </td>
                              <td className="border border-gray-300 p-1 text-left pl-2 w-[50%] text-xs">
                                {stats.totalWage.toLocaleString()}원
                              </td>
                            </tr>
                            <tr>
                              <td
                                colSpan="2"
                                className="border border-gray-300 bg-gray-100 p-1 font-semibold w-[40%] text-xs"
                              >
                                비과세소득
                              </td>
                              <td className="border border-gray-300 p-1 text-left pl-2 w-[50%] text-xs">
                                0원
                              </td>
                            </tr>
                            <tr>
                              <td
                                rowSpan="2"
                                className="border border-gray-300 bg-gray-100 p-1 font-semibold w-[10%] text-xs"
                              >
                                원천
                                <br />
                                징수액
                              </td>
                              <td className="border border-gray-300 bg-gray-100 p-1 font-semibold w-[30%] text-xs">
                                소득세
                              </td>
                              <td className="border border-gray-300 p-1 text-left pl-2 w-[50%] text-xs">
                                원
                              </td>
                            </tr>
                            <tr>
                              <td className="border border-gray-300 bg-gray-100 p-1 font-semibold w-[30%] text-xs">
                                지방소득세
                              </td>
                              <td className="border border-gray-300 p-1 text-left pl-2 w-[60%] text-xs">
                                원
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  })
                  .filter(Boolean); // Remove null entries

                // If we have workers but none have records for the selected month
                if (workersWithRecords.length === 0) {
                  return (
                    <div className="w-full text-xl p-4 text-center text-red-500 border border-gray-300 rounded">
                      {selectedSite
                        ? "근로자 또는 근로기록이 존재하지 않습니다."
                        : "공사현장을 선택해주세요."}
                    </div>
                  );
                }

                return workersWithRecords;
              })()
            ) : (
              <div className="w-full text-xl p-4 text-center text-red-500 border border-gray-300 rounded">
                {selectedSite
                  ? "근로자 또는 근로기록이 존재하지 않습니다."
                  : "공사현장을 선택해주세요."}
              </div>
            )}
          </div>
        </div>
      </div>
    </RoleGuard>
  );
}

export default DailyWorkerDetailConfirm;
