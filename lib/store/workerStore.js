// lib/store/workerStore.js
import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { calculateAgeFromResidentNumber } from "@/lib/utils/insuranceCalculations";
import { getPreviousYearMonthFromSelected } from "@/lib/utils/dateUtils";

/**
 * 근로자 관리를 위한 스토어
 */
const useWorkerStore = create((set, get) => ({
  // 상태
  registeredWorkers: [],
  activeWorkers: [],
  inactiveWorkers: [],
  selectedWorkerId: null,
  workerDetails: {},
  showDetail: false,
  isLoading: false,
  isWorkerLoading: false,
  isDetailLoading: false,
  error: null,

  // 선택된 년/월 및 현장 - 필요시 siteStore나 다른 스토어에서 가져옴
  yearMonth: new Date().toISOString().substring(0, 7), // YYYY-MM 형식

  // 근로자 목록 로드 - 선택된 사이트와 년월 기준
  // lib/store/workerStore.js
  loadWorkers: async (siteId, yearMonth) => {
    if (!siteId || !yearMonth) {
      set({
        registeredWorkers: [],
        activeWorkers: [],
        inactiveWorkers: [],
        error: null,
      });
      return;
    }

    try {
      set({ isWorkerLoading: true, error: null });

      // 수정 전 코드
      /*
    // 등록된 근로자 로드
    await get().loadRegisteredWorkers(siteId, yearMonth);

    // 보험 가입 중인 근로자 로드
    await get().loadActiveInsuranceWorkers(siteId, yearMonth);
    */

      // 수정 후 코드
      // 1. 먼저 선택 월에 등록된 모든 근로자 목록 가져오기
      const { data: recordsData, error: recordsError } = await supabase
        .from("work_records")
        .select("worker_id, status, work_hours")
        .eq("site_id", siteId)
        .eq("registration_month", yearMonth);

      if (recordsError) throw recordsError;

      // 선택월 등록된 근로자 ID 목록
      const registeredWorkerIds = recordsData
        ? [...new Set(recordsData.map((record) => record.worker_id))]
        : [];

      // 2. 보험에 가입된 근로자 목록 가져오기
      const { data: activeEnrollments, error: enrollmentsError } = await supabase
        .from("insurance_enrollments")
        .select("worker_id, year_month, enrollment_status, user_confirmed")
        .eq("site_id", siteId)
        .in("enrollment_status", ["confirmed", "reported"])
        .is("national_pension_loss_date", null)
        .is("health_insurance_loss_date", null)
        .is("employment_insurance_loss_date", null)
        .is("industrial_accident_loss_date", null);

      if (enrollmentsError) throw enrollmentsError;

      // 3. 보험 가입된 근로자 ID 추출
      const enrolledWorkerIds =
        activeEnrollments && activeEnrollments.length > 0
          ? [...new Set(activeEnrollments.map((e) => e.worker_id))]
          : [];

      // 4. 각 카테고리별 근로자 ID 분류
      // 신규 가입 대상자: 현재 월에 등록되었지만 보험에 가입되지 않은 근로자
      const newWorkerIds = registeredWorkerIds.filter((id) => !enrolledWorkerIds.includes(id));

      // 유지 중인 근로자: 보험에 가입되어 있고 현재 월에도 등록된 근로자
      const activeWorkerIds = enrolledWorkerIds.filter((id) => registeredWorkerIds.includes(id));

      // 상실 대상자: 보험에 가입되어 있지만 현재 월에 등록되지 않은 근로자
      const inactiveWorkerIds = enrolledWorkerIds.filter((id) => !registeredWorkerIds.includes(id));

      // 5. 각 카테고리별 근로자 정보 가져오기
      const [newWorkers, activeWorkers, inactiveWorkers] = await Promise.all([
        fetchWorkerDetails(newWorkerIds, "new_enrollment"),
        fetchWorkerDetails(activeWorkerIds, "active_enrolled"),
        fetchWorkerDetails(inactiveWorkerIds, "inactive_enrolled"),
      ]);

      // 6. 상태 업데이트
      set({
        registeredWorkers: newWorkers,
        activeWorkers: activeWorkers,
        inactiveWorkers: inactiveWorkers,
        isWorkerLoading: false,
      });

      set({ isWorkerLoading: false });
    } catch (error) {
      console.error("근로자 목록 로드 오류:", error);
      set({ isWorkerLoading: false, error: error.message });
    }

    // 근로자 상세 정보 가져오기 함수
    async function fetchWorkerDetails(workerIds, source) {
      if (!workerIds || workerIds.length === 0) return [];

      const { data, error } = await supabase
        .from("workers")
        .select(
          `
        worker_id, name, resident_number, contact_number, address, job_code,
        nationality_code, worker_type
      `
        )
        .in("worker_id", workerIds)
        .eq("worker_type", "daily");

      if (error) throw error;

      // 직종 코드 처리
      const jobCodes = data.filter((w) => w.job_code).map((w) => w.job_code);
      let jobCodeMap = {};

      if (jobCodes.length > 0) {
        const { data: jobCodeData } = await supabase
          .from("code_masters")
          .select("code_value, code_name")
          .eq("code_type", "JOB_CODE")
          .in("code_value", jobCodes);

        jobCodeMap = jobCodeData
          ? jobCodeData.reduce((acc, item) => {
              acc[item.code_value] = item.code_name;
              return acc;
            }, {})
          : {};
      }

      // 근로자 데이터 가공
      return data.map((worker) => {
        const age = calculateAgeFromResidentNumber(worker.resident_number);

        return {
          ...worker,
          jobName: worker.job_code ? jobCodeMap[worker.job_code] || "미지정" : "미지정",
          age: age,
          source: source,
        };
      });
    }
  },

  // 근로자 검색
  searchWorkers: async (siteId, yearMonth, searchTerm) => {
    if (!siteId || !yearMonth || !searchTerm) return;

    try {
      set({ isLoading: true, error: null });

      // 이름으로 근로자 검색 쿼리
      const { data, error } = await supabase
        .from("workers")
        .select("*")
        .ilike("name", `%${searchTerm}%`)
        .eq("worker_type", "daily")
        .order("name");

      if (error) throw error;

      // 현재 현장에 등록된 근로자인지 확인
      if (data && data.length > 0) {
        const workerIds = data.map((worker) => worker.worker_id);

        // 해당 현장의 등록된 근로자 ID 가져오기
        const { data: records, error: recordsError } = await supabase
          .from("work_records")
          .select("worker_id, work_type")
          .eq("site_id", siteId)
          .eq("registration_month", yearMonth)
          .in("worker_id", workerIds);

        if (recordsError) throw recordsError;

        const registeredIds = new Set(records?.map((r) => r.worker_id) || []);

        // 등록 여부 표시하여 결과 반환
        const searchResults = data.map((worker) => ({
          ...worker,
          isRegistered: registeredIds.has(worker.worker_id),
          age: calculateAgeFromResidentNumber(worker.resident_number),
        }));

        // 결과 업데이트 (원래 목록은 유지)
        set({ searchResults, isLoading: false });
        return searchResults;
      }

      set({ searchResults: [], isLoading: false });
      return [];
    } catch (error) {
      console.error("근로자 검색 오류:", error);
      set({ isLoading: false, error: error.message });
      return [];
    }
  },

  // 선택월 등록된 근로자 로드
  loadRegisteredWorkers: async (siteId, yearMonth) => {
    if (!siteId || !yearMonth) return [];

    try {
      set({ isLoading: true, error: null });

      // 날짜 계산 - 선택한 달의 시작일과, 다음 달의 시작일 계산
      const dateInfo = getPreviousYearMonthFromSelected(
        yearMonth.split("-")[0],
        yearMonth.split("-")[1]
      );

      const startDate = `${dateInfo.currentYearMonth}-01`;
      const endDate = `${dateInfo.nextYearMonth}-01`;

      // 두 가지 경우를 OR로 조합
      // 1. registration_month가 선택월인 경우
      // 2. 또는 work_date가 선택월 범위에 있는 경우
      const { data: recordsData, error: recordsError } = await supabase
        .from("work_records")
        .select("worker_id, status, registration_month, work_date")
        .eq("site_id", siteId)
        .or(
          `registration_month.eq.${yearMonth},and(work_date.gte.${startDate},work_date.lt.${endDate})`
        );

      if (recordsError) throw recordsError;

      if (!recordsData || recordsData.length === 0) {
        set({ registeredWorkers: [], isLoading: false });
        return [];
      }

      // 중복 제거
      const uniqueWorkerIds = [...new Set(recordsData.map((record) => record.worker_id))];

      // registration 유형을 제외한 근무 이력이 있는 근로자 ID
      const workerIdsWithHistory = [
        ...new Set(
          recordsData
            .filter((record) => record.work_type !== "registration")
            .map((record) => record.worker_id)
        ),
      ];

      // 근로자 상세 정보 가져오기 - daily 타입 근로자만 필터링
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

      if (!workersData || workersData.length === 0) {
        set({ registeredWorkers: [], isLoading: false });
        return [];
      }

      // 직종 코드 정보 가져오기
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

      // 근로자 데이터 정리 및 나이 계산 추가
      const workersWithJobName = workersData.map((worker) => {
        const age = calculateAgeFromResidentNumber(worker.resident_number);

        return {
          ...worker,
          jobName: worker.job_code ? jobCodeMap[worker.job_code] || "미지정" : "미지정",
          age: age,
          source: "registered", // 소스 표시 (등록된 근로자)
          hasWorkHistory: workerIdsWithHistory.includes(worker.worker_id),
        };
      });

      set({ registeredWorkers: workersWithJobName, isLoading: false });
      return workersWithJobName;
    } catch (error) {
      console.error("등록 근로자 데이터 로드 오류:", error);
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  // 보험 가입 중인 근로자 로드
  // 보험 가입 중인 근로자 로드 (수정된 버전)
  loadActiveInsuranceWorkers: async (siteId, yearMonth) => {
    if (!siteId || !yearMonth) {
      set({ activeWorkers: [], inactiveWorkers: [] });
      return { activeWorkersList: [], inactiveWorkersList: [] };
    }

    try {
      set({ isLoading: true, error: null });

      // 1. enrollment_status가 'confirmed' 또는 'reported'인 보험 가입 정보 가져오기
      const { data: activeEnrollments, error: enrollmentsError } = await supabase
        .from("insurance_enrollments")
        .select("worker_id, year_month, enrollment_status, user_confirmed")
        .eq("site_id", siteId)
        .in("enrollment_status", ["confirmed", "reported"])
        .is("national_pension_loss_date", null)
        .is("health_insurance_loss_date", null)
        .is("employment_insurance_loss_date", null)
        .is("industrial_accident_loss_date", null);

      if (enrollmentsError) throw enrollmentsError;

      if (!activeEnrollments || activeEnrollments.length === 0) {
        set({ activeWorkers: [], inactiveWorkers: [], isLoading: false });
        return { activeWorkersList: [], inactiveWorkersList: [] };
      }

      // 2. 선택월에 등록된 근로자 ID 목록 가져오기
      const { data: recordsData, error: recordsError } = await supabase
        .from("work_records")
        .select("worker_id, status, work_hours")
        .eq("site_id", siteId)
        .eq("registration_month", yearMonth);

      if (recordsError) throw recordsError;

      // 선택월 등록된 근로자 ID 목록
      const registeredWorkerIds = recordsData
        ? [...new Set(recordsData.map((record) => record.worker_id))]
        : [];

      // 선택월 근무 시간이 기록된 근로자 ID
      const workingWorkerIds = recordsData
        ? [
            ...new Set(
              recordsData
                .filter((r) => r.status !== "registration" && parseFloat(r.work_hours) > 0)
                .map((r) => r.worker_id)
            ),
          ]
        : [];

      // 3. 가입된 근로자 ID 추출
      const enrolledWorkerIds = [...new Set(activeEnrollments.map((e) => e.worker_id))];

      // 4. 유지 중인 근로자: 가입되었고 현재 월에 등록된 근로자
      const activeWorkerIds = enrolledWorkerIds.filter(
        (id) => registeredWorkerIds.includes(id) || workingWorkerIds.includes(id)
      );

      // 5. 상실 대상자: 가입되었지만 현재 월에 등록되지 않은 근로자
      const inactiveWorkerIds = enrolledWorkerIds.filter(
        (id) => !registeredWorkerIds.includes(id) && !workingWorkerIds.includes(id)
      );

      let activeWorkersList = [];
      let inactiveWorkersList = [];

      // 근로자 상세 정보 가져오기 - 활성 근로자
      if (activeWorkerIds.length > 0) {
        const { data: activeWorkersData, error: activeWorkersError } = await supabase
          .from("workers")
          .select(
            `
          worker_id, name, resident_number, contact_number, address, job_code,
          nationality_code, worker_type
        `
          )
          .in("worker_id", activeWorkerIds)
          .eq("worker_type", "daily");

        if (activeWorkersError) throw activeWorkersError;

        // 직종 코드 처리 (기존 코드와 동일)
        const jobCodes = activeWorkersData.filter((w) => w.job_code).map((w) => w.job_code);
        let jobCodeMap = {};

        if (jobCodes.length > 0) {
          const { data: jobCodeData } = await supabase
            .from("code_masters")
            .select("code_value, code_name")
            .eq("code_type", "JOB_CODE")
            .in("code_value", jobCodes);

          jobCodeMap = jobCodeData
            ? jobCodeData.reduce((acc, item) => {
                acc[item.code_value] = item.code_name;
                return acc;
              }, {})
            : {};
        }

        // 근로자 데이터 정리
        activeWorkersList = activeWorkersData.map((worker) => {
          const age = calculateAgeFromResidentNumber(worker.resident_number);

          return {
            ...worker,
            jobName: worker.job_code ? jobCodeMap[worker.job_code] || "미지정" : "미지정",
            age: age,
            source: "active_enrolled", // 소스 표시 (활성 가입 근로자)
          };
        });

        set({ activeWorkers: activeWorkersList });
      }

      // 근로자 상세 정보 가져오기 - 비활성 근로자 (기존 코드와 유사)
      if (inactiveWorkerIds.length > 0) {
        const { data: inactiveWorkersData, error: inactiveWorkersError } = await supabase
          .from("workers")
          .select(
            `
          worker_id, name, resident_number, contact_number, address, job_code,
          nationality_code, worker_type
        `
          )
          .in("worker_id", inactiveWorkerIds)
          .eq("worker_type", "daily");

        if (inactiveWorkersError) throw inactiveWorkersError;

        // 직종 코드 처리 (기존 코드와 동일)
        const jobCodes = inactiveWorkersData.filter((w) => w.job_code).map((w) => w.job_code);
        let jobCodeMap = {};

        if (jobCodes.length > 0) {
          const { data: jobCodeData } = await supabase
            .from("code_masters")
            .select("code_value, code_name")
            .eq("code_type", "JOB_CODE")
            .in("code_value", jobCodes);

          jobCodeMap = jobCodeData
            ? jobCodeData.reduce((acc, item) => {
                acc[item.code_value] = item.code_name;
                return acc;
              }, {})
            : {};
        }

        // 근로자 데이터 정리
        inactiveWorkersList = inactiveWorkersData.map((worker) => {
          const age = calculateAgeFromResidentNumber(worker.resident_number);

          return {
            ...worker,
            jobName: worker.job_code ? jobCodeMap[worker.job_code] || "미지정" : "미지정",
            age: age,
            source: "inactive_enrolled", // 소스 표시 (비활성 가입 근로자)
          };
        });

        set({ inactiveWorkers: inactiveWorkersList });
      }

      set({ isLoading: false });
      return { activeWorkersList, inactiveWorkersList };
    } catch (error) {
      console.error("보험 가입 근로자 로드 오류:", error);
      set({ isLoading: false, error: error.message });
      throw error;
    }
  },

  // 근로자 상세 정보 가져오기
  fetchWorkerDetails: async (workerId) => {
    if (!workerId) return null;

    try {
      set({ isDetailLoading: true, error: null });

      // 이미 캐시에 있는 경우 API 호출 생략
      const { workerDetails } = get();
      if (workerDetails[workerId]) {
        set({
          selectedWorkerId: workerId,
          showDetail: true,
          isDetailLoading: false,
        });
        return workerDetails[workerId];
      }

      const { data, error } = await supabase
        .from("workers")
        .select("*")
        .eq("worker_id", workerId)
        .single();

      if (error) throw error;

      // 국적, 체류자격 등의 코드 이름 가져오기
      let worker = { ...data };

      // 직종 코드 이름 가져오기
      if (worker.job_code) {
        const { data: jobData } = await supabase
          .from("code_masters")
          .select("code_name")
          .eq("code_type", "JOB_CODE")
          .eq("code_value", worker.job_code)
          .maybeSingle();

        if (jobData) {
          worker.job_name = jobData.code_name;
        }
      }

      // 국적 코드 이름 가져오기
      if (worker.nationality_code) {
        const { data: nationalityData } = await supabase
          .from("code_masters")
          .select("code_name")
          .eq("code_type", "NATIONALITY")
          .eq("code_value", worker.nationality_code)
          .maybeSingle();

        if (nationalityData) {
          worker.nationality_name = nationalityData.code_name;
        }
      }

      // 나이 계산
      worker.age = calculateAgeFromResidentNumber(worker.resident_number);

      // 캐시에 추가
      set((state) => ({
        workerDetails: { ...state.workerDetails, [workerId]: worker },
        selectedWorkerId: workerId,
        showDetail: true,
        isDetailLoading: false,
      }));

      return worker;
    } catch (error) {
      console.error("근로자 상세 정보 조회 오류:", error);
      set({ isDetailLoading: false, error: error.message });
      return null;
    }
  },

  // 선택된 근로자 설정
  setSelectedWorkerId: (workerId) => {
    const { selectedWorkerId, showDetail } = get();

    if (selectedWorkerId === workerId && showDetail) {
      set({ showDetail: false, selectedWorkerId: null });
    } else {
      set({ selectedWorkerId: workerId, showDetail: true });
    }
  },

  // 근로자 현장 등록하기
  registerWorkerToSite: async (workerId, siteId, yearMonth) => {
    if (!workerId || !siteId || !yearMonth) {
      return { success: false, message: "근로자와 공사현장, 년월을 선택해주세요." };
    }

    try {
      set({ isLoading: true, error: null });

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
      await get().loadWorkers(siteId, yearMonth);

      set({ isLoading: false });
      return { success: true, message: `근로자가 ${yearMonth}월에 성공적으로 등록되었습니다.` };
    } catch (error) {
      console.error("근로자 등록 오류:", error);
      set({ isLoading: false, error: error.message });
      return { success: false, message: `등록 중 오류가 발생했습니다: ${error.message}` };
    }
  },
  resetStore: () =>
    set({
      registeredWorkers: [],
      activeWorkers: [],
      inactiveWorkers: [],
      selectedWorkerId: null,
      showDetail: false,
      isLoading: false,
      isWorkerLoading: false,
      isDetailLoading: false,
      error: null,
    }),
  // 오류 지우기
  clearError: () => set({ error: null }),
}));

export default useWorkerStore;
