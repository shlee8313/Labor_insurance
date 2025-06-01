//file: \components\Sidebar.js

//file: app/dashboard/reports/dailyWorkerTime/page.js

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/store/authStore";
// ❌ 제거됨: import { hasPermission } from "@/lib/permissions";

import {
  FaHome,
  FaBuilding,
  FaUsers,
  FaUserCog,
  FaHardHat,
  FaClipboardList,
  FaFileInvoiceDollar,
  FaCog,
  FaSignOutAlt,
  FaChevronDown,
  FaChevronUp,
  FaMoneyCheckAlt,
  FaShieldAlt,
} from "react-icons/fa";
import { supabase } from "@/lib/supabase";

export default function Sidebar({ isOpen, toggle }) {
  const pathname = usePathname();

  // 🎯 authStore에서 hasPermission 가져오기 (캐싱된 버전)
  const { user, clearAuth, hasPermission } = useAuthStore();

  const [companyName, setCompanyName] = useState("");
  const [reportsOpen, setReportsOpen] = useState(false);

  // 페이지 로드 시 현재 경로에 따라 보고서 메뉴 상태 결정
  useEffect(() => {
    if (pathname.startsWith("/dashboard/reports")) {
      setReportsOpen(true);
    }
  }, [pathname]);

  useEffect(() => {
    // 사용자가 로그인한 경우에만 회사 정보를 조회
    if (user?.id) {
      fetchCompanyInfo();
    }
  }, [user?.id]);

  const fetchCompanyInfo = async () => {
    try {
      // 사용자-회사 연결 정보 조회
      const { data: userCompany, error: userCompanyError } = await supabase
        .from("user_companies")
        .select("company:companies(company_name)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!userCompanyError && userCompany?.company) {
        setCompanyName(userCompany.company.company_name);
      }
    } catch (error) {
      console.error("회사 정보 조회 오류:", error);
    }
  };

  const handleLogout = async () => {
    // 로그아웃 로직
    await supabase.auth.signOut();
    clearAuth();
    window.location.href = "/login";
  };

  // 현재 경로가 메뉴 항목의 경로와 일치하는지 확인하는 함수
  const isActiveRoute = (route) => {
    if (route === "/dashboard" && pathname === "/dashboard") {
      return true;
    }
    return pathname.startsWith(route) && route !== "/dashboard";
  };

  // 보고서 메뉴 토글
  const toggleReports = () => {
    setReportsOpen(!reportsOpen);
  };

  return (
    <>
      {/* 모바일 오버레이 */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden" onClick={toggle}></div>
      )}

      {/* 사이드바 */}
      <div
        className={`
        fixed top-0 left-0 h-full bg-gray-800 text-white w-50 z-30
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        lg:static lg:translate-x-0
        overflow-y-auto
      `}
      >
        <div className="p-5 border-b border-gray-700">
          <Link href="/dashboard" className="flex flex-col items-start">
            {companyName && (
              <h2 className="text-lg font-semibold text-gray-200 truncate">{companyName}</h2>
            )}
            <p className="text-sm text-gray-400">일용근로자 관리</p>
          </Link>
        </div>

        <nav className="mt-5">
          <ul>
            {/* <li>
              <Link
                href="/dashboard"
                className={`
                  flex items-center py-3 px-5 text-gray-300 hover:bg-gray-700 hover:text-white
                  ${isActiveRoute("/dashboard") ? "bg-gray-700 text-white" : ""}
                `}
              >
                <FaHome className="mr-3" />
                <span>대시보드</span>
              </Link>
            </li> */}

            {/* 🎯 수정됨: hasPermission(user?.role, "VIEW_SITES") → hasPermission("VIEW_SITES") */}
            {hasPermission("VIEW_SITES") && (
              <li>
                <Link
                  href="/dashboard/sites"
                  className={`
                    flex items-center py-3 px-5 text-gray-300 hover:bg-gray-700 hover:text-white
                    ${isActiveRoute("/dashboard/sites") ? "bg-gray-700 text-white" : ""}
                  `}
                >
                  <FaHardHat className="mr-3" />
                  <span>현장 관리</span>
                </Link>
              </li>
            )}

            {/* 🎯 수정됨: hasPermission(user?.role, "VIEW_WORKERS") → hasPermission("VIEW_WORKERS") */}
            {hasPermission("VIEW_WORKERS") && (
              <li>
                <Link
                  href="/dashboard/workers"
                  className={`
                    flex items-center py-3 px-5 text-gray-300 hover:bg-gray-700 hover:text-white
                    ${isActiveRoute("/dashboard/workers") ? "bg-gray-700 text-white" : ""}
                  `}
                >
                  <FaUserCog className="mr-3" />
                  <span>근로자 관리</span>
                </Link>
              </li>
            )}

            <li>
              <Link
                href="/dashboard/work_time"
                className={`
                  flex items-center py-3 px-5 text-gray-300 hover:bg-gray-700 hover:text-white
                  ${isActiveRoute("/dashboard/work_time") ? "bg-gray-700 text-white" : ""}
                `}
              >
                <FaClipboardList className="mr-3" />
                <span className="text-md">근로내역(시간·임금)</span>
              </Link>
            </li>

            {/* 🎯 수정됨: hasPermission(user?.role, "EDIT_INSURANCE") → hasPermission("EDIT_INSURANCE") */}
            {hasPermission("EDIT_INSURANCE") && (
              <li>
                <Link
                  href="/dashboard/insurance/insurance-enrollments"
                  className={`
                    flex items-center py-3 px-5 text-gray-300 hover:bg-gray-700 hover:text-white
                    ${
                      isActiveRoute("/dashboard/insurance/insurance-enrollments")
                        ? "bg-gray-700 text-white"
                        : ""
                    }
                  `}
                >
                  <FaShieldAlt className="mr-3" />
                  <span>4보험관리</span>
                </Link>
              </li>
            )}

            {/* 🎯 수정됨: hasPermission(user?.role, "EDIT_PAYROLL") → hasPermission("EDIT_PAYROLL") */}
            {hasPermission("EDIT_PAYROLL") && (
              <li>
                <Link
                  href="/dashboard/payroll/daily_worker"
                  className={`
                    flex items-center py-3 px-5 text-gray-300 hover:bg-gray-700 hover:text-white
                    ${
                      isActiveRoute("/dashboard/payroll/daily_worker")
                        ? "bg-gray-700 text-white"
                        : ""
                    }
                  `}
                >
                  <FaMoneyCheckAlt className="mr-3" />
                  <span>일용근로자 급여지급</span>
                </Link>
              </li>
            )}

            {/* 보고서 메뉴 - 드롭다운 */}
            <li>
              <button
                onClick={toggleReports}
                className={`
                  w-full flex items-center justify-between py-3 px-5 text-gray-300 hover:bg-gray-700 hover:text-white
                  ${isActiveRoute("/dashboard/reports") ? "bg-gray-700 text-white" : ""}
                `}
              >
                <div className="flex items-center">
                  <FaFileInvoiceDollar className="mr-3" />
                  <span>신고서</span>
                </div>
                {reportsOpen ? <FaChevronUp /> : <FaChevronDown />}
              </button>

              {/* 보고서 하위 메뉴 */}
              {reportsOpen && (
                <ul className="bg-gray-900">
                  <li>
                    <Link
                      href="/dashboard/reports/dailyWorkerGongdan"
                      className={`
                        flex items-center py-2 px-5 pl-12 text-gray-300 hover:bg-gray-700 hover:text-white
                        ${
                          pathname === "/dashboard/reports/dailyWorkerGongdan"
                            ? "bg-gray-700 text-white"
                            : ""
                        }
                      `}
                    >
                      <span className="text-sm">일용노무비지급명세서</span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/dashboard/reports/dailyWorkerHomeTax"
                      className={`
                        flex items-center py-2 px-5 pl-12 text-gray-300 hover:bg-gray-700 hover:text-white
                        ${
                          pathname === "/dashboard/reports/dailyWorkerHomeTax"
                            ? "bg-gray-700 text-white"
                            : ""
                        }
                      `}
                    >
                      <span className="text-sm">일용근로자소득지급명세서</span>
                    </Link>
                  </li>

                  <li>
                    <Link
                      href="/dashboard/reports/dailyWorkerDetailConfirm"
                      className={`
                        flex items-center py-2 px-5 pl-12 text-gray-300 hover:bg-gray-700 hover:text-white
                        ${
                          pathname === "/dashboard/reports/dailyWorkerDetailConfirm"
                            ? "bg-gray-700 text-white"
                            : ""
                        }
                      `}
                    >
                      <span className="text-sm">근로확인신고서</span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/dashboard/reports/insuranceEligibilityRegistration"
                      className={`
                        flex items-center py-2 px-5 pl-12 text-gray-300 hover:bg-gray-700 hover:text-white
                        ${
                          pathname === "/dashboard/reports/insuranceEligibilityRegistration"
                            ? "bg-gray-700 text-white"
                            : ""
                        }
                      `}
                    >
                      <span className="text-sm">자격취득신고서</span>
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/dashboard/reports/insuranceEligibilityLoss"
                      className={`
                        flex items-center py-2 px-5 pl-12 text-gray-300 hover:bg-gray-700 hover:text-white
                        ${
                          pathname === "/dashboard/reports/insuranceEligibilityLoss"
                            ? "bg-gray-700 text-white"
                            : ""
                        }
                      `}
                    >
                      <span className="text-sm">자격상실실신고서</span>
                    </Link>
                  </li>

                  <li>
                    <Link
                      href="/dashboard/reports/workersCompensationInsuranceReport"
                      className={`
                        flex items-center py-2 px-5 pl-12 text-gray-300 hover:bg-gray-700 hover:text-white
                        ${
                          pathname === "/dashboard/reports/workersCompensationInsuranceReport"
                            ? "bg-gray-700 text-white"
                            : ""
                        }
                      `}
                    >
                      <span className="text-sm">고용·산재 보험료 신고서</span>
                    </Link>
                  </li>
                </ul>
              )}
            </li>

            {/* 🎯 수정됨: hasPermission(user?.role, "EDIT_COMPANIES") → hasPermission("EDIT_COMPANIES") */}
            {hasPermission("EDIT_COMPANIES") && (
              <li>
                <Link
                  href="/dashboard/settings"
                  className={`
                    flex items-center py-3 px-5 text-gray-300 hover:bg-gray-700 hover:text-white
                    ${isActiveRoute("/dashboard/settings") ? "bg-gray-700 text-white" : ""}
                  `}
                >
                  <FaCog className="mr-3" />
                  <span>설정</span>
                </Link>
              </li>
            )}
          </ul>

          {/* 사용자 관리 항목 - nav 안에 있지만 ul 밖에 둬서 아래 배치 */}
          <div className="mt-5 w-full border-t border-gray-700 pt-5">
            <ul>
              {/* 🎯 수정됨: hasPermission(user?.role, "VIEW_USERS") → hasPermission("VIEW_USERS") */}
              {hasPermission("VIEW_USERS") && (
                <li>
                  <Link
                    href="/dashboard/users"
                    className={`flex items-center py-3 px-5 text-gray-300 hover:bg-gray-700 hover:text-white
                  ${isActiveRoute("/dashboard/users") ? "bg-gray-700 text-white" : ""}
                `}
                  >
                    <FaUsers className="mr-3" />
                    <span>사용자 관리</span>
                  </Link>
                </li>
              )}

              {/* 🎯 수정됨: hasPermission(user?.role, "VIEW_COMPANIES") → hasPermission("VIEW_COMPANIES") */}
              {hasPermission("VIEW_COMPANIES") && (
                <li>
                  <Link
                    href="/dashboard/company"
                    className={`
                    flex items-center py-3 px-5 text-gray-300 hover:bg-gray-700 hover:text-white
                    ${isActiveRoute("/dashboard/company") ? "bg-gray-700 text-white" : ""}
                  `}
                  >
                    <FaBuilding className="mr-3" />
                    <span>회사 관리</span>
                  </Link>
                </li>
              )}

              {/* 🎯 수정됨: hasPermission(user?.role, "EDIT_COMPANIES") → hasPermission("EDIT_COMPANIES") */}
              {hasPermission("EDIT_COMPANIES") && (
                <li>
                  <Link
                    href="/dashboard/taxInsuranceRates"
                    className={`
                    flex items-center py-3 px-5 text-gray-300 hover:bg-gray-700 hover:text-white
                    ${isActiveRoute("/dashboard/taxInsuranceRates") ? "bg-gray-700 text-white" : ""}
                  `}
                  >
                    <FaBuilding className="mr-3" />
                    <span>보험료·세율 정보</span>
                  </Link>
                </li>
              )}
            </ul>
          </div>
        </nav>

        <div className="absolute bottom-10 w-full border-t border-gray-700 p-3">
          <div className="flex items-center mb-3 px-2">
            <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-lg font-bold mr-3">
              {user?.name ? user.name.charAt(0) : "?"}
            </div>
            <div>
              <p className="font-medium">{user?.name || "사용자"}</p>
              <p className="text-xs text-gray-400">{user?.email || ""}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded"
          >
            <FaSignOutAlt className="mr-2" />
            <span>로그아웃</span>
          </button>
        </div>
      </div>
    </>
  );
}
