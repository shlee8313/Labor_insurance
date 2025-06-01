//file: app/dashboard/payroll/daily-worker/components/WorkerBulkPaymentModal.js

// 급여테이블 소계라인에서 일괄처리 인별 일괄처리리
import React, { useState } from "react";
import { formatNumber, formatResidentNumber } from "@/lib/utils/taxCalculations";

const WorkerBulkPaymentModal = ({ bulkPaymentInfo, onClose, onConfirm }) => {
  const [paymentMethod, setPaymentMethod] = useState("계좌이체");
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm(bulkPaymentInfo, paymentMethod, memo);
    } catch (error) {
      console.error("일괄 지급 처리 오류:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!bulkPaymentInfo) return null;

  const { worker, unpaidRecords, totalGrossAmount, totalNetAmount, recordCount } = bulkPaymentInfo;

  // 날짜별로 그룹화
  const recordsByDate = unpaidRecords.reduce((acc, record) => {
    const date = record.day;
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(record);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 overflow-y-auto z-50">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
        </div>
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
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
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                  />
                </svg>
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                  일괄 급여 지급 처리
                </h3>

                {/* 근로자 정보 */}
                <div className="mt-4 bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-2">근로자 정보</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">이름:</span>
                      <span className="ml-2 font-medium">{worker.name}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">주민번호:</span>
                      <span className="ml-2 font-medium">
                        {formatResidentNumber(worker.resident_number)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">직종:</span>
                      <span className="ml-2 font-medium">{worker.job_code || "일용직"}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">지급 건수:</span>
                      <span className="ml-2 font-medium text-blue-600">{recordCount}건</span>
                    </div>
                  </div>
                </div>

                {/* 미지급 항목 목록 */}
                <div className="mt-4">
                  <h4 className="font-medium text-gray-800 mb-2">미지급 항목</h4>
                  <div className="max-h-60 overflow-y-auto border border-gray-200 rounded">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="border-b border-gray-200 p-2 text-left">근무일</th>
                          <th className="border-b border-gray-200 p-2 text-right">근무시간</th>
                          <th className="border-b border-gray-200 p-2 text-right">일당</th>
                          <th className="border-b border-gray-200 p-2 text-right">수당</th>
                          <th className="border-b border-gray-200 p-2 text-right">실지급액</th>
                        </tr>
                      </thead>
                      <tbody>
                        {unpaidRecords.map((record, index) => {
                          const allowances = Number(record.allowances || 0);
                          const dailyWage = Number(record.dailyWage || 0);
                          const totalPay = dailyWage + allowances;

                          // 간단한 실지급액 계산 (여기서는 공제액을 대략적으로 계산)
                          const estimatedDeduction = totalPay * 0.1; // 대략 10% 공제 가정
                          const netPay = totalPay - estimatedDeduction;

                          return (
                            <tr key={record.record_id || index} className="hover:bg-gray-50">
                              <td className="border-b border-gray-200 p-2">{record.day}일</td>
                              <td className="border-b border-gray-200 p-2 text-right">
                                {record.hours}시간
                              </td>
                              <td className="border-b border-gray-200 p-2 text-right">
                                {formatNumber(dailyWage)}
                              </td>
                              <td className="border-b border-gray-200 p-2 text-right">
                                {formatNumber(allowances)}
                              </td>
                              <td className="border-b border-gray-200 p-2 text-right">
                                {formatNumber(netPay)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 금액 요약 */}
                <div className="mt-4 bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-800 mb-2">지급 금액 요약</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">총 지급계:</span>
                      <span className="ml-2 font-bold text-blue-600">
                        {formatNumber(totalGrossAmount)}원
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">실지급액:</span>
                      <span className="ml-2 font-bold text-green-600">
                        {formatNumber(totalNetAmount)}원
                      </span>
                    </div>
                  </div>
                </div>

                {/* 지급 방법 및 메모 */}
                <div className="mt-4 space-y-4">
                  <div>
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
                      placeholder="일괄 지급 관련 메모"
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
                `일괄 지급 처리 (${formatNumber(totalNetAmount)}원)`
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

export default WorkerBulkPaymentModal;
