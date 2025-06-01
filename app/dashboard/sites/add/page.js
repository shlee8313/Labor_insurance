//file: app/dashboard/sites/add/page.js

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import RoleGuard from "@/components/RoleGuard";
import { useAuthStore } from "@/lib/store/authStore";
import useSiteStore from "@/lib/store/siteStore";

export default function AddSitePage() {
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const siteStore = useSiteStore();
  const [currentCompany, setCurrentCompany] = useState(null);
  const [formData, setFormData] = useState({
    company_id: "",
    site_name: "",
    site_number: "", // 단위사업장기호
    address: "",
    contact_number: "",
    start_date: "",
    end_date: "",
    // report_date: "",
    site_manager: "",
    manager_job_description: "",
    manager_resident_number: "",
    manager_position: "",
    manager_phone_number: "",
    status: "active",
    industrial_accident_rate: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const formatResidentId = (value) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 13);
    return cleaned.length > 6 ? `${cleaned.slice(0, 6)}-${cleaned.slice(6)}` : cleaned;
  };

  const formatPhoneNumber = (value) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 11);
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  };

  useEffect(() => {
    async function fetchCurrentCompany() {
      try {
        if (currentUser) {
          // 현재 사용자의 회사 정보 조회
          const { data: userCompany, error: userCompanyError } = await supabase
            .from("user_companies")
            .select("company:companies(*)")
            .eq("user_id", currentUser.id)
            .maybeSingle();

          if (userCompanyError) throw userCompanyError;

          if (userCompany?.company) {
            setCurrentCompany(userCompany.company);
            // 회사 ID를 폼 데이터에 설정
            setFormData((prev) => ({
              ...prev,
              company_id: userCompany.company.company_id,
            }));
          }
        }
      } catch (error) {
        console.error("회사 정보 조회 오류:", error);
        setError("회사 정보를 불러오는 중 오류가 발생했습니다.");
      }
    }

    fetchCurrentCompany();
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === "manager_resident_number") {
      formattedValue = formatResidentId(value);
    } else if (name === "contact_number") {
      formattedValue = formatPhoneNumber(value);
    } else if (name == "manager_phone_number") {
      formattedValue = formatPhoneNumber(value);
    }

    setFormData((prev) => ({
      ...prev,
      [name]: formattedValue,
    }));
  };

  // 본사 현장 찾기 또는 생성 함수
  const findOrCreateHeadOfficeSite = async (companyId) => {
    try {
      console.log(`본사 현장 찾기 시작 - 회사 ID: ${companyId}`);

      // 1. 먼저 "본사"라는 이름의 현장을 찾기
      let { data: headOfficeSite, error: findError } = await supabase
        .from("location_sites")
        .select("*")
        .eq("company_id", companyId)
        .eq("site_name", "본사")
        .maybeSingle();

      if (findError && findError.code !== "PGRST116") {
        console.error("본사 현장 검색 오류:", findError);
        throw findError;
      }

      // 2. 본사 현장이 있으면 반환
      if (headOfficeSite) {
        console.log("기존 본사 현장 존재:", headOfficeSite.site_name);
        return headOfficeSite;
      }

      // 3. 본사 현장이 없으면 본사 현장을 자동 생성
      console.log("본사 현장이 없어 자동 생성을 시도합니다.");

      // 회사 정보 조회
      let companyInfo = null;
      try {
        const { data, error: companyError } = await supabase
          .from("companies")
          .select("company_name, address, contact_number, representative_name")
          .eq("company_id", companyId)
          .maybeSingle();

        if (!companyError) {
          companyInfo = data;
        }
      } catch (err) {
        console.log("회사 정보 조회 실패, 기본값 사용:", err);
      }

      // 본사 현장 생성 데이터 준비
      const newSiteData = {
        company_id: companyId,
        site_name: "본사",
        address: companyInfo?.address || "주소 미등록",
        contact_number: companyInfo?.contact_number || "000-0000-0000",
        start_date: new Date().toISOString().split("T")[0],
        site_manager: companyInfo?.representative_name || "관리자",
        status: "active",
      };

      console.log("생성할 본사 현장 데이터:", newSiteData);

      // 본사 현장 생성
      const { data: newHeadOfficeSite, error: createError } = await supabase
        .from("location_sites")
        .insert(newSiteData)
        .select()
        .single();

      if (createError) {
        console.error("본사 현장 생성 오류:", createError);
        throw createError;
      }

      console.log("본사 현장이 자동으로 생성되었습니다:", newHeadOfficeSite);
      return newHeadOfficeSite;
    } catch (error) {
      console.error("본사 현장 처리 상세 오류:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return null;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!formData.company_id) {
        throw new Error("회사 정보가 설정되지 않았습니다. 관리자에게 문의하세요.");
      }

      if (!currentUser?.id) {
        throw new Error("사용자 정보를 확인할 수 없습니다.");
      }
      // ✅ 추가된 부분: 본사 현장 확인 및 생성
      console.log("본사 현장 확인 및 생성 시작...");
      const headOfficeSite = await findOrCreateHeadOfficeSite(formData.company_id);
      if (headOfficeSite) {
        console.log(`본사 현장 처리 완료: ${headOfficeSite.site_name}`);
      } else {
        console.warn("본사 현장 생성에 실패했지만 계속 진행합니다.");
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

      // 1. 현장 생성
      const { data: newSite, error: siteError } = await supabase
        .from("location_sites")
        .insert([
          {
            company_id: formData.company_id,
            site_name: formData.site_name,
            site_number: formData.site_number || null,
            address: formData.address,
            contact_number: cleanedContactNumber, // 하이픈 제거된 전화번호
            start_date: formData.start_date || null,
            end_date: formData.end_date || null,
            site_manager: formData.site_manager,
            manager_job_description: formData.manager_job_description || null,
            manager_resident_number: cleanedResidentNumber, // 하이픈 제거된 주민번호
            manager_position: formData.manager_position || null,
            manager_phone_number: cleanedManagerNumber || null,
            status: formData.status,
            industrial_accident_rate: formData.industrial_accident_rate
              ? parseFloat(formData.industrial_accident_rate)
              : null,
          },
        ])
        .select();

      if (siteError) throw siteError;

      const createdSite = newSite[0];
      console.log("새 현장 생성됨:", createdSite);

      // 2. 사용자 역할에 따른 처리
      if (currentUser.role === "admin") {
        // admin은 user_location_sites에 추가하지 않음
        // siteStore의 fetchAllCompanySites 로직으로 자동 접근
        console.log("Admin 사용자: user_location_sites 배정 생략");
      } else {
        // 일반 사용자는 해당 현장에 자동 배정
        // siteStore의 fetchAssignedSites 로직에 따라 배정된 현장만 접근 가능
        const { error: assignmentError } = await supabase.from("user_location_sites").insert([
          {
            user_id: currentUser.id,
            site_id: createdSite.site_id,
            assigned_date: new Date().toISOString().split("T")[0], // 오늘 날짜
          },
        ]);

        if (assignmentError) {
          console.error("현장 배정 오류:", assignmentError);
          // 현장은 생성되었지만 배정에 실패한 경우 경고만 로그
          console.warn("현장 생성은 성공했지만 사용자 배정에 실패했습니다.");
        } else {
          console.log(`일반 사용자 ${currentUser.id}를 현장 ${createdSite.site_id}에 배정 완료`);
        }
      }

      // 3. siteStore 캐시 무효화 및 재로드
      try {
        // siteStore 상태 초기화 후 다시 로드
        siteStore.resetStore();

        // 현재 사용자 기준으로 사이트 목록 다시 초기화
        await siteStore.initialize(currentUser.id);

        console.log("siteStore 캐시 갱신 완료");
      } catch (storeError) {
        console.error("siteStore 갱신 오류:", storeError);
        // 스토어 갱신 실패해도 현장 생성은 성공했으므로 계속 진행
      }

      // 4. workTimeStore 캐시도 무효화 (필요한 경우)
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

      // 5. 성공 처리
      console.log("현장 생성 및 설정 완료, 목록 페이지로 이동");
      router.push("/dashboard/sites");
    } catch (error) {
      console.error("공사현장 추가 오류:", error);
      setError(error.message || "공사현장을 추가하는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleGuard requiredPermission="EDIT_SITES">
      <div className="w-full mx-auto px-4 ">
        <div className="w-full ">
          {/* 현재 접속 회사 정보 표시 (디버깅용 - 필요시 주석 해제) */}
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

          <h1 className="text-2xl font-bold ">현장 추가</h1>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8  pb-8 mb-4">
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
                disabled={loading || !formData.company_id}
                className={`${
                  loading || !formData.company_id ? "bg-blue-400" : "bg-blue-500 hover:bg-blue-700"
                } text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 flex items-center`}
              >
                {loading && (
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
                {loading ? "저장 중..." : "현장 추가"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </RoleGuard>
  );
}
