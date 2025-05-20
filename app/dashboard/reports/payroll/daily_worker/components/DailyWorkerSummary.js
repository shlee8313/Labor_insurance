//file: app/dashboard/payroll/daily-worker/components/DailyWorkerSummary.js
import React from "react";
import { formatNumber } from "@/lib/utils/taxCalculations";

const DailyWorkerSummary = ({ dailySummaries, handleBulkPayment }) => {
  // 일자별 요약을 배열로 변환하고 날짜순으로 정렬
  const sortedSummaries = Object.entries(dailySummaries)
    .map(([dateStr, summary]) => ({ dateStr, ...summary }))
    .sort((a, b) => a.day - b.day);

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold text-gray-900 mb-4">일자별 요약</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedSummaries.map((summary) => (
          <div key={summary.dateStr} className="bg-white p-4 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">{summary.dateStr}</h3>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  summary.unpaidAmount > 0
                    ? "bg-red-100 text-red-800"
                    : "bg-green-100 text-green-800"
                }`}
              >
                {summary.unpaidAmount > 0 ? "미지급 있음" : "모두 지급 완료"}
              </span>
            </div>
            <table className="w-full mb-3">
              <thead className="bg-gray-50 text-xs">
                <tr>
                  <th className="px-2 py-1 text-left">이름</th>
                  <th className="px-2 py-1 text-left">시간</th>
                  <th className="px-2 py-1 text-right">일당</th>
                  <th className="px-2 py-1 text-center">상태</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {summary.workers.map((worker, index) => (
                  <tr key={index}>
                    <td className="px-2 py-1">{worker.name}</td>
                    <td className="px-2 py-1">{worker.hours}시간</td>
                    <td className="px-2 py-1 text-right">{formatNumber(worker.amount)}</td>
                    <td className="px-2 py-1 text-center">
                      {worker.status === "paid" ? (
                        <span className="text-green-700 font-medium">지급</span>
                      ) : (
                        <span className="text-red-600 font-medium">미지급</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t text-sm font-medium">
                <tr>
                  <td className="px-2 py-1" colSpan="2">
                    합계
                  </td>
                  <td className="px-2 py-1 text-right">{formatNumber(summary.totalAmount)}</td>
                  <td className="px-2 py-1"></td>
                </tr>
              </tfoot>
            </table>
            {summary.unpaidAmount > 0 && (
              <div className="mt-2 print:hidden text-right">
                <button
                  onClick={() => handleBulkPayment(summary.dateStr, summary.workers)}
                  className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none"
                >
                  일괄 지급처리
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
