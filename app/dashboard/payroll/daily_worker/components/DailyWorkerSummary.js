//file: app/dashboard/payroll/daily-worker/components/DailyWorkerSummary.js

// 일자별 집계, 테이블 밑에 있는 것
import React from "react";
import { formatNumber } from "@/lib/utils/taxCalculations";
import { groupRecordsByDateWithCalculations } from "@/lib/utils/payrollCalculations";

const DailyWorkerSummary = ({ workerData, handleBulkPayment }) => {
  // 편집값 가져오기 함수 (DailyWorkerTable과 동일한 로직)
  const getEffectiveValue = (record, field) => {
    // 실제 컴포넌트에서는 editValues 상태를 사용하지만,
    // Summary에서는 원본 값을 그대로 사용
    return Number(record[field] || 0);
  };

  // 일자별 그룹화된 데이터 및 계산
  const dateGroups = groupRecordsByDateWithCalculations(workerData, getEffectiveValue);

  // 정렬된 요약 데이터
  const sortedSummaries = Object.values(dateGroups).sort((a, b) => a.day - b.day);

  // 데이터가 없으면 아무것도 렌더링하지 않음
  if (!workerData || workerData.length === 0 || sortedSummaries.length === 0) {
    return null;
  }

  return (
    <div className="mb-8 mt-10">
      <h2 className="text-xl font-bold text-gray-900 mb-4">일자별 요약</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {sortedSummaries.map((summary) => (
          <div key={summary.dateStr} className="bg-white p-4 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">{summary.dateStr}</h3>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  summary.hasUnpaid ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
                }`}
              >
                {summary.hasUnpaid ? "미지급 있음" : "모두 지급 완료"}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full mb-3 text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-1 py-1 text-left">이름</th>
                    <th className="px-1 py-1 text-center">시간</th>
                    <th className="px-1 py-1 text-right">일당</th>
                    <th className="px-1 py-1 text-right">공제</th>
                    <th className="px-1 py-1 text-right">실지급</th>
                    <th className="px-1 py-1 text-center">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.workers.map((worker, index) => (
                    <tr key={`${worker.worker_id}-${index}`} className="border-b border-gray-100">
                      <td className="px-1 py-1 text-xs">{worker.name}</td>
                      <td className="px-1 py-1 text-center text-xs">{worker.hours}h</td>
                      <td className="px-1 py-1 text-right text-xs">
                        {formatNumber(worker.dailyWage + worker.allowances)}
                      </td>
                      <td className="px-1 py-1 text-right text-xs text-red-600">
                        {formatNumber(worker.totalDeduction)}
                      </td>
                      <td className="px-1 py-1 text-right text-xs font-medium text-blue-600">
                        {formatNumber(worker.netPay)}
                      </td>
                      <td className="px-1 py-1 text-center text-xs">
                        {worker.status === "paid" ? (
                          <span className="text-green-700 font-medium">지급</span>
                        ) : (
                          <span className="text-red-600 font-medium">미지급</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-300 bg-gray-50">
                  <tr className="font-medium">
                    <td className="px-1 py-1 text-xs" colSpan="2">
                      합계
                    </td>
                    <td className="px-1 py-1 text-right text-xs">
                      {formatNumber(summary.totalAmount)}
                    </td>
                    <td className="px-1 py-1 text-right text-xs text-red-600">
                      {formatNumber(summary.totalDeductionAmount)}
                    </td>
                    <td className="px-1 py-1 text-right text-xs font-bold text-blue-600">
                      {formatNumber(summary.totalNetAmount)}
                    </td>
                    <td className="px-1 py-1"></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 요약 정보 */}
            <div className="mt-3 p-2 bg-gray-50 rounded text-xs">
              <div className="flex justify-between">
                <span>총 지급계:</span>
                <span className="font-medium">{formatNumber(summary.totalAmount)}원</span>
              </div>
              <div className="flex justify-between">
                <span>총 공제액:</span>
                <span className="font-medium text-red-600">
                  -{formatNumber(summary.totalDeductionAmount)}원
                </span>
              </div>
              <div className="flex justify-between border-t pt-1 mt-1">
                <span className="font-medium">실지급액:</span>
                <span className="font-bold text-blue-600">
                  {formatNumber(summary.totalNetAmount)}원
                </span>
              </div>
              {summary.unpaidNetAmount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>미지급 실지급액:</span>
                  <span className="font-medium">{formatNumber(summary.unpaidNetAmount)}원</span>
                </div>
              )}
            </div>

            {summary.unpaidNetAmount > 0 && (
              <div className="mt-3 print:hidden text-right">
                <button
                  onClick={() => {
                    console.log("DailyWorkerSummary: 클릭됨, dateStr:", summary.dateStr);
                    // ✅ 여기가 중요! dailySummaries의 키와 일치하는 날짜 문자열을 전달
                    // 예를 들어, summary 객체에 dailySummariesKey라는 속성이 '5월 1일'처럼 있다면
                    // handleBulkPayment(summary.dailySummariesKey, summary.workers);
                    // 현재 로그로 추정컨대, summary.dateStr이 '2일'로 나오므로
                    // dailySummaries의 키는 '5월 2일'입니다.
                    // 따라서, 'summary' 객체에 '5월 2일'을 나타내는 적절한 속성 (예: summary.monthDayFormat)을 사용해야 합니다.
                    // 일단 summary 객체 자체를 콘솔에 찍어서 어떤 날짜 관련 필드가 있는지 확인해보세요.
                    console.log("DailyWorkerSummary: summary 객체 확인:", summary); // summary 객체 전체를 확인하여 올바른 날짜 속성 찾기

                    // 만약 summary.dateStr이 'YYYY-MM-DD' 형식이고, dailySummaries 키가 'MM월 DD일' 형식이라면
                    // const formattedDate = new Date(summary.dateStr).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
                    // handleBulkPayment(formattedDate, summary.workers);

                    // 현재 로그를 보면 summary.dateStr이 "2일"로 전달되는데, dailySummaries 키는 "5월 2일"입니다.
                    // 즉, summary.dateStr은 `dailySummaries`의 키가 아닙니다.
                    // `summary` 객체 안에 '5월 2일' 형태의 값이 들어있는 다른 속성이 있는지 확인하고 사용해야 합니다.
                    // 아니면 groupRecordsByDateWithCalculations에서 summary 객체에 해당 포맷을 추가해야 합니다.
                    // (예시: summary.displayDate = new Date(summary.originalDate).toLocaleDateString(...);)

                    // 일단은 `page.js`에서 받은 `dailySummaries`의 키 형태가 '5월 1일'이므로,
                    // DailyWorkerSummary에서 이와 일치하는 `summary` 객체의 속성을 사용해야 합니다.
                    // `summary.dateStr`은 '2일'로 찍히므로, 다른 속성을 찾아야 합니다.
                    // `groupRecordsByDateWithCalculations`에서 '5월 2일' 형태의 키를 그대로 `summary` 객체에 추가하고 있다면 그 값을 사용하세요.
                    handleBulkPayment(summary.dateStr, summary.workers); // 이 부분 수정이 필요합니다.
                  }}
                  className="text-xs px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none transition-colors"
                >
                  일괄 지급처리 ({formatNumber(summary.unpaidNetAmount)}원)
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default DailyWorkerSummary;
