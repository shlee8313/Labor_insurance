"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import RoleGuard from "@/components/RoleGuard";
import { useAuthStore } from "@/lib/store/authStore";
import useCodeStore from "@/lib/store/codeStore"; // codeStore 임포트
import { hasPermission } from "@/lib/permissions";
import { ToastContainer, toast } from "react-toastify";
import { Search } from "lucide-react"; // Lucide 아이콘 추가

export default function WorkersPage() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const { user: currentUser } = useAuthStore();
  const [userSites, setUserSites] = useState([]);

  // 검색 관련 상태 추가
  const [searchQuery, setSearchQuery] = useState("");
  const [searchType, setSearchType] = useState("name"); // 'name', 'resident_number', 'contact_number'
  const [filteredWorkers, setFilteredWorkers] = useState([]);

  // codeStore에서 국적코드 정보 가져오기 위한 함수들
  const { getCodeList, getCodeInfo } = useCodeStore();
  const [nationalityCodes, setNationalityCodes] = useState({});

  // 삭제 확인 모달 관련 상태 추가
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [workerToDelete, setWorkerToDelete] = useState(null);

  // 삭제 모달 열기
  const openDeleteModal = (workerId, workerName) => {
    setWorkerToDelete({ id: workerId, name: workerName });
    setShowDeleteModal(true);
  };

  // 삭제 확인
  const confirmDelete = async () => {
    if (!workerToDelete) return;

    // 기존 삭제 로직 실행
    await handleDeleteWorker(workerToDelete.id);

    // 모달 닫기
    setShowDeleteModal(false);
    setWorkerToDelete(null);
  };

  // 삭제 취소
  const cancelDelete = () => {
    setShowDeleteModal(false);
    setWorkerToDelete(null);
  };
  // 국적 코드 데이터 로드
  useEffect(() => {
    const loadNationalityCodes = async () => {
      try {
        const codes = await getCodeList("NATIONALITY");
        const codeMap = {};

        codes.forEach((code) => {
          codeMap[code.code_value] = code.code_name;
        });

        setNationalityCodes(codeMap);
      } catch (error) {
        console.error("국적 코드 로드 오류:", error);
      }
    };

    loadNationalityCodes();
  }, [getCodeList]);

  // 근로자 데이터 조회 함수
  const fetchWorkersData = async () => {
    try {
      setLoading(true);

      if (!currentUser?.id) {
        setLoading(false);
        return;
      }

      // 관리자인 경우 특별 처리
      // if (currentUser.role === "admin") {
      // 관리자 회사 ID 조회
      const { data: companyData, error: companyError } = await supabase
        .from("user_companies")
        .select("company_id")
        .eq("user_id", currentUser.id)
        .maybeSingle();

      if (companyError) throw companyError;

      if (companyData?.company_id) {
        // 회사의 모든 현장 ID 조회
        const { data: companySites, error: companySitesError } = await supabase
          .from("location_sites")
          .select("site_id")
          .eq("company_id", companyData.company_id);

        if (companySitesError) throw companySitesError;

        if (companySites && companySites.length > 0) {
          const siteIds = companySites.map((site) => site.site_id);
          setUserSites(siteIds);

          // 회사의 모든 근로자 조회
          const { data: workRecords, error: workRecordsError } = await supabase
            .from("work_records")
            .select("worker_id")
            .in("site_id", siteIds);

          if (workRecordsError) throw workRecordsError;

          if (workRecords && workRecords.length > 0) {
            const workerIds = [...new Set(workRecords.map((record) => record.worker_id))];

            // 근로자 정보 조회
            const { data: workersData, error: workersError } = await supabase
              .from("workers")
              .select("*")
              .in("worker_id", workerIds);

            if (workersError) throw workersError;

            // 근로자에 현장 정보 추가
            // 근로자 데이터에 현장 정보와 등록월 정보 추가
            const workersWithSites = await Promise.all(
              workersData.map(async (worker) => {
                // 각 근로자의 현장 정보 조회
                const { data: workerSites } = await supabase
                  .from("work_records")
                  .select(
                    `
                      site_id,
                      registration_month,
                      location_site:location_sites(
                        site_id, 
                        site_name
                      )
                    `
                  )
                  .eq("worker_id", worker.worker_id);

                // 중복 제거
                const uniqueSites = [];
                const siteIds = new Set();

                // 등록 월 추출 및 중복 제거
                const registrationMonths = new Set();

                if (workerSites) {
                  workerSites.forEach((record) => {
                    // 현장 정보 추가
                    if (record.location_site && !siteIds.has(record.site_id)) {
                      siteIds.add(record.site_id);
                      uniqueSites.push(record.location_site);
                    }

                    // 등록 월 추가
                    if (record.registration_month) {
                      registrationMonths.add(record.registration_month);
                    }
                  });
                }

                // 등록 월을 쉼표로 구분된 문자열로 변환
                const registrationMonthsStr = Array.from(registrationMonths).sort().join(", ");

                return {
                  ...worker,
                  sites: uniqueSites,
                  work_month: registrationMonthsStr, // 이 부분을 추가
                };
              })
            );

            setWorkers(workersWithSites);
            setFilteredWorkers(workersWithSites); // 초기 필터링된 목록 설정
            setLoading(false);
            return;
          }
        }
      }
      // }

      // 1. 현재 사용자에게 할당된 현장 ID 목록 조회
      const { data: sitesData, error: sitesError } = await supabase
        .from("user_location_sites")
        .select("site_id")
        .eq("user_id", currentUser.id)
        .is("removed_date", null);

      if (sitesError) throw sitesError;

      // 할당된 현장이 없는 경우
      if (!sitesData || sitesData.length === 0) {
        setWorkers([]);
        setFilteredWorkers([]);
        setLoading(false);
        return;
      }

      setUserSites(sitesData.map((site) => site.site_id));
      const siteIds = sitesData.map((site) => site.site_id);

      // 2. 현재 사용자의 권한에 따라 근로자 데이터 조회 (여기가 수정된 부분)
      let query;

      if (currentUser.role === "admin") {
        // admin은 회사의 모든 근로자를 볼 수 있음
        const { data: companyData } = await supabase
          .from("user_companies")
          .select("company_id")
          .eq("user_id", currentUser.id)
          .maybeSingle();

        if (companyData?.company_id) {
          // 회사의 모든 현장 찾기
          const { data: companySites } = await supabase
            .from("location_sites")
            .select("site_id")
            .eq("company_id", companyData.company_id);

          if (companySites && companySites.length > 0) {
            const companySiteIds = companySites.map((site) => site.site_id);

            // 회사의 모든 근로자 찾기 (work_records 기반)
            const { data: workRecords } = await supabase
              .from("work_records")
              .select("worker_id")
              .in("site_id", companySiteIds);

            if (workRecords && workRecords.length > 0) {
              const workerIds = [...new Set(workRecords.map((record) => record.worker_id))];

              // 찾은 근로자 목록으로 데이터 조회
              query = supabase.from("workers").select("*").in("worker_id", workerIds);
            } else {
              query = supabase.from("workers").select("*").limit(0); // 빈 결과
            }
          }
        }
      } else {
        // manager, site_manager는 자신의 현장 근로자만 볼 수 있음
        const { data: workRecords } = await supabase
          .from("work_records")
          .select("worker_id")
          .in("site_id", siteIds);

        if (workRecords && workRecords.length > 0) {
          const workerIds = [...new Set(workRecords.map((record) => record.worker_id))];

          query = supabase.from("workers").select("*").in("worker_id", workerIds);
        } else {
          query = supabase.from("workers").select("*").limit(0); // 빈 결과
        }
      }

      // 쿼리 실행 및 결과 처리
      if (query) {
        const { data: workersData, error: workersError } = await query;

        if (workersError) throw workersError;

        // 근로자 데이터에 현장 정보 추가
        const workersWithSites = await Promise.all(
          workersData.map(async (worker) => {
            // 각 근로자의 현장 정보 조회
            const { data: workerSites } = await supabase
              .from("work_records")
              .select(
                `
                site_id,
                location_site:location_sites(
                  site_id, 
                  site_name
                )
              `
              )
              .eq("worker_id", worker.worker_id);

            // 중복 제거
            const uniqueSites = [];
            const siteIds = new Set();

            if (workerSites) {
              workerSites.forEach((record) => {
                if (record.location_site && !siteIds.has(record.site_id)) {
                  siteIds.add(record.site_id);
                  uniqueSites.push(record.location_site);
                }
              });
            }

            return {
              ...worker,
              sites: uniqueSites,
            };
          })
        );

        setWorkers(workersWithSites);
        setFilteredWorkers(workersWithSites); // 초기 필터링된 목록 설정
      } else {
        setWorkers([]);
        setFilteredWorkers([]);
      }

      setError(null);
    } catch (error) {
      console.error("근로자 목록 조회 오류:", error);
      setError("근로자 목록을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkersData();
  }, [currentUser]);

  // 검색 기능 - 검색어 변경 시 필터링
  // 검색 기능 - 검색어 변경 시 필터링
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredWorkers(workers);
      return;
    }

    // 검색어를 소문자로 변환하고 하이픈 제거
    const query = searchQuery.toLowerCase().replace(/-/g, "");

    // 모든 필드에서 검색
    const filtered = workers.filter((worker) => {
      // 이름 검색
      const nameMatch = worker.name?.toLowerCase().includes(query);

      // 주민번호 검색 (하이픈 제거)
      const residentNumber = worker.resident_number?.replace(/-/g, "") || "";
      const residentNumberMatch = residentNumber.includes(query);

      // 연락처 검색 (하이픈 제거)
      const contactNumber = worker.contact_number?.replace(/-/g, "") || "";
      const contactNumberMatch = contactNumber.includes(query);

      // 셋 중 하나라도 일치하면 포함
      return nameMatch || residentNumberMatch || contactNumberMatch;
    });

    setFilteredWorkers(filtered);
  }, [searchQuery, workers]);
  // 검색 핸들러
  const handleSearch = (e) => {
    e.preventDefault();
    // 이미 useEffect에서 필터링이 적용되므로 여기서는 아무것도 하지 않아도 됨
  };

  async function handleDeleteWorker(workerId) {
    try {
      setActionLoading(true);

      // 먼저 실제 근무 기록이 있는지 확인
      const { data: actualWorkRecords, error: checkError } = await supabase
        .from("work_records")
        .select("record_id")
        .eq("worker_id", workerId)
        .neq("status", "registration"); // 'registration'이 아닌 레코드만 조회 (실제 근무 기록)

      if (checkError) {
        console.error("근로자 근무 기록 확인 오류:", checkError);
        throw checkError;
      }

      // 실제 근무 기록이 있으면 삭제 불가
      if (actualWorkRecords && actualWorkRecords.length > 0) {
        setError("실제 근무 기록이 있는 근로자는 삭제할 수 없습니다.");
        toast.error("실제 근무 기록이 있는 근로자는 삭제할 수 없습니다.");
        return;
      }

      // 근로자와 관련된 출역 기록 삭제 (등록 기록만 있으므로 안전하게 삭제 가능)
      const { error: workRecordsError } = await supabase
        .from("work_records")
        .delete()
        .eq("worker_id", workerId);

      if (workRecordsError) {
        console.error("근로자 출역 기록 삭제 오류:", workRecordsError);
      }

      // 근로자와 관련된 보험 가입 정보 삭제
      const { error: insuranceError } = await supabase
        .from("insurance_enrollments")
        .delete()
        .eq("worker_id", workerId);

      if (insuranceError) {
        console.error("근로자 보험 정보 삭제 오류:", insuranceError);
      }

      // 근로자와 관련된 일용근로자 신고 삭제
      const { error: reportError } = await supabase
        .from("daily_work_reports")
        .delete()
        .eq("worker_id", workerId);

      if (reportError) {
        console.error("근로자 신고 정보 삭제 오류:", reportError);
      }

      // 근로자 삭제
      const { error: workerError } = await supabase
        .from("workers")
        .delete()
        .eq("worker_id", workerId);

      if (workerError) throw workerError;

      // 근로자 목록 업데이트
      const updatedWorkers = workers.filter((worker) => worker.worker_id !== workerId);
      setWorkers(updatedWorkers);
      setFilteredWorkers(updatedWorkers);
      setSuccessMessage("근로자가 삭제되었습니다.");

      // 3초 후 성공 메시지 제거
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (error) {
      console.error("근로자 삭제 오류:", error);
      setError("근로자 삭제 중 오류가 발생했습니다.");
      toast.error("근로자 삭제 중 오류가 발생했습니다.");
    } finally {
      setActionLoading(false);
    }
  }

  // 현재 사용자가 해당 근로자를 관리할 수 있는지 확인
  const canManageWorker = (worker) => {
    // admin은 회사 소속 모든 현장의 근로자를 관리할 수 있음
    if (currentUser?.role === "admin") {
      return true;
    }

    // manager, site_manager는 자신에게 배정된 현장의 근로자를 관리할 수 있음
    if (["manager", "site_manager"].includes(currentUser?.role)) {
      // 근로자가 속한 현장 중 현재 사용자에게 할당된 현장이 있는지 확인
      return worker.sites.some((site) => userSites.includes(site.site_id));
    }

    return false;
  };

  // 주민등록번호 마스킹 처리 함수
  const maskResidentNumber = (number) => {
    if (!number) return "-";
    return number.substring(0, 6) + "-*******";
  };

  const formatResidentNumber = (number) => {
    if (!number) return "-";
    return number.replace(/(\d{6})(\d{7})/, "$1-$2");
  };

  // 전화번호 포맷팅 함수
  const formatPhoneNumber = (phoneNumber) => {
    if (!phoneNumber) return "-";

    // 숫자만 추출
    const cleaned = ("" + phoneNumber).replace(/\D/g, "");

    // 길이에 따라 다른 형식 적용
    if (cleaned.length === 11) {
      // 010-1234-5678 형식
      return cleaned.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
    } else if (cleaned.length === 10) {
      // 02-123-4567 또는 010-123-4567 형식
      if (cleaned.startsWith("02")) {
        return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "$1-$2-$3");
      }
      return cleaned.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
    } else if (cleaned.length === 8) {
      // 1588-1234 형식
      return cleaned.replace(/(\d{4})(\d{4})/, "$1-$2");
    }

    // 기본값 반환
    return phoneNumber;
  };

  return (
    <RoleGuard requiredPermission="VIEW_WORKERS">
      <div className="w-full mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">근로자 관리</h1>

          <div className="flex items-center space-x-4">
            {/* 검색 기능 추가 */}
            <form onSubmit={handleSearch} className="flex">
              <div className="relative w-64 md:w-80">
                <input
                  type="text"
                  placeholder="이름, 주민번호, 연락처 검색..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm pr-10"
                />
                <button
                  type="submit"
                  className="absolute right-0 top-0 h-full px-3 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 flex items-center justify-center"
                >
                  <Search size={16} />
                </button>
              </div>
            </form>
            <Link
              href="/dashboard/workers/add"
              className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            >
              근로자 추가
            </Link>
          </div>
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

        {/* 검색 결과 요약 표시 */}
        {searchQuery && (
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              검색 결과: <span className="font-medium">{filteredWorkers.length}</span>명의 근로자가
              "{searchQuery}"에 일치합니다.
              {filteredWorkers.length === 0 && " 검색어를 확인해 주세요."}
            </p>
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
                    이름
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    주민등록번호
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    국적
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    연락처
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    근로자 유형
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    배정 현장
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    근무년월
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    관리
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredWorkers.map((worker) => (
                  <tr key={worker.worker_id}>
                    <td className="px-6 py-4 whitespace-nowrap">{worker.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {formatResidentNumber(worker.resident_number)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {/* 국적코드를 국가명으로 변환 */}
                      {worker.nationality_code && nationalityCodes[worker.nationality_code]
                        ? nationalityCodes[worker.nationality_code]
                        : worker.nationality_code || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {/* 전화번호 포맷팅 적용 */}
                      {formatPhoneNumber(worker.contact_number)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                        ${
                          worker.worker_type === "daily"
                            ? "bg-orange-100 text-orange-800"
                            : worker.worker_type === "part_time"
                            ? "bg-green-100 text-green-800"
                            : worker.worker_type === "contract"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {worker.worker_type === "daily"
                          ? "일용근로자"
                          : worker.worker_type === "part_time"
                          ? "단시간근로자"
                          : worker.worker_type === "contract"
                          ? "계약직"
                          : "정규직"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {worker.sites && worker.sites.length > 0 ? (
                          worker.sites.map((site, index) => (
                            <span
                              key={index}
                              className="px-2 py-1 text-xs bg-gray-100 rounded-full truncate max-w-xs"
                              title={site.site_name}
                            >
                              {site.site_name}
                            </span>
                          ))
                        ) : (
                          <span className="text-gray-400">배정된 현장 없음</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 text-xs py-4 whitespace-nowrap">
                      {worker.work_month ? worker.work_month : "-"}{" "}
                      {/* 근무년월이 없으면 "-" 표시 */}
                    </td>

                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {canManageWorker(worker) ? (
                        <>
                          <Link
                            href={`/dashboard/workers/edit/${worker.worker_id}`}
                            className="text-indigo-600 hover:text-indigo-900 mr-4"
                          >
                            수정
                          </Link>
                          <button
                            onClick={() => openDeleteModal(worker.worker_id, worker.name)}
                            disabled={actionLoading}
                            className="text-red-600 hover:text-red-900"
                          >
                            삭제
                          </button>
                        </>
                      ) : (
                        <span className="text-gray-400">권한 없음</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredWorkers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
                      {searchQuery ? "검색 결과가 없습니다." : "등록된 근로자가 없습니다."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {/* 삭제 확인 모달 */}
        {showDeleteModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-lg p-6 w-96 max-w-md mx-auto">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                  <svg
                    className="h-6 w-6 text-red-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">근로자 삭제</h3>
                <p className="text-sm text-gray-500 mb-6">
                  <strong>{workerToDelete?.name}</strong> 근로자를 정말 삭제하시겠습니까?
                  <br />이 작업은 되돌릴 수 없습니다.
                </p>
              </div>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={cancelDelete}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300"
                >
                  취소
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-red-300 disabled:cursor-not-allowed"
                >
                  {actionLoading ? (
                    <span className="flex items-center">
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
                      처리 중...
                    </span>
                  ) : (
                    "삭제"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </RoleGuard>
  );
}
