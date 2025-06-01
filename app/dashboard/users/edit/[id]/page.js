//file: app/dashboard/users/edit/[id]/page.js

"use client";

import React, { useState, useEffect } from "react";
import { use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import RoleGuard from "@/components/RoleGuard";

// 로딩 컴포넌트
const LoadingSpinner = () => (
  <div className="flex justify-center items-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    <span className="ml-3">로딩 중...</span>
  </div>
);

export default function EditUserPage({ params }) {
  // params를 언래핑하여 사용
  const unwrappedParams = use(params);
  const userId = unwrappedParams.id;

  const router = useRouter();
  const [companies, setCompanies] = useState([]);
  const [locationSites, setlocationSites] = useState([]);
  const [selectedSites, setSelectedSites] = useState([]);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    name: "",
    contact_number: "",
    role: "",
    company_id: "",
    status: "",
  });
  const [originalEmail, setOriginalEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchData() {
      try {
        // 병렬로 데이터 조회
        const [companiesResponse, userResponse] = await Promise.all([
          // 회사 목록 조회
          supabase
            .from("companies")
            .select("company_id, company_name, business_number")
            .order("company_name"),

          // 사용자 정보 조회
          supabase.from("users").select("*").eq("id", userId).single(),
        ]);

        // 회사 데이터 처리
        if (companiesResponse.error) throw companiesResponse.error;
        setCompanies(companiesResponse.data || []);

        // 사용자 데이터 처리
        if (userResponse.error) throw userResponse.error;

        if (userResponse.data) {
          const userData = userResponse.data;

          setFormData({
            username: userData.username || "",
            email: userData.email || "",
            name: userData.name || "",
            contact_number: userData.contact_number || "",
            role: userData.role || "user",
            status: userData.status || "active",
            company_id: "",
          });
          setOriginalEmail(userData.email || "");

          // 사용자-회사 연결 정보 조회
          const { data: userCompanyData, error: userCompanyError } = await supabase
            .from("user_companies")
            .select("company_id")
            .eq("user_id", userId)
            .maybeSingle();

          if (!userCompanyError && userCompanyData) {
            setFormData((prev) => ({
              ...prev,
              company_id: userCompanyData.company_id,
            }));

            // 회사 정보가 있으면 해당 회사의 공사현장 목록 조회
            await fetchlocationSites(userCompanyData.company_id);

            // 사용자-현장 연결 정보 조회
            const { data: userSitesData, error: userSitesError } = await supabase
              .from("user_location_sites")
              .select("site_id")
              .eq("user_id", userId)
              .is("removed_date", null);

            if (!userSitesError && userSitesData) {
              // 사용자가 담당하는 현장 ID 목록 설정
              setSelectedSites(userSitesData.map((item) => item.site_id));
            }
          }
        }
      } catch (error) {
        console.error("데이터 조회 오류:", error);
        setError("사용자 정보를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    if (userId) {
      fetchData();
    }
  }, [userId]);

  const fetchlocationSites = async (companyId) => {
    try {
      const { data, error } = await supabase
        .from("location_sites")
        .select("site_id, site_name")
        .eq("company_id", companyId)
        .order("site_name");

      if (error) throw error;
      setlocationSites(data || []);
    } catch (error) {
      console.error("공사현장 목록 조회 오류:", error);
      setError("공사현장 목록을 불러오는 중 오류가 발생했습니다.");
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // 회사가 변경되면 공사현장 목록도 업데이트
    if (name === "company_id" && value) {
      fetchlocationSites(value);
      // 회사가 변경되면 선택된 공사현장 초기화
      setSelectedSites([]);
    }
  };

  const handleSiteSelect = (siteId) => {
    setSelectedSites((prev) => {
      if (prev.includes(siteId)) {
        return prev.filter((id) => id !== siteId);
      } else {
        return [...prev, siteId];
      }
    });
  };

  const handleSelectAllSites = () => {
    if (selectedSites.length === locationSites.length) {
      // 모든 현장이 이미 선택되어 있다면 모두 선택 해제
      setSelectedSites([]);
    } else {
      // 그렇지 않다면 모든 현장 선택
      setSelectedSites(locationSites.map((site) => site.site_id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // 1. 사용자 정보 업데이트
      const { error: updateError } = await supabase
        .from("users")
        .update({
          username: formData.username,
          name: formData.name,
          contact_number: formData.contact_number,
          role: formData.role,
          status: formData.status,
          updated_at: new Date(),
        })
        .eq("id", userId);

      if (updateError) throw updateError;

      // 2. 회사 연결 정보 처리
      if (formData.company_id) {
        // 기존 연결 확인
        const { data: existingLink, error: linkQueryError } = await supabase
          .from("user_companies")
          .select("*")
          .eq("user_id", userId)
          .maybeSingle();

        if (linkQueryError) throw linkQueryError;

        if (existingLink) {
          // 기존 연결 업데이트
          if (existingLink.company_id !== formData.company_id) {
            const { error: updateLinkError } = await supabase
              .from("user_companies")
              .update({
                company_id: formData.company_id,
                updated_at: new Date(),
              })
              .eq("user_id", userId);

            if (updateLinkError) throw updateLinkError;
          }
        } else {
          // 새 연결 생성
          const { error: insertLinkError } = await supabase.from("user_companies").insert({
            user_id: userId,
            company_id: formData.company_id,
            assigned_date: new Date().toISOString().split("T")[0],
            is_active: true,
          });

          if (insertLinkError) throw insertLinkError;
        }

        // 3. 현장 배정 처리
        if (selectedSites.length > 0) {
          // 기존 현장 배정 조회
          const { data: existingSites, error: sitesQueryError } = await supabase
            .from("user_location_sites")
            .select("site_id")
            .eq("user_id", userId)
            .is("removed_date", null);

          if (sitesQueryError) throw sitesQueryError;

          const existingSiteIds = existingSites ? existingSites.map((item) => item.site_id) : [];

          // 삭제할 현장 (기존에 있었지만 현재 선택되지 않은 현장)
          const sitesToRemove = existingSiteIds.filter((id) => !selectedSites.includes(id));

          // 추가할 현장 (새로 선택된 현장)
          const sitesToAdd = selectedSites.filter((id) => !existingSiteIds.includes(id));

          // 삭제 처리 (removed_date 설정)
          if (sitesToRemove.length > 0) {
            const { error: removeError } = await supabase
              .from("user_location_sites")
              .update({ removed_date: new Date().toISOString().split("T")[0] })
              .eq("user_id", userId)
              .in("site_id", sitesToRemove);

            if (removeError) throw removeError;
          }

          // 추가 처리
          if (sitesToAdd.length > 0) {
            const newSiteEntries = sitesToAdd.map((siteId) => ({
              user_id: userId,
              site_id: siteId,
              assigned_date: new Date().toISOString().split("T")[0],
            }));

            const { error: addError } = await supabase
              .from("user_location_sites")
              .insert(newSiteEntries);

            if (addError) throw addError;
          }
        } else {
          // 모든 현장 배정 제거
          const { error: removeAllError } = await supabase
            .from("user_location_sites")
            .update({ removed_date: new Date().toISOString().split("T")[0] })
            .eq("user_id", userId)
            .is("removed_date", null);

          if (removeAllError) throw removeAllError;
        }
      } else {
        // 회사 선택이 없으면 모든 현장 배정도 제거
        const { error: deleteLinkError } = await supabase
          .from("user_companies")
          .delete()
          .eq("user_id", userId);

        if (deleteLinkError) throw deleteLinkError;

        // 모든 현장 배정 제거
        const { error: removeAllSitesError } = await supabase
          .from("user_location_sites")
          .update({ removed_date: new Date().toISOString().split("T")[0] })
          .eq("user_id", userId)
          .is("removed_date", null);

        if (removeAllSitesError) throw removeAllSitesError;
      }

      router.push("/dashboard/users");
    } catch (error) {
      console.error("사용자 정보 수정 오류:", error);
      setError(error.message || "사용자 정보 수정 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <RoleGuard requiredPermission="MANAGE_USERS">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">사용자 정보 수정</h1>
            <Link
              href="/dashboard/users"
              className="text-blue-500 hover:text-blue-700 flex items-center"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 mr-1"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              사용자 목록으로 돌아가기
            </Link>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="username">
                  아이디 *
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
                  이름 *
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
                  이메일
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  disabled
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-500 bg-gray-100 leading-tight"
                />
                <p className="text-xs text-gray-500 mt-1">이메일은 변경할 수 없습니다.</p>
              </div>

              <div className="mb-4">
                <label
                  className="block text-gray-700 text-sm font-bold mb-2"
                  htmlFor="contact_number"
                >
                  연락처
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

              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="role">
                  역할 *
                  {formData.role === "admin" && (
                    <span className="ml-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                      최고 관리자 역할은 변경할 수 없습니다.
                    </span>
                  )}
                </label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                  disabled={formData.role === "admin"}
                  className={`shadow appearance-none border rounded w-full py-2 px-3 leading-tight focus:outline-none focus:shadow-outline ${
                    formData.role === "admin"
                      ? "text-gray-500 bg-gray-100 cursor-not-allowed"
                      : "text-gray-700"
                  }`}
                >
                  <option value="user">일반 사용자</option>
                  <option value="site_manager">현장 관리자</option>
                  <option value="sub_manager">서브 관리자</option>
                  <option value="manager">관리자</option>
                  <option value="admin">최고 관리자</option>
                </select>
                {formData.role === "admin" && (
                  <p className="text-xs text-gray-500 mt-1">
                    보안상 최고 관리자의 역할은 변경할 수 없습니다.
                  </p>
                )}
              </div>

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
                  <option value="active">활성</option>
                  <option value="pending">대기</option>
                  <option value="inactive">비활성</option>
                  <option value="locked">잠금</option>
                </select>
              </div>

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
            </div>

            {/* 담당 공사현장 선택 섹션 */}
            {/* 담당 공사현장 선택 섹션 */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center">
                  <label className="block text-gray-700 text-sm font-bold">담당 공사현장</label>
                  {formData.role === "admin" && (
                    <span className="ml-3 text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                      admin은 선택하지 않아도 전체가 자동배정됩니다.
                    </span>
                  )}
                </div>
                {formData.role !== "admin" && (
                  <button
                    type="button"
                    onClick={handleSelectAllSites}
                    className="text-sm text-blue-500 hover:text-blue-700"
                  >
                    {selectedSites.length === locationSites.length && locationSites.length > 0
                      ? "전체 선택 해제"
                      : "전체 선택"}
                  </button>
                )}
              </div>

              {locationSites.length > 0 ? (
                <div
                  className={`bg-gray-50 p-3 rounded border max-h-60 overflow-y-auto ${
                    formData.role === "admin" ? "opacity-60" : ""
                  }`}
                >
                  {locationSites.map((site) => (
                    <div key={site.site_id} className="mb-2 last:mb-0">
                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          className="form-checkbox h-5 w-5 text-blue-600"
                          checked={
                            formData.role === "admin" ? true : selectedSites.includes(site.site_id)
                          }
                          onChange={() => handleSiteSelect(site.site_id)}
                          disabled={formData.role === "admin"}
                        />
                        <span className="ml-2">{site.site_name}</span>
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 p-3 rounded border text-gray-500 text-center">
                  {formData.company_id
                    ? "등록된 공사현장이 없습니다."
                    : "회사를 선택하면 공사현장 목록이 표시됩니다."}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-6">
              <Link
                href="/dashboard/users"
                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150"
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
