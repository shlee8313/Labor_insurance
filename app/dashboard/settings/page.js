"use client";

import React, { useState, useEffect } from "react";
import { Search, ChevronDown, ChevronUp, RefreshCw, Clock } from "lucide-react";
import useCodeStore, { CODE_TYPES } from "@/lib/store/codeStore";
import { format } from "date-fns";
import { ko } from "date-fns/locale";

export default function SettingsPage() {
  // Zustand 스토어에서 필요한 상태와 함수 가져오기
  const {
    codeMasters,
    availableCodeTypes,
    lastFetched,
    isLoading,
    error,
    loadAvailableCodeTypes,
    loadCodeTypeIfNeeded,
    invalidateCache,
    getCacheStatus,
  } = useCodeStore();

  // 로컬 UI 상태
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCodeType, setSelectedCodeType] = useState("");
  const [sortConfig, setSortConfig] = useState({
    key: "code_value",
    direction: "ascending",
  });
  const [showCacheInfo, setShowCacheInfo] = useState(false);

  // 초기 로딩 시 사용 가능한 코드 타입 목록 가져오기
  useEffect(() => {
    const initialize = async () => {
      // 사용 가능한 코드 타입이 아직 없는 경우 로드
      if (availableCodeTypes.length === 0) {
        await loadAvailableCodeTypes();
      }

      // 초기 선택값 설정 (사용 가능한 코드 타입이 있으면 첫 번째로)
      if (availableCodeTypes.length > 0 && !selectedCodeType) {
        setSelectedCodeType(availableCodeTypes[0]);
      }
    };

    initialize();
  }, [availableCodeTypes, loadAvailableCodeTypes, selectedCodeType]);

  // 선택된 코드 타입이 변경되면 해당 데이터 로드
  useEffect(() => {
    if (!selectedCodeType) return;

    const loadData = async () => {
      await loadCodeTypeIfNeeded(selectedCodeType);
    };

    loadData();
  }, [selectedCodeType, loadCodeTypeIfNeeded]);

  // 정렬 처리 함수
  const requestSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  // 정렬된 데이터 계산
  const getSortedData = () => {
    if (!selectedCodeType || !codeMasters[selectedCodeType]) {
      return [];
    }

    // 우선 필터링
    let filteredData = [...codeMasters[selectedCodeType]];

    // searchTerm이 있으면 검색 필터링 적용
    if (searchTerm) {
      filteredData = filteredData.filter(
        (item) =>
          (item.code_value && item.code_value.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (item.code_name && item.code_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // 정렬 적용
    if (sortConfig.key) {
      filteredData.sort((a, b) => {
        // null 값 처리
        if (a[sortConfig.key] === null) return sortConfig.direction === "ascending" ? -1 : 1;
        if (b[sortConfig.key] === null) return sortConfig.direction === "ascending" ? 1 : -1;

        // 문자열은 대소문자 구분 없이 비교
        if (typeof a[sortConfig.key] === "string" && typeof b[sortConfig.key] === "string") {
          const valueA = a[sortConfig.key].toLowerCase();
          const valueB = b[sortConfig.key].toLowerCase();

          if (valueA < valueB) {
            return sortConfig.direction === "ascending" ? -1 : 1;
          }
          if (valueA > valueB) {
            return sortConfig.direction === "ascending" ? 1 : -1;
          }
          return 0;
        }

        // 일반적인 비교
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === "ascending" ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === "ascending" ? 1 : -1;
        }
        return 0;
      });
    }

    return filteredData;
  };

  // 정렬 아이콘 렌더링
  const renderSortIcon = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === "ascending" ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  // 코드 타입 변경 핸들러
  const handleCodeTypeChange = (type) => {
    setSelectedCodeType(type);
    setSearchTerm(""); // 코드 타입 변경 시 검색어 초기화
  };

  // 현재 선택된 코드 타입에 대한 데이터 새로고침
  const handleRefresh = async () => {
    if (!selectedCodeType) return;

    // 캐시 무효화 후 새로 로드
    invalidateCache(selectedCodeType);
    await loadCodeTypeIfNeeded(selectedCodeType, true);
  };

  // 마지막 데이터 갱신 시간 표시
  const getLastUpdatedTime = () => {
    if (!selectedCodeType || !lastFetched[selectedCodeType]) {
      return "아직 로드되지 않음";
    }

    try {
      const date = new Date(lastFetched[selectedCodeType]);
      return format(date, "yyyy년 MM월 dd일 HH:mm:ss", { locale: ko });
    } catch (e) {
      return "날짜 형식 오류";
    }
  };

  // 데이터 정렬 및 필터링 적용
  const sortedData = getSortedData();

  // 선택된 코드 타입의 레이블과 설명 가져오기
  const getSelectedTypeInfo = () => {
    if (!selectedCodeType || !CODE_TYPES[selectedCodeType]) {
      return { label: selectedCodeType, description: "" };
    }
    return CODE_TYPES[selectedCodeType];
  };

  const { label: selectedTypeLabel, description: selectedTypeDescription } = getSelectedTypeInfo();

  // 캐시 상태 가져오기
  const cacheStatus = getCacheStatus();

  // 고용산재 부과구분사유 가이드 렌더링
  const renderEmploymentIssueGuide = () => {
    return (
      <div className="overflow-x-auto shadow-md rounded-lg mt-6">
        <div className="bg-white p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-4">고용산재 부과구분사유 안내</h3>
          <p className="mb-4 text-gray-700">
            아래 표는 고용보험과 산재보험의 부과구분 부호(코드)와 그에 따른 부담금 적용 여부 및 대상
            근로자를 정리한 것입니다.
          </p>

          <div className="overflow-x-auto border rounded-lg mb-6">
            <table className="min-w-full bg-white">
              <thead className="bg-gray-100">
                <tr>
                  <th className="py-3 px-4 border text-center" rowSpan="2">
                    부호
                  </th>
                  <th className="py-3 px-4 border text-center" colSpan="4">
                    부담액
                  </th>
                  <th className="py-3 px-4 border text-center" rowSpan="2">
                    대상 근로자
                  </th>
                </tr>
                <tr>
                  <th className="py-3 px-4 border text-center">산재보험</th>
                  <th className="py-3 px-4 border text-center">임금채권보담금</th>
                  <th className="py-3 px-4 border text-center">실업급여</th>
                  <th className="py-3 px-4 border text-center">고용안정직업능력개발</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="py-3 px-4 border text-center font-medium">51</td>
                  <td className="py-3 px-4 border text-center">O</td>
                  <td className="py-3 px-4 border text-center">O</td>
                  <td className="py-3 px-4 border text-center">X</td>
                  <td className="py-3 px-4 border text-center">X</td>
                  <td className="py-3 px-4 border text-left">
                    09. 고용보험 미가입 외국인근로자
                    <br />
                    11. 항운노조원(임금채권부담금 부과대상)
                    <br />
                    03. 현장실습생
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 border text-center font-medium">52</td>
                  <td className="py-3 px-4 border text-center">O</td>
                  <td className="py-3 px-4 border text-center">X</td>
                  <td className="py-3 px-4 border text-center">X</td>
                  <td className="py-3 px-4 border text-center">X</td>
                  <td className="py-3 px-4 border text-left">
                    13. 항운노조원(임금채권부담금 소송승소)
                    <br />
                    24. 시간선택제재택공무원
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 border text-center font-medium">54</td>
                  <td className="py-3 px-4 border text-center">O</td>
                  <td className="py-3 px-4 border text-center">X</td>
                  <td className="py-3 px-4 border text-center">O</td>
                  <td className="py-3 px-4 border text-center">O</td>
                  <td className="py-3 px-4 border text-left">
                    22. 자활근로종사자(급여특례, 자산위계층, 주거급여 · 의료급여 또는 교육급여
                    수급자)
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 border text-center font-medium">55</td>
                  <td className="py-3 px-4 border text-center">X</td>
                  <td className="py-3 px-4 border text-center">X</td>
                  <td className="py-3 px-4 border text-center">O</td>
                  <td className="py-3 px-4 border text-center">O</td>
                  <td className="py-3 px-4 border text-left">
                    05. 국가기관에서 근무하는 청원경찰
                    <br />
                    06. '선원법' 및 '어선원 및 어선 재해보상보험법' 적용자
                    <br />
                    07. 해외파견자
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 border text-center font-medium">56</td>
                  <td className="py-3 px-4 border text-center">X</td>
                  <td className="py-3 px-4 border text-center">X</td>
                  <td className="py-3 px-4 border text-center">O</td>
                  <td className="py-3 px-4 border text-center">X</td>
                  <td className="py-3 px-4 border text-left">
                    01. 봉급직 · 임기제 공무원
                    <br />
                    16. 노조전임자(노조조합 등 급품 지급)
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 border text-center font-medium">57</td>
                  <td className="py-3 px-4 border text-center">X</td>
                  <td className="py-3 px-4 border text-center">X</td>
                  <td className="py-3 px-4 border text-center">O</td>
                  <td className="py-3 px-4 border text-center">X</td>
                  <td className="py-3 px-4 border text-left">
                    14. 시간선택제재공무원, 한시임기제공무원
                  </td>
                </tr>
                <tr>
                  <td className="py-3 px-4 border text-center font-medium">58</td>
                  <td className="py-3 px-4 border text-center">O</td>
                  <td className="py-3 px-4 border text-center">X</td>
                  <td className="py-3 px-4 border text-center">X</td>
                  <td className="py-3 px-4 border text-center">O</td>
                  <td className="py-3 px-4 border text-left">
                    21. 자활근로종사자(생계급여 수급자)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="text-md font-medium text-blue-800 mb-2">참고사항</h4>
            <ul className="list-disc pl-5 space-y-1 text-blue-800">
              <li>위 표에서 "O"는 해당 보험료가 부과됨을, "X"는 부과되지 않음을 의미합니다.</li>
              <li>신고 시 각 근로자의 상황에 맞는 부과구분 부호를 선택해야 합니다.</li>
              <li>정확한 부과구분 부호 적용은 4대보험 처리의 중요한 요소입니다.</li>
              <li>
                부과구분 부호가 변경될 수 있으므로 고용보험 산재보험 토털서비스 최신 정보를
                확인하세요.
              </li>
            </ul>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white min-h-screen p-4 md:p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">코드 설정</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowCacheInfo(!showCacheInfo)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-small rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            <Clock className="h-4 w-4 mr-1" />
            캐시 정보
          </button>
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-small rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
            새로고침
          </button>
        </div>
      </div>

      <p className="text-gray-500 mb-6">
        데이터베이스에 저장된 코드 정보를 조회합니다. 마지막 업데이트: {getLastUpdatedTime()}
      </p>

      {/* 캐시 정보 표시 */}
      {showCacheInfo && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <h3 className="text-md font-small mb-2">캐시 상태</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-small text-gray-500 uppercase">
                    코드 타입
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-small text-gray-500 uppercase">
                    마지막 갱신
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-small text-gray-500 uppercase">
                    경과 시간
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-small text-gray-500 uppercase">
                    상태
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {cacheStatus.map((status) => (
                  <tr key={status.codeType}>
                    <td className="px-3 py-2 text-sm">
                      {CODE_TYPES[status.codeType]?.label || status.codeType}
                    </td>
                    <td className="px-3 py-2 text-sm">{status.lastFetched}</td>
                    <td className="px-3 py-2 text-sm">
                      {status.ageInMinutes !== null ? `${status.ageInMinutes}분 전` : "-"}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <span
                        className={`px-2 py-1 rounded-full text-xs ${
                          status.isValid
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {status.isValid ? "유효" : "만료"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 코드 타입 탭 네비게이션 */}
      <div className="mb-6 border-b border-gray-200 overflow-x-auto">
        <div className="flex whitespace-nowrap">
          {availableCodeTypes.map((type) => (
            <button
              key={type}
              className={`px-2 py-2 font-small ${
                selectedCodeType === type
                  ? "border-b-2 border-blue-500 text-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
              onClick={() => handleCodeTypeChange(type)}
            >
              {CODE_TYPES[type]?.label || type}
            </button>
          ))}
        </div>
      </div>

      {/* 선택된 코드 타입 정보 */}
      {selectedCodeType && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800">{selectedTypeLabel}</h2>
          <p className="text-gray-600 mt-1">{selectedTypeDescription}</p>

          {/* 고용산재 부과구분사유 코드인 경우 탭은 제거 - 테이블을 코드 목록 아래에 직접 표시 */}
        </div>
      )}

      {/* 고용산재 부과구분사유 가이드는 코드 목록 하단에 표시하므로 여기서는 항상 코드 목록 표시 */}
      {
        <>
          {/* 검색 필드 */}
          <div className="mb-6">
            <div className="relative max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="코드 값, 코드명, 설명으로 검색"
                className="w-full pl-10 p-2 border border-gray-300 rounded-md"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-red-700">{error}</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto shadow-md rounded-lg">
                <table className="min-w-full bg-white">
                  <thead className="bg-gray-50">
                    <tr>
                      <th
                        className="px-6 py-3 text-left text-xs font-small text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => requestSort("code_value")}
                      >
                        <div className="flex items-center">
                          코드 값 {renderSortIcon("code_value")}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-small text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => requestSort("code_name")}
                      >
                        <div className="flex items-center">
                          코드명 {renderSortIcon("code_name")}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-small text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => requestSort("description")}
                      >
                        <div className="flex items-center">
                          설명 {renderSortIcon("description")}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-small text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => requestSort("sort_order")}
                      >
                        <div className="flex items-center">
                          정렬순서 {renderSortIcon("sort_order")}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-small text-gray-500 uppercase tracking-wider cursor-pointer"
                        onClick={() => requestSort("is_active")}
                      >
                        <div className="flex items-center">
                          활성상태 {renderSortIcon("is_active")}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {sortedData.length > 0 ? (
                      sortedData.map((code, index) => (
                        <tr
                          key={`${code.code_type}-${code.code_value}-${index}`}
                          className="hover:bg-gray-50"
                        >
                          <td className="px-6 py-4 whitespace-nowrap font-small">
                            {code.code_value}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">{code.code_name}</td>
                          <td className="px-6 py-4 whitespace-normal break-words max-w-xs">
                            {code.description}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">{code.sort_order}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 rounded-full text-xs ${
                                code.is_active
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {code.is_active ? "활성" : "비활성"}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                          표시할 데이터가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* 고용산재 부과구분사유 테이블 */}
              {selectedCodeType === "EMPLOYMENT_INJURY_LEVY_REASON" && (
                <div className="mt-10 overflow-x-auto">
                  <h3 className="text-lg font-semibold mb-4">고용산재 부과구분 부호 안내표</h3>
                  <table className="min-w-full border-collapse">
                    <thead>
                      <tr>
                        <th className="border border-gray-300 bg-gray-100 p-2" rowSpan="2">
                          부호
                        </th>
                        <th className="border border-gray-300 bg-gray-100 p-2" colSpan="4">
                          부담액
                        </th>
                        <th className="border border-gray-300 bg-gray-100 p-2" rowSpan="2">
                          대상 근로자(부과구분사유)
                        </th>
                      </tr>
                      <tr>
                        <th className="border border-gray-300 bg-gray-100 p-2">산재보험</th>
                        <th className="border border-gray-300 bg-gray-100 p-2">임금채권보담금</th>
                        <th className="border border-gray-300 bg-gray-100 p-2">실업급여</th>
                        <th className="border border-gray-300 bg-gray-100 p-2">
                          고용안정직업능력개발
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 p-2 font-medium">51</td>
                        <td className="border border-gray-300 p-2">O</td>
                        <td className="border border-gray-300 p-2">O</td>
                        <td className="border border-gray-300 p-2">X</td>
                        <td className="border border-gray-300 p-2">X</td>
                        <td className="border border-gray-300 p-2 text-left">
                          09.고용보험 미가입, 외국인근로자
                          <br />
                          11.항운노조원(임금채권부담금 부과대상)
                          <br />
                          03.현장실습생
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2 font-medium">52</td>
                        <td className="border border-gray-300 p-2">O</td>
                        <td className="border border-gray-300 p-2">X</td>
                        <td className="border border-gray-300 p-2">X</td>
                        <td className="border border-gray-300 p-2">X</td>
                        <td className="border border-gray-300 p-2 text-left">
                          13.항운노조원(임금채권부담금 소송승소)
                          <br />
                          24.시간선택제재택공무원
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2 font-medium">54</td>
                        <td className="border border-gray-300 p-2">O</td>
                        <td className="border border-gray-300 p-2">X</td>
                        <td className="border border-gray-300 p-2">O</td>
                        <td className="border border-gray-300 p-2">O</td>
                        <td className="border border-gray-300 p-2 text-left">
                          22. 자활근로종사자(급여특례, 자산위계층, 주거급여 · 의료급여 또는 교육급여
                          수급자)
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2 font-medium">55</td>
                        <td className="border border-gray-300 p-2">X</td>
                        <td className="border border-gray-300 p-2">X</td>
                        <td className="border border-gray-300 p-2">O</td>
                        <td className="border border-gray-300 p-2">O</td>
                        <td className="border border-gray-300 p-2 text-left">
                          05.국가기관에서 근무하는 청원경찰
                          <br />
                          06. '선원법' 및 '어선원 및 어선 재해보상보험법' 적용자
                          <br />
                          07.해외파견자
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2 font-medium">56</td>
                        <td className="border border-gray-300 p-2">X</td>
                        <td className="border border-gray-300 p-2">X</td>
                        <td className="border border-gray-300 p-2">O</td>
                        <td className="border border-gray-300 p-2">X</td>
                        <td className="border border-gray-300 p-2 text-left">
                          01.봉급직 · 임기제 공무원
                          <br />
                          16.노조전임자(노조조합 등 급품 처급)
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2 font-medium">57</td>
                        <td className="border border-gray-300 p-2">X</td>
                        <td className="border border-gray-300 p-2">X</td>
                        <td className="border border-gray-300 p-2">O</td>
                        <td className="border border-gray-300 p-2">X</td>
                        <td className="border border-gray-300 p-2 text-left">
                          14.자간선택제재공무원, 한시임기제공무원
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 p-2 font-medium">58</td>
                        <td className="border border-gray-300 p-2">O</td>
                        <td className="border border-gray-300 p-2">X</td>
                        <td className="border border-gray-300 p-2">X</td>
                        <td className="border border-gray-300 p-2">O</td>
                        <td className="border border-gray-300 p-2 text-left">
                          21. 자활근로종사자(생계급여 수급자)
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </>
      }

      <div className="mt-8 p-6 bg-gray-50 rounded-lg shadow-inner">
        <h3 className="text-lg font-small mb-3 text-gray-700">안내사항</h3>
        <ul className="list-disc pl-5 space-y-2 text-gray-600">
          <li>이 페이지는 데이터베이스의 코드 마스터 테이블에서 조회한 정보를 표시합니다.</li>
          <li>코드 정보는 조회만 가능하며, 추가/수정/삭제는 데이터베이스 관리자에게 문의하세요.</li>
          <li>
            데이터는 캐시되어 저장되므로 최신 정보 확인이 필요하면 새로고침 버튼을 사용하세요.
          </li>
          <li>각 컬럼 헤더를 클릭하면 해당 컬럼 기준으로 정렬됩니다.</li>
          <li>
            모든 코드는 업무 처리에 중요한 정보이므로, 코드 정보 변경 시 관련 업무에 미치는 영향을
            반드시 검토해야 합니다.
          </li>
        </ul>
      </div>
    </div>
  );
}
