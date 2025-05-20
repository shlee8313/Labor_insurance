//file: app/dashboard/page.js
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/store/authStore";
import { FaBuilding, FaHardHat, FaUsers, FaFileAlt } from "react-icons/fa";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState({
    companies: 0,
    sites: 0,
    users: 0,
    reports: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        // 회사 수
        const { count: companiesCount, error: companiesError } = await supabase
          .from("companies")
          .select("*", { count: "exact", head: true });

        // 현장 수
        const { count: sitesCount, error: sitesError } = await supabase
          .from("construction_sites")
          .select("*", { count: "exact", head: true });

        // 사용자 수
        const { count: usersCount, error: usersError } = await supabase
          .from("users")
          .select("*", { count: "exact", head: true });

        // 일용근로자신고서 수 (예시)
        const { count: reportsCount, error: reportsError } = await supabase
          .from("daily_work_reports")
          .select("*", { count: "exact", head: true });

        setStats({
          companies: companiesCount || 0,
          sites: sitesCount || 0,
          users: usersCount || 0,
          reports: reportsCount || 0,
        });
      } catch (error) {
        console.error("통계 조회 오류:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">대시보드</h1>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3">환영합니다, {user?.name || "사용자"} 님!</h2>
        <p className="text-gray-600">
          오늘도 좋은 하루 되세요. 아래에서 시스템 현황을 확인하실 수 있습니다.
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center">
            <div className="rounded-full h-12 w-12 flex items-center justify-center bg-blue-100 text-blue-500">
              <FaBuilding size={24} />
            </div>
            <div className="ml-4">
              <h3 className="text-gray-500 text-sm">등록된 회사</h3>
              <p className="text-2xl font-bold">{loading ? "..." : stats.companies}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center">
            <div className="rounded-full h-12 w-12 flex items-center justify-center bg-green-100 text-green-500">
              <FaHardHat size={24} />
            </div>
            <div className="ml-4">
              <h3 className="text-gray-500 text-sm">공사현장</h3>
              <p className="text-2xl font-bold">{loading ? "..." : stats.sites}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center">
            <div className="rounded-full h-12 w-12 flex items-center justify-center bg-purple-100 text-purple-500">
              <FaUsers size={24} />
            </div>
            <div className="ml-4">
              <h3 className="text-gray-500 text-sm">사용자</h3>
              <p className="text-2xl font-bold">{loading ? "..." : stats.users}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center">
            <div className="rounded-full h-12 w-12 flex items-center justify-center bg-yellow-100 text-yellow-500">
              <FaFileAlt size={24} />
            </div>
            <div className="ml-4">
              <h3 className="text-gray-500 text-sm">신고서</h3>
              <p className="text-2xl font-bold">{loading ? "..." : stats.reports}</p>
            </div>
          </div>
        </div>
      </div>

      {/* 최근 활동 및 알림 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-lg">최근 활동</h2>
          </div>
          <div className="p-5">
            {loading ? (
              <p className="text-center py-4 text-gray-500">로딩 중...</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                <li className="py-3">
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mr-3"></div>
                    <p className="text-sm">새로운 근로자가 등록되었습니다.</p>
                    <span className="ml-auto text-xs text-gray-500">2시간 전</span>
                  </div>
                </li>
                <li className="py-3">
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-green-500 mr-3"></div>
                    <p className="text-sm">일용근로자 신고서가 제출되었습니다.</p>
                    <span className="ml-auto text-xs text-gray-500">어제</span>
                  </div>
                </li>
                <li className="py-3">
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-purple-500 mr-3"></div>
                    <p className="text-sm">새로운 현장이 추가되었습니다.</p>
                    <span className="ml-auto text-xs text-gray-500">2일 전</span>
                  </div>
                </li>
              </ul>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-lg">알림 및 할 일</h2>
          </div>
          <div className="p-5">
            {loading ? (
              <p className="text-center py-4 text-gray-500">로딩 중...</p>
            ) : (
              <ul className="divide-y divide-gray-200">
                <li className="py-3">
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-red-500 mr-3"></div>
                    <p className="text-sm">
                      <span className="font-medium">긴급</span>: 4월 일용근로자 신고서를
                      제출해주세요.
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">기한: 2025-04-10</p>
                </li>
                <li className="py-3">
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-yellow-500 mr-3"></div>
                    <p className="text-sm">
                      <span className="font-medium">주의</span>: 2명의 사용자가 이메일 인증을
                      완료하지 않았습니다.
                    </p>
                  </div>
                </li>
                <li className="py-3">
                  <div className="flex items-center">
                    <div className="w-2 h-2 rounded-full bg-blue-500 mr-3"></div>
                    <p className="text-sm">
                      <span className="font-medium">정보</span>: 시스템이 업데이트되었습니다.
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">버전: 1.2.0</p>
                </li>
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
