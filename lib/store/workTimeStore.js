// lib/store/workTimeStore.js// lib/store/workTimeStore.js
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

/*
=== DB 트리거 함수들 ===
1. calculate_work_hours_and_allowances(): 근무시간과 수당을 자동 계산
   - work_hours = regular_hours + overtime_hours + night_hours + holiday_hours
   - 시급 계산 후 수당 자동 계산:
     * overtime_allowance = overtime_hours × hourly_rate × 0.5
     * night_allowance = night_hours × hourly_rate × 0.5  
     * holiday_allowance = holiday_hours × hourly_rate × 0.5
   - work_type_metadata JSON 자동 생성

2. update_daily_work_report_totals(): daily_work_reports 총계 자동 업데이트
   - daily_work_report_details 변경 시 모든 총계 필드 자동 재계산
   - total_regular_hours, total_overtime_hours, total_night_hours, total_holiday_hours
   - total_overtime_allowance, total_night_allowance, total_holiday_allowance
*/

// 🔥 유효한 근무 시간이 있는지 확인하는 헬퍼 함수 (스토어 외부에서 정의)
const hasValidWorkTime = (detail) => {
  if (!detail) return false;
  return (
    (detail.regular_hours && Number(detail.regular_hours) > 0) ||
    (detail.overtime_hours && Number(detail.overtime_hours) > 0) ||
    (detail.night_hours && Number(detail.night_hours) > 0) ||
    (detail.holiday_hours && Number(detail.holiday_hours) > 0)
  );
};

const useWorkTimeStore = create((set, get) => ({
  // 상태 - 보험 관련 제거하여 중복 방지
  workers: [], // 근로자 목록
  workerDetails: {}, // 근로자 ID를 키로 하는 상세 정보 캐시
  workReports: {}, // 근로자-현장-월 조합을 키로 하는 근무 기록 캐시
  selectedWorker: null, // 선택된 근로자
  yearMonth: getCurrentYearMonth(), // 선택된 년월
  prevMonthWork: {}, // 이전 월 근무 기록

  // 로딩 상태 (컴포넌트별로 분리)
  isLoading: false,
  isWorkerLoading: false,
  isDetailLoading: false,
  isReportLoading: false,

  // 유틸리티 함수들
  formatNumber,
  parseNumber,
  isSunday: (day) => isSundayByDate(day, get().yearMonth),
  isHoliday: (dateStr) => isHolidayByDate(dateStr),
  getDaysInMonth: (yearMonth) => getDaysInMonth(yearMonth || get().yearMonth),

  // 보험료 계산
  calculateInsuranceFee: (wage, insuranceType) => {
    return calculateInsurancePremium(parseNumber(wage), insuranceType);
  },

  // 보험 상태 업데이트 알림 (insuranceStatusStore와 연동)
  notifyInsuranceStatusUpdate: async (workerId, siteId, yearMonth) => {
    try {
      const { default: useInsuranceStatusStore } = await import("@/lib/store/insuranceStatusStore");
      useInsuranceStatusStore.getState().clearStatusCache(workerId, siteId, yearMonth);

      setTimeout(async () => {
        await useInsuranceStatusStore.getState().loadInsuranceStatus(workerId, siteId, yearMonth);
      }, 100);
    } catch (error) {
      console.error("보험 상태 업데이트 알림 실패:", error);
    }
  },

  // 근로자 목록 가져오기
  fetchWorkers: async (siteId, searchTerm = "") => {
    const { yearMonth } = get();
    if (!siteId || !yearMonth) {
      set({ workers: [] });
      return;
    }

    try {
      set({ isWorkerLoading: true });

      const { currentYearMonth, nextYearMonth } = getPreviousYearMonthFromSelected(
        yearMonth.split("-")[0],
        yearMonth.split("-")[1]
      );

      const startDate = `${currentYearMonth}-01`;
      const endDate = `${nextYearMonth}-01`;

      const { data: workRecords, error: recordsError } = await supabase
        .from("work_records")
        .select("worker_id, work_type, work_date, status")
        .eq("site_id", siteId)
        .or(
          `registration_month.eq.${yearMonth},and(work_date.gte.${startDate},work_date.lt.${endDate})`
        );

      if (recordsError) throw recordsError;

      const allRegisteredWorkerIds =
        Array.from(new Set(workRecords?.map((record) => record.worker_id))) || [];

      const workerIdsWithHistory =
        Array.from(
          new Set(
            workRecords
              ?.filter((record) => record.work_type !== "registration")
              .map((record) => record.worker_id)
          )
        ) || [];

      let workersQuery = supabase
        .from("workers")
        .select("*")
        .in("worker_id", allRegisteredWorkerIds)
        .order("name");

      if (searchTerm) {
        workersQuery = workersQuery.ilike("name", `%${searchTerm}%`);
      }

      const { data: workersData, error: workersError } = await workersQuery;

      if (workersError) throw workersError;

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
    if (!workerId) {
      console.warn("❌ workerId가 없습니다.");
      return;
    }

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

      set((state) => ({
        workerDetails: { ...state.workerDetails, [workerId]: data },
        selectedWorker: workerId,
        isDetailLoading: false,
      }));
    } catch (error) {
      console.error("❌ 근로자 상세 정보 조회 오류:", error);
      set({ isDetailLoading: false, selectedWorker: null });
    }
  },

  // 🔥 근무 기록 가져오기 - 새로운 세분화된 필드들 포함
  fetchWorkReports: async (workerId, siteId, yearMonth) => {
    if (!workerId || !siteId || !yearMonth) return;

    const cacheKey = `${workerId}-${siteId}-${yearMonth}`;
    const { workReports } = get();
    if (workReports[cacheKey]) {
      return;
    }

    try {
      set({ isReportLoading: true });

      const { currentYearMonth, nextYearMonth } = getPreviousYearMonthFromSelected(
        yearMonth.split("-")[0],
        yearMonth.split("-")[1]
      );

      const startDate = `${currentYearMonth}-01`;
      const endDate = `${nextYearMonth}-01`;

      // daily_work_reports 조회
      const { data: reports, error: reportsError } = await supabase
        .from("daily_work_reports")
        .select("*")
        .eq("worker_id", workerId)
        .eq("site_id", siteId)
        .eq("report_month", yearMonth);

      if (reportsError) throw reportsError;

      let reportData = null;
      // 🔥 새로운 세분화된 구조로 workDetails 초기화
      let workDetails = Array.from({ length: 31 }, () => ({
        regular_hours: "", // 일반 근무시간
        overtime_hours: "", // 연장 근무시간
        night_hours: "", // 야간 근무시간
        holiday_hours: "", // 휴일 근무시간
        base_wage: "", // 기본 일당
        overtime_rate: 1.5, // 연장 수당률 (기본 150%)
        night_rate: 1.5, // 야간 수당률 (기본 150%)
        holiday_rate: 2.0, // 휴일 수당률 (기본 200%)
        payment_status: "unpaid",
        payment_date: null,
        payment_method: null,
        payment_memo: null,
      }));

      if (reports && reports.length > 0) {
        reportData = reports[0];

        // daily_work_report_details 조회
        const { data: details, error: detailsError } = await supabase
          .from("daily_work_report_details")
          .select("*")
          .eq("report_id", reportData.report_id)
          .order("work_date");

        if (detailsError) throw detailsError;

        reportData.details = details || [];

        if (details && details.length > 0) {
          // 🔥 work_records에서 세분화된 시간 정보 가져오기
          const { data: workRecords, error: workRecordsError } = await supabase
            .from("work_records")
            .select(
              `
              work_date, work_hours, daily_wage, 
              regular_hours, overtime_hours, night_hours, holiday_hours,
              overtime_allowance, night_allowance, holiday_allowance, extra_allowance,
              payment_status, payment_date, payment_method, payment_memo,
              work_type_metadata
            `
            )
            .eq("worker_id", workerId)
            .eq("site_id", siteId)
            .gte("work_date", startDate)
            .lt("work_date", endDate)
            .not("work_type", "eq", "registration");

          if (workRecordsError) throw workRecordsError;

          // 날짜별 상세 정보 맵 구성
          const workRecordMap = {};
          if (workRecords && workRecords.length > 0) {
            workRecords.forEach((record) => {
              const day = new Date(record.work_date).getDate();
              workRecordMap[day] = record;
            });
          }

          // 🔥 세분화된 데이터로 workDetails 구성
          details.forEach((detail) => {
            const day = new Date(detail.work_date).getDate() - 1; // 0부터 시작하는 인덱스
            if (day >= 0 && day < 31) {
              const dayNum = day + 1;
              const workRecord = workRecordMap[dayNum];

              if (workRecord) {
                // 🔥 DB에서 가져온 세분화된 시간 정보 사용
                workDetails[day] = {
                  regular_hours: (parseFloat(workRecord.regular_hours) || 0).toString(),
                  overtime_hours: (parseFloat(workRecord.overtime_hours) || 0).toString(),
                  night_hours: (parseFloat(workRecord.night_hours) || 0).toString(),
                  holiday_hours: (parseFloat(workRecord.holiday_hours) || 0).toString(),
                  base_wage: formatNumber(
                    workRecord.daily_wage ? workRecord.daily_wage.toString() : "0"
                  ),
                  // 🔥 수당률은 메타데이터에서 추출하거나 기본값 사용
                  overtime_rate: 1.5,
                  night_rate: 1.5,
                  holiday_rate: 2.0,
                  // 🔥 지급 관련 정보
                  payment_status: workRecord.payment_status || "unpaid",
                  payment_date: workRecord.payment_date || null,
                  payment_method: workRecord.payment_method || null,
                  payment_memo: workRecord.payment_memo || null,
                  // 🔥 계산된 수당들 (읽기 전용, DB에서 자동 계산됨)
                  calculated_overtime_allowance: parseFloat(workRecord.overtime_allowance) || 0,
                  calculated_night_allowance: parseFloat(workRecord.night_allowance) || 0,
                  calculated_holiday_allowance: parseFloat(workRecord.holiday_allowance) || 0,
                  calculated_extra_allowance: parseFloat(workRecord.extra_allowance) || 0,
                };
              } else {
                // work_records에 없는 경우 detail 정보로 구성
                const totalHours = parseFloat(detail.work_hours) || 0;
                workDetails[day] = {
                  regular_hours: totalHours.toString(),
                  overtime_hours: "0",
                  night_hours: "0",
                  holiday_hours: "0",
                  base_wage: formatNumber(detail.daily_wage ? detail.daily_wage.toString() : "0"),
                  overtime_rate: 1.5,
                  night_rate: 1.5,
                  holiday_rate: 2.0,
                  payment_status: "unpaid",
                  payment_date: null,
                  payment_method: null,
                  payment_memo: null,
                };
              }
            }
          });
        }
      } else {
        // 🔥 daily_work_reports가 없는 경우 work_records에서 직접 조회
        const { data: workRecords, error: workRecordsError } = await supabase
          .from("work_records")
          .select(
            `
            work_date, work_hours, daily_wage,
            regular_hours, overtime_hours, night_hours, holiday_hours,
            overtime_allowance, night_allowance, holiday_allowance, extra_allowance,
            payment_status, payment_date, payment_method, payment_memo,
            work_type_metadata
          `
          )
          .eq("worker_id", workerId)
          .eq("site_id", siteId)
          .gte("work_date", startDate)
          .lt("work_date", endDate)
          .not("work_type", "eq", "registration");

        if (workRecordsError) throw workRecordsError;

        if (workRecords && workRecords.length > 0) {
          workRecords.forEach((record) => {
            const day = new Date(record.work_date).getDate() - 1;
            if (day >= 0 && day < 31) {
              // 🔥 세분화된 시간 정보로 구성
              workDetails[day] = {
                regular_hours: (parseFloat(record.regular_hours) || 0).toString(),
                overtime_hours: (parseFloat(record.overtime_hours) || 0).toString(),
                night_hours: (parseFloat(record.night_hours) || 0).toString(),
                holiday_hours: (parseFloat(record.holiday_hours) || 0).toString(),
                base_wage: formatNumber(record.daily_wage ? record.daily_wage.toString() : "0"),
                overtime_rate: 1.5,
                night_rate: 1.5,
                holiday_rate: 2.0,
                payment_status: record.payment_status || "unpaid",
                payment_date: record.payment_date || null,
                payment_method: record.payment_method || null,
                payment_memo: record.payment_memo || null,
                // 🔥 계산된 수당들 (DB 자동 계산)
                calculated_overtime_allowance: parseFloat(record.overtime_allowance) || 0,
                calculated_night_allowance: parseFloat(record.night_allowance) || 0,
                calculated_holiday_allowance: parseFloat(record.holiday_allowance) || 0,
                calculated_extra_allowance: parseFloat(record.extra_allowance) || 0,
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

      // 이전 월 근무 기록 확인
      await get().fetchPreviousMonthWork(workerId, siteId, yearMonth);

      // 보험 상태 업데이트 알림
      await get().notifyInsuranceStatusUpdate(workerId, siteId, yearMonth);
    } catch (error) {
      console.error("근무 기록 조회 오류:", error);
      set({ isReportLoading: false });
    }
  },

  // 이전 월 근무 기록 가져오기
  fetchPreviousMonthWork: async (workerId, siteId, yearMonth) => {
    if (!workerId || !siteId || !yearMonth) return;

    const { prevYearMonth, prevMonthStartDate, currentMonthStartDate } =
      getPreviousYearMonthFromSelected(yearMonth.split("-")[0], yearMonth.split("-")[1]);

    const prevMonthStart = prevMonthStartDate.toISOString().split("T")[0];
    const currentMonthStart = currentMonthStartDate.toISOString().split("T")[0];

    const cacheKey = `${workerId}-${siteId}-${prevYearMonth}`;
    const { prevMonthWork } = get();
    if (prevMonthWork[cacheKey]) {
      return;
    }

    try {
      // 🔥 세분화된 필드들 포함하여 이전월 데이터 조회
      let { data: workRecordsData, error: workError } = await supabase
        .from("work_records")
        .select(
          `
          worker_id, work_date, work_hours, daily_wage, status, registration_month,
          regular_hours, overtime_hours, night_hours, holiday_hours
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
            regular_hours, overtime_hours, night_hours, holiday_hours
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

      const workRecords = workRecordsData
        ? workRecordsData.filter((r) => r.status !== "registration")
        : [];

      // 🔥 세분화된 시간 합계 계산
      const workDays = workRecords.length;
      const totalRegularHours = workRecords.reduce(
        (sum, r) => sum + (parseFloat(r.regular_hours) || 0),
        0
      );
      const totalOvertimeHours = workRecords.reduce(
        (sum, r) => sum + (parseFloat(r.overtime_hours) || 0),
        0
      );
      const totalNightHours = workRecords.reduce(
        (sum, r) => sum + (parseFloat(r.night_hours) || 0),
        0
      );
      const totalHolidayHours = workRecords.reduce(
        (sum, r) => sum + (parseFloat(r.holiday_hours) || 0),
        0
      );
      const workHours = workRecords.reduce((sum, r) => sum + (parseFloat(r.work_hours) || 0), 0);
      const monthlyWage = workRecords.reduce((sum, r) => sum + (parseFloat(r.daily_wage) || 0), 0);
      const isRegistered = registrationData && registrationData.length > 0;

      const firstWorkDate =
        workRecords.length > 0
          ? workRecords.sort((a, b) => new Date(a.work_date) - new Date(b.work_date))[0].work_date
          : null;

      const result = {
        days: workDays,
        hours: workHours,
        // 🔥 세분화된 시간 정보 추가
        regularHours: totalRegularHours,
        overtimeHours: totalOvertimeHours,
        nightHours: totalNightHours,
        holidayHours: totalHolidayHours,
        startDate: firstWorkDate || "없음",
        monthlyWage,
        isRegistered,
      };

      set((state) => ({
        prevMonthWork: { ...state.prevMonthWork, [cacheKey]: result },
      }));
    } catch (error) {
      console.error("이전 월 근무 기록 조회 오류:", error);
    }
  },

  // 근로자를 현장에 등록하는 함수
  registerWorkerToSite: async (workerId, siteId) => {
    const { yearMonth } = get();
    if (!workerId || !siteId || !yearMonth) {
      return { success: false, message: "근로자와 공사현장을 선택해주세요." };
    }

    try {
      set({ isLoading: true });

      const { data: existingRecord, error: checkError } = await supabase
        .from("work_records")
        .select("*")
        .eq("worker_id", workerId)
        .eq("site_id", siteId)
        .eq("registration_month", yearMonth)
        .maybeSingle();

      if (checkError && checkError.code !== "PGRST116") {
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
        work_type: "registration",
        daily_wage: 0,
        status: "registration",
        registration_month: yearMonth,
      });

      if (insertError) throw insertError;

      await get().fetchWorkers(siteId);

      set({ isLoading: false });
      return { success: true, message: `근로자가 ${yearMonth}월에 성공적으로 등록되었습니다.` };
    } catch (error) {
      console.error("근로자 등록 오류:", error);
      set({ isLoading: false });
      return { success: false, message: `등록 중 오류가 발생했습니다: ${error.message}` };
    }
  },

  // 🔥 근무 기록 저장 - 세분화된 시간 구조로 수정
  saveWorkRecords: async (workerId, siteId, yearMonth, workDetails) => {
    if (!workerId || !siteId || !yearMonth) {
      return { success: false, message: "근로자, 공사현장, 근무년월을 모두 선택해주세요." };
    }

    try {
      set({ isLoading: true });

      let paidRecordsCount = 0;

      const { currentMonthStartDate, nextMonthStartDate } = getPreviousYearMonthFromSelected(
        yearMonth.split("-")[0],
        yearMonth.split("-")[1]
      );

      const startDate = currentMonthStartDate.toISOString().split("T")[0];
      const endDate = nextMonthStartDate.toISOString().split("T")[0];

      // 기존 work_records 데이터 조회
      const { data: existingRecords, error: existingRecordsError } = await supabase
        .from("work_records")
        .select("*")
        .eq("worker_id", workerId)
        .eq("site_id", siteId)
        .gte("work_date", startDate)
        .lt("work_date", endDate)
        .not("work_type", "eq", "registration");

      if (existingRecordsError) throw existingRecordsError;

      const existingRecordsMap = {};
      if (existingRecords && existingRecords.length > 0) {
        existingRecords.forEach((record) => {
          existingRecordsMap[record.work_date] = record;
        });
      }

      // 🔥 세분화된 시간 구조로 처리할 작업 세부사항 구성
      const processedWorkDetails = [];
      const daysInMonth = getDaysInMonth(yearMonth);

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${yearMonth}-${String(day).padStart(2, "0")}`;
        const detailIndex = day - 1;
        const currentDetail = workDetails[detailIndex] || {};

        const existingRecord = existingRecordsMap[dateStr];

        // 지급완료 레코드면 기존 데이터 유지
        if (existingRecord && existingRecord.payment_status === "paid") {
          paidRecordsCount++;

          processedWorkDetails.push({
            ...currentDetail,
            day,
            date: dateStr,
            // 🔥 기존 세분화된 시간 정보 유지
            regular_hours: (existingRecord.regular_hours || 0).toString(),
            overtime_hours: (existingRecord.overtime_hours || 0).toString(),
            night_hours: (existingRecord.night_hours || 0).toString(),
            holiday_hours: (existingRecord.holiday_hours || 0).toString(),
            base_wage: formatNumber(
              existingRecord.daily_wage ? existingRecord.daily_wage.toString() : "0"
            ),
            payment_status: "paid",
            payment_date: existingRecord.payment_date,
            payment_method: existingRecord.payment_method,
            payment_memo: existingRecord.payment_memo,
            record_id: existingRecord.record_id,
            preserve: true,
          });
        } else if (hasValidWorkTime(currentDetail)) {
          // 🔥 함수 직접 호출로 수정
          // 🔥 새로운 세분화된 시간 정보가 있는 경우
          processedWorkDetails.push({
            ...currentDetail,
            day,
            date: dateStr,
            payment_status: "unpaid",
            payment_date: null,
            payment_method: null,
            payment_memo: null,
          });
        } else if (existingRecord) {
          processedWorkDetails.push({
            ...currentDetail,
            day,
            date: dateStr,
            payment_status: existingRecord.payment_status || "unpaid",
            payment_date: existingRecord.payment_date,
            payment_method: existingRecord.payment_method,
            payment_memo: existingRecord.payment_memo,
          });
        }
      }

      // 🔥 유효한 근무 기록 필터링 (세분화된 시간 중 하나라도 있으면 유효)
      const validWorkDetails = processedWorkDetails.filter(
        (detail) => hasValidWorkTime(detail) && detail.base_wage // 🔥 함수 직접 호출로 수정
      );

      if (validWorkDetails.length === 0) {
        set({ isLoading: false });
        return {
          success: false,
          message: "최소 하나 이상의 근무 기록을 입력해주세요.",
        };
      }

      // 🔥 총계 계산 (세분화된 시간 기준)
      const totalWorkDays = validWorkDetails.length;
      const totalRegularHours = validWorkDetails.reduce(
        (sum, d) => sum + Number(d.regular_hours || 0),
        0
      );
      const totalOvertimeHours = validWorkDetails.reduce(
        (sum, d) => sum + Number(d.overtime_hours || 0),
        0
      );
      const totalNightHours = validWorkDetails.reduce(
        (sum, d) => sum + Number(d.night_hours || 0),
        0
      );
      const totalHolidayHours = validWorkDetails.reduce(
        (sum, d) => sum + Number(d.holiday_hours || 0),
        0
      );
      const totalHours =
        totalRegularHours + totalOvertimeHours + totalNightHours + totalHolidayHours;
      const avgDailyWorkHours = totalWorkDays > 0 ? totalHours / totalWorkDays : 0;
      const totalWage = validWorkDetails.reduce((sum, d) => sum + parseNumber(d.base_wage || 0), 0);

      const cacheKey = `${workerId}-${siteId}-${yearMonth}`;
      const { workReports } = get();
      const existingReport = workReports[cacheKey]?.report;

      let reportId;

      // daily_work_reports 처리
      if (existingReport) {
        const { error: updateError } = await supabase
          .from("daily_work_reports")
          .update({
            total_work_days: totalWorkDays,
            avg_daily_work_hours: avgDailyWorkHours,
            total_wage: totalWage,
            total_compensation: totalWage,
            total_paid_days: totalWorkDays,
            // 🔥 세분화된 시간 총계 (DB 트리거가 자동 계산)
            total_regular_hours: totalRegularHours,
            total_overtime_hours: totalOvertimeHours,
            total_night_hours: totalNightHours,
            total_holiday_hours: totalHolidayHours,
            updated_at: new Date().toISOString(),
          })
          .eq("report_id", existingReport.report_id);

        if (updateError) throw updateError;

        reportId = existingReport.report_id;

        // 기존 상세 데이터 삭제
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
            insurance_type: "5",
            total_work_days: totalWorkDays,
            avg_daily_work_hours: avgDailyWorkHours,
            total_wage: totalWage,
            total_compensation: totalWage,
            total_paid_days: totalWorkDays,
            // 🔥 세분화된 시간 총계
            total_regular_hours: totalRegularHours,
            total_overtime_hours: totalOvertimeHours,
            total_night_hours: totalNightHours,
            total_holiday_hours: totalHolidayHours,
            payment_month: yearMonth,
            report_status: "draft",
          })
          .select();

        if (insertError) throw insertError;

        reportId = newReport[0].report_id;
      }

      // 🔥 상세 데이터 생성 (세분화된 시간 포함)
      const detailsToInsert = validWorkDetails.map((detail) => ({
        report_id: reportId,
        work_date: detail.date,
        work_hours:
          Number(detail.regular_hours || 0) +
          Number(detail.overtime_hours || 0) +
          Number(detail.night_hours || 0) +
          Number(detail.holiday_hours || 0),
        daily_wage: parseNumber(detail.base_wage || 0),
        // 🔥 세분화된 시간 정보
        regular_hours: Number(detail.regular_hours || 0),
        overtime_hours: Number(detail.overtime_hours || 0),
        night_hours: Number(detail.night_hours || 0),
        holiday_hours: Number(detail.holiday_hours || 0),
      }));

      if (detailsToInsert.length > 0) {
        const { error: detailsError } = await supabase
          .from("daily_work_report_details")
          .insert(detailsToInsert);

        if (detailsError) throw detailsError;
      }

      // 🔥 work_records 테이블 처리
      const recordsToPreserve = validWorkDetails.filter((detail) => detail.preserve);
      const recordsToInsert = validWorkDetails.filter((detail) => !detail.preserve);

      const recordIdsToPreserve = recordsToPreserve.map((detail) => detail.record_id);

      // 기존 레코드 삭제
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

      // 🔥 새 레코드 삽입 (세분화된 시간 정보 포함)
      if (recordsToInsert.length > 0) {
        const workRecordsToInsert = recordsToInsert.map((detail) => {
          // 작업 유형 결정
          let workType = "regular";
          if (Number(detail.night_hours || 0) > 0) workType = "night";
          if (Number(detail.holiday_hours || 0) > 0) workType = "holiday";
          if (Number(detail.overtime_hours || 0) > 0) workType = "overtime";

          // 🔥 메타데이터 생성 (세분화된 시간 포함)
          const workTypeMetadata = JSON.stringify({
            regular_hours: Number(detail.regular_hours || 0),
            overtime_hours: Number(detail.overtime_hours || 0),
            night_hours: Number(detail.night_hours || 0),
            holiday_hours: Number(detail.holiday_hours || 0),
            overtime_rate: Number(detail.overtime_rate || 1.5),
            night_rate: Number(detail.night_rate || 1.5),
            holiday_rate: Number(detail.holiday_rate || 2.0),
          });

          return {
            worker_id: workerId,
            site_id: siteId,
            work_date: detail.date,
            // 🔥 총 근무시간 (DB 트리거가 자동 계산하지만 명시적으로 설정)
            work_hours:
              Number(detail.regular_hours || 0) +
              Number(detail.overtime_hours || 0) +
              Number(detail.night_hours || 0) +
              Number(detail.holiday_hours || 0),
            // 🔥 세분화된 시간 필드들
            regular_hours: Number(detail.regular_hours || 0),
            overtime_hours: Number(detail.overtime_hours || 0),
            night_hours: Number(detail.night_hours || 0),
            holiday_hours: Number(detail.holiday_hours || 0),
            work_type: workType,
            work_type_metadata: workTypeMetadata,
            daily_wage: parseNumber(detail.base_wage || 0),
            status: "confirmed",
            registration_month: yearMonth,
            payment_status: "unpaid",
            payment_date: null,
            payment_method: null,
            payment_memo: null,
          };
        });

        const { error: insertWorkRecordsError } = await supabase
          .from("work_records")
          .insert(workRecordsToInsert);

        if (insertWorkRecordsError) throw insertWorkRecordsError;
      }

      // 캐시 무효화 및 데이터 다시 로드
      set((state) => ({
        workReports: {
          ...state.workReports,
          [cacheKey]: undefined,
        },
      }));

      // 보험 상태 업데이트 알림
      await get().notifyInsuranceStatusUpdate(workerId, siteId, yearMonth);

      // 외부 스토어 캐시 무효화
      try {
        const workHistoryStore = require("@/lib/store/workHistoryStore").default;
        if (workHistoryStore) {
          workHistoryStore.setState((state) => ({
            workersHistory: {
              ...state.workersHistory,
              [cacheKey]: undefined,
            },
          }));
        }
      } catch (e) {
        console.error("WorkHistoryStore 캐시 무효화 실패:", e);
      }

      // 전역 이벤트 발생
      try {
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

  // 선택된 년월 설정
  setYearMonth: (yearMonth) => {
    set({ yearMonth });
  },

  // 🔥 근무 기록의 특정 필드 값을 업데이트 (세분화된 시간 필드 지원)
  updateWorkDetail: (index, field, value) => {
    const { selectedWorker, workReports, yearMonth } = get();

    if (!selectedWorker) return;

    // 현재 선택된 근로자에 해당하는 캐시 키 찾기
    const matchingCacheKey = Object.keys(workReports).find(
      (key) => key.startsWith(`${selectedWorker}-`) && key.endsWith(`-${yearMonth}`)
    );

    if (!matchingCacheKey || !workReports[matchingCacheKey]) return;

    const updatedWorkDetails = [...workReports[matchingCacheKey].workDetails];

    // 기존 데이터가 없는 경우 기본 구조 생성
    if (!updatedWorkDetails[index]) {
      updatedWorkDetails[index] = {
        regular_hours: "",
        overtime_hours: "",
        night_hours: "",
        holiday_hours: "",
        base_wage: "",
        overtime_rate: 1.5,
        night_rate: 1.5,
        holiday_rate: 2.0,
        payment_status: "unpaid",
        payment_date: null,
        payment_method: null,
        payment_memo: null,
      };
    }

    // 🔥 세분화된 시간 필드들 처리
    if (["regular_hours", "overtime_hours", "night_hours", "holiday_hours"].includes(field)) {
      const numericValue = value.replace(/[^0-9.]/g, "");
      updatedWorkDetails[index] = {
        ...updatedWorkDetails[index],
        [field]: numericValue,
      };
    } else if (field === "base_wage") {
      const numericValue = value.replace(/[^0-9]/g, "");
      updatedWorkDetails[index] = {
        ...updatedWorkDetails[index],
        base_wage: formatNumber(numericValue),
      };
    } else if (["overtime_rate", "night_rate", "holiday_rate"].includes(field)) {
      // 수당률 필드 처리
      const numericValue = parseFloat(value) || 0;
      updatedWorkDetails[index] = {
        ...updatedWorkDetails[index],
        [field]: numericValue,
      };
    } else {
      // 기타 모든 필드 처리
      updatedWorkDetails[index] = {
        ...updatedWorkDetails[index],
        [field]: value,
      };
    }

    // 상태 업데이트
    set((state) => ({
      workReports: {
        ...state.workReports,
        [matchingCacheKey]: {
          ...state.workReports[matchingCacheKey],
          workDetails: updatedWorkDetails,
        },
      },
    }));
  },

  // 특정 record_id의 캐시된 상태를 강제로 업데이트하는 함수
  updateCachedRecordStatus: (recordId, newStatus) => {
    Object.keys(get().workReports).forEach((cacheKey) => {
      const reportData = get().workReports[cacheKey];
      if (reportData && reportData.workDetails) {
        let updated = false;
        const updatedDetails = reportData.workDetails.map((detail) => {
          if (detail.record_id === recordId) {
            updated = true;
            return { ...detail, payment_status: newStatus };
          }
          return detail;
        });
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

  // 상태 초기화
  resetStore: () =>
    set({
      workers: [],
      workerDetails: {},
      workReports: {},
      selectedWorker: null,
      yearMonth: getCurrentYearMonth(),
      prevMonthWork: {},
      isLoading: false,
      isWorkerLoading: false,
      isDetailLoading: false,
      isReportLoading: false,
    }),
}));

export default useWorkTimeStore;

/***
 *
 *
 *
 *
 *
 *
 *
 */

// // lib/store/workTimeStore.js
// import { create } from "zustand";
// import { supabase } from "@/lib/supabase";
// // 유틸리티 함수들 임포트
// import { formatNumber, parseNumber } from "@/lib/utils/formattingUtils";
// import {
//   getCurrentYearMonth,
//   getDaysInMonth,
//   isSundayByDate,
//   isHolidayByDate,
//   getPreviousYearMonthFromSelected,
// } from "@/lib/utils/dateUtils";
// import {
//   calculateTotalWorkHours,
//   calculateWorkDays,
//   calculateTotalWage,
//   calculateHourlyRate,
//   determineWorkType,
//   createWorkTypeMetadata,
//   parseWorkTypeMetadata,
// } from "@/lib/utils/workTimeUtils";
// import { calculateInsurancePremium } from "@/lib/utils/insuranceCalculations";
// const useWorkTimeStore = create((set, get) => ({
//   // 상태 - 보험 관련 제거하여 중복 방지
//   workers: [], // 근로자 목록
//   workerDetails: {}, // 근로자 ID를 키로 하는 상세 정보 캐시
//   workReports: {}, // 근로자-현장-월 조합을 키로 하는 근무 기록 캐시
//   selectedWorker: null, // 선택된 근로자
//   yearMonth: getCurrentYearMonth(), // 선택된 년월
//   prevMonthWork: {}, // 이전 월 근무 기록 (근로자-현장-월 조합을 키로 하는 객체)
//   // ❌ 제거: insuranceStatus: {}, // 중복 제거 - insuranceStatusStore에서 관리
//   // 로딩 상태 (컴포넌트별로 분리)
//   isLoading: false,
//   isWorkerLoading: false,
//   isDetailLoading: false, // 근로자 상세 정보 로딩 상태
//   isReportLoading: false, // 근무 기록 로딩 상태
//   // 유틸리티 함수들 - 별도 파일에서 임포트한 것들 사용
//   formatNumber,
//   parseNumber,
//   isSunday: (day) => isSundayByDate(day, get().yearMonth),
//   isHoliday: (dateStr) => isHolidayByDate(dateStr),
//   getDaysInMonth: (yearMonth) => getDaysInMonth(yearMonth || get().yearMonth),
//   // 보험료 계산 - 개선된 함수 사용
//   calculateInsuranceFee: (wage, insuranceType) => {
//     return calculateInsurancePremium(parseNumber(wage), insuranceType);
//   },
//   // ✅ 새로운 통합 함수 - insuranceStatusStore에 업데이트 알림
//   notifyInsuranceStatusUpdate: async (workerId, siteId, yearMonth) => {
//     try {
//       // 동적 import로 순환 참조 방지
//       const { default: useInsuranceStatusStore } = await import("@/lib/store/insuranceStatusStore");
//       // 캐시 무효화 후 재로드
//       useInsuranceStatusStore.getState().clearStatusCache(workerId, siteId, yearMonth);

//       // 새로운 상태 로드
//       setTimeout(async () => {
//         await useInsuranceStatusStore.getState().loadInsuranceStatus(workerId, siteId, yearMonth);
//       }, 100);
//     } catch (error) {
//       console.error("보험 상태 업데이트 알림 실패:", error);
//     }
//   },
//   // 근로자 목록 가져오기 - 현장 ID를 매개변수로 받음
//   fetchWorkers: async (siteId, searchTerm = "") => {
//     const { yearMonth } = get();
//     if (!siteId || !yearMonth) {
//       set({ workers: [] });
//       return;
//     }
//     try {
//       set({ isWorkerLoading: true });

//       // 선택된 년/월 기준 날짜 범위 계산
//       const { currentYearMonth, nextYearMonth } = getPreviousYearMonthFromSelected(
//         yearMonth.split("-")[0],
//         yearMonth.split("-")[1]
//       );

//       const startDate = `${currentYearMonth}-01`;
//       const endDate = `${nextYearMonth}-01`;

//       // 1. 선택된 현장에서 선택한 월에 등록된 근로자 ID만 가져오기
//       const { data: workRecords, error: recordsError } = await supabase
//         .from("work_records")
//         .select("worker_id, work_type, work_date, status")
//         .eq("site_id", siteId)
//         .or(
//           `registration_month.eq.${yearMonth},and(work_date.gte.${startDate},work_date.lt.${endDate})`
//         );

//       if (recordsError) throw recordsError;

//       // 근무 이력이 있는 근로자 ID (중복 제거)
//       const allRegisteredWorkerIds =
//         Array.from(new Set(workRecords?.map((record) => record.worker_id))) || [];

//       // registration 유형을 제외한 근무 이력이 있는 근로자 ID
//       const workerIdsWithHistory =
//         Array.from(
//           new Set(
//             workRecords
//               ?.filter((record) => record.work_type !== "registration")
//               .map((record) => record.worker_id)
//           )
//         ) || [];

//       // 근로자 정보 가져오기
//       let workersQuery = supabase
//         .from("workers")
//         .select("*")
//         .in("worker_id", allRegisteredWorkerIds)
//         .order("name");

//       if (searchTerm) {
//         workersQuery = workersQuery.ilike("name", `%${searchTerm}%`);
//       }

//       const { data: workersData, error: workersError } = await workersQuery;

//       if (workersError) throw workersError;

//       // 각 근로자에 근무 이력 및 등록 여부 표시
//       const workersWithMetadata =
//         workersData?.map((worker) => ({
//           ...worker,
//           hasWorkHistory: workerIdsWithHistory.includes(worker.worker_id),
//           isRegistered: allRegisteredWorkerIds.includes(worker.worker_id),
//         })) || [];

//       set({ workers: workersWithMetadata, isWorkerLoading: false });
//     } catch (error) {
//       console.error("근로자 목록 조회 오류:", error);
//       set({ isWorkerLoading: false });
//     }
//   },
//   // 근로자 상세 정보 가져오기
//   fetchWorkerDetails: async (workerId) => {
//     if (!workerId) {
//       console.warn("❌ workerId가 없습니다.");
//       return;
//     }
//     // 이미 캐시에 있는 경우 API 호출 생략
//     const { workerDetails } = get();
//     if (workerDetails[workerId]) {
//       set({ selectedWorker: workerId });
//       return;
//     }

//     try {
//       set({ isDetailLoading: true });

//       const { data, error } = await supabase
//         .from("workers")
//         .select("*")
//         .eq("worker_id", workerId)
//         .single();

//       if (error) throw error;

//       // 캐시에 추가
//       set((state) => ({
//         workerDetails: { ...state.workerDetails, [workerId]: data },
//         selectedWorker: workerId,
//         isDetailLoading: false,
//       }));
//     } catch (error) {
//       console.error("❌ 근로자 상세 정보 조회 오류:", error);
//       set({ isDetailLoading: false, selectedWorker: null });
//     }
//   },
//   // 근무 기록 가져오기
//   fetchWorkReports: async (workerId, siteId, yearMonth) => {
//     if (!workerId || !siteId || !yearMonth) return;
//     // 캐시 키 생성
//     const cacheKey = `${workerId}-${siteId}-${yearMonth}`;

//     // 이미 캐시에 있는 경우 API 호출 생략
//     const { workReports } = get();
//     if (workReports[cacheKey]) {
//       return;
//     }

//     try {
//       set({ isReportLoading: true });

//       // 날짜 계산
//       const { currentMonthStartDate, nextMonthStartDate } = getPreviousYearMonthFromSelected(
//         yearMonth.split("-")[0],
//         yearMonth.split("-")[1]
//       );

//       const startDate = currentMonthStartDate.toISOString().split("T")[0];
//       const endDate = nextMonthStartDate.toISOString().split("T")[0];

//       // 일용근로자 근로확인신고 여부 확인
//       const { data: reports, error: reportsError } = await supabase
//         .from("daily_work_reports")
//         .select("*")
//         .eq("worker_id", workerId)
//         .eq("site_id", siteId)
//         .eq("report_month", yearMonth);

//       if (reportsError) throw reportsError;

//       let reportData = null;
//       let workDetails = Array.from({ length: 31 }, () => ({
//         hours: "",
//         extended: false,
//         holiday: false,
//         night: false,
//         wage: "",
//         payment_status: "unpaid",
//         payment_date: null,
//       }));

//       if (reports && reports.length > 0) {
//         reportData = reports[0];

//         // 일용근로자 근로확인신고 상세 데이터 가져오기
//         const { data: details, error: detailsError } = await supabase
//           .from("daily_work_report_details")
//           .select("*")
//           .eq("report_id", reportData.report_id)
//           .order("work_date");

//         if (detailsError) throw detailsError;

//         reportData.details = details || [];

//         if (details && details.length > 0) {
//           // work_records 테이블에서 해당 월의 작업 유형 정보 가져오기
//           const { data: workRecords, error: workRecordsError } = await supabase
//             .from("work_records")
//             .select("*, payment_status, payment_date")
//             .eq("worker_id", workerId)
//             .eq("site_id", siteId)
//             .gte("work_date", startDate)
//             .lt("work_date", endDate)
//             .not("work_type", "eq", "registration");

//           if (workRecordsError) throw workRecordsError;

//           // 날짜별 작업 유형 및 지급 상태 정보를 맵으로 구성
//           const workTypeMap = {};
//           if (workRecords && workRecords.length > 0) {
//             workRecords.forEach((record) => {
//               const day = new Date(record.work_date).getDate();

//               // 작업 유형 기본값 설정
//               let extended = false;
//               let holiday = false;
//               let night = false;

//               // work_type 필드로 기본 설정
//               if (record.work_type === "overtime") extended = true;
//               if (record.work_type === "holiday") holiday = true;
//               if (record.work_type === "night") night = true;

//               // 메타데이터 필드가 있으면 더 정확한 정보 사용
//               if (record.work_type_metadata) {
//                 try {
//                   const metadata = parseWorkTypeMetadata(record.work_type_metadata);
//                   extended = metadata.extended || extended;
//                   holiday = metadata.holiday || holiday;
//                   night = metadata.night || night;
//                 } catch (e) {
//                   console.error("메타데이터 파싱 오류:", e);
//                 }
//               }

//               // 지급 상태 정보 추가
//               workTypeMap[day] = {
//                 extended,
//                 holiday,
//                 night,
//                 payment_status: record.payment_status || "unpaid",
//                 payment_date: record.payment_date || null,
//               };
//             });
//           }

//           // daily_work_report_details와 work_type 정보를 결합
//           details.forEach((detail) => {
//             const day = new Date(detail.work_date).getDate() - 1; // 0부터 시작하는 인덱스
//             if (day >= 0 && day < 31) {
//               const dayNum = day + 1;
//               const workType = workTypeMap[dayNum] || {
//                 extended: false,
//                 holiday: isSundayByDate(day, yearMonth),
//                 night: false,
//                 payment_status: "unpaid",
//                 payment_date: null,
//               };

//               workDetails[day] = {
//                 hours: detail.work_hours.toString(),
//                 extended: workType.extended,
//                 holiday: workType.holiday,
//                 night: workType.night,
//                 wage: formatNumber(detail.daily_wage.toString()),
//                 payment_status: workType.payment_status,
//                 payment_date: workType.payment_date,
//               };
//             }
//           });
//         }
//       } else {
//         // daily_work_reports에 데이터가 없으면 work_records에서 직접 확인
//         const { data: workRecords, error: workRecordsError } = await supabase
//           .from("work_records")
//           .select("*, payment_status, payment_date")
//           .eq("worker_id", workerId)
//           .eq("site_id", siteId)
//           .gte("work_date", startDate)
//           .lt("work_date", endDate)
//           .not("work_type", "eq", "registration");

//         if (workRecordsError) throw workRecordsError;

//         // work_records에서 데이터를 가져와 적용
//         if (workRecords && workRecords.length > 0) {
//           workRecords.forEach((record) => {
//             const day = new Date(record.work_date).getDate() - 1;
//             if (day >= 0 && day < 31) {
//               // 메타데이터 추출하여 작업 유형 판단
//               let isExtended = record.work_type === "overtime";
//               let isHoliday = record.work_type === "holiday" || isSundayByDate(day, yearMonth);
//               let isNight = record.work_type === "night";

//               if (record.work_type_metadata) {
//                 try {
//                   const metadata = parseWorkTypeMetadata(record.work_type_metadata);
//                   isExtended = metadata.extended || isExtended;
//                   isHoliday = metadata.holiday || isHoliday;
//                   isNight = metadata.night || isNight;
//                 } catch (e) {
//                   console.error("메타데이터 파싱 오류:", e);
//                 }
//               }

//               workDetails[day] = {
//                 hours: record.work_hours.toString(),
//                 extended: isExtended,
//                 holiday: isHoliday,
//                 night: isNight,
//                 wage: formatNumber(record.daily_wage ? record.daily_wage.toString() : "0"),
//                 payment_status: record.payment_status || "unpaid",
//                 payment_date: record.payment_date || null,
//               };
//             }
//           });
//         }
//       }

//       // 캐시에 추가
//       set((state) => ({
//         workReports: {
//           ...state.workReports,
//           [cacheKey]: {
//             report: reportData,
//             workDetails: workDetails,
//           },
//         },
//         isReportLoading: false,
//       }));

//       // 이전 월 근무 기록 확인
//       await get().fetchPreviousMonthWork(workerId, siteId, yearMonth);

//       // ✅ 보험 상태 업데이트 알림 (기존 로직 대체)
//       await get().notifyInsuranceStatusUpdate(workerId, siteId, yearMonth);
//     } catch (error) {
//       console.error("근무 기록 조회 오류:", error);
//       set({ isReportLoading: false });
//     }
//   },
//   // 이전 월 근무 기록 가져오기
//   fetchPreviousMonthWork: async (workerId, siteId, yearMonth) => {
//     if (!workerId || !siteId || !yearMonth) return;
//     // 이전 월 계산
//     const { prevYearMonth, prevMonthStartDate, currentMonthStartDate } =
//       getPreviousYearMonthFromSelected(yearMonth.split("-")[0], yearMonth.split("-")[1]);

//     const prevMonthStart = prevMonthStartDate.toISOString().split("T")[0];
//     const currentMonthStart = currentMonthStartDate.toISOString().split("T")[0];

//     // 캐시 키 생성
//     const cacheKey = `${workerId}-${siteId}-${prevYearMonth}`;

//     // 이미 캐시에 있는 경우 API 호출 생략
//     const { prevMonthWork } = get();
//     if (prevMonthWork[cacheKey]) {
//       return;
//     }

//     try {
//       // 이전월 근무 기록 조회
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

//       // 등록 여부 확인
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
//         days: workDays,
//         hours: workHours,
//         startDate: firstWorkDate || "없음",
//         monthlyWage,
//         isRegistered,
//       };

//       // 캐시에 추가
//       set((state) => ({
//         prevMonthWork: { ...state.prevMonthWork, [cacheKey]: result },
//       }));
//     } catch (error) {
//       console.error("이전 월 근무 기록 조회 오류:", error);
//     }
//   },
//   // 근로자를 현장에 등록하는 함수
//   registerWorkerToSite: async (workerId, siteId) => {
//     const { yearMonth } = get();
//     if (!workerId || !siteId || !yearMonth) {
//       return { success: false, message: "근로자와 공사현장을 선택해주세요." };
//     }

//     try {
//       set({ isLoading: true });

//       // 이미 같은 월에 등록되어 있는지 확인
//       const { data: existingRecord, error: checkError } = await supabase
//         .from("work_records")
//         .select("*")
//         .eq("worker_id", workerId)
//         .eq("site_id", siteId)
//         .eq("registration_month", yearMonth)
//         .maybeSingle();

//       if (checkError && checkError.code !== "PGRST116") {
//         throw checkError;
//       }

//       if (existingRecord) {
//         set({ isLoading: false });
//         return { success: false, message: "이미 해당 현장의 선택한 월에 등록된 근로자입니다." };
//       }

//       // 새 등록 기록 생성
//       const today = new Date().toISOString().split("T")[0];
//       const { error: insertError } = await supabase.from("work_records").insert({
//         worker_id: workerId,
//         site_id: siteId,
//         work_date: today,
//         work_hours: 0,
//         work_type: "registration",
//         daily_wage: 0,
//         status: "registration",
//         registration_month: yearMonth,
//       });

//       if (insertError) throw insertError;

//       // 근로자 목록 갱신
//       await get().fetchWorkers(siteId);

//       set({ isLoading: false });
//       return { success: true, message: `근로자가 ${yearMonth}월에 성공적으로 등록되었습니다.` };
//     } catch (error) {
//       console.error("근로자 등록 오류:", error);
//       set({ isLoading: false });
//       return { success: false, message: `등록 중 오류가 발생했습니다: ${error.message}` };
//     }
//   },
//   // 근무 기록 저장 - 보험 상태 업데이트 알림 추가
//   saveWorkRecords: async (workerId, siteId, yearMonth, workDetails) => {
//     if (!workerId || !siteId || !yearMonth) {
//       return { success: false, message: "근로자, 공사현장, 근무년월을 모두 선택해주세요." };
//     }
//     try {
//       set({ isLoading: true });

//       // 지급완료된 항목 개수 추적
//       let paidRecordsCount = 0;

//       // 현재 월의 전체 날짜 범위 가져오기
//       const { currentMonthStartDate, nextMonthStartDate } = getPreviousYearMonthFromSelected(
//         yearMonth.split("-")[0],
//         yearMonth.split("-")[1]
//       );

//       const startDate = currentMonthStartDate.toISOString().split("T")[0];
//       const endDate = nextMonthStartDate.toISOString().split("T")[0];

//       // 1. 기존 work_records 데이터 조회
//       const { data: existingRecords, error: existingRecordsError } = await supabase
//         .from("work_records")
//         .select("*")
//         .eq("worker_id", workerId)
//         .eq("site_id", siteId)
//         .gte("work_date", startDate)
//         .lt("work_date", endDate)
//         .not("work_type", "eq", "registration");

//       if (existingRecordsError) throw existingRecordsError;

//       // 날짜별 기존 레코드 맵 구성
//       const existingRecordsMap = {};
//       if (existingRecords && existingRecords.length > 0) {
//         existingRecords.forEach((record) => {
//           existingRecordsMap[record.work_date] = record;
//         });
//       }

//       // 2. 처리할 작업 세부사항 구성
//       const processedWorkDetails = [];
//       const daysInMonth = getDaysInMonth(yearMonth);

//       for (let day = 1; day <= daysInMonth; day++) {
//         const dateStr = `${yearMonth}-${String(day).padStart(2, "0")}`;
//         const detailIndex = day - 1;
//         const currentDetail = workDetails[detailIndex] || {};

//         const existingRecord = existingRecordsMap[dateStr];

//         // 지급완료 레코드면 기존 데이터 유지
//         if (existingRecord && existingRecord.payment_status === "paid") {
//           paidRecordsCount++;

//           processedWorkDetails.push({
//             ...currentDetail,
//             day,
//             date: dateStr,
//             hours: existingRecord.work_hours.toString(),
//             wage: formatNumber(
//               existingRecord.daily_wage ? existingRecord.daily_wage.toString() : "0"
//             ),
//             payment_status: "paid",
//             payment_date: existingRecord.payment_date,
//             record_id: existingRecord.record_id,
//             preserve: true,
//           });
//         } else if (currentDetail.hours && currentDetail.wage) {
//           processedWorkDetails.push({
//             ...currentDetail,
//             day,
//             date: dateStr,
//             payment_status: "unpaid",
//             payment_date: null,
//           });
//         } else if (existingRecord) {
//           processedWorkDetails.push({
//             ...currentDetail,
//             day,
//             date: dateStr,
//             payment_status: existingRecord.payment_status || "unpaid",
//             payment_date: existingRecord.payment_date,
//           });
//         }
//       }

//       // 저장할 유효한 레코드 필터링
//       const validWorkDetails = processedWorkDetails.filter((detail) => detail.hours && detail.wage);

//       if (validWorkDetails.length === 0) {
//         set({ isLoading: false });
//         return {
//           success: false,
//           message: "최소 하나 이상의 근무 기록을 입력해주세요.",
//         };
//       }

//       // 총 근무일수, 평균 근무시간, 총 임금 계산
//       const totalWorkDays = validWorkDetails.length;
//       const totalHours = validWorkDetails.reduce((sum, detail) => sum + Number(detail.hours), 0);
//       const avgDailyWorkHours = totalWorkDays > 0 ? totalHours / totalWorkDays : 0;
//       const totalWage = validWorkDetails.reduce(
//         (sum, detail) => sum + parseNumber(detail.wage || 0),
//         0
//       );

//       // 캐시 키 생성
//       const cacheKey = `${workerId}-${siteId}-${yearMonth}`;
//       const { workReports } = get();
//       const existingReport = workReports[cacheKey]?.report;

//       let reportId;

//       // 3. 일용근로자 근로확인신고 보고서 처리
//       if (existingReport) {
//         const { error: updateError } = await supabase
//           .from("daily_work_reports")
//           .update({
//             total_work_days: totalWorkDays,
//             avg_daily_work_hours: avgDailyWorkHours,
//             total_wage: totalWage,
//             total_compensation: totalWage,
//             total_paid_days: totalWorkDays,
//             updated_at: new Date().toISOString(),
//           })
//           .eq("report_id", existingReport.report_id);

//         if (updateError) throw updateError;

//         reportId = existingReport.report_id;

//         // 기존 상세 데이터 전체 삭제
//         const { error: deleteDetailsError } = await supabase
//           .from("daily_work_report_details")
//           .delete()
//           .eq("report_id", reportId);

//         if (deleteDetailsError) throw deleteDetailsError;
//       } else {
//         // 새 신고 데이터 생성
//         const { data: newReport, error: insertError } = await supabase
//           .from("daily_work_reports")
//           .insert({
//             worker_id: workerId,
//             site_id: siteId,
//             report_month: yearMonth,
//             insurance_type: "5",
//             total_work_days: totalWorkDays,
//             avg_daily_work_hours: avgDailyWorkHours,
//             total_wage: totalWage,
//             total_compensation: totalWage,
//             total_paid_days: totalWorkDays,
//             payment_month: yearMonth,
//             report_status: "draft",
//           })
//           .select();

//         if (insertError) throw insertError;

//         reportId = newReport[0].report_id;
//       }

//       // 4. 상세 데이터 생성 및 work_records 테이블 업데이트
//       const detailsToInsert = validWorkDetails.map((detail) => ({
//         report_id: reportId,
//         work_date: detail.date,
//         work_hours: Number(detail.hours),
//         daily_wage: parseNumber(detail.wage || 0),
//       }));

//       // 상세 데이터 삽입
//       if (detailsToInsert.length > 0) {
//         const { error: detailsError } = await supabase
//           .from("daily_work_report_details")
//           .insert(detailsToInsert);

//         if (detailsError) throw detailsError;
//       }

//       // 5. work_records 테이블 처리
//       const recordsToPreserve = validWorkDetails.filter((detail) => detail.preserve);
//       const recordsToInsert = validWorkDetails.filter((detail) => !detail.preserve);

//       const recordIdsToPreserve = recordsToPreserve.map((detail) => detail.record_id);

//       // 기존 레코드 중 보존할 ID 목록에 없는 것들 삭제
//       if (existingRecords && existingRecords.length > 0) {
//         const { error: deleteRecordsError } = await supabase
//           .from("work_records")
//           .delete()
//           .eq("worker_id", workerId)
//           .eq("site_id", siteId)
//           .gte("work_date", startDate)
//           .lt("work_date", endDate)
//           .not("work_type", "eq", "registration")
//           .not(
//             "record_id",
//             "in",
//             recordIdsToPreserve.length > 0 ? `(${recordIdsToPreserve.join(",")})` : "(0)"
//           );

//         if (deleteRecordsError) throw deleteRecordsError;
//       }

//       // 새 레코드 삽입
//       if (recordsToInsert.length > 0) {
//         const workRecordsToInsert = recordsToInsert.map((detail) => {
//           const workType = determineWorkType(detail.day, yearMonth, detail.extended, detail.night);
//           const workTypeMetadata = JSON.stringify(
//             createWorkTypeMetadata(detail.extended, detail.holiday, detail.night)
//           );

//           return {
//             worker_id: workerId,
//             site_id: siteId,
//             work_date: detail.date,
//             work_hours: Number(detail.hours),
//             work_type: workType,
//             work_type_metadata: workTypeMetadata,
//             daily_wage: parseNumber(detail.wage || 0),
//             status: "confirmed",
//             registration_month: yearMonth,
//             payment_status: "unpaid",
//             payment_date: null,
//           };
//         });

//         const { error: insertWorkRecordsError } = await supabase
//           .from("work_records")
//           .insert(workRecordsToInsert);

//         if (insertWorkRecordsError) throw insertWorkRecordsError;
//       }

//       // 6. 캐시 무효화 및 데이터 다시 로드
//       set((state) => ({
//         workReports: {
//           ...state.workReports,
//           [cacheKey]: undefined,
//         },
//       }));

//       // ✅ 보험 상태 업데이트 알림 (외부 스토어들에게)
//       await get().notifyInsuranceStatusUpdate(workerId, siteId, yearMonth);

//       // 외부 스토어 캐시 무효화 (기존 방식 유지)
//       try {
//         const workHistoryStore = require("@/lib/store/workHistoryStore").default;
//         if (workHistoryStore) {
//           workHistoryStore.setState((state) => ({
//             workersHistory: {
//               ...state.workersHistory,
//               [cacheKey]: undefined,
//             },
//           }));
//         }
//       } catch (e) {
//         console.error("WorkHistoryStore 캐시 무효화 실패:", e);
//       }

//       // 전역 이벤트 발생
//       try {
//         const timestamp = new Date().getTime();
//         localStorage.setItem(
//           "worktime_data_updated",
//           JSON.stringify({
//             workerId,
//             siteId,
//             yearMonth,
//             timestamp,
//           })
//         );

//         if (typeof window !== "undefined") {
//           const event = new CustomEvent("worktime_data_updated", {
//             detail: { workerId, siteId, yearMonth, timestamp },
//           });
//           window.dispatchEvent(event);
//         }
//       } catch (e) {
//         console.error("데이터 변경 알림 실패:", e);
//       }

//       // 캐시 무효화 후 로컬 데이터 다시 로드
//       await get().fetchWorkReports(workerId, siteId, yearMonth);

//       set({ isLoading: false });

//       let message = "근무 기록이 저장되었습니다.";
//       if (paidRecordsCount > 0) {
//         message += ` (단, 지급완료된 ${paidRecordsCount}건의 기록은 수정되지 않았습니다.)`;
//       }

//       return {
//         success: true,
//         message: message,
//       };
//     } catch (error) {
//       console.error("근무 기록 저장 오류:", error);
//       set({ isLoading: false });
//       return { success: false, message: `저장 중 오류가 발생했습니다: ${error.message}` };
//     }
//   },
//   // 선택된 년월 설정
//   setYearMonth: (yearMonth) => {
//     set({ yearMonth });
//   },
//   // 근무 기록의 특정 필드 값을 업데이트
//   updateWorkDetail: (index, field, value) => {
//     const { selectedWorker } = get();
//     if (!selectedWorker) return;

//     const { workReports, yearMonth } = get();

//     // 임시로 첫 번째 매칭되는 캐시 키 찾기 (개선 필요)
//     const matchingCacheKey = Object.keys(workReports).find(
//       (key) => key.startsWith(`${selectedWorker}-`) && key.endsWith(`-${yearMonth}`)
//     );

//     if (!matchingCacheKey || !workReports[matchingCacheKey]) return;

//     // 근무 기록 복사본 생성
//     const updatedWorkDetails = [...workReports[matchingCacheKey].workDetails];

//     // 필드에 따라 적절한 처리
//     if (field === "hours") {
//       const numericValue = value.replace(/[^0-9.]/g, "");
//       updatedWorkDetails[index] = {
//         ...updatedWorkDetails[index],
//         hours: numericValue,
//       };
//     } else if (field === "wage") {
//       const numericValue = value.replace(/[^0-9]/g, "");
//       updatedWorkDetails[index] = {
//         ...updatedWorkDetails[index],
//         wage: formatNumber(numericValue),
//       };
//     } else {
//       updatedWorkDetails[index] = {
//         ...updatedWorkDetails[index],
//         [field]: value,
//       };
//     }

//     // 상태 업데이트
//     set((state) => ({
//       workReports: {
//         ...state.workReports,
//         [matchingCacheKey]: {
//           ...state.workReports[matchingCacheKey],
//           workDetails: updatedWorkDetails,
//         },
//       },
//     }));
//   },
//   // ❌ 제거: checkInsuranceStatus (insuranceStatusStore에서 관리)
//   // ❌ 제거: recalculateInsuranceStatus (insuranceStatusStore에서 관리)
//   // 특정 record_id의 캐시된 상태를 강제로 업데이트하는 함수
//   updateCachedRecordStatus: (recordId, newStatus) => {
//     Object.keys(get().workReports).forEach((cacheKey) => {
//       const reportData = get().workReports[cacheKey];
//       if (reportData && reportData.workDetails) {
//         let updated = false;
//         const updatedDetails = reportData.workDetails.map((detail) => {
//           if (detail.record_id === recordId) {
//             updated = true;
//             return { ...detail, payment_status: newStatus };
//           }
//           return detail;
//         });
//         if (updated) {
//           set((state) => ({
//             workReports: {
//               ...state.workReports,
//               [cacheKey]: {
//                 ...reportData,
//                 workDetails: updatedDetails,
//               },
//             },
//           }));
//         }
//       }
//     });
//   },
//   // 상태 초기화
//   resetStore: () =>
//     set({
//       workers: [],
//       workerDetails: {},
//       workReports: {},
//       selectedWorker: null,
//       yearMonth: getCurrentYearMonth(),
//       prevMonthWork: {},
//       // ❌ 제거: insuranceStatus: {},
//       isLoading: false,
//       isWorkerLoading: false,
//       isDetailLoading: false,
//       isReportLoading: false,
//     }),
// }));
// export default useWorkTimeStore;

/**
 *
 *
 *
 *
 */

// import { create } from "zustand";
// import { supabase } from "@/lib/supabase";

// // 유틸리티 함수들 임포트
// import { formatNumber, parseNumber } from "@/lib/utils/formattingUtils";

// import {
//   getCurrentYearMonth,
//   getDaysInMonth,
//   isSundayByDate,
//   isHolidayByDate,
//   getPreviousYearMonthFromSelected,
// } from "@/lib/utils/dateUtils";

// import {
//   calculateTotalWorkHours,
//   calculateWorkDays,
//   calculateTotalWage,
//   calculateHourlyRate,
//   determineWorkType,
//   createWorkTypeMetadata,
//   parseWorkTypeMetadata,
// } from "@/lib/utils/workTimeUtils";

// import { calculateInsurancePremium } from "@/lib/utils/insuranceCalculations";

// const useWorkTimeStore = create((set, get) => ({
//   // 상태 - 현장 관련 제거, 근무시간 관리만 담당
//   workers: [], // 근로자 목록
//   workerDetails: {}, // 근로자 ID를 키로 하는 상세 정보 캐시
//   workReports: {}, // 근로자-현장-월 조합을 키로 하는 근무 기록 캐시
//   selectedWorker: null, // 선택된 근로자
//   yearMonth: getCurrentYearMonth(), // 선택된 년월
//   prevMonthWork: {}, // 이전 월 근무 기록 (근로자-현장-월 조합을 키로 하는 객체)
//   insuranceStatus: {}, // 4대보험 상태 (근로자-현장 조합을 키로 하는 객체)

//   // 로딩 상태 (컴포넌트별로 분리)
//   isLoading: false,
//   isWorkerLoading: false,
//   isDetailLoading: false, // 근로자 상세 정보 로딩 상태
//   isReportLoading: false, // 근무 기록 로딩 상태

//   // 유틸리티 함수들 - 별도 파일에서 임포트한 것들 사용
//   formatNumber,
//   parseNumber,
//   isSunday: (day) => isSundayByDate(day, get().yearMonth),
//   isHoliday: (dateStr) => isHolidayByDate(dateStr),
//   getDaysInMonth: (yearMonth) => getDaysInMonth(yearMonth || get().yearMonth),

//   // 보험료 계산 - 개선된 함수 사용
//   calculateInsuranceFee: (wage, insuranceType) => {
//     return calculateInsurancePremium(parseNumber(wage), insuranceType);
//   },

//   // 근로자 목록 가져오기 - 현장 ID를 매개변수로 받음
//   fetchWorkers: async (siteId, searchTerm = "") => {
//     const { yearMonth } = get();
//     if (!siteId || !yearMonth) {
//       set({ workers: [] });
//       return;
//     }

//     try {
//       set({ isWorkerLoading: true });

//       // 선택된 년/월 기준 날짜 범위 계산
//       const { currentYearMonth, nextYearMonth } = getPreviousYearMonthFromSelected(
//         yearMonth.split("-")[0],
//         yearMonth.split("-")[1]
//       );

//       const startDate = `${currentYearMonth}-01`;
//       const endDate = `${nextYearMonth}-01`;

//       // 1. 선택된 현장에서 선택한 월에 등록된 근로자 ID만 가져오기
//       const { data: workRecords, error: recordsError } = await supabase
//         .from("work_records")
//         .select("worker_id, work_type, work_date, status")
//         .eq("site_id", siteId)
//         .or(
//           `registration_month.eq.${yearMonth},and(work_date.gte.${startDate},work_date.lt.${endDate})`
//         );

//       if (recordsError) throw recordsError;

//       // 근무 이력이 있는 근로자 ID (중복 제거)
//       const allRegisteredWorkerIds =
//         Array.from(new Set(workRecords?.map((record) => record.worker_id))) || [];

//       // registration 유형을 제외한 근무 이력이 있는 근로자 ID
//       const workerIdsWithHistory =
//         Array.from(
//           new Set(
//             workRecords
//               ?.filter((record) => record.work_type !== "registration")
//               .map((record) => record.worker_id)
//           )
//         ) || [];

//       // 근로자 정보 가져오기
//       let workersQuery = supabase
//         .from("workers")
//         .select("*")
//         .in("worker_id", allRegisteredWorkerIds)
//         .order("name");

//       if (searchTerm) {
//         workersQuery = workersQuery.ilike("name", `%${searchTerm}%`);
//       }

//       const { data: workersData, error: workersError } = await workersQuery;

//       if (workersError) throw workersError;

//       // 각 근로자에 근무 이력 및 등록 여부 표시
//       const workersWithMetadata =
//         workersData?.map((worker) => ({
//           ...worker,
//           hasWorkHistory: workerIdsWithHistory.includes(worker.worker_id),
//           isRegistered: allRegisteredWorkerIds.includes(worker.worker_id),
//         })) || [];

//       set({ workers: workersWithMetadata, isWorkerLoading: false });
//     } catch (error) {
//       console.error("근로자 목록 조회 오류:", error);
//       set({ isWorkerLoading: false });
//     }
//   },

//   // 근로자 상세 정보 가져오기
//   fetchWorkerDetails: async (workerId) => {
//     console.log("🔄 fetchWorkerDetails 호출:", workerId);

//     if (!workerId) {
//       console.warn("❌ workerId가 없습니다.");
//       return;
//     }

//     // 이미 캐시에 있는 경우 API 호출 생략
//     const { workerDetails } = get();
//     if (workerDetails[workerId]) {
//       console.log("✅ 캐시에서 찾음:", workerDetails[workerId].name);
//       set({ selectedWorker: workerId });
//       return;
//     }

//     try {
//       console.log("🔍 DB에서 조회 시작...");
//       set({ isDetailLoading: true });

//       const { data, error } = await supabase
//         .from("workers")
//         .select("*")
//         .eq("worker_id", workerId)
//         .single();

//       console.log("📊 DB 조회 결과:", { data: data?.name, error });

//       if (error) throw error;

//       // 캐시에 추가
//       set((state) => ({
//         workerDetails: { ...state.workerDetails, [workerId]: data },
//         selectedWorker: workerId,
//         isDetailLoading: false,
//       }));

//       console.log("✅ 근로자 정보 로드 완료:", data.name);
//     } catch (error) {
//       console.error("❌ 근로자 상세 정보 조회 오류:", error);
//       set({ isDetailLoading: false, selectedWorker: null });
//     }
//   },

//   // 근무 기록 가져오기
//   fetchWorkReports: async (workerId, siteId, yearMonth) => {
//     if (!workerId || !siteId || !yearMonth) return;

//     // 캐시 키 생성
//     const cacheKey = `${workerId}-${siteId}-${yearMonth}`;

//     // 이미 캐시에 있는 경우 API 호출 생략
//     const { workReports } = get();
//     if (workReports[cacheKey]) {
//       return;
//     }

//     try {
//       set({ isReportLoading: true });

//       // 날짜 계산
//       const { currentMonthStartDate, nextMonthStartDate } = getPreviousYearMonthFromSelected(
//         yearMonth.split("-")[0],
//         yearMonth.split("-")[1]
//       );

//       const startDate = currentMonthStartDate.toISOString().split("T")[0];
//       const endDate = nextMonthStartDate.toISOString().split("T")[0];

//       // 일용근로자 근로확인신고 여부 확인
//       const { data: reports, error: reportsError } = await supabase
//         .from("daily_work_reports")
//         .select("*")
//         .eq("worker_id", workerId)
//         .eq("site_id", siteId)
//         .eq("report_month", yearMonth);

//       if (reportsError) throw reportsError;

//       let reportData = null;
//       let workDetails = Array.from({ length: 31 }, () => ({
//         hours: "",
//         extended: false,
//         holiday: false,
//         night: false,
//         wage: "",
//         payment_status: "unpaid",
//         payment_date: null,
//       }));

//       if (reports && reports.length > 0) {
//         reportData = reports[0];

//         // 일용근로자 근로확인신고 상세 데이터 가져오기
//         const { data: details, error: detailsError } = await supabase
//           .from("daily_work_report_details")
//           .select("*")
//           .eq("report_id", reportData.report_id)
//           .order("work_date");

//         if (detailsError) throw detailsError;

//         reportData.details = details || [];

//         if (details && details.length > 0) {
//           // work_records 테이블에서 해당 월의 작업 유형 정보 가져오기
//           const { data: workRecords, error: workRecordsError } = await supabase
//             .from("work_records")
//             .select("*, payment_status, payment_date")
//             .eq("worker_id", workerId)
//             .eq("site_id", siteId)
//             .gte("work_date", startDate)
//             .lt("work_date", endDate)
//             .not("work_type", "eq", "registration");

//           if (workRecordsError) throw workRecordsError;

//           // 날짜별 작업 유형 및 지급 상태 정보를 맵으로 구성
//           const workTypeMap = {};
//           if (workRecords && workRecords.length > 0) {
//             workRecords.forEach((record) => {
//               const day = new Date(record.work_date).getDate();

//               // 작업 유형 기본값 설정
//               let extended = false;
//               let holiday = false;
//               let night = false;

//               // work_type 필드로 기본 설정
//               if (record.work_type === "overtime") extended = true;
//               if (record.work_type === "holiday") holiday = true;
//               if (record.work_type === "night") night = true;

//               // 메타데이터 필드가 있으면 더 정확한 정보 사용
//               if (record.work_type_metadata) {
//                 try {
//                   const metadata = parseWorkTypeMetadata(record.work_type_metadata);
//                   extended = metadata.extended || extended;
//                   holiday = metadata.holiday || holiday;
//                   night = metadata.night || night;
//                 } catch (e) {
//                   console.error("메타데이터 파싱 오류:", e);
//                 }
//               }

//               // 지급 상태 정보 추가
//               workTypeMap[day] = {
//                 extended,
//                 holiday,
//                 night,
//                 payment_status: record.payment_status || "unpaid",
//                 payment_date: record.payment_date || null,
//               };
//             });
//           }

//           // daily_work_report_details와 work_type 정보를 결합
//           details.forEach((detail) => {
//             const day = new Date(detail.work_date).getDate() - 1; // 0부터 시작하는 인덱스
//             if (day >= 0 && day < 31) {
//               const dayNum = day + 1;
//               const workType = workTypeMap[dayNum] || {
//                 extended: false,
//                 holiday: isSundayByDate(day, yearMonth),
//                 night: false,
//                 payment_status: "unpaid",
//                 payment_date: null,
//               };

//               workDetails[day] = {
//                 hours: detail.work_hours.toString(),
//                 extended: workType.extended,
//                 holiday: workType.holiday,
//                 night: workType.night,
//                 wage: formatNumber(detail.daily_wage.toString()),
//                 payment_status: workType.payment_status,
//                 payment_date: workType.payment_date,
//               };
//             }
//           });
//         }
//       } else {
//         // daily_work_reports에 데이터가 없으면 work_records에서 직접 확인
//         const { data: workRecords, error: workRecordsError } = await supabase
//           .from("work_records")
//           .select("*, payment_status, payment_date")
//           .eq("worker_id", workerId)
//           .eq("site_id", siteId)
//           .gte("work_date", startDate)
//           .lt("work_date", endDate)
//           .not("work_type", "eq", "registration");

//         if (workRecordsError) throw workRecordsError;

//         // work_records에서 데이터를 가져와 적용
//         if (workRecords && workRecords.length > 0) {
//           workRecords.forEach((record) => {
//             const day = new Date(record.work_date).getDate() - 1;
//             if (day >= 0 && day < 31) {
//               // 메타데이터 추출하여 작업 유형 판단
//               let isExtended = record.work_type === "overtime";
//               let isHoliday = record.work_type === "holiday" || isSundayByDate(day, yearMonth);
//               let isNight = record.work_type === "night";

//               if (record.work_type_metadata) {
//                 try {
//                   const metadata = parseWorkTypeMetadata(record.work_type_metadata);
//                   isExtended = metadata.extended || isExtended;
//                   isHoliday = metadata.holiday || isHoliday;
//                   isNight = metadata.night || isNight;
//                 } catch (e) {
//                   console.error("메타데이터 파싱 오류:", e);
//                 }
//               }

//               workDetails[day] = {
//                 hours: record.work_hours.toString(),
//                 extended: isExtended,
//                 holiday: isHoliday,
//                 night: isNight,
//                 wage: formatNumber(record.daily_wage ? record.daily_wage.toString() : "0"),
//                 payment_status: record.payment_status || "unpaid",
//                 payment_date: record.payment_date || null,
//               };
//             }
//           });
//         }
//       }

//       // 캐시에 추가
//       set((state) => ({
//         workReports: {
//           ...state.workReports,
//           [cacheKey]: {
//             report: reportData,
//             workDetails: workDetails,
//           },
//         },
//         isReportLoading: false,
//       }));

//       // 4대보험 상태 확인
//       await get().checkInsuranceStatus(workerId, siteId);

//       // 이전 월 근무 기록 확인
//       await get().fetchPreviousMonthWork(workerId, siteId, yearMonth);

//       // 근무 기록 로드 후 보험 상태 재계산
//       await get().recalculateInsuranceStatus(workerId, siteId, yearMonth);
//     } catch (error) {
//       console.error("근무 기록 조회 오류:", error);
//       set({ isReportLoading: false });
//     }
//   },

//   // 이전 월 근무 기록 가져오기
//   fetchPreviousMonthWork: async (workerId, siteId, yearMonth) => {
//     if (!workerId || !siteId || !yearMonth) return;

//     // 이전 월 계산
//     const { prevYearMonth, prevMonthStartDate, currentMonthStartDate } =
//       getPreviousYearMonthFromSelected(yearMonth.split("-")[0], yearMonth.split("-")[1]);

//     const prevMonthStart = prevMonthStartDate.toISOString().split("T")[0];
//     const currentMonthStart = currentMonthStartDate.toISOString().split("T")[0];

//     // 캐시 키 생성
//     const cacheKey = `${workerId}-${siteId}-${prevYearMonth}`;

//     // 이미 캐시에 있는 경우 API 호출 생략
//     const { prevMonthWork } = get();
//     if (prevMonthWork[cacheKey]) {
//       return;
//     }

//     try {
//       // 이전월 근무 기록 조회
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

//       // 등록 여부 확인
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
//         days: workDays,
//         hours: workHours,
//         startDate: firstWorkDate || "없음",
//         monthlyWage,
//         isRegistered,
//       };

//       // 캐시에 추가
//       set((state) => ({
//         prevMonthWork: { ...state.prevMonthWork, [cacheKey]: result },
//       }));
//     } catch (error) {
//       console.error("이전 월 근무 기록 조회 오류:", error);
//     }
//   },

//   // 4대보험 상태 확인
//   checkInsuranceStatus: async (workerId, siteId) => {
//     if (!workerId || !siteId) return;

//     // 캐시 키 생성
//     const cacheKey = `${workerId}-${siteId}`;

//     // 이미 캐시에 있는 경우 API 호출 생략
//     const { insuranceStatus } = get();
//     if (insuranceStatus[cacheKey]) {
//       return;
//     }

//     try {
//       // 보험 가입 정보 조회
//       const { data: enrollments, error } = await supabase
//         .from("insurance_enrollments")
//         .select(
//           `
//         enrollment_id,
//         worker_id,
//         site_id,
//         year_month,
//         national_pension_status,
//         health_insurance_status,
//         employment_insurance_status,
//         industrial_accident_status,
//         national_pension_acquisition_date,
//         health_insurance_acquisition_date,
//         employment_insurance_acquisition_date,
//         industrial_accident_acquisition_date,
//         national_pension_loss_date,
//         health_insurance_loss_date,
//         employment_insurance_loss_date,
//         industrial_accident_loss_date
//       `
//         )
//         .eq("worker_id", workerId)
//         .eq("site_id", siteId);

//       if (error) throw error;

//       // 기본 상태 설정
//       const newStatus = {
//         national_pension: "해당사항없음",
//         health_insurance: "해당사항없음",
//         employment_insurance: "해당사항없음",
//         industrial_accident: "해당사항없음",
//       };

//       if (enrollments && enrollments.length > 0) {
//         // 최신 등록 정보를 우선순위로 처리
//         const latestEnrollment = enrollments.sort((a, b) => {
//           const dateA = new Date(a.updated_at || a.created_at || 0);
//           const dateB = new Date(b.updated_at || b.created_at || 0);
//           return dateB - dateA;
//         })[0];

//         // 각 보험 유형별 상태 확인
//         // 국민연금
//         if (
//           latestEnrollment.national_pension_status === "manual_required" ||
//           latestEnrollment.national_pension_status === "auto_required"
//         ) {
//           newStatus.national_pension = "가입대상";
//         }
//         if (
//           latestEnrollment.national_pension_acquisition_date &&
//           !latestEnrollment.national_pension_loss_date
//         ) {
//           newStatus.national_pension = "가입상태";
//         }

//         // 건강보험
//         if (
//           latestEnrollment.health_insurance_status === "manual_required" ||
//           latestEnrollment.health_insurance_status === "auto_required"
//         ) {
//           newStatus.health_insurance = "가입대상";
//         }
//         if (
//           latestEnrollment.health_insurance_acquisition_date &&
//           !latestEnrollment.health_insurance_loss_date
//         ) {
//           newStatus.health_insurance = "가입상태";
//         }

//         // 고용보험
//         if (
//           latestEnrollment.employment_insurance_status === "manual_required" ||
//           latestEnrollment.employment_insurance_status === "auto_required"
//         ) {
//           newStatus.employment_insurance = "가입대상";
//         }
//         if (
//           latestEnrollment.employment_insurance_acquisition_date &&
//           !latestEnrollment.employment_insurance_loss_date
//         ) {
//           newStatus.employment_insurance = "가입상태";
//         }

//         // 산재보험
//         if (
//           latestEnrollment.industrial_accident_status === "manual_required" ||
//           latestEnrollment.industrial_accident_status === "auto_required"
//         ) {
//           newStatus.industrial_accident = "가입대상";
//         }
//         if (
//           latestEnrollment.industrial_accident_acquisition_date &&
//           !latestEnrollment.industrial_accident_loss_date
//         ) {
//           newStatus.industrial_accident = "가입상태";
//         }
//       }

//       // 캐시에 추가
//       set((state) => ({
//         insuranceStatus: { ...state.insuranceStatus, [cacheKey]: newStatus },
//       }));
//     } catch (error) {
//       console.error("4대보험 상태 확인 오류:", error);
//     }
//   },

//   // 근로자를 현장에 등록하는 함수
//   registerWorkerToSite: async (workerId, siteId) => {
//     const { yearMonth } = get();

//     if (!workerId || !siteId || !yearMonth) {
//       return { success: false, message: "근로자와 공사현장을 선택해주세요." };
//     }

//     try {
//       set({ isLoading: true });

//       // 이미 같은 월에 등록되어 있는지 확인
//       const { data: existingRecord, error: checkError } = await supabase
//         .from("work_records")
//         .select("*")
//         .eq("worker_id", workerId)
//         .eq("site_id", siteId)
//         .eq("registration_month", yearMonth)
//         .maybeSingle();

//       if (checkError && checkError.code !== "PGRST116") {
//         throw checkError;
//       }

//       if (existingRecord) {
//         set({ isLoading: false });
//         return { success: false, message: "이미 해당 현장의 선택한 월에 등록된 근로자입니다." };
//       }

//       // 새 등록 기록 생성
//       const today = new Date().toISOString().split("T")[0];
//       const { error: insertError } = await supabase.from("work_records").insert({
//         worker_id: workerId,
//         site_id: siteId,
//         work_date: today,
//         work_hours: 0,
//         work_type: "registration",
//         daily_wage: 0,
//         status: "registration",
//         registration_month: yearMonth,
//       });

//       if (insertError) throw insertError;

//       // 근로자 목록 갱신
//       await get().fetchWorkers(siteId);

//       set({ isLoading: false });
//       return { success: true, message: `근로자가 ${yearMonth}월에 성공적으로 등록되었습니다.` };
//     } catch (error) {
//       console.error("근로자 등록 오류:", error);
//       set({ isLoading: false });
//       return { success: false, message: `등록 중 오류가 발생했습니다: ${error.message}` };
//     }
//   },

//   // 근무 기록 저장
//   saveWorkRecords: async (workerId, siteId, yearMonth, workDetails) => {
//     if (!workerId || !siteId || !yearMonth) {
//       return { success: false, message: "근로자, 공사현장, 근무년월을 모두 선택해주세요." };
//     }

//     try {
//       set({ isLoading: true });

//       // 지급완료된 항목 개수 추적
//       let paidRecordsCount = 0;

//       // 현재 월의 전체 날짜 범위 가져오기
//       const { currentMonthStartDate, nextMonthStartDate } = getPreviousYearMonthFromSelected(
//         yearMonth.split("-")[0],
//         yearMonth.split("-")[1]
//       );

//       const startDate = currentMonthStartDate.toISOString().split("T")[0];
//       const endDate = nextMonthStartDate.toISOString().split("T")[0];

//       // 1. 기존 work_records 데이터 조회
//       const { data: existingRecords, error: existingRecordsError } = await supabase
//         .from("work_records")
//         .select("*")
//         .eq("worker_id", workerId)
//         .eq("site_id", siteId)
//         .gte("work_date", startDate)
//         .lt("work_date", endDate)
//         .not("work_type", "eq", "registration");

//       if (existingRecordsError) throw existingRecordsError;

//       // 날짜별 기존 레코드 맵 구성
//       const existingRecordsMap = {};
//       if (existingRecords && existingRecords.length > 0) {
//         existingRecords.forEach((record) => {
//           existingRecordsMap[record.work_date] = record;
//         });
//       }

//       // 2. 처리할 작업 세부사항 구성
//       const processedWorkDetails = [];
//       const daysInMonth = getDaysInMonth(yearMonth);

//       for (let day = 1; day <= daysInMonth; day++) {
//         const dateStr = `${yearMonth}-${String(day).padStart(2, "0")}`;
//         const detailIndex = day - 1;
//         const currentDetail = workDetails[detailIndex] || {};

//         const existingRecord = existingRecordsMap[dateStr];

//         // 지급완료 레코드면 기존 데이터 유지
//         if (existingRecord && existingRecord.payment_status === "paid") {
//           paidRecordsCount++;

//           processedWorkDetails.push({
//             ...currentDetail,
//             day,
//             date: dateStr,
//             hours: existingRecord.work_hours.toString(),
//             wage: formatNumber(
//               existingRecord.daily_wage ? existingRecord.daily_wage.toString() : "0"
//             ),
//             payment_status: "paid",
//             payment_date: existingRecord.payment_date,
//             record_id: existingRecord.record_id,
//             preserve: true,
//           });
//         } else if (currentDetail.hours && currentDetail.wage) {
//           processedWorkDetails.push({
//             ...currentDetail,
//             day,
//             date: dateStr,
//             payment_status: "unpaid",
//             payment_date: null,
//           });
//         } else if (existingRecord) {
//           processedWorkDetails.push({
//             ...currentDetail,
//             day,
//             date: dateStr,
//             payment_status: existingRecord.payment_status || "unpaid",
//             payment_date: existingRecord.payment_date,
//           });
//         }
//       }

//       // 저장할 유효한 레코드 필터링
//       const validWorkDetails = processedWorkDetails.filter((detail) => detail.hours && detail.wage);

//       if (validWorkDetails.length === 0) {
//         set({ isLoading: false });
//         return {
//           success: false,
//           message: "최소 하나 이상의 근무 기록을 입력해주세요.",
//         };
//       }

//       // 총 근무일수, 평균 근무시간, 총 임금 계산
//       const totalWorkDays = validWorkDetails.length;
//       const totalHours = validWorkDetails.reduce((sum, detail) => sum + Number(detail.hours), 0);
//       const avgDailyWorkHours = totalWorkDays > 0 ? totalHours / totalWorkDays : 0;
//       const totalWage = validWorkDetails.reduce(
//         (sum, detail) => sum + parseNumber(detail.wage || 0),
//         0
//       );

//       // 캐시 키 생성
//       const cacheKey = `${workerId}-${siteId}-${yearMonth}`;
//       const { workReports } = get();
//       const existingReport = workReports[cacheKey]?.report;

//       let reportId;

//       // 3. 일용근로자 근로확인신고 보고서 처리
//       if (existingReport) {
//         const { error: updateError } = await supabase
//           .from("daily_work_reports")
//           .update({
//             total_work_days: totalWorkDays,
//             avg_daily_work_hours: avgDailyWorkHours,
//             total_wage: totalWage,
//             total_compensation: totalWage,
//             total_paid_days: totalWorkDays,
//             updated_at: new Date().toISOString(),
//           })
//           .eq("report_id", existingReport.report_id);

//         if (updateError) throw updateError;

//         reportId = existingReport.report_id;

//         // 기존 상세 데이터 전체 삭제
//         const { error: deleteDetailsError } = await supabase
//           .from("daily_work_report_details")
//           .delete()
//           .eq("report_id", reportId);

//         if (deleteDetailsError) throw deleteDetailsError;
//       } else {
//         // 새 신고 데이터 생성
//         const { data: newReport, error: insertError } = await supabase
//           .from("daily_work_reports")
//           .insert({
//             worker_id: workerId,
//             site_id: siteId,
//             report_month: yearMonth,
//             insurance_type: "5",
//             total_work_days: totalWorkDays,
//             avg_daily_work_hours: avgDailyWorkHours,
//             total_wage: totalWage,
//             total_compensation: totalWage,
//             total_paid_days: totalWorkDays,
//             payment_month: yearMonth,
//             report_status: "draft",
//           })
//           .select();

//         if (insertError) throw insertError;

//         reportId = newReport[0].report_id;
//       }

//       // 4. 상세 데이터 생성 및 work_records 테이블 업데이트
//       const detailsToInsert = validWorkDetails.map((detail) => ({
//         report_id: reportId,
//         work_date: detail.date,
//         work_hours: Number(detail.hours),
//         daily_wage: parseNumber(detail.wage || 0),
//       }));

//       // 상세 데이터 삽입
//       if (detailsToInsert.length > 0) {
//         const { error: detailsError } = await supabase
//           .from("daily_work_report_details")
//           .insert(detailsToInsert);

//         if (detailsError) throw detailsError;
//       }

//       // 5. work_records 테이블 처리
//       const recordsToPreserve = validWorkDetails.filter((detail) => detail.preserve);
//       const recordsToInsert = validWorkDetails.filter((detail) => !detail.preserve);

//       const recordIdsToPreserve = recordsToPreserve.map((detail) => detail.record_id);

//       // 기존 레코드 중 보존할 ID 목록에 없는 것들 삭제
//       if (existingRecords && existingRecords.length > 0) {
//         const { error: deleteRecordsError } = await supabase
//           .from("work_records")
//           .delete()
//           .eq("worker_id", workerId)
//           .eq("site_id", siteId)
//           .gte("work_date", startDate)
//           .lt("work_date", endDate)
//           .not("work_type", "eq", "registration")
//           .not(
//             "record_id",
//             "in",
//             recordIdsToPreserve.length > 0 ? `(${recordIdsToPreserve.join(",")})` : "(0)"
//           );

//         if (deleteRecordsError) throw deleteRecordsError;
//       }

//       // 새 레코드 삽입
//       if (recordsToInsert.length > 0) {
//         const workRecordsToInsert = recordsToInsert.map((detail) => {
//           const workType = determineWorkType(detail.day, yearMonth, detail.extended, detail.night);
//           const workTypeMetadata = JSON.stringify(
//             createWorkTypeMetadata(detail.extended, detail.holiday, detail.night)
//           );

//           return {
//             worker_id: workerId,
//             site_id: siteId,
//             work_date: detail.date,
//             work_hours: Number(detail.hours),
//             work_type: workType,
//             work_type_metadata: workTypeMetadata,
//             daily_wage: parseNumber(detail.wage || 0),
//             status: "confirmed",
//             registration_month: yearMonth,
//             payment_status: "unpaid",
//             payment_date: null,
//           };
//         });

//         const { error: insertWorkRecordsError } = await supabase
//           .from("work_records")
//           .insert(workRecordsToInsert);

//         if (insertWorkRecordsError) throw insertWorkRecordsError;
//       }

//       // 6. 캐시 무효화 및 데이터 다시 로드
//       set((state) => ({
//         workReports: {
//           ...state.workReports,
//           [cacheKey]: undefined,
//         },
//       }));

//       // 외부 스토어 캐시 무효화
//       try {
//         const workHistoryStore = require("@/lib/store/workHistoryStore").default;
//         if (workHistoryStore) {
//           workHistoryStore.setState((state) => ({
//             workersHistory: {
//               ...state.workersHistory,
//               [cacheKey]: undefined,
//             },
//           }));
//         }
//       } catch (e) {
//         console.error("WorkHistoryStore 캐시 무효화 실패:", e);
//       }

//       try {
//         const insuranceStatusStore = require("@/lib/store/insuranceStatusStore").default;
//         if (insuranceStatusStore) {
//           insuranceStatusStore.setState((state) => ({
//             insuranceStatus: {
//               ...state.insuranceStatus,
//               [cacheKey]: undefined,
//             },
//           }));

//           setTimeout(() => {
//             insuranceStatusStore.getState().loadInsuranceStatus(workerId, siteId, yearMonth);
//           }, 100);
//         }
//       } catch (e) {
//         console.error("InsuranceStatusStore 캐시 무효화 실패:", e);
//       }

//       // 전역 이벤트 발생
//       try {
//         const timestamp = new Date().getTime();
//         localStorage.setItem(
//           "worktime_data_updated",
//           JSON.stringify({
//             workerId,
//             siteId,
//             yearMonth,
//             timestamp,
//           })
//         );

//         if (typeof window !== "undefined") {
//           const event = new CustomEvent("worktime_data_updated", {
//             detail: { workerId, siteId, yearMonth, timestamp },
//           });
//           window.dispatchEvent(event);
//         }
//       } catch (e) {
//         console.error("데이터 변경 알림 실패:", e);
//       }

//       // 캐시 무효화 후 로컬 데이터 다시 로드
//       await get().fetchWorkReports(workerId, siteId, yearMonth);

//       set({ isLoading: false });

//       let message = "근무 기록이 저장되었습니다.";
//       if (paidRecordsCount > 0) {
//         message += ` (단, 지급완료된 ${paidRecordsCount}건의 기록은 수정되지 않았습니다.)`;
//       }

//       return {
//         success: true,
//         message: message,
//       };
//     } catch (error) {
//       console.error("근무 기록 저장 오류:", error);
//       set({ isLoading: false });
//       return { success: false, message: `저장 중 오류가 발생했습니다: ${error.message}` };
//     }
//   },

//   // 선택된 년월 설정
//   setYearMonth: (yearMonth) => {
//     set({ yearMonth });
//   },

//   // 근무 기록의 특정 필드 값을 업데이트
//   updateWorkDetail: (index, field, value) => {
//     const { selectedWorker } = get();

//     // selectedSite는 siteStore에서 가져와야 함
//     // 임시로 외부에서 siteId를 받도록 수정 필요

//     if (!selectedWorker) return;

//     // 이 부분은 컴포넌트에서 siteStore.selectedSite를 전달받아야 함
//     // 현재는 기본 구현만 유지
//     const { workReports, yearMonth } = get();

//     // 실제 구현시에는 siteId를 매개변수로 받아야 함
//     // updateWorkDetail: (index, field, value, siteId) => { ... }

//     // 캐시 키는 컴포넌트에서 올바른 siteId를 전달해야 생성 가능
//     // const cacheKey = `${selectedWorker}-${siteId}-${yearMonth}`;

//     // 임시로 첫 번째 매칭되는 캐시 키 찾기 (개선 필요)
//     const matchingCacheKey = Object.keys(workReports).find(
//       (key) => key.startsWith(`${selectedWorker}-`) && key.endsWith(`-${yearMonth}`)
//     );

//     if (!matchingCacheKey || !workReports[matchingCacheKey]) return;

//     // 근무 기록 복사본 생성
//     const updatedWorkDetails = [...workReports[matchingCacheKey].workDetails];

//     // 필드에 따라 적절한 처리
//     if (field === "hours") {
//       const numericValue = value.replace(/[^0-9.]/g, "");
//       updatedWorkDetails[index] = {
//         ...updatedWorkDetails[index],
//         hours: numericValue,
//       };
//     } else if (field === "wage") {
//       const numericValue = value.replace(/[^0-9]/g, "");
//       updatedWorkDetails[index] = {
//         ...updatedWorkDetails[index],
//         wage: formatNumber(numericValue),
//       };
//     } else {
//       updatedWorkDetails[index] = {
//         ...updatedWorkDetails[index],
//         [field]: value,
//       };
//     }

//     // 상태 업데이트
//     set((state) => ({
//       workReports: {
//         ...state.workReports,
//         [matchingCacheKey]: {
//           ...state.workReports[matchingCacheKey],
//           workDetails: updatedWorkDetails,
//         },
//       },
//     }));
//   },

//   // 근무 기록을 기반으로 4대보험 상태 재계산
//   recalculateInsuranceStatus: async (workerId, siteId, yearMonth) => {
//     if (!workerId || !siteId || !yearMonth) return;

//     const workReportsCacheKey = `${workerId}-${siteId}-${yearMonth}`;
//     const insuranceCacheKey = `${workerId}-${siteId}`;

//     try {
//       const { workReports } = get();
//       if (!workReports[workReportsCacheKey] || !workReports[workReportsCacheKey].workDetails) {
//         return null;
//       }

//       const { workDetails } = workReports[workReportsCacheKey];

//       // 근무일수 계산
//       const workDays = workDetails.filter(
//         (detail) =>
//           detail &&
//           detail.hours &&
//           detail.wage &&
//           parseFloat(detail.hours) > 0 &&
//           parseNumber(detail.wage) > 0
//       ).length;

//       // 총 근무시간 계산
//       const totalHours = workDetails.reduce((sum, detail) => {
//         return sum + (detail && detail.hours ? parseFloat(detail.hours) || 0 : 0);
//       }, 0);

//       // 기본 보험 상태 설정
//       const newStatus = {
//         national_pension: "해당사항없음",
//         health_insurance: "해당사항없음",
//         employment_insurance: "가입상태",
//         industrial_accident: "가입상태",
//       };

//       // 현재 가입 정보 확인
//       try {
//         const { data, error } = await supabase
//           .from("insurance_enrollments")
//           .select(
//             `
//           enrollment_id,
//           worker_id,
//           site_id,
//           year_month,
//           national_pension_status,
//           health_insurance_status,
//           employment_insurance_status,
//           industrial_accident_status,
//           national_pension_acquisition_date,
//           health_insurance_acquisition_date,
//           employment_insurance_acquisition_date,
//           industrial_accident_acquisition_date,
//           national_pension_loss_date,
//           health_insurance_loss_date,
//           employment_insurance_loss_date,
//           industrial_accident_loss_date,
//           created_at,
//           updated_at
//         `
//           )
//           .eq("worker_id", workerId)
//           .eq("site_id", siteId);

//         if (error) {
//           console.warn("Error fetching insurance enrollments:", error.message);
//         } else if (data && data.length > 0) {
//           const latestEnrollment = data.sort((a, b) => {
//             const dateA = new Date(a.updated_at || a.created_at || 0);
//             const dateB = new Date(b.updated_at || b.created_at || 0);
//             return dateB - dateA;
//           })[0];

//           // 이미 가입된 상태인지 확인
//           if (
//             latestEnrollment.national_pension_acquisition_date &&
//             !latestEnrollment.national_pension_loss_date
//           ) {
//             newStatus.national_pension = "가입상태";
//           }

//           if (
//             latestEnrollment.health_insurance_acquisition_date &&
//             !latestEnrollment.health_insurance_loss_date
//           ) {
//             newStatus.health_insurance = "가입상태";
//           }

//           if (
//             latestEnrollment.employment_insurance_acquisition_date &&
//             !latestEnrollment.employment_insurance_loss_date
//           ) {
//             newStatus.employment_insurance = "가입상태";
//           }

//           if (
//             latestEnrollment.industrial_accident_acquisition_date &&
//             !latestEnrollment.industrial_accident_loss_date
//           ) {
//             newStatus.industrial_accident = "가입상태";
//           }
//         }
//       } catch (enrollmentError) {
//         console.warn("Exception in enrollment query:", enrollmentError.message);
//       }

//       // 근무 이력 기반으로 가입 필요 여부 판단
//       if (workDays >= 8 && newStatus.national_pension !== "가입상태") {
//         newStatus.national_pension = "가입대상";
//       }

//       if ((totalHours >= 60 || workDays >= 8) && newStatus.health_insurance !== "가입상태") {
//         newStatus.health_insurance = "가입대상";
//       }

//       // 캐시 업데이트
//       set((state) => ({
//         insuranceStatus: {
//           ...state.insuranceStatus,
//           [insuranceCacheKey]: newStatus,
//         },
//       }));

//       return newStatus;
//     } catch (error) {
//       console.error("4대보험 상태 재계산 오류:", {
//         message: error.message || "Unknown error",
//         stack: error.stack,
//         workerId,
//         siteId,
//         yearMonth,
//       });

//       return null;
//     }
//   },

//   // 특정 record_id의 캐시된 상태를 강제로 업데이트하는 함수
//   updateCachedRecordStatus: (recordId, newStatus) => {
//     Object.keys(get().workReports).forEach((cacheKey) => {
//       const reportData = get().workReports[cacheKey];
//       if (reportData && reportData.workDetails) {
//         let updated = false;
//         const updatedDetails = reportData.workDetails.map((detail) => {
//           if (detail.record_id === recordId) {
//             updated = true;
//             return { ...detail, payment_status: newStatus };
//           }
//           return detail;
//         });

//         if (updated) {
//           set((state) => ({
//             workReports: {
//               ...state.workReports,
//               [cacheKey]: {
//                 ...reportData,
//                 workDetails: updatedDetails,
//               },
//             },
//           }));
//         }
//       }
//     });
//   },

//   // 상태 초기화
//   resetStore: () =>
//     set({
//       workers: [],
//       workerDetails: {},
//       workReports: {},
//       selectedWorker: null,
//       yearMonth: getCurrentYearMonth(),
//       prevMonthWork: {},
//       insuranceStatus: {},
//       isLoading: false,
//       isWorkerLoading: false,
//       isDetailLoading: false,
//       isReportLoading: false,
//     }),
// }));

// export default useWorkTimeStore;
