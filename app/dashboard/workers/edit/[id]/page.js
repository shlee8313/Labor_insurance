//file: app/dashboard/workers/edit/[id]/page.js

"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import RoleGuard from "@/components/RoleGuard";
import { useAuthStore } from "@/lib/store/authStore";
import useCodeStore from "@/lib/store/codeStore";
import { Search } from "lucide-react";
import { AlertTriangle, Save } from "lucide-react";

export default function WorkerEditPage({ params }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const workerId = unwrappedParams.id;

  const { user: currentUser } = useAuthStore();

  // Zustand 코드 스토어 사용
  const { codeMasters, isLoading: codeLoading, loadCodeTypeIfNeeded, getCodeInfo } = useCodeStore();

  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [sites, setSites] = useState([]);
  const [workerSites, setWorkerSites] = useState([]); // 근로자 배정 현장 목록
  const [systemSettings, setSystemSettings] = useState({});
  const [bankList, setBankList] = useState([]);
  const [initialWorkerSites, setInitialWorkerSites] = useState([]);

  // 기존 상태 변수 아래에 다음 상태를 추가
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [initialFormData, setInitialFormData] = useState({});
  const [isInitialSitesSet, setIsInitialSitesSet] = useState(false);
  // 검색어 상태
  const [nationalitySearch, setNationalitySearch] = useState("");
  const [residenceStatusSearch, setResidenceStatusSearch] = useState("");
  const [jobCodeSearch, setJobCodeSearch] = useState("");
  const [bankSearch, setBankSearch] = useState("");
  const [siteSearch, setSiteSearch] = useState("");

  // 드롭다운 열림 상태
  const [nationalityDropdownOpen, setNationalityDropdownOpen] = useState(false);
  const [residenceStatusDropdownOpen, setResidenceStatusDropdownOpen] = useState(false);
  const [jobCodeDropdownOpen, setJobCodeDropdownOpen] = useState(false);
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);
  const [siteDropdownOpen, setSiteDropdownOpen] = useState(false);

  // 4대보험 드롭다운 열림 상태
  const [npAcquisitionDropdownOpen, setNpAcquisitionDropdownOpen] = useState(false);
  const [hiAcquisitionDropdownOpen, setHiAcquisitionDropdownOpen] = useState(false);
  const [eiAcquisitionDropdownOpen, setEiAcquisitionDropdownOpen] = useState(false);
  const [npLossDropdownOpen, setNpLossDropdownOpen] = useState(false);
  const [hiLossDropdownOpen, setHiLossDropdownOpen] = useState(false);
  const [eiLossDropdownOpen, setEiLossDropdownOpen] = useState(false);

  // 4대보험 검색어 상태
  const [npAcquisitionSearch, setNpAcquisitionSearch] = useState("");
  const [hiAcquisitionSearch, setHiAcquisitionSearch] = useState("");
  const [eiAcquisitionSearch, setEiAcquisitionSearch] = useState("");
  const [npLossSearch, setNpLossSearch] = useState("");
  const [hiLossSearch, setHiLossSearch] = useState("");
  const [eiLossSearch, setEiLossSearch] = useState("");

  // 필터링된 코드 목록 계산
  const filteredNationalityCodes = codeMasters.NATIONALITY
    ? codeMasters.NATIONALITY.filter(
        (code) =>
          code.code_value.toLowerCase().includes(nationalitySearch.toLowerCase()) ||
          code.code_name.toLowerCase().includes(nationalitySearch.toLowerCase())
      )
    : [];

  const filteredResidenceStatusCodes = codeMasters.COMMON_RESIDENCE_STATUS
    ? codeMasters.COMMON_RESIDENCE_STATUS.filter(
        (code) =>
          code.code_value.toLowerCase().includes(residenceStatusSearch.toLowerCase()) ||
          code.code_name.toLowerCase().includes(residenceStatusSearch.toLowerCase())
      )
    : [];

  const filteredJobCodes = codeMasters.JOB_CODE
    ? codeMasters.JOB_CODE.filter(
        (code) =>
          code.code_value.toLowerCase().includes(jobCodeSearch.toLowerCase()) ||
          code.code_name.toLowerCase().includes(jobCodeSearch.toLowerCase())
      )
    : [];

  const filteredBanks = bankList.filter((bank) =>
    bank.toLowerCase().includes(bankSearch.toLowerCase())
  );

  // 현장 필터링
  const filteredSites = sites.filter(
    (site) =>
      site.site_name.toLowerCase().includes(siteSearch.toLowerCase()) &&
      !workerSites.some((ws) => ws.site_id === site.site_id)
  );

  // 필터링된 4대보험 코드 목록
  const filteredNpAcquisitionCodes = getFilteredSystemSettings(
    "np_acquisition_code",
    npAcquisitionSearch
  );
  const filteredHiAcquisitionCodes = getFilteredSystemSettings(
    "hi_acquisition_code",
    hiAcquisitionSearch
  );
  const filteredEiAcquisitionCodes = getFilteredSystemSettings(
    "ei_acquisition_code",
    eiAcquisitionSearch
  );
  const filteredNpLossCodes = getFilteredSystemSettings("np_loss_code", npLossSearch);
  const filteredHiLossCodes = getFilteredSystemSettings("hi_loss_code", hiLossSearch);
  const filteredEiLossCodes = getFilteredSystemSettings("ei_loss_code", eiLossSearch);

  const [formData, setFormData] = useState({
    worker_id: "",
    name: "",
    eng_name: "",
    resident_number: "",
    resident_number_formatted: "",
    nationality_code: "100", // 기본값 한국
    nationality_name: "한국", // 기본값 표시용
    residence_status_code: "",
    residence_status_name: "",
    job_code: "",
    job_name: "",
    address: "",
    contact_number: "",
    contact_number_formatted: "",
    representative_yn: false,
    worker_type: "daily", // 기본값 일용직
    resignation_date: "", // 퇴직일
    site_id: "",
    // 은행 정보 추가
    bank_name: "",
    bank_account: "",
    // 급여 정보 추가 (근로자 유형별)
    daily_wage: "", // 일당 (일용직)
    daily_wage_formatted: "", // 일당 표시용
    hourly_wage: "", // 시급 (단시간)
    hourly_wage_formatted: "", // 시급 표시용
    start_date: "", // 입사일 (계약직, 정규직)
    contract_end_date: "", // 계약종료일 (계약직, 정규직)
    base_salary: "", // 기본급 (계약직, 정규직)
    base_salary_formatted: "", // 기본급 표시용
    // 국민연금 정보 추가
    np_acquisition_code: "",
    np_acquisition_name: "",
    np_special_occupation_code: "0", // 기본값 일반
    np_pension_system_code: "0", // 기본값 없음
    np_loss_code: "",
    np_loss_name: "",
    // 건강보험 정보 추가
    hi_acquisition_code: "",
    hi_acquisition_name: "",
    hi_premium_reduction_code: "",
    hi_loss_code: "",
    hi_loss_name: "",
    // 고용보험 정보 추가
    ei_acquisition_code: "",
    ei_acquisition_name: "",
    ei_premium_classification_reason: "",
    ei_loss_code: "",
    ei_loss_name: "",
  });

  function getFilteredSystemSettings(category, searchTerm) {
    if (!systemSettings[category]) return [];

    return systemSettings[category].filter(
      (item) =>
        item.setting_key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.setting_value.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  // 컴포넌트 마운트 시 초기 상태 저장
  useEffect(() => {
    setInitialWorkerSites([...workerSites]);
  }, [workerSites]);

  // 페이지 로드 시 코드 마스터 및 현장 데이터 로드
  // 기존 useEffect 부분을 교체
  useEffect(() => {
    const initializeData = async () => {
      if (!currentUser?.id) return;

      try {
        setLoading(true);

        // 1단계: 코드 마스터 및 시스템 설정 먼저 로드 (순차 실행)
        await Promise.all([
          loadCodeTypeIfNeeded("NATIONALITY"),
          loadCodeTypeIfNeeded("COMMON_RESIDENCE_STATUS"),
          loadCodeTypeIfNeeded("JOB_CODE"),
        ]);

        // 2단계: 현장 데이터 및 은행 목록 로드
        await loadSites();
        // 시스템 설정 로드하고 결과 대기
        await loadSystemSettings();

        setBankList([
          "KB국민은행",
          "신한은행",
          "우리은행",
          "하나은행",
          "농협은행",
          "SC제일은행",
          "IBK기업은행",
          "수협은행",
          "대구은행",
          "부산은행",
          "광주은행",
          "제주은행",
          "전북은행",
          "경남은행",
          "케이뱅크",
          "카카오뱅크",
          "토스뱅크",
          "새마을금고",
          "신협",
          "산림조합중앙회",
          "우체국",
        ]);

        setLoading(false);
      } catch (error) {
        console.error("데이터 초기화 오류:", error);
        setLoading(false);
        setError("데이터 초기화 중 오류가 발생했습니다.");
      }
    };

    initializeData();
  }, [workerId, currentUser, loadCodeTypeIfNeeded]);

  // 시스템 설정이 로드된 후에 근로자 데이터 로드
  useEffect(() => {
    if (workerId && Object.keys(systemSettings).length > 0 && !loading) {
      loadWorkerData();
    }
  }, [workerId, systemSettings]);
  // 시스템 설정 로드 (4대보험 코드값)
  // 시스템 설정 로드 (4대보험 코드값) - 수정된 버전
  const loadSystemSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .or(
          `setting_category.eq.np_acquisition_code,setting_category.eq.np_loss_code,setting_category.eq.hi_acquisition_code,setting_category.eq.hi_loss_code,setting_category.eq.ei_acquisition_code,setting_category.eq.ei_loss_code,setting_category.eq.np_special_occupation_code,setting_category.eq.np_pension_system_code,setting_category.eq.hi_premium_reduction_code,setting_category.eq.ei_premium_classification_reason`
        );

      if (error) throw error;

      // 카테고리별로 분류
      const categorizedSettings = {};
      data.forEach((setting) => {
        if (!categorizedSettings[setting.setting_category]) {
          categorizedSettings[setting.setting_category] = [];
        }
        categorizedSettings[setting.setting_category].push(setting);
      });

      setSystemSettings(categorizedSettings);
      console.log("시스템 설정 로드 완료:", categorizedSettings); // 디버깅용
      return categorizedSettings; // 결과 반환 추가
    } catch (error) {
      console.error("시스템 설정 로드 오류:", error);
      setError("4대보험 코드 정보를 불러오는 중 오류가 발생했습니다.");
      return {}; // 오류 시 빈 객체 반환
    }
  };

  // 현장 데이터 로드 함수
  const loadSites = async () => {
    try {
      if (!currentUser?.id) return;

      let sitesQuery;

      // admin은 회사 내 모든 현장 조회
      if (currentUser.role === "admin") {
        // 회사 ID 조회
        const { data: companyData, error: companyError } = await supabase
          .from("user_companies")
          .select("company_id")
          .eq("user_id", currentUser.id)
          .maybeSingle();

        if (companyError) throw companyError;

        if (companyData?.company_id) {
          sitesQuery = supabase
            .from("location_sites")
            .select("*")
            .eq("company_id", companyData.company_id)
            .eq("status", "active")
            .order("site_name", { ascending: true });
        }
      } else {
        // manager, site_manager는 배정된 현장만 조회
        sitesQuery = supabase
          .from("user_location_sites")
          .select(
            `
            site_id,
            location_sites:location_sites(*)
          `
          )
          .eq("user_id", currentUser.id)
          .is("removed_date", null)
          .eq("location_sites.status", "active");
      }

      if (sitesQuery) {
        const { data: sitesData, error: sitesError } = await sitesQuery;

        if (sitesError) throw sitesError;

        // 데이터 가공
        let formattedSites;
        if (currentUser.role === "admin") {
          formattedSites = sitesData || [];
        } else {
          formattedSites = (sitesData || []).map((item) => item.location_sites);
        }

        setSites(formattedSites);
      }
    } catch (error) {
      console.error("현장 데이터 로드 오류:", error);
      setError("현장 정보를 불러오는 중 오류가 발생했습니다.");
    }
  };

  // 근로자 데이터 로드 함수
  const loadWorkerData = async () => {
    try {
      // setLoading(true);

      // 1. 근로자 기본 정보 조회
      const { data: worker, error: workerError } = await supabase
        .from("workers")
        .select("*")
        .eq("worker_id", workerId)
        .single();

      if (workerError) throw workerError;

      // 2. 근로자가 배정된 현장 조회
      const { data: workerSitesData, error: workerSitesError } = await supabase
        .from("work_records")
        .select(
          `
          site_id,
          location_sites:location_sites(
            site_id,
            site_name,
            status
          )
        `
        )
        .eq("worker_id", workerId)
        .order("work_date", { ascending: false });

      if (workerSitesError) throw workerSitesError;

      // 중복 제거 (현장 ID 기준)
      const uniqueSites = [];
      const siteIds = new Set();

      workerSitesData.forEach((record) => {
        if (record.location_sites && !siteIds.has(record.site_id)) {
          siteIds.add(record.site_id);
          uniqueSites.push(record.location_sites);
        }
      });

      // 활성 상태인 현장만 필터링
      const activeSites = uniqueSites.filter((site) => site.status === "active");
      setWorkerSites(activeSites);

      // ⭐ 초기 현장 목록은 한 번만 설정하고 절대 변경하지 않음
      if (!isInitialSitesSet) {
        console.log("🟢 초기 현장 목록 설정 (최초 1회):", activeSites);
        setInitialWorkerSites([...activeSites]);
        setIsInitialSitesSet(true); // 플래그 설정으로 다시 설정되지 않도록 함
      }
      // 코드 정보 가져오기
      const nationalityInfo = worker.nationality_code
        ? getCodeInfo("NATIONALITY", worker.nationality_code)
        : null;

      const residenceStatusInfo = worker.residence_status_code
        ? getCodeInfo("COMMON_RESIDENCE_STATUS", worker.residence_status_code)
        : null;

      const jobInfo = worker.job_code ? getCodeInfo("JOB_CODE", worker.job_code) : null;

      // 시스템 설정에서 4대보험 정보 가져오기
      const npAcquisitionInfo = worker.np_acquisition_code
        ? systemSettings.np_acquisition_code?.find(
            (s) => String(s.setting_key) === String(worker.np_acquisition_code)
          )
        : null;

      const npLossInfo = worker.np_loss_code
        ? systemSettings.np_loss_code?.find(
            (s) => String(s.setting_key) === String(worker.np_loss_code)
          )
        : null;

      const hiAcquisitionInfo = worker.hi_acquisition_code
        ? systemSettings.hi_acquisition_code?.find(
            (s) => String(s.setting_key) === String(worker.hi_acquisition_code)
          )
        : null;

      const hiLossInfo = worker.hi_loss_code
        ? systemSettings.hi_loss_code?.find(
            (s) => String(s.setting_key) === String(worker.hi_loss_code)
          )
        : null;

      const eiAcquisitionInfo = worker.ei_acquisition_code
        ? systemSettings.ei_acquisition_code?.find(
            (s) => String(s.setting_key) === String(worker.ei_acquisition_code)
          )
        : null;

      const eiLossInfo = worker.ei_loss_code
        ? systemSettings.ei_loss_code?.find(
            (s) => String(s.setting_key) === String(worker.ei_loss_code)
          )
        : null;

      // 주민번호 포맷팅
      const residentNumberFormatted = formatResidentNumber(worker.resident_number);

      // 전화번호 포맷팅
      const contactNumberFormatted = formatPhoneNumber(worker.contact_number);

      // 퇴직일 포맷팅
      const resignationDate = worker.resignation_date
        ? new Date(worker.resignation_date).toISOString().split("T")[0]
        : "";

      // 급여 정보 포맷팅
      const dailyWageFormatted = worker.daily_wage
        ? worker.daily_wage.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
        : "";
      const hourlyWageFormatted = worker.hourly_rate
        ? worker.hourly_rate.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
        : "";
      const baseSalaryFormatted = worker.monthly_salary
        ? worker.monthly_salary.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")
        : "";

      // 계약 날짜 포맷팅
      const startDate = worker.contract_start_date
        ? new Date(worker.contract_start_date).toISOString().split("T")[0]
        : "";
      const contractEndDate = worker.contract_end_date
        ? new Date(worker.contract_end_date).toISOString().split("T")[0]
        : "";

      // 폼 데이터 설정
      const formDataToSet = {
        worker_id: worker.worker_id,
        name: worker.name || "",
        eng_name: worker.eng_name || "",
        resident_number: worker.resident_number || "",
        resident_number_formatted: residentNumberFormatted,
        nationality_code: worker.nationality_code || "100",
        nationality_name: nationalityInfo?.code_name || "한국",
        residence_status_code: worker.residence_status_code || "",
        residence_status_name: residenceStatusInfo?.code_name || "",
        job_code: worker.job_code || "",
        job_name: jobInfo?.code_name || "",
        address: worker.address || "",
        contact_number: worker.contact_number || "",
        contact_number_formatted: contactNumberFormatted,
        representative_yn: worker.representative_yn || false,
        worker_type: worker.worker_type || "daily",
        // 새로 추가된 필드
        bank_name: worker.bank_name || "",
        bank_account: worker.bank_account || "",
        resignation_date: resignationDate,
        // 급여 정보
        daily_wage: worker.daily_wage?.toString() || "",
        daily_wage_formatted: dailyWageFormatted,
        hourly_wage: worker.hourly_rate?.toString() || "",
        hourly_wage_formatted: hourlyWageFormatted,
        start_date: startDate,
        contract_end_date: contractEndDate,
        base_salary: worker.monthly_salary?.toString() || "",
        base_salary_formatted: baseSalaryFormatted,
        // 국민연금 정보
        np_acquisition_code: worker.np_acquisition_code || "",
        np_acquisition_name: npAcquisitionInfo
          ? npAcquisitionInfo.setting_value || npAcquisitionInfo.description
          : "",
        np_special_occupation_code: worker.np_special_occupation_code || "0",
        np_pension_system_code: worker.np_pension_system_code || "0",
        np_loss_code: worker.np_loss_code || "",
        np_loss_name: npLossInfo ? npLossInfo.setting_value || npLossInfo.description : "",
        // 건강보험 정보
        hi_acquisition_code: worker.hi_acquisition_code || "",
        hi_acquisition_name: hiAcquisitionInfo
          ? hiAcquisitionInfo.setting_value || hiAcquisitionInfo.description
          : "",
        hi_premium_reduction_code: worker.hi_premium_reduction_code || "",
        hi_loss_code: worker.hi_loss_code || "",
        hi_loss_name: hiLossInfo ? hiLossInfo.setting_value || hiLossInfo.description : "",
        // 고용보험 정보
        ei_acquisition_code: worker.ei_acquisition_code || "",
        ei_acquisition_name: eiAcquisitionInfo
          ? eiAcquisitionInfo.setting_value || eiAcquisitionInfo.description
          : "",
        ei_premium_classification_reason: worker.ei_premium_classification_reason || "",
        ei_loss_code: worker.ei_loss_code || "",
        ei_loss_name: eiLossInfo ? eiLossInfo.setting_value || eiLossInfo.description : "",
      };

      setFormData(formDataToSet);
      // 초기 데이터 저장 (비교를 위해)
      setInitialFormData(formDataToSet);
      setIsDirty(false);
      setError(null);
    } catch (error) {
      console.error("근로자 데이터 로드 오류:", error);
      setError("근로자 정보를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 주민등록번호 포맷팅 함수
  const formatResidentNumber = (value) => {
    if (!value) return "";

    if (value.length === 13) {
      return `${value.substring(0, 6)}-${value.substring(6)}`;
    }

    return value;
  };

  // 전화번호 포맷팅 함수
  const formatPhoneNumber = (value) => {
    if (!value) return "";

    // 숫자만 남기기
    const numbers = value.replace(/[^0-9]/g, "");

    if (numbers.length === 11) {
      return `${numbers.substring(0, 3)}-${numbers.substring(3, 7)}-${numbers.substring(7)}`;
    } else if (numbers.length === 10) {
      return `${numbers.substring(0, 3)}-${numbers.substring(3, 6)}-${numbers.substring(6)}`;
    }

    return value;
  };

  // 초기 상태와 현재 상태 비교 함수
  const hasChangesFromInitial = (currentData) => {
    // 비교할 필드 목록
    const fieldsToCompare = [
      "name",
      "eng_name",
      "resident_number",
      "nationality_code",
      "residence_status_code",
      "job_code",
      "address",
      "contact_number",
      "representative_yn",
      "worker_type",
      "bank_name",
      "bank_account",
      "resignation_date",
      "daily_wage",
      "hourly_wage",
      "start_date",
      "contract_end_date",
      "base_salary",
      "np_acquisition_code",
      "np_special_occupation_code",
      "np_pension_system_code",
      "np_loss_code",
      "hi_acquisition_code",
      "hi_premium_reduction_code",
      "hi_loss_code",
      "ei_acquisition_code",
      "ei_premium_classification_reason",
      "ei_loss_code",
    ];

    // 각 필드를 순회하며 값이 변경되었는지 확인
    return fieldsToCompare.some((field) => {
      // 빈 문자열과 null/undefined를 동등하게 처리
      const initialValue = initialFormData[field] || "";
      const currentValue = currentData[field] || "";

      // boolean 타입 특별 처리
      if (typeof initialFormData[field] === "boolean") {
        return initialFormData[field] !== currentData[field];
      }

      return String(initialValue) !== String(currentValue); // 문자열로 변환하여 비교
    });
  };

  // 현장 변경사항 확인
  const hasSiteChanges = () => {
    console.log("🔍 현장 변경사항 확인:");
    console.log(
      "  - 초기 현장:",
      initialWorkerSites.map((s) => `${s.site_id}:${s.site_name}`)
    );
    console.log(
      "  - 현재 현장:",
      workerSites.map((s) => `${s.site_id}:${s.site_name}`)
    );
    console.log("  - 초기 현장 수:", initialWorkerSites.length);
    console.log("  - 현재 현장 수:", workerSites.length);

    if (initialWorkerSites.length !== workerSites.length) {
      console.log("🟢 현장 개수 변경됨 - 변경사항 있음");
      return true;
    }

    const initialSiteIds = initialWorkerSites.map((site) => site.site_id).sort();
    const currentSiteIds = workerSites.map((site) => site.site_id).sort();

    const hasChanged = initialSiteIds.some((id, index) => id !== currentSiteIds[index]);
    console.log("🔍 현장 ID 비교:", { initialSiteIds, currentSiteIds });
    console.log(
      hasChanged ? "🟢 현장 ID 변경됨 - 변경사항 있음" : "🔴 현장 ID 동일 - 변경사항 없음"
    );

    return hasChanged;
  };

  // 입력 필드 변경 핸들러
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // 체크박스의 경우 checked 값 사용, 그 외에는 value 사용
    const newValue = type === "checkbox" ? checked : value;

    if (name === "resident_number_formatted") {
      // 주민번호 형식화 (000000-0000000)
      let formatted = value.replace(/[^0-9]/g, ""); // 숫자만 남기기

      if (formatted.length > 6) {
        formatted = formatted.slice(0, 6) + "-" + formatted.slice(6, 13);
      }

      // 최대 14자리 (하이픈 포함)로 제한
      formatted = formatted.slice(0, 14);

      // 원본 값 (하이픈 제거)과 형식화된 값 모두 저장
      setFormData((prev) => ({
        ...prev,
        resident_number: formatted.replace(/-/g, ""),
        resident_number_formatted: formatted,
      }));
      return;
    }

    if (name === "contact_number_formatted") {
      // 전화번호 형식화 (010-0000-0000)
      let formatted = value.replace(/[^0-9]/g, ""); // 숫자만 남기기

      if (formatted.length > 3 && formatted.length <= 7) {
        formatted = formatted.slice(0, 3) + "-" + formatted.slice(3);
      } else if (formatted.length > 7) {
        formatted =
          formatted.slice(0, 3) + "-" + formatted.slice(3, 7) + "-" + formatted.slice(7, 11);
      }

      // 최대 13자리 (하이픈 포함)로 제한
      formatted = formatted.slice(0, 13);

      // 원본 값 (하이픈 제거)과 형식화된 값 모두 저장
      setFormData((prev) => ({
        ...prev,
        contact_number: formatted.replace(/-/g, ""),
        contact_number_formatted: formatted,
      }));
      return;
    }

    if (name === "bank_account") {
      // 계좌번호는 숫자만 허용
      const formatted = value.replace(/[^0-9]/g, "");

      setFormData((prev) => ({
        ...prev,
        bank_account: formatted,
      }));
      return;
    }

    // 급여 관련 필드는 숫자만 허용하고 콤마 포맷팅
    if (["daily_wage_formatted", "hourly_wage_formatted", "base_salary_formatted"].includes(name)) {
      // 숫자만 추출 (콤마 제거)
      const numbersOnly = value.replace(/[^0-9]/g, "");

      // 콤마 포맷팅
      const formatted = numbersOnly.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

      // 원본 필드명 결정
      const originalFieldName = name.replace("_formatted", "");

      setFormData((prev) => ({
        ...prev,
        [originalFieldName]: numbersOnly, // 숫자만 저장
        [name]: formatted, // 포맷팅된 값 저장
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));

    setIsDirty(true);
  };

  // 변경사항 확인 후 isDirty 업데이트
  useEffect(() => {
    const hasFieldChanges = hasChangesFromInitial(formData);
    const hasSiteChangesNow = hasSiteChanges();
    setIsDirty(hasFieldChanges || hasSiteChangesNow);
  }, [formData, workerSites, initialFormData, initialWorkerSites]);

  // 국적 선택 핸들러
  const handleNationalitySelect = (code) => {
    setFormData((prev) => ({
      ...prev,
      nationality_code: code.code_value,
      nationality_name: code.code_name,
      // 한국 국적인 경우 체류자격 초기화
      ...(code.code_value === "100"
        ? {
            residence_status_code: "",
            residence_status_name: "",
          }
        : {}),
    }));
    setNationalityDropdownOpen(false);
    setNationalitySearch("");
  };

  // 체류자격 선택 핸들러
  const handleResidenceStatusSelect = (code) => {
    setFormData((prev) => ({
      ...prev,
      residence_status_code: code.code_value,
      residence_status_name: code.code_name,
    }));
    setResidenceStatusDropdownOpen(false);
    setResidenceStatusSearch("");
  };

  // 직종 선택 핸들러
  const handleJobCodeSelect = (code) => {
    setFormData((prev) => ({
      ...prev,
      job_code: code.code_value,
      job_name: code.code_name,
    }));
    setJobCodeDropdownOpen(false);
    setJobCodeSearch("");
  };

  // 은행 선택 핸들러
  const handleBankSelect = (bank) => {
    setFormData((prev) => ({
      ...prev,
      bank_name: bank,
    }));
    setBankDropdownOpen(false);
    setBankSearch("");
  };

  // 현장 선택 핸들러 (즉시 DB에 저장)
  const handleSiteSelect = async (site) => {
    console.log("🔵 현장 선택:", site.site_name);

    // 이미 배정된 현장인지 확인
    const isAlreadyAssigned = workerSites.some((ws) => ws.site_id === site.site_id);

    if (isAlreadyAssigned) {
      setError("이미 배정된 현장입니다.");
      setSiteDropdownOpen(false);
      setSiteSearch("");
      return;
    }

    try {
      // 즉시 DB에 현장 배정 추가
      const todayDate = new Date().toISOString().split("T")[0];
      const currentYearMonth = todayDate.substring(0, 7);

      const recordToInsert = {
        worker_id: parseInt(workerId),
        site_id: parseInt(site.site_id),
        work_date: todayDate,
        work_hours: 0,
        work_type: "registration",
        daily_wage:
          formData.worker_type === "daily" && formData.daily_wage
            ? parseFloat(formData.daily_wage)
            : 0,
        status: "registration",
        registration_month: currentYearMonth,
      };

      console.log("🟢 DB에 현장 배정 추가:", recordToInsert);

      const { error: insertError } = await supabase.from("work_records").insert([recordToInsert]);

      if (insertError) {
        console.error("현장 배정 추가 오류:", insertError);
        setError(`현장 배정 중 오류가 발생했습니다: ${insertError.message}`);
        return;
      }

      // 성공 시 UI 상태 업데이트
      const updatedSites = [...workerSites, site];
      console.log(
        "🟢 현장 추가 후 목록:",
        updatedSites.map((s) => s.site_name)
      );
      setWorkerSites(updatedSites);

      setSuccessMessage(`${site.site_name} 현장에 성공적으로 배정되었습니다.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("현장 배정 오류:", error);
      setError(`현장 배정 중 오류가 발생했습니다: ${error.message}`);
    }

    setSiteDropdownOpen(false);
    setSiteSearch("");
  };

  // 4대보험 코드 선택 핸들러
  const handleInsuranceCodeSelect = (category, code, dropdownSetter, searchSetter) => {
    const fieldMapping = {
      np_acquisition_code: { code: "np_acquisition_code", name: "np_acquisition_name" },
      np_loss_code: { code: "np_loss_code", name: "np_loss_name" },
      hi_acquisition_code: { code: "hi_acquisition_code", name: "hi_acquisition_name" },
      hi_loss_code: { code: "hi_loss_code", name: "hi_loss_name" },
      ei_acquisition_code: { code: "ei_acquisition_code", name: "ei_acquisition_name" },
      ei_loss_code: { code: "ei_loss_code", name: "ei_loss_name" },
    };

    const fields = fieldMapping[category];

    if (fields) {
      setFormData((prev) => ({
        ...prev,
        [fields.code]: code.setting_key,
        [fields.name]: code.description,
      }));
    } else {
      // 그 외 필드 (special_occupation, pension_system, premium_reduction, classification_reason)
      setFormData((prev) => ({
        ...prev,
        [category]: code.setting_key,
      }));
    }

    dropdownSetter(false);
    searchSetter("");
  };

  // 현장 제거 핸들러 (즉시 DB에서 삭제)
  const handleRemoveSite = async (siteId) => {
    console.log("🔵 현장 제거 ID:", siteId);

    try {
      // 실제 근무 기록이 있는지 먼저 확인
      const { data: actualWorkRecords, error: checkError } = await supabase
        .from("work_records")
        .select("work_date, work_hours, status")
        .eq("worker_id", workerId)
        .eq("site_id", siteId)
        .neq("status", "registration");

      if (checkError) {
        console.error("근무 기록 확인 오류:", checkError);
        setError(`근무 기록 확인 중 오류가 발생했습니다: ${checkError.message}`);
        return;
      }

      if (actualWorkRecords && actualWorkRecords.length > 0) {
        const siteName = workerSites.find((s) => s.site_id === siteId)?.site_name || "해당 현장";
        setError(`${siteName}에 실제 근무 기록이 있어 배정을 취소할 수 없습니다.`);
        return;
      }

      // 등록용 레코드만 삭제
      const { error: deleteError } = await supabase
        .from("work_records")
        .delete()
        .eq("worker_id", workerId)
        .eq("site_id", siteId)
        .eq("status", "registration");

      if (deleteError) {
        console.error("현장 배정 제거 오류:", deleteError);
        setError(`현장 배정 취소 중 오류가 발생했습니다: ${deleteError.message}`);
        return;
      }

      // 성공 시 UI 상태 업데이트
      const updatedSites = workerSites.filter((site) => site.site_id !== siteId);
      console.log(
        "🟢 현장 제거 후 목록:",
        updatedSites.map((s) => s.site_name)
      );
      setWorkerSites(updatedSites);

      const siteName = workerSites.find((s) => s.site_id === siteId)?.site_name || "현장";
      setSuccessMessage(`${siteName} 배정이 성공적으로 취소되었습니다.`);
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("현장 배정 제거 오류:", error);
      setError(`현장 배정 취소 중 오류가 발생했습니다: ${error.message}`);
    }
  };

  // 현재 사용자가 해당 현장에 대한 권한이 있는지 확인
  const canManageSite = (siteId) => {
    if (currentUser?.role === "admin") return true;
    // 편집 페이지에서는 모든 사이트에 접근 가능하도록 true 반환
    return true;
  };

  // 폼 제출 핸들러 (현장 배정 관련 부분 제거됨 - 즉시 처리되므로)
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setSaveLoading(true);
      setError(null);

      // 필수 입력값 확인
      if (
        !formData.name ||
        !formData.resident_number ||
        !formData.contact_number ||
        !formData.address
      ) {
        setError("필수 입력 항목을 모두 입력해주세요.");
        return;
      }

      // 주민등록번호 형식 검증
      const residentNumberRegex = /^\d{13}$/;
      if (!residentNumberRegex.test(formData.resident_number)) {
        setError("주민등록번호는 하이픈(-) 없이 13자리 숫자로 입력해주세요.");
        return;
      }

      // 외국인이면 체류자격 필수
      if (formData.nationality_code !== "100" && !formData.residence_status_code) {
        setError("외국인의 경우 체류자격을 선택해주세요.");
        return;
      }

      // 근로자 유형별 필수 입력값 확인
      if (formData.worker_type === "daily" && !formData.daily_wage) {
        setError("일용직의 경우 일당을 입력해주세요.");
        return;
      }
      if (formData.worker_type === "part_time" && !formData.hourly_wage) {
        setError("단시간 근로자의 경우 시급을 입력해주세요.");
        return;
      }
      if (
        (formData.worker_type === "contract" || formData.worker_type === "regular") &&
        (!formData.start_date || !formData.base_salary)
      ) {
        setError("계약직/정규직의 경우 입사일과 기본급을 입력해주세요.");
        return;
      }

      // 근로자 정보 업데이트 데이터 준비
      const workerUpdateData = {
        name: formData.name,
        eng_name: formData.eng_name || null,
        resident_number: formData.resident_number,
        nationality_code: formData.nationality_code,
        residence_status_code: formData.residence_status_code || null,
        job_code: formData.job_code || null,
        address: formData.address,
        contact_number: formData.contact_number,
        representative_yn: formData.representative_yn,
        worker_type: formData.worker_type,
        bank_name: formData.bank_name || null,
        bank_account: formData.bank_account || null,
        resignation_date: formData.resignation_date || null,
        np_acquisition_code: formData.np_acquisition_code || null,
        np_special_occupation_code: formData.np_special_occupation_code || "0",
        np_pension_system_code: formData.np_pension_system_code || "0",
        np_loss_code: formData.np_loss_code || null,
        hi_acquisition_code: formData.hi_acquisition_code || null,
        hi_premium_reduction_code: formData.hi_premium_reduction_code || null,
        hi_loss_code: formData.hi_loss_code || null,
        ei_acquisition_code: formData.ei_acquisition_code || null,
        ei_premium_classification_reason: formData.ei_premium_classification_reason || null,
        ei_loss_code: formData.ei_loss_code || null,
      };

      // 근로자 유형별 급여 정보 추가
      if (formData.worker_type === "daily" && formData.daily_wage) {
        workerUpdateData.daily_wage = parseFloat(formData.daily_wage);
      } else if (formData.worker_type === "part_time" && formData.hourly_wage) {
        workerUpdateData.hourly_rate = parseFloat(formData.hourly_wage);
      } else if (formData.worker_type === "contract" || formData.worker_type === "regular") {
        if (formData.start_date) {
          workerUpdateData.contract_start_date = formData.start_date;
        }
        if (formData.contract_end_date) {
          workerUpdateData.contract_end_date = formData.contract_end_date;
        }
        if (formData.base_salary) {
          workerUpdateData.monthly_salary = parseFloat(formData.base_salary);
        }
      }

      // 근로자 정보 업데이트
      console.log("근로자 정보 업데이트 시작");
      const { data: worker, error: workerError } = await supabase
        .from("workers")
        .update(workerUpdateData)
        .eq("worker_id", workerId)
        .select()
        .single();

      if (workerError) {
        console.error("근로자 정보 업데이트 오류:", workerError);
        if (workerError.code === "23505") {
          throw new Error("이미 등록된 주민등록번호입니다.");
        }
        throw workerError;
      }
      console.log("근로자 정보 업데이트 완료");

      // 초기 데이터 업데이트 (isDirty 상태 리셋용)
      console.log("💾 저장 완료 - 초기값 업데이트");
      setInitialFormData({ ...formData });
      setInitialWorkerSites([...workerSites]); // 저장 성공 후에만 업데이트
      setIsDirty(false);
      setLastSavedTime(new Date());

      setSuccessMessage("근로자 정보가 성공적으로 업데이트되었습니다.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("근로자 정보 업데이트 오류:", error);
      setError(error.message || "근로자 정보 업데이트 중 오류가 발생했습니다.");
    } finally {
      setSaveLoading(false);
    }
  };

  // 드롭다운 외부 클릭 핸들러
  useEffect(() => {
    const handleClickOutside = (event) => {
      const dropdowns = [
        { open: nationalityDropdownOpen, setter: setNationalityDropdownOpen },
        { open: residenceStatusDropdownOpen, setter: setResidenceStatusDropdownOpen },
        { open: jobCodeDropdownOpen, setter: setJobCodeDropdownOpen },
        { open: bankDropdownOpen, setter: setBankDropdownOpen },
        { open: siteDropdownOpen, setter: setSiteDropdownOpen },
        { open: npAcquisitionDropdownOpen, setter: setNpAcquisitionDropdownOpen },
        { open: hiAcquisitionDropdownOpen, setter: setHiAcquisitionDropdownOpen },
        { open: eiAcquisitionDropdownOpen, setter: setEiAcquisitionDropdownOpen },
        { open: npLossDropdownOpen, setter: setNpLossDropdownOpen },
        { open: hiLossDropdownOpen, setter: setHiLossDropdownOpen },
        { open: eiLossDropdownOpen, setter: setEiLossDropdownOpen },
      ];

      if (dropdowns.some((d) => d.open) && !event.target.closest(".dropdown-container")) {
        dropdowns.forEach((d) => d.open && d.setter(false));
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [
    nationalityDropdownOpen,
    residenceStatusDropdownOpen,
    jobCodeDropdownOpen,
    bankDropdownOpen,
    siteDropdownOpen,
    npAcquisitionDropdownOpen,
    hiAcquisitionDropdownOpen,
    eiAcquisitionDropdownOpen,
    npLossDropdownOpen,
    hiLossDropdownOpen,
    eiLossDropdownOpen,
  ]);

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3">불러오는 중...</span>
      </div>
    );
  }

  return (
    <RoleGuard requiredPermission="VIEW_WORKERS">
      <div className="w-full mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">근로자 수정</h1>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {successMessage}
          </div>
        )}

        {/* 코드 데이터 로딩 중 표시 */}
        {codeLoading && (
          <div className="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded mb-4">
            코드 데이터를 불러오는 중입니다...
          </div>
        )}

        <div className="grid grid-cols-12 gap-6">
          {/* 근로자 기본 정보 */}
          <div className="col-span-8 bg-white shadow-2xl rounded-2xl p-6">
            <div className="">
              <h2 className="text-xl font-semibold mb-4">기본 정보</h2>

              <form onSubmit={handleSubmit}>
                <div className="grid grid-cols-4 gap-6 mb-6">
                  {/* 이름 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      이름 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>

                  {/* 영문 이름 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      영문 이름
                    </label>
                    <input
                      type="text"
                      name="eng_name"
                      value={formData.eng_name}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">외국인의 경우 필수</p>
                  </div>

                  {/* 주민등록번호 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      주민등록번호/외국인등록번호 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="resident_number_formatted"
                      value={formData.resident_number_formatted}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="000000-0000000"
                      maxLength={14}
                      required
                    />
                  </div>

                  {/* 연락처 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      연락처 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      name="contact_number_formatted"
                      value={formData.contact_number_formatted}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="010-0000-0000"
                      required
                    />
                  </div>

                  {/* 국적코드 */}
                  <div className="dropdown-container relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      국적 <span className="text-red-500">*</span>
                    </label>
                    <div
                      className="border border-gray-300 rounded-md cursor-pointer"
                      onClick={() => setNationalityDropdownOpen(!nationalityDropdownOpen)}
                    >
                      <div className="w-full px-3 py-2 flex justify-between items-center">
                        <span>{formData.nationality_name || "선택하세요"}</span>
                        <span className="ml-2">▼</span>
                      </div>
                    </div>

                    {nationalityDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              className="w-full pl-8 pr-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              placeholder="검색..."
                              value={nationalitySearch}
                              onChange={(e) => setNationalitySearch(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div>
                          {filteredNationalityCodes.length > 0 ? (
                            filteredNationalityCodes.map((code) => (
                              <div
                                key={code.code_value}
                                className={`px-3 py-2 hover:bg-gray-100 cursor-pointer ${
                                  formData.nationality_code === code.code_value ? "bg-blue-50" : ""
                                }`}
                                onClick={() => handleNationalitySelect(code)}
                              >
                                <span className="font-medium mr-2">{code.code_name}</span>
                                <span className="text-xs text-gray-500">({code.code_value})</span>
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-gray-500">검색 결과가 없습니다</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 체류자격코드 (외국인인 경우) */}
                  <div className="dropdown-container relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      체류자격{" "}
                      {formData.nationality_code !== "100" && (
                        <span className="text-red-500">*</span>
                      )}
                    </label>
                    <div
                      className={`border border-gray-300 rounded-md ${
                        formData.nationality_code !== "100"
                          ? "cursor-pointer"
                          : "bg-gray-100 cursor-not-allowed"
                      }`}
                      onClick={() =>
                        formData.nationality_code !== "100" &&
                        setResidenceStatusDropdownOpen(!residenceStatusDropdownOpen)
                      }
                    >
                      <div className="w-full px-3 py-2 flex justify-between items-center">
                        <span
                          className={formData.nationality_code === "100" ? "text-gray-500" : ""}
                        >
                          {formData.nationality_code === "100"
                            ? "해당 없음"
                            : formData.residence_status_name || "선택하세요"}
                        </span>
                        {formData.nationality_code !== "100" && <span className="ml-2">▼</span>}
                      </div>
                    </div>

                    {residenceStatusDropdownOpen && formData.nationality_code !== "100" && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              className="w-full pl-8 pr-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              placeholder="검색..."
                              value={residenceStatusSearch}
                              onChange={(e) => setResidenceStatusSearch(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div>
                          {filteredResidenceStatusCodes.length > 0 ? (
                            filteredResidenceStatusCodes.map((code) => (
                              <div
                                key={code.code_value}
                                className={`px-3 py-2 hover:bg-gray-100 cursor-pointer ${
                                  formData.residence_status_code === code.code_value
                                    ? "bg-blue-50"
                                    : ""
                                }`}
                                onClick={() => handleResidenceStatusSelect(code)}
                              >
                                <span className="font-medium mr-2">{code.code_name}</span>
                                <span className="text-xs text-gray-500">({code.code_value})</span>
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-gray-500">검색 결과가 없습니다</div>
                          )}
                        </div>
                      </div>
                    )}

                    {formData.nationality_code !== "100" && (
                      <p className="text-xs text-gray-500 mt-1">외국인의 경우 필수 선택</p>
                    )}
                  </div>

                  {/* 직종코드 */}
                  <div className="dropdown-container relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">직종</label>
                    <div
                      className="border border-gray-300 rounded-md cursor-pointer"
                      onClick={() => setJobCodeDropdownOpen(!jobCodeDropdownOpen)}
                    >
                      <div className="w-full px-3 py-2 flex justify-between items-center">
                        <span>{formData.job_name || "선택하세요"}</span>
                        <span className="ml-2">▼</span>
                      </div>
                    </div>

                    {jobCodeDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              className="w-full pl-8 pr-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              placeholder="검색..."
                              value={jobCodeSearch}
                              onChange={(e) => setJobCodeSearch(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div>
                          {filteredJobCodes.length > 0 ? (
                            filteredJobCodes.map((code) => (
                              <div
                                key={code.code_value}
                                className={`px-3 py-2 hover:bg-gray-100 cursor-pointer ${
                                  formData.job_code === code.code_value ? "bg-blue-50" : ""
                                }`}
                                onClick={() => handleJobCodeSelect(code)}
                              >
                                <span className="font-medium mr-2">{code.code_name}</span>
                                <span className="text-xs text-gray-500">({code.code_value})</span>
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-gray-500">검색 결과가 없습니다</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div></div>

                  {/* 은행명 */}
                  <div className="dropdown-container relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">은행명</label>
                    <div
                      className="border border-gray-300 rounded-md cursor-pointer"
                      onClick={() => setBankDropdownOpen(!bankDropdownOpen)}
                    >
                      <div className="w-full px-3 py-2 flex justify-between items-center">
                        <span>{formData.bank_name || "선택하세요"}</span>
                        <span className="ml-2">▼</span>
                      </div>
                    </div>

                    {bankDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              className="w-full pl-8 pr-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              placeholder="검색..."
                              value={bankSearch}
                              onChange={(e) => setBankSearch(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div>
                          {filteredBanks.length > 0 ? (
                            filteredBanks.map((bank, index) => (
                              <div
                                key={index}
                                className={`px-3 py-2 hover:bg-gray-100 cursor-pointer ${
                                  formData.bank_name === bank ? "bg-blue-50" : ""
                                }`}
                                onClick={() => handleBankSelect(bank)}
                              >
                                <span className="font-medium">{bank}</span>
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-gray-500">검색 결과가 없습니다</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 계좌번호 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">계좌번호</label>
                    <input
                      type="text"
                      name="bank_account"
                      value={formData.bank_account}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="숫자만 입력하세요"
                    />
                    <p className="text-xs text-gray-500 mt-1">계좌번호는 숫자만 입력 가능합니다.</p>
                  </div>

                  {/* 주소 */}
                  <div className="col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      주소 <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                  <div></div>

                  {/* 근로자 유형 */}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      근로자 유형 <span className="text-red-500">*</span>
                    </label>
                    <div className="flex space-x-4 mt-1">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="worker_type"
                          value="daily"
                          checked={formData.worker_type === "daily"}
                          onChange={handleChange}
                          className="form-radio h-4 w-4 text-blue-600"
                        />
                        <span className="ml-2">일용직</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="worker_type"
                          value="part_time"
                          checked={formData.worker_type === "part_time"}
                          onChange={handleChange}
                          className="form-radio h-4 w-4 text-blue-600"
                        />
                        <span className="ml-2">단시간</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="worker_type"
                          value="contract"
                          checked={formData.worker_type === "contract"}
                          onChange={handleChange}
                          className="form-radio h-4 w-4 text-blue-600"
                        />
                        <span className="ml-2">계약직</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="worker_type"
                          value="regular"
                          checked={formData.worker_type === "regular"}
                          onChange={handleChange}
                          className="form-radio h-4 w-4 text-blue-600"
                        />
                        <span className="ml-2">정규직</span>
                      </label>
                    </div>
                  </div>

                  {/* 대표자 여부 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-1">
                      대표자 여부
                    </label>
                    <div className="flex items-center">
                      <label className="inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          name="representative_yn"
                          checked={formData.representative_yn}
                          onChange={handleChange}
                          className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm font-medium text-gray-700">대표자 체크</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* 근로자 유형별 추가 필드 */}
                <div className="border-t border-gray-200 pt-6 mb-6">
                  <h3 className="text-lg font-semibold mb-4">급여 정보</h3>

                  {/* 일용직 - 일당 */}
                  {formData.worker_type === "daily" && (
                    <div className="grid grid-cols-4 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          일당 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="daily_wage_formatted"
                          value={formData.daily_wage_formatted}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="예: 150,000"
                        />
                        <p className="text-xs text-gray-500 mt-1">일당을 입력하세요 (원)</p>
                      </div>
                    </div>
                  )}

                  {/* 단시간 - 시급 */}
                  {formData.worker_type === "part_time" && (
                    <div className="grid grid-cols-4 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          시급 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="hourly_wage_formatted"
                          value={formData.hourly_wage_formatted}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="예: 9,620"
                        />
                        <p className="text-xs text-gray-500 mt-1">시급을 입력하세요 (원)</p>
                      </div>
                    </div>
                  )}

                  {/* 계약직/정규직 - 입사일, 계약종료일, 기본급 */}
                  {(formData.worker_type === "contract" || formData.worker_type === "regular") && (
                    <div className="grid grid-cols-4 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          입사일 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          name="start_date"
                          value={formData.start_date}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          계약종료일
                        </label>
                        <input
                          type="date"
                          name="contract_end_date"
                          value={formData.contract_end_date}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-xs text-red-500 mt-1">퇴직한 경우에만 입력하세요.</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          기본급 <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="base_salary_formatted"
                          value={formData.base_salary_formatted}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                          placeholder="예: 2,500,000"
                        />
                        <p className="text-xs text-gray-500 mt-1">월 기본급을 입력하세요 (원)</p>
                      </div>
                    </div>
                  )}
                </div>
              </form>
            </div>
          </div>

          <div className="col-span-4 ">
            {/* 현장 배정 정보 */}
            <div className="bg-white shadow-xl rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-4">현장 배정 정보</h2>

              {/* 현재 배정된 현장 목록 */}
              <div className="mb-6">
                <h3 className="text-lg text-blue-500 font-medium mb-2">배정된 현장</h3>
                {workerSites.length > 0 ? (
                  <ul className="space-y-2">
                    {workerSites.map((site) => (
                      <li
                        key={site.site_id}
                        className="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-200"
                      >
                        <span className="flex-grow font-medium">{site.site_name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSite(site.site_id)}
                          disabled={saveLoading}
                          className="ml-2 text-xs px-2 py-1 bg-red-500 hover:bg-red-700 text-white rounded disabled:bg-red-300 disabled:cursor-not-allowed"
                        >
                          배정 취소
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="text-blue-800 text-sm">현재 배정된 현장이 없습니다.</p>
                  </div>
                )}
              </div>

              {/* 새 현장 배정 폼 */}
              <div>
                <h3 className="text-lg text-blue-500 font-medium mb-2">현장 배정</h3>
                <div className="mb-4 dropdown-container relative">
                  <div
                    className="border border-gray-300 rounded-md cursor-pointer"
                    onClick={() => setSiteDropdownOpen(!siteDropdownOpen)}
                  >
                    <div className="w-full px-3 py-2 flex justify-between items-center">
                      <span>현장을 선택하세요</span>
                      <span className="ml-2">▼</span>
                    </div>
                  </div>

                  {siteDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                      <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            className="w-full pl-8 pr-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="검색..."
                            value={siteSearch}
                            onChange={(e) => setSiteSearch(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </div>
                      <div>
                        {filteredSites.length > 0 ? (
                          filteredSites.map((site) => (
                            <div
                              key={site.site_id}
                              className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                              onClick={() => handleSiteSelect(site)}
                            >
                              <span className="font-medium">{site.site_name}</span>
                            </div>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-gray-500">
                            {siteSearch ? "검색 결과가 없습니다" : "배정 가능한 현장이 없습니다"}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {sites.length === 0 ? (
                    <p className="text-sm text-red-500 mt-1">배정 가능한 현장이 없습니다.</p>
                  ) : sites.length === workerSites.length ? (
                    <p className="text-sm text-orange-500 mt-1">
                      모든 현장에 이미 배정되어 있습니다.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {/* 4대보험 정보 */}
            <div className="bg-white shadow-2xl rounded-2xl p-4 mt-6">
              <h2 className="text-xl font-semibold mb-4">4대보험 정보</h2>

              {/* 국민연금 */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-lg text-blue-500 font-semibold mb-4">국민연금</h3>
                <div className="grid grid-cols-2 gap-6 mb-6">
                  {/* 국민연금 취득부호 */}
                  <div className="dropdown-container relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">취득부호</label>
                    <div
                      className="border border-gray-300 rounded-md cursor-pointer"
                      onClick={() => setNpAcquisitionDropdownOpen(!npAcquisitionDropdownOpen)}
                    >
                      <div className="w-full px-3 py-2 flex justify-between items-center">
                        <span>{formData.np_acquisition_name || "선택하세요"}</span>
                        <span className="ml-2">▼</span>
                      </div>
                    </div>

                    {npAcquisitionDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              className="w-full pl-8 pr-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              placeholder="검색..."
                              value={npAcquisitionSearch}
                              onChange={(e) => setNpAcquisitionSearch(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div>
                          {filteredNpAcquisitionCodes.length > 0 ? (
                            filteredNpAcquisitionCodes.map((code, index) => (
                              <div
                                key={index}
                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                onClick={() =>
                                  handleInsuranceCodeSelect(
                                    "np_acquisition_code",
                                    code,
                                    setNpAcquisitionDropdownOpen,
                                    setNpAcquisitionSearch
                                  )
                                }
                              >
                                <span className="font-medium mr-2">{code.description}</span>
                                <span className="text-xs text-gray-500">({code.setting_key})</span>
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-gray-500">검색 결과가 없습니다</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 국민연금 상실부호 */}
                  <div className="dropdown-container relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">상실부호</label>
                    <div
                      className="border border-gray-300 rounded-md cursor-pointer"
                      onClick={() => setNpLossDropdownOpen(!npLossDropdownOpen)}
                    >
                      <div className="w-full px-3 py-2 flex justify-between items-center">
                        <span>{formData.np_loss_name || "선택하세요"}</span>
                        <span className="ml-2">▼</span>
                      </div>
                    </div>

                    {npLossDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              className="w-full pl-8 pr-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              placeholder="검색..."
                              value={npLossSearch}
                              onChange={(e) => setNpLossSearch(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div>
                          {filteredNpLossCodes.length > 0 ? (
                            filteredNpLossCodes.map((code, index) => (
                              <div
                                key={index}
                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                onClick={() =>
                                  handleInsuranceCodeSelect(
                                    "np_loss_code",
                                    code,
                                    setNpLossDropdownOpen,
                                    setNpLossSearch
                                  )
                                }
                              >
                                <span className="font-medium mr-2">{code.description}</span>
                                <span className="text-xs text-gray-500">({code.setting_key})</span>
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-gray-500">검색 결과가 없습니다</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 국민연금 특수직종 */}
                  <div className="col-span-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">특수직종</label>
                    <div className="flex space-x-4 mt-1">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="np_special_occupation_code"
                          value="0"
                          checked={formData.np_special_occupation_code === "0"}
                          onChange={handleChange}
                          className="form-radio h-4 w-4 text-blue-600"
                        />
                        <span className="ml-2">일반</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="np_special_occupation_code"
                          value="1"
                          checked={formData.np_special_occupation_code === "1"}
                          onChange={handleChange}
                          className="form-radio h-4 w-4 text-blue-600"
                        />
                        <span className="ml-2">광원</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="np_special_occupation_code"
                          value="2"
                          checked={formData.np_special_occupation_code === "2"}
                          onChange={handleChange}
                          className="form-radio h-4 w-4 text-blue-600"
                        />
                        <span className="ml-2">부원</span>
                      </label>
                    </div>
                  </div>

                  {/* 국민연금 직역연금 */}
                  <div className="col-span-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">직역연금</label>
                    <div className="flex space-x-4 mt-1">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="np_pension_system_code"
                          value="0"
                          checked={formData.np_pension_system_code === "0"}
                          onChange={handleChange}
                          className="form-radio h-4 w-4 text-blue-600"
                        />
                        <span className="ml-2">없음</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="np_pension_system_code"
                          value="1"
                          checked={formData.np_pension_system_code === "1"}
                          onChange={handleChange}
                          className="form-radio h-4 w-4 text-blue-600"
                        />
                        <span className="ml-2">가입자</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="np_pension_system_code"
                          value="2"
                          checked={formData.np_pension_system_code === "2"}
                          onChange={handleChange}
                          className="form-radio h-4 w-4 text-blue-600"
                        />
                        <span className="ml-2">수급권자</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* 건강보험 */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-lg text-blue-500 font-semibold mb-4">건강보험</h3>
                <div className="grid grid-cols-2 gap-6 mb-6">
                  {/* 건강보험 취득부호 */}
                  <div className="dropdown-container relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">취득부호</label>
                    <div
                      className="border border-gray-300 rounded-md cursor-pointer"
                      onClick={() => setHiAcquisitionDropdownOpen(!hiAcquisitionDropdownOpen)}
                    >
                      <div className="w-full px-3 py-2 flex justify-between items-center">
                        <span>{formData.hi_acquisition_name || "선택하세요"}</span>
                        <span className="ml-2">▼</span>
                      </div>
                    </div>

                    {hiAcquisitionDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              className="w-full pl-8 pr-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              placeholder="검색..."
                              value={hiAcquisitionSearch}
                              onChange={(e) => setHiAcquisitionSearch(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div>
                          {filteredHiAcquisitionCodes.length > 0 ? (
                            filteredHiAcquisitionCodes.map((code, index) => (
                              <div
                                key={index}
                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                onClick={() =>
                                  handleInsuranceCodeSelect(
                                    "hi_acquisition_code",
                                    code,
                                    setHiAcquisitionDropdownOpen,
                                    setHiAcquisitionSearch
                                  )
                                }
                              >
                                <span className="font-medium mr-2">{code.description}</span>
                                <span className="text-xs text-gray-500">({code.setting_key})</span>
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-gray-500">검색 결과가 없습니다</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 건강보험 상실부호 */}
                  <div className="dropdown-container relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">상실부호</label>
                    <div
                      className="border border-gray-300 rounded-md cursor-pointer"
                      onClick={() => setHiLossDropdownOpen(!hiLossDropdownOpen)}
                    >
                      <div className="w-full px-3 py-2 flex justify-between items-center">
                        <span>{formData.hi_loss_name || "선택하세요"}</span>
                        <span className="ml-2">▼</span>
                      </div>
                    </div>

                    {hiLossDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              className="w-full pl-8 pr-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              placeholder="검색..."
                              value={hiLossSearch}
                              onChange={(e) => setHiLossSearch(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div>
                          {filteredHiLossCodes.length > 0 ? (
                            filteredHiLossCodes.map((code, index) => (
                              <div
                                key={index}
                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                onClick={() =>
                                  handleInsuranceCodeSelect(
                                    "hi_loss_code",
                                    code,
                                    setHiLossDropdownOpen,
                                    setHiLossSearch
                                  )
                                }
                              >
                                <span className="font-medium mr-2">{code.description}</span>
                                <span className="text-xs text-gray-500">({code.setting_key})</span>
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-gray-500">검색 결과가 없습니다</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 건강보험 보험료 감면 */}
                  {systemSettings.hi_premium_reduction_code && (
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        보험료 감면
                      </label>
                      <select
                        name="hi_premium_reduction_code"
                        value={formData.hi_premium_reduction_code || ""}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="">없음</option>
                        {systemSettings.hi_premium_reduction_code.map((code) => (
                          <option key={code.setting_key} value={code.setting_key}>
                            {code.description}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {/* 고용보험 */}
              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-lg text-blue-500 font-semibold mb-4">고용보험</h3>
                <div className="grid grid-cols-2 gap-6 mb-6">
                  {/* 고용보험 취득부호 */}
                  <div className="dropdown-container relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">취득부호</label>
                    <div
                      className="border border-gray-300 rounded-md cursor-pointer"
                      onClick={() => setEiAcquisitionDropdownOpen(!eiAcquisitionDropdownOpen)}
                    >
                      <div className="w-full px-3 py-2 flex justify-between items-center">
                        <span>{formData.ei_acquisition_name || "선택하세요"}</span>
                        <span className="ml-2">▼</span>
                      </div>
                    </div>

                    {eiAcquisitionDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              className="w-full pl-8 pr-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              placeholder="검색..."
                              value={eiAcquisitionSearch}
                              onChange={(e) => setEiAcquisitionSearch(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div>
                          {filteredEiAcquisitionCodes.length > 0 ? (
                            filteredEiAcquisitionCodes.map((code, index) => (
                              <div
                                key={index}
                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                onClick={() =>
                                  handleInsuranceCodeSelect(
                                    "ei_acquisition_code",
                                    code,
                                    setEiAcquisitionDropdownOpen,
                                    setEiAcquisitionSearch
                                  )
                                }
                              >
                                <span className="font-medium mr-2">{code.description}</span>
                                <span className="text-xs text-gray-500">({code.setting_key})</span>
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-gray-500">검색 결과가 없습니다</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 고용보험 상실부호 */}
                  <div className="dropdown-container relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">상실부호</label>
                    <div
                      className="border border-gray-300 rounded-md cursor-pointer"
                      onClick={() => setEiLossDropdownOpen(!eiLossDropdownOpen)}
                    >
                      <div className="w-full px-3 py-2 flex justify-between items-center">
                        <span>{formData.ei_loss_name || "선택하세요"}</span>
                        <span className="ml-2">▼</span>
                      </div>
                    </div>

                    {eiLossDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                              type="text"
                              className="w-full pl-8 pr-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                              placeholder="검색..."
                              value={eiLossSearch}
                              onChange={(e) => setEiLossSearch(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div>
                          {filteredEiLossCodes.length > 0 ? (
                            filteredEiLossCodes.map((code, index) => (
                              <div
                                key={index}
                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                                onClick={() =>
                                  handleInsuranceCodeSelect(
                                    "ei_loss_code",
                                    code,
                                    setEiLossDropdownOpen,
                                    setEiLossSearch
                                  )
                                }
                              >
                                <span className="font-medium mr-2">{code.description}</span>
                                <span className="text-xs text-gray-500">({code.setting_key})</span>
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-2 text-gray-500">검색 결과가 없습니다</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 고용보험 부과 구분사유 */}
                  {systemSettings.ei_premium_classification_reason &&
                    formData.ei_acquisition_code && (
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          취득부과 구분사유
                        </label>
                        <select
                          name="ei_premium_classification_reason"
                          value={formData.ei_premium_classification_reason || ""}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">선택하세요</option>
                          {systemSettings.ei_premium_classification_reason
                            .filter((code) => {
                              // 취득부호에 해당하는 사유만 필터링
                              switch (formData.ei_acquisition_code) {
                                case "51":
                                  return ["09", "10"].includes(code.setting_key);
                                case "52":
                                  return ["11", "13"].includes(code.setting_key);
                                case "54":
                                  return ["03", "22"].includes(code.setting_key);
                                case "55":
                                  return ["05", "06", "07"].includes(code.setting_key);
                                case "56":
                                  return ["01", "16"].includes(code.setting_key);
                                case "57":
                                  return ["14"].includes(code.setting_key);
                                case "58":
                                  return ["21"].includes(code.setting_key);
                                default:
                                  return false;
                              }
                            })
                            .map((code) => (
                              <option key={code.setting_key} value={code.setting_key}>
                                {code.setting_value} - {code.setting_key}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Floating Save Button */}
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
          {/* 저장 상태 라벨 - 변경사항이 있을 때만 표시 */}
          {isDirty && (
            <div className="mb-3 bg-amber-600 text-white px-3 py-2 rounded-lg shadow-md flex items-center">
              <AlertTriangle size={16} className="mr-2" />
              <span className="text-sm font-medium">저장되지 않은 변경사항</span>
            </div>
          )}

          {/* 버튼 그룹 */}
          <div className="flex gap-10">
            {/* 취소 버튼 */}
            <button
              type="button"
              onClick={() => router.push("/dashboard/workers")}
              className="w-14 h-14 bg-gray-400 hover:bg-gray-700 text-white rounded-full shadow-lg flex flex-col items-center justify-center transition-all duration-200"
              title="취소"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mb-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              <span className="text-xs leading-none mt-0.5">취소</span>
            </button>

            {/* 저장 버튼 */}
            <button
              type="submit"
              disabled={saveLoading}
              className={`flex flex-col items-center justify-center rounded-full w-16 h-16 shadow-xl ${
                isDirty
                  ? "bg-gradient-to-br from-red-400 to-red-600 hover:from-red-500 hover:to-red-700"
                  : "bg-gradient-to-br from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700"
              } text-white transform transition-all duration-200 hover:scale-110 ${
                saveLoading ? "opacity-80" : ""
              }`}
              onClick={handleSubmit}
              title={isDirty ? "변경사항 저장" : "저장됨"}
            >
              {saveLoading ? (
                <div className="animate-spin h-7 w-7 border-3 border-white border-t-transparent rounded-full"></div>
              ) : (
                <>
                  <Save size={28} strokeWidth={1.5} />
                  <span className="text-xs leading-none mt-0.5">저장</span>
                </>
              )}
            </button>
          </div>

          {/* 마지막 저장 시간 (저장되었고 변경사항이 없을 때만 표시) */}
          {lastSavedTime && !isDirty && (
            <div className="mt-3 text-xs text-white bg-green-500 px-2 py-1 rounded-full shadow-sm">
              {lastSavedTime.toLocaleTimeString()} 저장됨
            </div>
          )}
        </div>
      </div>
    </RoleGuard>
  );
}
