// //react query 사용안한것.

// "use client";
// import React, { useEffect, useState, useMemo, useCallback } from "react";

// import { supabase } from "@/lib/supabase";
// import { useAuthStore } from "@/lib/store/authStore";
// import RoleGuard from "@/components/RoleGuard";
// import { ToastContainer, toast } from "react-toastify";
// import { formatResidentNumber, formatPhoneNumber } from "@/lib/utils/formattingUtils";
// import Link from "next/link";

// // Import all necessary stores directly
// import useSiteStore from "@/lib/store/siteStore";
// import useWorkerStore from "@/lib/store/workerStore";
// import useWorkHistoryStore from "@/lib/store/workHistoryStore";
// import useInsuranceStatusStore from "@/lib/store/insuranceStatusStore";
// import useInsuranceEnrollmentStore from "@/lib/store/insuranceEnrollmentStore";
// import useInsuranceStore from "@/lib/store/useInsuranceStore";
// // import useInsuranceStatusStore from './insuranceStatusStore';
// // import useWorkerStore from './workerStore';
// // 최적화 1: 보험 상태 뱃지를 메모이제이션된 컴포넌트로 분리
// const InsuranceStatusBadge = React.memo(({ status, styleClasses, statusText }) => {
//   return (
//     <span
//       className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${styleClasses}`}
//     >
//       {statusText}
//     </span>
//   );
// });
// // 최적화 2: 근로자 프로필 컴포넌트 분리
// const WorkerProfile = React.memo(({ worker }) => {
//   return (
//     <div className="flex items-center">
//       <div className="flex-shrink-0 h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
//         <span className="text-gray-600 font-medium">
//           {worker.name ? worker.name.charAt(0) : "?"}
//         </span>
//       </div>
//       <div className="ml-4">
//         <div className="text-sm font-medium text-gray-900">{worker.name}</div>
//         <div className="text-sm text-gray-500">{formatResidentNumber(worker.resident_number)}</div>
//         <div className="text-sm text-gray-500 flex items-center mt-1">
//           <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">
//             {worker.jobName || "직종 미지정"}
//           </span>
//           <span className="mx-1">•</span>
//           <span>{worker.age || "?"}세</span>
//         </div>
//       </div>
//     </div>
//   );
// });

// // 최적화 3: 근무 이력 컴포넌트 분리
// const WorkerHistory = React.memo(({ workHistory, isInactiveTab = false }) => {
//   return (
//     <div className="grid grid-cols-2 gap-x-4 gap-y-1">
//       <div className="text-sm">
//         <span className="text-gray-500">전월 근무: </span>
//         <span className="font-medium">{workHistory.previousMonthWorkDays || 0}일</span>
//         <span className="text-gray-400"> / </span>
//         <span className="font-medium">{workHistory.previousMonthWorkHours || 0}시간</span>
//       </div>
//       <div className="text-sm">
//         <span className="text-gray-500">당월 근무: </span>
//         {isInactiveTab ? (
//           <>
//             <span className="font-medium text-red-500">0일</span>
//             <span className="text-gray-400"> / </span>
//             <span className="font-medium text-red-500">0시간</span>
//           </>
//         ) : (
//           <>
//             <span className="font-medium">{workHistory.currentMonthWorkDays || 0}일</span>
//             <span className="text-gray-400"> / </span>
//             <span className="font-medium">{workHistory.currentMonthWorkHours || 0}시간</span>
//           </>
//         )}
//       </div>
//       <div className="text-sm">
//         <span className="text-gray-500">첫 근무일: </span>
//         <span className="font-medium">
//           {workHistory.firstWorkDate
//             ? new Date(workHistory.firstWorkDate).toLocaleDateString()
//             : "기록 없음"}
//         </span>
//       </div>
//       <div className="text-sm">
//         <span className="text-gray-500">당월 급여: </span>
//         {isInactiveTab ? (
//           <span className="font-medium text-red-500">0원</span>
//         ) : (
//           <span className="font-medium">{(workHistory.monthlyWage || 0).toLocaleString()}원</span>
//         )}
//       </div>
//       {isInactiveTab && (
//         <div className="text-sm">
//           <span className="font-medium w-28 font-medium">당월 미등록:</span>
//           <span className="text-red-500 font-medium">상실 대상</span>
//         </div>
//       )}
//     </div>
//   );
// });

// // 최적화 4: 보험 상태 그리드 컴포넌트
// const InsuranceStatusGrid = React.memo(
//   ({
//     workerId,
//     activeTab,
//     insuranceStatusCache,
//     selectedSite,
//     isEnrolled,
//     getStatusStyle,
//     getStatusText,
//   }) => {
//     // 탭에 따라 다른 렌더링
//     if (activeTab === 0) {
//       return (
//         <div className="grid grid-cols-2 gap-2">
//           <div className="text-sm">
//             <span className="text-gray-500">국민연금: </span>
//             <InsuranceStatusBadge
//               status={insuranceStatusCache[workerId]?.nationalPension}
//               styleClasses={getStatusStyle(insuranceStatusCache[workerId]?.nationalPension)}
//               statusText={getStatusText(insuranceStatusCache[workerId]?.nationalPension)}
//             />
//           </div>
//           <div className="text-sm">
//             <span className="text-gray-500">건강보험: </span>
//             <InsuranceStatusBadge
//               status={insuranceStatusCache[workerId]?.healthInsurance}
//               styleClasses={getStatusStyle(insuranceStatusCache[workerId]?.healthInsurance)}
//               statusText={getStatusText(insuranceStatusCache[workerId]?.healthInsurance)}
//             />
//           </div>
//           <div className="text-sm">
//             <span className="text-gray-500">고용보험: </span>
//             <InsuranceStatusBadge
//               status={insuranceStatusCache[workerId]?.employmentInsurance}
//               styleClasses={getStatusStyle(insuranceStatusCache[workerId]?.employmentInsurance)}
//               statusText={getStatusText(insuranceStatusCache[workerId]?.employmentInsurance)}
//             />
//           </div>
//           <div className="text-sm">
//             <span className="text-gray-500">산재보험: </span>
//             <InsuranceStatusBadge
//               status={insuranceStatusCache[workerId]?.industrialAccident}
//               styleClasses={getStatusStyle(insuranceStatusCache[workerId]?.industrialAccident)}
//               statusText={getStatusText(insuranceStatusCache[workerId]?.industrialAccident)}
//             />
//           </div>
//         </div>
//       );
//     } else {
//       // 유지 중인 근로자 및 상실 대상자 탭
//       const isInactiveTab = activeTab === 2;

//       return (
//         <div className="grid grid-cols-2 gap-2">
//           <div className="text-sm">
//             <span className="text-gray-500">국민연금: </span>
//             <span
//               className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
//                 isEnrolled(workerId, selectedSite, "national_pension")
//                   ? isInactiveTab
//                     ? "bg-red-100 text-red-800" // 상실 필요 (가입된 상태)
//                     : "bg-green-100 text-green-800" // 가입 상태
//                   : "bg-red-100 text-red-800" // 미가입 상태 - 빨간색으로 변경
//               }`}
//             >
//               {isInactiveTab
//                 ? isEnrolled(workerId, selectedSite, "national_pension")
//                   ? "상실 필요"
//                   : "미가입"
//                 : isEnrolled(workerId, selectedSite, "national_pension")
//                 ? "가입"
//                 : "미가입"}
//             </span>
//           </div>
//           <div className="text-sm">
//             <span className="text-gray-500">건강보험: </span>
//             <span
//               className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
//                 isEnrolled(workerId, selectedSite, "health_insurance")
//                   ? isInactiveTab
//                     ? "bg-red-100 text-red-800" // 상실 필요 (가입된 상태)
//                     : "bg-green-100 text-green-800" // 가입 상태
//                   : "bg-red-100 text-red-800" // 미가입 상태 - 빨간색으로 변경
//               }`}
//             >
//               {isInactiveTab
//                 ? isEnrolled(workerId, selectedSite, "health_insurance")
//                   ? "상실 필요"
//                   : "미가입"
//                 : isEnrolled(workerId, selectedSite, "health_insurance")
//                 ? "가입"
//                 : "미가입"}
//             </span>
//           </div>
//           <div className="text-sm">
//             <span className="text-gray-500">고용보험: </span>
//             <span
//               className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
//                 isEnrolled(workerId, selectedSite, "employment_insurance")
//                   ? isInactiveTab
//                     ? "bg-red-100 text-red-800" // 상실 필요 (가입된 상태)
//                     : "bg-green-100 text-green-800" // 가입 상태
//                   : "bg-red-100 text-red-800" // 미가입 상태 - 빨간색으로 변경
//               }`}
//             >
//               {isInactiveTab
//                 ? isEnrolled(workerId, selectedSite, "employment_insurance")
//                   ? "상실 필요"
//                   : "미가입"
//                 : isEnrolled(workerId, selectedSite, "employment_insurance")
//                 ? "가입"
//                 : "미가입"}
//             </span>
//           </div>
//           <div className="text-sm">
//             <span className="text-gray-500">산재보험: </span>
//             <span
//               className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
//                 isEnrolled(workerId, selectedSite, "industrial_accident")
//                   ? isInactiveTab
//                     ? "bg-red-100 text-red-800" // 상실 필요 (가입된 상태)
//                     : "bg-green-100 text-green-800" // 가입 상태
//                   : "bg-red-100 text-red-800" // 미가입 상태 - 빨간색으로 변경
//               }`}
//             >
//               {isInactiveTab
//                 ? isEnrolled(workerId, selectedSite, "industrial_accident")
//                   ? "상실 필요"
//                   : "미가입"
//                 : isEnrolled(workerId, selectedSite, "industrial_accident")
//                 ? "가입"
//                 : "미가입"}
//             </span>
//           </div>
//         </div>
//       );
//     }
//   }
// );

// // 최적화 5: 보험 설정 컨트롤 컴포넌트
// const InsuranceControls = React.memo(
//   ({
//     worker,
//     yearMonth,
//     selectedSite,
//     insuranceStatusCache,
//     handleStatusChange,
//     renderInsuranceStatusBadge,
//   }) => {
//     // 각 보험 타입의 상태 값 가져오기
//     const npStatus = insuranceStatusCache[worker.worker_id]?.nationalPension || {};
//     const hiStatus = insuranceStatusCache[worker.worker_id]?.healthInsurance || {};
//     const eiStatus = insuranceStatusCache[worker.worker_id]?.employmentInsurance || {};
//     const iaStatus = insuranceStatusCache[worker.worker_id]?.industrialAccident || {};

//     return (
//       <div className="grid grid-cols-4 md:grid-cols-4 gap-4">
//         {/* 국민연금 */}
//         <div className="border rounded-lg p-4 bg-white">
//           <h5 className="font-medium mb-2">국민연금</h5>
//           <div className="space-y-2 mb-4">
//             <p className="text-sm">
//               <span className="font-medium">현재 상태:</span>{" "}
//               {renderInsuranceStatusBadge(worker.worker_id, "national_pension")}
//             </p>
//             <p className="text-sm">
//               <span className="font-medium">사유:</span> {npStatus?.reason || "자동 판단"}
//             </p>
//           </div>
//           <div className="flex space-x-2">
//             <button
//               onClick={(e) =>
//                 handleStatusChange(worker.worker_id, "national_pension", "manual_required", e)
//               }
//               className={`px-2 py-1 text-xs rounded ${
//                 npStatus?.statusCode === "manual_required"
//                   ? "bg-blue-500 text-white"
//                   : "bg-gray-200 text-gray-700 hover:bg-blue-100"
//               }`}
//             >
//               수동 적용
//             </button>
//             <button
//               onClick={(e) =>
//                 handleStatusChange(worker.worker_id, "national_pension", "manual_exempted", e)
//               }
//               className={`px-2 py-1 text-xs rounded ${
//                 npStatus?.statusCode === "manual_exempted"
//                   ? "bg-blue-500 text-white"
//                   : "bg-gray-200 text-gray-700 hover:bg-blue-100"
//               }`}
//             >
//               수동 제외
//             </button>
//           </div>
//         </div>

//         {/* 건강보험 */}
//         <div className="border rounded-lg p-4 bg-white">
//           <h5 className="font-medium mb-2">건강보험</h5>
//           <div className="space-y-2 mb-4">
//             <p className="text-sm">
//               <span className="font-medium">현재 상태:</span>{" "}
//               {renderInsuranceStatusBadge(worker.worker_id, "health_insurance")}
//             </p>
//             <p className="text-sm">
//               <span className="font-medium">사유:</span> {hiStatus?.reason || "자동 판단"}
//             </p>
//           </div>
//           <div className="flex space-x-2">
//             <button
//               onClick={(e) =>
//                 handleStatusChange(worker.worker_id, "health_insurance", "manual_required", e)
//               }
//               className={`px-2 py-1 text-xs rounded ${
//                 hiStatus?.statusCode === "manual_required"
//                   ? "bg-blue-500 text-white"
//                   : "bg-gray-200 text-gray-700 hover:bg-blue-100"
//               }`}
//             >
//               수동 적용
//             </button>
//             <button
//               onClick={(e) =>
//                 handleStatusChange(worker.worker_id, "health_insurance", "manual_exempted", e)
//               }
//               className={`px-2 py-1 text-xs rounded ${
//                 hiStatus?.statusCode === "manual_exempted"
//                   ? "bg-blue-500 text-white"
//                   : "bg-gray-200 text-gray-700 hover:bg-blue-100"
//               }`}
//             >
//               수동 제외
//             </button>
//           </div>
//         </div>

//         {/* 고용보험 */}
//         <div className="border rounded-lg p-4 bg-white">
//           <h5 className="font-medium mb-2">고용보험</h5>
//           <div className="space-y-2 mb-4">
//             <p className="text-sm">
//               <span className="font-medium">현재 상태:</span>{" "}
//               {renderInsuranceStatusBadge(worker.worker_id, "employment_insurance")}
//             </p>
//             <p className="text-sm">
//               <span className="font-medium">사유:</span>{" "}
//               {eiStatus?.reason || "일용근로자는 근로일수 상관없이 적용"}
//             </p>
//           </div>
//           <div className="flex space-x-2">
//             <button
//               onClick={(e) =>
//                 handleStatusChange(worker.worker_id, "employment_insurance", "manual_required", e)
//               }
//               className={`px-2 py-1 text-xs rounded ${
//                 eiStatus?.statusCode === "manual_required"
//                   ? "bg-blue-500 text-white"
//                   : "bg-gray-200 text-gray-700 hover:bg-blue-100"
//               }`}
//             >
//               수동 적용
//             </button>
//             <button
//               onClick={(e) =>
//                 handleStatusChange(worker.worker_id, "employment_insurance", "manual_exempted", e)
//               }
//               className={`px-2 py-1 text-xs rounded ${
//                 eiStatus?.statusCode === "manual_exempted"
//                   ? "bg-blue-500 text-white"
//                   : "bg-gray-200 text-gray-700 hover:bg-blue-100"
//               }`}
//             >
//               수동 제외
//             </button>
//           </div>
//         </div>

//         {/* 산재보험 */}
//         <div className="border rounded-lg p-4 bg-white">
//           <h5 className="font-medium mb-2">산재보험</h5>
//           <div className="space-y-2 mb-4">
//             <p className="text-sm">
//               <span className="font-medium">현재 상태:</span>{" "}
//               {renderInsuranceStatusBadge(worker.worker_id, "industrial_accident")}
//             </p>
//             <p className="text-sm">
//               <span className="font-medium">사유:</span>{" "}
//               {iaStatus?.reason || "모든 근로자 당연 적용"}
//             </p>
//           </div>
//           <div className="flex space-x-2">
//             <button
//               className="px-2 py-1 text-xs rounded bg-blue-500 text-white cursor-not-allowed"
//               disabled
//             >
//               항상 적용
//             </button>
//           </div>
//         </div>
//       </div>
//     );
//   }
// );

// // 메인 컴포넌트
// function InsuranceEnrollmentsPage() {
//   // Auth state
//   const user = useAuthStore((state) => state.user);

//   // UI state
//   const [searchTerm, setSearchTerm] = useState("");
//   const [activeTab, setActiveTab] = useState(0);
//   const [isLoading, setIsLoading] = useState(false);
//   const [dataLoaded, setDataLoaded] = useState(false); // 새로 추가: 데이터 로드 완료 상태

//   // Date selection state
//   const currentYear = new Date().getFullYear().toString();
//   const currentMonth = (new Date().getMonth() + 1).toString().padStart(2, "0");
//   const [selectedYear, setSelectedYear] = useState(currentYear);
//   const [selectedMonth, setSelectedMonth] = useState(currentMonth);
//   const [currentMonthEnrolledWorkers, setCurrentMonthEnrolledWorkers] = useState([]);
//   // Get state from site store using Zustand hooks
//   const sites = useSiteStore((state) => state.sites);
//   const selectedSite = useSiteStore((state) => state.selectedSite);
//   const setSelectedSite = useSiteStore((state) => state.setSelectedSite);
//   const companyName = useSiteStore((state) => state.companyName);

//   // Get state from worker store using Zustand hooks
//   // Get state from worker store - direct property access
//   const registeredWorkers = useWorkerStore((state) => state.registeredWorkers);
//   const activeWorkers = useWorkerStore((state) => state.activeWorkers);
//   const inactiveWorkers = useWorkerStore((state) => state.inactiveWorkers);
//   const selectedWorkerId = useWorkerStore((state) => state.selectedWorkerId);
//   const showDetail = useWorkerStore((state) => state.showDetail);
//   const setSelectedWorkerId = useWorkerStore((state) => state.setSelectedWorkerId);
//   const loadWorkers = useWorkerStore((state) => state.loadWorkers);
//   // Get state from work history store using Zustand hooks
//   // Get state from work history store - direct property access
//   const workersHistory = useWorkHistoryStore((state) => state.workersHistory);

//   // Get state from insurance status store - direct property access
//   const manualSettings = useInsuranceStatusStore((state) => state.manualSettings);
//   const getStatusStyle = useInsuranceStatusStore((state) => state.getStatusStyle);
//   const getStatusText = useInsuranceStatusStore((state) => state.getStatusText);
//   const updateInsuranceStatusUI = useInsuranceStatusStore((state) => state.updateInsuranceStatusUI);
//   const clearError = useInsuranceStatusStore((state) => state.clearError);

//   // Get state from insurance enrollment store using Zustand hooks
//   // Get state from insurance enrollment store - direct property access
//   const isEnrolled = useInsuranceEnrollmentStore((state) => state.isEnrolled);
//   const enrollmentRecords = useInsuranceEnrollmentStore((state) => state.enrollmentRecords);
//   const handleInsuranceAcquisition = useInsuranceEnrollmentStore(
//     (state) => state.handleInsuranceAcquisition
//   );

//   const insuranceEnrollmentStore = useInsuranceEnrollmentStore.getState;
//   const handleInsuranceLoss = useInsuranceEnrollmentStore((state) => state.handleInsuranceLoss);
//   const loadInsuranceEnrollments = useInsuranceEnrollmentStore(
//     (state) => state.loadInsuranceEnrollments
//   );

//   // Handle insurance operations from insurance store using Zustand hooks
//   // Handle insurance operations from insurance store - direct property access
//   const initialize = useInsuranceStore((state) => state.initialize);

//   // 최적화: 보험 상태 결과 캐싱
//   const insuranceStatusCache = useMemo(() => {
//     if (!selectedSite || !selectedYear || !selectedMonth || !dataLoaded) return {}; // 데이터 로드 여부 확인 추가

//     const yearMonth = `${selectedYear}-${selectedMonth}`;
//     const result = {};

//     // 모든 근로자 목록 통합
//     const allWorkers = [];
//     const addedWorkerIds = new Set();

//     // 1. 신규 가입 대상자 추가
//     if (registeredWorkers && registeredWorkers.length > 0) {
//       registeredWorkers.forEach((worker) => {
//         if (!addedWorkerIds.has(worker.worker_id)) {
//           allWorkers.push(worker);
//           addedWorkerIds.add(worker.worker_id);
//         }
//       });
//     }

//     // 2. 활성 근로자 추가
//     if (activeWorkers && activeWorkers.length > 0) {
//       activeWorkers.forEach((worker) => {
//         if (!addedWorkerIds.has(worker.worker_id)) {
//           allWorkers.push(worker);
//           addedWorkerIds.add(worker.worker_id);
//         }
//       });
//     }

//     // 3. 상실 대상자 추가
//     if (inactiveWorkers && inactiveWorkers.length > 0) {
//       inactiveWorkers.forEach((worker) => {
//         if (!addedWorkerIds.has(worker.worker_id)) {
//           allWorkers.push(worker);
//           addedWorkerIds.add(worker.worker_id);
//         }
//       });
//     }

//     // 각 근로자의 모든 보험 상태를 계산하고 캐싱
//     const statusStore = useInsuranceStatusStore.getState();

//     addedWorkerIds.forEach((workerId) => {
//       // 일괄 처리 (모든 보험 상태를 한 번에 계산)
//       const cacheKey = `${workerId}-${selectedSite}-${yearMonth}`;
//       const statusData = statusStore.insuranceStatus[cacheKey];

//       if (statusData) {
//         // 이미 계산된 상태가 있으면 사용
//         result[workerId] = {
//           nationalPension: statusData.nationalPension,
//           healthInsurance: statusData.healthInsurance,
//           employmentInsurance: statusData.employmentInsurance,
//           industrialAccident: statusData.industrialAccident,
//         };
//       } else {
//         // 필요한 경우에만 계산 (나중에 useEffect에서 로드됨)
//         result[workerId] = {
//           nationalPension: null,
//           healthInsurance: null,
//           employmentInsurance: null,
//           industrialAccident: null,
//         };
//       }
//     });

//     return result;
//   }, [
//     registeredWorkers,
//     activeWorkers,
//     inactiveWorkers,
//     selectedSite,
//     selectedYear,
//     selectedMonth,
//     dataLoaded, // 데이터 로드 여부 의존성 추가
//   ]);

//   // Initialize stores when component mounts
//   // 1. 사용자 인증 후 초기화
//   useEffect(() => {
//     if (user) {
//       setIsLoading(true);
//       initialize(user.id)
//         .then(() => setIsLoading(false))
//         .catch((error) => {
//           console.error("초기화 오류:", error);
//           setIsLoading(false);
//         });
//     }
//   }, [user, initialize]);

//   // 2. 현장 및 모든 데이타 초기화
//   useEffect(() => {
//     // 컴포넌트가 마운트될 때의 동작 (현재 코드)

//     // 컴포넌트가 언마운트될 때의 정리 함수
//     return () => {
//       // 모든 관련 스토어 초기화
//       useSiteStore.getState().resetStore();
//       useWorkerStore.getState().resetStore();
//       // useWorkHistoryStore.getState().resetStore();
//       // useInsuranceStatusStore.getState().resetStore();
//       // useInsuranceEnrollmentStore.getState().resetStore();

//       // 또는 통합 스토어를 사용하는 경우 아래와 같이 호출
//       // useInsuranceStore.getState().resetStore();
//     };
//   }, []); // 빈 의존성 배열은 컴포넌트 마운트/언마운트 시에만 실행됨을 의미

//   // 2. 현장 또는 날짜 변경 시 근로자 목록 로드 - 수정된 부분
//   useEffect(() => {
//     const refreshData = async () => {
//       if (selectedSite && selectedYear && selectedMonth) {
//         setDataLoaded(false); // 데이터 로드 시작 시 상태 초기화
//         setIsLoading(true); // 로딩 상태 활성화
//         const yearMonth = `${selectedYear}-${selectedMonth}`;
//         console.log("Refreshing data on mount/visibility...");

//         try {
//           // 먼저 근로자 목록 로드
//           await loadWorkers(selectedSite, yearMonth);

//           // 잠시 기다려서 근로자 데이터가 상태에 업데이트될 시간을 줌
//           await new Promise((resolve) => setTimeout(resolve, 100));

//           // 근로자 데이터 로드 후 모든 근로자의 정보 처리
//           const workerStore = useWorkerStore.getState();

//           // 모든 근로자 유형에서 고유 ID 목록 생성
//           const allWorkerIds = [
//             ...(workerStore.registeredWorkers || []).map((w) => w.worker_id),
//             ...(workerStore.activeWorkers || []).map((w) => w.worker_id),
//             ...(workerStore.inactiveWorkers || []).map((w) => w.worker_id),
//           ].filter((id, index, self) => self.indexOf(id) === index);

//           if (allWorkerIds.length > 0) {
//             console.log(`Loading data for ${allWorkerIds.length} workers...`);

//             const workHistoryStore = useWorkHistoryStore.getState();
//             const insuranceStatusStore = useInsuranceStatusStore.getState();
//             const insuranceEnrollmentStore = useInsuranceEnrollmentStore.getState();

//             // 모든 근로자의 데이터를 병렬로 로드
//             const promises = allWorkerIds.map((workerId) => {
//               return Promise.all([
//                 // 작업 이력 로드
//                 workHistoryStore.loadWorkersHistory(workerId, selectedSite, yearMonth),
//                 // 보험 상태 로드
//                 insuranceStatusStore.loadInsuranceStatus(workerId, selectedSite, yearMonth),
//                 // 보험 가입 정보 로드
//                 insuranceEnrollmentStore.loadInsuranceEnrollments(workerId, selectedSite),
//               ]);
//             });

//             // 모든 데이터 로드 완료 대기
//             await Promise.all(promises);
//             console.log("All worker data loaded successfully");

//             // 데이터 로드 완료 상태 설정
//             setDataLoaded(true);
//           }
//         } catch (error) {
//           console.error("데이터 로드 중 오류 발생:", error);
//           toast.error("데이터를 불러오는 중 오류가 발생했습니다.");
//         } finally {
//           // 작업 완료 후 로딩 상태 비활성화
//           setIsLoading(false);
//         }
//       }
//     };

//     refreshData();
//   }, [selectedSite, selectedYear, selectedMonth, loadWorkers]);
//   // 선택된 근로자에 대한 상세 정보 및 보험 상태 로드
//   useEffect(() => {
//     if (selectedWorkerId && selectedSite && dataLoaded) {
//       // dataLoaded 의존성 추가
//       setIsLoading(true);
//       const yearMonth = `${selectedYear}-${selectedMonth}`;

//       // 모든 필요한 데이터 병렬로 로드
//       const workerStore = useWorkerStore.getState();
//       const insuranceStatusStore = useInsuranceStatusStore.getState();
//       const workHistoryStore = useWorkHistoryStore.getState();
//       const insuranceEnrollmentStore = useInsuranceEnrollmentStore.getState();

//       Promise.all([
//         // 근로자 상세 정보 로드 (필요한 경우)
//         workerStore.fetchWorkerDetails(selectedWorkerId),

//         // 보험 상태 정보 로드
//         insuranceStatusStore.loadInsuranceStatus(selectedWorkerId, selectedSite, yearMonth),

//         // 근로자 이력 데이터 로드
//         workHistoryStore.loadWorkersHistory(selectedWorkerId, selectedSite, yearMonth),

//         // 보험 가입 이력 로드
//         insuranceEnrollmentStore.loadInsuranceEnrollments(selectedWorkerId, selectedSite),
//       ])
//         .catch((error) => console.error("근로자 정보 로드 오류:", error))
//         .finally(() => setIsLoading(false));
//     }
//   }, [selectedWorkerId, selectedSite, selectedYear, selectedMonth, dataLoaded]);

//   // Handle site selection change
//   const handleSiteChange = (e) => {
//     setSelectedSite(e.target.value);
//   };

//   // Handle year and month change
//   const handleYearMonthChange = (e) => {
//     const [year, month] = e.target.value.split("-");
//     setSelectedYear(year);
//     setSelectedMonth(month);
//   };

//   // Handle search
//   const handleSearch = (e) => {
//     setSearchTerm(e.target.value);
//   };

//   // Filter workers based on search term - 메모이제이션
//   const filterWorkers = useCallback(
//     (workers) => {
//       if (!searchTerm || !workers) return workers || [];
//       return workers.filter(
//         (worker) =>
//           worker.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
//           worker.resident_number.includes(searchTerm)
//       );
//     },
//     [searchTerm]
//   );

//   /**
//    *
//    */
//   // This function should be added to your main component
//   const getEnrollmentDate = useCallback(
//     (workerId) => {
//       if (!workerId || !selectedSite || !enrollmentRecords) return null;

//       const cacheKey = `${workerId}-${selectedSite}`;
//       const enrollments = enrollmentRecords[cacheKey] || [];

//       // Find the newest acquisition date
//       let latestEnrollmentMonth = null;

//       for (const enrollment of enrollments) {
//         // Look for any acquisition date fields
//         const fields = [
//           "national_pension_acquisition_date",
//           "health_insurance_acquisition_date",
//           "employment_insurance_acquisition_date",
//           "industrial_accident_acquisition_date",
//         ];

//         for (const field of fields) {
//           if (enrollment[field]) {
//             const enrollmentDate = enrollment[field].substring(0, 7); // YYYY-MM

//             // Keep the most recent month
//             if (!latestEnrollmentMonth || enrollmentDate > latestEnrollmentMonth) {
//               latestEnrollmentMonth = enrollmentDate;
//             }
//           }
//         }

//         // Also check year_month field if present
//         if (enrollment.year_month) {
//           if (!latestEnrollmentMonth || enrollment.year_month > latestEnrollmentMonth) {
//             latestEnrollmentMonth = enrollment.year_month;
//           }
//         }
//       }

//       return latestEnrollmentMonth;
//     },
//     [selectedSite, enrollmentRecords]
//   );
//   /**
//    *
//    */
//   // Handle acquisition with toast feedback - useCallback으로 최적화
//   // handleAcquisition 함수 수정
//   const handleAcquisition = useCallback(
//     async (workerId, e) => {
//       if (e) e.stopPropagation();
//       console.log("가입 처리 시작:", workerId, selectedSite, `${selectedYear}-${selectedMonth}`);

//       setIsLoading(true);
//       try {
//         const yearMonth = `${selectedYear}-${selectedMonth}`;
//         console.log("보험 가입 함수 호출 직전:", { workerId, selectedSite, yearMonth });

//         // 보험 가입 처리 (이제 상태를 confirmed로 설정하도록 수정됨)
//         const result = await insuranceEnrollmentStore().handleInsuranceAcquisition(
//           workerId,
//           selectedSite,
//           yearMonth,
//           ["national_pension", "health_insurance", "employment_insurance", "industrial_accident"]
//         );

//         console.log("보험 가입 결과:", result);

//         if (result.success) {
//           toast.success("보험 가입 처리가 완료되었습니다.");

//           console.log("UI 갱신 시작");

//           // 모든 관련 캐시 초기화
//           try {
//             // 보험 상태 스토어의 캐시 초기화 - 수정된 부분
//             const statusCacheKey = `${workerId}-${selectedSite}-${yearMonth}`;
//             useInsuranceStatusStore.setState((state) => ({
//               ...state,
//               insuranceStatus: { ...state.insuranceStatus, [statusCacheKey]: undefined },
//             }));

//             // 근로자 이력 스토어의 캐시 초기화 - 수정된 부분
//             const historyKey = `${workerId}-${selectedSite}-${yearMonth}`;
//             useWorkHistoryStore.setState((state) => ({
//               ...state,
//               workersHistory: { ...state.workersHistory, [historyKey]: undefined },
//             }));

//             console.log("캐시 초기화 완료");
//           } catch (cacheError) {
//             console.error("캐시 초기화 오류:", cacheError);
//           }

//           // 전체 데이터 다시 로드
//           console.log("데이터 다시 로드 시작");
//           await loadWorkers(selectedSite, yearMonth);
//           console.log("데이터 로드 완료");

//           // 약간의 지연 후 탭 변경 (UI에 반영될 시간 제공)
//           setTimeout(() => {
//             // 탭 변경 - "유지 중인 근로자" 탭으로 이동
//             setActiveTab(1);
//             console.log("탭 변경 완료 - 유지 중인 근로자 탭으로 이동");

//             // 한 번 더 데이터 로드 (탭 변경 후)
//             loadWorkers(selectedSite, yearMonth);
//           }, 500);
//         } else {
//           toast.error(result.message);
//         }
//       } catch (error) {
//         console.error("보험 가입 처리 상세 오류:", error);
//         toast.error(`처리 실패: ${error.message}`);
//       } finally {
//         setIsLoading(false);
//       }
//     },
//     [selectedYear, selectedMonth, selectedSite, loadWorkers, setActiveTab, insuranceEnrollmentStore]
//   );

//   // Handle loss with toast feedback - useCallback으로 최적화
//   const handleLoss = useCallback(
//     async (workerId, e) => {
//       if (e) e.stopPropagation();

//       setIsLoading(true);
//       try {
//         // Get the current date in YYYY-MM-DD format for the loss date
//         const today = new Date().toISOString().split("T")[0];
//         const yearMonth = `${selectedYear}-${selectedMonth}`;

//         // Get the enrollment record first
//         const { data: enrollments, error: fetchError } = await supabase
//           .from("insurance_enrollments")
//           .select("*")
//           .eq("worker_id", workerId)
//           .eq("site_id", selectedSite)
//           .eq("year_month", yearMonth)
//           .is("national_pension_loss_date", null);

//         if (fetchError) throw fetchError;

//         if (!enrollments || enrollments.length === 0) {
//           throw new Error("가입 정보를 찾을 수 없습니다.");
//         }

//         // Update with explicit field updates
//         const updates = {
//           national_pension_loss_date: today,
//           health_insurance_loss_date: today,
//           employment_insurance_loss_date: today,
//           industrial_accident_loss_date: today,
//           updated_at: new Date().toISOString(),
//         };

//         const { error: updateError } = await supabase
//           .from("insurance_enrollments")
//           .update(updates)
//           .eq("worker_id", workerId)
//           .eq("site_id", selectedSite);

//         if (updateError) throw updateError;

//         // Refresh the data after successful update - getState()는 유지(여기서는 상태를 가져오기만 함)
//         const insuranceEnrollmentStoreInstance = useInsuranceEnrollmentStore.getState();
//         await insuranceEnrollmentStoreInstance.loadInsuranceEnrollments(workerId, selectedSite);

//         // Reload all worker data
//         await loadWorkers(selectedSite, yearMonth);

//         toast.success("보험 상실 처리가 완료되었습니다.");
//       } catch (error) {
//         console.error("보험 상실 처리 오류:", error);
//         toast.error(`처리 실패: ${error.message}`);
//       } finally {
//         setIsLoading(false);
//       }
//     },
//     [selectedSite, selectedYear, selectedMonth, loadWorkers]
//   );
//   // Handle status change - useCallback으로 최적화
//   const handleStatusChange = useCallback(
//     async (workerId, insuranceType, newStatus, e) => {
//       if (e) e.stopPropagation();

//       setIsLoading(true);
//       try {
//         // 올바른 함수 호출 - 새로운 UI 전용 함수 사용
//         const yearMonth = `${selectedYear}-${selectedMonth}`;
//         const result = await updateInsuranceStatusUI(
//           workerId,
//           selectedSite,
//           yearMonth,
//           insuranceType,
//           newStatus
//         );

//         if (result.success) {
//           toast.info(
//             `${getInsuranceTypeName(
//               insuranceType
//             )} 상태가 변경되었습니다. 저장 버튼을 클릭하여 변경사항을 저장하세요.`
//           );
//           return true;
//         } else {
//           toast.error(`상태 변경 실패: ${result.message}`);
//           return false;
//         }
//       } catch (error) {
//         console.error(`상태 변경 중 오류 발생:`, error);
//         toast.error(`상태 변경 중 오류: ${error.message}`);
//         return false;
//       } finally {
//         setIsLoading(false);
//       }
//     },
//     [selectedYear, selectedMonth, selectedSite, updateInsuranceStatusUI]
//   );

//   const handleCancelEnrollment = useCallback(
//     async (workerId, e) => {
//       if (e) e.stopPropagation();

//       setIsLoading(true);
//       try {
//         const yearMonth = `${selectedYear}-${selectedMonth}`;

//         // Delete the enrollment record completely
//         const { error } = await supabase
//           .from("insurance_enrollments")
//           .delete()
//           .eq("worker_id", workerId)
//           .eq("site_id", selectedSite)
//           .eq("year_month", yearMonth);

//         if (error) throw error;

//         // Refresh the data
//         toast.success("가입 처리가 취소되었습니다.");

//         // Reload workers to update UI
//         await loadWorkers(selectedSite, yearMonth);

//         // Move back to the first tab
//         setActiveTab(0);
//       } catch (error) {
//         console.error("가입 취소 처리 오류:", error);
//         toast.error(`처리 실패: ${error.message}`);
//       } finally {
//         setIsLoading(false);
//       }
//     },
//     [selectedSite, selectedYear, selectedMonth, loadWorkers, setActiveTab]
//   );
//   // 보험 유형 이름 반환 함수 추가 - 메모이제이션
//   const getInsuranceTypeName = useCallback((insuranceType) => {
//     switch (insuranceType) {
//       case "national_pension":
//         return "국민연금";
//       case "health_insurance":
//         return "건강보험";
//       case "employment_insurance":
//         return "고용보험";
//       case "industrial_accident":
//         return "산재보험";
//       default:
//         return insuranceType;
//     }
//   }, []);

//   // 수동 사유 업데이트 - useCallback으로 최적화
//   const handleReason = useCallback(
//     (workerId, reason, e) => {
//       if (e) e.stopPropagation();

//       try {
//         const yearMonth = `${selectedYear}-${selectedMonth}`;
//         const insuranceStatusStore = useInsuranceStatusStore.getState();

//         // 올바른 함수 호출
//         insuranceStatusStore.updateManualReason(workerId, selectedSite, yearMonth, reason);

//         toast.info("사유가 변경되었습니다. 저장 버튼을 클릭하여 변경사항을 저장하세요.");
//         return true;
//       } catch (error) {
//         console.error(`사유 업데이트 중 오류 발생:`, error);
//         toast.error(`사유 업데이트 중 오류: ${error.message}`);
//         return false;
//       }
//     },
//     [selectedYear, selectedMonth, selectedSite]
//   );

//   // 모든 설정 저장 처리 함수 - useCallback으로 최적화
//   const handleSaveAll = useCallback(async () => {
//     try {
//       setIsLoading(true);
//       toast.info("설정 저장 중...", { autoClose: false, toastId: "saving" });

//       // 현재 년/월
//       const yearMonth = `${selectedYear}-${selectedMonth}`;

//       // 모든 수동 설정 및 근무 기록 데이터 가져오기
//       const insuranceStatusStore = useInsuranceStatusStore.getState();
//       const workerHistoryData = useWorkHistoryStore.getState().workersHistory;

//       // 모든 근로자 ID 목록 생성 (중복 제거)
//       const allWorkerIds = [
//         ...(registeredWorkers || []).map((w) => w.worker_id),
//         ...(activeWorkers || []).map((w) => w.worker_id),
//         ...(inactiveWorkers || []).map((w) => w.worker_id),
//       ].filter((id, index, self) => self.indexOf(id) === index);

//       if (allWorkerIds.length === 0) {
//         toast.info("저장할 근로자가 없습니다.");
//         toast.dismiss("saving");
//         setIsLoading(false);
//         return;
//       }

//       // 결과 추적
//       let successCount = 0;
//       let errorCount = 0;

//       // 각 근로자 처리 (병렬 처리로 변경)
//       const savePromises = allWorkerIds.map(async (workerId) => {
//         try {
//           // 캐시 키 생성
//           const cacheKey = `${workerId}-${selectedSite}-${yearMonth}`;

//           // 현재 상태 가져오기
//           const insuranceStatus = insuranceStatusStore.insuranceStatus[cacheKey];

//           // 각 보험에 대한 상태값 결정
//           // 이제 insurance_enrollments 테이블에서 직접 각 보험의 상태를 조회
//           const { data: existingRecord, error: checkError } = await supabase
//             .from("insurance_enrollments")
//             .select("*")
//             .eq("worker_id", workerId)
//             .eq("site_id", selectedSite)
//             .eq("year_month", yearMonth)
//             .maybeSingle();

//           // DB 조회 오류 처리
//           if (checkError && checkError.code !== "PGRST116") {
//             console.error(`레코드 확인 오류:`, checkError);
//             return { success: false, error: checkError };
//           }

//           // 근무 이력 가져오기
//           const workHistory = workerHistoryData[cacheKey] || {};

//           // 각 보험 타입별 상태값 결정 (기존 값 유지 또는 자동 판단)
//           const nationalPensionStatus =
//             existingRecord?.national_pension_status ||
//             (insuranceStatus?.nationalPension?.required ? "auto_required" : "auto_exempted");

//           const healthInsuranceStatus =
//             existingRecord?.health_insurance_status ||
//             (insuranceStatus?.healthInsurance?.required ? "auto_required" : "auto_exempted");

//           const employmentInsuranceStatus =
//             existingRecord?.employment_insurance_status ||
//             (insuranceStatus?.employmentInsurance?.required ? "auto_required" : "auto_exempted");

//           const industrialAccidentStatus =
//             existingRecord?.industrial_accident_status ||
//             (insuranceStatus?.industrialAccident?.required ? "auto_required" : "auto_exempted");

//           // 저장할 데이터 준비
//           const settingsToSave = {
//             worker_id: parseInt(workerId),
//             site_id: selectedSite,
//             year_month: yearMonth,

//             // 보험 상태 필드
//             national_pension_status: nationalPensionStatus,
//             health_insurance_status: healthInsuranceStatus,
//             employment_insurance_status: employmentInsuranceStatus,
//             industrial_accident_status: industrialAccidentStatus,

//             // 근무 정보 필드
//             first_work_date: workHistory.firstWorkDate || null,
//             previous_month_work_days: workHistory.previousMonthWorkDays || 0,
//             previous_month_work_hours: workHistory.previousMonthWorkHours || 0,
//             current_month_work_days: workHistory.currentMonthWorkDays || 0,
//             current_month_work_hours: workHistory.currentMonthWorkHours || 0,

//             // 수동 사유는 기존 값 유지
//             manual_reason: existingRecord?.manual_reason || "",

//             // 사용자 확정 정보
//             enrollment_status: "confirmed", // 사용자 확정 상태로 변경
//             user_confirmed: true, // 사용자 확정 표시
//             user_confirmed_at: new Date().toISOString(), // 확정 시간 기록
//             confirmed_by: user?.id || null, // 확정한 사용자 ID

//             // 기타 상태 값은 기존 값 유지
//             national_pension_reported: existingRecord?.national_pension_reported || false,
//             health_insurance_reported: existingRecord?.health_insurance_reported || false,
//             employment_insurance_reported: existingRecord?.employment_insurance_reported || false,
//             industrial_accident_reported: existingRecord?.industrial_accident_reported || false,

//             national_pension_acquisition_date:
//               existingRecord?.national_pension_acquisition_date || null,
//             health_insurance_acquisition_date:
//               existingRecord?.health_insurance_acquisition_date || null,
//             employment_insurance_acquisition_date:
//               existingRecord?.employment_insurance_acquisition_date || null,
//             industrial_accident_acquisition_date:
//               existingRecord?.industrial_accident_acquisition_date || null,

//             national_pension_loss_date: existingRecord?.national_pension_loss_date || null,
//             health_insurance_loss_date: existingRecord?.health_insurance_loss_date || null,
//             employment_insurance_loss_date: existingRecord?.employment_insurance_loss_date || null,
//             industrial_accident_loss_date: existingRecord?.industrial_accident_loss_date || null,

//             // 시스템 필드
//             updated_at: new Date().toISOString(),
//           };

//           let result;
//           if (existingRecord) {
//             // 기존 레코드 업데이트
//             result = await supabase
//               .from("insurance_enrollments")
//               .update(settingsToSave)
//               .eq("enrollment_id", existingRecord.enrollment_id);
//           } else {
//             // 새 레코드 추가
//             const insertData = {
//               ...settingsToSave,
//               created_at: new Date().toISOString(),
//             };
//             result = await supabase.from("insurance_enrollments").insert(insertData);
//           }

//           if (result.error) {
//             return { success: false, error: result.error };
//           } else {
//             return { success: true };
//           }
//         } catch (error) {
//           return { success: false, error };
//         }
//       });

//       // 모든 작업 완료 기다리기
//       const results = await Promise.all(savePromises);

//       // 결과 처리
//       results.forEach((result) => {
//         if (result.success) {
//           successCount++;
//         } else {
//           errorCount++;
//         }
//       });

//       // 토스트 닫기
//       toast.dismiss("saving");

//       // 결과 표시
//       if (errorCount === 0) {
//         toast.success(`${successCount}개의 설정이 저장되었습니다.`);
//       } else if (successCount === 0) {
//         toast.error(`저장 실패: ${errorCount}개의 오류가 발생했습니다.`);
//       } else {
//         toast.warning(`${successCount}개 저장 성공, ${errorCount}개 저장 실패`);
//       }

//       // 데이터 다시 로드
//       const yearMonthStr = `${selectedYear}-${selectedMonth}`;
//       loadWorkers(selectedSite, yearMonthStr);

//       // 오류 초기화
//       clearError();
//     } catch (error) {
//       console.error("설정 저장 오류:", error);
//       toast.error("설정 저장 중 오류가 발생했습니다.");
//     } finally {
//       setIsLoading(false);
//     }
//   }, [
//     selectedYear,
//     selectedMonth,
//     selectedSite,
//     registeredWorkers,
//     activeWorkers,
//     inactiveWorkers,
//     user,
//     loadWorkers,
//     clearError,
//   ]);

//   // Get count by insurance type - 메모이제이션
//   const getCountByInsuranceType = useCallback(
//     (workers, insuranceType) => {
//       if (!workers) return 0;
//       return workers.filter((worker) => isEnrolled(worker.worker_id, selectedSite, insuranceType))
//         .length;
//     },
//     [selectedSite, isEnrolled]
//   );

//   // Get manual setting reason
//   const getManualReason = useCallback(
//     (workerId) => {
//       const key = `${workerId}-${selectedSite}`;
//       return manualSettings[key]?.manual_reason || "";
//     },
//     [selectedSite, manualSettings]
//   );

//   // 최적화된 renderInsuranceStatusBadge 함수
//   const renderInsuranceStatusBadge = useCallback(
//     (workerId, insuranceType) => {
//       if (!workerId || !selectedSite) {
//         return (
//           <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
//             정보 없음
//           </span>
//         );
//       }

//       const yearMonth = `${selectedYear}-${selectedMonth}`;

//       // 캐싱된 상태 사용
//       const status =
//         insuranceStatusCache[workerId]?.[
//           insuranceType === "national_pension"
//             ? "nationalPension"
//             : insuranceType === "health_insurance"
//             ? "healthInsurance"
//             : insuranceType === "employment_insurance"
//             ? "employmentInsurance"
//             : "industrialAccident"
//         ];

//       // 탭에 따라 다른 로직 적용
//       if (activeTab === 0) {
//         // 신규 대상자 탭
//         // 스타일 및 텍스트 가져오기
//         const styleClasses = getStatusStyle(status);
//         const statusText = getStatusText(status);

//         return (
//           <span
//             className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${styleClasses}`}
//           >
//             {statusText}
//           </span>
//         );
//       } else {
//         // 유지 중인 근로자 및 상실 대상자 탭 - 실제 가입 상태 표시
//         const enrolled = isEnrolled(workerId, selectedSite, insuranceType);

//         // 상실 탭에서 "상실 필요" 상태 표시
//         if (activeTab === 2 && enrolled) {
//           return (
//             <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
//               상실 필요
//             </span>
//           );
//         }

//         return (
//           <span
//             className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
//               enrolled ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
//             }`}
//           >
//             {enrolled ? "가입" : "미가입"}
//           </span>
//         );
//       }
//     },
//     [
//       selectedSite,
//       selectedYear,
//       selectedMonth,
//       activeTab,
//       insuranceStatusCache,
//       getStatusStyle,
//       getStatusText,
//       isEnrolled,
//     ]
//   );

//   // 최적화된 renderEnrollmentRecords 함수
//   const renderEnrollmentRecords = useCallback(
//     (workerId) => {
//       // 보험 종류 정의
//       const insuranceTypes = [
//         { id: "national_pension", name: "국민연금", color: "blue" },
//         { id: "health_insurance", name: "건강보험", color: "green" },
//         { id: "employment_insurance", name: "고용보험", color: "purple" },
//         { id: "industrial_accident", name: "산재보험", color: "red" },
//       ];

//       // 가입 상태인 보험만 필터링
//       const enrolledInsurances = insuranceTypes.filter((type) =>
//         isEnrolled(workerId, selectedSite, type.id)
//       );

//       if (enrolledInsurances.length === 0) {
//         // 가입된 보험이 없는 경우
//         return (
//           <tr>
//             <td colSpan="4" className="px-6 py-10 text-center text-gray-500">
//               <div className="flex flex-col items-center">
//                 <svg
//                   xmlns="http://www.w3.org/2000/svg"
//                   className="h-8 w-8 text-gray-300 mb-2"
//                   fill="none"
//                   viewBox="0 0 24 24"
//                   stroke="currentColor"
//                 >
//                   <path
//                     strokeLinecap="round"
//                     strokeLinejoin="round"
//                     strokeWidth="2"
//                     d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
//                   />
//                 </svg>
//                 가입 정보가 없습니다.
//               </div>
//             </td>
//           </tr>
//         );
//       }

//       // 가입된 보험에 대한 행 생성
//       return enrolledInsurances.map((insurance, idx) => (
//         <tr key={idx} className="hover:bg-gray-50">
//           <td className="px-4 py-3 text-sm">
//             <span className="flex items-center">
//               <span className={`w-2 h-2 bg-${insurance.color}-500 rounded-full mr-2`}></span>
//               {insurance.name}
//             </span>
//           </td>
//           <td className="px-4 py-3 text-sm">{activeTab === 2 ? "상실 대상" : "가입 중"}</td>
//           <td className="px-4 py-3 text-sm">{activeTab === 2 ? "근로관계 종료" : "자동 가입"}</td>
//           <td className="px-4 py-3 text-sm">
//             {activeTab === 2 ? (
//               <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
//                 상실 필요
//               </span>
//             ) : (
//               <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
//                 가입 중
//               </span>
//             )}
//           </td>
//         </tr>
//       ));
//     },
//     [activeTab, selectedSite, isEnrolled]
//   );

//   // 최적화된 근로자 기본 정보 및 근무 이력 상세 정보 렌더링 컴포넌트
//   const WorkerDetailInfo = React.memo(({ worker }) => (
//     <div className="bg-white p-4 rounded-lg shadow-sm">
//       <h4 className="text-md font-semibold text-blue-700 mb-3 pb-2 border-b">근로자 정보</h4>
//       <div className="space-y-3 text-sm">
//         <div className="flex">
//           <span className="font-medium w-28">이름:</span>
//           <span>{worker.name}</span>
//         </div>
//         <div className="flex">
//           <span className="font-medium w-28">주민등록번호:</span>
//           <span>{formatResidentNumber(worker.resident_number)}</span>
//         </div>
//         <div className="flex">
//           <span className="font-medium w-28">연락처:</span>
//           <span>{formatPhoneNumber(worker.contact_number)}</span>
//         </div>
//         <div className="flex">
//           <span className="font-medium w-28">나이:</span>
//           <span>{worker.age}세</span>
//         </div>
//         <div className="flex">
//           <span className="font-medium w-28">직종:</span>
//           <span>{worker.jobName || "미지정"}</span>
//         </div>
//       </div>
//     </div>
//   ));

//   const WorkHistoryDetail = React.memo(({ workHistory, isInactiveTab = false }) => (
//     <div className="bg-white p-4 rounded-lg shadow-sm">
//       <h4 className="text-md font-semibold text-blue-700 mb-3 pb-2 border-b">근무 이력</h4>
//       <div className="space-y-3 text-sm">
//         <div className="flex">
//           <span className="font-medium w-28">첫 근무일:</span>
//           <span>
//             {workHistory.firstWorkDate
//               ? new Date(workHistory.firstWorkDate).toLocaleDateString()
//               : "없음"}
//           </span>
//         </div>
//         <div className="flex">
//           <span className="font-medium w-28">전월 근무일수:</span>
//           <span>{workHistory.previousMonthWorkDays || 0}일</span>
//         </div>
//         <div className="flex">
//           <span className="font-medium w-28">전월 근무시간:</span>
//           <span>{workHistory.previousMonthWorkHours || 0}시간</span>
//         </div>
//         <div className="flex">
//           <span className="font-medium w-28">당월 근무일수:</span>
//           {isInactiveTab ? (
//             <span className="text-red-500 font-medium">0일</span>
//           ) : (
//             <span>{workHistory.currentMonthWorkDays || 0}일</span>
//           )}
//         </div>
//         <div className="flex">
//           <span className="font-medium w-28">당월 근무시간:</span>
//           {isInactiveTab ? (
//             <span className="text-red-500 font-medium">0시간</span>
//           ) : (
//             <span>{workHistory.currentMonthWorkHours || 0}시간</span>
//           )}
//         </div>
//         <div className="flex">
//           <span className="font-medium w-28">당월 급여:</span>
//           {isInactiveTab ? (
//             <span className="text-red-500 font-medium">0원</span>
//           ) : (
//             <span>{(workHistory.monthlyWage || 0).toLocaleString()}원</span>
//           )}
//         </div>
//         {isInactiveTab && (
//           <div className="flex">
//             <span className="font-medium w-28 font-medium">당월 미등록:</span>
//             <span className="text-red-500 font-medium">상실 대상</span>
//           </div>
//         )}
//       </div>
//     </div>
//   ));

//   // 근로자 행 컴포넌트 (메모이제이션)
//   const WorkerRow = React.memo(
//     ({
//       worker,
//       index,
//       workHistory,
//       isInactiveTab,
//       selected,
//       showDetail,
//       yearMonth,
//       handleRowClick,
//       handleActionClick,
//       enrollmentDate, // 이 prop을 추가했습니다
//     }) => (
//       <React.Fragment>
//         <tr
//           className={`${
//             selected ? "bg-blue-50" : "hover:bg-gray-50"
//           } cursor-pointer transition-colors`}
//           onClick={() => handleRowClick(worker.worker_id)}
//         >
//           <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>

//           <td className="px-4 py-4">
//             <WorkerProfile worker={worker} />
//           </td>

//           <td className="px-4 py-4">
//             <WorkerHistory workHistory={workHistory} isInactiveTab={isInactiveTab} />
//           </td>

//           <td className="px-4 py-4">
//             <InsuranceStatusGrid
//               workerId={worker.worker_id}
//               activeTab={activeTab}
//               insuranceStatusCache={insuranceStatusCache}
//               selectedSite={selectedSite}
//               isEnrolled={isEnrolled}
//               getStatusStyle={getStatusStyle}
//               getStatusText={getStatusText}
//             />
//           </td>

//           <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
//             {activeTab === 0 ? (
//               // New enrollment tab - Show the enrollment button
//               <button
//                 onClick={(e) => {
//                   e.stopPropagation();
//                   console.log("가입 처리 버튼 클릭됨", worker.worker_id);
//                   handleActionClick(worker.worker_id, e, "acquire");
//                 }}
//                 className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition"
//               >
//                 <svg
//                   xmlns="http://www.w3.org/2000/svg"
//                   className="h-4 w-4 mr-1"
//                   fill="none"
//                   viewBox="0 0 24 24"
//                   stroke="currentColor"
//                 >
//                   <path
//                     strokeLinecap="round"
//                     strokeLinejoin="round"
//                     strokeWidth="2"
//                     d="M12 6v6m0 0v6m0-6h6m-6 0H6"
//                   />
//                 </svg>
//                 가입 처리
//               </button>
//             ) : activeTab === 1 ? (
//               // Active workers tab - Show cancel button for newly enrolled workers
//               // 즉시 실행 함수를 사용하여 안전하게 확인
//               (() => {
//                 if (enrollmentDate && enrollmentDate === yearMonth) {
//                   return (
//                     <button
//                       onClick={(e) => handleActionClick(worker.worker_id, e, "cancel")}
//                       className="inline-flex items-center px-3 py-1.5 bg-yellow-600 text-white text-xs font-medium rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 transition"
//                     >
//                       <svg
//                         xmlns="http://www.w3.org/2000/svg"
//                         className="h-4 w-4 mr-1"
//                         fill="none"
//                         viewBox="0 0 24 24"
//                         stroke="currentColor"
//                       >
//                         <path
//                           strokeLinecap="round"
//                           strokeLinejoin="round"
//                           strokeWidth="2"
//                           d="M6 18L18 6M6 6l12 12"
//                         />
//                       </svg>
//                       취소
//                     </button>
//                   );
//                 } else {
//                   return (
//                     <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium rounded-md bg-gray-100 text-gray-600">
//                       유지중
//                     </span>
//                   );
//                 }
//               })()
//             ) : (
//               // Inactive workers tab - Show loss button
//               <button
//                 onClick={(e) => handleActionClick(worker.worker_id, e, "loss")}
//                 className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition"
//               >
//                 <svg
//                   xmlns="http://www.w3.org/2000/svg"
//                   className="h-4 w-4 mr-1"
//                   fill="none"
//                   viewBox="0 0 24 24"
//                   stroke="currentColor"
//                 >
//                   <path
//                     strokeLinecap="round"
//                     strokeLinejoin="round"
//                     strokeWidth="2"
//                     d="M6 18L18 6M6 6l12 12"
//                   />
//                 </svg>
//                 상실 처리
//               </button>
//             )}
//           </td>
//         </tr>

//         {selected && showDetail && (
//           <tr>
//             <td colSpan="5" className="p-0">
//               <div className="border-t border-b border-blue-200 bg-blue-50 p-6">
//                 <div className="flex justify-between items-start mb-4">
//                   <h3 className="text-lg font-semibold text-blue-800">
//                     {worker.name} - 4대보험 세부 정보
//                   </h3>
//                   <button
//                     onClick={() => handleRowClick(null)}
//                     className="text-gray-400 hover:text-gray-600"
//                   >
//                     <svg
//                       xmlns="http://www.w3.org/2000/svg"
//                       className="h-6 w-6"
//                       fill="none"
//                       viewBox="0 0 24 24"
//                       stroke="currentColor"
//                     >
//                       <path
//                         strokeLinecap="round"
//                         strokeLinejoin="round"
//                         strokeWidth="2"
//                         d="M6 18L18 6M6 6l12 12"
//                       />
//                     </svg>
//                   </button>
//                 </div>

//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                   {/* 근로자 정보 */}
//                   <WorkerDetailInfo worker={worker} />

//                   {/* 근무 이력 정보 */}
//                   <WorkHistoryDetail workHistory={workHistory} isInactiveTab={isInactiveTab} />
//                 </div>

//                 <div className="mt-6">
//                   <h4 className="text-md font-semibold text-blue-700 mb-3 pb-2 border-b">
//                     4대보험 가입 정보
//                   </h4>
//                   <div className="bg-white border rounded-lg shadow-sm">
//                     <table className="min-w-full divide-y divide-gray-200">
//                       <thead className="bg-gray-50">
//                         <tr>
//                           <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                             보험 종류
//                           </th>
//                           <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                             가입일
//                           </th>
//                           <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                             가입사유
//                           </th>
//                           <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                             상태
//                           </th>
//                         </tr>
//                       </thead>
//                       <tbody className="divide-y divide-gray-200">
//                         {renderEnrollmentRecords(worker.worker_id)}
//                       </tbody>
//                     </table>
//                   </div>

//                   {/* 상실 탭인 경우 주의 메시지 표시 */}
//                   {isInactiveTab && (
//                     <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
//                       <div className="flex items-start">
//                         <svg
//                           xmlns="http://www.w3.org/2000/svg"
//                           className="h-5 w-5 text-yellow-500 mr-2 mt-0.5"
//                           fill="none"
//                           viewBox="0 0 24 24"
//                           stroke="currentColor"
//                         >
//                           <path
//                             strokeLinecap="round"
//                             strokeLinejoin="round"
//                             strokeWidth="2"
//                             d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
//                           />
//                         </svg>
//                         <div>
//                           <p className="text-yellow-800 font-medium mb-1">
//                             주의: 당월 근무 기록이 없는 근로자입니다
//                           </p>
//                           <p className="text-yellow-700 text-sm">
//                             실제로 현장에 더 이상 출근하지 않는 경우 상실 처리가 필요합니다.
//                             상실일이 속한 달의 전월까지 보험료가 부과되므로, 가능한 빨리 상실
//                             처리하는 것이 좋습니다.
//                           </p>
//                         </div>
//                       </div>
//                     </div>
//                   )}

//                   {/* 유지 탭인 경우 주의 메시지 표시 */}
//                   {activeTab === 1 && (
//                     <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
//                       <div className="flex items-start">
//                         <svg
//                           xmlns="http://www.w3.org/2000/svg"
//                           className="h-5 w-5 text-yellow-500 mr-2 mt-0.5"
//                           fill="none"
//                           viewBox="0 0 24 24"
//                           stroke="currentColor"
//                         >
//                           <path
//                             strokeLinecap="round"
//                             strokeLinejoin="round"
//                             strokeWidth="2"
//                             d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
//                           />
//                         </svg>
//                         <div>
//                           <p className="text-yellow-800 font-medium mb-1">
//                             주의: 고용 관계 변동 사항
//                           </p>
//                           <p className="text-yellow-700 text-sm">
//                             근로자가 현장에 더 이상 출근하지 않는 경우 상실 처리가 필요합니다.
//                             그렇지 않으면 계속해서 보험료가 부과됩니다.
//                           </p>
//                         </div>
//                       </div>
//                     </div>
//                   )}

//                   {/* 신규 가입 탭에서만 설정 UI 표시 */}
//                   {activeTab === 0 && (
//                     <>
//                       <div className="mt-6">
//                         <h4 className="text-md font-semibold text-blue-700 mb-3 pb-2 border-b">
//                           4대보험 설정
//                         </h4>
//                         <InsuranceControls
//                           worker={worker}
//                           yearMonth={yearMonth}
//                           selectedSite={selectedSite}
//                           insuranceStatusCache={insuranceStatusCache}
//                           handleStatusChange={handleStatusChange}
//                           renderInsuranceStatusBadge={renderInsuranceStatusBadge}
//                         />
//                       </div>

//                       {/* 사유 입력 */}
//                       <div className="mt-6">
//                         <h4 className="text-md font-semibold text-blue-700 mb-2">수동 설정 사유</h4>
//                         <div className="flex items-start space-x-2">
//                           <textarea
//                             className="flex-1 p-2 border rounded"
//                             rows="2"
//                             placeholder="수동 설정 사유를 입력하세요"
//                             value={getManualReason(worker.worker_id)}
//                             onChange={(e) => {
//                               const updatedSettings = { ...manualSettings };
//                               const key = `${worker.worker_id}-${selectedSite}`;
//                               if (!updatedSettings[key]) {
//                                 updatedSettings[key] = {
//                                   manual_reason: e.target.value,
//                                 };
//                               } else {
//                                 updatedSettings[key].manual_reason = e.target.value;
//                               }
//                             }}
//                           ></textarea>
//                           <button
//                             className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
//                             onClick={(e) => {
//                               e.stopPropagation();
//                               handleReason(worker.worker_id, getManualReason(worker.worker_id), e);
//                             }}
//                           >
//                             저장
//                           </button>
//                         </div>
//                       </div>
//                     </>
//                   )}
//                 </div>
//               </div>
//             </td>
//           </tr>
//         )}
//       </React.Fragment>
//     )
//   );

//   // 행 클릭 및 액션 버튼 클릭 핸들러 - useCallback으로 최적화
//   const handleRowClick = useCallback(
//     (workerId) => {
//       setSelectedWorkerId(workerId === selectedWorkerId ? null : workerId);
//     },
//     [selectedWorkerId, setSelectedWorkerId]
//   );

//   const handleActionClick = useCallback(
//     (workerId, e, action) => {
//       console.log("handleActionClick 호출됨:", workerId, action);
//       e.stopPropagation();

//       if (action === "acquire") {
//         console.log("acquire 액션 - handleAcquisition 호출 전");
//         handleAcquisition(workerId, e);
//       } else if (action === "loss") {
//         console.log("loss 액션 - handleLoss 호출 전");
//         handleLoss(workerId, e);
//       } else if (action === "cancel") {
//         console.log("cancel 액션 - handleCancelEnrollment 호출 전");
//         handleCancelEnrollment(workerId, e);
//       }
//     },
//     [handleAcquisition, handleLoss, handleCancelEnrollment]
//   );

//   // 메인 렌더링 코드
//   return (
//     <RoleGuard requiredPermission="EDIT_INSURANCE">
//       <div className="space-y-6">
//         {/* Loading overlay */}
//         {isLoading && (
//           <div className="fixed inset-0 flex items-center justify-center bg-gray-800 bg-opacity-70 z-50">
//             <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500 mr-3"></div>
//             <span className="text-white">처리 중...</span>
//           </div>
//         )}

//         {/* Header section */}
//         <div className="bg-white rounded-lg shadow p-6">
//           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
//             <div>
//               <h1 className="text-2xl font-bold text-gray-800">4대보험 관리</h1>
//               {companyName && <p className="text-sm text-gray-500 mt-1">{companyName}</p>}
//             </div>
//             <div className="flex flex-col md:flex-row items-start md:items-center gap-3 w-full md:w-auto">
//               <select
//                 className="px-3 py-2 border border-gray-300 rounded-md bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full md:w-auto"
//                 value={selectedSite || ""}
//                 onChange={handleSiteChange}
//               >
//                 <option value="">공사현장 선택</option>
//                 {sites.map((site) => (
//                   <option key={site.site_id} value={site.site_id}>
//                     {site.site_name}
//                   </option>
//                 ))}
//               </select>

//               <input
//                 type="month"
//                 className="px-3 py-2 border border-gray-300 rounded-md bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full md:w-auto"
//                 value={`${selectedYear}-${selectedMonth}`}
//                 onChange={handleYearMonthChange}
//               />

//               {/* <div className="flex ml-auto gap-2">
//                 <Link
//                   href="/daily-report"
//                   className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition shadow-sm flex items-center"
//                 >
//                   <svg
//                     xmlns="http://www.w3.org/2000/svg"
//                     className="h-4 w-4 mr-2"
//                     fill="none"
//                     viewBox="0 0 24 24"
//                     stroke="currentColor"
//                   >
//                     <path
//                       strokeLinecap="round"
//                       strokeLinejoin="round"
//                       strokeWidth="2"
//                       d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
//                     />
//                   </svg>
//                   급여명세서
//                 </Link>
//                 <button
//                   className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition shadow-sm flex items-center"
//                   onClick={handleSaveAll}
//                 >
//                   <svg
//                     xmlns="http://www.w3.org/2000/svg"
//                     className="h-4 w-4 mr-2"
//                     fill="none"
//                     viewBox="0 0 24 24"
//                     stroke="currentColor"
//                   >
//                     <path
//                       strokeLinecap="round"
//                       strokeLinejoin="round"
//                       strokeWidth="2"
//                       d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
//                     />
//                   </svg>
//                   모든 설정 저장
//                 </button>
//               </div> */}
//             </div>
//           </div>
//         </div>

//         {/* Explanation section */}
//         <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-5 rounded-lg shadow-sm border border-blue-200">
//           <div className="flex items-start">
//             <div className="mr-4 bg-blue-200 p-2 rounded-full">
//               <svg
//                 xmlns="http://www.w3.org/2000/svg"
//                 className="h-6 w-6 text-blue-700"
//                 fill="none"
//                 viewBox="0 0 24 24"
//                 stroke="currentColor"
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   strokeWidth="2"
//                   d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
//                 />
//               </svg>
//             </div>
//             <div>
//               <h2 className="text-lg font-semibold text-blue-800 mb-2">4대보험 적용 판단 안내</h2>
//               <ul className="list-none space-y-1.5 text-sm text-blue-800">
//                 <li className="flex items-start">
//                   <span className="inline-block w-3 h-3 bg-blue-400 rounded-full mt-1.5 mr-2"></span>
//                   <span>
//                     <strong>국민연금:</strong> 60세 이하 근로자 중 월급여 220만원 이상이거나 월 8일
//                     이상 또는 월 60시간 이상 근무한 경우
//                   </span>
//                 </li>
//                 <li className="flex items-start">
//                   <span className="inline-block w-3 h-3 bg-blue-400 rounded-full mt-1.5 mr-2"></span>
//                   <span>
//                     <strong>건강보험:</strong> 월 60시간 이상 근무한 경우
//                   </span>
//                 </li>
//                 <li className="flex items-start">
//                   <span className="inline-block w-3 h-3 bg-blue-400 rounded-full mt-1.5 mr-2"></span>
//                   <span>
//                     <strong>고용보험:</strong> 일용근로자는 근로일수 및 시간 상관없이 모두 적용
//                     (65세 이상은 특례 적용)
//                   </span>
//                 </li>
//                 <li className="flex items-start">
//                   <span className="inline-block w-3 h-3 bg-blue-400 rounded-full mt-1.5 mr-2"></span>
//                   <span>
//                     <strong>산재보험:</strong> 모든 근로자 당연 적용
//                   </span>
//                 </li>
//               </ul>
//               <p className="mt-2 text-sm italic text-blue-700">
//                 자동 판단 결과를 확인하고, 필요시 수동으로 적용 여부를 조정할 수 있습니다.
//               </p>
//             </div>
//           </div>
//         </div>

//         {/* Search and statistics */}
//         <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-lg shadow-sm">
//           <div className="relative w-full md:w-80">
//             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
//               <svg
//                 className="h-5 w-5 text-gray-400"
//                 xmlns="http://www.w3.org/2000/svg"
//                 viewBox="0 0 20 20"
//                 fill="currentColor"
//               >
//                 <path
//                   fillRule="evenodd"
//                   d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z"
//                   clipRule="evenodd"
//                 />
//               </svg>
//             </div>
//             <input
//               type="text"
//               className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
//               placeholder="근로자 이름 또는 주민번호 검색..."
//               value={searchTerm}
//               onChange={handleSearch}
//             />
//           </div>

//           <div className="flex gap-2 flex-wrap justify-center md:justify-end w-full md:w-auto">
//             {/* Statistics cards */}
//             <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm flex items-center">
//               <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
//               <span>
//                 국민연금:{" "}
//                 {getCountByInsuranceType(
//                   [...(activeWorkers || []), ...(inactiveWorkers || [])],
//                   "national_pension"
//                 )}
//                 명
//               </span>
//             </div>
//             <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center">
//               <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
//               <span>
//                 건강보험:{" "}
//                 {getCountByInsuranceType(
//                   [...(activeWorkers || []), ...(inactiveWorkers || [])],
//                   "health_insurance"
//                 )}
//                 명
//               </span>
//             </div>
//             <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm flex items-center">
//               <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span>
//               <span>
//                 고용보험:{" "}
//                 {getCountByInsuranceType(
//                   [...(activeWorkers || []), ...(inactiveWorkers || [])],
//                   "employment_insurance"
//                 )}
//                 명
//               </span>
//             </div>
//             <div className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm flex items-center">
//               <span className="w-2 h-2 bg-amber-500 rounded-full mr-2"></span>
//               <span>
//                 산재보험:{" "}
//                 {getCountByInsuranceType(
//                   [...(activeWorkers || []), ...(inactiveWorkers || [])],
//                   "industrial_accident"
//                 )}
//                 명
//               </span>
//             </div>
//           </div>
//         </div>

//         {/* Tab area */}
//         <div className="bg-white rounded-lg shadow overflow-hidden">
//           {/* Tab header */}
//           <div className="flex border-b">
//             <button
//               className={`py-3 px-6 font-medium text-sm focus:outline-none transition-colors ${
//                 activeTab === 0
//                   ? "border-b-2 border-blue-500 text-blue-600 bg-blue-50"
//                   : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
//               }`}
//               onClick={() => setActiveTab(0)}
//             >
//               신규 가입 대상자
//               <span className="ml-2 bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs">
//                 {registeredWorkers ? registeredWorkers.length : 0}
//               </span>
//             </button>
//             <button
//               className={`py-3 px-6 font-medium text-sm focus:outline-none transition-colors ${
//                 activeTab === 1
//                   ? "border-b-2 border-blue-500 text-blue-600 bg-blue-50"
//                   : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
//               }`}
//               onClick={() => setActiveTab(1)}
//             >
//               유지 중인 근로자
//               <span className="ml-2 bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs">
//                 {activeWorkers ? activeWorkers.length : 0}
//               </span>
//             </button>
//             <button
//               className={`py-3 px-6 font-medium text-sm focus:outline-none transition-colors ${
//                 activeTab === 2
//                   ? "border-b-2 border-blue-500 text-blue-600 bg-blue-50"
//                   : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
//               }`}
//               onClick={() => setActiveTab(2)}
//             >
//               상실 대상자
//               <span className="ml-2 bg-red-100 text-red-800 px-2 py-0.5 rounded-full text-xs">
//                 {inactiveWorkers ? inactiveWorkers.length : 0}
//               </span>
//             </button>
//           </div>

//           {/* Tab content */}
//           <div className="overflow-x-auto">
//             <table className="min-w-full divide-y divide-gray-200">
//               <thead className="bg-gray-50">
//                 <tr>
//                   <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
//                     No.
//                   </th>
//                   <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     근로자 정보
//                   </th>
//                   <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     근무 이력
//                   </th>
//                   <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
//                     4대보험 가입 상태
//                   </th>
//                   <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
//                     액션
//                   </th>
//                 </tr>
//               </thead>
//               <tbody className="bg-white divide-y divide-gray-200">
//                 {(() => {
//                   // Determine which workers to show based on active tab
//                   const workersArray =
//                     activeTab === 0
//                       ? registeredWorkers
//                       : activeTab === 1
//                       ? activeWorkers
//                       : inactiveWorkers;

//                   const filteredWorkers = filterWorkers(workersArray);

//                   if (filteredWorkers.length === 0) {
//                     return (
//                       <tr>
//                         <td colSpan="5" className="px-6 py-12 text-center">
//                           <div className="flex flex-col items-center">
//                             <svg
//                               xmlns="http://www.w3.org/2000/svg"
//                               className="h-12 w-12 text-gray-300 mb-4"
//                               fill="none"
//                               viewBox="0 0 24 24"
//                               stroke="currentColor"
//                             >
//                               <path
//                                 strokeLinecap="round"
//                                 strokeLinejoin="round"
//                                 strokeWidth="2"
//                                 d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
//                               />
//                             </svg>
//                             <span className="text-gray-500 text-lg">
//                               {selectedSite
//                                 ? searchTerm
//                                   ? "검색 결과가 없습니다."
//                                   : activeTab === 0
//                                   ? "신규 가입 대상자가 없습니다."
//                                   : activeTab === 1
//                                   ? "유지 중인 근로자가 없습니다."
//                                   : "상실 대상자가 없습니다."
//                                 : "공사현장을 선택해주세요."}
//                             </span>
//                           </div>
//                         </td>
//                       </tr>
//                     );
//                   }

//                   return filteredWorkers.map((worker, index) => {
//                     const yearMonth = `${selectedYear}-${selectedMonth}`;
//                     const workHistory =
//                       workersHistory[`${worker.worker_id}-${selectedSite}-${yearMonth}`] || {};
//                     const isInactiveTab = activeTab === 2;

//                     // Get the enrollment date to determine if the worker was enrolled in the current month
//                     const enrollmentDate = getEnrollmentDate(worker.worker_id);

//                     return (
//                       <WorkerRow
//                         key={worker.worker_id}
//                         worker={worker}
//                         index={index}
//                         workHistory={workHistory}
//                         isInactiveTab={isInactiveTab}
//                         selected={selectedWorkerId === worker.worker_id}
//                         showDetail={showDetail}
//                         yearMonth={yearMonth}
//                         handleRowClick={handleRowClick}
//                         handleActionClick={handleActionClick}
//                         enrollmentDate={enrollmentDate} // Pass the enrollment date
//                       />
//                     );
//                   });
//                 })()}
//               </tbody>
//             </table>
//           </div>
//         </div>

//         {/* Footer/Action buttons */}
//         <div className="flex justify-end space-x-4 mt-6">
//           <Link
//             href="/daily-report"
//             className="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition shadow-sm flex items-center"
//           >
//             <svg
//               xmlns="http://www.w3.org/2000/svg"
//               className="h-4 w-4 mr-2"
//               fill="none"
//               viewBox="0 0 24 24"
//               stroke="currentColor"
//             >
//               <path
//                 strokeLinecap="round"
//                 strokeLinejoin="round"
//                 strokeWidth="2"
//                 d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
//               />
//             </svg>
//             급여명세서
//           </Link>
//           {activeTab === 0 && (
//             <button
//               className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition shadow-sm flex items-center"
//               onClick={handleSaveAll}
//             >
//               <svg
//                 xmlns="http://www.w3.org/2000/svg"
//                 className="h-4 w-4 mr-2"
//                 fill="none"
//                 viewBox="0 0 24 24"
//                 stroke="currentColor"
//               >
//                 <path
//                   strokeLinecap="round"
//                   strokeLinejoin="round"
//                   strokeWidth="2"
//                   d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
//                 />
//               </svg>
//               모든 설정 저장
//             </button>
//           )}
//         </div>

//         {/* Toast container */}
//         <ToastContainer />
//       </div>
//     </RoleGuard>
//   );
// }

// export default InsuranceEnrollmentsPage;
