// lib/store/workHistoryStore.js
import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { getPreviousYearMonthFromSelected } from "@/lib/utils/dateUtils";
import { parseNumber } from "@/lib/utils/formattingUtils";

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

  // 근로자별 근무 이력 로드
  // 근로자별 근무 이력 로드 (수정된 버전)
  // lib/store/workHistoryStore.js 파일에서
  // In useWorkHistoryStore (workHistoryStore.js)
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

      // 일관된 형식으로 캐시 키 생성
      const cacheKey = `${workerId}-${siteId}-${yearMonth}`;

      // 현재 상태 가져오기
      const { workersHistory } = get();
      console.log(`캐시 키 ${cacheKey}에 대한 데이터 확인 중...`);

      // 캐시 된 데이터가 있으면 반환
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

      // 명시적인 기본값으로 결과 구성
      const historyData = {
        previousMonthWorkDays: prevMonthData?.workDays || 0,
        previousMonthWorkHours: prevMonthData?.workHours || 0,
        isPreviousMonthRegistered: prevMonthData?.isRegistered || false,
        firstWorkDate: prevMonthData?.firstWorkDate || firstWorkDate,
        currentMonthWorkDays: currentMonthData?.workDays || 0,
        currentMonthWorkHours: currentMonthData?.workHours || 0,
        monthlyWage: currentMonthData?.monthlyWage || 0,
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

      // 업데이트 된 상태 로그
      console.log(`업데이트된 workersHistory 상태:`, get().workersHistory);

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

  // 이전 월 근무 데이터 조회
  loadPreviousMonthRecords: async (workerId, siteId, yearMonth) => {
    // 이전 월 계산
    const dateInfo = getPreviousYearMonthFromSelected(
      yearMonth.split("-")[0],
      yearMonth.split("-")[1]
    );

    const prevYearMonth = dateInfo.prevYearMonth;
    const prevMonthStart = `${prevYearMonth}-01`;
    const currentMonthStart = `${dateInfo.currentYearMonth}-01`;

    // 캐시 키 생성
    const cacheKey = `${workerId}-${siteId}-${prevYearMonth}`;

    // 이미 캐시에 있는 경우 반환
    const { prevMonthWork } = get();
    if (prevMonthWork[cacheKey]) {
      return prevMonthWork[cacheKey];
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

      // 데이터 계산
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

      return result;
    } catch (error) {
      console.error("이전 월 근무 데이터 처리 오류:", error);
      return {
        workDays: 0,
        workHours: 0,
        firstWorkDate: null,
        monthlyWage: 0,
        isRegistered: false,
      };
    }
  },

  // 선택 월 근무 데이터 조회
  // 선택 월 근무 데이터 조회 (수정된 버전)
  // 선택 월 근무 데이터 조회 (디버깅 로그 추가)
  // 선택 월 근무 데이터 조회 (전체 재작성)
  // lib/store/workHistoryStore.js 파일에서
  // In useWorkHistoryStore (workHistoryStore.js)
  // 선택 월 근무 데이터 조회 함수 내부 (약 라인 240 근처)
  loadCurrentMonthRecords: async (workerId, siteId, yearMonth) => {
    try {
      // 날짜 계산
      const dateInfo = getPreviousYearMonthFromSelected(
        yearMonth.split("-")[0],
        yearMonth.split("-")[1]
      );

      const startDate = `${dateInfo.currentYearMonth}-01`;
      const endDate = `${dateInfo.nextYearMonth}-01`;

      console.log(`근무 기록 로드 시작 - 근로자: ${workerId}, 현장: ${siteId}, 연월: ${yearMonth}`);
      console.log(`날짜 범위: ${startDate} ~ ${endDate}`);

      // 날짜 기반 근무 기록 조회
      const { data: workDateRecords, error: workDateError } = await supabase
        .from("work_records")
        .select("worker_id, work_date, work_hours, daily_wage, status")
        .eq("site_id", siteId)
        .eq("worker_id", workerId)
        .gte("work_date", startDate)
        .lt("work_date", endDate);

      if (workDateError) throw workDateError;

      // 등록월 기반 근무 기록 조회 (날짜 기반 조회로 결과가 없을 경우)
      const { data: regMonthRecords, error: regMonthError } = await supabase
        .from("work_records")
        .select("worker_id, work_date, work_hours, daily_wage, status")
        .eq("site_id", siteId)
        .eq("worker_id", workerId)
        .eq("registration_month", yearMonth);

      if (regMonthError) throw regMonthError;

      // 중복 없이 모든 기록 합치기
      const allRecords = [...(workDateRecords || []), ...(regMonthRecords || [])];

      // 중복 제거를 위한 Set
      const uniqueRecords = new Set();
      const workRecords = [];

      allRecords.forEach((record) => {
        // 이미 처리된 record인지 확인 (work_date로 구분)
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

      // 계산
      const workDays = workRecords.length;
      const workHours = workRecords.reduce((sum, r) => sum + parseFloat(r.work_hours || 0), 0);
      const monthlyWage = workRecords.reduce((sum, r) => sum + parseFloat(r.daily_wage || 0), 0);
      const isRegistered = regData !== null;

      // 디버깅 로그 추가
      console.log("work_records 데이터:", {
        workDateRecords: workDateRecords || [],
        regMonthRecords: regMonthRecords || [],
        allRecords: allRecords || [],
        workRecords: workRecords || [],
        결과: {
          workDays,
          workHours,
          monthlyWage,
          isRegistered,
        },
      });

      return {
        workDays,
        workHours,
        monthlyWage,
        isRegistered,
      };
    } catch (error) {
      console.error(`근무 기록 로드 오류(ID: ${workerId}, 연월: ${yearMonth}):`, error);
      return {
        workDays: 0,
        workHours: 0,
        monthlyWage: 0,
        isRegistered: false,
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

  // 근무 기록 저장
  saveWorkRecords: async (workerId, siteId, yearMonth, workDetails) => {
    if (!workerId || !siteId || !yearMonth || !workDetails) {
      return { success: false, message: "근로자, 현장, 년월, 근무 데이터가 모두 필요합니다." };
    }

    try {
      set({ isLoading: true, error: null });

      // 유효한 근무 기록만 필터링
      const validWorkDetails = workDetails
        .map((detail, index) => ({
          ...detail,
          day: index + 1,
          date: `${yearMonth}-${String(index + 1).padStart(2, "0")}`,
        }))
        .filter((detail) => detail.hours && detail.wage);

      if (validWorkDetails.length === 0) {
        set({ isLoading: false });
        return { success: false, message: "최소 하나 이상의 근무 기록이 필요합니다." };
      }

      // 날짜 계산
      const dateInfo = getPreviousYearMonthFromSelected(
        yearMonth.split("-")[0],
        yearMonth.split("-")[1]
      );

      const startDate = `${dateInfo.currentYearMonth}-01`;
      const endDate = `${dateInfo.nextYearMonth}-01`;

      // 총 근무일수, 평균 근무시간, 총 임금 계산
      const totalWorkDays = validWorkDetails.length;
      const totalHours = validWorkDetails.reduce(
        (sum, detail) => sum + parseFloat(detail.hours || 0),
        0
      );
      const avgDailyWorkHours = totalWorkDays > 0 ? totalHours / totalWorkDays : 0;
      const totalWage = validWorkDetails.reduce(
        (sum, detail) => sum + parseNumber(detail.wage || 0),
        0
      );

      // 데이터베이스 트랜잭션 처리 - supabase.js에서는 직접적인 트랜잭션을 지원하지 않으므로
      // 순차적으로 처리하고 오류 발생 시 롤백 처리

      // 1. 기존 근무 기록 삭제 (registration 유형 제외)
      const { error: deleteError } = await supabase
        .from("work_records")
        .delete()
        .eq("site_id", siteId)
        .eq("worker_id", workerId)
        .gte("work_date", startDate)
        .lt("work_date", endDate)
        .not("work_type", "eq", "registration");

      if (deleteError) throw deleteError;

      // 2. 새 근무 기록 추가
      const workRecordsToInsert = validWorkDetails.map((detail) => {
        // 작업 유형 결정
        let workType = "regular";
        if (detail.night) workType = "night";
        if (detail.holiday) workType = "holiday";
        if (detail.extended) workType = "overtime";

        // 메타데이터 생성
        const workTypeMetadata = JSON.stringify({
          extended: detail.extended || false,
          holiday: detail.holiday || false,
          night: detail.night || false,
        });

        return {
          worker_id: workerId,
          site_id: siteId,
          work_date: detail.date,
          work_hours: parseFloat(detail.hours || 0),
          work_type: workType,
          work_type_metadata: workTypeMetadata,
          daily_wage: parseNumber(detail.wage || 0),
          status: "confirmed",
          registration_month: yearMonth,
        };
      });

      const { error: insertError } = await supabase
        .from("work_records")
        .insert(workRecordsToInsert);

      if (insertError) throw insertError;

      // 3. daily_work_reports 테이블 업데이트
      // 기존 report 확인
      // const { data: existingReport, error: checkError } = await supabase
      //   .from("daily_work_reports")
      //   .select("report_id")
      //   .eq("worker_id", workerId)
      //   .eq("site_id", siteId)
      //   .eq("report_month", yearMonth)
      //   .maybeSingle();

      // if (checkError && checkError.code !== "PGRST116") throw checkError;

      // let reportId;

      // if (existingReport) {
      //   // 기존 신고 데이터 업데이트
      //   reportId = existingReport.report_id;
      //   const { error: updateError } = await supabase
      //     .from("daily_work_reports")
      //     .update({
      //       total_work_days: totalWorkDays,
      //       avg_daily_work_hours: avgDailyWorkHours,
      //       total_wage: totalWage,
      //       total_compensation: totalWage,
      //       total_paid_days: totalWorkDays,
      //       updated_at: new Date().toISOString(),
      //     })
      //     .eq("report_id", reportId);

      //   if (updateError) throw updateError;

      //   // 기존 상세 데이터 삭제
      //   const { error: deleteDetailsError } = await supabase
      //     .from("daily_work_report_details")
      //     .delete()
      //     .eq("report_id", reportId);

      //   if (deleteDetailsError) throw deleteDetailsError;
      // } else {
      //   // 새 신고 데이터 생성
      //   const { data: newReport, error: insertReportError } = await supabase
      //     .from("daily_work_reports")
      //     .insert({
      //       worker_id: workerId,
      //       site_id: siteId,
      //       report_month: yearMonth,
      //       insurance_type: "5", // 기본값: 산재보험 및 고용보험 모두
      //       total_work_days: totalWorkDays,
      //       avg_daily_work_hours: avgDailyWorkHours,
      //       total_wage: totalWage,
      //       total_compensation: totalWage,
      //       total_paid_days: totalWorkDays,
      //       payment_month: yearMonth,
      //       report_status: "draft",
      //     })
      //     .select();

      //   if (insertReportError) throw insertReportError;
      //   reportId = newReport[0].report_id;
      // }

      // // 4. 상세 데이터 생성
      // const detailsToInsert = validWorkDetails.map((detail) => ({
      //   report_id: reportId,
      //   work_date: detail.date,
      //   work_hours: parseFloat(detail.hours || 0),
      //   daily_wage: parseNumber(detail.wage || 0),
      // }));

      // const { error: insertDetailsError } = await supabase
      //   .from("daily_work_report_details")
      //   .insert(detailsToInsert);

      // if (insertDetailsError) throw insertDetailsError;

      // 5. 캐시 무효화 (최신 데이터 반영을 위해)
      const cacheKey = `${workerId}-${siteId}-${yearMonth}`;
      set((state) => ({
        workersHistory: {
          ...state.workersHistory,
          [cacheKey]: undefined,
        },
      }));

      // 업데이트된 이력 다시 로드
      await get().loadWorkersHistory(workerId, siteId, yearMonth);

      set({ isLoading: false });
      return { success: true, message: "근무 기록이 성공적으로 저장되었습니다." };
    } catch (error) {
      console.error("근무 기록 저장 오류:", error);
      set({ isLoading: false, error: error.message });
      return { success: false, message: `근무 기록 저장 중 오류 발생: ${error.message}` };
    }
  },

  // 월간 보고서 집계
  getMonthlyReport: async (siteId, yearMonth) => {
    if (!siteId || !yearMonth) return null;

    try {
      set({ isLoading: true, error: null });

      // 날짜 계산
      const dateInfo = getPreviousYearMonthFromSelected(
        yearMonth.split("-")[0],
        yearMonth.split("-")[1]
      );

      const startDate = `${dateInfo.currentYearMonth}-01`;
      const endDate = `${dateInfo.nextYearMonth}-01`;

      // 해당 월에 해당 현장의 모든 근무 기록 조회
      const { data, error } = await supabase
        .from("work_records")
        .select(
          `
          worker_id, 
          work_date, 
          work_hours, 
          daily_wage, 
          status,
          workers(name, resident_number)
        `
        )
        .eq("site_id", siteId)
        .gte("work_date", startDate)
        .lt("work_date", endDate)
        .neq("status", "registration");

      if (error) throw error;

      // 근로자별로 집계
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
              totalWage: 0,
              records: [],
            };
          }

          reportByWorker[workerId].workDays++;
          reportByWorker[workerId].workHours += parseFloat(record.work_hours || 0);
          reportByWorker[workerId].totalWage += parseFloat(record.daily_wage || 0);
          reportByWorker[workerId].records.push(record);
        });
      }

      // 전체 집계
      const totalReport = {
        totalWorkers: Object.keys(reportByWorker).length,
        totalWorkDays: Object.values(reportByWorker).reduce((sum, w) => sum + w.workDays, 0),
        totalWorkHours: Object.values(reportByWorker).reduce((sum, w) => sum + w.workHours, 0),
        totalWage: Object.values(reportByWorker).reduce((sum, w) => sum + w.totalWage, 0),
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

    // Create the cache key
    const cacheKey = `${workerId}-${siteId}-${yearMonth}`;

    // Invalidate the cache
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
