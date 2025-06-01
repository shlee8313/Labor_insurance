// lib/store/workHistoryStore.js
import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { getPreviousYearMonthFromSelected } from "@/lib/utils/dateUtils";
import { parseNumber } from "@/lib/utils/formattingUtils";

/*
=== DB 트리거 함수들 ===
1. calculate_work_hours_and_allowances(): 근무시간과 수당을 자동 계산
   - work_hours = regular_hours + overtime_hours + night_hours + holiday_hours
   - 시급 기반 수당 자동 계산:
     * overtime_allowance = overtime_hours × hourly_rate × 0.5
     * night_allowance = night_hours × hourly_rate × 0.5
     * holiday_allowance = holiday_hours × hourly_rate × 0.5
   - work_type_metadata JSON 자동 생성

2. update_daily_work_report_totals(): daily_work_reports 총계 자동 업데이트
   - daily_work_report_details 변경 시 모든 총계 필드 자동 재계산
   - 세분화된 시간 총계: total_regular_hours, total_overtime_hours, total_night_hours, total_holiday_hours
   - 수당 총계: total_overtime_allowance, total_night_allowance, total_holiday_allowance
   - 세금/공제 총계: total_income_tax, total_local_income_tax, total_national_pension 등
*/

/**
 * 근무 이력 관리를 위한 스토어
 */
const useWorkHistoryStore = create((set, get) => ({
  // 상태
  workersHistory: {},
  prevMonthWork: {},
  isLoading: false,
  isReportLoading: false,
  error: null,

  // 🔥 근로자별 근무 이력 로드 - 세분화된 시간 정보 포함
  loadWorkersHistory: async (workerId, siteId, yearMonth) => {
    if (!workerId || !siteId || !yearMonth) {
      console.warn("loadWorkersHistory 필수 매개변수가 누락되었습니다");
      return null;
    }

    try {
      console.log(
        `worker ${workerId}, site ${siteId}, yearMonth ${yearMonth}에 대한 근무 이력 로드 중...`
      );
      set({ isLoading: true, error: null });

      const cacheKey = `${workerId}-${siteId}-${yearMonth}`;
      const { workersHistory } = get();
      console.log(`캐시 키 ${cacheKey}에 대한 데이터 확인 중...`);

      // 캐시된 데이터가 있으면 반환
      if (workersHistory[cacheKey]) {
        set({ isLoading: false });
        return workersHistory[cacheKey];
      }

      // 이전 달과 현재 달 데이터를 병렬로 로드
      console.log("이전 달 및 현재 달 데이터 로드 중...");
      const [prevMonthData, currentMonthData, firstWorkDate] = await Promise.all([
        get().loadPreviousMonthRecords(workerId, siteId, yearMonth),
        get().loadCurrentMonthRecords(workerId, siteId, yearMonth),
        get().findFirstWorkDate(workerId, siteId),
      ]);

      console.log("데이터 로드됨:", {
        prevMonth: prevMonthData,
        currentMonth: currentMonthData,
        firstWorkDate,
      });

      // 🔥 세분화된 시간 정보를 포함한 결과 구성
      const historyData = {
        // 이전월 정보
        previousMonthWorkDays: prevMonthData?.workDays || 0,
        previousMonthWorkHours: prevMonthData?.workHours || 0,
        previousMonthRegularHours: prevMonthData?.regularHours || 0,
        previousMonthOvertimeHours: prevMonthData?.overtimeHours || 0,
        previousMonthNightHours: prevMonthData?.nightHours || 0,
        previousMonthHolidayHours: prevMonthData?.holidayHours || 0,
        isPreviousMonthRegistered: prevMonthData?.isRegistered || false,
        firstWorkDate: prevMonthData?.firstWorkDate || firstWorkDate,

        // 현재월 정보
        currentMonthWorkDays: currentMonthData?.workDays || 0,
        currentMonthWorkHours: currentMonthData?.workHours || 0,
        currentMonthRegularHours: currentMonthData?.regularHours || 0,
        currentMonthOvertimeHours: currentMonthData?.overtimeHours || 0,
        currentMonthNightHours: currentMonthData?.nightHours || 0,
        currentMonthHolidayHours: currentMonthData?.holidayHours || 0,
        monthlyWage: currentMonthData?.monthlyWage || 0,

        // 🔥 수당 정보 (DB에서 자동 계산됨)
        totalOvertimeAllowance: currentMonthData?.totalOvertimeAllowance || 0,
        totalNightAllowance: currentMonthData?.totalNightAllowance || 0,
        totalHolidayAllowance: currentMonthData?.totalHolidayAllowance || 0,
        totalExtraAllowance: currentMonthData?.totalExtraAllowance || 0,

        // 🔥 세금/공제 정보 (DB에서 자동 계산됨)
        totalIncomeTax: currentMonthData?.totalIncomeTax || 0,
        totalLocalTax: currentMonthData?.totalLocalTax || 0,
        totalNationalPension: currentMonthData?.totalNationalPension || 0,
        totalHealthInsurance: currentMonthData?.totalHealthInsurance || 0,
        totalEmploymentInsurance: currentMonthData?.totalEmploymentInsurance || 0,
        totalIndustrialAccident: currentMonthData?.totalIndustrialAccident || 0,
        totalLongTermCare: currentMonthData?.totalLongTermCare || 0,
        totalOtherDeductions: currentMonthData?.totalOtherDeductions || 0,

        // 🔥 지급 관련 정보
        lastWorkDateThisMonth: currentMonthData?.lastWorkDateThisMonth || null,
        isRegisteredInCurrentMonth: currentMonthData?.isRegistered || false,
      };

      console.log(`캐시에 작업자 이력 데이터 저장 (${cacheKey}):`, historyData);

      // 캐시 업데이트
      set((state) => ({
        workersHistory: {
          ...state.workersHistory,
          [cacheKey]: historyData,
        },
        isLoading: false,
      }));

      return historyData;
    } catch (error) {
      console.error("loadWorkersHistory 오류:", error);
      set({ isLoading: false, error: error.message });
      return null;
    }
  },

  // 여러 근로자의 근무 이력을 로드
  loadMultipleWorkersHistory: async (workersList, siteId, yearMonth) => {
    if (!workersList || !siteId || !yearMonth) return {};

    try {
      set({ isLoading: true, error: null });

      // 병렬 처리를 위한 Promise 배열
      const historyPromises = workersList.map((worker) =>
        get().loadWorkersHistory(worker.worker_id, siteId, yearMonth)
      );

      // 모든 Promise 병렬 처리 후 결과 취합
      const results = await Promise.all(historyPromises);

      // 결과 데이터 매핑
      const historyData = {};
      workersList.forEach((worker, index) => {
        if (results[index]) {
          historyData[worker.worker_id] = results[index];
        }
      });

      set({ isLoading: false });
      return historyData;
    } catch (error) {
      console.error("다중 근로자 이력 로드 오류:", error);
      set({ isLoading: false, error: error.message });
      return {};
    }
  },

  // 🔥 이전 월 근무 데이터 조회 - 세분화된 시간 정보 포함
  loadPreviousMonthRecords: async (workerId, siteId, yearMonth) => {
    const dateInfo = getPreviousYearMonthFromSelected(
      yearMonth.split("-")[0],
      yearMonth.split("-")[1]
    );

    const prevYearMonth = dateInfo.prevYearMonth;
    const prevMonthStart = `${prevYearMonth}-01`;
    const currentMonthStart = `${dateInfo.currentYearMonth}-01`;

    const cacheKey = `${workerId}-${siteId}-${prevYearMonth}`;
    const { prevMonthWork } = get();
    if (prevMonthWork[cacheKey]) {
      return prevMonthWork[cacheKey];
    }

    try {
      // 🔥 세분화된 시간 필드들과 수당 정보 포함하여 조회
      let { data: workRecordsData, error: workError } = await supabase
        .from("work_records")
        .select(
          `
          worker_id, work_date, work_hours, daily_wage, status, registration_month,
          regular_hours, overtime_hours, night_hours, holiday_hours,
          overtime_allowance, night_allowance, holiday_allowance, extra_allowance,
          income_tax, local_income_tax,
          national_pension, health_insurance, employment_insurance, 
          industrial_accident, long_term_care, other_deductions
        `
        )
        .eq("site_id", siteId)
        .eq("worker_id", workerId)
        .gte("work_date", prevMonthStart)
        .lt("work_date", currentMonthStart);

      if (workError) {
        console.error("이전월 근무 데이터 조회 오류:", workError);
        throw workError;
      }

      // 결과가 없는 경우 registration_month로 조회
      if (!workRecordsData || workRecordsData.length === 0) {
        const { data: regMonthData, error: regMonthError } = await supabase
          .from("work_records")
          .select(
            `
            worker_id, work_date, work_hours, daily_wage, status, registration_month,
            regular_hours, overtime_hours, night_hours, holiday_hours,
            overtime_allowance, night_allowance, holiday_allowance, extra_allowance,
            income_tax, local_income_tax,
            national_pension, health_insurance, employment_insurance, 
            industrial_accident, long_term_care, other_deductions
          `
          )
          .eq("site_id", siteId)
          .eq("worker_id", workerId)
          .eq("registration_month", prevYearMonth);

        if (!regMonthError && regMonthData && regMonthData.length > 0) {
          workRecordsData = regMonthData;
        }
      }

      // 등록 여부 확인
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

      // 🔥 세분화된 데이터 계산
      const workDays = workRecords.length;
      const workHours = workRecords.reduce((sum, r) => sum + (parseFloat(r.work_hours) || 0), 0);
      const regularHours = workRecords.reduce(
        (sum, r) => sum + (parseFloat(r.regular_hours) || 0),
        0
      );
      const overtimeHours = workRecords.reduce(
        (sum, r) => sum + (parseFloat(r.overtime_hours) || 0),
        0
      );
      const nightHours = workRecords.reduce((sum, r) => sum + (parseFloat(r.night_hours) || 0), 0);
      const holidayHours = workRecords.reduce(
        (sum, r) => sum + (parseFloat(r.holiday_hours) || 0),
        0
      );
      const monthlyWage = workRecords.reduce((sum, r) => sum + (parseFloat(r.daily_wage) || 0), 0);

      // 🔥 수당 합계 (DB에서 자동 계산된 값들)
      const totalOvertimeAllowance = workRecords.reduce(
        (sum, r) => sum + (parseFloat(r.overtime_allowance) || 0),
        0
      );
      const totalNightAllowance = workRecords.reduce(
        (sum, r) => sum + (parseFloat(r.night_allowance) || 0),
        0
      );
      const totalHolidayAllowance = workRecords.reduce(
        (sum, r) => sum + (parseFloat(r.holiday_allowance) || 0),
        0
      );
      const totalExtraAllowance = workRecords.reduce(
        (sum, r) => sum + (parseFloat(r.extra_allowance) || 0),
        0
      );

      // 🔥 세금/공제 합계 (DB에서 자동 계산된 값들)
      const totalIncomeTax = workRecords.reduce(
        (sum, r) => sum + (parseFloat(r.income_tax) || 0),
        0
      );
      const totalLocalTax = workRecords.reduce(
        (sum, r) => sum + (parseFloat(r.local_income_tax) || 0),
        0
      );
      const totalNationalPension = workRecords.reduce(
        (sum, r) => sum + (parseFloat(r.national_pension) || 0),
        0
      );
      const totalHealthInsurance = workRecords.reduce(
        (sum, r) => sum + (parseFloat(r.health_insurance) || 0),
        0
      );
      const totalEmploymentInsurance = workRecords.reduce(
        (sum, r) => sum + (parseFloat(r.employment_insurance) || 0),
        0
      );
      const totalIndustrialAccident = workRecords.reduce(
        (sum, r) => sum + (parseFloat(r.industrial_accident) || 0),
        0
      );
      const totalLongTermCare = workRecords.reduce(
        (sum, r) => sum + (parseFloat(r.long_term_care) || 0),
        0
      );
      const totalOtherDeductions = workRecords.reduce(
        (sum, r) => sum + (parseFloat(r.other_deductions) || 0),
        0
      );

      const isRegistered = registrationData && registrationData.length > 0;

      // 첫 근무일 확인
      const firstWorkDate =
        workRecords.length > 0
          ? workRecords.sort((a, b) => new Date(a.work_date) - new Date(b.work_date))[0].work_date
          : null;

      const result = {
        workDays,
        workHours,
        // 🔥 세분화된 시간 정보
        regularHours,
        overtimeHours,
        nightHours,
        holidayHours,
        firstWorkDate,
        monthlyWage,
        // 🔥 수당 정보 (DB 자동 계산)
        totalOvertimeAllowance,
        totalNightAllowance,
        totalHolidayAllowance,
        totalExtraAllowance,
        // 🔥 세금/공제 정보 (DB 자동 계산)
        totalIncomeTax,
        totalLocalTax,
        totalNationalPension,
        totalHealthInsurance,
        totalEmploymentInsurance,
        totalIndustrialAccident,
        totalLongTermCare,
        totalOtherDeductions,
        isRegistered,
      };

      // 캐시에 추가
      set((state) => ({
        prevMonthWork: { ...state.prevMonthWork, [cacheKey]: result },
      }));

      return result;
    } catch (error) {
      console.error("이전 월 근무 데이터 처리 오류:", error);
      return {
        workDays: 0,
        workHours: 0,
        regularHours: 0,
        overtimeHours: 0,
        nightHours: 0,
        holidayHours: 0,
        firstWorkDate: null,
        monthlyWage: 0,
        totalOvertimeAllowance: 0,
        totalNightAllowance: 0,
        totalHolidayAllowance: 0,
        totalExtraAllowance: 0,
        totalIncomeTax: 0,
        totalLocalTax: 0,
        totalNationalPension: 0,
        totalHealthInsurance: 0,
        totalEmploymentInsurance: 0,
        totalIndustrialAccident: 0,
        totalLongTermCare: 0,
        totalOtherDeductions: 0,
        isRegistered: false,
      };
    }
  },

  // 🔥 선택 월 근무 데이터 조회 - 세분화된 시간 정보 포함
  loadCurrentMonthRecords: async (workerId, siteId, yearMonth) => {
    try {
      const dateInfo = getPreviousYearMonthFromSelected(
        yearMonth.split("-")[0],
        yearMonth.split("-")[1]
      );

      const startDate = `${dateInfo.currentYearMonth}-01`;
      const endDate = `${dateInfo.nextYearMonth}-01`;

      console.log(`근무 기록 로드 시작 - 근로자: ${workerId}, 현장: ${siteId}, 연월: ${yearMonth}`);
      console.log(`날짜 범위: ${startDate} ~ ${endDate}`);

      // 🔥 세분화된 시간 필드들과 수당, 세금/공제 정보 포함하여 조회
      const { data: workDateRecords, error: workDateError } = await supabase
        .from("work_records")
        .select(
          `
          worker_id, work_date, work_hours, daily_wage, status,
          regular_hours, overtime_hours, night_hours, holiday_hours,
          overtime_allowance, night_allowance, holiday_allowance, extra_allowance,
          tax_exemption_amount, income_tax, local_income_tax,
          national_pension, health_insurance, employment_insurance, 
          industrial_accident, long_term_care, other_deductions,
          payment_status, payment_date, payment_method, payment_memo
        `
        )
        .eq("site_id", siteId)
        .eq("worker_id", workerId)
        .gte("work_date", startDate)
        .lt("work_date", endDate);

      if (workDateError) throw workDateError;

      // 등록월 기반 조회도 함께 수행
      const { data: regMonthRecords, error: regMonthError } = await supabase
        .from("work_records")
        .select(
          `
          worker_id, work_date, work_hours, daily_wage, status,
          regular_hours, overtime_hours, night_hours, holiday_hours,
          overtime_allowance, night_allowance, holiday_allowance, extra_allowance,
          tax_exemption_amount, income_tax, local_income_tax,
          national_pension, health_insurance, employment_insurance, 
          industrial_accident, long_term_care, other_deductions,
          payment_status, payment_date, payment_method, payment_memo
        `
        )
        .eq("site_id", siteId)
        .eq("worker_id", workerId)
        .eq("registration_month", yearMonth);

      if (regMonthError) throw regMonthError;

      // 중복 없이 모든 기록 합치기
      const allRecords = [...(workDateRecords || []), ...(regMonthRecords || [])];

      // 중복 제거
      const uniqueRecords = new Set();
      const workRecords = [];

      allRecords.forEach((record) => {
        const recordKey = `${record.work_date}`;
        if (!uniqueRecords.has(recordKey) && record.status !== "registration") {
          uniqueRecords.add(recordKey);
          workRecords.push(record);
        }
      });

      // 등록 여부 확인
      const { data: regData, error: regError } = await supabase
        .from("work_records")
        .select("worker_id, status")
        .eq("site_id", siteId)
        .eq("worker_id", workerId)
        .eq("registration_month", yearMonth)
        .eq("status", "registration")
        .maybeSingle();

      if (regError && regError.code !== "PGRST116") throw regError;

      // 🔥 이번달 마지막 근무일 조회
      let lastWorkDateThisMonth = null;
      if (workRecords && workRecords.length > 0) {
        const sortedRecords = [...workRecords].sort(
          (a, b) => new Date(b.work_date).getTime() - new Date(a.work_date).getTime()
        );
        lastWorkDateThisMonth = sortedRecords[0].work_date;
        console.log(`이번달 마지막 근무일: ${lastWorkDateThisMonth}`);
      }

      // 🔥 세분화된 데이터 계산
      const workDays = workRecords.length;
      const workHours = workRecords.reduce((sum, r) => sum + parseFloat(r.work_hours || 0), 0);
      const regularHours = workRecords.reduce(
        (sum, r) => sum + parseFloat(r.regular_hours || 0),
        0
      );
      const overtimeHours = workRecords.reduce(
        (sum, r) => sum + parseFloat(r.overtime_hours || 0),
        0
      );
      const nightHours = workRecords.reduce((sum, r) => sum + parseFloat(r.night_hours || 0), 0);
      const holidayHours = workRecords.reduce(
        (sum, r) => sum + parseFloat(r.holiday_hours || 0),
        0
      );
      const monthlyWage = workRecords.reduce((sum, r) => sum + parseFloat(r.daily_wage || 0), 0);

      // 🔥 수당 합계 (DB에서 자동 계산된 값들)
      const totalOvertimeAllowance = workRecords.reduce(
        (sum, r) => sum + parseFloat(r.overtime_allowance || 0),
        0
      );
      const totalNightAllowance = workRecords.reduce(
        (sum, r) => sum + parseFloat(r.night_allowance || 0),
        0
      );
      const totalHolidayAllowance = workRecords.reduce(
        (sum, r) => sum + parseFloat(r.holiday_allowance || 0),
        0
      );
      const totalExtraAllowance = workRecords.reduce(
        (sum, r) => sum + parseFloat(r.extra_allowance || 0),
        0
      );

      // 🔥 세금/공제 합계 (DB에서 자동 계산된 값들)
      const totalTaxExemption = workRecords.reduce(
        (sum, r) => sum + parseFloat(r.tax_exemption_amount || 0),
        0
      );
      const totalIncomeTax = workRecords.reduce((sum, r) => sum + parseFloat(r.income_tax || 0), 0);
      const totalLocalTax = workRecords.reduce(
        (sum, r) => sum + parseFloat(r.local_income_tax || 0),
        0
      );
      const totalNationalPension = workRecords.reduce(
        (sum, r) => sum + parseFloat(r.national_pension || 0),
        0
      );
      const totalHealthInsurance = workRecords.reduce(
        (sum, r) => sum + parseFloat(r.health_insurance || 0),
        0
      );
      const totalEmploymentInsurance = workRecords.reduce(
        (sum, r) => sum + parseFloat(r.employment_insurance || 0),
        0
      );
      const totalIndustrialAccident = workRecords.reduce(
        (sum, r) => sum + parseFloat(r.industrial_accident || 0),
        0
      );
      const totalLongTermCare = workRecords.reduce(
        (sum, r) => sum + parseFloat(r.long_term_care || 0),
        0
      );
      const totalOtherDeductions = workRecords.reduce(
        (sum, r) => sum + parseFloat(r.other_deductions || 0),
        0
      );

      const isRegistered = regData !== null;

      // 디버깅 로그
      console.log("work_records 데이터:", {
        workDateRecords: workDateRecords || [],
        regMonthRecords: regMonthRecords || [],
        allRecords: allRecords || [],
        workRecords: workRecords || [],
        결과: {
          workDays,
          workHours,
          regularHours,
          overtimeHours,
          nightHours,
          holidayHours,
          monthlyWage,
          isRegistered,
          lastWorkDateThisMonth,
          // 수당 정보
          totalOvertimeAllowance,
          totalNightAllowance,
          totalHolidayAllowance,
          totalExtraAllowance,
          // 세금/공제 정보
          totalIncomeTax,
          totalLocalTax,
          totalNationalPension,
          totalHealthInsurance,
          totalEmploymentInsurance,
          totalIndustrialAccident,
          totalLongTermCare,
          totalOtherDeductions,
        },
      });

      return {
        workDays,
        workHours,
        // 🔥 세분화된 시간 정보
        regularHours,
        overtimeHours,
        nightHours,
        holidayHours,
        monthlyWage,
        // 🔥 수당 정보 (DB 자동 계산)
        totalOvertimeAllowance,
        totalNightAllowance,
        totalHolidayAllowance,
        totalExtraAllowance,
        // 🔥 세금/공제 정보 (DB 자동 계산)
        totalTaxExemption,
        totalIncomeTax,
        totalLocalTax,
        totalNationalPension,
        totalHealthInsurance,
        totalEmploymentInsurance,
        totalIndustrialAccident,
        totalLongTermCare,
        totalOtherDeductions,
        isRegistered,
        lastWorkDateThisMonth,
      };
    } catch (error) {
      console.error(`근무 기록 로드 오류(ID: ${workerId}, 연월: ${yearMonth}):`, error);
      return {
        workDays: 0,
        workHours: 0,
        regularHours: 0,
        overtimeHours: 0,
        nightHours: 0,
        holidayHours: 0,
        monthlyWage: 0,
        totalOvertimeAllowance: 0,
        totalNightAllowance: 0,
        totalHolidayAllowance: 0,
        totalExtraAllowance: 0,
        totalTaxExemption: 0,
        totalIncomeTax: 0,
        totalLocalTax: 0,
        totalNationalPension: 0,
        totalHealthInsurance: 0,
        totalEmploymentInsurance: 0,
        totalIndustrialAccident: 0,
        totalLongTermCare: 0,
        totalOtherDeductions: 0,
        isRegistered: false,
        lastWorkDateThisMonth: null,
      };
    }
  },

  // 최초 근무일 찾기
  findFirstWorkDate: async (workerId, siteId) => {
    try {
      const { data, error } = await supabase
        .from("work_records")
        .select("work_date, status")
        .eq("site_id", siteId)
        .eq("worker_id", workerId)
        .neq("status", "registration")
        .order("work_date", { ascending: true })
        .limit(1);

      if (error) {
        console.error("최초 근무일 조회 오류:", error);
        throw error;
      }

      return data && data.length > 0 ? data[0].work_date : null;
    } catch (error) {
      console.error("최초 근무일 조회 처리 오류:", error);
      return null;
    }
  },

  // 🔥 월간 보고서 집계 - 세분화된 시간 정보 포함
  getMonthlyReport: async (siteId, yearMonth) => {
    if (!siteId || !yearMonth) return null;

    try {
      set({ isLoading: true, error: null });

      const dateInfo = getPreviousYearMonthFromSelected(
        yearMonth.split("-")[0],
        yearMonth.split("-")[1]
      );

      const startDate = `${dateInfo.currentYearMonth}-01`;
      const endDate = `${dateInfo.nextYearMonth}-01`;

      // 🔥 세분화된 시간과 수당 정보를 포함하여 조회
      const { data, error } = await supabase
        .from("work_records")
        .select(
          `
          worker_id, work_date, work_hours, daily_wage, status,
          regular_hours, overtime_hours, night_hours, holiday_hours,
          overtime_allowance, night_allowance, holiday_allowance, extra_allowance,
          income_tax, local_income_tax,
          national_pension, health_insurance, employment_insurance, 
          industrial_accident, long_term_care, other_deductions,
          workers(name, resident_number)
        `
        )
        .eq("site_id", siteId)
        .gte("work_date", startDate)
        .lt("work_date", endDate)
        .neq("status", "registration");

      if (error) throw error;

      // 🔥 근로자별로 세분화된 정보 집계
      const reportByWorker = {};

      if (data && data.length > 0) {
        data.forEach((record) => {
          const workerId = record.worker_id;

          if (!reportByWorker[workerId]) {
            reportByWorker[workerId] = {
              workerId,
              name: record.workers?.name || "미상",
              workDays: 0,
              workHours: 0,
              // 🔥 세분화된 시간 합계
              regularHours: 0,
              overtimeHours: 0,
              nightHours: 0,
              holidayHours: 0,
              totalWage: 0,
              // 🔥 수당 합계 (DB 자동 계산)
              totalOvertimeAllowance: 0,
              totalNightAllowance: 0,
              totalHolidayAllowance: 0,
              totalExtraAllowance: 0,
              // 🔥 세금/공제 합계 (DB 자동 계산)
              totalIncomeTax: 0,
              totalLocalTax: 0,
              totalNationalPension: 0,
              totalHealthInsurance: 0,
              totalEmploymentInsurance: 0,
              totalIndustrialAccident: 0,
              totalLongTermCare: 0,
              totalOtherDeductions: 0,
              records: [],
            };
          }

          const workerReport = reportByWorker[workerId];

          workerReport.workDays++;
          workerReport.workHours += parseFloat(record.work_hours || 0);
          // 🔥 세분화된 시간 집계
          workerReport.regularHours += parseFloat(record.regular_hours || 0);
          workerReport.overtimeHours += parseFloat(record.overtime_hours || 0);
          workerReport.nightHours += parseFloat(record.night_hours || 0);
          workerReport.holidayHours += parseFloat(record.holiday_hours || 0);
          workerReport.totalWage += parseFloat(record.daily_wage || 0);

          // 🔥 수당 집계 (DB 자동 계산)
          workerReport.totalOvertimeAllowance += parseFloat(record.overtime_allowance || 0);
          workerReport.totalNightAllowance += parseFloat(record.night_allowance || 0);
          workerReport.totalHolidayAllowance += parseFloat(record.holiday_allowance || 0);
          workerReport.totalExtraAllowance += parseFloat(record.extra_allowance || 0);

          // 🔥 세금/공제 집계 (DB 자동 계산)
          workerReport.totalIncomeTax += parseFloat(record.income_tax || 0);
          workerReport.totalLocalTax += parseFloat(record.local_income_tax || 0);
          workerReport.totalNationalPension += parseFloat(record.national_pension || 0);
          workerReport.totalHealthInsurance += parseFloat(record.health_insurance || 0);
          workerReport.totalEmploymentInsurance += parseFloat(record.employment_insurance || 0);
          workerReport.totalIndustrialAccident += parseFloat(record.industrial_accident || 0);
          workerReport.totalLongTermCare += parseFloat(record.long_term_care || 0);
          workerReport.totalOtherDeductions += parseFloat(record.other_deductions || 0);

          workerReport.records.push(record);
        });
      }

      // 🔥 전체 집계 (세분화된 정보 포함)
      const totalReport = {
        totalWorkers: Object.keys(reportByWorker).length,
        totalWorkDays: Object.values(reportByWorker).reduce((sum, w) => sum + w.workDays, 0),
        totalWorkHours: Object.values(reportByWorker).reduce((sum, w) => sum + w.workHours, 0),
        // 🔥 세분화된 시간 전체 합계
        totalRegularHours: Object.values(reportByWorker).reduce(
          (sum, w) => sum + w.regularHours,
          0
        ),
        totalOvertimeHours: Object.values(reportByWorker).reduce(
          (sum, w) => sum + w.overtimeHours,
          0
        ),
        totalNightHours: Object.values(reportByWorker).reduce((sum, w) => sum + w.nightHours, 0),
        totalHolidayHours: Object.values(reportByWorker).reduce(
          (sum, w) => sum + w.holidayHours,
          0
        ),
        totalWage: Object.values(reportByWorker).reduce((sum, w) => sum + w.totalWage, 0),
        // 🔥 수당 전체 합계 (DB 자동 계산)
        totalOvertimeAllowance: Object.values(reportByWorker).reduce(
          (sum, w) => sum + w.totalOvertimeAllowance,
          0
        ),
        totalNightAllowance: Object.values(reportByWorker).reduce(
          (sum, w) => sum + w.totalNightAllowance,
          0
        ),
        totalHolidayAllowance: Object.values(reportByWorker).reduce(
          (sum, w) => sum + w.totalHolidayAllowance,
          0
        ),
        totalExtraAllowance: Object.values(reportByWorker).reduce(
          (sum, w) => sum + w.totalExtraAllowance,
          0
        ),
        // 🔥 세금/공제 전체 합계 (DB 자동 계산)
        totalIncomeTax: Object.values(reportByWorker).reduce((sum, w) => sum + w.totalIncomeTax, 0),
        totalLocalTax: Object.values(reportByWorker).reduce((sum, w) => sum + w.totalLocalTax, 0),
        totalNationalPension: Object.values(reportByWorker).reduce(
          (sum, w) => sum + w.totalNationalPension,
          0
        ),
        totalHealthInsurance: Object.values(reportByWorker).reduce(
          (sum, w) => sum + w.totalHealthInsurance,
          0
        ),
        totalEmploymentInsurance: Object.values(reportByWorker).reduce(
          (sum, w) => sum + w.totalEmploymentInsurance,
          0
        ),
        totalIndustrialAccident: Object.values(reportByWorker).reduce(
          (sum, w) => sum + w.totalIndustrialAccident,
          0
        ),
        totalLongTermCare: Object.values(reportByWorker).reduce(
          (sum, w) => sum + w.totalLongTermCare,
          0
        ),
        totalOtherDeductions: Object.values(reportByWorker).reduce(
          (sum, w) => sum + w.totalOtherDeductions,
          0
        ),
        workerReports: reportByWorker,
      };

      set({ isLoading: false });
      return totalReport;
    } catch (error) {
      console.error("월간 보고서 집계 오류:", error);
      set({ isLoading: false, error: error.message });
      return null;
    }
  },

  // 근무 이력 캐시 강제 초기화
  forceCacheRefresh: (workerId, siteId, yearMonth) => {
    if (!workerId || !siteId || !yearMonth) return false;

    console.log(`강제 캐시 초기화: ${workerId}-${siteId}-${yearMonth}`);

    const cacheKey = `${workerId}-${siteId}-${yearMonth}`;

    // 캐시 무효화
    set((state) => ({
      workersHistory: {
        ...state.workersHistory,
        [cacheKey]: undefined,
      },
    }));

    return true;
  },

  resetStore: () =>
    set({
      workersHistory: {},
      prevMonthWork: {},
      isLoading: false,
      isReportLoading: false,
      error: null,
    }),

  // 오류 지우기
  clearError: () => set({ error: null }),
}));

export default useWorkHistoryStore;

/**
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 *
 */

// // lib/store/workHistoryStore.js
// import { create } from "zustand";
// import { supabase } from "@/lib/supabase";
// import { getPreviousYearMonthFromSelected } from "@/lib/utils/dateUtils";
// import { parseNumber } from "@/lib/utils/formattingUtils";

// /**
//  * 근무 이력 관리를 위한 스토어
//  */
// const useWorkHistoryStore = create((set, get) => ({
//   // 상태
//   workersHistory: {},
//   prevMonthWork: {},
//   isLoading: false,
//   isReportLoading: false,
//   error: null,

//   // 근로자별 근무 이력 로드
//   // 근로자별 근무 이력 로드 (수정된 버전)
//   // lib/store/workHistoryStore.js 파일에서
//   // In useWorkHistoryStore (workHistoryStore.js)
//   loadWorkersHistory: async (workerId, siteId, yearMonth) => {
//     if (!workerId || !siteId || !yearMonth) {
//       console.warn("loadWorkersHistory 필수 매개변수가 누락되었습니다");
//       return null;
//     }

//     try {
//       console.log(
//         `worker ${workerId}, site ${siteId}, yearMonth ${yearMonth}에 대한 근무 이력 로드 중...`
//       );
//       set({ isLoading: true, error: null });

//       // 일관된 형식으로 캐시 키 생성
//       const cacheKey = `${workerId}-${siteId}-${yearMonth}`;

//       // 현재 상태 가져오기
//       const { workersHistory } = get();
//       console.log(`캐시 키 ${cacheKey}에 대한 데이터 확인 중...`);

//       // 캐시 된 데이터가 있으면 반환
//       if (workersHistory[cacheKey]) {
//         set({ isLoading: false });
//         return workersHistory[cacheKey];
//       }

//       // 이전 달과 현재 달 데이터를 병렬로 로드
//       console.log("이전 달 및 현재 달 데이터 로드 중...");
//       const [prevMonthData, currentMonthData, firstWorkDate] = await Promise.all([
//         get().loadPreviousMonthRecords(workerId, siteId, yearMonth),
//         get().loadCurrentMonthRecords(workerId, siteId, yearMonth),
//         get().findFirstWorkDate(workerId, siteId),
//       ]);

//       console.log("데이터 로드됨:", {
//         prevMonth: prevMonthData,
//         currentMonth: currentMonthData,
//         firstWorkDate,
//       });

//       // 명시적인 기본값으로 결과 구성
//       const historyData = {
//         previousMonthWorkDays: prevMonthData?.workDays || 0,
//         previousMonthWorkHours: prevMonthData?.workHours || 0,
//         isPreviousMonthRegistered: prevMonthData?.isRegistered || false,
//         firstWorkDate: prevMonthData?.firstWorkDate || firstWorkDate,
//         currentMonthWorkDays: currentMonthData?.workDays || 0,
//         currentMonthWorkHours: currentMonthData?.workHours || 0,
//         monthlyWage: currentMonthData?.monthlyWage || 0,
//         isRegisteredInCurrentMonth: currentMonthData?.isRegistered || false,
//       };

//       console.log(`캐시에 작업자 이력 데이터 저장 (${cacheKey}):`, historyData);

//       // 캐시 업데이트
//       set((state) => ({
//         workersHistory: {
//           ...state.workersHistory,
//           [cacheKey]: historyData,
//         },
//         isLoading: false,
//       }));

//       // 업데이트 된 상태 로그
//       console.log(`업데이트된 workersHistory 상태:`, get().workersHistory);

//       return historyData;
//     } catch (error) {
//       console.error("loadWorkersHistory 오류:", error);
//       set({ isLoading: false, error: error.message });
//       return null;
//     }
//   },
//   // 여러 근로자의 근무 이력을 로드
//   loadMultipleWorkersHistory: async (workersList, siteId, yearMonth) => {
//     if (!workersList || !siteId || !yearMonth) return {};

//     try {
//       set({ isLoading: true, error: null });

//       // 병렬 처리를 위한 Promise 배열
//       const historyPromises = workersList.map((worker) =>
//         get().loadWorkersHistory(worker.worker_id, siteId, yearMonth)
//       );

//       // 모든 Promise 병렬 처리 후 결과 취합
//       const results = await Promise.all(historyPromises);

//       // 결과 데이터 매핑
//       const historyData = {};
//       workersList.forEach((worker, index) => {
//         if (results[index]) {
//           historyData[worker.worker_id] = results[index];
//         }
//       });

//       set({ isLoading: false });
//       return historyData;
//     } catch (error) {
//       console.error("다중 근로자 이력 로드 오류:", error);
//       set({ isLoading: false, error: error.message });
//       return {};
//     }
//   },

//   // 이전 월 근무 데이터 조회
//   loadPreviousMonthRecords: async (workerId, siteId, yearMonth) => {
//     // 이전 월 계산
//     const dateInfo = getPreviousYearMonthFromSelected(
//       yearMonth.split("-")[0],
//       yearMonth.split("-")[1]
//     );

//     const prevYearMonth = dateInfo.prevYearMonth;
//     const prevMonthStart = `${prevYearMonth}-01`;
//     const currentMonthStart = `${dateInfo.currentYearMonth}-01`;

//     // 캐시 키 생성
//     const cacheKey = `${workerId}-${siteId}-${prevYearMonth}`;

//     // 이미 캐시에 있는 경우 반환
//     const { prevMonthWork } = get();
//     if (prevMonthWork[cacheKey]) {
//       return prevMonthWork[cacheKey];
//     }

//     try {
//       // 이전월 근무 기록 조회 - 날짜 범위로 필터링
//       let { data: workRecordsData, error: workError } = await supabase
//         .from("work_records")
//         .select("worker_id, work_date, work_hours, daily_wage, status, registration_month")
//         .eq("site_id", siteId)
//         .eq("worker_id", workerId)
//         .gte("work_date", prevMonthStart)
//         .lt("work_date", currentMonthStart);

//       if (workError) {
//         console.error("이전월 근무 데이터 조회 오류:", workError);
//         throw workError;
//       }

//       // 결과가 없는 경우 - registration_month로 조회
//       if (!workRecordsData || workRecordsData.length === 0) {
//         const { data: regMonthData, error: regMonthError } = await supabase
//           .from("work_records")
//           .select("worker_id, work_date, work_hours, daily_wage, status, registration_month")
//           .eq("site_id", siteId)
//           .eq("worker_id", workerId)
//           .eq("registration_month", prevYearMonth);

//         if (!regMonthError && regMonthData && regMonthData.length > 0) {
//           workRecordsData = regMonthData;
//         }
//       }

//       // 이전월 등록 여부 확인
//       const { data: registrationData, error: regError } = await supabase
//         .from("work_records")
//         .select("worker_id, status, registration_month")
//         .eq("site_id", siteId)
//         .eq("worker_id", workerId)
//         .eq("registration_month", prevYearMonth)
//         .eq("status", "registration");

//       // 근무 기록 필터링 (registration 상태 제외)
//       const workRecords = workRecordsData
//         ? workRecordsData.filter((r) => r.status !== "registration")
//         : [];

//       // 데이터 계산
//       const workDays = workRecords.length;
//       const workHours = workRecords.reduce((sum, r) => sum + (parseFloat(r.work_hours) || 0), 0);
//       const monthlyWage = workRecords.reduce((sum, r) => sum + (parseFloat(r.daily_wage) || 0), 0);
//       const isRegistered = registrationData && registrationData.length > 0;

//       // 첫 근무일 확인
//       const firstWorkDate =
//         workRecords.length > 0
//           ? workRecords.sort((a, b) => new Date(a.work_date) - new Date(b.work_date))[0].work_date
//           : null;

//       const result = {
//         workDays,
//         workHours,
//         firstWorkDate,
//         monthlyWage,
//         isRegistered,
//       };

//       // 캐시에 추가
//       set((state) => ({
//         prevMonthWork: { ...state.prevMonthWork, [cacheKey]: result },
//       }));

//       return result;
//     } catch (error) {
//       console.error("이전 월 근무 데이터 처리 오류:", error);
//       return {
//         workDays: 0,
//         workHours: 0,
//         firstWorkDate: null,
//         monthlyWage: 0,
//         isRegistered: false,
//       };
//     }
//   },

//   // 선택 월 근무 데이터 조회
//   // 선택 월 근무 데이터 조회 (수정된 버전)
//   // 선택 월 근무 데이터 조회 (디버깅 로그 추가)
//   // 선택 월 근무 데이터 조회 (전체 재작성)
//   // lib/store/workHistoryStore.js 파일에서
//   // In useWorkHistoryStore (workHistoryStore.js)
//   // 선택 월 근무 데이터 조회 함수 내부 (약 라인 240 근처)
//   // workHistoryStore.js - loadCurrentMonthRecords 메서드 (수정 버전)
//   loadCurrentMonthRecords: async (workerId, siteId, yearMonth) => {
//     try {
//       // 날짜 계산
//       const dateInfo = getPreviousYearMonthFromSelected(
//         yearMonth.split("-")[0],
//         yearMonth.split("-")[1]
//       );

//       const startDate = `${dateInfo.currentYearMonth}-01`;
//       const endDate = `${dateInfo.nextYearMonth}-01`;

//       console.log(`근무 기록 로드 시작 - 근로자: ${workerId}, 현장: ${siteId}, 연월: ${yearMonth}`);
//       console.log(`날짜 범위: ${startDate} ~ ${endDate}`);

//       // 날짜 기반 근무 기록 조회
//       const { data: workDateRecords, error: workDateError } = await supabase
//         .from("work_records")
//         .select("worker_id, work_date, work_hours, daily_wage, status")
//         .eq("site_id", siteId)
//         .eq("worker_id", workerId)
//         .gte("work_date", startDate)
//         .lt("work_date", endDate);

//       if (workDateError) throw workDateError;

//       // 등록월 기반 근무 기록 조회 (날짜 기반 조회로 결과가 없을 경우)
//       const { data: regMonthRecords, error: regMonthError } = await supabase
//         .from("work_records")
//         .select("worker_id, work_date, work_hours, daily_wage, status")
//         .eq("site_id", siteId)
//         .eq("worker_id", workerId)
//         .eq("registration_month", yearMonth);

//       if (regMonthError) throw regMonthError;

//       // 중복 없이 모든 기록 합치기
//       const allRecords = [...(workDateRecords || []), ...(regMonthRecords || [])];

//       // 중복 제거를 위한 Set
//       const uniqueRecords = new Set();
//       const workRecords = [];

//       allRecords.forEach((record) => {
//         // 이미 처리된 record인지 확인 (work_date로 구분)
//         const recordKey = `${record.work_date}`;
//         if (!uniqueRecords.has(recordKey) && record.status !== "registration") {
//           uniqueRecords.add(recordKey);
//           workRecords.push(record);
//         }
//       });

//       // 등록 여부 확인
//       const { data: regData, error: regError } = await supabase
//         .from("work_records")
//         .select("worker_id, status")
//         .eq("site_id", siteId)
//         .eq("worker_id", workerId)
//         .eq("registration_month", yearMonth)
//         .eq("status", "registration")
//         .maybeSingle();

//       if (regError && regError.code !== "PGRST116") throw regError;

//       // 🔥 이번달 마지막 근무일 조회 (새로 추가)
//       let lastWorkDateThisMonth = null;
//       if (workRecords && workRecords.length > 0) {
//         const sortedRecords = [...workRecords].sort(
//           (a, b) => new Date(b.work_date).getTime() - new Date(a.work_date).getTime()
//         );
//         lastWorkDateThisMonth = sortedRecords[0].work_date;
//         console.log(`이번달 마지막 근무일: ${lastWorkDateThisMonth}`);
//       }

//       // 계산
//       const workDays = workRecords.length;
//       const workHours = workRecords.reduce((sum, r) => sum + parseFloat(r.work_hours || 0), 0);
//       const monthlyWage = workRecords.reduce((sum, r) => sum + parseFloat(r.daily_wage || 0), 0);
//       const isRegistered = regData !== null;

//       // 디버깅 로그 추가
//       console.log("work_records 데이터:", {
//         workDateRecords: workDateRecords || [],
//         regMonthRecords: regMonthRecords || [],
//         allRecords: allRecords || [],
//         workRecords: workRecords || [],
//         결과: {
//           workDays,
//           workHours,
//           monthlyWage,
//           isRegistered,
//           lastWorkDateThisMonth, // 🔥 로그에 추가
//         },
//       });

//       return {
//         workDays,
//         workHours,
//         monthlyWage,
//         isRegistered,
//         lastWorkDateThisMonth, // 🔥 반환값에 추가
//       };
//     } catch (error) {
//       console.error(`근무 기록 로드 오류(ID: ${workerId}, 연월: ${yearMonth}):`, error);
//       return {
//         workDays: 0,
//         workHours: 0,
//         monthlyWage: 0,
//         isRegistered: false,
//         lastWorkDateThisMonth: null, // 🔥 에러시에도 null 반환
//       };
//     }
//   },

//   // 최초 근무일 찾기
//   findFirstWorkDate: async (workerId, siteId) => {
//     try {
//       const { data, error } = await supabase
//         .from("work_records")
//         .select("work_date, status")
//         .eq("site_id", siteId)
//         .eq("worker_id", workerId)
//         .neq("status", "registration")
//         .order("work_date", { ascending: true })
//         .limit(1);

//       if (error) {
//         console.error("최초 근무일 조회 오류:", error);
//         throw error;
//       }

//       return data && data.length > 0 ? data[0].work_date : null;
//     } catch (error) {
//       console.error("최초 근무일 조회 처리 오류:", error);
//       return null;
//     }
//   },

//   // 근무 기록 저장
//   saveWorkRecords: async (workerId, siteId, yearMonth, workDetails) => {
//     if (!workerId || !siteId || !yearMonth || !workDetails) {
//       return { success: false, message: "근로자, 현장, 년월, 근무 데이터가 모두 필요합니다." };
//     }

//     try {
//       set({ isLoading: true, error: null });

//       // 유효한 근무 기록만 필터링
//       const validWorkDetails = workDetails
//         .map((detail, index) => ({
//           ...detail,
//           day: index + 1,
//           date: `${yearMonth}-${String(index + 1).padStart(2, "0")}`,
//         }))
//         .filter((detail) => detail.hours && detail.wage);

//       if (validWorkDetails.length === 0) {
//         set({ isLoading: false });
//         return { success: false, message: "최소 하나 이상의 근무 기록이 필요합니다." };
//       }

//       // 날짜 계산
//       const dateInfo = getPreviousYearMonthFromSelected(
//         yearMonth.split("-")[0],
//         yearMonth.split("-")[1]
//       );

//       const startDate = `${dateInfo.currentYearMonth}-01`;
//       const endDate = `${dateInfo.nextYearMonth}-01`;

//       // 총 근무일수, 평균 근무시간, 총 임금 계산
//       const totalWorkDays = validWorkDetails.length;
//       const totalHours = validWorkDetails.reduce(
//         (sum, detail) => sum + parseFloat(detail.hours || 0),
//         0
//       );
//       const avgDailyWorkHours = totalWorkDays > 0 ? totalHours / totalWorkDays : 0;
//       const totalWage = validWorkDetails.reduce(
//         (sum, detail) => sum + parseNumber(detail.wage || 0),
//         0
//       );

//       // 데이터베이스 트랜잭션 처리 - supabase.js에서는 직접적인 트랜잭션을 지원하지 않으므로
//       // 순차적으로 처리하고 오류 발생 시 롤백 처리

//       // 1. 기존 근무 기록 삭제 (registration 유형 제외)
//       const { error: deleteError } = await supabase
//         .from("work_records")
//         .delete()
//         .eq("site_id", siteId)
//         .eq("worker_id", workerId)
//         .gte("work_date", startDate)
//         .lt("work_date", endDate)
//         .not("work_type", "eq", "registration");

//       if (deleteError) throw deleteError;

//       // 2. 새 근무 기록 추가
//       const workRecordsToInsert = validWorkDetails.map((detail) => {
//         // 작업 유형 결정
//         let workType = "regular";
//         if (detail.night) workType = "night";
//         if (detail.holiday) workType = "holiday";
//         if (detail.extended) workType = "overtime";

//         // 메타데이터 생성
//         const workTypeMetadata = JSON.stringify({
//           extended: detail.extended || false,
//           holiday: detail.holiday || false,
//           night: detail.night || false,
//         });

//         return {
//           worker_id: workerId,
//           site_id: siteId,
//           work_date: detail.date,
//           work_hours: parseFloat(detail.hours || 0),
//           work_type: workType,
//           work_type_metadata: workTypeMetadata,
//           daily_wage: parseNumber(detail.wage || 0),
//           status: "confirmed",
//           registration_month: yearMonth,
//         };
//       });

//       const { error: insertError } = await supabase
//         .from("work_records")
//         .insert(workRecordsToInsert);

//       if (insertError) throw insertError;

//       // 3. daily_work_reports 테이블 업데이트
//       // 기존 report 확인
//       // const { data: existingReport, error: checkError } = await supabase
//       //   .from("daily_work_reports")
//       //   .select("report_id")
//       //   .eq("worker_id", workerId)
//       //   .eq("site_id", siteId)
//       //   .eq("report_month", yearMonth)
//       //   .maybeSingle();

//       // if (checkError && checkError.code !== "PGRST116") throw checkError;

//       // let reportId;

//       // if (existingReport) {
//       //   // 기존 신고 데이터 업데이트
//       //   reportId = existingReport.report_id;
//       //   const { error: updateError } = await supabase
//       //     .from("daily_work_reports")
//       //     .update({
//       //       total_work_days: totalWorkDays,
//       //       avg_daily_work_hours: avgDailyWorkHours,
//       //       total_wage: totalWage,
//       //       total_compensation: totalWage,
//       //       total_paid_days: totalWorkDays,
//       //       updated_at: new Date().toISOString(),
//       //     })
//       //     .eq("report_id", reportId);

//       //   if (updateError) throw updateError;

//       //   // 기존 상세 데이터 삭제
//       //   const { error: deleteDetailsError } = await supabase
//       //     .from("daily_work_report_details")
//       //     .delete()
//       //     .eq("report_id", reportId);

//       //   if (deleteDetailsError) throw deleteDetailsError;
//       // } else {
//       //   // 새 신고 데이터 생성
//       //   const { data: newReport, error: insertReportError } = await supabase
//       //     .from("daily_work_reports")
//       //     .insert({
//       //       worker_id: workerId,
//       //       site_id: siteId,
//       //       report_month: yearMonth,
//       //       insurance_type: "5", // 기본값: 산재보험 및 고용보험 모두
//       //       total_work_days: totalWorkDays,
//       //       avg_daily_work_hours: avgDailyWorkHours,
//       //       total_wage: totalWage,
//       //       total_compensation: totalWage,
//       //       total_paid_days: totalWorkDays,
//       //       payment_month: yearMonth,
//       //       report_status: "draft",
//       //     })
//       //     .select();

//       //   if (insertReportError) throw insertReportError;
//       //   reportId = newReport[0].report_id;
//       // }

//       // // 4. 상세 데이터 생성
//       // const detailsToInsert = validWorkDetails.map((detail) => ({
//       //   report_id: reportId,
//       //   work_date: detail.date,
//       //   work_hours: parseFloat(detail.hours || 0),
//       //   daily_wage: parseNumber(detail.wage || 0),
//       // }));

//       // const { error: insertDetailsError } = await supabase
//       //   .from("daily_work_report_details")
//       //   .insert(detailsToInsert);

//       // if (insertDetailsError) throw insertDetailsError;

//       // 5. 캐시 무효화 (최신 데이터 반영을 위해)
//       const cacheKey = `${workerId}-${siteId}-${yearMonth}`;
//       set((state) => ({
//         workersHistory: {
//           ...state.workersHistory,
//           [cacheKey]: undefined,
//         },
//       }));

//       // 업데이트된 이력 다시 로드
//       await get().loadWorkersHistory(workerId, siteId, yearMonth);

//       set({ isLoading: false });
//       return { success: true, message: "근무 기록이 성공적으로 저장되었습니다." };
//     } catch (error) {
//       console.error("근무 기록 저장 오류:", error);
//       set({ isLoading: false, error: error.message });
//       return { success: false, message: `근무 기록 저장 중 오류 발생: ${error.message}` };
//     }
//   },

//   // 월간 보고서 집계
//   getMonthlyReport: async (siteId, yearMonth) => {
//     if (!siteId || !yearMonth) return null;

//     try {
//       set({ isLoading: true, error: null });

//       // 날짜 계산
//       const dateInfo = getPreviousYearMonthFromSelected(
//         yearMonth.split("-")[0],
//         yearMonth.split("-")[1]
//       );

//       const startDate = `${dateInfo.currentYearMonth}-01`;
//       const endDate = `${dateInfo.nextYearMonth}-01`;

//       // 해당 월에 해당 현장의 모든 근무 기록 조회
//       const { data, error } = await supabase
//         .from("work_records")
//         .select(
//           `
//           worker_id,
//           work_date,
//           work_hours,
//           daily_wage,
//           status,
//           workers(name, resident_number)
//         `
//         )
//         .eq("site_id", siteId)
//         .gte("work_date", startDate)
//         .lt("work_date", endDate)
//         .neq("status", "registration");

//       if (error) throw error;

//       // 근로자별로 집계
//       const reportByWorker = {};

//       if (data && data.length > 0) {
//         data.forEach((record) => {
//           const workerId = record.worker_id;

//           if (!reportByWorker[workerId]) {
//             reportByWorker[workerId] = {
//               workerId,
//               name: record.workers?.name || "미상",
//               workDays: 0,
//               workHours: 0,
//               totalWage: 0,
//               records: [],
//             };
//           }

//           reportByWorker[workerId].workDays++;
//           reportByWorker[workerId].workHours += parseFloat(record.work_hours || 0);
//           reportByWorker[workerId].totalWage += parseFloat(record.daily_wage || 0);
//           reportByWorker[workerId].records.push(record);
//         });
//       }

//       // 전체 집계
//       const totalReport = {
//         totalWorkers: Object.keys(reportByWorker).length,
//         totalWorkDays: Object.values(reportByWorker).reduce((sum, w) => sum + w.workDays, 0),
//         totalWorkHours: Object.values(reportByWorker).reduce((sum, w) => sum + w.workHours, 0),
//         totalWage: Object.values(reportByWorker).reduce((sum, w) => sum + w.totalWage, 0),
//         workerReports: reportByWorker,
//       };

//       set({ isLoading: false });
//       return totalReport;
//     } catch (error) {
//       console.error("월간 보고서 집계 오류:", error);
//       set({ isLoading: false, error: error.message });
//       return null;
//     }
//   },

//   // 근무 이력 캐시 강제 초기화
//   forceCacheRefresh: (workerId, siteId, yearMonth) => {
//     if (!workerId || !siteId || !yearMonth) return false;

//     console.log(`강제 캐시 초기화: ${workerId}-${siteId}-${yearMonth}`);

//     // Create the cache key
//     const cacheKey = `${workerId}-${siteId}-${yearMonth}`;

//     // Invalidate the cache
//     set((state) => ({
//       workersHistory: {
//         ...state.workersHistory,
//         [cacheKey]: undefined,
//       },
//     }));

//     return true;
//   },

//   resetStore: () =>
//     set({
//       workersHistory: {},
//       prevMonthWork: {},
//       isLoading: false,
//       isReportLoading: false,
//       error: null,
//     }),
//   // 오류 지우기
//   clearError: () => set({ error: null }),
// }));

// export default useWorkHistoryStore;
