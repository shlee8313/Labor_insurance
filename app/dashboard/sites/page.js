//file: app/dashboard/users/page.js
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import RoleGuard from "@/components/RoleGuard";
import { useAuthStore } from "@/lib/store/authStore";
import { hasPermission } from "@/lib/permissions";

export default function SitesPage() {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuthStore();
  const [userCompanyId, setUserCompanyId] = useState(null);

  const formatPhoneNumber = (value) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 11);
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  };
  // First, get the company ID for the logged-in user
  useEffect(() => {
    async function fetchUserCompany() {
      if (!user) return;

      try {
        // Assuming there's a user_companies table that links users to companies
        const { data, error } = await supabase
          .from("user_companies")
          .select("company_id")
          .eq("user_id", user.id)
          .single();

        if (error) throw error;

        if (data) {
          setUserCompanyId(data.company_id);
        }
      } catch (error) {
        console.error("사용자 회사 정보 조회 오류:", error);
        setError("회사 정보를 불러오는 중 오류가 발생했습니다.");
      }
    }

    fetchUserCompany();
  }, [user]);

  // Then, fetch sites filtered by the user's company
  useEffect(() => {
    async function fetchSites() {
      if (!userCompanyId) {
        if (!loading) setLoading(true);
        return; // Wait until we have the company ID
      }

      try {
        let query = supabase
          .from("construction_sites")
          .select("*, company:companies(company_name)")
          .eq("company_id", userCompanyId); // Filter by company ID

        // 현장 관리자는 자신의 현장만 볼 수 있음
        if (user?.role === "site_manager") {
          // 현장 관리자가 담당하는 현장 ID 목록 조회
          const { data: managerSites, error: managerError } = await supabase
            .from("user_construction_sites")
            .select("site_id")
            .eq("user_id", user.id)
            .is("removed_date", null);

          if (managerError) throw managerError;

          if (managerSites && managerSites.length > 0) {
            const siteIds = managerSites.map((item) => item.site_id);
            query = query.in("site_id", siteIds);
          } else {
            // 담당 현장이 없으면 빈 배열 반환
            setSites([]);
            setLoading(false);
            return;
          }
        }

        const { data, error: sitesError } = await query.order("site_name");

        if (sitesError) throw sitesError;
        setSites(data || []);
      } catch (error) {
        console.error("공사현장 목록 조회 오류:", error);
        setError("공사현장 목록을 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    fetchSites();
  }, [user, userCompanyId]);

  async function handleDeleteSite(siteId) {
    if (!confirm("정말 이 공사현장을 삭제하시겠습니까?")) return;

    try {
      setLoading(true);

      // 공사현장 삭제
      const { error } = await supabase.from("construction_sites").delete().eq("site_id", siteId);

      if (error) throw error;

      // 목록에서 제거
      setSites(sites.filter((site) => site.site_id !== siteId));
    } catch (error) {
      console.error("공사현장 삭제 오류:", error);
      alert("공사현장을 삭제하는 중 오류가 발생했습니다. 관련된 데이터가 있을 수 있습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <RoleGuard requiredPermission="VIEW_SITES">
      <div className="w-full mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">공사현장 관리</h1>
          {hasPermission(user?.role, "EDIT_SITES") && (
            <Link
              href="/dashboard/sites/add"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              현장 추가
            </Link>
          )}
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center">불러오는 중...</div>
        ) : (
          <div className="bg-white shadow overflow-hidden rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    현장명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    공사책임자
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    전화번호
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    주소
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    시작일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    종료 예정일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  {hasPermission(user?.role, "EDIT_SITES") && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      관리
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sites.map((site) => (
                  <tr key={site.site_id}>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">{site.site_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{site.construction_manager}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {formatPhoneNumber(site.contact_number)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{site.address}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {site.start_date ? new Date(site.start_date).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {site.end_date ? new Date(site.end_date).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${
                          site.status === "active"
                            ? "bg-green-100 text-green-800"
                            : site.status === "closed"
                            ? "bg-red-100 text-red-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        {site.status === "active"
                          ? "진행중"
                          : site.status === "closed"
                          ? "완료"
                          : site.status === "suspended"
                          ? "중단"
                          : site.status}
                      </span>
                    </td>
                    {hasPermission(user?.role, "EDIT_SITES") && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/dashboard/sites/edit/${site.site_id}`}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          수정
                        </Link>
                        {hasPermission(user?.role, "DELETE_SITES") && (
                          <button
                            onClick={() => handleDeleteSite(site.site_id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            삭제
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {sites.length === 0 && (
                  <tr>
                    <td
                      colSpan={hasPermission(user?.role, "EDIT_SITES") ? 8 : 7}
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      등록된 공사현장이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
