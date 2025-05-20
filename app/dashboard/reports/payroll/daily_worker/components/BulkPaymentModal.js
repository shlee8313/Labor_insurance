//file: app/dashboard/payroll/daily-worker/components/BulkPaymentModal.js
import React, { useState, useRef, useEffect } from "react";
import { formatNumber } from "@/lib/utils/taxCalculations";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Calendar } from "lucide-react";

const BulkPaymentModal = ({ bulkPaymentInfo, onClose, onConfirm }) => {
  const [paymentMethod, setPaymentMethod] = useState("계좌이체");
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date()); // 지급일 상태 추가
  const [showDatePicker, setShowDatePicker] = useState(false); // 달력 표시 상태

  // ref 정의
  const datePickerRef = useRef(null);
  const dateButtonRef = useRef(null);

  // 외부 클릭 감지를 위한 useEffect
  useEffect(() => {
    function handleClickOutside(event) {
      if (showDatePicker) {
        // 클릭된 요소가 달력 또는 달력 버튼 내부인지 확인
        const isDatePickerClick =
          datePickerRef.current && datePickerRef.current.contains(event.target);
        const isDateButtonClick =
          dateButtonRef.current && dateButtonRef.current.contains(event.target);

        // 달력 외부 클릭 시 달력 닫기
        if (!isDatePickerClick && !isDateButtonClick) {
          setShowDatePicker(false);
        }
      }
    }

    // 이벤트 리스너 추가
    document.addEventListener("mousedown", handleClickOutside);

    // 컴포넌트 언마운트 시 이벤트 리스너 제거
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDatePicker]);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      // 선택한 지급일을 포함하여 전달
      await onConfirm(bulkPaymentInfo.items, paymentMethod, memo, paymentDate);
    } catch (error) {
      console.error("일괄 지급 처리 오류:", error);
    } finally {
      setLoading(false);
    }
  };

  // 날짜를 YYYY-MM-DD 형식으로 포맷팅하는 함수
  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // 달력 아이콘 클릭 시 달력 표시 토글
  const toggleDatePicker = () => {
    setShowDatePicker(!showDatePicker);
  };

  // 날짜 선택 시 처리
  const handleDateSelect = (date) => {
    setPaymentDate(date);
    setShowDatePicker(false); // 날짜 선택 후 달력 닫기
  };

  if (!bulkPaymentInfo) return null;

  return (
    <div className="fixed inset-0 overflow-y-auto z-50">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
        </div>
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
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
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                  일괄 지급 처리
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    {bulkPaymentInfo.date} 모든 미지급 일당을 일괄 지급하시겠습니까?
                  </p>
                  <div className="mt-3 bg-gray-50 p-3 rounded-md max-h-60 overflow-y-auto">
                    <p className="text-sm font-medium mb-2">미지급 항목 목록:</p>
                    <ul className="text-sm space-y-1 list-disc pl-5">
                      {bulkPaymentInfo.items.map((item, index) => (
                        <li key={index}>
                          {item.name} ({item.job || "일용직"}) - {formatNumber(item.totalAmount)}원
                          {item.records && item.records.length > 1 && (
                            <span className="text-gray-500 text-xs ml-1">
                              ({item.records.length}건)
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 text-sm font-medium">
                      총 금액: {formatNumber(bulkPaymentInfo.totalAmount)}원
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  {/* 지급일 선택 UI 추가 */}
                  <div className="mb-3 relative">
                    <label
                      htmlFor="payment-date"
                      className="block text-sm font-medium text-gray-700"
                    >
                      지급일
                    </label>
                    <div className="mt-1 flex items-center">
                      <input
                        type="text"
                        id="payment-date"
                        value={formatDate(paymentDate)}
                        readOnly
                        className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md cursor-pointer"
                        onClick={toggleDatePicker}
                      />
                      <button
                        ref={dateButtonRef}
                        type="button"
                        className="absolute inset-y-0 right-0 mt-6 flex items-center pr-3"
                        onClick={toggleDatePicker}
                      >
                        <Calendar className="h-5 w-5 text-gray-400" />
                      </button>
                    </div>
                    {showDatePicker && (
                      <div
                        ref={datePickerRef}
                        className="absolute z-10 mt-1 bg-white shadow-lg rounded-md border border-gray-200"
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
                  <div className="mb-3">
                    <label
                      htmlFor="bulk-payment-method"
                      className="block text-sm font-medium text-gray-700"
                    >
                      지급 방법
                    </label>
                    <select
                      id="bulk-payment-method"
                      name="bulk-payment-method"
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                    >
                      <option>계좌이체</option>
                      <option>현금</option>
                      <option>현금영수증</option>
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="bulk-payment-memo"
                      className="block text-sm font-medium text-gray-700"
                    >
                      메모 (선택사항)
                    </label>
                    <textarea
                      id="bulk-payment-memo"
                      name="bulk-payment-memo"
                      rows="2"
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                      placeholder="지급 관련 메모"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm disabled:bg-green-300"
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
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  처리 중...
                </span>
              ) : (
                "지급 처리"
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BulkPaymentModal;
