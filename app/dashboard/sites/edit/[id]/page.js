//file: app/dashboard/sites/[id]/edit/page.js

"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import RoleGuard from "@/components/RoleGuard";
import { useAuthStore } from "@/lib/store/authStore";
import useSiteStore from "@/lib/store/siteStore";

export default function EditSitePage() {
  const router = useRouter();
  const params = useParams();
  const siteId = params.id;
  const { user: currentUser } = useAuthStore();
  const siteStore = useSiteStore();
  const [currentCompany, setCurrentCompany] = useState(null);

  const [formData, setFormData] = useState({
    company_id: "",
    site_name: "",
    site_number: "",
    address: "",
    contact_number: "",
    contract_start_date: "",
    end_date: "",
    report_date: "",
    site_manager: "",
    manager_job_description: "",
    manager_resident_number: "",
    manager_position: "",
    manager_phone_number: "",
    status: "active",
    industrial_accident_rate: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const formatResidentId = (value) => {
    if (!value) return "";
    const cleaned = value.replace(/\D/g, "").slice(0, 13);
    return cleaned.length > 6 ? `${cleaned.slice(0, 6)}-${cleaned.slice(6)}` : cleaned;
  };

  const formatPhoneNumber = (value) => {
    if (!value) return "";
    const cleaned = value.replace(/\D/g, "").slice(0, 11);
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  };

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        // Fetch current user's company info
        if (currentUser) {
          const { data: userCompany, error: userCompanyError } = await supabase
            .from("user_companies")
            .select("company:companies(*)")
            .eq("user_id", currentUser.id)
            .maybeSingle();

          if (userCompanyError) throw userCompanyError;

          if (userCompany?.company) {
            setCurrentCompany(userCompany.company);
            // Set company ID in form data
            setFormData((prev) => ({
              ...prev,
              company_id: userCompany.company.company_id,
            }));
          }
        }

        // Fetch site details
        if (siteId) {
          const { data: siteData, error: siteError } = await supabase
            .from("location_sites")
            .select("*")
            .eq("site_id", siteId)
            .single();

          if (siteError) throw siteError;

          if (siteData) {
            setFormData({
              company_id: siteData.company_id || "",
              site_name: siteData.site_name || "",
              site_number: siteData.site_number || "",
              address: siteData.address || "",
              contact_number: formatPhoneNumber(siteData.contact_number) || "",
              contract_start_date: siteData.contract_start_date
                ? siteData.contract_start_date.split("T")[0]
                : "",
              end_date: siteData.end_date ? siteData.end_date.split("T")[0] : "",
              report_date: siteData.report_date ? siteData.report_date.split("T")[0] : "",
              site_manager: siteData.site_manager || "",
              manager_job_description: siteData.manager_job_description || "",
              manager_resident_number: formatResidentId(siteData.manager_resident_number) || "",
              manager_position: siteData.manager_position || "",
              manager_phone_number: formatPhoneNumber(siteData.manager_phone_number) || "",
              status: siteData.status || "active",
              industrial_accident_rate: siteData.industrial_accident_rate?.toString() || "",
            });
          }
        }
      } catch (error) {
        console.error("데이터 조회 오류:", error);
        setError("공사현장 정보를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [siteId, currentUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === "manager_resident_number") {
      formattedValue = formatResidentId(value);
    } else if (name === "contact_number") {
      formattedValue = formatPhoneNumber(value);
    } else if (name === "manager_phone_number") {
      formattedValue = formatPhoneNumber(value);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: formattedValue,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      if (!formData.company_id) {
        throw new Error("회사 정보가 설정되지 않았습니다. 관리자에게 문의하세요.");
      }

      // 저장 전에 하이픈 제거
      const cleanedResidentNumber = formData.manager_resident_number
        ? formData.manager_resident_number.replace(/-/g, "")
        : null;

      const cleanedContactNumber = formData.contact_number
        ? formData.contact_number.replace(/-/g, "")
        : null;

      const cleanedManagerNumber = formData.manager_phone_number
        ? formData.manager_phone_number.replace(/-/g, "")
        : null;

      // 현장 정보 업데이트
      const { error: updateError } = await supabase
        .from("location_sites")
        .update({
          company_id: formData.company_id,
          site_name: formData.site_name,
          site_number: formData.site_number || null,
          address: formData.address,
          contact_number: cleanedContactNumber,
          contract_start_date: formData.contract_start_date || null,
          end_date: formData.end_date || null,
          report_date: formData.report_date || null,
          site_manager: formData.site_manager,
          manager_job_description: formData.manager_job_description || null,
          manager_resident_number: cleanedResidentNumber,
          manager_position: formData.manager_position || null,
          manager_phone_number: cleanedManagerNumber || null,
          status: formData.status,
          industrial_accident_rate: formData.industrial_accident_rate
            ? parseFloat(formData.industrial_accident_rate)
            : null,
          updated_at: new Date().toISOString(),
        })
        .eq("site_id", siteId);

      if (updateError) throw updateError;

      // siteStore 캐시 무효화 및 재로드
      try {
        // siteStore 상태 초기화 후 다시 로드
        siteStore.resetStore();

        // 현재 사용자 기준으로 사이트 목록 다시 초기화
        await siteStore.initialize(currentUser.id);

        console.log("siteStore 캐시 갱신 완료");
      } catch (storeError) {
        console.error("siteStore 갱신 오류:", storeError);
        // 스토어 갱신 실패해도 현장 수정은 성공했으므로 계속 진행
      }

      // workTimeStore 캐시도 무효화 (필요한 경우)
      try {
        // workTimeStore가 사용 중이라면 캐시 무효화
        const workTimeStore = require("@/lib/store/workTimeStore").default;
        if (workTimeStore && typeof workTimeStore.getState === "function") {
          // workTimeStore의 sites 목록 갱신
          workTimeStore.getState().initialize?.(currentUser.id);
          console.log("workTimeStore 캐시 갱신 완료");
        }
      } catch (workStoreError) {
        console.error("workTimeStore 갱신 오류:", workStoreError);
        // 선택적 갱신이므로 실패해도 무시
      }

      router.push("/dashboard/sites");
    } catch (error) {
      console.error("공사현장 수정 오류:", error);
      setError(error.message || "공사현장 정보 수정 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="flex items-center">
          <svg
            className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500"
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
          <span>로딩 중...</span>
        </div>
      </div>
    );
  }

  return (
    <RoleGuard requiredPermission="EDIT_SITES">
      <div className="w-full mx-auto px-4">
        <div className="w-full">
          {/* 현재 접속 회사 정보 표시 */}
          {currentCompany && (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    현재 접속 회사: <span className="font-bold">{currentCompany.company_name}</span>
                    {currentUser?.role === "admin" && (
                      <span className="ml-2 text-blue-600">(관리자 - 모든 현장 자동 접근)</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          <h1 className="text-2xl font-bold">현장 정보 수정</h1>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pb-8 mb-4">
            <div className="p-6 w-full">
              {/* 기본정보 섹션 */}
              <div className="mb-8 p-6 bg-white shadow-md rounded-lg">
                <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">기본정보</h2>
                <div className="grid grid-cols-4 gap-4">
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
                      현장 연락처
                    </label>
                    <input
                      id="contact_number"
                      name="contact_number"
                      type="text"
                      value={formData.contact_number}
                      onChange={handleChange}
                      placeholder="예: 010-1234-5678"
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
              <div className="mb-8 px-6 pb-2 bg-white shadow-md rounded-lg">
                <h2 className="text-xl font-bold mb-4 text-gray-800 border-b pb-2">진행사항</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="mb-4">
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
                      htmlFor="contract_start_date"
                    >
                      시작일
                    </label>
                    <input
                      id="contract_start_date"
                      name="contract_start_date"
                      type="date"
                      value={formData.contract_start_date}
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
                  <div className="mb-4">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="site_manager"
                    >
                      공사책임자 *
                    </label>
                    <input
                      id="site_manager"
                      name="site_manager"
                      type="text"
                      value={formData.site_manager}
                      onChange={handleChange}
                      required
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
                      htmlFor="manager_phone_number"
                    >
                      공사책임자 연락처
                    </label>
                    <input
                      id="manager_phone_number"
                      name="manager_phone_number"
                      type="text"
                      value={formData.manager_phone_number}
                      onChange={handleChange}
                      placeholder="예: 010-1234-5678"
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

            <div className="flex items-center justify-end mt-2">
              <Link
                href="/dashboard/sites"
                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 mx-10 rounded focus:outline-none focus:shadow-outline"
              >
                취소
              </Link>
              <button
                type="submit"
                disabled={saving || !formData.company_id}
                className={`${
                  saving || !formData.company_id ? "bg-blue-400" : "bg-blue-500 hover:bg-blue-700"
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
