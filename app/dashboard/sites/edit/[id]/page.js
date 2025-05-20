//file: app/dashboard/sites/page.js

"use client";

import React, { useState, useEffect } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import RoleGuard from "@/components/RoleGuard";

export default function EditSitePage({ params }) {
  // const siteId = params.id;
  // const { siteId } = useParams(params.id); // ✅ unwrap the promise
  const unwrappedParams = use(params);
  const siteId = unwrappedParams.id;
  const router = useRouter();
  const [companies, setCompanies] = useState([]);
  const [formData, setFormData] = useState({
    company_id: "",
    site_name: "",
    address: "",
    contact_number: "",
    start_date: "",
    end_date: "",
    report_date: "",
    construction_manager: "",
    manager_job_description: "",
    manager_resident_number: "",
    manager_position: "",
    construction_manager_phone_number: "",
    status: "active",
    industrial_accident_rate: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  // 주민번호 포맷팅 함수 (000000-0000000 형식으로)
  const formatResidentId = (value) => {
    if (!value) return "";
    const cleaned = value.replace(/\D/g, "");
    return cleaned.length > 6 ? `${cleaned.slice(0, 6)}-${cleaned.slice(6)}` : cleaned;
  };

  // 전화번호 포맷팅 함수 (000-0000-0000 형식으로)
  const formatPhoneNumber = (value) => {
    if (!value) return "";
    const cleaned = value.replace(/\D/g, "");
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  };

  useEffect(() => {
    async function fetchData() {
      try {
        // 회사 목록 조회
        const { data: companiesData, error: companiesError } = await supabase
          .from("companies")
          .select("company_id, company_name")
          .order("company_name");

        if (companiesError) throw companiesError;
        setCompanies(companiesData || []);

        // 공사현장 정보 조회
        const { data: siteData, error: siteError } = await supabase
          .from("construction_sites")
          .select("*")
          .eq("site_id", siteId)
          .single();

        if (siteError) throw siteError;

        if (siteData) {
          setFormData({
            company_id: siteData.company_id || "",
            site_name: siteData.site_name || "",
            address: siteData.address || "",
            contact_number: formatPhoneNumber(siteData.contact_number) || "", // 전화번호 포맷팅
            start_date: siteData.start_date ? siteData.start_date.split("T")[0] : "",
            end_date: siteData.end_date ? siteData.end_date.split("T")[0] : "",
            report_date: siteData.report_date ? siteData.report_date.split("T")[0] : "",
            construction_manager: siteData.construction_manager || "",
            manager_job_description: siteData.manager_job_description || "",
            manager_resident_number: formatResidentId(siteData.manager_resident_number) || "", // 주민번호 포맷팅
            construction_manager_phone_number:
              formatPhoneNumber(siteData.construction_manager_phone_number) || "",
            manager_position: siteData.manager_position || "",
            status: siteData.status || "active",
            industrial_accident_rate: siteData.industrial_accident_rate?.toString() || "",
          });
        }
      } catch (error) {
        console.error("데이터 조회 오류:", error);
        setError("공사현장 정보를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    if (siteId) {
      fetchData();
    }
  }, [siteId]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // 주민번호와 전화번호 입력 시 자동으로 포맷팅
    if (name === "manager_resident_number") {
      setFormData((prev) => ({
        ...prev,
        [name]: formatResidentId(value),
      }));
    } else if (name === "contact_number") {
      setFormData((prev) => ({
        ...prev,
        [name]: formatPhoneNumber(value),
      }));
    } else if (name === "construction_manager_phone_number") {
      setFormData((prev) => ({
        ...prev,
        [name]: formatPhoneNumber(value),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // 저장 전에 하이픈 제거
      const cleanedResidentNumber = formData.manager_resident_number
        ? formData.manager_resident_number.replace(/-/g, "")
        : null;

      const cleanedContactNumber = formData.contact_number
        ? formData.contact_number.replace(/-/g, "")
        : null;

      const cleanManagerNumber = formData.construction_manager_phone_number
        ? formData.construction_manager_phone_number.replace(/-/g, "")
        : null;

      const { error } = await supabase
        .from("construction_sites")
        .update({
          company_id: formData.company_id || null,
          site_name: formData.site_name,
          address: formData.address,
          contact_number: cleanedContactNumber, // 하이픈 제거된 전화번호
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
          report_date: formData.report_date || null,
          construction_manager: formData.construction_manager,
          manager_job_description: formData.manager_job_description || null,
          manager_resident_number: cleanedResidentNumber, // 하이픈 제거된 주민번호
          manager_position: formData.manager_position || null,
          construction_manager_phone_number: cleanManagerNumber,
          status: formData.status,
          industrial_accident_rate: formData.industrial_accident_rate
            ? parseFloat(formData.industrial_accident_rate)
            : null,
          updated_at: new Date(),
        })
        .eq("site_id", siteId);

      if (error) throw error;

      router.push("/dashboard/sites");
    } catch (error) {
      console.error("공사현장 수정 오류:", error);
      setError("공사현장 정보 수정 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">로딩 중...</div>;
  }

  return (
    <RoleGuard requiredPermission="EDIT_SITES">
      <div className="w-full mx-auto px-4 ">
        <div className="w-full mx-auto">
          <h1 className="text-2xl font-bold mb-6">현장 정보 수정</h1>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8  pb-8 mb-4">
            <div className="p-6 w-full mx-auto">
              {/* 기본정보 섹션 */}
              <div className="mb-8 p-6 bg-white shadow-md rounded-lg">
                <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">기본정보</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {/* <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="company_id">
              소속 회사
            </label>
            <select
              id="company_id"
              name="company_id"
              value={formData.company_id}
              onChange={handleChange}
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
            >
              <option value="">회사 선택</option>
              {companies.map((company) => (
                <option key={company.company_id} value={company.company_id}>
                  {company.company_name}
                </option>
              ))}
            </select>
          </div> */}

                  <div className="">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="site_name"
                    >
                      현장명 *
                    </label>
                    <input
                      id="site_name"
                      name="site_name"
                      type="text"
                      value={formData.site_name}
                      onChange={handleChange}
                      required
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div className="">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="contact_number"
                    >
                      현장장연락처
                    </label>
                    <input
                      id="contact_number"
                      name="contact_number"
                      type="text"
                      value={formData.contact_number}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div className="">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="site_number"
                    >
                      단위사업장기호
                    </label>
                    <input
                      id="site_number"
                      name="site_number"
                      type="text"
                      value={formData.site_number}
                      onChange={handleChange}
                      placeholder="예: 10원종A호"
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                    <p className="text-gray-500 text-xs mt-1">
                      건강보험 단위사업장기호를 입력하세요 (필수 아님)
                    </p>
                  </div>

                  <div className="">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="industrial_accident_rate"
                    >
                      산재보험요율 (%)
                    </label>
                    <input
                      id="industrial_accident_rate"
                      name="industrial_accident_rate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={formData.industrial_accident_rate}
                      onChange={handleChange}
                      placeholder="예: 3.40"
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="address">
                      주소 *
                    </label>
                    <input
                      id="address"
                      name="address"
                      type="text"
                      value={formData.address}
                      onChange={handleChange}
                      required
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>
                </div>
              </div>

              {/* 진행사항 섹션 */}
              <div className="mb-8 px-6 pb-4 bg-white shadow-md rounded-lg">
                <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">진행사항</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="">
                    <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="status">
                      상태 *
                    </label>
                    <select
                      id="status"
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      required
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    >
                      <option value="active">진행중</option>
                      <option value="suspended">중단</option>
                      <option value="closed">완료</option>
                    </select>
                  </div>

                  <div className="">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="start_date"
                    >
                      시작일
                    </label>
                    <input
                      id="start_date"
                      name="start_date"
                      type="date"
                      value={formData.start_date}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div className="">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="end_date"
                    >
                      종료 예정일
                    </label>
                    <input
                      id="end_date"
                      name="end_date"
                      type="date"
                      value={formData.end_date}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div className="">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="report_date"
                    >
                      신고일
                    </label>
                    <input
                      id="report_date"
                      name="report_date"
                      type="date"
                      value={formData.report_date}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>
                </div>
              </div>

              {/* 책임자 섹션 */}
              <div className="mb-8 px-6 pb-4 bg-white shadow-md rounded-lg">
                <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">책임자</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="construction_manager"
                    >
                      공사책임자 *
                    </label>
                    <input
                      id="construction_manager"
                      name="construction_manager"
                      type="text"
                      value={formData.construction_manager}
                      onChange={handleChange}
                      required
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div className="">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="manager_position"
                    >
                      책임자 직위
                    </label>
                    <input
                      id="manager_position"
                      name="manager_position"
                      type="text"
                      value={formData.manager_position}
                      onChange={handleChange}
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div className="">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="manager_resident_number"
                    >
                      책임자 주민번호
                    </label>
                    <input
                      id="manager_resident_number"
                      name="manager_resident_number"
                      type="text"
                      value={formData.manager_resident_number}
                      onChange={handleChange}
                      placeholder="000000-0000000"
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div className="">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="construction_manager_phone_number"
                    >
                      책임자 연락처
                    </label>
                    <input
                      id="construction_manager_phone_number"
                      name="construction_manager_phone_number"
                      type="text"
                      value={formData.construction_manager_phone_number}
                      onChange={handleChange}
                      placeholder="예: 010-1234-5678"
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>

                  <div className="col-span-2">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="manager_job_description"
                    >
                      책임자 직무내용
                    </label>
                    <input
                      id="manager_job_description"
                      name="manager_job_description"
                      type="text"
                      value={formData.manager_job_description}
                      onChange={handleChange}
                      placeholder="예: 공사현장 안전관리 및 감독"
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end ">
              <Link
                href="/dashboard/sites"
                className="bg-gray-500 hover:bg-gray-700 text-white font-bold mx-12 py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              >
                취소
              </Link>
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </RoleGuard>
  );
}
