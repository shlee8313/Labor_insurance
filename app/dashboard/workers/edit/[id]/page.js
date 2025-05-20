//file: app/dashboard/workers/edit/[id]/page.js

//file: app/dashboard/workers/edit/[id]/page.js

"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import RoleGuard from "@/components/RoleGuard";
import { useAuthStore } from "@/lib/store/authStore";
import useCodeStore, { CODE_TYPES } from "@/lib/store/codeStore";
import { Search } from "lucide-react";
import { toast } from "react-hot-toast";
// 기존 import 아래에 추가
import { AlertTriangle, Save } from "lucide-react";

export default function WorkerEditPage({ params }) {
  const router = useRouter();
  const unwrappedParams = use(params);
  const workerId = unwrappedParams.id;

  const { user: currentUser } = useAuthStore();

  // codeStore 훅 사용
  const { getCodeList, getActiveCodeList, getCodeInfo } = useCodeStore();

  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  // 기존 상태 변수 아래에 다음 상태를 추가
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [initialFormData, setInitialFormData] = useState({});
  const [sites, setSites] = useState([]);
  const [workerSites, setWorkerSites] = useState([]);
  const [nationalityCodes, setNationalityCodes] = useState([]);
  const [residenceStatusCodes, setResidenceStatusCodes] = useState([]);
  const [jobCodes, setJobCodes] = useState([]);
  const [userSiteIds, setUserSiteIds] = useState([]);
  const [bankList, setBankList] = useState([]);
  const [systemSettings, setSystemSettings] = useState({});
  // 추가할 상태
  const [pendingSiteChanges, setPendingSiteChanges] = useState({
    sitesToAdd: [], // 새로 추가할 현장 (DB에 없었던 현장)
    sitesToRemove: [], // 제거할 현장 (DB에 있던 현장)
    originalSites: [], // 원래 DB에 있던 현장들 (초기화용)
  });
  const [modifiedWorkerSites, setModifiedWorkerSites] = useState([]); // 수정된 현장 목록 (UI용)
  // 필터링된 코드 목록
  const [filteredNationalityCodes, setFilteredNationalityCodes] = useState([]);
  const [filteredResidenceStatusCodes, setFilteredResidenceStatusCodes] = useState([]);
  const [filteredJobCodes, setFilteredJobCodes] = useState([]);
  const [filteredBanks, setFilteredBanks] = useState([]);

  // 4대보험 필터링된 코드 목록
  const [filteredNpAcquisitionCodes, setFilteredNpAcquisitionCodes] = useState([]);
  const [filteredHiAcquisitionCodes, setFilteredHiAcquisitionCodes] = useState([]);
  const [filteredEiAcquisitionCodes, setFilteredEiAcquisitionCodes] = useState([]);
  const [filteredNpLossCodes, setFilteredNpLossCodes] = useState([]);
  const [filteredHiLossCodes, setFilteredHiLossCodes] = useState([]);
  const [filteredEiLossCodes, setFilteredEiLossCodes] = useState([]);

  // 검색어 상태
  const [nationalitySearch, setNationalitySearch] = useState("");
  const [residenceStatusSearch, setResidenceStatusSearch] = useState("");
  const [jobCodeSearch, setJobCodeSearch] = useState("");
  const [siteSearch, setSiteSearch] = useState("");
  const [bankSearch, setBankSearch] = useState("");
  const [filteredSites, setFilteredSites] = useState([]);
  // 4대보험 검색어 상태
  const [npAcquisitionSearch, setNpAcquisitionSearch] = useState("");
  const [hiAcquisitionSearch, setHiAcquisitionSearch] = useState("");
  const [eiAcquisitionSearch, setEiAcquisitionSearch] = useState("");
  const [npLossSearch, setNpLossSearch] = useState("");
  const [hiLossSearch, setHiLossSearch] = useState("");
  const [eiLossSearch, setEiLossSearch] = useState("");

  // 드롭다운 열림 상태
  const [nationalityDropdownOpen, setNationalityDropdownOpen] = useState(false);
  const [residenceStatusDropdownOpen, setResidenceStatusDropdownOpen] = useState(false);
  const [jobCodeDropdownOpen, setJobCodeDropdownOpen] = useState(false);
  const [siteDropdownOpen, setSiteDropdownOpen] = useState(false);
  const [bankDropdownOpen, setBankDropdownOpen] = useState(false);

  // 4대보험 드롭다운 열림 상태
  const [npAcquisitionDropdownOpen, setNpAcquisitionDropdownOpen] = useState(false);
  const [hiAcquisitionDropdownOpen, setHiAcquisitionDropdownOpen] = useState(false);
  const [eiAcquisitionDropdownOpen, setEiAcquisitionDropdownOpen] = useState(false);
  const [npLossDropdownOpen, setNpLossDropdownOpen] = useState(false);
  const [hiLossDropdownOpen, setHiLossDropdownOpen] = useState(false);
  const [eiLossDropdownOpen, setEiLossDropdownOpen] = useState(false);

  const [formData, setFormData] = useState({
    worker_id: "",
    name: "",
    eng_name: "",
    resident_number: "",
    resident_number_formatted: "",
    nationality_code: "",
    nationality_name: "",
    residence_status_code: "",
    residence_status_name: "",
    job_code: "",
    job_name: "",
    address: "",
    contact_number: "",
    contact_number_formatted: "",
    representative_yn: false,
    worker_type: "",
    site_id: "",
    // 새로 추가된 필드
    bank_name: "",
    bank_account: "",
    resignation_date: "",
    // 국민연금 정보
    np_acquisition_code: "",
    np_acquisition_name: "",
    np_special_occupation_code: "0",
    np_pension_system_code: "0",
    np_loss_code: "",
    np_loss_name: "",
    // 건강보험 정보
    hi_acquisition_code: "",
    hi_acquisition_name: "",
    hi_premium_reduction_code: "",
    hi_loss_code: "",
    hi_loss_name: "",
    // 고용보험 정보
    ei_acquisition_code: "",
    ei_acquisition_name: "",
    ei_premium_classification_reason: "",
    ei_loss_code: "",
    ei_loss_name: "",
  });

  // 초기화 코드 수정
  // 초기화 함수 수정
  // useEffect 외부에 initializeData 함수 정의
  const initializeData = async () => {
    if (!currentUser?.id) return;

    try {
      console.log("데이터 초기화 시작");
      setLoading(true);

      // 시스템 설정 먼저 로드하고 결과를 명시적으로 저장
      const systemSettingsData = await loadSystemSettings();
      console.log("시스템 설정 로드 완료, 결과:", {
        dataLoaded: !!systemSettingsData,
        categoriesCount: Object.keys(systemSettingsData || {}).length,
      });

      // 다른 기본 데이터는 병렬로 로드
      await Promise.all([loadCodeMasters(), loadSites(), loadBankList()]);

      console.log("기본 데이터 로드 완료");

      // 시스템 설정이 완전히 로드된 후에만 근로자 데이터 로드
      if (workerId && systemSettingsData) {
        console.log(`근로자 ID ${workerId} 데이터 로드 시작`);
        // 여기에서 systemSettingsData를 인자로 전달
        await loadWorkerData(systemSettingsData);
        console.log("근로자 데이터 로드 완료");
      }

      setLoading(false);
    } catch (error) {
      console.error("데이터 초기화 오류:", error);
      setLoading(false);
      setError("데이터 초기화 중 오류가 발생했습니다.");
    }
  };

  // 개선된 초기화 코드
  useEffect(() => {
    // 함수 호출
    initializeData();
  }, [workerId, currentUser]);
  // useEffect 추가
  useEffect(() => {
    if (workerSites) {
      setModifiedWorkerSites([...workerSites]);
      setPendingSiteChanges({
        sitesToAdd: [],
        sitesToRemove: [],
        originalSites: workerSites.map((site) => site.site_id), // 원래 DB에 있던 현장 IDs 저장
      });
    }
  }, [workerSites]);
  // systemSettings 상태가 변경될 때마다 필터링된 목록 업데이트
  useEffect(() => {
    if (systemSettings) {
      setFilteredNpAcquisitionCodes(systemSettings.np_acquisition_code || []);
      setFilteredHiAcquisitionCodes(systemSettings.hi_acquisition_code || []);
      setFilteredEiAcquisitionCodes(systemSettings.ei_acquisition_code || []);
      setFilteredNpLossCodes(systemSettings.np_loss_code || []);
      setFilteredHiLossCodes(systemSettings.hi_loss_code || []);
      setFilteredEiLossCodes(systemSettings.ei_loss_code || []);
    }
  }, [systemSettings]);
  // 은행 목록 로드
  const loadBankList = () => {
    const banks = [
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
    ];
    setBankList(banks);
    setFilteredBanks(banks);
    return true;
  };

  // 개선된 시스템 설정 로드 함수
  // 개선된 시스템 설정 로드 함수
  const loadSystemSettings = async () => {
    try {
      console.log("시스템 설정 로드 시작");

      const { data, error } = await supabase
        .from("system_settings")
        .select("*")
        .or(
          `setting_category.eq.np_acquisition_code,setting_category.eq.np_loss_code,setting_category.eq.hi_acquisition_code,setting_category.eq.hi_loss_code,setting_category.eq.ei_acquisition_code,setting_category.eq.ei_loss_code,setting_category.eq.np_special_occupation_code,setting_category.eq.np_pension_system_code,setting_category.eq.hi_premium_reduction_code,setting_category.eq.ei_premium_classification_reason,setting_category.eq.worker_type_code`
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

      console.log("로드된 시스템 설정 카테고리:", Object.keys(categorizedSettings));

      // 각 카테고리에 대한 코드 수 로깅
      Object.keys(categorizedSettings).forEach((category) => {
        console.log(`${category}: ${categorizedSettings[category].length}개 코드 로드됨`);
      });

      // 상태 업데이트
      setSystemSettings(categorizedSettings);

      // 필터링된 목록 초기화
      setFilteredNpAcquisitionCodes(categorizedSettings.np_acquisition_code || []);
      setFilteredHiAcquisitionCodes(categorizedSettings.hi_acquisition_code || []);
      setFilteredEiAcquisitionCodes(categorizedSettings.ei_acquisition_code || []);
      setFilteredNpLossCodes(categorizedSettings.np_loss_code || []);
      setFilteredHiLossCodes(categorizedSettings.hi_loss_code || []);
      setFilteredEiLossCodes(categorizedSettings.ei_loss_code || []);

      console.log("시스템 설정 로드 완료");

      // 중요: 결과 데이터를 명시적으로 반환
      return categorizedSettings;
    } catch (error) {
      console.error("시스템 설정 로드 오류:", error);
      toast.error("4대보험 코드 정보를 불러오는 중 오류가 발생했습니다.");
      setError("4대보험 코드 정보를 불러오는 중 오류가 발생했습니다.");
      return {};
    }
  };

  // 검색어가 변경될 때마다 필터링된 코드 목록 업데이트
  useEffect(() => {
    setFilteredNationalityCodes(
      nationalityCodes.filter(
        (code) =>
          code.code_value.toLowerCase().includes(nationalitySearch.toLowerCase()) ||
          code.code_name.toLowerCase().includes(nationalitySearch.toLowerCase())
      )
    );
  }, [nationalitySearch, nationalityCodes]);

  useEffect(() => {
    setFilteredResidenceStatusCodes(
      residenceStatusCodes.filter(
        (code) =>
          code.code_value.toLowerCase().includes(residenceStatusSearch.toLowerCase()) ||
          code.code_name.toLowerCase().includes(residenceStatusSearch.toLowerCase())
      )
    );
  }, [residenceStatusSearch, residenceStatusCodes]);

  useEffect(() => {
    setFilteredJobCodes(
      jobCodes.filter(
        (code) =>
          code.code_value.toLowerCase().includes(jobCodeSearch.toLowerCase()) ||
          code.code_name.toLowerCase().includes(jobCodeSearch.toLowerCase())
      )
    );
  }, [jobCodeSearch, jobCodes]);

  useEffect(() => {
    // 현재 배정되지 않은 현장만 필터링
    const assignedSiteIds = new Set(modifiedWorkerSites.map((site) => site.site_id));
    const availableSites = sites.filter((site) => !assignedSiteIds.has(site.site_id));

    setFilteredSites(
      availableSites.filter((site) =>
        site.site_name.toLowerCase().includes(siteSearch.toLowerCase())
      )
    );
  }, [siteSearch, sites, modifiedWorkerSites]);

  useEffect(() => {
    setFilteredBanks(
      bankList.filter((bank) => bank.toLowerCase().includes(bankSearch.toLowerCase()))
    );
  }, [bankSearch, bankList]);
  // 4대보험 코드 필터링
  useEffect(() => {
    if (systemSettings.np_acquisition_code) {
      setFilteredNpAcquisitionCodes(
        systemSettings.np_acquisition_code.filter(
          (code) =>
            code.setting_key.toLowerCase().includes(npAcquisitionSearch.toLowerCase()) ||
            code.setting_value.toLowerCase().includes(npAcquisitionSearch.toLowerCase()) ||
            code.description.toLowerCase().includes(npAcquisitionSearch.toLowerCase())
        )
      );
    }
  }, [npAcquisitionSearch, systemSettings.np_acquisition_code]);

  useEffect(() => {
    if (systemSettings.hi_acquisition_code) {
      setFilteredHiAcquisitionCodes(
        systemSettings.hi_acquisition_code.filter(
          (code) =>
            code.setting_key.toLowerCase().includes(hiAcquisitionSearch.toLowerCase()) ||
            code.setting_value.toLowerCase().includes(hiAcquisitionSearch.toLowerCase()) ||
            code.description.toLowerCase().includes(hiAcquisitionSearch.toLowerCase())
        )
      );
    }
  }, [hiAcquisitionSearch, systemSettings.hi_acquisition_code]);

  useEffect(() => {
    if (systemSettings.ei_acquisition_code) {
      setFilteredEiAcquisitionCodes(
        systemSettings.ei_acquisition_code.filter(
          (code) =>
            code.setting_key.toLowerCase().includes(eiAcquisitionSearch.toLowerCase()) ||
            code.setting_value.toLowerCase().includes(eiAcquisitionSearch.toLowerCase()) ||
            code.description.toLowerCase().includes(eiAcquisitionSearch.toLowerCase())
        )
      );
    }
  }, [eiAcquisitionSearch, systemSettings.ei_acquisition_code]);

  useEffect(() => {
    if (systemSettings.np_loss_code) {
      setFilteredNpLossCodes(
        systemSettings.np_loss_code.filter(
          (code) =>
            code.setting_key.toLowerCase().includes(npLossSearch.toLowerCase()) ||
            code.setting_value.toLowerCase().includes(npLossSearch.toLowerCase()) ||
            code.description.toLowerCase().includes(npLossSearch.toLowerCase())
        )
      );
    }
  }, [npLossSearch, systemSettings.np_loss_code]);

  useEffect(() => {
    if (systemSettings.hi_loss_code) {
      setFilteredHiLossCodes(
        systemSettings.hi_loss_code.filter(
          (code) =>
            code.setting_key.toLowerCase().includes(hiLossSearch.toLowerCase()) ||
            code.setting_value.toLowerCase().includes(hiLossSearch.toLowerCase()) ||
            code.description.toLowerCase().includes(hiLossSearch.toLowerCase())
        )
      );
    }
  }, [hiLossSearch, systemSettings.hi_loss_code]);

  useEffect(() => {
    if (systemSettings.ei_loss_code) {
      setFilteredEiLossCodes(
        systemSettings.ei_loss_code.filter(
          (code) =>
            code.setting_key.toLowerCase().includes(eiLossSearch.toLowerCase()) ||
            code.setting_value.toLowerCase().includes(eiLossSearch.toLowerCase()) ||
            code.description.toLowerCase().includes(eiLossSearch.toLowerCase())
        )
      );
    }
  }, [eiLossSearch, systemSettings.ei_loss_code]);

  // 드롭다운 외부 클릭 핸들러
  useEffect(() => {
    const handleClickOutside = (event) => {
      const dropdowns = [
        { open: nationalityDropdownOpen, setter: setNationalityDropdownOpen },
        { open: residenceStatusDropdownOpen, setter: setResidenceStatusDropdownOpen },
        { open: jobCodeDropdownOpen, setter: setJobCodeDropdownOpen },
        { open: siteDropdownOpen, setter: setSiteDropdownOpen },
        { open: bankDropdownOpen, setter: setBankDropdownOpen },
        { open: npAcquisitionDropdownOpen, setter: setNpAcquisitionDropdownOpen },
        { open: hiAcquisitionDropdownOpen, setter: setHiAcquisitionDropdownOpen },
        { open: eiAcquisitionDropdownOpen, setter: setEiAcquisitionDropdownOpen },
        { open: npLossDropdownOpen, setter: setNpLossDropdownOpen },
        { open: hiLossDropdownOpen, setter: setHiLossDropdownOpen },
        { open: eiLossDropdownOpen, setter: setEiLossDropdownOpen },
      ];

      if (!event.target.closest(".dropdown-container")) {
        dropdowns.forEach((item) => {
          if (item.open) item.setter(false);
        });
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
    siteDropdownOpen,
    bankDropdownOpen,
    npAcquisitionDropdownOpen,
    hiAcquisitionDropdownOpen,
    eiAcquisitionDropdownOpen,
    npLossDropdownOpen,
    hiLossDropdownOpen,
    eiLossDropdownOpen,
  ]);

  // 코드 마스터 데이터 로드 함수 - codeStore 사용으로 리팩토링
  const loadCodeMasters = async () => {
    try {
      // 국적코드 로드
      const nationalityData = await getActiveCodeList("NATIONALITY");
      setNationalityCodes(nationalityData || []);
      setFilteredNationalityCodes(nationalityData || []);

      // 체류자격코드 로드
      const residenceData = await getActiveCodeList("COMMON_RESIDENCE_STATUS");
      setResidenceStatusCodes(residenceData || []);
      setFilteredResidenceStatusCodes(residenceData || []);

      // 직종코드 로드
      const jobData = await getActiveCodeList("JOB_CODE");
      setJobCodes(jobData || []);
      setFilteredJobCodes(jobData || []);

      return true;
    } catch (error) {
      console.error("코드 마스터 로드 오류:", error);
      toast.error("코드 정보를 불러오는 중 오류가 발생했습니다.");
      setError("코드 정보를 불러오는 중 오류가 발생했습니다.");
      return false;
    }
  };

  // 현장 데이터 로드 함수
  const loadSites = async () => {
    try {
      if (!currentUser?.id) return false;

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
            .from("construction_sites")
            .select("*")
            .eq("company_id", companyData.company_id)
            .eq("status", "active")
            .order("site_name", { ascending: true });
        }
      } else {
        // manager, site_manager는 배정된 현장만 조회
        sitesQuery = supabase
          .from("user_construction_sites")
          .select(
            `
            site_id,
            construction_site:construction_sites(*)
          `
          )
          .eq("user_id", currentUser.id)
          .is("removed_date", null)
          .eq("construction_site.status", "active");
      }

      if (sitesQuery) {
        const { data: sitesData, error: sitesError } = await sitesQuery;

        if (sitesError) throw sitesError;

        // 데이터 가공
        let formattedSites;
        if (currentUser.role === "admin") {
          formattedSites = sitesData || [];
        } else {
          formattedSites = (sitesData || []).map((item) => item.construction_site);
          // 사용자에게 할당된 현장 ID 배열 저장
          const siteIds = sitesData.map((item) => item.site_id);
          setUserSiteIds(siteIds);
        }

        setSites(formattedSites);
        setFilteredSites(formattedSites);
        return true;
      }
      return false;
    } catch (error) {
      console.error("현장 데이터 로드 오류:", error);
      toast.error("현장 정보를 불러오는 중 오류가 발생했습니다.");
      setError("현장 정보를 불러오는 중 오류가 발생했습니다.");
      return false;
    }
  };

  // 시스템 설정에서 코드 정보 가져오기 - 개선된 버전
  // 시스템 설정에서 코드 정보 가져오기 - 수정된 버전
  const getSettingInfo = (category, code) => {
    if (!systemSettings[category]) {
      console.log(`Category ${category} not found in systemSettings`);
      return null;
    }

    // 문자열로 변환하여 비교
    const strCode = String(code);
    const result = systemSettings[category].find((item) => String(item.setting_key) === strCode);

    if (!result) {
      console.log(`Code ${code} not found in category ${category}`);
      console.log(
        `Available codes:`,
        systemSettings[category].map((item) => item.setting_key)
      );
    } else {
      console.log(
        `Code ${code} found in category ${category}: ${result.setting_value || result.description}`
      );
    }

    return result;
  };

  // 근로자 데이터 로드 함수 - 개선된 버전
  // 근로자 데이터 로드 함수 - 수정된 버전
  // 근로자 데이터 로드 함수 - 수정된 버전
  // 근로자 데이터 로드 함수 - 디버깅 로그 추가된 전체 버전
  const loadWorkerData = async (settingsData) => {
    try {
      // console.log("loadWorkerData 시작 - 전달받은 설정 데이터:", {
      //   settingsProvided: !!settingsData,
      //   settingsKeysCount: settingsData ? Object.keys(settingsData).length : 0,
      // });

      setLoading(true);

      // 1. 근로자 기본 정보 조회
      const { data: worker, error: workerError } = await supabase
        .from("workers")
        .select("*")
        .eq("worker_id", workerId)
        .single();

      if (workerError) throw workerError;

      // 디버깅: 불러온 근로자 데이터 로깅
      console.log("불러온 근로자 데이터:", worker);

      // 2. 근로자가 배정된 현장 조회
      const { data: workerSitesData, error: workerSitesError } = await supabase
        .from("work_records")
        .select(
          `
        site_id,
        construction_site:construction_sites(
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
        if (record.construction_site && !siteIds.has(record.site_id)) {
          siteIds.add(record.site_id);
          uniqueSites.push(record.construction_site);
        }
      });

      // 활성 상태인 현장만 필터링
      const activeSites = uniqueSites.filter((site) => site.status === "active");
      setWorkerSites(activeSites);

      // codeStore를 사용하여 코드 정보 가져오기
      const nationalityInfo = worker.nationality_code
        ? getCodeInfo("NATIONALITY", worker.nationality_code)
        : null;

      const residenceStatusInfo = worker.residence_status_code
        ? getCodeInfo("COMMON_RESIDENCE_STATUS", worker.residence_status_code)
        : null;

      const jobInfo = worker.job_code ? getCodeInfo("JOB_CODE", worker.job_code) : null;

      // 사용할 시스템 설정 결정 - 전달된 설정이 있으면 사용, 없으면 현재 상태 사용
      const useSettingsData = settingsData || systemSettings;

      // console.log("사용할 시스템 설정 데이터:", {
      //   fromParameter: !!settingsData,
      //   fromState: !settingsData && !!systemSettings,
      //   dataSource: settingsData ? "parameter" : "state",
      // });

      // worker 오브젝트 로깅 추가
      // console.log("근로자 4대보험 코드 값:", {
      //   np_acquisition_code: worker.np_acquisition_code,
      //   np_loss_code: worker.np_loss_code,
      //   hi_acquisition_code: worker.hi_acquisition_code,
      //   hi_loss_code: worker.hi_loss_code,
      //   ei_acquisition_code: worker.ei_acquisition_code,
      //   ei_loss_code: worker.ei_loss_code,
      // });

      // 시스템 설정 확인 로깅 추가
      // console.log("시스템 설정 카테고리 확인:", {
      //   np_acquisition_code_exists: Array.isArray(useSettingsData.np_acquisition_code),
      //   np_acquisition_code_length: useSettingsData.np_acquisition_code?.length,
      //   np_loss_code_exists: Array.isArray(useSettingsData.np_loss_code),
      //   np_loss_code_length: useSettingsData.np_loss_code?.length,
      //   hi_acquisition_code_exists: Array.isArray(useSettingsData.hi_acquisition_code),
      //   hi_acquisition_code_length: useSettingsData.hi_acquisition_code?.length,
      //   ei_acquisition_code_exists: Array.isArray(useSettingsData.ei_acquisition_code),
      //   ei_acquisition_code_length: useSettingsData.ei_acquisition_code?.length,
      // });

      // 샘플 데이터 출력
      if (useSettingsData.np_acquisition_code?.length > 0) {
        console.log("국민연금 취득부호 샘플:", useSettingsData.np_acquisition_code[0]);
      }

      // 국민연금 정보
      let npAcquisitionInfo = null;
      let npLossInfo = null;

      if (worker.np_acquisition_code && useSettingsData.np_acquisition_code) {
        // 디버깅을 위한 로그 추가
        console.log("국민연금 취득부호 검색:", {
          searchCode: worker.np_acquisition_code,
          availableCodes: useSettingsData.np_acquisition_code.map((s) => s.setting_key),
        });

        npAcquisitionInfo = useSettingsData.np_acquisition_code.find(
          (s) => String(s.setting_key) === String(worker.np_acquisition_code)
        );

        // 검색 결과 로그
        console.log("국민연금 취득부호 검색 결과:", npAcquisitionInfo);
      }

      if (worker.np_loss_code && useSettingsData.np_loss_code) {
        console.log("국민연금 상실부호 검색:", {
          searchCode: worker.np_loss_code,
          availableCodes: useSettingsData.np_loss_code.map((s) => s.setting_key),
        });

        npLossInfo = useSettingsData.np_loss_code.find(
          (s) => String(s.setting_key) === String(worker.np_loss_code)
        );

        console.log("국민연금 상실부호 검색 결과:", npLossInfo);
      }

      // 건강보험 정보
      let hiAcquisitionInfo = null;
      let hiLossInfo = null;
      if (worker.hi_acquisition_code && useSettingsData.hi_acquisition_code) {
        console.log("건강보험 취득부호 검색:", {
          searchCode: worker.hi_acquisition_code,
          availableCodes: useSettingsData.hi_acquisition_code.map((s) => s.setting_key),
        });

        hiAcquisitionInfo = useSettingsData.hi_acquisition_code.find(
          (s) => String(s.setting_key) === String(worker.hi_acquisition_code)
        );

        console.log("건강보험 취득부호 검색 결과:", hiAcquisitionInfo);
      }

      if (worker.hi_loss_code && useSettingsData.hi_loss_code) {
        hiLossInfo = useSettingsData.hi_loss_code.find(
          (s) => String(s.setting_key) === String(worker.hi_loss_code)
        );
      }

      // 고용보험 정보
      let eiAcquisitionInfo = null;
      let eiLossInfo = null;
      if (worker.ei_acquisition_code && useSettingsData.ei_acquisition_code) {
        console.log("고용보험 취득부호 검색:", {
          searchCode: worker.ei_acquisition_code,
          availableCodes: useSettingsData.ei_acquisition_code.map((s) => s.setting_key),
        });

        eiAcquisitionInfo = useSettingsData.ei_acquisition_code.find(
          (s) => String(s.setting_key) === String(worker.ei_acquisition_code)
        );

        console.log("고용보험 취득부호 검색 결과:", eiAcquisitionInfo);
      }

      if (worker.ei_loss_code && useSettingsData.ei_loss_code) {
        eiLossInfo = useSettingsData.ei_loss_code.find(
          (s) => String(s.setting_key) === String(worker.ei_loss_code)
        );
      }

      // 주민번호 포맷팅
      const residentNumberFormatted = formatResidentNumber(worker.resident_number);

      // 전화번호 포맷팅
      const contactNumberFormatted = formatPhoneNumber(worker.contact_number);

      // 퇴직일 포맷팅
      const resignationDate = worker.resignation_date
        ? new Date(worker.resignation_date).toISOString().split("T")[0]
        : "";

      // console.log("4대보험 정보 로드 결과:", {
      //   npAcquisition: {
      //     code: worker.np_acquisition_code,
      //     info: npAcquisitionInfo,
      //   },
      //   npLoss: {
      //     code: worker.np_loss_code,
      //     info: npLossInfo,
      //   },
      //   hiAcquisition: {
      //     code: worker.hi_acquisition_code,
      //     info: hiAcquisitionInfo,
      //   },
      //   hiLoss: {
      //     code: worker.hi_loss_code,
      //     info: hiLossInfo,
      //   },
      //   eiAcquisition: {
      //     code: worker.ei_acquisition_code,
      //     info: eiAcquisitionInfo,
      //   },
      //   eiLoss: {
      //     code: worker.ei_loss_code,
      //     info: eiLossInfo,
      //   },
      // });

      // 폼 데이터 설정
      const formDataToSet = {
        worker_id: worker.worker_id,
        name: worker.name || "",
        eng_name: worker.eng_name || "",
        resident_number: worker.resident_number || "",
        resident_number_formatted: residentNumberFormatted,
        nationality_code: worker.nationality_code || "100",
        nationality_name: nationalityInfo?.code_name || "",
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

      // 폼 데이터 설정 값 로그
      // console.log("폼 데이터 설정 값:", {
      //   np_acquisition_code: formDataToSet.np_acquisition_code,
      //   np_acquisition_name: formDataToSet.np_acquisition_name,
      //   hi_acquisition_code: formDataToSet.hi_acquisition_code,
      //   hi_acquisition_name: formDataToSet.hi_acquisition_name,
      //   ei_acquisition_code: formDataToSet.ei_acquisition_code,
      //   ei_acquisition_name: formDataToSet.ei_acquisition_name,
      //   np_loss_code: formDataToSet.np_loss_code,
      //   np_loss_name: formDataToSet.np_loss_name,
      //   hi_loss_code: formDataToSet.hi_loss_code,
      //   hi_loss_name: formDataToSet.hi_loss_name,
      //   ei_loss_code: formDataToSet.ei_loss_code,
      //   ei_loss_name: formDataToSet.ei_loss_name,
      // });

      setFormData(formDataToSet);
      // 초기 데이터 저장 (비교를 위해)
      setInitialFormData(formDataToSet);
      // 여기에 한 줄 추가: 데이터 로드 시 isDirty 초기화
      setIsDirty(false);
      setError(null);

      console.log("근로자 데이터 로드 및 폼 데이터 설정 완료");
    } catch (error) {
      console.error("근로자 데이터 로드 오류:", error);
      toast.error("근로자 정보를 불러오는 중 오류가 발생했습니다.");
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

  // 주민등록번호 마스킹 처리 함수
  const maskResidentNumber = (number) => {
    if (!number) return "";
    // 하이픈이 없으면 추가
    let formatted = number;
    if (number.length === 13) {
      formatted = `${number.substring(0, 6)}-${number.substring(6)}`;
    }

    // 앞 6자리 + 하이픈 + 마스킹 처리(* 7개)
    if (formatted.includes("-")) {
      return formatted.split("-")[0] + "-*******";
    }

    // 하이픈이 없는 경우
    return number.substring(0, 6) + "-*******";
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

  // 입력 필드 변경 핸들러
  // 입력 필드 변경 핸들러
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // 체크박스의 경우 checked 값 사용, 그 외에는 value 사용
    let newValue = type === "checkbox" ? checked : value;

    if (name === "resident_number_formatted") {
      // 주민번호 형식화 (000000-0000000)
      let formatted = value.replace(/[^0-9]/g, ""); // 숫자만 남기기

      if (formatted.length > 6) {
        formatted = formatted.slice(0, 6) + "-" + formatted.slice(6, 13);
      }

      // 최대 14자리 (하이픈 포함)로 제한
      formatted = formatted.slice(0, 14);

      // 원본 값 (하이픈 제거)과 형식화된 값 모두 저장
      setFormData((prev) => {
        const updatedData = {
          ...prev,
          resident_number: formatted.replace(/-/g, ""),
          resident_number_formatted: formatted,
        };

        // 현재 상태가 초기 상태와 같은지 확인
        const isDifferentFromInitial = hasChangesFromInitial(updatedData);

        // 현장 변경사항 확인
        const hasSiteChanges =
          pendingSiteChanges.sitesToAdd.length > 0 || pendingSiteChanges.sitesToRemove.length > 0;

        // 필드 또는 현장에 변경사항이 있으면 isDirty = true
        setIsDirty(isDifferentFromInitial || hasSiteChanges);

        return updatedData;
      });
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
      setFormData((prev) => {
        const updatedData = {
          ...prev,
          contact_number: formatted.replace(/-/g, ""),
          contact_number_formatted: formatted,
        };

        // 현재 상태가 초기 상태와 같은지 확인
        const isDifferentFromInitial = hasChangesFromInitial(updatedData);

        // 현장 변경사항 확인
        const hasSiteChanges =
          pendingSiteChanges.sitesToAdd.length > 0 || pendingSiteChanges.sitesToRemove.length > 0;

        // 필드 또는 현장에 변경사항이 있으면 isDirty = true
        setIsDirty(isDifferentFromInitial || hasSiteChanges);

        return updatedData;
      });
      return;
    }

    if (name === "bank_account") {
      // 계좌번호는 숫자만 허용
      const formatted = value.replace(/[^0-9]/g, "");

      setFormData((prev) => {
        const updatedData = {
          ...prev,
          bank_account: formatted,
        };

        // 현재 상태가 초기 상태와 같은지 확인
        const isDifferentFromInitial = hasChangesFromInitial(updatedData);

        // 현장 변경사항 확인
        const hasSiteChanges =
          pendingSiteChanges.sitesToAdd.length > 0 || pendingSiteChanges.sitesToRemove.length > 0;

        // 필드 또는 현장에 변경사항이 있으면 isDirty = true
        setIsDirty(isDifferentFromInitial || hasSiteChanges);

        return updatedData;
      });
      return;
    }

    // 일반 필드 처리
    setFormData((prev) => {
      const updatedData = {
        ...prev,
        [name]: newValue,
      };

      // 현재 상태가 초기 상태와 같은지 확인
      const isDifferentFromInitial = hasChangesFromInitial(updatedData);

      // 현장 변경사항 확인
      const hasSiteChanges =
        pendingSiteChanges.sitesToAdd.length > 0 || pendingSiteChanges.sitesToRemove.length > 0;

      // 필드 또는 현장에 변경사항이 있으면 isDirty = true
      setIsDirty(isDifferentFromInitial || hasSiteChanges);

      return updatedData;
    });
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
  // 국적 선택 핸들러
  // 국적 선택 핸들러
  const handleNationalitySelect = (code) => {
    setFormData((prev) => {
      const updatedData = {
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
      };

      // 현재 상태가 초기 상태와 같은지 확인
      const isDifferentFromInitial = hasChangesFromInitial(updatedData);

      // 현장 변경사항 확인
      const hasSiteChanges =
        pendingSiteChanges.sitesToAdd.length > 0 || pendingSiteChanges.sitesToRemove.length > 0;

      // 필드 또는 현장에 변경사항이 있으면 isDirty = true
      setIsDirty(isDifferentFromInitial || hasSiteChanges);

      return updatedData;
    });

    setNationalityDropdownOpen(false);
    setNationalitySearch("");
  };

  // 체류자격 선택 핸들러
  const handleResidenceStatusSelect = (code) => {
    setFormData((prev) => {
      const updatedData = {
        ...prev,
        residence_status_code: code.code_value,
        residence_status_name: code.code_name,
      };

      // 현재 상태가 초기 상태와 같은지 확인
      const isDifferentFromInitial = hasChangesFromInitial(updatedData);

      // 현장 변경사항 확인
      const hasSiteChanges =
        pendingSiteChanges.sitesToAdd.length > 0 || pendingSiteChanges.sitesToRemove.length > 0;

      // 필드 또는 현장에 변경사항이 있으면 isDirty = true
      setIsDirty(isDifferentFromInitial || hasSiteChanges);

      return updatedData;
    });

    setResidenceStatusDropdownOpen(false);
    setResidenceStatusSearch("");
  };

  // 직종 선택 핸들러
  const handleJobCodeSelect = (code) => {
    setFormData((prev) => {
      const updatedData = {
        ...prev,
        job_code: code.code_value,
        job_name: code.code_name,
      };

      // 현재 상태가 초기 상태와 같은지 확인
      const isDifferentFromInitial = hasChangesFromInitial(updatedData);

      // 현장 변경사항 확인
      const hasSiteChanges =
        pendingSiteChanges.sitesToAdd.length > 0 || pendingSiteChanges.sitesToRemove.length > 0;

      // 필드 또는 현장에 변경사항이 있으면 isDirty = true
      setIsDirty(isDifferentFromInitial || hasSiteChanges);

      return updatedData;
    });

    setJobCodeDropdownOpen(false);
    setJobCodeSearch("");
  };

  // 은행 선택 핸들러
  const handleBankSelect = (bank) => {
    setFormData((prev) => {
      const updatedData = {
        ...prev,
        bank_name: bank,
      };

      // 현재 상태가 초기 상태와 같은지 확인
      const isDifferentFromInitial = hasChangesFromInitial(updatedData);

      // 현장 변경사항 확인
      const hasSiteChanges =
        pendingSiteChanges.sitesToAdd.length > 0 || pendingSiteChanges.sitesToRemove.length > 0;

      // 필드 또는 현장에 변경사항이 있으면 isDirty = true
      setIsDirty(isDifferentFromInitial || hasSiteChanges);

      return updatedData;
    });

    setBankDropdownOpen(false);
    setBankSearch("");
  };

  // 4대보험 코드 선택 핸들러
  // 4대보험 코드 선택 핸들러 - 수정된 버전
  // 4대보험 코드 선택 핸들러 - 수정된 버전
  // 4대보험 코드 선택 핸들러
  const handleInsuranceCodeSelect = (category, code, dropdownSetter, searchSetter) => {
    console.log("보험 코드 선택:", category, code);

    const fieldMapping = {
      np_acquisition_code: { code: "np_acquisition_code", name: "np_acquisition_name" },
      np_loss_code: { code: "np_loss_code", name: "np_loss_name" },
      hi_acquisition_code: { code: "hi_acquisition_code", name: "hi_acquisition_name" },
      hi_loss_code: { code: "hi_loss_code", name: "hi_loss_name" },
      ei_acquisition_code: { code: "ei_acquisition_code", name: "ei_acquisition_name" },
      ei_loss_code: { code: "ei_loss_code", name: "ei_loss_name" },
    };

    const fields = fieldMapping[category];

    setFormData((prev) => {
      let updatedData = { ...prev };

      if (fields) {
        updatedData = {
          ...updatedData,
          [fields.code]: String(code.setting_key),
          [fields.name]: code.setting_value || code.description,
        };
      } else {
        // 그 외 필드 (special_occupation, pension_system, premium_reduction, classification_reason)
        updatedData = {
          ...updatedData,
          [category]: String(code.setting_key),
        };
      }

      // 현재 상태가 초기 상태와 같은지 확인
      const isDifferentFromInitial = hasChangesFromInitial(updatedData);

      // 현장 변경사항 확인
      const hasSiteChanges =
        pendingSiteChanges.sitesToAdd.length > 0 || pendingSiteChanges.sitesToRemove.length > 0;

      // 필드 또는 현장에 변경사항이 있으면 isDirty = true
      setIsDirty(isDifferentFromInitial || hasSiteChanges);

      return updatedData;
    });

    dropdownSetter(false);
    searchSetter("");
  };

  // 현장 선택 핸들러
  const handleSiteSelect = (site) => {
    setFormData((prev) => ({
      ...prev,
      site_id: site.site_id,
    }));
    setSiteDropdownOpen(false);
    setSiteSearch("");
  };

  // 폼 제출 핸들러
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
        toast.error("필수 입력 항목을 모두 입력해주세요.");
        return;
      }

      // 주민등록번호 형식 검증 (숫자 13자리)
      const residentNumberRegex = /^\d{13}$/;
      if (!residentNumberRegex.test(formData.resident_number)) {
        setError("주민등록번호는 하이픈(-) 없이 13자리 숫자로 입력해주세요.");
        toast.error("주민등록번호는 하이픈(-) 없이 13자리 숫자로 입력해주세요.");
        return;
      }

      // 외국인이면 체류자격 필수
      if (formData.nationality_code !== "100" && !formData.residence_status_code) {
        setError("외국인의 경우 체류자격을 선택해주세요.");
        toast.error("외국인의 경우 체류자격을 선택해주세요.");
        return;
      }

      // 근로자 정보 업데이트
      const { data: worker, error: workerError } = await supabase
        .from("workers")
        .update({
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
          // 새로 추가된 필드
          bank_name: formData.bank_name || null,
          bank_account: formData.bank_account || null,
          resignation_date: formData.resignation_date || null,
          // 국민연금 정보
          np_acquisition_code: formData.np_acquisition_code || null,
          np_special_occupation_code: formData.np_special_occupation_code || "0",
          np_pension_system_code: formData.np_pension_system_code || "0",
          np_loss_code: formData.np_loss_code || null,
          // 건강보험 정보
          hi_acquisition_code: formData.hi_acquisition_code || null,
          hi_premium_reduction_code: formData.hi_premium_reduction_code || null,
          hi_loss_code: formData.hi_loss_code || null,
          // 고용보험 정보
          ei_acquisition_code: formData.ei_acquisition_code || null,
          ei_premium_classification_reason: formData.ei_premium_classification_reason || null,
          ei_loss_code: formData.ei_loss_code || null,
        })
        .eq("worker_id", workerId)
        .select()
        .single();

      if (workerError) {
        if (workerError.code === "23505") {
          // 중복 키 오류 (PostgreSQL)
          throw new Error("이미 등록된 주민등록번호입니다.");
        }
        throw workerError;
      }

      // 현장 배정 변경사항 처리
      if (pendingSiteChanges.sitesToAdd.length > 0 || pendingSiteChanges.sitesToRemove.length > 0) {
        // 1. 실제 근무 기록이 있는 현장은 제거 불가능한지 확인
        if (pendingSiteChanges.sitesToRemove.length > 0) {
          const { data: actualWorkRecords, error: actualWorkError } = await supabase
            .from("work_records")
            .select("site_id")
            .eq("worker_id", workerId)
            .in("site_id", pendingSiteChanges.sitesToRemove)
            .neq("status", "registration");

          if (actualWorkError) throw actualWorkError;

          if (actualWorkRecords && actualWorkRecords.length > 0) {
            const sitesWithRecords = actualWorkRecords.map((r) => r.site_id);
            // 실제 근무 기록이 있는 현장은 제거 불가
            if (sitesWithRecords.length > 0) {
              const sitesWithRecordsNames = modifiedWorkerSites
                .filter((site) => sitesWithRecords.includes(site.site_id))
                .map((site) => site.site_name)
                .join(", ");

              throw new Error(
                `${sitesWithRecordsNames} 현장에 실제 근무 기록이 있어 배정을 취소할 수 없습니다.`
              );
            }
          }
        }

        // 2. 제거할 현장 처리
        if (pendingSiteChanges.sitesToRemove.length > 0) {
          const { data: records, error: recordsError } = await supabase
            .from("work_records")
            .select("record_id")
            .eq("worker_id", workerId)
            .in("site_id", pendingSiteChanges.sitesToRemove)
            .eq("status", "registration");

          if (recordsError) throw recordsError;

          if (records && records.length > 0) {
            const recordIds = records.map((r) => r.record_id);
            const { error: deleteError } = await supabase
              .from("work_records")
              .delete()
              .in("record_id", recordIds);

            if (deleteError) throw deleteError;
          }
        }

        // 3. 추가할 현장 처리
        if (pendingSiteChanges.sitesToAdd.length > 0) {
          const todayDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD 형식

          const recordsToInsert = pendingSiteChanges.sitesToAdd.map((siteId) => ({
            worker_id: workerId,
            site_id: siteId,
            work_date: todayDate,
            work_hours: 0,
            work_type: "registration",
            daily_wage: 0,
            status: "registration",
          }));

          const { error: insertError } = await supabase
            .from("work_records")
            .insert(recordsToInsert);

          if (insertError) throw insertError;
        }
      }

      // 현장 변경사항 초기화
      setPendingSiteChanges({ sitesToAdd: [], sitesToRemove: [] });

      // 데이터 갱신
      await loadWorkerData();
      // 데이터 저장 성공 시 초기 데이터 업데이트
      setInitialFormData({ ...formData });
      setLastSavedTime(new Date());
      setIsDirty(false); // Explicitly set isDirty to false
      // toast.success("근로자 정보가 업데이트되었습니다.");
      setSuccessMessage("근로자 정보가 업데이트되었습니다.");
      setTimeout(() => setSuccessMessage(null), 1500);
    } catch (error) {
      console.error("근로자 정보 업데이트 오류:", error);
      toast.error(error.message || "근로자 정보 업데이트 중 오류가 발생했습니다.");
      setError(error.message || "근로자 정보 업데이트 중 오류가 발생했습니다.");
    } finally {
      setSaveLoading(false);
    }
  };
  // 현장 배정 핸들러
  // 현장 배정 핸들러
  // 현장 배정 핸들러
  const handleAssignSite = (e) => {
    e.preventDefault();
    const siteId = parseInt(formData.site_id);

    if (!siteId) {
      setError("배정할 현장을 선택해주세요.");
      toast.error("배정할 현장을 선택해주세요.");
      return;
    }

    // 현재 사용자가 해당 현장에 접근 권한이 있는지 확인
    if (!canManageSite(siteId)) {
      toast.error("해당 현장에 대한 접근 권한이 없습니다.");
      return;
    }

    // 이미 UI에 배정된 현장인지 확인
    const isAlreadyAssigned = modifiedWorkerSites.some((site) => site.site_id === siteId);
    if (isAlreadyAssigned) {
      setError("이미 해당 현장에 배정되어 있습니다.");
      toast.error("이미 해당 현장에 배정되어 있습니다.");
      return;
    }

    // 추가할 현장 찾기
    const siteToAdd = sites.find((site) => site.site_id === siteId);
    if (!siteToAdd) {
      setError("선택한 현장을 찾을 수 없습니다.");
      toast.error("선택한 현장을 찾을 수 없습니다.");
      return;
    }

    // 원래 DB에 있던 현장인지 확인
    const isOriginalSite = pendingSiteChanges.originalSites.includes(siteId);

    // 변경사항을 추적하는 상태 업데이트
    setPendingSiteChanges((prev) => {
      if (isOriginalSite) {
        // 원래 있던 현장인 경우 => 제거 목록에서 제거 (원래 상태로 복원)
        const newSitesToRemove = prev.sitesToRemove.filter((id) => id !== siteId);

        // 변경사항이 있는지 확인 - 변경 전후 제거 목록 비교
        const hasChanges =
          prev.sitesToRemove.length !== newSitesToRemove.length || prev.sitesToAdd.length > 0;

        // 변경사항이 있으면 isDirty = true
        setIsDirty(hasChanges);

        return {
          ...prev,
          sitesToRemove: newSitesToRemove,
        };
      } else {
        // 새로 추가하는 현장인 경우 => 추가 목록에 추가
        if (!prev.sitesToAdd.includes(siteId)) {
          // 추가 목록이 변경되므로 isDirty = true
          setIsDirty(true);

          return {
            ...prev,
            sitesToAdd: [...prev.sitesToAdd, siteId],
          };
        }
        return prev; // 변경 없음
      }
    });

    // UI용 현장 목록 업데이트
    setModifiedWorkerSites((prev) => [...prev, siteToAdd]);

    // 폼 초기화
    setFormData((prev) => ({
      ...prev,
      site_id: "",
    }));

    // 성공 메시지
    toast.success("현장이 임시 배정되었습니다. 저장 버튼을 눌러 확정하세요.");

    // 드롭다운 닫기
    setSiteDropdownOpen(false);
    setSiteSearch("");
  };

  // 현장 배정 제거 핸들러
  const handleRemoveSite = (siteId) => {
    // 현재 사용자가 해당 현장에 접근 권한이 있는지 확인
    if (!canManageSite(siteId)) {
      toast.error("해당 현장에 대한 접근 권한이 없습니다.");
      return;
    }

    // 제거할 현장 정보 찾기
    const siteToRemove = modifiedWorkerSites.find((site) => site.site_id === siteId);
    if (!siteToRemove) {
      toast.error("해당 현장을 찾을 수 없습니다.");
      return;
    }

    // 원래 DB에 있던 현장인지 확인 (originalSites에 있는지)
    const isOriginalSite = pendingSiteChanges.originalSites.includes(siteId);

    setPendingSiteChanges((prev) => {
      let newState;

      if (isOriginalSite) {
        // 원래 있던 현장인 경우 => 제거 목록에 추가
        if (!prev.sitesToRemove.includes(siteId)) {
          newState = {
            ...prev,
            sitesToRemove: [...prev.sitesToRemove, siteId],
          };
        } else {
          newState = prev; // 이미 제거 목록에 있으면 변경 없음
        }
      } else {
        // 새로 추가했던 현장인 경우 => 추가 목록에서만 제거
        newState = {
          ...prev,
          sitesToAdd: prev.sitesToAdd.filter((id) => id !== siteId),
        };
      }

      // 변경사항이 원래 상태와 같은지 확인
      const hasPendingChanges = newState.sitesToAdd.length > 0 || newState.sitesToRemove.length > 0;

      // 변경사항 있으면 isDirty = true, 없으면 false
      setIsDirty(hasPendingChanges);

      return newState;
    });

    // UI용 현장 목록 업데이트
    setModifiedWorkerSites((prev) => prev.filter((site) => site.site_id !== siteId));

    toast.success("현장 배정이 임시 취소되었습니다. 저장 버튼을 눌러 확정하세요.");
  };

  // 현재 사용자가 해당 현장에 대한 권한이 있는지 확인
  const canManageSite = (siteId) => {
    if (currentUser?.role === "admin") return true;
    return userSiteIds.includes(siteId);
  };
  // 드롭다운 컴포넌트 (재사용)
  // 드롭다운 컴포넌트 (재사용) - 수정된 버전
  // 드롭다운 컴포넌트 (재사용) - 수정된 버전
  const renderDropdown = (
    title,
    isOpen,
    setIsOpen,
    selectedValue,
    searchValue,
    setSearchValue,
    filteredOptions,
    handleSelect,
    placeholder = "선택하세요",
    disabled = false
  ) => {
    // selectedValue 디버깅 추가
    console.log(`Dropdown ${title} - selectedValue:`, selectedValue);

    return (
      <div className="dropdown-container relative">
        <label className="block text-sm font-medium text-gray-700 mb-1">{title}</label>
        <div
          className={`border border-gray-300 rounded-md ${
            disabled ? "bg-gray-100 cursor-not-allowed" : "cursor-pointer"
          }`}
          onClick={() => !disabled && setIsOpen(!isOpen)}
        >
          <div className="w-full px-3 py-2 flex justify-between items-center">
            <span className={disabled ? "text-gray-500" : ""}>
              {/* 디버깅을 위해 명시적으로 확인 */}
              {selectedValue ? `${selectedValue}` : placeholder}
            </span>
            {!disabled && <span className="ml-2">▼</span>}
          </div>
        </div>

        {isOpen && !disabled && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  className="w-full pl-8 pr-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="검색..."
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <div>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option, index) => (
                  <div
                    key={index}
                    className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
                    onClick={() => handleSelect(option)}
                  >
                    <span className="font-medium mr-2">
                      {option.code_name || option.setting_value || option.description || option}
                    </span>
                    {(option.code_value || option.setting_key) && (
                      <span className="text-xs text-gray-500">
                        ({option.code_value || option.setting_key})
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div className="px-3 py-2 text-gray-500">검색 결과가 없습니다</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

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
      <div className="w-full px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">근로자 수정</h1>
          {/* <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => router.push("/dashboard/workers")}
              className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
            >
              목록으로
            </button>
            <button
              type="submit"
              disabled={saveLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:bg-blue-300 disabled:cursor-not-allowed"
              onClick={handleSubmit}
            >
              {saveLoading ? (
                <span className="flex items-center">
                  <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                  처리 중...
                </span>
              ) : (
                "저장"
              )}
            </button>
          </div> */}
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

        <div className="grid grid-cols-12 gap-6">
          {/* 근로자 기본 정보 */}
          <div className="col-span-8 bg-white shadow-2xl rounded-2xl px-6 pt-4">
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
                    {formData.nationality_code !== "100" && (
                      <p className="text-xs text-gray-500 mt-1">외국인의 경우 권장</p>
                    )}
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
                    <p className="text-xs text-gray-500 mt-1">
                      주민번호는 자동으로 하이픈이 입력됩니다.
                    </p>
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
                    <p className="text-xs text-gray-500 mt-1">
                      전화번호는 자동으로 하이픈이 입력됩니다.
                    </p>
                  </div>
                  {/* 국적코드 */}
                  {renderDropdown(
                    "국적 *",
                    nationalityDropdownOpen,
                    setNationalityDropdownOpen,
                    formData.nationality_name,
                    nationalitySearch,
                    setNationalitySearch,
                    filteredNationalityCodes,
                    handleNationalitySelect
                  )}

                  {/* 체류자격코드 (외국인인 경우) */}
                  {renderDropdown(
                    `체류자격 ${formData.nationality_code !== "100" ? "*" : ""}`,
                    residenceStatusDropdownOpen,
                    setResidenceStatusDropdownOpen,
                    formData.residence_status_name,
                    residenceStatusSearch,
                    setResidenceStatusSearch,
                    filteredResidenceStatusCodes,
                    handleResidenceStatusSelect,
                    formData.nationality_code === "100" ? "해당 없음" : "선택하세요",
                    formData.nationality_code === "100"
                  )}

                  {/* 직종코드 */}
                  {renderDropdown(
                    "직종",
                    jobCodeDropdownOpen,
                    setJobCodeDropdownOpen,
                    formData.job_name,
                    jobCodeSearch,
                    setJobCodeSearch,
                    filteredJobCodes,
                    handleJobCodeSelect
                  )}
                  <div></div>
                  {/* 은행명 */}
                  {renderDropdown(
                    "은행명",
                    bankDropdownOpen,
                    setBankDropdownOpen,
                    formData.bank_name,
                    bankSearch,
                    setBankSearch,
                    filteredBanks,
                    handleBankSelect
                  )}

                  {/* 계좌번호 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">계좌번호</label>
                    <input
                      type="text"
                      name="bank_account"
                      value={formData.bank_account}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="숫자만 입력"
                    />
                    <p className="text-xs text-gray-500 mt-1">계좌번호는 숫자만 입력 가능합니다.</p>
                  </div>

                  {/* 퇴직일 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">퇴직일</label>
                    <input
                      type="date"
                      name="resignation_date"
                      value={formData.resignation_date}
                      onChange={handleChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-red-500 mt-1">퇴직한 경우에만 입력하세요.</p>
                  </div>

                  {/* 주소 */}
                  <div className="lg:col-span-3">
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
                  <div className="lg:col-span-2">
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
                  <div className="lg:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
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
                {/* <div className="flex justify-end space-x-4 mt-6">
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/workers")}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={saveLoading}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed"
                  >
                    {saveLoading ? (
                      <span className="flex items-center">
                        <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        처리 중...
                      </span>
                    ) : (
                      "저장"
                    )}
                  </button>
                </div> */}
              </form>
            </div>
          </div>
          <div className="col-span-4">
            {/* 현장 배정 정보 */}
            <div className="bg-white shadow-xl  rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">현장 배정 정보</h2>

              {/* 현재 배정된 현장 목록 */}
              {/* 현재 배정된 현장 목록 */}
              <div className="mb-6">
                <h3 className="text-lg font-medium text-blue-500 mb-2">배정된 현장</h3>
                {/* 변경된 상태가 있는 경우 알림 표시 */}
                {(pendingSiteChanges.sitesToAdd.length > 0 ||
                  pendingSiteChanges.sitesToRemove.length > 0) && (
                  <div className="bg-amber-50 p-2 rounded border border-amber-200 mb-2 text-sm">
                    <span className="font-medium text-amber-600">
                      변경사항이 있습니다. 저장 버튼을 눌러 확정하세요.
                    </span>
                  </div>
                )}

                {modifiedWorkerSites.length > 0 ? (
                  <ul className="space-y-2">
                    {modifiedWorkerSites.map((site) => {
                      // 새로 추가된 현장인지 확인
                      const isNewlyAdded = pendingSiteChanges.sitesToAdd.includes(site.site_id);

                      return (
                        <li
                          key={site.site_id}
                          className={`flex items-center justify-between p-2 rounded border ${
                            isNewlyAdded
                              ? "bg-green-50 border-green-200"
                              : "bg-gray-50 border-gray-200"
                          }`}
                        >
                          <span className="flex-grow font-medium">
                            {site.site_name}
                            {isNewlyAdded && (
                              <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                추가됨
                              </span>
                            )}
                          </span>
                          {canManageSite(site.site_id) && (
                            <button
                              type="button"
                              onClick={() => handleRemoveSite(site.site_id)}
                              disabled={saveLoading}
                              className="ml-2 text-xs px-2 py-1 bg-red-500 hover:bg-red-700 text-white rounded disabled:bg-red-300 disabled:cursor-not-allowed"
                            >
                              배정 취소
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-gray-500 italic">배정된 현장이 없습니다.</p>
                )}
              </div>
              {/* 새 현장 배정 폼 */}
              <div>
                <h3 className="text-lg text-blue-500 font-medium mb-2">새 현장 배정</h3>
                <form onSubmit={handleAssignSite}>
                  <div className="mb-4 dropdown-container relative">
                    <div
                      className="border border-gray-300 rounded-md cursor-pointer"
                      onClick={() => setSiteDropdownOpen(!siteDropdownOpen)}
                    >
                      <div className="w-full px-3 py-2 flex justify-between items-center">
                        <span>
                          {sites.find((s) => s.site_id === parseInt(formData.site_id))?.site_name ||
                            "배정할 현장 선택"}
                        </span>
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
                            // 이미 배정된 현장(modifiedWorkerSites에 있는 현장)은 필터링
                            filteredSites
                              .filter(
                                (site) =>
                                  !modifiedWorkerSites.some((ms) => ms.site_id === site.site_id)
                              )
                              .map((site) => (
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

                    {/* 배정 가능한 현장 없음 메시지 수정 */}
                    {sites.length === 0 ? (
                      <p className="text-sm text-red-500 mt-1">배정 가능한 현장이 없습니다.</p>
                    ) : sites.length === modifiedWorkerSites.length ? (
                      <p className="text-sm text-orange-500 mt-1">
                        모든 현장에 이미 배정되어 있습니다.
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="submit"
                    disabled={
                      saveLoading ||
                      !formData.site_id ||
                      sites.length === 0 ||
                      sites.length === modifiedWorkerSites.length ||
                      modifiedWorkerSites.some(
                        (site) => site.site_id === parseInt(formData.site_id)
                      )
                    }
                    className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-300 disabled:cursor-not-allowed"
                  >
                    {saveLoading ? (
                      <span className="flex items-center justify-center">
                        <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        처리 중...
                      </span>
                    ) : (
                      "현장 배정"
                    )}
                  </button>
                </form>
              </div>
            </div>
            {/* 4대보험 정보 */}
            <div className="bg-white shadow-2xl  rounded-2xl p-6 mt-6 ">
              <h2 className="text-xl font-semibold mb-4">4대보험 정보</h2>

              {/* 국민연금 */}
              <div className="border-t border-gray-200 pt-4 mb-6">
                <h3 className="text-lg text-blue-500 font-semibold mb-4">국민연금</h3>
                <div className="grid grid-cols-2 gap-6">
                  {/* 국민연금 취득부호 */}
                  {renderDropdown(
                    "취득부호",
                    npAcquisitionDropdownOpen,
                    setNpAcquisitionDropdownOpen,
                    formData.np_acquisition_name,
                    npAcquisitionSearch,
                    setNpAcquisitionSearch,
                    filteredNpAcquisitionCodes,
                    (code) =>
                      handleInsuranceCodeSelect(
                        "np_acquisition_code",
                        code,
                        setNpAcquisitionDropdownOpen,
                        setNpAcquisitionSearch
                      )
                  )}

                  {/* 국민연금 상실부호 */}
                  {renderDropdown(
                    "상실부호",
                    npLossDropdownOpen,
                    setNpLossDropdownOpen,
                    formData.np_loss_name,
                    npLossSearch,
                    setNpLossSearch,
                    filteredNpLossCodes,
                    (code) =>
                      handleInsuranceCodeSelect(
                        "np_loss_code",
                        code,
                        setNpLossDropdownOpen,
                        setNpLossSearch
                      )
                  )}

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
              <div className="border-t border-gray-200 pt-4 mb-6">
                <h3 className="text-lg text-blue-500 font-semibold mb-4">건강보험</h3>
                <div className="grid grid-cols-2 gap-6">
                  {/* 건강보험 취득부호 */}
                  {renderDropdown(
                    "취득부호",
                    hiAcquisitionDropdownOpen,
                    setHiAcquisitionDropdownOpen,
                    formData.hi_acquisition_name,
                    hiAcquisitionSearch,
                    setHiAcquisitionSearch,
                    filteredHiAcquisitionCodes,
                    (code) =>
                      handleInsuranceCodeSelect(
                        "hi_acquisition_code",
                        code,
                        setHiAcquisitionDropdownOpen,
                        setHiAcquisitionSearch
                      )
                  )}

                  {/* 건강보험 상실부호 */}
                  {renderDropdown(
                    "상실부호",
                    hiLossDropdownOpen,
                    setHiLossDropdownOpen,
                    formData.hi_loss_name,
                    hiLossSearch,
                    setHiLossSearch,
                    filteredHiLossCodes,
                    (code) =>
                      handleInsuranceCodeSelect(
                        "hi_loss_code",
                        code,
                        setHiLossDropdownOpen,
                        setHiLossSearch
                      )
                  )}

                  {/* 건강보험 보험료 감면 */}
                  {systemSettings.hi_premium_reduction_code && (
                    <div>
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
                <div className="grid grid-cols-2 gap-6">
                  {/* 고용보험 취득부호 */}
                  {renderDropdown(
                    "취득부호",
                    eiAcquisitionDropdownOpen,
                    setEiAcquisitionDropdownOpen,
                    formData.ei_acquisition_name,
                    eiAcquisitionSearch,
                    setEiAcquisitionSearch,
                    filteredEiAcquisitionCodes,
                    (code) =>
                      handleInsuranceCodeSelect(
                        "ei_acquisition_code",
                        code,
                        setEiAcquisitionDropdownOpen,
                        setEiAcquisitionSearch
                      )
                  )}
                  {/* 고용보험 상실부호 */}
                  {renderDropdown(
                    "상실부호",
                    eiLossDropdownOpen,
                    setEiLossDropdownOpen,
                    formData.ei_loss_name,
                    eiLossSearch,
                    setEiLossSearch,
                    filteredEiLossCodes,
                    (code) =>
                      handleInsuranceCodeSelect(
                        "ei_loss_code",
                        code,
                        setEiLossDropdownOpen,
                        setEiLossSearch
                      )
                  )}
                  {/* 고용보험 부과 구분사유 */}

                  {systemSettings.ei_premium_classification_reason &&
                    formData.ei_acquisition_code && (
                      <div className="col-span-2 mb-10">
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
        {/* 입력 데이터 디버그 표시 (개발용) */}
        {/* {process.env.NODE_ENV === "development" && (
          <div className="mt-8 p-4 bg-gray-100 rounded-md text-xs">
            <h3 className="font-bold mb-2">디버그 정보 (개발 모드에서만 표시)</h3>
            <pre className="whitespace-pre-wrap">
              {JSON.stringify(
                {
                  ...formData,
                  resident_number: formData.resident_number?.replace(/./g, "*"), // 민감 정보 마스킹
                },
                null,
                2
              )}
            </pre>
          </div>
        )} */}
        {/* Floating Save Button */}
        {/* Floating Save Button - 가로바 없는 깔끔한 디자인 */}
        <div className="fixed bottom-2 right-6 z-50 flex flex-col items-end">
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
                  {/* <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 mb-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M5 13l4 4L19 7"
                    />
                  </svg> */}
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

// "use client";

// import { useState, useEffect, use } from "react";
// import { useRouter } from "next/navigation";
// import { supabase } from "@/lib/supabase";
// import RoleGuard from "@/components/RoleGuard";
// import { useAuthStore } from "@/lib/store/authStore";
// import useCodeStore, { CODE_TYPES } from "@/lib/store/codeStore"; // codeStore 추가
// import { Search } from "lucide-react";
// import { toast } from "react-hot-toast";

// export default function WorkerEditPage({ params }) {
//   const router = useRouter();
//   const unwrappedParams = use(params);
//   const workerId = unwrappedParams.id;

//   // const workerId = params.id;
//   const { user: currentUser } = useAuthStore();

//   // codeStore 훅 사용
//   const { getCodeList, getActiveCodeList, getCodeInfo } = useCodeStore();

//   const [loading, setLoading] = useState(true);
//   const [saveLoading, setSaveLoading] = useState(false);
//   const [error, setError] = useState(null);
//   const [successMessage, setSuccessMessage] = useState(null);

//   const [sites, setSites] = useState([]);
//   const [workerSites, setWorkerSites] = useState([]);
//   const [nationalityCodes, setNationalityCodes] = useState([]);
//   const [residenceStatusCodes, setResidenceStatusCodes] = useState([]);
//   const [jobCodes, setJobCodes] = useState([]);
//   const [userSiteIds, setUserSiteIds] = useState([]);

//   // 필터링된 코드 목록
//   const [filteredNationalityCodes, setFilteredNationalityCodes] = useState([]);
//   const [filteredResidenceStatusCodes, setFilteredResidenceStatusCodes] = useState([]);
//   const [filteredJobCodes, setFilteredJobCodes] = useState([]);

//   // 검색어 상태
//   const [nationalitySearch, setNationalitySearch] = useState("");
//   const [residenceStatusSearch, setResidenceStatusSearch] = useState("");
//   const [jobCodeSearch, setJobCodeSearch] = useState("");
//   const [siteSearch, setSiteSearch] = useState("");
//   const [filteredSites, setFilteredSites] = useState([]);

//   // 드롭다운 열림 상태
//   const [nationalityDropdownOpen, setNationalityDropdownOpen] = useState(false);
//   const [residenceStatusDropdownOpen, setResidenceStatusDropdownOpen] = useState(false);
//   const [jobCodeDropdownOpen, setJobCodeDropdownOpen] = useState(false);
//   const [siteDropdownOpen, setSiteDropdownOpen] = useState(false);

//   const [formData, setFormData] = useState({
//     worker_id: "",
//     name: "",
//     eng_name: "",
//     resident_number: "",
//     resident_number_formatted: "",
//     nationality_code: "",
//     nationality_name: "",
//     residence_status_code: "",
//     residence_status_name: "",
//     job_code: "",
//     job_name: "",
//     address: "",
//     contact_number: "",
//     contact_number_formatted: "",
//     representative_yn: false,
//     worker_type: "",
//     site_id: "",
//   });

//   useEffect(() => {
//     // 코드 마스터 데이터와 현장 데이터 로드
//     if (currentUser?.id) {
//       Promise.all([loadCodeMasters(), loadSites()]).then(() => {
//         // 근로자 데이터 로드
//         if (workerId) {
//           loadWorkerData();
//         }
//       });
//     }
//   }, [workerId, currentUser]);

//   // 검색어가 변경될 때마다 필터링된 코드 목록 업데이트
//   useEffect(() => {
//     setFilteredNationalityCodes(
//       nationalityCodes.filter(
//         (code) =>
//           code.code_value.toLowerCase().includes(nationalitySearch.toLowerCase()) ||
//           code.code_name.toLowerCase().includes(nationalitySearch.toLowerCase())
//       )
//     );
//   }, [nationalitySearch, nationalityCodes]);

//   useEffect(() => {
//     setFilteredResidenceStatusCodes(
//       residenceStatusCodes.filter(
//         (code) =>
//           code.code_value.toLowerCase().includes(residenceStatusSearch.toLowerCase()) ||
//           code.code_name.toLowerCase().includes(residenceStatusSearch.toLowerCase())
//       )
//     );
//   }, [residenceStatusSearch, residenceStatusCodes]);

//   useEffect(() => {
//     setFilteredJobCodes(
//       jobCodes.filter(
//         (code) =>
//           code.code_value.toLowerCase().includes(jobCodeSearch.toLowerCase()) ||
//           code.code_name.toLowerCase().includes(jobCodeSearch.toLowerCase())
//       )
//     );
//   }, [jobCodeSearch, jobCodes]);

//   useEffect(() => {
//     // 현재 배정되지 않은 현장만 필터링
//     const assignedSiteIds = new Set(workerSites.map((site) => site.site_id));
//     const availableSites = sites.filter((site) => !assignedSiteIds.has(site.site_id));

//     setFilteredSites(
//       availableSites.filter((site) =>
//         site.site_name.toLowerCase().includes(siteSearch.toLowerCase())
//       )
//     );
//   }, [siteSearch, sites, workerSites]);

//   // 드롭다운 외부 클릭 핸들러
//   useEffect(() => {
//     const handleClickOutside = (event) => {
//       if (
//         nationalityDropdownOpen ||
//         residenceStatusDropdownOpen ||
//         jobCodeDropdownOpen ||
//         siteDropdownOpen
//       ) {
//         if (!event.target.closest(".dropdown-container")) {
//           setNationalityDropdownOpen(false);
//           setResidenceStatusDropdownOpen(false);
//           setJobCodeDropdownOpen(false);
//           setSiteDropdownOpen(false);
//         }
//       }
//     };

//     document.addEventListener("mousedown", handleClickOutside);
//     return () => {
//       document.removeEventListener("mousedown", handleClickOutside);
//     };
//   }, [nationalityDropdownOpen, residenceStatusDropdownOpen, jobCodeDropdownOpen, siteDropdownOpen]);

//   // 코드 마스터 데이터 로드 함수 - codeStore 사용으로 리팩토링
//   const loadCodeMasters = async () => {
//     try {
//       // 국적코드 로드
//       const nationalityData = await getActiveCodeList("NATIONALITY");
//       setNationalityCodes(nationalityData || []);
//       setFilteredNationalityCodes(nationalityData || []);

//       // 체류자격코드 로드
//       const residenceData = await getActiveCodeList("COMMON_RESIDENCE_STATUS");
//       setResidenceStatusCodes(residenceData || []);
//       setFilteredResidenceStatusCodes(residenceData || []);

//       // 직종코드 로드
//       const jobData = await getActiveCodeList("JOB_CODE");
//       setJobCodes(jobData || []);
//       setFilteredJobCodes(jobData || []);
//     } catch (error) {
//       console.error("코드 마스터 로드 오류:", error);
//       toast.error("코드 정보를 불러오는 중 오류가 발생했습니다.");
//       setError("코드 정보를 불러오는 중 오류가 발생했습니다.");
//     }
//   };

//   // 현장 데이터 로드 함수
//   const loadSites = async () => {
//     try {
//       if (!currentUser?.id) return;

//       let sitesQuery;

//       // admin은 회사 내 모든 현장 조회
//       if (currentUser.role === "admin") {
//         // 회사 ID 조회
//         const { data: companyData, error: companyError } = await supabase
//           .from("user_companies")
//           .select("company_id")
//           .eq("user_id", currentUser.id)
//           .maybeSingle();

//         if (companyError) throw companyError;

//         if (companyData?.company_id) {
//           sitesQuery = supabase
//             .from("construction_sites")
//             .select("*")
//             .eq("company_id", companyData.company_id)
//             .eq("status", "active")
//             .order("site_name", { ascending: true });
//         }
//       } else {
//         // manager, site_manager는 배정된 현장만 조회
//         sitesQuery = supabase
//           .from("user_construction_sites")
//           .select(
//             `
//             site_id,
//             construction_site:construction_sites(*)
//           `
//           )
//           .eq("user_id", currentUser.id)
//           .is("removed_date", null)
//           .eq("construction_site.status", "active");
//       }

//       if (sitesQuery) {
//         const { data: sitesData, error: sitesError } = await sitesQuery;

//         if (sitesError) throw sitesError;

//         // 데이터 가공
//         let formattedSites;
//         if (currentUser.role === "admin") {
//           formattedSites = sitesData || [];
//         } else {
//           formattedSites = (sitesData || []).map((item) => item.construction_site);
//           // 사용자에게 할당된 현장 ID 배열 저장
//           const siteIds = sitesData.map((item) => item.site_id);
//           setUserSiteIds(siteIds);
//         }

//         setSites(formattedSites);
//         setFilteredSites(formattedSites);
//       }
//     } catch (error) {
//       console.error("현장 데이터 로드 오류:", error);
//       toast.error("현장 정보를 불러오는 중 오류가 발생했습니다.");
//       setError("현장 정보를 불러오는 중 오류가 발생했습니다.");
//     }
//   };

//   // 근로자 데이터 로드 함수 - codeStore 사용으로 개선
//   const loadWorkerData = async () => {
//     try {
//       setLoading(true);

//       // 1. 근로자 기본 정보 조회
//       const { data: worker, error: workerError } = await supabase
//         .from("workers")
//         .select("*")
//         .eq("worker_id", workerId)
//         .single();

//       if (workerError) throw workerError;

//       // 2. 근로자가 배정된 현장 조회
//       const { data: workerSitesData, error: workerSitesError } = await supabase
//         .from("work_records")
//         .select(
//           `
//           site_id,
//           construction_site:construction_sites(
//             site_id,
//             site_name,
//             status
//           )
//         `
//         )
//         .eq("worker_id", workerId)
//         .order("work_date", { ascending: false });

//       if (workerSitesError) throw workerSitesError;

//       // 중복 제거 (현장 ID 기준)
//       const uniqueSites = [];
//       const siteIds = new Set();

//       workerSitesData.forEach((record) => {
//         if (record.construction_site && !siteIds.has(record.site_id)) {
//           siteIds.add(record.site_id);
//           uniqueSites.push(record.construction_site);
//         }
//       });

//       // 활성 상태인 현장만 필터링
//       const activeSites = uniqueSites.filter((site) => site.status === "active");
//       setWorkerSites(activeSites);

//       // codeStore를 사용하여 코드 정보 가져오기
//       const nationalityInfo = worker.nationality_code
//         ? getCodeInfo("NATIONALITY", worker.nationality_code)
//         : null;

//       const residenceStatusInfo = worker.residence_status_code
//         ? getCodeInfo("COMMON_RESIDENCE_STATUS", worker.residence_status_code)
//         : null;

//       const jobInfo = worker.job_code ? getCodeInfo("JOB_CODE", worker.job_code) : null;

//       // 주민번호 포맷팅
//       const residentNumberFormatted = formatResidentNumber(worker.resident_number);

//       // 전화번호 포맷팅
//       const contactNumberFormatted = formatPhoneNumber(worker.contact_number);

//       // 폼 데이터 설정
//       setFormData({
//         worker_id: worker.worker_id,
//         name: worker.name || "",
//         eng_name: worker.eng_name || "",
//         resident_number: worker.resident_number || "",
//         resident_number_formatted: residentNumberFormatted,
//         nationality_code: worker.nationality_code || "100",
//         nationality_name: nationalityInfo?.code_name || "",
//         residence_status_code: worker.residence_status_code || "",
//         residence_status_name: residenceStatusInfo?.code_name || "",
//         job_code: worker.job_code || "",
//         job_name: jobInfo?.code_name || "",
//         address: worker.address || "",
//         contact_number: worker.contact_number || "",
//         contact_number_formatted: contactNumberFormatted,
//         representative_yn: worker.representative_yn || false,
//         worker_type: worker.worker_type || "daily",
//       });

//       setError(null);
//     } catch (error) {
//       console.error("근로자 데이터 로드 오류:", error);
//       toast.error("근로자 정보를 불러오는 중 오류가 발생했습니다.");
//       setError("근로자 정보를 불러오는 중 오류가 발생했습니다.");
//     } finally {
//       setLoading(false);
//     }
//   };

//   // 주민등록번호 포맷팅 함수
//   const formatResidentNumber = (value) => {
//     if (!value) return "";

//     if (value.length === 13) {
//       return `${value.substring(0, 6)}-${value.substring(6)}`;
//     }

//     return value;
//   };

//   // 주민등록번호 마스킹 처리 함수
//   const maskResidentNumber = (number) => {
//     if (!number) return "";
//     // 하이픈이 없으면 추가
//     let formatted = number;
//     if (number.length === 13) {
//       formatted = `${number.substring(0, 6)}-${number.substring(6)}`;
//     }

//     // 앞 6자리 + 하이픈 + 마스킹 처리(* 7개)
//     if (formatted.includes("-")) {
//       return formatted.split("-")[0] + "-*******";
//     }

//     // 하이픈이 없는 경우
//     return number.substring(0, 6) + "-*******";
//   };

//   // 전화번호 포맷팅 함수
//   const formatPhoneNumber = (value) => {
//     if (!value) return "";

//     // 숫자만 남기기
//     const numbers = value.replace(/[^0-9]/g, "");

//     if (numbers.length === 11) {
//       return `${numbers.substring(0, 3)}-${numbers.substring(3, 7)}-${numbers.substring(7)}`;
//     } else if (numbers.length === 10) {
//       return `${numbers.substring(0, 3)}-${numbers.substring(3, 6)}-${numbers.substring(6)}`;
//     }

//     return value;
//   };

//   // 입력 필드 변경 핸들러
//   const handleChange = (e) => {
//     const { name, value, type, checked } = e.target;

//     // 체크박스의 경우 checked 값 사용, 그 외에는 value 사용
//     let newValue = type === "checkbox" ? checked : value;

//     if (name === "resident_number_formatted") {
//       // 주민번호 형식화 (000000-0000000)
//       let formatted = value.replace(/[^0-9]/g, ""); // 숫자만 남기기

//       if (formatted.length > 6) {
//         formatted = formatted.slice(0, 6) + "-" + formatted.slice(6, 13);
//       }

//       // 최대 14자리 (하이픈 포함)로 제한
//       formatted = formatted.slice(0, 14);

//       // 원본 값 (하이픈 제거)과 형식화된 값 모두 저장
//       setFormData((prev) => ({
//         ...prev,
//         resident_number: formatted.replace(/-/g, ""),
//         resident_number_formatted: formatted,
//       }));
//       return;
//     }

//     if (name === "contact_number_formatted") {
//       // 전화번호 형식화 (010-0000-0000)
//       let formatted = value.replace(/[^0-9]/g, ""); // 숫자만 남기기

//       if (formatted.length > 3 && formatted.length <= 7) {
//         formatted = formatted.slice(0, 3) + "-" + formatted.slice(3);
//       } else if (formatted.length > 7) {
//         formatted =
//           formatted.slice(0, 3) + "-" + formatted.slice(3, 7) + "-" + formatted.slice(7, 11);
//       }

//       // 최대 13자리 (하이픈 포함)로 제한
//       formatted = formatted.slice(0, 13);

//       // 원본 값 (하이픈 제거)과 형식화된 값 모두 저장
//       setFormData((prev) => ({
//         ...prev,
//         contact_number: formatted.replace(/-/g, ""),
//         contact_number_formatted: formatted,
//       }));
//       return;
//     }

//     setFormData((prev) => ({
//       ...prev,
//       [name]: newValue,
//     }));
//   };

//   // 국적 선택 핸들러
//   const handleNationalitySelect = (code) => {
//     setFormData((prev) => ({
//       ...prev,
//       nationality_code: code.code_value,
//       nationality_name: code.code_name,
//       // 한국 국적인 경우 체류자격 초기화
//       ...(code.code_value === "100"
//         ? {
//             residence_status_code: "",
//             residence_status_name: "",
//           }
//         : {}),
//     }));
//     setNationalityDropdownOpen(false);
//     setNationalitySearch("");
//   };

//   // 체류자격 선택 핸들러
//   const handleResidenceStatusSelect = (code) => {
//     setFormData((prev) => ({
//       ...prev,
//       residence_status_code: code.code_value,
//       residence_status_name: code.code_name,
//     }));
//     setResidenceStatusDropdownOpen(false);
//     setResidenceStatusSearch("");
//   };

//   // 직종 선택 핸들러
//   const handleJobCodeSelect = (code) => {
//     setFormData((prev) => ({
//       ...prev,
//       job_code: code.code_value,
//       job_name: code.code_name,
//     }));
//     setJobCodeDropdownOpen(false);
//     setJobCodeSearch("");
//   };

//   // 현장 선택 핸들러
//   const handleSiteSelect = (site) => {
//     setFormData((prev) => ({
//       ...prev,
//       site_id: site.site_id,
//     }));
//     setSiteDropdownOpen(false);
//     setSiteSearch("");
//   };

//   // 폼 제출 핸들러
//   const handleSubmit = async (e) => {
//     e.preventDefault();

//     try {
//       setSaveLoading(true);
//       setError(null);

//       // 필수 입력값 확인
//       if (
//         !formData.name ||
//         !formData.resident_number ||
//         !formData.contact_number ||
//         !formData.address
//       ) {
//         setError("필수 입력 항목을 모두 입력해주세요.");
//         toast.error("필수 입력 항목을 모두 입력해주세요.");
//         return;
//       }

//       // 주민등록번호 형식 검증 (숫자 13자리)
//       const residentNumberRegex = /^\d{13}$/;
//       if (!residentNumberRegex.test(formData.resident_number)) {
//         setError("주민등록번호는 하이픈(-) 없이 13자리 숫자로 입력해주세요.");
//         toast.error("주민등록번호는 하이픈(-) 없이 13자리 숫자로 입력해주세요.");
//         return;
//       }

//       // 외국인이면 체류자격 필수
//       if (formData.nationality_code !== "100" && !formData.residence_status_code) {
//         setError("외국인의 경우 체류자격을 선택해주세요.");
//         toast.error("외국인의 경우 체류자격을 선택해주세요.");
//         return;
//       }

//       // 근로자 정보 업데이트
//       const { data: worker, error: workerError } = await supabase
//         .from("workers")
//         .update({
//           name: formData.name,
//           eng_name: formData.eng_name || null,
//           resident_number: formData.resident_number,
//           nationality_code: formData.nationality_code,
//           residence_status_code: formData.residence_status_code || null,
//           job_code: formData.job_code || null,
//           address: formData.address,
//           contact_number: formData.contact_number,
//           representative_yn: formData.representative_yn,
//           worker_type: formData.worker_type,
//         })
//         .eq("worker_id", workerId)
//         .select()
//         .single();

//       if (workerError) {
//         if (workerError.code === "23505") {
//           // 중복 키 오류 (PostgreSQL)
//           throw new Error("이미 등록된 주민등록번호입니다.");
//         }
//         throw workerError;
//       }

//       toast.success("근로자 정보가 업데이트되었습니다.");
//       setSuccessMessage("근로자 정보가 업데이트되었습니다.");
//       setTimeout(() => setSuccessMessage(null), 3000);
//     } catch (error) {
//       console.error("근로자 정보 업데이트 오류:", error);
//       toast.error(error.message || "근로자 정보 업데이트 중 오류가 발생했습니다.");
//       setError(error.message || "근로자 정보 업데이트 중 오류가 발생했습니다.");
//     } finally {
//       setSaveLoading(false);
//     }
//   };

//   // 현장 배정 핸들러
//   const handleAssignSite = async (e) => {
//     e.preventDefault();
//     const siteId = formData.site_id;

//     if (!siteId) {
//       setError("배정할 현장을 선택해주세요.");
//       toast.error("배정할 현장을 선택해주세요.");
//       return;
//     }

//     // 현재 사용자가 해당 현장에 접근 권한이 있는지 확인
//     if (!canManageSite(parseInt(siteId))) {
//       toast.error("해당 현장에 대한 접근 권한이 없습니다.");
//       return;
//     }

//     try {
//       setSaveLoading(true);

//       // 이미 배정된 현장인지 확인
//       const isAlreadyAssigned = workerSites.some((site) => site.site_id === parseInt(siteId));

//       if (isAlreadyAssigned) {
//         setError("이미 해당 현장에 배정되어 있습니다.");
//         toast.error("이미 해당 현장에 배정되어 있습니다.");
//         return;
//       }

//       // 현장-근로자 연결 (work_records에 레코드 생성)
//       const todayDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD 형식

//       const { error: recordError } = await supabase.from("work_records").insert({
//         worker_id: workerId,
//         site_id: siteId,
//         work_date: todayDate,
//         work_hours: 0, // 초기값
//         work_type: "registration", // 특수 타입: 등록용
//         daily_wage: 0, // 초기값
//         status: "registration", // 특수 상태: 등록용
//       });

//       if (recordError) throw recordError;

//       // 현장 목록 갱신
//       loadWorkerData();

//       toast.success("현장이 성공적으로 배정되었습니다.");
//       setSuccessMessage("현장이 성공적으로 배정되었습니다.");
//       setTimeout(() => setSuccessMessage(null), 3000);

//       // 폼 초기화
//       setFormData((prev) => ({
//         ...prev,
//         site_id: "",
//       }));
//     } catch (error) {
//       console.error("현장 배정 오류:", error);
//       toast.error("현장 배정 중 오류가 발생했습니다.");
//       setError("현장 배정 중 오류가 발생했습니다.");
//     } finally {
//       setSaveLoading(false);
//     }
//   };

//   // 현장 배정 제거 핸들러
//   const handleRemoveSite = async (siteId) => {
//     // 현재 사용자가 해당 현장에 접근 권한이 있는지 확인
//     if (!canManageSite(siteId)) {
//       toast.error("해당 현장에 대한 접근 권한이 없습니다.");
//       return;
//     }

//     if (!confirm("이 현장 배정을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
//       return;
//     }

//     try {
//       setSaveLoading(true);

//       // 해당 현장의 작업 기록을 모두 조회
//       const { data: records, error: recordsError } = await supabase
//         .from("work_records")
//         .select("record_id")
//         .eq("worker_id", workerId)
//         .eq("site_id", siteId);

//       if (recordsError) throw recordsError;

//       // 실제 근무 기록이 있는지 확인
//       const { data: actualWorkRecords, error: actualWorkError } = await supabase
//         .from("work_records")
//         .select("record_id")
//         .eq("worker_id", workerId)
//         .eq("site_id", siteId)
//         .neq("status", "registration");

//       if (actualWorkError) throw actualWorkError;

//       // 실제 근무 기록이 있으면 배정 취소 불가
//       if (actualWorkRecords && actualWorkRecords.length > 0) {
//         setError("해당 현장에 실제 근무 기록이 있어 배정을 취소할 수 없습니다.");
//         toast.error("해당 현장에 실제 근무 기록이 있어 배정을 취소할 수 없습니다.");
//         return;
//       }

//       // 등록용 레코드만 있는 경우 모두 삭제
//       if (records && records.length > 0) {
//         const recordIds = records.map((r) => r.record_id);

//         const { error: deleteError } = await supabase
//           .from("work_records")
//           .delete()
//           .in("record_id", recordIds);

//         if (deleteError) throw deleteError;
//       }

//       // 현장 목록 갱신
//       loadWorkerData();

//       toast.success("현장 배정이 제거되었습니다.");
//       setSuccessMessage("현장 배정이 제거되었습니다.");
//       setTimeout(() => setSuccessMessage(null), 3000);
//     } catch (error) {
//       console.error("현장 배정 제거 오류:", error);
//       toast.error("현장 배정 제거 중 오류가 발생했습니다.");
//       setError("현장 배정 제거 중 오류가 발생했습니다.");
//     } finally {
//       setSaveLoading(false);
//     }
//   };

//   // 현재 사용자가 해당 현장에 대한 권한이 있는지 확인
//   const canManageSite = (siteId) => {
//     if (currentUser?.role === "admin") return true;
//     return userSiteIds.includes(siteId);
//   };

//   if (loading) {
//     return (
//       <div className="flex justify-center items-center py-8">
//         <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
//         <span className="ml-3">불러오는 중...</span>
//       </div>
//     );
//   }

//   return (
//     <RoleGuard requiredPermission="VIEW_WORKERS">
//       <div className="container mx-auto px-4 py-8">
//         <div className="flex justify-between items-center mb-6">
//           <h1 className="text-2xl font-bold">근로자 정보 수정</h1>
//           <button
//             onClick={() => router.push("/dashboard/workers")}
//             className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
//           >
//             목록으로
//           </button>
//         </div>

//         {error && (
//           <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
//             {error}
//           </div>
//         )}

//         {successMessage && (
//           <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
//             {successMessage}
//           </div>
//         )}

//         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//           {/* 근로자 기본 정보 */}
//           <div className="lg:col-span-2">
//             <div className="bg-white shadow rounded-lg p-6">
//               <h2 className="text-xl font-semibold mb-4">기본 정보</h2>

//               <form onSubmit={handleSubmit}>
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
//                   {/* 이름 */}
//                   <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-1">
//                       이름 <span className="text-red-500">*</span>
//                     </label>
//                     <input
//                       type="text"
//                       name="name"
//                       value={formData.name}
//                       onChange={handleChange}
//                       className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
//                       required
//                     />
//                   </div>

//                   {/* 영문 이름 */}
//                   <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-1">
//                       영문 이름
//                     </label>
//                     <input
//                       type="text"
//                       name="eng_name"
//                       value={formData.eng_name}
//                       onChange={handleChange}
//                       className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
//                     />
//                     {formData.nationality_code !== "100" && (
//                       <p className="text-xs text-gray-500 mt-1">외국인의 경우 권장</p>
//                     )}
//                   </div>

//                   {/* 주민등록번호 */}
//                   <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-1">
//                       주민등록번호/외국인등록번호 <span className="text-red-500">*</span>
//                     </label>
//                     <input
//                       type="text"
//                       name="resident_number_formatted"
//                       value={formData.resident_number_formatted}
//                       onChange={handleChange}
//                       className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
//                       placeholder="000000-0000000"
//                       maxLength={14}
//                       required
//                     />
//                     <p className="text-xs text-gray-500 mt-1">
//                       주민번호는 자동으로 하이픈이 입력됩니다.
//                     </p>
//                   </div>

//                   {/* 국적코드 */}
//                   <div className="dropdown-container relative">
//                     <label className="block text-sm font-medium text-gray-700 mb-1">
//                       국적 <span className="text-red-500">*</span>
//                     </label>
//                     <div
//                       className="border border-gray-300 rounded-md cursor-pointer"
//                       onClick={() => setNationalityDropdownOpen(!nationalityDropdownOpen)}
//                     >
//                       <div className="w-full px-3 py-2 flex justify-between items-center">
//                         <span>{formData.nationality_name || "선택하세요"}</span>
//                         <span className="ml-2">▼</span>
//                       </div>
//                     </div>

//                     {nationalityDropdownOpen && (
//                       <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
//                         <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
//                           <div className="relative">
//                             <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
//                             <input
//                               type="text"
//                               className="w-full pl-8 pr-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
//                               placeholder="검색..."
//                               value={nationalitySearch}
//                               onChange={(e) => setNationalitySearch(e.target.value)}
//                               onClick={(e) => e.stopPropagation()}
//                             />
//                           </div>
//                         </div>
//                         <div>
//                           {filteredNationalityCodes.length > 0 ? (
//                             filteredNationalityCodes.map((code) => (
//                               <div
//                                 key={code.code_value}
//                                 className={`px-3 py-2 hover:bg-gray-100 cursor-pointer ${
//                                   formData.nationality_code === code.code_value ? "bg-blue-50" : ""
//                                 }`}
//                                 onClick={() => handleNationalitySelect(code)}
//                               >
//                                 <span className="font-medium mr-2">{code.code_name}</span>
//                                 <span className="text-xs text-gray-500">({code.code_value})</span>
//                               </div>
//                             ))
//                           ) : (
//                             <div className="px-3 py-2 text-gray-500">검색 결과가 없습니다</div>
//                           )}
//                         </div>
//                       </div>
//                     )}
//                   </div>

//                   {/* 체류자격코드 (외국인인 경우) */}
//                   <div className="dropdown-container relative">
//                     <label className="block text-sm font-medium text-gray-700 mb-1">
//                       체류자격{" "}
//                       {formData.nationality_code !== "100" && (
//                         <span className="text-red-500">*</span>
//                       )}
//                     </label>
//                     <div
//                       className={`border border-gray-300 rounded-md ${
//                         formData.nationality_code !== "100"
//                           ? "cursor-pointer"
//                           : "bg-gray-100 cursor-not-allowed"
//                       }`}
//                       onClick={() =>
//                         formData.nationality_code !== "100" &&
//                         setResidenceStatusDropdownOpen(!residenceStatusDropdownOpen)
//                       }
//                     >
//                       <div className="w-full px-3 py-2 flex justify-between items-center">
//                         <span
//                           className={formData.nationality_code === "100" ? "text-gray-500" : ""}
//                         >
//                           {formData.nationality_code === "100"
//                             ? "해당 없음"
//                             : formData.residence_status_name || "선택하세요"}
//                         </span>
//                         {formData.nationality_code !== "100" && <span className="ml-2">▼</span>}
//                       </div>
//                     </div>

//                     {residenceStatusDropdownOpen && formData.nationality_code !== "100" && (
//                       <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
//                         <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
//                           <div className="relative">
//                             <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
//                             <input
//                               type="text"
//                               className="w-full pl-8 pr-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
//                               placeholder="검색..."
//                               value={residenceStatusSearch}
//                               onChange={(e) => setResidenceStatusSearch(e.target.value)}
//                               onClick={(e) => e.stopPropagation()}
//                             />
//                           </div>
//                         </div>
//                         <div>
//                           {filteredResidenceStatusCodes.length > 0 ? (
//                             filteredResidenceStatusCodes.map((code) => (
//                               <div
//                                 key={code.code_value}
//                                 className={`px-3 py-2 hover:bg-gray-100 cursor-pointer ${
//                                   formData.residence_status_code === code.code_value
//                                     ? "bg-blue-50"
//                                     : ""
//                                 }`}
//                                 onClick={() => handleResidenceStatusSelect(code)}
//                               >
//                                 <span className="font-medium mr-2">{code.code_name}</span>
//                                 <span className="text-xs text-gray-500">({code.code_value})</span>
//                               </div>
//                             ))
//                           ) : (
//                             <div className="px-3 py-2 text-gray-500">검색 결과가 없습니다</div>
//                           )}
//                         </div>
//                       </div>
//                     )}

//                     {formData.nationality_code !== "100" && (
//                       <p className="text-xs text-gray-500 mt-1">외국인의 경우 필수 선택</p>
//                     )}
//                   </div>

//                   {/* 직종코드 */}
//                   <div className="dropdown-container relative">
//                     <label className="block text-sm font-medium text-gray-700 mb-1">직종</label>
//                     <div
//                       className="border border-gray-300 rounded-md cursor-pointer"
//                       onClick={() => setJobCodeDropdownOpen(!jobCodeDropdownOpen)}
//                     >
//                       <div className="w-full px-3 py-2 flex justify-between items-center">
//                         <span>{formData.job_name || "선택하세요"}</span>
//                         <span className="ml-2">▼</span>
//                       </div>
//                     </div>

//                     {jobCodeDropdownOpen && (
//                       <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
//                         <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
//                           <div className="relative">
//                             <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
//                             <input
//                               type="text"
//                               className="w-full pl-8 pr-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
//                               placeholder="검색..."
//                               value={jobCodeSearch}
//                               onChange={(e) => setJobCodeSearch(e.target.value)}
//                               onClick={(e) => e.stopPropagation()}
//                             />
//                           </div>
//                         </div>
//                         <div>
//                           {filteredJobCodes.length > 0 ? (
//                             filteredJobCodes.map((code) => (
//                               <div
//                                 key={code.code_value}
//                                 className={`px-3 py-2 hover:bg-gray-100 cursor-pointer ${
//                                   formData.job_code === code.code_value ? "bg-blue-50" : ""
//                                 }`}
//                                 onClick={() => handleJobCodeSelect(code)}
//                               >
//                                 <span className="font-medium mr-2">{code.code_name}</span>
//                                 <span className="text-xs text-gray-500">({code.code_value})</span>
//                               </div>
//                             ))
//                           ) : (
//                             <div className="px-3 py-2 text-gray-500">검색 결과가 없습니다</div>
//                           )}
//                         </div>
//                       </div>
//                     )}
//                   </div>

//                   {/* 연락처 */}
//                   <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-1">
//                       연락처 <span className="text-red-500">*</span>
//                     </label>
//                     <input
//                       type="tel"
//                       name="contact_number_formatted"
//                       value={formData.contact_number_formatted}
//                       onChange={handleChange}
//                       className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
//                       placeholder="010-0000-0000"
//                       required
//                     />
//                     <p className="text-xs text-gray-500 mt-1">
//                       전화번호는 자동으로 하이픈이 입력됩니다.
//                     </p>
//                   </div>

//                   {/* 주소 */}
//                   <div className="md:col-span-2">
//                     <label className="block text-sm font-medium text-gray-700 mb-1">
//                       주소 <span className="text-red-500">*</span>
//                     </label>
//                     <input
//                       type="text"
//                       name="address"
//                       value={formData.address}
//                       onChange={handleChange}
//                       className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
//                       required
//                     />
//                   </div>

//                   {/* 근로자 유형 */}
//                   <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-1">
//                       근로자 유형 <span className="text-red-500">*</span>
//                     </label>
//                     <div className="flex space-x-4 mt-1">
//                       <label className="inline-flex items-center">
//                         <input
//                           type="radio"
//                           name="worker_type"
//                           value="daily"
//                           checked={formData.worker_type === "daily"}
//                           onChange={handleChange}
//                           className="form-radio h-4 w-4 text-blue-600"
//                         />
//                         <span className="ml-2">일용직</span>
//                       </label>
//                       <label className="inline-flex items-center">
//                         <input
//                           type="radio"
//                           name="worker_type"
//                           value="regular"
//                           checked={formData.worker_type === "regular"}
//                           onChange={handleChange}
//                           className="form-radio h-4 w-4 text-blue-600"
//                         />
//                         <span className="ml-2">상용직</span>
//                       </label>
//                     </div>
//                   </div>

//                   {/* 대표자 여부 */}
//                   <div className="flex items-center">
//                     <label className="inline-flex items-center cursor-pointer">
//                       <input
//                         type="checkbox"
//                         name="representative_yn"
//                         checked={formData.representative_yn}
//                         onChange={handleChange}
//                         className="form-checkbox h-5 w-5 text-blue-600 rounded focus:ring-blue-500"
//                       />
//                       <span className="ml-2 text-sm font-medium text-gray-700">대표자 여부</span>
//                     </label>
//                   </div>
//                 </div>

//                 <div className="flex justify-end space-x-4">
//                   <button
//                     type="button"
//                     onClick={() => router.push("/dashboard/workers")}
//                     className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
//                   >
//                     취소
//                   </button>
//                   <button
//                     type="submit"
//                     disabled={saveLoading}
//                     className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-blue-300 disabled:cursor-not-allowed"
//                   >
//                     {saveLoading ? (
//                       <span className="flex items-center">
//                         <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
//                         처리 중...
//                       </span>
//                     ) : (
//                       "저장"
//                     )}
//                   </button>
//                 </div>
//               </form>
//             </div>
//           </div>

//           {/* 현장 배정 정보 */}
//           <div className="bg-white shadow rounded-lg p-6">
//             <h2 className="text-xl font-semibold mb-4">현장 배정 정보</h2>

//             {/* 현재 배정된 현장 목록 */}
//             <div className="mb-6">
//               <h3 className="text-lg font-medium mb-2">배정된 현장</h3>
//               {workerSites.length > 0 ? (
//                 <ul className="space-y-2">
//                   {workerSites.map((site) => (
//                     <li
//                       key={site.site_id}
//                       className="flex items-center justify-between bg-gray-50 p-2 rounded border border-gray-200"
//                     >
//                       <span className="flex-grow font-medium">{site.site_name}</span>
//                       {canManageSite(site.site_id) && (
//                         <button
//                           type="button"
//                           onClick={() => handleRemoveSite(site.site_id)}
//                           disabled={saveLoading}
//                           className="ml-2 text-xs px-2 py-1 bg-red-500 hover:bg-red-700 text-white rounded disabled:bg-red-300 disabled:cursor-not-allowed"
//                         >
//                           배정 취소
//                         </button>
//                       )}
//                     </li>
//                   ))}
//                 </ul>
//               ) : (
//                 <p className="text-gray-500 italic">배정된 현장이 없습니다.</p>
//               )}
//             </div>

//             {/* 새 현장 배정 폼 */}
//             <div>
//               <h3 className="text-lg font-medium mb-2">새 현장 배정</h3>
//               <form onSubmit={handleAssignSite}>
//                 <div className="mb-4 dropdown-container relative">
//                   <div
//                     className="border border-gray-300 rounded-md cursor-pointer"
//                     onClick={() => setSiteDropdownOpen(!siteDropdownOpen)}
//                   >
//                     <div className="w-full px-3 py-2 flex justify-between items-center">
//                       <span>
//                         {sites.find((s) => s.site_id === parseInt(formData.site_id))?.site_name ||
//                           "배정할 현장 선택"}
//                       </span>
//                       <span className="ml-2">▼</span>
//                     </div>
//                   </div>

//                   {siteDropdownOpen && (
//                     <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
//                       <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
//                         <div className="relative">
//                           <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
//                           <input
//                             type="text"
//                             className="w-full pl-8 pr-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
//                             placeholder="검색..."
//                             value={siteSearch}
//                             onChange={(e) => setSiteSearch(e.target.value)}
//                             onClick={(e) => e.stopPropagation()}
//                           />
//                         </div>
//                       </div>
//                       <div>
//                         {filteredSites.length > 0 ? (
//                           filteredSites
//                             .filter(
//                               (site) => !workerSites.some((ws) => ws.site_id === site.site_id)
//                             )
//                             .map((site) => (
//                               <div
//                                 key={site.site_id}
//                                 className="px-3 py-2 hover:bg-gray-100 cursor-pointer"
//                                 onClick={() => handleSiteSelect(site)}
//                               >
//                                 <span className="font-medium">{site.site_name}</span>
//                               </div>
//                             ))
//                         ) : (
//                           <div className="px-3 py-2 text-gray-500">
//                             {siteSearch ? "검색 결과가 없습니다" : "배정 가능한 현장이 없습니다"}
//                           </div>
//                         )}
//                       </div>
//                     </div>
//                   )}

//                   {sites.length === 0 ? (
//                     <p className="text-sm text-red-500 mt-1">배정 가능한 현장이 없습니다.</p>
//                   ) : sites.length === workerSites.length ? (
//                     <p className="text-sm text-orange-500 mt-1">
//                       모든 현장에 이미 배정되어 있습니다.
//                     </p>
//                   ) : null}
//                 </div>
//                 <button
//                   type="submit"
//                   disabled={
//                     saveLoading ||
//                     !formData.site_id ||
//                     sites.length === 0 ||
//                     sites.length === workerSites.length ||
//                     workerSites.some((site) => site.site_id === parseInt(formData.site_id))
//                   }
//                   className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-green-300 disabled:cursor-not-allowed"
//                 >
//                   {saveLoading ? (
//                     <span className="flex items-center justify-center">
//                       <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
//                       처리 중...
//                     </span>
//                   ) : (
//                     "현장 배정"
//                   )}
//                 </button>
//               </form>
//             </div>

//             {/* 4대보험 정보 섹션 */}
//             {/* <div className="mt-8">
//               <h3 className="text-lg font-medium mb-2">4대보험 이력</h3>
//               <div className="bg-blue-50 p-3 rounded border border-blue-200 mb-3">
//                 <p className="text-sm text-blue-700">
//                   이 근로자의 4대보험 가입 및 신고 이력을 관리하려면 4대보험 관리 메뉴를 이용하세요.
//                 </p>
//               </div>
//               <button
//                 type="button"
//                 onClick={() =>
//                   router.push(
//                     `/dashboard/insurance/daily-work-report?worker_id=${formData.worker_id}`
//                   )
//                 }
//                 className="w-full px-4 py-2 border border-blue-300 rounded-md shadow-sm text-sm font-medium text-blue-700 bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
//               >
//                 4대보험 관리로 이동
//               </button>
//             </div> */}
//           </div>
//         </div>

//         {/* 입력 데이터 디버그 표시 (개발용) */}
//         {process.env.NODE_ENV === "development" && (
//           <div className="mt-8 p-4 bg-gray-100 rounded-md text-xs">
//             <h3 className="font-bold mb-2">디버그 정보 (개발 모드에서만 표시)</h3>
//             <pre className="whitespace-pre-wrap">
//               {JSON.stringify(
//                 {
//                   ...formData,
//                   resident_number: formData.resident_number?.replace(/./g, "*"), // 민감 정보 마스킹
//                 },
//                 null,
//                 2
//               )}
//             </pre>
//           </div>
//         )}
//       </div>
//     </RoleGuard>
//   );
// }
