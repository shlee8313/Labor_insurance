// lib/store/useInsuranceStore.js
import { create } from "zustand";

// 분리된 스토어들 임포트
import useSiteStore from "./siteStore";
import useWorkerStore from "./workerStore";
import useWorkHistoryStore from "./workHistoryStore";
import useInsuranceStatusStore from "./insuranceStatusStore";
import useInsuranceEnrollmentStore from "./insuranceEnrollmentStore";

// 유틸리티 함수 임포트
import { formatResidentNumber, formatPhoneNumber } from "@/lib/utils/formattingUtils";
import { calculateAgeFromResidentNumber } from "@/lib/utils/insuranceCalculations";
import { getPreviousYearMonthFromSelected } from "@/lib/utils/dateUtils";

/**
 * 통합 보험 관리 스토어 (파사드 패턴)
 * 역할: 하위 호환성 유지, 복잡한 조합 로직 처리, 통합 인터페이스 제공
 */
const useInsuranceStore = create((set, get) => ({
  // 기본 상태 - 하위 호환성 유지
  activeTab: 0,
  selectedYear: new Date().getFullYear(),
  selectedMonth: String(new Date().getMonth() + 1).padStart(2, "0"),
  isLoading: false,
  error: null,

  // 초기화 함수 (하위 호환용)
  initialize: async (userId) => {
    try {
      set({ isLoading: true, error: null });

      // 사이트 스토어 초기화
      await useSiteStore.getState().initialize(userId);

      set({ isLoading: false });
      return { success: true };
    } catch (error) {
      console.error("초기화 오류:", error);
      set({ isLoading: false, error: error.message });
      return { success: false, message: error.message };
    }
  },

  // 현장 선택 (하위 호환용)
  setSelectedSite: (siteId) => {
    useSiteStore.getState().setSelectedSite(siteId);
  },

  // 년월 선택 (하위 호환용)
  setSelectedYearMonth: (year, month) => {
    set({ selectedYear: year, selectedMonth: month });

    // 현재 선택된 현장이 있으면 근로자 목록 다시 로드
    const siteId = useSiteStore.getState().selectedSite;
    if (siteId) {
      const yearMonth = `${year}-${String(month).padStart(2, "0")}`;
      useWorkerStore.getState().loadWorkers(siteId, yearMonth);
    }
  },

  // 탭 선택 (하위 호환용)
  setActiveTab: (tabIndex) => {
    set({ activeTab: tabIndex });
  },

  // 근로자 선택 (하위 호환용)
  setSelectedWorkerId: (workerId) => {
    useWorkerStore.getState().setSelectedWorkerId(workerId);
  },

  // 통합 데이터 로드 (하위 호환용)
  loadAllWorkersData: async () => {
    try {
      set({ isLoading: true, error: null });

      const siteId = useSiteStore.getState().selectedSite;
      const { selectedYear, selectedMonth } = get();
      const yearMonth = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;

      if (!siteId || !yearMonth) {
        set({ isLoading: false });
        return { success: false, message: "현장과 년월을 선택해주세요." };
      }

      // 근로자 목록 로드
      await useWorkerStore.getState().loadWorkers(siteId, yearMonth);

      set({ isLoading: false });
      return { success: true };
    } catch (error) {
      console.error("데이터 로드 오류:", error);
      set({ isLoading: false, error: error.message });
      return { success: false, message: error.message };
    }
  },

  // 근로자 이력 로드 (하위 호환용 - 배치 처리)
  loadWorkersHistory: async (registeredWorkers) => {
    try {
      const siteId = useSiteStore.getState().selectedSite;
      const { selectedYear, selectedMonth } = get();
      const yearMonth = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;

      if (!siteId || !yearMonth || !registeredWorkers) return {};

      return await useWorkHistoryStore
        .getState()
        .loadMultipleWorkersHistory(registeredWorkers, siteId, yearMonth);
    } catch (error) {
      console.error("근로자 이력 로드 오류:", error);
      return {};
    }
  },

  // 보험 가입 정보 로드 (하위 호환용 - 배치 처리)
  loadInsuranceEnrollments: async (historyData) => {
    try {
      const siteId = useSiteStore.getState().selectedSite;
      if (!siteId || !historyData) return {};

      const enrollmentData = {};
      const workerIds = Object.keys(historyData);

      // 병렬 처리로 성능 향상
      const promises = workerIds.map(async (workerId) => {
        const enrollments = await useInsuranceEnrollmentStore
          .getState()
          .loadInsuranceEnrollments(workerId, siteId);
        return { workerId, enrollments };
      });

      const results = await Promise.all(promises);

      results.forEach(({ workerId, enrollments }) => {
        enrollmentData[workerId] = enrollments;
      });

      return enrollmentData;
    } catch (error) {
      console.error("보험 가입 정보 로드 오류:", error);
      return {};
    }
  },

  // 보험 상태 변경 (하위 호환용)
  handleInsuranceStatusChange: async (workerId, insuranceType, newStatus, reason = "") => {
    try {
      const siteId = useSiteStore.getState().selectedSite;
      const { selectedYear, selectedMonth } = get();
      const yearMonth = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;

      if (!workerId || !siteId || !yearMonth || !insuranceType) {
        return { success: false, message: "필수 정보가 누락되었습니다." };
      }

      // UI 상태만 업데이트 (DB 저장 안함)
      return await useInsuranceStatusStore
        .getState()
        .updateInsuranceStatusUI(workerId, siteId, yearMonth, insuranceType, newStatus, reason);
    } catch (error) {
      console.error("보험 상태 변경 오류:", error);
      return { success: false, message: `보험 상태 변경 중 오류 발생: ${error.message}` };
    }
  },

  // 사유 업데이트 (하위 호환용)
  handleReasonUpdate: async (workerId, reason) => {
    try {
      const siteId = useSiteStore.getState().selectedSite;
      const { selectedYear, selectedMonth } = get();
      const yearMonth = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;

      if (!workerId || !siteId || !yearMonth) {
        return { success: false, message: "필수 정보가 누락되었습니다." };
      }

      // 캐시에만 업데이트 (UI용)
      const cacheKey = `${workerId}-${siteId}-${yearMonth}`;
      const { manualSettings } = useInsuranceStatusStore.getState();
      const currentManualSetting = manualSettings[cacheKey] || {};

      useInsuranceStatusStore.setState((state) => ({
        manualSettings: {
          ...state.manualSettings,
          [cacheKey]: {
            ...currentManualSetting,
            manual_reason: reason,
          },
        },
      }));

      return {
        success: true,
        message: "사유가 업데이트되었습니다. 변경사항을 저장하려면 '저장' 버튼을 클릭하세요.",
      };
    } catch (error) {
      console.error("사유 업데이트 오류:", error);
      return { success: false, message: `사유 업데이트 중 오류 발생: ${error.message}` };
    }
  },

  // 변경사항 일괄 저장 (새로운 기능)
  saveAllChanges: async () => {
    try {
      set({ isLoading: true, error: null });

      const siteId = useSiteStore.getState().selectedSite;
      const { selectedYear, selectedMonth } = get();
      const yearMonth = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;

      if (!siteId || !yearMonth) {
        return { success: false, message: "현장과 년월을 선택해주세요." };
      }

      const { manualSettings } = useInsuranceStatusStore.getState();
      const changes = [];

      // 변경된 설정들을 찾아서 저장
      Object.keys(manualSettings).forEach((cacheKey) => {
        const setting = manualSettings[cacheKey];
        if (setting && cacheKey.includes(yearMonth)) {
          const [workerId, ,] = cacheKey.split("-");
          changes.push({
            workerId: parseInt(workerId),
            setting,
          });
        }
      });

      if (changes.length === 0) {
        set({ isLoading: false });
        return { success: true, message: "저장할 변경사항이 없습니다." };
      }

      // 순차적으로 저장 (병렬 처리시 동시성 문제 방지)
      const results = [];
      for (const change of changes) {
        // 각 보험별로 저장
        const insuranceTypes = [
          "national_pension",
          "health_insurance",
          "employment_insurance",
          "industrial_accident",
        ];

        for (const insuranceType of insuranceTypes) {
          const statusField = `${insuranceType}_status`;
          if (change.setting[statusField]) {
            const result = await useInsuranceStatusStore
              .getState()
              .updateInsuranceStatus(
                change.workerId,
                siteId,
                yearMonth,
                insuranceType,
                change.setting[statusField],
                change.setting.manual_reason || ""
              );
            results.push(result);
          }
        }

        // 사유만 변경된 경우
        if (
          change.setting.manual_reason &&
          !insuranceTypes.some((type) => change.setting[`${type}_status`])
        ) {
          const result = await useInsuranceStatusStore
            .getState()
            .updateManualReason(change.workerId, siteId, yearMonth, change.setting.manual_reason);
          results.push(result);
        }
      }

      const failedResults = results.filter((r) => !r.success);

      set({ isLoading: false });

      if (failedResults.length === 0) {
        return { success: true, message: `${changes.length}명의 변경사항이 저장되었습니다.` };
      } else {
        return {
          success: false,
          message: `${failedResults.length}개의 저장 실패가 있습니다. 다시 시도해주세요.`,
        };
      }
    } catch (error) {
      console.error("일괄 저장 오류:", error);
      set({ isLoading: false, error: error.message });
      return { success: false, message: `저장 중 오류 발생: ${error.message}` };
    }
  },

  // 보험 가입 처리 (하위 호환용)
  handleInsuranceAcquisition: async (workerId) => {
    try {
      const siteId = useSiteStore.getState().selectedSite;
      const { selectedYear, selectedMonth } = get();
      const yearMonth = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;

      if (!workerId || !siteId || !yearMonth) {
        return { success: false, message: "필수 정보가 누락되었습니다." };
      }

      // 보험 상태 확인
      const insuranceStatus = await useInsuranceStatusStore
        .getState()
        .loadInsuranceStatus(workerId, siteId, yearMonth);

      if (!insuranceStatus) {
        return { success: false, message: "보험 상태 정보를 계산할 수 없습니다." };
      }

      // 가입이 필요한 보험 타입 확인
      const insuranceTypes = [];
      const statusMapping = {
        nationalPension: "national_pension",
        healthInsurance: "health_insurance",
        employmentInsurance: "employment_insurance",
        industrialAccident: "industrial_accident",
      };

      Object.keys(statusMapping).forEach((key) => {
        if (insuranceStatus[key]?.required) {
          insuranceTypes.push(statusMapping[key]);
        }
      });

      if (insuranceTypes.length === 0) {
        return { success: false, message: "가입이 필요한 보험이 없습니다." };
      }

      // 가입 처리
      return await useInsuranceEnrollmentStore
        .getState()
        .handleInsuranceAcquisition(workerId, siteId, yearMonth, insuranceTypes, 0);
    } catch (error) {
      console.error("보험 가입 처리 오류:", error);
      return { success: false, message: `보험 가입 처리 중 오류 발생: ${error.message}` };
    }
  },

  // 보험 상실 처리 (하위 호환용)
  handleInsuranceLoss: async (workerId) => {
    try {
      const siteId = useSiteStore.getState().selectedSite;
      const { selectedYear, selectedMonth } = get();
      const yearMonth = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;

      if (!workerId || !siteId) {
        return { success: false, message: "필수 정보가 누락되었습니다." };
      }

      return await useInsuranceEnrollmentStore
        .getState()
        .handleInsuranceLoss(workerId, siteId, yearMonth);
    } catch (error) {
      console.error("보험 상실 처리 오류:", error);
      return { success: false, message: `보험 상실 처리 중 오류 발생: ${error.message}` };
    }
  },

  // 근로자 분류 (하위 호환용)
  classifyWorkersByInsuranceStatus: () => {
    try {
      const { registeredWorkers, activeWorkers, inactiveWorkers } = useWorkerStore.getState();
      const { workersHistory } = useWorkHistoryStore.getState();
      const { enrollmentRecords } = useInsuranceEnrollmentStore.getState();

      // 모든 근로자 통합 (중복 제거)
      const allWorkers = [...registeredWorkers, ...activeWorkers, ...inactiveWorkers];
      const uniqueWorkers = [];
      const workerIds = new Set();

      allWorkers.forEach((worker) => {
        if (!workerIds.has(worker.worker_id)) {
          uniqueWorkers.push(worker);
          workerIds.add(worker.worker_id);
        }
      });

      return useInsuranceEnrollmentStore
        .getState()
        .classifyWorkersForInsurance(uniqueWorkers, workersHistory, enrollmentRecords);
    } catch (error) {
      console.error("근로자 분류 오류:", error);
      return {
        newEnrollmentWorkers: [],
        activeEnrollmentWorkers: [],
        lossEnrollmentWorkers: [],
      };
    }
  },

  // 하위 호환성을 위한 직접 참조 메서드들
  isEnrolled: (workerId, insuranceType) => {
    const siteId = useSiteStore.getState().selectedSite;
    if (!workerId || !siteId || !insuranceType) return false;
    return useInsuranceEnrollmentStore.getState().isEnrolled(workerId, siteId, insuranceType);
  },

  getEffectiveStatus: (workerId, insuranceType) => {
    const siteId = useSiteStore.getState().selectedSite;
    const { selectedYear, selectedMonth } = get();
    const yearMonth = `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;

    if (!workerId || !siteId || !yearMonth || !insuranceType) return null;

    return useInsuranceStatusStore
      .getState()
      .getEffectiveStatus(workerId, siteId, yearMonth, insuranceType);
  },

  // 유틸리티 메서드들 (하위 호환용)
  getStatusStyle: (status) => {
    return useInsuranceStatusStore.getState().getStatusStyle(status);
  },

  getStatusText: (status) => {
    return useInsuranceStatusStore.getState().getStatusText(status);
  },

  // 스토어 초기화
  resetStore: () => {
    set({
      activeTab: 0,
      selectedYear: new Date().getFullYear(),
      selectedMonth: String(new Date().getMonth() + 1).padStart(2, "0"),
      isLoading: false,
      error: null,
    });

    // 개별 스토어들 초기화
    useSiteStore.getState().resetStore();
    useWorkerStore.getState().resetStore();
    useWorkHistoryStore.getState().resetStore();
    useInsuranceStatusStore.getState().resetStore();
    useInsuranceEnrollmentStore.getState().resetStore();
  },

  // 오류 지우기
  clearError: () => {
    set({ error: null });
    useSiteStore.getState().clearError();
    useWorkerStore.getState().clearError();
    useWorkHistoryStore.getState().clearError();
    useInsuranceStatusStore.getState().clearError();
    useInsuranceEnrollmentStore.getState().clearError();
  },

  // 편의를 위한 getter 메서드들
  getCurrentSite: () => useSiteStore.getState().selectedSite,
  getCurrentYearMonth: () => {
    const { selectedYear, selectedMonth } = get();
    return `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`;
  },

  // 하위 호환성을 위한 유틸리티 함수들 노출
  formatResidentNumber,
  formatPhoneNumber,
  calculateAgeFromResidentNumber,
  getPreviousYearMonthFromSelected,
}));

export default useInsuranceStore;

/**
 *
 *
 *
 *
 *
 *
 */

// //file: lib/store/useInsuranceStore.js
// import { create } from "zustand";

// // 분리된 스토어들 임포트
// import useSiteStore from "./siteStore";
// import useWorkerStore from "./workerStore";
// import useWorkHistoryStore from "./workHistoryStore";
// import useInsuranceStatusStore from "./insuranceStatusStore";
// import useInsuranceEnrollmentStore from "./insuranceEnrollmentStore";

// // 유틸리티 함수 임포트
// import { formatResidentNumber, formatPhoneNumber } from "@/lib/utils/formattingUtils";

// import { calculateAgeFromResidentNumber } from "@/lib/utils/insuranceCalculations";

// import { getPreviousYearMonthFromSelected } from "@/lib/utils/dateUtils";

// /**
//  * 통합 보험 관리 스토어 (파사드 패턴)
//  * 하위 호환성 유지를 위한 파사드 역할을 하며,
//  * 실제 기능은 분리된 스토어들이 담당
//  */
// const useInsuranceStore = create((set, get) => ({
//   // 기본 상태 - 하위 호환성 유지용
//   activeTab: 0,
//   isLoading: false,
//   error: null,

//   // 하위 호환용 초기화 함수
//   initialize: async (userId) => {
//     try {
//       set({ isLoading: true, error: null });

//       // 각 스토어 초기화
//       await useSiteStore.getState().initialize(userId);

//       set({ isLoading: false });
//     } catch (error) {
//       console.error("초기화 오류:", error);
//       set({ isLoading: false, error: error.message });
//     }
//   },

//   // 현장 선택
//   setSelectedSite: (siteId) => {
//     useSiteStore.getState().setSelectedSite(siteId);
//   },

//   // 년월 선택
//   setSelectedYearMonth: (year, month) => {
//     // 현재 년월 상태 업데이트 (스토어들은 각자 자체적으로 상태 관리)
//     set((state) => ({
//       selectedYear: year,
//       selectedMonth: month,
//     }));

//     // 필요한 경우 다시 데이터 로드
//     const siteId = useSiteStore.getState().selectedSite;
//     if (siteId) {
//       // 현재 선택된 년월 기준으로 근로자 목록 다시 로드
//       useWorkerStore.getState().loadWorkers(siteId, `${year}-${month}`);
//     }
//   },

//   // 탭 선택
//   setActiveTab: (tabIndex) => {
//     set({ activeTab: tabIndex });
//   },

//   // 근로자 선택
//   setSelectedWorkerId: (workerId) => {
//     useWorkerStore.getState().setSelectedWorkerId(workerId);
//   },

//   // 모든 근로자 데이터 로드 (하위 호환용 통합 함수)
//   loadAllWorkersData: async () => {
//     try {
//       set({ isLoading: true, error: null });

//       // 사이트와 년월 가져오기
//       const siteId = useSiteStore.getState().selectedSite;
//       const { selectedYear, selectedMonth } = get();
//       const yearMonth = `${selectedYear}-${selectedMonth.padStart(2, "0")}`;

//       if (!siteId || !yearMonth) {
//         set({ isLoading: false });
//         return;
//       }

//       // 근로자 목록 로드
//       await useWorkerStore.getState().loadWorkers(siteId, yearMonth);

//       set({ isLoading: false });
//     } catch (error) {
//       console.error("데이터 로드 오류:", error);
//       set({ isLoading: false, error: error.message });
//     }
//   },

//   // 근로자 이력 로드 (하위 호환용)
//   loadWorkersHistory: async (registeredWorkers) => {
//     try {
//       // 사이트와 년월 가져오기
//       const siteId = useSiteStore.getState().selectedSite;
//       const { selectedYear, selectedMonth } = get();
//       const yearMonth = `${selectedYear}-${selectedMonth.padStart(2, "0")}`;

//       if (!siteId || !yearMonth || !registeredWorkers) return {};

//       return await useWorkHistoryStore
//         .getState()
//         .loadMultipleWorkersHistory(registeredWorkers, siteId, yearMonth);
//     } catch (error) {
//       console.error("근로자 이력 로드 오류:", error);
//       return {};
//     }
//   },

//   // 보험 가입 정보 로드 (하위 호환용)
//   loadInsuranceEnrollments: async (historyData) => {
//     try {
//       const siteId = useSiteStore.getState().selectedSite;

//       if (!siteId || !historyData) return {};

//       // 모든 근로자의 가입 정보 로드
//       const enrollmentData = {};

//       for (const workerId of Object.keys(historyData)) {
//         const enrollments = await useInsuranceEnrollmentStore
//           .getState()
//           .loadInsuranceEnrollments(workerId, siteId);

//         enrollmentData[workerId] = enrollments;
//       }

//       return enrollmentData;
//     } catch (error) {
//       console.error("보험 가입 정보 로드 오류:", error);
//       return {};
//     }
//   },

//   // 보험 상태 업데이트 (하위 호환용)
//   handleInsuranceStatusChange: async (workerId, insuranceType, newStatus) => {
//     try {
//       const siteId = useSiteStore.getState().selectedSite;
//       const { selectedYear, selectedMonth } = get();
//       const yearMonth = `${selectedYear}-${selectedMonth.padStart(2, "0")}`;

//       if (!workerId || !siteId || !yearMonth || !insuranceType) {
//         return { success: false, message: "필수 정보가 누락되었습니다." };
//       }

//       // 상태 객체 수정 (UI만 반영)
//       const cacheKey = `${workerId}-${siteId}-${yearMonth}`;

//       // 현재 상태 가져오기
//       const { manualSettings, insuranceStatus } = useInsuranceStatusStore.getState();
//       const currentManualSetting = manualSettings[cacheKey] || {};

//       // 수정할 필드와 값 설정
//       const statusField = `${insuranceType}_status`;

//       // UI용 임시 상태 업데이트 (캐싱만)
//       useInsuranceStatusStore.setState((state) => ({
//         manualSettings: {
//           ...state.manualSettings,
//           [cacheKey]: {
//             ...currentManualSetting,
//             [statusField]: newStatus,
//           },
//         },
//       }));

//       // 보험 상태 캐시 무효화하여 다시 계산되도록 함
//       useInsuranceStatusStore.setState((state) => ({
//         insuranceStatus: { ...state.insuranceStatus, [cacheKey]: undefined },
//       }));

//       // 다시 계산
//       await useInsuranceStatusStore.getState().loadInsuranceStatus(workerId, siteId, yearMonth);

//       return {
//         success: true,
//         message: "보험 상태가 변경되었습니다. 변경사항을 저장하려면 '저장' 버튼을 클릭하세요.",
//       };
//     } catch (error) {
//       console.error("보험 상태 변경 오류:", error);
//       return { success: false, message: `보험 상태 변경 중 오류 발생: ${error.message}` };
//     }
//   },

//   // 사유 업데이트 (하위 호환용)
//   handleReasonUpdate: async (workerId, reason) => {
//     try {
//       const siteId = useSiteStore.getState().selectedSite;
//       const { selectedYear, selectedMonth } = get();
//       const yearMonth = `${selectedYear}-${selectedMonth.padStart(2, "0")}`;

//       if (!workerId || !siteId || !yearMonth) {
//         return { success: false, message: "필수 정보가 누락되었습니다." };
//       }

//       // 캐시 키 생성
//       const cacheKey = `${workerId}-${siteId}-${yearMonth}`;

//       // 현재 수동 설정 가져오기
//       const { manualSettings } = useInsuranceStatusStore.getState();
//       const currentManualSetting = manualSettings[cacheKey] || {};

//       // UI용 임시 상태 업데이트 (캐싱만)
//       useInsuranceStatusStore.setState((state) => ({
//         manualSettings: {
//           ...state.manualSettings,
//           [cacheKey]: {
//             ...currentManualSetting,
//             manual_reason: reason,
//           },
//         },
//       }));

//       return {
//         success: true,
//         message: "사유가 업데이트되었습니다. 변경사항을 저장하려면 '저장' 버튼을 클릭하세요.",
//       };
//     } catch (error) {
//       console.error("사유 업데이트 오류:", error);
//       return { success: false, message: `사유 업데이트 중 오류 발생: ${error.message}` };
//     }
//   },

//   // 보험 가입 처리 (하위 호환용)
//   handleInsuranceAcquisition: async (workerId) => {
//     try {
//       const siteId = useSiteStore.getState().selectedSite;
//       const { selectedYear, selectedMonth } = get();
//       const yearMonth = `${selectedYear}-${selectedMonth.padStart(2, "0")}`;

//       if (!workerId || !siteId || !yearMonth) {
//         return { success: false, message: "필수 정보가 누락되었습니다." };
//       }
//       // 현재 보험 상태 가져오기
//       const workerHistory = await useWorkHistoryStore
//         .getState()
//         .loadWorkersHistory(workerId, siteId, yearMonth);

//       if (!workerHistory) {
//         return { success: false, message: "근로자 이력 정보를 가져올 수 없습니다." };
//       }

//       // 보험 상태 계산
//       const insuranceStatus = await useInsuranceStatusStore
//         .getState()
//         .loadInsuranceStatus(workerId, siteId, yearMonth, null, workerHistory);

//       if (!insuranceStatus) {
//         return { success: false, message: "보험 상태 정보를 계산할 수 없습니다." };
//       }

//       // 가입이 필요한 보험 타입 확인
//       const insuranceTypes = [];

//       if (insuranceStatus.nationalPension.required) {
//         insuranceTypes.push("national_pension");
//       }

//       if (insuranceStatus.healthInsurance.required) {
//         insuranceTypes.push("health_insurance");
//       }

//       if (insuranceStatus.employmentInsurance.required) {
//         insuranceTypes.push("employment_insurance");
//       }

//       if (insuranceStatus.industrialAccident.required) {
//         insuranceTypes.push("industrial_accident");
//       }

//       // 가입할 보험이 없는 경우
//       if (insuranceTypes.length === 0) {
//         return { success: false, message: "가입이 필요한 보험이 없습니다." };
//       }

//       // 월급여 설정
//       const monthlyWage = workerHistory.monthlyWage || 0;

//       // 가입 처리
//       return await useInsuranceEnrollmentStore
//         .getState()
//         .handleInsuranceAcquisition(workerId, siteId, yearMonth, insuranceTypes, monthlyWage);
//     } catch (error) {
//       console.error("보험 가입 처리 오류:", error);
//       return { success: false, message: `보험 가입 처리 중 오류 발생: ${error.message}` };
//     }
//   },

//   // 보험 상실 처리 (하위 호환용)
//   handleInsuranceLoss: async (workerId) => {
//     try {
//       const siteId = useSiteStore.getState().selectedSite;

//       if (!workerId || !siteId) {
//         return { success: false, message: "필수 정보가 누락되었습니다." };
//       }

//       return await useInsuranceEnrollmentStore.getState().handleInsuranceLoss(workerId, siteId);
//     } catch (error) {
//       console.error("보험 상실 처리 오류:", error);
//       return { success: false, message: `보험 상실 처리 중 오류 발생: ${error.message}` };
//     }
//   },

//   // 근로자 분류 함수 (하위 호환용)
//   classifyWorkersByInsuranceStatus: () => {
//     try {
//       // 각 스토어에서 데이터 가져오기
//       const { registeredWorkers, activeWorkers, inactiveWorkers } = useWorkerStore.getState();
//       const { workersHistory } = useWorkHistoryStore.getState();
//       const { enrollmentRecords } = useInsuranceEnrollmentStore.getState();

//       // 등록된 근로자와 활성 근로자 결합 (중복 제거)
//       const allWorkers = [...registeredWorkers, ...activeWorkers, ...inactiveWorkers];
//       const uniqueWorkers = [];
//       const workerIds = new Set();

//       allWorkers.forEach((worker) => {
//         if (!workerIds.has(worker.worker_id)) {
//           uniqueWorkers.push(worker);
//           workerIds.add(worker.worker_id);
//         }
//       });

//       // 분류 수행
//       return useInsuranceEnrollmentStore
//         .getState()
//         .classifyWorkersForInsurance(uniqueWorkers, workersHistory, enrollmentRecords);
//     } catch (error) {
//       console.error("근로자 분류 오류:", error);
//       return {
//         newEnrollmentWorkers: [],
//         activeEnrollmentWorkers: [],
//         lossEnrollmentWorkers: [],
//       };
//     }
//   },

//   // 보험별 가입 상태 확인 (하위 호환용)
//   isEnrolled: (workerId, insuranceType) => {
//     const siteId = useSiteStore.getState().selectedSite;

//     if (!workerId || !siteId || !insuranceType) return false;

//     return useInsuranceEnrollmentStore.getState().isEnrolled(workerId, siteId, insuranceType);
//   },

//   // 실제 상태값 가져오기 (하위 호환용)
//   getEffectiveStatus: (workerId, insuranceType) => {
//     const siteId = useSiteStore.getState().selectedSite;
//     const { selectedYear, selectedMonth } = get();
//     const yearMonth = `${selectedYear}-${selectedMonth.padStart(2, "0")}`;

//     if (!workerId || !siteId || !yearMonth || !insuranceType) return null;

//     return useInsuranceStatusStore
//       .getState()
//       .getEffectiveStatus(workerId, siteId, yearMonth, insuranceType);
//   },

//   // 상태 스타일 및 텍스트 유틸리티 함수 (하위 호환용)
//   getStatusStyle: (status) => {
//     return useInsuranceStatusStore.getState().getStatusStyle(status);
//   },

//   getStatusText: (status) => {
//     return useInsuranceStatusStore.getState().getStatusText(status);
//   },

//   resetStore: () => {
//     // 자체 상태 초기화
//     set({
//       activeTab: 0,
//       isLoading: false,
//       error: null,
//     });

//     // 다른 모든 관련 스토어 초기화
//     useSiteStore.getState().resetStore();
//     useWorkerStore.getState().resetStore();
//     useWorkHistoryStore.getState().resetStore();
//     useInsuranceStatusStore.getState().resetStore();
//     useInsuranceEnrollmentStore.getState().resetStore();
//   },

//   // 오류 지우기 (하위 호환용)
//   clearError: () => {
//     set({ error: null });
//     useSiteStore.getState().clearError();
//     useWorkerStore.getState().clearError();
//     useWorkHistoryStore.getState().clearError();
//     useInsuranceStatusStore.getState().clearError();
//     useInsuranceEnrollmentStore.getState().clearError();
//   },

//   // 유틸리티 함수들 (하위 호환용)
//   formatResidentNumber,
//   formatPhoneNumber,
//   calculateAgeFromResidentNumber,
//   getPreviousYearMonthFromSelected,
// }));

// export default useInsuranceStore;
