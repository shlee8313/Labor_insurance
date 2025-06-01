// file: lib/utils/insurance_enrollments_helper.js (수정된 버전)

/**
 * 4대보험 가입/상실 관리를 위한 헬퍼 함수들
 */

/**
 * 특정 월의 이전/이후 월 계산
 */
export const getAdjacentMonth = (yearMonth, direction = "previous") => {
  const [year, month] = yearMonth.split("-").map((num) => parseInt(num));

  if (direction === "previous") {
    const prevMonth = month - 1;
    if (prevMonth === 0) {
      return `${year - 1}-12`;
    }
    return `${year}-${prevMonth.toString().padStart(2, "0")}`;
  } else {
    const nextMonth = month + 1;
    if (nextMonth === 13) {
      return `${year + 1}-01`;
    }
    return `${year}-${nextMonth.toString().padStart(2, "0")}`;
  }
};

/**
 * 🔧 수정됨: 활성 가입 상태 확인 (개별 보험별로 정확히 확인)
 * @param {Array} enrollmentRecords - 가입 기록 배열
 * @returns {boolean} 활성 가입 여부
 */
export const hasActiveInsuranceEnrollment = (enrollmentRecords) => {
  if (!enrollmentRecords || enrollmentRecords.length === 0) return false;

  console.log("🔧 활성 가입 상태 확인:", enrollmentRecords.length, "개 레코드");

  // 각 레코드에서 활성 상태인 보험이 하나라도 있는지 확인
  const hasActive = enrollmentRecords.some((record) => {
    console.log("🔧 레코드 확인:", {
      enrollment_status: record.enrollment_status,
      worker_id: record.worker_id,
    });

    // 🔧 추가: enrollment_status가 terminated인 경우 즉시 false
    if (record.enrollment_status === "terminated") {
      console.log("  → 종료된 가입 상태");
      return false;
    }

    // 각 보험별로 개별적으로 확인
    const insuranceChecks = [
      {
        acq: record.national_pension_acquisition_date,
        loss: record.national_pension_loss_date,
        status: record.national_pension_status,
        name: "국민연금",
      },
      {
        acq: record.health_insurance_acquisition_date,
        loss: record.health_insurance_loss_date,
        status: record.health_insurance_status,
        name: "건강보험",
      },
      {
        acq: record.employment_insurance_acquisition_date,
        loss: record.employment_insurance_loss_date,
        status: record.employment_insurance_status,
        name: "고용보험",
      },
      {
        acq: record.industrial_accident_acquisition_date,
        loss: record.industrial_accident_loss_date,
        status: record.industrial_accident_status,
        name: "산재보험",
      },
    ];

    // 하나라도 활성 상태인 보험이 있으면 true
    const activeInsurances = insuranceChecks.filter((insurance) => {
      // 🔧 강화된 로직: 가입일이 있고 상실일이 없으며 상태가 required인 경우만 활성으로 간주
      const hasAcquisition = !!insurance.acq;
      const hasNoLoss = !insurance.loss;
      const hasRequiredStatus =
        insurance.status === "auto_required" || insurance.status === "manual_required";

      const isActive = hasAcquisition && hasNoLoss && hasRequiredStatus;

      console.log(`    ${insurance.name}:`, {
        가입일: insurance.acq,
        상실일: insurance.loss,
        상태: insurance.status,
        활성여부: isActive,
      });

      return isActive;
    });

    const recordHasActive = activeInsurances.length > 0;
    console.log(`  → 레코드 활성 보험 수: ${activeInsurances.length}`);

    return recordHasActive;
  });

  console.log("🔧 최종 활성 가입 상태:", hasActive);
  return hasActive;
};

/**
 * 🔧 수정됨: 현재 월 근무 여부 확인 (더 정확한 조건)
 * @param {Object} workHistory - 근무 이력
 * @returns {boolean} 현재 월 근무 여부
 */
export const hasCurrentMonthWork = (workHistory) => {
  if (!workHistory) return false;

  // 현재 월에 실제 근무한 경우
  const hasActualWork =
    (workHistory.currentMonthWorkDays || 0) > 0 || (workHistory.currentMonthWorkHours || 0) > 0;

  // 현재 월에 등록된 경우
  const isRegistered = workHistory.isRegisteredInCurrentMonth || false;

  return hasActualWork || isRegistered;
};

/**
 * 상실일 이후 재가입 가능 월인지 확인
 * @param {string} yearMonth - 조회 년월 (YYYY-MM)
 * @param {Array} enrollmentRecords - 가입 기록 배열
 * @returns {boolean} 재가입 가능 여부
 */
export const canReEnrollAfterLoss = (yearMonth, enrollmentRecords) => {
  if (!enrollmentRecords || enrollmentRecords.length === 0) return true;

  // 가장 최근 상실일 찾기
  let latestLossDate = null;

  enrollmentRecords.forEach((record) => {
    // 모든 보험의 상실일 중 가장 늦은 날짜 찾기
    const lossDates = [
      record.national_pension_loss_date,
      record.health_insurance_loss_date,
      record.employment_insurance_loss_date,
      record.industrial_accident_loss_date,
    ].filter((date) => date !== null);

    lossDates.forEach((lossDate) => {
      if (!latestLossDate || lossDate > latestLossDate) {
        latestLossDate = lossDate;
      }
    });
  });

  if (!latestLossDate) return true;

  // 상실일의 다음 달부터 재가입 가능
  const lossDate = new Date(latestLossDate);
  const lossYearMonth = `${lossDate.getFullYear()}-${(lossDate.getMonth() + 1)
    .toString()
    .padStart(2, "0")}`;
  const nextMonthAfterLoss = getAdjacentMonth(lossYearMonth, "next");

  return yearMonth >= nextMonthAfterLoss;
};

// 🔧 개선된 isEnrolledInThisMonth 함수 (helper 파일에서 교체)

/**
 * 해당 달에 가입처리된 근로자인지 확인 (개선된 버전)
 * year_month 필드와 acquisition_date를 모두 고려
 * @param {number} workerId - 근로자 ID
 * @param {string} yearMonth - 년월 (YYYY-MM)
 * @param {Array} enrollmentRecords - 가입 기록 배열
 * @returns {boolean} 해당 달 가입처리 여부
 */
export const isEnrolledInThisMonth = (workerId, yearMonth, enrollmentRecords) => {
  console.log("🔧 개선된 이번달 가입처리 확인:", {
    workerId,
    yearMonth,
    레코드수: enrollmentRecords?.length || 0,
  });

  if (!enrollmentRecords || enrollmentRecords.length === 0) {
    console.log("  → 가입 기록 없음");
    return false;
  }

  const result = enrollmentRecords.some((record) => {
    console.log("🔧 레코드 검사:", {
      record_worker_id: record.worker_id,
      target_worker_id: workerId,
      record_year_month: record.year_month,
      target_year_month: yearMonth,
    });

    if (record.worker_id !== workerId) return false;

    // 🔧 방법 1: year_month 필드로 확인 (더 정확함)
    if (record.year_month === yearMonth) {
      console.log("  → year_month 필드 일치로 해당 월 가입처리 확인됨");
      return true;
    }

    // 🔧 방법 2: acquisition_date로도 확인 (fallback)
    const acquisitionDates = [
      record.national_pension_acquisition_date,
      record.health_insurance_acquisition_date,
      record.employment_insurance_acquisition_date,
      record.industrial_accident_acquisition_date,
    ].filter((date) => date !== null && date !== undefined && date !== "");

    console.log("  → 가입일 목록:", acquisitionDates);

    if (acquisitionDates.length === 0) {
      console.log("  → 유효한 가입일 없음");
      return false;
    }

    const hasThisMonthAcquisition = acquisitionDates.some((date) => {
      if (!date) return false;

      try {
        let acquisitionDate;

        if (typeof date === "string") {
          acquisitionDate = new Date(date);
        } else if (date instanceof Date) {
          acquisitionDate = date;
        } else {
          console.warn("알 수 없는 날짜 형식:", date);
          return false;
        }

        if (isNaN(acquisitionDate.getTime())) {
          console.warn("유효하지 않은 날짜:", date);
          return false;
        }

        const acquisitionYearMonth = `${acquisitionDate.getFullYear()}-${String(
          acquisitionDate.getMonth() + 1
        ).padStart(2, "0")}`;

        console.log("    acquisition_date 확인:", {
          원본가입일: date,
          변환된년월: acquisitionYearMonth,
          대상년월: yearMonth,
          일치여부: acquisitionYearMonth === yearMonth,
        });

        return acquisitionYearMonth === yearMonth;
      } catch (error) {
        console.error("날짜 변환 오류:", date, error);
        return false;
      }
    });

    console.log(`  → 근로자 ${workerId} acquisition_date 기준 결과:`, hasThisMonthAcquisition);
    return hasThisMonthAcquisition;
  });

  console.log(`🔧 최종 결과 - 근로자 ${workerId} 이번달(${yearMonth}) 가입처리:`, result);
  return result;
};

// 🔧 추가: 취소 버튼 표시를 위한 더 명확한 함수
export const shouldShowCancelButton = (workerId, yearMonth, enrollmentRecords) => {
  console.log("🔧 취소 버튼 표시 여부 확인:", { workerId, yearMonth });

  if (!enrollmentRecords || enrollmentRecords.length === 0) {
    console.log("  → 가입 기록 없음, 취소 버튼 안보임");
    return false;
  }

  // 1. 해당 월의 레코드가 있는지 확인
  const thisMonthRecord = enrollmentRecords.find(
    (record) => record.worker_id === workerId && record.year_month === yearMonth
  );

  if (!thisMonthRecord) {
    console.log("  → 해당 월 레코드 없음, 취소 버튼 안보임");
    return false;
  }

  // 2. 해당 월에 실제로 가입처리가 되었는지 확인
  const hasAcquisitionThisMonth = [
    thisMonthRecord.national_pension_acquisition_date,
    thisMonthRecord.health_insurance_acquisition_date,
    thisMonthRecord.employment_insurance_acquisition_date,
    thisMonthRecord.industrial_accident_acquisition_date,
  ].some((date) => {
    if (!date) return false;

    try {
      const acquisitionDate = new Date(date);
      const acquisitionYearMonth = `${acquisitionDate.getFullYear()}-${String(
        acquisitionDate.getMonth() + 1
      ).padStart(2, "0")}`;
      return acquisitionYearMonth === yearMonth;
    } catch {
      return false;
    }
  });

  // 3. enrollment_status도 확인
  const isConfirmedStatus = thisMonthRecord.enrollment_status === "confirmed";

  const shouldShow = hasAcquisitionThisMonth && isConfirmedStatus;

  console.log("  → 취소 버튼 표시 결과:", {
    해당월레코드있음: !!thisMonthRecord,
    해당월가입처리됨: hasAcquisitionThisMonth,
    확정상태: isConfirmedStatus,
    최종결과: shouldShow,
  });

  return shouldShow;
};

/**
 * 근로자별 미가입 보험 유형 확인
 * @param {number} workerId - 근로자 ID
 * @param {number} siteId - 현장 ID
 * @param {Object} insuranceStatusData - 보험 상태 데이터
 * @param {Object} enrollmentRecordsData - 가입 기록 데이터
 * @returns {Array} 미가입인데 가입 대상인 보험 유형 배열
 */
export const getEligibleUnEnrolledInsurances = (
  workerId,
  siteId,
  insuranceStatusData,
  enrollmentRecordsData
) => {
  const eligibleTypes = [];
  const workerStatus = insuranceStatusData?.[workerId];
  const cacheKey = `${workerId}-${siteId}`;
  const enrollmentRecords = enrollmentRecordsData?.[cacheKey] || [];

  if (!workerStatus) return eligibleTypes;

  const insuranceTypes = [
    { key: "nationalPension", type: "national_pension", name: "국민연금" },
    { key: "healthInsurance", type: "health_insurance", name: "건강보험" },
    { key: "employmentInsurance", type: "employment_insurance", name: "고용보험" },
    { key: "industrialAccident", type: "industrial_accident", name: "산재보험" },
  ];

  insuranceTypes.forEach(({ key, type, name }) => {
    const isRequired = workerStatus[key]?.required || false;

    // 🔧 수정됨: 개별 보험별로 정확히 가입 상태 확인
    const isEnrolled = enrollmentRecords.some((record) => {
      const acqField = `${type}_acquisition_date`;
      const lossField = `${type}_loss_date`;
      const statusField = `${type}_status`;

      return (
        (record[acqField] && !record[lossField]) ||
        record[statusField] === "auto_required" ||
        record[statusField] === "manual_required"
      );
    });

    if (isRequired && !isEnrolled) {
      eligibleTypes.push({ type, name });
    }
  });

  return eligibleTypes;
};

/**
 * 전월 가입 처리 누락 여부 확인
 * @param {Object} workHistory - 근무 이력
 * @param {Object} insuranceStatus - 보험 상태
 * @param {Array} enrollmentRecords - 가입 기록
 * @param {string} currentYearMonth - 현재 조회 년월
 * @returns {Object} 전월 가입 누락 정보
 */
export const checkPreviousMonthEnrollmentMissing = (
  workHistory,
  insuranceStatus,
  enrollmentRecords,
  currentYearMonth
) => {
  const result = {
    shouldHaveEnrolledPrevious: false,
    missedInsurances: [],
    message: "",
  };

  if (!workHistory || !insuranceStatus) return result;

  const previousYearMonth = getAdjacentMonth(currentYearMonth, "previous");

  // 전월 근무가 있었는지 확인
  const hasPreviousWork =
    (workHistory.previousMonthWorkDays || 0) > 0 || (workHistory.previousMonthWorkHours || 0) > 0;

  if (!hasPreviousWork) return result;

  // 전월에 가입처리가 되었는지 확인
  const hasEnrollmentInPrevious =
    enrollmentRecords &&
    enrollmentRecords.some((record) => {
      const acquisitionDates = [
        record.national_pension_acquisition_date,
        record.health_insurance_acquisition_date,
        record.employment_insurance_acquisition_date,
        record.industrial_accident_acquisition_date,
      ].filter((date) => date !== null);

      return acquisitionDates.some((date) => {
        if (!date) return false;
        const acquisitionDate = new Date(date);
        const acquisitionYearMonth = `${acquisitionDate.getFullYear()}-${(
          acquisitionDate.getMonth() + 1
        )
          .toString()
          .padStart(2, "0")}`;
        return acquisitionYearMonth === previousYearMonth;
      });
    });

  // 현재 가입 대상인 보험들 확인
  const currentlyRequired = [];
  if (insuranceStatus.nationalPension?.required) currentlyRequired.push("국민연금");
  if (insuranceStatus.healthInsurance?.required) currentlyRequired.push("건강보험");
  if (insuranceStatus.employmentInsurance?.required) currentlyRequired.push("고용보험");
  if (insuranceStatus.industrialAccident?.required) currentlyRequired.push("산재보험");

  if (hasPreviousWork && !hasEnrollmentInPrevious && currentlyRequired.length > 0) {
    result.shouldHaveEnrolledPrevious = true;
    result.missedInsurances = currentlyRequired;
    result.message = `전월(${previousYearMonth}) 가입 처리했어야 함`;
  }

  return result;
};

/**
 * 🔧 대폭 수정됨: 근로자 분류 로직 개선 (상실일 고려)
 * @param {Array} allWorkers - 모든 근로자 배열
 * @param {Object} workHistoryData - 근무 이력 데이터
 * @param {Object} enrollmentRecordsData - 가입 기록 데이터
 * @param {string} selectedYearMonth - 선택된 년월
 * @returns {Object} 분류된 근로자 객체
 */
export const classifyWorkersImproved = (
  allWorkers,
  workHistoryData,
  enrollmentRecordsData,
  selectedYearMonth
) => {
  console.log("🔧 개선된 근로자 분류 시작:", {
    전체근로자수: allWorkers?.length || 0,
    선택된년월: selectedYearMonth,
  });

  const newEnrollmentWorkers = [];
  const activeEnrollmentWorkers = [];
  const lossEnrollmentCandidates = [];

  if (!allWorkers || allWorkers.length === 0) {
    console.log("근로자가 없어서 빈 결과 반환");
    return { newEnrollmentWorkers, activeEnrollmentWorkers, lossEnrollmentCandidates };
  }

  allWorkers.forEach((worker) => {
    const workerId = worker.worker_id;
    const siteId = worker.site_id || worker.selectedSite;

    if (!siteId) {
      console.warn(`근로자 ${workerId}의 현장 정보 없음`);
      return;
    }

    // 근무 이력 확인
    const workHistoryKey = `${workerId}-${siteId}-${selectedYearMonth}`;
    const workHistory = workHistoryData?.[workHistoryKey] || {};

    // 가입 기록 확인
    const enrollmentKey = `${workerId}-${siteId}`;
    const enrollmentRecords = enrollmentRecordsData?.[enrollmentKey] || [];

    // 🔧 추가: 상실처리 여부 확인
    const isTerminated = enrollmentRecords.some(
      (record) => record.enrollment_status === "terminated"
    );

    // 현재 월에 근무가 있는지 확인
    const hasCurrentWork = hasCurrentMonthWork(workHistory);

    // 현재 가입 상태 확인 (상실되지 않은 가입)
    const hasActiveEnrollment = hasActiveInsuranceEnrollment(enrollmentRecords);

    // 재가입 가능 여부 확인 (상실일 이후인지)
    const canReEnroll = canReEnrollAfterLoss(selectedYearMonth, enrollmentRecords);

    console.log(`🔧 근로자 ${worker.name}(ID: ${workerId}) 분류:`, {
      현재월근무: hasCurrentWork,
      활성가입: hasActiveEnrollment,
      재가입가능: canReEnroll,
      상실처리됨: isTerminated,
      근무이력: {
        현재월근무일수: workHistory.currentMonthWorkDays || 0,
        현재월근무시간: workHistory.currentMonthWorkHours || 0,
        등록여부: workHistory.isRegisteredInCurrentMonth || false,
      },
      가입기록수: enrollmentRecords.length,
    });

    // 🔧 수정된 분류 로직: 상실처리된 근로자는 모든 탭에서 제외
    if (isTerminated) {
      console.log(`→ 상실처리 완료로 분류 제외: ${worker.name}`);
      return; // 🔧 중요: 상실처리된 근로자는 어떤 탭에도 표시하지 않음
    }

    if (hasCurrentWork && !hasActiveEnrollment && canReEnroll) {
      // 현재 월 근무하고, 활성 가입 없고, 재가입 가능 → 신규 가입 대상
      console.log(`→ 신규 가입 대상: ${worker.name}`);
      newEnrollmentWorkers.push({
        ...worker,
        source: "new_enrollment",
      });
    } else if (hasCurrentWork && hasActiveEnrollment) {
      // 현재 월 근무하고, 활성 가입 있음 → 유지 중인 근로자
      console.log(`→ 유지 중인 근로자: ${worker.name}`);
      activeEnrollmentWorkers.push({
        ...worker,
        source: "active_enrolled",
      });
    } else if (!hasCurrentWork && hasActiveEnrollment) {
      // 현재 월 근무 없고, 활성 가입 있음 → 상실 대상자
      console.log(`→ 상실 대상자: ${worker.name}`);
      lossEnrollmentCandidates.push({
        ...worker,
        source: "inactive_enrolled",
      });
    } else {
      // 기타 경우들 로깅
      console.log(
        `→ 분류 제외: ${worker.name} (근무: ${hasCurrentWork}, 가입: ${hasActiveEnrollment}, 재가입가능: ${canReEnroll})`
      );
    }
  });

  const result = {
    newEnrollmentWorkers,
    activeEnrollmentWorkers,
    lossEnrollmentCandidates,
  };

  console.log("🔧 분류 완료:", {
    신규가입대상: result.newEnrollmentWorkers.length,
    유지중인근로자: result.activeEnrollmentWorkers.length,
    상실대상자: result.lossEnrollmentCandidates.length,
  });

  return result;
};

/**
 * 모든 설정 저장을 위한 데이터 준비
 * @param {Object} workersData - 근로자 데이터
 * @param {Object} workHistoryData - 근무 이력 데이터
 * @param {Object} insuranceStatusData - 보험 상태 데이터
 * @param {string} selectedSite - 선택된 현장 ID
 * @param {string} yearMonth - 년월
 * @param {Object} user - 사용자 정보
 * @returns {Array} 저장할 데이터 배열
 */
export const prepareAllSettingsData = (
  workersData,
  workHistoryData,
  insuranceStatusData,
  selectedSite,
  yearMonth,
  user
) => {
  const allWorkers = [
    ...(workersData?.registeredWorkers || []),
    ...(workersData?.activeWorkers || []),
    ...(workersData?.inactiveWorkers || []),
  ];

  const settingsData = [];

  allWorkers.forEach((worker) => {
    const workerId = worker.worker_id;
    const workHistoryKey = `${workerId}-${selectedSite}-${yearMonth}`;
    const workHistory = workHistoryData?.[workHistoryKey] || {};
    const insuranceStatus = insuranceStatusData?.[workerId];

    if (!insuranceStatus) return;

    // 각 보험 타입별 상태값 결정
    const nationalPensionStatus = insuranceStatus?.nationalPension?.required
      ? "auto_required"
      : "auto_exempted";
    const healthInsuranceStatus = insuranceStatus?.healthInsurance?.required
      ? "auto_required"
      : "auto_exempted";
    const employmentInsuranceStatus = insuranceStatus?.employmentInsurance?.required
      ? "auto_required"
      : "auto_exempted";
    const industrialAccidentStatus = insuranceStatus?.industrialAccident?.required
      ? "auto_required"
      : "auto_exempted";

    const settingData = {
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

      // 사용자 확정 정보
      enrollment_status: "confirmed",
      user_confirmed: true,
      user_confirmed_at: new Date().toISOString(),
      confirmed_by: user?.id || null,

      // 시스템 필드
      updated_at: new Date().toISOString(),
    };

    settingsData.push(settingData);
  });

  return settingsData;
};
