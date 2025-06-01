// lib/store/payrollStore.js
import { create } from "zustand";
import { supabase } from "@/lib/supabase";
import { toast } from "react-toastify";

/*
=== DB 트리거 함수들 ===
1. calculate_work_hours_and_allowances(): 근무시간과 수당을 자동 계산
   - work_hours = regular_hours + overtime_hours + night_hours + holiday_hours
   - overtime_allowance = overtime_hours × hourly_rate × 0.5
   - night_allowance = night_hours × hourly_rate × 0.5
   - holiday_allowance = holiday_hours × hourly_rate × 0.5

2. update_daily_work_report_totals(): daily_work_reports 총계 자동 업데이트
   - daily_work_report_details 변경 시 자동으로 총계 재계산
*/

const usePayrollStore = create((set, get) => ({
  // 상태
  yearMonth: new Date().toISOString().substring(0, 7), // YYYY-MM 형식
  selectedSite: null,
  loading: false,
  error: null,
  workerData: [],
  dailySummaries: {},
  payrollSummary: {
    totalWorkers: 0,
    totalWorkDays: 0,
    totalPaid: 0,
    totalUnpaid: 0,
  },
  showPaymentModal: false,
  showBulkPaymentModal: false,
  showPayslipModal: false,
  paymentInfo: null,
  bulkPaymentInfo: null,
  payslipInfo: null,

  // 액션
  setYearMonth: (yearMonth) => set({ yearMonth }),
  setSelectedSite: (siteId) => {
    const prevSiteId = get().selectedSite;
    set({ selectedSite: siteId });

    console.log(`payrollStore: 현장 ID 변경됨 ${prevSiteId} -> ${siteId}`);

    if (prevSiteId !== siteId && siteId) {
      console.log(`새 현장 ID로 데이터 로드 시작: ${siteId}`);
      setTimeout(() => {
        get().fetchDailyWorkerPayrollData();
      }, 0);
    }
  },
  setShowPaymentModal: (show) => set({ showPaymentModal: show }),
  setShowBulkPaymentModal: (show) => set({ showBulkPaymentModal: show }),
  setShowPayslipModal: (show) => set({ showPayslipModal: show }),
  setPaymentInfo: (info) => set({ paymentInfo: info }),
  setBulkPaymentInfo: (info) => set({ bulkPaymentInfo: info }),
  setPayslipInfo: (info) => set({ payslipInfo: info }),

  // 데이터 로드 - 새로운 DB 스키마 필드들 포함
  fetchDailyWorkerPayrollData: async () => {
    const { selectedSite, yearMonth } = get();
    console.log("fetchDailyWorkerPayrollData 실행:", { selectedSite, yearMonth });

    if (!selectedSite || !yearMonth) {
      set({ loading: false });
      return;
    }

    try {
      set({ loading: true, error: null });
      console.log("DB 쿼리 시작: 작업 기록 조회");

      const year = parseInt(yearMonth.split("-")[0]);
      const month = parseInt(yearMonth.split("-")[1]);
      const startDate = `${yearMonth}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${yearMonth}-${lastDay}`;

      // 🔥 수정된 쿼리: 새로운 세분화된 필드들 포함
      const { data: workRecords, error: workRecordsError } = await supabase
        .from("work_records")
        .select(
          `
          record_id,
          worker_id,
          work_date,
          work_hours,
          daily_wage,
          work_type,
          status,
          payment_status,
          payment_date,
          payment_method,
          payment_memo,
          bulk_payment_id,
          regular_hours,
          overtime_hours,
          night_hours,
          holiday_hours,
          overtime_allowance,
          night_allowance,
          holiday_allowance,
          extra_allowance,
          tax_exemption_amount,
          income_tax,
          local_income_tax,
          national_pension,
          health_insurance,
          employment_insurance,
          industrial_accident,
          long_term_care,
          other_deductions,
          workers (
            worker_id,
            name,
            resident_number,
            contact_number,
            worker_type,
            job_code
          )
        `
        )
        .eq("site_id", selectedSite)
        .gte("work_date", startDate)
        .lte("work_date", endDate)
        .neq("status", "registration")
        .order("work_date", { ascending: true });

      console.log("DB 쿼리 결과:", {
        site_id: selectedSite,
        startDate,
        endDate,
        workRecordsCount: workRecords?.length || 0,
      });

      if (workRecordsError) throw workRecordsError;

      // 일용직 근로자만 필터링
      const dailyWorkerRecords = workRecords.filter(
        (record) => record.workers?.worker_type === "daily"
      );

      if (dailyWorkerRecords.length === 0) {
        set({
          workerData: [],
          payrollSummary: {
            totalWorkers: 0,
            totalWorkDays: 0,
            totalPaid: 0,
            totalUnpaid: 0,
          },
          dailySummaries: {},
          loading: false,
        });
        return;
      }

      // 🔥 근로자별 데이터 구성 - 세분화된 시간과 수당 포함
      const workerMap = new Map();
      const dailyMap = new Map();
      let totalPaid = 0;
      let totalUnpaid = 0;

      dailyWorkerRecords.forEach((record) => {
        if (!record.workers) return;

        const workerId = record.worker_id;
        const workDate = new Date(record.work_date);
        const day = workDate.getDate();
        const dateStr = `${month}월 ${day}일`;

        // 일자별 요약정보 구성
        if (!dailyMap.has(dateStr)) {
          dailyMap.set(dateStr, {
            date: record.work_date,
            day: day,
            workers: [],
            totalAmount: 0,
            paidAmount: 0,
            unpaidAmount: 0,
          });
        }

        const dailySummary = dailyMap.get(dateStr);

        // 근로자가 이미 해당 일자에 있는지 확인
        const existingWorkerIndex = dailySummary.workers.findIndex((w) => w.worker_id === workerId);

        if (existingWorkerIndex === -1) {
          dailySummary.workers.push({
            worker_id: workerId,
            name: record.workers.name,
            hours: parseFloat(record.work_hours) || 0,
            amount: parseFloat(record.daily_wage) || 0,
            status: record.payment_status || "unpaid",
          });
        }

        dailySummary.totalAmount += parseFloat(record.daily_wage) || 0;

        if (record.payment_status === "paid") {
          dailySummary.paidAmount += parseFloat(record.daily_wage) || 0;
          totalPaid += parseFloat(record.daily_wage) || 0;
        } else {
          dailySummary.unpaidAmount += parseFloat(record.daily_wage) || 0;
          totalUnpaid += parseFloat(record.daily_wage) || 0;
        }

        // 근로자별 데이터 구성
        if (!workerMap.has(workerId)) {
          workerMap.set(workerId, {
            worker_id: workerId,
            name: record.workers.name,
            resident_number: record.workers.resident_number,
            contact_number: record.workers.contact_number,
            job_code: record.workers.job_code,
            records: [],
            // 🔥 세분화된 시간 합계
            totalRegularHours: 0,
            totalOvertimeHours: 0,
            totalNightHours: 0,
            totalHolidayHours: 0,
            totalHours: 0,
            totalWage: 0,
            // 🔥 세분화된 수당 합계 (DB에서 자동 계산됨)
            totalOvertimeAllowance: 0,
            totalNightAllowance: 0,
            totalHolidayAllowance: 0,
            totalExtraAllowance: 0,
            totalTaxExemption: 0,
            totalIncomeTax: 0,
            totalLocalTax: 0,
            totalNationalPension: 0,
            totalHealthInsurance: 0,
            totalEmploymentInsurance: 0,
            totalIndustrialAccident: 0,
            totalLongTermCare: 0,
            totalOtherDeductions: 0,
            totalDeduction: 0,
            netPay: 0,
          });
        }

        const worker = workerMap.get(workerId);

        // 🔥 세분화된 데이터 처리 (DB에서 자동 계산된 값들 사용)
        const regularHours = parseFloat(record.regular_hours) || 0;
        const overtimeHours = parseFloat(record.overtime_hours) || 0;
        const nightHours = parseFloat(record.night_hours) || 0;
        const holidayHours = parseFloat(record.holiday_hours) || 0;
        const workHours = parseFloat(record.work_hours) || 0; // DB 트리거가 자동 계산
        const dailyWage = parseFloat(record.daily_wage) || 0;

        // 🔥 수당들 (DB 트리거가 자동 계산)
        const overtimeAllowance = parseFloat(record.overtime_allowance) || 0;
        const nightAllowance = parseFloat(record.night_allowance) || 0;
        const holidayAllowance = parseFloat(record.holiday_allowance) || 0;
        const extraAllowance = parseFloat(record.extra_allowance) || 0;

        const taxExemption = parseFloat(record.tax_exemption_amount) || 0;
        const incomeTax = parseFloat(record.income_tax) || 0;
        const localTax = parseFloat(record.local_income_tax) || 0;

        // 🔥 4대보험료 (DB에서 저장된 값 사용)
        const nationalPension = parseFloat(record.national_pension) || 0;
        const healthInsurance = parseFloat(record.health_insurance) || 0;
        const employmentInsurance = parseFloat(record.employment_insurance) || 0;
        const industrialAccident = parseFloat(record.industrial_accident) || 0;
        const longTermCare = parseFloat(record.long_term_care) || 0;
        const otherDeductions = parseFloat(record.other_deductions) || 0;

        const totalDeduction =
          incomeTax +
          localTax +
          nationalPension +
          healthInsurance +
          employmentInsurance +
          industrialAccident +
          longTermCare +
          otherDeductions;
        const netPay =
          dailyWage +
          overtimeAllowance +
          nightAllowance +
          holidayAllowance +
          extraAllowance -
          totalDeduction;

        // 근로자 데이터에 추가
        worker.records.push({
          record_id: record.record_id,
          work_date: record.work_date,
          day: day,
          date: dateStr,
          // 🔥 세분화된 시간 정보
          regularHours: regularHours,
          overtimeHours: overtimeHours,
          nightHours: nightHours,
          holidayHours: holidayHours,
          hours: workHours,
          dailyWage: dailyWage,
          // 🔥 세분화된 수당 정보 (DB 자동 계산)
          overtimeAllowance: overtimeAllowance,
          nightAllowance: nightAllowance,
          holidayAllowance: holidayAllowance,
          extraAllowance: extraAllowance,
          taxExemption: taxExemption,
          incomeTax: incomeTax,
          localTax: localTax,
          nationalPension: nationalPension,
          healthInsurance: healthInsurance,
          employmentInsurance: employmentInsurance,
          industrialAccident: industrialAccident,
          longTermCare: longTermCare,
          otherDeductions: otherDeductions,
          totalDeduction: totalDeduction,
          netPay: netPay,
          status: record.payment_status || "unpaid",
          payment_date: record.payment_date,
          payment_method: record.payment_method,
          payment_memo: record.payment_memo,
          bulk_payment_id: record.bulk_payment_id,
        });

        // 🔥 근로자 합계 갱신
        worker.totalRegularHours += regularHours;
        worker.totalOvertimeHours += overtimeHours;
        worker.totalNightHours += nightHours;
        worker.totalHolidayHours += holidayHours;
        worker.totalHours += workHours;
        worker.totalWage += dailyWage;
        worker.totalOvertimeAllowance += overtimeAllowance;
        worker.totalNightAllowance += nightAllowance;
        worker.totalHolidayAllowance += holidayAllowance;
        worker.totalExtraAllowance += extraAllowance;
        worker.totalTaxExemption += taxExemption;
        worker.totalIncomeTax += incomeTax;
        worker.totalLocalTax += localTax;
        worker.totalNationalPension += nationalPension;
        worker.totalHealthInsurance += healthInsurance;
        worker.totalEmploymentInsurance += employmentInsurance;
        worker.totalIndustrialAccident += industrialAccident;
        worker.totalLongTermCare += longTermCare;
        worker.totalOtherDeductions += otherDeductions;
        worker.totalDeduction += totalDeduction;
        worker.netPay += netPay;
      });

      // 근로자 데이터 배열과 일자별 요약 객체로 변환
      const workerDataArray = Array.from(workerMap.values()).sort(
        (a, b) => a.worker_id - b.worker_id
      );
      const dailySummariesObj = Object.fromEntries(dailyMap.entries());

      console.log("근로자 데이터 로드 결과:", {
        근로자수: workerDataArray.length,
        일자별요약: Object.keys(dailySummariesObj).length,
      });

      // 전체 요약 정보 업데이트
      set({
        workerData: workerDataArray,
        dailySummaries: dailySummariesObj,
        payrollSummary: {
          totalWorkers: workerMap.size,
          totalWorkDays: dailyMap.size,
          totalPaid: totalPaid,
          totalUnpaid: totalUnpaid,
        },
        loading: false,
      });
    } catch (error) {
      console.error("일용직 급여 데이터 로드 오류:", error);
      set({
        loading: false,
        error: "근로자 급여 정보를 불러오는 중 오류가 발생했습니다.",
      });
      toast.error("근로자 급여 정보를 불러오는 중 오류가 발생했습니다.");
    }
  },

  // 지급 상태 업데이트 (낙관적 UI 업데이트 사용)
  updatePaymentStatus: async (recordId, newStatus) => {
    try {
      const { workerData } = get();
      let currentRecord = null;
      let workerIndex = -1;
      let recordIndex = -1;

      // 레코드 및 해당 인덱스 찾기
      for (let i = 0; i < workerData.length; i++) {
        const worker = workerData[i];
        const index = worker.records.findIndex((r) => r.record_id === recordId);
        if (index !== -1) {
          currentRecord = worker.records[index];
          workerIndex = i;
          recordIndex = index;
          break;
        }
      }

      if (!currentRecord) {
        throw new Error("해당 레코드를 찾을 수 없습니다");
      }

      // 낙관적 UI 업데이트
      set((state) => {
        const newWorkerData = [...state.workerData];
        const worker = newWorkerData[workerIndex];
        const record = worker.records[recordIndex];

        newWorkerData[workerIndex].records[recordIndex] = {
          ...record,
          status: newStatus,
          payment_date: newStatus === "paid" ? record.payment_date : null,
        };

        return { workerData: newWorkerData };
      });

      // 서버 업데이트
      const updateData = {
        payment_status: newStatus,
      };

      if (newStatus === "unpaid") {
        updateData.payment_date = null;
        updateData.payment_method = null;
        updateData.payment_memo = null;
      }

      const { data, error } = await supabase
        .from("work_records")
        .update(updateData)
        .eq("record_id", recordId)
        .select();

      if (error) {
        // 서버 업데이트 실패 시 UI 롤백
        set((state) => {
          const newWorkerData = [...state.workerData];
          const worker = newWorkerData[workerIndex];
          const record = worker.records[recordIndex];

          newWorkerData[workerIndex].records[recordIndex] = {
            ...record,
            status: currentRecord.status,
            payment_date: currentRecord.payment_date,
          };

          return { workerData: newWorkerData };
        });

        throw error;
      }

      // 일자별 요약 업데이트
      if (workerIndex !== -1 && recordIndex !== -1) {
        get().updateDailySummaries(workerIndex, recordIndex, newStatus);
      }

      toast.success(
        `지급 상태가 '${newStatus === "unpaid" ? "미지급" : "지급"}'으로 변경되었습니다.`
      );

      return true;
    } catch (error) {
      console.error("지급 상태 변경 오류:", error);
      toast.error("지급 상태 변경 중 오류가 발생했습니다.");
      return false;
    }
  },

  handlePayment: async (record, worker, selectedDate = null) => {
    // 마우스 위치 저장
    const saveMousePosition = () => {
      const mousePositionSave = {
        x: window.event?.clientX || 0,
        y: window.event?.clientY || 0,
      };
      return mousePositionSave;
    };

    // 현재 마우스 위치 저장
    const savedPosition = saveMousePosition();

    try {
      // 날짜가 선택되지 않았으면 모달 표시
      if (!selectedDate) {
        set({
          paymentInfo: {
            recordId: record.record_id,
            workerId: worker.worker_id,
            worker: worker.name,
            date: record.date,
            workDate: record.work_date,
            amount: record.dailyWage,
            netAmount: record.netPay,
          },
          showPaymentModal: true,
        });
        return;
      }

      // 1. 낙관적 UI 업데이트: 먼저 UI 업데이트
      const workerData = [...get().workerData];
      let workerIndex = -1;
      let recordIndex = -1;

      for (let i = 0; i < workerData.length; i++) {
        const w = workerData[i];
        const idx = w.records.findIndex((r) => r.record_id === record.record_id);
        if (idx !== -1) {
          workerIndex = i;
          recordIndex = idx;
          break;
        }
      }

      if (workerIndex !== -1 && recordIndex !== -1) {
        // 낙관적 UI 업데이트 - 단일 상태 업데이트로 병합
        set((state) => {
          // 깊은 복사로 새 상태 생성
          const newWorkerData = [...state.workerData];
          newWorkerData[workerIndex].records[recordIndex].status = "paid";
          newWorkerData[workerIndex].records[recordIndex].payment_date = selectedDate;

          // 일자별 요약 업데이트
          const dailySummaries = { ...state.dailySummaries };
          const dateStr = newWorkerData[workerIndex].records[recordIndex].date;
          const amount = parseFloat(newWorkerData[workerIndex].records[recordIndex].dailyWage) || 0;

          if (dailySummaries[dateStr]) {
            dailySummaries[dateStr] = {
              ...dailySummaries[dateStr],
              paidAmount: dailySummaries[dateStr].paidAmount + amount,
              unpaidAmount: dailySummaries[dateStr].unpaidAmount - amount,
              workers: dailySummaries[dateStr].workers.map((w) =>
                w.worker_id === workerData[workerIndex].worker_id ? { ...w, status: "paid" } : w
              ),
            };
          }

          // 갱신된 상태 반환
          return {
            workerData: newWorkerData,
            dailySummaries,
            payrollSummary: {
              ...state.payrollSummary,
              totalPaid: state.payrollSummary.totalPaid + amount,
              totalUnpaid: state.payrollSummary.totalUnpaid - amount,
            },
          };
        });
      }

      // 2. 백그라운드에서 서버 요청 처리
      const formatDate = (date) => {
        if (!date) return "";
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const paymentDate = selectedDate ? formatDate(selectedDate) : formatDate(new Date());

      // 서버 요청 (백그라운드에서 진행)
      setTimeout(async () => {
        try {
          // 세금 계산 및 서버 업데이트
          const dailyWage = parseFloat(record.dailyWage) || 0;
          const allowances = parseFloat(record.allowances || 0) || 0;
          const taxExemption = parseFloat(record.taxExemption || 0) || 0;
          const totalPayAmount = dailyWage + allowances;

          // 세금 계산...
          const dailyIncomeDeduction = 150000;
          const incomeTaxRate = 0.06;
          const taxReductionRate = 0.45;
          const localTaxRate = 0.1;
          const minTaxExemption = 1000;

          // 과세대상금액 및 소득세 계산...
          let taxableIncome = Math.max(0, totalPayAmount - dailyIncomeDeduction - taxExemption);
          let incomeTax =
            taxableIncome > 0 ? Math.round(taxableIncome * incomeTaxRate * taxReductionRate) : 0;
          incomeTax = incomeTax < minTaxExemption ? 0 : incomeTax;

          // 주민세 및 고용보험료 계산
          const localTax = Math.round(incomeTax * localTaxRate);
          const employmentInsurance = Math.round(totalPayAmount * 0.009);

          // 서버 업데이트
          const { error } = await supabase
            .from("work_records")
            .update({
              payment_status: "paid",
              payment_date: paymentDate,
              payment_method: "계좌이체", // 기본값
              income_tax: incomeTax,
              local_income_tax: localTax,
              employment_insurance: employmentInsurance,
            })
            .eq("record_id", record.record_id);

          if (error) throw error;

          // 성공 메시지
          toast.success(`${worker.name}님  ${paymentDate}에 지급 처리되었습니다.`);

          // 캐시 무효화 (필요한 경우)
          try {
            const workTimeStore = require("@/lib/store/workTimeStore").default;
            if (workTimeStore) {
              workTimeStore.setState((state) => ({
                ...state,
                workReports: {},
              }));
            }
          } catch (e) {
            console.error("캐시 무효화 오류:", e);
          }
        } catch (e) {
          console.error("백그라운드 지급 처리 오류:", e);
          toast.error("지급 처리 중 오류가 발생했습니다.");
        }
      }, 0);

      // 3. 마우스 위치 복원 (선택 사항)
      setTimeout(() => {
        try {
          // 마우스 포인터 위치의 요소 찾기
          const elementAtPoint = document.elementFromPoint(savedPosition.x, savedPosition.y);
          if (elementAtPoint) {
            // 필요한 경우 호버 이벤트 시뮬레이션
            const mouseoverEvent = new MouseEvent("mouseover", {
              bubbles: true,
              cancelable: true,
              view: window,
              clientX: savedPosition.x,
              clientY: savedPosition.y,
            });
            elementAtPoint.dispatchEvent(mouseoverEvent);
          }
        } catch (e) {
          console.error("마우스 위치 복원 오류:", e);
        }
      }, 10);
    } catch (error) {
      console.error("지급 처리 오류:", error);
      toast.error("지급 처리 중 오류가 발생했습니다.");
    }
  },

  // 🔥 지급 처리 함수 - 새로운 필드들 포함
  confirmPayment: async (recordId, paymentMethod, memo) => {
    try {
      const currentState = {
        workerData: [...get().workerData],
        dailySummaries: { ...get().dailySummaries },
        payrollSummary: { ...get().payrollSummary },
      };

      let workerIndex = -1;
      let recordIndex = -1;
      let worker = null;
      let record = null;

      // 레코드 찾기
      for (let i = 0; i < currentState.workerData.length; i++) {
        const w = currentState.workerData[i];
        const idx = w.records.findIndex((r) => r.record_id === recordId);
        if (idx !== -1) {
          workerIndex = i;
          recordIndex = idx;
          worker = w;
          record = w.records[idx];
          break;
        }
      }

      if (!record) {
        throw new Error("레코드를 찾을 수 없습니다");
      }

      const currentDate = new Date().toISOString().slice(0, 10);

      // 낙관적 UI 업데이트
      set((state) => {
        const newState = {
          showPaymentModal: false,
          workerData: state.workerData.map((w, wIdx) => {
            if (wIdx !== workerIndex) return w;

            return {
              ...w,
              records: w.records.map((r, rIdx) => {
                if (rIdx !== recordIndex) return r;

                // 🔥 새로운 필드들 포함한 레코드 업데이트
                return {
                  ...r,
                  status: "paid",
                  payment_date: currentDate,
                  payment_method: paymentMethod,
                  payment_memo: memo,
                };
              }),
            };
          }),
        };

        // 일자별 요약 및 전체 요약 업데이트 로직...
        return newState;
      });

      // 🔥 서버 업데이트 - 새로운 필드들 포함
      const { error } = await supabase
        .from("work_records")
        .update({
          payment_status: "paid",
          payment_date: currentDate,
          payment_method: paymentMethod,
          payment_memo: memo,
          // 세금과 공제는 이미 DB 트리거에 의해 계산되어 있음
        })
        .eq("record_id", recordId);

      if (error) throw error;

      toast.success("지급이 완료되었습니다.");
    } catch (error) {
      console.error("지급 처리 오류:", error);
      toast.error("지급 처리 중 오류가 발생했습니다.");

      // 오류 발생 시 원래 상태로 복원
      set({
        workerData: currentState.workerData,
        dailySummaries: currentState.dailySummaries,
        payrollSummary: currentState.payrollSummary,
        showPaymentModal: false,
      });
    }
  },

  // 🔥 일괄 지급 처리 - bulk_payment_id 지원
  // lib/store/payrollStore.js - 디버깅이 강화된 confirmBulkPayment 함수

  // 🔥 디버깅 강화된 일괄 지급 처리 함수
  // lib/store/payrollStore.js - 단순 해결: bulk_payment_id를 null로 설정

  // 🔥 단순 해결된 일괄 지급 처리 함수
  confirmBulkPayment: async (items, paymentMethod, memo, paymentDate = null) => {
    const currentState = {
      workerData: [...get().workerData],
      dailySummaries: { ...get().dailySummaries },
      payrollSummary: { ...get().payrollSummary },
    };

    try {
      console.log("🚀 일괄 지급 처리 시작");

      if (!items || items.length === 0) {
        toast.error("지급할 항목이 없습니다.");
        return;
      }

      const formatDate = (date) => {
        if (!date) return "";
        const d = new Date(date);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
          d.getDate()
        ).padStart(2, "0")}`;
      };

      const formattedDate = paymentDate
        ? paymentDate instanceof Date
          ? formatDate(paymentDate)
          : paymentDate
        : formatDate(new Date());

      console.log(`📅 지급일: ${formattedDate}`);

      // 🔥 bulk_payment_id를 사용하지 않고 일괄 지급 구현
      // 대신 payment_memo에 일괄 지급 표시를 추가
      const batchIdentifier = `BATCH_${Date.now()}`;
      const batchMemo = memo
        ? `[일괄지급:${batchIdentifier}] ${memo}`
        : `[일괄지급:${batchIdentifier}]`;

      // 레코드 정보 수집
      const recordIds = [];

      items.forEach((item) => {
        if (item.records && item.records.length > 0) {
          item.records.forEach((record) => {
            if (record.record_id) {
              recordIds.push(record.record_id);
            }
          });
        }
      });

      console.log(`📊 처리할 레코드: ${recordIds.length}개`);

      if (recordIds.length === 0) {
        toast.error("유효한 레코드가 없습니다.");
        return;
      }

      // 낙관적 UI 업데이트
      set((state) => ({
        ...state,
        showBulkPaymentModal: false,
        workerData: state.workerData.map((worker) => ({
          ...worker,
          records: worker.records.map((record) => {
            if (recordIds.includes(record.record_id)) {
              return {
                ...record,
                status: "paid",
                payment_date: formattedDate,
                payment_method: paymentMethod,
                payment_memo: batchMemo,
                // bulk_payment_id 제거 - 외래 키 제약 때문에 null로 설정
              };
            }
            return record;
          }),
        })),
      }));

      // 🔥 개별 레코드 업데이트 (bulk_payment_id 제외)
      let successCount = 0;
      let errorCount = 0;

      for (const recordId of recordIds) {
        try {
          console.log(`🔄 레코드 ${recordId} 처리 중`);

          const { data, error } = await supabase
            .from("work_records")
            .update({
              payment_status: "paid",
              payment_date: formattedDate,
              payment_method: paymentMethod,
              payment_memo: batchMemo,
              // bulk_payment_id 필드 제거 - 외래 키 제약 때문에
              updated_at: new Date().toISOString(),
            })
            .eq("record_id", recordId)
            .select("record_id, payment_status");

          if (error) {
            console.error(`❌ 레코드 ${recordId} 업데이트 실패:`, error);
            errorCount++;
          } else {
            console.log(`✅ 레코드 ${recordId} 업데이트 성공`);
            successCount++;
          }

          // 요청 간 지연
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (error) {
          console.error(`💥 레코드 ${recordId} 처리 중 예외:`, error);
          errorCount++;
        }
      }

      console.log(`🎯 최종 결과 - 성공: ${successCount}, 실패: ${errorCount}`);

      if (successCount > 0) {
        toast.success(
          `✅ 일괄 지급 완료: ${successCount}건 성공${
            errorCount > 0 ? `, ${errorCount}건 실패` : ""
          }`
        );

        // 데이터 다시 로드
        setTimeout(() => {
          const payrollStore = usePayrollStore.getState();
          if (payrollStore.selectedSite) {
            payrollStore.fetchDailyWorkerPayrollData();
          }
        }, 1000);
      }

      if (errorCount === recordIds.length) {
        throw new Error("모든 레코드 업데이트 실패");
      }
    } catch (error) {
      console.error("💥 일괄 지급 처리 전체 오류:", error);
      toast.error(`일괄 지급 처리 중 오류가 발생했습니다: ${error.message}`);

      // UI 롤백
      set({
        workerData: currentState.workerData,
        dailySummaries: currentState.dailySummaries,
        payrollSummary: currentState.payrollSummary,
        showBulkPaymentModal: false,
      });
    }
  },
  // 🔥 일괄 지급 내역 조회 함수 (work_records에서 직접 조회)
  getBulkPaymentHistory: async (siteId, yearMonth) => {
    try {
      const { data, error } = await supabase
        .from("work_records")
        .select(
          `
        bulk_payment_id,
        payment_date,
        payment_method,
        payment_memo,
        daily_wage,
        workers(name)
      `
        )
        .eq("site_id", siteId)
        .like("payment_date", `${yearMonth}%`)
        .not("bulk_payment_id", "is", null)
        .order("payment_date", { ascending: false });

      if (error) throw error;

      // bulk_payment_id별로 그룹화
      const groupedPayments = {};

      data?.forEach((record) => {
        const bulkId = record.bulk_payment_id;

        if (!groupedPayments[bulkId]) {
          groupedPayments[bulkId] = {
            bulk_payment_id: bulkId,
            payment_date: record.payment_date,
            payment_method: record.payment_method,
            payment_memo: record.payment_memo,
            records: [],
            total_amount: 0,
            worker_count: 0,
          };
        }

        groupedPayments[bulkId].records.push(record);
        groupedPayments[bulkId].total_amount += parseFloat(record.daily_wage || 0);
      });

      // 근로자 수 계산 (중복 제거)
      Object.values(groupedPayments).forEach((payment) => {
        const uniqueWorkers = new Set(payment.records.map((r) => r.workers?.name).filter(Boolean));
        payment.worker_count = uniqueWorkers.size;
      });

      return Object.values(groupedPayments);
    } catch (error) {
      console.error("일괄 지급 내역 조회 오류:", error);
      return [];
    }
  },

  // 🔥 급여명세서 표시 - 세분화된 정보 포함
  showPayslip: (worker) => {
    // 세분화된 시간과 수당 정보를 포함한 명세서 데이터 설정
    set({
      payslipInfo: {
        worker_id: worker.worker_id,
        name: worker.name,
        resident_number: worker.resident_number,
        contact_number: worker.contact_number,
        job: worker.job_code || "일용직",
        workRecords: worker.records,
        // 🔥 세분화된 시간 정보
        totalRegularHours: worker.totalRegularHours || 0,
        totalOvertimeHours: worker.totalOvertimeHours || 0,
        totalNightHours: worker.totalNightHours || 0,
        totalHolidayHours: worker.totalHolidayHours || 0,
        totalHours: worker.totalHours || 0,
        totalWage: worker.totalWage || 0,
        // 🔥 세분화된 수당 정보 (DB 자동 계산)
        totalOvertimeAllowance: worker.totalOvertimeAllowance || 0,
        totalNightAllowance: worker.totalNightAllowance || 0,
        totalHolidayAllowance: worker.totalHolidayAllowance || 0,
        totalExtraAllowance: worker.totalExtraAllowance || 0,
        totalTaxExemption: worker.totalTaxExemption || 0,
        totalIncomeTax: worker.totalIncomeTax || 0,
        totalLocalTax: worker.totalLocalTax || 0,
        totalNationalPension: worker.totalNationalPension || 0,
        totalHealthInsurance: worker.totalHealthInsurance || 0,
        totalEmploymentInsurance: worker.totalEmploymentInsurance || 0,
        totalIndustrialAccident: worker.totalIndustrialAccident || 0,
        totalLongTermCare: worker.totalLongTermCare || 0,
        totalOtherDeductions: worker.totalOtherDeductions || 0,
        totalDeductions: worker.totalDeduction || 0,
        netPay: worker.netPay || 0,
        yearMonth: get().yearMonth,
      },
      showPayslipModal: true,
    });
  },

  // 일자별 요약 데이터 업데이트 (내부 함수)
  updateDailySummaries: (workerIndex, recordIndex, newStatus) => {
    if (workerIndex === undefined || recordIndex === undefined || !newStatus) {
      console.error("updateDailySummaries 호출 오류: 필수 매개변수 누락", {
        workerIndex,
        recordIndex,
        newStatus,
      });
      return;
    }

    set((state) => {
      const { workerData, dailySummaries } = state;

      if (!workerData || workerIndex >= workerData.length) {
        console.error("updateDailySummaries 오류: 잘못된 workerIndex", {
          workerDataLength: workerData?.length,
          workerIndex,
        });
        return state;
      }

      const worker = workerData[workerIndex];

      if (!worker.records || recordIndex >= worker.records.length) {
        console.error("updateDailySummaries 오류: 잘못된 recordIndex", {
          recordsLength: worker?.records?.length,
          recordIndex,
        });
        return state;
      }

      const record = worker.records[recordIndex];
      const workDate = new Date(record.work_date);
      const month = workDate.getMonth() + 1;
      const day = workDate.getDate();
      const dateStr = `${month}월 ${day}일`;

      if (!dailySummaries[dateStr]) {
        console.warn(`updateDailySummaries: ${dateStr} 날짜에 대한 요약 데이터가 없음`);
        return state;
      }

      const summary = dailySummaries[dateStr];
      const dailyWage = parseFloat(record.dailyWage) || 0;

      const newSummary = { ...summary };

      if (newStatus === "paid") {
        newSummary.paidAmount += dailyWage;
        newSummary.unpaidAmount -= dailyWage;
      } else {
        newSummary.paidAmount -= dailyWage;
        newSummary.unpaidAmount += dailyWage;
      }

      // 요약 데이터의 worker 상태 업데이트
      const workerIdx = newSummary.workers.findIndex((w) => w.worker_id === worker.worker_id);
      if (workerIdx !== -1) {
        newSummary.workers[workerIdx].status = newStatus;
      }

      return {
        dailySummaries: {
          ...dailySummaries,
          [dateStr]: newSummary,
        },
        payrollSummary: {
          ...state.payrollSummary,
          totalPaid:
            newStatus === "paid"
              ? state.payrollSummary.totalPaid + dailyWage
              : state.payrollSummary.totalPaid - dailyWage,
          totalUnpaid:
            newStatus === "paid"
              ? state.payrollSummary.totalUnpaid - dailyWage
              : state.payrollSummary.totalUnpaid + dailyWage,
        },
      };
    });
  },

  // 레코드 업데이트 (지급일 변경 등)
  updateRecord: async (updatedRecord) => {
    const currentState = {
      workerData: [...get().workerData],
    };

    try {
      let workerIndex = -1;
      let recordIndex = -1;

      for (let i = 0; i < currentState.workerData.length; i++) {
        const worker = currentState.workerData[i];
        const index = worker.records.findIndex((r) => r.record_id === updatedRecord.record_id);
        if (index !== -1) {
          workerIndex = i;
          recordIndex = index;
          break;
        }
      }

      if (workerIndex === -1 || recordIndex === -1) {
        throw new Error("해당 레코드를 찾을 수 없습니다");
      }

      // 낙관적 UI 업데이트
      set((state) => {
        const newWorkerData = [...state.workerData];
        newWorkerData[workerIndex].records[recordIndex] = updatedRecord;
        return { workerData: newWorkerData };
      });

      // 서버 업데이트
      let paymentDate = updatedRecord.payment_date;
      if (paymentDate && paymentDate instanceof Date) {
        paymentDate = paymentDate.toISOString().split("T")[0];
      }

      const { error } = await supabase
        .from("work_records")
        .update({
          payment_date: paymentDate,
          payment_method: updatedRecord.payment_method,
          payment_memo: updatedRecord.payment_memo,
        })
        .eq("record_id", updatedRecord.record_id);

      if (error) {
        // Rollback UI on error
        set({ workerData: currentState.workerData });
        throw error;
      }

      toast.success("레코드가 성공적으로 업데이트되었습니다.");
      return true;
    } catch (error) {
      console.error("레코드 업데이트 오류:", error);
      toast.error("레코드 업데이트 중 오류가 발생했습니다.");
      // Ensure the modal is closed or handled if it was open for this update
      // For a more robust solution, you might want to consider specific error states for modals.
      return false;
    }
  },

  // 현재 store 상태 초기화
  resetStore: () => {
    set({
      yearMonth: new Date().toISOString().substring(0, 7),
      loading: false,
      error: null,
      workerData: [],
      dailySummaries: {},
      payrollSummary: {
        totalWorkers: 0,
        totalWorkDays: 0,
        totalPaid: 0,
        totalUnpaid: 0,
      },
      showPaymentModal: false,
      showBulkPaymentModal: false,
      showPayslipModal: false,
      paymentInfo: null,
      bulkPaymentInfo: null,
      payslipInfo: null,
    });
  },
}));

export default usePayrollStore;

/**
 *
 *
 *
 *
 *
 */

// // lib/store/payrollStore.js
// import { create } from "zustand";
// import { supabase } from "@/lib/supabase";
// import { toast } from "react-toastify";

// const usePayrollStore = create((set, get) => ({
//   // 상태
//   yearMonth: new Date().toISOString().substring(0, 7), // YYYY-MM 형식
//   selectedSite: null,
//   loading: false,
//   error: null,
//   workerData: [],
//   dailySummaries: {},
//   payrollSummary: {
//     totalWorkers: 0,
//     totalWorkDays: 0,
//     totalPaid: 0,
//     totalUnpaid: 0,
//   },
//   showPaymentModal: false,
//   showBulkPaymentModal: false,
//   showPayslipModal: false,
//   paymentInfo: null,
//   bulkPaymentInfo: null,
//   payslipInfo: null,

//   // 액션
//   setYearMonth: (yearMonth) => set({ yearMonth }),
//   setSelectedSite: (siteId) => {
//     // 이전 사이트 ID 저장
//     const prevSiteId = get().selectedSite;

//     // 새 사이트 ID 설정
//     set({ selectedSite: siteId });

//     console.log(`payrollStore: 현장 ID 변경됨 ${prevSiteId} -> ${siteId}`);

//     // 사이트 ID가 변경되었고 유효한 값이 있을 때만 데이터 로드
//     if (prevSiteId !== siteId && siteId) {
//       console.log(`새 현장 ID로 데이터 로드 시작: ${siteId}`);
//       // 약간의 지연 후 호출 (상태 업데이트 완료 보장)
//       setTimeout(() => {
//         get().fetchDailyWorkerPayrollData();
//       }, 0);
//     }
//   },
//   setShowPaymentModal: (show) => set({ showPaymentModal: show }),
//   setShowBulkPaymentModal: (show) => set({ showBulkPaymentModal: show }),
//   setShowPayslipModal: (show) => set({ showPayslipModal: show }),

//   setPaymentInfo: (info) => set({ paymentInfo: info }),
//   setBulkPaymentInfo: (info) => set({ bulkPaymentInfo: info }),
//   setPayslipInfo: (info) => set({ payslipInfo: info }),

//   // 데이터 로드
//   fetchDailyWorkerPayrollData: async () => {
//     const { selectedSite, yearMonth } = get();
//     console.log("fetchDailyWorkerPayrollData 실행:", { selectedSite, yearMonth });
//     if (!selectedSite || !yearMonth) {
//       set({ loading: false });
//       return;
//     }

//     try {
//       set({ loading: true, error: null });
//       console.log("DB 쿼리 시작: 작업 기록 조회");
//       // 1. 해당 월의 시작일과 끝일 계산
//       const year = parseInt(yearMonth.split("-")[0]);
//       const month = parseInt(yearMonth.split("-")[1]);
//       const startDate = `${yearMonth}-01`;
//       const lastDay = new Date(year, month, 0).getDate();
//       const endDate = `${yearMonth}-${lastDay}`;

//       // 2. 선택된 현장의 일용직 근로자 목록 가져오기
//       const { data: workRecords, error: workRecordsError } = await supabase
//         .from("work_records")
//         .select(
//           `
//           record_id,
//           worker_id,
//           work_date,
//           work_hours,
//           daily_wage,
//           work_type,
//           status,
//           payment_status,
//           payment_date,
//           overtime_allowance,
//           night_allowance,
//           holiday_allowance,
//           extra_allowance,
//           tax_exemption_amount,
//           income_tax,
//           local_income_tax,
//           national_pension,
//           health_insurance,
//           employment_insurance,
//           industrial_accident,
//           long_term_care,
//           workers (
//             worker_id,
//             name,
//             resident_number,
//             contact_number,
//             worker_type,
//             job_code
//           )
//         `
//         )
//         .eq("site_id", selectedSite)
//         .gte("work_date", startDate)
//         .lte("work_date", endDate)
//         .neq("status", "registration")
//         .order("work_date", { ascending: true });

//       console.log("DB 쿼리 결과:", {
//         site_id: selectedSite,
//         startDate,
//         endDate,
//         workRecordsCount: workRecords?.length || 0,
//       });

//       if (workRecordsError) throw workRecordsError;

//       // 일용직 근로자만 필터링
//       const dailyWorkerRecords = workRecords.filter(
//         (record) => record.workers?.worker_type === "daily"
//       );

//       if (dailyWorkerRecords.length === 0) {
//         set({
//           workerData: [],
//           payrollSummary: {
//             totalWorkers: 0,
//             totalWorkDays: 0,
//             totalPaid: 0,
//             totalUnpaid: 0,
//           },
//           dailySummaries: {},
//           loading: false,
//         });
//         return;
//       }

//       // 3. 근로자별 데이터 구성
//       const workerMap = new Map();
//       const dailyMap = new Map();
//       let totalPaid = 0;
//       let totalUnpaid = 0;

//       dailyWorkerRecords.forEach((record) => {
//         if (!record.workers) return;

//         const workerId = record.worker_id;
//         const workDate = new Date(record.work_date);
//         const day = workDate.getDate();
//         const dateStr = `${month}월 ${day}일`;

//         // 일자별 요약정보 구성
//         if (!dailyMap.has(dateStr)) {
//           dailyMap.set(dateStr, {
//             date: record.work_date,
//             day: day,
//             workers: [],
//             totalAmount: 0,
//             paidAmount: 0,
//             unpaidAmount: 0,
//           });
//         }

//         const dailySummary = dailyMap.get(dateStr);

//         // 근로자가 이미 해당 일자에 있는지 확인
//         const existingWorkerIndex = dailySummary.workers.findIndex((w) => w.worker_id === workerId);

//         if (existingWorkerIndex === -1) {
//           dailySummary.workers.push({
//             worker_id: workerId,
//             name: record.workers.name,
//             hours: parseFloat(record.work_hours) || 0,
//             amount: parseFloat(record.daily_wage) || 0,
//             status: record.payment_status || "unpaid",
//           });
//         }

//         dailySummary.totalAmount += parseFloat(record.daily_wage) || 0;

//         if (record.payment_status === "paid") {
//           dailySummary.paidAmount += parseFloat(record.daily_wage) || 0;
//           totalPaid += parseFloat(record.daily_wage) || 0;
//         } else {
//           dailySummary.unpaidAmount += parseFloat(record.daily_wage) || 0;
//           totalUnpaid += parseFloat(record.daily_wage) || 0;
//         }

//         // 근로자별 데이터 구성
//         if (!workerMap.has(workerId)) {
//           workerMap.set(workerId, {
//             worker_id: workerId,
//             name: record.workers.name,
//             resident_number: record.workers.resident_number,
//             contact_number: record.workers.contact_number,
//             job_code: record.workers.job_code,
//             records: [],
//             totalHours: 0,
//             totalWage: 0,
//             totalAllowance: 0,
//             totalTaxExemption: 0,
//             totalIncomeTax: 0,
//             totalLocalTax: 0,
//             totalNationalPension: 0,
//             totalHealthInsurance: 0,
//             totalEmploymentInsurance: 0,
//             totalIndustrialAccident: 0,
//             totalLongTermCare: 0,
//             totalDeduction: 0,
//             netPay: 0,
//           });
//         }

//         const worker = workerMap.get(workerId);

//         // 금액 계산
//         const workHours = parseFloat(record.work_hours) || 0;
//         const dailyWage = parseFloat(record.daily_wage) || 0;
//         const overtimeAllowance = parseFloat(record.overtime_allowance) || 0;
//         const nightAllowance = parseFloat(record.night_allowance) || 0;
//         const holidayAllowance = parseFloat(record.holiday_allowance) || 0;
//         const extraAllowance = parseFloat(record.extra_allowance) || 0;
//         const totalAllowance =
//           overtimeAllowance + nightAllowance + holidayAllowance + extraAllowance;
//         const taxExemption = parseFloat(record.tax_exemption_amount) || 0;

//         // 세금 계산 (DB에 저장된 값이 있으면 사용, 없으면 계산)
//         let incomeTax, localTax;
//         const totalPayAmount = dailyWage + totalAllowance;

//         if (
//           record.income_tax !== null &&
//           record.income_tax !== undefined &&
//           record.local_income_tax !== null &&
//           record.local_income_tax !== undefined
//         ) {
//           // DB에 저장된 값 사용
//           incomeTax = parseFloat(record.income_tax) || 0;
//           localTax = parseFloat(record.local_income_tax) || 0;
//         } else {
//           // 세금 계산 로직 적용
//           const dailyIncomeDeduction = 150000; // 일용근로소득 공제액 15만원
//           const incomeTaxRate = 0.06; // 소득세율 6%
//           const taxReductionRate = 0.45; // 소득세 감면율 45%
//           const localTaxRate = 0.1; // 지방소득세율 10%
//           const minTaxExemption = 1000; // 소액부징수 기준액 1,000원

//           let dailyTaxableAmount = 0;
//           let calculatedIncomeTax = 0;

//           if (totalPayAmount > dailyIncomeDeduction) {
//             dailyTaxableAmount = totalPayAmount - dailyIncomeDeduction;
//             calculatedIncomeTax = Math.round(dailyTaxableAmount * incomeTaxRate * taxReductionRate);

//             // 소액부징수 적용
//             calculatedIncomeTax = calculatedIncomeTax < minTaxExemption ? 0 : calculatedIncomeTax;
//           }

//           incomeTax = calculatedIncomeTax;
//           localTax = Math.round(incomeTax * localTaxRate);
//         }

//         // 공제금액 (DB에 저장된 값 사용)
//         const nationalPension = parseFloat(record.national_pension) || 0;
//         const healthInsurance = parseFloat(record.health_insurance) || 0;
//         const employmentInsurance = parseFloat(record.employment_insurance) || 0;
//         const industrialAccident = parseFloat(record.industrial_accident) || 0;
//         const longTermCare = parseFloat(record.long_term_care) || 0;

//         const totalDeduction =
//           incomeTax +
//           localTax +
//           nationalPension +
//           healthInsurance +
//           employmentInsurance +
//           industrialAccident +
//           longTermCare;

//         const netPay = totalPayAmount - totalDeduction;

//         // 근로자 데이터에 추가
//         worker.records.push({
//           record_id: record.record_id,
//           work_date: record.work_date,
//           day: day,
//           date: dateStr,
//           hours: workHours,
//           dailyWage: dailyWage,
//           allowances: totalAllowance,
//           taxExemption: taxExemption,
//           incomeTax: incomeTax,
//           localTax: localTax,
//           nationalPension: nationalPension,
//           healthInsurance: healthInsurance,
//           employmentInsurance: employmentInsurance,
//           industrialAccident: industrialAccident,
//           longTermCare: longTermCare,
//           totalDeduction: totalDeduction,
//           netPay: netPay,
//           status: record.payment_status || "unpaid",
//           payment_date: record.payment_date,
//           // 세금 계산을 위한 추가 정보
//           totalPayAmount: dailyWage + totalAllowance,
//           dailyIncomeDeduction: 150000,
//           incomeTaxRate: 0.06,
//           taxReductionRate: 0.45,
//         });

//         // 근로자 합계 갱신
//         worker.totalHours += workHours;
//         worker.totalWage += dailyWage;
//         worker.totalAllowance += totalAllowance;
//         worker.totalTaxExemption += taxExemption;
//         worker.totalIncomeTax += incomeTax;
//         worker.totalLocalTax += localTax;
//         worker.totalNationalPension += nationalPension;
//         worker.totalHealthInsurance += healthInsurance;
//         worker.totalEmploymentInsurance += employmentInsurance;
//         worker.totalIndustrialAccident += industrialAccident;
//         worker.totalLongTermCare += longTermCare;
//         worker.totalDeduction += totalDeduction;
//         worker.netPay += netPay;
//       });

//       // 근로자 합계 업데이트 시 세금 계산 상수도 같이 저장
//       const calcConstants = {
//         dailyIncomeDeduction: 150000,
//         incomeTaxRate: 0.06,
//         taxReductionRate: 0.45,
//         localTaxRate: 0.1,
//         minTaxExemption: 1000,
//       };

//       // 근로자 데이터 배열과 일자별 요약 객체로 변환
//       const workerDataArray = Array.from(workerMap.values()).sort(
//         (a, b) => a.worker_id - b.worker_id
//       ); // 근로자 ID 기준 오름차순 정렬
//       const dailySummariesObj = Object.fromEntries(dailyMap.entries());

//       console.log("근로자 데이터 로드 결과:", {
//         근로자수: workerDataArray.length,
//         일자별요약: Object.keys(dailySummariesObj).length,
//       });
//       // 전체 요약 정보 업데이트
//       set({
//         workerData: workerDataArray,
//         dailySummaries: dailySummariesObj,
//         payrollSummary: {
//           totalWorkers: workerMap.size,
//           totalWorkDays: dailyMap.size,
//           totalPaid: totalPaid,
//           totalUnpaid: totalUnpaid,
//           calcConstants: calcConstants, // 계산 상수 추가
//         },
//         loading: false,
//       });
//     } catch (error) {
//       console.error("일용직 급여 데이터 로드 오류:", error);
//       set({
//         loading: false,
//         error: "근로자 급여 정보를 불러오는 중 오류가 발생했습니다.",
//       });
//       toast.error("근로자 급여 정보를 불러오는 중 오류가 발생했습니다.");
//     }
//   },

//   // 지급 상태 업데이트 (낙관적 UI 업데이트 사용)
//   updatePaymentStatus: async (recordId, newStatus) => {
//     try {
//       // 1. 현재 레코드 찾기
//       const { workerData } = get();
//       let currentRecord = null;
//       let workerIndex = -1;
//       let recordIndex = -1;

//       // 레코드 및 해당 인덱스 찾기
//       for (let i = 0; i < workerData.length; i++) {
//         const worker = workerData[i];
//         const index = worker.records.findIndex((r) => r.record_id === recordId);
//         if (index !== -1) {
//           currentRecord = worker.records[index];
//           workerIndex = i;
//           recordIndex = index;
//           break;
//         }
//       }

//       if (!currentRecord) {
//         throw new Error("해당 레코드를 찾을 수 없습니다");
//       }

//       // 2. 낙관적 UI 업데이트 (먼저 UI 업데이트)
//       set((state) => {
//         const newWorkerData = [...state.workerData];
//         const worker = newWorkerData[workerIndex];
//         const record = worker.records[recordIndex];

//         // 레코드 상태 업데이트
//         newWorkerData[workerIndex].records[recordIndex] = {
//           ...record,
//           status: newStatus,
//           payment_date: newStatus === "paid" ? record.payment_date : null,
//         };

//         return { workerData: newWorkerData };
//       });

//       // 3. 서버 업데이트
//       const updateData = {
//         payment_status: newStatus,
//       };

//       if (newStatus === "unpaid") {
//         updateData.payment_date = null;
//       }

//       const { data, error } = await supabase
//         .from("work_records")
//         .update(updateData)
//         .eq("record_id", recordId)
//         .select();

//       if (error) {
//         // 서버 업데이트 실패 시 UI 롤백
//         set((state) => {
//           const newWorkerData = [...state.workerData];
//           const worker = newWorkerData[workerIndex];
//           const record = worker.records[recordIndex];

//           newWorkerData[workerIndex].records[recordIndex] = {
//             ...record,
//             status: currentRecord.status,
//             payment_date: currentRecord.payment_date,
//           };

//           return { workerData: newWorkerData };
//         });

//         throw error;
//       }

//       // 4. 일자별 요약 업데이트
//       if (workerIndex !== -1 && recordIndex !== -1) {
//         get().updateDailySummaries(workerIndex, recordIndex, newStatus);
//       } else {
//         console.warn("일자별 요약 업데이트 건너뜀: 유효하지 않은 인덱스", {
//           workerIndex,
//           recordIndex,
//         });
//       }

//       // 성공 메시지
//       toast.success(
//         `지급 상태가 '${newStatus === "unpaid" ? "미지급" : "지급"}'으로 변경되었습니다.`
//       );

//       return true;
//     } catch (error) {
//       console.error("지급 상태 변경 오류:", error);
//       toast.error("지급 상태 변경 중 오류가 발생했습니다.");
//       return false;
//     }
//   },

//   // 레코드 업데이트 (지급일 변경 등)
//   updateRecord: async (updatedRecord) => {
//     try {
//       // 레코드 찾기
//       const { workerData } = get();
//       let workerIndex = -1;
//       let recordIndex = -1;

//       for (let i = 0; i < workerData.length; i++) {
//         const worker = workerData[i];
//         const index = worker.records.findIndex((r) => r.record_id === updatedRecord.record_id);
//         if (index !== -1) {
//           workerIndex = i;
//           recordIndex = index;
//           break;
//         }
//       }

//       if (workerIndex === -1 || recordIndex === -1) {
//         throw new Error("해당 레코드를 찾을 수 없습니다");
//       }

//       // 낙관적 UI 업데이트
//       set((state) => {
//         const newWorkerData = [...state.workerData];
//         newWorkerData[workerIndex].records[recordIndex] = updatedRecord;
//         return { workerData: newWorkerData };
//       });

//       // 서버 업데이트
//       let paymentDate = updatedRecord.payment_date;
//       if (paymentDate && paymentDate instanceof Date) {
//         paymentDate = paymentDate.toISOString().split("T")[0]; // YYYY-MM-DD 형식으로 변환
//       }

//       const { error } = await supabase
//         .from("work_records")
//         .update({
//           payment_date: paymentDate,
//         })
//         .eq("record_id", updatedRecord.record_id);

//       if (error) {
//         // 실패 시 UI 롤백
//         set((state) => {
//           const newWorkerData = [...state.workerData];
//           newWorkerData[workerIndex].records[recordIndex] =
//             workerData[workerIndex].records[recordIndex];
//           return { workerData: newWorkerData };
//         });

//         throw error;
//       }

//       toast.success("지급일이 성공적으로 업데이트되었습니다.");
//       return true;
//     } catch (error) {
//       console.error("레코드 업데이트 오류:", error);
//       toast.error("레코드 업데이트 중 오류가 발생했습니다.");
//       return false;
//     }
//   },

//   // 일자별 요약 데이터 업데이트 (내부 함수)
//   // 일자별 요약 데이터 업데이트 (내부 함수)
//   updateDailySummaries: (workerIndex, recordIndex, newStatus) => {
//     // 매개변수 유효성 검사 추가
//     if (workerIndex === undefined || recordIndex === undefined || !newStatus) {
//       console.error("updateDailySummaries 호출 오류: 필수 매개변수 누락", {
//         workerIndex,
//         recordIndex,
//         newStatus,
//       });
//       return; // 매개변수가 올바르지 않으면 함수 실행 중단
//     }

//     set((state) => {
//       const { workerData, dailySummaries } = state;

//       // workerData 배열 범위 검사
//       if (!workerData || workerIndex >= workerData.length) {
//         console.error("updateDailySummaries 오류: 잘못된 workerIndex", {
//           workerDataLength: workerData?.length,
//           workerIndex,
//         });
//         return state; // 상태 변경 없이 현재 상태 반환
//       }

//       const worker = workerData[workerIndex];

//       // worker.records 배열 범위 검사
//       if (!worker.records || recordIndex >= worker.records.length) {
//         console.error("updateDailySummaries 오류: 잘못된 recordIndex", {
//           recordsLength: worker?.records?.length,
//           recordIndex,
//         });
//         return state; // 상태 변경 없이 현재 상태 반환
//       }

//       const record = worker.records[recordIndex];

//       // 해당 일자 찾기
//       const workDate = new Date(record.work_date);
//       const month = workDate.getMonth() + 1;
//       const day = workDate.getDate();
//       const dateStr = `${month}월 ${day}일`;

//       // 요약 데이터가 없으면 무시
//       if (!dailySummaries[dateStr]) {
//         console.warn(`updateDailySummaries: ${dateStr} 날짜에 대한 요약 데이터가 없음`);
//         return state;
//       }

//       const summary = dailySummaries[dateStr];
//       const dailyWage = parseFloat(record.dailyWage) || 0;

//       // 요약 데이터 업데이트
//       const newSummary = { ...summary };

//       if (newStatus === "paid") {
//         newSummary.paidAmount += dailyWage;
//         newSummary.unpaidAmount -= dailyWage;
//       } else {
//         newSummary.paidAmount -= dailyWage;
//         newSummary.unpaidAmount += dailyWage;
//       }

//       // 요약 데이터의 worker 상태 업데이트
//       const workerIdx = newSummary.workers.findIndex((w) => w.worker_id === worker.worker_id);
//       if (workerIdx !== -1) {
//         newSummary.workers[workerIdx].status = newStatus;
//       }

//       // 요약 업데이트
//       return {
//         dailySummaries: {
//           ...dailySummaries,
//           [dateStr]: newSummary,
//         },
//         // 전체 합계 업데이트
//         payrollSummary: {
//           ...state.payrollSummary,
//           totalPaid:
//             newStatus === "paid"
//               ? state.payrollSummary.totalPaid + dailyWage
//               : state.payrollSummary.totalPaid - dailyWage,
//           totalUnpaid:
//             newStatus === "paid"
//               ? state.payrollSummary.totalUnpaid - dailyWage
//               : state.payrollSummary.totalUnpaid + dailyWage,
//         },
//       };
//     });
//   },

//   // payrollStore.js의 handlePayment 함수 수정
//   handlePayment: async (record, worker, selectedDate = null) => {
//     // 마우스 위치 저장
//     const saveMousePosition = () => {
//       const mousePositionSave = {
//         x: window.event?.clientX || 0,
//         y: window.event?.clientY || 0,
//       };
//       return mousePositionSave;
//     };

//     // 현재 마우스 위치 저장
//     const savedPosition = saveMousePosition();

//     try {
//       // 날짜가 선택되지 않았으면 모달 표시
//       if (!selectedDate) {
//         set({
//           paymentInfo: {
//             recordId: record.record_id,
//             workerId: worker.worker_id,
//             worker: worker.name,
//             date: record.date,
//             workDate: record.work_date,
//             amount: record.dailyWage,
//             netAmount: record.netPay,
//           },
//           showPaymentModal: true,
//         });
//         return;
//       }

//       // 1. 낙관적 UI 업데이트: 먼저 UI 업데이트
//       const workerData = [...get().workerData];
//       let workerIndex = -1;
//       let recordIndex = -1;

//       for (let i = 0; i < workerData.length; i++) {
//         const w = workerData[i];
//         const idx = w.records.findIndex((r) => r.record_id === record.record_id);
//         if (idx !== -1) {
//           workerIndex = i;
//           recordIndex = idx;
//           break;
//         }
//       }

//       if (workerIndex !== -1 && recordIndex !== -1) {
//         // 낙관적 UI 업데이트 - 단일 상태 업데이트로 병합
//         set((state) => {
//           // 깊은 복사로 새 상태 생성
//           const newWorkerData = [...state.workerData];
//           newWorkerData[workerIndex].records[recordIndex].status = "paid";
//           newWorkerData[workerIndex].records[recordIndex].payment_date = selectedDate;

//           // 일자별 요약 업데이트
//           const dailySummaries = { ...state.dailySummaries };
//           const dateStr = newWorkerData[workerIndex].records[recordIndex].date;
//           const amount = parseFloat(newWorkerData[workerIndex].records[recordIndex].dailyWage) || 0;

//           if (dailySummaries[dateStr]) {
//             dailySummaries[dateStr] = {
//               ...dailySummaries[dateStr],
//               paidAmount: dailySummaries[dateStr].paidAmount + amount,
//               unpaidAmount: dailySummaries[dateStr].unpaidAmount - amount,
//               workers: dailySummaries[dateStr].workers.map((w) =>
//                 w.worker_id === workerData[workerIndex].worker_id ? { ...w, status: "paid" } : w
//               ),
//             };
//           }

//           // 갱신된 상태 반환
//           return {
//             workerData: newWorkerData,
//             dailySummaries,
//             payrollSummary: {
//               ...state.payrollSummary,
//               totalPaid: state.payrollSummary.totalPaid + amount,
//               totalUnpaid: state.payrollSummary.totalUnpaid - amount,
//             },
//           };
//         });
//       }

//       // 2. 백그라운드에서 서버 요청 처리
//       const formatDate = (date) => {
//         if (!date) return "";
//         const d = new Date(date);
//         const year = d.getFullYear();
//         const month = String(d.getMonth() + 1).padStart(2, "0");
//         const day = String(d.getDate()).padStart(2, "0");
//         return `${year}-${month}-${day}`;
//       };

//       const paymentDate = selectedDate ? formatDate(selectedDate) : formatDate(new Date());

//       // 서버 요청 (백그라운드에서 진행)
//       setTimeout(async () => {
//         try {
//           // 세금 계산 및 서버 업데이트
//           const dailyWage = parseFloat(record.dailyWage) || 0;
//           const allowances = parseFloat(record.allowances || 0) || 0;
//           const taxExemption = parseFloat(record.taxExemption || 0) || 0;
//           const totalPayAmount = dailyWage + allowances;

//           // 세금 계산...
//           const dailyIncomeDeduction = 150000;
//           const incomeTaxRate = 0.06;
//           const taxReductionRate = 0.45;
//           const localTaxRate = 0.1;
//           const minTaxExemption = 1000;

//           // 과세대상금액 및 소득세 계산...
//           let taxableIncome = Math.max(0, totalPayAmount - dailyIncomeDeduction - taxExemption);
//           let incomeTax =
//             taxableIncome > 0 ? Math.round(taxableIncome * incomeTaxRate * taxReductionRate) : 0;
//           incomeTax = incomeTax < minTaxExemption ? 0 : incomeTax;

//           // 주민세 및 고용보험료 계산
//           const localTax = Math.round(incomeTax * localTaxRate);
//           const employmentInsurance = Math.round(totalPayAmount * 0.009);

//           // 서버 업데이트
//           const { error } = await supabase
//             .from("work_records")
//             .update({
//               payment_status: "paid",
//               payment_date: paymentDate,
//               payment_method: "계좌이체", // 기본값
//               income_tax: incomeTax,
//               local_income_tax: localTax,
//               employment_insurance: employmentInsurance,
//             })
//             .eq("record_id", record.record_id);

//           if (error) throw error;

//           // 성공 메시지
//           toast.success(`${worker.name}님  ${paymentDate}에 지급 처리되었습니다.`);

//           // 캐시 무효화 (필요한 경우)
//           try {
//             const workTimeStore = require("@/lib/store/workTimeStore").default;
//             if (workTimeStore) {
//               workTimeStore.setState((state) => ({
//                 ...state,
//                 workReports: {},
//               }));
//             }
//           } catch (e) {
//             console.error("캐시 무효화 오류:", e);
//           }
//         } catch (e) {
//           console.error("백그라운드 지급 처리 오류:", e);
//           toast.error("지급 처리 중 오류가 발생했습니다.");
//         }
//       }, 0);

//       // 3. 마우스 위치 복원 (선택 사항)
//       setTimeout(() => {
//         try {
//           // 마우스 포인터 위치의 요소 찾기
//           const elementAtPoint = document.elementFromPoint(savedPosition.x, savedPosition.y);
//           if (elementAtPoint) {
//             // 필요한 경우 호버 이벤트 시뮬레이션
//             const mouseoverEvent = new MouseEvent("mouseover", {
//               bubbles: true,
//               cancelable: true,
//               view: window,
//               clientX: savedPosition.x,
//               clientY: savedPosition.y,
//             });
//             elementAtPoint.dispatchEvent(mouseoverEvent);
//           }
//         } catch (e) {
//           console.error("마우스 위치 복원 오류:", e);
//         }
//       }, 10);
//     } catch (error) {
//       console.error("지급 처리 오류:", error);
//       toast.error("지급 처리 중 오류가 발생했습니다.");
//     }
//   },

//   confirmPayment: async (recordId, paymentMethod, memo) => {
//     try {
//       // 현재 상태 복사 (롤백용)
//       const currentState = {
//         workerData: [...get().workerData],
//         dailySummaries: { ...get().dailySummaries },
//         payrollSummary: { ...get().payrollSummary },
//       };

//       // 현재 레코드 찾기
//       let workerIndex = -1;
//       let recordIndex = -1;
//       let worker = null;
//       let record = null;

//       for (let i = 0; i < currentState.workerData.length; i++) {
//         const w = currentState.workerData[i];
//         const idx = w.records.findIndex((r) => r.record_id === recordId);
//         if (idx !== -1) {
//           workerIndex = i;
//           recordIndex = idx;
//           worker = w;
//           record = w.records[idx];
//           break;
//         }
//       }

//       if (!record) {
//         throw new Error("레코드를 찾을 수 없습니다");
//       }

//       // 현재 날짜 (지급일)
//       const currentDate = new Date().toISOString().slice(0, 10);

//       // 1. 세금 계산 로직 (클라이언트에서 수행)
//       const dailyWage = parseFloat(record.dailyWage) || 0;
//       const allowances = parseFloat(record.allowances || 0);
//       const taxExemption = parseFloat(record.taxExemption || 0);
//       const totalPayAmount = dailyWage + allowances;
//       const taxableAmount = Math.max(0, totalPayAmount - taxExemption);

//       // 세금 계산 상수
//       const dailyIncomeDeduction = 150000; // 일용근로소득 공제액 15만원
//       const incomeTaxRate = 0.06; // 소득세율 6%
//       const taxReductionRate = 0.45; // 소득세 감면율 45%
//       const localTaxRate = 0.1; // 지방소득세율 10%
//       const minTaxExemption = 1000; // 소액부징수 기준액 1,000원

//       // 소득세 계산
//       let incomeTax = 0;
//       if (taxableAmount > dailyIncomeDeduction) {
//         const taxableIncome = taxableAmount - dailyIncomeDeduction;
//         incomeTax = Math.round(taxableIncome * incomeTaxRate * taxReductionRate);
//         incomeTax = incomeTax < minTaxExemption ? 0 : incomeTax;
//       }

//       // 주민세 계산 (소득세의 10%)
//       const localTax = Math.round(incomeTax * localTaxRate);

//       // 고용보험료 계산 (0.9%)
//       const employmentInsurance = Math.round(taxableAmount * 0.009);

//       // 공제 합계 계산
//       const totalDeduction =
//         incomeTax +
//         localTax +
//         employmentInsurance +
//         (parseFloat(record.nationalPension) || 0) +
//         (parseFloat(record.healthInsurance) || 0) +
//         (parseFloat(record.industrialAccident) || 0) +
//         (parseFloat(record.longTermCare) || 0);

//       // 실지급액 계산
//       const netPay = totalPayAmount - totalDeduction;

//       // 2. 낙관적 UI 업데이트 (즉시 UI 변경)
//       set((state) => {
//         // 깊은 복사를 통해 새 상태 객체 생성
//         const newState = {
//           // 모달 즉시 닫기
//           showPaymentModal: false,

//           // workerData 업데이트
//           workerData: state.workerData.map((w, wIdx) => {
//             if (wIdx !== workerIndex) return w;

//             return {
//               ...w,
//               records: w.records.map((r, rIdx) => {
//                 if (rIdx !== recordIndex) return r;

//                 // 해당 레코드 업데이트
//                 return {
//                   ...r,
//                   status: "paid",
//                   payment_date: currentDate,
//                   payment_method: paymentMethod,
//                   payment_memo: memo,
//                   incomeTax: incomeTax,
//                   localTax: localTax,
//                   employmentInsurance: employmentInsurance,
//                   totalDeduction: totalDeduction,
//                   netPay: netPay,
//                 };
//               }),
//             };
//           }),
//         };

//         // 일자별 요약 업데이트
//         if (record.date) {
//           const dateStr = record.date;
//           if (state.dailySummaries[dateStr]) {
//             const summary = state.dailySummaries[dateStr];
//             const amount = parseFloat(record.dailyWage) || 0;

//             newState.dailySummaries = {
//               ...state.dailySummaries,
//               [dateStr]: {
//                 ...summary,
//                 paidAmount: summary.paidAmount + amount,
//                 unpaidAmount: summary.unpaidAmount - amount,
//                 workers: summary.workers.map((w) =>
//                   w.worker_id === worker.worker_id ? { ...w, status: "paid" } : w
//                 ),
//               },
//             };
//           }
//         }

//         // 전체 요약 업데이트
//         const amount = parseFloat(record.dailyWage) || 0;
//         newState.payrollSummary = {
//           ...state.payrollSummary,
//           totalPaid: state.payrollSummary.totalPaid + amount,
//           totalUnpaid: state.payrollSummary.totalUnpaid - amount,
//         };

//         return newState;
//       });

//       // 3. 백그라운드에서 서버 업데이트
//       const { error } = await supabase
//         .from("work_records")
//         .update({
//           payment_status: "paid",
//           payment_date: currentDate,
//           payment_method: paymentMethod,
//           payment_memo: memo,
//           income_tax: incomeTax,
//           local_income_tax: localTax,
//           employment_insurance: employmentInsurance,
//         })
//         .eq("record_id", recordId);

//       if (error) throw error;

//       // 성공 메시지 표시
//       toast.success("지급이 완료되었습니다.");

//       // 캐시 무효화 (백그라운드에서 처리)
//       try {
//         const workTimeStore = require("@/lib/store/workTimeStore").default;
//         if (workTimeStore) {
//           workTimeStore.setState((state) => ({
//             ...state,
//             workReports: {},
//           }));
//           console.log("지급 처리 후 workTimeStore 캐시가 성공적으로 무효화되었습니다.");
//         }
//       } catch (e) {
//         console.error("지급 처리 후 workTimeStore 캐시 무효화 중 오류 발생:", e);
//       }
//     } catch (error) {
//       console.error("지급 처리 오류:", error);
//       toast.error("지급 처리 중 오류가 발생했습니다.");

//       // 4. 오류 발생 시 원래 상태로 복원
//       set({
//         workerData: currentState.workerData,
//         dailySummaries: currentState.dailySummaries,
//         payrollSummary: currentState.payrollSummary,
//         showPaymentModal: false,
//       });
//     }
//   },

//   confirmBulkPayment: async (items, paymentMethod, memo, paymentDate = null) => {
//     try {
//       // 현재 상태 캡처 (롤백용)
//       const currentState = {
//         workerData: [...get().workerData],
//         dailySummaries: { ...get().dailySummaries },
//         payrollSummary: { ...get().payrollSummary },
//       };

//       // 날짜 처리
//       const formatDate = (date) => {
//         if (!date) return "";
//         const d = new Date(date);
//         return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
//           d.getDate()
//         ).padStart(2, "0")}`;
//       };

//       const formattedDate = paymentDate
//         ? paymentDate instanceof Date
//           ? formatDate(paymentDate)
//           : paymentDate
//         : formatDate(new Date());

//       console.log(`일괄 지급처리 - 선택된 지급일: ${formattedDate}`);

//       // 영향 받는 레코드 ID와 날짜 매핑
//       const recordDateMap = new Map();
//       const recordWorkerMap = new Map();
//       const recordIds = [];

//       // 각 아이템에서 레코드 ID 수집
//       items.forEach((item) => {
//         item.records.forEach((record) => {
//           recordIds.push(record.record_id);
//           recordDateMap.set(record.record_id, record.date);
//           recordWorkerMap.set(record.record_id, item.worker_id);
//         });
//       });

//       // 1. 낙관적 UI 업데이트 - 즉시 UI 변경
//       set((state) => {
//         // 새로운 상태 객체 생성
//         const newState = {
//           // 모달 닫기
//           showBulkPaymentModal: false,

//           // 워커 데이터 업데이트
//           workerData: state.workerData.map((worker) => {
//             // 각 근로자의 레코드 업데이트
//             const updatedRecords = worker.records.map((record) => {
//               // 일괄 처리 대상인지 확인
//               if (recordIds.includes(record.record_id)) {
//                 return {
//                   ...record,
//                   status: "paid",
//                   payment_date: formattedDate,
//                   payment_method: paymentMethod,
//                   payment_memo: memo,
//                 };
//               }
//               return record;
//             });

//             return {
//               ...worker,
//               records: updatedRecords,
//             };
//           }),

//           // 일자별 요약 업데이트
//           dailySummaries: { ...state.dailySummaries },
//         };

//         // 영향 받는 날짜별 요약 정보 업데이트
//         const affectedDates = [...new Set(Array.from(recordDateMap.values()))];
//         let totalPaidAmount = 0;

//         affectedDates.forEach((dateStr) => {
//           if (newState.dailySummaries[dateStr]) {
//             const summary = newState.dailySummaries[dateStr];

//             // 해당 날짜의 모든 worker 상태 업데이트
//             const updatedWorkers = summary.workers.map((worker) => {
//               // 이 날짜에 일괄 지급 대상인 근로자 확인
//               const isAffected = items.some(
//                 (item) =>
//                   item.worker_id === worker.worker_id &&
//                   item.records.some((r) => r.date === dateStr)
//               );

//               if (isAffected && worker.status !== "paid") {
//                 totalPaidAmount += worker.amount;
//                 return { ...worker, status: "paid" };
//               }
//               return worker;
//             });

//             // 요약 정보 업데이트
//             newState.dailySummaries[dateStr] = {
//               ...summary,
//               workers: updatedWorkers,
//               paidAmount: summary.paidAmount + totalPaidAmount,
//               unpaidAmount: summary.unpaidAmount - totalPaidAmount,
//             };
//           }
//         });

//         // 전체 요약 업데이트
//         newState.payrollSummary = {
//           ...state.payrollSummary,
//           totalPaid: state.payrollSummary.totalPaid + totalPaidAmount,
//           totalUnpaid: state.payrollSummary.totalUnpaid - totalPaidAmount,
//         };

//         return newState;
//       });

//       // 2. 백그라운드에서 서버 업데이트
//       setTimeout(async () => {
//         try {
//           // 세금 계산 및 서버 업데이트
//           const updatePromises = recordIds.map(async (recordId) => {
//             // 여기에 세금 계산 코드 추가
//             const incomeTax = 0; // 예시 - 실제로는 계산 필요
//             const localTax = 0; // 예시 - 실제로는 계산 필요

//             return supabase
//               .from("work_records")
//               .update({
//                 payment_status: "paid",
//                 payment_date: formattedDate,
//                 payment_method: paymentMethod,
//                 payment_memo: memo,
//                 income_tax: incomeTax,
//                 local_income_tax: localTax,
//               })
//               .eq("record_id", recordId);
//           });

//           await Promise.all(updatePromises);

//           // 성공 메시지
//           toast.success(`일괄 지급이 ${formattedDate}로 완료되었습니다.`);

//           // 캐시 무효화 (선택 사항)
//           try {
//             const workTimeStore = require("@/lib/store/workTimeStore").default;
//             if (workTimeStore) {
//               workTimeStore.setState((state) => ({
//                 ...state,
//                 workReports: {},
//               }));
//             }
//           } catch (e) {
//             console.error("캐시 무효화 오류:", e);
//           }
//         } catch (error) {
//           console.error("일괄 지급 처리 백그라운드 오류:", error);
//           toast.error("일부 항목에 대한 지급 처리가 실패했습니다.");

//           // 오류 발생 시 롤백은 하지 않음 - 재시도 기회 제공
//         }
//       }, 0);
//     } catch (error) {
//       console.error("일괄 지급 처리 오류:", error);
//       toast.error("일괄 지급 처리 중 오류가 발생했습니다.");

//       // 3. 심각한 오류 시에만 원래 상태로 복원
//       set({
//         workerData: currentState.workerData,
//         dailySummaries: currentState.dailySummaries,
//         payrollSummary: currentState.payrollSummary,
//         showBulkPaymentModal: false,
//       });
//     }
//   },

//   showPayslip: (worker) => {
//     // 세금 계산 함수들
//     const calculateIncomeTax = (dailyWage, allowances, taxExemption) => {
//       // 과세 대상 총액 계산
//       const dailyTotal = Number(dailyWage) || 0;
//       const allowanceTotal = Number(allowances) || 0;
//       const exemptionTotal = Number(taxExemption) || 0;

//       const taxablePayAmount = dailyTotal + allowanceTotal - exemptionTotal;

//       // 상세 디버깅 로그
//       console.log(
//         `소득세 계산 - 일당: ${dailyTotal}, 수당: ${allowanceTotal}, 비과세: ${exemptionTotal}, 과세대상: ${taxablePayAmount}`
//       );

//       // 일용근로소득공제 적용 (15만원)
//       if (taxablePayAmount <= 150000) {
//         console.log(`과세대상(${taxablePayAmount})이 15만원 이하여서 소득세 0`);
//         return 0;
//       }

//       // 과세표준 계산
//       const taxBase = taxablePayAmount - 150000;

//       // 세액 계산 (과세표준 x 세율(6%) x 감면율(45%))
//       let tax = Math.round(taxBase * 0.06 * 0.45);

//       // 소액부징수 적용 (1,000원 미만 면제)
//       if (tax < 1000) {
//         console.log(`계산된 세액(${tax})이 1,000원 미만이어서 소득세 0`);
//         return 0;
//       }

//       console.log(`최종 소득세: ${tax}`);
//       return tax;
//     };

//     const calculateLocalTax = (incomeTax) => {
//       const localTax = Math.round(Number(incomeTax) * 0.1);
//       console.log(`지방소득세 계산: ${incomeTax} x 10% = ${localTax}`);
//       return localTax;
//     };

//     // 근로자 기록에 세금 정보 추가 및 계산
//     const completedRecords = worker.records.map((record) => {
//       // 기본값 확인
//       const dailyWage = Number(record.dailyWage) || 0;
//       const allowances = Number(record.allowances) || 0;
//       const taxExemption = Number(record.taxExemption) || 0;

//       console.log(
//         `레코드 처리(${record.date}) - 일당: ${dailyWage}, 수당: ${allowances}, 비과세: ${taxExemption}`
//       );

//       // 각 날짜별 세금 계산
//       const incomeTax = calculateIncomeTax(dailyWage, allowances, taxExemption);
//       const localTax = calculateLocalTax(incomeTax);

//       // 고용보험료 계산 (0.9%)
//       const taxableAmount = Math.max(0, dailyWage + allowances - taxExemption);
//       const employmentInsurance = Math.floor(taxableAmount * 0.009);

//       // 공제 합계
//       const totalDeduction =
//         Number(incomeTax) +
//         Number(localTax) +
//         Number(record.nationalPension || 0) +
//         Number(record.healthInsurance || 0) +
//         Number(employmentInsurance) +
//         Number(record.industrialAccident || 0) +
//         Number(record.longTermCare || 0);

//       // 실지급액 계산
//       const netPay = dailyWage + allowances - totalDeduction;

//       console.log(
//         `레코드 계산 결과 - 소득세: ${incomeTax}, 지방세: ${localTax}, 고용보험: ${employmentInsurance}, 총공제: ${totalDeduction}, 실지급: ${netPay}`
//       );

//       // 업데이트된 레코드 반환
//       return {
//         ...record,
//         incomeTax: incomeTax,
//         localTax: localTax,
//         employmentInsurance: employmentInsurance,
//         totalDeduction: totalDeduction,
//         netPay: netPay,
//       };
//     });

//     // 세금 및 공제 합계 계산
//     const totalIncomeTax = completedRecords.reduce((sum, r) => sum + Number(r.incomeTax || 0), 0);
//     const totalLocalTax = completedRecords.reduce((sum, r) => sum + Number(r.localTax || 0), 0);
//     const totalEmploymentInsurance = completedRecords.reduce(
//       (sum, r) => sum + Number(r.employmentInsurance || 0),
//       0
//     );
//     const totalDeductions = completedRecords.reduce(
//       (sum, r) => sum + Number(r.totalDeduction || 0),
//       0
//     );

//     // 총 실지급액 계산
//     const totalWage = Number(worker.totalWage) || 0;
//     const totalAllowance = Number(worker.totalAllowance) || 0;
//     const netPay = totalWage + totalAllowance - totalDeductions;

//     // 디버깅용 요약 로그
//     console.log("급여명세서 요약:", {
//       총일당: totalWage,
//       총수당: totalAllowance,
//       총소득세: totalIncomeTax,
//       총지방세: totalLocalTax,
//       총고용보험: totalEmploymentInsurance,
//       총공제액: totalDeductions,
//       총실지급액: netPay,
//     });

//     // 명세서 데이터 설정
//     set({
//       payslipInfo: {
//         worker_id: worker.worker_id,
//         name: worker.name,
//         resident_number: worker.resident_number,
//         contact_number: worker.contact_number,
//         job: worker.job_code || "일용직",
//         workRecords: completedRecords,
//         totalHours: worker.totalHours || 0,
//         totalWage: totalWage,
//         totalAllowance: totalAllowance,
//         totalTaxExemption: worker.totalTaxExemption || 0,
//         totalIncomeTax: totalIncomeTax,
//         totalLocalTax: totalLocalTax,
//         totalNationalPension: worker.totalNationalPension || 0,
//         totalHealthInsurance: worker.totalHealthInsurance || 0,
//         totalEmploymentInsurance: totalEmploymentInsurance,
//         totalDeductions: totalDeductions,
//         netPay: netPay,
//         yearMonth: get().yearMonth,
//       },
//       showPayslipModal: true,
//     });
//   },

//   // 현재 store 상태 초기화
//   resetStore: () => {
//     set({
//       yearMonth: new Date().toISOString().substring(0, 7),
//       loading: false,
//       error: null,
//       workerData: [],
//       dailySummaries: {},
//       payrollSummary: {
//         totalWorkers: 0,
//         totalWorkDays: 0,
//         totalPaid: 0,
//         totalUnpaid: 0,
//       },
//       showPaymentModal: false,
//       showBulkPaymentModal: false,
//       showPayslipModal: false,
//       paymentInfo: null,
//       bulkPaymentInfo: null,
//       payslipInfo: null,
//     });
//   },
// }));

// export default usePayrollStore;
