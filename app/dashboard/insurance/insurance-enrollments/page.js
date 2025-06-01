// file: app/dashboard/insurance/insurance-enrollments/page.js

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

// 새로운 보험 계산 함수 import
import { determineInsuranceStatus } from "@/lib/utils/insuranceCalculations";

// 🔥 새로운 헬퍼 함수들 import
import {
  classifyWorkersImproved,
  getEligibleUnEnrolledInsurances,
  checkPreviousMonthEnrollmentMissing,
  isEnrolledInThisMonth,
  shouldShowCancelButton, // 🔧 새로 추가
  debugEnrollmentDates, // 🔧 새로 추가 (디버깅용)
  prepareAllSettingsData,
} from "@/lib/utils/insurance_enrollments_helper";

// Create a client with optimized settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 10, // 10 minutes
      retry: 1,
      refetchOnMount: false,
    },
    mutations: {
      retry: 0,
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

// 🔧 개선: 데이터 검증 함수
const validateInsuranceData = (workersData, workHistoryData, selectedSite, yearMonth) => {
  const issues = [];

  if (!workersData || !workHistoryData) {
    issues.push("기본 데이터 누락");
    return { isValid: false, issues };
  }

  const allWorkers = [
    ...(workersData.registeredWorkers || []),
    ...(workersData.activeWorkers || []),
    ...(workersData.inactiveWorkers || []),
  ];

  if (allWorkers.length === 0) {
    issues.push("근로자 데이터 없음");
    return { isValid: false, issues };
  }

  // 근무 이력 데이터 검증
  const missingHistory = allWorkers.filter((worker) => {
    const key = `${worker.worker_id}-${selectedSite}-${yearMonth}`;
    return !workHistoryData[key];
  });

  if (missingHistory.length > 0) {
    issues.push(`누락된 근무 이력: ${missingHistory.map((w) => w.name).join(", ")}`);
  }

  return {
    isValid: issues.length === 0,
    issues,
    workerCount: allWorkers.length,
    missingHistoryCount: missingHistory.length,
  };
};

// 🔧 개선: 기본값 생성 함수
const createDefaultInsuranceStatus = (worker, errorMessage) => {
  return {
    nationalPension: {
      required: false,
      reason: `계산 오류: ${errorMessage}`,
      isManual: false,
      statusCode: "auto_exempted",
    },
    healthInsurance: {
      required: false,
      reason: `계산 오류: ${errorMessage}`,
      isManual: false,
      statusCode: "auto_exempted",
    },
    employmentInsurance: {
      required: true,
      reason: "일용근로자 당연 적용 (오류로 인한 기본값)",
      isManual: false,
      statusCode: "auto_required",
    },
    industrialAccident: {
      required: true,
      reason: "모든 근로자 당연 적용 (오류로 인한 기본값)",
      isManual: false,
      statusCode: "auto_required",
    },
  };
};

// 🔧 개선: 데이터 그룹화 함수
const groupBy = (array, key) => {
  if (!array) return {};
  return array.reduce((result, item) => {
    const group = item[key];
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {});
};

// 🎯 성능 최적화: 보험 상태 뱃지를 메모이제이션된 컴포넌트로 분리
const InsuranceStatusBadge = React.memo(({ status, styleClasses, statusText }) => {
  return (
    <span
      className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${styleClasses}`}
    >
      {statusText}
    </span>
  );
});

// 🎯 성능 최적화: 근로자 프로필 컴포넌트 분리
const WorkerProfile = React.memo(({ worker }) => (
  <div className="flex items-center">
    <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
      <span className="text-gray-600 font-medium">{worker.name ? worker.name.charAt(0) : "?"}</span>
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
));

// 🎯 성능 최적화: 근무 이력 컴포넌트 분리
const WorkerHistory = React.memo(({ workHistory, isInactiveTab = false }) => (
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
      <div className="text-sm col-span-2">
        <span className="font-medium text-red-500">⚠️ 당월 미등록: 상실 대상</span>
      </div>
    )}
  </div>
));

// 🔥 새로운 컴포넌트: 전월 가입 누락 안내
const PreviousMonthWarning = React.memo(({ warning }) => {
  if (!warning.shouldHaveEnrolledPrevious) return null;

  return (
    <div className="text-xs text-amber-600 mb-1 flex items-center">
      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
        <path
          fillRule="evenodd"
          d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      {warning.message}
    </div>
  );
});

// 🔥 새로운 컴포넌트: 추가 가입 가능 보험 표시
const AdditionalEnrollmentInfo = React.memo(({ eligibleInsurances }) => {
  if (!eligibleInsurances || eligibleInsurances.length === 0) return null;

  return (
    <div className="text-xs text-blue-600 mb-1">
      <span className="font-medium">추가 가입 대상: </span>
      {eligibleInsurances.map((ins) => ins.name).join(", ")}
    </div>
  );
});

// 🎯 성능 최적화: 보험 상태 그리드 컴포넌트 (개선됨)
const InsuranceStatusGrid = React.memo(
  ({
    workerId,
    activeTab,
    insuranceStatusData,
    selectedSite,
    isEnrolled,
    enrollmentRecordsData,
    getStatusStyle,
    getStatusText,
  }) => {
    // 신규 가입 대상자 탭에서는 자동 계산된 상태 표시
    if (activeTab === 0) {
      const workerStatus = insuranceStatusData?.[workerId];

      return (
        <div className="grid grid-cols-2 gap-2">
          <div className="text-sm">
            <span className="text-gray-500">국민연금: </span>
            <InsuranceStatusBadge
              status={workerStatus?.nationalPension}
              styleClasses={getStatusStyle(workerStatus?.nationalPension)}
              statusText={getStatusText(workerStatus?.nationalPension)}
            />
          </div>
          <div className="text-sm">
            <span className="text-gray-500">건강보험: </span>
            <InsuranceStatusBadge
              status={workerStatus?.healthInsurance}
              styleClasses={getStatusStyle(workerStatus?.healthInsurance)}
              statusText={getStatusText(workerStatus?.healthInsurance)}
            />
          </div>
          <div className="text-sm">
            <span className="text-gray-500">고용보험: </span>
            <InsuranceStatusBadge
              status={workerStatus?.employmentInsurance}
              styleClasses={getStatusStyle(workerStatus?.employmentInsurance)}
              statusText={getStatusText(workerStatus?.employmentInsurance)}
            />
          </div>
          <div className="text-sm">
            <span className="text-gray-500">산재보험: </span>
            <InsuranceStatusBadge
              status={workerStatus?.industrialAccident}
              styleClasses={getStatusStyle(workerStatus?.industrialAccident)}
              statusText={getStatusText(workerStatus?.industrialAccident)}
            />
          </div>
        </div>
      );
    } else {
      // 유지 중인 근로자 및 상실 대상자 탭에서는 실제 가입 상태 표시 (개선됨)
      const isInactiveTab = activeTab === 2;

      // 🔥 추가 가입 가능한 보험 확인
      const eligibleUnEnrolled = getEligibleUnEnrolledInsurances(
        workerId,
        selectedSite,
        insuranceStatusData,
        enrollmentRecordsData
      );

      const getInsuranceStatus = (insuranceType) => {
        const enrolled = isEnrolled && isEnrolled(workerId, selectedSite, insuranceType);
        const isEligible = eligibleUnEnrolled.some((ins) => ins.type === insuranceType);

        if (isInactiveTab) {
          return {
            enrolled,
            text: enrolled ? "상실 필요" : "미가입",
            style: enrolled ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-600",
          };
        } else {
          return {
            enrolled,
            text: enrolled ? "가입" : isEligible ? "미가입(가입대상)" : "미가입",
            style: enrolled
              ? "bg-green-100 text-green-800"
              : isEligible
              ? "bg-yellow-100 text-yellow-800"
              : "bg-red-100 text-red-800",
          };
        }
      };

      const npStatus = getInsuranceStatus("national_pension");
      const hiStatus = getInsuranceStatus("health_insurance");
      const eiStatus = getInsuranceStatus("employment_insurance");
      const iaStatus = getInsuranceStatus("industrial_accident");

      return (
        <div className="grid grid-cols-2 gap-2">
          <div className="text-sm">
            <span className="text-gray-500">국민연금: </span>
            <span
              className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${npStatus.style}`}
            >
              {npStatus.text}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">건강보험: </span>
            <span
              className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${hiStatus.style}`}
            >
              {hiStatus.text}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">고용보험: </span>
            <span
              className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${eiStatus.style}`}
            >
              {eiStatus.text}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-gray-500">산재보험: </span>
            <span
              className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${iaStatus.style}`}
            >
              {iaStatus.text}
            </span>
          </div>
        </div>
      );
    }
  }
);

// 🔥 새로운 컴포넌트: 확인 모달
const ConfirmationModal = React.memo(({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex space-x-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
});

// WorkerRow 컴포넌트 (개선됨)
// 🔧 WorkerRow 컴포넌트의 취소 버튼 로직 수정 (페이지 컴포넌트에서 교체)

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
    activeTab,
    selectedSite,
    insuranceStatusData,
    enrollmentRecordsData,
    getStatusStyle,
    getStatusText,
    isEnrolled,
  }) => {
    // 🔥 기존 로직들
    const previousMonthWarning = checkPreviousMonthEnrollmentMissing(
      workHistory,
      insuranceStatusData?.[worker.worker_id],
      enrollmentRecordsData?.[`${worker.worker_id}-${selectedSite}`],
      yearMonth
    );

    const eligibleUnEnrolled = getEligibleUnEnrolledInsurances(
      worker.worker_id,
      selectedSite,
      insuranceStatusData,
      enrollmentRecordsData
    );

    // 🔧 새로운 취소 버튼 표시 로직
    const shouldShowCancel =
      activeTab === 1
        ? (() => {
            const enrollmentRecords =
              enrollmentRecordsData?.[`${worker.worker_id}-${selectedSite}`];

            console.log(`🔧 취소 버튼 조건 확인 - 근로자 ${worker.name}(${worker.worker_id}):`, {
              activeTab,
              yearMonth,
              enrollmentRecords수: enrollmentRecords?.length || 0,
              eligibleUnEnrolled수: eligibleUnEnrolled.length,
            });

            // 🔧 개선된 함수 사용
            const result = shouldShowCancelButton(worker.worker_id, yearMonth, enrollmentRecords);

            console.log(`  → 취소 버튼 표시 여부: ${result}`);
            return result;
          })()
        : false;

    // 🔧 버튼 결정 로직 로깅
    if (activeTab === 1) {
      console.log(`🔧 ${worker.name} 최종 버튼 결정:`, {
        추가가입가능보험수: eligibleUnEnrolled.length,
        취소버튼표시여부: shouldShowCancel,
        최종버튼: eligibleUnEnrolled.length > 0 ? "추가가입" : shouldShowCancel ? "취소" : "유지중",
      });
    }

    return (
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
              insuranceStatusData={insuranceStatusData}
              selectedSite={selectedSite}
              isEnrolled={isEnrolled}
              enrollmentRecordsData={enrollmentRecordsData}
              getStatusStyle={getStatusStyle}
              getStatusText={getStatusText}
            />
          </td>

          <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
            {activeTab === 0 ? (
              // 신규 가입 탭 - 가입 처리 버튼 + 전월 가입 누락 경고
              <div className="flex flex-col items-end">
                <PreviousMonthWarning warning={previousMonthWarning} />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleActionClick(worker.worker_id, e, "acquire", previousMonthWarning);
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
              </div>
            ) : activeTab === 1 ? (
              // 유지 중인 근로자 탭 - 수정된 조건부 버튼 표시
              <div className="flex flex-col items-end space-y-1">
                <AdditionalEnrollmentInfo eligibleInsurances={eligibleUnEnrolled} />

                {eligibleUnEnrolled.length > 0 ? (
                  // 🔧 우선순위 1: 추가 가입 가능한 보험이 있는 경우
                  <button
                    onClick={(e) => handleActionClick(worker.worker_id, e, "additional")}
                    className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition"
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
                    추가 가입
                  </button>
                ) : shouldShowCancel ? (
                  // 🔧 우선순위 2: 개선된 조건으로 취소 버튼 표시
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
                ) : (
                  // 🔧 우선순위 3: 그 외의 경우 유지중 표시
                  <span className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-md">
                    유지중
                  </span>
                )}
              </div>
            ) : (
              // 상실 대상자 탭 - 상실 처리 버튼
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

        {/* 상세 정보 표시 */}
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

                {/* 🔧 개선된 취소 버튼 조건 디버깅 정보 */}
                {activeTab === 1 && (
                  <div className="mb-4 p-3 bg-white rounded border">
                    <h4 className="font-semibold mb-2 text-blue-800">
                      🔧 취소 버튼 조건 디버깅 (개선됨)
                    </h4>
                    <div className="text-sm space-y-1">
                      <div>추가 가입 가능한 보험: {eligibleUnEnrolled.length}개</div>
                      <div>취소 버튼 표시 가능: {shouldShowCancel ? "예" : "아니오"}</div>
                      <div>
                        표시될 버튼:{" "}
                        {eligibleUnEnrolled.length > 0
                          ? "추가 가입"
                          : shouldShowCancel
                          ? "취소"
                          : "유지중"}
                      </div>

                      {/* 🔧 추가: 현재 월과 가입처리월 비교 */}
                      {(() => {
                        const enrollmentRecords =
                          enrollmentRecordsData?.[`${worker.worker_id}-${selectedSite}`];
                        const thisMonthRecord = enrollmentRecords?.find(
                          (r) => r.worker_id === worker.worker_id && r.year_month === yearMonth
                        );

                        return (
                          <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                            <div>현재 조회 월: {yearMonth}</div>
                            <div>가입처리된 월: {thisMonthRecord?.year_month || "없음"}</div>
                            <div>
                              가입일 예시:{" "}
                              {thisMonthRecord?.employment_insurance_acquisition_date || "없음"}
                            </div>
                            <div>
                              월 일치 여부:{" "}
                              {thisMonthRecord?.year_month === yearMonth ? "일치" : "불일치"}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* 기존 상세 정보들 */}
                <div className="text-sm text-gray-600 bg-white p-4 rounded">
                  {/* 기존 상세 정보 표시 로직과 동일 */}
                </div>
              </div>
            </td>
          </tr>
        )}
      </React.Fragment>
    );
  }
);

// 탭별 컴포넌트들 (기존과 유사하지만 WorkerRow props 추가)
const NewEnrollmentTab = React.memo(
  ({
    workers,
    workHistoryData,
    insuranceStatusData,
    selectedSite,
    selectedYear,
    selectedMonth,
    searchTerm,
    selectedWorkerId,
    handleRowClick,
    handleActionClick,
    getStatusStyle,
    getStatusText,
    enrollmentRecordsData,
    isEnrolled,
  }) => {
    const filteredWorkers = useMemo(() => {
      if (!searchTerm || !workers) return workers || [];
      return workers.filter(
        (worker) =>
          worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          worker.resident_number.includes(searchTerm)
      );
    }, [workers, searchTerm]);

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
                {searchTerm ? "검색 결과가 없습니다." : "신규 가입 대상자가 없습니다."}
              </span>
            </div>
          </td>
        </tr>
      );
    }

    return (
      <>
        {filteredWorkers.map((worker, index) => {
          const yearMonth = `${selectedYear}-${selectedMonth}`;
          const workHistory =
            workHistoryData?.[`${worker.worker_id}-${selectedSite}-${yearMonth}`] || {};

          return (
            <WorkerRow
              key={worker.worker_id}
              worker={worker}
              index={index}
              workHistory={workHistory}
              isInactiveTab={false}
              selected={selectedWorkerId === worker.worker_id}
              yearMonth={yearMonth}
              handleRowClick={handleRowClick}
              handleActionClick={handleActionClick}
              activeTab={0}
              selectedSite={selectedSite}
              insuranceStatusData={insuranceStatusData}
              enrollmentRecordsData={enrollmentRecordsData}
              getStatusStyle={getStatusStyle}
              getStatusText={getStatusText}
              isEnrolled={isEnrolled}
            />
          );
        })}
      </>
    );
  }
);

const ActiveWorkersTab = React.memo(
  ({
    workers,
    workHistoryData,
    enrollmentRecordsData,
    selectedSite,
    selectedYear,
    selectedMonth,
    searchTerm,
    selectedWorkerId,
    handleRowClick,
    handleActionClick,
    isEnrolled,
    insuranceStatusData,
    getStatusStyle,
    getStatusText,
  }) => {
    const filteredWorkers = useMemo(() => {
      if (!searchTerm || !workers) return workers || [];
      return workers.filter(
        (worker) =>
          worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          worker.resident_number.includes(searchTerm)
      );
    }, [workers, searchTerm]);

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
              <span className="text-gray-500 text-lg">유지 중인 근로자가 없습니다.</span>
            </div>
          </td>
        </tr>
      );
    }

    return (
      <>
        {filteredWorkers.map((worker, index) => {
          const yearMonth = `${selectedYear}-${selectedMonth}`;
          const workHistory =
            workHistoryData?.[`${worker.worker_id}-${selectedSite}-${yearMonth}`] || {};

          return (
            <WorkerRow
              key={worker.worker_id}
              worker={worker}
              index={index}
              workHistory={workHistory}
              isInactiveTab={false}
              selected={selectedWorkerId === worker.worker_id}
              yearMonth={yearMonth}
              handleRowClick={handleRowClick}
              handleActionClick={handleActionClick}
              activeTab={1}
              selectedSite={selectedSite}
              enrollmentRecordsData={enrollmentRecordsData}
              insuranceStatusData={insuranceStatusData}
              getStatusStyle={getStatusStyle}
              getStatusText={getStatusText}
              isEnrolled={isEnrolled}
            />
          );
        })}
      </>
    );
  }
);

const InactiveWorkersTab = React.memo(
  ({
    workers,
    workHistoryData,
    enrollmentRecordsData,
    selectedSite,
    selectedYear,
    selectedMonth,
    searchTerm,
    selectedWorkerId,
    handleRowClick,
    handleActionClick,
    isEnrolled,
    insuranceStatusData,
    getStatusStyle,
    getStatusText,
  }) => {
    const filteredWorkers = useMemo(() => {
      if (!searchTerm || !workers) return workers || [];
      return workers.filter(
        (worker) =>
          worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          worker.resident_number.includes(searchTerm)
      );
    }, [workers, searchTerm]);

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
              <span className="text-gray-500 text-lg">상실 대상자가 없습니다.</span>
            </div>
          </td>
        </tr>
      );
    }

    return (
      <>
        {filteredWorkers.map((worker, index) => {
          const yearMonth = `${selectedYear}-${selectedMonth}`;
          const workHistory =
            workHistoryData?.[`${worker.worker_id}-${selectedSite}-${yearMonth}`] || {};

          return (
            <WorkerRow
              key={worker.worker_id}
              worker={worker}
              index={index}
              workHistory={workHistory}
              isInactiveTab={true}
              selected={selectedWorkerId === worker.worker_id}
              yearMonth={yearMonth}
              handleRowClick={handleRowClick}
              handleActionClick={handleActionClick}
              activeTab={2}
              selectedSite={selectedSite}
              enrollmentRecordsData={enrollmentRecordsData}
              insuranceStatusData={insuranceStatusData}
              getStatusStyle={getStatusStyle}
              getStatusText={getStatusText}
              isEnrolled={isEnrolled}
            />
          );
        })}
      </>
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

  // 🔥 새로운 모달 상태
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: null,
  });

  // Date selection state
  const currentYear = new Date().getFullYear().toString();
  const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, "0");
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [selectedSite, setSelectedSite] = useState(null);

  // 기존 Zustand 스토어들
  const { getStatusStyle, getStatusText, updateInsuranceStatusUI, clearError, manualSettings } =
    useInsuranceStatusStore();
  const { initialize } = useInsuranceStore();

  // 🚀 React Query - 현장 데이터 로드 (기존과 동일)
  const { data: sitesData } = useQuery({
    queryKey: ["sites", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // 기존 로직과 동일 (생략)
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, role")
        .eq("id", user.id)
        .single();

      if (userError) throw userError;

      const userRole = userData?.role;

      const { data: companyData, error: companyError } = await supabase
        .from("user_companies")
        .select("company_id, company:companies(company_name)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (companyError) throw companyError;
      if (!companyData || !companyData.company_id) return [];

      if (userRole === "admin") {
        const { data: sites, error: sitesError } = await supabase
          .from("location_sites")
          .select(
            "site_id, site_name, address, start_date, end_date, status, industrial_accident_rate"
          )
          .eq("company_id", companyData.company_id)
          .order("site_name");

        if (sitesError) throw sitesError;
        return sites || [];
      } else {
        const { data: assignedSites, error: assignedError } = await supabase
          .from("user_location_sites")
          .select(
            `
            site_id,
            assigned_date,
            location_sites (
              site_id,
              site_name,
              address,
              start_date,
              end_date,
              status,
              industrial_accident_rate
            )
          `
          )
          .eq("user_id", user.id)
          .is("removed_date", null)
          .order("location_sites(site_name)");

        if (assignedError) throw assignedError;

        const sites =
          assignedSites?.map((item) => ({
            ...item.location_sites,
            assigned_date: item.assigned_date,
          })) || [];

        return sites;
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000,
    refetchOnMount: false,
  });

  // 🚀 React Query 최적화: 통합 쿼리 (개선됨 - 새로운 분류 로직 사용)
  const {
    data: integratedData,
    isLoading: isIntegratedLoading,
    error: integratedError,
  } = useQuery({
    queryKey: ["integrated-insurance-data", selectedSite, `${selectedYear}-${selectedMonth}`],
    queryFn: async () => {
      if (!selectedSite) {
        return {
          workersData: { registeredWorkers: [], activeWorkers: [], inactiveWorkers: [] },
          workHistoryData: {},
          insuranceStatusData: {},
          enrollmentRecordsData: {},
        };
      }

      console.log("🚀 통합 데이터 로드 시작:", selectedSite, `${selectedYear}-${selectedMonth}`);

      try {
        const yearMonth = `${selectedYear}-${selectedMonth}`;

        // 1. 기본 근로자 데이터 로드 (기존 로직)
        const basicWorkersData = await loadWorkersData(selectedSite, yearMonth);

        // 2. 근로자가 있으면 추가 데이터 로드
        let workHistoryData = {};
        let insuranceStatusData = {};
        let enrollmentRecordsData = {};

        const allWorkers = [
          ...basicWorkersData.registeredWorkers,
          ...basicWorkersData.activeWorkers,
          ...basicWorkersData.inactiveWorkers,
        ];

        if (allWorkers.length > 0) {
          // 병렬 로드
          const [workHistory, enrollmentRecords] = await Promise.all([
            loadWorkHistoryData(allWorkers, selectedSite, yearMonth),
            loadEnrollmentRecordsData(allWorkers, selectedSite),
          ]);

          workHistoryData = workHistory;
          enrollmentRecordsData = enrollmentRecords;

          // 보험 상태 계산
          insuranceStatusData = await loadInsuranceStatusData(
            allWorkers,
            selectedSite,
            yearMonth,
            workHistoryData
          );
        }

        // 🔥 3. 개선된 분류 로직 적용
        const improvedClassification = classifyWorkersImproved(
          allWorkers,
          workHistoryData,
          enrollmentRecordsData,
          yearMonth
        );

        console.log("✅ 개선된 분류 완료:", {
          신규가입대상: improvedClassification.newEnrollmentWorkers.length,
          유지중인근로자: improvedClassification.activeEnrollmentWorkers.length,
          상실대상자: improvedClassification.lossEnrollmentCandidates.length,
        });

        return {
          workersData: {
            registeredWorkers: improvedClassification.newEnrollmentWorkers,
            activeWorkers: improvedClassification.activeEnrollmentWorkers,
            inactiveWorkers: improvedClassification.lossEnrollmentCandidates,
          },
          workHistoryData,
          insuranceStatusData,
          enrollmentRecordsData,
        };
      } catch (error) {
        console.error("❌ 통합 데이터 로드 실패:", error);
        throw error;
      }
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
    cacheTime: 5 * 60 * 1000,
    refetchOnMount: false,
    retry: 1,
  });

  // 🚀 데이터 로드 함수들 (기존과 동일하므로 생략)
  // 🔧 수정된 loadWorkersData 함수 (페이지 컴포넌트 내부에서 교체)

  const loadWorkersData = async (siteId, yearMonth) => {
    console.log("🔧 수정된 근로자 데이터 로드 시작:", siteId, yearMonth);

    if (!siteId) {
      return { registeredWorkers: [], activeWorkers: [], inactiveWorkers: [] };
    }

    try {
      // 1. 현재 월에 등록된 근로자 ID 조회
      const { data: recordsData, error: recordsError } = await supabase
        .from("work_records")
        .select("worker_id, status, work_hours")
        .eq("site_id", siteId)
        .eq("registration_month", yearMonth);

      if (recordsError) throw recordsError;

      const registeredWorkerIds = recordsData
        ? [...new Set(recordsData.map((record) => record.worker_id))]
        : [];

      // 2. 보험에 가입된 근로자 ID 조회 (모든 enrollment_status 포함)
      const { data: enrollmentData, error: enrollmentError } = await supabase
        .from("insurance_enrollments")
        .select("worker_id, year_month, enrollment_status")
        .eq("site_id", siteId);

      if (enrollmentError) throw enrollmentError;

      // 보험 가입 이력이 있는 모든 근로자 ID (과거 포함)
      const enrolledWorkerIds =
        enrollmentData && enrollmentData.length > 0
          ? [...new Set(enrollmentData.map((e) => e.worker_id))]
          : [];

      // 3. 모든 관련 근로자 ID 수집
      const allWorkerIds = [...new Set([...registeredWorkerIds, ...enrolledWorkerIds])];

      console.log("🔧 근로자 ID 수집 결과:", {
        등록된근로자: registeredWorkerIds.length,
        보험가입이력있는근로자: enrolledWorkerIds.length,
        전체근로자: allWorkerIds.length,
      });

      // 4. 근로자 상세 정보 조회
      const fetchWorkerDetails = async (workerIds) => {
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

        // 직종 코드 정보 조회
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

        // 나이 계산 함수
        const calculateAge = (residentNumber) => {
          if (!residentNumber || residentNumber.length !== 13) return 0;

          const birthYear = parseInt(residentNumber.substring(0, 2), 10);
          const genderDigit = parseInt(residentNumber.charAt(6), 10);

          let fullYear;
          if (genderDigit === 1 || genderDigit === 2) {
            fullYear = 1900 + birthYear;
          } else if (genderDigit === 3 || genderDigit === 4) {
            fullYear = 2000 + birthYear;
          } else {
            fullYear = 1900 + birthYear;
          }

          const currentYear = new Date().getFullYear();
          return currentYear - fullYear;
        };

        return data.map((worker) => ({
          ...worker,
          jobName: worker.job_code ? jobCodeMap[worker.job_code] || "미지정" : "미지정",
          age: calculateAge(worker.resident_number),
          site_id: siteId, // 🔧 중요: site_id 명시적으로 추가
          selectedSite: siteId, // 헬퍼 함수 호환성을 위해 추가
        }));
      };

      const allWorkers = await fetchWorkerDetails(allWorkerIds);

      console.log("🔧 최종 근로자 데이터:", {
        조회된근로자수: allWorkers.length,
        샘플근로자: allWorkers
          .slice(0, 3)
          .map((w) => ({ id: w.worker_id, name: w.name, site_id: w.site_id })),
      });

      // 🔧 중요: 모든 근로자를 하나의 배열로 반환하고,
      // 실제 분류는 classifyWorkersImproved에서 수행하도록 함
      return {
        registeredWorkers: allWorkers, // 임시로 모든 근로자를 여기에 넣음
        activeWorkers: [],
        inactiveWorkers: [],
      };
    } catch (error) {
      console.error("❌ 근로자 데이터 조회 중 오류 발생:", error);
      throw error;
    }
  };

  const loadWorkHistoryData = async (allWorkers, siteId, yearMonth) => {
    // 기존 로직 유지 (paste.txt 참조)
    if (!allWorkers || allWorkers.length === 0) return {};

    const result = {};
    const calculatePreviousYearMonth = (year, month) => {
      const prevMonth = parseInt(month) - 1;
      if (prevMonth === 0) {
        return `${parseInt(year) - 1}-12`;
      }
      return `${year}-${prevMonth.toString().padStart(2, "0")}`;
    };

    const getNextYearMonth = (yearMonth) => {
      const [year, month] = yearMonth.split("-").map((num) => parseInt(num));
      const nextMonth = month + 1;
      const nextYear = nextMonth > 12 ? year + 1 : year;
      return `${nextMonth > 12 ? nextYear : year}-${
        nextMonth > 12 ? "01" : String(nextMonth).padStart(2, "0")
      }`;
    };

    const prevYearMonth = calculatePreviousYearMonth(
      yearMonth.split("-")[0],
      yearMonth.split("-")[1]
    );
    const currentMonthStart = `${yearMonth}-01`;
    const nextYearMonth = getNextYearMonth(yearMonth);
    const nextMonthStart = `${nextYearMonth}-01`;
    const prevMonthStart = `${prevYearMonth}-01`;

    const workerIds = allWorkers.map((worker) => worker.worker_id);

    const [prevRecordsData, currentRecordsData, allRecordsData] = await Promise.all([
      supabase
        .from("work_records")
        .select("worker_id, work_date, work_hours, daily_wage, status")
        .in("worker_id", workerIds)
        .eq("site_id", siteId)
        .gte("work_date", prevMonthStart)
        .lt("work_date", currentMonthStart)
        .neq("status", "registration"),

      supabase
        .from("work_records")
        .select("worker_id, work_date, work_hours, daily_wage, status, registration_month")
        .in("worker_id", workerIds)
        .eq("site_id", siteId)
        .or(
          `registration_month.eq.${yearMonth},and(work_date.gte.${currentMonthStart},work_date.lt.${nextMonthStart})`
        )
        .neq("status", "registration"),

      supabase
        .from("work_records")
        .select("worker_id, work_date")
        .in("worker_id", workerIds)
        .eq("site_id", siteId)
        .neq("status", "registration")
        .order("work_date", { ascending: true }),
    ]);

    for (const worker of allWorkers) {
      const workerId = worker.worker_id;

      const prevRecords = prevRecordsData.data
        ? prevRecordsData.data.filter((r) => r.worker_id === workerId)
        : [];
      const currentRecords = currentRecordsData.data
        ? currentRecordsData.data.filter((r) => r.worker_id === workerId)
        : [];
      const workerAllRecords = allRecordsData.data
        ? allRecordsData.data.filter((r) => r.worker_id === workerId)
        : [];

      const firstWorkDate = workerAllRecords.length > 0 ? workerAllRecords[0].work_date : null;
      const isPreviousMonthRegistered = prevRecords.length > 0 || false;

      const sortedPrevRecords = [...prevRecords].sort(
        (a, b) => new Date(a.work_date) - new Date(b.work_date)
      );
      const prevMonthFirstWorkDate =
        sortedPrevRecords.length > 0 ? sortedPrevRecords[0].work_date : null;

      const sortedCurrentRecords = [...currentRecords].sort(
        (a, b) => new Date(a.work_date) - new Date(b.work_date)
      );
      const currentMonthFirstWorkDate =
        sortedCurrentRecords.length > 0 ? sortedCurrentRecords[0].work_date : null;

      // 🔥 추가: 이번달 마지막 근무일 계산
      let lastWorkDateThisMonth = null;
      if (currentRecords && currentRecords.length > 0) {
        const sortedCurrentRecordsDesc = [...currentRecords].sort(
          (a, b) => new Date(b.work_date).getTime() - new Date(a.work_date).getTime()
        );
        lastWorkDateThisMonth = sortedCurrentRecordsDesc[0].work_date;
      }

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

      const monthlyWage = currentRecords.reduce((sum, r) => sum + parseFloat(r.daily_wage || 0), 0);

      const isRegisteredInCurrentMonth =
        currentRecords.length > 0 || currentRecords.some((r) => r.registration_month === yearMonth);

      result[`${workerId}-${siteId}-${yearMonth}`] = {
        firstWorkDate: firstWorkDate,
        lastWorkDateThisMonth, // 🔥 새로 추가됨
        currentMonthWorkDays,
        currentMonthWorkHours,
        previousMonthWorkDays,
        previousMonthWorkHours,
        monthlyWage,
        isRegisteredInCurrentMonth,
        isPreviousMonthRegistered,
        allTimeFirstWorkDate: firstWorkDate,
        prevMonthFirstWorkDate,
        currentMonthFirstWorkDate,
      };
    }

    return result;
  };

  const loadInsuranceStatusData = async (allWorkers, siteId, yearMonth, workHistoryData) => {
    // 기존 로직 유지하되 paste-4.txt의 determineInsuranceStatus 함수 사용
    if (!allWorkers || allWorkers.length === 0) return {};

    const result = {};
    let successCount = 0;
    let errorCount = 0;

    const allWorkerIds = allWorkers.map((w) => w.worker_id);

    const [allExistingEnrollments, allManualSettings] = await Promise.all([
      supabase
        .from("insurance_enrollments")
        .select(
          `
        worker_id,
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
        industrial_accident_status
      `
        )
        .in("worker_id", allWorkerIds)
        .eq("site_id", siteId),

      supabase
        .from("insurance_enrollments")
        .select(
          `
        worker_id,
        national_pension_status,
        health_insurance_status,
        employment_insurance_status,
        industrial_accident_status,
        manual_reason
      `
        )
        .in("worker_id", allWorkerIds)
        .eq("site_id", siteId)
        .eq("year_month", yearMonth),
    ]);

    const enrollmentsByWorker = groupBy(allExistingEnrollments.data || [], "worker_id");
    const manualSettingsByWorker = groupBy(allManualSettings.data || [], "worker_id");

    for (const worker of allWorkers) {
      try {
        const workerId = worker.worker_id;
        const workHistory = workHistoryData[`${workerId}-${siteId}-${yearMonth}`] || {};

        // 🔥 paste-4.txt의 새로운 함수로 근무 이력 정규화
        const normalizedWorkHistory = {
          currentMonthWorkDays: workHistory.currentMonthWorkDays || 0,
          currentMonthWorkHours: workHistory.currentMonthWorkHours || 0,
          previousMonthWorkDays: workHistory.previousMonthWorkDays || 0,
          previousMonthWorkHours: workHistory.previousMonthWorkHours || 0,
          firstWorkDate: workHistory.allTimeFirstWorkDate || workHistory.firstWorkDate || null,
          lastWorkDateThisMonth: workHistory.lastWorkDateThisMonth || null, // 🔥 중요: 새로 추가된 필드
          monthlyWage: workHistory.monthlyWage || 0,
          isRegisteredInCurrentMonth: workHistory.isRegisteredInCurrentMonth || false,
          isPreviousMonthRegistered: workHistory.isPreviousMonthRegistered || false,
        };

        // 기존 가입 상태 확인
        const workerEnrollments = enrollmentsByWorker[workerId] || [];
        const enrollmentStatus = {};

        const insuranceTypes = [
          "national_pension",
          "health_insurance",
          "employment_insurance",
          "industrial_accident",
        ];

        insuranceTypes.forEach((insuranceType) => {
          const isEnrolled = workerEnrollments.some((record) => {
            const acquisitionField = `${insuranceType}_acquisition_date`;
            const lossField = `${insuranceType}_loss_date`;
            const statusField = `${insuranceType}_status`;

            return (
              (record[acquisitionField] && !record[lossField]) ||
              record[statusField] === "auto_required" ||
              record[statusField] === "manual_required"
            );
          });

          enrollmentStatus[insuranceType] = { isEnrolled };
        });

        // 🔥 paste-4.txt의 새로운 determineInsuranceStatus 함수 사용
        const insuranceResult = determineInsuranceStatus(
          worker,
          normalizedWorkHistory,
          enrollmentStatus
        );

        if (!insuranceResult || typeof insuranceResult !== "object") {
          throw new Error("보험 판단 결과 구조 오류");
        }

        const requiredFields = [
          "nationalPension",
          "healthInsurance",
          "employmentInsurance",
          "industrialAccident",
        ];
        const missingFields = requiredFields.filter((field) => !insuranceResult[field]);

        if (missingFields.length > 0) {
          throw new Error(`보험 판단 결과 필수 필드 누락: ${missingFields.join(", ")}`);
        }

        // 수동 설정 적용
        const workerManualSettings = manualSettingsByWorker[workerId];
        const manualSettings =
          workerManualSettings && workerManualSettings.length > 0 ? workerManualSettings[0] : null;

        if (manualSettings) {
          const insuranceTypes = [
            "nationalPension",
            "healthInsurance",
            "employmentInsurance",
            "industrialAccident",
          ];
          const dbFields = [
            "national_pension_status",
            "health_insurance_status",
            "employment_insurance_status",
            "industrial_accident_status",
          ];

          insuranceTypes.forEach((type, index) => {
            const dbField = dbFields[index];
            if (manualSettings[dbField]?.startsWith("manual_")) {
              insuranceResult[type] = {
                ...insuranceResult[type],
                required: manualSettings[dbField] === "manual_required",
                reason: "수동 설정",
                isManual: true,
                statusCode: manualSettings[dbField],
              };
            }
          });

          if (manualSettings.manual_reason) {
            insuranceResult.manualReason = manualSettings.manual_reason;
          }
        }

        result[workerId] = insuranceResult;
        successCount++;
      } catch (error) {
        console.error(
          `❌ 근로자 ${worker.name}(ID: ${worker.worker_id}) 보험 상태 계산 오류:`,
          error
        );
        result[worker.worker_id] = createDefaultInsuranceStatus(worker, error.message);
        errorCount++;
      }
    }

    console.log("📊 새로운 보험 상태 계산 완료:", {
      총근로자수: allWorkers.length,
      성공: successCount,
      실패: errorCount,
      성공률: `${((successCount / allWorkers.length) * 100).toFixed(1)}%`,
    });

    return result;
  };

  // 🔧 수정된 loadEnrollmentRecordsData 함수 (페이지 컴포넌트 내부에서 교체)

  const loadEnrollmentRecordsData = async (allWorkers, siteId) => {
    console.log("🔧 수정된 가입 기록 로드 시작:", {
      근로자수: allWorkers?.length || 0,
      현장ID: siteId,
    });

    if (!allWorkers || allWorkers.length === 0) return {};

    const result = {};
    const workerIds = allWorkers.map((worker) => worker.worker_id);

    try {
      // 🔧 단순화된 조회: 복잡한 변환 없이 원본 데이터 그대로 사용
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
        .eq("site_id", siteId);

      if (error) throw error;

      console.log("🔧 조회된 가입 기록:", {
        전체레코드수: data?.length || 0,
        근로자별분포: data
          ? Object.keys(
              data.reduce((acc, record) => {
                acc[record.worker_id] = (acc[record.worker_id] || 0) + 1;
                return acc;
              }, {})
            ).length
          : 0,
      });

      // 🔧 중요: 복잡한 변환 로직 제거하고 원본 데이터 그대로 사용
      for (const worker of allWorkers) {
        const workerId = worker.worker_id;
        const workerEnrollments = data ? data.filter((e) => e.worker_id === workerId) : [];

        const cacheKey = `${workerId}-${siteId}`;

        // 🔧 원본 레코드 그대로 저장 (변환하지 않음)
        result[cacheKey] = workerEnrollments.map((record) => ({
          ...record,
          // 호환성을 위해 일부 필드 추가 (기존 코드가 기대하는 형태)
          insurance_type: "all", // 모든 보험 정보를 포함하는 통합 레코드임을 표시
          acquisition_date:
            record.national_pension_acquisition_date ||
            record.health_insurance_acquisition_date ||
            record.employment_insurance_acquisition_date ||
            record.industrial_accident_acquisition_date,
          loss_date:
            record.national_pension_loss_date ||
            record.health_insurance_loss_date ||
            record.employment_insurance_loss_date ||
            record.industrial_accident_loss_date,
          status: record.enrollment_status,
        }));
      }

      console.log("🔧 최종 가입 기록 결과:", {
        캐시키수: Object.keys(result).length,
        샘플데이터: Object.entries(result)
          .slice(0, 3)
          .map(([key, records]) => ({
            캐시키: key,
            레코드수: records.length,
          })),
      });

      return result;
    } catch (error) {
      console.error("❌ 가입 기록 로드 중 오류:", error);
      throw error;
    }
  };

  // 🚀 개별 데이터 추출 (통합 데이터에서)
  const workersData = integratedData?.workersData || {
    registeredWorkers: [],
    activeWorkers: [],
    inactiveWorkers: [],
  };
  const workHistoryData = integratedData?.workHistoryData || {};
  const insuranceStatusData = integratedData?.insuranceStatusData || {};
  const enrollmentRecordsData = integratedData?.enrollmentRecordsData || {};

  // 🔥 보험 가입 처리 Mutation (개선됨 - 추가 가입 지원)
  // 🔧 수정된 보험 가입 처리 Mutation (페이지 컴포넌트에서 교체)

  const acquisitionMutation = useMutation({
    mutationFn: async ({ workerId, yearMonth, insuranceTypes = null, isAdditional = false }) => {
      console.log("🔧 보험 가입 함수 호출:", {
        workerId,
        selectedSite,
        yearMonth,
        insuranceTypes,
        isAdditional,
      });

      // 🔧 중요: 가입일을 처리 월 기준으로 설정
      const getAcquisitionDateForMonth = (yearMonth, workHistory) => {
        // 첫 근무일이 있으면 첫 근무일 사용, 없으면 해당 월 1일 사용
        if (workHistory.firstWorkDate) {
          const firstWorkDate = new Date(workHistory.firstWorkDate);
          const [targetYear, targetMonth] = yearMonth.split("-").map(Number);

          // 첫 근무일이 해당 월에 속하면 첫 근무일 사용
          if (
            firstWorkDate.getFullYear() === targetYear &&
            firstWorkDate.getMonth() + 1 === targetMonth
          ) {
            return workHistory.firstWorkDate;
          }
        }

        // 그 외의 경우 해당 월 1일 사용
        return `${yearMonth}-01`;
      };

      // 1. 근로자 정보 가져오기
      const { data: worker, error: workerError } = await supabase
        .from("workers")
        .select("*")
        .eq("worker_id", workerId)
        .single();

      if (workerError) throw workerError;

      // 2. 근무 이력 정보 가져오기
      const workHistoryKey = `${workerId}-${selectedSite}-${yearMonth}`;
      const workHistory = workHistoryData?.[workHistoryKey] || {};

      // 🔧 수정된 가입일 계산
      const acquisitionDate = getAcquisitionDateForMonth(yearMonth, workHistory);
      console.log("🔧 계산된 가입일:", acquisitionDate, "for", yearMonth);

      // 3. 기존 가입 상태 확인
      const { data: existingEnrollments, error: enrollmentError } = await supabase
        .from("insurance_enrollments")
        .select(
          `
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
        industrial_accident_status
      `
        )
        .eq("worker_id", workerId)
        .eq("site_id", selectedSite);

      if (enrollmentError) {
        console.error("기존 가입 정보 조회 오류:", enrollmentError);
      }

      const enrollmentStatus = {};
      const allInsuranceTypes = [
        "national_pension",
        "health_insurance",
        "employment_insurance",
        "industrial_accident",
      ];

      allInsuranceTypes.forEach((insuranceType) => {
        const isEnrolled =
          existingEnrollments &&
          existingEnrollments.some((record) => {
            const acquisitionField = `${insuranceType}_acquisition_date`;
            const lossField = `${insuranceType}_loss_date`;
            const statusField = `${insuranceType}_status`;

            return (
              (record[acquisitionField] && !record[lossField]) ||
              record[statusField] === "auto_required" ||
              record[statusField] === "manual_required"
            );
          });

        enrollmentStatus[insuranceType] = { isEnrolled };
      });

      // 4. 보험 상태 계산
      const normalizedWorkHistory = {
        currentMonthWorkDays: workHistory.currentMonthWorkDays || 0,
        currentMonthWorkHours: workHistory.currentMonthWorkHours || 0,
        previousMonthWorkDays: workHistory.previousMonthWorkDays || 0,
        previousMonthWorkHours: workHistory.previousMonthWorkHours || 0,
        firstWorkDate: workHistory.firstWorkDate || workHistory.allTimeFirstWorkDate || null,
        lastWorkDateThisMonth: workHistory.lastWorkDateThisMonth || null,
        monthlyWage: workHistory.monthlyWage || 0,
        isRegisteredInCurrentMonth: workHistory.isRegisteredInCurrentMonth || false,
        isPreviousMonthRegistered: workHistory.isPreviousMonthRegistered || false,
      };

      const insuranceResult = determineInsuranceStatus(
        worker,
        normalizedWorkHistory,
        enrollmentStatus
      );

      // 5. 추가 가입인 경우 특정 보험만 처리
      let targetInsuranceTypes;
      if (isAdditional && insuranceTypes) {
        targetInsuranceTypes = insuranceTypes;
      } else {
        targetInsuranceTypes = allInsuranceTypes;
      }

      // 6. 각 보험별 상태 정보 가져오기 (수정된 가입일 사용)
      const getAcquisitionDateForInsurance = (status) => {
        return status === "auto_required" || status === "manual_required" ? acquisitionDate : null;
      };

      // 7. 기존 가입 정보 체크
      const { data: existing, error: checkError } = await supabase
        .from("insurance_enrollments")
        .select("*")
        .eq("worker_id", workerId)
        .eq("site_id", selectedSite)
        .eq("year_month", yearMonth)
        .maybeSingle();

      if (checkError && checkError.code !== "PGRST116") throw checkError;

      // 8. 업데이트 데이터 준비
      const updateData = {
        first_work_date: normalizedWorkHistory.firstWorkDate || null,
        previous_month_work_days: normalizedWorkHistory.previousMonthWorkDays || 0,
        previous_month_work_hours: normalizedWorkHistory.previousMonthWorkHours || 0,
        current_month_work_days: normalizedWorkHistory.currentMonthWorkDays || 0,
        current_month_work_hours: normalizedWorkHistory.currentMonthWorkHours || 0,
        enrollment_status: "confirmed",
        user_confirmed: true,
        user_confirmed_at: new Date().toISOString(),
        confirmed_by: user?.id || null,
        updated_at: new Date().toISOString(),
        manual_reason: existing?.manual_reason || "",
      };

      // 추가 가입이 아닌 경우 모든 보험 처리
      if (!isAdditional) {
        const nationalPensionStatus =
          insuranceResult.nationalPension?.statusCode ||
          (insuranceResult.nationalPension?.required ? "auto_required" : "auto_exempted");
        const healthInsuranceStatus =
          insuranceResult.healthInsurance?.statusCode ||
          (insuranceResult.healthInsurance?.required ? "auto_required" : "auto_exempted");
        const employmentInsuranceStatus =
          insuranceResult.employmentInsurance?.statusCode ||
          (insuranceResult.employmentInsurance?.required ? "auto_required" : "auto_exempted");
        const industrialAccidentStatus =
          insuranceResult.industrialAccident?.statusCode ||
          (insuranceResult.industrialAccident?.required ? "auto_required" : "auto_exempted");

        updateData.national_pension_status = nationalPensionStatus;
        updateData.health_insurance_status = healthInsuranceStatus;
        updateData.employment_insurance_status = employmentInsuranceStatus;
        updateData.industrial_accident_status = industrialAccidentStatus;

        // 🔧 수정된 가입일 설정 (해당 월 기준)
        updateData.national_pension_acquisition_date =
          getAcquisitionDateForInsurance(nationalPensionStatus);
        updateData.health_insurance_acquisition_date =
          getAcquisitionDateForInsurance(healthInsuranceStatus);
        updateData.employment_insurance_acquisition_date =
          getAcquisitionDateForInsurance(employmentInsuranceStatus);
        updateData.industrial_accident_acquisition_date =
          getAcquisitionDateForInsurance(industrialAccidentStatus);
      } else {
        // 추가 가입인 경우 특정 보험만 업데이트 (수정된 가입일 사용)
        if (insuranceTypes.includes("national_pension")) {
          updateData.national_pension_status = "auto_required";
          updateData.national_pension_acquisition_date = acquisitionDate;
        }
        if (insuranceTypes.includes("health_insurance")) {
          updateData.health_insurance_status = "auto_required";
          updateData.health_insurance_acquisition_date = acquisitionDate;
        }
        if (insuranceTypes.includes("employment_insurance")) {
          updateData.employment_insurance_status = "auto_required";
          updateData.employment_insurance_acquisition_date = acquisitionDate;
        }
        if (insuranceTypes.includes("industrial_accident")) {
          updateData.industrial_accident_status = "auto_required";
          updateData.industrial_accident_acquisition_date = acquisitionDate;
        }
      }

      console.log("🔧 최종 업데이트 데이터:", updateData);

      if (existing) {
        const { error: updateError } = await supabase
          .from("insurance_enrollments")
          .update(updateData)
          .eq("enrollment_id", existing.enrollment_id);

        if (updateError) throw updateError;
      } else {
        const insertData = {
          worker_id: parseInt(workerId),
          site_id: selectedSite,
          year_month: yearMonth,
          ...updateData,
          created_at: new Date().toISOString(),
        };

        const { error: insertError } = await supabase
          .from("insurance_enrollments")
          .insert(insertData);

        if (insertError) throw insertError;
      }

      return {
        success: true,
        message: isAdditional
          ? "추가 보험 가입 처리가 완료되었습니다."
          : "보험 가입 처리가 완료되었습니다.",
        insuranceResult,
        acquisitionDate: acquisitionDate, // 🔧 디버깅용 추가
      };
    },
    onSuccess: (data) => {
      console.log("🔧 가입 처리 성공:", data);
      toast.success(data.message);
      queryClient.invalidateQueries({
        queryKey: ["integrated-insurance-data"],
        exact: false,
      });
    },
    onError: (error) => {
      console.error("보험 가입 처리 오류:", error);
      toast.error(`처리 실패: ${error.message}`);
    },
  });

  // 🔥 모든 설정 저장 Mutation (paste-3.txt 기반)
  // 🔧 더 안정적인 saveAllMutation (대안 - 지연된 탭 변경)

  const saveAllMutation = useMutation({
    mutationFn: async () => {
      const yearMonth = `${selectedYear}-${selectedMonth}`;

      const settingsData = prepareAllSettingsData(
        workersData,
        workHistoryData,
        insuranceStatusData,
        selectedSite,
        yearMonth,
        user
      );

      if (settingsData.length === 0) {
        return { success: true, message: "저장할 근로자가 없습니다.", workerCount: 0 };
      }

      console.log("🔧 모든 설정 저장 시작:", {
        근로자수: settingsData.length,
        현장: selectedSite,
        년월: yearMonth,
      });

      let successCount = 0;
      let errorCount = 0;

      // 각 근로자 처리 (기존과 동일)
      const savePromises = settingsData.map(async (settingData) => {
        try {
          // 기존 레코드 확인
          const { data: existingRecord, error: checkError } = await supabase
            .from("insurance_enrollments")
            .select("*")
            .eq("worker_id", settingData.worker_id)
            .eq("site_id", settingData.site_id)
            .eq("year_month", settingData.year_month)
            .maybeSingle();

          if (checkError && checkError.code !== "PGRST116") {
            return { success: false, error: checkError };
          }

          // 🔧 가입일 설정을 해당 월에 맞게 수정
          const getAcquisitionDateForMonth = (yearMonth, status) => {
            if (status === "auto_required" || status === "manual_required") {
              return `${yearMonth}-01`;
            }
            return null;
          };

          const finalData = {
            ...settingData,
            manual_reason: existingRecord?.manual_reason || "",
            national_pension_reported: existingRecord?.national_pension_reported || false,
            health_insurance_reported: existingRecord?.health_insurance_reported || false,
            employment_insurance_reported: existingRecord?.employment_insurance_reported || false,
            industrial_accident_reported: existingRecord?.industrial_accident_reported || false,

            national_pension_acquisition_date: getAcquisitionDateForMonth(
              yearMonth,
              settingData.national_pension_status
            ),
            health_insurance_acquisition_date: getAcquisitionDateForMonth(
              yearMonth,
              settingData.health_insurance_status
            ),
            employment_insurance_acquisition_date: getAcquisitionDateForMonth(
              yearMonth,
              settingData.employment_insurance_status
            ),
            industrial_accident_acquisition_date: getAcquisitionDateForMonth(
              yearMonth,
              settingData.industrial_accident_status
            ),

            national_pension_loss_date: existingRecord?.national_pension_loss_date || null,
            health_insurance_loss_date: existingRecord?.health_insurance_loss_date || null,
            employment_insurance_loss_date: existingRecord?.employment_insurance_loss_date || null,
            industrial_accident_loss_date: existingRecord?.industrial_accident_loss_date || null,
          };

          let result;
          if (existingRecord) {
            result = await supabase
              .from("insurance_enrollments")
              .update(finalData)
              .eq("enrollment_id", existingRecord.enrollment_id);
          } else {
            const insertData = {
              ...finalData,
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

      const results = await Promise.all(savePromises);

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
        workerCount: settingsData.length,
        message:
          errorCount === 0
            ? `${successCount}개의 설정이 저장되었습니다.`
            : successCount === 0
            ? `저장 실패: ${errorCount}개의 오류가 발생했습니다.`
            : `${successCount}개 저장 성공, ${errorCount}개 저장 실패`,
      };
    },
    onSuccess: async (result) => {
      console.log("🔧 모든 설정 저장 성공:", result);

      if (result.success) {
        toast.success(result.message);

        // 🔧 단계별 처리로 안정성 향상
        if (result.workerCount > 0) {
          console.log("🔧 데이터 새로고침 시작...");

          // 1. 먼저 데이터 새로고침
          await queryClient.invalidateQueries({
            queryKey: ["integrated-insurance-data"],
            exact: false,
            refetchType: "all",
          });

          // 2. 약간의 지연 후 탭 변경 (데이터 로딩 완료를 위해)
          setTimeout(() => {
            console.log("🔧 유지중인 근로자 탭으로 자동 이동");
            setActiveTab(1);
            setSelectedWorkerId(null);
            setShowDetail(false);

            // 🔧 추가 안내 메시지
            toast.info("✅ 가입 처리 완료! 유지중인 근로자 탭을 확인하세요.", {
              autoClose: 2000,
            });
          }, 1000); // 1초 지연
        }
      } else if (result.successCount === 0) {
        toast.error(result.message);
      } else {
        toast.warning(result.message);

        // 🔧 부분 성공인 경우에도 탭 변경
        if (result.successCount > 0) {
          setTimeout(() => {
            setActiveTab(1);
          }, 500);
        }
      }
    },
    onError: (error) => {
      console.error("설정 저장 오류:", error);
      toast.error("설정 저장 중 오류가 발생했습니다.");
    },
  });

  // 🔧 추가: 탭 변경 시 자동 스크롤 (선택사항)
  const handleTabChange = useCallback((newTab) => {
    setActiveTab(newTab);
    setSelectedWorkerId(null);
    setShowDetail(false);

    // 🔧 탭 변경 시 상단으로 스크롤
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, []);

  // 보험 상실 처리 Mutation (기존과 동일)
  const lossMutation = useMutation({
    mutationFn: async ({ workerId }) => {
      console.log("🔧 상실처리 시작:", workerId);

      const today = new Date().toISOString().split("T")[0];

      // 1. 기존 가입 정보 확인
      const { data: enrollments, error: fetchError } = await supabase
        .from("insurance_enrollments")
        .select("*")
        .eq("worker_id", workerId)
        .eq("site_id", selectedSite);

      if (fetchError) throw fetchError;

      if (!enrollments || enrollments.length === 0) {
        throw new Error("가입 정보를 찾을 수 없습니다.");
      }

      console.log("🔧 상실처리 대상 가입정보:", enrollments.length, "건");

      // 2. 🔧 중요: 상실일과 상태를 모두 업데이트
      const updates = {
        // 상실일 설정
        national_pension_loss_date: today,
        health_insurance_loss_date: today,
        employment_insurance_loss_date: today,
        industrial_accident_loss_date: today,

        // 🔧 추가: 상태도 함께 업데이트
        national_pension_status: "auto_exempted",
        health_insurance_status: "auto_exempted",
        employment_insurance_status: "auto_exempted",
        industrial_accident_status: "auto_exempted",

        // 기타 메타데이터
        enrollment_status: "terminated", // 🔧 추가: 전체 가입 상태를 종료로 변경
        updated_at: new Date().toISOString(),
      };

      // 3. 모든 관련 레코드 업데이트
      const { error: updateError } = await supabase
        .from("insurance_enrollments")
        .update(updates)
        .eq("worker_id", workerId)
        .eq("site_id", selectedSite);

      if (updateError) throw updateError;

      console.log("🔧 상실처리 완료:", workerId);

      return {
        success: true,
        message: "보험 상실 처리가 완료되었습니다.",
        workerId: workerId,
      };
    },
    onSuccess: (data) => {
      console.log("🔧 상실처리 성공, 데이터 새로고침 시작");
      toast.success(data.message);

      // 🔧 중요: 캐시 무효화를 더 강력하게
      queryClient.invalidateQueries({
        queryKey: ["integrated-insurance-data"],
        exact: false,
        refetchType: "all", // 🔧 추가: 강제 리페치
      });

      // 🔧 추가: 선택된 근로자 초기화 (상세창 닫기)
      setSelectedWorkerId(null);
      setShowDetail(false);
    },
    onError: (error) => {
      console.error("🔧 상실처리 오류:", error);
      toast.error(`처리 실패: ${error.message}`);
    },
  });

  // 가입 취소 처리 Mutation (기존과 동일)
  const cancelEnrollmentMutation = useMutation({
    mutationFn: async ({ workerId, yearMonth }) => {
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
      queryClient.invalidateQueries({ queryKey: ["integrated-insurance-data"] });
    },
    onError: (error) => {
      console.error("가입 취소 처리 오류:", error);
      toast.error(`처리 실패: ${error.message}`);
    },
  });

  // 🚀 이후 기존 함수들 (컴포넌트 내에서 정의된 함수들)
  // 🔧 수정된 isEnrolled 함수 (페이지 컴포넌트 내부에서 교체)

  // 🔧 상실일 확인이 강화된 isEnrolled 함수 (페이지 컴포넌트에서 교체)

  const isEnrolled = useCallback(
    (workerId, siteId, insuranceType) => {
      if (!workerId || !siteId || !enrollmentRecordsData) return false;

      const cacheKey = `${workerId}-${siteId}`;
      const records = enrollmentRecordsData[cacheKey] || [];

      console.log(`🔧 가입 상태 확인: 근로자 ${workerId}, 보험 ${insuranceType}`, {
        레코드수: records.length,
      });

      // 🔧 수정된 로직: 통합 레코드에서 해당 보험의 가입 상태 확인
      return records.some((record) => {
        // 🔧 추가: 전체 가입 상태가 종료된 경우 즉시 false
        if (record.enrollment_status === "terminated") {
          console.log(`  → 종료된 가입 상태로 인해 false`);
          return false;
        }

        // 각 보험별 필드명 매핑
        const fieldMapping = {
          national_pension: {
            acq: "national_pension_acquisition_date",
            loss: "national_pension_loss_date",
            status: "national_pension_status",
          },
          health_insurance: {
            acq: "health_insurance_acquisition_date",
            loss: "health_insurance_loss_date",
            status: "health_insurance_status",
          },
          employment_insurance: {
            acq: "employment_insurance_acquisition_date",
            loss: "employment_insurance_loss_date",
            status: "employment_insurance_status",
          },
          industrial_accident: {
            acq: "industrial_accident_acquisition_date",
            loss: "industrial_accident_loss_date",
            status: "industrial_accident_status",
          },
        };

        const fields = fieldMapping[insuranceType];
        if (!fields) {
          console.warn(`알 수 없는 보험 타입: ${insuranceType}`);
          return false;
        }

        // 🔧 강화된 로직: 3가지 조건을 모두 만족해야 활성 가입으로 간주
        const hasAcquisition = !!record[fields.acq];
        const hasNoLoss = !record[fields.loss]; // 상실일이 없어야 함
        const hasRequiredStatus =
          record[fields.status] === "auto_required" || record[fields.status] === "manual_required";

        // 모든 조건을 만족해야 활성 가입
        const isEnrolledResult = hasAcquisition && hasNoLoss && hasRequiredStatus;

        console.log(`  → ${insuranceType} 결과: ${isEnrolledResult}`, {
          가입일: record[fields.acq],
          상실일: record[fields.loss],
          상태: record[fields.status],
          가입일있음: hasAcquisition,
          상실일없음: hasNoLoss,
          필수상태: hasRequiredStatus,
        });

        return isEnrolledResult;
      });
    },
    [enrollmentRecordsData]
  );

  // 🔥 새로운 함수: 전월 가입 누락 확인 후 가입 처리
  const handleAcquisitionWithWarning = useCallback(
    async (workerId, e, warning) => {
      if (e) e.stopPropagation();

      const yearMonth = `${selectedYear}-${selectedMonth}`;

      if (warning.shouldHaveEnrolledPrevious) {
        // 확인 모달 표시
        setConfirmModal({
          isOpen: true,
          title: "전월 가입 누락 확인",
          message: `${warning.message}\n전월 가입대상자임에도 이번달에 가입처리 하시겠습니까?`,
          onConfirm: () => {
            setConfirmModal({ ...confirmModal, isOpen: false });
            acquisitionMutation.mutate({ workerId, yearMonth });
          },
        });
      } else {
        // 바로 가입 처리
        acquisitionMutation.mutate({ workerId, yearMonth });
      }
    },
    [selectedYear, selectedMonth, acquisitionMutation, confirmModal]
  );

  // 🔥 새로운 함수: 추가 가입 처리
  const handleAdditionalEnrollment = useCallback(
    async (workerId, e) => {
      if (e) e.stopPropagation();

      const yearMonth = `${selectedYear}-${selectedMonth}`;

      // 추가 가입 가능한 보험 유형 확인
      const eligibleInsurances = getEligibleUnEnrolledInsurances(
        workerId,
        selectedSite,
        insuranceStatusData,
        enrollmentRecordsData
      );

      if (eligibleInsurances.length === 0) {
        toast.warning("추가 가입 가능한 보험이 없습니다.");
        return;
      }

      const insuranceTypes = eligibleInsurances.map((ins) => ins.type);

      acquisitionMutation.mutate({
        workerId,
        yearMonth,
        insuranceTypes,
        isAdditional: true,
      });
    },
    [
      selectedYear,
      selectedMonth,
      selectedSite,
      insuranceStatusData,
      enrollmentRecordsData,
      acquisitionMutation,
    ]
  );

  // Handle acquisition (기존 함수 유지)
  const handleAcquisition = useCallback(
    async (workerId, e) => {
      if (e) e.stopPropagation();
      const yearMonth = `${selectedYear}-${selectedMonth}`;
      acquisitionMutation.mutate({ workerId, yearMonth });
    },
    [selectedYear, selectedMonth, acquisitionMutation]
  );

  // Handle loss
  const handleLoss = useCallback(
    async (workerId, e) => {
      if (e) e.stopPropagation();
      lossMutation.mutate({ workerId });
    },
    [lossMutation]
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

  // 🔥 새로운 함수: 모든 설정 저장
  const handleSaveAllSettings = useCallback(async () => {
    if (!selectedSite) {
      toast.warning("현장을 선택해주세요.");
      return;
    }

    const allWorkers = [
      ...(workersData?.registeredWorkers || []),
      ...(workersData?.activeWorkers || []),
      ...(workersData?.inactiveWorkers || []),
    ];

    if (allWorkers.length === 0) {
      toast.warning("저장할 근로자가 없습니다.");
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: "모든 설정 저장",
      message: `총 ${allWorkers.length}명의 근로자 보험 설정을 저장하시겠습니까?`,
      onConfirm: () => {
        setConfirmModal({ ...confirmModal, isOpen: false });
        saveAllMutation.mutate();
      },
    });
  }, [selectedSite, workersData, saveAllMutation, confirmModal]);

  // Get count by insurance type
  const getCountByInsuranceType = useCallback(
    (workers, insuranceType) => {
      if (!workers) return 0;
      return workers.filter((worker) => isEnrolled(worker.worker_id, selectedSite, insuranceType))
        .length;
    },
    [selectedSite, isEnrolled]
  );

  // 행 클릭 및 액션 버튼 클릭 핸들러 (개선됨)
  const handleRowClick = useCallback(
    (workerId) => {
      setSelectedWorkerId(workerId === selectedWorkerId ? null : workerId);
      setShowDetail(workerId !== null && workerId !== selectedWorkerId);
    },
    [selectedWorkerId]
  );

  const handleActionClick = useCallback(
    (workerId, e, action, warning = null) => {
      console.log("handleActionClick 호출됨:", workerId, action);
      e.stopPropagation();

      // 세부 정보창 닫기 - 선택된 근로자 정보 초기화
      setSelectedWorkerId(null);
      setShowDetail(false);

      if (action === "acquire") {
        if (warning) {
          handleAcquisitionWithWarning(workerId, e, warning);
        } else {
          handleAcquisition(workerId, e);
        }
      } else if (action === "additional") {
        handleAdditionalEnrollment(workerId, e);
      } else if (action === "loss") {
        handleLoss(workerId, e);
      } else if (action === "cancel") {
        handleCancelEnrollment(workerId, e);
      }
    },
    [
      handleAcquisition,
      handleAcquisitionWithWarning,
      handleAdditionalEnrollment,
      handleLoss,
      handleCancelEnrollment,
    ]
  );

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

  // 🔥 모달 닫기 함수
  const handleCloseModal = useCallback(() => {
    setConfirmModal({ ...confirmModal, isOpen: false });
  }, [confirmModal]);

  useEffect(() => {
    if (user) {
      initialize(user.id);
    }
  }, [user, initialize]);

  // 현장 또는 연월이 변경될 때 탭 초기화
  useEffect(() => {
    setActiveTab(0);
    setSelectedWorkerId(null);
    setShowDetail(false);

    if (selectedSite) {
      console.log("현장/연월 변경, 통합 쿼리 무효화");
      queryClient.invalidateQueries({
        queryKey: ["integrated-insurance-data"],
        exact: false,
      });
    }
  }, [selectedSite, selectedYear, selectedMonth]);

  // 로딩 상태 계산
  const isLoading =
    acquisitionMutation.isPending ||
    lossMutation.isPending ||
    cancelEnrollmentMutation.isPending ||
    saveAllMutation.isPending ||
    (!!selectedSite && isIntegratedLoading);

  // 메인 렌더링
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

        {/* 🔥 확인 모달 */}
        <ConfirmationModal
          isOpen={confirmModal.isOpen}
          onClose={handleCloseModal}
          onConfirm={confirmModal.onConfirm}
          title={confirmModal.title}
          message={confirmModal.message}
        />

        {/* Header section */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 pl-6 ">4대보험 관리</h1>

          {/* 컨트롤 패널 */}
          <div className="bg-white p-4 rounded-lg shadow-md  print:hidden">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div>
                  <label htmlFor="site-select" className="block text-sm font-medium text-gray-700">
                    현장 선택:
                  </label>
                  <select
                    id="site-select"
                    name="site-select"
                    value={selectedSite || ""}
                    onChange={handleSiteChange}
                    className="mt-1 block w-48 text-sm rounded-md border-2  border-blue-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">현장을 선택하세요</option>
                    {sitesData?.map((site) => (
                      <option key={site.site_id} value={site.site_id}>
                        {site.site_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="year-month" className="block text-sm font-medium text-gray-700">
                    조회 년월:
                  </label>
                  <input
                    type="month"
                    id="year-month"
                    name="year-month"
                    value={`${selectedYear}-${selectedMonth}`}
                    onChange={handleYearMonthChange}
                    max={new Date().toISOString().slice(0, 7)}
                    className="mt-1 block w-40 text-sm rounded-md border  border-blue-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

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
              <h2 className="text-lg font-semibold text-blue-800 mb-2">
                🔥 개선된 4대보험 적용 판단 안내
              </h2>
              <ul className="list-none space-y-1.5 text-sm text-blue-800">
                <li className="flex items-start">
                  <span className="inline-block w-3 h-3 bg-blue-400 rounded-full mt-1.5 mr-2"></span>
                  <span>
                    <strong>국민연금:</strong> 18~60세 + (월급여 220만원 이상 OR
                    1개월경과+누적8일이상 OR 1개월경과+누적60시간이상)
                  </span>
                </li>
                <li className="flex items-start">
                  <span className="inline-block w-3 h-3 bg-blue-400 rounded-full mt-1.5 mr-2"></span>
                  <span>
                    <strong>건강보험:</strong> 1개월 경과 + 누적 60시간 이상 근로
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
                ✅ 상실일 이후 재가입 가능 여부, 전월 가입 누락 확인, 추가 가입 처리 등이
                개선되었습니다.
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
                  // 🎯 성능 최적화: 탭별 컴포넌트 사용
                  if (activeTab === 0) {
                    return (
                      <NewEnrollmentTab
                        workers={workersData?.registeredWorkers}
                        workHistoryData={workHistoryData}
                        insuranceStatusData={insuranceStatusData}
                        selectedSite={selectedSite}
                        selectedYear={selectedYear}
                        selectedMonth={selectedMonth}
                        searchTerm={searchTerm}
                        selectedWorkerId={selectedWorkerId}
                        handleRowClick={handleRowClick}
                        handleActionClick={handleActionClick}
                        getStatusStyle={getStatusStyle}
                        getStatusText={getStatusText}
                        enrollmentRecordsData={enrollmentRecordsData}
                        isEnrolled={isEnrolled}
                      />
                    );
                  } else if (activeTab === 1) {
                    return (
                      <ActiveWorkersTab
                        workers={workersData?.activeWorkers}
                        workHistoryData={workHistoryData}
                        enrollmentRecordsData={enrollmentRecordsData}
                        selectedSite={selectedSite}
                        selectedYear={selectedYear}
                        selectedMonth={selectedMonth}
                        searchTerm={searchTerm}
                        selectedWorkerId={selectedWorkerId}
                        handleRowClick={handleRowClick}
                        handleActionClick={handleActionClick}
                        isEnrolled={isEnrolled}
                        insuranceStatusData={insuranceStatusData}
                        getStatusStyle={getStatusStyle}
                        getStatusText={getStatusText}
                      />
                    );
                  } else {
                    return (
                      <InactiveWorkersTab
                        workers={workersData?.inactiveWorkers}
                        workHistoryData={workHistoryData}
                        enrollmentRecordsData={enrollmentRecordsData}
                        selectedSite={selectedSite}
                        selectedYear={selectedYear}
                        selectedMonth={selectedMonth}
                        searchTerm={searchTerm}
                        selectedWorkerId={selectedWorkerId}
                        handleRowClick={handleRowClick}
                        handleActionClick={handleActionClick}
                        isEnrolled={isEnrolled}
                        insuranceStatusData={insuranceStatusData}
                        getStatusStyle={getStatusStyle}
                        getStatusText={getStatusText}
                      />
                    );
                  }
                })()}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer/Action buttons */}
        <div className="flex justify-between items-center mt-6">
          <div className="text-sm text-gray-600">
            🔥 개선된 보험 관리: 통합 쿼리로{" "}
            {workersData
              ? (workersData.registeredWorkers?.length || 0) +
                (workersData.activeWorkers?.length || 0) +
                (workersData.inactiveWorkers?.length || 0)
              : 0}
            명 처리됨
          </div>
          <div className="flex space-x-4">
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

            {/* 🔥 조건부 "모든 설정 저장" 버튼 - 신규가입 대상자 탭에서만 표시 */}
            {activeTab === 0 && (
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition shadow-sm flex items-center"
                onClick={handleSaveAllSettings}
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
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                {saveAllMutation.isPending ? "저장 중..." : "모든 설정 저장"}
              </button>
            )}

            {/* 🚀 성능 모니터링 버튼 (다른 탭에서는 이 버튼 표시) */}
            {activeTab !== 0 && (
              <button
                className="px-4 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition shadow-sm flex items-center"
                onClick={() => {
                  console.log("🚀 성능 데이터:", {
                    sitesData: sitesData?.length || 0,
                    workersData: workersData ? Object.keys(workersData).length : 0,
                    workHistoryData: Object.keys(workHistoryData || {}).length,
                    insuranceStatusData: Object.keys(insuranceStatusData || {}).length,
                    enrollmentRecordsData: Object.keys(enrollmentRecordsData || {}).length,
                    메모리사용량: performance.memory
                      ? `${Math.round(performance.memory.usedJSHeapSize / 1024 / 1024)}MB`
                      : "측정불가",
                  });
                  toast.info("성능 데이터가 콘솔에 출력되었습니다.");
                }}
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
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                성능 확인
              </button>
            )}
          </div>
        </div>

        {/* 🚀 개선: 에러 및 로딩 상태 표시 */}
        {integratedError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-red-500 mr-2 mt-0.5"
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
                <p className="text-red-800 font-medium">데이터 로드 중 오류가 발생했습니다</p>
                <p className="text-red-700 text-sm mt-1">{integratedError.message}</p>
                <button
                  onClick={() =>
                    queryClient.invalidateQueries({ queryKey: ["integrated-insurance-data"] })
                  }
                  className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                >
                  다시 시도
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast container */}
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
        />
      </div>
    </RoleGuard>
  );
}

export default InsuranceEnrollmentsWithProvider;
