//file: app\dashboard\reports\payroll\page.js
"use client";
import React, { useRef } from "react";
// import { useReactToPrint } from "react-to-print";

export default function PayslipComponentWithPrint() {
  const componentRef = useRef();

  //   const handlePrint = useReactToPrint({
  //     content: () => componentRef.current,
  //   });

  return (
    <div className="p-5 bg-gray-100 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">급여명세서</h1>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            인쇄하기
          </button>
        </div>

        <div ref={componentRef} className="bg-white p-6 shadow-md rounded-md">
          <div className="text-2xl font-bold text-center mb-5">임금 명세서</div>

          {/* 근로자 정보 테이블 */}
          <table className="w-full border-collapse mb-5">
            <tbody>
              <tr>
                <th className="border border-gray-300 p-2.5 bg-gray-100 w-1/6">성명</th>
                <td className="border border-gray-300 p-2.5 text-blue-700 font-bold w-1/3">
                  홍 길 동
                </td>
                <th className="border border-gray-300 p-2.5 bg-gray-100 w-1/6">사번</th>
                <td className="border border-gray-300 p-2.5 text-blue-700 font-bold w-1/3">
                  073542
                </td>
              </tr>
              <tr>
                <th className="border border-gray-300 p-2.5 bg-gray-100">부서</th>
                <td className="border border-gray-300 p-2.5 text-blue-700 font-bold">개발지원팀</td>
                <th className="border border-gray-300 p-2.5 bg-gray-100">직급</th>
                <td className="border border-gray-300 p-2.5 text-blue-700 font-bold">팀장</td>
              </tr>
            </tbody>
          </table>

          {/* 세부 내역 테이블 */}
          <table className="w-full border-collapse mb-5">
            <thead>
              <tr>
                <th className="border border-gray-300 p-2.5 bg-gray-100 text-center" colSpan="5">
                  세부 내역
                </th>
              </tr>
              <tr>
                <th colspan="3" className="border border-gray-300 p-2.5 bg-gray-100 text-center">
                  지급
                </th>
                <th colspan="2" className="border border-gray-300 p-2.5 bg-gray-100 text-center">
                  공제
                </th>
              </tr>
              <tr>
                <th
                  colspan="2"
                  className="border border-gray-300 p-2.5 bg-gray-100 text-center w-1/4"
                >
                  지급급항목
                </th>
                <th className="border border-gray-300 p-2.5 bg-gray-100 text-center w-1/4">
                  지급 금액(원)
                </th>
                <th className="border border-gray-300 p-2.5 bg-gray-100 text-center w-1/4">
                  공제항목
                </th>
                <th className="border border-gray-300 p-2.5 bg-gray-100 text-center w-1/4">
                  공제 금액(원)
                </th>
              </tr>
            </thead>
            <tbody className="text-center">
              <tr>
                <td rowspan="6" className="border border-gray-300 p-1">
                  매<br />월<br />지<br />급
                </td>
                <td className="border border-gray-300 p-2.5">기본급</td>
                <td className="border border-gray-300 p-2.5">3,200,000</td>
                <td className="border border-gray-300 p-2.5">소득세</td>
                <td className="border border-gray-300 p-2.5">115,530</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2.5">연장근로수당</td>
                <td className="border border-gray-300 p-2.5">379,728</td>
                <td className="border border-gray-300 p-2.5">국민연금</td>
                <td className="border border-gray-300 p-2.5">177,570</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2.5">야간근로수당</td>
                <td className="border border-gray-300 p-2.5">15,822</td>
                <td className="border border-gray-300 p-2.5">고용 보험</td>
                <td className="border border-gray-300 p-2.5">31,570</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2.5">휴일근로수당</td>
                <td className="border border-gray-300 p-2.5">94,932</td>
                <td className="border border-gray-300 p-2.5">건강 보험</td>
                <td className="border border-gray-300 p-2.5">135,350</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2.5">가족수당</td>
                <td className="border border-gray-300 p-2.5">150,000</td>
                <td className="border border-gray-300 p-2.5">장기 요양 보험</td>
                <td className="border border-gray-300 p-2.5">15,590</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2.5">식대</td>
                <td className="border border-gray-300 p-2.5">100,000</td>
                <td className="border border-gray-300 p-2.5">노동조합비</td>
                <td className="border border-gray-300 p-2.5">15,000</td>
              </tr>
              <tr className="font-bold bg-gray-50">
                <td colspan="2" className="border border-gray-300 p-2.5">
                  지급액 계
                </td>
                <td className="border border-gray-300 p-2.5">3,940,482</td>
                <td className="border border-gray-300 p-2.5">공제액 계</td>
                <td className="border border-gray-300 p-2.5">490,610</td>
              </tr>
              <tr className="font-bold bg-gray-50">
                <td className="border border-gray-300 p-2.5" colSpan="3">
                  실 수령액 (원)
                </td>
                <td className="border border-gray-300 p-2.5 text-blue-700" colSpan="2">
                  3,472,161
                </td>
              </tr>
            </tbody>
          </table>

          {/* 계산 방법 테이블 */}
          <table className="w-full border-collapse mb-5">
            <thead>
              <tr>
                <th className="border border-gray-300 p-2.5 bg-gray-200 text-center" colSpan="3">
                  계산 방법
                </th>
              </tr>
              <tr>
                <th className="border border-gray-300 p-2.5 bg-gray-200 text-center w-1/6">구분</th>
                <th className="border border-gray-300 p-2.5 bg-gray-200 text-center w-2/3">
                  산출식 또는 산출방법
                </th>
                <th className="border border-gray-300 p-2.5 bg-gray-200 text-center w-1/6">
                  지급액 (원)
                </th>
              </tr>
            </thead>
            <tbody className="text-center">
              <tr>
                <td className="border border-gray-300 p-2.5">연장근로수당</td>
                <td className="border border-gray-300 p-2.5">
                  연장근로시간 수 (16시간) × 15,822원 × 1.5
                </td>
                <td className="border border-gray-300 p-2.5">379,728</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2.5">야간근로수당</td>
                <td className="border border-gray-300 p-2.5">
                  야간근로시간 수 (2시간) × 15,822원 × 0.5
                </td>
                <td className="border border-gray-300 p-2.5">15,822</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2.5">휴일근로수당</td>
                <td className="border border-gray-300 p-2.5">
                  휴일근로시간 수 (4시간) × 15,822원 × 1.5
                </td>
                <td className="border border-gray-300 p-2.5">94,932</td>
              </tr>
              <tr>
                <td className="border border-gray-300 p-2.5">가족수당</td>
                <td className="border border-gray-300 p-2.5">
                  100,000원 × 1명(배우자) + 50,000원 × 1명(자녀 1명)
                </td>
                <td className="border border-gray-300 p-2.5">150,000</td>
              </tr>
            </tbody>
          </table>

          {/* 푸터 */}
          <div className="text-right text-sm text-gray-500">
            임금명세서 작성 사례(출처: 고용노동부)
          </div>
        </div>
      </div>
    </div>
  );
}
