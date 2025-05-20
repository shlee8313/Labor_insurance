//file: app/dashboard/payroll/daily-worker/components/PayslipModal.js
import React from "react";
import { formatNumber, formatResidentNumber, formatPhoneNumber } from "@/lib/utils/taxCalculations";
import { Printer } from "lucide-react";

const PayslipModal = ({ payslipInfo, onClose, onPrint }) => {
  if (!payslipInfo) return null;

  const yearMonth = payslipInfo.yearMonth || "";
  const year = yearMonth.split("-")[0] || new Date().getFullYear();
  const month = yearMonth.split("-")[1] || (new Date().getMonth() + 1).toString().padStart(2, "0");

  return (
    <div className="fixed inset-0 overflow-y-auto z-50">
      <div className="flex items-center  justify-center  min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* 배경 오버레이 */}
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={onClose}></div>
        </div>

        {/* 모달 컨텐츠 */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
          &#8203;
        </span>
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle max-w-7xl w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex justify-between items-start">
              <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                급여명세서 - {payslipInfo.name} ({payslipInfo.job})
              </h3>
              <button
                onClick={onPrint}
                className="text-sm px-3 py-1 border border-gray-300 rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none print:hidden flex items-center"
              >
                <Printer size={16} className="mr-1" />
                인쇄
              </button>
            </div>

            <div className="mt-4 bg-gray-50 p-4 rounded-lg">
              {/* 근로자 정보 및 지급 요약 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">근로자 정보</h4>
                  <p className="text-sm text-gray-600">이름: {payslipInfo.name}</p>
                  <p className="text-sm text-gray-600">
                    주민등록번호: {formatResidentNumber(payslipInfo.resident_number)}
                  </p>
                  <p className="text-sm text-gray-600">
                    연락처: {formatPhoneNumber(payslipInfo.contact_number)}
                  </p>
                  <p className="text-sm text-gray-600">직종: {payslipInfo.job}</p>
                  <p className="text-sm text-gray-600">
                    지급 월: {year}년 {month}월
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">지급 요약</h4>
                  <p className="text-sm text-gray-600">
                    총 근무일수: {payslipInfo.workRecords.length}일
                  </p>
                  <p className="text-sm text-gray-600">총 근무시간: {payslipInfo.totalHours}시간</p>
                  <p className="text-sm text-gray-600">
                    총 지급액: {formatNumber(payslipInfo.totalWage + payslipInfo.totalAllowance)}원
                  </p>
                  <p className="text-sm text-gray-600">
                    총 공제액: {formatNumber(payslipInfo.totalDeductions)}원
                  </p>
                  <p className="text-sm font-medium text-gray-800">
                    최종 실지급액: {formatNumber(payslipInfo.netPay)}원
                  </p>
                </div>
              </div>

              {/* 근무 내역 테이블 */}
              <h4 className="text-sm font-medium text-gray-700 mb-2">근무 내역</h4>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="border border-gray-300 p-2 text-center">근무일</th>
                      <th className="border border-gray-300 p-2 text-center">시간</th>
                      <th className="border border-gray-300 p-2 text-center">일당</th>
                      <th className="border border-gray-300 p-2 text-center">수당</th>
                      <th className="border border-gray-300 p-2 text-center">지급계</th>
                      <th className="border border-gray-300 p-2 text-center">비과세</th>
                      <th className="border border-gray-300 p-2 text-center">소득세</th>
                      <th className="border border-gray-300 p-2 text-center">주민세</th>
                      <th className="border border-gray-300 p-2 text-center">국민</th>
                      <th className="border border-gray-300 p-2 text-center">건강</th>
                      <th className="border border-gray-300 p-2 text-center">고용</th>
                      {/* <th className="border border-gray-300 p-2 text-center">장기요양</th> */}
                      <th className="border border-gray-300 p-2 text-center">공제계</th>
                      <th className="border border-gray-300 p-2 text-center">실지급액</th>
                      <th className="border border-gray-300 p-2 text-center">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payslipInfo.workRecords.map((record, index) => (
                      <tr key={index}>
                        <td className="border border-gray-300 p-2 text-center">{record.date}</td>
                        <td className="border border-gray-300 p-2 text-right">{record.hours}</td>
                        <td className="border border-gray-300 p-2 text-right">
                          {formatNumber(record.dailyWage)}
                        </td>
                        <td className="border border-gray-300 p-2 text-right">
                          {formatNumber(record.allowances)}
                        </td>
                        <td className="border border-gray-300 p-2 text-right">
                          {formatNumber(record.dailyWage + record.allowances)}
                        </td>
                        <td className="border border-gray-300 p-2 text-right">
                          {formatNumber(record.taxExemption)}
                        </td>
                        <td className="border border-gray-300 p-2 text-right">
                          {formatNumber(record.incomeTax)}
                        </td>
                        <td className="border border-gray-300 p-2 text-right">
                          {formatNumber(record.localTax)}
                        </td>
                        <td className="border border-gray-300 p-2 text-right">
                          {formatNumber(record.nationalPension)}
                        </td>
                        <td className="border border-gray-300 p-2 text-right">
                          {formatNumber(record.healthInsurance)}
                        </td>
                        <td className="border border-gray-300 p-2 text-right">
                          {formatNumber(record.employmentInsurance)}
                        </td>
                        {/* <td className="border border-gray-300 p-2 text-right">
                          {formatNumber(record.longTermCare)}
                        </td> */}
                        <td className="border border-gray-300 p-2 text-right">
                          {formatNumber(record.totalDeduction)}
                        </td>
                        <td className="border border-gray-300 p-2 text-right">
                          {formatNumber(record.netPay)}
                        </td>
                        <td className="border border-gray-300 p-2 text-center">
                          {record.status === "paid" ? (
                            <span className="text-green-700 font-medium">지급</span>
                          ) : (
                            <span className="text-red-600 font-medium">미지급</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-blue-50 font-medium">
                    <tr>
                      <td className="border border-gray-300 p-2 text-right">합계</td>
                      <td className="border border-gray-300 p-2 text-right">
                        {formatNumber(payslipInfo.totalHours)}
                      </td>
                      <td className="border border-gray-300 p-2 text-right">
                        {formatNumber(payslipInfo.totalWage)}
                      </td>
                      <td className="border border-gray-300 p-2 text-right">
                        {formatNumber(payslipInfo.totalAllowance)}
                      </td>
                      <td className="border border-gray-300 p-2 text-right">
                        {formatNumber(payslipInfo.totalWage + payslipInfo.totalAllowance)}
                      </td>
                      <td className="border border-gray-300 p-2 text-right">
                        {formatNumber(payslipInfo.totalTaxExemption)}
                      </td>
                      <td className="border border-gray-300 p-2 text-right">
                        {formatNumber(
                          payslipInfo.workRecords.reduce((sum, r) => sum + r.incomeTax, 0)
                        )}
                      </td>
                      <td className="border border-gray-300 p-2 text-right">
                        {formatNumber(
                          payslipInfo.workRecords.reduce((sum, r) => sum + r.localTax, 0)
                        )}
                      </td>
                      <td className="border border-gray-300 p-2 text-right">
                        {formatNumber(
                          payslipInfo.workRecords.reduce((sum, r) => sum + r.nationalPension, 0)
                        )}
                      </td>
                      <td className="border border-gray-300 p-2 text-right">
                        {formatNumber(
                          payslipInfo.workRecords.reduce((sum, r) => sum + r.healthInsurance, 0)
                        )}
                      </td>
                      <td className="border border-gray-300 p-2 text-right">
                        {formatNumber(
                          payslipInfo.workRecords.reduce((sum, r) => sum + r.employmentInsurance, 0)
                        )}
                      </td>
                      {/* <td className="border border-gray-300 p-2 text-right">
                        {formatNumber(
                          payslipInfo.workRecords.reduce((sum, r) => sum + r.longTermCare, 0)
                        )}
                      </td> */}
                      <td className="border border-gray-300 p-2 text-right">
                        {formatNumber(payslipInfo.totalDeductions)}
                      </td>
                      <td className="border border-gray-300 p-2 text-right">
                        {formatNumber(payslipInfo.netPay)}
                      </td>
                      <td className="border border-gray-300 p-2"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* 공제 내역 및 지급 계산 */}
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">공제 내역</h4>
                  <div className="bg-white p-3 rounded-md border border-gray-300">
                    <ul className="text-sm space-y-1">
                      <li className="flex justify-between">
                        <span>소득세:</span>
                        <span>
                          {formatNumber(
                            payslipInfo.workRecords.reduce((sum, r) => sum + r.incomeTax, 0)
                          )}
                          원
                        </span>
                      </li>
                      <li className="flex justify-between">
                        <span>주민세:</span>
                        <span>
                          {formatNumber(
                            payslipInfo.workRecords.reduce((sum, r) => sum + r.localTax, 0)
                          )}
                          원
                        </span>
                      </li>
                      <li className="flex justify-between">
                        <span>국민연금:</span>
                        <span>
                          {formatNumber(
                            payslipInfo.workRecords.reduce((sum, r) => sum + r.nationalPension, 0)
                          )}
                          원
                        </span>
                      </li>
                      <li className="flex justify-between">
                        <span>건강보험:</span>
                        <span>
                          {formatNumber(
                            payslipInfo.workRecords.reduce((sum, r) => sum + r.healthInsurance, 0)
                          )}
                          원
                        </span>
                      </li>
                      <li className="flex justify-between">
                        <span>고용보험:</span>
                        <span>
                          {formatNumber(
                            payslipInfo.workRecords.reduce(
                              (sum, r) => sum + r.employmentInsurance,
                              0
                            )
                          )}
                          원
                        </span>
                      </li>
                      {/* <li className="flex justify-between">
                        <span>장기요양보험:</span>
                        <span>
                          {formatNumber(
                            payslipInfo.workRecords.reduce((sum, r) => sum + r.longTermCare, 0)
                          )}
                          원
                        </span>
                      </li> */}
                      <li className="flex justify-between font-medium pt-1 border-t">
                        <span>총 공제액:</span>
                        <span>{formatNumber(payslipInfo.totalDeductions)}원</span>
                      </li>
                    </ul>
                  </div>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">지급 계산</h4>
                  <div className="bg-white p-3 rounded-md border border-gray-300">
                    <ul className="text-sm space-y-1">
                      <li className="flex justify-between">
                        <span>총 일당:</span>
                        <span>{formatNumber(payslipInfo.totalWage)}원</span>
                      </li>
                      <li className="flex justify-between">
                        <span>총 수당:</span>
                        <span>{formatNumber(payslipInfo.totalAllowance)}원</span>
                      </li>
                      <li className="flex justify-between">
                        <span>총 지급액:</span>
                        <span>
                          {formatNumber(payslipInfo.totalWage + payslipInfo.totalAllowance)}원
                        </span>
                      </li>
                      <li className="flex justify-between">
                        <span>비과세액:</span>
                        <span>{formatNumber(payslipInfo.totalTaxExemption)}원</span>
                      </li>
                      <li className="flex justify-between text-red-600">
                        <span>총 공제액:</span>
                        <span>-{formatNumber(payslipInfo.totalDeductions)}원</span>
                      </li>
                      <li className="flex justify-between font-medium pt-1 border-t">
                        <span>최종 실지급액:</span>
                        <span>{formatNumber(payslipInfo.netPay)}원</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* 급여명세서 하단 메모 */}
            <div className="mt-4 text-sm text-gray-500">
              <p>* 본 급여명세서는 정보 제공을 위한 것이며, 공식 문서로 사용될 수 없습니다.</p>
              <p>* 문의사항은 담당자에게 연락 바랍니다.</p>
            </div>
          </div>

          {/* 푸터 버튼 */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse print:hidden">
            <button
              type="button"
              onClick={onClose}
              className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PayslipModal;
