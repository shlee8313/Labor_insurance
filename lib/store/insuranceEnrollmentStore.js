// lib/store/insuranceEnrollmentStore.js
import { create } from "zustand";
import { supabase } from "@/lib/supabase";

/**
 * 4대보험 가입/상실 처리 전담 스토어
 * 역할: 보험 가입/상실 처리, 가입 이력 관리, 근로자 분류
 */
const useInsuranceEnrollmentStore = create((set, get) => ({
  // 상태
  enrollmentRecords: {},
  enrollmentHistory: {},
  isLoading: false,
  error: null,

  // 보험 가입 정보 로드
  loadInsuranceEnrollments: async (workerId, siteId) => {
    if (!workerId || !siteId) return [];

    try {
      set({ isLoading: true, error: null });

      const cacheKey = `${workerId}-${siteId}`;
      const { enrollmentRecords } = get();

      // 캐시 확인
      if (enrollmentRecords[cacheKey]) {
        set({ isLoading: false });
        return enrollmentRecords[cacheKey];
      }

      // 보험 가입 이력 조회
      const { data, error } = await supabase
        .from("insurance_enrollments")
        .select(
          `
          enrollment_id, worker_id, site_id, year_month, enrollment_status,
          national_pension_acquisition_date, health_insurance_acquisition_date,
          employment_insurance_acquisition_date, industrial_accident_acquisition_date,
          national_pension_loss_date, health_insurance_loss_date,
          employment_insurance_loss_date, industrial_accident_loss_date,
          national_pension_status, health_insurance_status,
          employment_insurance_status, industrial_accident_status,
          created_at, updated_at
        `
        )
        .eq("worker_id", workerId)
        .eq("site_id", siteId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // 데이터 변환 - 보험 유형별로 개별 레코드 생성
      const transformedData = get()._transformEnrollmentData(data || []);

      // 캐시에 저장
      set((state) => ({
        enrollmentRecords: { ...state.enrollmentRecords, [cacheKey]: transformedData },
        isLoading: false,
      }));

      return transformedData;
    } catch (error) {
      console.error("보험 가입 정보 로드 오류:", error);
      set({ isLoading: false, error: error.message });
      return [];
    }
  },

  // 데이터 변환 (내부 메서드)
  _transformEnrollmentData: (data) => {
    const transformedData = [];

    data.forEach((record) => {
      const insuranceTypes = [
        {
          type: "national_pension",
          acquisition: record.national_pension_acquisition_date,
          loss: record.national_pension_loss_date,
          status: record.national_pension_status,
        },
        {
          type: "health_insurance",
          acquisition: record.health_insurance_acquisition_date,
          loss: record.health_insurance_loss_date,
          status: record.health_insurance_status,
        },
        {
          type: "employment_insurance",
          acquisition: record.employment_insurance_acquisition_date,
          loss: record.employment_insurance_loss_date,
          status: record.employment_insurance_status,
        },
        {
          type: "industrial_accident",
          acquisition: record.industrial_accident_acquisition_date,
          loss: record.industrial_accident_loss_date,
          status: record.industrial_accident_status,
        },
      ];

      insuranceTypes.forEach(({ type, acquisition, loss, status }) => {
        if (acquisition || status) {
          transformedData.push({
            enrollment_id: `${record.enrollment_id}_${type.substring(0, 2)}`,
            worker_id: record.worker_id,
            site_id: record.site_id,
            year_month: record.year_month,
            insurance_type: type,
            acquisition_date: acquisition,
            loss_date: loss,
            status: status,
            enrollment_status: record.enrollment_status,
            created_at: record.created_at,
            updated_at: record.updated_at,
          });
        }
      });
    });

    return transformedData;
  },

  // 보험 가입 처리
  handleInsuranceAcquisition: async (
    workerId,
    siteId,
    yearMonth,
    insuranceTypes,
    monthlyWage = 0
  ) => {
    if (!workerId || !siteId || !yearMonth || !insuranceTypes || insuranceTypes.length === 0) {
      return { success: false, message: "필수 정보가 누락되었습니다." };
    }

    try {
      set({ isLoading: true, error: null });

      const today = new Date();
      const acquisitionDate = today.toISOString().split("T")[0];

      // 1. 근로자와 근무 이력 가져오기
      const { workerData, workHistory } = await get()._fetchWorkerAndHistory(
        workerId,
        siteId,
        yearMonth
      );

      // 2. 보험 상태 계산 (insuranceStatusStore 사용)
      const { determineInsuranceStatus } = await import("@/lib/utils/insuranceCalculations");
      const insuranceStatus = determineInsuranceStatus(workerData, workHistory);

      // 3. 가입 데이터 준비
      const updateData = await get()._prepareEnrollmentData(
        workerId,
        siteId,
        yearMonth,
        insuranceTypes,
        acquisitionDate,
        insuranceStatus,
        workHistory
      );

      // 4. 데이터베이스 저장
      const { error: upsertError } = await supabase
        .from("insurance_enrollments")
        .upsert(updateData, {
          onConflict: "worker_id,site_id,year_month",
          returning: "minimal",
        });

      if (upsertError) throw upsertError;

      // 5. 캐시 무효화 및 재로드
      await get()._invalidateAndReload(workerId, siteId);

      set({ isLoading: false });
      return { success: true, message: "보험 가입 처리가 완료되었습니다." };
    } catch (error) {
      console.error("보험 가입 처리 오류:", error);
      set({ isLoading: false, error: error.message });
      return {
        success: false,
        message: `보험 가입 처리 중 오류가 발생했습니다: ${error.message}`,
      };
    }
  },

  // 근로자와 근무 이력 조회 (내부 메서드)
  _fetchWorkerAndHistory: async (workerId, siteId, yearMonth) => {
    // 근로자 정보 가져오기
    const { data: workerData, error: workerError } = await supabase
      .from("workers")
      .select("*")
      .eq("worker_id", workerId)
      .single();

    if (workerError) throw workerError;

    // 현재 달과 이전 달 계산
    const year = parseInt(yearMonth.split("-")[0]);
    const month = parseInt(yearMonth.split("-")[1]);
    let prevYear = year;
    let prevMonth = month - 1;

    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear--;
    }

    const prevYearMonth = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

    // 현재 달 근무 기록 조회
    const { data: currentMonthRecords, error: currentMonthError } = await supabase
      .from("work_records")
      .select("work_date, work_hours, daily_wage, status")
      .eq("worker_id", workerId)
      .eq("site_id", siteId)
      .eq("registration_month", yearMonth)
      .neq("status", "registration");

    if (currentMonthError) throw currentMonthError;

    // 이전 달 근무 기록 조회
    const { data: prevMonthRecords, error: prevMonthError } = await supabase
      .from("work_records")
      .select("work_date, work_hours, daily_wage, status")
      .eq("worker_id", workerId)
      .eq("site_id", siteId)
      .eq("registration_month", prevYearMonth)
      .neq("status", "registration");

    // 이전달 오류는 무시하고 계속 진행
    if (prevMonthError) {
      console.warn("이전 달 근무 기록 조회 오류:", prevMonthError);
    }

    // 첫 근무일 찾기
    let firstWorkDate = null;
    if (currentMonthRecords && currentMonthRecords.length > 0) {
      const sortedRecords = [...currentMonthRecords].sort(
        (a, b) => new Date(a.work_date).getTime() - new Date(b.work_date).getTime()
      );
      firstWorkDate = sortedRecords[0].work_date;
    }

    // 근무 이력 구성
    const workHistory = {
      currentMonthWorkDays: currentMonthRecords?.length || 0,
      currentMonthWorkHours:
        currentMonthRecords?.reduce((sum, r) => sum + parseFloat(r.work_hours || 0), 0) || 0,
      monthlyWage:
        currentMonthRecords?.reduce((sum, r) => sum + parseFloat(r.daily_wage || 0), 0) || 0,
      previousMonthWorkDays: prevMonthRecords?.length || 0,
      previousMonthWorkHours:
        prevMonthRecords?.reduce((sum, r) => sum + parseFloat(r.work_hours || 0), 0) || 0,
      firstWorkDate: firstWorkDate,
      isRegisteredInCurrentMonth: true,
    };

    return { workerData, workHistory };
  },

  // 가입 데이터 준비 (내부 메서드)
  _prepareEnrollmentData: async (
    workerId,
    siteId,
    yearMonth,
    insuranceTypes,
    acquisitionDate,
    insuranceStatus,
    workHistory
  ) => {
    // 기존 레코드 확인
    const { data: existingRecord, error: checkError } = await supabase
      .from("insurance_enrollments")
      .select("*")
      .eq("worker_id", workerId)
      .eq("site_id", siteId)
      .eq("year_month", yearMonth)
      .maybeSingle();

    if (checkError && checkError.code !== "PGRST116") {
      throw checkError;
    }

    // 현재 사용자 ID 가져오기
    const authStore = await import("@/lib/store/authStore");
    const user = authStore.useAuthStore.getState().user;
    const userId = user?.id;

    // 기본 데이터 구성
    const updateData = {
      worker_id: workerId,
      site_id: siteId,
      year_month: yearMonth,
      updated_at: new Date().toISOString(),
      first_work_date: workHistory.firstWorkDate,
      previous_month_work_days: parseInt(workHistory.previousMonthWorkDays, 10),
      previous_month_work_hours: parseFloat(workHistory.previousMonthWorkHours),
      current_month_work_days: parseInt(workHistory.currentMonthWorkDays, 10),
      current_month_work_hours: parseFloat(workHistory.currentMonthWorkHours),
      enrollment_status: "confirmed",
      user_confirmed: true,
      user_confirmed_at: new Date().toISOString(),
      confirmed_by: userId || null,
    };

    // 각 보험 유형별 데이터 설정
    const insuranceMapping = {
      national_pension: {
        acquisition: "national_pension_acquisition_date",
        status: "national_pension_status",
        statusKey: "nationalPension",
      },
      health_insurance: {
        acquisition: "health_insurance_acquisition_date",
        status: "health_insurance_status",
        statusKey: "healthInsurance",
      },
      employment_insurance: {
        acquisition: "employment_insurance_acquisition_date",
        status: "employment_insurance_status",
        statusKey: "employmentInsurance",
      },
      industrial_accident: {
        acquisition: "industrial_accident_acquisition_date",
        status: "industrial_accident_status",
        statusKey: "industrialAccident",
      },
    };

    insuranceTypes.forEach((type) => {
      const mapping = insuranceMapping[type];
      if (mapping) {
        const statusInfo = insuranceStatus[mapping.statusKey];
        updateData[mapping.acquisition] = statusInfo?.required ? acquisitionDate : null;
        updateData[mapping.status] = statusInfo?.required ? "auto_required" : "auto_exempted";
      }
    });

    // 새 레코드인 경우 생성일 추가
    if (!existingRecord) {
      updateData.created_at = new Date().toISOString();
    }

    return updateData;
  },

  // 캐시 무효화 및 재로드 (내부 메서드)
  _invalidateAndReload: async (workerId, siteId) => {
    const cacheKey = `${workerId}-${siteId}`;
    set((state) => ({
      enrollmentRecords: { ...state.enrollmentRecords, [cacheKey]: undefined },
    }));

    await get().loadInsuranceEnrollments(workerId, siteId);
  },

  // 보험 상실 처리
  handleInsuranceLoss: async (workerId, siteId, yearMonth = null, insuranceTypes = null) => {
    try {
      set({ isLoading: true, error: null });

      const today = new Date();
      const lossDate = today.toISOString().split("T")[0];

      // yearMonth가 제공된 경우 특정 년월의 레코드만 처리
      let updateData = {};

      if (insuranceTypes && insuranceTypes.length > 0) {
        // 특정 보험만 상실 처리
        insuranceTypes.forEach((type) => {
          const lossField = `${type}_loss_date`;
          updateData[lossField] = lossDate;
        });
      } else {
        // 모든 보험 상실 처리
        updateData = {
          national_pension_loss_date: lossDate,
          health_insurance_loss_date: lossDate,
          employment_insurance_loss_date: lossDate,
          industrial_accident_loss_date: lossDate,
          updated_at: new Date().toISOString(),
        };
      }

      let query = supabase
        .from("insurance_enrollments")
        .update(updateData)
        .eq("worker_id", workerId)
        .eq("site_id", siteId);

      // 특정 년월이 지정된 경우
      if (yearMonth) {
        query = query.eq("year_month", yearMonth);
      }

      const { error } = await query;
      if (error) throw error;

      // 캐시 무효화 및 재로드
      await get()._invalidateAndReload(workerId, siteId);

      set({ isLoading: false });
      return { success: true, message: "보험 상실 처리가 완료되었습니다." };
    } catch (error) {
      console.error("보험 상실 처리 오류:", error);
      set({ isLoading: false, error: error.message });
      return {
        success: false,
        message: `보험 상실 처리 중 오류가 발생했습니다: ${error.message}`,
      };
    }
  },

  // 보험별 가입 상태 확인
  isEnrolled: (workerId, siteId, insuranceType) => {
    try {
      const cacheKey = `${workerId}-${siteId}`;
      const { enrollmentRecords } = get();
      const enrollments = enrollmentRecords[cacheKey];

      if (!enrollments || enrollments.length === 0) return false;

      // 해당 보험 유형의 활성 가입 정보 확인
      return enrollments.some((enrollment) => {
        if (enrollment.insurance_type === insuranceType) {
          // 가입일이 있고 상실일이 없는 경우
          if (enrollment.acquisition_date && !enrollment.loss_date) {
            return true;
          }
          // 상태가 required인 경우
          if (enrollment.status === "auto_required" || enrollment.status === "manual_required") {
            return true;
          }
        }
        return false;
      });
    } catch (error) {
      console.error(`isEnrolled 함수 오류: ${error.message}`, error);
      return false;
    }
  },

  // 근로자 분류 (신규 가입, 기존 가입, 상실 대상)
  classifyWorkersForInsurance: (workers, workersHistory, enrollmentData) => {
    if (!workers) {
      return {
        newEnrollmentWorkers: [],
        activeEnrollmentWorkers: [],
        lossEnrollmentCandidates: [],
      };
    }

    const newEnrollmentWorkers = [];
    const activeEnrollmentWorkers = [];
    const lossEnrollmentCandidates = [];
    const processedWorkerIds = new Set();

    workers.forEach((worker) => {
      const workerId = worker.worker_id;

      // 중복 방지
      if (processedWorkerIds.has(workerId)) return;
      processedWorkerIds.add(workerId);

      // 이미 source가 지정된 경우 그대로 사용
      if (worker.source) {
        if (worker.source === "new_enrollment") {
          newEnrollmentWorkers.push(worker);
        } else if (worker.source === "active_enrolled") {
          activeEnrollmentWorkers.push(worker);
        } else if (worker.source === "inactive_enrolled") {
          lossEnrollmentCandidates.push(worker);
        }
        return;
      }

      // 동적 분류 로직
      const classification = get()._classifyWorker(worker, workersHistory, enrollmentData);

      switch (classification) {
        case "new":
          newEnrollmentWorkers.push(worker);
          break;
        case "active":
          activeEnrollmentWorkers.push(worker);
          break;
        case "loss":
          lossEnrollmentCandidates.push(worker);
          break;
        default:
          newEnrollmentWorkers.push(worker); // 기본값
      }
    });

    return {
      newEnrollmentWorkers,
      activeEnrollmentWorkers,
      lossEnrollmentCandidates,
    };
  },

  // 개별 근로자 분류 (내부 메서드)
  _classifyWorker: (worker, workersHistory, enrollmentData) => {
    const workerId = worker.worker_id;
    const siteId = worker.site_id;

    // 현재 년월 계산
    const currentDate = new Date();
    const yearMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(
      2,
      "0"
    )}`;

    // 근무 이력 조회
    const historyKeys = [`${workerId}-${siteId}-${yearMonth}`, `${workerId}-${yearMonth}`];

    let history = null;
    for (const key of historyKeys) {
      if (workersHistory && workersHistory[key]) {
        history = workersHistory[key];
        break;
      }
    }

    // 가입 정보 조회
    const enrollmentKeys = [`${workerId}-${siteId}`, `${workerId}`];

    let enrollments = [];
    for (const key of enrollmentKeys) {
      if (enrollmentData && enrollmentData[key]) {
        enrollments = enrollmentData[key];
        break;
      }
    }

    // 이력 데이터가 없는 경우
    if (!history) {
      return enrollments && enrollments.length > 0 ? "loss" : "new";
    }

    // 현재 월 근무 여부 확인
    const hasCurrentMonthWork =
      history.currentMonthWorkDays > 0 ||
      history.currentMonthWorkHours > 0 ||
      history.isRegisteredInCurrentMonth;

    // 활성 가입 여부 확인
    const hasActiveEnrollment = enrollments && enrollments.some((e) => !e.loss_date);

    // 분류 결정
    if (hasCurrentMonthWork && !hasActiveEnrollment) {
      return "new"; // 신규 가입 대상
    } else if (hasCurrentMonthWork && hasActiveEnrollment) {
      return "active"; // 유지 중인 근로자
    } else if (!hasCurrentMonthWork && hasActiveEnrollment) {
      return "loss"; // 상실 대상
    } else {
      return "new"; // 기본값
    }
  },

  // 4대보험 신고서 데이터 준비
  prepareReportData: async (workerId, siteId, yearMonth, insuranceTypes) => {
    if (!workerId || !siteId || !yearMonth || !insuranceTypes) {
      return { success: false, message: "필수 정보가 누락되었습니다." };
    }

    try {
      set({ isLoading: true, error: null });

      // 병렬로 데이터 조회
      const [workerResult, siteResult, enrollmentResult, workRecordsResult] = await Promise.all([
        // 근로자 정보
        supabase
          .from("workers")
          .select(
            "worker_id, name, resident_number, nationality_code, residence_status_code, address, contact_number, job_code"
          )
          .eq("worker_id", workerId)
          .single(),

        // 현장 정보
        supabase
          .from("location_sites")
          .select(
            "site_id, site_name, address, business_number, representative_name, contact_number"
          )
          .eq("site_id", siteId)
          .single(),

        // 보험 가입 정보
        supabase
          .from("insurance_enrollments")
          .select("insurance_type, acquisition_date, loss_date, monthly_wage")
          .eq("worker_id", workerId)
          .eq("site_id", siteId)
          .in("insurance_type", insuranceTypes)
          .is("loss_date", null),

        // 근무 기록
        supabase
          .from("work_records")
          .select("work_date, work_hours, daily_wage")
          .eq("worker_id", workerId)
          .eq("site_id", siteId)
          .eq("registration_month", yearMonth)
          .neq("status", "registration"),
      ]);

      // 에러 체크
      if (workerResult.error) throw workerResult.error;
      if (siteResult.error) throw siteResult.error;
      if (enrollmentResult.error) throw enrollmentResult.error;
      if (workRecordsResult.error) throw workRecordsResult.error;

      // 근무 관련 통계 계산
      const workRecords = workRecordsResult.data || [];
      const workDays = workRecords.length;
      const workHours = workRecords.reduce((sum, r) => sum + parseFloat(r.work_hours || 0), 0);
      const totalWage = workRecords.reduce((sum, r) => sum + parseFloat(r.daily_wage || 0), 0);

      // 보험별 정보 정리
      const insuranceData = {};
      insuranceTypes.forEach((type) => {
        const enrollment = enrollmentResult.data?.find((e) => e.insurance_type === type);
        insuranceData[type] = enrollment || null;
      });

      const reportData = {
        worker: workerResult.data,
        site: siteResult.data,
        enrollments: enrollmentResult.data || [],
        workRecords: workRecords,
        yearMonth,
        insuranceData,
        statistics: {
          workDays,
          workHours,
          totalWage,
          avgDailyWorkHours: workDays > 0 ? workHours / workDays : 0,
        },
      };

      set({ isLoading: false });
      return { success: true, data: reportData };
    } catch (error) {
      console.error("보고서 데이터 준비 오류:", error);
      set({ isLoading: false, error: error.message });
      return { success: false, message: `보고서 데이터 준비 중 오류 발생: ${error.message}` };
    }
  },

  // 스토어 초기화
  resetStore: () =>
    set({
      enrollmentRecords: {},
      enrollmentHistory: {},
      isLoading: false,
      error: null,
    }),

  // 오류 지우기
  clearError: () => set({ error: null }),
}));

export default useInsuranceEnrollmentStore;

/**
 *
 *
 *
 *
 *
 *
 *
 */

// // lib/store/insuranceEnrollmentStore.js
// import { create } from "zustand";
// import { supabase } from "@/lib/supabase";

// /**
//  * 4대보험 가입/상실 처리를 위한 스토어
//  */
// const useInsuranceEnrollmentStore = create((set, get) => ({
//   // 상태
//   enrollmentRecords: {},
//   enrollmentHistory: {},
//   isLoading: false,
//   error: null,

//   // 보험 가입 정보 로드
//   // loadInsuranceEnrollments 함수 수정
//   loadInsuranceEnrollments: async (workerId, siteId) => {
//     if (!workerId || !siteId) return [];

//     try {
//       set({ isLoading: true, error: null });

//       // 캐시 키 생성
//       const cacheKey = `${workerId}-${siteId}`;

//       // 이미 캐시에 있는 경우 반환
//       const { enrollmentRecords } = get();
//       if (enrollmentRecords[cacheKey]) {
//         set({ isLoading: false });
//         return enrollmentRecords[cacheKey];
//       }

//       // 모든 보험 가입 이력 조회
//       // insurance_type 컬럼이 없으므로 해당 조건을 제거하고
//       // 개별 보험 정보를 사용하는 쿼리로 수정
//       const { data, error } = await supabase
//         .from("insurance_enrollments")
//         .select(
//           `
//         enrollment_id,
//         worker_id,
//         site_id,
//         year_month,
//         enrollment_status,
//         national_pension_acquisition_date,
//         health_insurance_acquisition_date,
//         employment_insurance_acquisition_date,
//         industrial_accident_acquisition_date,
//         national_pension_loss_date,
//         health_insurance_loss_date,
//         employment_insurance_loss_date,
//         industrial_accident_loss_date,
//         national_pension_status,
//         health_insurance_status,
//         employment_insurance_status,
//         industrial_accident_status,
//         created_at,
//         updated_at
//       `
//         )
//         .eq("worker_id", workerId)
//         .eq("site_id", siteId)
//         .order("created_at", { ascending: false });

//       if (error) throw error;

//       // 데이터 변환 - 기존 코드가 보험 유형별로 레코드를 기대하므로
//       // 각 보험 유형별로 개별 레코드를 생성하여 반환
//       const transformedData = [];

//       if (data && data.length > 0) {
//         // 각 레코드를 보험 유형별로 분리
//         data.forEach((record) => {
//           // 국민연금 정보가 있으면 추가
//           if (record.national_pension_acquisition_date || record.national_pension_status) {
//             transformedData.push({
//               enrollment_id: `${record.enrollment_id}_np`,
//               worker_id: record.worker_id,
//               site_id: record.site_id,
//               year_month: record.year_month,
//               insurance_type: "national_pension", // 변환된 필드
//               acquisition_date: record.national_pension_acquisition_date,
//               loss_date: record.national_pension_loss_date,
//               status: record.national_pension_status,
//               enrollment_status: record.enrollment_status,
//               created_at: record.created_at,
//               updated_at: record.updated_at,
//             });
//           }

//           // 건강보험 정보가 있으면 추가
//           if (record.health_insurance_acquisition_date || record.health_insurance_status) {
//             transformedData.push({
//               enrollment_id: `${record.enrollment_id}_hi`,
//               worker_id: record.worker_id,
//               site_id: record.site_id,
//               year_month: record.year_month,
//               insurance_type: "health_insurance", // 변환된 필드
//               acquisition_date: record.health_insurance_acquisition_date,
//               loss_date: record.health_insurance_loss_date,
//               status: record.health_insurance_status,
//               enrollment_status: record.enrollment_status,
//               created_at: record.created_at,
//               updated_at: record.updated_at,
//             });
//           }

//           // 고용보험 정보가 있으면 추가
//           if (record.employment_insurance_acquisition_date || record.employment_insurance_status) {
//             transformedData.push({
//               enrollment_id: `${record.enrollment_id}_ei`,
//               worker_id: record.worker_id,
//               site_id: record.site_id,
//               year_month: record.year_month,
//               insurance_type: "employment_insurance", // 변환된 필드
//               acquisition_date: record.employment_insurance_acquisition_date,
//               loss_date: record.employment_insurance_loss_date,
//               status: record.employment_insurance_status,
//               enrollment_status: record.enrollment_status,
//               created_at: record.created_at,
//               updated_at: record.updated_at,
//             });
//           }

//           // 산재보험 정보가 있으면 추가
//           if (record.industrial_accident_acquisition_date || record.industrial_accident_status) {
//             transformedData.push({
//               enrollment_id: `${record.enrollment_id}_ia`,
//               worker_id: record.worker_id,
//               site_id: record.site_id,
//               year_month: record.year_month,
//               insurance_type: "industrial_accident", // 변환된 필드
//               acquisition_date: record.industrial_accident_acquisition_date,
//               loss_date: record.industrial_accident_loss_date,
//               status: record.industrial_accident_status,
//               enrollment_status: record.enrollment_status,
//               created_at: record.created_at,
//               updated_at: record.updated_at,
//             });
//           }
//         });
//       }

//       // 캐시에 저장
//       set((state) => ({
//         enrollmentRecords: { ...state.enrollmentRecords, [cacheKey]: transformedData },
//         isLoading: false,
//       }));

//       return transformedData;
//     } catch (error) {
//       console.error("보험 가입 정보 로드 오류:", error);
//       set({ isLoading: false, error: error.message });
//       return [];
//     }
//   },

//   // 보험 가입 처리
//   handleInsuranceAcquisition: async (
//     workerId,
//     siteId,
//     yearMonth,
//     insuranceTypes,
//     monthlyWage = 0
//   ) => {
//     if (!workerId || !siteId || !yearMonth || !insuranceTypes || insuranceTypes.length === 0) {
//       return { success: false, message: "필수 정보가 누락되었습니다." };
//     }

//     try {
//       set({ isLoading: true, error: null });

//       // 가입일 설정 (당일)
//       const today = new Date();
//       const acquisitionDate = today.toISOString().split("T")[0]; // YYYY-MM-DD 형식

//       // 1. 근로자 정보 가져오기
//       const { data: worker, error: workerError } = await supabase
//         .from("workers")
//         .select("*")
//         .eq("worker_id", workerId)
//         .single();

//       if (workerError) throw workerError;

//       // 2. 근무 이력 직접 데이터베이스에서 가져오기
//       console.log(
//         `근무 기록 직접 조회 시작 - 근로자: ${workerId}, 현장: ${siteId}, 연월: ${yearMonth}`
//       );

//       // 현재 달 근무 기록 조회
//       const { data: currentMonthRecords, error: currentMonthError } = await supabase
//         .from("work_records")
//         .select("work_date, work_hours, daily_wage, status")
//         .eq("worker_id", workerId)
//         .eq("site_id", siteId)
//         .eq("registration_month", yearMonth)
//         .neq("status", "registration");

//       if (currentMonthError) {
//         console.error("현재 달 근무 기록 조회 오류:", currentMonthError);
//         throw currentMonthError;
//       }

//       console.log("조회된 현재 달 근무 기록:", currentMonthRecords);

//       // 첫 근무일 찾기
//       let firstWorkDate = null;
//       if (currentMonthRecords && currentMonthRecords.length > 0) {
//         const sortedRecords = [...currentMonthRecords].sort(
//           (a, b) => new Date(a.work_date).getTime() - new Date(b.work_date).getTime()
//         );
//         firstWorkDate = sortedRecords[0].work_date;
//       }

//       // 이전 달 계산
//       const year = parseInt(yearMonth.split("-")[0]);
//       const month = parseInt(yearMonth.split("-")[1]);
//       let prevYear = year;
//       let prevMonth = month - 1;

//       if (prevMonth === 0) {
//         prevMonth = 12;
//         prevYear--;
//       }

//       const prevYearMonth = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;

//       // 이전 달 근무 기록 조회
//       const { data: prevMonthRecords, error: prevMonthError } = await supabase
//         .from("work_records")
//         .select("work_date, work_hours, daily_wage, status")
//         .eq("worker_id", workerId)
//         .eq("site_id", siteId)
//         .eq("registration_month", prevYearMonth)
//         .neq("status", "registration");

//       if (prevMonthError) {
//         console.error("이전 달 근무 기록 조회 오류:", prevMonthError);
//         // 오류가 있어도 계속 진행
//       }

//       console.log("조회된 이전 달 근무 기록:", prevMonthRecords);

//       // 근무 이력 구성
//       const workHistory = {
//         currentMonthWorkDays: currentMonthRecords?.length || 0,
//         currentMonthWorkHours:
//           currentMonthRecords?.reduce((sum, r) => sum + parseFloat(r.work_hours || 0), 0) || 0,
//         monthlyWage:
//           currentMonthRecords?.reduce((sum, r) => sum + parseFloat(r.daily_wage || 0), 0) || 0,
//         previousMonthWorkDays: prevMonthRecords?.length || 0,
//         previousMonthWorkHours:
//           prevMonthRecords?.reduce((sum, r) => sum + parseFloat(r.work_hours || 0), 0) || 0,
//         firstWorkDate: firstWorkDate,
//         isRegisteredInCurrentMonth: true, // 이 함수를 호출한다는 것은 이미 등록되었다고 가정
//       };

//       console.log("계산된 근무 이력 데이터:", workHistory);

//       // 3. 보험 가입 필요 여부 계산
//       const { determineInsuranceStatus } = await import("@/lib/utils/insuranceCalculations");
//       const insuranceStatus = determineInsuranceStatus(worker, workHistory);

//       console.log("계산된 보험 상태:", insuranceStatus);

//       // 기존 레코드 확인
//       const { data: existingRecord, error: checkError } = await supabase
//         .from("insurance_enrollments")
//         .select("*")
//         .eq("worker_id", workerId)
//         .eq("site_id", siteId)
//         .eq("year_month", yearMonth)
//         .maybeSingle();

//       if (checkError && checkError.code !== "PGRST116") {
//         throw checkError;
//       }

//       // 현재 사용자 ID 가져오기 (필요한 경우 authStore 등에서 가져오도록 수정)
//       const authStore = await import("@/lib/store/authStore");
//       const user = authStore.useAuthStore.getState().user;
//       const userId = user?.id;

//       // 데이터 준비
//       const updateData = {
//         worker_id: workerId,
//         site_id: siteId,
//         year_month: yearMonth,
//         updated_at: new Date().toISOString(),

//         // 근무 이력 데이터 저장 - 명시적으로 숫자형 변환
//         first_work_date: workHistory.firstWorkDate,
//         previous_month_work_days: parseInt(workHistory.previousMonthWorkDays, 10),
//         previous_month_work_hours: parseFloat(workHistory.previousMonthWorkHours),
//         current_month_work_days: parseInt(workHistory.currentMonthWorkDays, 10),
//         current_month_work_hours: parseFloat(workHistory.currentMonthWorkHours),

//         // 가입 상태를 confirmed로 설정하여 "유지 중인 근로자" 탭으로 이동하게 함
//         enrollment_status: "confirmed",
//         user_confirmed: true,
//         user_confirmed_at: new Date().toISOString(),
//         confirmed_by: userId || null,
//       };

//       // 각 보험 유형별 데이터 설정 - 계산된 상태 기반
//       if (insuranceTypes.includes("national_pension")) {
//         // 국민연금 - 계산된 상태 기반으로 설정
//         updateData.national_pension_acquisition_date = insuranceStatus.nationalPension.required
//           ? acquisitionDate
//           : null;
//         updateData.national_pension_status = insuranceStatus.nationalPension.required
//           ? "auto_required"
//           : "auto_exempted";
//       }

//       if (insuranceTypes.includes("health_insurance")) {
//         // 건강보험 - 계산된 상태 기반으로 설정
//         updateData.health_insurance_acquisition_date = insuranceStatus.healthInsurance.required
//           ? acquisitionDate
//           : null;
//         updateData.health_insurance_status = insuranceStatus.healthInsurance.required
//           ? "auto_required"
//           : "auto_exempted";
//       }

//       if (insuranceTypes.includes("employment_insurance")) {
//         // 고용보험 - 항상 필요하므로 그대로 유지
//         updateData.employment_insurance_acquisition_date = acquisitionDate;
//         updateData.employment_insurance_status = "auto_required";
//       }

//       if (insuranceTypes.includes("industrial_accident")) {
//         // 산재보험 - 항상 필요하므로 그대로 유지
//         updateData.industrial_accident_acquisition_date = acquisitionDate;
//         updateData.industrial_accident_status = "auto_required";
//       }

//       // 새 레코드인 경우 추가 필드
//       if (!existingRecord) {
//         updateData.created_at = new Date().toISOString();
//       }

//       // 최종 저장 데이터 확인
//       console.log("저장할 최종 데이터:", updateData);

//       // Upsert 수행
//       const { error: upsertError } = await supabase
//         .from("insurance_enrollments")
//         .upsert(updateData, {
//           onConflict: "worker_id,site_id,year_month",
//           returning: "minimal",
//         });

//       if (upsertError) {
//         throw upsertError;
//       }

//       // 캐시 무효화
//       const cacheKey = `${workerId}-${siteId}`;
//       set((state) => ({
//         enrollmentRecords: { ...state.enrollmentRecords, [cacheKey]: undefined },
//       }));

//       // 데이터 다시 로드
//       await get().loadInsuranceEnrollments(workerId, siteId);

//       set({ isLoading: false });
//       return {
//         success: true,
//         message: "보험 가입 처리가 완료되었습니다.",
//       };
//     } catch (error) {
//       console.error("보험 가입 처리 오류:", error);
//       set({ isLoading: false, error: error.message });
//       return {
//         success: false,
//         message: `보험 가입 처리 중 오류가 발생했습니다: ${error.message}`,
//       };
//     }
//   },

//   // 보험 상실 처리
//   handleInsuranceLoss: async (workerId, siteId, insuranceTypes = null) => {
//     try {
//       set({ isLoading: true, error: null });

//       // 상실일 설정 (당일)
//       const today = new Date();
//       const lossDate = today.toISOString().split("T")[0]; // YYYY-MM-DD 형식

//       let query = supabase
//         .from("insurance_enrollments")
//         .update({
//           loss_date: lossDate,
//           loss_reason_code: "03", // 사용관계종료
//           updated_at: new Date().toISOString(),
//         })
//         .eq("worker_id", workerId)
//         .eq("site_id", siteId)
//         .is("loss_date", null);

//       // 특정 보험 유형만 상실 처리하는 경우
//       if (insuranceTypes && insuranceTypes.length > 0) {
//         query = query.in("insurance_type", insuranceTypes);
//       }

//       const { data, error } = await query;

//       if (error) throw error;

//       // 캐시 무효화
//       const cacheKey = `${workerId}-${siteId}`;
//       set((state) => ({
//         enrollmentRecords: { ...state.enrollmentRecords, [cacheKey]: undefined },
//       }));

//       // 데이터 다시 로드
//       await get().loadInsuranceEnrollments(workerId, siteId);

//       set({ isLoading: false });

//       return {
//         success: true,
//         message: "보험 상실 처리가 완료되었습니다.",
//       };
//     } catch (error) {
//       console.error("보험 상실 처리 오류:", error);
//       set({ isLoading: false, error: error.message });
//       return {
//         success: false,
//         message: `보험 상실 처리 중 오류가 발생했습니다: ${error.message}`,
//       };
//     }
//   },

//   // 보험별 가입 상태 확인
//   // 수정된 isEnrolled 함수
//   isEnrolled: (workerId, siteId, insuranceType) => {
//     try {
//       // 해당 근로자, 현장에 대한 보험 정보 조회
//       const cacheKey = `${workerId}-${siteId}`;
//       const { enrollmentRecords } = get();
//       const enrollments = enrollmentRecords[cacheKey];

//       if (!enrollments || enrollments.length === 0) return false;

//       // 각 보험 유형별 상태 필드명
//       const statusField = `${insuranceType}_status`;

//       // 모든 레코드를 검사하여 가입 상태 확인
//       for (const enrollment of enrollments) {
//         // 방법 1: 개별 보험 레코드 확인
//         if (enrollment.insurance_type === insuranceType) {
//           // 직접 가입일이 있고 상실일이 없는 경우
//           if (enrollment.acquisition_date && !enrollment.loss_date) {
//             return true;
//           }

//           // 상태 코드가 required인 경우만 가입으로 간주
//           if (enrollment.status === "auto_required" || enrollment.status === "manual_required") {
//             return true;
//           }
//         }

//         // 방법 2: 통합 레코드에서 필드명으로 확인
//         // status가 required인 경우
//         if (
//           enrollment[statusField] === "auto_required" ||
//           enrollment[statusField] === "manual_required"
//         ) {
//           return true;
//         }
//       }

//       // 가입 정보가 확인되지 않음
//       return false;
//     } catch (error) {
//       console.error(`isEnrolled 함수 오류: ${error.message}`, error);
//       return false; // 오류 발생 시 안전하게 false 반환
//     }
//   },

//   // 가입 대상 분류 - 신규 가입, 기존 가입, 상실 대상
//   // lib/store/insuranceEnrollmentStore.js
//   classifyWorkersForInsurance: (workers, workersHistory, enrollmentData) => {
//     if (!workers) {
//       return {
//         newEnrollmentWorkers: [],
//         activeEnrollmentWorkers: [],
//         lossEnrollmentCandidates: [],
//       };
//     }

//     // 로그 디버깅 추가
//     console.log("분류 함수 호출됨: ", {
//       workers: workers.length,
//       workersHistoryKeys: Object.keys(workersHistory || {}),
//       enrollmentDataKeys: Object.keys(enrollmentData || {}),
//     });

//     // 결과 객체 초기화
//     const newEnrollmentWorkers = [];
//     const activeEnrollmentWorkers = [];
//     const lossEnrollmentCandidates = [];

//     // 이미 처리된 근로자 ID 추적 (중복 방지)
//     const processedWorkerIds = new Set();

//     // 모든 근로자에 대해 루프
//     workers.forEach((worker) => {
//       const workerId = worker.worker_id;
//       const siteId = worker.site_id;

//       // 로그 추가
//       console.log(
//         `분류 중인 근로자: ${workerId}, 이름: ${worker.name}, 소스: ${worker.source || "없음"}`
//       );

//       // 이미 처리된 근로자는 건너뛰기 (중복 방지)
//       if (processedWorkerIds.has(workerId)) {
//         console.log(`- 이미，처리된 근로자 ID: ${workerId}`);
//         return;
//       }
//       processedWorkerIds.add(workerId);

//       // 현재 년월 가져오기
//       const currentDate = new Date();
//       const yearMonth = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(
//         2,
//         "0"
//       )}`;

//       // 근무 이력 가져오기 - 여러 캐시 키 패턴 시도
//       let history = null;
//       const historyKeys = [
//         `${workerId}-${siteId}-${yearMonth}`, // 가장 일반적인 형태
//         `${workerId}-${yearMonth}`, // 일부 캐시에서 사용할 수 있는 형태
//       ];

//       for (const key of historyKeys) {
//         if (workersHistory && workersHistory[key]) {
//           history = workersHistory[key];
//           console.log(`- 이력 데이터 찾음: ${key}`);
//           break;
//         }
//       }

//       // 등록 데이터 가져오기 - 여러 캐시 키 패턴 시도
//       let enrollments = [];
//       const enrollmentKeys = [
//         `${workerId}-${siteId}`, // 가장 일반적인 형태
//         `${workerId}`, // 일부 캐시에서 사용할 수 있는 형태
//       ];

//       for (const key of enrollmentKeys) {
//         if (enrollmentData && enrollmentData[key]) {
//           enrollments = enrollmentData[key];
//           console.log(`- 보험 가입 데이터 찾음: ${key}, 레코드 수: ${enrollments.length}`);
//           break;
//         }
//       }

//       // 직접 체크 - DB에 실제로 저장된 데이터가 있는지 확인 (비동기 검사는 곤란하므로 이전에 로드된 데이터만 활용)
//       // 이 부분이 중요: 근로자에게 이미 source가 할당되어 있으면 그대로 사용
//       if (worker.source) {
//         console.log(`- 소스 기반 분류: ${worker.source}`);

//         if (worker.source === "new_enrollment") {
//           newEnrollmentWorkers.push(worker);
//         } else if (worker.source === "active_enrolled") {
//           activeEnrollmentWorkers.push(worker);
//         } else if (worker.source === "inactive_enrolled") {
//           lossEnrollmentCandidates.push(worker);
//         }

//         return; // 이미 분류됨
//       }

//       // 이제 실제 판단 로직 - 근무 이력과 보험 가입 상태를 기반으로

//       // 1. 이력 데이터가 없으면 등록 데이터만으로 판단
//       if (!history) {
//         console.log(`- 이력 데이터 없음, 보험 데이터로만 판단`);

//         // 보험 가입 여부만으로 판단
//         if (enrollments && enrollments.length > 0) {
//           // 가입된 상태이지만 이력 없음 -> 상실 대상자로 분류
//           console.log(`- 보험 데이터 있음, 이력 없음 -> 상실 대상`);
//           lossEnrollmentCandidates.push(worker);
//         } else {
//           // 보험 미가입 상태 -> 신규 가입 대상자로 분류
//           console.log(`- 보험 데이터 없음 -> 신규 가입 대상`);
//           newEnrollmentWorkers.push(worker);
//         }

//         return;
//       }

//       // 2. 이력 데이터 있는 경우 현재 월 근무 여부 확인
//       const hasCurrentMonthWork =
//         history.currentMonthWorkDays > 0 ||
//         history.currentMonthWorkHours > 0 ||
//         history.isRegisteredInCurrentMonth;

//       // 보험 가입 여부 확인 (loss_date가 없는 레코드 있는지)
//       const hasActiveEnrollment = enrollments && enrollments.some((e) => !e.loss_date);

//       console.log(
//         `- 이력 확인: 현재 월 근무=${hasCurrentMonthWork}, 보험 가입=${hasActiveEnrollment}`
//       );

//       // 최종 분류 결정
//       if (hasCurrentMonthWork && !hasActiveEnrollment) {
//         // 현재 월에 근무하지만 보험 미가입 -> 신규 가입 대상자
//         console.log(`- 분류 결과: 신규 가입 대상자`);
//         newEnrollmentWorkers.push(worker);
//       } else if (hasCurrentMonthWork && hasActiveEnrollment) {
//         // 현재 월에 근무하고 보험 가입 -> 유지 중인 근로자
//         console.log(`- 분류 결과: 유지 중인 근로자`);
//         activeEnrollmentWorkers.push(worker);
//       } else if (!hasCurrentMonthWork && hasActiveEnrollment) {
//         // 현재 월에 근무하지 않지만 보험 가입 -> 상실 대상자
//         console.log(`- 분류 결과: 상실 대상자`);
//         lossEnrollmentCandidates.push(worker);
//       } else {
//         // 그 외의 경우 -> 신규 가입 대상자로 (안전 장치)
//         console.log(`- 분류 결과: 기본값 - 신규 가입 대상자`);
//         newEnrollmentWorkers.push(worker);
//       }
//     });

//     // 각 카테고리별 결과 로그
//     console.log("분류 결과 요약: ", {
//       newEnrollmentWorkers: newEnrollmentWorkers.length,
//       activeEnrollmentWorkers: activeEnrollmentWorkers.length,
//       lossEnrollmentCandidates: lossEnrollmentCandidates.length,
//     });

//     return {
//       newEnrollmentWorkers,
//       activeEnrollmentWorkers,
//       lossEnrollmentCandidates,
//     };
//   },

//   // 4대보험 신고서 생성을 위한 데이터 준비
//   prepareReportData: async (workerId, siteId, yearMonth, insuranceTypes) => {
//     if (!workerId || !siteId || !yearMonth || !insuranceTypes) {
//       return { success: false, message: "필수 정보가 누락되었습니다." };
//     }

//     try {
//       set({ isLoading: true, error: null });

//       // 근로자 정보 조회
//       const { data: worker, error: workerError } = await supabase
//         .from("workers")
//         .select(
//           `
//           worker_id, name, resident_number, nationality_code, residence_status_code,
//           address, contact_number, job_code
//         `
//         )
//         .eq("worker_id", workerId)
//         .single();

//       if (workerError) throw workerError;

//       // 현장 정보 조회
//       const { data: site, error: siteError } = await supabase
//         .from("location_sites")
//         .select(
//           `
//           site_id, site_name, address, business_number, representative_name,
//           contact_number
//         `
//         )
//         .eq("site_id", siteId)
//         .single();

//       if (siteError) throw siteError;

//       // 보험 가입 정보 조회
//       const { data: enrollments, error: enrollmentError } = await supabase
//         .from("insurance_enrollments")
//         .select(
//           `
//           insurance_type, acquisition_date, loss_date, monthly_wage
//         `
//         )
//         .eq("worker_id", workerId)
//         .eq("site_id", siteId)
//         .in("insurance_type", insuranceTypes)
//         .is("loss_date", null);

//       if (enrollmentError) throw enrollmentError;

//       // 근무 기록 조회
//       const { data: workRecords, error: workError } = await supabase
//         .from("work_records")
//         .select(
//           `
//           work_date, work_hours, daily_wage
//         `
//         )
//         .eq("worker_id", workerId)
//         .eq("site_id", siteId)
//         .eq("registration_month", yearMonth)
//         .neq("status", "registration");

//       if (workError) throw workError;

//       // 보고서 데이터 생성
//       const reportData = {
//         worker,
//         site,
//         enrollments: enrollments || [],
//         workRecords: workRecords || [],
//         yearMonth,
//         // 각 보험 유형별 가입 정보
//         insuranceData: {},
//       };

//       // 각 보험 유형별 정보 정리
//       insuranceTypes.forEach((type) => {
//         const enrollment = enrollments?.find((e) => e.insurance_type === type);
//         reportData.insuranceData[type] = enrollment || null;
//       });

//       // 근무 관련 통계 계산
//       const workDays = workRecords?.length || 0;
//       const workHours =
//         workRecords?.reduce((sum, r) => sum + parseFloat(r.work_hours || 0), 0) || 0;
//       const totalWage =
//         workRecords?.reduce((sum, r) => sum + parseFloat(r.daily_wage || 0), 0) || 0;

//       reportData.statistics = {
//         workDays,
//         workHours,
//         totalWage,
//         avgDailyWorkHours: workDays > 0 ? workHours / workDays : 0,
//       };

//       set({ isLoading: false });
//       return { success: true, data: reportData };
//     } catch (error) {
//       console.error("보고서 데이터 준비 오류:", error);
//       set({ isLoading: false, error: error.message });
//       return { success: false, message: `보고서 데이터 준비 중 오류 발생: ${error.message}` };
//     }
//   },
//   resetStore: () =>
//     set({
//       enrollmentRecords: {},
//       enrollmentHistory: {},
//       isLoading: false,
//       error: null,
//     }),
//   // 오류 지우기
//   clearError: () => set({ error: null }),
// }));

// export default useInsuranceEnrollmentStore;
