// file: app/dashboard/work_time/page.js
"use client";

import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/store/authStore";
import RoleGuard from "@/components/RoleGuard";
import useCodeStore from "@/lib/store/codeStore";
import useWorkTimeStore from "@/lib/store/workTimeStore";
import { useShallow } from "zustand/react/shallow";
import WorkerAddModal from "./components/WorkerAddModal";
import CalendarWorkTime from "./components/CalendarWorkTime"; // 새로운 달력 컴포넌트 import
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
import useWorkHistoryStore from "@/lib/store/workHistoryStore";
import useInsuranceStatusStore from "@/lib/store/insuranceStatusStore";

function WorkTimePage() {
  const { user } = useAuthStore();
  const { getCodeList } = useCodeStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [showSiteSelector, setShowSiteSelector] = useState(null);

  // WorkTimeStore에서 상태 및 액션 가져오기
  const {
    // 상태
    workers,
    sites,
    selectedSite,
    selectedWorker,
    yearMonth,

    // 로딩 상태
    // isLoading,
    isDetailLoading,
    isReportLoading,

    // 액션
    initialize,
    setSelectedSite,
    fetchWorkerDetails,
    setYearMonth,
    updateWorkDetail,
    registerWorkerToSite,
    saveWorkRecords,
  } = useWorkTimeStore();

  // 코드 데이터 저장용 상태
  const [nationalityCodes, setNationalityCodes] = useState([]);
  const [residenceStatusCodes, setResidenceStatusCodes] = useState([]);
  const [jobCodes, setJobCodes] = useState([]);

  const [unassignedWorkers, setUnassignedWorkers] = useState([]);
  const [showWorkerAssignModal, setShowWorkerAssignModal] = useState(false);
  const [workerSearchTerm, setWorkerSearchTerm] = useState(""); // 배정 모달 검색어 (추가)
  const [isLoading, setIsLoading] = useState(false);
  // const [isLoading, setIsLoading] = useState(false);
  // 저장 상태 추적을 위한 새로운 상태 변수들
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  // useShallow를 사용하여 선택자 함수 최적화
  const workerDetails = useWorkTimeStore(
    useShallow((state) => state.workerDetails[state.selectedWorker] || null)
  );

  // 모달에서 근로자 등록 완료 후 호출될 콜백
  const handleWorkerAddSuccess = (newWorker) => {
    // 근로자 목록 새로고침
    if (selectedSite) {
      useWorkTimeStore.getState().fetchWorkers(selectedSite);
    }
  };

  // 주민등록번호 형식화 함수 (누락된 것 같아 추가)
  const getFormattedResidentNumber = (num) => {
    if (!num) return "-";
    if (num.length === 13) {
      return `${num.substring(0, 6)}-${num.substring(6, 13)}`;
    }
    return num;
  };

  const workReportData = useWorkTimeStore(
    useShallow((state) => {
      if (!state.selectedWorker || !state.selectedSite || !state.yearMonth) return null;
      const cacheKey = `${state.selectedWorker}-${state.selectedSite}-${state.yearMonth}`;
      return state.workReports[cacheKey] || null;
    })
  );

  const prevMonthWorkData = useWorkTimeStore(
    useShallow((state) => {
      if (!state.selectedWorker || !state.selectedSite || !state.yearMonth) return null;
      const currentDate = new Date(`${state.yearMonth}-01`);
      const prevMonth = new Date(currentDate);
      prevMonth.setMonth(currentDate.getMonth() - 1);
      const prevYearMonth = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(
        2,
        "0"
      )}`;
      const cacheKey = `${state.selectedWorker}-${state.selectedSite}-${prevYearMonth}`;
      return state.prevMonthWork[cacheKey] || { days: 0, hours: 0, startDate: "없음" };
    })
  );

  const insuranceStatusData = useWorkTimeStore(
    useShallow((state) => {
      if (!state.selectedWorker || !state.selectedSite) return null;
      const cacheKey = `${state.selectedWorker}-${state.selectedSite}`;
      return (
        state.insuranceStatus[cacheKey] || {
          national_pension: "해당사항없음",
          health_insurance: "해당사항없음",
          employment_insurance: "해당사항없음",
          industrial_accident: "해당사항없음",
        }
      );
    })
  );

  const formatResidentNumber = (num) => {
    if (!num) return "-";
    return num.replace(/^(\d{6})(\d{7})$/, "$1-$2");
  };

  const formatPhoneNumber = (num) => {
    if (!num) return "-";
    return num.replace(/^(\d{2,3})(\d{3,4})(\d{4})$/, "$1-$2-$3");
  };
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

  // 초기화
  useEffect(() => {
    if (user) {
      initialize(user.id);
    }
  }, [user, initialize]);

  // 사이트 변경 시 검색어 초기화 및 근로자 목록 갱신
  useEffect(() => {
    setSearchTerm("");
    if (selectedSite) {
      useWorkTimeStore.getState().fetchWorkers(selectedSite);
    }
  }, [selectedSite]);

  // 검색어 변경 시 근로자 목록 필터링
  useEffect(() => {
    if (selectedSite) {
      const debouncedFetch = setTimeout(() => {
        useWorkTimeStore.getState().fetchWorkers(selectedSite, searchTerm);
      }, 300);

      return () => clearTimeout(debouncedFetch);
    }
  }, [searchTerm, selectedSite]);

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
    // 선택된 근로자가 있으면 초기화 (Store 상태 직접 업데이트)
    if (selectedWorker) {
      useWorkTimeStore.setState((state) => ({
        ...state,
        selectedWorker: null,
      }));
    }

    // 검색어 초기화
    setSearchTerm("");

    // 공사현장이 선택된 경우, 해당 현장의 근로자 목록 갱신
    if (selectedSite) {
      useWorkTimeStore.getState().fetchWorkers(selectedSite);
    }
  }, [selectedSite, yearMonth]);

  // 모달이 열릴 때 실행
  useEffect(() => {
    if (showWorkerAssignModal && selectedSite) {
      fetchUnassignedWorkers();
    }
  }, [showWorkerAssignModal, selectedSite]);

  // 페이지 이탈 시 자동 저장 처리
  useEffect(() => {
    // 페이지 이탈 시 저장되지 않은 변경사항이 있을 경우 자동 저장
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && isDirty && autoSaveEnabled) {
        // 페이지가 숨겨질 때(다른 페이지로 이동 등) 자동 저장
        if (selectedWorker && selectedSite && yearMonth && workReportData) {
          console.log("페이지 이탈 감지, 자동 저장 실행");

          // 로컬 스토리지에 임시 저장 (페이지 이탈 후 자동 저장이 실패할 수 있으므로)
          try {
            const cacheKey = `workrecord_${selectedWorker}_${selectedSite}_${yearMonth}`;
            localStorage.setItem(cacheKey, JSON.stringify(workReportData.workDetails));
            localStorage.setItem(`${cacheKey}_isDirty`, "true");
          } catch (error) {
            console.error("로컬 스토리지 저장 오류:", error);
          }

          // 서버에 저장
          saveWorkRecords(selectedWorker, selectedSite, yearMonth, workReportData.workDetails).then(
            (result) => {
              if (result.success) {
                console.log("페이지 이탈 시 자동 저장 성공");
                // 페이지 이탈 시에는 toast가 표시되지 않을 수 있음

                // 로컬 스토리지 상태 업데이트
                const cacheKey = `workrecord_${selectedWorker}_${selectedSite}_${yearMonth}`;
                const now = Date.now();
                localStorage.setItem(`${cacheKey}_lastSaved`, now.toString());
                localStorage.setItem(`${cacheKey}_isDirty`, "false");
              } else {
                console.error("페이지 이탈 시 자동 저장 실패:", result.message);
              }
            }
          );
        }
      }
    };

    // 페이지 이탈 이벤트 리스너 등록
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

        // 이전에 더티 상태였으면 복원 (다시 돌아왔을 때도 저장이 필요하다는 것을 표시)
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
  /**
   *
   *
   */
  // 근로자를 현장에 등록하는 핸들러
  const handleRegisterWorker = async () => {
    if (!selectedWorker || !selectedSite) {
      toast.error("근로자와 공사현장을 선택해주세요.");
      return;
    }

    const result = await registerWorkerToSite(selectedWorker, selectedSite);
    toast.info(result.message);
  };

  // 근무 기록 저장 핸들러
  // const handleSaveWorkRecords = async () => {
  //   if (!selectedWorker || !selectedSite || !yearMonth || !workReportData) {
  //     alert("근로자, 공사현장, 근무년월을 모두 선택해주세요.");
  //     return;
  //   }

  //   const result = await saveWorkRecords(
  //     selectedWorker,
  //     selectedSite,
  //     yearMonth,
  //     workReportData.workDetails
  //   );
  //   alert(result.message);
  // };

  // 근무 기록 변경 핸들러
  // 근무 기록 변경 핸들러 - 수정된 부분
  const handleChange = (index, field, value) => {
    // 현재 기록의 지급 상태 확인
    const dayData = workReportData?.workDetails[index] || {};

    // 지급완료된 기록이면 수정 불가
    if (dayData.payment_status === "paid") {
      // 사용자에게 알림 (토스트 메시지)
      toast.warn("지급완료된 근무기록은 수정할 수 없습니다.");
      return;
    }

    // 아니면 기존 로직 실행
    updateWorkDetail(index, field, value);
    setIsDirty(true);

    // 더티 상태를 로컬 스토리지에도 저장
    if (selectedWorker && selectedSite && yearMonth) {
      try {
        const cacheKey = `workrecord_${selectedWorker}_${selectedSite}_${yearMonth}`;
        localStorage.setItem(`${cacheKey}_isDirty`, "true");
      } catch (error) {
        console.error("로컬 스토리지 저장 오류:", error);
      }
    }
  };

  // 코드 값으로 이름 가져오기
  const getCodeName = (codeType, codeValue) => {
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
  };

  // 숫자 포맷팅 함수
  const formatNumber = (value) => {
    if (!value) return "";
    const cleaned = value.replace(/,/g, "").replace(/\D/g, "");
    return cleaned.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  };
  // 현장 변경 토글
  const toggleSiteSelector = (workerId, event) => {
    event.stopPropagation();
    setShowSiteSelector(showSiteSelector === workerId ? null : workerId);
  };

  /**
   * 
  
   */

  // 현장등록취소 함수 추가
  const handleRemoveWorkerFromSite = async (workerId, event) => {
    event.stopPropagation();

    if (!confirm("정말 이 근로자의 현장 등록을 취소하시겠습니까?")) {
      return;
    }

    try {
      // 근로자의 registration 유형 레코드만 조회
      const { data: registrationRecords, error: recordsError } = await supabase
        .from("work_records")
        .select("record_id")
        .eq("worker_id", workerId)
        .eq("site_id", selectedSite)
        .eq("status", "registration");

      if (recordsError) throw recordsError;

      console.log("근로자 배정 취소 년월", yearMonth);
      // 실제 근무 기록이 있는지 확인
      const { data: actualRecords, error: actualError } = await supabase
        .from("work_records")
        .select("record_id")
        .eq("worker_id", workerId)
        .eq("site_id", selectedSite)
        .eq("registration_month", yearMonth)
        .neq("status", "registration");

      if (actualError) throw actualError;

      // 실제 근무 기록이 있으면 취소 불가
      if (actualRecords && actualRecords.length > 0) {
        toast.error("이 근로자는 해당 현장에 실제 근무 기록이 있어 등록을 취소할 수 없습니다.");
        return;
      }

      // 등록 기록 삭제
      if (registrationRecords && registrationRecords.length > 0) {
        const recordIds = registrationRecords.map((r) => r.record_id);

        const { error: deleteError } = await supabase
          .from("work_records")
          .delete()
          .in("record_id", recordIds);

        if (deleteError) throw deleteError;

        toast.success("현장 등록이 취소되었습니다.");

        // 근로자 목록 갱신
        if (selectedSite) {
          await useWorkTimeStore.getState().fetchWorkers(selectedSite);
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
  // 현장 변경 처리
  // 현장 변경 처리
  const changeSite = async (workerId, siteId, siteName, event) => {
    event.stopPropagation();

    try {
      // 1. 기존 현장 정보 가져오기
      const { data: currentRecords, error: recordsError } = await supabase
        .from("work_records")
        .select("record_id, site_id, status")
        .eq("worker_id", workerId);

      if (recordsError) throw recordsError;

      // 2. 변경하려는 현장이 이미 배정되어 있는지 확인
      if (currentRecords.some((record) => record.site_id === parseInt(siteId))) {
        toast.info(`이미 ${siteName} 현장에 배정되어 있습니다.`);
        setShowSiteSelector(null);
        return;
      }

      // 3. 실제 근무 기록(status가 'registration'이 아닌)이 있는지 확인
      const hasWorkRecords = currentRecords.some((record) => record.status !== "registration");

      // 4. 기존 등록용 레코드 삭제
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

      // 5. 새 현장 배정 레코드 생성
      const todayDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD 형식

      const { error: insertError } = await supabase.from("work_records").insert({
        worker_id: workerId,
        site_id: siteId,
        work_date: todayDate,
        work_hours: 0,
        work_type: "registration",
        daily_wage: 0,
        status: "registration",
      });

      if (insertError) throw insertError;

      // 6. 성공 메시지 표시 - 근무 기록이 있는 경우 특별 메시지
      const workerName = workers.find((w) => w.worker_id === workerId)?.name || "근로자";

      if (hasWorkRecords) {
        toast.success(
          `근로시간과 임금이 있는 근로자는 현장이 추가됩니다. ${workerName}님에게 ${siteName} 현장이 추가되었습니다.`
        );
      } else {
        toast.info(`${workerName}님의 현장이 ${siteName}(으)로 변경되었습니다.`);
      }

      // 7. 현재 보고 있는 현장의 근로자 목록 업데이트
      if (selectedSite) {
        await useWorkTimeStore.getState().fetchWorkers(selectedSite);
      }

      setShowSiteSelector(null);
    } catch (error) {
      console.error("현장 변경 오류:", error);
      toast.error("현장 변경 중 오류가 발생했습니다.");
    }
  };

  // 배정되지 않은 근로자 가져오기
  const fetchUnassignedWorkers = async () => {
    if (!selectedSite) return;

    try {
      setIsLoading(true);

      // 선택한 년월 사용 (yearMonth 상태 변수 사용)
      const selectedYearMonth = yearMonth; // 이미 'YYYY-MM' 형식으로 저장되어 있음

      // 1. 로그인한 사용자의 회사 ID 가져오기
      const { data: userCompany, error: companyError } = await supabase
        .from("user_companies")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (companyError) throw companyError;

      if (!userCompany?.company_id) {
        throw new Error("회사 정보를 찾을 수 없습니다.");
      }

      // 2. 회사의 모든 현장 ID 가져오기
      const { data: companySites, error: sitesError } = await supabase
        .from("construction_sites")
        .select("site_id")
        .eq("company_id", userCompany.company_id);

      if (sitesError) throw sitesError;

      const companySiteIds = companySites.map((site) => site.site_id);

      // 3. 회사에 소속된 모든 근로자 ID 가져오기 (선택한 월 상관없이)
      const { data: allWorkRecords, error: recordsError } = await supabase
        .from("work_records")
        .select("worker_id, site_id")
        .in("site_id", companySiteIds);

      if (recordsError) throw recordsError;

      // 중복 제거하여 모든 근로자 ID 목록 생성
      const allCompanyWorkerIds = [...new Set(allWorkRecords.map((record) => record.worker_id))];

      // 4. 현재 현장에 선택한 월에 배정된 근로자 ID 가져오기
      const { data: currentSiteRecords, error: currentSiteError } = await supabase
        .from("work_records")
        .select("worker_id")
        .eq("site_id", selectedSite)
        .eq("registration_month", selectedYearMonth); // 선택한 월에 등록된 근로자만 검색

      if (currentSiteError) throw currentSiteError;

      const currentSiteWorkerIds = new Set(currentSiteRecords.map((record) => record.worker_id));

      // 5. 회사에 속한 근로자 중 현재 현장의 선택한 월에 배정되지 않은 근로자 ID 필터링
      const unassignedWorkerIds = allCompanyWorkerIds.filter((id) => !currentSiteWorkerIds.has(id));

      if (unassignedWorkerIds.length === 0) {
        setUnassignedWorkers([]);
        return;
      }

      // 6. 배정되지 않은 근로자 정보 가져오기
      const { data: workerDetails, error: workersError } = await supabase
        .from("workers")
        .select("*")
        .in("worker_id", unassignedWorkerIds)
        .order("name");

      if (workersError) throw workersError;

      setUnassignedWorkers(workerDetails || []);
    } catch (error) {
      console.error("배정되지 않은 근로자 조회 오류:", error);
      toast.error("배정 가능한 근로자 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  // 배정되지 않은 근로자를 선택하면 현장에 배정
  const assignWorkerToSite = async (workerId, siteId) => {
    if (!workerId || !siteId) return;

    try {
      setIsLoading(true); // 컴포넌트 로컬 상태 사용

      // 오늘 날짜 생성
      const todayDate = new Date().toISOString().split("T")[0];

      // 새 등록 레코드 생성
      const { error } = await supabase.from("work_records").insert({
        worker_id: workerId,
        site_id: siteId,
        work_date: todayDate,
        work_hours: 0,
        work_type: "registration",
        daily_wage: 0,
        status: "registration",
        registration_month: yearMonth, // 현재 선택된 년월 전달
      });

      if (error) throw error;

      // 성공 메시지
      toast.success("근로자가 현장에 성공적으로 배정되었습니다.");

      // 모달 닫기
      setShowWorkerAssignModal(false);

      // 근로자 목록 새로고침
      if (selectedSite) {
        await useWorkTimeStore.getState().fetchWorkers(selectedSite);
      }
    } catch (error) {
      console.error("근로자 배정 오류:", error);
      toast.error("근로자 배정 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false); // 컴포넌트 로컬 상태 사용
    }
  };

  // 총계 계산
  const workDetails =
    workReportData?.workDetails ||
    Array.from({ length: 31 }, () => ({
      hours: "",
      extended: false,
      holiday: false,
      night: false,
      wage: "",
    }));

  const totalHours = workDetails.reduce((sum, day) => sum + Number(day.hours || 0), 0);
  const totalWage = workDetails.reduce(
    (sum, day) => sum + Number((day.wage || "").replace(/,/g, "") || 0),
    0
  );
  const totalWorkDays = workDetails.filter((day) => day.hours).length;
  const extendedDays = workDetails.filter((day) => day.extended).length;
  const holidayDays = workDetails.filter((day) => day.holiday).length;
  const nightDays = workDetails.filter((day) => day.night).length;

  // 사대보험 가입여부 체크
  // /***

  //  */
  // 국민연금 자격 여부 개선 - 8일 이상 또는 고시소득 220만원 이상 조건 추가
  const calculateInsuranceEligibility = () => {
    // 연령 계산 - 주민번호 첫 6자리로부터 생년월일 추출
    const calculateAge = () => {
      if (!workerDetails?.resident_number) return null;

      const residentNum = workerDetails.resident_number;
      // 주민번호 앞 6자리(YYMMDD) 추출
      const birthDate = residentNum.substring(0, 6);
      // 주민번호 7번째 자리 (성별코드)
      const genderCode = residentNum.substring(6, 7);

      let birthYear;
      // 성별코드가 1,2면 1900년대, 3,4면 2000년대 출생
      if (genderCode === "1" || genderCode === "2" || genderCode === "5" || genderCode === "6") {
        birthYear = 1900 + parseInt(birthDate.substring(0, 2));
      } else {
        birthYear = 2000 + parseInt(birthDate.substring(0, 2));
      }

      const currentYear = new Date().getFullYear();
      return currentYear - birthYear;
    };

    const age = calculateAge();
    const isOver60 = age !== null && age >= 60;
    const isOver65 = age !== null && age >= 65;

    // 외국인 체류자격 확인
    const residenceStatus = workerDetails?.residence_status_code || "";
    const isF2F5F6 = ["F2", "F5", "F6"].includes(residenceStatus);
    const isE9H2 = ["E9", "H2"].includes(residenceStatus);
    const isF4 = residenceStatus === "F4";

    // 고시소득 계산 - 총 임금으로 추정
    const totalIncome = totalWage;
    const meetsIncomeThreshold = totalIncome >= 2200000; // 220만원 이상

    // 국민연금 자격 여부 - 60세 미만이면서 (8일 이상 근무 또는 고시소득 220만원 이상)
    const isNationalPensionEligible = !isOver60 && (totalWorkDays >= 8 || meetsIncomeThreshold);

    // 국민연금 가입 사유
    let nationalPensionReason = "";
    if (isNationalPensionEligible) {
      if (totalWorkDays >= 8 && meetsIncomeThreshold) {
        nationalPensionReason = "8일 이상 근무 및 고시소득 이상";
      } else if (totalWorkDays >= 8) {
        nationalPensionReason = "8일 이상 근무";
      } else if (meetsIncomeThreshold) {
        nationalPensionReason = "고시소득(220만원) 이상";
      }
    }

    // 건강보험 자격 여부
    const isHealthInsuranceEligible = totalHours >= 60;

    // 산재보험 자격 여부 - 근무일수와 관계없이 항상 가입
    const isIndustrialAccidentEligible = totalWorkDays > 0;

    // 고용보험 자격 여부 체류자격별 분기
    let employmentInsuranceStatus = "";

    if (totalWorkDays > 0) {
      if (isF2F5F6) {
        employmentInsuranceStatus = "당연적용";
      } else if (isE9H2) {
        employmentInsuranceStatus = isOver65
          ? "고용안정·직업능력개발만 당연적용"
          : "실업급여는 임의가입, 고용안정·직업능력개발은 당연적용";
      } else if (isF4) {
        employmentInsuranceStatus = "임의가입";
      } else if (isOver65) {
        employmentInsuranceStatus = "고용안정·직업능력개발만 당연적용";
      } else {
        employmentInsuranceStatus = "가입 필요";
      }
    } else {
      employmentInsuranceStatus = "해당 없음";
    }

    // 고용보험 요약 설명 (배지용)
    let employmentInsuranceShortDesc = "";
    if (totalWorkDays > 0) {
      if (isF2F5F6) {
        employmentInsuranceShortDesc = "체류자격 당연적용";
      } else if (isE9H2) {
        employmentInsuranceShortDesc = isOver65 ? "65세 이상 일부적용" : "일부 당연적용";
      } else if (isF4) {
        employmentInsuranceShortDesc = "임의가입 대상";
      } else if (isOver65) {
        employmentInsuranceShortDesc = "65세 이상 일부적용";
      } else {
        employmentInsuranceShortDesc = "가입 필요";
      }
    }

    // 계산 결과 반환
    return {
      age,
      isOver60,
      isOver65,
      residenceStatus,
      isF2F5F6,
      isE9H2,
      isF4,
      meetsIncomeThreshold,
      isNationalPensionEligible,
      nationalPensionReason,
      isHealthInsuranceEligible,
      isIndustrialAccidentEligible,
      employmentInsuranceStatus,
      employmentInsuranceShortDesc,
    };
  };

  // 요약 정보 렌더링 함수 (그리드 스타일)
  const renderInsuranceEligibilitySummary = () => {
    const eligibility = calculateInsuranceEligibility();

    return (
      <div className="grid grid-cols-4 gap-4 text-base font-normal mb-4">
        <div className="border rounded p-2 bg-blue-50">
          <span className="font-medium">국민연금 자격 여부:</span>{" "}
          {eligibility.isNationalPensionEligible ? (
            <span className="text-blue-600 font-bold">가입 대상</span>
          ) : eligibility.isOver60 ? (
            <span className="text-orange-500">60세 이상 미해당</span>
          ) : (
            <span className="text-gray-500">해당 없음</span>
          )}
          {eligibility.isNationalPensionEligible && (
            <div className="text-xs text-gray-600 mt-1">
              취득일: 최초 근무일
              <div className="mt-1 text-green-600">{eligibility.nationalPensionReason}</div>
            </div>
          )}
        </div>

        <div className="border rounded p-2 bg-blue-50">
          <span className="font-medium">건강보험 자격 여부:</span>{" "}
          {eligibility.isHealthInsuranceEligible ? (
            <span className="text-blue-600 font-bold">가입 대상</span>
          ) : (
            <span className="text-gray-500">해당 없음</span>
          )}
          {eligibility.isHealthInsuranceEligible && (
            <div className="text-xs text-gray-600 mt-1">취득일: 최초 근무일</div>
          )}
        </div>

        <div className="border rounded p-2 bg-blue-50">
          <span className="font-medium">산재보험:</span>{" "}
          {eligibility.isIndustrialAccidentEligible ? (
            <span className="text-blue-600 font-bold">가입 필요</span>
          ) : (
            <span className="text-gray-500">해당 없음</span>
          )}
          {eligibility.isIndustrialAccidentEligible && (
            <div className="text-xs text-gray-600 mt-1">취득일: 근무 시작일</div>
          )}
        </div>

        <div className="border rounded p-2 bg-blue-50">
          <span className="font-medium">고용보험:</span>{" "}
          {eligibility.employmentInsuranceStatus === "해당 없음" ? (
            <span className="text-gray-500">해당 없음</span>
          ) : (
            <span className="text-blue-600 font-bold">{eligibility.employmentInsuranceStatus}</span>
          )}
          {totalWorkDays > 0 && eligibility.employmentInsuranceStatus !== "해당 없음" && (
            <div className="text-xs text-gray-600 mt-1">
              {eligibility.isF4 || eligibility.isE9H2 ? "임의가입 가능" : "취득일: 근무 시작일"}
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleSaveAndRefresh = async () => {
    setIsLoading(true);

    try {
      // 지급완료된 항목 개수 계산
      const paidItemsCount =
        workReportData?.workDetails?.filter(
          (item) => item.payment_status === "paid" && (item.hours || item.wage)
        ).length || 0;

      // 원래 저장 함수 호출
      const result = await saveWorkRecords(
        selectedWorker,
        selectedSite,
        yearMonth,
        workReportData.workDetails
      );

      if (result.success) {
        // 저장 상태 업데이트
        setIsDirty(false);
        const now = new Date();
        setLastSavedTime(now);

        // 로컬 스토리지에 저장 상태 기록
        const cacheKey = `workrecord_${selectedWorker}_${selectedSite}_${yearMonth}`;
        localStorage.setItem(cacheKey, JSON.stringify(workReportData.workDetails));
        localStorage.setItem(`${cacheKey}_lastSaved`, now.getTime().toString());
        localStorage.setItem(`${cacheKey}_isDirty`, "false");

        // 지급완료 항목에 대한 안내 메시지 추가
        let message = result.message;
        if (paidItemsCount > 0 && !message.includes("지급완료")) {
          message = `${result.message} (지급완료된 ${paidItemsCount}건의 기록은 수정되지 않았습니다.)`;
        }

        toast.success(message);

        // 데이터 변경 기록 및 관련 로직은 기존 코드 유지
        try {
          // ...기존 데이터 변경 알림 및 캐시 무효화 로직...
        } catch (e) {
          console.error("데이터 변경 알림 발생 중 오류:", e);
        }
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
  // 상태 박스 렌더링 함수 (DB 상태와 계산된 상태 비교)
  // const renderInsuranceStatusBox = () => {
  //   const eligibility = calculateInsuranceEligibility();

  //   return (
  //     <div className="mt-8 border rounded bg-white p-2 space-y-1">
  //       <div className="font-semibold mb-1">📌 4대보험</div>

  //       {/* 국민연금 */}
  //       <div className="flex items-center justify-between">
  //         <div>
  //           국민연금:{" "}
  //           {insuranceStatusData?.national_pension === "가입대상" ? (
  //             <span className="text-blue-500 font-medium">가입대상</span>
  //           ) : insuranceStatusData?.national_pension === "가입상태" ? (
  //             <span className="text-red-500 font-medium">가입상태</span>
  //           ) : (
  //             <span>해당사항없음</span>
  //           )}
  //         </div>

  //         {/* 계산된 자격 여부 표시 */}
  //         {eligibility.isNationalPensionEligible &&
  //           insuranceStatusData?.national_pension !== "가입상태" && (
  //             <div className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
  //               {eligibility.nationalPensionReason}
  //             </div>
  //           )}
  //       </div>

  //       {/* 건강보험 */}
  //       <div className="flex items-center justify-between">
  //         <div>
  //           건강보험:{" "}
  //           {insuranceStatusData?.health_insurance === "가입대상" ? (
  //             <span className="text-blue-500 font-medium">가입대상</span>
  //           ) : insuranceStatusData?.health_insurance === "가입상태" ? (
  //             <span className="text-red-500 font-medium">가입상태</span>
  //           ) : (
  //             <span>해당사항없음</span>
  //           )}
  //         </div>

  //         {/* 계산된 자격 여부 표시 */}
  //         {eligibility.isHealthInsuranceEligible &&
  //           insuranceStatusData?.health_insurance !== "가입상태" && (
  //             <div className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
  //               60시간 이상 근무
  //             </div>
  //           )}
  //       </div>

  //       {/* 고용보험 */}
  //       <div className="flex items-center justify-between">
  //         <div>
  //           고용보험:{" "}
  //           {insuranceStatusData?.employment_insurance === "가입대상" ? (
  //             <span className="text-blue-500 font-medium">가입대상</span>
  //           ) : insuranceStatusData?.employment_insurance === "가입상태" ? (
  //             <span className="text-red-500 font-medium">가입상태</span>
  //           ) : (
  //             <span>해당사항없음</span>
  //           )}
  //         </div>

  //         {/* 계산된 자격 여부 표시 */}
  //         {totalWorkDays > 0 && insuranceStatusData?.employment_insurance !== "가입상태" && (
  //           <div className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
  //             {eligibility.employmentInsuranceShortDesc}
  //           </div>
  //         )}
  //       </div>

  //       {/* 산재보험 */}
  //       <div className="flex items-center justify-between">
  //         <div>
  //           산재보험:{" "}
  //           {insuranceStatusData?.industrial_accident === "가입대상" ? (
  //             <span className="text-blue-500 font-medium">가입대상</span>
  //           ) : insuranceStatusData?.industrial_accident === "가입상태" ? (
  //             <span className="text-red-500 font-medium">가입상태</span>
  //           ) : (
  //             <span>해당사항없음</span>
  //           )}
  //         </div>

  //         {/* 계산된 자격 여부 표시 */}
  //         {eligibility.isIndustrialAccidentEligible &&
  //           insuranceStatusData?.industrial_accident !== "가입상태" && (
  //             <div className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
  //               근무 시작 시 가입 필요
  //             </div>
  //           )}
  //       </div>
  //     </div>
  //   );
  // };

  return (
    <RoleGuard requiredPermission="VIEW_DAILY_REPORTS">
      <div className="space-y-4">
        {isLoading && (
          <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 z-50">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
            <span className="ml-3 text-white">처리 중...</span>
          </div>
        )}

        <div className="flex items-center gap-4">
          <select
            className="w-48 px-3 py-2 border border-gray-300 rounded bg-white"
            value={selectedSite || ""}
            onChange={(e) => setSelectedSite(e.target.value)}
          >
            <option value="">공사현장 선택</option>
            {sites.map((site) => (
              <option key={site.site_id} value={site.site_id}>
                {site.site_name}
              </option>
            ))}
          </select>

          <input
            type="month"
            className="w-40 px-3 py-2 border border-gray-300 rounded"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
            max={new Date().toISOString().slice(0, 7)} // 현재 년월까지만 선택 가능 (YYYY-MM 형식)
          />

          {/* 근로자 배정 버튼 */}
          <div className="relative">
            <button
              className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-blue-600 flex items-center"
              onClick={() => setShowWorkerAssignModal(true)}
              title="근로자등록은 되어 있으나 현재 현장에 배정되지 않은 근로자 배정"
            >
              <UserPlus size={18} className="mr-1" />
              근로자 배정
            </button>
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
            <div className="space-y-2">
              {workers.length > 0 ? (
                workers.map((worker) => (
                  <div key={worker.worker_id} className="relative">
                    <div
                      className={`p-2 rounded hover:bg-gray-100 cursor-pointer transition-colors flex justify-between items-center ${
                        selectedWorker === worker.worker_id
                          ? "bg-blue-100 border-l-4 border-blue-500"
                          : ""
                      } ${worker.hasWorkHistory ? "border-l-4 border-green-500" : ""} 
                      ${
                        worker.isRegistered && !worker.hasWorkHistory
                          ? "border-l-4 border-yellow-500"
                          : ""
                      } ${worker.notInSite ? "opacity-60 border-dashed border" : ""}`}
                      onClick={() => fetchWorkerDetails(worker.worker_id)}
                    >
                      <div className="w-96  truncate pr-2">
                        {worker.name}
                        {/* {worker.hasWorkHistory && (
                          <span className="ml-2 text-xs text-green-600">⚒️ 근무이력</span>
                        )}
                        {worker.isRegistered && !worker.hasWorkHistory && (
                          <span className="ml-2 text-xs text-yellow-600">📋 등록됨</span>
                        )}
                        {worker.notInSite && (
                          <span className="ml-2 text-xs text-gray-500">🔄 등록 필요</span>
                        )} */}
                      </div>

                      <button
                        className="ml-2 p-1 text-xs bg-gray-100 hover:bg-gray-200 rounded flex items-center text-gray-700 site-selector-button"
                        onClick={(e) => toggleSiteSelector(worker.worker_id, e)}
                      >
                        <Building2 size={14} className="mr-1" />
                        {/* 현장변경 */}
                        <ChevronDown size={14} className="ml-1" />
                      </button>
                    </div>

                    {showSiteSelector === worker.worker_id && (
                      <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg z-10 border border-gray-200 site-selector-dropdown">
                        <div className="py-1">
                          <p className="pl-6 px-4 py-2 text-xs text-gray-500 border-b">현장 선택</p>
                          {sites.map((site) => (
                            <button
                              key={site.site_id}
                              className={`pl-6 px-4 py-2 text-xs text-left w-full hover:bg-gray-100 flex items-center justify-between ${
                                site.site_id === worker.site_id
                                  ? "bg-blue-50 text-blue-700"
                                  : "text-gray-700"
                              }`}
                              onClick={(e) =>
                                changeSite(worker.worker_id, site.site_id, site.site_name, e)
                              }
                            >
                              <span className="truncate mr-2" style={{ maxWidth: "120px" }}>
                                {site.site_name}
                              </span>
                              {site.site_id === worker.site_id && (
                                <Check size={14} className="text-blue-500 flex-shrink-0" />
                              )}
                            </button>
                          ))}
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
                ))
              ) : (
                <div className="text-gray-500 text-center py-4">
                  {selectedSite ? "근로자 정보가 없습니다." : "공사현장을 선택해주세요."}
                </div>
              )}
            </div>

            {selectedSite && (
              <div className="mt-4 border-t pt-4">
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  disabled={isLoading}
                  className="w-full py-2 px-4 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
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
            ) : workerDetails ? (
              <>
                <div>
                  {/* 제목과 저장하기 버튼을 한 줄에 정렬 */}
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold">
                      {workerDetails.name} - 근로자 기본정보
                    </h2>
                    {/* 저장 상태 표시 - 수정된 부분 */}
                    {/* <div className="flex items-center gap-4">
                      {isDirty && (
                        <div className="flex items-center bg-yellow-50 text-yellow-800 px-3 py-1 rounded-md border border-yellow-200">
                          <AlertTriangle size={18} className="mr-2" />
                          <span className="text-sm">저장되지 않은 변경사항 있음.</span>
                        </div>
                      )}

                      {lastSavedTime && (
                        <div className="text-sm text-gray-500">
                          마지막 저장: {lastSavedTime.toLocaleTimeString()}
                        </div>
                      )}

                      <button
                        className={`px-4 py-2 rounded flex items-center ${
                          isDirty
                            ? "bg-red-500 text-white hover:bg-red-600"
                            : "bg-blue-500 text-white hover:bg-blue-600"
                        }`}
                        onClick={handleSaveAndRefresh}
                        disabled={isLoading || isReportLoading}
                      >
                        <Save size={18} className="mr-2" />
                        {isDirty ? "변경사항 저장" : "저장됨"}
                      </button>
                    </div> */}
                    <div>
                      <span className="text-2xs ">
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
                            {formatResidentNumber(workerDetails.resident_number)}
                          </td>
                          <td className="p-2 border-r">
                            {getCodeName("nationality", workerDetails.nationality_code)}
                          </td>
                          <td className="p-2 border-r">
                            {getCodeName("residence_status", workerDetails.residence_status_code) ||
                              "-"}
                          </td>
                          <td className="p-2 border-r">
                            {getCodeName("job", workerDetails.job_code) || "-"}
                          </td>
                          <td className="p-2 border-r">
                            {formatPhoneNumber(workerDetails.contact_number)}
                          </td>
                          <td className="p-2">
                            {workerDetails.worker_type === "daily" ? "일용직" : "상용직"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid grid-cols-8 gap-4">
                  <div className="col-span-1 border p-3 rounded space-y-2 text-sm bg-gray-50">
                    <div className="font-semibold text-lg mb-8">📊 통계</div>
                    <div>총 근무일수: {totalWorkDays}일</div>
                    <div>총 근무시간: {totalHours}시간</div>
                    {/* 회색 선 두 줄 */}
                    <div className="my-4 space-y-1">
                      <div className="border-t-2 border-gray-300" />
                      <div className="border-t-2 border-gray-300" />
                    </div>
                    <div>전월 근무시작일: {prevMonthWorkData?.startDate}</div>
                    <div>전월 근무일수: {prevMonthWorkData?.days || "없음"}</div>
                    <div>전월 근무시간: {prevMonthWorkData?.hours || "없음"}</div>

                    {/* <div className="mt-8 border rounded bg-white p-2 space-y-1"> */}
                    {/* <div className="font-semibold mb-1">📌 4대보험</div> */}
                    {/* <div>
                        국민연금:{" "}
                        {insuranceStatusData?.national_pension === "가입대상" ? (
                          <span className="text-blue-500 font-medium">가입대상</span>
                        ) : insuranceStatusData?.national_pension === "가입상태" ? (
                          <span className="text-red-500 font-medium">가입상태</span>
                        ) : (
                          <span>해당사항없음</span>
                        )}
                      </div>
                      <div>
                        건강보험:{" "}
                        {insuranceStatusData?.health_insurance === "가입대상" ? (
                          <span className="text-blue-500 font-medium">가입대상</span>
                        ) : insuranceStatusData?.health_insurance === "가입상태" ? (
                          <span className="text-red-500 font-medium">가입상태</span>
                        ) : (
                          <span>해당사항없음</span>
                        )}
                      </div>
                      <div>
                        고용보험:{" "}
                        {insuranceStatusData?.employment_insurance === "가입대상" ? (
                          <span className="text-blue-500 font-medium">가입대상</span>
                        ) : insuranceStatusData?.employment_insurance === "가입상태" ? (
                          <span className="text-red-500 font-medium">가입상태</span>
                        ) : (
                          <span>해당사항없음</span>
                        )}
                      </div>
                      <div>
                        산재보험:{" "}
                        {insuranceStatusData?.industrial_accident === "가입대상" ? (
                          <span className="text-blue-500 font-medium">가입대상</span>
                        ) : insuranceStatusData?.industrial_accident === "가입상태" ? (
                          <span className="text-red-500 font-medium">가입상태</span>
                        ) : (
                          <span>해당사항없음</span>
                        )}
                      </div> */}
                    {/* {renderInsuranceStatusBox()} */}
                    {/* </div> */}
                  </div>
                  <div className="col-span-7">
                    {/* 새로운 달력 컴포넌트로 교체 */}
                    <CalendarWorkTime
                      yearMonth={yearMonth}
                      workDetails={workDetails}
                      isReportLoading={isReportLoading}
                      handleChange={handleChange}
                      formatNumber={formatNumber}
                    />
                  </div>
                </div>

                <div className="border-t pt-4 text-lg font-semibold">
                  <div className="flex justify-between mb-4">
                    <div className="flex gap-8">
                      <div>
                        총 근무일수: <span className="text-blue-600">{totalWorkDays}일</span>
                      </div>
                      <div>
                        총 근무시간: <span className="text-blue-600">{totalHours}시간</span>
                      </div>
                      <div>
                        총 임금:{" "}
                        <span className="text-blue-600">{totalWage.toLocaleString()}원</span>
                      </div>
                    </div>
                    <div className="flex gap-8 text-sm">
                      <div>
                        연장 근무일수:{" "}
                        <span className={extendedDays > 0 ? "text-red-500 font-medium" : ""}>
                          {extendedDays}일
                        </span>
                      </div>
                      <div>
                        휴일 근무일수:{" "}
                        <span className={holidayDays > 0 ? "text-red-500 font-medium" : ""}>
                          {holidayDays}일
                        </span>
                      </div>
                      <div>
                        야간 근무일수:{" "}
                        <span className={nightDays > 0 ? "text-red-500 font-medium" : ""}>
                          {nightDays}일
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 요약 정보 추가 */}

                  {/* <div className="grid grid-cols-4 gap-4 text-base font-normal mb-4"> */}
                  {/* <div className="border rounded p-2 bg-blue-50">
                      <span className="font-medium">국민연금 자격 여부:</span>{" "}
                      {totalWorkDays >= 8 ? (
                        <span className="text-blue-600 font-bold">가입 대상</span>
                      ) : (
                        <span className="text-gray-500">해당 없음</span>
                      )}
                    </div>
                    <div className="border rounded p-2 bg-blue-50">
                      <span className="font-medium">건강보험 자격 여부:</span>{" "}
                      {totalHours >= 60 ? (
                        <span className="text-blue-600 font-bold">가입 대상</span>
                      ) : (
                        <span className="text-gray-500">해당 없음</span>
                      )}
                    </div>
                    <div className="border rounded p-2 bg-blue-50">
                      <span className="font-medium">산재보험:</span>{" "}
                      {totalWorkDays > 0 ? (
                        <span className="text-blue-600 font-bold">가입 필요</span>
                      ) : (
                        <span className="text-gray-500">해당 없음</span>
                      )}
                    </div>
                    <div className="border rounded p-2 bg-blue-50">
                      <span className="font-medium">고용보험:</span>{" "}
                      {totalWorkDays > 0 ? (
                        <span className="text-blue-600 font-bold">가입 필요</span>
                      ) : (
                        <span className="text-gray-500">해당 없음</span>
                      )}
                    </div>*/}
                  <div>{renderInsuranceEligibilitySummary()}</div>
                </div>
                {/* <div className="flex justify-end gap-4 mt-4">
                  <button
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    onClick={handleSaveAndRefresh}
                    disabled={isLoading || isReportLoading}
                  >
                    저장하기
                  </button>
                </div> */}

                {/* 가입 & 상실 요건 박스 */}
                <div className="mt-8 space-y-8">
                  <div className="border rounded bg-white p-3 space-y-2">
                    <div className="font-semibold mb-1">✅ 4대보험 가입 요건</div>
                    <div>
                      📌 <strong>국민연금</strong>: 60세 미만 + 최초 근무일부터 1개월간 8일 이상
                      근무 또는 고시소득(220만원 이상)인 경우 → <strong>취득일: 최초 근무일</strong>
                    </div>
                    <div>
                      📌 <strong>건강보험</strong>: 최초 근무일부터 1개월간 60시간 이상 근무 시 →{" "}
                      <strong>취득일: 최초 근무일</strong>
                    </div>
                    <div>
                      📌 <strong>산재보험</strong>: 1일만 일해도 무조건 가입 →{" "}
                      <strong>취득일: 근무 시작일</strong>
                    </div>
                    <div>
                      📌 <strong>고용보험</strong>:
                      <ul className="list-disc list-inside ml-4 space-y-1">
                        <li>일용직도 1일 근무 시 가입 대상</li>
                        <li>65세 이상은 실업급여 제외, 고용안정·직업능력개발 사업만 적용</li>
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
                      📌 <strong>국민연금</strong>: 8일 미만 근무한 달이 있으면 →{" "}
                      <strong>상실일: 해당 달의 1일</strong>
                    </div>
                    <div>
                      📌 <strong>건강보험</strong>: 1개월간 60시간 미만 근무 시 →{" "}
                      <strong>상실일: 해당 달의 1일</strong>
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
            ) : (
              <div className="flex items-center justify-center h-96 text-gray-500">
                {selectedSite ? "좌측에서 근로자를 선택해주세요." : "공사현장을 먼저 선택해주세요."}
              </div>
            )}
          </div>
        </div>

        {/* 근로자 등록 모달 */}
        <WorkerAddModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          siteId={selectedSite}
          selectedYearMonth={yearMonth} // 선택된 년월 전달
          onSuccess={handleWorkerAddSuccess}
        />
        {/* 배정되지 않은 근로자 배정 */}
        {/* 배정되지 않은 근로자 배정 */}
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
                // 공사현장 미선택 시 표시될 내용
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
                // 공사현장 선택 시 기존 내용 표시
                <>
                  <p className="text-sm text-gray-500 mb-4">
                    현재 현장에 배정되지 않은 근로자 목록입니다.
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

                  {unassignedWorkers.length === 0 ? (
                    <p className="text-center py-4 text-gray-500">배정 가능한 근로자가 없습니다</p>
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
                                {getFormattedResidentNumber(worker.resident_number)}
                              </div>
                            </div>
                            <button
                              className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                              onClick={() => assignWorkerToSite(worker.worker_id, selectedSite)}
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
        {workerDetails && (
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

            {/* 저장 상태 라벨 - 개선된 버전 */}
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
        {/* Toast container */}
        <ToastContainer />
      </div>
    </RoleGuard>
  );
}

export default WorkTimePage;
