// lib/store/codeStore.js

// ES 모듈 방식으로 Zustand 임포트
import { create } from "zustand"; // 전체 모듈 임포트
import { persist } from "zustand/middleware";

// 커스텀 스토리지 객체 정의 - 서버 사이드 렌더링을 고려한 안전한 접근
const storage = {
  getItem: (name) => {
    try {
      if (typeof window !== "undefined") {
        const storedValue = localStorage.getItem(name);
        return storedValue ? JSON.parse(storedValue) : null;
      }
      return null;
    } catch (e) {
      console.error(e);
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(name, JSON.stringify(value));
      }
    } catch (e) {
      console.error(e);
    }
  },
  removeItem: (name) => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem(name);
      }
    } catch (e) {
      console.error(e);
    }
  },
};

// 코드 타입 정의 - 수정된 버전 (순서 재배열)
export const CODE_TYPES = {
  PENSION_ACQUISITION_CODE: {
    label: "국민연금 취득코드",
    description: "국민연금 자격 취득 관련 코드입니다.",
  },
  PENSION_LOSS_REASON: {
    label: "국민연금상실사유",
    description: "국민연금 자격 상실 관련 코드입니다.",
  },
  HEALTH_ACQUISITION_CODE: {
    label: "건강취득코드",
    description: "건강보험 자격 취득 관련 코드입니다.",
  },
  HEALTH_LOSS_REASON: {
    label: "건강보험 상실부호",
    description: "건강보험 자격 상실 관련 코드입니다.",
  },
  EMPLOYMENT_LOSS_REASON: {
    label: "고용보험 상실사유",
    description: "고용보험 자격 상실 관련 코드입니다.",
  },
  EMPLOYMENT_INJURY_LEVY_CODE: {
    label: "고용산재부과구분",
    description: "고용보험 및 산재보험 부과 구분 코드입니다.",
  },
  EMPLOYMENT_INJURY_LEVY_REASON: {
    label: "고용산재 부과구분사유",
    description: "고용보험 및 산재보험 부과 구분 사유 코드입니다.",
  },
  GONGDAN_TYPE: { label: "공단구분", description: "4대보험 공단 구분 코드입니다." },
  HEALTH_ACCOUNTING_CODE: {
    label: "건강보험 회계코드",
    description: "건강보험 회계 관련 코드입니다.",
  },
  NATIONALITY: { label: "국적코드", description: "국가별 코드 정보입니다." },
  RESIDENCE_STATUS: { label: "체류자격코드", description: "외국인 체류자격 관련 코드 정보입니다." },
  COMMON_RESIDENCE_STATUS: {
    label: "공통체류자격",
    description: "공통 체류자격 관련 코드 정보입니다.",
  },
  JOB_CODE: { label: "직종코드", description: "직업 분류 코드 정보입니다." },
};

// 스토어 생성 - persist 미들웨어 사용
const useCodeStore = create(
  persist(
    (set, get) => ({
      // 상태
      codeMasters: {}, // { NATIONALITY: [...], JOB_CODE: [...], ... }
      availableCodeTypes: [],
      lastFetched: {}, // { NATIONALITY: timestamp, JOB_CODE: timestamp, ... }
      isLoading: false,
      error: null,

      // 데이터 캐시 유효 시간 (밀리초) - 기본 1시간
      cacheValidityPeriod: 60 * 60 * 1000,

      // 데이터 필요할 때만 로드하는 액션
      loadCodeTypeIfNeeded: async (codeType, forceFetch = false) => {
        const { codeMasters, lastFetched, cacheValidityPeriod } = get();
        const now = Date.now();

        // 데이터가 이미 있고, 캐시가 유효하고, 강제 로드를 요청하지 않은 경우
        if (
          !forceFetch &&
          codeMasters[codeType] &&
          lastFetched[codeType] &&
          now - lastFetched[codeType] < cacheValidityPeriod
        ) {
          return codeMasters[codeType]; // 캐시된 데이터 반환
        }

        // 아니면 새로 로드
        return await get().loadCodeType(codeType);
      },

      // 특정 코드 타입 데이터 로드
      loadCodeType: async (codeType) => {
        try {
          set({ isLoading: true, error: null });

          const url = `/api/code-masters?type=${encodeURIComponent(codeType)}`;
          const response = await fetch(url);

          if (!response.ok) {
            throw new Error(`API 요청 실패: ${response.status}`);
          }

          const data = await response.json();

          set((state) => ({
            codeMasters: {
              ...state.codeMasters,
              [codeType]: data,
            },
            lastFetched: {
              ...state.lastFetched,
              [codeType]: Date.now(),
            },
            isLoading: false,
          }));

          return data;
        } catch (err) {
          console.error(`Error loading ${codeType} data:`, err);
          set({ error: err.message, isLoading: false });
          throw err;
        }
      },

      // 사용 가능한 코드 타입 로드 (CODE_TYPES 객체 순서에 맞게 정렬)
      loadAvailableCodeTypes: async () => {
        try {
          set({ isLoading: true, error: null });

          const response = await fetch("/api/code-masters?format=types");

          if (!response.ok) {
            throw new Error(`API 요청 실패: ${response.status}`);
          }

          const types = await response.json();

          // CODE_TYPES 객체의 키 순서대로 정렬
          const orderedTypes = types.sort((a, b) => {
            const aIndex = Object.keys(CODE_TYPES).indexOf(a);
            const bIndex = Object.keys(CODE_TYPES).indexOf(b);

            // CODE_TYPES에 없는 타입은 맨 뒤로
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;

            return aIndex - bIndex;
          });

          set({
            availableCodeTypes: orderedTypes,
            isLoading: false,
          });

          return orderedTypes;
        } catch (err) {
          console.error("Error loading code types:", err);
          set({ error: err.message, isLoading: false });
          throw err;
        }
      },

      // 모든 코드 타입의 데이터를 한 번에 로드
      loadAllCodeTypes: async () => {
        const { availableCodeTypes, loadCodeType } = get();

        if (availableCodeTypes.length === 0) {
          await get().loadAvailableCodeTypes();
        }

        const updatedTypes = get().availableCodeTypes;

        // 각 코드 타입에 대해 병렬로 데이터 로드
        await Promise.all(updatedTypes.map((type) => loadCodeType(type)));
      },

      // 캐시 무효화 및 데이터 다시 로드
      invalidateCache: (codeType = null) => {
        if (codeType) {
          // 특정 타입만 무효화
          set((state) => ({
            lastFetched: {
              ...state.lastFetched,
              [codeType]: null,
            },
          }));
        } else {
          // 모든 캐시 무효화
          set({ lastFetched: {} });
        }
      },

      // 특정 코드의 정보를 가져옴 (예: 국적코드 값으로 이름 가져오기)
      getCodeInfo: (codeType, codeValue) => {
        const { codeMasters } = get();

        if (!codeMasters[codeType]) {
          return null;
        }

        return codeMasters[codeType].find((code) => code.code_value === codeValue);
      },

      // 코드 리스트를 가져오되, 필요시 로드
      getCodeList: async (codeType, forceFetch = false) => {
        const { loadCodeTypeIfNeeded } = get();

        try {
          return await loadCodeTypeIfNeeded(codeType, forceFetch);
        } catch (error) {
          console.error(`Failed to get code list for ${codeType}:`, error);
          return [];
        }
      },

      // 코드 값 존재 여부 확인
      codeExists: (codeType, codeValue) => {
        const { codeMasters } = get();

        if (!codeMasters[codeType]) {
          return false;
        }

        return codeMasters[codeType].some((code) => code.code_value === codeValue);
      },

      // 활성화된 코드만 필터링해서 반환
      getActiveCodeList: async (codeType) => {
        const { getCodeList } = get();
        const codeList = await getCodeList(codeType);
        return codeList.filter((code) => code.is_active);
      },

      // 캐시 상태 확인
      getCacheStatus: () => {
        const { lastFetched, cacheValidityPeriod } = get();
        const now = Date.now();

        const status = Object.entries(lastFetched).map(([codeType, timestamp]) => {
          const isValid = timestamp && now - timestamp < cacheValidityPeriod;
          return {
            codeType,
            lastFetched: timestamp ? new Date(timestamp).toLocaleString() : "Never",
            isValid,
            ageInMinutes: timestamp ? Math.round((now - timestamp) / (60 * 1000)) : null,
          };
        });

        return status;
      },

      // 캐시 유효 기간 설정
      setCacheValidityPeriod: (periodInMs) => {
        set({ cacheValidityPeriod: periodInMs });
      },
    }),
    {
      name: "code-masters-storage", // 로컬 스토리지 키
      storage: storage, // 커스텀 정의한 스토리지 객체 사용
      partialize: (state) => ({
        // 영구 저장할 상태만 선택
        codeMasters: state.codeMasters,
        lastFetched: state.lastFetched,
        cacheValidityPeriod: state.cacheValidityPeriod,
        availableCodeTypes: state.availableCodeTypes,
      }),
    }
  )
);

export default useCodeStore;
