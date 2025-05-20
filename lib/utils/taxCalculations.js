// /lib/utils/taxCalculations.js

// /lib/utils/taxCalculations.js

/**
 * 일별 소득세 계산
 * @param {number} dailyWage - 일급여액
 * @param {Object} rates - 세율 설정 객체
 * @returns {number} - 계산된 일별 소득세
 */
export const calculateDailyTax = (dailyWage, rates = {}) => {
  const dailyIncomeDeduction = rates.dailyIncomeDeduction || 150000; // 일용근로소득 공제액 (기본값 15만원)
  const incomeTaxRate = rates.incomeTaxRate || 0.06; // 소득세율 (기본값 6%)
  const taxReductionRate = rates.taxReductionRate || 0.45; // 소득세 감면율 (기본값 45%)

  let dailyTax = 0;
  let dailyTaxableAmount = 0;

  if (dailyWage > dailyIncomeDeduction) {
    dailyTaxableAmount = dailyWage - dailyIncomeDeduction; // 일 공제액 적용
    dailyTax = Math.round(dailyTaxableAmount * incomeTaxRate * taxReductionRate); // 세율과 감면율 적용
  }

  return {
    dailyTax,
    dailyTaxableAmount,
    formula:
      dailyTaxableAmount > 0
        ? `(${formatNumber(dailyWage)} - ${formatNumber(dailyIncomeDeduction)}) × ${(
            incomeTaxRate * 100
          ).toFixed(1)}% × ${(taxReductionRate * 100).toFixed(1)}% = ${formatNumber(dailyTax)}`
        : `과세표준 없음 (일당 ≤ ${formatNumber(dailyIncomeDeduction)}원)`,
  };
};

/**
 * 소액부징수 규칙 적용
 * @param {number} tax - 원본 세액
 * @param {number} minTaxExemption - 소액부징수 기준액
 * @returns {number} - 소액부징수 적용 후 세액
 */
export const applyMinimumTaxRule = (tax, minTaxExemption = 1000) => {
  return tax < minTaxExemption ? 0 : tax;
};

/**
 * 근로자별 급여 및 세금 합계 계산
 * @param {Object} workRecords - 근로 기록 데이터
 * @param {number} workerId - 근로자 ID
 * @param {Object} rates - 세율 및 보험요율 설정값
 * @returns {Object} - 계산된 합계 정보
 */
export const calculateWorkerTotals = (workRecords, workerId, rates = {}) => {
  // 세율 및 보험요율 기본값 설정
  const {
    incomeTaxRate = 0.06, // 기본 소득세율 6%
    taxReductionRate = 0.45, // 소득세 감면율 45%
    minTaxExemption = 1000, // 소액부징수 1,000원
    localTaxRate = 0.1, // 지방소득세율 10%
    dailyIncomeDeduction = 150000, // 일용근로자 소득공제 15만원
    employmentInsuranceRate = 0.008, // 고용보험 0.8%
    healthInsuranceRate = 0.0323, // 건강보험 3.23%
    nationalPensionRate = 0.045, // 국민연금 4.5%
  } = rates;

  const workerRecords = workRecords[workerId] || {};
  let totalHours = 0;
  let totalWage = 0;
  let workDays = 0;
  let totalBiGwaSe = 0; // 비과세 소득 합계
  let dailyTaxCalcDetails = []; // 일별 세금 계산 상세 정보

  const sortedDays = Object.keys(workerRecords)
    .map((day) => parseInt(day))
    .sort((a, b) => a - b);

  sortedDays.forEach((day) => {
    const record = workerRecords[day];
    if (record && record.hours) {
      const dailyWage = parseFloat(record.wage) || 0;
      totalHours += parseFloat(record.hours);
      totalWage += dailyWage;
      workDays++;

      // 비과세 소득 계산 (실제로는 별도 데이터 필요)
      // 현재 예시에서는 0으로 설정
      totalBiGwaSe += 0;

      // 일별 세금 계산에 세율 설정 전달
      const { dailyTax, dailyTaxableAmount, formula } = calculateDailyTax(dailyWage, {
        dailyIncomeDeduction,
        incomeTaxRate,
        taxReductionRate,
      });

      // 일별 세금 계산 정보 저장
      dailyTaxCalcDetails.push({
        day,
        date: record.date,
        dailyWage,
        dailyTaxableAmount,
        formula,
        dailyTax,
      });
    }
  });

  // 총 소득세 계산 (일별 세금 합산)
  let incomeTax = dailyTaxCalcDetails.reduce((sum, detail) => sum + detail.dailyTax, 0);

  // 소액부징수 적용 전 원본 소득세 저장
  const originalIncomeTax = incomeTax;

  // 소액부징수 적용
  incomeTax = applyMinimumTaxRule(incomeTax, minTaxExemption);

  // 지방소득세 계산
  const localTax = Math.round(incomeTax * localTaxRate);

  // 사회보험료 계산
  const employmentInsurance = Math.round(totalWage * employmentInsuranceRate);
  const healthInsurance = Math.round(totalWage * healthInsuranceRate);
  const nationalPension = Math.round(totalWage * nationalPensionRate);

  // 총 공제액 및 실지급액 계산
  const totalDeduction =
    incomeTax + localTax + employmentInsurance + healthInsurance + nationalPension;
  const netPay = totalWage - totalDeduction;

  return {
    totalHours,
    totalWage,
    taxableIncome: totalWage, // 과세소득은 총급여액과 동일
    biGwaSe: totalBiGwaSe, // 비과세소득
    workDays,
    hourlyRate: workDays > 0 ? Math.round(totalWage / totalHours) : 0,
    incomeTax,
    localTax,
    employmentInsurance,
    healthInsurance,
    nationalPension,
    totalDeduction,
    netPay,
    originalIncomeTax, // 소액부징수 전 원본 소득세
    soakBuJingSu: incomeTax === 0 && originalIncomeTax > 0, // 소액부징수 적용 여부
    dailyTaxCalcDetails, // 일별 세금 계산 상세 정보
  };
};

/**
 * 금액 형식 변환 (천 단위 콤마)
 * @param {number} value - 포맷팅할 금액
 * @returns {string} - 포맷팅된 금액 문자열
 */
export const formatNumber = (value) => {
  if (value === undefined || value === null) return "";
  return value.toLocaleString();
};

/**
 * 주민등록번호 포맷 변환
 * @param {string} num - 주민등록번호
 * @returns {string} - 포맷팅된 주민등록번호
 */
export const formatResidentNumber = (num) => {
  if (!num) return "";
  return num.replace(/^(\d{6})(\d{7})$/, "$1-$2");
};

/**
 * 전화번호 포맷 변환
 * @param {string} num - 전화번호
 * @returns {string} - 포맷팅된 전화번호
 */
export const formatPhoneNumber = (num) => {
  if (!num) return "";
  return num.replace(/^(\d{2,3})(\d{3,4})(\d{4})$/, "$1-$2-$3");
};

/**
 * 사업자등록번호 포맷 변환
 * @param {string} num - 사업자등록번호
 * @returns {string} - 포맷팅된 사업자등록번호
 */
export const formatBusinessNumber = (num) => {
  if (!num) return "";
  return num.replace(/^(\d{3})(\d{2})(\d{5})$/, "$1-$2-$3");
};

/**
 * 날짜 형식 변환 (일자만 추출)
 * @param {string} dateString - YYYY-MM-DD 형식의 날짜 문자열
 * @returns {string} - 일자만 추출된 문자열
 */
export const formatDateToDayOnly = (dateString) => {
  if (!dateString) return "";
  const parts = dateString.split("-");
  if (parts.length === 3) {
    return parts[2]; // 일자만 반환
  }
  return dateString;
};
