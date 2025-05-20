//file: lib/store/useInsuranceStore.js (Part 1)
// "use client";
// import { create } from "zustand";
// import { supabase } from "@/lib/supabase";
// import useWorkTimeStore from "./workTimeStore";

// // 유틸리티 함수
// const formatResidentNumber = (value) => {
//   if (!value) return "";
//   return value.length === 13 ? `${value.substring(0, 6)}-${value.substring(6)}` : value;
// };

// const formatPhoneNumber = (value) => {
//   if (!value) return "";
//   return value.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
// };

// const calculateAgeFromResidentNumber = (residentNumber) => {
//   if (!residentNumber || residentNumber.length !== 13) return 0;

//   const birthYear = parseInt(residentNumber.substring(0, 2));
//   const genderDigit = parseInt(residentNumber.charAt(6));

//   // 성별 숫자가 1,2면 1900년대, 3,4면 2000년대
//   const fullYear = genderDigit < 3 ? 1900 + birthYear : 2000 + birthYear;
//   const today = new Date();
//   const age = today.getFullYear() - fullYear;

//   return age;
// };

// // 보험 가입 상태 판단 함수
// const determineInsuranceStatus = (worker, workHistory) => {
//   // 기본 상태 객체
//   const status = {
//     nationalPension: { required: false, reason: "" },
//     healthInsurance: { required: false, reason: "" },
//     employmentInsurance: { required: true, reason: "일용근로자 당연 적용" },
//     industrialAccident: { required: true, reason: "모든 근로자 당연 적용" },
//   };

//   // 근로자가 없거나 근무 이력이 없는 경우
//   if (!worker || !workHistory) return status;

//   // 기본 정보 추출
//   const age = worker.age || calculateAgeFromResidentNumber(worker.resident_number);
//   const previousMonthWorkDays = workHistory.previousMonthWorkDays || 0;
//   const previousMonthWorkHours = workHistory.previousMonthWorkHours || 0;
//   const currentMonthWorkDays = workHistory.currentMonthWorkDays || 0;
//   const currentMonthWorkHours = workHistory.currentMonthWorkHours || 0;
//   const monthlyWage = workHistory.monthlyWage || 0;

//   // 선택월 근무가 전혀 없는 경우
//   if (
//     currentMonthWorkDays === 0 &&
//     currentMonthWorkHours === 0 &&
//     !workHistory.isRegisteredInCurrentMonth
//   ) {
//     return {
//       nationalPension: { required: false, reason: "선택월 근무 없음" },
//       healthInsurance: { required: false, reason: "선택월 근무 없음" },
//       employmentInsurance: { required: true, reason: "일용근로자 당연 적용" },
//       industrialAccident: { required: true, reason: "모든 근로자 당연 적용" },
//     };
//   }

//   // 1. 국민연금 판단
//   if (age <= 60) {
//     // 월 60시간 이상 근무 또는 월 8일 이상 근무 또는 월급여 220만원 이상
//     if (previousMonthWorkHours >= 60 || previousMonthWorkDays >= 8 || monthlyWage >= 2200000) {
//       status.nationalPension.required = true;
//       status.nationalPension.reason =
//         previousMonthWorkHours >= 60
//           ? "월 60시간 이상 근무"
//           : previousMonthWorkDays >= 8
//           ? "월 8일 이상 근무"
//           : "월급여 220만원 이상";
//     } else {
//       status.nationalPension.required = false;
//       status.nationalPension.reason = "월 60시간 미만, 월 8일 미만 근무, 월급여 220만원 미만";
//     }
//   } else {
//     status.nationalPension.required = false;
//     status.nationalPension.reason = "60세 초과";
//   }

//   // 2. 건강보험 판단 (월 60시간 이상 근무만 조건)
//   if (previousMonthWorkHours >= 60) {
//     status.healthInsurance.required = true;
//     status.healthInsurance.reason = "월 60시간 이상 근무";
//   } else {
//     status.healthInsurance.required = false;
//     status.healthInsurance.reason = "월 60시간 미만 근무";
//   }

//   // 3. 고용보험 판단 (일용근로자는 항상 가입)
//   status.employmentInsurance.required = true;
//   status.employmentInsurance.reason = age >= 65 ? "65세 이상 특례 적용" : "일용근로자 당연 적용";

//   return status;
// };

// // 선택한 달 기준으로 이전 달 계산 - 개선된 함수
// const getPreviousYearMonthFromSelected = (year, month) => {
//   const selectedYear = parseInt(year);
//   const selectedMonth = parseInt(month);

//   let prevMonth = selectedMonth - 1;
//   let prevYear = selectedYear;

//   if (prevMonth === 0) {
//     prevMonth = 12;
//     prevYear = selectedYear - 1;
//   }

//   // 다음 달 계산 추가
//   let nextMonth = selectedMonth + 1;
//   let nextYear = selectedYear;

//   if (nextMonth === 13) {
//     nextMonth = 1;
//     nextYear = selectedYear + 1;
//   }

//   return {
//     currentYear: selectedYear.toString(),
//     currentMonth: selectedMonth.toString().padStart(2, "0"),
//     prevYear: prevYear.toString(),
//     prevMonth: prevMonth.toString().padStart(2, "0"),
//     nextYear: nextYear.toString(),
//     nextMonth: nextMonth.toString().padStart(2, "0"),
//   };
// };

// const useInsuranceStore = create((set, get) => ({
//   // 상태
//   sites: [],
//   companyName: "",
//   selectedSite: "",
//   selectedYear: new Date().getFullYear().toString(),
//   selectedMonth: (new Date().getMonth() + 1).toString().padStart(2, "0"),
//   activeTab: 0,
//   selectedWorkerId: null,
//   showDetail: false,
//   userCompanyId: null,

//   // 근로자 데이터 관련 상태
//   registeredWorkers: [],
//   activeWorkers: [],
//   inactiveWorkers: [],
//   workersHistory: {},

//   // 보험 상태 관련 상태
//   insuranceStatus: {},
//   manualSettings: {},
//   enrollmentRecords: {},

//   // 로딩 상태
//   isLoading: false,
//   isSiteLoading: false,

//   // 유틸리티
//   formatResidentNumber,
//   formatPhoneNumber,
//   calculateAgeFromResidentNumber,
//   determineInsuranceStatus,
//   getPreviousYearMonthFromSelected,

//   // 초기화 함수
//   initialize: async (userId) => {
//     try {
//       // 회사 ID 가져오기
//       await get().fetchUserCompany(userId);

//       // 현장 목록 가져오기
//       await get().fetchSites();
//     } catch (error) {
//       console.error("초기화 오류:", error);
//     }
//   },

//   // 회사 ID 및 정보 가져오기
//   fetchUserCompany: async (userId) => {
//     if (!userId) return;

//     try {
//       const { data, error } = await supabase
//         .from("user_companies")
//         .select("company_id, company:companies(company_name)")
//         .eq("user_id", userId)
//         .maybeSingle();

//       if (error) throw error;

//       if (data) {
//         set({
//           userCompanyId: data.company_id,
//           companyName: data.company?.company_name || "",
//         });
//         return data.company_id;
//       }
//     } catch (error) {
//       console.error("사용자 회사 정보 조회 오류:", error);
//     }

//     return null;
//   },

//   // 현장 목록 가져오기
//   fetchSites: async () => {
//     const { userCompanyId } = get();
//     if (!userCompanyId) return;

//     try {
//       set({ isSiteLoading: true });

//       const { data, error } = await supabase
//         .from("construction_sites")
//         .select("site_id, site_name")
//         .eq("company_id", userCompanyId)
//         .order("site_name");

//       if (error) throw error;

//       set({ sites: data || [] });

//       // 첫 번째 현장 자동 선택
//       if (data && data.length > 0 && !get().selectedSite) {
//         set({ selectedSite: data[0].site_id });
//       }
//     } catch (error) {
//       console.error("현장 목록 조회 오류:", error);
//     } finally {
//       set({ isSiteLoading: false });
//     }
//   },

//   // 모든 근로자 데이터 로드 - 통합 함수
//   loadAllWorkersData: async () => {
//     const { selectedSite, selectedYear, selectedMonth } = get();
//     if (!selectedSite || !selectedYear || !selectedMonth) return;

//     set({ isLoading: true });
//     try {
//       // 상태 초기화 추가
//       set({
//         registeredWorkers: [],
//         activeWorkers: [],
//         inactiveWorkers: [],
//         workersHistory: {},
//         insuranceStatus: {},
//         manualSettings: {},
//         enrollmentRecords: {},
//       });

//       console.log(
//         `[DEBUG] 데이터 로드 시작 - 현장: ${selectedSite}, 년월: ${selectedYear}-${selectedMonth}`
//       );

//       // 1. 등록 근로자 로드
//       const regWorkers = await get().loadRegisteredWorkers();
//       console.log(`[DEBUG] 등록 근로자 로드 완료 - ${regWorkers ? regWorkers.length : 0}명`);

//       // 2. 가입 근로자 로드
//       const { activeWorkersList, inactiveWorkersList } = await get().loadActiveInsuranceWorkers();
//       console.log(
//         `[DEBUG] 가입 근로자 로드 완료 - 활성: ${activeWorkersList.length}명, 비활성: ${inactiveWorkersList.length}명`
//       );

//       // 3. 근무 이력 로드
//       const historyData = await get().loadWorkersHistory(
//         regWorkers,
//         activeWorkersList,
//         inactiveWorkersList
//       );
//       console.log(
//         `[DEBUG] 근로자 이력 로드 완료 - 데이터 키 수: ${Object.keys(historyData).length}`
//       );

//       // 4. 보험 가입 정보 로드
//       await get().loadInsuranceEnrollments(historyData);
//       console.log(`[DEBUG] 보험 가입 정보 로드 완료`);
//     } catch (error) {
//       console.error("데이터 로드 오류:", error);
//     } finally {
//       set({ isLoading: false });
//     }
//   },

//   // 선택월 등록된 근로자 로드
//   loadRegisteredWorkers: async () => {
//     const { selectedSite, selectedYear, selectedMonth } = get();
//     if (!selectedSite) return [];

//     try {
//       const yearMonth = `${selectedYear}-${selectedMonth}`;

//       // 날짜 계산 - 선택한 달의 시작일과, 다음 달의 시작일 계산
//       const dateInfo = getPreviousYearMonthFromSelected(selectedYear, selectedMonth);
//       const startDate = `${yearMonth}-01`;
//       const endDate = `${dateInfo.nextYear}-${dateInfo.nextMonth}-01`;

//       console.log(
//         `[DEBUG] 등록된 근로자 조회 조건 - 년월: ${yearMonth}, 시작일: ${startDate}, 종료일: ${endDate}`
//       );

//       // 두 가지 경우를 OR로 조합
//       // 1. registration_month가 선택월인 경우
//       // 2. 또는 work_date가 선택월 범위에 있는 경우
//       const { data: recordsData, error: recordsError } = await supabase
//         .from("work_records")
//         .select("worker_id, status, registration_month, work_date")
//         .eq("site_id", selectedSite)
//         .or(
//           `registration_month.eq.${yearMonth},and(work_date.gte.${startDate},work_date.lt.${endDate})`
//         );

//       if (recordsError) throw recordsError;

//       console.log(`[DEBUG] 등록된 근로자 조회 결과:`, recordsData);

//       if (!recordsData || recordsData.length === 0) {
//         console.log(`[DEBUG] 등록된 근로자 없음`);
//         set({ registeredWorkers: [] });
//         return [];
//       }

//       // 중복 제거
//       const uniqueWorkerIds = [...new Set(recordsData.map((record) => record.worker_id))];
//       console.log(`[DEBUG] 고유 근로자 ID 목록:`, uniqueWorkerIds);

//       // 근로자 상세 정보 가져오기 - daily 타입 근로자만 필터링
//       const { data: workersData, error: workersError } = await supabase
//         .from("workers")
//         .select(
//           `
//          worker_id, name, resident_number, contact_number, address, job_code,
//          nationality_code, worker_type
//        `
//         )
//         .in("worker_id", uniqueWorkerIds)
//         .eq("worker_type", "daily"); // daily 타입 근로자만 필터링

//       if (workersError) throw workersError;

//       console.log(`[DEBUG] 근로자 상세 정보:`, workersData);

//       if (!workersData || workersData.length === 0) {
//         console.log(`[DEBUG] 필터링 후 등록된 근로자가 없음`);
//         set({ registeredWorkers: [] });
//         return [];
//       }

//       // 직종 코드 정보 가져오기
//       const jobCodes = workersData.filter((w) => w.job_code).map((w) => w.job_code);

//       let jobCodeMap = {};

//       if (jobCodes.length > 0) {
//         const { data: jobCodeData, error: jobCodeError } = await supabase
//           .from("code_masters")
//           .select("code_value, code_name")
//           .eq("code_type", "JOB_CODE")
//           .in("code_value", jobCodes);

//         if (jobCodeError) throw jobCodeError;

//         jobCodeMap = jobCodeData.reduce((acc, item) => {
//           acc[item.code_value] = item.code_name;
//           return acc;
//         }, {});
//       }

//       // 근로자 데이터 정리 및 나이 계산 추가
//       const workersWithJobName = workersData.map((worker) => {
//         const age = calculateAgeFromResidentNumber(worker.resident_number);

//         return {
//           ...worker,
//           jobName: worker.job_code ? jobCodeMap[worker.job_code] || "미지정" : "미지정",
//           age: age,
//           source: "registered", // 소스 표시 (등록된 근로자)
//         };
//       });

//       console.log(`[DEBUG] 최종 등록 근로자 목록:`, workersWithJobName);
//       set({ registeredWorkers: workersWithJobName });
//       return workersWithJobName;
//     } catch (error) {
//       console.error("등록 근로자 데이터 로드 오류:", error);
//       throw error;
//     }
//   },
//   //file: lib/store/useInsuranceStore.js (Part 3)

//   // 보험 가입 중인 근로자 로드
//   loadActiveInsuranceWorkers: async () => {
//     const { selectedSite, selectedYear, selectedMonth } = get();
//     if (!selectedSite) return { activeWorkersList: [], inactiveWorkersList: [] };

//     try {
//       console.log(`[DEBUG] 보험 가입 근로자 조회 시작 - 년월: ${selectedYear}-${selectedMonth}`);

//       // loss_date가 없는(아직 상실되지 않은) 보험 가입 기록 가져오기
//       const { data: enrollments, error: enrollmentsError } = await supabase
//         .from("insurance_enrollments")
//         .select("worker_id, insurance_type, acquisition_date")
//         .eq("site_id", selectedSite)
//         .is("loss_date", null);

//       if (enrollmentsError) throw enrollmentsError;

//       console.log(`[DEBUG] 보험 가입 기록 조회 결과:`, enrollments);

//       if (!enrollments || enrollments.length === 0) {
//         console.log(`[DEBUG] 보험 가입 근로자 없음`);
//         set({ activeWorkers: [], inactiveWorkers: [] });
//         return { activeWorkersList: [], inactiveWorkersList: [] };
//       }

//       // 중복 제거
//       const uniqueWorkerIds = [...new Set(enrollments.map((enrollment) => enrollment.worker_id))];
//       console.log(`[DEBUG] 고유 가입 근로자 ID 목록:`, uniqueWorkerIds);

//       // 선택월 등록된 근로자 ID 목록 가져오기
//       const yearMonth = `${selectedYear}-${selectedMonth}`;

//       // 날짜 계산 - 선택한 달의 시작일과, 다음 달의 시작일 계산
//       const dateInfo = getPreviousYearMonthFromSelected(selectedYear, selectedMonth);
//       const startDate = `${yearMonth}-01`;
//       const endDate = `${dateInfo.nextYear}-${dateInfo.nextMonth}-01`;

//       const { data: recordsData, error: recordsError } = await supabase
//         .from("work_records")
//         .select("worker_id, status, registration_month, work_date")
//         .eq("site_id", selectedSite)
//         .or(
//           `registration_month.eq.${yearMonth},and(work_date.gte.${startDate},work_date.lt.${endDate})`
//         );

//       if (recordsError) throw recordsError;

//       console.log(`[DEBUG] 선택월 등록 근로자 조회 결과:`, recordsData);

//       // 선택월 등록된 근로자 ID 목록
//       const registeredWorkerIds = recordsData
//         ? [...new Set(recordsData.map((record) => record.worker_id))]
//         : [];

//       // 선택월에 등록되지 않았지만 보험 가입 중인 근로자 ID
//       const inactiveWorkerIds = uniqueWorkerIds.filter((id) => !registeredWorkerIds.includes(id));

//       // 보험 가입 중이고 선택월에도 등록된 근로자 ID
//       const activeWorkerIds = uniqueWorkerIds.filter((id) => registeredWorkerIds.includes(id));

//       console.log(`[DEBUG] 활성 가입 근로자 ID:`, activeWorkerIds);
//       console.log(`[DEBUG] 비활성 가입 근로자 ID:`, inactiveWorkerIds);

//       let activeWorkersList = [];
//       let inactiveWorkersList = [];

//       // 근로자 상세 정보 가져오기 - 활성 근로자
//       if (activeWorkerIds.length > 0) {
//         const { data: activeWorkersData, error: activeWorkersError } = await supabase
//           .from("workers")
//           .select(
//             `
//            worker_id, name, resident_number, contact_number, address, job_code,
//            nationality_code, worker_type
//          `
//           )
//           .in("worker_id", activeWorkerIds)
//           .eq("worker_type", "daily");

//         if (activeWorkersError) throw activeWorkersError;

//         // 직종 코드 처리
//         const jobCodes = activeWorkersData.filter((w) => w.job_code).map((w) => w.job_code);

//         let jobCodeMap = {};

//         if (jobCodes.length > 0) {
//           const { data: jobCodeData } = await supabase
//             .from("code_masters")
//             .select("code_value, code_name")
//             .eq("code_type", "JOB_CODE")
//             .in("code_value", jobCodes);

//           jobCodeMap = jobCodeData
//             ? jobCodeData.reduce((acc, item) => {
//                 acc[item.code_value] = item.code_name;
//                 return acc;
//               }, {})
//             : {};
//         }

//         // 근로자 데이터 정리
//         activeWorkersList = activeWorkersData.map((worker) => {
//           const age = calculateAgeFromResidentNumber(worker.resident_number);

//           return {
//             ...worker,
//             jobName: worker.job_code ? jobCodeMap[worker.job_code] || "미지정" : "미지정",
//             age: age,
//             source: "active_enrolled", // 소스 표시 (활성 가입 근로자)
//           };
//         });

//         console.log(`[DEBUG] 활성 가입 근로자 정보:`, activeWorkersList);
//         set({ activeWorkers: activeWorkersList });
//       }

//       // 근로자 상세 정보 가져오기 - 비활성 근로자
//       if (inactiveWorkerIds.length > 0) {
//         const { data: inactiveWorkersData, error: inactiveWorkersError } = await supabase
//           .from("workers")
//           .select(
//             `
//            worker_id, name, resident_number, contact_number, address, job_code,
//            nationality_code, worker_type
//          `
//           )
//           .in("worker_id", inactiveWorkerIds)
//           .eq("worker_type", "daily");

//         if (inactiveWorkersError) throw inactiveWorkersError;

//         // 직종 코드 처리
//         const jobCodes = inactiveWorkersData.filter((w) => w.job_code).map((w) => w.job_code);

//         let jobCodeMap = {};

//         if (jobCodes.length > 0) {
//           const { data: jobCodeData } = await supabase
//             .from("code_masters")
//             .select("code_value, code_name")
//             .eq("code_type", "JOB_CODE")
//             .in("code_value", jobCodes);

//           jobCodeMap = jobCodeData
//             ? jobCodeData.reduce((acc, item) => {
//                 acc[item.code_value] = item.code_name;
//                 return acc;
//               }, {})
//             : {};
//         }

//         // 근로자 데이터 정리
//         inactiveWorkersList = inactiveWorkersData.map((worker) => {
//           const age = calculateAgeFromResidentNumber(worker.resident_number);

//           return {
//             ...worker,
//             jobName: worker.job_code ? jobCodeMap[worker.job_code] || "미지정" : "미지정",
//             age: age,
//             source: "inactive_enrolled", // 소스 표시 (비활성 가입 근로자)
//           };
//         });

//         console.log(`[DEBUG] 비활성 가입 근로자 정보:`, inactiveWorkersList);
//         set({ inactiveWorkers: inactiveWorkersList });
//       }

//       return { activeWorkersList, inactiveWorkersList };
//     } catch (error) {
//       console.error("보험 가입 근로자 로드 오류:", error);
//       throw error;
//     }
//   },
//   //file: lib/store/useInsuranceStore.js (Part 4)

//   // 이전 월 근무 데이터 조회 - 선택월 기준으로 이전 월 (수정)
//   loadPreviousMonthRecords: async (workerId, siteId, year, month) => {
//     // 이전 월 계산 - 선택된 월의 이전 월로 명확하게 계산
//     const dateInfo = getPreviousYearMonthFromSelected(year, month);
//     const prevYearMonth = `${dateInfo.prevYear}-${dateInfo.prevMonth}`;
//     const prevMonthStart = `${prevYearMonth}-01`;

//     // 선택 월 시작일 계산
//     const currentMonthStart = `${year}-${month}-01`;

//     console.log(
//       `[DEBUG] 이전월(${prevYearMonth}) 근무 데이터 조회 - 근로자 ID: ${workerId}, 현장 ID: ${siteId}`
//     );

//     try {
//       // 이전월 근무 기록 조회 - 날짜 범위로 필터링
//       let { data: workRecordsData, error: workError } = await supabase
//         .from("work_records")
//         .select("worker_id, work_date, work_hours, daily_wage, status, registration_month")
//         .eq("site_id", siteId)
//         .eq("worker_id", workerId)
//         .gte("work_date", prevMonthStart)
//         .lt("work_date", currentMonthStart);

//       if (workError) {
//         console.error(`[DEBUG] 이전월 근무 데이터 조회 오류:`, workError);
//         throw workError;
//       }

//       // 결과가 없는 경우 - registration_month로 조회
//       if (!workRecordsData || workRecordsData.length === 0) {
//         console.log(`[DEBUG] 날짜 기준 데이터 없음, registration_month로 재시도`);

//         const { data: regMonthData, error: regMonthError } = await supabase
//           .from("work_records")
//           .select("worker_id, work_date, work_hours, daily_wage, status, registration_month")
//           .eq("site_id", siteId)
//           .eq("worker_id", workerId)
//           .eq("registration_month", prevYearMonth);

//         if (!regMonthError && regMonthData && regMonthData.length > 0) {
//           workRecordsData = regMonthData;
//         }
//       }

//       // 이전월 등록 여부 확인
//       const { data: registrationData, error: regError } = await supabase
//         .from("work_records")
//         .select("worker_id, status, registration_month")
//         .eq("site_id", siteId)
//         .eq("worker_id", workerId)
//         .eq("registration_month", prevYearMonth)
//         .eq("status", "registration");

//       // 근무 기록 필터링 (registration 상태 제외)
//       const workRecords = workRecordsData
//         ? workRecordsData.filter((r) => r.status !== "registration")
//         : [];

//       // 데이터 계산
//       const workDays = workRecords.length;
//       const workHours = workRecords.reduce((sum, r) => sum + (parseFloat(r.work_hours) || 0), 0);
//       const monthlyWage = workRecords.reduce((sum, r) => sum + (parseFloat(r.daily_wage) || 0), 0);
//       const isRegistered = registrationData && registrationData.length > 0;

//       // 첫 근무일 확인
//       const firstWorkDate =
//         workRecords.length > 0
//           ? workRecords.sort((a, b) => new Date(a.work_date) - new Date(b.work_date))[0].work_date
//           : null;

//       const result = {
//         workDays,
//         workHours,
//         firstWorkDate,
//         monthlyWage,
//         isRegistered,
//       };

//       console.log(`[DEBUG] 이전월 근무 데이터 계산 결과:`, result);
//       return result;
//     } catch (error) {
//       console.error(`[DEBUG] 이전월 근무 데이터 처리 오류:`, error);
//       return {
//         workDays: 0,
//         workHours: 0,
//         firstWorkDate: null,
//         monthlyWage: 0,
//         isRegistered: false,
//       };
//     }
//   },

//   //file: lib/store/useInsuranceStore.js (Part 4 - 계속)

//   // 선택 월 근무 데이터 조회 - 수정
//   loadCurrentMonthRecords: async (workerId, siteId, year, month) => {
//     const yearMonth = `${year}-${month}`;
//     const monthStart = `${yearMonth}-01`;

//     // 다음 달 계산 - 수정된 유틸리티 함수 사용
//     const dateInfo = getPreviousYearMonthFromSelected(year, month);
//     const nextMonthStart = `${dateInfo.nextYear}-${dateInfo.nextMonth}-01`;

//     console.log(
//       `[DEBUG] 선택월(${yearMonth}) 근무 데이터 조회 - 근로자 ID: ${workerId}, 현장 ID: ${siteId}`
//     );

//     try {
//       // 선택월 근무 데이터 - 날짜 범위로 필터링
//       let { data: workRecordsData, error: workError } = await supabase
//         .from("work_records")
//         .select("worker_id, work_date, work_hours, daily_wage, status, registration_month")
//         .eq("site_id", siteId)
//         .eq("worker_id", workerId)
//         .gte("work_date", monthStart)
//         .lt("work_date", nextMonthStart);

//       if (workError) {
//         console.error(`[DEBUG] 선택월 근무 데이터 조회 오류:`, workError);
//         throw workError;
//       }

//       // 결과가 없는 경우 - registration_month로 조회
//       if (!workRecordsData || workRecordsData.length === 0) {
//         console.log(`[DEBUG] 날짜 기준 데이터 없음, registration_month로 재시도`);

//         const { data: regMonthData, error: regMonthError } = await supabase
//           .from("work_records")
//           .select("worker_id, work_date, work_hours, daily_wage, status, registration_month")
//           .eq("site_id", siteId)
//           .eq("worker_id", workerId)
//           .eq("registration_month", yearMonth);

//         if (!regMonthError && regMonthData && regMonthData.length > 0) {
//           workRecordsData = regMonthData;
//         }
//       }

//       // 선택월 등록 여부 확인
//       const { data: registrationData, error: regError } = await supabase
//         .from("work_records")
//         .select("worker_id, status, registration_month")
//         .eq("site_id", siteId)
//         .eq("worker_id", workerId)
//         .eq("registration_month", yearMonth)
//         .eq("status", "registration");

//       // 근무 기록 필터링 (registration 상태 제외)
//       const workRecords = workRecordsData
//         ? workRecordsData.filter((r) => r.status !== "registration")
//         : [];

//       // 데이터 계산
//       const workDays = workRecords.length;
//       const workHours = workRecords.reduce((sum, r) => sum + (parseFloat(r.work_hours) || 0), 0);
//       const monthlyWage = workRecords.reduce((sum, r) => sum + (parseFloat(r.daily_wage) || 0), 0);
//       const isRegistered = registrationData && registrationData.length > 0;

//       const result = {
//         workDays,
//         workHours,
//         monthlyWage,
//         isRegistered,
//       };

//       console.log(`[DEBUG] 선택월 근무 데이터 계산 결과:`, result);
//       return result;
//     } catch (error) {
//       console.error(`[DEBUG] 선택월 근무 데이터 처리 오류:`, error);
//       return {
//         workDays: 0,
//         workHours: 0,
//         monthlyWage: 0,
//         isRegistered: false,
//       };
//     }
//   },

//   // 최초 근무일 찾기
//   findFirstWorkDate: async (workerId, siteId) => {
//     console.log(`[DEBUG] 최초 근무일 조회 - 근로자 ID: ${workerId}, 현장 ID: ${siteId}`);

//     try {
//       const { data, error } = await supabase
//         .from("work_records")
//         .select("work_date, status")
//         .eq("site_id", siteId)
//         .eq("worker_id", workerId)
//         .neq("status", "registration")
//         .order("work_date", { ascending: true })
//         .limit(1);

//       if (error) {
//         console.error(`[DEBUG] 최초 근무일 조회 오류:`, error);
//         throw error;
//       }

//       const result = data && data.length > 0 ? data[0].work_date : null;
//       console.log(`[DEBUG] 최초 근무일 조회 결과:`, result);
//       return result;
//     } catch (error) {
//       console.error(`[DEBUG] 최초 근무일 조회 처리 오류:`, error);
//       return null;
//     }
//   },

//   // 근로자 분류 함수 추가
//   classifyWorkersByInsuranceStatus: () => {
//     const {
//       registeredWorkers,
//       activeWorkers,
//       inactiveWorkers,
//       enrollmentRecords,
//       workersHistory,
//       selectedYear,
//       selectedMonth,
//     } = get();

//     // 현재 월과 이전 월 계산
//     const currentYearMonth = `${selectedYear}-${selectedMonth}`;
//     const prevDateInfo = getPreviousYearMonthFromSelected(selectedYear, selectedMonth);
//     const prevYearMonth = `${prevDateInfo.prevYear}-${prevDateInfo.prevMonth}`;

//     // 모든 근로자 목록 통합
//     const allWorkers = [...registeredWorkers, ...activeWorkers, ...inactiveWorkers].filter(
//       (v, i, a) => a.findIndex((t) => t.worker_id === v.worker_id) === i
//     );

//     // 결과 객체 초기화
//     const newEnrollmentWorkers = [];
//     const activeEnrollmentWorkers = [];
//     const lossEnrollmentWorkers = [];

//     // 각 근로자에 대해 분류
//     allWorkers.forEach((worker) => {
//       const workerId = worker.worker_id;
//       const enrollments = enrollmentRecords[workerId] || [];
//       const workerHistory = workersHistory[workerId] || {};

//       // 현재 월 근무 여부
//       const hasCurrentMonthWork =
//         workerHistory.currentMonthWorkDays > 0 ||
//         workerHistory.currentMonthWorkHours > 0 ||
//         workerHistory.isRegisteredInCurrentMonth;

//       // 이전 월 근무 여부
//       const hasPreviousMonthWork =
//         workerHistory.previousMonthWorkDays > 0 ||
//         workerHistory.previousMonthWorkHours > 0 ||
//         workerHistory.isPreviousMonthRegistered;

//       // 현재 보험 가입 상태
//       const hasActiveInsurance = enrollments.some((e) => !e.loss_date);

//       // 현재 월에 가입 처리 여부
//       const hasEnrollmentInCurrentMonth = enrollments.some((e) => {
//         if (!e.acquisition_date) return false;
//         const acquisitionDate = new Date(e.acquisition_date);
//         const acquisitionYearMonth = `${acquisitionDate.getFullYear()}-${String(
//           acquisitionDate.getMonth() + 1
//         ).padStart(2, "0")}`;
//         return acquisitionYearMonth === currentYearMonth;
//       });

//       // 이전 월 이전에 가입 처리 여부
//       const hasEnrollmentBeforeCurrentMonth = enrollments.some((e) => {
//         if (!e.acquisition_date) return false;
//         const acquisitionDate = new Date(e.acquisition_date);
//         const acquisitionYearMonth = `${acquisitionDate.getFullYear()}-${String(
//           acquisitionDate.getMonth() + 1
//         ).padStart(2, "0")}`;
//         return acquisitionYearMonth < currentYearMonth;
//       });

//       // 1. 신규 가입 대상자 판별
//       if (
//         hasCurrentMonthWork &&
//         (!hasActiveInsurance || !hasEnrollmentBeforeCurrentMonth) &&
//         !hasEnrollmentInCurrentMonth
//       ) {
//         newEnrollmentWorkers.push(worker);
//       }
//       // 2. 유지 중인 근로자 판별
//       else if (hasEnrollmentBeforeCurrentMonth && hasActiveInsurance && hasCurrentMonthWork) {
//         activeEnrollmentWorkers.push(worker);
//       }
//       // 3. 상실 대상자 판별
//       else if (hasActiveInsurance && !hasCurrentMonthWork && hasPreviousMonthWork) {
//         lossEnrollmentWorkers.push(worker);
//       }
//     });

//     return {
//       newEnrollmentWorkers,
//       activeEnrollmentWorkers,
//       lossEnrollmentWorkers,
//     };
//   },

//   // 근로자별 근무 이력 로드 - 수정
//   // 근로자별 근무 이력 로드 - 수정
//   loadWorkersHistory: async (
//     registeredWorkersList,
//     activeWorkersList = [],
//     inactiveWorkersList = []
//   ) => {
//     const { selectedSite, selectedYear, selectedMonth } = get();
//     console.log(`[DEBUG] 근무 이력 로드 시작`);

//     // 모든 근로자 목록 취합
//     let allWorkers = [...(registeredWorkersList || [])];

//     // 유니크한 worker_id 추적용 Set
//     const workerIds = new Set(allWorkers.map((w) => w.worker_id));

//     // 활성/비활성 근로자 추가 (중복 제거)
//     (activeWorkersList || []).forEach((worker) => {
//       if (!workerIds.has(worker.worker_id)) {
//         allWorkers.push(worker);
//         workerIds.add(worker.worker_id);
//       }
//     });

//     (inactiveWorkersList || []).forEach((worker) => {
//       if (!workerIds.has(worker.worker_id)) {
//         allWorkers.push(worker);
//         workerIds.add(worker.worker_id);
//       }
//     });

//     console.log(`[DEBUG] 이력 로드 대상 근로자 수: ${allWorkers.length}`);

//     if (allWorkers.length === 0) {
//       console.log("[DEBUG] 근로자 목록이 비어 있음, 이력 처리 생략");
//       return {};
//     }

//     // 결과 데이터 객체
//     const historyData = {};
//     const statusData = {};

//     // 병렬 처리를 위한 Promise 배열
//     const historyPromises = allWorkers.map(async (worker) => {
//       try {
//         // 이전월 근무 데이터 (선택월 기준)
//         const prevMonthData = await get().loadPreviousMonthRecords(
//           worker.worker_id,
//           selectedSite,
//           selectedYear,
//           selectedMonth
//         );

//         // 선택월 근무 데이터
//         const currentMonthData = await get().loadCurrentMonthRecords(
//           worker.worker_id,
//           selectedSite,
//           selectedYear,
//           selectedMonth
//         );

//         // 최초 근무일
//         let firstWorkDate = prevMonthData.firstWorkDate;
//         if (!firstWorkDate) {
//           firstWorkDate = await get().findFirstWorkDate(worker.worker_id, selectedSite);
//         }

//         // 근무 이력 데이터 구성 - 필수 필드 추가
//         return {
//           workerId: worker.worker_id,
//           worker,
//           historyData: {
//             previousMonthWorkDays: prevMonthData.workDays || 0,
//             previousMonthWorkHours: prevMonthData.workHours || 0,
//             firstWorkDate: firstWorkDate,
//             currentMonthWorkDays: currentMonthData.workDays || 0,
//             currentMonthWorkHours: currentMonthData.workHours || 0,
//             monthlyWage: currentMonthData.monthlyWage || 0,
//             isRegisteredInCurrentMonth: currentMonthData.isRegistered || false,
//             isPreviousMonthRegistered: prevMonthData.isRegistered || false,
//           },
//         };
//       } catch (error) {
//         console.error(`[DEBUG] 근로자 ID ${worker.worker_id} 이력 로드 오류:`, error);
//         // 오류가 발생해도 기본 데이터 설정
//         return {
//           workerId: worker.worker_id,
//           worker,
//           historyData: {
//             previousMonthWorkDays: 0,
//             previousMonthWorkHours: 0,
//             firstWorkDate: null,
//             currentMonthWorkDays: 0,
//             currentMonthWorkHours: 0,
//             monthlyWage: 0,
//             isRegisteredInCurrentMonth: false,
//             isPreviousMonthRegistered: false,
//           },
//         };
//       }
//     });

//     // 모든 Promise 병렬 처리 후 결과 취합
//     const results = await Promise.all(historyPromises);

//     // 결과 데이터 매핑
//     results.forEach(({ workerId, worker, historyData: workerHistory }) => {
//       historyData[workerId] = workerHistory;
//       statusData[workerId] = determineInsuranceStatus(worker, workerHistory);
//     });

//     // 상태 업데이트
//     set({ workersHistory: historyData });
//     set({ insuranceStatus: statusData });

//     return historyData;
//   },
//   //file: lib/store/useInsuranceStore.js (Part 5)

//   // 보험 가입 정보 로드
//   loadInsuranceEnrollments: async (historyData = null) => {
//     const { selectedSite, selectedYear, selectedMonth } = get();
//     if (!selectedSite) return;

//     try {
//       // 선택된 년/월
//       const yearMonth = `${selectedYear}-${selectedMonth}`;
//       console.log(`[DEBUG] 보험 가입 정보 로드 시작 - 년월: ${yearMonth}`);

//       // 보험 수동 설정 정보 가져오기 - insurance_enrollments 테이블 사용
//       let manualData = [];
//       const { data, error: manualError } = await supabase
//         .from("insurance_enrollments") // insurance_manual_settings 대신 insurance_enrollments 사용
//         .select("*")
//         .eq("site_id", selectedSite)
//         .eq("year_month", yearMonth)
//         .is("insurance_type", null); // 보험 유형이 null인 레코드는 수동 설정으로 간주

//       if (manualError) {
//         console.error(`[DEBUG] 수동 설정 정보 조회 오류:`, manualError);
//         console.log(`[DEBUG] 수동 설정 정보가 없거나 조회 중 오류 발생, 빈 배열로 처리`);
//         // manualData는 이미 빈 배열로 초기화되어 있음
//       } else {
//         manualData = data || [];
//         console.log(`[DEBUG] 수동 설정 정보:`, manualData);
//       }

//       // 수동 설정 데이터 매핑
//       const manualSettingsData = {};
//       if (manualData && manualData.length > 0) {
//         manualData.forEach((setting) => {
//           manualSettingsData[setting.worker_id] = {
//             national_pension_status: setting.national_pension_status || "auto_exempted",
//             health_insurance_status: setting.health_insurance_status || "auto_exempted",
//             employment_insurance_status: setting.employment_insurance_status || "auto_required",
//             industrial_accident_status: setting.industrial_accident_status || "auto_required",
//             manual_reason: setting.manual_reason || "",
//           };
//         });
//       }

//       set({ manualSettings: manualSettingsData });

//       // 모든 보험 가입 이력 가져오기 (상실일 포함) - insurance_type이 null이 아닌 레코드
//       const { data: enrollmentData, error: enrollmentError } = await supabase
//         .from("insurance_enrollments")
//         .select("*")
//         .eq("site_id", selectedSite)
//         .not("insurance_type", "is", null); // 보험 유형이 있는 레코드만 가져옴

//       if (enrollmentError) {
//         console.error(`[DEBUG] 보험 가입 이력 조회 오류:`, enrollmentError);
//         throw enrollmentError;
//       }

//       // 보험 가입 이력 정리
//       const enrollmentsByWorker = {};
//       if (enrollmentData && enrollmentData.length > 0) {
//         enrollmentData.forEach((enrollment) => {
//           if (!enrollmentsByWorker[enrollment.worker_id]) {
//             enrollmentsByWorker[enrollment.worker_id] = [];
//           }
//           enrollmentsByWorker[enrollment.worker_id].push(enrollment);
//         });
//       }

//       set({ enrollmentRecords: enrollmentsByWorker });

//       // 보험 상태 업데이트 (이력 데이터가 제공된 경우)
//       if (historyData) {
//         const { registeredWorkers, activeWorkers, inactiveWorkers } = get();
//         const updatedStatusData = {};

//         Object.entries(historyData).forEach(([workerId, history]) => {
//           // 해당 근로자 찾기
//           let worker =
//             registeredWorkers.find((w) => w.worker_id.toString() === workerId) ||
//             activeWorkers.find((w) => w.worker_id.toString() === workerId) ||
//             inactiveWorkers.find((w) => w.worker_id.toString() === workerId);

//           if (worker) {
//             updatedStatusData[workerId] = determineInsuranceStatus(worker, history);
//           }
//         });

//         // 기존 상태와 새 상태 병합
//         set((state) => ({ insuranceStatus: { ...state.insuranceStatus, ...updatedStatusData } }));
//       }
//     } catch (error) {
//       console.error("[DEBUG] 보험 가입 정보 로드 오류:", error);
//     }
//   },

//   // 상태 설정 관련 함수들
//   setSelectedSite: (siteId) => {
//     set({ selectedSite: siteId });
//     if (siteId) {
//       get().loadAllWorkersData();
//     }
//   },

//   setSelectedYearMonth: (year, month) => {
//     set({ selectedYear: year, selectedMonth: month });
//     const { selectedSite } = get();
//     if (selectedSite) {
//       get().loadAllWorkersData();
//     }
//   },

//   setActiveTab: (tabIndex) => {
//     set({ activeTab: tabIndex });
//   },

//   setSelectedWorkerId: (workerId) => {
//     const { selectedWorkerId, showDetail } = get();

//     if (selectedWorkerId === workerId && showDetail) {
//       set({ showDetail: false, selectedWorkerId: null });
//     } else {
//       set({ selectedWorkerId: workerId, showDetail: true });
//     }
//   },
//   //file: lib/store/useInsuranceStore.js (Part 6)

//   // 보험 상태 수동 변경 처리
//   handleInsuranceStatusChange: async (workerId, insuranceType, newStatus) => {
//     try {
//       console.log(
//         `[DEBUG] 보험 상태 수동 변경 - 근로자 ID: ${workerId}, 보험 타입: ${insuranceType}, 상태: ${newStatus}`
//       );

//       // 현재 설정 복사
//       const {
//         manualSettings,
//         insuranceStatus,
//         selectedSite,
//         selectedYear,
//         selectedMonth,
//         workersHistory,
//       } = get();
//       const updatedSettings = { ...manualSettings };

//       // 해당 근로자의 설정이 없으면 생성
//       if (!updatedSettings[workerId]) {
//         updatedSettings[workerId] = {
//           national_pension_status: insuranceStatus[workerId]?.nationalPension?.required
//             ? "auto_required"
//             : "auto_exempted",
//           health_insurance_status: insuranceStatus[workerId]?.healthInsurance?.required
//             ? "auto_required"
//             : "auto_exempted",
//           employment_insurance_status: insuranceStatus[workerId]?.employmentInsurance?.required
//             ? "auto_required"
//             : "auto_exempted",
//           industrial_accident_status: "auto_required", // 산재는 항상 필수
//           manual_reason: "",
//         };
//       }

//       // 상태 업데이트
//       const statusKey = `${insuranceType}_status`;
//       updatedSettings[workerId][statusKey] = newStatus;

//       // 상태 업데이트
//       set({ manualSettings: updatedSettings });

//       // DB 저장
//       const yearMonth = `${selectedYear}-${selectedMonth}`;

//       // 기존 레코드 확인
//       const { data: existingRecord, error: existingError } = await supabase
//         .from("insurance_manual_settings")
//         .select("*")
//         .eq("worker_id", workerId)
//         .eq("site_id", selectedSite)
//         .eq("year_month", yearMonth)
//         .maybeSingle();

//       if (existingError) {
//         console.error("기존 설정 조회 오류:", existingError);
//       }

//       // 워커 히스토리 데이터 준비
//       const workerHistory = workersHistory[workerId] || {};

//       // Upsert용 데이터 준비
//       const settingData = {
//         worker_id: workerId,
//         site_id: selectedSite,
//         year_month: yearMonth,
//         national_pension_status: updatedSettings[workerId].national_pension_status,
//         health_insurance_status: updatedSettings[workerId].health_insurance_status,
//         employment_insurance_status: updatedSettings[workerId].employment_insurance_status,
//         industrial_accident_status: updatedSettings[workerId].industrial_accident_status,
//         manual_reason: updatedSettings[workerId].manual_reason,
//         previous_month_work_days: workerHistory.previousMonthWorkDays || 0,
//         previous_month_work_hours: workerHistory.previousMonthWorkHours || 0,
//         current_month_work_days: workerHistory.currentMonthWorkDays || 0,
//         current_month_work_hours: workerHistory.currentMonthWorkHours || 0,
//         first_work_date: workerHistory.firstWorkDate,
//         created_by: "system", // 실제 구현 시 현재 사용자 ID로 교체 필요
//         updated_by: "system", // 실제 구현 시 현재 사용자 ID로 교체 필요
//         updated_at: new Date().toISOString(),
//       };

//       // 기존 레코드가 없는 경우 created_at 추가
//       if (!existingRecord) {
//         settingData.created_at = new Date().toISOString();
//       }

//       // Upsert 수행
//       const { error } = await supabase.from("insurance_manual_settings").upsert(settingData, {
//         onConflict: "worker_id,site_id,year_month",
//         returning: "minimal",
//       });

//       if (error) {
//         console.error(`[DEBUG] 보험 상태 변경 DB 저장 오류:`, error);
//         throw error;
//       }

//       console.log(`[DEBUG] 보험 상태 변경 저장 성공`);
//       return { success: true, message: "보험 상태가 변경되었습니다." };
//     } catch (error) {
//       console.error("[DEBUG] 보험 상태 변경 오류:", error);
//       return {
//         success: false,
//         message: `보험 상태 변경 중 오류가 발생했습니다: ${error.message || "알 수 없는 오류"}`,
//       };
//     }
//   },

//   // 사유 업데이트 처리
//   handleReasonUpdate: async (workerId, reason) => {
//     try {
//       console.log(`[DEBUG] 사유 업데이트 시작 - 근로자 ID: ${workerId}, 사유: ${reason}`);

//       // 현재 설정 복사
//       const {
//         manualSettings,
//         insuranceStatus,
//         selectedSite,
//         selectedYear,
//         selectedMonth,
//         workersHistory,
//       } = get();
//       const updatedSettings = { ...manualSettings };

//       // 해당 근로자의 설정이 없으면 생성
//       if (!updatedSettings[workerId]) {
//         updatedSettings[workerId] = {
//           national_pension_status: insuranceStatus[workerId]?.nationalPension?.required
//             ? "auto_required"
//             : "auto_exempted",
//           health_insurance_status: insuranceStatus[workerId]?.healthInsurance?.required
//             ? "auto_required"
//             : "auto_exempted",
//           employment_insurance_status: insuranceStatus[workerId]?.employmentInsurance?.required
//             ? "auto_required"
//             : "auto_exempted",
//           industrial_accident_status: "auto_required", // 산재는 항상 필수
//           manual_reason: reason,
//         };
//       } else {
//         updatedSettings[workerId].manual_reason = reason;
//       }

//       // 상태 업데이트 - UI 즉시 반영
//       set({ manualSettings: updatedSettings });

//       // DB 저장
//       const yearMonth = `${selectedYear}-${selectedMonth}`;

//       // 워커 히스토리 데이터
//       const workerHistory = workersHistory[workerId] || {};

//       // 기존 데이터 조회
//       const { data: existingData, error: existingError } = await supabase
//         .from("insurance_manual_settings")
//         .select("*")
//         .eq("worker_id", workerId)
//         .eq("site_id", selectedSite)
//         .eq("year_month", yearMonth)
//         .maybeSingle();

//       if (existingError) {
//         console.error("기존 설정 조회 오류:", existingError);
//         // 오류 발생해도 계속 진행
//       }

//       // 저장할 데이터 준비
//       const settingData = {
//         worker_id: workerId,
//         site_id: selectedSite,
//         year_month: yearMonth,
//         national_pension_status: updatedSettings[workerId].national_pension_status,
//         health_insurance_status: updatedSettings[workerId].health_insurance_status,
//         employment_insurance_status: updatedSettings[workerId].employment_insurance_status,
//         industrial_accident_status: updatedSettings[workerId].industrial_accident_status,
//         manual_reason: reason, // 업데이트된 사유
//         previous_month_work_days: workerHistory.previousMonthWorkDays || 0,
//         previous_month_work_hours: workerHistory.previousMonthWorkHours || 0,
//         current_month_work_days: workerHistory.currentMonthWorkDays || 0,
//         current_month_work_hours: workerHistory.currentMonthWorkHours || 0,
//         first_work_date: workerHistory.firstWorkDate,
//         updated_by: "system", // 실제 구현 시 현재 사용자 ID로 교체 필요
//         updated_at: new Date().toISOString(),
//       };

//       // 새 레코드인 경우 생성 정보 추가
//       if (!existingData) {
//         settingData.created_by = "system"; // 실제 구현 시 현재 사용자 ID로 교체 필요
//         settingData.created_at = new Date().toISOString();
//       }

//       // Upsert 수행
//       const { error } = await supabase.from("insurance_manual_settings").upsert(settingData, {
//         onConflict: "worker_id,site_id,year_month",
//         returning: "minimal",
//       });

//       if (error) {
//         console.error(`[DEBUG] 사유 업데이트 DB 저장 오류:`, error);
//         throw error;
//       }

//       console.log(`[DEBUG] 사유 업데이트 성공`);
//       return { success: true, message: "사유가 업데이트되었습니다." };
//     } catch (error) {
//       console.error("[DEBUG] 사유 업데이트 오류:", error);
//       return {
//         success: false,
//         message: `사유 업데이트 중 오류가 발생했습니다: ${error.message || "알 수 없는 오류"}`,
//       };
//     }
//   },
//   //file: lib/store/useInsuranceStore.js (Part 7)

//   // 보험 가입 처리
//   handleInsuranceAcquisition: async (workerId) => {
//     try {
//       set({ isLoading: true });
//       const {
//         selectedSite,
//         selectedYear,
//         selectedMonth,
//         insuranceStatus,
//         manualSettings,
//         workersHistory,
//       } = get();
//       console.log(`[DEBUG] 보험 가입 처리 시작 - 근로자 ID: ${workerId}`);

//       // 근로자 데이터 확인
//       const worker = get().registeredWorkers.find((w) => w.worker_id === workerId);
//       if (!worker) {
//         console.error(`[DEBUG] 근로자 ID ${workerId}를 찾을 수 없음`);
//         return { success: false, message: "근로자 정보를 찾을 수 없습니다." };
//       }

//       // 이력 데이터 확인
//       const workerHistory = workersHistory[workerId];
//       if (!workerHistory) {
//         console.error(`[DEBUG] 근로자 ID ${workerId}의 이력 데이터가 없음, 이력 생성 필요`);
//         // 이력 데이터가 없을 경우, 먼저 이력 데이터 생성
//         await get().loadWorkersHistory([worker]);
//       }

//       // 가입일 설정 (당일)
//       const today = new Date();
//       const acquisitionDate = today.toISOString().split("T")[0]; // YYYY-MM-DD 형식
//       const yearMonth = `${selectedYear}-${selectedMonth}`;

//       // 보험 상태 확인 (최신 상태 사용)
//       const currentWorkerStatus = insuranceStatus[workerId] || {
//         nationalPension: { required: false },
//         healthInsurance: { required: false },
//         employmentInsurance: { required: true },
//         industrialAccident: { required: true },
//       };

//       // 수동 설정 확인
//       const currentManualSetting = manualSettings[workerId] || {};

//       // 보험별 상태 결정 (수동 설정 우선)
//       const nationalPensionRequired =
//         currentManualSetting.national_pension_status?.includes("required") ||
//         (!currentManualSetting.national_pension_status &&
//           currentWorkerStatus.nationalPension.required);

//       const healthInsuranceRequired =
//         currentManualSetting.health_insurance_status?.includes("required") ||
//         (!currentManualSetting.health_insurance_status &&
//           currentWorkerStatus.healthInsurance.required);

//       const employmentInsuranceRequired =
//         currentManualSetting.employment_insurance_status?.includes("required") ||
//         (!currentManualSetting.employment_insurance_status &&
//           currentWorkerStatus.employmentInsurance.required);

//       const industrialAccidentRequired =
//         currentManualSetting.industrial_accident_status?.includes("required") ||
//         (!currentManualSetting.industrial_accident_status &&
//           currentWorkerStatus.industrialAccident.required);

//       // 가입 처리할 보험 목록
//       const insuranceTypes = [
//         { type: "national_pension", required: nationalPensionRequired },
//         { type: "health_insurance", required: healthInsuranceRequired },
//         { type: "employment_insurance", required: employmentInsuranceRequired },
//         { type: "industrial_accident", required: industrialAccidentRequired },
//       ];

//       console.log(`[DEBUG] 가입 처리할 보험:`, insuranceTypes);

//       // 처리 결과 추적
//       let successCount = 0;
//       let errorMessages = [];

//       for (const insurance of insuranceTypes) {
//         if (insurance.required) {
//           try {
//             console.log(`[DEBUG] ${insurance.type} 가입 처리 중`);

//             // 이미 가입된 상태인지 확인 (상실되지 않은 기록 확인)
//             const { data: existingEnrollment, error: checkError } = await supabase
//               .from("insurance_enrollments")
//               .select("enrollment_id")
//               .eq("site_id", selectedSite)
//               .eq("worker_id", workerId)
//               .eq("insurance_type", insurance.type)
//               .is("loss_date", null)
//               .maybeSingle();

//             if (checkError) {
//               console.error(`[DEBUG] 기존 가입 확인 오류:`, checkError);
//               errorMessages.push(`${insurance.type} 확인 오류: ${checkError.message}`);
//               continue;
//             }

//             // 가입되어 있지 않은 경우에만 새로 가입
//             if (!existingEnrollment) {
//               const monthlyWage = workersHistory[workerId]?.monthlyWage || 0;

//               const { data: insertData, error: insertError } = await supabase
//                 .from("insurance_enrollments")
//                 .insert({
//                   worker_id: workerId,
//                   site_id: selectedSite,
//                   year_month: yearMonth,
//                   insurance_type: insurance.type,
//                   acquisition_date: acquisitionDate,
//                   acquisition_reason_code: "01", // 신규 취득
//                   monthly_wage: monthlyWage,
//                   created_by: "system", // 실제 구현 시 현재 사용자 ID로 교체 필요
//                   updated_by: "system", // 실제 구현 시 현재 사용자 ID로 교체 필요
//                   created_at: new Date().toISOString(),
//                   updated_at: new Date().toISOString(),
//                 });

//               //file: lib/store/useInsuranceStore.js (Part 7 - 계속)

//               if (insertError) {
//                 console.error(`[DEBUG] 보험 가입 DB 저장 오류:`, insertError);
//                 errorMessages.push(`${insurance.type} 가입 오류: ${insertError.message}`);
//                 continue;
//               }

//               console.log(`[DEBUG] ${insurance.type} 가입 처리 성공`);
//               successCount++;
//             } else {
//               console.log(`[DEBUG] ${insurance.type} 이미 가입됨, 처리 생략`);
//               successCount++;
//             }
//           } catch (error) {
//             console.error(`[DEBUG] ${insurance.type} 보험 가입 처리 오류:`, error);
//             errorMessages.push(
//               `${insurance.type} 가입 처리 오류: ${error.message || "알 수 없는 오류"}`
//             );
//           }
//         } else {
//           console.log(`[DEBUG] ${insurance.type} 필수 아님, 가입 처리 생략`);
//         }
//       }

//       // 데이터 다시 로드
//       await get().loadAllWorkersData();

//       set({ isLoading: false });

//       // 결과 반환
//       if (successCount > 0) {
//         return {
//           success: true,
//           message:
//             errorMessages.length > 0
//               ? `일부 보험 가입이 완료되었습니다. (${successCount}개 성공, ${errorMessages.length}개 실패)`
//               : "보험 가입 처리가 완료되었습니다.",
//         };
//       } else {
//         return {
//           success: false,
//           message: `보험 가입 처리 중 오류가 발생했습니다: ${errorMessages.join(", ")}`,
//         };
//       }
//     } catch (error) {
//       console.error("[DEBUG] 보험 가입 처리 오류:", error);
//       set({ isLoading: false });
//       return {
//         success: false,
//         message: `보험 가입 처리 중 오류가 발생했습니다: ${error.message || "알 수 없는 오류"}`,
//       };
//     }
//   },

//   // 보험 상실 처리
//   handleInsuranceLoss: async (workerId) => {
//     try {
//       set({ isLoading: true });
//       const { selectedSite } = get();
//       console.log(`[DEBUG] 보험 상실 처리 시작 - 근로자 ID: ${workerId}`);

//       // 상실일 설정 (당일)
//       const today = new Date();
//       const lossDate = today.toISOString().split("T")[0]; // YYYY-MM-DD 형식

//       // insurance_enrollments 테이블에서 loss_date가 null인 해당 근로자 보험 기록 찾기
//       const { data: enrollments, error: findError } = await supabase
//         .from("insurance_enrollments")
//         .select("enrollment_id, insurance_type")
//         .eq("site_id", selectedSite)
//         .eq("worker_id", workerId)
//         .is("loss_date", null);

//       if (findError) {
//         console.error(`[DEBUG] 상실 처리할 보험 조회 오류:`, findError);
//         throw findError;
//       }

//       console.log(`[DEBUG] 상실 처리할 보험 기록:`, enrollments);

//       if (!enrollments || enrollments.length === 0) {
//         console.log(`[DEBUG] 상실 처리할 보험 가입 정보 없음`);
//         set({ isLoading: false });
//         return {
//           success: false,
//           message: "상실 처리할 보험 가입 정보가 없습니다.",
//         };
//       }

//       // 모든 보험 기록 상실 처리
//       const enrollmentIds = enrollments.map((e) => e.enrollment_id);

//       // 상실 처리
//       const { error: updateError } = await supabase
//         .from("insurance_enrollments")
//         .update({
//           loss_date: lossDate,
//           updated_by: "system", // 실제 구현 시 현재 사용자 ID로 교체 필요
//           updated_at: new Date().toISOString(),
//         })
//         .in("enrollment_id", enrollmentIds);

//       if (updateError) {
//         console.error(`[DEBUG] 상실 처리 DB 업데이트 오류:`, updateError);
//         throw updateError;
//       }

//       console.log(`[DEBUG] 보험 상실 처리 완료 - 상실일: ${lossDate}`);

//       // 데이터 다시 로드
//       await get().loadAllWorkersData();

//       set({ isLoading: false });
//       return {
//         success: true,
//         message: "보험 상실 처리가 완료되었습니다.",
//       };
//     } catch (error) {
//       console.error("[DEBUG] 보험 상실 처리 오류:", error);
//       set({ isLoading: false });
//       return {
//         success: false,
//         message: `보험 상실 처리 중 오류가 발생했습니다: ${error.message || "알 수 없는 오류"}`,
//       };
//     }
//   },
//   //file: lib/store/useInsuranceStore.js (Part 8 - 마지막 부분)

//   // 상태 스타일 및 텍스트 처리 유틸리티 함수들
//   getStatusStyle: (status) => {
//     if (status.startsWith("manual_")) {
//       return status === "manual_required"
//         ? "bg-blue-100 text-blue-800 border-blue-300"
//         : "bg-gray-100 text-gray-800 border-gray-300";
//     } else {
//       return status === "auto_required"
//         ? "bg-green-100 text-green-800 border-green-300"
//         : "bg-red-100 text-red-800 border-red-300";
//     }
//   },

//   getStatusText: (status) => {
//     switch (status) {
//       case "auto_required":
//         return "자동 적용";
//       case "auto_exempted":
//         return "자동 제외";
//       case "manual_required":
//         return "수동 적용";
//       case "manual_exempted":
//         return "수동 제외";
//       default:
//         return "상태 없음";
//     }
//   },

//   // 보험별 가입 상태 확인
//   isEnrolled: (workerId, insuranceType) => {
//     const { enrollmentRecords } = get();
//     const enrollments = enrollmentRecords[workerId] || [];
//     return enrollments.some((e) => e.insurance_type === insuranceType && !e.loss_date);
//   },

//   // 실제 상태값 가져오기 (자동 또는 수동)
//   getEffectiveStatus: (workerId, insuranceType) => {
//     const { manualSettings, insuranceStatus } = get();

//     // 수동 설정이 있으면 우선 적용
//     if (manualSettings[workerId] && manualSettings[workerId][`${insuranceType}_status`]) {
//       return manualSettings[workerId][`${insuranceType}_status`];
//     }

//     // 자동 판단 결과
//     const autoStatus = insuranceStatus[workerId];
//     if (!autoStatus) return "auto_exempted";

//     switch (insuranceType) {
//       case "national_pension":
//         return autoStatus.nationalPension?.required ? "auto_required" : "auto_exempted";
//       case "health_insurance":
//         return autoStatus.healthInsurance?.required ? "auto_required" : "auto_exempted";
//       case "employment_insurance":
//         return autoStatus.employmentInsurance?.required ? "auto_required" : "auto_exempted";
//       case "industrial_accident":
//         return "auto_required"; // 산재는 항상 필수
//       default:
//         return "auto_exempted";
//     }
//   },

//   // 신규 가입 대상자 조회
//   getNewEnrollmentCandidateWorkers: () => {
//     const result = get().classifyWorkersByInsuranceStatus();
//     return result.newEnrollmentWorkers;
//   },

//   // 유지 중인 근로자 조회
//   getActiveEnrollmentWorkers: () => {
//     const result = get().classifyWorkersByInsuranceStatus();
//     return result.activeEnrollmentWorkers;
//   },

//   // 상실 대상자 조회
//   getLossEnrollmentCandidateWorkers: () => {
//     const result = get().classifyWorkersByInsuranceStatus();
//     return result.lossEnrollmentWorkers;
//   },
// }));

// export default useInsuranceStore;

//file: lib/store/useInsuranceStore.js
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
 * 하위 호환성 유지를 위한 파사드 역할을 하며,
 * 실제 기능은 분리된 스토어들이 담당
 */
const useInsuranceStore = create((set, get) => ({
  // 기본 상태 - 하위 호환성 유지용
  activeTab: 0,
  isLoading: false,
  error: null,

  // 하위 호환용 초기화 함수
  initialize: async (userId) => {
    try {
      set({ isLoading: true, error: null });

      // 각 스토어 초기화
      await useSiteStore.getState().initialize(userId);

      set({ isLoading: false });
    } catch (error) {
      console.error("초기화 오류:", error);
      set({ isLoading: false, error: error.message });
    }
  },

  // 현장 선택
  setSelectedSite: (siteId) => {
    useSiteStore.getState().setSelectedSite(siteId);
  },

  // 년월 선택
  setSelectedYearMonth: (year, month) => {
    // 현재 년월 상태 업데이트 (스토어들은 각자 자체적으로 상태 관리)
    set((state) => ({
      selectedYear: year,
      selectedMonth: month,
    }));

    // 필요한 경우 다시 데이터 로드
    const siteId = useSiteStore.getState().selectedSite;
    if (siteId) {
      // 현재 선택된 년월 기준으로 근로자 목록 다시 로드
      useWorkerStore.getState().loadWorkers(siteId, `${year}-${month}`);
    }
  },

  // 탭 선택
  setActiveTab: (tabIndex) => {
    set({ activeTab: tabIndex });
  },

  // 근로자 선택
  setSelectedWorkerId: (workerId) => {
    useWorkerStore.getState().setSelectedWorkerId(workerId);
  },

  // 모든 근로자 데이터 로드 (하위 호환용 통합 함수)
  loadAllWorkersData: async () => {
    try {
      set({ isLoading: true, error: null });

      // 사이트와 년월 가져오기
      const siteId = useSiteStore.getState().selectedSite;
      const { selectedYear, selectedMonth } = get();
      const yearMonth = `${selectedYear}-${selectedMonth.padStart(2, "0")}`;

      if (!siteId || !yearMonth) {
        set({ isLoading: false });
        return;
      }

      // 근로자 목록 로드
      await useWorkerStore.getState().loadWorkers(siteId, yearMonth);

      set({ isLoading: false });
    } catch (error) {
      console.error("데이터 로드 오류:", error);
      set({ isLoading: false, error: error.message });
    }
  },

  // 근로자 이력 로드 (하위 호환용)
  loadWorkersHistory: async (registeredWorkers) => {
    try {
      // 사이트와 년월 가져오기
      const siteId = useSiteStore.getState().selectedSite;
      const { selectedYear, selectedMonth } = get();
      const yearMonth = `${selectedYear}-${selectedMonth.padStart(2, "0")}`;

      if (!siteId || !yearMonth || !registeredWorkers) return {};

      return await useWorkHistoryStore
        .getState()
        .loadMultipleWorkersHistory(registeredWorkers, siteId, yearMonth);
    } catch (error) {
      console.error("근로자 이력 로드 오류:", error);
      return {};
    }
  },

  // 보험 가입 정보 로드 (하위 호환용)
  loadInsuranceEnrollments: async (historyData) => {
    try {
      const siteId = useSiteStore.getState().selectedSite;

      if (!siteId || !historyData) return {};

      // 모든 근로자의 가입 정보 로드
      const enrollmentData = {};

      for (const workerId of Object.keys(historyData)) {
        const enrollments = await useInsuranceEnrollmentStore
          .getState()
          .loadInsuranceEnrollments(workerId, siteId);

        enrollmentData[workerId] = enrollments;
      }

      return enrollmentData;
    } catch (error) {
      console.error("보험 가입 정보 로드 오류:", error);
      return {};
    }
  },

  // 보험 상태 업데이트 (하위 호환용)
  handleInsuranceStatusChange: async (workerId, insuranceType, newStatus) => {
    try {
      const siteId = useSiteStore.getState().selectedSite;
      const { selectedYear, selectedMonth } = get();
      const yearMonth = `${selectedYear}-${selectedMonth.padStart(2, "0")}`;

      if (!workerId || !siteId || !yearMonth || !insuranceType) {
        return { success: false, message: "필수 정보가 누락되었습니다." };
      }

      // 상태 객체 수정 (UI만 반영)
      const cacheKey = `${workerId}-${siteId}-${yearMonth}`;

      // 현재 상태 가져오기
      const { manualSettings, insuranceStatus } = useInsuranceStatusStore.getState();
      const currentManualSetting = manualSettings[cacheKey] || {};

      // 수정할 필드와 값 설정
      const statusField = `${insuranceType}_status`;

      // UI용 임시 상태 업데이트 (캐싱만)
      useInsuranceStatusStore.setState((state) => ({
        manualSettings: {
          ...state.manualSettings,
          [cacheKey]: {
            ...currentManualSetting,
            [statusField]: newStatus,
          },
        },
      }));

      // 보험 상태 캐시 무효화하여 다시 계산되도록 함
      useInsuranceStatusStore.setState((state) => ({
        insuranceStatus: { ...state.insuranceStatus, [cacheKey]: undefined },
      }));

      // 다시 계산
      await useInsuranceStatusStore.getState().loadInsuranceStatus(workerId, siteId, yearMonth);

      return {
        success: true,
        message: "보험 상태가 변경되었습니다. 변경사항을 저장하려면 '저장' 버튼을 클릭하세요.",
      };
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
      const yearMonth = `${selectedYear}-${selectedMonth.padStart(2, "0")}`;

      if (!workerId || !siteId || !yearMonth) {
        return { success: false, message: "필수 정보가 누락되었습니다." };
      }

      // 캐시 키 생성
      const cacheKey = `${workerId}-${siteId}-${yearMonth}`;

      // 현재 수동 설정 가져오기
      const { manualSettings } = useInsuranceStatusStore.getState();
      const currentManualSetting = manualSettings[cacheKey] || {};

      // UI용 임시 상태 업데이트 (캐싱만)
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

  // 보험 가입 처리 (하위 호환용)
  handleInsuranceAcquisition: async (workerId) => {
    try {
      const siteId = useSiteStore.getState().selectedSite;
      const { selectedYear, selectedMonth } = get();
      const yearMonth = `${selectedYear}-${selectedMonth.padStart(2, "0")}`;

      if (!workerId || !siteId || !yearMonth) {
        return { success: false, message: "필수 정보가 누락되었습니다." };
      }
      // 현재 보험 상태 가져오기
      const workerHistory = await useWorkHistoryStore
        .getState()
        .loadWorkersHistory(workerId, siteId, yearMonth);

      if (!workerHistory) {
        return { success: false, message: "근로자 이력 정보를 가져올 수 없습니다." };
      }

      // 보험 상태 계산
      const insuranceStatus = await useInsuranceStatusStore
        .getState()
        .loadInsuranceStatus(workerId, siteId, yearMonth, null, workerHistory);

      if (!insuranceStatus) {
        return { success: false, message: "보험 상태 정보를 계산할 수 없습니다." };
      }

      // 가입이 필요한 보험 타입 확인
      const insuranceTypes = [];

      if (insuranceStatus.nationalPension.required) {
        insuranceTypes.push("national_pension");
      }

      if (insuranceStatus.healthInsurance.required) {
        insuranceTypes.push("health_insurance");
      }

      if (insuranceStatus.employmentInsurance.required) {
        insuranceTypes.push("employment_insurance");
      }

      if (insuranceStatus.industrialAccident.required) {
        insuranceTypes.push("industrial_accident");
      }

      // 가입할 보험이 없는 경우
      if (insuranceTypes.length === 0) {
        return { success: false, message: "가입이 필요한 보험이 없습니다." };
      }

      // 월급여 설정
      const monthlyWage = workerHistory.monthlyWage || 0;

      // 가입 처리
      return await useInsuranceEnrollmentStore
        .getState()
        .handleInsuranceAcquisition(workerId, siteId, yearMonth, insuranceTypes, monthlyWage);
    } catch (error) {
      console.error("보험 가입 처리 오류:", error);
      return { success: false, message: `보험 가입 처리 중 오류 발생: ${error.message}` };
    }
  },

  // 보험 상실 처리 (하위 호환용)
  handleInsuranceLoss: async (workerId) => {
    try {
      const siteId = useSiteStore.getState().selectedSite;

      if (!workerId || !siteId) {
        return { success: false, message: "필수 정보가 누락되었습니다." };
      }

      return await useInsuranceEnrollmentStore.getState().handleInsuranceLoss(workerId, siteId);
    } catch (error) {
      console.error("보험 상실 처리 오류:", error);
      return { success: false, message: `보험 상실 처리 중 오류 발생: ${error.message}` };
    }
  },

  // 근로자 분류 함수 (하위 호환용)
  classifyWorkersByInsuranceStatus: () => {
    try {
      // 각 스토어에서 데이터 가져오기
      const { registeredWorkers, activeWorkers, inactiveWorkers } = useWorkerStore.getState();
      const { workersHistory } = useWorkHistoryStore.getState();
      const { enrollmentRecords } = useInsuranceEnrollmentStore.getState();

      // 등록된 근로자와 활성 근로자 결합 (중복 제거)
      const allWorkers = [...registeredWorkers, ...activeWorkers, ...inactiveWorkers];
      const uniqueWorkers = [];
      const workerIds = new Set();

      allWorkers.forEach((worker) => {
        if (!workerIds.has(worker.worker_id)) {
          uniqueWorkers.push(worker);
          workerIds.add(worker.worker_id);
        }
      });

      // 분류 수행
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

  // 보험별 가입 상태 확인 (하위 호환용)
  isEnrolled: (workerId, insuranceType) => {
    const siteId = useSiteStore.getState().selectedSite;

    if (!workerId || !siteId || !insuranceType) return false;

    return useInsuranceEnrollmentStore.getState().isEnrolled(workerId, siteId, insuranceType);
  },

  // 실제 상태값 가져오기 (하위 호환용)
  getEffectiveStatus: (workerId, insuranceType) => {
    const siteId = useSiteStore.getState().selectedSite;
    const { selectedYear, selectedMonth } = get();
    const yearMonth = `${selectedYear}-${selectedMonth.padStart(2, "0")}`;

    if (!workerId || !siteId || !yearMonth || !insuranceType) return null;

    return useInsuranceStatusStore
      .getState()
      .getEffectiveStatus(workerId, siteId, yearMonth, insuranceType);
  },

  // 상태 스타일 및 텍스트 유틸리티 함수 (하위 호환용)
  getStatusStyle: (status) => {
    return useInsuranceStatusStore.getState().getStatusStyle(status);
  },

  getStatusText: (status) => {
    return useInsuranceStatusStore.getState().getStatusText(status);
  },

  resetStore: () => {
    // 자체 상태 초기화
    set({
      activeTab: 0,
      isLoading: false,
      error: null,
    });

    // 다른 모든 관련 스토어 초기화
    useSiteStore.getState().resetStore();
    useWorkerStore.getState().resetStore();
    useWorkHistoryStore.getState().resetStore();
    useInsuranceStatusStore.getState().resetStore();
    useInsuranceEnrollmentStore.getState().resetStore();
  },

  // 오류 지우기 (하위 호환용)
  clearError: () => {
    set({ error: null });
    useSiteStore.getState().clearError();
    useWorkerStore.getState().clearError();
    useWorkHistoryStore.getState().clearError();
    useInsuranceStatusStore.getState().clearError();
    useInsuranceEnrollmentStore.getState().clearError();
  },

  // 유틸리티 함수들 (하위 호환용)
  formatResidentNumber,
  formatPhoneNumber,
  calculateAgeFromResidentNumber,
  getPreviousYearMonthFromSelected,
}));

export default useInsuranceStore;
