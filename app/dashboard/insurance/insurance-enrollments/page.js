// file: app\dashboard\insurance\insurance-enrollments\page.js
"use client";
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/store/authStore";
import RoleGuard from "@/components/RoleGuard";
import { ToastContainer, toast } from "react-toastify";
import { formatResidentNumber, formatPhoneNumber } from "@/lib/utils/formattingUtils";
import Link from "next/link";
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { usePathname, useSearchParams } from "next/navigation";
// Import all necessary stores directly
import useSiteStore from "@/lib/store/siteStore";
import useWorkerStore from "@/lib/store/workerStore";
import useWorkHistoryStore from "@/lib/store/workHistoryStore";
import useInsuranceStatusStore from "@/lib/store/insuranceStatusStore";
import useInsuranceEnrollmentStore from "@/lib/store/insuranceEnrollmentStore";
import useInsuranceStore from "@/lib/store/useInsuranceStore";

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

// Wrap the main component with QueryClientProvider
function InsuranceEnrollmentsWithProvider() {
  return (
    <QueryClientProvider client={queryClient}>
      <InsuranceEnrollmentsPage />
    </QueryClientProvider>
  );
}

// 최적화 1: 보험 상태 뱃지를 메모이제이션된 컴포넌트로 분리
const InsuranceStatusBadge = React.memo(({ status, styleClasses, statusText }) => {
  return (
    <span
      className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${styleClasses}`}
    >
      {statusText}
    </span>
  );
});

// 최적화 2: 근로자 프로필 컴포넌트 분리
const WorkerProfile = React.memo(({ worker }) => {
  return (
    <div className="flex items-center">
      <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
        <span className="text-gray-600 font-medium">
          {worker.name ? worker.name.charAt(0) : "?"}
        </span>
      </div>
      <div className="ml-4">
        <div className="text-sm font-medium text-gray-900">{worker.name}</div>
        <div className="text-sm text-gray-500">{formatResidentNumber(worker.resident_number)}</div>
        <div className="text-sm text-gray-500 flex items-center mt-1">
          <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
            {worker.jobName || "직종 미지정"}
          </span>
          <span className="mx-1">•</span>
          <span>{worker.age || "?"}세</span>
        </div>
      </div>
    </div>
  );
});

// 최적화 3: 근무 이력 컴포넌트 분리
const WorkerHistory = React.memo(({ workHistory, isInactiveTab = false }) => {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
      <div className="text-sm">
        <span className="text-gray-500">전월 근무: </span>
        <span className="font-medium">{workHistory.previousMonthWorkDays || 0}일</span>
        <span className="text-gray-400"> / </span>
        <span className="font-medium">{workHistory.previousMonthWorkHours || 0}시간</span>
      </div>
      <div className="text-sm">
        <span className="text-gray-500">당월 근무: </span>
        {isInactiveTab ? (
          <>
            <span className="font-medium text-red-500">0일</span>
            <span className="text-gray-400"> / </span>
            <span className="font-medium text-red-500">0시간</span>
          </>
        ) : (
          <>
            <span className="font-medium">{workHistory.currentMonthWorkDays || 0}일</span>
            <span className="text-gray-400"> / </span>
            <span className="font-medium">{workHistory.currentMonthWorkHours || 0}시간</span>
          </>
        )}
      </div>
      <div className="text-sm">
        <span className="text-gray-500">전월 첫 근무일: </span>
        <span className="font-medium">
          {workHistory.prevMonthFirstWorkDate
            ? new Date(workHistory.prevMonthFirstWorkDate).toLocaleDateString()
            : "기록 없음"}
        </span>
        <span>||</span>
        <span className="text-gray-500"> 당월 첫 근무일: </span>
        <span className="font-medium">
          {workHistory.currentMonthFirstWorkDate
            ? new Date(workHistory.currentMonthFirstWorkDate).toLocaleDateString()
            : "기록 없음"}
        </span>
      </div>
      <div className="text-sm">
        <span className="text-gray-500">당월 급여: </span>
        {isInactiveTab ? (
          <span className="font-medium text-red-500">0원</span>
        ) : (
          <span className="font-medium">{(workHistory.monthlyWage || 0).toLocaleString()}원</span>
        )}
      </div>
      {isInactiveTab && (
        <div className="text-sm">
          <span className="font-medium w-28 font-medium">당월 미등록:</span>
          <span className="text-red-500 font-medium">상실 대상</span>
        </div>
      )}
    </div>
  );
});

// 최적화 4: 보험 상태 그리드 컴포넌트
const InsuranceStatusGrid = React.memo(
  ({
    workerId,
    activeTab,
    insuranceStatusCache,
    selectedSite,
    isEnrolled,
    getStatusStyle,
    getStatusText,
  }) => {
    // 탭에 따라 다른 렌더링
    if (activeTab === 0) {
      return (
        <div className="grid grid-cols-2 gap-2">
          <div className="text-sm">
            <span className="text-gray-500">국민연금: </span>
            <InsuranceStatusBadge
              status={insuranceStatusCache[workerId]?.nationalPension}
              styleClasses={getStatusStyle(insuranceStatusCache[workerId]?.nationalPension)}
              statusText={getStatusText(insuranceStatusCache[workerId]?.nationalPension)}
            />
          </div>
          <div className="text-sm">
            <span className="text-gray-500">건강보험: </span>
            <InsuranceStatusBadge
              status={insuranceStatusCache[workerId]?.healthInsurance}
              styleClasses={getStatusStyle(insuranceStatusCache[workerId]?.healthInsurance)}
              statusText={getStatusText(insuranceStatusCache[workerId]?.healthInsurance)}
            />
          </div>
          <div className="text-sm">
            <span className="text-gray-500">고용보험: </span>
            <InsuranceStatusBadge
              status={insuranceStatusCache[workerId]?.employmentInsurance}
              styleClasses={getStatusStyle(insuranceStatusCache[workerId]?.employmentInsurance)}
              statusText={getStatusText(insuranceStatusCache[workerId]?.employmentInsurance)}
            />
          </div>
          <div className="text-sm">
            <span className="text-gray-500">산재보험: </span>
            <InsuranceStatusBadge
              status={insuranceStatusCache[workerId]?.industrialAccident}
              styleClasses={getStatusStyle(insuranceStatusCache[workerId]?.industrialAccident)}
              statusText={getStatusText(insuranceStatusCache[workerId]?.industrialAccident)}
            />
          </div>
        </div>
      );
    } else {
      // 유지 중인 근로자 및 상실 대상자 탭
      const isInactiveTab = activeTab === 2;

      return (
        <div className="grid grid-cols-2 gap-2">
          <div className="text-sm">
            <span className="text-gray-500">국민연금: </span>
            <span
              className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                isEnrolled(workerId, selectedSite, "national_pension")
                  ? isInactiveTab
                    ? "bg-red-100 text-red-800" // 상실 필요 (가입된 상태)
                    : "bg-green-100 text-green-800" // 가입 상태
                  : "bg-red-100 text-red-800" // 미가입 상태 - 빨간색으로 변경
              }`}
            >
              {isInactiveTab
                ? isEnrolled(workerId, selectedSite, "national_pension")
                  ? "상실 필요"
                  : "미가입"
                : isEnrolled(workerId, selectedSite, "national_pension")
                ? "가입"
                : "미가입"}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">건강보험: </span>
            <span
              className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                isEnrolled(workerId, selectedSite, "health_insurance")
                  ? isInactiveTab
                    ? "bg-red-100 text-red-800" // 상실 필요 (가입된 상태)
                    : "bg-green-100 text-green-800" // 가입 상태
                  : "bg-red-100 text-red-800" // 미가입 상태 - 빨간색으로 변경
              }`}
            >
              {isInactiveTab
                ? isEnrolled(workerId, selectedSite, "health_insurance")
                  ? "상실 필요"
                  : "미가입"
                : isEnrolled(workerId, selectedSite, "health_insurance")
                ? "가입"
                : "미가입"}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">고용보험: </span>
            <span
              className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                isEnrolled(workerId, selectedSite, "employment_insurance")
                  ? isInactiveTab
                    ? "bg-red-100 text-red-800" // 상실 필요 (가입된 상태)
                    : "bg-green-100 text-green-800" // 가입 상태
                  : "bg-red-100 text-red-800" // 미가입 상태 - 빨간색으로 변경
              }`}
            >
              {isInactiveTab
                ? isEnrolled(workerId, selectedSite, "employment_insurance")
                  ? "상실 필요"
                  : "미가입"
                : isEnrolled(workerId, selectedSite, "employment_insurance")
                ? "가입"
                : "미가입"}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">산재보험: </span>
            <span
              className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                isEnrolled(workerId, selectedSite, "industrial_accident")
                  ? isInactiveTab
                    ? "bg-red-100 text-red-800" // 상실 필요 (가입된 상태)
                    : "bg-green-100 text-green-800" // 가입 상태
                  : "bg-red-100 text-red-800" // 미가입 상태 - 빨간색으로 변경
              }`}
            >
              {isInactiveTab
                ? isEnrolled(workerId, selectedSite, "industrial_accident")
                  ? "상실 필요"
                  : "미가입"
                : isEnrolled(workerId, selectedSite, "industrial_accident")
                ? "가입"
                : "미가입"}
            </span>
          </div>
        </div>
      );
    }
  }
);

// 최적화 5: 보험 설정 컨트롤 컴포넌트
const InsuranceControls = React.memo(
  ({
    worker,
    yearMonth,
    selectedSite,
    insuranceStatusCache,
    handleStatusChange,
    renderInsuranceStatusBadge,
  }) => {
    // 각 보험 타입의 상태 값 가져오기
    const npStatus = insuranceStatusCache[worker.worker_id]?.nationalPension || {};
    const hiStatus = insuranceStatusCache[worker.worker_id]?.healthInsurance || {};
    const eiStatus = insuranceStatusCache[worker.worker_id]?.employmentInsurance || {};
    const iaStatus = insuranceStatusCache[worker.worker_id]?.industrialAccident || {};

    return (
      <div className="grid grid-cols-4 md:grid-cols-4 gap-4">
        {/* 국민연금 */}
        <div className="border rounded-lg p-4 bg-white">
          <h5 className="font-medium mb-2">국민연금</h5>
          <div className="space-y-2 mb-4">
            <p className="text-sm">
              <span className="font-medium">현재 상태:</span>{" "}
              {renderInsuranceStatusBadge(worker.worker_id, "national_pension")}
            </p>
            <p className="text-sm">
              <span className="font-medium">사유:</span> {npStatus?.reason || "자동 판단"}
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={(e) =>
                handleStatusChange(worker.worker_id, "national_pension", "manual_required", e)
              }
              className={`px-2 py-1 text-xs rounded ${
                npStatus?.statusCode === "manual_required"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-blue-100"
              }`}
            >
              수동 적용
            </button>
            <button
              onClick={(e) =>
                handleStatusChange(worker.worker_id, "national_pension", "manual_exempted", e)
              }
              className={`px-2 py-1 text-xs rounded ${
                npStatus?.statusCode === "manual_exempted"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-blue-100"
              }`}
            >
              수동 제외
            </button>
          </div>
        </div>

        {/* 건강보험 */}
        <div className="border rounded-lg p-4 bg-white">
          <h5 className="font-medium mb-2">건강보험</h5>
          <div className="space-y-2 mb-4">
            <p className="text-sm">
              <span className="font-medium">현재 상태:</span>{" "}
              {renderInsuranceStatusBadge(worker.worker_id, "health_insurance")}
            </p>
            <p className="text-sm">
              <span className="font-medium">사유:</span> {hiStatus?.reason || "자동 판단"}
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={(e) =>
                handleStatusChange(worker.worker_id, "health_insurance", "manual_required", e)
              }
              className={`px-2 py-1 text-xs rounded ${
                hiStatus?.statusCode === "manual_required"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-blue-100"
              }`}
            >
              수동 적용
            </button>
            <button
              onClick={(e) =>
                handleStatusChange(worker.worker_id, "health_insurance", "manual_exempted", e)
              }
              className={`px-2 py-1 text-xs rounded ${
                hiStatus?.statusCode === "manual_exempted"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-blue-100"
              }`}
            >
              수동 제외
            </button>
          </div>
        </div>

        {/* 고용보험 */}
        <div className="border rounded-lg p-4 bg-white">
          <h5 className="font-medium mb-2">고용보험</h5>
          <div className="space-y-2 mb-4">
            <p className="text-sm">
              <span className="font-medium">현재 상태:</span>{" "}
              {renderInsuranceStatusBadge(worker.worker_id, "employment_insurance")}
            </p>
            <p className="text-sm">
              <span className="font-medium">사유:</span>{" "}
              {eiStatus?.reason || "일용근로자는 근로일수 상관없이 적용"}
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={(e) =>
                handleStatusChange(worker.worker_id, "employment_insurance", "manual_required", e)
              }
              className={`px-2 py-1 text-xs rounded ${
                eiStatus?.statusCode === "manual_required"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-blue-100"
              }`}
            >
              수동 적용
            </button>
            <button
              onClick={(e) =>
                handleStatusChange(worker.worker_id, "employment_insurance", "manual_exempted", e)
              }
              className={`px-2 py-1 text-xs rounded ${
                eiStatus?.statusCode === "manual_exempted"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-blue-100"
              }`}
            >
              수동 제외
            </button>
          </div>
        </div>

        {/* 산재보험 */}
        <div className="border rounded-lg p-4 bg-white">
          <h5 className="font-medium mb-2">산재보험</h5>
          <div className="space-y-2 mb-4">
            <p className="text-sm">
              <span className="font-medium">현재 상태:</span>{" "}
              {renderInsuranceStatusBadge(worker.worker_id, "industrial_accident")}
            </p>
            <p className="text-sm">
              <span className="font-medium">사유:</span>{" "}
              {iaStatus?.reason || "모든 근로자 당연 적용"}
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              className="px-2 py-1 text-xs rounded bg-blue-500 text-white cursor-not-allowed"
              disabled
            >
              항상 적용
            </button>
          </div>
        </div>
      </div>
    );
  }
);

// 메인 컴포넌트
function InsuranceEnrollmentsPage() {
  const queryClient = useQueryClient();

  // Auth state
  const user = useAuthStore((state) => state.user);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // UI state
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState(0);
  const [selectedWorkerId, setSelectedWorkerId] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  // Date selection state
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, "0");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);

  // Site state
  const { sites, selectedSite, setSelectedSite, companyName } = useSiteStore();

  // 기존 Zustand 스토어들
  const { getStatusStyle, getStatusText, updateInsuranceStatusUI, clearError, manualSettings } =
    useInsuranceStatusStore();
  // const { isEnrolled } = useInsuranceEnrollmentStore();
  const { initialize } = useInsuranceStore();

  // React Query - 현장 데이터 로드
  const { data: sitesData } = useQuery({
    queryKey: ["sites", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // The siteStore.js first fetches the user's company ID
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", user.id)
        .single();

      if (userError) {
        console.error("사용자 정보 조회 오류:", userError);
        throw userError;
      }

      // In siteStore.js, it uses fetchUserCompany to get company_id
      const { data: companyData, error: companyError } = await supabase
        .from("user_companies")
        .select("company_id, company:companies(company_name)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (companyError) {
        console.error("사용자 회사 정보 조회 오류:", companyError);
        throw companyError;
      }

      if (!companyData || !companyData.company_id) {
        console.log("사용자에게 연결된 회사가 없습니다");
        return [];
      }

      // Now fetch sites by company_id as done in fetchSites
      const { data: sites, error: sitesError } = await supabase
        .from("construction_sites")
        .select(
          "site_id, site_name, address, start_date, end_date, status, industrial_accident_rate"
        )
        .eq("company_id", companyData.company_id)
        .order("site_name");

      if (sitesError) {
        console.error("현장 목록 조회 오류:", sitesError);
        throw sitesError;
      }

      console.log("Found sites:", sites);
      return sites || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5분 (사이트 목록은 자주 변경되지 않음)
    cacheTime: 10 * 60 * 1000, // 10분
    refetchOnMount: true, // 컴포넌트 마운트 시 항상 다시 조회
    onSuccess: (data) => {
      console.log("사이트 데이터 로드 성공:", data);
      // Zustand 스토어와 동기화
      if (useSiteStore.getState) {
        // Update sites in the store
        useSiteStore.getState().sites = data;

        // If no site is selected and we have sites, select the first one
        if (data && data.length > 0 && !useSiteStore.getState().selectedSite) {
          setSelectedSite(data[0].site_id);
        }
      }
    },
    onError: (error) => {
      console.error("사이트 데이터 로드 중 오류:", error);
    },
  });

  console.log("sitesData:", sitesData);
  console.log("user:", user);
  // React Query - 근로자 데이터 로드
  // 먼저 쿼리 실행 여부 확인을 위해 로그 추가
  console.log("selectedSite:", selectedSite);
  console.log("selectedYear:", selectedYear);
  console.log("selectedMonth:", selectedMonth);

  // workersData 쿼리 수정
  const {
    data: workersData,
    isLoading: isLoadingWorkers,
    error: workersError,
  } = useQuery({
    queryKey: ["workers", selectedSite, `${selectedYear}-${selectedMonth}`],
    queryFn: async () => {
      console.log("workers 쿼리 실행 - 선택된 현장:", selectedSite);

      if (!selectedSite) {
        console.log("현장이 선택되지 않았습니다.");
        return { registeredWorkers: [], activeWorkers: [], inactiveWorkers: [] };
      }

      const yearMonth = `${selectedYear}-${selectedMonth}`;
      console.log("조회 기간:", yearMonth);

      try {
        // 1. 먼저 선택 월에 등록된 모든 근로자 목록 가져오기
        const { data: recordsData, error: recordsError } = await supabase
          .from("work_records")
          .select("worker_id, status, work_hours")
          .eq("site_id", selectedSite)
          .eq("registration_month", yearMonth);

        if (recordsError) throw recordsError;

        // 선택월 등록된 근로자 ID 목록
        const registeredWorkerIds = recordsData
          ? [...new Set(recordsData.map((record) => record.worker_id))]
          : [];

        // 2. 보험에 가입된 근로자 목록 가져오기
        const { data: activeEnrollments, error: enrollmentsError } = await supabase
          .from("insurance_enrollments")
          .select("worker_id, year_month")
          .eq("site_id", selectedSite)
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

        // 3. 근로자별 가입 연월 정보 매핑
        const workerEnrollmentMonths = activeEnrollments.reduce((acc, enrollment) => {
          // 이미 있는 경우 더 이른 날짜를 사용 (가장 먼저 가입한 날짜 기준)
          if (!acc[enrollment.worker_id] || enrollment.year_month < acc[enrollment.worker_id]) {
            acc[enrollment.worker_id] = enrollment.year_month;
          }
          return acc;
        }, {});

        // 4. 각 카테고리별 근로자 ID 분류
        // 신규 가입 대상자: 현재 월에 등록되었지만 보험에 가입되지 않은 근로자
        const newWorkerIds = registeredWorkerIds.filter((id) => !enrolledWorkerIds.includes(id));

        // 유지 중인 근로자: 보험에 가입되어 있고 현재 월에도 등록된 근로자
        const activeWorkerIds = enrolledWorkerIds.filter((id) => registeredWorkerIds.includes(id));

        // 상실 대상자: 보험에 가입되어 있지만 현재 월에 등록되지 않은 근로자
        // 단, 선택한 연월보다 이전에 가입된 근로자만 포함 (선택한 연월과 같은 경우는 제외)
        const inactiveWorkerIds = enrolledWorkerIds.filter(
          (id) =>
            !registeredWorkerIds.includes(id) &&
            workerEnrollmentMonths[id] &&
            workerEnrollmentMonths[id] < yearMonth // 엄격하게 이전 연월만 ('같은' 연월은 제외)
        );
        if (
          newWorkerIds.length === 0 &&
          activeWorkerIds.length === 0 &&
          inactiveWorkerIds.length === 0
        ) {
          console.log("조회할 근로자 ID가 없습니다.");
          return { registeredWorkers: [], activeWorkers: [], inactiveWorkers: [] };
        }

        // 각 카테고리별 근로자 정보 가져오기
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

          // 근로자 데이터 가공 - 나이 계산 함수 호출
          return data.map((worker) => {
            // 주민번호로 나이 계산
            const resident = worker.resident_number || "";
            let age = 0;

            if (resident.length === 13) {
              const birthYear = parseInt(resident.substring(0, 2), 10);
              const genderDigit = parseInt(resident.charAt(6), 10);

              // Calculate full year based on gender digit
              let fullYear;
              if (genderDigit === 1 || genderDigit === 2) {
                fullYear = 1900 + birthYear;
              } else if (genderDigit === 3 || genderDigit === 4) {
                fullYear = 2000 + birthYear;
              } else {
                fullYear = 1900 + birthYear;
              }

              const currentYear = new Date().getFullYear();
              age = currentYear - fullYear;
            }

            return {
              ...worker,
              jobName: worker.job_code ? jobCodeMap[worker.job_code] || "미지정" : "미지정",
              age: age,
              source: source,
            };
          });
        }

        // Fetch details for each category
        const [newWorkers, activeWorkers, inactiveWorkers] = await Promise.all([
          fetchWorkerDetails(newWorkerIds, "new_enrollment"),
          fetchWorkerDetails(activeWorkerIds, "active_enrolled"),
          fetchWorkerDetails(inactiveWorkerIds, "inactive_enrolled"),
        ]);

        console.log("분류 결과 - 등록 근로자:", newWorkers.length);
        console.log("분류 결과 - 활성 근로자:", activeWorkers.length);
        console.log("분류 결과 - 비활성 근로자:", inactiveWorkers.length);

        return {
          registeredWorkers: newWorkers,
          activeWorkers: activeWorkers,
          inactiveWorkers: inactiveWorkers,
        };
      } catch (error) {
        console.error("근로자 데이터 조회 중 오류 발생:", error);
        throw error;
      }
    },
    enabled: !!selectedSite,
    staleTime: 60 * 1000, // 1분 (근로자 데이터는 어느 정도 최신성 필요)
    cacheTime: 3 * 60 * 1000, // 3분
    refetchOnMount: true, // 컴포넌트 마운트 시 항상 다시 조회
    onSuccess: (data) => {
      console.log("근로자 데이터 로드 성공:", data);
      // Sync with Zustand store if needed
      if (useWorkerStore && useWorkerStore.getState) {
        const workerStore = useWorkerStore.getState();
        workerStore.setRegisteredWorkers(data.registeredWorkers || []);
        workerStore.setActiveWorkers(data.activeWorkers || []);
        workerStore.setInactiveWorkers(data.inactiveWorkers || []);
      }
    },
    onError: (error) => {
      console.error("근로자 데이터 로드 실패:", error);
    },
  });

  // React Query - 근무 이력 데이터 로드
  // React Query - 근무 이력 데이터 로드
  const { data: workHistoryData } = useQuery({
    queryKey: ["workHistory", selectedSite, `${selectedYear}-${selectedMonth}`, workersData],
    queryFn: async () => {
      if (!workersData) return {};

      const yearMonth = `${selectedYear}-${selectedMonth}`;
      const allWorkers = [
        ...(workersData.registeredWorkers || []),
        ...(workersData.activeWorkers || []),
        ...(workersData.inactiveWorkers || []),
      ];

      if (allWorkers.length === 0) {
        return {};
      }

      const result = {};

      // 이전 달 계산
      const prevYearMonth = calculatePreviousYearMonth(selectedYear, selectedMonth);

      // 날짜 범위 계산
      const currentMonthStart = `${yearMonth}-01`;
      const nextYearMonth = getNextYearMonth(yearMonth);
      const nextMonthStart = `${nextYearMonth}-01`;
      const prevMonthStart = `${prevYearMonth}-01`;

      // 모든 근로자 ID 목록
      const workerIds = allWorkers.map((worker) => worker.worker_id);

      // 이전월 근무 기록 한 번에 조회
      const { data: prevRecordsData, error: prevError } = await supabase
        .from("work_records")
        .select("worker_id, work_date, work_hours, daily_wage, status")
        .in("worker_id", workerIds)
        .eq("site_id", selectedSite)
        .gte("work_date", prevMonthStart)
        .lt("work_date", currentMonthStart)
        .neq("status", "registration");

      if (prevError) {
        console.error("이전월 근무 기록 조회 오류:", prevError);
      }

      // 현재월 근무 기록 한 번에 조회
      const { data: currentRecordsData, error: currentError } = await supabase
        .from("work_records")
        .select("worker_id, work_date, work_hours, daily_wage, status, registration_month")
        .in("worker_id", workerIds)
        .eq("site_id", selectedSite)
        .or(
          `registration_month.eq.${yearMonth},and(work_date.gte.${currentMonthStart},work_date.lt.${nextMonthStart})`
        )
        .neq("status", "registration");

      if (currentError) {
        console.error("현재월 근무 기록 조회 오류:", currentError);
      }

      // 근로자별로 데이터 처리
      for (const worker of allWorkers) {
        const workerId = worker.worker_id;

        // 이전월 근무 필터링
        const prevRecords = prevRecordsData
          ? prevRecordsData.filter((r) => r.worker_id === workerId)
          : [];

        // 현재월 근무 필터링
        const currentRecords = currentRecordsData
          ? currentRecordsData.filter((r) => r.worker_id === workerId)
          : [];

        // 이전월 등록 여부 확인
        const isPreviousMonthRegistered = prevRecords.length > 0 || false;

        // 최초 근무일 찾기 (전체 기록)
        const allRecords = [...prevRecords, ...currentRecords].sort(
          (a, b) => new Date(a.work_date) - new Date(b.work_date)
        );
        const allTimeFirstWorkDate = allRecords.length > 0 ? allRecords[0].work_date : null;

        // 전월 첫 근무일 찾기
        const sortedPrevRecords = [...prevRecords].sort(
          (a, b) => new Date(a.work_date) - new Date(b.work_date)
        );
        const prevMonthFirstWorkDate =
          sortedPrevRecords.length > 0 ? sortedPrevRecords[0].work_date : null;

        // 당월 첫 근무일 찾기
        const sortedCurrentRecords = [...currentRecords].sort(
          (a, b) => new Date(a.work_date) - new Date(b.work_date)
        );
        const currentMonthFirstWorkDate =
          sortedCurrentRecords.length > 0 ? sortedCurrentRecords[0].work_date : null;

        // 통계 계산
        const previousMonthWorkDays = prevRecords.length;
        const previousMonthWorkHours = prevRecords.reduce(
          (sum, r) => sum + parseFloat(r.work_hours || 0),
          0
        );

        const currentMonthWorkDays = currentRecords.length;
        const currentMonthWorkHours = currentRecords.reduce(
          (sum, r) => sum + parseFloat(r.work_hours || 0),
          0
        );

        const monthlyWage = currentRecords.reduce(
          (sum, r) => sum + parseFloat(r.daily_wage || 0),
          0
        );

        const isRegisteredInCurrentMonth =
          currentRecords.length > 0 ||
          currentRecords.some((r) => r.registration_month === yearMonth);

        // 결과 저장
        result[`${workerId}-${selectedSite}-${yearMonth}`] = {
          allTimeFirstWorkDate, // 최초 근무일 (기존의 firstWorkDate)
          prevMonthFirstWorkDate, // 전월 첫 근무일
          currentMonthFirstWorkDate, // 당월 첫 근무일
          previousMonthWorkDays,
          previousMonthWorkHours,
          isPreviousMonthRegistered,
          currentMonthWorkDays,
          currentMonthWorkHours,
          monthlyWage,
          isRegisteredInCurrentMonth,
        };
      }

      return result;
    },
    enabled: !!selectedSite && !!workersData && workersData.registeredWorkers !== undefined,
    staleTime: 60 * 1000, // 1분
    cacheTime: 3 * 60 * 1000, // 3분
    refetchOnMount: true, // 컴포넌트 마운트 시 항상 다시 조회
  });

  // 다음 년월 계산 함수
  function getNextYearMonth(yearMonth) {
    const [year, month] = yearMonth.split("-").map((num) => parseInt(num));
    const nextMonth = month + 1;
    const nextYear = nextMonth > 12 ? year + 1 : year;
    return `${nextMonth > 12 ? nextYear : year}-${
      nextMonth > 12 ? "01" : String(nextMonth).padStart(2, "0")
    }`;
  }

  // React Query - 보험 가입 상태 데이터 로드
  const { data: insuranceStatusData } = useQuery({
    queryKey: [
      "insuranceStatus",
      selectedSite,
      `${selectedYear}-${selectedMonth}`,
      workersData,
      workHistoryData,
    ],
    queryFn: async () => {
      if (!workersData || !workHistoryData) return {};

      const yearMonth = `${selectedYear}-${selectedMonth}`;
      const allWorkers = [
        ...(workersData.registeredWorkers || []),
        ...(workersData.activeWorkers || []),
        ...(workersData.inactiveWorkers || []),
      ];

      const result = {};

      // 각 근로자별 보험 상태 계산
      for (const worker of allWorkers) {
        const workerId = worker.worker_id;
        const workHistory = workHistoryData[`${workerId}-${selectedSite}-${yearMonth}`] || {};
        const age = worker.age || 0;

        // 보험 가입 기준에 따른 상태 계산

        // 국민연금: 60세 이하이고 월급여 220만원 이상이거나 월 8일 또는 60시간 이상 근무
        const npRequired =
          age <= 60 &&
          (workHistory.monthlyWage >= 2200000 ||
            workHistory.currentMonthWorkDays >= 8 ||
            workHistory.currentMonthWorkHours >= 60);

        // 건강보험: 월 60시간 이상 근무
        const hiRequired = workHistory.currentMonthWorkHours >= 60;

        // 고용보험/산재보험은 당연 적용
        const eiRequired = true;
        const iaRequired = true;

        // 각 보험별 사유 텍스트 설정
        const npReason =
          age > 60
            ? "60세 초과"
            : npRequired
            ? workHistory.monthlyWage >= 2200000
              ? "월급여 220만원 이상"
              : workHistory.currentMonthWorkHours >= 60
              ? "월 60시간 이상 근무"
              : "월 8일 이상 근무"
            : "월 60시간 미만, 월 8일 미만 근무, 월급여 220만원 미만";

        const hiReason = hiRequired ? "월 60시간 이상 근무" : "월 60시간 미만 근무";
        const eiReason = age >= 65 ? "65세 이상 특례 적용" : "일용근로자 당연 적용";
        const iaReason = "모든 근로자 당연 적용";

        // 수동 설정 확인 (DB에서 가져옴)
        const { data: manualSettings, error: settingsError } = await supabase
          .from("insurance_enrollments")
          .select(
            `
          national_pension_status,
          health_insurance_status,
          employment_insurance_status,
          industrial_accident_status,
          manual_reason
        `
          )
          .eq("worker_id", workerId)
          .eq("site_id", selectedSite)
          .eq("year_month", yearMonth)
          .maybeSingle();

        if (settingsError && settingsError.code !== "PGRST116") {
          console.error("설정 조회 오류:", settingsError);
        }

        // 최종 상태 설정 (자동 + 수동 설정 적용)
        result[workerId] = {
          nationalPension: {
            required: npRequired,
            reason: npReason,
            isManual: manualSettings?.national_pension_status?.startsWith("manual_") || false,
            statusCode:
              manualSettings?.national_pension_status ||
              (npRequired ? "auto_required" : "auto_exempted"),
          },
          healthInsurance: {
            required: hiRequired,
            reason: hiReason,
            isManual: manualSettings?.health_insurance_status?.startsWith("manual_") || false,
            statusCode:
              manualSettings?.health_insurance_status ||
              (hiRequired ? "auto_required" : "auto_exempted"),
          },
          employmentInsurance: {
            required: eiRequired,
            reason: eiReason,
            isManual: manualSettings?.employment_insurance_status?.startsWith("manual_") || false,
            statusCode: manualSettings?.employment_insurance_status || "auto_required",
          },
          industrialAccident: {
            required: iaRequired,
            reason: iaReason,
            isManual: manualSettings?.industrial_accident_status?.startsWith("manual_") || false,
            statusCode: manualSettings?.industrial_accident_status || "auto_required",
          },
          manualReason: manualSettings?.manual_reason || "",
        };
      }

      return result;
    },
    enabled: !!selectedSite && !!workersData && !!workHistoryData,
    staleTime: 60 * 1000, // 1분 (근로자 데이터는 어느 정도 최신성 필요)
    cacheTime: 3 * 60 * 1000, // 3분
    refetchOnMount: true, // 컴포넌트 마운트 시 항상 다시 조회
    onSuccess: (data) => {
      // Sync with Zustand store if needed
      if (useInsuranceStatusStore.getState) {
        const insuranceStatusStore = useInsuranceStatusStore.getState();
        // Store the data in the appropriate format
        const formattedData = {};
        for (const workerId in data) {
          const cacheKey = `${workerId}-${selectedSite}-${selectedYear}-${selectedMonth}`;
          formattedData[cacheKey] = data[workerId];
        }
        insuranceStatusStore.setInsuranceStatus(formattedData);
      }
    },
  });

  // React Query - 보험 가입 이력 데이터 로드
  const { data: enrollmentRecordsData } = useQuery({
    queryKey: ["enrollmentRecords", selectedSite, workersData],
    queryFn: async () => {
      if (!workersData) return {};

      const allWorkers = [
        ...(workersData.registeredWorkers || []),
        ...(workersData.activeWorkers || []),
        ...(workersData.inactiveWorkers || []),
      ];

      const result = {};

      // 모든 근로자에 대한 보험 가입 정보를 한 번에 조회
      const workerIds = allWorkers.map((worker) => worker.worker_id);

      if (workerIds.length === 0) {
        return {};
      }

      const { data, error } = await supabase
        .from("insurance_enrollments")
        .select(
          `
        enrollment_id,
        worker_id,
        site_id,
        year_month,
        enrollment_status,
        national_pension_acquisition_date,
        health_insurance_acquisition_date,
        employment_insurance_acquisition_date,
        industrial_accident_acquisition_date,
        national_pension_loss_date,
        health_insurance_loss_date,
        employment_insurance_loss_date,
        industrial_accident_loss_date,
        national_pension_status,
        health_insurance_status,
        employment_insurance_status,
        industrial_accident_status,
        manual_reason,
        created_at,
        updated_at
      `
        )
        .in("worker_id", workerIds)
        .eq("site_id", selectedSite);

      if (error) throw error;

      // 근로자별로 데이터 그룹화
      for (const worker of allWorkers) {
        const workerId = worker.worker_id;
        const workerEnrollments = data ? data.filter((e) => e.worker_id === workerId) : [];

        // 보험 유형별로 가입 상태 구분하기 위한 데이터 변환
        const transformedData = [];

        workerEnrollments.forEach((record) => {
          // 국민연금 정보
          if (record.national_pension_acquisition_date || record.national_pension_status) {
            transformedData.push({
              enrollment_id: `${record.enrollment_id}_np`,
              worker_id: record.worker_id,
              site_id: record.site_id,
              year_month: record.year_month,
              insurance_type: "national_pension",
              acquisition_date: record.national_pension_acquisition_date,
              loss_date: record.national_pension_loss_date,
              status: record.national_pension_status,
              enrollment_status: record.enrollment_status,
              created_at: record.created_at,
              updated_at: record.updated_at,
              manual_reason: record.manual_reason,
            });
          }

          // 건강보험 정보
          if (record.health_insurance_acquisition_date || record.health_insurance_status) {
            transformedData.push({
              enrollment_id: `${record.enrollment_id}_hi`,
              worker_id: record.worker_id,
              site_id: record.site_id,
              year_month: record.year_month,
              insurance_type: "health_insurance",
              acquisition_date: record.health_insurance_acquisition_date,
              loss_date: record.health_insurance_loss_date,
              status: record.health_insurance_status,
              enrollment_status: record.enrollment_status,
              created_at: record.created_at,
              updated_at: record.updated_at,
              manual_reason: record.manual_reason,
            });
          }

          // 고용보험 정보
          if (record.employment_insurance_acquisition_date || record.employment_insurance_status) {
            transformedData.push({
              enrollment_id: `${record.enrollment_id}_ei`,
              worker_id: record.worker_id,
              site_id: record.site_id,
              year_month: record.year_month,
              insurance_type: "employment_insurance",
              acquisition_date: record.employment_insurance_acquisition_date,
              loss_date: record.employment_insurance_loss_date,
              status: record.employment_insurance_status,
              enrollment_status: record.enrollment_status,
              created_at: record.created_at,
              updated_at: record.updated_at,
              manual_reason: record.manual_reason,
            });
          }

          // 산재보험 정보
          if (record.industrial_accident_acquisition_date || record.industrial_accident_status) {
            transformedData.push({
              enrollment_id: `${record.enrollment_id}_ia`,
              worker_id: record.worker_id,
              site_id: record.site_id,
              year_month: record.year_month,
              insurance_type: "industrial_accident",
              acquisition_date: record.industrial_accident_acquisition_date,
              loss_date: record.industrial_accident_loss_date,
              status: record.industrial_accident_status,
              enrollment_status: record.enrollment_status,
              created_at: record.created_at,
              updated_at: record.updated_at,
              manual_reason: record.manual_reason,
            });
          }
        });

        const cacheKey = `${workerId}-${selectedSite}`;
        result[cacheKey] = transformedData;
      }
      console.log("React Query 변환 결과:", result);
      return result;
    },
    enabled: !!selectedSite && !!workersData,
    staleTime: 60 * 1000, // 1분 (근로자 데이터는 어느 정도 최신성 필요)
    cacheTime: 3 * 60 * 1000, // 3분
    refetchOnMount: true, // 컴포넌트 마운트 시 항상 다시 조회
    onSuccess: (data) => {
      // Sync with Zustand store if needed
      if (useInsuranceEnrollmentStore.getState) {
        useInsuranceEnrollmentStore.getState().setEnrollmentRecords(data);
      }
    },
  });

  // 보험 가입 처리 Mutation
  const acquisitionMutation = useMutation({
    mutationFn: async ({ workerId, yearMonth }) => {
      console.log("보험 가입 함수 호출:", { workerId, selectedSite, yearMonth });

      // 현재 날짜를 가입일로 사용
      const today = new Date().toISOString().split("T")[0];

      // 현재 UI에 표시된 보험 상태 가져오기
      const currentStatus = insuranceStatusData?.[workerId] || {};

      // 각 보험별 상태 정보 가져오기
      const nationalPensionStatus =
        currentStatus.nationalPension?.statusCode ||
        (currentStatus.nationalPension?.required ? "auto_required" : "auto_exempted");

      const healthInsuranceStatus =
        currentStatus.healthInsurance?.statusCode ||
        (currentStatus.healthInsurance?.required ? "auto_required" : "auto_exempted");

      const employmentInsuranceStatus =
        currentStatus.employmentInsurance?.statusCode ||
        (currentStatus.employmentInsurance?.required ? "auto_required" : "auto_exempted");

      const industrialAccidentStatus =
        currentStatus.industrialAccident?.statusCode ||
        (currentStatus.industrialAccident?.required ? "auto_required" : "auto_exempted");

      // 근무 이력 정보 가져오기
      const workHistoryKey = `${workerId}-${selectedSite}-${yearMonth}`;
      const workHistory = workHistoryData?.[workHistoryKey] || {};

      // 먼저 기존 가입 정보 체크
      const { data: existing, error: checkError } = await supabase
        .from("insurance_enrollments")
        .select("*")
        .eq("worker_id", workerId)
        .eq("site_id", selectedSite)
        .eq("year_month", yearMonth)
        .maybeSingle();

      if (checkError && checkError.code !== "PGRST116") throw checkError;

      // 상태에 따라 취득일을 결정하는 함수
      const getAcquisitionDate = (status) => {
        return status === "auto_required" || status === "manual_required" ? today : null;
      };

      if (existing) {
        // 이미 존재하는 경우 업데이트
        const { error: updateError } = await supabase
          .from("insurance_enrollments")
          .update({
            // 보험 상태 및 취득일 - 상태에 따라 취득일 설정
            national_pension_status: nationalPensionStatus,
            health_insurance_status: healthInsuranceStatus,
            employment_insurance_status: employmentInsuranceStatus,
            industrial_accident_status: industrialAccidentStatus,

            // 취득일은 상태에 따라 설정
            national_pension_acquisition_date: getAcquisitionDate(nationalPensionStatus),
            health_insurance_acquisition_date: getAcquisitionDate(healthInsuranceStatus),
            employment_insurance_acquisition_date: getAcquisitionDate(employmentInsuranceStatus),
            industrial_accident_acquisition_date: getAcquisitionDate(industrialAccidentStatus),

            // 근무 이력 정보
            first_work_date: workHistory.firstWorkDate || null,
            previous_month_work_days: workHistory.previousMonthWorkDays || 0,
            previous_month_work_hours: workHistory.previousMonthWorkHours || 0,
            current_month_work_days: workHistory.currentMonthWorkDays || 0,
            current_month_work_hours: workHistory.currentMonthWorkHours || 0,

            enrollment_status: "confirmed",
            user_confirmed: true,
            user_confirmed_at: new Date().toISOString(),
            confirmed_by: user?.id || null,
            updated_at: new Date().toISOString(),
          })
          .eq("enrollment_id", existing.enrollment_id);

        if (updateError) throw updateError;
      } else {
        // 신규 생성
        const { error: insertError } = await supabase.from("insurance_enrollments").insert({
          worker_id: parseInt(workerId),
          site_id: selectedSite,
          year_month: yearMonth,

          // 보험 상태 및 취득일 - 상태에 따라 취득일 설정
          national_pension_status: nationalPensionStatus,
          health_insurance_status: healthInsuranceStatus,
          employment_insurance_status: employmentInsuranceStatus,
          industrial_accident_status: industrialAccidentStatus,

          // 취득일은 상태에 따라 설정
          national_pension_acquisition_date: getAcquisitionDate(nationalPensionStatus),
          health_insurance_acquisition_date: getAcquisitionDate(healthInsuranceStatus),
          employment_insurance_acquisition_date: getAcquisitionDate(employmentInsuranceStatus),
          industrial_accident_acquisition_date: getAcquisitionDate(industrialAccidentStatus),

          // 근무 이력 정보
          first_work_date: workHistory.firstWorkDate || null,
          previous_month_work_days: workHistory.previousMonthWorkDays || 0,
          previous_month_work_hours: workHistory.previousMonthWorkHours || 0,
          current_month_work_days: workHistory.currentMonthWorkDays || 0,
          current_month_work_hours: workHistory.currentMonthWorkHours || 0,

          enrollment_status: "confirmed",
          user_confirmed: true,
          user_confirmed_at: new Date().toISOString(),
          confirmed_by: user?.id || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (insertError) throw insertError;
      }

      return { success: true, message: "보험 가입 처리가 완료되었습니다." };
    },
    onSuccess: () => {
      toast.success("보험 가입 처리가 완료되었습니다.");

      // 관련 데이터 무효화하여 다시 로드
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      queryClient.invalidateQueries({ queryKey: ["workHistory"] });
      queryClient.invalidateQueries({ queryKey: ["insuranceStatus"] });
      queryClient.invalidateQueries({ queryKey: ["enrollmentRecords"] });

      // 약간의 지연 후 탭 변경 (UI에 반영될 시간 제공)
      // setTimeout(() => {
      //   // 탭 변경 - "유지 중인 근로자" 탭으로 이동
      //   setActiveTab(1);
      // }, 500);
    },
    onError: (error) => {
      console.error("보험 가입 처리 오류:", error);
      toast.error(`처리 실패: ${error.message}`);
    },
  });

  // 보험 상실 처리 Mutation
  const lossMutation = useMutation({
    mutationFn: async ({ workerId }) => {
      // 현재 날짜를 상실일로 사용
      const today = new Date().toISOString().split("T")[0];

      // 먼저 기존 가입 정보 체크
      const { data: enrollments, error: fetchError } = await supabase
        .from("insurance_enrollments")
        .select("*")
        .eq("worker_id", workerId)
        .eq("site_id", selectedSite)
        .is("national_pension_loss_date", null);

      if (fetchError) throw fetchError;

      if (!enrollments || enrollments.length === 0) {
        throw new Error("가입 정보를 찾을 수 없습니다.");
      }

      // 모든 가입 정보에 상실일 업데이트
      const updates = {
        national_pension_loss_date: today,
        health_insurance_loss_date: today,
        employment_insurance_loss_date: today,
        industrial_accident_loss_date: today,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("insurance_enrollments")
        .update(updates)
        .eq("worker_id", workerId)
        .eq("site_id", selectedSite);

      if (updateError) throw updateError;

      return { success: true, message: "보험 상실 처리가 완료되었습니다." };
    },
    onSuccess: () => {
      toast.success("보험 상실 처리가 완료되었습니다.");

      // 관련 데이터 무효화하여 다시 로드
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      queryClient.invalidateQueries({ queryKey: ["enrollmentRecords"] });
    },
    onError: (error) => {
      console.error("보험 상실 처리 오류:", error);
      toast.error(`처리 실패: ${error.message}`);
    },
  });

  // 가입 취소 처리 Mutation
  const cancelEnrollmentMutation = useMutation({
    mutationFn: async ({ workerId, yearMonth }) => {
      // 가입 기록 삭제
      const { error } = await supabase
        .from("insurance_enrollments")
        .delete()
        .eq("worker_id", workerId)
        .eq("site_id", selectedSite)
        .eq("year_month", yearMonth);

      if (error) throw error;

      return { success: true, message: "가입 처리가 취소되었습니다." };
    },
    onSuccess: () => {
      toast.success("가입 처리가 취소되었습니다.");

      // 관련 데이터 무효화하여 다시 로드
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      queryClient.invalidateQueries({ queryKey: ["enrollmentRecords"] });

      // 첫 번째 탭으로 이동
      // setActiveTab(0);
    },
    onError: (error) => {
      console.error("가입 취소 처리 오류:", error);
      toast.error(`처리 실패: ${error.message}`);
    },
  });

  // 보험 상태 변경 Mutation
  const statusChangeMutation = useMutation({
    mutationFn: async ({ workerId, insuranceType, newStatus, yearMonth }) => {
      // 먼저 기존 상태 확인
      const { data: existing, error: checkError } = await supabase
        .from("insurance_enrollments")
        .select("*")
        .eq("worker_id", workerId)
        .eq("site_id", selectedSite)
        .eq("year_month", yearMonth)
        .maybeSingle();

      if (checkError && checkError.code !== "PGRST116") throw checkError;

      // 업데이트할 필드 결정
      const updateField =
        insuranceType === "national_pension"
          ? "national_pension_status"
          : insuranceType === "health_insurance"
          ? "health_insurance_status"
          : insuranceType === "employment_insurance"
          ? "employment_insurance_status"
          : "industrial_accident_status";

      if (existing) {
        // 기존 레코드 업데이트
        const updates = {
          [updateField]: newStatus,
          updated_at: new Date().toISOString(),
        };

        const { error: updateError } = await supabase
          .from("insurance_enrollments")
          .update(updates)
          .eq("enrollment_id", existing.enrollment_id);

        if (updateError) throw updateError;
      } else {
        // 신규 레코드 생성
        const insertData = {
          worker_id: parseInt(workerId),
          site_id: selectedSite,
          year_month: yearMonth,
          [updateField]: newStatus,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: insertError } = await supabase
          .from("insurance_enrollments")
          .insert(insertData);

        if (insertError) throw insertError;
      }

      return { success: true, message: "상태가 변경되었습니다." };
    },
    onSuccess: (data, variables) => {
      const insuranceTypeNames = {
        national_pension: "국민연금",
        health_insurance: "건강보험",
        employment_insurance: "고용보험",
        industrial_accident: "산재보험",
      };

      toast.info(`${insuranceTypeNames[variables.insuranceType]} 상태가 변경되었습니다.`);

      // 관련 데이터 무효화하여 다시 로드
      queryClient.invalidateQueries({ queryKey: ["insuranceStatus"] });
      queryClient.invalidateQueries({ queryKey: ["enrollmentRecords"] });
    },
    onError: (error) => {
      console.error("상태 변경 중 오류:", error);
      toast.error(`상태 변경 실패: ${error.message}`);
    },
  });

  // 수동 사유 업데이트 Mutation
  const reasonUpdateMutation = useMutation({
    mutationFn: async ({ workerId, reason, yearMonth }) => {
      // 먼저 기존 정보 확인
      const { data: existing, error: checkError } = await supabase
        .from("insurance_enrollments")
        .select("*")
        .eq("worker_id", workerId)
        .eq("site_id", selectedSite)
        .eq("year_month", yearMonth)
        .maybeSingle();

      if (checkError && checkError.code !== "PGRST116") throw checkError;

      if (existing) {
        // 기존 레코드 업데이트
        const { error: updateError } = await supabase
          .from("insurance_enrollments")
          .update({
            manual_reason: reason,
            updated_at: new Date().toISOString(),
          })
          .eq("enrollment_id", existing.enrollment_id);

        if (updateError) throw updateError;
      } else {
        // 신규 레코드 생성
        const { error: insertError } = await supabase.from("insurance_enrollments").insert({
          worker_id: parseInt(workerId),
          site_id: selectedSite,
          year_month: yearMonth,
          manual_reason: reason,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (insertError) throw insertError;
      }

      return { success: true, message: "사유가 업데이트되었습니다." };
    },
    onSuccess: () => {
      toast.info("사유가 업데이트되었습니다.");

      // 관련 데이터 무효화하여 다시 로드
      queryClient.invalidateQueries({ queryKey: ["enrollmentRecords"] });
    },
    onError: (error) => {
      console.error("사유 업데이트 중 오류:", error);
      toast.error(`업데이트 실패: ${error.message}`);
    },
  });

  // 모든 설정 저장 Mutation
  const saveAllMutation = useMutation({
    mutationFn: async () => {
      const yearMonth = `${selectedYear}-${selectedMonth}`;

      // 모든 근로자 ID 목록 생성 (중복 제거)
      const allWorkers = [
        ...(workersData?.registeredWorkers || []),
        ...(workersData?.activeWorkers || []),
        ...(workersData?.inactiveWorkers || []),
      ];

      const allWorkerIds = allWorkers.map((w) => w.worker_id);

      if (allWorkerIds.length === 0) {
        return { success: true, message: "저장할 근로자가 없습니다." };
      }

      // 결과 추적
      let successCount = 0;
      let errorCount = 0;

      // 각 근로자 처리
      const savePromises = allWorkerIds.map(async (workerId) => {
        try {
          // 현재 보험 상태 가져오기
          const insuranceStatus = insuranceStatusData?.[workerId];

          if (!insuranceStatus)
            return { success: false, error: new Error("보험 상태 정보가 없습니다.") };

          // 근무 이력 가져오기
          const workHistory = workHistoryData?.[`${workerId}-${selectedSite}-${yearMonth}`] || {};

          // 기존 가입 정보 확인
          const { data: existingRecord, error: checkError } = await supabase
            .from("insurance_enrollments")
            .select("*")
            .eq("worker_id", workerId)
            .eq("site_id", selectedSite)
            .eq("year_month", yearMonth)
            .maybeSingle();

          if (checkError && checkError.code !== "PGRST116") {
            return { success: false, error: checkError };
          }

          // 각 보험 타입별 상태값 결정 (기존 값 유지 또는 자동 판단)
          const nationalPensionStatus =
            existingRecord?.national_pension_status ||
            (insuranceStatus?.nationalPension?.required ? "auto_required" : "auto_exempted");

          const healthInsuranceStatus =
            existingRecord?.health_insurance_status ||
            (insuranceStatus?.healthInsurance?.required ? "auto_required" : "auto_exempted");

          const employmentInsuranceStatus =
            existingRecord?.employment_insurance_status ||
            (insuranceStatus?.employmentInsurance?.required ? "auto_required" : "auto_exempted");

          const industrialAccidentStatus =
            existingRecord?.industrial_accident_status ||
            (insuranceStatus?.industrialAccident?.required ? "auto_required" : "auto_exempted");

          // 저장할 데이터 준비
          const settingsToSave = {
            worker_id: parseInt(workerId),
            site_id: selectedSite,
            year_month: yearMonth,

            // 보험 상태 필드
            national_pension_status: nationalPensionStatus,
            health_insurance_status: healthInsuranceStatus,
            employment_insurance_status: employmentInsuranceStatus,
            industrial_accident_status: industrialAccidentStatus,

            // 근무 정보 필드
            first_work_date: workHistory.firstWorkDate || null,
            previous_month_work_days: workHistory.previousMonthWorkDays || 0,
            previous_month_work_hours: workHistory.previousMonthWorkHours || 0,
            current_month_work_days: workHistory.currentMonthWorkDays || 0,
            current_month_work_hours: workHistory.currentMonthWorkHours || 0,

            // 수동 사유는 기존 값 유지
            manual_reason: existingRecord?.manual_reason || "",

            // 사용자 확정 정보
            enrollment_status: "confirmed", // 사용자 확정 상태로 변경
            user_confirmed: true, // 사용자 확정 표시
            user_confirmed_at: new Date().toISOString(), // 확정 시간 기록
            confirmed_by: user?.id || null, // 확정한 사용자 ID

            // 기타 상태 값은 기존 값 유지
            national_pension_reported: existingRecord?.national_pension_reported || false,
            health_insurance_reported: existingRecord?.health_insurance_reported || false,
            employment_insurance_reported: existingRecord?.employment_insurance_reported || false,
            industrial_accident_reported: existingRecord?.industrial_accident_reported || false,

            national_pension_acquisition_date:
              existingRecord?.national_pension_acquisition_date || null,
            health_insurance_acquisition_date:
              existingRecord?.health_insurance_acquisition_date || null,
            employment_insurance_acquisition_date:
              existingRecord?.employment_insurance_acquisition_date || null,
            industrial_accident_acquisition_date:
              existingRecord?.industrial_accident_acquisition_date || null,

            national_pension_loss_date: existingRecord?.national_pension_loss_date || null,
            health_insurance_loss_date: existingRecord?.health_insurance_loss_date || null,
            employment_insurance_loss_date: existingRecord?.employment_insurance_loss_date || null,
            industrial_accident_loss_date: existingRecord?.industrial_accident_loss_date || null,

            // 시스템 필드
            updated_at: new Date().toISOString(),
          };

          let result;
          if (existingRecord) {
            // 기존 레코드 업데이트
            result = await supabase
              .from("insurance_enrollments")
              .update(settingsToSave)
              .eq("enrollment_id", existingRecord.enrollment_id);
          } else {
            // 새 레코드 추가
            const insertData = {
              ...settingsToSave,
              created_at: new Date().toISOString(),
            };
            result = await supabase.from("insurance_enrollments").insert(insertData);
          }

          if (result.error) {
            return { success: false, error: result.error };
          } else {
            return { success: true };
          }
        } catch (error) {
          return { success: false, error };
        }
      });

      // 모든 작업 완료 기다리기
      const results = await Promise.all(savePromises);

      // 결과 처리
      results.forEach((result) => {
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      });

      return {
        success: errorCount === 0,
        successCount,
        errorCount,
        message:
          errorCount === 0
            ? `${successCount}개의 설정이 저장되었습니다.`
            : successCount === 0
            ? `저장 실패: ${errorCount}개의 오류가 발생했습니다.`
            : `${successCount}개 저장 성공, ${errorCount}개 저장 실패`,
      };
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(result.message);
      } else if (result.successCount === 0) {
        toast.error(result.message);
      } else {
        toast.warning(result.message);
      }

      // 관련 데이터 무효화하여 다시 로드
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      queryClient.invalidateQueries({ queryKey: ["workHistory"] });
      queryClient.invalidateQueries({ queryKey: ["insuranceStatus"] });
      queryClient.invalidateQueries({ queryKey: ["enrollmentRecords"] });
    },
    onError: (error) => {
      console.error("설정 저장 오류:", error);
      toast.error("설정 저장 중 오류가 발생했습니다.");
    },
  });

  // 이전 달 계산 함수
  const calculatePreviousYearMonth = (year, month) => {
    const prevMonth = parseInt(month) - 1;
    if (prevMonth === 0) {
      return `${parseInt(year) - 1}-12`;
    }
    return `${year}-${prevMonth.toString().padStart(2, "0")}`;
  };

  // 가입일 확인 함수

  // Handle acquisition with toast feedback
  const handleAcquisition = useCallback(
    async (workerId, e) => {
      if (e) e.stopPropagation();
      console.log("가입 처리 시작:", workerId, selectedSite, `${selectedYear}-${selectedMonth}`);

      const yearMonth = `${selectedYear}-${selectedMonth}`;
      acquisitionMutation.mutate({ workerId, yearMonth });
    },
    [selectedYear, selectedMonth, selectedSite, acquisitionMutation]
  );

  // Handle loss with toast feedback
  const handleLoss = useCallback(
    async (workerId, e) => {
      if (e) e.stopPropagation();

      lossMutation.mutate({ workerId });
    },
    [lossMutation]
  );

  // 컴포넌트 내에서 직접 isEnrolled 함수 정의
  const isEnrolled = useCallback(
    (workerId, siteId, insuranceType) => {
      if (!workerId || !siteId || !enrollmentRecordsData) return false;

      // 캐시 키 생성 (workerId-siteId 형식)
      const cacheKey = `${workerId}-${siteId}`;

      // 해당 근로자의 보험 기록 가져오기
      const records = enrollmentRecordsData[cacheKey] || [];

      // 디버깅 로그 추가
      console.log(`근로자 ${workerId}, 보험 ${insuranceType} 기록 확인:`, records);

      // 해당 보험 유형에 가입되어 있는지 확인
      return records.some((record) => {
        // 보험 유형이 일치하는지 확인
        if (record.insurance_type === insuranceType) {
          // 가입 상태 확인 방법 1: 취득일이 있고 상실일이 없는 경우
          if (record.acquisition_date && !record.loss_date) {
            return true;
          }

          // 가입 상태 확인 방법 2: 상태 코드가 가입 필요인 경우
          if (record.status === "auto_required" || record.status === "manual_required") {
            return true;
          }
        }

        return false;
      });
    },
    [enrollmentRecordsData]
  );

  // Handle status change
  const handleStatusChange = useCallback(
    async (workerId, insuranceType, newStatus, e) => {
      if (e) e.stopPropagation();

      const yearMonth = `${selectedYear}-${selectedMonth}`;
      statusChangeMutation.mutate({ workerId, insuranceType, newStatus, yearMonth });
    },
    [selectedYear, selectedMonth, statusChangeMutation]
  );

  // Handle cancel enrollment
  const handleCancelEnrollment = useCallback(
    async (workerId, e) => {
      if (e) e.stopPropagation();

      const yearMonth = `${selectedYear}-${selectedMonth}`;
      cancelEnrollmentMutation.mutate({ workerId, yearMonth });
    },
    [selectedYear, selectedMonth, cancelEnrollmentMutation]
  );

  // 보험 유형 이름 반환 함수
  const getInsuranceTypeName = useCallback((insuranceType) => {
    switch (insuranceType) {
      case "national_pension":
        return "국민연금";
      case "health_insurance":
        return "건강보험";
      case "employment_insurance":
        return "고용보험";
      case "industrial_accident":
        return "산재보험";
      default:
        return insuranceType;
    }
  }, []);

  // 수동 사유 업데이트
  const handleReason = useCallback(
    (workerId, reason, e) => {
      if (e) e.stopPropagation();

      const yearMonth = `${selectedYear}-${selectedMonth}`;
      reasonUpdateMutation.mutate({ workerId, reason, yearMonth });
    },
    [selectedYear, selectedMonth, reasonUpdateMutation]
  );

  // 모든 설정 저장 처리 함수
  const handleSaveAll = useCallback(() => {
    saveAllMutation.mutate();
  }, [saveAllMutation]);

  // Get count by insurance type
  const getCountByInsuranceType = useCallback(
    (workers, insuranceType) => {
      if (!workers) return 0;
      return workers.filter((worker) => isEnrolled(worker.worker_id, selectedSite, insuranceType))
        .length;
    },
    [selectedSite, isEnrolled]
  );

  // Get manual setting reason
  const getManualReason = useCallback(
    (workerId) => {
      if (!enrollmentRecordsData) return "";
      const key = `${workerId}-${selectedSite}`;
      const records = enrollmentRecordsData[key] || [];
      const yearMonth = `${selectedYear}-${selectedMonth}`;

      // 현재 달의 기록 찾기
      const currentRecord = records.find((record) => record.year_month === yearMonth);
      return currentRecord?.manual_reason || "";
    },
    [selectedSite, selectedYear, selectedMonth, enrollmentRecordsData]
  );

  // 보험 상태 배지 렌더링 함수
  const renderInsuranceStatusBadge = useCallback(
    (workerId, insuranceType) => {
      if (!workerId || !selectedSite || !insuranceStatusData) {
        return (
          <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
            정보 없음
          </span>
        );
      }

      // 캐싱된 상태 사용
      const status =
        insuranceStatusData[workerId]?.[
          insuranceType === "national_pension"
            ? "nationalPension"
            : insuranceType === "health_insurance"
            ? "healthInsurance"
            : insuranceType === "employment_insurance"
            ? "employmentInsurance"
            : "industrialAccident"
        ];

      // 탭에 따라 다른 로직 적용
      if (activeTab === 0) {
        // 신규 대상자 탭
        // 스타일 및 텍스트 가져오기
        const styleClasses = getStatusStyle(status);
        const statusText = getStatusText(status);

        return (
          <span
            className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${styleClasses}`}
          >
            {statusText}
          </span>
        );
      } else {
        // 유지 중인 근로자 및 상실 대상자 탭 - 실제 가입 상태 표시
        const enrolled = isEnrolled(workerId, selectedSite, insuranceType);

        // 상실 탭에서 "상실 필요" 상태 표시
        if (activeTab === 2 && enrolled) {
          return (
            <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
              상실 필요
            </span>
          );
        }

        return (
          <span
            className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
              enrolled ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            {enrolled ? "가입" : "미가입"}
          </span>
        );
      }
    },
    [selectedSite, activeTab, insuranceStatusData, getStatusStyle, getStatusText, isEnrolled]
  );

  // 가입 내역 렌더링 함수
  const renderEnrollmentRecords = useCallback(
    (workerId) => {
      // 보험 종류 정의
      const insuranceTypes = [
        { id: "national_pension", name: "국민연금", color: "blue" },
        { id: "health_insurance", name: "건강보험", color: "green" },
        { id: "employment_insurance", name: "고용보험", color: "purple" },
        { id: "industrial_accident", name: "산재보험", color: "red" },
      ];

      // 가입 상태인 보험만 필터링
      const enrolledInsurances = insuranceTypes.filter((type) =>
        isEnrolled(workerId, selectedSite, type.id)
      );

      if (enrolledInsurances.length === 0) {
        // 가입된 보험이 없는 경우
        return (
          <tr>
            <td colSpan="4" className="px-6 py-10 text-center text-gray-500">
              <div className="flex flex-col items-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-8 w-8 text-gray-300 mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                가입 정보가 없습니다.
              </div>
            </td>
          </tr>
        );
      }

      // 가입된 보험에 대한 행 생성
      return enrolledInsurances.map((insurance, idx) => (
        <tr key={idx} className="hover:bg-gray-50">
          <td className="px-4 py-3 text-sm">
            <span className="flex items-center">
              <span className={`w-2 h-2 bg-${insurance.color}-500 rounded-full mr-2`}></span>
              {insurance.name}
            </span>
          </td>
          <td className="px-4 py-3 text-sm">{activeTab === 2 ? "상실 대상" : "가입 중"}</td>
          <td className="px-4 py-3 text-sm">{activeTab === 2 ? "근로관계 종료" : "자동 가입"}</td>
          <td className="px-4 py-3 text-sm">
            {activeTab === 2 ? (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                상실 필요
              </span>
            ) : (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                가입 중
              </span>
            )}
          </td>
        </tr>
      ));
    },
    [activeTab, selectedSite, isEnrolled]
  );

  // 근로자 기본 정보 및 근무 이력 상세 정보 렌더링 컴포넌트
  const WorkerDetailInfo = React.memo(({ worker }) => (
    <div className="bg-white p-4 rounded-lg shadow-sm">
      <h4 className="text-md font-semibold text-blue-700 mb-3 pb-2 border-b">근로자 정보</h4>
      <div className="space-y-3 text-sm">
        <div className="flex">
          <span className="font-medium w-28">이름:</span>
          <span>{worker.name}</span>
        </div>
        <div className="flex">
          <span className="font-medium w-28">주민등록번호:</span>
          <span>{formatResidentNumber(worker.resident_number)}</span>
        </div>
        <div className="flex">
          <span className="font-medium w-28">연락처:</span>
          <span>{formatPhoneNumber(worker.contact_number)}</span>
        </div>
        <div className="flex">
          <span className="font-medium w-28">나이:</span>
          <span>{worker.age}세</span>
        </div>
        <div className="flex">
          <span className="font-medium w-28">직종:</span>
          <span>{worker.jobName || "미지정"}</span>
        </div>
      </div>
    </div>
  ));

  const WorkHistoryDetail = React.memo(({ workHistory, isInactiveTab = false }) => (
    <div className="bg-white p-4 rounded-lg shadow-sm">
      <h4 className="text-md font-semibold text-blue-700 mb-3 pb-2 border-b">근무 이력</h4>
      <div className="space-y-3 text-sm">
        <div className="flex">
          <span className="font-medium w-28">전월 첫 근무일:</span>
          <span>
            {workHistory.prevMonthFirstWorkDate
              ? new Date(workHistory.prevMonthFirstWorkDate).toLocaleDateString()
              : "없음"}
          </span>
        </div>
        <div className="flex">
          <span className="font-medium w-28">전월 근무일수:</span>
          <span>{workHistory.previousMonthWorkDays || 0}일</span>
        </div>
        <div className="flex">
          <span className="font-medium w-28">전월 근무시간:</span>
          <span>{workHistory.previousMonthWorkHours || 0}시간</span>
        </div>
        <div className="flex">
          <span className="font-medium w-28">당월 첫 근무일:</span>
          <span>
            {isInactiveTab ? (
              <span className="text-red-500 font-medium">미근무</span>
            ) : workHistory.currentMonthFirstWorkDate ? (
              new Date(workHistory.currentMonthFirstWorkDate).toLocaleDateString()
            ) : (
              "당월 미근무"
            )}
          </span>
        </div>
        <div className="flex">
          <span className="font-medium w-28">당월 근무일수:</span>
          {isInactiveTab ? (
            <span className="text-red-500 font-medium">0일</span>
          ) : (
            <span>{workHistory.currentMonthWorkDays || 0}일</span>
          )}
        </div>
        <div className="flex">
          <span className="font-medium w-28">당월 근무시간:</span>
          {isInactiveTab ? (
            <span className="text-red-500 font-medium">0시간</span>
          ) : (
            <span>{workHistory.currentMonthWorkHours || 0}시간</span>
          )}
        </div>
        <div className="flex">
          <span className="font-medium w-28">당월 급여:</span>
          {isInactiveTab ? (
            <span className="text-red-500 font-medium">0원</span>
          ) : (
            <span>{(workHistory.monthlyWage || 0).toLocaleString()}원</span>
          )}
        </div>
        {isInactiveTab && (
          <div className="flex">
            <span className="font-medium w-28 font-medium">당월 미등록:</span>
            <span className="text-red-500 font-medium">상실 대상</span>
          </div>
        )}
      </div>
    </div>
  ));

  // 근로자 행 컴포넌트
  const WorkerRow = React.memo(
    ({
      worker,
      index,
      workHistory,
      isInactiveTab,
      selected,
      yearMonth,
      handleRowClick,
      handleActionClick,
      enrollmentDate,
    }) => (
      <React.Fragment>
        <tr
          className={`${
            selected ? "bg-blue-50" : "hover:bg-gray-50"
          } cursor-pointer transition-colors`}
          onClick={() => handleRowClick(worker.worker_id)}
        >
          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>

          <td className="px-4 py-4">
            <WorkerProfile worker={worker} />
          </td>

          <td className="px-4 py-4">
            <WorkerHistory workHistory={workHistory} isInactiveTab={isInactiveTab} />
          </td>

          <td className="px-4 py-4">
            <InsuranceStatusGrid
              workerId={worker.worker_id}
              activeTab={activeTab}
              insuranceStatusCache={insuranceStatusData || {}}
              selectedSite={selectedSite}
              isEnrolled={isEnrolled}
              getStatusStyle={getStatusStyle}
              getStatusText={getStatusText}
            />
          </td>

          <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
            {activeTab === 0 ? (
              // New enrollment tab - Show the enrollment button
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  console.log("가입 처리 버튼 클릭됨", worker.worker_id);
                  handleActionClick(worker.worker_id, e, "acquire");
                }}
                className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                가입 처리
              </button>
            ) : activeTab === 1 ? (
              // Active workers tab - Show cancel button for newly enrolled workers
              (() => {
                // if (enrollmentDate && enrollmentDate === yearMonth) {
                return (
                  <button
                    onClick={(e) => handleActionClick(worker.worker_id, e, "cancel")}
                    className="inline-flex items-center px-3 py-1.5 bg-yellow-600 text-white text-xs font-medium rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 mr-1"
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
                    취소
                  </button>
                );
                // } else {
                //   return (
                //     <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-600">
                //       유지중
                //     </span>
                //   );
                // }
              })()
            ) : (
              // Inactive workers tab - Show loss button
              <button
                onClick={(e) => handleActionClick(worker.worker_id, e, "loss")}
                className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-1"
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
                상실 처리
              </button>
            )}
          </td>
        </tr>

        {selected && (
          <tr>
            <td colSpan="5" className="p-0">
              <div className="border-t border-b border-blue-200 bg-blue-50 p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-blue-800">
                    {worker.name} - 4대보험 세부 정보
                  </h3>
                  <button
                    onClick={() => handleRowClick(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-6 w-6"
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
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* 근로자 정보 */}
                  <WorkerDetailInfo worker={worker} />

                  {/* 근무 이력 정보 */}
                  <WorkHistoryDetail workHistory={workHistory} isInactiveTab={isInactiveTab} />
                </div>

                <div className="mt-6">
                  <h4 className="text-md font-semibold text-blue-700 mb-3 pb-2 border-b">
                    4대보험 가입 정보
                  </h4>
                  <div className="bg-white border rounded-lg shadow-sm">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            보험 종류
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            가입일
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            가입사유
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            상태
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {renderEnrollmentRecords(worker.worker_id)}
                      </tbody>
                    </table>
                  </div>

                  {/* 상실 탭인 경우 주의 메시지 표시 */}
                  {isInactiveTab && (
                    <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-yellow-500 mr-2 mt-0.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        <div>
                          <p className="text-yellow-800 font-medium mb-1">
                            주의: 당월 근무 기록이 없는 근로자입니다
                          </p>
                          <p className="text-yellow-700 text-sm">
                            실제로 현장에 더 이상 출근하지 않는 경우 상실 처리가 필요합니다.
                            상실일이 속한 달의 전월까지 보험료가 부과되므로, 가능한 빨리 상실
                            처리하는 것이 좋습니다.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 유지 탭인 경우 주의 메시지 표시 */}
                  {activeTab === 1 && (
                    <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-5 w-5 text-yellow-500 mr-2 mt-0.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        <div>
                          <p className="text-yellow-800 font-medium mb-1">
                            주의: 고용 관계 변동 사항
                          </p>
                          <p className="text-yellow-700 text-sm">
                            근로자가 현장에 더 이상 출근하지 않는 경우 상실 처리가 필요합니다.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 신규 가입 탭에서만 설정 UI 표시 */}
                  {activeTab === 0 && (
                    <>
                      <div className="mt-6">
                        <h4 className="text-md font-semibold text-blue-700 mb-3 pb-2 border-b">
                          4대보험 설정
                        </h4>
                        <InsuranceControls
                          worker={worker}
                          yearMonth={yearMonth}
                          selectedSite={selectedSite}
                          insuranceStatusCache={insuranceStatusData || {}}
                          handleStatusChange={handleStatusChange}
                          renderInsuranceStatusBadge={renderInsuranceStatusBadge}
                        />
                      </div>

                      {/* 사유 입력 */}
                      <div className="mt-6">
                        <h4 className="text-md font-semibold text-blue-700 mb-2">수동 설정 사유</h4>
                        <div className="flex items-start space-x-2">
                          <textarea
                            className="flex-1 p-2 border rounded"
                            rows="2"
                            placeholder="수동 설정 사유를 입력하세요"
                            value={getManualReason(worker.worker_id)}
                            onChange={(e) => {
                              // 클라이언트 상태만 변경
                              const reason = e.target.value;
                              // 실제 저장은 사용자가 저장 버튼을 클릭할 때 수행
                            }}
                          ></textarea>
                          <button
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReason(worker.worker_id, getManualReason(worker.worker_id), e);
                            }}
                          >
                            저장
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    )
  );

  // 행 클릭 및 액션 버튼 클릭 핸들러
  const handleRowClick = useCallback(
    (workerId) => {
      setSelectedWorkerId(workerId === selectedWorkerId ? null : workerId);
      setShowDetail(workerId !== null && workerId !== selectedWorkerId);
    },
    [selectedWorkerId]
  );

  useEffect(() => {
    if (user) {
      initialize(user.id);
    }
  }, [user, initialize]);

  // 현장 또는 연월이 변경될 때 탭 초기화 및 데이터 무효화
  useEffect(() => {
    // UI 상태 초기화
    setActiveTab(0); // 기본 탭(신규 가입 대상자)으로 초기화
    setSelectedWorkerId(null); // 선택된 근로자 정보도 초기화
    setShowDetail(false); // 상세 정보 표시 여부도 초기화

    // 데이터 새로고침 - 현장이 선택된 경우에만 실행
    if (selectedSite) {
      console.log("현장/연월 변경 또는 페이지 진입, 쿼리 캐시 무효화");

      // 모든 관련 쿼리 무효화하여 새로고침
      queryClient.invalidateQueries({ queryKey: ["workers"] });
      queryClient.invalidateQueries({ queryKey: ["workHistory"] });
      queryClient.invalidateQueries({ queryKey: ["insuranceStatus"] });
      queryClient.invalidateQueries({ queryKey: ["enrollmentRecords"] });
    }
  }, [selectedSite, selectedYear, selectedMonth, queryClient]);

  // 선택된 근로자에 대한 상세 정보 로드
  const { data: selectedWorkerData } = useQuery({
    queryKey: ["workerDetails", selectedWorkerId],
    queryFn: async () => {
      if (!selectedWorkerId) return null;

      const { data, error } = await supabase
        .from("workers")
        .select("*")
        .eq("worker_id", selectedWorkerId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!selectedWorkerId,
  });

  // 테스트 로그 추가
  // useEffect(() => {
  //   if (workersData?.activeWorkers?.length > 0 && enrollmentRecordsData) {
  //     const testWorkerId = workersData.activeWorkers[0].worker_id;
  //     console.log("isEnrolled 테스트:", {
  //       workerId: testWorkerId,
  //       국민연금: isEnrolled(testWorkerId, selectedSite, "national_pension"),
  //       건강보험: isEnrolled(testWorkerId, selectedSite, "health_insurance"),
  //       고용보험: isEnrolled(testWorkerId, selectedSite, "employment_insurance"),
  //       산재보험: isEnrolled(testWorkerId, selectedSite, "industrial_accident"),
  //     });
  //   }
  // }, [workersData, selectedSite, enrollmentRecordsData, isEnrolled]);
  // Handle site selection change
  const handleSiteChange = (e) => {
    setSelectedSite(e.target.value);
  };

  // Handle year and month change
  const handleYearMonthChange = (e) => {
    const [year, month] = e.target.value.split("-");
    setSelectedYear(year);
    setSelectedMonth(month);
  };

  // Handle search
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  // Filter workers based on search term - 메모이제이션
  const filterWorkers = useCallback(
    (workers) => {
      if (!searchTerm || !workers) return workers || [];
      return workers.filter(
        (worker) =>
          worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          worker.resident_number.includes(searchTerm)
      );
    },
    [searchTerm]
  );

  // 가입일 확인 함수
  const getEnrollmentDate = useCallback(
    (workerId) => {
      if (!workerId || !selectedSite || !enrollmentRecordsData) return null;

      const cacheKey = `${workerId}-${selectedSite}`;
      const enrollments = enrollmentRecordsData[cacheKey] || [];

      // Find the newest acquisition date
      let latestEnrollmentMonth = null;

      for (const enrollment of enrollments) {
        // Look for any acquisition date fields
        const fields = [
          "national_pension_acquisition_date",
          "health_insurance_acquisition_date",
          "employment_insurance_acquisition_date",
          "industrial_accident_acquisition_date",
        ];

        for (const field of fields) {
          if (enrollment[field]) {
            const enrollmentDate = enrollment[field].substring(0, 7); // YYYY-MM

            // Keep the most recent month
            if (!latestEnrollmentMonth || enrollmentDate > latestEnrollmentMonth) {
              latestEnrollmentMonth = enrollmentDate;
            }
          }
        }

        // Also check year_month field if present
        if (enrollment.year_month) {
          if (!latestEnrollmentMonth || enrollment.year_month > latestEnrollmentMonth) {
            latestEnrollmentMonth = enrollment.year_month;
          }
        }
      }

      return latestEnrollmentMonth;
    },
    [selectedSite, enrollmentRecordsData]
  );

  const handleActionClick = useCallback(
    (workerId, e, action) => {
      console.log("handleActionClick 호출됨:", workerId, action);
      e.stopPropagation();

      const yearMonth = `${selectedYear}-${selectedMonth}`;

      // 세부 정보창 닫기 - 선택된 근로자 정보 초기화
      setSelectedWorkerId(null);
      setShowDetail(false);

      if (action === "acquire") {
        console.log("acquire 액션 - handleAcquisition 호출 전");
        handleAcquisition(workerId, e);
      } else if (action === "loss") {
        console.log("loss 액션 - handleLoss 호출 전");
        handleLoss(workerId, e);
      } else if (action === "cancel") {
        console.log("cancel 액션 - handleCancelEnrollment 호출 전");
        handleCancelEnrollment(workerId, e);
      }
    },
    [handleAcquisition, handleLoss, handleCancelEnrollment, selectedYear, selectedMonth]
  );

  // 로딩 상태 계산
  const isLoading =
    acquisitionMutation.isPending ||
    lossMutation.isPending ||
    cancelEnrollmentMutation.isPending ||
    statusChangeMutation.isPending ||
    reasonUpdateMutation.isPending ||
    saveAllMutation.isPending ||
    (!!selectedSite &&
      (isLoadingWorkers ||
        workersData === undefined ||
        workHistoryData === undefined ||
        insuranceStatusData === undefined));

  // 메인 렌더링 코드
  return (
    <RoleGuard requiredPermission="EDIT_INSURANCE">
      <div className="space-y-6">
        {/* Loading overlay */}
        {isLoading && (
          <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-70 z-50">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mr-3"></div>
            <span className="text-white">처리 중...</span>
          </div>
        )}

        {/* Header section */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">4대보험 관리</h1>
              {companyName && <p className="text-sm text-gray-500 mt-1">{companyName}</p>}
            </div>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3 w-full md:w-auto">
              <select
                className="px-3 py-2 border border-gray-300 rounded-md bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full md:w-auto"
                value={selectedSite || ""}
                onChange={handleSiteChange}
              >
                <option value="">공사현장 선택</option>
                {sitesData?.map((site) => (
                  <option key={site.site_id} value={site.site_id}>
                    {site.site_name}
                  </option>
                ))}
              </select>

              <input
                type="month"
                className="px-3 py-2 border border-gray-300 rounded-md bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full md:w-auto"
                value={`${selectedYear}-${selectedMonth}`}
                onChange={handleYearMonthChange}
                max={new Date().toISOString().slice(0, 7)} // 현재 년월까지만 선택 가능 (YYYY-MM 형식)
              />
            </div>
          </div>
        </div>

        {/* Explanation section */}
        <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-5 rounded-lg shadow-sm border border-blue-200">
          <div className="flex items-start">
            <div className="mr-4 bg-blue-200 p-2 rounded-full">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-blue-700"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-blue-800 mb-2">4대보험 적용 판단 안내</h2>
              <ul className="list-none space-y-1.5 text-sm text-blue-800">
                <li className="flex items-start">
                  <span className="inline-block w-3 h-3 bg-blue-400 rounded-full mt-1.5 mr-2"></span>
                  <span>
                    <strong>국민연금:</strong> 60세 이하 근로자 중 월급여 220만원 이상이거나 월 8일
                    이상 또는 월 60시간 이상 근무한 경우
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="inline-block w-3 h-3 bg-blue-400 rounded-full mt-1.5 mr-2"></span>
                  <span>
                    <strong>건강보험:</strong> 월 60시간 이상 근무한 경우
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="inline-block w-3 h-3 bg-blue-400 rounded-full mt-1.5 mr-2"></span>
                  <span>
                    <strong>고용보험:</strong> 일용근로자는 근로일수 및 시간 상관없이 모두 적용
                    (65세 이상은 특례 적용)
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="inline-block w-3 h-3 bg-blue-400 rounded-full mt-1.5 mr-2"></span>
                  <span>
                    <strong>산재보험:</strong> 모든 근로자 당연 적용
                  </span>
                </li>
              </ul>
              <p className="mt-2 text-sm italic text-blue-700">
                자동 판단 결과를 확인하고, 필요시 수동으로 적용 여부를 조정할 수 있습니다.
              </p>
            </div>
          </div>
        </div>

        {/* Search and statistics */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg shadow-sm">
          <div className="relative w-full md:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg
                className="h-5 w-5 text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <input
              type="text"
              className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="근로자 이름 또는 주민번호 검색..."
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>

          <div className="flex gap-2 flex-wrap justify-center md:justify-end w-full md:w-auto">
            {/* Statistics cards */}
            <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm flex items-center">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
              <span>
                국민연금:{" "}
                <span className="font-medium text-black">
                  {getCountByInsuranceType(
                    [
                      ...(workersData?.activeWorkers || []),
                      ...(workersData?.inactiveWorkers || []),
                    ],
                    "national_pension"
                  )}{" "}
                </span>
                명
              </span>
            </div>
            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
              <span>
                건강보험:{" "}
                <span className="font-medium text-black">
                  {getCountByInsuranceType(
                    [
                      ...(workersData?.activeWorkers || []),
                      ...(workersData?.inactiveWorkers || []),
                    ],
                    "health_insurance"
                  )}{" "}
                </span>
                명
              </span>
            </div>
            <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm flex items-center">
              <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
              <span>
                고용보험:{" "}
                <span className="font-medium text-black">
                  {getCountByInsuranceType(
                    [
                      ...(workersData?.activeWorkers || []),
                      ...(workersData?.inactiveWorkers || []),
                    ],
                    "employment_insurance"
                  )}{" "}
                </span>
                명
              </span>
            </div>
            <div className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm flex items-center">
              <span className="w-2 h-2 bg-amber-500 rounded-full mr-2"></span>
              <span>
                산재보험:{" "}
                <span className="font-medium text-black">
                  {getCountByInsuranceType(
                    [
                      ...(workersData?.activeWorkers || []),
                      ...(workersData?.inactiveWorkers || []),
                    ],
                    "industrial_accident"
                  )}{" "}
                </span>
                명
              </span>
            </div>
          </div>
        </div>

        {/* Tab area */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Tab header */}
          <div className="flex border-b">
            <button
              className={`py-3 px-6 font-medium text-sm focus:outline-none transition-colors ${
                activeTab === 0
                  ? "border-b-2 border-blue-500 text-blue-600 bg-blue-50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setActiveTab(0)}
            >
              신규 가입 대상자
              <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">
                {workersData?.registeredWorkers ? workersData.registeredWorkers.length : 0}
              </span>
            </button>
            <button
              className={`py-3 px-6 font-medium text-sm focus:outline-none transition-colors ${
                activeTab === 1
                  ? "border-b-2 border-blue-500 text-blue-600 bg-blue-50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setActiveTab(1)}
            >
              유지 중인 근로자
              <span className="ml-2 bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs">
                {workersData?.activeWorkers ? workersData.activeWorkers.length : 0}
              </span>
            </button>
            <button
              className={`py-3 px-6 font-medium text-sm focus:outline-none transition-colors ${
                activeTab === 2
                  ? "border-b-2 border-blue-500 text-blue-600 bg-blue-50"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setActiveTab(2)}
            >
              상실 대상자
              <span className="ml-2 bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs">
                {workersData?.inactiveWorkers ? workersData.inactiveWorkers.length : 0}
              </span>
            </button>
          </div>

          {/* Tab content */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    No.
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    근로자 정보
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    근무 이력
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    4대보험 가입 상태
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(() => {
                  // Determine which workers to show based on active tab
                  const workersArray =
                    activeTab === 0
                      ? workersData?.registeredWorkers
                      : activeTab === 1
                      ? workersData?.activeWorkers
                      : workersData?.inactiveWorkers;

                  const filteredWorkers = filterWorkers(workersArray);

                  if (!filteredWorkers || filteredWorkers.length === 0) {
                    return (
                      <tr>
                        <td colSpan="5" className="px-6 py-12 text-center">
                          <div className="flex flex-col items-center">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-12 w-12 text-gray-300 mb-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            <span className="text-gray-500 text-lg">
                              {selectedSite
                                ? searchTerm
                                  ? "검색 결과가 없습니다."
                                  : activeTab === 0
                                  ? "신규 가입 대상자가 없습니다."
                                  : activeTab === 1
                                  ? "유지 중인 근로자가 없습니다."
                                  : "상실 대상자가 없습니다."
                                : "공사현장을 선택해주세요."}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return filteredWorkers.map((worker, index) => {
                    const yearMonth = `${selectedYear}-${selectedMonth}`;
                    const workHistory =
                      workHistoryData?.[`${worker.worker_id}-${selectedSite}-${yearMonth}`] || {};
                    const isInactiveTab = activeTab === 2;

                    // Get the enrollment date to determine if the worker was enrolled in the current month
                    const enrollmentDate = getEnrollmentDate(worker.worker_id);

                    return (
                      <WorkerRow
                        key={worker.worker_id}
                        worker={worker}
                        index={index}
                        workHistory={workHistory}
                        isInactiveTab={isInactiveTab}
                        selected={selectedWorkerId === worker.worker_id}
                        yearMonth={yearMonth}
                        handleRowClick={handleRowClick}
                        handleActionClick={handleActionClick}
                        enrollmentDate={enrollmentDate}
                      />
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer/Action buttons */}
        <div className="flex justify-end space-x-4 mt-6">
          <Link
            href="/daily-report"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition shadow-sm flex items-center"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            급여명세서
          </Link>
          {activeTab === 0 && (
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition shadow-sm flex items-center"
              onClick={handleSaveAll}
              disabled={saveAllMutation.isPending}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                />
              </svg>
              모든 설정 저장
            </button>
          )}
        </div>

        {/* Toast container */}
        <ToastContainer />
      </div>
    </RoleGuard>
  );
}

export default InsuranceEnrollmentsWithProvider;
