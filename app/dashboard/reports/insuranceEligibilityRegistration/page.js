// file:app\dashboard\reports\insuranceEligibilityRegistration
// 국민연금/건강보험/고용보험 자격취득신고서서
"use client";
// import Head from "next/head";
// import Image from "next/image";
import { useState } from "react";

export default function InsuranceEligibilityRegistration() {
  return (
    <div className="font-sans text-xs m-0 p-5">
      {/* <Head>
        <title>국민연금/건강보험/고용보험 신고 양식</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head> */}

      <div className="flex items-center mb-2.5">
        <div className="w-5 h-5 mr-1.5 relative">
          {/* <Image
            src="/images/document-icon.png"
            alt="문서 아이콘"
            fill
            className="object-contain"
          /> */}
        </div>
        {/* <span className="text-xs">
          고용보험 및 산업재해보상보험의 보험료징수 등에 관한 법률 시행규칙(별지 제22호의5서식){" "}
        </span> */}
      </div>

      <div className="text-center my-4 font-bold text-base">
        국민연금 [ ] 사업장가입자 자격취득 신고서　건강보험 [ ] 직장가입자 자격취득 신고서
        <br />
        고용보험 [ ] 피보험 자격취득 신고서　　　산재보험 [ ] 근로자 고용 신고서
      </div>

      <div className="text-xs mb-4">
        <p className="my-1">
          ※ 공통사항 및 작성방법은 제2쪽을 참고해 주시기 바라며, 색상이 어두운 란은 신고인이 적지
          않습니다.
        </p>
        <p className="my-1">※ [ ]에는 해당되는 곳에 "√" 표시를 합니다.</p>
        <p className="my-1">
          ※ 국민연금의 시설보험 적용의 자격취득일 또는 월 소득액(소득월액, 보수월액, 평균보수액)이
          서로 다른 경우 추가 명단표에 작성나다.
        </p>
      </div>

      <table className="w-full border-collapse border border-gray-300 mb-4">
        <tbody>
          <tr>
            <td
              rowSpan="3"
              className="border border-gray-300 p-1 text-left align-middle text-[10px] text-black"
            >
              사업장
            </td>
            <td className="w-1/4 border border-gray-300 p-1 text-left align-middle text-[10px] text-black relative">
              <span className="block text-gray-500">사업장관리번호</span>
              <input
                type="text"
                className="w-full focus:outline-none text-[12px]"
                // placeholder="사업장관리번호를 입력하세요"
              />
            </td>
            <td className="w-1/4 border border-gray-300 p-1 text-left align-middle text-[10px] text-black relative">
              <span className="block text-gray-500">명칭</span>
              <input
                type="text"
                className="w-full focus:outline-none text-[12px]"
                // placeholder="명칭을 입력하세요"
              />
            </td>
            <td className="w-1/4 border border-gray-300 p-1 text-left align-middle text-[10px] text-black relative">
              <span className="block text-gray-500">단위사업장 명칭</span>
              <input
                type="text"
                className="w-full focus:outline-none text-[12px]"
                // placeholder="단위사업장 명칭을 입력하세요"
              />
            </td>
            <td className="border border-gray-300 p-1 text-left align-middle text-[10px] text-black relative">
              <span className="block text-gray-500">영업소 명칭</span>
              <input
                type="text"
                className="w-full focus:outline-none text-[12px]"
                // placeholder="영업소 명칭을 입력하세요"
              />
            </td>
          </tr>
          <tr>
            <td
              colSpan="3"
              className="border border-gray-300 p-1 text-left align-middle text-[10px] text-black relative"
            >
              <span className="block text-gray-500">소재지</span>
              <input
                type="text"
                className="w-full focus:outline-none text-[12px]"
                // placeholder="소재지를 입력하세요"
              />
            </td>
            <td className="border border-gray-300 p-1 text-left align-middle text-[10px] text-black relative">
              <span className="block text-gray-500">우편번호</span>
              <input
                type="text"
                className="w-full focus:outline-none text-[12px]"
                // placeholder="우편번호를 입력하세요"
              />
            </td>
          </tr>
          <tr>
            <td
              colSpan="2"
              className="border border-gray-300 p-1 text-left align-middle text-[10px] text-black relative"
            >
              <span className="block text-gray-500">전화번호</span>
              <input
                type="tel"
                className="w-full focus:outline-none text-[12px]"
                // placeholder="전화번호를 입력하세요"
              />
            </td>
            <td
              colSpan="2"
              className="border border-gray-300 p-1 text-left align-middle text-[10px] text-black relative"
            >
              <span className="block text-gray-500">팩스번호</span>
              <input
                type="tel"
                className="w-full focus:outline-none text-[12px]"
                // placeholder="팩스번호를 입력하세요"
              />
            </td>
          </tr>
          <tr>
            <td
              rowSpan="2"
              className="border border-gray-300 p-1 text-left align-middle text-[10px] text-black"
            >
              보험사무
              <br />
              대행기관
            </td>
            <td className="border border-gray-300 p-1 text-left align-middle text-[10px] text-black relative">
              <span className="block text-gray-500">번호</span>
              <input
                type="text"
                className="w-full focus:outline-none text-[12px]"
                // placeholder="번호를 입력하세요"
              />
            </td>
            <td className="border border-gray-300 p-1 text-left align-middle text-[10px] text-black relative">
              <span className="block text-gray-500">명칭</span>
              <input
                type="text"
                className="w-full focus:outline-none text-[12px]"
                // placeholder="명칭을 입력하세요"
              />
            </td>
            <td
              colSpan="2"
              className="border border-gray-300 p-1 text-left align-middle text-[10px] text-black relative"
            >
              <span className="block text-gray-500">하수급인 관리번호</span>
              <input
                type="text"
                className="w-full focus:outline-none text-[12px]"
                // placeholder="하수급인 관리번호를 입력하세요"
              />
            </td>
          </tr>
          <tr>
            <td
              colSpan="4"
              className="border border-gray-300 p-1 text-left align-middle text-[10px] text-black relative"
            >
              <span className="block text-gray-500">참고사항</span>
              <input
                type="text"
                className="w-full focus:outline-none text-[12px]"
                // placeholder="참고사항을 입력하세요"
              />
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-50">
            <th
              rowSpan="3"
              className="w-[2%] border border-gray-300  text-center align-middle text-[10px] text-black"
            >
              구분
            </th>
            <th
              rowSpan="2"
              className="w-[6%] border border-gray-300  text-center align-middle text-[10px] text-black"
            >
              성명
            </th>
            <th
              rowSpan="2"
              className="w-[3%] border border-gray-300  text-center align-middle text-[10px] text-black"
            >
              국적
            </th>
            <th
              rowSpan="3"
              className="w-[3%] border border-gray-300  text-center align-middle text-[10px] text-black"
            >
              대표자
              <br />
              여부
            </th>
            <th
              rowSpan="3"
              className="w-[6%] border border-gray-300  text-center align-middle text-[10px] text-black"
            >
              월 소득액
              <br />
              (소득월액·보수월액 <br />
              ·월평균보수액)
            </th>
            <th
              rowSpan="3"
              className="w-[3%] border border-gray-300  text-center align-middle text-[10px] text-black"
            >
              자격
              <br />
              취득일
              <br />
              (YYYY.
              <br />
              MM.DD)
            </th>
            <th
              colSpan="3"
              className="w-[6%] border border-gray-300  text-center align-middle text-[10px] text-black"
            >
              국민연금
            </th>
            <th
              colSpan="4"
              className="w-[6%] border border-gray-300  text-center align-middle text-[10px] text-black"
            >
              건강보험
            </th>
            <th
              colSpan="5"
              className="w-[6%] border border-gray-300  text-center align-middle text-[10px] text-black"
            >
              고용보험·산재보험
            </th>
            <th
              rowSpan="3"
              className="w-[3%] border border-gray-300  text-center align-middle text-[10px] text-black"
            >
              일자리
              <br />
              안정자금
              <br />
              지원 신청
            </th>
          </tr>
          <tr className="bg-gray-50">
            <th
              rowSpan="2"
              className="w-[3%] border border-gray-300  text-center align-middle text-[10px] text-black"
            >
              자격
              <br />
              취득
              <br />
              부호
            </th>
            <th
              rowSpan="2"
              className="w-[3%] border border-gray-300  text-center align-middle text-[10px] text-black"
            >
              종수
              <br />
              부호
            </th>
            <th
              rowSpan="2"
              className="w-[3%] border border-gray-300  text-center align-middle text-[10px] text-black"
            >
              지역
              <br />
              부호
            </th>
            <th
              rowSpan="2"
              className="border border-gray-300  text-center align-middle text-[10px] text-black"
            >
              자격
              <br />
              취득
              <br />
              부호
            </th>
            <th className="border border-gray-300  text-center align-middle text-[10px] text-black">
              보험료
            </th>
            <th
              colSpan="2"
              className="border border-gray-300  text-center align-middle text-[10px] text-black"
            >
              공무원·교직원
            </th>
            <th
              rowSpan="2"
              className="border border-gray-300  text-center align-middle text-[10px] text-black"
            >
              직종
              <br />
              부호
            </th>
            <th
              rowSpan="2"
              className="border border-gray-300  text-center align-middle text-[10px] text-black"
            >
              1주
              <br />
              소정
              <br />
              시간
            </th>
            <th
              rowSpan="2"
              className="border border-gray-300  text-center align-middle text-[10px] text-black"
            >
              계약
              <br />
              종료
              <br />
              연월
              <br />
              (계약직만
              <br />
              작성)
            </th>
            <th
              colSpan="2"
              className="border border-gray-300  text-center align-middle text-[10px] text-black"
            >
              보험료
              <br />
              부과구분
              <br />
              (해당자만
              <br />
              기재)
            </th>
          </tr>
          <tr className="bg-gray-50">
            <th className="border border-gray-300  text-center align-middle text-[10px] text-black">
              주민등록번호
              <br />
              (외국인등록번호,국내거소신고번호)
            </th>
            <th className="border border-gray-300  text-center align-middle text-[10px] text-black">
              체류
              <br />
              자격
            </th>
            <th className="border border-gray-300  text-center align-middle text-[10px] text-black">
              감면
              <br />
              부호
            </th>
            <th className="border border-gray-300  text-center align-middle text-[10px] text-black">
              회계명
              <br />
              /부호
            </th>
            <th className="border border-gray-300  text-center align-middle text-[10px] text-black">
              직종명
              <br />
              /부호
            </th>
            <th className="border border-gray-300  text-center align-middle text-[10px] text-black">
              부호
            </th>
            <th className="border border-gray-300  text-center align-middle text-[10px] text-black">
              사유
            </th>
          </tr>
        </thead>
        <tbody>
          {/* 1번 행 */}
          <tr className="h-4">
            <td
              rowSpan="2"
              className="w-[2%] border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            >
              1
            </td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black">
              이상훈
            </td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black">
              대한민국
            </td>
            <td
              rowSpan="2"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            >
              [ ]예
              <br />[ ]아니오
            </td>
            <td
              rowSpan="2"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            ></td>
            <td
              rowSpan="2"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            ></td>
            <td
              colSpan="3"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            >
              [ ]국민연금
              <br />
              ([ ]취득 월 납부 희망)
            </td>
            <td
              colSpan="4"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            >
              [ ]건강보험
              <br />
              ([ ]피부양자 신청)
            </td>
            <td
              colSpan="5"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            >
              [ ]고용보험(계약직 여부:[ ]예, [ ]아니오)
              <br />[ ]산재보험
            </td>
            <td
              rowSpan="2"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            >
              [ ]예
              <br />[ ]아니오
            </td>
          </tr>
          <tr className="h-4">
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black">
              700426-112
            </td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black">
              F4
            </td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
          </tr>

          {/* 2번 행 */}
          <tr className="h-4">
            <td
              rowSpan="2"
              className="w-[2%] border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            >
              2
            </td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td
              rowSpan="2"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            >
              [ ]예
              <br />[ ]아니오
            </td>
            <td
              rowSpan="2"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            ></td>
            <td
              rowSpan="2"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            ></td>
            <td
              colSpan="3"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            >
              [ ]국민연금
              <br />
              ([ ]취득 월 납부 희망)
            </td>
            <td
              colSpan="4"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            >
              [ ]건강보험
              <br />
              ([ ]피부양자 신청)
            </td>
            <td
              colSpan="5"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            >
              [ ]고용보험(계약직 여부:[ ]예, [ ]아니오)
              <br />[ ]산재보험
            </td>
            <td
              rowSpan="2"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            >
              [ ]예
              <br />[ ]아니오
            </td>
          </tr>
          <tr className="h-4">
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
          </tr>

          {/* 3번 행 */}
          <tr className="h-4">
            <td
              rowSpan="2"
              className="w-[2%] border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            >
              3
            </td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td
              rowSpan="2"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            >
              [ ]예
              <br />[ ]아니오
            </td>
            <td
              rowSpan="2"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            ></td>
            <td
              rowSpan="2"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            ></td>
            <td
              colSpan="3"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            >
              [ ]국민연금
              <br />
              ([ ]취득 월 납부 희망)
            </td>
            <td
              colSpan="4"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            >
              [ ]건강보험
              <br />
              ([ ]피부양자 신청)
            </td>
            <td
              colSpan="5"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            >
              [ ]고용보험(계약직 여부:[ ]예, [ ]아니오)
              <br />[ ]산재보험
            </td>
            <td
              rowSpan="2"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            >
              [ ]예
              <br />[ ]아니오
            </td>
          </tr>
          <tr className="h-4">
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
          </tr>

          {/* 4번 행 */}
          <tr className="h-4">
            <td
              rowSpan="2"
              className="w-[2%] border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            >
              4
            </td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td
              rowSpan="2"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            >
              [ ]예
              <br />[ ]아니오
            </td>
            <td
              rowSpan="2"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            ></td>
            <td
              rowSpan="2"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            ></td>
            <td
              colSpan="3"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            >
              [ ]국민연금
              <br />
              ([ ]취득 월 납부 희망)
            </td>
            <td
              colSpan="4"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            >
              [ ]건강보험
              <br />
              ([ ]피부양자 신청)
            </td>
            <td
              colSpan="5"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            >
              [ ]고용보험(계약직 여부:[ ]예, [ ]아니오)
              <br />[ ]산재보험
            </td>
            <td
              rowSpan="2"
              className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"
            >
              [ ]예
              <br />[ ]아니오
            </td>
          </tr>
          <tr className="h-4">
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
            <td className="border border-gray-300 p-1 text-center align-middle text-[10px] text-black"></td>
          </tr>
        </tbody>
      </table>

      <div className="mt-2.5 text-left">위와 같이 자격취득을 신고합니다.</div>

      <div className="mt-2.5 text-right">
        <span className="mr-5">년</span>
        <span className="mr-5">월</span>
        <span>일</span>
      </div>

      <div className="mt-5 text-center">
        신고인(사용자 · 대표자) <span className="ml-24">(서명 또는 인)</span> / [ ] 보험사무대행기관{" "}
        <span className="ml-24">(서명 또는 인)</span>
      </div>

      <div className="mt-5 text-center font-bold">
        국민연금공단 이사장/국민건강보험공단 이사장/근로복지공단 ○○지역본부(지사)장 귀하
      </div>
    </div>
  );
}
