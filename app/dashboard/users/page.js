//file: app/dashboard/users/page.js

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import RoleGuard from "@/components/RoleGuard";
import { useAuthStore } from "@/lib/store/authStore";
import { hasPermission } from "@/lib/permissions";
import useSiteStore from "@/lib/store/siteStore";

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const { user: currentUser } = useAuthStore();
  const [myCompanyId, setMyCompanyId] = useState(null);

  // 같은 회사 사용자 데이터 조회 함수
  const fetchUsersData = async () => {
    try {
      setLoading(true);

      // 1. 현재 사용자의 회사 ID 찾기
      if (!currentUser?.id) {
        setLoading(false);
        return;
      }

      const { data: companyData, error: companyError } = await supabase
        .from("user_companies")
        .select("company_id")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (companyError) throw companyError;

      const companyId = companyData?.company_id;
      setMyCompanyId(companyId);

      if (!companyId) {
        // 회사가 없으면 본인만 표시
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("*")
          .eq("id", currentUser.id);

        if (userError) throw userError;

        // 본인의 관리현장 정보도 조회
        const usersWithSites = await Promise.all(
          (userData || []).map(async (user) => {
            const managedSites = await fetchUserManagedSites(user.id, user.role);
            return {
              ...user,
              managedSites: managedSites,
            };
          })
        );

        setUsers(usersWithSites);
        setLoading(false);
        return;
      }

      // 2. 같은 회사에 속한 사용자 ID 목록 가져오기
      const { data: companyUsers, error: companyUsersError } = await supabase
        .from("user_companies")
        .select("user_id")
        .eq("company_id", companyId);

      if (companyUsersError) throw companyUsersError;

      if (!companyUsers || companyUsers.length === 0) {
        setUsers([]);
        setLoading(false);
        return;
      }

      // 3. 해당 사용자 ID로 사용자 정보 조회
      const userIds = companyUsers.map((item) => item.user_id);

      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("*")
        .in("id", userIds)
        .order("username", { ascending: true });

      if (usersError) throw usersError;

      // 4. 각 사용자의 관리현장 정보 조회
      const usersWithManagedSites = await Promise.all(
        usersData.map(async (user) => {
          const managedSites = await fetchUserManagedSites(user.id, user.role);
          return {
            ...user,
            managedSites: managedSites,
          };
        })
      );

      setUsers(usersWithManagedSites);
      setError(null);
    } catch (error) {
      console.error("사용자 목록 조회 오류:", error);
      setError("사용자 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 사용자의 관리현장 정보를 조회하는 함수 (siteStore 로직 활용)
  const fetchUserManagedSites = async (userId, userRole) => {
    try {
      let sites = [];

      // admin인 경우 회사의 모든 현장 조회 (siteStore의 fetchAllCompanySites 로직 활용)
      if (userRole === "admin") {
        // 사용자의 회사 ID 조회
        const { data: userCompany, error: companyError } = await supabase
          .from("user_companies")
          .select("company_id")
          .eq("user_id", userId)
          .single();

        if (companyError || !userCompany) {
          return [];
        }

        // 회사의 모든 현장 조회
        const { data: adminSites, error: adminSitesError } = await supabase
          .from("location_sites")
          .select("site_id, site_name")
          .eq("company_id", userCompany.company_id)
          .order("site_name");

        if (adminSitesError) throw adminSitesError;

        sites = (adminSites || []).map((site) => site.site_name);
      } else {
        // 일반 사용자는 배정된 현장만 조회 (siteStore의 fetchAssignedSites 로직 활용)
        const { data: userSites, error } = await supabase
          .from("user_location_sites")
          .select(
            `
            site_id,
            assigned_date,
            location_sites (
              site_id,
              site_name
            )
          `
          )
          .eq("user_id", userId)
          .is("removed_date", null)
          .order("location_sites(site_name)");

        if (error) throw error;

        sites = (userSites || [])
          .filter((item) => item.location_sites)
          .map((item) => item.location_sites.site_name);
      }

      return sites;
    } catch (error) {
      console.error(`사용자 ${userId}의 관리현장 조회 오류:`, error);
      return [];
    }
  };

  useEffect(() => {
    fetchUsersData();
  }, [currentUser]);

  async function handleDeleteUser(userId) {
    if (!confirm("정말 이 사용자를 삭제하시겠습니까?")) return;

    try {
      setActionLoading(true);

      // 사용자-현장 연결 삭제
      const { error: siteError } = await supabase
        .from("user_location_sites")
        .delete()
        .eq("user_id", userId);

      if (siteError) {
        console.error("사용자-현장 연결 삭제 오류:", siteError);
      }

      // 사용자-회사 연결 삭제
      const { error: linkError } = await supabase
        .from("user_companies")
        .delete()
        .eq("user_id", userId);

      if (linkError) throw linkError;

      // 사용자 삭제
      const { error: userError } = await supabase.from("users").delete().eq("id", userId);

      if (userError) throw userError;

      // 사용자 목록 업데이트
      setUsers(users.filter((user) => user.id !== userId));
      setSuccessMessage("사용자가 삭제되었습니다.");

      // 3초 후 성공 메시지 제거
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("사용자 삭제 오류:", error);
      setError("사용자 삭제 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  }

  // 사용자 상태 활성화 함수
  async function handleActivateUser(userId) {
    try {
      setActionLoading(true);
      console.log("🔄 활성화 시도 중:", userId);

      const { data, error } = await supabase
        .from("users")
        .update({ status: "active" })
        .eq("id", userId)
        .select("*");

      console.log("✅ 업데이트 결과:", data);
      if (error) {
        console.error("❌ Update 실패:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn("⚠️ 업데이트는 성공했지만, 반환된 데이터 없음");
      }

      // 최신 데이터 반영 위해 전체 목록 다시 조회
      await fetchUsersData();

      setSuccessMessage("사용자가 활성화되었습니다.");
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      console.error("🚨 사용자 활성화 오류:", err);
      setError("사용자 활성화 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  }

  // 현재 사용자가 해당 사용자를 관리할 수 있는지 확인
  const canManageUser = (user) => {
    // 본인은 관리할 수 없음
    if (user.id === currentUser?.id) return false;

    // admin은 같은 회사의 모든 사용자를 관리할 수 있음
    if (currentUser?.role === "admin") {
      // 같은 회사인지 확인 (간접적으로, users 배열에 포함되어 있으면 같은 회사)
      return true;
    }

    // manager는 같은 회사의 일반 사용자와 site_manager를 관리할 수 있음
    if (currentUser?.role === "manager") {
      return ["user", "site_manager", "sub_manager"].includes(user.role);
    }

    // site_manager와 sub_manager는 같은 회사의 일반 사용자만 관리할 수 있음
    if (["site_manager", "sub_manager"].includes(currentUser?.role)) {
      return user.role === "user";
    }

    // 일반 사용자는 관리 권한 없음
    return false;
  };

  // 관리현장 목록을 표시하는 함수
  const formatManagedSites = (managedSites) => {
    if (!managedSites || managedSites.length === 0) {
      return "-";
    }

    if (managedSites.length === 1) {
      return managedSites[0];
    }

    if (managedSites.length <= 3) {
      return managedSites.join(", ");
    }

    // 3개 이상인 경우 처음 2개만 표시하고 나머지는 "외 N개"로 표시
    return `${managedSites.slice(0, 2).join(", ")} 외 ${managedSites.length - 2}개`;
  };

  return (
    <RoleGuard requiredPermission="VIEW_USERS">
      <div className="w-full mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">사용자 관리</h1>
          {hasPermission(currentUser?.role, "MANAGE_USERS") && (
            <Link
              href="/dashboard/users/add"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              사용자 추가
            </Link>
          )}
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            {successMessage}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
            <span className="ml-3">불러오는 중...</span>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    사용자명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    이메일
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    이름
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    역할
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    관리현장
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  {hasPermission(currentUser?.role, "MANAGE_USERS") && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      관리
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-4 whitespace-nowrap">{user.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{user.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{user.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${
                          user.role === "admin"
                            ? "bg-purple-100 text-purple-800"
                            : user.role === "manager"
                            ? "bg-blue-100 text-blue-800"
                            : user.role === "site_manager"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {user.role === "admin"
                          ? "최고 관리자"
                          : user.role === "manager"
                          ? "관리자"
                          : user.role === "site_manager"
                          ? "현장 관리자"
                          : user.role === "sub_manager"
                          ? "서브 관리자"
                          : "일반 사용자"}
                      </span>
                    </td>
                    {/* <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className="text-sm text-gray-900"
                        title={
                          user.managedSites && user.managedSites.length > 3
                            ? user.managedSites.join(", ")
                            : ""
                        }
                      >
                        {formatManagedSites(user.managedSites)}
                      </span>
                    </td> */}
                    <td className="px-6 py-4 ">
                      <span className="text-sm text-gray-900">
                        {user.managedSites && user.managedSites.length > 0
                          ? user.managedSites.join(", ")
                          : "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${
                            user.status === "active"
                              ? "bg-green-100 text-green-800"
                              : user.status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {user.status === "active"
                            ? "활성"
                            : user.status === "pending"
                            ? "대기"
                            : user.status === "inactive"
                            ? "비활성"
                            : "잠금"}
                        </span>

                        {/* 활성화 버튼 - 관리 권한이 있고 사용자가 대기 상태인 경우에만 표시 */}
                        {canManageUser(user) &&
                          user.status === "pending" &&
                          currentUser?.role === "admin" && (
                            <button
                              onClick={() => handleActivateUser(user.id)}
                              disabled={actionLoading}
                              className="ml-2 text-xs px-2 py-1 bg-blue-500 hover:bg-blue-700 text-white rounded"
                            >
                              활성화
                            </button>
                          )}
                      </div>
                    </td>
                    {hasPermission(currentUser?.role, "MANAGE_USERS") && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        {canManageUser(user) ? (
                          <>
                            <Link
                              href={`/dashboard/users/edit/${user.id}`}
                              className="text-indigo-600 hover:text-indigo-900 mr-4"
                            >
                              수정
                            </Link>
                            <button
                              onClick={() => handleDeleteUser(user.id)}
                              disabled={actionLoading}
                              className="text-red-600 hover:text-red-900"
                            >
                              삭제
                            </button>
                          </>
                        ) : user.id === currentUser?.id ? (
                          <Link
                            href={`/dashboard/users/edit/${user.id}`}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            내 정보 수정
                          </Link>
                        ) : (
                          <span className="text-gray-400">권한 없음</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td
                      colSpan={hasPermission(currentUser?.role, "MANAGE_USERS") ? 7 : 6}
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      등록된 사용자가 없습니다.
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
