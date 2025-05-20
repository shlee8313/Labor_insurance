//file: app/register/company/page.js
// This is a Next.js page component for company registration.

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function CompanyRegisterPage() {
  const router = useRouter();

  const [companyData, setCompanyData] = useState({
    company_name: "",
    business_number: "",
    com_number: "",
    insurance_number: "",
    representative_name: "",
    mobile_number: "",
    phone_number: "",
    fax_number: "",
    establishment_date: "",
    address: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [registrationSuccess, setRegistrationSuccess] = useState(false);

  const handleCompanyChange = (e) => {
    const { name, value } = e.target;
    const formattedValue = formatInput(name, value);
    setCompanyData((prev) => ({
      ...prev,
      [name]: formattedValue,
    }));
  };

  const formatInput = (name, value) => {
    const onlyNums = value.replace(/\D/g, "");

    switch (name) {
      case "business_number":
        // 사업자등록번호: 000-00-00000 (10자리)
        if (onlyNums.length <= 3) {
          return onlyNums;
        } else if (onlyNums.length <= 5) {
          return `${onlyNums.slice(0, 3)}-${onlyNums.slice(3)}`;
        } else {
          return `${onlyNums.slice(0, 3)}-${onlyNums.slice(3, 5)}-${onlyNums.slice(5, 10)}`;
        }
      case "insurance_number":
        return onlyNums.replace(/^(\d{3})(\d{2})(\d{5})(\d{1})?.*/, "$1-$2-$3-$4").slice(0, 16);
      case "mobile_number":
        // 휴대전화: 010-000-0000 또는 010-0000-0000
        if (onlyNums.length <= 3) {
          return onlyNums;
        } else if (onlyNums.length <= 7) {
          // 중간 자리가 3자리 또는 4자리일 수 있음
          return `${onlyNums.slice(0, 3)}-${onlyNums.slice(3)}`;
        } else {
          // 중간 자리가 3자리인 경우
          if (onlyNums.length === 10) {
            return `${onlyNums.slice(0, 3)}-${onlyNums.slice(3, 6)}-${onlyNums.slice(6)}`;
          }
          // 중간 자리가 4자리인 경우
          else {
            return `${onlyNums.slice(0, 3)}-${onlyNums.slice(3, 7)}-${onlyNums.slice(7)}`;
          }
        }
      case "phone_number":
        if (onlyNums.startsWith("02")) {
          return onlyNums.replace(/^(\d{2})(\d{3,4})(\d{4}).*/, "$1-$2-$3").slice(0, 13);
        } else {
          return onlyNums.replace(/^(\d{3})(\d{3,4})(\d{4}).*/, "$1-$2-$3").slice(0, 13);
        }
      case "fax_number":
        if (onlyNums.startsWith("02")) {
          return onlyNums.replace(/^(\d{2})(\d{3,4})(\d{4}).*/, "$1-$2-$3").slice(0, 13);
        } else {
          return onlyNums.replace(/^(\d{3})(\d{3,4})(\d{4}).*/, "$1-$2-$3").slice(0, 13);
        }
      case "com_number":
        // 법인등록번호: 000000-0000000 (13자리)
        if (onlyNums.length <= 6) {
          return onlyNums;
        } else {
          return `${onlyNums.slice(0, 6)}-${onlyNums.slice(6, 13)}`;
        }

      default:
        return value;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: existingCompany } = await supabase
        .from("companies")
        .select("company_id")
        .eq("business_number", companyData.business_number.replace(/-/g, ""))
        .single();

      if (existingCompany) {
        throw new Error("이미 등록된 사업자번호입니다.");
      }

      const cleanData = {
        ...companyData,
        business_number: companyData.business_number.replace(/-/g, ""),
        com_number: companyData.com_number.replace(/-/g, ""),
        insurance_number: companyData.insurance_number.replace(/-/g, ""),
        mobile_number: companyData.mobile_number.replace(/-/g, ""),
        phone_number: companyData.phone_number.replace(/-/g, ""),
        fax_number: companyData.fax_number.replace(/-/g, ""),
      };

      const { data: company, error: companyError } = await supabase
        .from("companies")
        .insert([cleanData])
        .select("company_id")
        .single();

      if (companyError) throw companyError;

      setRegistrationSuccess(true);
      setTimeout(() => {
        router.push(`/register/user?company_id=${company.company_id}`);
      }, 2000);
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">회사 등록</h1>
          <p className="text-gray-600 mt-2">건설 현장 4대보험 관리 시스템에 회사를 등록해주세요.</p>
        </div>

        {registrationSuccess ? (
          <div className="bg-green-100 text-green-700 p-4 rounded mb-6">
            회사 등록이 완료되었습니다. 사용자 등록 페이지로 이동합니다...
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-6">{error}</div>}

            <h2 className="text-xl font-semibold mb-4">회사 정보</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {[
                { id: "company_name", label: "회사명", required: true },
                {
                  id: "business_number",
                  label: "사업자등록번호",
                  required: true,
                  placeholder: "000-00-00000",
                },
                {
                  id: "com_number",
                  label: "법인(주민)등록번호",
                  required: true,
                  placeholder: "000000-0000000",
                },
                {
                  id: "insurance_number",
                  label: "사업장관리번호",
                  required: true,
                  placeholder: "000-00-00000-0",
                },
                { id: "representative_name", label: "대표자명", required: true },
                {
                  id: "mobile_number",
                  label: "휴대전화",
                  required: false,
                  placeholder: "010-0000-0000",
                },
                {
                  id: "phone_number",
                  label: "전화번호",
                  required: false,
                  placeholder: "02-000-0000",
                },
                {
                  id: "fax_number",
                  label: "팩스번호",
                  required: false,
                  placeholder: "02-000-0000",
                },
                { id: "establishment_date", label: "성립일", required: true, type: "date" },
              ].map(({ id, label, required, placeholder, type = "text" }) => (
                <div key={id}>
                  <label className="block text-gray-700 mb-2" htmlFor={id}>
                    {label} {required && <span className="text-red-500">*</span>}
                  </label>
                  <input
                    id={id}
                    name={id}
                    type={type}
                    required={required}
                    placeholder={placeholder}
                    value={companyData[id]}
                    onChange={handleCompanyChange}
                    className="w-full p-2 border rounded"
                  />
                </div>
              ))}
            </div>

            <div className="mb-6">
              <label className="block text-gray-700 mb-2" htmlFor="address">
                주소 <span className="text-red-500">*</span>
              </label>
              <input
                id="address"
                name="address"
                type="text"
                required
                value={companyData.address}
                onChange={handleCompanyChange}
                className="w-full p-2 border rounded"
              />
            </div>

            <div className="flex items-center justify-between mt-8">
              <Link href="/login" className="text-blue-500 hover:text-blue-700">
                로그인 화면으로 돌아가기
              </Link>
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                disabled={loading}
              >
                {loading ? "처리 중..." : "회사 등록하기"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
