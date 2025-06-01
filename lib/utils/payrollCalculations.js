// lib/utils/payrollCalculations.js

/**
 * 일용근로자 급여 계산 관련 유틸리티 함수들
 */

/**
 * 소득세 계산 함수 - 비과세 제외
 * @param {Object} record - 근무 레코드
 * @param {number} record.dailyWage - 일당
 * @param {number} record.allowances - 수당
 * @param {number} record.taxExemption - 비과세
 * @returns {number} 계산된 소득세
 */
export const calculateIncomeTax = (record) => {
  const dailyWage = Number(record.dailyWage) || 0;
  const allowances = Number(record.allowances || 0);
  const taxExemption = Number(record.taxExemption || 0);

  const taxablePayAmount = dailyWage + allowances - taxExemption;
  const dailyIncomeDeduction = 150000; // 일용근로소득 공제액
  const incomeTaxRate = 0.06; // 소득세율 6%
  const taxReductionRate = 0.45; // 세액감면율 45%
  const minTaxExemption = 1000; // 최소 징수 금액

  let incomeTax = 0;

  if (taxablePayAmount > dailyIncomeDeduction) {
    const taxableAmount = taxablePayAmount - dailyIncomeDeduction;
    incomeTax = Math.round(taxableAmount * incomeTaxRate * taxReductionRate);
    incomeTax = incomeTax < minTaxExemption ? 0 : incomeTax;
  }

  return Math.max(0, incomeTax);
};

/**
 * 지방소득세 계산 함수 (소득세의 10%)
 * @param {number} incomeTax - 소득세
 * @returns {number} 계산된 지방소득세
 */
export const calculateLocalTax = (incomeTax) => {
  return Math.round(incomeTax * 0.1);
};

/**
 * 고용보험료 계산 함수 (지급계 - 비과세의 0.9%)
 * @param {Object} record - 근무 레코드
 * @param {number} record.dailyWage - 일당
 * @param {number} record.allowances - 수당
 * @param {number} record.taxExemption - 비과세
 * @returns {number} 계산된 고용보험료
 */
export const calculateEmploymentInsurance = (record) => {
  const dailyWage = Number(record.dailyWage) || 0;
  const allowances = Number(record.allowances || 0);
  const taxExemption = Number(record.taxExemption || 0);
  const taxablePayAmount = dailyWage + allowances - taxExemption;
  const employmentInsuranceRate = 0.009; // 고용보험료율 0.9%
  return Math.round(Math.max(0, taxablePayAmount) * employmentInsuranceRate);
};

/**
 * 공제 합계 계산 함수
 * @param {Object} record - 근무 레코드
 * @returns {number} 총 공제액
 */
export const calculateTotalDeduction = (record) => {
  const incomeTax = calculateIncomeTax(record);
  const localTax = calculateLocalTax(incomeTax);
  const employmentInsurance = calculateEmploymentInsurance(record);

  const nationalPension = Number(record.nationalPension) || 0;
  const healthInsurance = Number(record.healthInsurance) || 0;
  const industrialAccident = Number(record.industrialAccident) || 0;
  const longTermCare = Number(record.longTermCare) || 0;

  return (
    incomeTax +
    localTax +
    nationalPension +
    healthInsurance +
    employmentInsurance +
    industrialAccident +
    longTermCare
  );
};

/**
 * 실지급액 계산 함수
 * @param {Object} record - 근무 레코드
 * @returns {number} 실지급액
 */
export const calculateNetPay = (record) => {
  const dailyWage = Number(record.dailyWage) || 0;
  const allowances = Number(record.allowances || 0);
  const totalPay = dailyWage + allowances;
  const totalDeduction = calculateTotalDeduction(record);
  return totalPay - totalDeduction;
};

/**
 * 지급계 계산 함수 (일당 + 수당)
 * @param {Object} record - 근무 레코드
 * @returns {number} 지급계
 */
export const calculateTotalPay = (record) => {
  const dailyWage = Number(record.dailyWage) || 0;
  const allowances = Number(record.allowances || 0);
  return dailyWage + allowances;
};

/**
 * 과세대상 금액 계산 함수 (지급계 - 비과세)
 * @param {Object} record - 근무 레코드
 * @returns {number} 과세대상 금액
 */
export const calculateTaxableAmount = (record) => {
  const totalPay = calculateTotalPay(record);
  const taxExemption = Number(record.taxExemption || 0);
  return Math.max(0, totalPay - taxExemption);
};

/**
 * 근로자별 소계 계산 함수
 * @param {Array} records - 근로자의 모든 근무 레코드
 * @param {Function} getEffectiveValue - 편집값 가져오기 함수
 * @returns {Object} 소계 정보
 */
export const calculateWorkerSubtotal = (records, getEffectiveValue = null) => {
  const subtotal = {
    totalDays: records.length,
    totalHours: 0,
    totalWage: 0,
    totalAllowances: 0,
    totalPay: 0,
    totalTaxExemption: 0,
    totalIncomeTax: 0,
    totalLocalTax: 0,
    totalNationalPension: 0,
    totalHealthInsurance: 0,
    totalEmploymentInsurance: 0,
    totalIndustrialAccident: 0,
    totalLongTermCare: 0,
    totalDeduction: 0,
    totalNetPay: 0,
  };

  records.forEach((record) => {
    // 편집값이 있으면 적용, 없으면 원본값 사용
    const effectiveRecord = getEffectiveValue
      ? {
          ...record,
          allowances: getEffectiveValue(record, "allowances"),
          taxExemption: getEffectiveValue(record, "taxExemption"),
        }
      : record;

    subtotal.totalHours += Number(record.hours) || 0;
    subtotal.totalWage += Number(record.dailyWage) || 0;
    subtotal.totalAllowances += Number(effectiveRecord.allowances) || 0;
    subtotal.totalTaxExemption += Number(effectiveRecord.taxExemption) || 0;
    subtotal.totalNationalPension += Number(record.nationalPension) || 0;
    subtotal.totalHealthInsurance += Number(record.healthInsurance) || 0;
    subtotal.totalIndustrialAccident += Number(record.industrialAccident) || 0;
    subtotal.totalLongTermCare += Number(record.longTermCare) || 0;

    // 계산된 값들
    const incomeTax = calculateIncomeTax(effectiveRecord);
    const localTax = calculateLocalTax(incomeTax);
    const employmentInsurance = calculateEmploymentInsurance(effectiveRecord);
    const totalDeduction = calculateTotalDeduction(effectiveRecord);
    const netPay = calculateNetPay(effectiveRecord);

    subtotal.totalIncomeTax += incomeTax;
    subtotal.totalLocalTax += localTax;
    subtotal.totalEmploymentInsurance += employmentInsurance;
    subtotal.totalDeduction += totalDeduction;
    subtotal.totalNetPay += netPay;
  });

  subtotal.totalPay = subtotal.totalWage + subtotal.totalAllowances;

  return subtotal;
};

/**
 * 전체 합계 계산 함수
 * @param {Array} workersData - 모든 근로자 데이터
 * @param {Function} getEffectiveValue - 편집값 가져오기 함수
 * @returns {Object} 전체 합계 정보
 */
export const calculateGrandTotal = (workersData, getEffectiveValue = null) => {
  const grandTotal = {
    totalWorkers: workersData.length,
    totalDays: 0,
    totalHours: 0,
    totalWage: 0,
    totalAllowances: 0,
    totalPay: 0,
    totalTaxExemption: 0,
    totalIncomeTax: 0,
    totalLocalTax: 0,
    totalNationalPension: 0,
    totalHealthInsurance: 0,
    totalEmploymentInsurance: 0,
    totalIndustrialAccident: 0,
    totalLongTermCare: 0,
    totalDeduction: 0,
    totalNetPay: 0,
  };

  workersData.forEach((worker) => {
    const workerSubtotal = calculateWorkerSubtotal(worker.records, getEffectiveValue);

    grandTotal.totalDays += workerSubtotal.totalDays;
    grandTotal.totalHours += workerSubtotal.totalHours;
    grandTotal.totalWage += workerSubtotal.totalWage;
    grandTotal.totalAllowances += workerSubtotal.totalAllowances;
    grandTotal.totalPay += workerSubtotal.totalPay;
    grandTotal.totalTaxExemption += workerSubtotal.totalTaxExemption;
    grandTotal.totalIncomeTax += workerSubtotal.totalIncomeTax;
    grandTotal.totalLocalTax += workerSubtotal.totalLocalTax;
    grandTotal.totalNationalPension += workerSubtotal.totalNationalPension;
    grandTotal.totalHealthInsurance += workerSubtotal.totalHealthInsurance;
    grandTotal.totalEmploymentInsurance += workerSubtotal.totalEmploymentInsurance;
    grandTotal.totalIndustrialAccident += workerSubtotal.totalIndustrialAccident;
    grandTotal.totalLongTermCare += workerSubtotal.totalLongTermCare;
    grandTotal.totalDeduction += workerSubtotal.totalDeduction;
    grandTotal.totalNetPay += workerSubtotal.totalNetPay;
  });

  return grandTotal;
};

/**
 * 일자별 그룹화 및 계산 함수
 * @param {Array} workersData - 모든 근로자 데이터
 * @param {Function} getEffectiveValue - 편집값 가져오기 함수
 * @returns {Object} 일자별 그룹화된 데이터
 */
export const groupRecordsByDateWithCalculations = (workersData, getEffectiveValue = null) => {
  const dateGroups = {};

  workersData.forEach((worker) => {
    worker.records.forEach((record) => {
      const recordDate = new Date(record.work_date);

      // '월 일' 형식의 키 생성 (예: '5월 2일')
      // current locale is 'ko-KR' (Korean)
      const dateKey = recordDate.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });

      if (!dateGroups[dateKey]) {
        dateGroups[dateKey] = {
          day: record.day,
          dateStr: dateKey,
          workers: [],
        };
      }

      // 기존 근로자가 있는지 확인
      const existingWorkerIndex = dateGroups[dateKey].workers.findIndex(
        (w) => w.worker_id === worker.worker_id
      );

      const effectiveRecord = getEffectiveValue
        ? {
            ...record,
            allowances: getEffectiveValue(record, "allowances"),
            taxExemption: getEffectiveValue(record, "taxExemption"),
          }
        : record;

      const workerRecord = {
        worker_id: worker.worker_id,
        name: worker.name,
        hours: record.hours,
        dailyWage: Number(record.dailyWage) || 0,
        allowances: Number(effectiveRecord.allowances) || 0,
        taxExemption: Number(effectiveRecord.taxExemption) || 0,
        nationalPension: Number(record.nationalPension) || 0,
        healthInsurance: Number(record.healthInsurance) || 0,
        industrialAccident: Number(record.industrialAccident) || 0,
        longTermCare: Number(record.longTermCare) || 0,
        status: record.status || "unpaid",
        record: record, // 원본 레코드 참조
      };

      // 계산된 값들 추가
      workerRecord.totalDeduction = calculateTotalDeduction(workerRecord);
      workerRecord.netPay = calculateNetPay(workerRecord);

      if (existingWorkerIndex >= 0) {
        // 이미 있는 근로자면 데이터 합계
        const existing = dateGroups[dateKey].workers[existingWorkerIndex];
        existing.hours += workerRecord.hours;
        existing.dailyWage += workerRecord.dailyWage;
        existing.allowances += workerRecord.allowances;
        existing.taxExemption += workerRecord.taxExemption;
        existing.nationalPension += workerRecord.nationalPension;
        existing.healthInsurance += workerRecord.healthInsurance;
        existing.industrialAccident += workerRecord.industrialAccident;
        existing.longTermCare += workerRecord.longTermCare;
        existing.totalDeduction += workerRecord.totalDeduction;
        existing.netPay += workerRecord.netPay;

        // 상태는 하나라도 미지급이면 미지급으로
        if (workerRecord.status !== "paid") {
          existing.status = "unpaid";
        }
      } else {
        dateGroups[dateKey].workers.push(workerRecord);
      }
    });
  });

  // 각 날짜별 요약 정보 계산
  Object.values(dateGroups).forEach((group) => {
    const workers = group.workers;

    group.totalAmount = workers.reduce(
      (sum, worker) => sum + worker.dailyWage + worker.allowances,
      0
    );
    group.totalDeductionAmount = workers.reduce((sum, worker) => sum + worker.totalDeduction, 0);
    group.totalNetAmount = workers.reduce((sum, worker) => sum + worker.netPay, 0);

    // 미지급 계산
    const unpaidWorkers = workers.filter((worker) => worker.status !== "paid");
    group.unpaidNetAmount = unpaidWorkers.reduce((sum, worker) => sum + worker.netPay, 0);
    group.hasUnpaid = unpaidWorkers.length > 0;
  });

  return dateGroups;
};
