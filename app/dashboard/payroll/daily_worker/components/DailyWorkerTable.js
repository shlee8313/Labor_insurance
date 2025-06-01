"use client";

import React, { useState, useEffect, useRef, useCallback, memo } from "react";
import { formatNumber, formatResidentNumber } from "@/lib/utils/taxCalculations";
import {
  calculateIncomeTax,
  calculateLocalTax,
  calculateEmploymentInsurance,
  calculateTotalDeduction,
  calculateNetPay,
  calculateWorkerSubtotal,
  calculateGrandTotal,
} from "@/lib/utils/payrollCalculations";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import ActionButton from "./ActionButton";

const DailyWorkerTable = ({
  workerData,
  handlePayment,
  showPayslip,
  updateRecord,
  updatePaymentStatus,
  handleWorkerBulkPayment,
}) => {
  // 기존 상태들...
  const [hoveredCell, setHoveredCell] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [showDatePicker, setShowDatePicker] = useState({});
  const [selectedDate, setSelectedDate] = useState({});
  const [editMode, setEditMode] = useState({});
  const [paymentDateEditMode, setPaymentDateEditMode] = useState({});
  const [datePickerPosition, setDatePickerPosition] = useState({});
  const [selectedRow, setSelectedRow] = useState(null);

  // refs
  const datePickerRef = useRef({});
  const buttonRef = useRef({});
  const paymentDateRef = useRef({});
  const tableContainerRef = useRef(null);

  // 외부 클릭 감지 효과 (기존과 동일)
  useEffect(() => {
    function handleClickOutside(event) {
      Object.keys(showDatePicker).forEach((recordId) => {
        if (showDatePicker[recordId]) {
          const datePickerElement = datePickerRef.current[recordId];
          const buttonElement = buttonRef.current[recordId];
          const paymentDateElement = paymentDateRef.current[recordId];

          const isInsideDatePicker = datePickerElement && datePickerElement.contains(event.target);
          const isButtonClicked = buttonElement && buttonElement.contains(event.target);
          const isPaymentDateClicked =
            paymentDateElement && paymentDateElement.contains(event.target);

          if (!isInsideDatePicker && !isButtonClicked && !isPaymentDateClicked) {
            setShowDatePicker((prev) => ({
              ...prev,
              [recordId]: false,
            }));

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

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDatePicker, paymentDateEditMode]);

  // 기존 유틸리티 함수들...
  const getEffectiveValue = useCallback(
    (record, field) => {
      const editKey = `${record.record_id}-${field}`;
      return editValues[editKey] !== undefined ? editValues[editKey] : Number(record[field] || 0);
    },
    [editValues]
  );

  const findRecordById = useCallback(
    (recordId) => {
      for (const worker of workerData) {
        for (const record of worker.records) {
          if (record.record_id === recordId) {
            return record;
          }
        }
      }
      return null;
    },
    [workerData]
  );

  // 🔥 달력 위치 계산 함수 - viewport 기준으로 수정
  const calculateDatePickerPosition = useCallback((element) => {
    if (!element) return { top: 0, left: 0 };

    const elementRect = element.getBoundingClientRect();

    // 달력 크기 (실제 DatePicker 크기)
    const calendarWidth = 300;
    const calendarHeight = 350;

    // viewport 크기
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollY = window.scrollY;

    // 기본 위치: 요소 바로 아래 (스크롤 고려)
    let top = elementRect.bottom + scrollY + 5;
    let left = elementRect.left;

    // 🔥 오른쪽 경계 체크 및 조정
    if (left + calendarWidth > viewportWidth) {
      left = Math.max(10, elementRect.right - calendarWidth);
    }

    // 🔥 왼쪽 경계 체크
    if (left < 10) {
      left = 10;
    }

    // 🔥 아래쪽 경계 체크 - 화면 아래로 나가면 위쪽에 표시
    if (elementRect.bottom + calendarHeight > viewportHeight) {
      top = elementRect.top + scrollY - calendarHeight - 5;
    }

    // 🔥 위쪽으로도 나가는 경우 viewport 내에서 가능한 위치로
    if (top < scrollY + 10) {
      top = scrollY + 10;
    }

    return { top, left };
  }, []);

  // 🔥 지급처리 버튼 클릭 - 수정된 위치 계산
  const handlePayButtonClick = useCallback(
    (recordId) => {
      setSelectedRow(recordId);
      const buttonElement = buttonRef.current[recordId];

      if (buttonElement) {
        const position = calculateDatePickerPosition(buttonElement);

        setDatePickerPosition((prev) => ({
          ...prev,
          [recordId]: position,
        }));

        console.log("지급처리 달력 위치:", position);
      }

      setShowDatePicker((prev) => ({ ...prev, [recordId]: true }));
      if (!selectedDate[recordId]) {
        setSelectedDate((prev) => ({ ...prev, [recordId]: new Date() }));
      }
    },
    [selectedDate, calculateDatePickerPosition]
  );

  // 🔥 지급일 수정 클릭 - 수정된 위치 계산
  const handlePaymentDateClick = useCallback(
    (recordId, currentDate) => {
      if (!editMode[recordId]) return;

      const initialDate =
        selectedDate[recordId] || (currentDate ? new Date(currentDate) : new Date());

      setSelectedDate((prev) => ({ ...prev, [recordId]: initialDate }));

      const paymentDateElement = paymentDateRef.current[recordId];

      if (paymentDateElement) {
        const position = calculateDatePickerPosition(paymentDateElement);

        setDatePickerPosition((prev) => ({
          ...prev,
          [recordId]: position,
        }));

        console.log("지급일 수정 달력 위치:", position);
      }

      setShowDatePicker((prev) => ({ ...prev, [recordId]: true }));
      setPaymentDateEditMode((prev) => ({ ...prev, [recordId]: true }));
    },
    [editMode, selectedDate, calculateDatePickerPosition]
  );

  // 기존 다른 함수들은 그대로 유지...
  const handleMouseEnter = useCallback(
    (recordId, field) => {
      const record = findRecordById(recordId);
      if (record && record.status === "paid" && !editMode[recordId]) {
        return;
      }
      setHoveredCell(`${recordId}-${field}`);
    },
    [findRecordById, editMode]
  );

  const handleMouseLeave = useCallback(() => {
    setHoveredCell(null);
  }, []);

  const handleInputChange = useCallback((e, record, field) => {
    const value = e.target.value;
    const numericValue = value ? parseFloat(value.replace(/,/g, "")) : 0;

    setEditValues((prev) => ({
      ...prev,
      [`${record.record_id}-${field}`]: numericValue,
    }));
  }, []);

  const handleInputBlur = useCallback(
    (record, field) => {
      const editKey = `${record.record_id}-${field}`;
      const newValue = editValues[editKey];

      if (newValue !== undefined) {
        const updatedRecord = { ...record, [field]: newValue };

        if (typeof updateRecord === "function") {
          updateRecord(updatedRecord);
        }

        setHoveredCell(null);
      }
    },
    [editValues, updateRecord]
  );

  const handleKeyDown = useCallback(
    (e, record, field) => {
      if (e.key === "Enter") {
        handleInputBlur(record, field);
      }
    },
    [handleInputBlur]
  );

  const renderEditableCell = useCallback(
    (record, field, value) => {
      const cellId = `${record.record_id}-${field}`;
      const isHovered = hoveredCell === cellId;
      const displayValue = editValues[cellId] !== undefined ? editValues[cellId] : value;
      const isEditable = record.status !== "paid" || editMode[record.record_id];

      return (
        <td
          className={`border border-gray-200 text-sm p-1 text-right transition-all duration-150 ${
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
    },
    [
      hoveredCell,
      editValues,
      editMode,
      handleMouseEnter,
      handleMouseLeave,
      handleInputChange,
      handleInputBlur,
      handleKeyDown,
    ]
  );

  const handleDateSelect = useCallback(
    (date, record, worker) => {
      const recordId = record.record_id;
      const isPaymentDateEdit = paymentDateEditMode[recordId];

      setSelectedDate((prev) => ({ ...prev, [recordId]: date }));
      setShowDatePicker((prev) => ({ ...prev, [recordId]: false }));
      setPaymentDateEditMode((prev) => ({ ...prev, [recordId]: false }));

      if (!isPaymentDateEdit) {
        setEditMode((prev) => ({ ...prev, [recordId]: false }));
      }

      setTimeout(() => {
        if (isPaymentDateEdit) {
          const updatedRecord = { ...record, payment_date: date };
          if (typeof updateRecord === "function") {
            updateRecord(updatedRecord);
          }
        } else {
          handlePayment(record, worker, date);
        }
      }, 0);

      setTimeout(() => {
        if (datePickerRef.current[recordId]) {
          datePickerRef.current[recordId] = null;
        }
      }, 50);
    },
    [paymentDateEditMode, handlePayment, updateRecord]
  );

  const toggleEditMode = useCallback(
    async (recordId) => {
      setSelectedRow(recordId);
      const currentEditMode = editMode[recordId];

      if (!currentEditMode) {
        const record = findRecordById(recordId);
        if (record && record.status === "paid") {
          if (typeof updatePaymentStatus === "function") {
            try {
              const result = await updatePaymentStatus(recordId, "unpaid");
              if (result) {
                record.status = "unpaid";
                record.payment_date = null;
              }
            } catch (err) {
              console.error("updatePaymentStatus 호출 중 오류:", err);
            }
          }
        }
      } else {
        const record = findRecordById(recordId);
        const currentSelectedDate = selectedDate[recordId];

        if (record && currentSelectedDate) {
          if (paymentDateEditMode[recordId]) {
            const updatedRecord = { ...record, payment_date: currentSelectedDate };
            if (typeof updateRecord === "function") {
              updateRecord(updatedRecord);
            }
          }
        }

        setPaymentDateEditMode((prev) => ({ ...prev, [recordId]: false }));
      }

      setEditMode((prev) => ({ ...prev, [recordId]: !prev[recordId] }));
    },
    [editMode, findRecordById, updatePaymentStatus, selectedDate, paymentDateEditMode, updateRecord]
  );

  const formatDate = useCallback((date) => {
    if (!date) return "";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);

  const getButtonRef = useCallback((el, recordId) => {
    if (el && recordId) {
      buttonRef.current[recordId] = el;
    }
  }, []);

  const handleWorkerBulkPaymentClick = useCallback(
    (worker) => {
      const unpaidRecords = worker.records.filter((record) => record.status !== "paid");

      if (unpaidRecords.length === 0) {
        alert("지급할 항목이 없습니다.");
        return;
      }

      const totalAmount = unpaidRecords.reduce((sum, record) => {
        const effectiveRecord = {
          ...record,
          allowances: getEffectiveValue(record, "allowances"),
          taxExemption: getEffectiveValue(record, "taxExemption"),
        };
        return sum + calculateNetPay(effectiveRecord);
      }, 0);

      const totalGrossAmount = unpaidRecords.reduce((sum, record) => {
        const dailyWage = Number(record.dailyWage) || 0;
        const allowances = getEffectiveValue(record, "allowances");
        return sum + dailyWage + allowances;
      }, 0);

      const bulkPaymentInfo = {
        worker: worker,
        unpaidRecords: unpaidRecords,
        totalGrossAmount: totalGrossAmount,
        totalNetAmount: totalAmount,
        recordCount: unpaidRecords.length,
      };

      if (typeof handleWorkerBulkPayment === "function") {
        handleWorkerBulkPayment(bulkPaymentInfo);
      }
    },
    [getEffectiveValue, handleWorkerBulkPayment]
  );

  const grandTotal = calculateGrandTotal(workerData, getEffectiveValue);

  return (
    <div className="overflow-x-auto bg-white rounded-lg shadow-md mb-10 p-4">
      <div className="max-h-[70vh] overflow-y-auto relative" ref={tableContainerRef}>
        <table className="w-full border-collapse border-spacing-0">
          {/* 테이블 헤더 (기존과 동일) */}
          <thead className="sticky top-0 z-10 bg-gray-50">
            <tr className="shadow-[0_2px_0_0_#9CA3AF]">
              <th className="border border-gray-200 text-sm border-b-0 p-2 bg-blue-100" colSpan="3">
                근로자
              </th>
              <th
                className="border border-gray-200  text-sm border-b-0 p-2 bg-green-100"
                colSpan="2"
              >
                근무
              </th>
              <th
                className="border border-gray-200  text-sm border-b-0 p-2 bg-yellow-100"
                colSpan="3"
              >
                지급
              </th>
              <th
                rowSpan="2"
                className="border border-gray-200 text-sm border-b-0 p-2 bg-purple-100"
                colSpan="1"
              >
                비과세
              </th>
              <th className="border border-gray-200 text-sm border-b-0 p-2 bg-red-100" colSpan="6">
                공제액
              </th>
              <th
                rowSpan="2"
                className="border border-gray-200 text-sm border-b-0 p-2 bg-indigo-100"
                colSpan="1"
              >
                실지급액
              </th>
              <th className="border border-gray-200 text-sm border-b-0 p-2 bg-gray-100" colSpan="2">
                지급상태
              </th>
            </tr>
            <tr className="text-center sticky top-[41px] z-10 bg-gray-50 shadow-[0_2px_0_0_#9CA3AF]">
              <th className="border border-gray-200 text-sm border-b-0 p-2 bg-gray-50">이름</th>
              <th className="border border-gray-200 text-sm border-b-0 p-2 bg-gray-50">주민번호</th>
              <th className="border border-gray-200 text-sm border-b-0 p-2 bg-gray-50">직종</th>
              <th className="border border-gray-200 text-sm border-b-0 p-2 bg-gray-50">근무일</th>
              <th className="border border-gray-200 text-sm border-b-0 p-2 bg-gray-50">근무시간</th>
              <th className="border border-gray-200 text-sm border-b-0 p-2 bg-gray-50">일당</th>
              <th className="border border-gray-200 text-sm border-b-0 p-2 bg-gray-50">수당</th>
              <th className="border border-gray-200 text-sm border-b-0 p-2 bg-gray-50">지급계</th>
              <th className="border border-gray-200 text-sm border-b-0 p-2 bg-gray-50">소득세</th>
              <th className="border border-gray-200 text-sm border-b-0 p-2 bg-gray-50">주민세</th>
              <th className="border border-gray-200 text-sm border-b-0 p-2 bg-gray-50">국민</th>
              <th className="border border-gray-200 text-sm border-b-0 p-2 bg-gray-50">건강</th>
              <th className="border border-gray-200 text-sm border-b-0 p-2 bg-gray-50">고용</th>
              <th className="border border-gray-200 text-sm border-b-0 p-2 bg-gray-50">공제계</th>
              <th className="border border-gray-200 text-sm border-b-0 p-2 bg-gray-50">
                상태/지급일
              </th>
              <th className="border border-gray-200 text-sm border-b-0 p-2 bg-gray-50 print:hidden">
                액션
              </th>
            </tr>
          </thead>

          {/* 테이블 바디 */}
          <tbody>
            {workerData.map((worker, workerIndex) => (
              <React.Fragment key={worker.worker_id}>
                {worker.records.map((record, recordIndex) => {
                  const effectiveAllowances = getEffectiveValue(record, "allowances");
                  const effectiveTaxExemption = getEffectiveValue(record, "taxExemption");

                  const effectiveRecord = {
                    ...record,
                    allowances: effectiveAllowances,
                    taxExemption: effectiveTaxExemption,
                  };

                  const incomeTax = calculateIncomeTax(effectiveRecord);

                  return (
                    <tr
                      key={record.record_id || recordIndex}
                      className={`transition-colors duration-300 
                    ${selectedRow === record.record_id ? "bg-yellow-100" : "hover:bg-blue-50"} 
                    ${workerIndex > 0 && recordIndex === 0 ? "border-t-8 border-gray-300" : ""}`}
                    >
                      {recordIndex === 0 && (
                        <>
                          <td
                            className="border border-gray-200 text-sm p-2 font-semibold border-r text-gray-800"
                            rowSpan={worker.records.length}
                          >
                            {worker.name}
                          </td>
                          <td
                            className="border border-gray-200 text-sm p-2 font-semibold border-r text-gray-800"
                            rowSpan={worker.records.length}
                          >
                            {formatResidentNumber(worker.resident_number)}
                          </td>
                          <td
                            className="border border-gray-200 text-sm p-2 font-semibold border-r text-gray-800"
                            rowSpan={worker.records.length}
                          >
                            {worker.job_code || "일용직"}
                          </td>
                        </>
                      )}
                      <td className="border border-gray-200 text-sm p-2">{record.day}일</td>
                      <td className="border border-gray-200 text-sm p-2">{record.hours}시간</td>
                      <td className="border border-gray-200 text-sm p-2 text-right">
                        {formatNumber(record.dailyWage)}
                      </td>

                      {renderEditableCell(record, "allowances", record.allowances || 0)}

                      <td className="border border-gray-200 text-sm p-2 text-right">
                        {formatNumber(Number(record.dailyWage || 0) + effectiveAllowances)}
                      </td>

                      {renderEditableCell(record, "taxExemption", record.taxExemption || 0)}

                      <td className="border border-gray-200 text-sm p-2 text-right">
                        {formatNumber(incomeTax)}
                      </td>
                      <td className="border border-gray-200 text-sm p-2 text-right">
                        {formatNumber(calculateLocalTax(incomeTax))}
                      </td>
                      <td className="border border-gray-200 text-sm p-2 text-right">
                        {formatNumber(record.nationalPension || 0)}
                      </td>
                      <td className="border border-gray-200 text-sm p-2 text-right">
                        {formatNumber(record.healthInsurance || 0)}
                      </td>
                      <td className="border border-gray-200 text-sm p-2 text-right">
                        {formatNumber(calculateEmploymentInsurance(effectiveRecord))}
                      </td>
                      <td className="border border-gray-200 text-sm p-2 text-right">
                        {formatNumber(calculateTotalDeduction(effectiveRecord))}
                      </td>
                      <td className="border border-gray-200 text-sm p-2 text-right">
                        {formatNumber(calculateNetPay(effectiveRecord))}
                      </td>

                      {/* 🔥 상태/지급일 셀 - 달력 렌더링 수정 */}
                      <td
                        className={`border border-gray-200 text-sm p-2 text-center ${
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
                            <span className="text-green-700 font-medium ">
                              지급
                              <br />
                              <span className="text-2xs text-gray-600">
                                {formatDate(record.payment_date)}
                              </span>
                            </span>
                            {editMode[record.record_id] && (
                              <div className="text-sm text-blue-600 mt-1">(클릭하여 날짜 변경)</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-red-600 font-medium text-sm">미지급</span>
                        )}
                      </td>

                      <td className="border border-gray-200 text-sm p-2 text-center print:hidden relative">
                        <div>
                          {editMode[record.record_id] && record.status === "paid" ? (
                            <button
                              className="bg-green-500 text-white px-2 py-1 rounded text-sm"
                              onClick={() => toggleEditMode(record.record_id)}
                            >
                              저장
                            </button>
                          ) : editMode[record.record_id] ? (
                            <button
                              className="bg-blue-300 text-black px-2 py-1 rounded text-sm"
                              onClick={() => handlePayButtonClick(record.record_id)}
                              ref={(el) => (buttonRef.current[record.record_id] = el)}
                            >
                              지급처리
                            </button>
                          ) : record.status === "paid" ? (
                            <button
                              className="bg-gray-300 text-black px-2 py-1 rounded text-sm"
                              onClick={() => toggleEditMode(record.record_id)}
                            >
                              수정
                            </button>
                          ) : (
                            <button
                              className="bg-blue-300 text-black px-2 py-1 rounded text-sm"
                              onClick={() => handlePayButtonClick(record.record_id)}
                              ref={(el) => (buttonRef.current[record.record_id] = el)}
                            >
                              지급처리
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* 근로자 소계 행 (기존과 동일) */}
                {(() => {
                  const workerSubtotal = calculateWorkerSubtotal(worker.records, getEffectiveValue);
                  return (
                    <tr className="bg-blue-50 font-semibold border-b-2 border-blue-300 transition-colors duration-150 hover:bg-blue-100">
                      <td colSpan="3" className="border text-sm text-left border-gray-200 p-2">
                        소계
                      </td>
                      <td className="border border-gray-200 text-sm p-2 text-right">
                        {workerSubtotal.totalDays}일
                      </td>
                      <td className="border border-gray-200 text-sm p-2 text-right">
                        {workerSubtotal.totalHours}시간
                      </td>
                      <td className="border border-gray-200 text-sm p-2 text-right">
                        {formatNumber(workerSubtotal.totalWage)}
                      </td>
                      <td className="border border-gray-200 text-sm p-2 text-right">
                        {formatNumber(workerSubtotal.totalAllowances)}
                      </td>
                      <td className="border border-gray-200 text-sm p-2 text-right">
                        {formatNumber(workerSubtotal.totalPay)}
                      </td>
                      <td className="border border-gray-200 text-sm p-2 text-right">
                        {formatNumber(workerSubtotal.totalTaxExemption)}
                      </td>
                      <td className="border border-gray-200 text-sm p-2 text-right">
                        {formatNumber(workerSubtotal.totalIncomeTax)}
                      </td>
                      <td className="border border-gray-200 text-sm p-2 text-right">
                        {formatNumber(workerSubtotal.totalLocalTax)}
                      </td>
                      <td className="border border-gray-200 text-sm p-2 text-right">
                        {formatNumber(workerSubtotal.totalNationalPension)}
                      </td>
                      <td className="border border-gray-200 text-sm p-2 text-right">
                        {formatNumber(workerSubtotal.totalHealthInsurance)}
                      </td>
                      <td className="border border-gray-200 text-sm p-2 text-right">
                        {formatNumber(workerSubtotal.totalEmploymentInsurance)}
                      </td>
                      <td className="border border-gray-200 text-sm p-2 text-right">
                        {formatNumber(workerSubtotal.totalDeduction)}
                      </td>
                      <td className="border border-gray-200 text-sm p-2 text-right">
                        {formatNumber(workerSubtotal.totalNetPay)}
                      </td>
                      <td className="border border-gray-200 text-sm p-2" colSpan="2">
                        <button
                          onClick={() => handleWorkerBulkPaymentClick(worker)}
                          className="w-full px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none disabled:bg-gray-400"
                          disabled={
                            worker.records.filter((record) => record.status !== "paid").length === 0
                          }
                        >
                          {worker.records.filter((record) => record.status !== "paid").length > 0
                            ? `일괄지급 (${
                                worker.records.filter((record) => record.status !== "paid").length
                              }건)`
                            : "지급완료"}
                        </button>
                      </td>
                    </tr>
                  );
                })()}
              </React.Fragment>
            ))}

            {/* 합계 행 (기존과 동일) */}
            <tr className="bg-gray-200 font-bold border-t-2 border-gray-400 transition-colors duration-150 hover:bg-gray-300">
              <td className="border border-gray-200 text-sm p-2 text-left" colSpan="3">
                합계
              </td>
              <td className="border border-gray-200 text-sm p-2 text-right">
                {grandTotal.totalDays}일
              </td>
              <td className="border border-gray-200 text-sm p-2 text-right">
                {grandTotal.totalHours}시간
              </td>
              <td className="border border-gray-200 text-sm p-2 text-right">
                {formatNumber(grandTotal.totalWage)}
              </td>
              <td className="border border-gray-200 text-sm p-2 text-right">
                {formatNumber(grandTotal.totalAllowances)}
              </td>
              <td className="border border-gray-200 text-sm p-2 text-right">
                {formatNumber(grandTotal.totalPay)}
              </td>
              <td className="border border-gray-200 text-sm p-2 text-right">
                {formatNumber(grandTotal.totalTaxExemption)}
              </td>
              <td className="border border-gray-200 text-sm p-2 text-right">
                {formatNumber(grandTotal.totalIncomeTax)}
              </td>
              <td className="border border-gray-200 text-sm p-2 text-right">
                {formatNumber(grandTotal.totalLocalTax)}
              </td>
              <td className="border border-gray-200 text-sm p-2 text-right">
                {formatNumber(grandTotal.totalNationalPension)}
              </td>
              <td className="border border-gray-200 text-sm p-2 text-right">
                {formatNumber(grandTotal.totalHealthInsurance)}
              </td>
              <td className="border border-gray-200 text-sm p-2 text-right">
                {formatNumber(grandTotal.totalEmploymentInsurance)}
              </td>
              <td className="border border-gray-200 text-sm p-2 text-right">
                {formatNumber(grandTotal.totalDeduction)}
              </td>
              <td className="border border-gray-200 text-sm p-2 text-right">
                {formatNumber(grandTotal.totalNetPay)}
              </td>
              <td className="border border-gray-200 text-sm p-2" colSpan="2"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* 🔥 Portal을 사용한 달력 렌더링 - 테이블 외부에 위치 */}
      {Object.keys(showDatePicker).map((recordId) => {
        if (!showDatePicker[recordId]) return null;

        const record = findRecordById(parseInt(recordId));
        if (!record) return null;

        return (
          <div
            key={`datepicker-${recordId}`}
            className="fixed z-50"
            style={{
              top: `${datePickerPosition[recordId]?.top || 0}px`,
              left: `${datePickerPosition[recordId]?.left || 0}px`,
              boxShadow: "0 10px 25px rgba(0,0,0,0.25)",
              borderRadius: "12px",
              overflow: "hidden",
            }}
            ref={(el) => (datePickerRef.current[recordId] = el)}
          >
            <DatePicker
              selected={
                selectedDate[recordId] ||
                (record.payment_date ? new Date(record.payment_date) : new Date())
              }
              onChange={(date) => {
                const worker = workerData.find((w) =>
                  w.records.some((r) => r.record_id === parseInt(recordId))
                );

                setShowDatePicker((prev) => ({
                  ...prev,
                  [recordId]: false,
                }));

                setTimeout(() => {
                  if (datePickerRef.current[recordId]) {
                    datePickerRef.current[recordId] = null;
                  }
                }, 0);

                if (worker) {
                  handleDateSelect(date, record, worker);
                }
              }}
              dateFormat="yyyy-MM-dd"
              inline
              className="bg-white shadow-lg border-0 rounded-lg"
              calendarClassName="shadow-none border-0 rounded-lg p-2"
              onClickOutside={() => {
                setShowDatePicker((prev) => ({
                  ...prev,
                  [recordId]: false,
                }));
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

export default memo(DailyWorkerTable);
