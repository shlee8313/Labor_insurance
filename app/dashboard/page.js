//file: app/dashboard/page.js
"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/store/authStore";
import useSiteStore from "@/lib/store/siteStore";
import useWorkerStore from "@/lib/store/workerStore";
import useWorkHistoryStore from "@/lib/store/workHistoryStore";
import { FaBuilding, FaHardHat, FaUsers, FaMoneyBillWave } from "react-icons/fa";
import { formatNumber } from "@/lib/utils/formattingUtils";
import { getPreviousYearMonthFromSelected } from "@/lib/utils/dateUtils";

// 현장별 상세 정보 컴포넌트
function SiteDetailsSection({ sites, currentYearMonth }) {
  const [siteDetails, setSiteDetails] = useState({});
  const [loadingSites, setLoadingSites] = useState(true);
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  useEffect(() => {
    async function fetchSiteDetails() {
      if (!sites.length) return;

      setLoadingSites(true);
      const details = {};

      for (const site of sites.slice(0, 6)) {
        try {
          const siteDetail = await getSiteDetailInfo(site.site_id, currentYearMonth);
          details[site.site_id] = siteDetail;
        } catch (error) {
          console.error(`현장 ${site.site_id} 상세 정보 조회 오류:`, error);
          details[site.site_id] = null;
        }
      }

      setSiteDetails(details);
      setLoadingSites(false);
    }

    fetchSiteDetails();
  }, [sites, currentYearMonth]);

  // 현장별 상세 정보 조회 함수
  async function getSiteDetailInfo(siteId, yearMonth) {
    // 1. 현장 책임자 정보 조회
    const { data: managers, error: managersError } = await supabase
      .from("user_location_sites")
      .select(
        `
        users (
          name,
          contact_number
        )
      `
      )
      .eq("site_id", siteId)
      .is("removed_date", null)
      .limit(1);

    if (managersError) throw managersError;

    const manager = managers?.[0]?.users || null;

    // 2. 이전달 계산
    const [year, month] = yearMonth.split("-").map(Number);
    const dateInfo = getPreviousYearMonthFromSelected(year, month);
    const prevYearMonth = dateInfo.prevYearMonth;

    // 3. 현재 월 근무 기록 조회
    const { data: currentWorkRecords, error: currentError } = await supabase
      .from("work_records")
      .select(
        `
        worker_id,
        work_date,
        work_hours,
        daily_wage,
        status,
        workers (
          name
        )
      `
      )
      .eq("site_id", siteId)
      .eq("registration_month", yearMonth)
      .neq("status", "registration");

    if (currentError) throw currentError;

    // 4. 이전달 근무 기록 조회
    const { data: prevWorkRecords, error: prevError } = await supabase
      .from("work_records")
      .select(
        `
        worker_id,
        work_date,
        work_hours,
        status,
        workers (
          name
        )
      `
      )
      .eq("site_id", siteId)
      .eq("registration_month", prevYearMonth)
      .neq("status", "registration");

    if (prevError) throw prevError;

    // 5. 데이터 분석
    const currentWorkerStats = {};
    const prevWorkerStats = {};
    let totalLaborCost = 0;

    // 현재 월 데이터 분석
    currentWorkRecords?.forEach((record) => {
      const workerId = record.worker_id;
      const workerName = record.workers?.name || "미상";

      if (!currentWorkerStats[workerId]) {
        currentWorkerStats[workerId] = {
          name: workerName,
          workDays: 0,
          workHours: 0,
          totalWage: 0,
          firstWorkDate: null,
        };
      }

      currentWorkerStats[workerId].workDays++;
      currentWorkerStats[workerId].workHours += parseFloat(record.work_hours || 0);
      currentWorkerStats[workerId].totalWage += parseFloat(record.daily_wage || 0);

      // 이번달 첫 근무일 찾기 (work_date가 있다면)
      if (record.work_date) {
        if (
          !currentWorkerStats[workerId].firstWorkDate ||
          record.work_date < currentWorkerStats[workerId].firstWorkDate
        ) {
          currentWorkerStats[workerId].firstWorkDate = record.work_date;
        }
      }

      totalLaborCost += parseFloat(record.daily_wage || 0);
    });

    // 이전달 데이터 분석
    prevWorkRecords?.forEach((record) => {
      const workerId = record.worker_id;
      const workerName = record.workers?.name || "미상";

      if (!prevWorkerStats[workerId]) {
        prevWorkerStats[workerId] = {
          name: workerName,
          workDays: 0,
          workHours: 0,
          firstWorkDate: null,
        };
      }

      prevWorkerStats[workerId].workDays++;
      prevWorkerStats[workerId].workHours += parseFloat(record.work_hours || 0);

      // 첫 근무일 찾기
      if (
        !prevWorkerStats[workerId].firstWorkDate ||
        record.work_date < prevWorkerStats[workerId].firstWorkDate
      ) {
        prevWorkerStats[workerId].firstWorkDate = record.work_date;
      }
    });

    // 6. 결과 정리
    const totalWorkers = Object.keys(currentWorkerStats).length;

    // 이번달 근무자 중 지난달 근무 이력이 있는 자
    const currentWorkersWithPrevHistory = Object.keys(currentWorkerStats)
      .filter((workerId) => prevWorkerStats[workerId])
      .map((workerId) => ({
        name: currentWorkerStats[workerId].name,
        prevStartDate: prevWorkerStats[workerId].firstWorkDate,
        prevWorkHours: prevWorkerStats[workerId].workHours,
        currentStartDate: currentWorkerStats[workerId].firstWorkDate,
        currentWorkHours: currentWorkerStats[workerId].workHours,
      }));

    // 이번달 8일 이상 근무자
    const workersOver8Days = Object.values(currentWorkerStats)
      .filter((worker) => worker.workDays >= 8)
      .map((worker) => worker.name);

    // 이번달 60시간 이상 근무자
    const workersOver60Hours = Object.values(currentWorkerStats)
      .filter((worker) => worker.workHours >= 60)
      .map((worker) => worker.name);

    // 이번달 220만원 이상 근무자
    const workersOver2M = Object.values(currentWorkerStats)
      .filter((worker) => worker.totalWage >= 2200000)
      .map((worker) => worker.name);

    return {
      manager,
      totalWorkers,
      totalLaborCost,
      currentWorkersWithPrevHistory,
      workersOver8Days,
      workersOver60Hours,
      workersOver2M,
    };
  }

  if (!sites.length) return null;

  return (
    <div className="bg-white rounded-lg shadow mb-6">
      <div className="px-5 py-4 border-b border-gray-200">
        <h2 className="font-semibold text-lg">현장 현황</h2>
      </div>
      <div className="p-5">
        {loadingSites ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">현장 정보를 불러오는 중...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sites.slice(0, 6).map((site) => {
              const detail = siteDetails[site.site_id];

              return (
                <div key={site.site_id} className="border border-gray-200 rounded-lg p-6">
                  {/* 현장 기본 정보 */}
                  <div className="mb-4">
                    <h3 className="font-bold text-lg text-gray-900 mb-1">{site.site_name}</h3>
                    <p className="text-gray-600 mb-2">{site.address}</p>
                    <div className="flex gap-4 text-sm text-gray-500">
                      <span>
                        상태:{" "}
                        <span className="font-medium text-green-600">
                          {site.status || "active"}
                        </span>
                      </span>
                      <span>시작: {site.start_date}</span>
                    </div>
                  </div>

                  {detail ? (
                    <div className="grid grid-cols-3 gap-6">
                      {/* 좌측: 기본 현황 */}

                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">현장 기본 현황</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">책임자:</span>
                            <span className="font-medium">{detail.manager?.name || "미배정"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">전화번호:</span>
                            <span className="font-medium">
                              {detail.manager?.contact_number || "-"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">근로자 수:</span>
                            <span className="font-medium text-blue-600">
                              {detail.totalWorkers}명
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">이번달 인건비:</span>
                            <span className="font-medium text-green-600">
                              {formatNumber(detail.totalLaborCost)}원
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-50 rounded-lg p-4">
                        <h4 className="font-medium text-gray-900 mb-3">근무 기준 분류</h4>
                        <div className="space-y-2 text-sm">
                          <div>
                            <span className="text-gray-600">
                              8일 이상 근무자 ({detail.workersOver8Days.length}명):
                            </span>
                            <div className="mt-1 text-blue-700">
                              {detail.workersOver8Days.length > 0
                                ? detail.workersOver8Days.join(", ")
                                : "없음"}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-600">
                              60시간 이상 근무자 ({detail.workersOver60Hours.length}명):
                            </span>
                            <div className="mt-1 text-purple-700">
                              {detail.workersOver60Hours.length > 0
                                ? detail.workersOver60Hours.join(", ")
                                : "없음"}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-600">
                              220만원 이상 근무자 ({detail.workersOver2M.length}명):
                            </span>
                            <div className="mt-1 text-green-700">
                              {detail.workersOver2M.length > 0
                                ? detail.workersOver2M.join(", ")
                                : "없음"}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 우측: 연속 근무자 정보 */}

                      <div className="bg-amber-50 rounded-lg p-2">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium text-gray-900">
                            연속 근무자 ({detail.currentWorkersWithPrevHistory.length}명)
                          </h4>
                          <span className="text-xs text-gray-600">
                            이번달 근무자 중 지난달 근무이력 보유자
                          </span>
                        </div>
                        {/* <div className="text-sm text-gray-600 mb-2">
                          이번달 근무자 중 지난달 근무이력 보유자
                        </div> */}
                        {detail.currentWorkersWithPrevHistory.length > 0 ? (
                          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                            {detail.currentWorkersWithPrevHistory.map((worker, index) => (
                              <div
                                key={index}
                                className="bg-white border border-amber-200 rounded-lg p-1 text-sm shadow-sm hover:bg-blue-100"
                              >
                                {/* 이름 클릭 시 toggle */}
                                <div
                                  onClick={() => toggle(index)}
                                  className="text-amber-800 font-semibold text-sm cursor-pointer hover:underline"
                                >
                                  {worker.name}
                                </div>

                                {/* 펼쳐지는 상세 정보 */}
                                {openIndex === index && (
                                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* 지난달 */}
                                    <div className="bg-gray-50 rounded-lg p-3">
                                      <div className="text-gray-700 font-medium mb-2">지난달</div>
                                      <div className="text-gray-600">
                                        시작일: {worker.prevStartDate || "미상"}
                                      </div>
                                      <div className="text-gray-600">
                                        근무시간: {worker.prevWorkHours.toFixed(1)}시간
                                      </div>
                                    </div>

                                    {/* 이번달 */}
                                    <div className="bg-amber-50 rounded-lg p-3">
                                      <div className="text-amber-700 font-medium mb-2">이번달</div>
                                      <div className="text-amber-600">
                                        시작일: {worker.currentStartDate || "미상"}
                                      </div>
                                      <div className="text-amber-600">
                                        근무시간: {worker.currentWorkHours.toFixed(1)}시간
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-gray-500 text-center py-4 text-sm">
                            연속 근무자가 없습니다
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-gray-500">상세 정보를 불러올 수 없습니다</p>
                    </div>
                  )}
                </div>
              );
            })}

            {sites.length > 6 && (
              <div className="text-center pt-4 border-t border-gray-200">
                <p className="text-sm text-gray-500">총 {sites.length}개 현장 중 6개 표시</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();
  const {
    sites,
    companyName,
    userCompanyId,
    initialize: initializeSiteStore,
    isLoading: isSiteLoading,
  } = useSiteStore();

  const [stats, setStats] = useState({
    totalSites: 0,
    totalManagers: 0,
    totalWorkers: 0,
    thisMonthLaborCost: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 현재 년월 (YYYY-MM 형식)
  const currentYearMonth = new Date().toISOString().substring(0, 7);

  useEffect(() => {
    async function initializeData() {
      if (!user?.id) return;

      try {
        setLoading(true);
        setError(null);

        // 1. 사이트 스토어 초기화
        await initializeSiteStore(user.id);
      } catch (error) {
        console.error("초기화 오류:", error);
        setError("데이터를 불러오는 중 오류가 발생했습니다.");
      }
    }

    initializeData();
  }, [user?.id, initializeSiteStore]);

  useEffect(() => {
    async function fetchDashboardStats() {
      if (!userCompanyId || sites.length === 0) return;

      try {
        setLoading(true);

        // 1. 공사현장 수 계산
        const totalSites = sites.length;

        // 2. 공사 책임자 수 계산 (현장별 담당자)
        const { data: managers, error: managersError } = await supabase
          .from("user_location_sites")
          .select("user_id")
          .in(
            "site_id",
            sites.map((site) => site.site_id)
          )
          .is("removed_date", null);

        if (managersError) throw managersError;

        // 중복 제거하여 고유한 담당자 수 계산
        const uniqueManagers = new Set(managers?.map((m) => m.user_id) || []);
        const totalManagers = uniqueManagers.size;

        // 3. 전체 근로자 수 계산 (현재 월 기준)
        let totalWorkers = 0;
        for (const site of sites) {
          const { data: workers, error: workersError } = await supabase
            .from("work_records")
            .select("worker_id")
            .eq("site_id", site.site_id)
            .eq("registration_month", currentYearMonth);

          if (workersError) {
            console.warn(`현장 ${site.site_id} 근로자 조회 오류:`, workersError);
            continue;
          }

          // 해당 현장의 고유 근로자 수 추가
          const uniqueWorkers = new Set(workers?.map((w) => w.worker_id) || []);
          totalWorkers += uniqueWorkers.size;
        }

        // 4. 이번달 인건비 계산
        let thisMonthLaborCost = 0;

        // work_record_monthly_summaries 테이블에서 이번달 인건비 조회
        const { data: monthlySummaries, error: summariesError } = await supabase
          .from("work_record_monthly_summaries")
          .select("total_wage")
          .in(
            "site_id",
            sites.map((site) => site.site_id)
          )
          .eq("year_month", currentYearMonth);

        if (summariesError) {
          console.warn("월별 요약 테이블 조회 오류:", summariesError);

          // 대안: work_records 테이블에서 직접 계산
          for (const site of sites) {
            const { data: workRecords, error: recordsError } = await supabase
              .from("work_records")
              .select("daily_wage")
              .eq("site_id", site.site_id)
              .eq("registration_month", currentYearMonth)
              .neq("status", "registration");

            if (recordsError) {
              console.warn(`현장 ${site.site_id} 급여 조회 오류:`, recordsError);
              continue;
            }

            const siteWageSum =
              workRecords?.reduce((sum, record) => sum + (parseFloat(record.daily_wage) || 0), 0) ||
              0;
            thisMonthLaborCost += siteWageSum;
          }
        } else {
          // 월별 요약에서 가져온 경우
          thisMonthLaborCost =
            monthlySummaries?.reduce(
              (sum, summary) => sum + (parseFloat(summary.total_wage) || 0),
              0
            ) || 0;
        }

        setStats({
          totalSites,
          totalManagers,
          totalWorkers,
          thisMonthLaborCost,
        });
      } catch (error) {
        console.error("대시보드 통계 조회 오류:", error);
        setError("통계 데이터를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardStats();
  }, [userCompanyId, sites, currentYearMonth]);

  if (loading || isSiteLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">대시보드</h1>

      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-3">환영합니다, {user?.name || "사용자"} 님!</h2>
        <p className="text-gray-600">
          {companyName && <span className="font-medium text-blue-600">{companyName}</span>}의 현황을
          확인하실 수 있습니다.
        </p>
      </div>

      {/* 회사 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center">
            <div className="rounded-full h-12 w-12 flex items-center justify-center bg-blue-100 text-blue-500">
              <FaBuilding size={24} />
            </div>
            <div className="ml-4">
              <h3 className="text-gray-500 text-sm">공사현장</h3>
              <p className="text-2xl font-bold">{stats.totalSites}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center">
            <div className="rounded-full h-12 w-12 flex items-center justify-center bg-green-100 text-green-500">
              <FaHardHat size={24} />
            </div>
            <div className="ml-4">
              <h3 className="text-gray-500 text-sm">공사 책임자</h3>
              <p className="text-2xl font-bold">{stats.totalManagers}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center">
            <div className="rounded-full h-12 w-12 flex items-center justify-center bg-purple-100 text-purple-500">
              <FaUsers size={24} />
            </div>
            <div className="ml-4">
              <h3 className="text-gray-500 text-sm">근로자 수</h3>
              <p className="text-2xl font-bold">{stats.totalWorkers}</p>
              <p className="text-xs text-gray-500">이번달 기준</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-5">
          <div className="flex items-center">
            <div className="rounded-full h-12 w-12 flex items-center justify-center bg-yellow-100 text-yellow-500">
              <FaMoneyBillWave size={24} />
            </div>
            <div className="ml-4">
              <h3 className="text-gray-500 text-sm">이번달 인건비</h3>
              <p className="text-2xl font-bold">{formatNumber(stats.thisMonthLaborCost)}원</p>
              <p className="text-xs text-gray-500">{currentYearMonth.replace("-", "년 ")}월</p>
            </div>
          </div>
        </div>
      </div>

      {/* 현장별 상세 정보 */}
      {sites.length > 0 && <SiteDetailsSection sites={sites} currentYearMonth={currentYearMonth} />}

      {/* 최근 활동 및 알림 섹션 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-lg">최근 활동</h2>
          </div>
          <div className="p-5">
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
          </div>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="font-semibold text-lg">알림 및 할 일</h2>
          </div>
          <div className="p-5">
            <ul className="divide-y divide-gray-200">
              <li className="py-3">
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-red-500 mr-3"></div>
                  <p className="text-sm">
                    <span className="font-medium">긴급</span>: 4월 일용근로자 신고서를 제출해주세요.
                  </p>
                </div>
                <p className="text-xs text-gray-500 mt-1">기한: 2025-04-10</p>
              </li>
              <li className="py-3">
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 mr-3"></div>
                  <p className="text-sm">
                    <span className="font-medium">주의</span>: 2명의 사용자가 이메일 인증을 완료하지
                    않았습니다.
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
          </div>
        </div>
      </div>
    </div>
  );
}
