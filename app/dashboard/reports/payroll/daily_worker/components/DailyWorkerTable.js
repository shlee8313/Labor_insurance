import React, { useState, useEffect, useRef } from "react";
import { formatNumber, formatResidentNumber } from "@/lib/utils/taxCalculations";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const DailyWorkerTable = ({
  workerData,
  handlePayment,
  showPayslip,
  updateRecord,
  updatePaymentStatus,
}) => {
  // 셀 호버 상태 관리
  const [hoveredCell, setHoveredCell] = useState(null);

  // 입력값 상태 관리
  const [editValues, setEditValues] = useState({});

  // 날짜 선택기 상태 관리
  const [showDatePicker, setShowDatePicker] = useState({});
  const [selectedDate, setSelectedDate] = useState({});

  // 편집 모드 상태
  const [editMode, setEditMode] = useState({});

  // 지급일 수정 모드 상태
  const [paymentDateEditMode, setPaymentDateEditMode] = useState({});

  // 날짜 선택기 외부 클릭 감지를 위한 ref
  const datePickerRef = useRef({});
  const buttonRef = useRef({});
  const paymentDateRef = useRef({});

  // 외부 클릭 감지 효과
  useEffect(() => {
    function handleClickOutside(event) {
      // 모든 열린 날짜 선택기에 대해 검사
      Object.keys(showDatePicker).forEach((recordId) => {
        if (showDatePicker[recordId]) {
          const datePickerElement = datePickerRef.current[recordId];
          const buttonElement = buttonRef.current[recordId];
          const paymentDateElement = paymentDateRef.current[recordId];

          // 클릭이 날짜 선택기, 버튼, 또는 지급일 셀 내부에서 발생했는지 확인
          const isInsideDatePicker = datePickerElement && datePickerElement.contains(event.target);
          const isButtonClicked = buttonElement && buttonElement.contains(event.target);
          const isPaymentDateClicked =
            paymentDateElement && paymentDateElement.contains(event.target);

          // 날짜 선택기, 버튼, 지급일 셀 외부 클릭 시 날짜 선택기 닫기
          if (!isInsideDatePicker && !isButtonClicked && !isPaymentDateClicked) {
            console.log("외부 클릭 감지 - 날짜 선택기 닫기:", recordId);

            setShowDatePicker((prev) => ({
              ...prev,
              [recordId]: false,
            }));

            // 지급일 수정 모드도 해제
            if (paymentDateEditMode[recordId]) {
              setPaymentDateEditMode((prev) => ({
                ...prev,
                [recordId]: false,
              }));
            }
          }
        }
      });
    }

    // 이벤트 리스너 등록
    document.addEventListener("mousedown", handleClickOutside);

    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDatePicker, paymentDateEditMode]);

  // 소득세 계산 함수 - 비과세 제외
  const calculateIncomeTax = (record) => {
    // 급여 정보 추출 - 숫자로 확실하게 변환
    const dailyWage = Number(record.dailyWage) || 0;
    const allowances = Number(record.allowances || 0);
    const taxExemption = Number(record.taxExemption || 0); // 비과세 금액

    // 비과세를 제외한 과세 대상 총액
    const taxablePayAmount = dailyWage + allowances - taxExemption;

    // 세금 계산 상수
    const dailyIncomeDeduction = 150000; // 일용근로소득 공제액 15만원
    const incomeTaxRate = 0.06; // 소득세율 6%
    const taxReductionRate = 0.45; // 소득세 감면율 45%
    const minTaxExemption = 1000; // 소액부징수 기준액 1,000원

    // 소득세 계산
    let incomeTax = 0;

    // 비과세 제외 후 공제액 초과 금액에 대해서만 세금 계산
    if (taxablePayAmount > dailyIncomeDeduction) {
      const taxableAmount = taxablePayAmount - dailyIncomeDeduction;
      incomeTax = Math.round(taxableAmount * incomeTaxRate * taxReductionRate);

      // 소액부징수 적용
      incomeTax = incomeTax < minTaxExemption ? 0 : incomeTax;
    }

    // 음수가 되지 않도록 방지 (비과세 금액이 과세 대상보다 큰 경우)
    return Math.max(0, incomeTax);
  };

  // 지방소득세 계산 함수 (소득세의 10%)
  const calculateLocalTax = (record) => {
    const incomeTax = calculateIncomeTax(record);
    return Math.round(incomeTax * 0.1);
  };

  // 고용보험료 계산 함수 (지급계 - 비과세의 0.9%)
  const calculateEmploymentInsurance = (record) => {
    const dailyWage = Number(record.dailyWage) || 0;
    const allowances = Number(record.allowances || 0);
    const taxExemption = Number(record.taxExemption || 0);

    // 비과세를 제외한 과세 대상 총액
    const taxablePayAmount = dailyWage + allowances - taxExemption;

    // 고용보험 요율 0.9%
    const employmentInsuranceRate = 0.009;

    // 고용보험료 계산 (비과세 제외 금액의 0.9%)
    const employmentInsurance = Math.round(Math.max(0, taxablePayAmount) * employmentInsuranceRate);

    return employmentInsurance;
  };

  // 공제 합계 계산 함수
  const calculateTotalDeduction = (record) => {
    const incomeTax = calculateIncomeTax(record);
    const localTax = calculateLocalTax(record);
    const employmentInsurance = calculateEmploymentInsurance(record);

    // 다른 공제 항목들도 추가 (모두 숫자로 변환)
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

  // 실지급액 계산 함수
  const calculateNetPay = (record) => {
    const dailyWage = Number(record.dailyWage) || 0;
    const allowances = Number(record.allowances || 0);
    const totalPay = dailyWage + allowances;
    const totalDeduction = calculateTotalDeduction(record);

    return totalPay - totalDeduction;
  };

  // 근로자별 근무일 합계 계산 함수
  const calculateTotalWorkDays = (records) => {
    return records.length;
  };

  // 근로자별 근무시간 합계 계산 함수
  const calculateTotalWorkHours = (records) => {
    return records.reduce((sum, record) => sum + (Number(record.hours) || 0), 0);
  };

  // record ID로 레코드 찾기 함수 추가
  const findRecordById = (recordId) => {
    for (const worker of workerData) {
      for (const record of worker.records) {
        if (record.record_id === recordId) {
          return record;
        }
      }
    }
    return null;
  };

  // 편집 상태 전환
  const handleMouseEnter = (recordId, field) => {
    // 지급 처리된 항목은 편집 모드가 켜져 있을 때만 편집 가능
    const record = findRecordById(recordId);
    if (record && record.status === "paid" && !editMode[recordId]) {
      return;
    }

    setHoveredCell(`${recordId}-${field}`);
  };

  const handleMouseLeave = () => {
    setHoveredCell(null);
  };

  // 입력값 변경 처리
  const handleInputChange = (e, record, field) => {
    const value = e.target.value;
    const numericValue = value ? parseFloat(value.replace(/,/g, "")) : 0;

    setEditValues({
      ...editValues,
      [`${record.record_id}-${field}`]: numericValue,
    });
  };

  // 입력 완료 처리 (포커스 아웃, 엔터키)
  const handleInputBlur = (record, field) => {
    const editKey = `${record.record_id}-${field}`;
    const newValue = editValues[editKey];

    if (newValue !== undefined) {
      const updatedRecord = { ...record, [field]: newValue };

      // 부모 컴포넌트로 업데이트 전달 (이 함수는 부모에서 제공해야 함)
      if (typeof updateRecord === "function") {
        updateRecord(updatedRecord);
      }

      // 호버 상태 제거
      setHoveredCell(null);
    }
  };

  // 엔터키 처리
  const handleKeyDown = (e, record, field) => {
    if (e.key === "Enter") {
      handleInputBlur(record, field);
    }
  };

  // 수당 및 비과세 필드 렌더링
  const renderEditableCell = (record, field, value) => {
    const cellId = `${record.record_id}-${field}`;
    const isHovered = hoveredCell === cellId;
    const displayValue = editValues[cellId] !== undefined ? editValues[cellId] : value;

    // 지급 처리된 항목은 편집 모드가 켜져 있을 때만 편집 가능
    const isEditable = record.status !== "paid" || editMode[record.record_id];

    return (
      <td
        className={`border border-gray-200 p-1 text-right transition-all duration-150 ${
          isEditable ? "hover:bg-blue-50" : ""
        }`}
        onMouseEnter={() => isEditable && handleMouseEnter(record.record_id, field)}
        onMouseLeave={handleMouseLeave}
      >
        {isHovered && isEditable ? (
          <input
            type="text"
            className="w-20 text-right p-1 border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={displayValue}
            onChange={(e) => handleInputChange(e, record, field)}
            onBlur={() => handleInputBlur(record, field)}
            onKeyDown={(e) => handleKeyDown(e, record, field)}
            autoFocus
          />
        ) : (
          formatNumber(displayValue)
        )}
      </td>
    );
  };

  // 실제 사용될 레코드 값 (편집 중인 값 반영)
  const getEffectiveValue = (record, field) => {
    const editKey = `${record.record_id}-${field}`;
    return editValues[editKey] !== undefined ? editValues[editKey] : Number(record[field] || 0);
  };

  // 지급처리 버튼 클릭 시 날짜 선택기 표시
  const handlePayButtonClick = (recordId) => {
    setShowDatePicker((prev) => ({
      ...prev,
      [recordId]: true,
    }));

    // 오늘 날짜를 기본값으로 설정
    if (!selectedDate[recordId]) {
      setSelectedDate((prev) => ({
        ...prev,
        [recordId]: new Date(),
      }));
    }

    // 버튼 참조 저장
    buttonRef.current[recordId] = document.activeElement;
  };

  // 지급일 수정 버튼 클릭 처리
  const handlePaymentDateClick = (recordId, currentDate) => {
    // 편집 모드일 때만 지급일 수정 가능
    if (!editMode[recordId]) return;

    console.log("지급일 수정 클릭:", { recordId, currentDate });

    // 이미 선택된 날짜가 있으면 사용하고, 없으면 현재 지급일 사용
    const initialDate =
      selectedDate[recordId] || (currentDate ? new Date(currentDate) : new Date());

    console.log("초기 날짜 설정:", initialDate);

    setSelectedDate((prev) => ({
      ...prev,
      [recordId]: initialDate,
    }));

    // 날짜 선택기 표시 - 모드 업데이트 전에 날짜 선택기 표시
    setShowDatePicker((prev) => ({
      ...prev,
      [recordId]: true,
    }));

    // 지급일 수정 모드 활성화
    setPaymentDateEditMode((prev) => ({
      ...prev,
      [recordId]: true,
    }));
  };

  // 날짜 선택 시 처리 - 업데이트된 버전
  // 날짜 선택 시 처리 - 업데이트된 버전
  const handleDateSelect = (date, record, worker) => {
    console.log("날짜 선택됨:", { date, recordId: record.record_id });

    setSelectedDate((prev) => ({
      ...prev,
      [record.record_id]: date,
    }));

    // 날짜 선택기 닫기
    setShowDatePicker((prev) => ({
      ...prev,
      [record.record_id]: false,
    }));

    // 지급일 수정 모드인 경우
    if (paymentDateEditMode[record.record_id]) {
      console.log("지급일 수정 모드에서 날짜 업데이트");

      // 지급일만 업데이트
      const updatedRecord = {
        ...record,
        payment_date: date,
      };

      console.log("업데이트할 레코드:", updatedRecord);

      if (typeof updateRecord === "function") {
        console.log("updateRecord 함수 호출");
        updateRecord(updatedRecord);

        // workTimeStore 캐시 무효화 추가
        try {
          const workTimeStore = require("@/lib/store/workTimeStore").default;
          if (workTimeStore) {
            workTimeStore.setState((state) => ({
              ...state,
              workReports: {},
            }));
            console.log("workTimeStore 캐시가 성공적으로 무효화되었습니다.");
          }
        } catch (e) {
          console.error("workTimeStore 캐시 무효화 중 오류 발생:", e);
        }
      } else {
        console.error("updateRecord 함수가 정의되지 않았습니다");
      }

      // 지급일 수정 모드 비활성화
      setPaymentDateEditMode((prev) => ({
        ...prev,
        [record.record_id]: false,
      }));
    } else {
      // 선택한 날짜로 지급 처리
      handlePayment(record, worker, date);

      // 지급 처리 후 workTimeStore 캐시 무효화 추가
      try {
        const workTimeStore = require("@/lib/store/workTimeStore").default;
        if (workTimeStore) {
          workTimeStore.setState((state) => ({
            ...state,
            workReports: {},
          }));
          console.log("지급 처리 후 workTimeStore 캐시가 성공적으로 무효화되었습니다.");
        }
      } catch (e) {
        console.error("지급 처리 후 workTimeStore 캐시 무효화 중 오류 발생:", e);
      }
    }
  };

  // 수정 모드 토글 및 unpaid 상태로 변경
  const toggleEditMode = async (recordId) => {
    const currentEditMode = editMode[recordId];
    console.log("편집 모드 토글:", { recordId, 현재모드: currentEditMode });

    // 수정 버튼 클릭 (편집 모드 켜기) 또는 저장 버튼 클릭 (편집 모드 끄기)
    if (!currentEditMode) {
      // 수정 버튼 클릭 - 편집 모드 켜기
      const record = findRecordById(recordId);

      console.log("수정 버튼 클릭 - 레코드 정보:", record);

      // 지급 상태 확인
      if (record && record.status === "paid") {
        console.log("지급 상태를 미지급으로 변경하려고 시도 중...");

        if (typeof updatePaymentStatus === "function") {
          console.log("updatePaymentStatus 함수 호출 - 미지급으로 변경");
          try {
            const result = await updatePaymentStatus(recordId, "unpaid");
            console.log("updatePaymentStatus 결과:", result);

            // 성공 시 즉시 UI에서도 상태 업데이트
            if (result) {
              record.status = "unpaid";
              record.payment_date = null;

              // 여기에 WorkTimeStore 캐시 무효화 코드 추가
              try {
                // 동적으로 workTimeStore 임포트 시도
                const workTimeStore = require("@/lib/store/workTimeStore").default;
                if (workTimeStore) {
                  // 가장 확실한 방법: 전체 workReports 캐시를 초기화
                  workTimeStore.setState((state) => ({
                    ...state,
                    workReports: {},
                  }));
                  console.log("workTimeStore 캐시가 성공적으로 무효화되었습니다.");
                }
              } catch (e) {
                console.error("workTimeStore 캐시 무효화 중 오류 발생:", e);
              }
            }
          } catch (err) {
            console.error("updatePaymentStatus 호출 중 오류:", err);
          }
        } else {
          console.error("updatePaymentStatus 함수가 정의되지 않았습니다");
        }
      } else {
        console.log(
          `지급 상태 변경 안함 - status: ${record?.status}, updatePaymentStatus 함수 존재: ${
            typeof updatePaymentStatus === "function"
          }`
        );
      }
    } else {
      // 저장 버튼 클릭 - 편집 모드 끄기
      const record = findRecordById(recordId);
      const currentSelectedDate = selectedDate[recordId];

      if (record && currentSelectedDate) {
        console.log("편집 모드 종료 시 날짜 저장:", {
          recordId,
          date: currentSelectedDate,
          paymentDateEditMode: paymentDateEditMode[recordId],
        });

        // 지급일 수정 중이었다면 날짜 업데이트 실행
        if (paymentDateEditMode[recordId]) {
          const updatedRecord = {
            ...record,
            payment_date: currentSelectedDate,
          };

          if (typeof updateRecord === "function") {
            console.log("toggleEditMode에서 updateRecord 함수 호출");
            updateRecord(updatedRecord);
          }
        }
      }

      // 지급일 수정 모드 종료
      setPaymentDateEditMode((prev) => ({
        ...prev,
        [recordId]: false,
      }));
    }

    // 편집 모드 토글
    setEditMode((prev) => ({
      ...prev,
      [recordId]: !prev[recordId],
    }));
  };

  // 날짜를 YYYY-MM-DD 형식으로 포맷팅
  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow-md mb-6 p-4">
      {/* 테이블 컨테이너 */}
      <div className="max-h-[70vh] overflow-y-auto relative">
        <table className="w-full border-collapse border-spacing-0">
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr>
              {/* 최상단 카테고리 헤더 */}
              <th className="border border-gray-200 p-2 bg-blue-100" colSpan="3">
                근로자
              </th>
              <th className="border border-gray-200 p-2 bg-green-100" colSpan="2">
                근무
              </th>
              <th className="border border-gray-200 p-2 bg-yellow-100" colSpan="3">
                지급
              </th>
              <th rowSpan="2" className="border border-gray-200 p-2 bg-purple-100" colSpan="1">
                비과세
              </th>
              <th className="border border-gray-200 p-2 bg-red-100" colSpan="6">
                공제액
              </th>
              <th rowSpan="2" className="border border-gray-200 p-2 bg-indigo-100" colSpan="1">
                실지급액
              </th>
              <th className="border border-gray-200 p-2 bg-gray-100" colSpan="2">
                지급상태
              </th>
            </tr>
            <tr className="text-center sticky top-[41px] z-10 bg-gray-50  ">
              {/* 세부 항목 헤더 */}
              {/* 근로자 */}
              <th className="border border-gray-200 p-2 bg-gray-50">이름</th>
              <th className="border border-gray-200 p-2 bg-gray-50">주민번호</th>
              <th className="border border-gray-200 p-2 bg-gray-50">직종</th>

              {/* 근무 */}
              <th className="border border-gray-200 p-2 bg-gray-50">근무일</th>
              <th className="border border-gray-200 p-2 bg-gray-50">근무시간</th>

              {/* 지급 */}
              <th className="border border-gray-200 p-2 bg-gray-50">일당</th>
              <th className="border border-gray-200 p-2 bg-gray-50">수당</th>
              <th className="border border-gray-200 p-2 bg-gray-50">지급계</th>

              {/* 비과세는 rowSpan 적용되어 있음 */}

              {/* 공제액 */}
              <th className="border border-gray-200 p-2 bg-gray-50">소득세</th>
              <th className="border border-gray-200 p-2 bg-gray-50">주민세</th>
              <th className="border border-gray-200 p-2 bg-gray-50">국민</th>
              <th className="border border-gray-200 p-2 bg-gray-50">건강</th>
              <th className="border border-gray-200 p-2 bg-gray-50">고용</th>
              {/* <th className="border border-gray-200 p-2 bg-gray-50">장기요양</th> */}
              <th className="border border-gray-200 p-2 bg-gray-50">공제계</th>

              {/* 실지급액은 rowSpan 적용되어 있음 */}

              {/* 지급상태 */}
              <th className="border border-gray-200 p-2 bg-gray-50">상태/지급일</th>
              <th className="border border-gray-200 p-2 bg-gray-50 print:hidden">액션</th>
            </tr>
          </thead>
          <tbody>
            {workerData.map((worker, workerIndex) => (
              <React.Fragment key={worker.worker_id}>
                {/* 근로자 기록 행 */}
                {worker.records.map((record, recordIndex) => {
                  // 현재 레코드의 값 (편집 중인 경우 편집 값 사용)
                  const effectiveAllowances = getEffectiveValue(record, "allowances");
                  const effectiveTaxExemption = getEffectiveValue(record, "taxExemption");

                  // 편집 값을 반영한 레코드
                  const effectiveRecord = {
                    ...record,
                    allowances: effectiveAllowances,
                    taxExemption: effectiveTaxExemption,
                  };

                  return (
                    <tr
                      key={record.record_id || recordIndex}
                      className={`transition-colors duration-150 hover:bg-blue-50 ${
                        workerIndex > 0 && recordIndex === 0 ? "border-t-8 border-gray-300" : ""
                      }`}
                    >
                      {recordIndex === 0 && (
                        <>
                          <td
                            className="border border-gray-200 p-2 font-semibold border-r text-gray-800"
                            rowSpan={worker.records.length}
                          >
                            {worker.name}
                          </td>
                          <td
                            className="border border-gray-200 p-2 font-semibold border-r text-gray-800"
                            rowSpan={worker.records.length}
                          >
                            {formatResidentNumber(worker.resident_number)}
                          </td>
                          <td
                            className="border border-gray-200 p-2 font-semibold border-r text-gray-800"
                            rowSpan={worker.records.length}
                          >
                            {worker.job_code || "일용직"}
                          </td>
                        </>
                      )}
                      <td className="border border-gray-200 p-2">{record.day}일</td>
                      <td className="border border-gray-200 p-2">{record.hours}시간</td>
                      <td className="border border-gray-200 p-2 text-right">
                        {formatNumber(record.dailyWage)}
                      </td>

                      {/* 수당 - 편집 가능한 셀 */}
                      {renderEditableCell(record, "allowances", record.allowances || 0)}

                      <td className="border border-gray-200 p-2 text-right">
                        {formatNumber(Number(record.dailyWage || 0) + effectiveAllowances)}
                      </td>

                      {/* 비과세 - 편집 가능한 셀 */}
                      {renderEditableCell(record, "taxExemption", record.taxExemption || 0)}

                      <td className="border border-gray-200 p-2 text-right">
                        {formatNumber(calculateIncomeTax(effectiveRecord))}
                      </td>
                      <td className="border border-gray-200 p-2 text-right">
                        {formatNumber(calculateLocalTax(effectiveRecord))}
                      </td>
                      <td className="border border-gray-200 p-2 text-right">
                        {formatNumber(record.nationalPension || 0)}
                      </td>
                      <td className="border border-gray-200 p-2 text-right">
                        {formatNumber(record.healthInsurance || 0)}
                      </td>
                      <td className="border border-gray-200 p-2 text-right">
                        {formatNumber(calculateEmploymentInsurance(effectiveRecord))}
                      </td>
                      <td className="border border-gray-200 p-2 text-right">
                        {formatNumber(calculateTotalDeduction(effectiveRecord))}
                      </td>
                      <td className="border border-gray-200 p-2 text-right">
                        {formatNumber(calculateNetPay(effectiveRecord))}
                      </td>
                      <td
                        className={`border border-gray-200 p-2 text-center ${
                          editMode[record.record_id] ? "cursor-pointer hover:bg-blue-50" : ""
                        }`}
                        ref={(el) => (paymentDateRef.current[record.record_id] = el)}
                        onClick={() =>
                          record.status === "paid" &&
                          editMode[record.record_id] &&
                          handlePaymentDateClick(record.record_id, record.payment_date)
                        }
                      >
                        {record.status === "paid" ? (
                          <div
                            className={
                              editMode[record.record_id]
                                ? "border-b border-dashed border-blue-500"
                                : ""
                            }
                          >
                            <span className="text-green-700 font-medium">
                              지급
                              <br />
                              <span className="text-sm text-gray-600">
                                {formatDate(record.payment_date)}
                              </span>
                            </span>
                            {editMode[record.record_id] && (
                              <div className="text-xs text-blue-600 mt-1">(클릭하여 날짜 변경)</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-red-600 font-medium">미지급</span>
                        )}

                        {showDatePicker[record.record_id] && (
                          <div
                            className="absolute z-20 mt-1"
                            ref={(el) => (datePickerRef.current[record.record_id] = el)}
                          >
                            <DatePicker
                              selected={
                                selectedDate[record.record_id] ||
                                (record.payment_date ? new Date(record.payment_date) : new Date())
                              }
                              onChange={(date) => handleDateSelect(date, record, worker)}
                              dateFormat="yyyy-MM-dd"
                              inline
                              className="bg-white shadow-lg border border-gray-300 rounded"
                            />
                          </div>
                        )}
                      </td>
                      <td className="border border-gray-200 p-2 text-center print:hidden relative">
                        {record.status === "paid" ? (
                          // 지급 처리된 항목은 수정 버튼 표시
                          <button
                            onClick={() => toggleEditMode(record.record_id)}
                            className={`text-blue-600 hover:text-blue-900 focus:outline-none px-2 py-1 rounded ${
                              editMode[record.record_id] ? "text-green-600" : "bg-blue-50"
                            }`}
                          >
                            {editMode[record.record_id] ? "지급처리" : "수정"}
                          </button>
                        ) : (
                          // 미지급 항목은 지급처리 버튼 표시
                          <div className="relative">
                            <button
                              ref={(el) => (buttonRef.current[record.record_id] = el)}
                              onClick={() => handlePayButtonClick(record.record_id)}
                              className="text-green-600 hover:text-green-900 focus:outline-none px-2 py-1 bg-green-100 rounded"
                            >
                              지급처리
                            </button>

                            {showDatePicker[record.record_id] &&
                              !paymentDateEditMode[record.record_id] && (
                                <div
                                  className="absolute z-20 mt-1 right-0"
                                  ref={(el) => (datePickerRef.current[record.record_id] = el)}
                                >
                                  <DatePicker
                                    selected={selectedDate[record.record_id]}
                                    onChange={(date) => handleDateSelect(date, record, worker)}
                                    dateFormat="yyyy-MM-dd"
                                    inline
                                    className="bg-white shadow-lg border border-gray-300 rounded"
                                  />
                                </div>
                              )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {/* 근로자 소계 행 */}
                <tr className="bg-blue-50 font-semibold border-b-2 border-blue-300 transition-colors duration-150 hover:bg-blue-100">
                  <td colSpan="3" className="border text-left border-gray-200 p-2">
                    소계
                  </td>
                  <td className="border border-gray-200 p-2 text-right">
                    {calculateTotalWorkDays(worker.records)}일
                  </td>
                  <td className="border border-gray-200 p-2 text-right">
                    {calculateTotalWorkHours(worker.records)}시간
                  </td>
                  <td className="border border-gray-200 p-2 text-right">
                    {formatNumber(worker.totalWage)}
                  </td>
                  <td className="border border-gray-200 p-2 text-right">
                    {formatNumber(
                      worker.records.reduce(
                        (sum, record) => sum + getEffectiveValue(record, "allowances"),
                        0
                      )
                    )}
                  </td>
                  <td className="border border-gray-200 p-2 text-right">
                    {formatNumber(
                      worker.totalWage +
                        worker.records.reduce(
                          (sum, record) => sum + getEffectiveValue(record, "allowances"),
                          0
                        )
                    )}
                  </td>
                  <td className="border border-gray-200 p-2 text-right">
                    {formatNumber(
                      worker.records.reduce(
                        (sum, record) => sum + getEffectiveValue(record, "taxExemption"),
                        0
                      )
                    )}
                  </td>
                  <td className="border border-gray-200 p-2 text-right">
                    {formatNumber(
                      worker.records.reduce((sum, record) => {
                        const effectiveRecord = {
                          ...record,
                          allowances: getEffectiveValue(record, "allowances"),
                          taxExemption: getEffectiveValue(record, "taxExemption"),
                        };
                        return sum + calculateIncomeTax(effectiveRecord);
                      }, 0)
                    )}
                  </td>
                  <td className="border border-gray-200 p-2 text-right">
                    {formatNumber(
                      worker.records.reduce((sum, record) => {
                        const effectiveRecord = {
                          ...record,
                          allowances: getEffectiveValue(record, "allowances"),
                          taxExemption: getEffectiveValue(record, "taxExemption"),
                        };
                        return sum + calculateLocalTax(effectiveRecord);
                      }, 0)
                    )}
                  </td>
                  <td className="border border-gray-200 p-2 text-right">
                    {formatNumber(worker.totalNationalPension)}
                  </td>
                  <td className="border border-gray-200 p-2 text-right">
                    {formatNumber(worker.totalHealthInsurance)}
                  </td>
                  <td className="border border-gray-200 p-2 text-right">
                    {formatNumber(
                      worker.records.reduce((sum, record) => {
                        const effectiveRecord = {
                          ...record,
                          allowances: getEffectiveValue(record, "allowances"),
                          taxExemption: getEffectiveValue(record, "taxExemption"),
                        };
                        return sum + calculateEmploymentInsurance(effectiveRecord);
                      }, 0)
                    )}
                  </td>
                  <td className="border border-gray-200 p-2 text-right">
                    {formatNumber(
                      worker.records.reduce((sum, record) => {
                        const effectiveRecord = {
                          ...record,
                          allowances: getEffectiveValue(record, "allowances"),
                          taxExemption: getEffectiveValue(record, "taxExemption"),
                        };
                        return sum + calculateTotalDeduction(effectiveRecord);
                      }, 0)
                    )}
                  </td>
                  <td className="border border-gray-200 p-2 text-right">
                    {formatNumber(
                      worker.records.reduce((sum, record) => {
                        const effectiveRecord = {
                          ...record,
                          allowances: getEffectiveValue(record, "allowances"),
                          taxExemption: getEffectiveValue(record, "taxExemption"),
                        };
                        return sum + calculateNetPay(effectiveRecord);
                      }, 0)
                    )}
                  </td>
                  <td className="border border-gray-200 p-2" colSpan="2">
                    <button
                      onClick={() => showPayslip(worker)}
                      className="w-full px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 focus:outline-none"
                    >
                      급여명세서
                    </button>
                  </td>
                </tr>
              </React.Fragment>
            ))}

            {/* 합계 행 */}
            <tr className="bg-gray-200 font-bold border-t-2 border-gray-400 transition-colors duration-150 hover:bg-gray-300">
              <td className="border border-gray-200 p-2 text-right" colSpan="5">
                합계
              </td>
              <td className="border border-gray-200 p-2 text-right">
                {formatNumber(workerData.reduce((sum, worker) => sum + worker.totalWage, 0))}
              </td>
              <td className="border border-gray-200 p-2 text-right">
                {formatNumber(
                  workerData.reduce(
                    (sum, worker) =>
                      sum +
                      worker.records.reduce(
                        (workerSum, record) => workerSum + getEffectiveValue(record, "allowances"),
                        0
                      ),
                    0
                  )
                )}
              </td>
              <td className="border border-gray-200 p-2 text-right">
                {formatNumber(
                  workerData.reduce(
                    (sum, worker) =>
                      sum +
                      worker.totalWage +
                      worker.records.reduce(
                        (workerSum, record) => workerSum + getEffectiveValue(record, "allowances"),
                        0
                      ),
                    0
                  )
                )}
              </td>
              <td className="border border-gray-200 p-2 text-right">
                {formatNumber(
                  workerData.reduce(
                    (sum, worker) =>
                      sum +
                      worker.records.reduce(
                        (workerSum, record) =>
                          workerSum + getEffectiveValue(record, "taxExemption"),
                        0
                      ),
                    0
                  )
                )}
              </td>
              <td className="border border-gray-200 p-2 text-right">
                {formatNumber(
                  workerData.reduce(
                    (sum, worker) =>
                      sum +
                      worker.records.reduce((subSum, record) => {
                        const effectiveRecord = {
                          ...record,
                          allowances: getEffectiveValue(record, "allowances"),
                          taxExemption: getEffectiveValue(record, "taxExemption"),
                        };
                        return subSum + calculateTotalDeduction(effectiveRecord);
                      }, 0),
                    0
                  )
                )}
              </td>
              <td className="border border-gray-200 p-2 text-right">
                {formatNumber(
                  workerData.reduce(
                    (sum, worker) =>
                      sum +
                      worker.records.reduce((subSum, record) => {
                        const effectiveRecord = {
                          ...record,
                          allowances: getEffectiveValue(record, "allowances"),
                          taxExemption: getEffectiveValue(record, "taxExemption"),
                        };
                        return subSum + calculateNetPay(effectiveRecord);
                      }, 0),
                    0
                  )
                )}
              </td>
              <td className="border border-gray-200 p-2" colSpan="2"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DailyWorkerTable;
