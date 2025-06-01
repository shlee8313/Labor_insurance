// file: app/dashboard/payroll/daily-worker/components/ByDayBulkPaymentModal.js
// 날자별 일괄지급급

"use client";
import React, { useState, useRef, useEffect } from "react";
import { formatNumber } from "@/lib/utils/taxCalculations";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Calendar } from "lucide-react";

const ByDayBulkPaymentModal = ({ bulkPaymentInfo, onClose, onConfirm }) => {
  const [paymentMethod, setPaymentMethod] = useState("계좌이체");
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const datePickerRef = useRef(null);
  const dateButtonRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (showDatePicker) {
        const isDatePickerClick =
          datePickerRef.current && datePickerRef.current.contains(event.target);
        const isDateButtonClick =
          dateButtonRef.current && dateButtonRef.current.contains(event.target);
        if (!isDatePickerClick && !isDateButtonClick) {
          setShowDatePicker(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDatePicker]);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm(bulkPaymentInfo.items, paymentMethod, memo, paymentDate);
    } catch (error) {
      console.error("일괄 지급 처리 오류:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const toggleDatePicker = () => {
    setShowDatePicker(!showDatePicker);
  };

  const handleDateSelect = (date) => {
    setPaymentDate(date);
    setShowDatePicker(false);
  };

  if (!bulkPaymentInfo) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center px-4 py-8 bg-gray-500 bg-opacity-75"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-lg shadow-xl transform transition-all sm:max-w-3xl w-full"
      >
        <div className="bg-white px-6 pt-6 pb-4 sm:pb-6">
          <div className="flex items-start">
            <div className="flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
              <svg
                className="h-6 w-6 text-green-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-xl font-semibold text-gray-900" id="modal-title">
                일괄 지급 처리
              </h3>
              <div className="mt-2">
                <p className="text-lg text-gray-600">
                  {bulkPaymentInfo.date} 모든 미지급 일당을 일괄 지급하시겠습니까?
                </p>
                <div className="mt-3 bg-gray-50 p-4 rounded-md max-h-60 overflow-y-auto">
                  <p className="text-lg font-semibold mb-2">미지급 항목 목록:</p>
                  <ul className="text-base space-y-1 list-disc pl-5">
                    {bulkPaymentInfo.items.map((item, index) => (
                      <li key={index}>
                        {item.name} ({item.job || "일용직"}) - {formatNumber(item.totalAmount)}원
                        {item.records && item.records.length > 1 && (
                          <span className="text-gray-500 text-sm ml-1">
                            ({item.records.length}건)
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-lg font-semibold">
                    총 금액: {formatNumber(bulkPaymentInfo.totalAmount)}원
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-4">
                {/* 지급일 */}
                <div className="flex items-center gap-2">
                  <label
                    htmlFor="payment-date"
                    className="text-lg font-medium text-gray-700 min-w-[60px]"
                  >
                    지급일
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="payment-date"
                      value={formatDate(paymentDate)}
                      readOnly
                      className="w-44 pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md cursor-pointer"
                      onClick={toggleDatePicker}
                    />
                    <button
                      ref={dateButtonRef}
                      type="button"
                      className="absolute inset-y-0 right-2 flex items-center"
                      onClick={toggleDatePicker}
                    >
                      <Calendar className="h-5 w-5 text-gray-400" />
                    </button>
                    {showDatePicker && (
                      <div
                        ref={datePickerRef}
                        className="absolute left-full ml-4 z-10 bg-white shadow-lg rounded-md border border-gray-200"
                      >
                        <DatePicker
                          selected={paymentDate}
                          onChange={handleDateSelect}
                          inline
                          dateFormat="yyyy-MM-dd"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* 지급 방법 */}
                <div>
                  <label
                    htmlFor="bulk-payment-method"
                    className="block text-lg font-medium text-gray-700"
                  >
                    지급 방법
                  </label>
                  <select
                    id="bulk-payment-method"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 rounded-md"
                  >
                    <option>계좌이체</option>
                    <option>현금</option>
                    <option>현금영수증</option>
                  </select>
                </div>

                {/* 메모 */}
                <div>
                  <label
                    htmlFor="bulk-payment-memo"
                    className="block text-lg font-medium text-gray-700"
                  >
                    메모 (선택사항)
                  </label>
                  <textarea
                    id="bulk-payment-memo"
                    rows="2"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    className="mt-1 block w-full text-base border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="지급 관련 메모"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 버튼 영역 */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex justify-center rounded-md border border-gray-300 px-4 py-2 bg-white text-lg font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className="inline-flex justify-center rounded-md border border-transparent px-4 py-2 bg-green-600 text-lg font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-green-300"
          >
            {loading ? (
              <span className="flex items-center">
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                처리 중...
              </span>
            ) : (
              "일별일괄지급처리"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ByDayBulkPaymentModal;
