// file: app\dashboard\reports\insuranceEligibilityLoss
// 4대보험 자격상실신고서
import React from "react";
// import Head from "next/head";

export default function KoreanForm() {
  return (
    <div className="font-sans m-5">
      {/* <Head>
        <title>Korean Form</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head> */}

      {/* Header Section */}
      <div className="mb-5">
        {/* <p>
          ■ 고용보험 및 산업재해보상보험의 보험료징수 등에 관한 법률 시행규칙[별지 제22호의6서식]{" "}
          <span className="text-blue-500">〈개정 2020. 1. 9〉</span>
        </p> */}
      </div>

      {/* Form Title Section */}
      <div className="text-lg font-bold text-center my-4">
        <div className="flex justify-center mb-4 ">
          <div className="inline-block mx-3">국민연금 [ ] 사업장가입자 자격상실신고서</div>
          <div className="inline-block mx-3">건강보험 [ ] 직장가입자 자격상실신고서</div>
        </div>
        <div className="flex justify-center mb-4">
          <div className="inline-block mx-3">고용보험 [ ] 피보험 자격상실신고서</div>
          <div className="inline-block mx-3">산재보험 [ ] 근로자 고용 종료신고서</div>
        </div>
      </div>

      {/* Notice Section */}
      <div className="border border-gray-300 p-3 mb-4 text-sm">
        <p>
          ※ 공통사항 및 작성방법은 뒷쪽을 참고하시기 바라며, 어두운 난은 신청인이 적지 않습니다.
        </p>
        <p>
          ※ 각 보험의 4대 사회보험의 징수 관련업무 따른 국가 사회보험을 징수하여 지정하여 주시기
          바랍니다. <span className="float-right">(앞쪽)</span>
        </p>
      </div>

      {/* Table 1: Business Information */}
      <table className="w-full border-collapse mb-5">
        <tbody>
          <tr>
            <th rowSpan={2} className="border border-gray-300 p-2">
              사업장
            </th>
            <th className="border border-gray-300 p-2">사업장관리번호</th>
            <th className="border border-gray-300 p-2">명칭</th>
            <th className="border border-gray-300 p-2">전화번호</th>
            <th className="border border-gray-300 p-2">팩스번호</th>
          </tr>
          <tr>
            <td colSpan={3} className="border border-gray-300 p-2">
              소재지
            </td>
            <td className="border border-gray-300 p-2">우편번호( )</td>
          </tr>
          <tr>
            <th className="border border-gray-300 p-2">보험사무대행기관</th>
            <td className="border border-gray-300 p-2">명칭</td>
            <td className="border border-gray-300 p-2">번호</td>
            <td colSpan={2} className="border border-gray-300 p-2">
              하수급인 관리번호(건설공사의 하수급인공급관에 한함)
            </td>
          </tr>
        </tbody>
      </table>

      {/* Table 2: Employee Information */}
      <table className="w-full border-collapse mb-5">
        <tbody>
          {/* Header rows */}
          <tr>
            <td rowSpan={4} className="border border-gray-300 p-1 text-center text-sm align-middle">
              일련번호
            </td>
            <td rowSpan={4} className="border border-gray-300 p-1 text-center text-sm align-middle">
              성명
            </td>
            <td rowSpan={4} className="border border-gray-300 p-1 text-center text-sm align-middle">
              주민등록번호
              <br />
              (외국인등록번호·
              <br />
              국내거소신고번호)
            </td>
            <td rowSpan={4} className="border border-gray-300 p-1 text-center text-sm align-middle">
              전화번호
              <br />
              (휴대전화번호)
            </td>
            <td rowSpan={4} className="border border-gray-300 p-1 text-center text-sm align-middle">
              상실
              <br />
              년월일
              <br />
              (YYYY.MM.DD)
            </td>
            <td colSpan={2} className="border border-gray-300 p-1 text-center text-sm">
              국민연금
            </td>
            <td colSpan={5} className="border border-gray-300 p-1 text-center text-sm">
              건강보험
            </td>
            <td colSpan={4} className="border border-gray-300 p-1 text-center text-sm">
              [ ]고용보험 [ ]산재보험
            </td>
          </tr>
          <tr>
            <td rowSpan={3} className="border border-gray-300 p-1 text-center text-sm align-middle">
              상실
              <br />
              부호
            </td>
            <td rowSpan={3} className="border border-gray-300 p-1 text-center text-sm align-middle">
              초일취득ㆍ
              <br />
              당월상실자 <br />
              납부여부
            </td>
            <td rowSpan={3} className="border border-gray-300 p-1 text-center text-sm align-middle">
              상실
              <br />
              부호
            </td>
            <td colSpan={2} className="border border-gray-300 p-1 text-center text-sm">
              해당 연도
            </td>
            <td colSpan={2} className="border border-gray-300 p-1 text-center text-sm">
              전년도
            </td>
            <td colSpan={2} className="border border-gray-300 p-1 text-center text-sm">
              상 실 사 유
            </td>
            <td className="border border-gray-300 p-1 text-center text-sm">해당 연도 보수 총액</td>
            <td className="border border-gray-300 p-1 text-center text-sm">전년도 보수 총액</td>
          </tr>
          <tr>
            <td rowSpan={2} className="border border-gray-300 p-1 text-center text-sm align-middle">
              보수 총액
            </td>
            <td rowSpan={2} className="border border-gray-300 p-1 text-center text-sm align-middle">
              근로
              <br />
              개월수
            </td>
            <td rowSpan={2} className="border border-gray-300 p-1 text-center text-sm align-middle">
              보수 총액
            </td>
            <td rowSpan={2} className="border border-gray-300 p-1 text-center text-sm align-middle">
              근로
              <br />
              개월수
            </td>
            <td rowSpan={2} className="border border-gray-300 p-1 text-center text-sm align-middle">
              구체적 사유
            </td>
            <td rowSpan={2} className="border border-gray-300 p-1 text-center text-sm align-middle">
              구분코드
            </td>
            <td className="border border-gray-300 p-1 text-center text-sm">고용보험</td>
            <td className="border border-gray-300 p-1 text-center text-sm">고용보험</td>
          </tr>
          <tr>
            <td className="border border-gray-300 p-1 text-center text-sm">산재보험</td>
            <td className="border border-gray-300 p-1 text-center text-sm">산재보험</td>
          </tr>

          {/* Data rows */}
          <tr className="bg-white">
            <td className="border border-gray-300 p-1 text-center text-sm">1</td>
            <td className="border border-gray-300 p-1 text-center text-sm">홍길동</td>
            <td className="border border-gray-300 p-1 text-center text-sm">800101-1234567</td>
            <td className="border border-gray-300 p-1 text-center text-sm">010-1234-5678</td>
            <td className="border border-gray-300 p-1 text-center text-sm">2025.04.15</td>
            <td className="border border-gray-300 p-1 text-center text-sm">23</td>
            <td className="border border-gray-300 p-1 text-center text-sm">
              희망
              <br />[ ]
            </td>
            <td className="border border-gray-300 p-1 text-center text-sm">31</td>
            <td className="border border-gray-300 p-1 text-center text-sm">42,000,000</td>
            <td className="border border-gray-300 p-1 text-center text-sm">12</td>
            <td className="border border-gray-300 p-1 text-center text-sm">38,000,000</td>
            <td className="border border-gray-300 p-1 text-center text-sm">12</td>
            <td className="border border-gray-300 p-1 text-center text-sm">개인사정</td>
            <td className="border border-gray-300 p-1 text-center text-sm">03</td>
            <td className="border border-gray-300 p-1 text-center text-sm">42,000,000</td>
            <td className="border border-gray-300 p-1 text-center text-sm">38,000,000</td>
          </tr>
          <tr className="bg-white">
            <td className="border border-gray-300 p-1 text-center text-sm">2</td>
            <td className="border border-gray-300 p-1 text-center text-sm">김철수</td>
            <td className="border border-gray-300 p-1 text-center text-sm">850505-1876543</td>
            <td className="border border-gray-300 p-1 text-center text-sm">010-9876-5432</td>
            <td className="border border-gray-300 p-1 text-center text-sm">2025.04.20</td>
            <td className="border border-gray-300 p-1 text-center text-sm">21</td>
            <td className="border border-gray-300 p-1 text-center text-sm">
              {" "}
              희망
              <br />[ ]
            </td>
            <td className="border border-gray-300 p-1 text-center text-sm">22</td>
            <td className="border border-gray-300 p-1 text-center text-sm">28,500,000</td>
            <td className="border border-gray-300 p-1 text-center text-sm">8</td>
            <td className="border border-gray-300 p-1 text-center text-sm">35,200,000</td>
            <td className="border border-gray-300 p-1 text-center text-sm">12</td>
            <td className="border border-gray-300 p-1 text-center text-sm">계약만료</td>
            <td className="border border-gray-300 p-1 text-center text-sm">01</td>
            <td className="border border-gray-300 p-1 text-center text-sm">28,500,000</td>
            <td className="border border-gray-300 p-1 text-center text-sm">35,200,000</td>
          </tr>
        </tbody>
      </table>

      {/* Footer Section */}
      <div>
        <p>
          접수일자 : &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 처리기간 3일(공통·산재보험은 7일)
        </p>
      </div>
    </div>
  );
}
