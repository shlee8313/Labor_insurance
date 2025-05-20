// lib/store/insuranceStatusStore.js
import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { determineInsuranceStatus } from "@/lib/utils/insuranceCalculations";
import { getPreviousYearMonthFromSelected } from "@/lib/utils/dateUtils";
/**
 * 4대보험 가입 자격 상태 관리를 위한 스토어
 */
const useInsuranceStatusStore = create((set, get) => ({
  // 상태
  insuranceStatus: {},
  manualSettings: {},
  isLoading: false,
  error: null,

  // 근로자의 보험 상태 로드
  loadInsuranceStatus: async (workerId, siteId, yearMonth, workerData, historyData) => {
    if (!workerId || !siteId) return null;

    try {
      set({ isLoading: true, error: null });

      // 캐시 키 생성
      const cacheKey = `${workerId}-${siteId}-${yearMonth}`;

      // 이미 캐시에 있는 경우 반환
      const { insuranceStatus } = get();
      if (insuranceStatus[cacheKey]) {
        set({ isLoading: false });
        return insuranceStatus[cacheKey];
      }

      // 근로자 정보나 이력 정보가 제공되지 않은 경우 자동으로 가져오기
      let worker = workerData;
      let history = historyData;

      if (!worker) {
        const { data, error } = await supabase
          .from("workers")
          .select("*")
          .eq("worker_id", workerId)
          .single();

        if (error) throw error;
        worker = data;
      }

      if (!history) {
        console.log(
          `[DEBUG] 근로자 ${workerId}의, 현장 ${siteId}, 년월 ${yearMonth} 이력 데이터 조회 시작`
        );

        // 날짜 정보 계산
        const dateComponents = yearMonth.split("-");
        const year = parseInt(dateComponents[0]);
        const month = parseInt(dateComponents[1]);

        // 이전 달 계산
        const prevDateInfo = getPreviousYearMonthFromSelected(year, month);
        const prevYearMonth = `${prevDateInfo.prevYear}-${prevDateInfo.prevMonth}`;

        // 날짜 범위 계산
        const prevMonthStart = `${prevYearMonth}-01`;
        const selectedMonthStart = `${yearMonth}-01`;

        console.log(`[DEBUG] 이전 달: ${prevYearMonth}, 선택 달: ${yearMonth}`);

        // 이전월 근무 기록 조회 - 날짜 범위로 정확하게 필터링
        const { data: prevRecords, error: prevError } = await supabase
          .from("work_records")
          .select("work_hours, work_date, daily_wage")
          .eq("worker_id", workerId)
          .eq("site_id", siteId)
          .gte("work_date", prevMonthStart)
          .lt("work_date", selectedMonthStart)
          .neq("status", "registration");

        if (prevError) {
          console.error(`[DEBUG] 이전월 근무 기록 조회 오류:`, prevError);
          throw prevError;
        }

        console.log(`[DEBUG] 이전월 근무 기록 조회 결과: ${prevRecords?.length || 0}건`);

        // 선택월 근무 기록 조회 - 날짜 범위로 정확하게 필터링
        const nextMonth = month === 12 ? 1 : month + 1;
        const nextYear = month === 12 ? year + 1 : year;
        const nextMonthStart = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

        const { data: currRecords, error: currError } = await supabase
          .from("work_records")
          .select("work_hours, daily_wage, work_date")
          .eq("worker_id", workerId)
          .eq("site_id", siteId)
          .gte("work_date", selectedMonthStart)
          .lt("work_date", nextMonthStart)
          .neq("status", "registration");

        if (currError) throw currError;

        // 등록 여부 확인
        const { data: regData, error: regError } = await supabase
          .from("work_records")
          .select("registration_month")
          .eq("worker_id", workerId)
          .eq("site_id", siteId)
          .eq("status", "registration")
          .or(`registration_month.eq.${yearMonth},registration_month.eq.${prevYearMonth}`);

        if (regError) throw regError;

        // 이력 데이터 구성
        history = {
          previousMonthWorkDays: prevRecords?.length || 0,
          previousMonthWorkHours:
            prevRecords?.reduce((sum, r) => sum + parseFloat(r.work_hours || 0), 0) || 0,
          isPreviousMonthRegistered:
            regData?.some((r) => r.registration_month === prevYearMonth) || false,
          currentMonthWorkDays: currRecords?.length || 0,
          currentMonthWorkHours:
            currRecords?.reduce((sum, r) => sum + parseFloat(r.work_hours || 0), 0) || 0,
          monthlyWage: currRecords?.reduce((sum, r) => sum + parseFloat(r.daily_wage || 0), 0) || 0,
          isRegisteredInCurrentMonth:
            regData?.some((r) => r.registration_month === yearMonth) || false,
        };
      }

      // 보험 상태 판단 (자동)
      const status = determineInsuranceStatus(worker, history);

      // 수동 설정 확인
      await get().loadManualSettings(workerId, siteId, yearMonth);
      const { manualSettings } = get();
      const manualSetting = manualSettings[`${workerId}-${siteId}-${yearMonth}`];

      // 수동 설정이 있는 경우 오버라이드
      let finalStatus = { ...status };

      if (manualSetting) {
        if (manualSetting.national_pension_status?.startsWith("manual_")) {
          finalStatus.nationalPension.required =
            manualSetting.national_pension_status === "manual_required";
          finalStatus.nationalPension.reason = "수동 설정";
          finalStatus.nationalPension.isManual = true;
        }

        if (manualSetting.health_insurance_status?.startsWith("manual_")) {
          finalStatus.healthInsurance.required =
            manualSetting.health_insurance_status === "manual_required";
          finalStatus.healthInsurance.reason = "수동 설정";
          finalStatus.healthInsurance.isManual = true;
        }

        if (manualSetting.employment_insurance_status?.startsWith("manual_")) {
          finalStatus.employmentInsurance.required =
            manualSetting.employment_insurance_status === "manual_required";
          finalStatus.employmentInsurance.reason = "수동 설정";
          finalStatus.employmentInsurance.isManual = true;
        }

        if (manualSetting.industrial_accident_status?.startsWith("manual_")) {
          finalStatus.industrialAccident.required =
            manualSetting.industrial_accident_status === "manual_required";
          finalStatus.industrialAccident.reason = "수동 설정";
          finalStatus.industrialAccident.isManual = true;
        }

        if (manualSetting.manual_reason) {
          finalStatus.manualReason = manualSetting.manual_reason;
        }
      }

      // 캐시에 저장
      set((state) => ({
        insuranceStatus: { ...state.insuranceStatus, [cacheKey]: finalStatus },
        isLoading: false,
      }));

      return finalStatus;
    } catch (error) {
      console.error("보험 상태 로드 오류:", error);
      set({ isLoading: false, error: error.message });
      return null;
    }
  },

  // 수동 설정 로드
  // loadManualSettings 함수 수정
  loadManualSettings: async (workerId, siteId, yearMonth) => {
    if (!workerId || !siteId || !yearMonth) return null;

    try {
      console.log(`[DEBUG] 수동 설정 로드 시작 - ${workerId}, ${siteId}, ${yearMonth}`);

      // insurance_manual_settings 대신 insurance_enrollments 테이블 사용
      const { data, error } = await supabase
        .from("insurance_enrollments")
        .select(
          `
        worker_id,
        site_id,
        year_month,
        national_pension_status,
        health_insurance_status,
        employment_insurance_status,
        industrial_accident_status,
        manual_reason
      `
        )
        .eq("worker_id", workerId)
        .eq("site_id", siteId)
        .eq("year_month", yearMonth)
        .maybeSingle();

      if (error) {
        console.error("수동 설정 로드 오류:", error);
        return null;
      }

      const cacheKey = `${workerId}-${siteId}-${yearMonth}`;

      if (data) {
        console.log(`[DEBUG] 수동 설정 데이터 찾음:`, data);

        // 캐시에 저장
        set((state) => ({
          manualSettings: { ...state.manualSettings, [cacheKey]: data },
        }));
        return data;
      } else {
        console.log(`[DEBUG] 수동 설정 데이터 없음`);
        return null;
      }
    } catch (error) {
      console.error("수동 설정 로드 오류:", error);
      return null;
    }
  },

  // 보험 상태 수동 변경
  // DB 저장 없이 UI만 업데이트하는 함수
  updateInsuranceStatusUI: async (
    workerId,
    siteId,
    yearMonth,
    insuranceType,
    newStatus,
    reason = ""
  ) => {
    if (!workerId || !siteId || !yearMonth || !insuranceType) {
      return { success: false, message: "필수 정보가 누락되었습니다." };
    }

    try {
      set({ isLoading: true, error: null });

      const cacheKey = `${workerId}-${siteId}-${yearMonth}`;

      // 현재 설정 가져오기
      const { manualSettings, insuranceStatus } = get();
      const currentManualSetting = manualSettings[cacheKey] || {};

      // 수정할 필드와 값 설정
      const statusField = `${insuranceType}_status`;

      // 새 설정 객체 생성
      const updatedSetting = {
        ...currentManualSetting,
        [statusField]: newStatus,
      };

      // 사유 제공된 경우 업데이트
      if (reason !== "") {
        updatedSetting.manual_reason = reason;
      }

      // 메모리 상태 업데이트
      set((state) => ({
        manualSettings: {
          ...state.manualSettings,
          [cacheKey]: updatedSetting,
        },
        // 상태 캐시 무효화
        insuranceStatus: {
          ...state.insuranceStatus,
          [cacheKey]: undefined,
        },
      }));

      // 수동 설정 적용 후 상태 재계산
      await get().loadInsuranceStatus(workerId, siteId, yearMonth);

      set({ isLoading: false });
      return {
        success: true,
        message: "보험 상태가 변경되었습니다. 저장 버튼을 클릭하여 변경사항을 저장하세요.",
      };
    } catch (error) {
      console.error("보험 상태 UI 변경 오류:", error);
      set({ isLoading: false, error: error.message });
      return { success: false, message: `보험 상태 변경 중 오류 발생: ${error.message}` };
    }
  },
  // 보험 상태 수동 변경
  updateInsuranceStatus: async (
    workerId,
    siteId,
    yearMonth,
    insuranceType,
    newStatus,
    reason = ""
  ) => {
    if (!workerId || !siteId || !yearMonth || !insuranceType) {
      return { success: false, message: "필수 정보가 누락되었습니다." };
    }

    try {
      set({ isLoading: true, error: null });

      const cacheKey = `${workerId}-${siteId}-${yearMonth}`;

      // 수정할 필드와 값 설정
      const statusField = `${insuranceType}_status`;

      // 기존 레코드가 있는지 확인
      const { data: existingRecord, error: checkError } = await supabase
        .from("insurance_enrollments")
        .select("enrollment_id")
        .eq("worker_id", workerId)
        .eq("site_id", siteId)
        .eq("year_month", yearMonth)
        .maybeSingle();

      if (checkError && checkError.code !== "PGRST116") {
        throw checkError;
      }

      let updateData = {};
      updateData[statusField] = newStatus;

      // 사유 제공된 경우 업데이트
      if (reason !== "") {
        updateData.manual_reason = reason;
      }

      let result;
      if (existingRecord) {
        // 기존 레코드 업데이트
        result = await supabase
          .from("insurance_enrollments")
          .update(updateData)
          .eq("enrollment_id", existingRecord.enrollment_id);
      } else {
        // 새 레코드 생성
        const insertData = {
          worker_id: workerId,
          site_id: siteId,
          year_month: yearMonth,
          [statusField]: newStatus,
          manual_reason: reason || "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        result = await supabase.from("insurance_enrollments").insert(insertData);
      }

      if (result.error) throw result.error;

      // 보험 상태 캐시 무효화하여 다시 계산되도록 함
      set((state) => ({
        insuranceStatus: { ...state.insuranceStatus, [cacheKey]: undefined },
      }));

      // 상태 다시 로드
      await get().loadInsuranceStatus(workerId, siteId, yearMonth);

      set({ isLoading: false });
      return { success: true, message: "보험 상태가 성공적으로 변경되었습니다." };
    } catch (error) {
      console.error("보험 상태 수동 변경 오류:", error);
      set({ isLoading: false, error: error.message });
      return { success: false, message: `보험 상태 변경 중 오류 발생: ${error.message}` };
    }
  },

  // 수동 사유 업데이트
  // 수동 사유 업데이트
  updateManualReason: async (workerId, siteId, yearMonth, reason) => {
    if (!workerId || !siteId || !yearMonth) {
      return { success: false, message: "필수 정보가 누락되었습니다." };
    }

    try {
      set({ isLoading: true, error: null });

      // 기존 레코드가 있는지 확인
      const { data: existingRecord, error: checkError } = await supabase
        .from("insurance_enrollments")
        .select("enrollment_id")
        .eq("worker_id", workerId)
        .eq("site_id", siteId)
        .eq("year_month", yearMonth)
        .maybeSingle();

      if (checkError && checkError.code !== "PGRST116") throw checkError;

      let result;
      if (existingRecord) {
        // 기존 레코드 업데이트
        result = await supabase
          .from("insurance_enrollments")
          .update({ manual_reason: reason })
          .eq("enrollment_id", existingRecord.enrollment_id);
      } else {
        // 새 레코드 생성
        const insertData = {
          worker_id: workerId,
          site_id: siteId,
          year_month: yearMonth,
          manual_reason: reason,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        result = await supabase.from("insurance_enrollments").insert(insertData);
      }

      if (result.error) throw result.error;

      // 캐시 업데이트
      const cacheKey = `${workerId}-${siteId}-${yearMonth}`;
      set((state) => ({
        manualSettings: {
          ...state.manualSettings,
          [cacheKey]: {
            ...state.manualSettings[cacheKey],
            manual_reason: reason,
          },
        },
      }));

      set({ isLoading: false });
      return { success: true, message: "사유가 성공적으로 업데이트되었습니다." };
    } catch (error) {
      console.error("사유 업데이트 오류:", error);
      set({ isLoading: false, error: error.message });
      return { success: false, message: `사유 업데이트 중 오류 발생: ${error.message}` };
    }
  },

  // 상태 스타일 및 텍스트 유틸리티 함수
  getStatusStyle: (status) => {
    if (!status) {
      return "bg-gray-100 text-gray-800 border-gray-300"; // Default style for null/undefined
    }

    // status가 객체인 경우 (getEffectiveStatus에서 반환한 객체)
    if (typeof status === "object" && status !== null) {
      // statusCode 속성이 있는지 확인
      if (status.statusCode) {
        // statusCode 기준으로 스타일 결정
        if (status.statusCode.startsWith("manual_")) {
          return status.statusCode === "manual_required"
            ? "bg-blue-100 text-blue-800 border-blue-300"
            : "bg-gray-100 text-gray-800 border-gray-300";
        } else {
          return status.statusCode === "auto_required"
            ? "bg-green-100 text-green-800 border-green-300"
            : "bg-red-100 text-red-800 border-red-300";
        }
      }
      // statusCode가 없으면 required 속성 기준으로 처리
      return status.required
        ? "bg-green-100 text-green-800 border-green-300"
        : "bg-red-100 text-red-800 border-red-300";
    }

    // status가 문자열인 경우 (이전 코드와 동일)
    if (typeof status === "string") {
      if (status.startsWith("manual_")) {
        return status === "manual_required"
          ? "bg-blue-100 text-blue-800 border-blue-300"
          : "bg-gray-100 text-gray-800 border-gray-300";
      } else {
        return status === "auto_required"
          ? "bg-green-100 text-green-800 border-green-300"
          : "bg-red-100 text-red-800 border-red-300";
      }
    }

    // 이외의 경우 기본 스타일 반환
    return "bg-gray-100 text-gray-800 border-gray-300";
  },

  getStatusText: (status) => {
    if (!status) {
      return "상태 없음";
    }

    // status가 객체인 경우
    if (typeof status === "object" && status !== null) {
      if (status.statusCode) {
        switch (status.statusCode) {
          case "auto_required":
            return "자동 적용";
          case "auto_exempted":
            return "자동 제외";
          case "manual_required":
            return "수동 적용";
          case "manual_exempted":
            return "수동 제외";
          default:
            return "상태 없음";
        }
      }
      return status.required ? "적용" : "제외";
    }

    // status가 문자열인 경우
    if (typeof status === "string") {
      switch (status) {
        case "auto_required":
          return "자동 적용";
        case "auto_exempted":
          return "자동 제외";
        case "manual_required":
          return "수동 적용";
        case "manual_exempted":
          return "수동 제외";
        default:
          return "상태 없음";
      }
    }

    return "상태 없음";
  },

  // 실제 상태값 가져오기 (자동 또는 수동)
  getEffectiveStatus: (workerId, siteId, yearMonth, insuranceType) => {
    if (!workerId || !siteId || !yearMonth || !insuranceType) {
      return {
        required: false,
        reason: "정보 부족",
        isManual: false,
        statusCode: "auto_exempted",
      };
    }

    const cacheKey = `${workerId}-${siteId}-${yearMonth}`;
    const { insuranceStatus, manualSettings } = get();

    // 모든 적용 데이터 로깅
    console.log("getEffectiveStatus 호출:", {
      workerId,
      siteId,
      yearMonth,
      insuranceType,
      insuranceStatus: insuranceStatus[cacheKey],
      manualSettings: manualSettings[cacheKey],
    });

    // 캐시된 상태 확인
    const status = insuranceStatus[cacheKey];
    const manualSetting = manualSettings[cacheKey];

    // 상태가 없는 경우 기본값 반환
    if (!status) {
      return {
        required: false,
        reason: "정보 없음",
        isManual: false,
        statusCode: "auto_exempted",
      };
    }

    // 보험 유형에 따른 상태 반환
    switch (insuranceType) {
      case "national_pension":
        // 여기에 기본 값을 설정하여 문제 확인
        // if (workerId === 1 || workerId === 2) {
        //   // 문제의 근로자 ID로 변경
        //   return {
        //     required: true, // 강제로 true로 설정
        //     reason: "디버깅: 강제 적용",
        //     isManual: false,
        //     statusCode: "auto_required",
        //   };
        // }

        return {
          required: status.nationalPension?.required || false,
          reason: status.nationalPension?.reason || "정보 없음",
          isManual: status.nationalPension?.isManual || false,
          statusCode:
            manualSetting?.national_pension_status ||
            (status.nationalPension?.required ? "auto_required" : "auto_exempted"),
        };

      case "health_insurance":
        return {
          required: status.healthInsurance?.required || false,
          reason: status.healthInsurance?.reason || "정보 없음",
          isManual: status.healthInsurance?.isManual || false,
          statusCode:
            manualSetting?.health_insurance_status ||
            (status.healthInsurance?.required ? "auto_required" : "auto_exempted"),
        };

      case "employment_insurance":
        return {
          required: status.employmentInsurance?.required || false,
          reason: status.employmentInsurance?.reason || "일용근로자 당연 적용",
          isManual: status.employmentInsurance?.isManual || false,
          statusCode:
            manualSetting?.employment_insurance_status ||
            (status.employmentInsurance?.required ? "auto_required" : "auto_exempted"),
        };

      case "industrial_accident":
        return {
          required: status.industrialAccident?.required || false,
          reason: status.industrialAccident?.reason || "모든 근로자 당연 적용",
          isManual: status.industrialAccident?.isManual || false,
          statusCode:
            manualSetting?.industrial_accident_status ||
            (status.industrialAccident?.required ? "auto_required" : "auto_exempted"),
        };

      default:
        // 알 수 없는 보험 유형인 경우
        console.warn(`알 수 없는 보험 유형: ${insuranceType}`);
        return {
          required: false,
          reason: "알 수 없는 보험 유형",
          isManual: false,
          statusCode: "auto_exempted",
        };
    }
  },

  forceUpdate: () => {
    // 상태 변경 없이 리렌더링만 트리거하기 위한 함수
    set((state) => ({ ...state }));
  },

  // 캐시 초기화 확장
  clearStatusCache: (workerId, siteId, yearMonth) => {
    if (!workerId || !siteId || !yearMonth) return;

    const cacheKey = `${workerId}-${siteId}-${yearMonth}`;

    set((state) => ({
      insuranceStatus: {
        ...state.insuranceStatus,
        [cacheKey]: undefined,
      },
    }));
  },
  // Add this new function to clear a specific cache entry
  resetStore: () =>
    set({
      insuranceStatus: {},
      manualSettings: {},
      isLoading: false,
      error: null,
    }),
  // 오류 지우기
  clearError: () => set({ error: null }),

  // 현장 선택 시 모든 근로자의 보험 상태를 다시 계산하는 함수 추가
  recalculateAllInsuranceStatus: async (siteId, yearMonth, workersList) => {
    if (!siteId || !yearMonth || !workersList || workersList.length === 0) return;

    try {
      set({ isLoading: true });
      console.log(`[INFO] 모든 근로자(${workersList.length}명)의 보험 상태 재계산 시작`);

      // 모든 근로자에 대해 병렬로 처리
      const promises = workersList.map((worker) =>
        get().loadInsuranceStatus(worker.worker_id, siteId, yearMonth)
      );

      await Promise.all(promises);
      console.log("[INFO] 모든 근로자의 보험 상태 재계산 완료");

      set({ isLoading: false });
    } catch (error) {
      console.error("[ERROR] 보험 상태 일괄 재계산 오류:", error);
      set({ isLoading: false, error: error.message });
    }
  },
}));

export default useInsuranceStatusStore;
