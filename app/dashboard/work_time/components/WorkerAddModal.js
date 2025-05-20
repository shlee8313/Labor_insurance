// components/WorkerAddModal.jsx
"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/store/authStore";
import useCodeStore from "@/lib/store/codeStore";
import { Search, X } from "lucide-react";

export default function WorkerAddModal({ isOpen, onClose, siteId, selectedYearMonth, onSuccess }) {
  const { user: currentUser } = useAuthStore();

  // Zustand 코드 스토어 사용
  const { loadCodeTypeIfNeeded, codeMasters } = useCodeStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // 검색어 상태
  const [nationalitySearch, setNationalitySearch] = useState("");
  const [residenceStatusSearch, setResidenceStatusSearch] = useState("");

  // 드롭다운 열림 상태
  const [nationalityDropdownOpen, setNationalityDropdownOpen] = useState(false);
  const [residenceStatusDropdownOpen, setResidenceStatusDropdownOpen] = useState(false);

  // 필터링된 코드 목록 계산
  const filteredNationalityCodes = codeMasters.NATIONALITY
    ? codeMasters.NATIONALITY.filter(
        (code) =>
          code.code_value.toLowerCase().includes(nationalitySearch.toLowerCase()) ||
          code.code_name.toLowerCase().includes(nationalitySearch.toLowerCase())
      )
    : [];

  const filteredResidenceStatusCodes = codeMasters.RESIDENCE_STATUS
    ? codeMasters.RESIDENCE_STATUS.filter(
        (code) =>
          code.code_value.toLowerCase().includes(residenceStatusSearch.toLowerCase()) ||
          code.code_name.toLowerCase().includes(residenceStatusSearch.toLowerCase())
      )
    : [];

  const [formData, setFormData] = useState({
    name: "",
    resident_number: "",
    resident_number_formatted: "",
    nationality_code: "100", // 기본값 한국
    nationality_name: "한국", // 기본값 표시용
    residence_status_code: "",
    residence_status_name: "",
    contact_number: "",
    contact_number_formatted: "",
    address: "",
    worker_type: "daily", // 기본값 일용직
  });

  // 페이지 로드 시 코드 마스터 데이터 로드
  useEffect(() => {
    if (isOpen) {
      // 코드 마스터 데이터 로드
      loadCodeTypeIfNeeded("NATIONALITY");
      loadCodeTypeIfNeeded("RESIDENCE_STATUS");

      // 폼 초기화
      setFormData({
        name: "",
        resident_number: "",
        resident_number_formatted: "",
        nationality_code: "100", // 기본값 한국
        nationality_name: "한국", // 기본값 표시용
        residence_status_code: "",
        residence_status_name: "",
        contact_number: "",
        contact_number_formatted: "",
        address: "",
        worker_type: "daily", // 기본값 일용직
      });
      setError(null);
    }
  }, [isOpen, loadCodeTypeIfNeeded]);

  // 입력 필드 변경 핸들러
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    // 체크박스의 경우 checked 값 사용, 그 외에는 value 사용
    const newValue = type === "checkbox" ? checked : value;

    if (name === "resident_number_formatted") {
      // 주민번호 형식화 (000000-0000000)
      let formatted = value.replace(/[^0-9]/g, ""); // 숫자만 남기기

      if (formatted.length > 6) {
        formatted = formatted.slice(0, 6) + "-" + formatted.slice(6, 13);
      }

      // 최대 14자리 (하이픈 포함)로 제한
      formatted = formatted.slice(0, 14);

      // 원본 값 (하이픈 제거)과 형식화된 값 모두 저장
      setFormData((prev) => ({
        ...prev,
        resident_number: formatted.replace(/-/g, ""),
        resident_number_formatted: formatted,
      }));
      return;
    }

    if (name === "contact_number_formatted") {
      // 전화번호 형식화 (010-0000-0000)
      let formatted = value.replace(/[^0-9]/g, ""); // 숫자만 남기기

      if (formatted.length > 3 && formatted.length <= 7) {
        formatted = formatted.slice(0, 3) + "-" + formatted.slice(3);
      } else if (formatted.length > 7) {
        formatted =
          formatted.slice(0, 3) + "-" + formatted.slice(3, 7) + "-" + formatted.slice(7, 11);
      }

      // 최대 13자리 (하이픈 포함)로 제한
      formatted = formatted.slice(0, 13);

      // 원본 값 (하이픈 제거)과 형식화된 값 모두 저장
      setFormData((prev) => ({
        ...prev,
        contact_number: formatted.replace(/-/g, ""),
        contact_number_formatted: formatted,
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));
  };

  // 국적 선택 핸들러
  const handleNationalitySelect = (code) => {
    setFormData((prev) => ({
      ...prev,
      nationality_code: code.code_value,
      nationality_name: code.code_name,
      // 한국 국적인 경우 체류자격 초기화
      ...(code.code_value === "100"
        ? {
            residence_status_code: "",
            residence_status_name: "",
          }
        : {}),
    }));
    setNationalityDropdownOpen(false);
    setNationalitySearch("");
  };

  // 체류자격 선택 핸들러
  const handleResidenceStatusSelect = (code) => {
    setFormData((prev) => ({
      ...prev,
      residence_status_code: code.code_value,
      residence_status_name: code.code_name,
    }));
    setResidenceStatusDropdownOpen(false);
    setResidenceStatusSearch("");
  };

  // 폼 제출 핸들러
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError(null);

      // 필수 입력값 확인
      if (
        !formData.name ||
        !formData.resident_number ||
        !formData.contact_number ||
        !formData.address
      ) {
        setError("필수 입력 항목을 모두 입력해주세요.");
        return;
      }

      // 주민등록번호 형식 검증 (숫자 13자리)
      const residentNumberRegex = /^\d{13}$/;
      if (!residentNumberRegex.test(formData.resident_number)) {
        setError("주민등록번호는 하이픈(-) 없이 13자리 숫자로 입력해주세요.");
        return;
      }

      // 외국인이면 체류자격 필수
      if (formData.nationality_code !== "100" && !formData.residence_status_code) {
        setError("외국인의 경우 체류자격을 선택해주세요.");
        return;
      }

      // 1. 근로자 정보 등록
      const { data: worker, error: workerError } = await supabase
        .from("workers")
        .insert({
          name: formData.name,
          resident_number: formData.resident_number,
          nationality_code: formData.nationality_code,
          residence_status_code: formData.residence_status_code || null,
          address: formData.address,
          contact_number: formData.contact_number,
          worker_type: formData.worker_type,
        })
        .select()
        .single();

      if (workerError) {
        if (workerError.code === "23505") {
          // 중복 키 오류 (PostgreSQL)
          throw new Error("이미 등록된 주민등록번호입니다.");
        }
        throw workerError;
      }

      // 2. 현장-근로자 연결 (work_records에 초기 레코드 생성)
      const todayDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD 형식

      const { error: recordError } = await supabase.from("work_records").insert({
        worker_id: worker.worker_id,
        site_id: siteId,
        work_date: todayDate,
        work_hours: 0, // 초기값
        work_type: "registration", // 특수 타입: 등록용
        daily_wage: 0, // 초기값
        status: "registration", // 특수 상태: 등록용
        registration_month: selectedYearMonth, // 선택된 년월 저장
      });

      if (recordError) throw recordError;

      // 성공 시 콜백 호출
      if (onSuccess) {
        onSuccess(worker);
      }

      // 모달 닫기
      onClose();
    } catch (error) {
      console.error("근로자 등록 오류:", error);
      setError(error.message || "근로자 등록 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold">신규 근로자 등록</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-200 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 m-4 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* 이름 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                이름 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {/* 주민등록번호 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                주민등록번호/외국인등록번호 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="resident_number_formatted"
                value={formData.resident_number_formatted}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="000000-0000000"
                maxLength={14}
                required
              />
            </div>

            {/* 국적코드 */}
            <div className="dropdown-container relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                국적 <span className="text-red-500">*</span>
              </label>
              <div
                className="border border-gray-300 rounded-md cursor-pointer"
                onClick={() => setNationalityDropdownOpen(!nationalityDropdownOpen)}
              >
                <div className="w-full px-3 py-2 flex justify-between items-center">
                  <span>{formData.nationality_name || "선택하세요"}</span>
                  <span className="ml-2">▼</span>
                </div>
              </div>

              {nationalityDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                  <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        className="w-full pl-8 pr-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="검색..."
                        value={nationalitySearch}
                        onChange={(e) => setNationalitySearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div>
                    {filteredNationalityCodes.length > 0 ? (
                      filteredNationalityCodes.map((code) => (
                        <div
                          key={code.code_value}
                          className={`px-3 py-2 hover:bg-gray-100 cursor-pointer ${
                            formData.nationality_code === code.code_value ? "bg-blue-50" : ""
                          }`}
                          onClick={() => handleNationalitySelect(code)}
                        >
                          <span className="font-medium mr-2">{code.code_name}</span>
                          <span className="text-xs text-gray-500">({code.code_value})</span>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-gray-500">검색 결과가 없습니다</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 체류자격코드 (외국인인 경우) */}
            <div className="dropdown-container relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                체류자격{" "}
                {formData.nationality_code !== "100" && <span className="text-red-500">*</span>}
              </label>
              <div
                className={`border border-gray-300 rounded-md ${
                  formData.nationality_code !== "100"
                    ? "cursor-pointer"
                    : "bg-gray-100 cursor-not-allowed"
                }`}
                onClick={() =>
                  formData.nationality_code !== "100" &&
                  setResidenceStatusDropdownOpen(!residenceStatusDropdownOpen)
                }
              >
                <div className="w-full px-3 py-2 flex justify-between items-center">
                  <span className={formData.nationality_code === "100" ? "text-gray-500" : ""}>
                    {formData.nationality_code === "100"
                      ? "해당 없음"
                      : formData.residence_status_name || "선택하세요"}
                  </span>
                  {formData.nationality_code !== "100" && <span className="ml-2">▼</span>}
                </div>
              </div>

              {residenceStatusDropdownOpen && formData.nationality_code !== "100" && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                  <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        className="w-full pl-8 pr-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                        placeholder="검색..."
                        value={residenceStatusSearch}
                        onChange={(e) => setResidenceStatusSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </div>
                  <div>
                    {filteredResidenceStatusCodes.length > 0 ? (
                      filteredResidenceStatusCodes.map((code) => (
                        <div
                          key={code.code_value}
                          className={`px-3 py-2 hover:bg-gray-100 cursor-pointer ${
                            formData.residence_status_code === code.code_value ? "bg-blue-50" : ""
                          }`}
                          onClick={() => handleResidenceStatusSelect(code)}
                        >
                          <span className="font-medium mr-2">{code.code_name}</span>
                          <span className="text-xs text-gray-500">({code.code_value})</span>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-gray-500">검색 결과가 없습니다</div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 연락처 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                연락처 <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                name="contact_number_formatted"
                value={formData.contact_number_formatted}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="010-0000-0000"
                required
              />
            </div>

            {/* 근로자 유형 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                근로자 유형 <span className="text-red-500">*</span>
              </label>
              <div className="flex space-x-4 mt-1">
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="worker_type"
                    value="daily"
                    checked={formData.worker_type === "daily"}
                    onChange={handleChange}
                    className="form-radio h-4 w-4 text-blue-600"
                  />
                  <span className="ml-2">일용직</span>
                </label>
                <label className="inline-flex items-center">
                  <input
                    type="radio"
                    name="worker_type"
                    value="regular"
                    checked={formData.worker_type === "regular"}
                    onChange={handleChange}
                    className="form-radio h-4 w-4 text-blue-600"
                  />
                  <span className="ml-2">상용직</span>
                </label>
              </div>
            </div>

            {/* 주소 */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                주소 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>

          <div className="flex justify-end space-x-4 mt-6 border-t pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {loading ? "처리 중..." : "등록"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
