//file: app/dashboard/payroll/daily-worker/components/PaymentModal.js
import React, { useState } from "react";
import { formatNumber } from "@/lib/utils/taxCalculations";

const PaymentModal = ({ paymentInfo, onClose, onConfirm }) => {
  const [paymentMethod, setPaymentMethod] = useState("계좌이체");
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm(paymentInfo.recordId, paymentMethod, memo);
    } catch (error) {
      console.error("지급 처리 오류:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!paymentInfo) return null;

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
                  일당 지급 처리
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    {paymentInfo.worker} 근로자의 {paymentInfo.date} 일당을 지급하시겠습니까?
                  </p>
                  <div className="mt-2">
                    <p className="text-sm font-medium">
                      일급여액: {formatNumber(paymentInfo.amount)}원
                    </p>
                    <p className="text-sm font-medium">
                      실지급액: {formatNumber(paymentInfo.netAmount)}원
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-3">
                    <label
                      htmlFor="payment-method"
                      className="block text-sm font-medium text-gray-700"
                    >
                      지급 방법
                    </label>
                    <select
                      id="payment-method"
                      name="payment-method"
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
                      htmlFor="payment-memo"
                      className="block text-sm font-medium text-gray-700"
                    >
                      메모 (선택사항)
                    </label>
                    <textarea
                      id="payment-memo"
                      name="payment-memo"
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

export default PaymentModal;
