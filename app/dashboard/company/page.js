//file: app/dashboard/company/page.js
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import RoleGuard from "@/components/RoleGuard";
import { useAuthStore } from "@/lib/store/authStore";
import { hasPermission } from "@/lib/permissions";

// 번호 형식 지정 함수
function formatBusinessNumber(num) {
  if (!num || num.length !== 10) return num;
  return `${num.slice(0, 3)}-${num.slice(3, 5)}-${num.slice(5)}`;
}

function formatInsuranceNumber(num) {
  if (!num || num.length !== 11) return num;
  return `${num.slice(0, 3)}-${num.slice(3, 5)}-${num.slice(5, 10)}-${num.slice(10)}`;
}

function formatPhoneNumber(num) {
  if (!num) return num;

  const onlyDigits = num.replace(/\D/g, "");

  // 02 지역번호 (2자리)
  if (onlyDigits.startsWith("02")) {
    if (onlyDigits.length === 10) {
      // 예: 02-330-3300 (3자리 중간번호)
      return `${onlyDigits.slice(0, 2)}-${onlyDigits.slice(2, 5)}-${onlyDigits.slice(5)}`;
    } else if (onlyDigits.length === 11) {
      // 예: 02-3300-3300 (4자리 중간번호)
      return `${onlyDigits.slice(0, 2)}-${onlyDigits.slice(2, 6)}-${onlyDigits.slice(6)}`;
    }
  } else {
    // 그 외 지역번호 (3자리)
    if (onlyDigits.length === 10) {
      // 예: 042-330-3300 (3자리 중간번호)
      return `${onlyDigits.slice(0, 3)}-${onlyDigits.slice(3, 6)}-${onlyDigits.slice(6)}`;
    } else if (onlyDigits.length === 11) {
      // 예: 042-3300-3300 (4자리 중간번호)
      return `${onlyDigits.slice(0, 3)}-${onlyDigits.slice(3, 7)}-${onlyDigits.slice(7)}`;
    }
  }

  // 포맷이 맞지 않으면 원본 반환
  return num;
}

export default function CompanyListPage() {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuthStore();

  useEffect(() => {
    async function fetchCompanies() {
      try {
        if (!user) {
          setCompanies([]);
          return;
        }

        let companiesQuery;

        // 관리자 (admin)인 경우에도 자신과 관련된 회사만 표시
        if (user.role === "admin") {
          // user_companies 테이블을 통해 사용자와 관련된 회사 정보를 조회
          const { data: userCompanies, error: userCompaniesError } = await supabase
            .from("user_companies")
            .select("company_id")
            .eq("user_id", user.id);

          if (userCompaniesError) throw userCompaniesError;

          // 사용자와 관련된 회사가 있는 경우
          if (userCompanies && userCompanies.length > 0) {
            const companyIds = userCompanies.map((uc) => uc.company_id);

            const { data, error } = await supabase
              .from("companies")
              .select("*")
              .in("company_id", companyIds)
              .order("company_name");

            if (error) throw error;
            setCompanies(data || []);
          } else {
            // 사용자와 관련된 회사가 없는 경우
            setCompanies([]);
          }
        } else {
          // 다른 역할의 사용자는 자신과 관련된 회사만 볼 수 있음
          const { data: userCompanies, error: userCompaniesError } = await supabase
            .from("user_companies")
            .select("company_id")
            .eq("user_id", user.id);

          if (userCompaniesError) throw userCompaniesError;

          if (userCompanies && userCompanies.length > 0) {
            const companyIds = userCompanies.map((uc) => uc.company_id);

            const { data, error } = await supabase
              .from("companies")
              .select("*")
              .in("company_id", companyIds)
              .order("company_name");

            if (error) throw error;
            setCompanies(data || []);
          } else {
            setCompanies([]);
          }
        }
      } catch (error) {
        console.error("회사 목록 조회 오류:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchCompanies();
  }, [user]);

  return (
    <RoleGuard requiredPermission="VIEW_COMPANIES">
      <div className="w-full mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">회사 관리</h1>
          {/* {hasPermission(user?.role, "EDIT_COMPANIES") && (
            <Link
              href="/company/register"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              회사 등록
            </Link>
          )} */}
        </div>

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
                    회사명
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    사업자등록번호
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    사업장관리번호
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    대표자
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    연락처
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    성립일
                  </th>
                  {hasPermission(user?.role, "EDIT_COMPANIES") && (
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      관리
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {companies.map((company) => (
                  <tr key={company.company_id}>
                    <td className="px-6 py-4 whitespace-nowrap">{company.company_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {formatBusinessNumber(company.business_number)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {formatInsuranceNumber(company.insurance_number)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">{company.representative_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {formatPhoneNumber(company.phone_number) || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {company.establishment_date
                        ? new Date(company.establishment_date).toLocaleDateString()
                        : "-"}
                    </td>
                    {hasPermission(user?.role, "EDIT_COMPANIES") && (
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link
                          href={`/dashboard/company/edit/${company.company_id}`}
                          className="text-indigo-600 hover:text-indigo-900 mr-4"
                        >
                          수정
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
                {companies.length === 0 && (
                  <tr>
                    <td
                      colSpan={hasPermission(user?.role, "EDIT_COMPANIES") ? 7 : 6}
                      className="px-6 py-4 text-center text-gray-500"
                    >
                      등록된 회사가 없습니다.
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
