// lib/store/workTimeStore.js
// lib/store/workTimeStore.js
// lib/store/workTimeStore.js
import { create } from "zustand";
import { supabase } from "@/lib/supabase";

// 유틸리티 함수들 임포트
import { formatNumber, parseNumber } from "@/lib/utils/formattingUtils";

import {
  getCurrentYearMonth,
  getDaysInMonth,
  isSundayByDate,
  isHolidayByDate,
  getPreviousYearMonthFromSelected,
} from "@/lib/utils/dateUtils";

import {
  calculateTotalWorkHours,
  calculateWorkDays,
  calculateTotalWage,
  calculateHourlyRate,
  determineWorkType,
  createWorkTypeMetadata,
  parseWorkTypeMetadata,
} from "@/lib/utils/workTimeUtils";

import { calculateInsurancePremium } from "@/lib/utils/insuranceCalculations";

const useWorkTimeStore = create((set, get) => ({
  // 상태
  workers: [], // 근로자 목록
  workerDetails: {}, // 근로자 ID를 키로 하는 상세 정보 캐시
  workReports: {}, // 근로자-현장-월 조합을 키로 하는 근무 기록 캐시
  selectedSite: null, // 선택된 현장
  selectedWorker: null, // 선택된 근로자
  yearMonth: getCurrentYearMonth(), // 선택된 년월
  sites: [], // 현장 목록
  userCompanyId: null, // 사용자 회사 ID
  prevMonthWork: {}, // 이전 월 근무 기록 (근로자-현장-월 조합을 키로 하는 객체)
  insuranceStatus: {}, // 4대보험 상태 (근로자-현장 조합을 키로 하는 객체)

  // 로딩 상태 (컴포넌트별로 분리)
  isLoading: false,
  isSiteLoading: false,
  isWorkerLoading: false,
  isDetailLoading: false, // 근로자 상세 정보 로딩 상태
  isReportLoading: false, // 근무 기록 로딩 상태

  // 유틸리티 함수들 - 별도 파일에서 임포트한 것들 사용
  formatNumber,
  parseNumber,
  isSunday: (day) => isSundayByDate(day, get().yearMonth),
  isHoliday: (dateStr) => isHolidayByDate(dateStr),
  getDaysInMonth: (yearMonth) => getDaysInMonth(yearMonth || get().yearMonth),

  // 보험료 계산 - 개선된 함수 사용
  calculateInsuranceFee: (wage, insuranceType) => {
    return calculateInsurancePremium(parseNumber(wage), insuranceType);
  },

  // 초기화 함수
  initialize: async (userId) => {
    // 회사 ID 가져오기
    await get().fetchUserCompany(userId);

    // 현장 목록 가져오기
    await get().fetchSites();
  },

  // 회사 ID 가져오기
  fetchUserCompany: async (userId) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from("user_companies")
        .select("company_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        set({ userCompanyId: data.company_id });
        return data.company_id;
      }
    } catch (error) {
      console.error("사용자 회사 정보 조회 오류:", error);
    }

    return null;
  },

  // 현장 목록 가져오기
  fetchSites: async () => {
    const { userCompanyId } = get();
    if (!userCompanyId) return;

    try {
      set({ isSiteLoading: true });

      const { data, error } = await supabase
        .from("construction_sites")
        .select("*")
        .eq("company_id", userCompanyId)
        .order("site_name");

      if (error) throw error;

      set({ sites: data || [], isSiteLoading: false });
    } catch (error) {
      console.error("사이트 목록 조회 오류:", error);
      set({ isSiteLoading: false });
    }
  },

  // 근로자 목록 가져오기 - registration_month 필드 기반 필터링
  fetchWorkers: async (siteId, searchTerm = "") => {
    const { userCompanyId, yearMonth } = get();
    if (!siteId || !userCompanyId || !yearMonth) {
      set({ workers: [] });
      return;
    }

    try {
      set({ isWorkerLoading: true });

      // 선택된 년/월 기준 날짜 범위 계산
      const { currentYearMonth, nextYearMonth } = getPreviousYearMonthFromSelected(
        yearMonth.split("-")[0],
        yearMonth.split("-")[1]
      );

      const startDate = `${currentYearMonth}-01`;
      const endDate = `${nextYearMonth}-01`;

      // 1. 선택된 현장에서 선택한 월에 등록된 근로자 ID만 가져오기
      const { data: workRecords, error: recordsError } = await supabase
        .from("work_records")
        .select("worker_id, work_type, work_date, status")
        .eq("site_id", siteId)
        .or(
          `registration_month.eq.${yearMonth},and(work_date.gte.${startDate},work_date.lt.${endDate})`
        );

      if (recordsError) throw recordsError;

      // 근무 이력이 있는 근로자 ID (중복 제거)
      const allRegisteredWorkerIds =
        Array.from(new Set(workRecords?.map((record) => record.worker_id))) || [];

      // registration 유형을 제외한 근무 이력이 있는 근로자 ID
      const workerIdsWithHistory =
        Array.from(
          new Set(
            workRecords
              ?.filter((record) => record.work_type !== "registration")
              .map((record) => record.worker_id)
          )
        ) || [];

      // 근로자 정보 가져오기 - 이 부분을 수정하여 항상 해당 현장의 근로자만 표시
      let workersQuery = supabase
        .from("workers")
        .select("*")
        .in("worker_id", allRegisteredWorkerIds) // 현재 선택된 현장에 등록된 근로자만
        .order("name");

      if (searchTerm) {
        workersQuery = workersQuery.ilike("name", `%${searchTerm}%`);
      }

      const { data: workersData, error: workersError } = await workersQuery;

      if (workersError) throw workersError;

      // 각 근로자에 근무 이력 및 등록 여부 표시
      const workersWithMetadata =
        workersData?.map((worker) => ({
          ...worker,
          hasWorkHistory: workerIdsWithHistory.includes(worker.worker_id),
          isRegistered: allRegisteredWorkerIds.includes(worker.worker_id),
        })) || [];

      set({ workers: workersWithMetadata, isWorkerLoading: false });
    } catch (error) {
      console.error("근로자 목록 조회 오류:", error);
      set({ isWorkerLoading: false });
    }
  },

  // 근로자 상세 정보 가져오기
  fetchWorkerDetails: async (workerId) => {
    if (!workerId) return;

    // 이미 캐시에 있는 경우 API 호출 생략
    const { workerDetails } = get();
    if (workerDetails[workerId]) {
      set({ selectedWorker: workerId });
      return;
    }

    try {
      set({ isDetailLoading: true });

      const { data, error } = await supabase
        .from("workers")
        .select("*")
        .eq("worker_id", workerId)
        .single();

      if (error) throw error;

      // 캐시에 추가
      set((state) => ({
        workerDetails: { ...state.workerDetails, [workerId]: data },
        selectedWorker: workerId,
        isDetailLoading: false,
      }));
    } catch (error) {
      console.error("근로자 상세 정보 조회 오류:", error);
      set({ isDetailLoading: false });
    }
  },

  // 근무 기록 가져오기
  // 근무 기록 가져오기
  fetchWorkReports: async (workerId, siteId, yearMonth) => {
    if (!workerId || !siteId || !yearMonth) return;

    // 캐시 키 생성
    const cacheKey = `${workerId}-${siteId}-${yearMonth}`;

    // 이미 캐시에 있는 경우 API 호출 생략
    const { workReports } = get();
    if (workReports[cacheKey]) {
      return;
    }

    try {
      set({ isReportLoading: true });

      // 날짜 계산
      const { currentMonthStartDate, nextMonthStartDate } = getPreviousYearMonthFromSelected(
        yearMonth.split("-")[0],
        yearMonth.split("-")[1]
      );

      const startDate = currentMonthStartDate.toISOString().split("T")[0];
      const endDate = nextMonthStartDate.toISOString().split("T")[0];

      // 일용근로자 근로확인신고 여부 확인
      const { data: reports, error: reportsError } = await supabase
        .from("daily_work_reports")
        .select("*")
        .eq("worker_id", workerId)
        .eq("site_id", siteId)
        .eq("report_month", yearMonth);

      if (reportsError) throw reportsError;

      let reportData = null;
      let workDetails = Array.from({ length: 31 }, () => ({
        hours: "",
        extended: false,
        holiday: false,
        night: false,
        wage: "",
        payment_status: "unpaid", // 기본값 추가
        payment_date: null, // 기본값 추가
      }));

      if (reports && reports.length > 0) {
        reportData = reports[0];

        // 일용근로자 근로확인신고 상세 데이터 가져오기
        const { data: details, error: detailsError } = await supabase
          .from("daily_work_report_details")
          .select("*")
          .eq("report_id", reportData.report_id)
          .order("work_date");

        if (detailsError) throw detailsError;

        reportData.details = details || [];

        if (details && details.length > 0) {
          // 먼저 work_records 테이블에서 해당 월의 작업 유형 정보 가져오기
          const { data: workRecords, error: workRecordsError } = await supabase
            .from("work_records")
            .select("*, payment_status, payment_date") // payment_status와 payment_date도 가져오기
            .eq("worker_id", workerId)
            .eq("site_id", siteId)
            .gte("work_date", startDate)
            .lt("work_date", endDate)
            .not("work_type", "eq", "registration");

          if (workRecordsError) throw workRecordsError;

          // 날짜별 작업 유형 및 지급 상태 정보를 맵으로 구성
          const workTypeMap = {};
          if (workRecords && workRecords.length > 0) {
            workRecords.forEach((record) => {
              const day = new Date(record.work_date).getDate();

              // 작업 유형 기본값 설정
              let extended = false;
              let holiday = false;
              let night = false;

              // work_type 필드로 기본 설정
              if (record.work_type === "overtime") extended = true;
              if (record.work_type === "holiday") holiday = true;
              if (record.work_type === "night") night = true;

              // 메타데이터 필드가 있으면 더 정확한 정보 사용
              if (record.work_type_metadata) {
                try {
                  const metadata = parseWorkTypeMetadata(record.work_type_metadata);
                  extended = metadata.extended || extended;
                  holiday = metadata.holiday || holiday;
                  night = metadata.night || night;
                } catch (e) {
                  console.error("메타데이터 파싱 오류:", e);
                }
              }

              // 지급 상태 정보 추가
              workTypeMap[day] = {
                extended,
                holiday,
                night,
                payment_status: record.payment_status || "unpaid",
                payment_date: record.payment_date || null,
              };
            });
          }

          // 이제 daily_work_report_details와 work_type 정보를 결합
          details.forEach((detail) => {
            const day = new Date(detail.work_date).getDate() - 1; // 0부터 시작하는 인덱스
            if (day >= 0 && day < 31) {
              const dayNum = day + 1;
              const workType = workTypeMap[dayNum] || {
                extended: false,
                holiday: isSundayByDate(day, yearMonth), // 일요일은 기본적으로 휴일로 표시
                night: false,
                payment_status: "unpaid",
                payment_date: null,
              };

              workDetails[day] = {
                hours: detail.work_hours.toString(),
                extended: workType.extended,
                holiday: workType.holiday,
                night: workType.night,
                wage: formatNumber(detail.daily_wage.toString()),
                payment_status: workType.payment_status,
                payment_date: workType.payment_date,
              };
            }
          });
        }
      } else {
        // daily_work_reports에 데이터가 없으면 work_records에서 직접 확인
        const { data: workRecords, error: workRecordsError } = await supabase
          .from("work_records")
          .select("*, payment_status, payment_date") // payment_status와 payment_date도 가져오기
          .eq("worker_id", workerId)
          .eq("site_id", siteId)
          .gte("work_date", startDate)
          .lt("work_date", endDate)
          .not("work_type", "eq", "registration");

        if (workRecordsError) throw workRecordsError;

        // work_records에서 데이터를 가져와 적용
        if (workRecords && workRecords.length > 0) {
          workRecords.forEach((record) => {
            const day = new Date(record.work_date).getDate() - 1; // 0부터 시작하는 인덱스
            if (day >= 0 && day < 31) {
              // 메타데이터 추출하여 작업 유형 판단
              let isExtended = record.work_type === "overtime";
              let isHoliday = record.work_type === "holiday" || isSundayByDate(day, yearMonth);
              let isNight = record.work_type === "night";

              if (record.work_type_metadata) {
                try {
                  const metadata = parseWorkTypeMetadata(record.work_type_metadata);
                  isExtended = metadata.extended || isExtended;
                  isHoliday = metadata.holiday || isHoliday;
                  isNight = metadata.night || isNight;
                } catch (e) {
                  console.error("메타데이터 파싱 오류:", e);
                }
              }

              workDetails[day] = {
                hours: record.work_hours.toString(),
                extended: isExtended,
                holiday: isHoliday,
                night: isNight,
                wage: formatNumber(record.daily_wage ? record.daily_wage.toString() : "0"),
                payment_status: record.payment_status || "unpaid",
                payment_date: record.payment_date || null,
              };
            }
          });
        }
      }

      // 캐시에 추가
      set((state) => ({
        workReports: {
          ...state.workReports,
          [cacheKey]: {
            report: reportData,
            workDetails: workDetails,
          },
        },
        isReportLoading: false,
      }));

      // 4대보험 상태 확인
      await get().checkInsuranceStatus(workerId, siteId);

      // 이전 월 근무 기록 확인
      await get().fetchPreviousMonthWork(workerId, siteId, yearMonth);

      // 근무 기록 로드 후 보험 상태 재계산
      await get().recalculateInsuranceStatus(workerId, siteId, yearMonth);
    } catch (error) {
      console.error("근무 기록 조회 오류:", error);
      set({ isReportLoading: false });
    }
  },

  // 이전 월 근무 기록 가져오기
  fetchPreviousMonthWork: async (workerId, siteId, yearMonth) => {
    if (!workerId || !siteId || !yearMonth) return;

    // 이전 월 계산
    const { prevYearMonth, prevMonthStartDate, currentMonthStartDate } =
      getPreviousYearMonthFromSelected(yearMonth.split("-")[0], yearMonth.split("-")[1]);

    const prevMonthStart = prevMonthStartDate.toISOString().split("T")[0];
    const currentMonthStart = currentMonthStartDate.toISOString().split("T")[0];

    // 캐시 키 생성
    const cacheKey = `${workerId}-${siteId}-${prevYearMonth}`;

    // 이미 캐시에 있는 경우 API 호출 생략
    const { prevMonthWork } = get();
    if (prevMonthWork[cacheKey]) {
      return;
    }

    try {
      // 이전월 근무 기록 조회 - 날짜 범위로 필터링
      let { data: workRecordsData, error: workError } = await supabase
        .from("work_records")
        .select("worker_id, work_date, work_hours, daily_wage, status, registration_month")
        .eq("site_id", siteId)
        .eq("worker_id", workerId)
        .gte("work_date", prevMonthStart)
        .lt("work_date", currentMonthStart);

      if (workError) {
        console.error("이전월 근무 데이터 조회 오류:", workError);
        throw workError;
      }

      // 결과가 없는 경우 - registration_month로 조회
      if (!workRecordsData || workRecordsData.length === 0) {
        const { data: regMonthData, error: regMonthError } = await supabase
          .from("work_records")
          .select("worker_id, work_date, work_hours, daily_wage, status, registration_month")
          .eq("site_id", siteId)
          .eq("worker_id", workerId)
          .eq("registration_month", prevYearMonth);

        if (!regMonthError && regMonthData && regMonthData.length > 0) {
          workRecordsData = regMonthData;
        }
      }

      // 이전월 등록 여부 확인
      const { data: registrationData, error: regError } = await supabase
        .from("work_records")
        .select("worker_id, status, registration_month")
        .eq("site_id", siteId)
        .eq("worker_id", workerId)
        .eq("registration_month", prevYearMonth)
        .eq("status", "registration");

      // 근무 기록 필터링 (registration 상태 제외)
      const workRecords = workRecordsData
        ? workRecordsData.filter((r) => r.status !== "registration")
        : [];

      // 데이터 계산 - workTimeUtils 함수 활용
      const workDays = workRecords.length;
      const workHours = workRecords.reduce((sum, r) => sum + (parseFloat(r.work_hours) || 0), 0);
      const monthlyWage = workRecords.reduce((sum, r) => sum + (parseFloat(r.daily_wage) || 0), 0);
      const isRegistered = registrationData && registrationData.length > 0;

      // 첫 근무일 확인
      const firstWorkDate =
        workRecords.length > 0
          ? workRecords.sort((a, b) => new Date(a.work_date) - new Date(b.work_date))[0].work_date
          : null;

      const result = {
        workDays,
        workHours,
        firstWorkDate,
        monthlyWage,
        isRegistered,
      };

      // 캐시에 추가
      set((state) => ({
        prevMonthWork: { ...state.prevMonthWork, [cacheKey]: result },
      }));
    } catch (error) {
      console.error("이전 월 근무 기록 조회 오류:", error);
    }
  },

  // 4대보험 상태 확인
  // lib/store/workTimeStore.js의 checkInsuranceStatus 함수를 아래 코드로 대체
  // 4대보험 상태 확인
  checkInsuranceStatus: async (workerId, siteId) => {
    if (!workerId || !siteId) return;

    // 캐시 키 생성
    const cacheKey = `${workerId}-${siteId}`;

    // 이미 캐시에 있는 경우 API 호출 생략
    const { insuranceStatus } = get();
    if (insuranceStatus[cacheKey]) {
      return;
    }

    try {
      // 보험 가입 정보 조회 - 스키마에 맞게 쿼리 수정
      const { data: enrollments, error } = await supabase
        .from("insurance_enrollments")
        .select(
          `
        enrollment_id, 
        worker_id,
        site_id,
        year_month,
        national_pension_status,
        health_insurance_status,
        employment_insurance_status,
        industrial_accident_status,
        national_pension_acquisition_date,
        health_insurance_acquisition_date,
        employment_insurance_acquisition_date,
        industrial_accident_acquisition_date,
        national_pension_loss_date,
        health_insurance_loss_date,
        employment_insurance_loss_date,
        industrial_accident_loss_date
      `
        )
        .eq("worker_id", workerId)
        .eq("site_id", siteId);

      if (error) throw error;

      // 기본 상태 설정
      const newStatus = {
        national_pension: "해당사항없음",
        health_insurance: "해당사항없음",
        employment_insurance: "해당사항없음",
        industrial_accident: "해당사항없음",
      };

      if (enrollments && enrollments.length > 0) {
        // 최신 등록 정보를 우선순위로 처리 (여러 레코드가 있을 경우)
        // 일반적으로 가장 최근에 생성된 레코드가 현재 상태를 반영
        const latestEnrollment = enrollments.sort((a, b) => {
          // created_at이 없을 경우를 대비해 업데이트 처리
          const dateA = new Date(a.updated_at || a.created_at || 0);
          const dateB = new Date(b.updated_at || b.created_at || 0);
          return dateB - dateA; // 내림차순 정렬 (최신순)
        })[0];

        // 각 보험 유형별 상태 확인
        // 1. 직접 status 필드 확인 (manual_required나 auto_required인 경우 가입 필요)
        // 2. 취득일/상실일 확인 (취득일이 있고 상실일이 없으면 가입 상태)

        // 국민연금
        if (
          latestEnrollment.national_pension_status === "manual_required" ||
          latestEnrollment.national_pension_status === "auto_required"
        ) {
          newStatus.national_pension = "가입대상";
        }
        if (
          latestEnrollment.national_pension_acquisition_date &&
          !latestEnrollment.national_pension_loss_date
        ) {
          newStatus.national_pension = "가입상태";
        }

        // 건강보험
        if (
          latestEnrollment.health_insurance_status === "manual_required" ||
          latestEnrollment.health_insurance_status === "auto_required"
        ) {
          newStatus.health_insurance = "가입대상";
        }
        if (
          latestEnrollment.health_insurance_acquisition_date &&
          !latestEnrollment.health_insurance_loss_date
        ) {
          newStatus.health_insurance = "가입상태";
        }

        // 고용보험
        if (
          latestEnrollment.employment_insurance_status === "manual_required" ||
          latestEnrollment.employment_insurance_status === "auto_required"
        ) {
          newStatus.employment_insurance = "가입대상";
        }
        if (
          latestEnrollment.employment_insurance_acquisition_date &&
          !latestEnrollment.employment_insurance_loss_date
        ) {
          newStatus.employment_insurance = "가입상태";
        }

        // 산재보험
        if (
          latestEnrollment.industrial_accident_status === "manual_required" ||
          latestEnrollment.industrial_accident_status === "auto_required"
        ) {
          newStatus.industrial_accident = "가입대상";
        }
        if (
          latestEnrollment.industrial_accident_acquisition_date &&
          !latestEnrollment.industrial_accident_loss_date
        ) {
          newStatus.industrial_accident = "가입상태";
        }
      }

      // 캐시에 추가
      set((state) => ({
        insuranceStatus: { ...state.insuranceStatus, [cacheKey]: newStatus },
      }));
    } catch (error) {
      console.error("4대보험 상태 확인 오류:", error);
    }
  },

  // 근로자를 현장에 등록하는 함수 - registration_month 필드 사용
  registerWorkerToSite: async (workerId, siteId) => {
    const { yearMonth } = get(); // 현재 선택된 년월 정보 가져오기

    if (!workerId || !siteId || !yearMonth) {
      return { success: false, message: "근로자와 공사현장을 선택해주세요." };
    }

    try {
      set({ isLoading: true });

      // 이미 같은 월에 등록되어 있는지 확인
      const { data: existingRecord, error: checkError } = await supabase
        .from("work_records")
        .select("*")
        .eq("worker_id", workerId)
        .eq("site_id", siteId)
        .eq("registration_month", yearMonth)
        .maybeSingle();

      if (checkError && checkError.code !== "PGRST116") {
        // PGRST116: 결과 없음
        throw checkError;
      }

      if (existingRecord) {
        set({ isLoading: false });
        return { success: false, message: "이미 해당 현장의 선택한 월에 등록된 근로자입니다." };
      }

      // 새 등록 기록 생성
      const today = new Date().toISOString().split("T")[0];
      const { error: insertError } = await supabase.from("work_records").insert({
        worker_id: workerId,
        site_id: siteId,
        work_date: today,
        work_hours: 0,
        work_type: "registration", // 등록용 레코드
        daily_wage: 0,
        status: "registration",
        registration_month: yearMonth, // 등록 월 추가
      });

      if (insertError) throw insertError;

      // 근로자 목록 갱신
      await get().fetchWorkers(siteId);

      set({ isLoading: false });
      return { success: true, message: `근로자가 ${yearMonth}월에 성공적으로 등록되었습니다.` };
    } catch (error) {
      console.error("근로자 등록 오류:", error);
      set({ isLoading: false });
      return { success: false, message: `등록 중 오류가 발생했습니다: ${error.message}` };
    }
  },

  // 근무 기록 저장
  // 근무 기록 저장
  saveWorkRecords: async (workerId, siteId, yearMonth, workDetails) => {
    if (!workerId || !siteId || !yearMonth) {
      return { success: false, message: "근로자, 공사현장, 근무년월을 모두 선택해주세요." };
    }

    try {
      set({ isLoading: true });

      // 지급완료된 항목 개수 추적
      let paidRecordsCount = 0;

      // 현재 월의 전체 날짜 범위 가져오기
      const { currentMonthStartDate, nextMonthStartDate } = getPreviousYearMonthFromSelected(
        yearMonth.split("-")[0],
        yearMonth.split("-")[1]
      );

      const startDate = currentMonthStartDate.toISOString().split("T")[0];
      const endDate = nextMonthStartDate.toISOString().split("T")[0];

      // 1. 먼저 기존 work_records 데이터를 조회하여 기존에 있던 모든 데이터(지급완료 포함)를 맵으로 구성
      const { data: existingRecords, error: existingRecordsError } = await supabase
        .from("work_records")
        .select("*")
        .eq("worker_id", workerId)
        .eq("site_id", siteId)
        .gte("work_date", startDate)
        .lt("work_date", endDate)
        .not("work_type", "eq", "registration");

      if (existingRecordsError) throw existingRecordsError;

      // 날짜별 기존 레코드 맵 구성 (키: YYYY-MM-DD)
      const existingRecordsMap = {};
      if (existingRecords && existingRecords.length > 0) {
        existingRecords.forEach((record) => {
          existingRecordsMap[record.work_date] = record;
        });
      }

      // 2. 모든 날짜에 대해 processedWorkDetails 배열 구성 (지급완료 포함)
      const processedWorkDetails = [];
      const daysInMonth = getDaysInMonth(yearMonth);

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${yearMonth}-${String(day).padStart(2, "0")}`;
        const detailIndex = day - 1;
        const currentDetail = workDetails[detailIndex] || {};

        // 해당 날짜의 기존 레코드가 있는지 확인
        const existingRecord = existingRecordsMap[dateStr];

        // 지급완료 레코드면 기존 데이터 유지, 아니면 새 데이터 사용
        if (existingRecord && existingRecord.payment_status === "paid") {
          // 지급완료된 레코드는 기존 데이터를 유지
          paidRecordsCount++;

          // 기존 레코드를 processedWorkDetails에 추가하되, UI에 보여주던 값과 일치시키기 위해 일부 필드는 currentDetail에서 가져옴
          processedWorkDetails.push({
            ...currentDetail, // UI에 표시되던 상태값 (extended, holiday, night)
            day,
            date: dateStr,
            hours: existingRecord.work_hours.toString(),
            wage: formatNumber(
              existingRecord.daily_wage ? existingRecord.daily_wage.toString() : "0"
            ),
            payment_status: "paid",
            payment_date: existingRecord.payment_date,
            record_id: existingRecord.record_id, // 기존 레코드 ID 보존
            preserve: true, // 이 필드로 기존 레코드임을 표시
          });
        } else if (currentDetail.hours && currentDetail.wage) {
          // 새로 입력된 유효한 데이터가 있는 경우
          processedWorkDetails.push({
            ...currentDetail,
            day,
            date: dateStr,
            payment_status: "unpaid",
            payment_date: null,
          });
        } else if (existingRecord && !currentDetail.hours && !currentDetail.wage) {
          // 기존에 있었으나 UI에서 비워진 경우 (삭제 케이스)
          // 아무것도 추가하지 않음 (삭제됨)
        } else if (existingRecord) {
          // 기존 레코드가 있고 payment_status가 paid가 아니면서 UI에서도 값이 있는 경우
          // (불완전한 수정 케이스)
          processedWorkDetails.push({
            ...currentDetail,
            day,
            date: dateStr,
            payment_status: existingRecord.payment_status || "unpaid",
            payment_date: existingRecord.payment_date,
          });
        }
      }

      // 저장할 유효한 레코드 필터링 (시간과 임금이 있는 레코드만)
      const validWorkDetails = processedWorkDetails.filter((detail) => detail.hours && detail.wage);

      // 저장할 데이터가 없는 경우
      if (validWorkDetails.length === 0) {
        set({ isLoading: false });
        return {
          success: false,
          message: "최소 하나 이상의 근무 기록을 입력해주세요.",
        };
      }

      // 총 근무일수, 평균 근무시간, 총 임금 계산 (모든 유효 레코드 기준)
      const totalWorkDays = validWorkDetails.length;
      const totalHours = validWorkDetails.reduce((sum, detail) => sum + Number(detail.hours), 0);
      const avgDailyWorkHours = totalWorkDays > 0 ? totalHours / totalWorkDays : 0;
      const totalWage = validWorkDetails.reduce(
        (sum, detail) => sum + parseNumber(detail.wage || 0),
        0
      );

      // 캐시 키 생성
      const cacheKey = `${workerId}-${siteId}-${yearMonth}`;
      const { workReports } = get();
      const existingReport = workReports[cacheKey]?.report;

      let reportId;

      // 3. 일용근로자 근로확인신고 보고서 처리
      if (existingReport) {
        // 기존 신고 데이터 업데이트
        const { error: updateError } = await supabase
          .from("daily_work_reports")
          .update({
            total_work_days: totalWorkDays,
            avg_daily_work_hours: avgDailyWorkHours,
            total_wage: totalWage,
            total_compensation: totalWage, // 과세소득은 일단 총 임금과 동일하게 설정
            total_paid_days: totalWorkDays, // 보수지급기초일수는 일단 총 근무일수와 동일하게 설정
            updated_at: new Date().toISOString(),
          })
          .eq("report_id", existingReport.report_id);

        if (updateError) throw updateError;

        reportId = existingReport.report_id;

        // 기존 상세 데이터 전체 삭제
        const { error: deleteDetailsError } = await supabase
          .from("daily_work_report_details")
          .delete()
          .eq("report_id", reportId);

        if (deleteDetailsError) throw deleteDetailsError;
      } else {
        // 새 신고 데이터 생성
        const { data: newReport, error: insertError } = await supabase
          .from("daily_work_reports")
          .insert({
            worker_id: workerId,
            site_id: siteId,
            report_month: yearMonth,
            insurance_type: "5", // 기본값: 산재보험 및 고용보험 모두
            total_work_days: totalWorkDays,
            avg_daily_work_hours: avgDailyWorkHours,
            total_wage: totalWage,
            total_compensation: totalWage,
            total_paid_days: totalWorkDays,
            payment_month: yearMonth,
            report_status: "draft",
          })
          .select();

        if (insertError) throw insertError;

        reportId = newReport[0].report_id;
      }

      // 4. 상세 데이터 생성 및 work_records 테이블 업데이트

      // 상세 데이터 생성 (전체 유효 레코드 - 지급완료 포함)
      const detailsToInsert = validWorkDetails.map((detail) => ({
        report_id: reportId,
        work_date: detail.date,
        work_hours: Number(detail.hours),
        daily_wage: parseNumber(detail.wage || 0),
      }));

      // 상세 데이터 삽입
      if (detailsToInsert.length > 0) {
        const { error: detailsError } = await supabase
          .from("daily_work_report_details")
          .insert(detailsToInsert);

        if (detailsError) throw detailsError;
      }

      // 5. work_records 테이블 처리
      // 보존할 레코드와 새로 추가할 레코드 분리
      const recordsToPreserve = validWorkDetails.filter((detail) => detail.preserve);
      const recordsToInsert = validWorkDetails.filter((detail) => !detail.preserve);

      // 보존할 레코드 ID 목록
      const recordIdsToPreserve = recordsToPreserve.map((detail) => detail.record_id);

      // 기존 레코드 중 보존할 ID 목록에 없는 것들 삭제
      if (existingRecords && existingRecords.length > 0) {
        const { error: deleteRecordsError } = await supabase
          .from("work_records")
          .delete()
          .eq("worker_id", workerId)
          .eq("site_id", siteId)
          .gte("work_date", startDate)
          .lt("work_date", endDate)
          .not("work_type", "eq", "registration")
          .not(
            "record_id",
            "in",
            recordIdsToPreserve.length > 0 ? `(${recordIdsToPreserve.join(",")})` : "(0)"
          );

        if (deleteRecordsError) throw deleteRecordsError;
      }

      // 새 레코드 삽입
      if (recordsToInsert.length > 0) {
        const workRecordsToInsert = recordsToInsert.map((detail) => {
          // 작업 유형 결정 - 함수 활용
          const workType = determineWorkType(detail.day, yearMonth, detail.extended, detail.night);

          // 메타데이터 생성 - 함수 활용
          const workTypeMetadata = JSON.stringify(
            createWorkTypeMetadata(detail.extended, detail.holiday, detail.night)
          );

          return {
            worker_id: workerId,
            site_id: siteId,
            work_date: detail.date,
            work_hours: Number(detail.hours),
            work_type: workType,
            work_type_metadata: workTypeMetadata,
            daily_wage: parseNumber(detail.wage || 0),
            status: "confirmed",
            registration_month: yearMonth,
            payment_status: "unpaid", // 항상 미지급 상태로 저장
            payment_date: null,
          };
        });

        const { error: insertWorkRecordsError } = await supabase
          .from("work_records")
          .insert(workRecordsToInsert);

        if (insertWorkRecordsError) throw insertWorkRecordsError;
      }

      // 6. 캐시 무효화 및 데이터 다시 로드
      set((state) => ({
        workReports: {
          ...state.workReports,
          [cacheKey]: undefined,
        },
      }));

      // workHistoryStore 캐시 무효화
      try {
        const workHistoryStore = require("@/lib/store/workHistoryStore").default;
        if (workHistoryStore) {
          console.log(`WorkHistoryStore 캐시 무효화: ${cacheKey}`);
          workHistoryStore.setState((state) => ({
            workersHistory: {
              ...state.workersHistory,
              [cacheKey]: undefined,
            },
          }));

          // forceCacheRefresh 함수가 있으면 호출
          if (typeof workHistoryStore.getState().forceCacheRefresh === "function") {
            workHistoryStore.getState().forceCacheRefresh(workerId, siteId, yearMonth);
          }
        }
      } catch (e) {
        console.error("WorkHistoryStore 캐시 무효화 실패:", e);
      }

      // insuranceStatusStore 캐시 무효화
      try {
        const insuranceStatusStore = require("@/lib/store/insuranceStatusStore").default;
        if (insuranceStatusStore) {
          console.log(`InsuranceStatusStore 캐시 무효화: ${cacheKey}`);
          insuranceStatusStore.setState((state) => ({
            insuranceStatus: {
              ...state.insuranceStatus,
              [cacheKey]: undefined,
            },
          }));

          // 다시 계산 강제 트리거
          setTimeout(() => {
            insuranceStatusStore.getState().loadInsuranceStatus(workerId, siteId, yearMonth);
          }, 100);
        }
      } catch (e) {
        console.error("InsuranceStatusStore 캐시 무효화 실패:", e);
      }

      // 전역 이벤트 발생 - 데이터 변경 알림
      try {
        // 로컬 스토리지를 통한 페이지 간 통신
        const timestamp = new Date().getTime();
        localStorage.setItem(
          "worktime_data_updated",
          JSON.stringify({
            workerId,
            siteId,
            yearMonth,
            timestamp,
          })
        );

        // 또는 커스텀 이벤트 발생
        if (typeof window !== "undefined") {
          const event = new CustomEvent("worktime_data_updated", {
            detail: { workerId, siteId, yearMonth, timestamp },
          });
          window.dispatchEvent(event);
        }
      } catch (e) {
        console.error("데이터 변경 알림 실패:", e);
      }

      // 캐시 무효화 후 로컬 데이터 다시 로드
      await get().fetchWorkReports(workerId, siteId, yearMonth);

      set({ isLoading: false });

      // 지급완료 항목이 있었으면 결과 메시지에 포함
      let message = "근무 기록이 저장되었습니다.";
      if (paidRecordsCount > 0) {
        message += ` (단, 지급완료된 ${paidRecordsCount}건의 기록은 수정되지 않았습니다.)`;
      }

      return {
        success: true,
        message: message,
      };
    } catch (error) {
      console.error("근무 기록 저장 오류:", error);
      set({ isLoading: false });
      return { success: false, message: `저장 중 오류가 발생했습니다: ${error.message}` };
    }
  },

  // 선택된 사이트 설정
  setSelectedSite: (siteId) => {
    set({ selectedSite: siteId });

    // 사이트가 변경되면 근로자 목록 다시 로드
    if (siteId) {
      get().fetchWorkers(siteId);
    } else {
      set({ workers: [] });
    }
  },

  // 선택된 년월 설정
  setYearMonth: (yearMonth) => {
    set({ yearMonth });

    // 년월이 변경되면 선택된 사이트의 근로자 목록 다시 로드
    const { selectedSite } = get();
    if (selectedSite) {
      get().fetchWorkers(selectedSite);
    }

    // 선택된 근로자가 있으면 근무 기록 다시 로드
    const { selectedWorker } = get();
    if (selectedWorker && selectedSite && yearMonth) {
      get().fetchWorkReports(selectedWorker, selectedSite, yearMonth);
    }
  },

  // 근무 기록의 특정 필드 값을 업데이트
  updateWorkDetail: (index, field, value) => {
    const { selectedWorker, selectedSite, yearMonth } = get();
    if (!selectedWorker || !selectedSite || !yearMonth) return;

    // 캐시 키 생성
    const cacheKey = `${selectedWorker}-${selectedSite}-${yearMonth}`;
    const { workReports } = get();

    if (!workReports[cacheKey]) return;

    // 근무 기록 복사본 생성
    const updatedWorkDetails = [...workReports[cacheKey].workDetails];

    // 필드에 따라 적절한 처리
    if (field === "hours") {
      // 숫자 입력만 허용
      const numericValue = value.replace(/[^0-9.]/g, "");
      updatedWorkDetails[index] = {
        ...updatedWorkDetails[index],
        hours: numericValue,
      };
    } else if (field === "wage") {
      // 숫자 입력만 허용하고 천 단위 콤마 추가
      const numericValue = value.replace(/[^0-9]/g, "");
      updatedWorkDetails[index] = {
        ...updatedWorkDetails[index],
        wage: formatNumber(numericValue),
      };
    } else {
      // boolean 값들 (extended, holiday, night)
      updatedWorkDetails[index] = {
        ...updatedWorkDetails[index],
        [field]: value,
      };
    }

    // 상태 업데이트
    set((state) => ({
      workReports: {
        ...state.workReports,
        [cacheKey]: {
          ...state.workReports[cacheKey],
          workDetails: updatedWorkDetails,
        },
      },
    }));

    // 변경 후 보험 상태 재계산 - 디바운스 처리
    const debounceTimer = setTimeout(() => {
      get().recalculateInsuranceStatus(selectedWorker, selectedSite, yearMonth);
    }, 500);

    return () => clearTimeout(debounceTimer);
  },

  // 근무 기록을 기반으로 4대보험 상태 재계산
  // Replace the recalculateInsuranceStatus function with this improved version
  // lib/store/workTimeStore.js의 recalculateInsuranceStatus 함수를 아래 코드로 대체
  // 근무 기록을 기반으로 4대보험 상태 재계산
  recalculateInsuranceStatus: async (workerId, siteId, yearMonth) => {
    if (!workerId || !siteId || !yearMonth) return;

    // 캐시 키 생성
    const workReportsCacheKey = `${workerId}-${siteId}-${yearMonth}`;
    const insuranceCacheKey = `${workerId}-${siteId}`;

    try {
      // 근무 기록 데이터 검증
      const { workReports } = get();
      if (!workReports[workReportsCacheKey] || !workReports[workReportsCacheKey].workDetails) {
        console.log(`No work reports found for cache key: ${workReportsCacheKey}`);
        return null;
      }

      const { workDetails } = workReports[workReportsCacheKey];

      // 1. 근무일수 계산 (근무시간과 임금이 모두 있는 날만 카운트)
      const workDays = workDetails.filter(
        (detail) =>
          detail &&
          detail.hours &&
          detail.wage &&
          parseFloat(detail.hours) > 0 &&
          parseNumber(detail.wage) > 0
      ).length;

      // 2. 총 근무시간 계산
      const totalHours = workDetails.reduce((sum, detail) => {
        return sum + (detail && detail.hours ? parseFloat(detail.hours) || 0 : 0);
      }, 0);

      console.log("Calculated work data:", { workDays, totalHours });

      // 3. 기본 보험 상태 설정
      const newStatus = {
        national_pension: "해당사항없음",
        health_insurance: "해당사항없음",
        employment_insurance: "가입상태", // 고용보험은 항상 적용
        industrial_accident: "가입상태", // 산재보험은 항상 적용
      };

      // 4. 현재 가입 정보 확인
      try {
        const { data, error } = await supabase
          .from("insurance_enrollments")
          .select(
            `
          enrollment_id,
          worker_id,
          site_id,
          year_month,
          national_pension_status,
          health_insurance_status,
          employment_insurance_status,
          industrial_accident_status,
          national_pension_acquisition_date,
          health_insurance_acquisition_date,
          employment_insurance_acquisition_date,
          industrial_accident_acquisition_date,
          national_pension_loss_date,
          health_insurance_loss_date,
          employment_insurance_loss_date,
          industrial_accident_loss_date,
          created_at,
          updated_at
        `
          )
          .eq("worker_id", workerId)
          .eq("site_id", siteId);

        if (error) {
          console.warn("Error fetching insurance enrollments:", error.message);
        } else if (data && data.length > 0) {
          // 가장 최근 등록 정보 사용
          const latestEnrollment = data.sort((a, b) => {
            const dateA = new Date(a.updated_at || a.created_at || 0);
            const dateB = new Date(b.updated_at || b.created_at || 0);
            return dateB - dateA; // 내림차순 정렬 (최신순)
          })[0];

          // 이미 가입된 상태인지 확인
          if (
            latestEnrollment.national_pension_acquisition_date &&
            !latestEnrollment.national_pension_loss_date
          ) {
            newStatus.national_pension = "가입상태";
          }

          if (
            latestEnrollment.health_insurance_acquisition_date &&
            !latestEnrollment.health_insurance_loss_date
          ) {
            newStatus.health_insurance = "가입상태";
          }

          if (
            latestEnrollment.employment_insurance_acquisition_date &&
            !latestEnrollment.employment_insurance_loss_date
          ) {
            newStatus.employment_insurance = "가입상태";
          }

          if (
            latestEnrollment.industrial_accident_acquisition_date &&
            !latestEnrollment.industrial_accident_loss_date
          ) {
            newStatus.industrial_accident = "가입상태";
          }
        }
      } catch (enrollmentError) {
        console.warn("Exception in enrollment query:", enrollmentError.message);
        // 기본 상태로 계속 진행
      }

      // 5. 근무 이력 기반으로 가입 필요 여부 판단

      // 국민연금: 8일 이상 근무하면 가입 대상
      if (workDays >= 8 && newStatus.national_pension !== "가입상태") {
        newStatus.national_pension = "가입대상";
      }

      // 건강보험: 60시간 이상 또는 8일 이상 근무하면 가입 대상
      if ((totalHours >= 60 || workDays >= 8) && newStatus.health_insurance !== "가입상태") {
        newStatus.health_insurance = "가입대상";
      }

      // 6. 캐시 업데이트
      set((state) => ({
        insuranceStatus: {
          ...state.insuranceStatus,
          [insuranceCacheKey]: newStatus,
        },
      }));

      console.log("Updated insurance status:", newStatus);
      return newStatus;
    } catch (error) {
      // 개선된 오류 로깅
      console.error("4대보험 상태 재계산 오류:", {
        message: error.message || "Unknown error",
        stack: error.stack,
        workerId,
        siteId,
        yearMonth,
      });

      return null;
    }
  },
  // 특정 record_id의 캐시된 상태를 강제로 업데이트하는 함수
  updateCachedRecordStatus: (recordId, newStatus) => {
    // 모든 캐시된 workReports를 확인
    Object.keys(get().workReports).forEach((cacheKey) => {
      const reportData = get().workReports[cacheKey];
      if (reportData && reportData.workDetails) {
        // workDetails 내의 모든 데이터 확인
        let updated = false;
        const updatedDetails = reportData.workDetails.map((detail) => {
          // record_id가 일치하는지 확인 (이 필드가 있다면)
          if (detail.record_id === recordId) {
            updated = true;
            return { ...detail, payment_status: newStatus };
          }
          return detail;
        });

        // 변경사항이 있으면 상태 업데이트
        if (updated) {
          set((state) => ({
            workReports: {
              ...state.workReports,
              [cacheKey]: {
                ...reportData,
                workDetails: updatedDetails,
              },
            },
          }));
        }
      }
    });
  },
}));

export default useWorkTimeStore;
