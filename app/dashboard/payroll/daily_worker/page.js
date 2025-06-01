//file: app/dashboard/payroll/daily_worker/page.js
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/store/authStore";
import useSiteStore from "@/lib/store/siteStore";
import usePayrollStore from "@/lib/store/payrollStore";
import RoleGuard from "@/components/RoleGuard";
import { ToastContainer, toast } from "react-toastify";
import { Search, Printer, Calendar, FileText } from "lucide-react";
import { formatNumber, formatResidentNumber, formatPhoneNumber } from "@/lib/utils/taxCalculations";
import PaymentModal from "./components/PaymentModal";
import BulkPaymentModal from "./components/ByDayBulkPaymentModal";
import PayslipModal from "./components/PayslipModal";
import WorkerBulkPaymentModal from "./components/WorkerBulkPaymentModal"; // 새로 추가
import DailyWorkerTable from "./components/DailyWorkerTable";
import DailyWorkerSummary from "./components/DailyWorkerSummary";
import ByDayBulkPaymentModal from "./components/ByDayBulkPaymentModal";

export default function DailyWorkerPayrollPage() {
  // 유저, 사이트 정보 스토어
  const { user: currentUser } = useAuthStore();
  const {
    sites,
    // selectedSite,
    // setSelectedSite,
    initialize,
  } = useSiteStore();

  // payrollStore 사용
  const {
    yearMonth,
    setYearMonth,
    loading,
    error,
    workerData,
    dailySummaries,
    payrollSummary,
    fetchDailyWorkerPayrollData,
    handlePayment,
    updatePaymentStatus,
    updateRecord,
    showPayslip,
    confirmPayment,
    confirmBulkPayment,
    showPaymentModal,
    showBulkPaymentModal,
    showPayslipModal,
    setShowPaymentModal,
    setShowBulkPaymentModal,
    setShowPayslipModal,
    paymentInfo,
    bulkPaymentInfo,
    payslipInfo,
    setBulkPaymentInfo,
  } = usePayrollStore();

  // 로컬 상태 (payrollStore로 이동하지 않는 것들)
  const [selectedSite, setSelectedSite] = useState(null);
  const [directSites, setDirectSites] = useState([]);

  // 근로자 일괄지급 관련 상태 추가
  const [showWorkerBulkPaymentModal, setShowWorkerBulkPaymentModal] = useState(false);
  const [workerBulkPaymentInfo, setWorkerBulkPaymentInfo] = useState(null);

  // 라우터
  const router = useRouter();

  useEffect(() => {
    // payrollStore 초기화
    usePayrollStore.getState().resetStore();

    return () => {
      // 컴포넌트 언마운트 시 다시 초기화
      usePayrollStore.getState().resetStore();
    };
  }, []);

  // 사이트 리스트 및 업무일 가져오기
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        console.log("현장 정보 로드 시작");

        if (!currentUser) {
          console.log("로그인된 사용자 정보가 없습니다");
          return;
        }

        // ✅ 직접 DB 조회 로직 활용
        const { data: userData, error: userError } = await supabase
          .from("user_companies")
          .select("company_id")
          .eq("user_id", currentUser.id)
          .maybeSingle();

        if (userError) {
          console.error("사용자 회사 ID 조회 실패:", userError);
          throw userError;
        }

        if (userData?.company_id) {
          const { data: sitesData, error: sitesError } = await supabase
            .from("location_sites")
            .select("site_id, site_name, address, start_date, end_date, status")
            .eq("company_id", userData.company_id);

          if (sitesError) {
            console.error("회사 현장 조회 실패:", sitesError);
            throw sitesError;
          }

          if (sitesData && sitesData.length > 0) {
            setDirectSites(sitesData);
            console.log("현장 목록 로드 완료:", sitesData);
          }
        }
      } catch (error) {
        console.error("초기 데이터 로드 오류:", error);
        toast.error("현장 정보를 불러오는 중 오류가 발생했습니다.");
      }
    };

    loadInitialData();
  }, [currentUser]); // fetchSites 의존성 제거

  // 선택된 사이트가 변경되면 근로자 급여 데이터 가져오기
  useEffect(() => {
    const loadPayrollData = async () => {
      if (selectedSite && yearMonth) {
        console.log("급여 데이터 로드 시작:", { selectedSite, yearMonth });

        try {
          const payrollStore = usePayrollStore.getState();

          // 1. selectedSite 설정
          payrollStore.setSelectedSite(selectedSite);

          // 2. 잠시 대기 후 데이터 fetch
          await new Promise((resolve) => setTimeout(resolve, 50));

          // 3. 데이터 fetch
          await payrollStore.fetchDailyWorkerPayrollData();

          console.log("급여 데이터 로드 완료");
        } catch (error) {
          console.error("급여 데이터 로드 오류:", error);
          toast.error("급여 데이터를 불러오는 중 오류가 발생했습니다.");
        }
      }
    };

    loadPayrollData();
  }, [selectedSite, yearMonth]);

  useEffect(() => {
    console.log("현재 dailySummaries 상태:", dailySummaries); // ✅ 페이지 렌더링 시 확인
  }, [dailySummaries]);
  // 날자별 일괄 지급 처리 핸들러
  // app/dashboard/payroll/daily_worker/page.js
  const handleBulkPayment = (dateStr, workers) => {
    // ✅ 이 로그가 콘솔에 찍히는지 다시 한번 확인. (DailyWorkerSummary의 로그 다음에 나와야 함)
    console.log(
      "🟢 page.js: handleBulkPayment 함수 시작. dateStr:",
      dateStr,
      "workers 길이:",
      workers ? workers.length : 0
    );

    const dailySummary = dailySummaries[dateStr];
    // ✅ dailySummary 값이 제대로 가져와지는지, undefined나 null이 아닌지 확인
    console.log("  dailySummary:", dailySummary);

    if (!dailySummary) {
      console.warn("handleBulkPayment: dailySummary가 없습니다. 함수 종료.");
      return; // 이 조건 때문에 함수가 종료될 수 있음!
    }

    const unpaidWorkers = [];
    let totalAmount = 0;

    // ✅ 이 루프가 잘 도는지, unpaidWorkers에 데이터가 채워지는지 확인
    workerData.forEach((worker) => {
      const unpaidRecords = worker.records.filter(
        (record) => record.date === dateStr && record.status !== "paid"
      );

      if (unpaidRecords.length > 0) {
        unpaidWorkers.push({
          worker_id: worker.worker_id,
          name: worker.name,
          job: worker.job_code || "일용직",
          records: unpaidRecords,
          totalAmount: unpaidRecords.reduce((sum, r) => sum + r.dailyWage, 0),
          totalNetAmount: unpaidRecords.reduce((sum, r) => sum + r.netPay, 0),
        });
        totalAmount += unpaidRecords.reduce((sum, r) => sum + r.dailyWage, 0);
      }
    });
    // ✅ unpaidWorkers와 totalAmount 값 확인
    console.log("  unpaidWorkers (필터링 후):", unpaidWorkers);
    console.log("  totalAmount (필터링 후):", totalAmount);

    if (unpaidWorkers.length === 0) {
      toast.info("미지급 항목이 없습니다.");
      console.log("  ⚠️ 미지급 항목이 없어 모달을 열지 않습니다.");
      return; // ✅ 이 조건 때문에 함수가 종료될 수 있음!
    }

    setBulkPaymentInfo({
      date: dateStr,
      // ✅ dailySummary.workDate가 아니라 dailySummary.date로 되어 있음.
      //    dailySummary 객체의 정확한 속성명을 확인해야 함 (console.log(dailySummary)로)
      workDate: dailySummary.date,
      items: unpaidWorkers,
      totalAmount: totalAmount,
    });
    // ✅ setBulkPaymentInfo 호출 후 bulkPaymentInfo 상태가 제대로 설정되었는지 확인
    console.log(
      "  setBulkPaymentInfo 호출됨. 설정된 bulkPaymentInfo:",
      usePayrollStore.getState().bulkPaymentInfo
    );

    setShowBulkPaymentModal(true);
    // ✅ setShowBulkPaymentModal 호출 후 showBulkPaymentModal 상태가 바로 true로 변경되었는지 확인 (비동기일 수 있음)
    console.log(
      "  setShowBulkPaymentModal(true) 호출됨. 현재 showBulkPaymentModal 상태:",
      usePayrollStore.getState().showBulkPaymentModal
    );

    // ✅ 추가 확인: React의 상태 업데이트는 비동기이므로, 약간의 시간차를 두고 상태를 최종 확인
    setTimeout(() => {
      console.log(
        "  ⏰ setTimeout 후 최종 showBulkPaymentModal 상태:",
        usePayrollStore.getState().showBulkPaymentModal
      );
    }, 100);
  };

  // 근로자 일괄지급 처리 핸들러 (새로 추가)
  const handleWorkerBulkPayment = (bulkPaymentInfo) => {
    setWorkerBulkPaymentInfo(bulkPaymentInfo);
    setShowWorkerBulkPaymentModal(true);
  };

  // 근로자별(소계옆 일괄처리리) 일괄지급 확인 처리 (새로 추가)
  const confirmWorkerBulkPayment = async (bulkPaymentInfo, paymentMethod, memo) => {
    try {
      if (
        !bulkPaymentInfo ||
        !bulkPaymentInfo.unpaidRecords ||
        bulkPaymentInfo.unpaidRecords.length === 0
      ) {
        toast.error("지급할 항목이 없습니다.");
        return;
      }

      const paymentDate = new Date().toISOString().split("T")[0]; // 오늘 날짜

      // 각 레코드별로 지급 처리
      const updatePromises = bulkPaymentInfo.unpaidRecords.map(async (record) => {
        try {
          const { error } = await supabase
            .from("work_records")
            .update({
              payment_status: "paid",
              payment_date: paymentDate,
              payment_method: paymentMethod,
              payment_memo: memo,
              updated_at: new Date().toISOString(),
            })
            .eq("record_id", record.record_id);

          if (error) throw error;
          return { success: true, recordId: record.record_id };
        } catch (error) {
          console.error(`레코드 ${record.record_id} 지급 처리 오류:`, error);
          return { success: false, recordId: record.record_id, error };
        }
      });

      const results = await Promise.all(updatePromises);
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;

      if (successCount > 0) {
        toast.success(
          `${bulkPaymentInfo.worker.name} 님의 ${successCount}건 일괄 지급이 완료되었습니다.`
        );
      }

      if (failCount > 0) {
        toast.warning(`${failCount}건의 지급 처리 중 오류가 발생했습니다.`);
      }

      // 모달 닫기
      setShowWorkerBulkPaymentModal(false);
      setWorkerBulkPaymentInfo(null);

      // 데이터 다시 로드
      if (selectedSite && yearMonth) {
        const payrollStore = usePayrollStore.getState();
        await payrollStore.fetchDailyWorkerPayrollData();
      }
    } catch (error) {
      console.error("일괄 지급 처리 오류:", error);
      toast.error("일괄 지급 처리 중 오류가 발생했습니다.");
    }
  };

  // 인쇄 핸들러
  const handlePrint = () => {
    window.print();
  };

  // 새 근무기록 추가 페이지로 이동
  const goToAddWorkRecord = () => {
    router.push(`/dashboard/work-records/add?site=${selectedSite}&month=${yearMonth}`);
  };

  return (
    <RoleGuard requiredPermission="EDIT_PAYROLL">
      <div className="bg-gray-50 min-h-screen">
        <div className="w-full mx-auto px-4 ">
          <header className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 ">일용근로자 일당 지급 관리</h1>

            {/* 컨트롤 패널 */}
            <div className="bg-white p-4 rounded-lg shadow-md mb-6 print:hidden">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center space-x-4 w-96">
                  <div>
                    <label
                      htmlFor="site-select"
                      className="block text-sm font-medium text-gray-700"
                    >
                      현장 선택:
                    </label>
                    <select
                      id="site-select"
                      name="site-select"
                      value={selectedSite || ""}
                      onChange={(e) => setSelectedSite(e.target.value)}
                      className="mt-1 text-sm block w-48 rounded-md border-2 border-blue-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">현장을 선택하세요</option>
                      {/* siteStore에서 현장 목록을 가져오지 못하면 직접 조회한 현장 목록 사용 */}
                      {sites && sites.length > 0 ? (
                        sites.map((site) => (
                          <option key={site.site_id} value={site.site_id}>
                            {site.site_name}
                          </option>
                        ))
                      ) : directSites && directSites.length > 0 ? (
                        directSites.map((site) => (
                          <option key={site.site_id} value={site.site_id}>
                            {site.site_name}
                          </option>
                        ))
                      ) : (
                        <option value="" disabled>
                          현장 정보가 없습니다
                        </option>
                      )}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="year-month" className="block text-sm font-medium text-gray-700">
                      조회 년월:
                    </label>
                    <input
                      type="month"
                      id="year-month"
                      name="year-month"
                      value={yearMonth}
                      onChange={(e) => setYearMonth(e.target.value)}
                      className="mt-1 text-sm block w-40 rounded-md border border-blue-300 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="w-96"></div>
                {/* 현장 정보 및 요약 */}
                {selectedSite && (
                  <div className="w-full flex-1 bg-white px-6 rounded-lg shadow-md border border-gray-300">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <h2 className="text-base font-semibold text-gray-900">현장 정보</h2>
                        <p className="text-gray-700 text-sm">
                          현장명:{" "}
                          {(sites &&
                            sites.find((site) => site.site_id == selectedSite)?.site_name) ||
                            (directSites &&
                              directSites.find((site) => site.site_id == selectedSite)
                                ?.site_name) ||
                            "선택된 현장 없음"}
                        </p>
                        <p className="text-gray-700 text-sm">
                          조회 월:{" "}
                          {yearMonth && `${yearMonth.split("-")[0]}년 ${yearMonth.split("-")[1]}월`}
                        </p>
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-gray-900">지급 요약</h2>
                        <p className="text-gray-700 text-sm">
                          근로자 수: {payrollSummary.totalWorkers}명
                        </p>
                        <p className="text-gray-700 text-sm">
                          총 근무 건수:{" "}
                          {workerData.reduce((sum, worker) => sum + worker.records.length, 0)}건
                        </p>
                      </div>
                      <div>
                        <h2 className="text-base font-semibold text-gray-900">금액 요약</h2>
                        <p className="text-gray-700 text-sm">
                          지급액: {formatNumber(payrollSummary.totalPaid)}원
                        </p>
                        <p className="text-gray-700 text-sm">
                          미지급액: {formatNumber(payrollSummary.totalUnpaid)}원
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* 에러 메시지 */}
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {/* 일용근로자 일당 관리 테이블 */}
          {loading ? (
            <div className="flex justify-center items-center py-8">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
              <span className="ml-3">불러오는 중...</span>
            </div>
          ) : (!sites || sites.length === 0) && (!directSites || directSites.length === 0) ? (
            <div className="bg-yellow-50 border border-yellow-400 text-yellow-700 p-4 rounded mb-4">
              <p className="font-bold">현장 정보가 없습니다</p>
              <p>사용자에게 할당된 공사현장이 없습니다. 관리자에게 현장 할당을 요청하세요.</p>
            </div>
          ) : !selectedSite ? (
            <div className="bg-blue-50 border border-blue-300 text-blue-700 p-4 rounded mb-4">
              <p>현장을 선택하시면 일용직 근로자의 급여 정보를 확인할 수 있습니다.</p>
            </div>
          ) : (
            <>
              {workerData.length > 0 ? (
                <DailyWorkerTable
                  workerData={workerData}
                  handlePayment={handlePayment}
                  showPayslip={showPayslip}
                  updateRecord={updateRecord}
                  updatePaymentStatus={updatePaymentStatus}
                  handleWorkerBulkPayment={handleWorkerBulkPayment} // 새로 추가된 prop
                />
              ) : (
                <div className="bg-white p-4 rounded-lg shadow-md mb-6 text-center">
                  <p className="text-gray-500">
                    해당 기간에 등록된 일용직 근로자 급여 내역이 없습니다.
                  </p>
                </div>
              )}

              {/* 일자별 요약 */}
              {workerData.length > 0 && (
                <DailyWorkerSummary workerData={workerData} handleBulkPayment={handleBulkPayment} />
              )}
            </>
          )}
        </div>

        {/* 지급 처리 모달 */}
        {showPaymentModal && (
          <PaymentModal
            paymentInfo={paymentInfo}
            onClose={() => setShowPaymentModal(false)}
            onConfirm={confirmPayment}
          />
        )}

        {/* 일괄 지급 모달 (날짜별) */}
        {showBulkPaymentModal && (
          <ByDayBulkPaymentModal
            bulkPaymentInfo={bulkPaymentInfo}
            onClose={() => setShowBulkPaymentModal(false)}
            onConfirm={confirmBulkPayment}
          />
        )}

        {/* 근로자별 (근로자 소계 옆에 있는 일괄괄) 일괄 지급 모달 () */}
        {showWorkerBulkPaymentModal && (
          <WorkerBulkPaymentModal
            bulkPaymentInfo={workerBulkPaymentInfo}
            onClose={() => {
              setShowWorkerBulkPaymentModal(false);
              setWorkerBulkPaymentInfo(null);
            }}
            onConfirm={confirmWorkerBulkPayment}
          />
        )}

        {/* 급여명세서 모달 */}
        {showPayslipModal && (
          <PayslipModal
            payslipInfo={payslipInfo}
            onClose={() => setShowPayslipModal(false)}
            onPrint={handlePrint}
          />
        )}

        {/* 토스트 컨테이너 */}
        <ToastContainer
          position="bottom-center"
          autoClose={1000} // 자동 off 시간
        />
      </div>
    </RoleGuard>
  );
}
