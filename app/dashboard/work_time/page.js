"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuthStore } from "@/lib/store/authStore";
import useSiteStore from "@/lib/store/siteStore";
import useWorkTimeStore from "@/lib/store/workTimeStore";
import useInsuranceStatusStore from "@/lib/store/insuranceStatusStore";
import RoleGuard from "@/components/RoleGuard";
import useCodeStore from "@/lib/store/codeStore";
import { useShallow } from "zustand/react/shallow";
import WorkerAddModal from "./components/WorkerAddModal";
import CalendarWorkTime from "./components/CalendarWorkTime";
import {
  Building2,
  ChevronDown,
  RefreshCw,
  Check,
  UserPlus,
  X,
  Save,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// 보험 상태 전용 훅
const useWorkerInsuranceStatus = (workerId, siteId, yearMonth) => {
  const { loadInsuranceStatus, getEffectiveStatus } = useInsuranceStatusStore();

  useEffect(() => {
    if (workerId && siteId && yearMonth) {
      loadInsuranceStatus(workerId, siteId, yearMonth);
    }
  }, [workerId, siteId, yearMonth, loadInsuranceStatus]);

  return useMemo(
    () => ({
      nationalPension: getEffectiveStatus(workerId, siteId, yearMonth, "national_pension"),
      healthInsurance: getEffectiveStatus(workerId, siteId, yearMonth, "health_insurance"),
      employmentInsurance: getEffectiveStatus(workerId, siteId, yearMonth, "employment_insurance"),
      industrialAccident: getEffectiveStatus(workerId, siteId, yearMonth, "industrial_accident"),
    }),
    [workerId, siteId, yearMonth, getEffectiveStatus]
  );
};

function WorkTimePage() {
  const { user } = useAuthStore();
  const { getCodeList } = useCodeStore();

  // siteStore에서 현장 관련 상태 가져오기
  const { sites, userRole, initialize: initializeSiteStore, isSiteLoading } = useSiteStore();

  // workTimeStore에서 근무시간 관리 기능만 가져오기
  const {
    workers,
    selectedWorker,
    yearMonth,
    workerDetails,
    workReports,
    isDetailLoading,
    isReportLoading,
    isLoading: isWorkTimeLoading,
    isWorkerLoading,
    fetchWorkers,
    fetchWorkerDetails,
    setYearMonth,
    registerWorkerToSite,
    saveWorkRecords,
  } = useWorkTimeStore();

  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showSiteSelector, setShowSiteSelector] = useState(null);
  const [selectedSite, setSelectedSite] = useState(null);

  // 코드 데이터 저장용 상태
  const [nationalityCodes, setNationalityCodes] = useState([]);
  const [residenceStatusCodes, setResidenceStatusCodes] = useState([]);
  const [jobCodes, setJobCodes] = useState([]);
  const [unassignedWorkers, setUnassignedWorkers] = useState([]);
  const [showWorkerAssignModal, setShowWorkerAssignModal] = useState(false);
  const [workerSearchTerm, setWorkerSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // 저장 상태 추적
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);

  // 최적화된 선택자들
  const selectedWorkerDetails = useWorkTimeStore(
    useShallow((state) => state.workerDetails[state.selectedWorker] || null)
  );

  const workReportData = useWorkTimeStore(
    useShallow((state) => {
      if (!state.selectedWorker || !selectedSite || !state.yearMonth) return null;
      const cacheKey = `${state.selectedWorker}-${selectedSite}-${state.yearMonth}`;
      return state.workReports[cacheKey] || null;
    })
  );

  const prevMonthWorkData = useWorkTimeStore(
    useShallow((state) => {
      if (!state.selectedWorker || !selectedSite || !state.yearMonth) return null;
      const currentDate = new Date(`${state.yearMonth}-01`);
      const prevMonth = new Date(currentDate);
      prevMonth.setMonth(currentDate.getMonth() - 1);
      const prevYearMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      const cacheKey = `${state.selectedWorker}-${selectedSite}-${prevYearMonth}`;
      return state.prevMonthWork[cacheKey] || { days: 0, hours: 0, startDate: "없음" };
    })
  );

  // 보험 상태 전용 훅 사용
  const insuranceStatus = useWorkerInsuranceStatus(selectedWorker, selectedSite, yearMonth);

  // 초기화 및 기본 useEffect들
  useEffect(() => {
    setSelectedSite(null);
    return () => {
      useWorkTimeStore.getState().resetStore();
    };
  }, []);

  useEffect(() => {
    if (user) {
      initializeSiteStore(user.id);
    }
  }, [user, initializeSiteStore]);

  // 코드 데이터 로드
  useEffect(() => {
    async function loadCodeData() {
      try {
        const nationalities = await getCodeList("NATIONALITY");
        setNationalityCodes(nationalities || []);

        const residenceStatuses = await getCodeList("COMMON_RESIDENCE_STATUS");
        setResidenceStatusCodes(residenceStatuses || []);

        const jobs = await getCodeList("JOB_CODE");
        setJobCodes(jobs || []);
      } catch (error) {
        console.error("코드 데이터 로드 오류:", error);
      }
    }

    loadCodeData();
  }, [getCodeList]);

  // 사이트 변경 시 검색어 초기화 및 근로자 목록 갱신
  useEffect(() => {
    setSearchTerm("");
    if (selectedSite) {
      fetchWorkers(selectedSite);
    }
  }, [selectedSite, fetchWorkers]);

  // 검색어 변경 시 근로자 목록 필터링
  useEffect(() => {
    if (selectedSite) {
      const debouncedFetch = setTimeout(() => {
        fetchWorkers(selectedSite, searchTerm);
      }, 300);
      return () => clearTimeout(debouncedFetch);
    }
  }, [searchTerm, selectedSite, fetchWorkers]);

  // 근로자 선택 시 근무 기록 로드
  useEffect(() => {
    if (selectedWorker && selectedSite && yearMonth) {
      useWorkTimeStore.getState().fetchWorkReports(selectedWorker, selectedSite, yearMonth);
    }
  }, [selectedWorker, selectedSite, yearMonth]);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    if (showSiteSelector !== null) {
      const handleClickOutside = (event) => {
        if (
          !event.target.closest(".site-selector-dropdown") &&
          !event.target.closest(".site-selector-button")
        ) {
          setShowSiteSelector(null);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showSiteSelector]);

  // 공사현장이나 월이 변경될 때 상태 초기화 및 UI 갱신
  useEffect(() => {
    if (selectedWorker) {
      useWorkTimeStore.setState((state) => ({
        ...state,
        selectedWorker: null,
      }));
    }
    setSearchTerm("");

    if (selectedSite) {
      fetchWorkers(selectedSite);
    }
  }, [selectedSite, yearMonth, fetchWorkers]);

  // 모달이 열릴 때 실행
  useEffect(() => {
    if (showWorkerAssignModal && selectedSite) {
      fetchUnassignedWorkers();
    }
  }, [showWorkerAssignModal, selectedSite]);

  // 페이지 이탈 시 자동 저장 처리
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && isDirty && autoSaveEnabled) {
        if (selectedWorker && selectedSite && yearMonth && workReportData) {
          try {
            const cacheKey = `workrecord_${selectedWorker}_${selectedSite}_${yearMonth}`;
            localStorage.setItem(cacheKey, JSON.stringify(workReportData.workDetails));
            localStorage.setItem(`${cacheKey}_isDirty`, "true");
          } catch (error) {
            console.error("로컬 스토리지 저장 오류:", error);
          }
          saveWorkRecords(selectedWorker, selectedSite, yearMonth, workReportData.workDetails).then(
            (result) => {
              if (result.success) {
                const cacheKey = `workrecord_${selectedWorker}_${selectedSite}_${yearMonth}`;
                const now = Date.now();
                localStorage.setItem(`${cacheKey}_lastSaved`, now.toString());
                localStorage.setItem(`${cacheKey}_isDirty`, "false");
              }
            }
          );
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [
    isDirty,
    selectedWorker,
    selectedSite,
    yearMonth,
    workReportData,
    autoSaveEnabled,
    saveWorkRecords,
  ]);

  // 로컬 스토리지에서 마지막 저장 상태 복원
  useEffect(() => {
    if (selectedWorker && selectedSite && yearMonth) {
      try {
        const cacheKey = `workrecord_${selectedWorker}_${selectedSite}_${yearMonth}`;
        const lastSaved = localStorage.getItem(`${cacheKey}_lastSaved`);
        const wasDirty = localStorage.getItem(`${cacheKey}_isDirty`) === "true";

        if (lastSaved) {
          setLastSavedTime(new Date(parseInt(lastSaved)));
        } else {
          setLastSavedTime(null);
        }

        if (wasDirty) {
          setIsDirty(true);
        } else {
          setIsDirty(false);
        }
      } catch (error) {
        console.error("저장 상태 복원 오류:", error);
      }
    }
  }, [selectedWorker, selectedSite, yearMonth]);

  // 메모이제이션된 보험 요약 렌더링
  const renderInsuranceEligibilitySummary = useCallback(() => {
    if (!insuranceStatus) {
      return (
        <div className="grid grid-cols-4 gap-4 text-base font-normal mb-4">
          <div className="border rounded p-2 bg-gray-50">정보 로딩 중...</div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-4 gap-4 text-base font-normal mb-4">
        {/* 국민연금 */}
        <div className="border rounded p-2 bg-blue-50">
          <span className="font-medium">국민연금:</span>{" "}
          {insuranceStatus.nationalPension?.required ? (
            <span className="text-blue-600 font-bold">가입 대상</span>
          ) : (
            <span className="text-gray-500">조건 미충족</span>
          )}
          <div className="text-xs text-green-600 mt-1">
            {insuranceStatus.nationalPension?.reason || "정보 없음"}
          </div>
        </div>

        {/* 건강보험 */}
        <div className="border rounded p-2 bg-blue-50">
          <span className="font-medium">건강보험:</span>{" "}
          {insuranceStatus.healthInsurance?.required ? (
            <span className="text-blue-600 font-bold">가입 대상</span>
          ) : (
            <span className="text-gray-500">조건 미충족</span>
          )}
          <div className="text-xs text-green-600 mt-1">
            {insuranceStatus.healthInsurance?.reason || "정보 없음"}
          </div>
        </div>

        {/* 산재보험 */}
        <div className="border rounded p-2 bg-blue-50">
          <span className="font-medium">산재보험:</span>{" "}
          {insuranceStatus.industrialAccident?.required ? (
            <span className="text-blue-600 font-bold">가입 대상</span>
          ) : (
            <span className="text-gray-500">해당 없음</span>
          )}
          <div className="text-xs text-green-600 mt-1">
            {insuranceStatus.industrialAccident?.reason || "정보 없음"}
          </div>
        </div>

        {/* 고용보험 */}
        <div className="border rounded p-2 bg-blue-50">
          <span className="font-medium">고용보험:</span>{" "}
          {insuranceStatus.employmentInsurance?.required ? (
            <span className="text-blue-600 font-bold">가입 대상</span>
          ) : (
            <span className="text-gray-500">해당 없음</span>
          )}
          <div className="text-xs text-green-600 mt-1">
            {insuranceStatus.employmentInsurance?.reason || "정보 없음"}
          </div>
        </div>
      </div>
    );
  }, [insuranceStatus]);

  // 핸들러 함수들
  const handleWorkerAddSuccess = useCallback(
    (newWorker) => {
      if (selectedSite) {
        fetchWorkers(selectedSite);
      }
    },
    [selectedSite, fetchWorkers]
  );

  const formatResidentNumber = useCallback((num) => {
    if (!num) return "-";
    return num.replace(/^(\d{6})(\d{7})$/, "$1-$2");
  }, []);

  const formatPhoneNumber = useCallback((num) => {
    if (!num) return "-";
    return num.replace(/^(\d{2,3})(\d{3,4})(\d{4})$/, "$1-$2-$3");
  }, []);

  const handleRegisterWorker = async () => {
    if (!selectedWorker || !selectedSite) {
      toast.error("근로자와 공사현장을 선택해주세요.");
      return;
    }
    const result = await registerWorkerToSite(selectedWorker, selectedSite);
    toast.info(result.message);
  };

  // formatNumber 함수 정의 (paste-2.txt에서 가져옴)
  const formatNumber = useCallback((value) => {
    if (!value) return "";
    const cleaned = value.replace(/,/g, "").replace(/\D/g, "");
    return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }, []);

  // updateWorkDetail 함수 정의 (paste-2.txt에서 가져옴)
  const updateWorkDetailWithSite = useCallback(
    (index, field, value, workerId, siteId, yearMonth) => {
      const cacheKey = `${workerId}-${siteId}-${yearMonth}`;
      const { workReports } = useWorkTimeStore.getState();

      if (!workReports[cacheKey]) {
        console.warn(`캐시 키를 찾을 수 없습니다: ${cacheKey}`);
        return;
      }

      const updatedWorkDetails = [...workReports[cacheKey].workDetails];

      if (
        field === "regular_hours" ||
        field === "overtime_hours" ||
        field === "night_hours" ||
        field === "holiday_hours"
      ) {
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
      } else {
        updatedWorkDetails[index] = {
          ...updatedWorkDetails[index],
          [field]: value,
        };
      }

      useWorkTimeStore.setState((state) => ({
        workReports: {
          ...state.workReports,
          [cacheKey]: {
            ...state.workReports[cacheKey],
            workDetails: updatedWorkDetails,
          },
        },
      }));
    },
    [formatNumber]
  );

  // 🔥 근무 기록 변경 핸들러 - 세분화된 시간 필드 지원
  const handleChange = useCallback(
    (index, field, value) => {
      const dayData = workReportData?.workDetails[index] || {};
      if (dayData.payment_status === "paid") {
        toast.warn("지급완료된 근무기록은 수정할 수 없습니다.");
        return;
      }

      if (!selectedSite || !selectedWorker || !yearMonth) {
        toast.error("현장과 근로자, 년월을 모두 선택해주세요.");
        return;
      }

      // 🔥 세분화된 시간 필드들과 base_wage 처리
      updateWorkDetailWithSite(index, field, value, selectedWorker, selectedSite, yearMonth);
      setIsDirty(true);

      try {
        const cacheKey = `workrecord_${selectedWorker}_${selectedSite}_${yearMonth}`;
        localStorage.setItem(`${cacheKey}_isDirty`, "true");
      } catch (error) {
        console.error("로컬 스토리지 저장 오류:", error);
      }
    },
    [workReportData, selectedSite, selectedWorker, yearMonth, updateWorkDetailWithSite]
  );

  const getCodeName = useCallback(
    (codeType, codeValue) => {
      if (!codeValue) return "-";
      let codeList = [];
      switch (codeType) {
        case "nationality":
          codeList = nationalityCodes;
          break;
        case "residence_status":
          codeList = residenceStatusCodes;
          break;
        case "job":
          codeList = jobCodes;
          break;
        default:
          return codeValue;
      }

      const code = codeList.find((c) => c.code_value === codeValue);
      return code ? code.code_name : codeValue;
    },
    [nationalityCodes, residenceStatusCodes, jobCodes]
  );

  const toggleSiteSelector = useCallback(
    (workerId, event) => {
      event.stopPropagation();
      setShowSiteSelector(showSiteSelector === workerId ? null : workerId);
    },
    [showSiteSelector]
  );

  const handleRemoveWorkerFromSite = async (workerId, event) => {
    event.stopPropagation();
    if (!confirm("정말 이 근로자의 현장 등록을 취소하시겠습니까?")) {
      return;
    }

    try {
      const { data: registrationRecords, error: recordsError } = await supabase
        .from("work_records")
        .select("record_id")
        .eq("worker_id", workerId)
        .eq("site_id", selectedSite)
        .eq("status", "registration");

      if (recordsError) throw recordsError;

      const { data: actualRecords, error: actualError } = await supabase
        .from("work_records")
        .select("record_id")
        .eq("worker_id", workerId)
        .eq("site_id", selectedSite)
        .eq("registration_month", yearMonth)
        .neq("status", "registration");

      if (actualError) throw actualError;

      if (actualRecords && actualRecords.length > 0) {
        setShowSiteSelector(null);
        toast.error("이 근로자는 해당 현장에 실제 근무 기록이 있어 등록을 취소할 수 없습니다.");
        return;
      }

      if (registrationRecords && registrationRecords.length > 0) {
        const recordIds = registrationRecords.map((r) => r.record_id);

        const { error: deleteError } = await supabase
          .from("work_records")
          .delete()
          .in("record_id", recordIds);

        if (deleteError) throw deleteError;

        toast.success("현장 등록이 취소되었습니다.");

        if (selectedSite) {
          await fetchWorkers(selectedSite);
        }
      } else {
        toast.error("현장 등록 정보를 찾을 수 없습니다.");
      }

      setShowSiteSelector(null);
    } catch (error) {
      console.error("현장 등록 취소 오류:", error);
      toast.error("현장 등록 취소 중 오류가 발생했습니다.");
    }
  };

  const changeSite = async (workerId, siteId, siteName, event) => {
    event.stopPropagation();
    try {
      const { data: currentRecords, error: recordsError } = await supabase
        .from("work_records")
        .select("record_id, site_id, status")
        .eq("worker_id", workerId);

      if (recordsError) throw recordsError;

      if (currentRecords.some((record) => record.site_id === parseInt(siteId))) {
        toast.info(`이미 ${siteName} 현장에 배정되어 있습니다.`);
        setShowSiteSelector(null);
        return;
      }

      const hasWorkRecords = currentRecords.some((record) => record.status !== "registration");

      const registrationRecords = currentRecords.filter(
        (record) => record.status === "registration"
      );
      if (registrationRecords.length > 0) {
        const recordIds = registrationRecords.map((r) => r.record_id);

        const { error: deleteError } = await supabase
          .from("work_records")
          .delete()
          .in("record_id", recordIds);

        if (deleteError) throw deleteError;
      }

      const todayDate = new Date().toISOString().split("T")[0];

      const { error: insertError } = await supabase.from("work_records").insert({
        worker_id: workerId,
        site_id: siteId,
        work_date: todayDate,
        work_hours: 0,
        work_type: "registration",
        daily_wage: 0,
        status: "registration",
        registration_month: yearMonth, // 🔥 registration_month 추가
      });

      if (insertError) throw insertError;

      const workerName = workers.find((w) => w.worker_id === workerId)?.name || "근로자";

      if (hasWorkRecords) {
        toast.success(
          `근로시간과 임금이 있는 근로자는 현장이 추가됩니다. ${workerName}님에게 ${siteName} 현장이 추가되었습니다.`
        );
      } else {
        toast.info(`${workerName}님의 현장이 ${siteName}(으)로 변경되었습니다.`);
      }

      if (selectedSite) {
        await fetchWorkers(selectedSite);
      }

      setShowSiteSelector(null);
    } catch (error) {
      console.error("현장 변경 오류:", error);
      toast.error("현장 변경 중 오류가 발생했습니다.");
    }
  };

  // 🔥 수정된 fetchUnassignedWorkers 함수
  const fetchUnassignedWorkers = async () => {
    if (!selectedSite) return;
    try {
      setIsLoading(true);
      console.log("근로자 배정 모달 - 데이터 조회 시작", {
        selectedSite,
        yearMonth,
        userId: user?.id,
      });

      const selectedYearMonth = yearMonth;

      // 1. 사용자의 회사 정보 가져오기
      const { data: userCompany, error: companyError } = await supabase
        .from("user_companies")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (companyError) throw companyError;

      if (!userCompany?.company_id) {
        throw new Error("회사 정보를 찾을 수 없습니다.");
      }

      console.log("사용자 회사 정보:", userCompany);

      // 2. 회사의 모든 현장 가져오기
      const { data: companySites, error: sitesError } = await supabase
        .from("location_sites")
        .select("site_id, site_name")
        .eq("company_id", userCompany.company_id);

      if (sitesError) throw sitesError;

      const companySiteIds = companySites.map((site) => site.site_id);
      console.log("회사 현장 목록:", companySites);

      // 3. 회사의 모든 현장에서 일한 적이 있는 근로자들 조회
      const { data: allWorkRecords, error: recordsError } = await supabase
        .from("work_records")
        .select("worker_id, site_id, registration_month")
        .in("site_id", companySiteIds);

      if (recordsError) throw recordsError;

      const allCompanyWorkerIds = [...new Set(allWorkRecords.map((record) => record.worker_id))];
      console.log("회사 전체 근로자 ID 목록:", allCompanyWorkerIds);

      // 4. 현재 선택된 현장과 월에 등록된 근로자들 조회
      const { data: currentSiteRecords, error: currentSiteError } = await supabase
        .from("work_records")
        .select("worker_id, registration_month")
        .eq("site_id", selectedSite)
        .eq("registration_month", selectedYearMonth);

      if (currentSiteError) throw currentSiteError;

      const currentSiteWorkerIds = new Set(currentSiteRecords.map((record) => record.worker_id));
      console.log("현재 현장에 등록된 근로자 ID:", Array.from(currentSiteWorkerIds));

      // 5. 배정되지 않은 근로자 ID 찾기
      const unassignedWorkerIds = allCompanyWorkerIds.filter((id) => !currentSiteWorkerIds.has(id));
      console.log("배정되지 않은 근로자 ID 목록:", unassignedWorkerIds);

      if (unassignedWorkerIds.length === 0) {
        console.log("배정 가능한 근로자가 없음");
        setUnassignedWorkers([]);
        return;
      }

      // 6. 배정되지 않은 근로자들의 상세 정보 가져오기
      const { data: workerDetails, error: workersError } = await supabase
        .from("workers")
        .select("*")
        .in("worker_id", unassignedWorkerIds)
        .eq("worker_type", "daily") // 🔥 일용직만 필터링
        .order("name");

      if (workersError) throw workersError;

      console.log("배정 가능한 근로자 상세 정보:", workerDetails);
      setUnassignedWorkers(workerDetails || []);
    } catch (error) {
      console.error("배정되지 않은 근로자 조회 오류:", error);
      toast.error(`배정 가능한 근로자 목록을 불러오는 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const assignWorkerToSite = async (workerId, siteId) => {
    if (!workerId || !siteId) return;
    try {
      setIsLoading(true);

      const todayDate = new Date().toISOString().split("T")[0];

      const { error } = await supabase.from("work_records").insert({
        worker_id: workerId,
        site_id: siteId,
        work_date: todayDate,
        work_hours: 0,
        work_type: "registration",
        daily_wage: 0,
        status: "registration",
        registration_month: yearMonth,
      });

      if (error) throw error;

      toast.success("근로자가 현장에 성공적으로 배정되었습니다.");

      setShowWorkerAssignModal(false);

      if (selectedSite) {
        await fetchWorkers(selectedSite);
      }
    } catch (error) {
      console.error("근로자 배정 오류:", error);
      toast.error("근로자 배정 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 🔥 메모이제이션된 총계 계산 - 세분화된 시간 구조로 수정
  const workSummary = useMemo(() => {
    const workDetails =
      workReportData?.workDetails ||
      Array.from({ length: 31 }, () => ({
        regular_hours: "",
        overtime_hours: "",
        night_hours: "",
        holiday_hours: "",
        base_wage: "",
      }));

    // 🔥 세분화된 시간 합계 계산
    const totalRegularHours = workDetails.reduce(
      (sum, day) => sum + Number(day.regular_hours || 0),
      0
    );
    const totalOvertimeHours = workDetails.reduce(
      (sum, day) => sum + Number(day.overtime_hours || 0),
      0
    );
    const totalNightHours = workDetails.reduce((sum, day) => sum + Number(day.night_hours || 0), 0);
    const totalHolidayHours = workDetails.reduce(
      (sum, day) => sum + Number(day.holiday_hours || 0),
      0
    );
    const totalHours = totalRegularHours + totalOvertimeHours + totalNightHours + totalHolidayHours;

    const totalWage = workDetails.reduce(
      (sum, day) => sum + Number((day.base_wage || "").replace(/,/g, "") || 0),
      0
    );

    // 🔥 근무일수는 어떤 시간이라도 입력된 날로 계산
    const totalWorkDays = workDetails.filter(
      (day) =>
        Number(day.regular_hours || 0) > 0 ||
        Number(day.overtime_hours || 0) > 0 ||
        Number(day.night_hours || 0) > 0 ||
        Number(day.holiday_hours || 0) > 0
    ).length;

    // 🔥 각 유형별 근무일수
    const overtimeDays = workDetails.filter((day) => Number(day.overtime_hours || 0) > 0).length;
    const nightDays = workDetails.filter((day) => Number(day.night_hours || 0) > 0).length;
    const holidayDays = workDetails.filter((day) => Number(day.holiday_hours || 0) > 0).length;

    return {
      totalHours,
      totalRegularHours,
      totalOvertimeHours,
      totalNightHours,
      totalHolidayHours,
      totalWage,
      totalWorkDays,
      overtimeDays,
      nightDays,
      holidayDays,
      workDetails,
    };
  }, [workReportData]);

  const handleSaveAndRefresh = async () => {
    setIsLoading(true);
    try {
      const paidItemsCount =
        workReportData?.workDetails?.filter(
          (item) =>
            item.payment_status === "paid" &&
            (item.regular_hours ||
              item.overtime_hours ||
              item.night_hours ||
              item.holiday_hours ||
              item.base_wage)
        ).length || 0;

      const result = await saveWorkRecords(
        selectedWorker,
        selectedSite,
        yearMonth,
        workReportData.workDetails
      );

      if (result.success) {
        setIsDirty(false);
        const now = new Date();
        setLastSavedTime(now);

        const cacheKey = `workrecord_${selectedWorker}_${selectedSite}_${yearMonth}`;
        localStorage.setItem(cacheKey, JSON.stringify(workReportData.workDetails));
        localStorage.setItem(`${cacheKey}_lastSaved`, now.getTime().toString());
        localStorage.setItem(`${cacheKey}_isDirty`, "false");

        let message = result.message;
        if (paidItemsCount > 0 && !message.includes("지급완료")) {
          message = `${result.message} (지급완료된 ${paidItemsCount}건의 기록은 수정되지 않았습니다.)`;
        }

        toast.success(message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("저장 중 오류 발생:", error);
      toast.error("저장 처리 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  const workersList = useMemo(() => {
    if (workers.length === 0) {
      return (
        <div className="text-gray-500 text-center py-4">
          {selectedSite ? "근로자 정보가 없습니다." : "공사현장을 선택해주세요."}
        </div>
      );
    }

    return workers.map((worker) => (
      <div
        key={worker.worker_id}
        className={`p-2 rounded hover:bg-gray-100 cursor-pointer transition-colors flex justify-between items-center ${
          selectedWorker === worker.worker_id ? "bg-blue-100 border-l-4 border-blue-500" : ""
        } ${worker.hasWorkHistory ? "border-l-4 border-green-500" : ""}
      ${worker.isRegistered && !worker.hasWorkHistory ? "border-l-4 border-yellow-500" : ""} ${
          worker.notInSite ? "opacity-60 border-dashed border" : ""
        }`}
        onClick={() => {
          fetchWorkerDetails(worker.worker_id);
        }}
      >
        <div className="w-96 truncate pr-2">{worker.name}</div>
        <div className="relative">
          <button
            className="ml-2 p-1 text-xs bg-gray-100 hover:bg-gray-200 rounded flex items-center text-gray-700 site-selector-button"
            onClick={(e) => toggleSiteSelector(worker.worker_id, e)}
          >
            <Building2 size={14} className="mr-1" />
            <ChevronDown size={14} className="ml-1" />
          </button>

          {showSiteSelector === worker.worker_id && (
            <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg z-10 border border-gray-200 site-selector-dropdown">
              <div className="py-1">
                <div className="border-t mt-1">
                  <button
                    className="pl-6 px-4 py-2 text-xs text-left w-full hover:bg-red-50 text-red-600"
                    onClick={(e) => handleRemoveWorkerFromSite(worker.worker_id, e)}
                  >
                    현장등록취소
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    ));
  }, [
    workers,
    selectedSite,
    selectedWorker,
    fetchWorkerDetails,
    toggleSiteSelector,
    showSiteSelector,
    handleRemoveWorkerFromSite,
  ]);

  return (
    <RoleGuard requiredPermission="VIEW_DAILY_REPORTS">
      <div className="space-y-4">
        {isLoading && (
          <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-white">처리 중...</span>
          </div>
        )}

        <div className="mb-2">
          <h2 className="text-2xl font-bold text-gray-900 mb-1 pl-6">근로내역</h2>

          <div className="bg-white rounded-lg shadow-md print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-4 pl-6">
                {/* 현장 선택 */}
                <div>
                  <label htmlFor="site-select" className="block text-sm font-medium text-gray-700">
                    현장 선택:
                  </label>
                  <select
                    id="site-select"
                    className="mt-1 block w-48 rounded-md border-2 border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    value={selectedSite || ""}
                    onChange={(e) => setSelectedSite(e.target.value)}
                    disabled={isSiteLoading}
                  >
                    <option value="">현장을 선택하세요</option>
                    {sites.map((site) => (
                      <option key={site.site_id} value={site.site_id}>
                        {site.site_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 조회 년월 */}
                <div>
                  <label htmlFor="year-month" className="block text-sm font-medium text-gray-700">
                    조회 년월:
                  </label>
                  <input
                    type="month"
                    id="year-month"
                    className="mt-1 block w-40 rounded-md border border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    value={yearMonth}
                    onChange={(e) => setYearMonth(e.target.value)}
                    max={new Date().toISOString().slice(0, 7)}
                  />
                </div>

                {/* 근로자 배정 버튼 */}
                <div className="pt-6">
                  <button
                    className="px-4 py-2 bg-orange-500 text-white text-sm rounded hover:bg-blue-600 flex items-center"
                    onClick={() => setShowWorkerAssignModal(true)}
                    title="근로자등록은 되어 있으나 현재 현장에 배정되지 않은 근로자 배정"
                  >
                    <UserPlus size={18} className="mr-1 text-sm" />
                    근로자 배정
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-8 gap-4">
          <div className="border rounded p-3 h-[700px] overflow-y-auto">
            <input
              type="text"
              placeholder="근로자 검색"
              className="w-full mb-2 px-2 py-1 border rounded"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <div className="space-y-2">{workersList}</div>
            {selectedSite && (
              <div className="mt-4 border-t pt-4">
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  disabled={isLoading}
                  className="w-full py-2 px-3 bg-blue-500 text-sm text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  신규 근로자 등록
                </button>
              </div>
            )}
          </div>

          <div className="col-span-7 border rounded p-4 space-y-6 overflow-x-auto">
            {isDetailLoading ? (
              <div className="flex items-center justify-center h-48">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                <span className="ml-3">근로자 정보 로딩 중...</span>
              </div>
            ) : selectedWorker && selectedWorkerDetails ? (
              <>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">
                      <span className="text-black">{selectedWorkerDetails.name}</span>{" "}
                      <span className="text-sm text-gray-500">- 근로자 기본정보</span>
                    </h2>
                    <div>
                      <span className="text-xs">
                        지급처리된 근로자의 근무내역수정: 리포트-일용근로자 급여-해당 근무일
                        "수정"버튼 클릭, 다시 지금페이지 돌아와서 수정하면됩니다.
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-gray-300">
                      <tbody>
                        <tr className="bg-gray-50">
                          <th className="p-2 text-left font-medium border-r">
                            주민(외국인)등록번호
                          </th>
                          <th className="p-2 text-left font-medium border-r">국적</th>
                          <th className="p-2 text-left font-medium border-r">체류자격</th>
                          <th className="p-2 text-left font-medium border-r">직종</th>
                          <th className="p-2 text-left font-medium border-r">연락처</th>
                          <th className="p-2 text-left font-medium">유형</th>
                        </tr>
                        <tr>
                          <td className="p-2 border-r">
                            {formatResidentNumber(selectedWorkerDetails.resident_number)}
                          </td>
                          <td className="p-2 border-r">
                            {getCodeName("nationality", selectedWorkerDetails.nationality_code)}
                          </td>
                          <td className="p-2 border-r">
                            {getCodeName(
                              "residence_status",
                              selectedWorkerDetails.residence_status_code
                            ) || "-"}
                          </td>
                          <td className="p-2 border-r">
                            {getCodeName("job", selectedWorkerDetails.job_code) || "-"}
                          </td>
                          <td className="p-2 border-r">
                            {formatPhoneNumber(selectedWorkerDetails.contact_number)}
                          </td>
                          <td className="p-2">
                            {selectedWorkerDetails.worker_type === "daily" ? "일용직" : "상용직"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-8 gap-4">
                  <div className="col-span-1 border p-3 rounded space-y-2 text-sm bg-gray-50">
                    <div className="font-semibold mb-8">📊 통계</div>
                    <div>총 근무일수: {workSummary.totalWorkDays}일</div>
                    <div>총 근무시간: {workSummary.totalHours}시간</div>
                    <div className="text-xs space-y-1 mt-2">
                      <div>일반: {workSummary.totalRegularHours}h</div>
                      <div>연장: {workSummary.totalOvertimeHours}h</div>
                      <div>야간: {workSummary.totalNightHours}h</div>
                      <div>휴일: {workSummary.totalHolidayHours}h</div>
                    </div>
                    <div className="my-4 space-y-1">
                      <div className="border-t-2 border-gray-300" />
                      <div className="border-t-2 border-gray-300" />
                    </div>
                    <div>전월 근무시작일: {prevMonthWorkData?.startDate}</div>
                    <div>전월 근무일수: {prevMonthWorkData?.days || "없음"}</div>
                    <div>전월 근무시간: {prevMonthWorkData?.hours || "없음"}</div>
                  </div>

                  <div className="col-span-7">
                    <CalendarWorkTime
                      yearMonth={yearMonth}
                      workDetails={workSummary.workDetails}
                      isReportLoading={isReportLoading}
                      handleChange={handleChange}
                      formatNumber={formatNumber}
                    />
                  </div>
                </div>

                <div className="border-t pt-4 text-md font-semibold">
                  <div className="flex justify-between mb-4">
                    <div className="flex gap-8">
                      <div>
                        총 근무일수:{" "}
                        <span className="text-blue-600">{workSummary.totalWorkDays}일</span>
                      </div>
                      <div>
                        총 근무시간:{" "}
                        <span className="text-blue-600">{workSummary.totalHours}시간</span>
                      </div>
                      <div>
                        총 임금:{" "}
                        <span className="text-blue-600">
                          {workSummary.totalWage.toLocaleString()}원
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-8 text-sm">
                      <div>
                        연장 근무일수:{" "}
                        <span
                          className={workSummary.overtimeDays > 0 ? "text-red-500 font-medium" : ""}
                        >
                          {workSummary.overtimeDays}일
                        </span>
                      </div>
                      <div>
                        휴일 근무일수:{" "}
                        <span
                          className={workSummary.holidayDays > 0 ? "text-red-500 font-medium" : ""}
                        >
                          {workSummary.holidayDays}일
                        </span>
                      </div>
                      <div>
                        야간 근무일수:{" "}
                        <span
                          className={workSummary.nightDays > 0 ? "text-red-500 font-medium" : ""}
                        >
                          {workSummary.nightDays}일
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 메모이제이션된 보험 요약 사용 */}
                  {renderInsuranceEligibilitySummary()}
                </div>

                {/* 가입 & 상실 요건 박스 */}
                <div className="mt-8 space-y-8 text-sm">
                  <div className="border rounded bg-white p-3 space-y-2">
                    <div className="font-semibold mb-1">✅ 4대보험 가입 요건</div>
                    <div>
                      📌 <strong>국민연금</strong>:
                      <ul className="list-disc list-inside ml-4 space-y-1">
                        <li>
                          <strong>최우선 조건</strong>: 월 소득 220만원 이상 → 즉시 가입 (18세 이상
                          60세 미만)
                        </li>
                        <li>
                          <strong>기본 조건</strong>: 18세 이상 60세 미만 이면서 1.최초 근무일부터
                          1개월 경과(마지막 근무일 기준) + 누적 8일 이상, 2. 또는 근무일부터 1개월
                          경과(마지막 근무일 기준)+ 누적 60시간 이상
                        </li>
                        <li>
                          <strong>취득일</strong>: 가입 조건 충족일 (통상 최초 근무일)
                        </li>
                      </ul>
                    </div>
                    <div>
                      📌 <strong>건강보험</strong>:
                      <ul className="list-disc list-inside ml-4 space-y-1">
                        <li>
                          연령 제한 없음 + 최초 근무일부터 1개월 경과(마지막 근무일 기준) + 누적
                          60시간 이상
                        </li>
                        <li>
                          <strong>취득일</strong>: 최초 근무일부터 1개월간 조건 충족 시 → 최초
                          근무일
                        </li>
                      </ul>
                    </div>
                    <div>
                      📌 <strong>산재보험</strong>: 1일만 일해도 무조건 가입 →{" "}
                      <strong>취득일: 근무 시작일</strong>
                    </div>
                    <div>
                      📌 <strong>고용보험</strong>:
                      <ul className="list-disc list-inside ml-4 space-y-1">
                        <li>일용직도 1일 근무 시 가입 대상</li>
                        <li>65세 이상은 실업급여 제외, 고용안정·직업능력개발사업만 적용</li>
                        <li>
                          외국인 중 F-2(거주체류자격), F-5(영주체류자격), F-6(결혼이민체류자격)는
                          당연 적용
                        </li>
                        <li>
                          E-9(비전문취업체류자격), H-2(방문취업체류자격)는 실업급여는 임의가입,
                          고용안정/직업능력개발은 당연 적용
                        </li>
                        <li>F-4(재외동포체류자격)은 임의가입</li>
                      </ul>
                    </div>
                  </div>

                  <div className="border rounded bg-white p-3 space-y-2">
                    <div className="font-semibold mb-1">⛔ 4대보험 상실 기준</div>
                    <div>
                      📌 <strong>국민연금</strong>:
                      <ul className="list-disc list-inside ml-4 space-y-1">
                        <li>가입 조건을 충족하지 않게 된 시점의 다음날</li>
                        <li>근로 종료 시 → 최종 근로일의 다음날</li>
                        <li>
                          누적 8일 미만 및 60시간 미만 근무 시 → 해당 조건 미충족 시점의 다음날
                        </li>
                      </ul>
                    </div>
                    <div>
                      📌 <strong>건강보험</strong>:
                      <ul className="list-disc list-inside ml-4 space-y-1">
                        <li>취득일이 1일인 경우: 취득월과 연속하여 다음달 근로 여부에 따라 결정</li>
                        <li>연속 근로 시 누적 60시간 이상 → 최종 근로일의 다음날</li>
                        <li>60시간 미만 근로월 발생 시 → 해당 월의 1일</li>
                      </ul>
                    </div>
                    <div>
                      📌 <strong>산재보험</strong>: 근무 종료 →{" "}
                      <strong>상실일: 마지막 근무일의 다음날</strong>
                    </div>
                    <div>
                      📌 <strong>고용보험</strong>: 근무 종료 →{" "}
                      <strong>상실일: 마지막 근무일의 다음날</strong>
                    </div>
                  </div>
                </div>
              </>
            ) : selectedWorker && !selectedWorkerDetails ? (
              <div className="flex items-center justify-center h-96 text-orange-500">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500 mx-auto mb-4"></div>
                  <div>근로자 정보를 불러오는 중입니다...</div>
                  <div className="text-sm text-gray-500 mt-2">
                    선택된 근로자 ID: {selectedWorker}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-96 text-gray-500">
                <div className="text-center">
                  <div className="text-lg mb-2">
                    {selectedSite
                      ? "좌측에서 근로자를 선택해주세요."
                      : "공사현장을 먼저 선택해주세요."}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 근로자 등록 모달 */}
        <WorkerAddModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          siteId={selectedSite}
          selectedYearMonth={yearMonth}
          onSuccess={handleWorkerAddSuccess}
        />

        {/* 배정되지 않은 근로자 배정 모달 */}
        {showWorkerAssignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg p-6 w-96 max-w-lg max-h-[80vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">근로자 배정</h2>
                <button
                  className="text-gray-500 hover:text-gray-700"
                  onClick={() => setShowWorkerAssignModal(false)}
                >
                  <X size={20} />
                </button>
              </div>

              {!selectedSite ? (
                <div className="py-6 text-center">
                  <div className="text-red-500 font-medium mb-4">공사현장을 선택해주세요</div>
                  <button
                    className="px-4 py-2 bg-gray-200 rounded text-gray-700 hover:bg-gray-300"
                    onClick={() => setShowWorkerAssignModal(false)}
                  >
                    닫기
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-500 mb-4">
                    현재 현장({sites.find((s) => s.site_id == selectedSite)?.site_name})에{" "}
                    {yearMonth}월에 배정되지 않은 근로자 목록입니다.
                  </p>

                  <div className="mb-4">
                    <input
                      type="text"
                      placeholder="근로자 검색..."
                      className="w-full px-3 py-2 border rounded"
                      value={workerSearchTerm}
                      onChange={(e) => setWorkerSearchTerm(e.target.value)}
                    />
                  </div>

                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                      <span className="ml-3">로딩 중...</span>
                    </div>
                  ) : unassignedWorkers.length === 0 ? (
                    <p className="text-center py-4 text-gray-500">
                      배정 가능한 근로자가 없습니다.
                      <br />
                      <span className="text-xs text-gray-400">
                        (현재 현장에 이미 배정된 근로자들은 제외됩니다)
                      </span>
                    </p>
                  ) : (
                    <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
                      {unassignedWorkers
                        .filter((worker) =>
                          worker.name.toLowerCase().includes(workerSearchTerm.toLowerCase())
                        )
                        .map((worker) => (
                          <div
                            key={worker.worker_id}
                            className="flex items-center justify-between p-2 border rounded hover:bg-gray-50"
                          >
                            <div>
                              <div className="font-medium">{worker.name}</div>
                              <div className="text-xs text-gray-500">
                                {formatResidentNumber(worker.resident_number)}
                              </div>
                              <div className="text-xs text-blue-500">
                                {getCodeName("job", worker.job_code) || "직종 미지정"}
                              </div>
                            </div>
                            <button
                              className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                              onClick={() => assignWorkerToSite(worker.worker_id, selectedSite)}
                              disabled={isLoading}
                            >
                              배정
                            </button>
                          </div>
                        ))}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      className="px-4 py-2 bg-gray-200 rounded text-gray-700 hover:bg-gray-300"
                      onClick={() => setShowWorkerAssignModal(false)}
                    >
                      닫기
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Floating Save Button */}
        {selectedWorker && selectedWorkerDetails && (
          <div className="fixed bottom-6 right-6 z-50">
            <button
              className={`flex items-center justify-center rounded-full w-16 h-16 shadow-xl ${
                isDirty
                  ? "bg-gradient-to-br from-red-400 to-red-600 hover:from-red-500 hover:to-red-700"
                  : "bg-gradient-to-br from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700"
              } text-white transform transition-all duration-300 hover:scale-110 hover:shadow-2xl ${
                isLoading || isReportLoading ? "opacity-80" : ""
              }`}
              onClick={handleSaveAndRefresh}
              disabled={isLoading || isReportLoading}
              title={isDirty ? "변경사항 저장" : "저장됨"}
            >
              {isLoading || isReportLoading ? (
                <div className="animate-spin h-7 w-7 border-3 border-white border-t-transparent rounded-full"></div>
              ) : (
                <Save size={28} strokeWidth={1.5} />
              )}
            </button>

            <div
              className={`absolute -top-12 right-0 whitespace-nowrap rounded-lg px-4 py-2 text-white text-sm font-semibold shadow-md ${
                isDirty
                  ? "bg-gradient-to-r from-red-500 to-red-600"
                  : "bg-gradient-to-r from-blue-500 to-blue-600"
              } transition-opacity duration-200 ${
                isLoading || isReportLoading ? "opacity-90" : ""
              }`}
            >
              {isLoading || isReportLoading ? "저장 중..." : isDirty ? "변경사항 저장" : "저장됨"}
              <div
                className={`absolute h-3 w-3 rotate-45 ${
                  isDirty ? "bg-red-600" : "bg-blue-600"
                } bottom-[-6px] right-6`}
              ></div>
            </div>
          </div>
        )}

        <ToastContainer position="top-center" />
      </div>
    </RoleGuard>
  );
}

export default WorkTimePage;

/***
 *
 *
 *
 */

// //file: app\dashboard\work_time\page.js

// "use client";
// import React, { useState, useEffect, useMemo, useCallback } from "react";
// import { useAuthStore } from "@/lib/store/authStore";
// import useSiteStore from "@/lib/store/siteStore";
// import useWorkTimeStore from "@/lib/store/workTimeStore";
// import useInsuranceStatusStore from "@/lib/store/insuranceStatusStore";
// import RoleGuard from "@/components/RoleGuard";
// import useCodeStore from "@/lib/store/codeStore";
// import { useShallow } from "zustand/react/shallow";
// import WorkerAddModal from "./components/WorkerAddModal";
// import CalendarWorkTime from "./components/CalendarWorkTime";
// import {
//   Building2,
//   ChevronDown,
//   RefreshCw,
//   Check,
//   UserPlus,
//   X,
//   Save,
//   AlertTriangle,
// } from "lucide-react";
// import { supabase } from "@/lib/supabase";
// import { ToastContainer, toast } from "react-toastify";
// import "react-toastify/dist/ReactToastify.css";

// // 보험 상태 전용 훅
// const useWorkerInsuranceStatus = (workerId, siteId, yearMonth) => {
//   const { loadInsuranceStatus, getEffectiveStatus } = useInsuranceStatusStore();

//   useEffect(() => {
//     if (workerId && siteId && yearMonth) {
//       loadInsuranceStatus(workerId, siteId, yearMonth);
//     }
//   }, [workerId, siteId, yearMonth, loadInsuranceStatus]);

//   return useMemo(
//     () => ({
//       nationalPension: getEffectiveStatus(workerId, siteId, yearMonth, "national_pension"),
//       healthInsurance: getEffectiveStatus(workerId, siteId, yearMonth, "health_insurance"),
//       employmentInsurance: getEffectiveStatus(workerId, siteId, yearMonth, "employment_insurance"),
//       industrialAccident: getEffectiveStatus(workerId, siteId, yearMonth, "industrial_accident"),
//     }),
//     [workerId, siteId, yearMonth, getEffectiveStatus]
//   );
// };

// function WorkTimePage() {
//   const { user } = useAuthStore();
//   const { getCodeList } = useCodeStore();

//   // siteStore에서 현장 관련 상태 가져오기
//   const { sites, userRole, initialize: initializeSiteStore, isSiteLoading } = useSiteStore();

//   // workTimeStore에서 근무시간 관리 기능만 가져오기
//   const {
//     workers,
//     selectedWorker,
//     yearMonth,
//     workerDetails,
//     workReports,
//     isDetailLoading,
//     isReportLoading,
//     isLoading: isWorkTimeLoading,
//     isWorkerLoading,
//     fetchWorkers,
//     fetchWorkerDetails,
//     setYearMonth,
//     registerWorkerToSite,
//     saveWorkRecords,
//   } = useWorkTimeStore();

//   const [searchTerm, setSearchTerm] = useState("");
//   const [isAddModalOpen, setIsAddModalOpen] = useState(false);
//   const [showSiteSelector, setShowSiteSelector] = useState(null);
//   const [selectedSite, setSelectedSite] = useState(null);

//   // 코드 데이터 저장용 상태
//   const [nationalityCodes, setNationalityCodes] = useState([]);
//   const [residenceStatusCodes, setResidenceStatusCodes] = useState([]);
//   const [jobCodes, setJobCodes] = useState([]);
//   const [unassignedWorkers, setUnassignedWorkers] = useState([]);
//   const [showWorkerAssignModal, setShowWorkerAssignModal] = useState(false);
//   const [workerSearchTerm, setWorkerSearchTerm] = useState("");
//   const [isLoading, setIsLoading] = useState(false);

//   // 저장 상태 추적
//   const [isDirty, setIsDirty] = useState(false);
//   const [lastSavedTime, setLastSavedTime] = useState(null);
//   const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);

//   // 최적화된 선택자들
//   const selectedWorkerDetails = useWorkTimeStore(
//     useShallow((state) => state.workerDetails[state.selectedWorker] || null)
//   );

//   const workReportData = useWorkTimeStore(
//     useShallow((state) => {
//       if (!state.selectedWorker || !selectedSite || !state.yearMonth) return null;
//       const cacheKey = `${state.selectedWorker}-${selectedSite}-${state.yearMonth}`;
//       return state.workReports[cacheKey] || null;
//     })
//   );

//   const prevMonthWorkData = useWorkTimeStore(
//     useShallow((state) => {
//       if (!state.selectedWorker || !selectedSite || !state.yearMonth) return null;
//       const currentDate = new Date(`${state.yearMonth}-01`);
//       const prevMonth = new Date(currentDate);
//       prevMonth.setMonth(currentDate.getMonth() - 1);
//       const prevYearMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(
//         2,
//         "0"
//       )}`;
//       const cacheKey = `${state.selectedWorker}-${selectedSite}-${prevYearMonth}`;
//       return state.prevMonthWork[cacheKey] || { days: 0, hours: 0, startDate: "없음" };
//     })
//   );

//   // 보험 상태 전용 훅 사용
//   const insuranceStatus = useWorkerInsuranceStatus(selectedWorker, selectedSite, yearMonth);

//   // 초기화 및 기본 useEffect들
//   useEffect(() => {
//     setSelectedSite(null);
//     return () => {
//       useWorkTimeStore.getState().resetStore();
//     };
//   }, []);

//   useEffect(() => {
//     if (user) {
//       initializeSiteStore(user.id);
//     }
//   }, [user, initializeSiteStore]);

//   // 코드 데이터 로드
//   useEffect(() => {
//     async function loadCodeData() {
//       try {
//         const nationalities = await getCodeList("NATIONALITY");
//         setNationalityCodes(nationalities || []);

//         const residenceStatuses = await getCodeList("COMMON_RESIDENCE_STATUS");
//         setResidenceStatusCodes(residenceStatuses || []);

//         const jobs = await getCodeList("JOB_CODE");
//         setJobCodes(jobs || []);
//       } catch (error) {
//         console.error("코드 데이터 로드 오류:", error);
//       }
//     }

//     loadCodeData();
//   }, [getCodeList]);

//   // 사이트 변경 시 검색어 초기화 및 근로자 목록 갱신
//   useEffect(() => {
//     setSearchTerm("");
//     if (selectedSite) {
//       fetchWorkers(selectedSite);
//     }
//   }, [selectedSite, fetchWorkers]);

//   // 검색어 변경 시 근로자 목록 필터링
//   useEffect(() => {
//     if (selectedSite) {
//       const debouncedFetch = setTimeout(() => {
//         fetchWorkers(selectedSite, searchTerm);
//       }, 300);
//       return () => clearTimeout(debouncedFetch);
//     }
//   }, [searchTerm, selectedSite, fetchWorkers]);

//   // 근로자 선택 시 근무 기록 로드
//   useEffect(() => {
//     if (selectedWorker && selectedSite && yearMonth) {
//       useWorkTimeStore.getState().fetchWorkReports(selectedWorker, selectedSite, yearMonth);
//     }
//   }, [selectedWorker, selectedSite, yearMonth]);

//   // 드롭다운 외부 클릭 시 닫기
//   useEffect(() => {
//     if (showSiteSelector !== null) {
//       const handleClickOutside = (event) => {
//         if (
//           !event.target.closest(".site-selector-dropdown") &&
//           !event.target.closest(".site-selector-button")
//         ) {
//           setShowSiteSelector(null);
//         }
//       };
//       document.addEventListener("mousedown", handleClickOutside);
//       return () => {
//         document.removeEventListener("mousedown", handleClickOutside);
//       };
//     }
//   }, [showSiteSelector]);

//   // 공사현장이나 월이 변경될 때 상태 초기화 및 UI 갱신
//   useEffect(() => {
//     if (selectedWorker) {
//       useWorkTimeStore.setState((state) => ({
//         ...state,
//         selectedWorker: null,
//       }));
//     }
//     setSearchTerm("");

//     if (selectedSite) {
//       fetchWorkers(selectedSite);
//     }
//   }, [selectedSite, yearMonth, fetchWorkers]);

//   // 모달이 열릴 때 실행
//   useEffect(() => {
//     if (showWorkerAssignModal && selectedSite) {
//       fetchUnassignedWorkers();
//     }
//   }, [showWorkerAssignModal, selectedSite]);

//   // 페이지 이탈 시 자동 저장 처리
//   useEffect(() => {
//     const handleVisibilityChange = () => {
//       if (document.visibilityState === "hidden" && isDirty && autoSaveEnabled) {
//         if (selectedWorker && selectedSite && yearMonth && workReportData) {
//           try {
//             const cacheKey = `workrecord_${selectedWorker}_${selectedSite}_${yearMonth}`;
//             localStorage.setItem(cacheKey, JSON.stringify(workReportData.workDetails));
//             localStorage.setItem(`${cacheKey}_isDirty`, "true");
//           } catch (error) {
//             console.error("로컬 스토리지 저장 오류:", error);
//           }
//           saveWorkRecords(selectedWorker, selectedSite, yearMonth, workReportData.workDetails).then(
//             (result) => {
//               if (result.success) {
//                 const cacheKey = `workrecord_${selectedWorker}_${selectedSite}_${yearMonth}`;
//                 const now = Date.now();
//                 localStorage.setItem(`${cacheKey}_lastSaved`, now.toString());
//                 localStorage.setItem(`${cacheKey}_isDirty`, "false");
//               }
//             }
//           );
//         }
//       }
//     };

//     document.addEventListener("visibilitychange", handleVisibilityChange);
//     return () => {
//       document.removeEventListener("visibilitychange", handleVisibilityChange);
//     };
//   }, [
//     isDirty,
//     selectedWorker,
//     selectedSite,
//     yearMonth,
//     workReportData,
//     autoSaveEnabled,
//     saveWorkRecords,
//   ]);

//   // 로컬 스토리지에서 마지막 저장 상태 복원
//   useEffect(() => {
//     if (selectedWorker && selectedSite && yearMonth) {
//       try {
//         const cacheKey = `workrecord_${selectedWorker}_${selectedSite}_${yearMonth}`;
//         const lastSaved = localStorage.getItem(`${cacheKey}_lastSaved`);
//         const wasDirty = localStorage.getItem(`${cacheKey}_isDirty`) === "true";

//         if (lastSaved) {
//           setLastSavedTime(new Date(parseInt(lastSaved)));
//         } else {
//           setLastSavedTime(null);
//         }

//         if (wasDirty) {
//           setIsDirty(true);
//         } else {
//           setIsDirty(false);
//         }
//       } catch (error) {
//         console.error("저장 상태 복원 오류:", error);
//       }
//     }
//   }, [selectedWorker, selectedSite, yearMonth]);

//   // 메모이제이션된 보험 요약 렌더링
//   const renderInsuranceEligibilitySummary = useCallback(() => {
//     if (!insuranceStatus) {
//       return (
//         <div className="grid grid-cols-4 gap-4 text-base font-normal mb-4">
//           <div className="border rounded p-2 bg-gray-50">정보 로딩 중...</div>
//         </div>
//       );
//     }

//     return (
//       <div className="grid grid-cols-4 gap-4 text-base font-normal mb-4">
//         {/* 국민연금 */}
//         <div className="border rounded p-2 bg-blue-50">
//           <span className="font-medium">국민연금:</span>{" "}
//           {insuranceStatus.nationalPension?.required ? (
//             <span className="text-blue-600 font-bold">가입 대상</span>
//           ) : (
//             <span className="text-gray-500">조건 미충족</span>
//           )}
//           <div className="text-xs text-green-600 mt-1">
//             {insuranceStatus.nationalPension?.reason || "정보 없음"}
//           </div>
//         </div>

//         {/* 건강보험 */}
//         <div className="border rounded p-2 bg-blue-50">
//           <span className="font-medium">건강보험:</span>{" "}
//           {insuranceStatus.healthInsurance?.required ? (
//             <span className="text-blue-600 font-bold">가입 대상</span>
//           ) : (
//             <span className="text-gray-500">조건 미충족</span>
//           )}
//           <div className="text-xs text-green-600 mt-1">
//             {insuranceStatus.healthInsurance?.reason || "정보 없음"}
//           </div>
//         </div>

//         {/* 산재보험 */}
//         <div className="border rounded p-2 bg-blue-50">
//           <span className="font-medium">산재보험:</span>{" "}
//           {insuranceStatus.industrialAccident?.required ? (
//             <span className="text-blue-600 font-bold">가입 대상</span>
//           ) : (
//             <span className="text-gray-500">해당 없음</span>
//           )}
//           <div className="text-xs text-green-600 mt-1">
//             {insuranceStatus.industrialAccident?.reason || "정보 없음"}
//           </div>
//         </div>

//         {/* 고용보험 */}
//         <div className="border rounded p-2 bg-blue-50">
//           <span className="font-medium">고용보험:</span>{" "}
//           {insuranceStatus.employmentInsurance?.required ? (
//             <span className="text-blue-600 font-bold">가입 대상</span>
//           ) : (
//             <span className="text-gray-500">해당 없음</span>
//           )}
//           <div className="text-xs text-green-600 mt-1">
//             {insuranceStatus.employmentInsurance?.reason || "정보 없음"}
//           </div>
//         </div>
//       </div>
//     );
//   }, [insuranceStatus]);

//   // 핸들러 함수들
//   const handleWorkerAddSuccess = useCallback(
//     (newWorker) => {
//       if (selectedSite) {
//         fetchWorkers(selectedSite);
//       }
//     },
//     [selectedSite, fetchWorkers]
//   );

//   const formatResidentNumber = useCallback((num) => {
//     if (!num) return "-";
//     return num.replace(/^(\d{6})(\d{7})$/, "$1-$2");
//   }, []);

//   const formatPhoneNumber = useCallback((num) => {
//     if (!num) return "-";
//     return num.replace(/^(\d{2,3})(\d{3,4})(\d{4})$/, "$1-$2-$3");
//   }, []);

//   const handleRegisterWorker = async () => {
//     if (!selectedWorker || !selectedSite) {
//       toast.error("근로자와 공사현장을 선택해주세요.");
//       return;
//     }
//     const result = await registerWorkerToSite(selectedWorker, selectedSite);
//     toast.info(result.message);
//   };

//   // 근무 기록 변경 핸들러
//   const handleChange = useCallback(
//     (index, field, value) => {
//       const dayData = workReportData?.workDetails[index] || {};
//       if (dayData.payment_status === "paid") {
//         toast.warn("지급완료된 근무기록은 수정할 수 없습니다.");
//         return;
//       }

//       if (!selectedSite || !selectedWorker || !yearMonth) {
//         toast.error("현장과 근로자, 년월을 모두 선택해주세요.");
//         return;
//       }

//       updateWorkDetailWithSite(index, field, value, selectedWorker, selectedSite, yearMonth);
//       setIsDirty(true);

//       try {
//         const cacheKey = `workrecord_${selectedWorker}_${selectedSite}_${yearMonth}`;
//         localStorage.setItem(`${cacheKey}_isDirty`, "true");
//       } catch (error) {
//         console.error("로컬 스토리지 저장 오류:", error);
//       }
//     },
//     [workReportData, selectedSite, selectedWorker, yearMonth]
//   );

//   // updateWorkDetail 함수
//   const updateWorkDetailWithSite = useCallback(
//     (index, field, value, workerId, siteId, yearMonth) => {
//       const cacheKey = `${workerId}-${siteId}-${yearMonth}`;
//       const { workReports } = useWorkTimeStore.getState();

//       if (!workReports[cacheKey]) {
//         console.warn(`캐시 키를 찾을 수 없습니다: ${cacheKey}`);
//         return;
//       }

//       const updatedWorkDetails = [...workReports[cacheKey].workDetails];

//       if (field === "hours") {
//         const numericValue = value.replace(/[^0-9.]/g, "");
//         updatedWorkDetails[index] = {
//           ...updatedWorkDetails[index],
//           hours: numericValue,
//         };
//       } else if (field === "wage") {
//         const numericValue = value.replace(/[^0-9]/g, "");
//         updatedWorkDetails[index] = {
//           ...updatedWorkDetails[index],
//           wage: formatNumber(numericValue),
//         };
//       } else {
//         updatedWorkDetails[index] = {
//           ...updatedWorkDetails[index],
//           [field]: value,
//         };
//       }

//       useWorkTimeStore.setState((state) => ({
//         workReports: {
//           ...state.workReports,
//           [cacheKey]: {
//             ...state.workReports[cacheKey],
//             workDetails: updatedWorkDetails,
//           },
//         },
//       }));
//     },
//     []
//   );

//   const getCodeName = useCallback(
//     (codeType, codeValue) => {
//       if (!codeValue) return "-";
//       let codeList = [];
//       switch (codeType) {
//         case "nationality":
//           codeList = nationalityCodes;
//           break;
//         case "residence_status":
//           codeList = residenceStatusCodes;
//           break;
//         case "job":
//           codeList = jobCodes;
//           break;
//         default:
//           return codeValue;
//       }

//       const code = codeList.find((c) => c.code_value === codeValue);
//       return code ? code.code_name : codeValue;
//     },
//     [nationalityCodes, residenceStatusCodes, jobCodes]
//   );

//   const formatNumber = useCallback((value) => {
//     if (!value) return "";
//     const cleaned = value.replace(/,/g, "").replace(/\D/g, "");
//     return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
//   }, []);

//   const toggleSiteSelector = useCallback(
//     (workerId, event) => {
//       event.stopPropagation();
//       setShowSiteSelector(showSiteSelector === workerId ? null : workerId);
//     },
//     [showSiteSelector]
//   );

//   const handleRemoveWorkerFromSite = async (workerId, event) => {
//     event.stopPropagation();
//     if (!confirm("정말 이 근로자의 현장 등록을 취소하시겠습니까?")) {
//       return;
//     }

//     try {
//       const { data: registrationRecords, error: recordsError } = await supabase
//         .from("work_records")
//         .select("record_id")
//         .eq("worker_id", workerId)
//         .eq("site_id", selectedSite)
//         .eq("status", "registration");

//       if (recordsError) throw recordsError;

//       const { data: actualRecords, error: actualError } = await supabase
//         .from("work_records")
//         .select("record_id")
//         .eq("worker_id", workerId)
//         .eq("site_id", selectedSite)
//         .eq("registration_month", yearMonth)
//         .neq("status", "registration");

//       if (actualError) throw actualError;

//       if (actualRecords && actualRecords.length > 0) {
//         setShowSiteSelector(null);
//         toast.error("이 근로자는 해당 현장에 실제 근무 기록이 있어 등록을 취소할 수 없습니다.");
//         return;
//       }

//       if (registrationRecords && registrationRecords.length > 0) {
//         const recordIds = registrationRecords.map((r) => r.record_id);

//         const { error: deleteError } = await supabase
//           .from("work_records")
//           .delete()
//           .in("record_id", recordIds);

//         if (deleteError) throw deleteError;

//         toast.success("현장 등록이 취소되었습니다.");

//         if (selectedSite) {
//           await fetchWorkers(selectedSite);
//         }
//       } else {
//         toast.error("현장 등록 정보를 찾을 수 없습니다.");
//       }

//       setShowSiteSelector(null);
//     } catch (error) {
//       console.error("현장 등록 취소 오류:", error);
//       toast.error("현장 등록 취소 중 오류가 발생했습니다.");
//     }
//   };

//   const changeSite = async (workerId, siteId, siteName, event) => {
//     event.stopPropagation();
//     try {
//       const { data: currentRecords, error: recordsError } = await supabase
//         .from("work_records")
//         .select("record_id, site_id, status")
//         .eq("worker_id", workerId);

//       if (recordsError) throw recordsError;

//       if (currentRecords.some((record) => record.site_id === parseInt(siteId))) {
//         toast.info(`이미 ${siteName} 현장에 배정되어 있습니다.`);
//         setShowSiteSelector(null);
//         return;
//       }

//       const hasWorkRecords = currentRecords.some((record) => record.status !== "registration");

//       const registrationRecords = currentRecords.filter(
//         (record) => record.status === "registration"
//       );
//       if (registrationRecords.length > 0) {
//         const recordIds = registrationRecords.map((r) => r.record_id);

//         const { error: deleteError } = await supabase
//           .from("work_records")
//           .delete()
//           .in("record_id", recordIds);

//         if (deleteError) throw deleteError;
//       }

//       const todayDate = new Date().toISOString().split("T")[0];

//       const { error: insertError } = await supabase.from("work_records").insert({
//         worker_id: workerId,
//         site_id: siteId,
//         work_date: todayDate,
//         work_hours: 0,
//         work_type: "registration",
//         daily_wage: 0,
//         status: "registration",
//       });

//       if (insertError) throw insertError;

//       const workerName = workers.find((w) => w.worker_id === workerId)?.name || "근로자";

//       if (hasWorkRecords) {
//         toast.success(
//           `근로시간과 임금이 있는 근로자는 현장이 추가됩니다. ${workerName}님에게 ${siteName} 현장이 추가되었습니다.`
//         );
//       } else {
//         toast.info(`${workerName}님의 현장이 ${siteName}(으)로 변경되었습니다.`);
//       }

//       if (selectedSite) {
//         await fetchWorkers(selectedSite);
//       }

//       setShowSiteSelector(null);
//     } catch (error) {
//       console.error("현장 변경 오류:", error);
//       toast.error("현장 변경 중 오류가 발생했습니다.");
//     }
//   };

//   const fetchUnassignedWorkers = async () => {
//     if (!selectedSite) return;
//     try {
//       setIsLoading(true);

//       const selectedYearMonth = yearMonth;

//       const { data: userCompany, error: companyError } = await supabase
//         .from("user_companies")
//         .select("company_id")
//         .eq("user_id", user.id)
//         .maybeSingle();

//       if (companyError) throw companyError;

//       if (!userCompany?.company_id) {
//         throw new Error("회사 정보를 찾을 수 없습니다.");
//       }

//       const { data: companySites, error: sitesError } = await supabase
//         .from("location_sites")
//         .select("site_id")
//         .eq("company_id", userCompany.company_id);

//       if (sitesError) throw sitesError;

//       const companySiteIds = companySites.map((site) => site.site_id);

//       const { data: allWorkRecords, error: recordsError } = await supabase
//         .from("work_records")
//         .select("worker_id, site_id")
//         .in("site_id", companySiteIds);

//       if (recordsError) throw recordsError;

//       const allCompanyWorkerIds = [...new Set(allWorkRecords.map((record) => record.worker_id))];

//       const { data: currentSiteRecords, error: currentSiteError } = await supabase
//         .from("work_records")
//         .select("worker_id")
//         .eq("site_id", selectedSite)
//         .eq("registration_month", selectedYearMonth);

//       if (currentSiteError) throw currentSiteError;

//       const currentSiteWorkerIds = new Set(currentSiteRecords.map((record) => record.worker_id));

//       const unassignedWorkerIds = allCompanyWorkerIds.filter((id) => !currentSiteWorkerIds.has(id));

//       if (unassignedWorkerIds.length === 0) {
//         setUnassignedWorkers([]);
//         return;
//       }

//       const { data: workerDetails, error: workersError } = await supabase
//         .from("workers")
//         .select("*")
//         .in("worker_id", unassignedWorkerIds)
//         .order("name");

//       if (workersError) throw workersError;

//       setUnassignedWorkers(workerDetails || []);
//     } catch (error) {
//       console.error("배정되지 않은 근로자 조회 오류:", error);
//       toast.error("배정 가능한 근로자 목록을 불러오는 중 오류가 발생했습니다.");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const assignWorkerToSite = async (workerId, siteId) => {
//     if (!workerId || !siteId) return;
//     try {
//       setIsLoading(true);

//       const todayDate = new Date().toISOString().split("T")[0];

//       const { error } = await supabase.from("work_records").insert({
//         worker_id: workerId,
//         site_id: siteId,
//         work_date: todayDate,
//         work_hours: 0,
//         work_type: "registration",
//         daily_wage: 0,
//         status: "registration",
//         registration_month: yearMonth,
//       });

//       if (error) throw error;

//       toast.success("근로자가 현장에 성공적으로 배정되었습니다.");

//       setShowWorkerAssignModal(false);

//       if (selectedSite) {
//         await fetchWorkers(selectedSite);
//       }
//     } catch (error) {
//       console.error("근로자 배정 오류:", error);
//       toast.error("근로자 배정 중 오류가 발생했습니다.");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   // 메모이제이션된 총계 계산
//   const workSummary = useMemo(() => {
//     const workDetails =
//       workReportData?.workDetails ||
//       Array.from({ length: 31 }, () => ({
//         hours: "",
//         extended: false,
//         holiday: false,
//         night: false,
//         wage: "",
//       }));

//     const totalHours = workDetails.reduce((sum, day) => sum + Number(day.hours || 0), 0);
//     const totalWage = workDetails.reduce(
//       (sum, day) => sum + Number((day.wage || "").replace(/,/g, "") || 0),
//       0
//     );
//     const totalWorkDays = workDetails.filter((day) => day.hours).length;
//     const extendedDays = workDetails.filter((day) => day.extended).length;
//     const holidayDays = workDetails.filter((day) => day.holiday).length;
//     const nightDays = workDetails.filter((day) => day.night).length;

//     return {
//       totalHours,
//       totalWage,
//       totalWorkDays,
//       extendedDays,
//       holidayDays,
//       nightDays,
//       workDetails,
//     };
//   }, [workReportData]);

//   const handleSaveAndRefresh = async () => {
//     setIsLoading(true);
//     try {
//       const paidItemsCount =
//         workReportData?.workDetails?.filter(
//           (item) => item.payment_status === "paid" && (item.hours || item.wage)
//         ).length || 0;

//       const result = await saveWorkRecords(
//         selectedWorker,
//         selectedSite,
//         yearMonth,
//         workReportData.workDetails
//       );

//       if (result.success) {
//         setIsDirty(false);
//         const now = new Date();
//         setLastSavedTime(now);

//         const cacheKey = `workrecord_${selectedWorker}_${selectedSite}_${yearMonth}`;
//         localStorage.setItem(cacheKey, JSON.stringify(workReportData.workDetails));
//         localStorage.setItem(`${cacheKey}_lastSaved`, now.getTime().toString());
//         localStorage.setItem(`${cacheKey}_isDirty`, "false");

//         let message = result.message;
//         if (paidItemsCount > 0 && !message.includes("지급완료")) {
//           message = `${result.message} (지급완료된 ${paidItemsCount}건의 기록은 수정되지 않았습니다.)`;
//         }

//         toast.success(message);
//       } else {
//         toast.error(result.message);
//       }
//     } catch (error) {
//       console.error("저장 중 오류 발생:", error);
//       toast.error("저장 처리 중 오류가 발생했습니다.");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const workersList = useMemo(() => {
//     if (workers.length === 0) {
//       return (
//         <div className="text-gray-500 text-center py-4">
//           {selectedSite ? "근로자 정보가 없습니다." : "공사현장을 선택해주세요."}
//         </div>
//       );
//     }

//     return workers.map((worker) => (
//       <div
//         key={worker.worker_id}
//         className={`p-2 rounded hover:bg-gray-100 cursor-pointer transition-colors flex justify-between items-center ${
//           selectedWorker === worker.worker_id ? "bg-blue-100 border-l-4 border-blue-500" : ""
//         } ${worker.hasWorkHistory ? "border-l-4 border-green-500" : ""}
//       ${worker.isRegistered && !worker.hasWorkHistory ? "border-l-4 border-yellow-500" : ""} ${
//           worker.notInSite ? "opacity-60 border-dashed border" : ""
//         }`}
//         onClick={() => {
//           fetchWorkerDetails(worker.worker_id);
//         }}
//       >
//         <div className="w-96 truncate pr-2">{worker.name}</div>
//         <div className="relative">
//           <button
//             className="ml-2 p-1 text-xs bg-gray-100 hover:bg-gray-200 rounded flex items-center text-gray-700 site-selector-button"
//             onClick={(e) => toggleSiteSelector(worker.worker_id, e)}
//           >
//             <Building2 size={14} className="mr-1" />
//             <ChevronDown size={14} className="ml-1" />
//           </button>

//           {showSiteSelector === worker.worker_id && (
//             <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg z-10 border border-gray-200 site-selector-dropdown">
//               <div className="py-1">
//                 <div className="border-t mt-1">
//                   <button
//                     className="pl-6 px-4 py-2 text-xs text-left w-full hover:bg-red-50 text-red-600"
//                     onClick={(e) => handleRemoveWorkerFromSite(worker.worker_id, e)}
//                   >
//                     현장등록취소
//                   </button>
//                 </div>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     ));
//   }, [
//     workers,
//     selectedSite,
//     selectedWorker,
//     fetchWorkerDetails,
//     toggleSiteSelector,
//     showSiteSelector,
//     handleRemoveWorkerFromSite,
//   ]);

//   return (
//     <RoleGuard requiredPermission="VIEW_DAILY_REPORTS">
//       <div className="space-y-4">
//         {isLoading && (
//           <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50">
//             <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
//             <span className="ml-3 text-white">처리 중...</span>
//           </div>
//         )}

//         <div className="mb-2">
//           <h2 className="text-2xl font-bold text-gray-900 mb-1 pl-6">근로내역</h2>

//           <div className="bg-white rounded-lg shadow-md print:hidden">
//             <div className="flex flex-wrap items-center justify-between gap-4">
//               <div className="flex items-center space-x-4 pl-6">
//                 {/* 현장 선택 */}
//                 <div>
//                   <label htmlFor="site-select" className="block text-sm font-medium text-gray-700">
//                     현장 선택:
//                   </label>
//                   <select
//                     id="site-select"
//                     className="mt-1 block w-48 rounded-md border-2 border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
//                     value={selectedSite || ""}
//                     onChange={(e) => setSelectedSite(e.target.value)}
//                     disabled={isSiteLoading}
//                   >
//                     <option value="">현장을 선택하세요</option>
//                     {sites.map((site) => (
//                       <option key={site.site_id} value={site.site_id}>
//                         {site.site_name}
//                       </option>
//                     ))}
//                   </select>
//                 </div>

//                 {/* 조회 년월 */}
//                 <div>
//                   <label htmlFor="year-month" className="block text-sm font-medium text-gray-700">
//                     조회 년월:
//                   </label>
//                   <input
//                     type="month"
//                     id="year-month"
//                     className="mt-1 block w-40 rounded-md border border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
//                     value={yearMonth}
//                     onChange={(e) => setYearMonth(e.target.value)}
//                     max={new Date().toISOString().slice(0, 7)}
//                   />
//                 </div>

//                 {/* 근로자 배정 버튼 */}
//                 <div className="pt-6">
//                   <button
//                     className="px-4 py-2 bg-orange-500 text-white text-sm rounded hover:bg-blue-600 flex items-center"
//                     onClick={() => setShowWorkerAssignModal(true)}
//                     title="근로자등록은 되어 있으나 현재 현장에 배정되지 않은 근로자 배정"
//                   >
//                     <UserPlus size={18} className="mr-1 text-sm" />
//                     근로자 배정
//                   </button>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>

//         <div className="grid grid-cols-8 gap-4">
//           <div className="border rounded p-3 h-[700px] overflow-y-auto">
//             <input
//               type="text"
//               placeholder="근로자 검색"
//               className="w-full mb-2 px-2 py-1 border rounded"
//               value={searchTerm}
//               onChange={(e) => setSearchTerm(e.target.value)}
//             />
//             <div className="space-y-2">{workersList}</div>
//             {selectedSite && (
//               <div className="mt-4 border-t pt-4">
//                 <button
//                   onClick={() => setIsAddModalOpen(true)}
//                   disabled={isLoading}
//                   className="w-full py-2 px-3 bg-blue-500 text-sm text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
//                 >
//                   신규 근로자 등록
//                 </button>
//               </div>
//             )}
//           </div>

//           <div className="col-span-7 border rounded p-4 space-y-6 overflow-x-auto">
//             {isDetailLoading ? (
//               <div className="flex items-center justify-center h-48">
//                 <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
//                 <span className="ml-3">근로자 정보 로딩 중...</span>
//               </div>
//             ) : selectedWorker && selectedWorkerDetails ? (
//               <>
//                 <div>
//                   <div className="flex items-center justify-between mb-4">
//                     <h2 className="text-xl font-semibold">
//                       <span className="text-black">{selectedWorkerDetails.name}</span>{" "}
//                       <span className="text-sm text-gray-500">- 근로자 기본정보</span>
//                     </h2>
//                     <div>
//                       <span className="text-xs">
//                         지급처리된 근로자의 근무내역수정: 리포트-일용근로자 급여-해당 근무일
//                         "수정"버튼 클릭, 다시 지금페이지 돌아와서 수정하면됩니다.
//                       </span>
//                     </div>
//                   </div>

//                   <div className="overflow-x-auto">
//                     <table className="w-full text-sm border border-gray-300">
//                       <tbody>
//                         <tr className="bg-gray-50">
//                           <th className="p-2 text-left font-medium border-r">
//                             주민(외국인)등록번호
//                           </th>
//                           <th className="p-2 text-left font-medium border-r">국적</th>
//                           <th className="p-2 text-left font-medium border-r">체류자격</th>
//                           <th className="p-2 text-left font-medium border-r">직종</th>
//                           <th className="p-2 text-left font-medium border-r">연락처</th>
//                           <th className="p-2 text-left font-medium">유형</th>
//                         </tr>
//                         <tr>
//                           <td className="p-2 border-r">
//                             {formatResidentNumber(selectedWorkerDetails.resident_number)}
//                           </td>
//                           <td className="p-2 border-r">
//                             {getCodeName("nationality", selectedWorkerDetails.nationality_code)}
//                           </td>
//                           <td className="p-2 border-r">
//                             {getCodeName(
//                               "residence_status",
//                               selectedWorkerDetails.residence_status_code
//                             ) || "-"}
//                           </td>
//                           <td className="p-2 border-r">
//                             {getCodeName("job", selectedWorkerDetails.job_code) || "-"}
//                           </td>
//                           <td className="p-2 border-r">
//                             {formatPhoneNumber(selectedWorkerDetails.contact_number)}
//                           </td>
//                           <td className="p-2">
//                             {selectedWorkerDetails.worker_type === "daily" ? "일용직" : "상용직"}
//                           </td>
//                         </tr>
//                       </tbody>
//                     </table>
//                   </div>
//                 </div>

//                 <div className="grid grid-cols-8 gap-4">
//                   <div className="col-span-1 border p-3 rounded space-y-2 text-sm bg-gray-50">
//                     <div className="font-semibold mb-8">📊 통계</div>
//                     <div>총 근무일수: {workSummary.totalWorkDays}일</div>
//                     <div>총 근무시간: {workSummary.totalHours}시간</div>
//                     <div className="my-4 space-y-1">
//                       <div className="border-t-2 border-gray-300" />
//                       <div className="border-t-2 border-gray-300" />
//                     </div>
//                     <div>전월 근무시작일: {prevMonthWorkData?.startDate}</div>
//                     <div>전월 근무일수: {prevMonthWorkData?.days || "없음"}</div>
//                     <div>전월 근무시간: {prevMonthWorkData?.hours || "없음"}</div>
//                   </div>

//                   <div className="col-span-7">
//                     <CalendarWorkTime
//                       yearMonth={yearMonth}
//                       workDetails={workSummary.workDetails}
//                       isReportLoading={isReportLoading}
//                       handleChange={handleChange}
//                       formatNumber={formatNumber}
//                     />
//                   </div>
//                 </div>

//                 <div className="border-t pt-4 text-md font-semibold">
//                   <div className="flex justify-between mb-4">
//                     <div className="flex gap-8">
//                       <div>
//                         총 근무일수:{" "}
//                         <span className="text-blue-600">{workSummary.totalWorkDays}일</span>
//                       </div>
//                       <div>
//                         총 근무시간:{" "}
//                         <span className="text-blue-600">{workSummary.totalHours}시간</span>
//                       </div>
//                       <div>
//                         총 임금:{" "}
//                         <span className="text-blue-600">
//                           {workSummary.totalWage.toLocaleString()}원
//                         </span>
//                       </div>
//                     </div>
//                     <div className="flex gap-8 text-sm">
//                       <div>
//                         연장 근무일수:{" "}
//                         <span
//                           className={workSummary.extendedDays > 0 ? "text-red-500 font-medium" : ""}
//                         >
//                           {workSummary.extendedDays}일
//                         </span>
//                       </div>
//                       <div>
//                         휴일 근무일수:{" "}
//                         <span
//                           className={workSummary.holidayDays > 0 ? "text-red-500 font-medium" : ""}
//                         >
//                           {workSummary.holidayDays}일
//                         </span>
//                       </div>
//                       <div>
//                         야간 근무일수:{" "}
//                         <span
//                           className={workSummary.nightDays > 0 ? "text-red-500 font-medium" : ""}
//                         >
//                           {workSummary.nightDays}일
//                         </span>
//                       </div>
//                     </div>
//                   </div>

//                   {/* 메모이제이션된 보험 요약 사용 */}
//                   {renderInsuranceEligibilitySummary()}
//                 </div>

//                 {/* 가입 & 상실 요건 박스 */}
//                 <div className="mt-8 space-y-8 text-sm">
//                   <div className="border rounded bg-white p-3 space-y-2">
//                     <div className="font-semibold mb-1">✅ 4대보험 가입 요건</div>
//                     <div>
//                       📌 <strong>국민연금</strong>:
//                       <ul className="list-disc list-inside ml-4 space-y-1">
//                         <li>
//                           <strong>최우선 조건</strong>: 월 소득 220만원 이상 → 즉시 가입 (18세 이상
//                           60세 미만)
//                         </li>
//                         <li>
//                           <strong>기본 조건</strong>: 18세 이상 60세 미만 이면서 1.최초 근무일부터
//                           1개월 경과(마지막 근무일 기준) + 누적 8일 이상, 2. 또는 근무일부터 1개월
//                           경과(마지막 근무일 기준)+ 누적 60시간 이상
//                         </li>
//                         <li>
//                           <strong>취득일</strong>: 가입 조건 충족일 (통상 최초 근무일)
//                         </li>
//                       </ul>
//                     </div>
//                     <div>
//                       📌 <strong>건강보험</strong>:
//                       <ul className="list-disc list-inside ml-4 space-y-1">
//                         <li>
//                           연령 제한 없음 + 최초 근무일부터 1개월 경과(마지막 근무일 기준) + 누적
//                           60시간 이상
//                         </li>
//                         <li>
//                           <strong>취득일</strong>: 최초 근무일부터 1개월간 조건 충족 시 → 최초
//                           근무일
//                         </li>
//                       </ul>
//                     </div>
//                     <div>
//                       📌 <strong>산재보험</strong>: 1일만 일해도 무조건 가입 →{" "}
//                       <strong>취득일: 근무 시작일</strong>
//                     </div>
//                     <div>
//                       📌 <strong>고용보험</strong>:
//                       <ul className="list-disc list-inside ml-4 space-y-1">
//                         <li>일용직도 1일 근무 시 가입 대상</li>
//                         <li>65세 이상은 실업급여 제외, 고용안정·직업능력개발사업만 적용</li>
//                         <li>
//                           외국인 중 F-2(거주체류자격), F-5(영주체류자격), F-6(결혼이민체류자격)는
//                           당연 적용
//                         </li>
//                         <li>
//                           E-9(비전문취업체류자격), H-2(방문취업체류자격)는 실업급여는 임의가입,
//                           고용안정/직업능력개발은 당연 적용
//                         </li>
//                         <li>F-4(재외동포체류자격)은 임의가입</li>
//                       </ul>
//                     </div>
//                   </div>

//                   <div className="border rounded bg-white p-3 space-y-2">
//                     <div className="font-semibold mb-1">⛔ 4대보험 상실 기준</div>
//                     <div>
//                       📌 <strong>국민연금</strong>:
//                       <ul className="list-disc list-inside ml-4 space-y-1">
//                         <li>가입 조건을 충족하지 않게 된 시점의 다음날</li>
//                         <li>근로 종료 시 → 최종 근로일의 다음날</li>
//                         <li>
//                           누적 8일 미만 및 60시간 미만 근무 시 → 해당 조건 미충족 시점의 다음날
//                         </li>
//                       </ul>
//                     </div>
//                     <div>
//                       📌 <strong>건강보험</strong>:
//                       <ul className="list-disc list-inside ml-4 space-y-1">
//                         <li>취득일이 1일인 경우: 취득월과 연속하여 다음달 근로 여부에 따라 결정</li>
//                         <li>연속 근로 시 누적 60시간 이상 → 최종 근로일의 다음날</li>
//                         <li>60시간 미만 근로월 발생 시 → 해당 월의 1일</li>
//                       </ul>
//                     </div>
//                     <div>
//                       📌 <strong>산재보험</strong>: 근무 종료 →{" "}
//                       <strong>상실일: 마지막 근무일의 다음날</strong>
//                     </div>
//                     <div>
//                       📌 <strong>고용보험</strong>: 근무 종료 →{" "}
//                       <strong>상실일: 마지막 근무일의 다음날</strong>
//                     </div>
//                   </div>
//                 </div>
//               </>
//             ) : selectedWorker && !selectedWorkerDetails ? (
//               <div className="flex items-center justify-center h-96 text-orange-500">
//                 <div className="text-center">
//                   <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500 mx-auto mb-4"></div>
//                   <div>근로자 정보를 불러오는 중입니다...</div>
//                   <div className="text-sm text-gray-500 mt-2">
//                     선택된 근로자 ID: {selectedWorker}
//                   </div>
//                 </div>
//               </div>
//             ) : (
//               <div className="flex items-center justify-center h-96 text-gray-500">
//                 <div className="text-center">
//                   <div className="text-lg mb-2">
//                     {selectedSite
//                       ? "좌측에서 근로자를 선택해주세요."
//                       : "공사현장을 먼저 선택해주세요."}
//                   </div>
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>

//         {/* 근로자 등록 모달 */}
//         <WorkerAddModal
//           isOpen={isAddModalOpen}
//           onClose={() => setIsAddModalOpen(false)}
//           siteId={selectedSite}
//           selectedYearMonth={yearMonth}
//           onSuccess={handleWorkerAddSuccess}
//         />

//         {/* 배정되지 않은 근로자 배정 모달 */}
//         {showWorkerAssignModal && (
//           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
//             <div className="bg-white rounded-lg p-6 w-96 max-w-lg max-h-[80vh] overflow-y-auto">
//               <div className="flex justify-between items-center mb-4">
//                 <h2 className="text-xl font-bold">근로자 배정</h2>
//                 <button
//                   className="text-gray-500 hover:text-gray-700"
//                   onClick={() => setShowWorkerAssignModal(false)}
//                 >
//                   <X size={20} />
//                 </button>
//               </div>

//               {!selectedSite ? (
//                 <div className="py-6 text-center">
//                   <div className="text-red-500 font-medium mb-4">공사현장을 선택해주세요</div>
//                   <button
//                     className="px-4 py-2 bg-gray-200 rounded text-gray-700 hover:bg-gray-300"
//                     onClick={() => setShowWorkerAssignModal(false)}
//                   >
//                     닫기
//                   </button>
//                 </div>
//               ) : (
//                 <>
//                   <p className="text-sm text-gray-500 mb-4">
//                     현재 현장에 배정되지 않은 근로자 목록입니다.
//                   </p>

//                   <div className="mb-4">
//                     <input
//                       type="text"
//                       placeholder="근로자 검색..."
//                       className="w-full px-3 py-2 border rounded"
//                       value={workerSearchTerm}
//                       onChange={(e) => setWorkerSearchTerm(e.target.value)}
//                     />
//                   </div>

//                   {unassignedWorkers.length === 0 ? (
//                     <p className="text-center py-4 text-gray-500">배정 가능한 근로자가 없습니다</p>
//                   ) : (
//                     <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
//                       {unassignedWorkers
//                         .filter((worker) =>
//                           worker.name.toLowerCase().includes(workerSearchTerm.toLowerCase())
//                         )
//                         .map((worker) => (
//                           <div
//                             key={worker.worker_id}
//                             className="flex items-center justify-between p-2 border rounded hover:bg-gray-50"
//                           >
//                             <div>
//                               <div className="font-medium">{worker.name}</div>
//                               <div className="text-xs text-gray-500">
//                                 {formatResidentNumber(worker.resident_number)}
//                               </div>
//                             </div>
//                             <button
//                               className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
//                               onClick={() => assignWorkerToSite(worker.worker_id, selectedSite)}
//                             >
//                               배정
//                             </button>
//                           </div>
//                         ))}
//                     </div>
//                   )}

//                   <div className="flex justify-end">
//                     <button
//                       className="px-4 py-2 bg-gray-200 rounded text-gray-700 hover:bg-gray-300"
//                       onClick={() => setShowWorkerAssignModal(false)}
//                     >
//                       닫기
//                     </button>
//                   </div>
//                 </>
//               )}
//             </div>
//           </div>
//         )}

//         {/* Floating Save Button */}
//         {selectedWorker && selectedWorkerDetails && (
//           <div className="fixed bottom-6 right-6 z-50">
//             <button
//               className={`flex items-center justify-center rounded-full w-16 h-16 shadow-xl ${
//                 isDirty
//                   ? "bg-gradient-to-br from-red-400 to-red-600 hover:from-red-500 hover:to-red-700"
//                   : "bg-gradient-to-br from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700"
//               } text-white transform transition-all duration-300 hover:scale-110 hover:shadow-2xl ${
//                 isLoading || isReportLoading ? "opacity-80" : ""
//               }`}
//               onClick={handleSaveAndRefresh}
//               disabled={isLoading || isReportLoading}
//               title={isDirty ? "변경사항 저장" : "저장됨"}
//             >
//               {isLoading || isReportLoading ? (
//                 <div className="animate-spin h-7 w-7 border-3 border-white border-t-transparent rounded-full"></div>
//               ) : (
//                 <Save size={28} strokeWidth={1.5} />
//               )}
//             </button>

//             <div
//               className={`absolute -top-12 right-0 whitespace-nowrap rounded-lg px-4 py-2 text-white text-sm font-semibold shadow-md ${
//                 isDirty
//                   ? "bg-gradient-to-r from-red-500 to-red-600"
//                   : "bg-gradient-to-r from-blue-500 to-blue-600"
//               } transition-opacity duration-200 ${
//                 isLoading || isReportLoading ? "opacity-90" : ""
//               }`}
//             >
//               {isLoading || isReportLoading ? "저장 중..." : isDirty ? "변경사항 저장" : "저장됨"}
//               <div
//                 className={`absolute h-3 w-3 rotate-45 ${
//                   isDirty ? "bg-red-600" : "bg-blue-600"
//                 } bottom-[-6px] right-6`}
//               ></div>
//             </div>
//           </div>
//         )}

//         <ToastContainer position="top-center" />
//       </div>
//     </RoleGuard>
//   );
// }

// export default WorkTimePage;

/**
 *
 *
 *
 *
 *
 */

// "use client";

// import React, { useState, useEffect, useMemo } from "react";
// import { useAuthStore } from "@/lib/store/authStore";
// import useSiteStore from "@/lib/store/siteStore"; // siteStore 추가
// import useWorkTimeStore from "@/lib/store/workTimeStore";
// import RoleGuard from "@/components/RoleGuard";
// import useCodeStore from "@/lib/store/codeStore";
// import { useShallow } from "zustand/react/shallow";
// import WorkerAddModal from "./components/WorkerAddModal";
// import CalendarWorkTime from "./components/CalendarWorkTime";
// // 새로운 보험 계산 함수 import
// import {
//   determineInsuranceStatus,
//   calculateAgeFromResidentNumber,
// } from "@/lib/utils/insuranceCalculations";
// import {
//   Building2,
//   ChevronDown,
//   RefreshCw,
//   Check,
//   UserPlus,
//   X,
//   Save,
//   AlertTriangle,
// } from "lucide-react";
// import { supabase } from "@/lib/supabase";
// import { ToastContainer, toast } from "react-toastify";
// import "react-toastify/dist/ReactToastify.css";

// function WorkTimePage() {
//   const { user } = useAuthStore();
//   const { getCodeList } = useCodeStore();

//   // siteStore에서 현장 관련 상태 가져오기
//   const { sites, userRole, initialize: initializeSiteStore, isSiteLoading } = useSiteStore();

//   // workTimeStore에서 근무시간 관리 기능만 가져오기
//   const {
//     workers,
//     selectedWorker,
//     yearMonth,
//     workerDetails,
//     workReports,
//     isDetailLoading,
//     isReportLoading,
//     isLoading: isWorkTimeLoading,
//     isWorkerLoading,
//     fetchWorkers,
//     fetchWorkerDetails,
//     setYearMonth,
//     registerWorkerToSite,
//     saveWorkRecords,
//   } = useWorkTimeStore();

//   const [searchTerm, setSearchTerm] = useState("");
//   const [isAddModalOpen, setIsAddModalOpen] = useState(false);
//   const [showSiteSelector, setShowSiteSelector] = useState(null);
//   // 현장선택 저장
//   const [selectedSite, setSelectedSite] = useState(null); // 로컬 상태로 관리
//   // 코드 데이터 저장용 상태
//   const [nationalityCodes, setNationalityCodes] = useState([]);
//   const [residenceStatusCodes, setResidenceStatusCodes] = useState([]);
//   const [jobCodes, setJobCodes] = useState([]);

//   const [unassignedWorkers, setUnassignedWorkers] = useState([]);
//   const [showWorkerAssignModal, setShowWorkerAssignModal] = useState(false);
//   const [workerSearchTerm, setWorkerSearchTerm] = useState("");
//   const [isLoading, setIsLoading] = useState(false);

//   // 저장 상태 추적
//   const [isDirty, setIsDirty] = useState(false);
//   const [lastSavedTime, setLastSavedTime] = useState(null);
//   const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);

//   // useShallow를 사용하여 선택자 함수 최적화 - 디버깅 추가
//   const selectedWorkerDetails = useWorkTimeStore(
//     useShallow((state) => {
//       const details = state.workerDetails[state.selectedWorker] || null;
//       console.log("🔍 selectedWorkerDetails 상태:", {
//         selectedWorker: state.selectedWorker,
//         hasDetails: !!details,
//         allWorkerDetails: Object.keys(state.workerDetails),
//         details: details ? details.name : "null",
//       });
//       return details;
//     })
//   );

//   const workReportData = useWorkTimeStore(
//     useShallow((state) => {
//       if (!state.selectedWorker || !selectedSite || !state.yearMonth) return null;
//       const cacheKey = `${state.selectedWorker}-${selectedSite}-${state.yearMonth}`;
//       return state.workReports[cacheKey] || null;
//     })
//   );

//   const prevMonthWorkData = useWorkTimeStore(
//     useShallow((state) => {
//       if (!state.selectedWorker || !selectedSite || !state.yearMonth) return null;
//       const currentDate = new Date(`${state.yearMonth}-01`);
//       const prevMonth = new Date(currentDate);
//       prevMonth.setMonth(currentDate.getMonth() - 1);
//       const prevYearMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(
//         2,
//         "0"
//       )}`;
//       const cacheKey = `${state.selectedWorker}-${selectedSite}-${prevYearMonth}`;
//       return state.prevMonthWork[cacheKey] || { days: 0, hours: 0, startDate: "없음" };
//     })
//   );

//   const insuranceStatusData = useWorkTimeStore(
//     useShallow((state) => {
//       if (!state.selectedWorker || !selectedSite) return null;
//       const cacheKey = `${state.selectedWorker}-${selectedSite}`;
//       return (
//         state.insuranceStatus[cacheKey] || {
//           national_pension: "해당사항없음",
//           health_insurance: "해당사항없음",
//           employment_insurance: "해당사항없음",
//           industrial_accident: "해당사항없음",
//         }
//       );
//     })
//   );

//   // ... (기존 useEffect들과 핸들러 함수들은 동일하게 유지)

//   useEffect(() => {
//     setSelectedSite(null);
//     return () => {
//       useWorkTimeStore.getState().resetStore();
//     };
//   }, []);

//   // 페이지 초기화 - 사용자 역할에 따른 현장 로드
//   useEffect(() => {
//     if (user) {
//       initializeSiteStore(user.id);
//     }
//   }, [user, initializeSiteStore]);

//   // 코드 데이터 로드
//   useEffect(() => {
//     async function loadCodeData() {
//       try {
//         const nationalities = await getCodeList("NATIONALITY");
//         setNationalityCodes(nationalities || []);

//         const residenceStatuses = await getCodeList("COMMON_RESIDENCE_STATUS");
//         setResidenceStatusCodes(residenceStatuses || []);

//         const jobs = await getCodeList("JOB_CODE");
//         setJobCodes(jobs || []);
//       } catch (error) {
//         console.error("코드 데이터 로드 오류:", error);
//       }
//     }

//     loadCodeData();
//   }, [getCodeList]);

//   // 사이트 변경 시 검색어 초기화 및 근로자 목록 갱신
//   useEffect(() => {
//     setSearchTerm("");
//     if (selectedSite) {
//       fetchWorkers(selectedSite);
//     }
//   }, [selectedSite, fetchWorkers]);

//   // 검색어 변경 시 근로자 목록 필터링
//   useEffect(() => {
//     if (selectedSite) {
//       const debouncedFetch = setTimeout(() => {
//         fetchWorkers(selectedSite, searchTerm);
//       }, 300);

//       return () => clearTimeout(debouncedFetch);
//     }
//   }, [searchTerm, selectedSite, fetchWorkers]);

//   // 근로자 선택 시 근무 기록 로드
//   useEffect(() => {
//     console.log("🔄 selectedWorker 변경됨:", selectedWorker);
//     if (selectedWorker && selectedSite && yearMonth) {
//       console.log("📊 근무 기록 로드 시작:", { selectedWorker, selectedSite, yearMonth });
//       useWorkTimeStore.getState().fetchWorkReports(selectedWorker, selectedSite, yearMonth);
//     }
//   }, [selectedWorker, selectedSite, yearMonth]);

//   // 드롭다운 외부 클릭 시 닫기
//   useEffect(() => {
//     if (showSiteSelector !== null) {
//       const handleClickOutside = (event) => {
//         if (
//           !event.target.closest(".site-selector-dropdown") &&
//           !event.target.closest(".site-selector-button")
//         ) {
//           setShowSiteSelector(null);
//         }
//       };

//       document.addEventListener("mousedown", handleClickOutside);
//       return () => {
//         document.removeEventListener("mousedown", handleClickOutside);
//       };
//     }
//   }, [showSiteSelector]);

//   // 공사현장이나 월이 변경될 때 상태 초기화 및 UI 갱신
//   useEffect(() => {
//     if (selectedWorker) {
//       useWorkTimeStore.setState((state) => ({
//         ...state,
//         selectedWorker: null,
//       }));
//     }

//     setSearchTerm("");

//     if (selectedSite) {
//       fetchWorkers(selectedSite);
//     }
//   }, [selectedSite, yearMonth]);

//   // 모달이 열릴 때 실행
//   useEffect(() => {
//     if (showWorkerAssignModal && selectedSite) {
//       fetchUnassignedWorkers();
//     }
//   }, [showWorkerAssignModal, selectedSite]);

//   // 페이지 이탈 시 자동 저장 처리
//   useEffect(() => {
//     const handleVisibilityChange = () => {
//       if (document.visibilityState === "hidden" && isDirty && autoSaveEnabled) {
//         if (selectedWorker && selectedSite && yearMonth && workReportData) {
//           console.log("페이지 이탈 감지, 자동 저장 실행");

//           try {
//             const cacheKey = `workrecord_${selectedWorker}_${selectedSite}_${yearMonth}`;
//             localStorage.setItem(cacheKey, JSON.stringify(workReportData.workDetails));
//             localStorage.setItem(`${cacheKey}_isDirty`, "true");
//           } catch (error) {
//             console.error("로컬 스토리지 저장 오류:", error);
//           }

//           saveWorkRecords(selectedWorker, selectedSite, yearMonth, workReportData.workDetails).then(
//             (result) => {
//               if (result.success) {
//                 console.log("페이지 이탈 시 자동 저장 성공");
//                 const cacheKey = `workrecord_${selectedWorker}_${selectedSite}_${yearMonth}`;
//                 const now = Date.now();
//                 localStorage.setItem(`${cacheKey}_lastSaved`, now.toString());
//                 localStorage.setItem(`${cacheKey}_isDirty`, "false");
//               } else {
//                 console.error("페이지 이탈 시 자동 저장 실패:", result.message);
//               }
//             }
//           );
//         }
//       }
//     };

//     document.addEventListener("visibilitychange", handleVisibilityChange);

//     return () => {
//       document.removeEventListener("visibilitychange", handleVisibilityChange);
//     };
//   }, [
//     isDirty,
//     selectedWorker,
//     selectedSite,
//     yearMonth,
//     workReportData,
//     autoSaveEnabled,
//     saveWorkRecords,
//   ]);

//   // 로컬 스토리지에서 마지막 저장 상태 복원
//   useEffect(() => {
//     if (selectedWorker && selectedSite && yearMonth) {
//       try {
//         const cacheKey = `workrecord_${selectedWorker}_${selectedSite}_${yearMonth}`;
//         const lastSaved = localStorage.getItem(`${cacheKey}_lastSaved`);
//         const wasDirty = localStorage.getItem(`${cacheKey}_isDirty`) === "true";

//         if (lastSaved) {
//           setLastSavedTime(new Date(parseInt(lastSaved)));
//         } else {
//           setLastSavedTime(null);
//         }

//         if (wasDirty) {
//           setIsDirty(true);
//         } else {
//           setIsDirty(false);
//         }
//       } catch (error) {
//         console.error("저장 상태 복원 오류:", error);
//       }
//     }
//   }, [selectedWorker, selectedSite, yearMonth]);

//   /**
//    * 핸들러 함수들
//    */
//   const handleWorkerAddSuccess = (newWorker) => {
//     if (selectedSite) {
//       fetchWorkers(selectedSite);
//     }
//   };

//   const formatResidentNumber = (num) => {
//     if (!num) return "-";
//     return num.replace(/^(\d{6})(\d{7})$/, "$1-$2");
//   };

//   const formatPhoneNumber = (num) => {
//     if (!num) return "-";
//     return num.replace(/^(\d{2,3})(\d{3,4})(\d{4})$/, "$1-$2-$3");
//   };

//   const handleRegisterWorker = async () => {
//     if (!selectedWorker || !selectedSite) {
//       toast.error("근로자와 공사현장을 선택해주세요.");
//       return;
//     }

//     const result = await registerWorkerToSite(selectedWorker, selectedSite);
//     toast.info(result.message);
//   };

//   // 근무 기록 변경 핸들러 - 개선된 버전
//   const handleChange = (index, field, value) => {
//     const dayData = workReportData?.workDetails[index] || {};

//     if (dayData.payment_status === "paid") {
//       toast.warn("지급완료된 근무기록은 수정할 수 없습니다.");
//       return;
//     }

//     if (!selectedSite || !selectedWorker || !yearMonth) {
//       toast.error("현장과 근로자, 년월을 모두 선택해주세요.");
//       return;
//     }

//     updateWorkDetailWithSite(index, field, value, selectedWorker, selectedSite, yearMonth);
//     setIsDirty(true);

//     try {
//       const cacheKey = `workrecord_${selectedWorker}_${selectedSite}_${yearMonth}`;
//       localStorage.setItem(`${cacheKey}_isDirty`, "true");
//     } catch (error) {
//       console.error("로컬 스토리지 저장 오류:", error);
//     }
//   };

//   // 개선된 updateWorkDetail 함수 - 컴포넌트 내에서 정의
//   const updateWorkDetailWithSite = (index, field, value, workerId, siteId, yearMonth) => {
//     const cacheKey = `${workerId}-${siteId}-${yearMonth}`;
//     const { workReports } = useWorkTimeStore.getState();

//     if (!workReports[cacheKey]) {
//       console.warn(`캐시 키를 찾을 수 없습니다: ${cacheKey}`);
//       return;
//     }

//     const updatedWorkDetails = [...workReports[cacheKey].workDetails];

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

//     useWorkTimeStore.setState((state) => ({
//       workReports: {
//         ...state.workReports,
//         [cacheKey]: {
//           ...state.workReports[cacheKey],
//           workDetails: updatedWorkDetails,
//         },
//       },
//     }));

//     const debounceTimer = setTimeout(() => {
//       useWorkTimeStore.getState().recalculateInsuranceStatus(workerId, siteId, yearMonth);
//     }, 500);

//     return () => clearTimeout(debounceTimer);
//   };

//   const getCodeName = (codeType, codeValue) => {
//     if (!codeValue) return "-";

//     let codeList = [];
//     switch (codeType) {
//       case "nationality":
//         codeList = nationalityCodes;
//         break;
//       case "residence_status":
//         codeList = residenceStatusCodes;
//         break;
//       case "job":
//         codeList = jobCodes;
//         break;
//       default:
//         return codeValue;
//     }

//     const code = codeList.find((c) => c.code_value === codeValue);
//     return code ? code.code_name : codeValue;
//   };

//   const formatNumber = (value) => {
//     if (!value) return "";
//     const cleaned = value.replace(/,/g, "").replace(/\D/g, "");
//     return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
//   };

//   const toggleSiteSelector = (workerId, event) => {
//     event.stopPropagation();
//     setShowSiteSelector(showSiteSelector === workerId ? null : workerId);
//   };

//   const handleRemoveWorkerFromSite = async (workerId, event) => {
//     event.stopPropagation();

//     if (!confirm("정말 이 근로자의 현장 등록을 취소하시겠습니까?")) {
//       return;
//     }

//     try {
//       const { data: registrationRecords, error: recordsError } = await supabase
//         .from("work_records")
//         .select("record_id")
//         .eq("worker_id", workerId)
//         .eq("site_id", selectedSite)
//         .eq("status", "registration");

//       if (recordsError) throw recordsError;

//       const { data: actualRecords, error: actualError } = await supabase
//         .from("work_records")
//         .select("record_id")
//         .eq("worker_id", workerId)
//         .eq("site_id", selectedSite)
//         .eq("registration_month", yearMonth)
//         .neq("status", "registration");

//       if (actualError) throw actualError;

//       if (actualRecords && actualRecords.length > 0) {
//         setShowSiteSelector(null);
//         toast.error("이 근로자는 해당 현장에 실제 근무 기록이 있어 등록을 취소할 수 없습니다.");
//         return;
//       }

//       if (registrationRecords && registrationRecords.length > 0) {
//         const recordIds = registrationRecords.map((r) => r.record_id);

//         const { error: deleteError } = await supabase
//           .from("work_records")
//           .delete()
//           .in("record_id", recordIds);

//         if (deleteError) throw deleteError;

//         toast.success("현장 등록이 취소되었습니다.");

//         if (selectedSite) {
//           await fetchWorkers(selectedSite);
//         }
//       } else {
//         toast.error("현장 등록 정보를 찾을 수 없습니다.");
//       }

//       setShowSiteSelector(null);
//     } catch (error) {
//       console.error("현장 등록 취소 오류:", error);
//       toast.error("현장 등록 취소 중 오류가 발생했습니다.");
//     }
//   };

//   const changeSite = async (workerId, siteId, siteName, event) => {
//     event.stopPropagation();

//     try {
//       const { data: currentRecords, error: recordsError } = await supabase
//         .from("work_records")
//         .select("record_id, site_id, status")
//         .eq("worker_id", workerId);

//       if (recordsError) throw recordsError;

//       if (currentRecords.some((record) => record.site_id === parseInt(siteId))) {
//         toast.info(`이미 ${siteName} 현장에 배정되어 있습니다.`);
//         setShowSiteSelector(null);
//         return;
//       }

//       const hasWorkRecords = currentRecords.some((record) => record.status !== "registration");

//       const registrationRecords = currentRecords.filter(
//         (record) => record.status === "registration"
//       );
//       if (registrationRecords.length > 0) {
//         const recordIds = registrationRecords.map((r) => r.record_id);

//         const { error: deleteError } = await supabase
//           .from("work_records")
//           .delete()
//           .in("record_id", recordIds);

//         if (deleteError) throw deleteError;
//       }

//       const todayDate = new Date().toISOString().split("T")[0];

//       const { error: insertError } = await supabase.from("work_records").insert({
//         worker_id: workerId,
//         site_id: siteId,
//         work_date: todayDate,
//         work_hours: 0,
//         work_type: "registration",
//         daily_wage: 0,
//         status: "registration",
//       });

//       if (insertError) throw insertError;

//       const workerName = workers.find((w) => w.worker_id === workerId)?.name || "근로자";

//       if (hasWorkRecords) {
//         toast.success(
//           `근로시간과 임금이 있는 근로자는 현장이 추가됩니다. ${workerName}님에게 ${siteName} 현장이 추가되었습니다.`
//         );
//       } else {
//         toast.info(`${workerName}님의 현장이 ${siteName}(으)로 변경되었습니다.`);
//       }

//       if (selectedSite) {
//         await fetchWorkers(selectedSite);
//       }

//       setShowSiteSelector(null);
//     } catch (error) {
//       console.error("현장 변경 오류:", error);
//       toast.error("현장 변경 중 오류가 발생했습니다.");
//     }
//   };

//   const fetchUnassignedWorkers = async () => {
//     if (!selectedSite) return;

//     try {
//       setIsLoading(true);

//       const selectedYearMonth = yearMonth;

//       const { data: userCompany, error: companyError } = await supabase
//         .from("user_companies")
//         .select("company_id")
//         .eq("user_id", user.id)
//         .maybeSingle();

//       if (companyError) throw companyError;

//       if (!userCompany?.company_id) {
//         throw new Error("회사 정보를 찾을 수 없습니다.");
//       }

//       const { data: companySites, error: sitesError } = await supabase
//         .from("location_sites")
//         .select("site_id")
//         .eq("company_id", userCompany.company_id);

//       if (sitesError) throw sitesError;

//       const companySiteIds = companySites.map((site) => site.site_id);

//       const { data: allWorkRecords, error: recordsError } = await supabase
//         .from("work_records")
//         .select("worker_id, site_id")
//         .in("site_id", companySiteIds);

//       if (recordsError) throw recordsError;

//       const allCompanyWorkerIds = [...new Set(allWorkRecords.map((record) => record.worker_id))];

//       const { data: currentSiteRecords, error: currentSiteError } = await supabase
//         .from("work_records")
//         .select("worker_id")
//         .eq("site_id", selectedSite)
//         .eq("registration_month", selectedYearMonth);

//       if (currentSiteError) throw currentSiteError;

//       const currentSiteWorkerIds = new Set(currentSiteRecords.map((record) => record.worker_id));

//       const unassignedWorkerIds = allCompanyWorkerIds.filter((id) => !currentSiteWorkerIds.has(id));

//       if (unassignedWorkerIds.length === 0) {
//         setUnassignedWorkers([]);
//         return;
//       }

//       const { data: workerDetails, error: workersError } = await supabase
//         .from("workers")
//         .select("*")
//         .in("worker_id", unassignedWorkerIds)
//         .order("name");

//       if (workersError) throw workersError;

//       setUnassignedWorkers(workerDetails || []);
//     } catch (error) {
//       console.error("배정되지 않은 근로자 조회 오류:", error);
//       toast.error("배정 가능한 근로자 목록을 불러오는 중 오류가 발생했습니다.");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const assignWorkerToSite = async (workerId, siteId) => {
//     if (!workerId || !siteId) return;

//     try {
//       setIsLoading(true);

//       const todayDate = new Date().toISOString().split("T")[0];

//       const { error } = await supabase.from("work_records").insert({
//         worker_id: workerId,
//         site_id: siteId,
//         work_date: todayDate,
//         work_hours: 0,
//         work_type: "registration",
//         daily_wage: 0,
//         status: "registration",
//         registration_month: yearMonth,
//       });

//       if (error) throw error;

//       toast.success("근로자가 현장에 성공적으로 배정되었습니다.");

//       setShowWorkerAssignModal(false);

//       if (selectedSite) {
//         await fetchWorkers(selectedSite);
//       }
//     } catch (error) {
//       console.error("근로자 배정 오류:", error);
//       toast.error("근로자 배정 중 오류가 발생했습니다.");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   // 총계 계산
//   const workDetails =
//     workReportData?.workDetails ||
//     Array.from({ length: 31 }, () => ({
//       hours: "",
//       extended: false,
//       holiday: false,
//       night: false,
//       wage: "",
//     }));

//   const totalHours = workDetails.reduce((sum, day) => sum + Number(day.hours || 0), 0);
//   const totalWage = workDetails.reduce(
//     (sum, day) => sum + Number((day.wage || "").replace(/,/g, "") || 0),
//     0
//   );
//   const totalWorkDays = workDetails.filter((day) => day.hours).length;
//   const extendedDays = workDetails.filter((day) => day.extended).length;
//   const holidayDays = workDetails.filter((day) => day.holiday).length;
//   const nightDays = workDetails.filter((day) => day.night).length;

//   // 새로운 4대보험 가입 조건 계산 함수 - determineInsuranceStatus 사용
//   const calculateInsuranceEligibilityWithNewLogic = () => {
//     if (!selectedWorkerDetails || !workReportData) {
//       return {
//         nationalPension: { required: false, reason: "정보 부족" },
//         healthInsurance: { required: false, reason: "정보 부족" },
//         employmentInsurance: { required: false, reason: "정보 부족" },
//         industrialAccident: { required: false, reason: "정보 부족" },
//       };
//     }

//     // 이번달 마지막 근무일 계산
//     const getLastWorkDateThisMonth = () => {
//       const workingDays = workDetails
//         .map((day, index) => ({
//           day: index + 1,
//           hours: day.hours,
//         }))
//         .filter((day) => day.hours && parseFloat(day.hours) > 0)
//         .sort((a, b) => b.day - a.day); // 큰 날짜부터 정렬

//       if (workingDays.length === 0) return null;

//       const lastWorkDay = workingDays[0].day;
//       return `${yearMonth}-${String(lastWorkDay).padStart(2, "0")}`;
//     };

//     // 근로자 정보 구성
//     const worker = {
//       ...selectedWorkerDetails,
//       age: calculateAgeFromResidentNumber(selectedWorkerDetails.resident_number),
//     };

//     // 근무 이력 구성
//     const workHistory = {
//       currentMonthWorkDays: totalWorkDays,
//       currentMonthWorkHours: totalHours,
//       previousMonthWorkDays: prevMonthWorkData?.days || 0,
//       previousMonthWorkHours: prevMonthWorkData?.hours || 0,
//       monthlyWage: totalWage,
//       firstWorkDate: prevMonthWorkData?.startDate !== "없음" ? prevMonthWorkData?.startDate : null,
//       lastWorkDateThisMonth: getLastWorkDateThisMonth(),
//       isRegisteredInCurrentMonth: true, // 이 페이지에서 확인하는 근로자는 등록된 상태
//     };

//     console.log("🔍 보험 상태 계산을 위한 데이터:", {
//       worker: {
//         name: worker.name,
//         age: worker.age,
//         resident_number: worker.resident_number,
//       },
//       workHistory,
//     });

//     // 새로운 determineInsuranceStatus 함수 사용
//     return determineInsuranceStatus(worker, workHistory);
//   };

//   // 보험 상태 요약 렌더링 함수 - 새로운 데이터 구조에 맞게 수정
//   const renderInsuranceEligibilitySummary = () => {
//     const eligibility = calculateInsuranceEligibilityWithNewLogic();

//     console.log("🎯 계산된 보험 자격:", eligibility);

//     return (
//       <div className="grid grid-cols-4 gap-4 text-base font-normal mb-4">
//         {/* 국민연금 */}
//         <div className="border rounded p-2 bg-blue-50">
//           <span className="font-medium">국민연금:</span>{" "}
//           {eligibility.nationalPension.required ? (
//             <span className="text-blue-600 font-bold">가입 대상</span>
//           ) : (
//             <span className="text-gray-500">조건 미충족</span>
//           )}
//           <div className="text-xs text-green-600 mt-1">{eligibility.nationalPension.reason}</div>
//         </div>

//         {/* 건강보험 */}
//         <div className="border rounded p-2 bg-blue-50">
//           <span className="font-medium">건강보험:</span>{" "}
//           {eligibility.healthInsurance.required ? (
//             <span className="text-blue-600 font-bold">가입 대상</span>
//           ) : (
//             <span className="text-gray-500">조건 미충족</span>
//           )}
//           <div className="text-xs text-green-600 mt-1">{eligibility.healthInsurance.reason}</div>
//         </div>

//         {/* 산재보험 */}
//         <div className="border rounded p-2 bg-blue-50">
//           <span className="font-medium">산재보험:</span>{" "}
//           {eligibility.industrialAccident.required ? (
//             <span className="text-blue-600 font-bold">가입 대상</span>
//           ) : (
//             <span className="text-gray-500">해당 없음</span>
//           )}
//           <div className="text-xs text-green-600 mt-1">{eligibility.industrialAccident.reason}</div>
//         </div>

//         {/* 고용보험 */}
//         <div className="border rounded p-2 bg-blue-50">
//           <span className="font-medium">고용보험:</span>{" "}
//           {eligibility.employmentInsurance.required ? (
//             <span className="text-blue-600 font-bold">가입 대상</span>
//           ) : (
//             <span className="text-gray-500">해당 없음</span>
//           )}
//           <div className="text-xs text-green-600 mt-1">
//             {eligibility.employmentInsurance.reason}
//           </div>
//         </div>
//       </div>
//     );
//   };

//   const handleSaveAndRefresh = async () => {
//     setIsLoading(true);

//     try {
//       const paidItemsCount =
//         workReportData?.workDetails?.filter(
//           (item) => item.payment_status === "paid" && (item.hours || item.wage)
//         ).length || 0;

//       const result = await saveWorkRecords(
//         selectedWorker,
//         selectedSite,
//         yearMonth,
//         workReportData.workDetails
//       );

//       if (result.success) {
//         setIsDirty(false);
//         const now = new Date();
//         setLastSavedTime(now);

//         const cacheKey = `workrecord_${selectedWorker}_${selectedSite}_${yearMonth}`;
//         localStorage.setItem(cacheKey, JSON.stringify(workReportData.workDetails));
//         localStorage.setItem(`${cacheKey}_lastSaved`, now.getTime().toString());
//         localStorage.setItem(`${cacheKey}_isDirty`, "false");

//         let message = result.message;
//         if (paidItemsCount > 0 && !message.includes("지급완료")) {
//           message = `${result.message} (지급완료된 ${paidItemsCount}건의 기록은 수정되지 않았습니다.)`;
//         }

//         toast.success(message);

//         try {
//           // 데이터 변경 알림 및 캐시 무효화 로직
//         } catch (e) {
//           console.error("데이터 변경 알림 발생 중 오류:", e);
//         }
//       } else {
//         toast.error(result.message);
//       }
//     } catch (error) {
//       console.error("저장 중 오류 발생:", error);
//       toast.error("저장 처리 중 오류가 발생했습니다.");
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   const workersList = useMemo(() => {
//     if (workers.length === 0) {
//       return (
//         <div className="text-gray-500 text-center py-4">
//           {selectedSite ? "근로자 정보가 없습니다." : "공사현장을 선택해주세요."}
//         </div>
//       );
//     }

//     return workers.map((worker) => (
//       <div
//         key={worker.worker_id}
//         className={`p-2 rounded hover:bg-gray-100 cursor-pointer transition-colors flex justify-between items-center ${
//           selectedWorker === worker.worker_id ? "bg-blue-100 border-l-4 border-blue-500" : ""
//         } ${worker.hasWorkHistory ? "border-l-4 border-green-500" : ""}
//       ${worker.isRegistered && !worker.hasWorkHistory ? "border-l-4 border-yellow-500" : ""} ${
//           worker.notInSite ? "opacity-60 border-dashed border" : ""
//         }`}
//         onClick={() => {
//           console.log("🔄 근로자 클릭:", {
//             workerId: worker.worker_id,
//             workerName: worker.name,
//             currentSelected: selectedWorker,
//           });
//           fetchWorkerDetails(worker.worker_id);
//         }}
//       >
//         <div className="w-96 truncate pr-2">{worker.name}</div>
//         <div className="relative">
//           <button
//             className="ml-2 p-1 text-xs bg-gray-100 hover:bg-gray-200 rounded flex items-center text-gray-700 site-selector-button"
//             onClick={(e) => toggleSiteSelector(worker.worker_id, e)}
//           >
//             <Building2 size={14} className="mr-1" />
//             <ChevronDown size={14} className="ml-1" />
//           </button>

//           {showSiteSelector === worker.worker_id && (
//             <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg z-10 border border-gray-200 site-selector-dropdown">
//               <div className="py-1">
//                 {/* <p className="pl-6 px-4 py-2 text-xs text-gray-500 border-b">현장 선택</p>
//                 {sites.map((site) => (
//                   <button
//                     key={site.site_id}
//                     className={`pl-6 px-4 py-2 text-xs text-left w-full hover:bg-gray-100 flex items-center justify-between ${
//                       site.site_id === worker.site_id ? "bg-blue-50 text-blue-700" : "text-gray-700"
//                     }`}
//                     onClick={(e) => changeSite(worker.worker_id, site.site_id, site.site_name, e)}
//                   >
//                     <span className="truncate mr-2" style={{ maxWidth: "120px" }}>
//                       {site.site_name}
//                     </span>
//                     {site.site_id === worker.site_id && (
//                       <Check size={14} className="text-blue-500 flex-shrink-0" />
//                     )}
//                   </button>
//                 ))} */}
//                 <div className="border-t mt-1">
//                   <button
//                     className="pl-6 px-4 py-2 text-xs text-left w-full hover:bg-red-50 text-red-600"
//                     onClick={(e) => handleRemoveWorkerFromSite(worker.worker_id, e)}
//                   >
//                     현장등록취소
//                   </button>
//                 </div>
//               </div>
//             </div>
//           )}
//         </div>
//       </div>
//     ));
//   }, [
//     workers,
//     isWorkerLoading,
//     selectedSite,
//     selectedWorker,
//     fetchWorkerDetails,
//     toggleSiteSelector,
//     showSiteSelector,
//     sites,
//     changeSite,
//     handleRemoveWorkerFromSite,
//   ]);

//   return (
//     <RoleGuard requiredPermission="VIEW_DAILY_REPORTS">
//       <div className="space-y-4">
//         {isLoading && (
//           <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50">
//             <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
//             <span className="ml-3 text-white">처리 중...</span>
//           </div>
//         )}

//         <div className="mb-2">
//           <h2 className="text-2xl font-bold text-gray-900 mb-1 pl-6">근로내역</h2>

//           <div className="bg-white rounded-lg shadow-md print:hidden">
//             <div className="flex flex-wrap items-center justify-between gap-4">
//               <div className="flex items-center space-x-4 pl-6">
//                 {/* 현장 선택 */}
//                 <div>
//                   <label htmlFor="site-select" className="block text-sm font-medium text-gray-700">
//                     현장 선택:
//                   </label>
//                   <select
//                     id="site-select"
//                     className="mt-1 block w-48 rounded-md border-2 border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
//                     value={selectedSite || ""}
//                     onChange={(e) => setSelectedSite(e.target.value)}
//                     disabled={isSiteLoading}
//                   >
//                     <option value="">현장을 선택하세요</option>
//                     {sites.map((site) => (
//                       <option key={site.site_id} value={site.site_id}>
//                         {site.site_name}
//                       </option>
//                     ))}
//                   </select>
//                 </div>

//                 {/* 조회 년월 */}
//                 <div>
//                   <label htmlFor="year-month" className="block text-sm font-medium text-gray-700">
//                     조회 년월:
//                   </label>
//                   <input
//                     type="month"
//                     id="year-month"
//                     className="mt-1 block w-40 rounded-md border border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
//                     value={yearMonth}
//                     onChange={(e) => setYearMonth(e.target.value)}
//                     max={new Date().toISOString().slice(0, 7)}
//                   />
//                 </div>

//                 {/* 근로자 배정 버튼 */}
//                 <div className="pt-6">
//                   <button
//                     className="px-4 py-2 bg-orange-500 text-white text-sm rounded hover:bg-blue-600 flex items-center"
//                     onClick={() => setShowWorkerAssignModal(true)}
//                     title="근로자등록은 되어 있으나 현재 현장에 배정되지 않은 근로자 배정"
//                   >
//                     <UserPlus size={18} className="mr-1 text-sm" />
//                     근로자 배정
//                   </button>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>

//         <div className="grid grid-cols-8 gap-4">
//           <div className="border rounded p-3 h-[700px] overflow-y-auto">
//             <input
//               type="text"
//               placeholder="근로자 검색"
//               className="w-full mb-2 px-2 py-1 border rounded"
//               value={searchTerm}
//               onChange={(e) => setSearchTerm(e.target.value)}
//             />
//             <div className="space-y-2">{workersList}</div>
//             {selectedSite && (
//               <div className="mt-4 border-t pt-4">
//                 <button
//                   onClick={() => setIsAddModalOpen(true)}
//                   disabled={isLoading}
//                   className="w-full py-2 px-3 bg-blue-500 text-sm text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
//                 >
//                   신규 근로자 등록
//                 </button>
//               </div>
//             )}
//           </div>

//           <div className="col-span-7 border rounded p-4 space-y-6 overflow-x-auto">
//             {isDetailLoading ? (
//               <div className="flex items-center justify-center h-48">
//                 <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
//                 <span className="ml-3">근로자 정보 로딩 중...</span>
//               </div>
//             ) : selectedWorker && selectedWorkerDetails ? (
//               <>
//                 <div>
//                   <div className="flex items-center justify-between mb-4">
//                     <h2 className="text-xl font-semibold">
//                       <span className="text-black">{selectedWorkerDetails.name}</span>{" "}
//                       <span className="text-sm text-gray-500">- 근로자 기본정보</span>
//                     </h2>
//                     <div>
//                       <span className="text-xs">
//                         지급처리된 근로자의 근무내역수정: 리포트-일용근로자 급여-해당 근무일
//                         "수정"버튼 클릭, 다시 지금페이지 돌아와서 수정하면됩니다.
//                       </span>
//                     </div>
//                   </div>

//                   <div className="overflow-x-auto">
//                     <table className="w-full text-sm border border-gray-300">
//                       <tbody>
//                         <tr className="bg-gray-50">
//                           <th className="p-2 text-left font-medium border-r">
//                             주민(외국인)등록번호
//                           </th>
//                           <th className="p-2 text-left font-medium border-r">국적</th>
//                           <th className="p-2 text-left font-medium border-r">체류자격</th>
//                           <th className="p-2 text-left font-medium border-r">직종</th>
//                           <th className="p-2 text-left font-medium border-r">연락처</th>
//                           <th className="p-2 text-left font-medium">유형</th>
//                         </tr>
//                         <tr>
//                           <td className="p-2 border-r">
//                             {formatResidentNumber(selectedWorkerDetails.resident_number)}
//                           </td>
//                           <td className="p-2 border-r">
//                             {getCodeName("nationality", selectedWorkerDetails.nationality_code)}
//                           </td>
//                           <td className="p-2 border-r">
//                             {getCodeName(
//                               "residence_status",
//                               selectedWorkerDetails.residence_status_code
//                             ) || "-"}
//                           </td>
//                           <td className="p-2 border-r">
//                             {getCodeName("job", selectedWorkerDetails.job_code) || "-"}
//                           </td>
//                           <td className="p-2 border-r">
//                             {formatPhoneNumber(selectedWorkerDetails.contact_number)}
//                           </td>
//                           <td className="p-2">
//                             {selectedWorkerDetails.worker_type === "daily" ? "일용직" : "상용직"}
//                           </td>
//                         </tr>
//                       </tbody>
//                     </table>
//                   </div>
//                 </div>

//                 <div className="grid grid-cols-8 gap-4">
//                   <div className="col-span-1 border p-3 rounded space-y-2 text-sm bg-gray-50">
//                     <div className="font-semibold  mb-8">📊 통계</div>
//                     <div>총 근무일수: {totalWorkDays}일</div>
//                     <div>총 근무시간: {totalHours}시간</div>
//                     <div className="my-4 space-y-1">
//                       <div className="border-t-2 border-gray-300" />
//                       <div className="border-t-2 border-gray-300" />
//                     </div>
//                     <div>전월 근무시작일: {prevMonthWorkData?.startDate}</div>
//                     <div>전월 근무일수: {prevMonthWorkData?.days || "없음"}</div>
//                     <div>전월 근무시간: {prevMonthWorkData?.hours || "없음"}</div>
//                   </div>

//                   <div className="col-span-7">
//                     <CalendarWorkTime
//                       yearMonth={yearMonth}
//                       workDetails={workDetails}
//                       isReportLoading={isReportLoading}
//                       handleChange={handleChange}
//                       formatNumber={formatNumber}
//                     />
//                   </div>
//                 </div>

//                 <div className="border-t pt-4 text-md font-semibold">
//                   <div className="flex justify-between mb-4">
//                     <div className="flex gap-8">
//                       <div>
//                         총 근무일수: <span className="text-blue-600">{totalWorkDays}일</span>
//                       </div>
//                       <div>
//                         총 근무시간: <span className="text-blue-600">{totalHours}시간</span>
//                       </div>
//                       <div>
//                         총 임금:{" "}
//                         <span className="text-blue-600">{totalWage.toLocaleString()}원</span>
//                       </div>
//                     </div>
//                     <div className="flex gap-8 text-sm">
//                       <div>
//                         연장 근무일수:{" "}
//                         <span className={extendedDays > 0 ? "text-red-500 font-medium" : ""}>
//                           {extendedDays}일
//                         </span>
//                       </div>
//                       <div>
//                         휴일 근무일수:{" "}
//                         <span className={holidayDays > 0 ? "text-red-500 font-medium" : ""}>
//                           {holidayDays}일
//                         </span>
//                       </div>
//                       <div>
//                         야간 근무일수:{" "}
//                         <span className={nightDays > 0 ? "text-red-500 font-medium" : ""}>
//                           {nightDays}일
//                         </span>
//                       </div>
//                     </div>
//                   </div>

//                   <div>{renderInsuranceEligibilitySummary()}</div>
//                 </div>

//                 {/* 가입 & 상실 요건 박스 - 업데이트된 내용 */}
//                 <div className="mt-8 space-y-8 text-sm">
//                   <div className="border rounded bg-white p-3 space-y-2">
//                     <div className="font-semibold mb-1">✅ 4대보험 가입 요건</div>
//                     <div>
//                       📌 <strong>국민연금</strong>:
//                       <ul className="list-disc list-inside ml-4 space-y-1">
//                         <li>
//                           <strong>최우선 조건</strong>: 월 소득 220만원 이상 → 즉시 가입 (18세 이상
//                           60세 미만)
//                         </li>
//                         <li>
//                           <strong>기본 조건</strong>: 18세 이상 60세 미만 이면서 1.최초 근무일부터
//                           1개월 경과(마지막 근무일 기준) + 누적 8일 이상, 2. 또는 근무일부터 1개월
//                           경과(마지막 근무일 기준)+ 누적 60시간 이상
//                         </li>
//                         <li>
//                           <strong>취득일</strong>: 가입 조건 충족일 (통상 최초 근무일)
//                         </li>
//                       </ul>
//                     </div>
//                     <div>
//                       📌 <strong>건강보험</strong>:
//                       <ul className="list-disc list-inside ml-4 space-y-1">
//                         <li>
//                           연령 제한 없음 + 최초 근무일부터 1개월 경과(마지막 근무일 기준) + 누적
//                           60시간 이상
//                         </li>
//                         <li>
//                           <strong>취득일</strong>: 최초 근무일부터 1개월간 조건 충족 시 → 최초
//                           근무일
//                         </li>
//                       </ul>
//                     </div>
//                     <div>
//                       📌 <strong>산재보험</strong>: 1일만 일해도 무조건 가입 →{" "}
//                       <strong>취득일: 근무 시작일</strong>
//                     </div>
//                     <div>
//                       📌 <strong>고용보험</strong>:
//                       <ul className="list-disc list-inside ml-4 space-y-1">
//                         <li>일용직도 1일 근무 시 가입 대상</li>
//                         <li>65세 이상은 실업급여 제외, 고용안정·직업능력개발 사업만 적용</li>
//                         <li>
//                           외국인 중 F-2(거주체류자격), F-5(영주체류자격), F-6(결혼이민체류자격)는
//                           당연 적용
//                         </li>
//                         <li>
//                           E-9(비전문취업체류자격), H-2(방문취업체류자격)는 실업급여는 임의가입,
//                           고용안정/직업능력개발은 당연 적용
//                         </li>
//                         <li>F-4(재외동포체류자격)은 임의가입</li>
//                       </ul>
//                     </div>
//                   </div>

//                   <div className="border rounded bg-white p-3 space-y-2">
//                     <div className="font-semibold mb-1">⛔ 4대보험 상실 기준</div>
//                     <div>
//                       📌 <strong>국민연금</strong>:
//                       <ul className="list-disc list-inside ml-4 space-y-1">
//                         <li>가입 조건을 충족하지 않게 된 시점의 다음날</li>
//                         <li>근로 종료 시 → 최종 근로일의 다음날</li>
//                         <li>
//                           누적 8일 미만 및 60시간 미만 근무 시 → 해당 조건 미충족 시점의 다음날
//                         </li>
//                       </ul>
//                     </div>
//                     <div>
//                       📌 <strong>건강보험</strong>:
//                       <ul className="list-disc list-inside ml-4 space-y-1">
//                         <li>취득일이 1일인 경우: 취득월과 연속하여 다음달 근로 여부에 따라 결정</li>
//                         <li>연속 근로 시 누적 60시간 이상 → 최종 근로일의 다음날</li>
//                         <li>60시간 미만 근로월 발생 시 → 해당 월의 1일</li>
//                       </ul>
//                     </div>
//                     <div>
//                       📌 <strong>산재보험</strong>: 근무 종료 →{" "}
//                       <strong>상실일: 마지막 근무일의 다음날</strong>
//                     </div>
//                     <div>
//                       📌 <strong>고용보험</strong>: 근무 종료 →{" "}
//                       <strong>상실일: 마지막 근무일의 다음날</strong>
//                     </div>
//                   </div>
//                 </div>
//               </>
//             ) : selectedWorker && !selectedWorkerDetails ? (
//               <div className="flex items-center justify-center h-96 text-orange-500">
//                 <div className="text-center">
//                   <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500 mx-auto mb-4"></div>
//                   <div>근로자 정보를 불러오는 중입니다...</div>
//                   <div className="text-sm text-gray-500 mt-2">
//                     선택된 근로자 ID: {selectedWorker}
//                   </div>
//                 </div>
//               </div>
//             ) : (
//               <div className="flex items-center justify-center h-96 text-gray-500">
//                 <div className="text-center">
//                   <div className="text-lg mb-2">
//                     {selectedSite
//                       ? "좌측에서 근로자를 선택해주세요."
//                       : "공사현장을 먼저 선택해주세요."}
//                   </div>
//                 </div>
//               </div>
//             )}
//           </div>
//         </div>

//         {/* 근로자 등록 모달 */}
//         <WorkerAddModal
//           isOpen={isAddModalOpen}
//           onClose={() => setIsAddModalOpen(false)}
//           siteId={selectedSite}
//           selectedYearMonth={yearMonth}
//           onSuccess={handleWorkerAddSuccess}
//         />

//         {/* 배정되지 않은 근로자 배정 모달 */}
//         {showWorkerAssignModal && (
//           <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
//             <div className="bg-white rounded-lg p-6 w-96 max-w-lg max-h-[80vh] overflow-y-auto">
//               <div className="flex justify-between items-center mb-4">
//                 <h2 className="text-xl font-bold">근로자 배정</h2>
//                 <button
//                   className="text-gray-500 hover:text-gray-700"
//                   onClick={() => setShowWorkerAssignModal(false)}
//                 >
//                   <X size={20} />
//                 </button>
//               </div>

//               {!selectedSite ? (
//                 <div className="py-6 text-center">
//                   <div className="text-red-500 font-medium mb-4">공사현장을 선택해주세요</div>
//                   <button
//                     className="px-4 py-2 bg-gray-200 rounded text-gray-700 hover:bg-gray-300"
//                     onClick={() => setShowWorkerAssignModal(false)}
//                   >
//                     닫기
//                   </button>
//                 </div>
//               ) : (
//                 <>
//                   <p className="text-sm text-gray-500 mb-4">
//                     현재 현장에 배정되지 않은 근로자 목록입니다.
//                   </p>

//                   <div className="mb-4">
//                     <input
//                       type="text"
//                       placeholder="근로자 검색..."
//                       className="w-full px-3 py-2 border rounded"
//                       value={workerSearchTerm}
//                       onChange={(e) => setWorkerSearchTerm(e.target.value)}
//                     />
//                   </div>

//                   {unassignedWorkers.length === 0 ? (
//                     <p className="text-center py-4 text-gray-500">배정 가능한 근로자가 없습니다</p>
//                   ) : (
//                     <div className="space-y-2 mb-4 max-h-60 overflow-y-auto">
//                       {unassignedWorkers
//                         .filter((worker) =>
//                           worker.name.toLowerCase().includes(workerSearchTerm.toLowerCase())
//                         )
//                         .map((worker) => (
//                           <div
//                             key={worker.worker_id}
//                             className="flex items-center justify-between p-2 border rounded hover:bg-gray-50"
//                           >
//                             <div>
//                               <div className="font-medium">{worker.name}</div>
//                               <div className="text-xs text-gray-500">
//                                 {formatResidentNumber(worker.resident_number)}
//                               </div>
//                             </div>
//                             <button
//                               className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
//                               onClick={() => assignWorkerToSite(worker.worker_id, selectedSite)}
//                             >
//                               배정
//                             </button>
//                           </div>
//                         ))}
//                     </div>
//                   )}

//                   <div className="flex justify-end">
//                     <button
//                       className="px-4 py-2 bg-gray-200 rounded text-gray-700 hover:bg-gray-300"
//                       onClick={() => setShowWorkerAssignModal(false)}
//                     >
//                       닫기
//                     </button>
//                   </div>
//                 </>
//               )}
//             </div>
//           </div>
//         )}

//         {/* Floating Save Button */}
//         {selectedWorker && selectedWorkerDetails && (
//           <div className="fixed bottom-6 right-6 z-50">
//             <button
//               className={`flex items-center justify-center rounded-full w-16 h-16 shadow-xl ${
//                 isDirty
//                   ? "bg-gradient-to-br from-red-400 to-red-600 hover:from-red-500 hover:to-red-700"
//                   : "bg-gradient-to-br from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700"
//               } text-white transform transition-all duration-300 hover:scale-110 hover:shadow-2xl ${
//                 isLoading || isReportLoading ? "opacity-80" : ""
//               }`}
//               onClick={handleSaveAndRefresh}
//               disabled={isLoading || isReportLoading}
//               title={isDirty ? "변경사항 저장" : "저장됨"}
//             >
//               {isLoading || isReportLoading ? (
//                 <div className="animate-spin h-7 w-7 border-3 border-white border-t-transparent rounded-full"></div>
//               ) : (
//                 <Save size={28} strokeWidth={1.5} />
//               )}
//             </button>

//             <div
//               className={`absolute -top-12 right-0 whitespace-nowrap rounded-lg px-4 py-2 text-white text-sm font-semibold shadow-md ${
//                 isDirty
//                   ? "bg-gradient-to-r from-red-500 to-red-600"
//                   : "bg-gradient-to-r from-blue-500 to-blue-600"
//               } transition-opacity duration-200 ${
//                 isLoading || isReportLoading ? "opacity-90" : ""
//               }`}
//             >
//               {isLoading || isReportLoading ? "저장 중..." : isDirty ? "변경사항 저장" : "저장됨"}
//               <div
//                 className={`absolute h-3 w-3 rotate-45 ${
//                   isDirty ? "bg-red-600" : "bg-blue-600"
//                 } bottom-[-6px] right-6`}
//               ></div>
//             </div>
//           </div>
//         )}

//         <ToastContainer
//           position="top-center" // 알람 위치 지정
//         />
//       </div>
//     </RoleGuard>
//   );
// }

// export default WorkTimePage;
