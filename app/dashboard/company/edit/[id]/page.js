//file: app/dashboard/company/edit/[id]/page.js
"use client";

import React, { useState, useEffect } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import RoleGuard from "@/components/RoleGuard";

export default function EditCompanyPage({ params }) {
  const unwrappedParams = use(params);
  const companyId = unwrappedParams.id;
  const router = useRouter();
  const [companyData, setCompanyData] = useState({
    company_name: "",
    com_number: "",
    business_number: "",
    insurance_number: "",
    representative_name: "",
    mobile_number: "",
    phone_number: "",
    fax_number: "",
    establishment_date: "",
    address: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchCompanyData() {
      try {
        const { data, error } = await supabase
          .from("companies")
          .select("*")
          .eq("company_id", companyId)
          .single();

        if (error) throw error;

        if (data) {
          // 화면에 표시할 때 포맷팅 적용
          setCompanyData({
            company_name: data.company_name || "",
            business_number: formatBusinessNumber(data.business_number || ""),
            com_number: formatComNumber(data.com_number || ""),
            insurance_number: formatInsuranceNumber(data.insurance_number || ""),
            representative_name: data.representative_name || "",
            mobile_number: formatPhoneNumber(data.mobile_number || ""),
            phone_number: formatPhoneNumber(data.phone_number || ""),
            fax_number: formatPhoneNumber(data.fax_number || ""),
            establishment_date: data.establishment_date
              ? data.establishment_date.split("T")[0]
              : "",
            address: data.address || "",
          });
        }
      } catch (error) {
        console.error("회사 정보 조회 오류:", error);
        setError("회사 정보를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    if (companyId) {
      fetchCompanyData();
    }
  }, [companyId]);

  // 사업자등록번호 포맷팅 (000-00-00000)
  const formatBusinessNumber = (value) => {
    const onlyNums = value.replace(/\D/g, "");
    if (!onlyNums) return "";

    // 10자리 숫자를 3-2-5 형식으로 포맷팅
    if (onlyNums.length <= 3) {
      return onlyNums;
    } else if (onlyNums.length <= 5) {
      return `${onlyNums.slice(0, 3)}-${onlyNums.slice(3)}`;
    } else {
      return `${onlyNums.slice(0, 3)}-${onlyNums.slice(3, 5)}-${onlyNums.slice(5, 10)}`;
    }
  };

  // 사업장관리번호 포맷팅 (000-00-00000-0)
  const formatInsuranceNumber = (value) => {
    const onlyNums = value.replace(/\D/g, "");
    if (!onlyNums) return "";

    // 11자리 숫자를 3-2-5-1 형식으로 포맷팅
    if (onlyNums.length <= 3) {
      return onlyNums;
    } else if (onlyNums.length <= 5) {
      return `${onlyNums.slice(0, 3)}-${onlyNums.slice(3)}`;
    } else if (onlyNums.length <= 10) {
      return `${onlyNums.slice(0, 3)}-${onlyNums.slice(3, 5)}-${onlyNums.slice(5)}`;
    } else {
      return `${onlyNums.slice(0, 3)}-${onlyNums.slice(3, 5)}-${onlyNums.slice(
        5,
        10
      )}-${onlyNums.slice(10, 11)}`;
    }
  };

  // 전화번호 포맷팅
  const formatPhoneNumber = (value) => {
    const onlyNums = value.replace(/\D/g, "");
    if (!onlyNums) return "";

    // 지역번호가 02인 경우 2-3/4-4 형식, 그 외의 경우 3-3/4-4 형식으로 포맷팅
    if (onlyNums.startsWith("02")) {
      // 02로 시작하는 경우
      if (onlyNums.length <= 2) {
        return onlyNums;
      } else if (onlyNums.length <= 6) {
        // 국번이 3자리 또는 4자리인 경우
        return `${onlyNums.slice(0, 2)}-${onlyNums.slice(2)}`;
      } else {
        // 국번이 3자리인 경우
        if (onlyNums.length === 9) {
          return `${onlyNums.slice(0, 2)}-${onlyNums.slice(2, 5)}-${onlyNums.slice(5, 9)}`;
        }
        // 국번이 4자리인 경우
        else {
          return `${onlyNums.slice(0, 2)}-${onlyNums.slice(2, 6)}-${onlyNums.slice(6, 10)}`;
        }
      }
    } else {
      // 그 외의 경우 (010, 031 등)
      if (onlyNums.length <= 3) {
        return onlyNums;
      } else if (onlyNums.length <= 7) {
        return `${onlyNums.slice(0, 3)}-${onlyNums.slice(3)}`;
      } else {
        // 국번이 3자리인 경우
        if (onlyNums.length === 10) {
          return `${onlyNums.slice(0, 3)}-${onlyNums.slice(3, 6)}-${onlyNums.slice(6, 10)}`;
        }
        // 국번이 4자리인 경우
        else {
          return `${onlyNums.slice(0, 3)}-${onlyNums.slice(3, 7)}-${onlyNums.slice(7, 11)}`;
        }
      }
    }
  };

  const formatComNumber = (value) => {
    // 숫자만 남김
    const onlyNums = value.replace(/\D/g, "");

    if (onlyNums.length <= 6) {
      return onlyNums;
    }

    return `${onlyNums.slice(0, 6)}-${onlyNums.slice(6, 13)}`;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;

    // 각 필드에 맞는 포맷팅 적용
    if (name === "business_number") {
      formattedValue = formatBusinessNumber(value);
    } else if (name === "insurance_number") {
      formattedValue = formatInsuranceNumber(value);
    } else if (name === "com_number") {
      formattedValue = formatComNumber(value);
    } else if (["mobile_number", "phone_number", "fax_number"].includes(name)) {
      formattedValue = formatPhoneNumber(value);
    }

    setCompanyData((prev) => ({
      ...prev,
      [name]: formattedValue,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // 저장 시 "-" 제거
      const cleanData = {
        company_name: companyData.company_name,
        business_number: companyData.business_number.replace(/-/g, ""),
        com_number: companyData.com_number.replace(/-/g, ""),
        insurance_number: companyData.insurance_number.replace(/-/g, ""),
        representative_name: companyData.representative_name,
        mobile_number: companyData.mobile_number.replace(/-/g, ""),
        phone_number: companyData.phone_number.replace(/-/g, ""),
        fax_number: companyData.fax_number.replace(/-/g, ""),
        establishment_date: companyData.establishment_date,
        address: companyData.address,
        updated_at: new Date(),
      };

      const { error } = await supabase
        .from("companies")
        .update(cleanData)
        .eq("company_id", companyId);

      if (error) throw error;

      router.push("/dashboard/company");
    } catch (error) {
      console.error("회사 정보 수정 오류:", error);
      setError("회사 정보 수정 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        <span className="ml-3">로딩 중...</span>
      </div>
    );
  }

  return (
    <RoleGuard requiredPermission="EDIT_COMPANIES">
      <div className="w-full mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">회사 정보 수정</h1>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mb-4">
                <label
                  className="block text-gray-700 text-sm font-bold mb-2"
                  htmlFor="company_name"
                >
                  회사명 *
                </label>
                <input
                  id="company_name"
                  name="company_name"
                  type="text"
                  value={companyData.company_name}
                  onChange={handleChange}
                  required
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>

              <div className="mb-4">
                <label
                  className="block text-gray-700 text-sm font-bold mb-2"
                  htmlFor="business_number"
                >
                  사업자등록번호 *
                </label>
                <input
                  id="business_number"
                  name="business_number"
                  type="text"
                  value={companyData.business_number}
                  onChange={handleChange}
                  required
                  placeholder="000-00-00000"
                  maxLength={12} // 하이픈 포함 최대 길이
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="com_number">
                  법인(주민)등록번호 *
                </label>
                <input
                  id="com_number"
                  name="com_number"
                  type="text"
                  value={companyData.com_number}
                  onChange={handleChange}
                  required
                  placeholder="000000-0000000"
                  maxLength={14} // 하이픈 포함 최대 길이
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>
              <div className="mb-4">
                <label
                  className="block text-gray-700 text-sm font-bold mb-2"
                  htmlFor="insurance_number"
                >
                  사업장관리번호 *
                </label>
                <input
                  id="insurance_number"
                  name="insurance_number"
                  type="text"
                  value={companyData.insurance_number}
                  onChange={handleChange}
                  required
                  placeholder="000-00-00000-0"
                  maxLength={14} // 하이픈 포함 최대 길이
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>

              <div className="mb-4">
                <label
                  className="block text-gray-700 text-sm font-bold mb-2"
                  htmlFor="representative_name"
                >
                  대표자명 *
                </label>
                <input
                  id="representative_name"
                  name="representative_name"
                  type="text"
                  value={companyData.representative_name}
                  onChange={handleChange}
                  required
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>

              <div className="mb-4">
                <label
                  className="block text-gray-700 text-sm font-bold mb-2"
                  htmlFor="mobile_number"
                >
                  휴대전화
                </label>
                <input
                  id="mobile_number"
                  name="mobile_number"
                  type="text"
                  value={companyData.mobile_number}
                  onChange={handleChange}
                  placeholder="010-0000-0000"
                  maxLength={13} // 하이픈 포함 최대 길이
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>

              <div className="mb-4">
                <label
                  className="block text-gray-700 text-sm font-bold mb-2"
                  htmlFor="phone_number"
                >
                  전화번호
                </label>
                <input
                  id="phone_number"
                  name="phone_number"
                  type="text"
                  value={companyData.phone_number}
                  onChange={handleChange}
                  placeholder="02-000-0000 "
                  maxLength={13} // 하이픈 포함 최대 길이
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="fax_number">
                  팩스번호
                </label>
                <input
                  id="fax_number"
                  name="fax_number"
                  type="text"
                  value={companyData.fax_number}
                  onChange={handleChange}
                  placeholder="02-000-0000 "
                  maxLength={13} // 하이픈 포함 최대 길이
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>

              <div className="mb-4">
                <label
                  className="block text-gray-700 text-sm font-bold mb-2"
                  htmlFor="establishment_date"
                >
                  성립일 *
                </label>
                <input
                  id="establishment_date"
                  name="establishment_date"
                  type="date"
                  value={companyData.establishment_date}
                  onChange={handleChange}
                  required
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="address">
                주소 *
              </label>
              <input
                id="address"
                name="address"
                type="text"
                value={companyData.address}
                onChange={handleChange}
                required
                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
              />
            </div>

            <div className="flex items-center justify-between mt-6">
              <Link
                href="/dashboard/company"
                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              >
                취소
              </Link>
              <button
                type="submit"
                disabled={saving}
                className={`${
                  saving ? "bg-blue-400" : "bg-blue-500 hover:bg-blue-700"
                } text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 flex items-center`}
              >
                {saving && (
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
                )}
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </RoleGuard>
  );
}
