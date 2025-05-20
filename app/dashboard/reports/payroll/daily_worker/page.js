//file: app/dashboard/reports/payroll/daily_worker/page.js
//worker 테이블: work_type: daily
// 일당 근로자 급여테이블

"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/store/authStore";
import useSiteStore from "@/lib/store/siteStore";
import RoleGuard from "@/components/RoleGuard";
import { ToastContainer, toast } from "react-toastify";
import { Search, Printer, Calendar, FileText } from "lucide-react";
import {
  calculateDailyTax,
  formatNumber,
  applyMinimumTaxRule,
  formatResidentNumber,
  formatPhoneNumber,
} from "@/lib/utils/taxCalculations";
import PaymentModal from "./components/PaymentModal";
import BulkPaymentModal from "./components/BulkPaymentModal";
import PayslipModal from "./components/PayslipModal";
import DailyWorkerTable from "./components/DailyWorkerTable";
import DailyWorkerSummary from "./components/DailyWorkerSummary";

export default function DailyWorkerPayrollPage() {
  // 유저, 사이트 정보 스토어
  const { user: currentUser } = useAuthStore();
  const { sites, selectedSite, setSelectedSite, fetchSites } = useSiteStore();

  // 로컬 상태
  const [yearMonth, setYearMonth] = useState(new Date().toISOString().substring(0, 7)); // YYYY-MM 형식
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [directSites, setDirectSites] = useState([]); // 직접 조회한 현장 목록

  // 근로자 데이터 상태
  const [workerData, setWorkerData] = useState([]);
  const [dailySummaries, setDailySummaries] = useState({});
  const [payrollSummary, setPayrollSummary] = useState({
    totalWorkers: 0,
    totalWorkDays: 0,
    totalPaid: 0,
    totalUnpaid: 0,
  });

  // 모달 관련 상태
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showBulkPaymentModal, setShowBulkPaymentModal] = useState(false);
  const [showPayslipModal, setShowPayslipModal] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [bulkPaymentInfo, setBulkPaymentInfo] = useState(null);
  const [payslipInfo, setPayslipInfo] = useState(null);

  // 라우터
  const router = useRouter();

  // 사이트 리스트 및 업무일 가져오기
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        setLoading(true);
        console.log("현장 정보 로드 시작");

        if (!currentUser) {
          console.log("로그인된 사용자 정보가 없습니다");
          setLoading(false);
          return;
        }

        // siteStore의 fetchSites() 실행
        await fetchSites();
        console.log("현장 정보 로드 완료:", sites);

        // 현장 정보가 없으면 직접 DB에서 조회 시도
        if (!sites || sites.length === 0) {
          console.log("사이트 스토어에 현장 정보가 없습니다. 직접 DB 조회를 시도합니다.");

          // 사용자의 회사 ID 조회
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
            console.log("사용자 회사 ID:", userData.company_id);

            // 회사 ID로 현장 목록 직접 조회
            const { data: sitesData, error: sitesError } = await supabase
              .from("construction_sites")
              .select("site_id, site_name, address, start_date, end_date, status")
              .eq("company_id", userData.company_id);

            if (sitesError) {
              console.error("회사 현장 조회 실패:", sitesError);
              throw sitesError;
            }

            console.log("직접 DB에서 조회한 현장 목록:", sitesData);

            if (sitesData && sitesData.length > 0) {
              // 직접 조회한 현장 목록 상태에 저장
              setDirectSites(sitesData);

              // 첫 번째 현장 자동 선택을 하지 않음
              // setSelectedSite(sitesData[0].site_id);
              // console.log("첫 번째 현장 자동 선택:", sitesData[0].site_id);
              console.log("현장 목록 로드 완료. 사용자가 직접 선택할 수 있습니다.");
            }
          }
        } else if (sites && sites.length > 0 && !selectedSite) {
          // 사이트가 하나 이상 있지만 자동 선택하지 않음
          // console.log("첫 번째 현장 자동 선택:", sites[0].site_id);
          // setSelectedSite(sites[0].site_id);
          console.log("현장 목록 로드 완료. 총", sites.length, "개의 현장이 있습니다.");
        }
      } catch (error) {
        console.error("초기 데이터 로드 오류:", error);
        setError("현장 정보를 불러오는 중 오류가 발생했습니다.");
        toast.error("현장 정보를 불러오는 중 오류가 발생했습니다.");
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [currentUser, fetchSites]);

  // 선택된 사이트가 변경되면 근로자 급여 데이터 가져오기
  useEffect(() => {
    console.log("선택된 현장 또는 년월 변경:", selectedSite, yearMonth);

    // 선택된 사이트와 년월이 있으면 데이터 로드
    if (selectedSite && yearMonth) {
      fetchDailyWorkerPayrollData();
    } else {
      // 선택된 사이트나 년월이 없으면 로딩 상태 해제
      setLoading(false);
    }
  }, [selectedSite, yearMonth]);

  // 일용직 근로자 급여 데이터 가져오기
  const fetchDailyWorkerPayrollData = async () => {
    if (!selectedSite || !yearMonth) {
      setLoading(false);
      return;
    }

    console.log("급여 데이터 로드 시작 - 현장:", selectedSite, "년월:", yearMonth);
    console.log("현재 사이트 정보:", sites);
    console.log("직접 조회한 사이트 정보:", directSites);

    try {
      setLoading(true);

      // 1. 해당 월의 시작일과 끝일 계산
      const year = parseInt(yearMonth.split("-")[0]);
      const month = parseInt(yearMonth.split("-")[1]);
      const startDate = `${yearMonth}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${yearMonth}-${lastDay}`;

      // 2. 선택된 현장의 일용직 근로자 목록 가져오기
      const { data: workRecords, error: workRecordsError } = await supabase
        .from("work_records")
        .select(
          `
          record_id,
          worker_id,
          work_date,
          work_hours,
          daily_wage,
          work_type,
          status,
          payment_status,
          payment_date,
          overtime_allowance,
          night_allowance,
          holiday_allowance,
          extra_allowance,
          tax_exemption_amount,
          income_tax,
          local_income_tax,
          national_pension,
          health_insurance,
          employment_insurance,
          industrial_accident,
          long_term_care,
          workers (
            worker_id,
            name,
            resident_number,
            contact_number,
            worker_type,
            job_code
          )
        `
        )
        .eq("site_id", selectedSite)
        .gte("work_date", startDate)
        .lte("work_date", endDate)
        .neq("status", "registration")
        .order("work_date", { ascending: true });

      if (workRecordsError) throw workRecordsError;

      // 일용직 근로자만 필터링
      const dailyWorkerRecords = workRecords.filter(
        (record) => record.workers?.worker_type === "daily"
      );

      if (dailyWorkerRecords.length === 0) {
        setWorkerData([]);
        setPayrollSummary({
          totalWorkers: 0,
          totalWorkDays: 0,
          totalPaid: 0,
          totalUnpaid: 0,
        });
        setDailySummaries({});
        setLoading(false);
        return;
      }

      // 3. 근로자별 데이터 구성
      const workerMap = new Map();
      const dailyMap = new Map();
      let totalPaid = 0;
      let totalUnpaid = 0;

      dailyWorkerRecords.forEach((record) => {
        if (!record.workers) return;

        const workerId = record.worker_id;
        const workDate = new Date(record.work_date);
        const day = workDate.getDate();
        const dateStr = `${month}월 ${day}일`;

        // 일자별 요약정보 구성
        if (!dailyMap.has(dateStr)) {
          dailyMap.set(dateStr, {
            date: record.work_date,
            day: day,
            workers: [],
            totalAmount: 0,
            paidAmount: 0,
            unpaidAmount: 0,
          });
        }

        const dailySummary = dailyMap.get(dateStr);

        // 근로자가 이미 해당 일자에 있는지 확인
        const existingWorkerIndex = dailySummary.workers.findIndex((w) => w.worker_id === workerId);

        if (existingWorkerIndex === -1) {
          dailySummary.workers.push({
            worker_id: workerId,
            name: record.workers.name,
            hours: parseFloat(record.work_hours) || 0,
            amount: parseFloat(record.daily_wage) || 0,
            status: record.payment_status || "unpaid",
          });
        }

        dailySummary.totalAmount += parseFloat(record.daily_wage) || 0;

        if (record.payment_status === "paid") {
          dailySummary.paidAmount += parseFloat(record.daily_wage) || 0;
          totalPaid += parseFloat(record.daily_wage) || 0;
        } else {
          dailySummary.unpaidAmount += parseFloat(record.daily_wage) || 0;
          totalUnpaid += parseFloat(record.daily_wage) || 0;
        }

        // 근로자별 데이터 구성
        if (!workerMap.has(workerId)) {
          workerMap.set(workerId, {
            worker_id: workerId,
            name: record.workers.name,
            resident_number: record.workers.resident_number,
            contact_number: record.workers.contact_number,
            job_code: record.workers.job_code,
            records: [],
            totalHours: 0,
            totalWage: 0,
            totalAllowance: 0,
            totalTaxExemption: 0,
            totalIncomeTax: 0,
            totalLocalTax: 0,
            totalNationalPension: 0,
            totalHealthInsurance: 0,
            totalEmploymentInsurance: 0,
            totalIndustrialAccident: 0,
            totalLongTermCare: 0,
            totalDeduction: 0,
            netPay: 0,
          });
        }

        const worker = workerMap.get(workerId);

        // 금액 계산
        const workHours = parseFloat(record.work_hours) || 0;
        const dailyWage = parseFloat(record.daily_wage) || 0;
        const overtimeAllowance = parseFloat(record.overtime_allowance) || 0;
        const nightAllowance = parseFloat(record.night_allowance) || 0;
        const holidayAllowance = parseFloat(record.holiday_allowance) || 0;
        const extraAllowance = parseFloat(record.extra_allowance) || 0;
        const totalAllowance =
          overtimeAllowance + nightAllowance + holidayAllowance + extraAllowance;
        const taxExemption = parseFloat(record.tax_exemption_amount) || 0;

        // 세금 계산 (DB에 저장된 값이 있으면 사용, 없으면 계산)
        let incomeTax, localTax;
        const totalPayAmount = dailyWage + totalAllowance;

        if (
          record.income_tax !== null &&
          record.income_tax !== undefined &&
          record.local_income_tax !== null &&
          record.local_income_tax !== undefined
        ) {
          // DB에 저장된 값 사용
          incomeTax = parseFloat(record.income_tax) || 0;
          localTax = parseFloat(record.local_income_tax) || 0;
        } else {
          // 세금 계산 로직 적용
          const dailyIncomeDeduction = 150000; // 일용근로소득 공제액 15만원
          const incomeTaxRate = 0.06; // 소득세율 6%
          const taxReductionRate = 0.45; // 소득세 감면율 45%
          const localTaxRate = 0.1; // 지방소득세율 10%
          const minTaxExemption = 1000; // 소액부징수 기준액 1,000원

          let dailyTaxableAmount = 0;
          let calculatedIncomeTax = 0;

          if (totalPayAmount > dailyIncomeDeduction) {
            dailyTaxableAmount = totalPayAmount - dailyIncomeDeduction;
            calculatedIncomeTax = Math.round(dailyTaxableAmount * incomeTaxRate * taxReductionRate);

            // 소액부징수 적용
            calculatedIncomeTax = calculatedIncomeTax < minTaxExemption ? 0 : calculatedIncomeTax;
          }

          incomeTax = calculatedIncomeTax;
          localTax = Math.round(incomeTax * localTaxRate);
        }

        // 공제금액 (DB에 저장된 값 사용)
        const nationalPension = parseFloat(record.national_pension) || 0;
        const healthInsurance = parseFloat(record.health_insurance) || 0;
        const employmentInsurance = parseFloat(record.employment_insurance) || 0;
        const industrialAccident = parseFloat(record.industrial_accident) || 0;
        const longTermCare = parseFloat(record.long_term_care) || 0;

        const totalDeduction =
          incomeTax +
          localTax +
          nationalPension +
          healthInsurance +
          employmentInsurance +
          industrialAccident +
          longTermCare;

        const netPay = totalPayAmount - totalDeduction;

        // 근로자 데이터에 추가
        worker.records.push({
          record_id: record.record_id,
          work_date: record.work_date,
          day: day,
          date: dateStr,
          hours: workHours,
          dailyWage: dailyWage,
          allowances: totalAllowance,
          taxExemption: taxExemption,
          incomeTax: incomeTax,
          localTax: localTax,
          nationalPension: nationalPension,
          healthInsurance: healthInsurance,
          employmentInsurance: employmentInsurance,
          industrialAccident: industrialAccident,
          longTermCare: longTermCare,
          totalDeduction: totalDeduction,
          netPay: netPay,
          status: record.payment_status || "unpaid",
          payment_date: record.payment_date,
          // 세금 계산을 위한 추가 정보
          totalPayAmount: dailyWage + totalAllowance,
          dailyIncomeDeduction: 150000,
          incomeTaxRate: 0.06,
          taxReductionRate: 0.45,
        });

        // 근로자 합계 갱신
        worker.totalHours += workHours;
        worker.totalWage += dailyWage;
        worker.totalAllowance += totalAllowance;
        worker.totalTaxExemption += taxExemption;
        worker.totalIncomeTax += incomeTax;
        worker.totalLocalTax += localTax;
        worker.totalNationalPension += nationalPension;
        worker.totalHealthInsurance += healthInsurance;
        worker.totalEmploymentInsurance += employmentInsurance;
        worker.totalIndustrialAccident += industrialAccident;
        worker.totalLongTermCare += longTermCare;
        worker.totalDeduction += totalDeduction;
        worker.netPay += netPay;
      });

      // 근로자 합계 업데이트 시 세금 계산 상수도 같이 저장
      const calcConstants = {
        dailyIncomeDeduction: 150000,
        incomeTaxRate: 0.06,
        taxReductionRate: 0.45,
        localTaxRate: 0.1,
        minTaxExemption: 1000,
      };

      // 근로자 데이터 배열과 일자별 요약 객체로 변환
      const workerDataArray = Array.from(workerMap.values());
      const dailySummariesObj = Object.fromEntries(dailyMap.entries());

      // 전체 요약 정보 업데이트
      setPayrollSummary({
        totalWorkers: workerMap.size,
        totalWorkDays: dailyMap.size,
        totalPaid: totalPaid,
        totalUnpaid: totalUnpaid,
        calcConstants: calcConstants, // 계산 상수 추가
      });

      setWorkerData(workerDataArray);
      setDailySummaries(dailySummariesObj);
    } catch (error) {
      console.error("일용직 급여 데이터 로드 오류:", error);
      setError("근로자 급여 정보를 불러오는 중 오류가 발생했습니다.");
      toast.error("근로자 급여 정보를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 개별 지급 처리 핸들러
  // 개별 지급 처리 핸들러 (수정된 버전)
  const handlePayment = async (record, worker, selectedDate = null) => {
    try {
      // 날짜가 선택되지 않았으면 모달을 보여줌
      if (!selectedDate) {
        setPaymentInfo({
          recordId: record.record_id,
          workerId: worker.worker_id,
          worker: worker.name,
          date: record.date,
          workDate: record.work_date,
          amount: record.dailyWage,
          netAmount: record.netPay,
        });
        setShowPaymentModal(true);
        return;
      }

      // 선택한 날짜 포맷팅 (YYYY-MM-DD)
      const paymentDate = selectedDate ? formatDate(selectedDate) : formatDate(new Date());

      setLoading(true);

      // 세금 다시 계산
      const dailyWage = parseFloat(record.dailyWage) || 0;
      const allowances = parseFloat(record.allowances || 0) || 0;
      const taxExemption = parseFloat(record.taxExemption || 0) || 0;
      const totalPayAmount = dailyWage + allowances;

      // 세금 계산 상수
      const dailyIncomeDeduction = 150000; // 일용근로소득 공제액 15만원
      const incomeTaxRate = 0.06; // 소득세율 6%
      const taxReductionRate = 0.45; // 소득세 감면율 45%
      const localTaxRate = 0.1; // 지방소득세율 10%
      const minTaxExemption = 1000; // 소액부징수 기준액 1,000원

      // 과세대상금액 계산 (비과세 제외)
      const taxableAmount = Math.max(0, totalPayAmount - taxExemption);

      // 소득세 계산
      let taxableIncome = 0;
      let incomeTax = 0;

      if (taxableAmount > dailyIncomeDeduction) {
        taxableIncome = taxableAmount - dailyIncomeDeduction;
        incomeTax = Math.round(taxableIncome * incomeTaxRate * taxReductionRate);

        // 소액부징수 적용
        incomeTax = incomeTax < minTaxExemption ? 0 : incomeTax;
      }

      // 주민세 계산 (소득세의 10%)
      const localTax = Math.round(incomeTax * localTaxRate);

      // 고용보험료 계산 (0.9%)
      const employmentInsurance = Math.round(taxableAmount * 0.009);

      // 지급 상태 업데이트할 데이터
      const updateData = {
        payment_status: "paid",
        payment_date: paymentDate,
        payment_method: "계좌이체", // 기본값 설정 또는 사용자 선택으로 변경 가능
        income_tax: incomeTax,
        local_income_tax: localTax,
        employment_insurance: employmentInsurance,
      };

      // 데이터베이스 업데이트
      const { error } = await supabase
        .from("work_records")
        .update(updateData)
        .eq("record_id", record.record_id);

      if (error) throw error;

      // 성공 메시지 표시
      toast.success(`${worker.name}님에게 ${paymentDate}에 지급 처리되었습니다.`);

      // 데이터 새로고침
      await fetchDailyWorkerPayrollData();
    } catch (error) {
      console.error("지급 처리 오류:", error);
      toast.error("지급 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 일괄 지급 처리 핸들러
  const handleBulkPayment = (dateStr, workers) => {
    // 지급 날짜의 모든 미지급 근로자 정보 수집
    const dailySummary = dailySummaries[dateStr];
    if (!dailySummary) return;

    // 미지급 항목만 필터링
    const unpaidWorkers = [];
    let totalAmount = 0;

    // 각 근로자별로 해당 날짜의 미지급 항목 찾기
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

    if (unpaidWorkers.length === 0) {
      toast.info("미지급 항목이 없습니다.");
      return;
    }

    setBulkPaymentInfo({
      date: dateStr,
      workDate: dailySummary.date,
      items: unpaidWorkers,
      totalAmount: totalAmount,
    });

    setShowBulkPaymentModal(true);
  };

  // 지급 확정 처리
  const confirmPayment = async (recordId, paymentMethod, memo) => {
    try {
      setLoading(true);

      const currentDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

      // 먼저, 해당 기록의 데이터를 가져옴
      const { data: recordData, error: recordDataError } = await supabase
        .from("work_records")
        .select("*")
        .eq("record_id", recordId)
        .single();

      if (recordDataError) throw recordDataError;

      // 세금 다시 계산
      const dailyWage = parseFloat(recordData.daily_wage) || 0;
      const overtimeAllowance = parseFloat(recordData.overtime_allowance) || 0;
      const nightAllowance = parseFloat(recordData.night_allowance) || 0;
      const holidayAllowance = parseFloat(recordData.holiday_allowance) || 0;
      const extraAllowance = parseFloat(recordData.extra_allowance) || 0;
      const totalPayAmount =
        dailyWage + overtimeAllowance + nightAllowance + holidayAllowance + extraAllowance;
      const taxExemption = parseFloat(recordData.tax_exemption_amount) || 0;

      // 과세대상금액 계산 (비과세 제외)
      const taxableAmount = Math.max(0, totalPayAmount - taxExemption);

      // 세금 계산 상수
      const dailyIncomeDeduction = 150000; // 일용근로소득 공제액 15만원
      const incomeTaxRate = 0.06; // 소득세율 6%
      const taxReductionRate = 0.45; // 소득세 감면율 45%
      const localTaxRate = 0.1; // 지방소득세율 10%
      const minTaxExemption = 1000; // 소액부징수 기준액 1,000원

      // 소득세 계산
      let taxableIncome = 0;
      let incomeTax = 0;

      if (taxableAmount > dailyIncomeDeduction) {
        taxableIncome = taxableAmount - dailyIncomeDeduction;
        incomeTax = Math.round(taxableIncome * incomeTaxRate * taxReductionRate);

        // 소액부징수 적용
        incomeTax = incomeTax < minTaxExemption ? 0 : incomeTax;
      }

      // 주민세 계산 (소득세의 10%)
      const localTax = Math.round(incomeTax * localTaxRate);

      // 고용보험료 계산 (0.9%)
      const employmentInsurance = Math.round(taxableAmount * 0.009);

      // 지급 상태 업데이트
      const { error } = await supabase
        .from("work_records")
        .update({
          payment_status: "paid",
          payment_date: currentDate,
          payment_method: paymentMethod,
          payment_memo: memo,
          income_tax: incomeTax,
          local_income_tax: localTax,
          employment_insurance: employmentInsurance,
        })
        .eq("record_id", recordId);

      if (error) throw error;

      // 성공 메시지 표시
      toast.success("지급이 완료되었습니다.");
      setPaymentSuccess(true);
      // 캐시 무효화
      try {
        const workTimeStore = require("@/lib/store/workTimeStore").default;
        if (workTimeStore) {
          workTimeStore.setState((state) => ({
            ...state,
            workReports: {},
          }));
          console.log("지급 처리 후 workTimeStore 캐시가 성공적으로 무효화되었습니다.");
        }
      } catch (e) {
        console.error("지급 처리 후 workTimeStore 캐시 무효화 중 오류 발생:", e);
      }
      // 모달 닫기
      setShowPaymentModal(false);

      // 데이터 새로고침
      fetchDailyWorkerPayrollData();
    } catch (error) {
      console.error("지급 처리 오류:", error);
      toast.error("지급 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 지급 상태 업데이트 함수 추가
  // 지급 상태 업데이트 함수
  // 지급 상태 업데이트 함수
  const updatePaymentStatus = async (recordId, newStatus) => {
    console.log(`updatePaymentStatus 호출됨: recordId=${recordId}, newStatus=${newStatus}`);

    if (!recordId) {
      console.error("recordId가 없습니다");
      return false;
    }

    try {
      setLoading(true);

      // 먼저 현재 레코드 데이터 확인
      const { data: currentRecord, error: fetchError } = await supabase
        .from("work_records")
        .select("*")
        .eq("record_id", recordId)
        .single();

      if (fetchError) {
        console.error("현재 레코드 조회 오류:", fetchError);
        toast.error("레코드 정보를 조회하는 중 오류가 발생했습니다.");
        return false;
      }

      console.log("현재 레코드 정보:", currentRecord);

      // 업데이트할 데이터 준비
      const updateData = {
        payment_status: newStatus,
      };

      // payment_date 처리 - unpaid면 null로 설정
      if (newStatus === "unpaid") {
        updateData.payment_date = null;
      }

      console.log("업데이트할 데이터:", updateData);

      // Supabase 업데이트 호출
      const { data, error } = await supabase
        .from("work_records")
        .update(updateData)
        .eq("record_id", recordId)
        .select();

      if (error) {
        console.error("레코드 상태 업데이트 오류:", error);
        toast.error("지급 상태 변경 중 오류가 발생했습니다.");
        return false;
      }

      console.log("업데이트 성공:", data);

      // 성공 시 토스트 메시지 표시
      toast.success(
        `지급 상태가 '${newStatus === "unpaid" ? "미지급" : "지급"}'으로 변경되었습니다.`
      );

      // 데이터 새로고침
      await fetchDailyWorkerPayrollData();

      return true;
    } catch (error) {
      console.error("지급 상태 변경 오류:", error);
      toast.error("지급 상태 변경 중 오류가 발생했습니다.");
      return false;
    } finally {
      setLoading(false);
    }
  };
  // 날짜를 YYYY-MM-DD 형식으로 포맷팅하는 함수
  const formatDate = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };
  // 일괄 지급 확정 처리
  // 일괄 지급 확정 처리 - 수정 버전
  const confirmBulkPayment = async (items, paymentMethod, memo, paymentDate = null) => {
    try {
      setLoading(true);

      // 날짜 처리: 선택한 날짜가 있으면 사용, 없으면 현재 날짜 사용
      let formattedDate;

      if (paymentDate) {
        // Date 객체인 경우 문자열로 변환
        if (paymentDate instanceof Date) {
          formattedDate = formatDate(paymentDate);
        } else {
          formattedDate = paymentDate; // 이미 문자열 형식인 경우
        }
      } else {
        // 날짜가 없는 경우 현재 날짜 사용
        formattedDate = new Date().toISOString().slice(0, 10);
      }

      console.log(`일괄 지급처리 - 선택된 지급일: ${formattedDate}`);

      // 각 아이템의 모든 레코드에 대해 지급 상태 업데이트
      const recordIds = items.flatMap((item) => item.records.map((record) => record.record_id));

      // 먼저, 모든 기록의 데이터를 가져옴
      const { data: recordsData, error: recordsDataError } = await supabase
        .from("work_records")
        .select("*")
        .in("record_id", recordIds);

      if (recordsDataError) throw recordsDataError;

      // 세금 계산 상수
      const dailyIncomeDeduction = 150000; // 일용근로소득 공제액 15만원
      const incomeTaxRate = 0.06; // 소득세율 6%
      const taxReductionRate = 0.45; // 소득세 감면율 45%
      const localTaxRate = 0.1; // 지방소득세율 10%
      const minTaxExemption = 1000; // 소액부징수 기준액 1,000원

      // 각 기록에 대해 세금 계산 및 업데이트
      const updatePromises = recordsData.map(async (record) => {
        // 세금 다시 계산
        const dailyWage = parseFloat(record.daily_wage) || 0;
        const overtimeAllowance = parseFloat(record.overtime_allowance) || 0;
        const nightAllowance = parseFloat(record.night_allowance) || 0;
        const holidayAllowance = parseFloat(record.holiday_allowance) || 0;
        const extraAllowance = parseFloat(record.extra_allowance) || 0;
        const totalPayAmount =
          dailyWage + overtimeAllowance + nightAllowance + holidayAllowance + extraAllowance;

        // 소득세 계산
        let dailyTaxableAmount = 0;
        let incomeTax = 0;

        if (totalPayAmount > dailyIncomeDeduction) {
          dailyTaxableAmount = totalPayAmount - dailyIncomeDeduction;
          incomeTax = Math.round(dailyTaxableAmount * incomeTaxRate * taxReductionRate);

          // 소액부징수 적용
          incomeTax = incomeTax < minTaxExemption ? 0 : incomeTax;
        }

        // 주민세 계산 (소득세의 10%)
        const localTax = Math.round(incomeTax * localTaxRate);

        // 기록 업데이트
        return supabase
          .from("work_records")
          .update({
            payment_status: "paid",
            payment_date: formattedDate, // 여기서 선택한 날짜 사용
            payment_method: paymentMethod,
            payment_memo: memo,
            income_tax: incomeTax,
            local_income_tax: localTax,
          })
          .eq("record_id", record.record_id);
      });

      // 모든 업데이트 프로미스 실행
      await Promise.all(updatePromises);

      // 성공 메시지 표시
      toast.success(`일괄 지급이 ${formattedDate}로 완료되었습니다.`);
      setPaymentSuccess(true);
      // 캐시 무효화
      try {
        const workTimeStore = require("@/lib/store/workTimeStore").default;
        if (workTimeStore) {
          workTimeStore.setState((state) => ({
            ...state,
            workReports: {},
          }));
          console.log("지급 처리 후 workTimeStore 캐시가 성공적으로 무효화되었습니다.");
        }
      } catch (e) {
        console.error("지급 처리 후 workTimeStore 캐시 무효화 중 오류 발생:", e);
      }

      // 모달 닫기
      setShowBulkPaymentModal(false);

      // 데이터 새로고침
      fetchDailyWorkerPayrollData();
    } catch (error) {
      console.error("일괄 지급 처리 오류:", error);
      toast.error("일괄 지급 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };
  // 단일 근무 기록 업데이트 함수
  const updateRecord = async (updatedRecord) => {
    try {
      console.log("레코드 업데이트 시작:", updatedRecord);

      // 레코드에 payment_date가 있고 Date 객체인 경우 문자열로 변환
      let paymentDate = updatedRecord.payment_date;
      if (paymentDate && paymentDate instanceof Date) {
        paymentDate = paymentDate.toISOString().split("T")[0]; // YYYY-MM-DD 형식으로 변환
      }

      // 업데이트할 데이터 준비
      const updateData = {
        ...updatedRecord,
        payment_date: paymentDate, // Date 객체를 문자열로 변환한 값 사용
      };

      // 서버로 업데이트 요청 보내기
      const { error } = await supabase
        .from("work_records")
        .update({
          payment_date: paymentDate,
          // 다른 필드도 필요한 경우 여기에 추가
        })
        .eq("record_id", updatedRecord.record_id);

      if (error) {
        console.error("레코드 업데이트 오류:", error);
        throw error;
      }

      // 성공 시 토스트 메시지 표시
      toast.success("지급일이 성공적으로 업데이트되었습니다.");

      // 데이터 새로고침
      await fetchDailyWorkerPayrollData();

      console.log("레코드 업데이트 성공:", updatedRecord);
      return true;
    } catch (error) {
      console.error("레코드 업데이트 오류:", error);
      toast.error("레코드 업데이트 중 오류가 발생했습니다.");
      return false;
    }
  };

  // 소득세 계산 함수
  // const calculateIncomeTax = (dailyWage, allowances, taxExemption) => {
  //   // 비과세를 제외한 과세 대상 총액
  //   const taxablePayAmount = dailyWage + allowances - taxExemption;

  //   // 세금 계산 상수
  //   const dailyIncomeDeduction = 150000; // 일용근로소득 공제액 15만원
  //   const incomeTaxRate = 0.06; // 소득세율 6%
  //   const taxReductionRate = 0.45; // 소득세 감면율 45%
  //   const minTaxExemption = 1000; // 소액부징수 기준액 1,000원

  //   // 소득세 계산
  //   let incomeTax = 0;

  //   // 비과세 제외 후 공제액 초과 금액에 대해서만 세금 계산
  //   if (taxablePayAmount > dailyIncomeDeduction) {
  //     const taxableAmount = taxablePayAmount - dailyIncomeDeduction;
  //     incomeTax = Math.round(taxableAmount * incomeTaxRate * taxReductionRate);

  //     // 소액부징수 적용
  //     incomeTax = incomeTax < minTaxExemption ? 0 : incomeTax;
  //   }

  //   return Math.max(0, incomeTax);
  // };

  // // 지방소득세 계산 함수 (소득세의 10%)
  // const calculateLocalTax = (incomeTax) => {
  //   return Math.round(incomeTax * 0.1);
  // };
  // 급여명세서 표시
  // 급여명세서 표시
  // 급여명세서 표시
  // 급여명세서 표시
  const showPayslip = (worker) => {
    // 세금 계산 함수들
    const calculateIncomeTax = (dailyWage, allowances, taxExemption) => {
      // 과세 대상 총액 계산
      const dailyTotal = Number(dailyWage) || 0;
      const allowanceTotal = Number(allowances) || 0;
      const exemptionTotal = Number(taxExemption) || 0;

      const taxablePayAmount = dailyTotal + allowanceTotal - exemptionTotal;

      // 상세 디버깅 로그
      console.log(
        `소득세 계산 - 일당: ${dailyTotal}, 수당: ${allowanceTotal}, 비과세: ${exemptionTotal}, 과세대상: ${taxablePayAmount}`
      );

      // 일용근로소득공제 적용 (15만원)
      if (taxablePayAmount <= 150000) {
        console.log(`과세대상(${taxablePayAmount})이 15만원 이하여서 소득세 0`);
        return 0;
      }

      // 과세표준 계산
      const taxBase = taxablePayAmount - 150000;

      // 세액 계산 (과세표준 x 세율(6%) x 감면율(45%))
      let tax = Math.round(taxBase * 0.06 * 0.45);

      // 소액부징수 적용 (1,000원 미만 면제)
      if (tax < 1000) {
        console.log(`계산된 세액(${tax})이 1,000원 미만이어서 소득세 0`);
        return 0;
      }

      console.log(`최종 소득세: ${tax}`);
      return tax;
    };

    const calculateLocalTax = (incomeTax) => {
      const localTax = Math.round(Number(incomeTax) * 0.1);
      console.log(`지방소득세 계산: ${incomeTax} x 10% = ${localTax}`);
      return localTax;
    };

    // 근로자 기록에 세금 정보 추가 및 계산
    const completedRecords = worker.records.map((record) => {
      // 기본값 확인
      const dailyWage = Number(record.dailyWage) || 0;
      const allowances = Number(record.allowances) || 0;
      const taxExemption = Number(record.taxExemption) || 0;

      console.log(
        `레코드 처리(${record.date}) - 일당: ${dailyWage}, 수당: ${allowances}, 비과세: ${taxExemption}`
      );

      // 각 날짜별 세금 계산
      const incomeTax = calculateIncomeTax(dailyWage, allowances, taxExemption);
      const localTax = calculateLocalTax(incomeTax);

      // 고용보험료 계산 (0.9%)
      const taxableAmount = Math.max(0, dailyWage + allowances - taxExemption);
      const employmentInsurance = Math.floor(taxableAmount * 0.009);

      // 공제 합계
      const totalDeduction =
        Number(incomeTax) +
        Number(localTax) +
        Number(record.nationalPension || 0) +
        Number(record.healthInsurance || 0) +
        Number(employmentInsurance) +
        Number(record.industrialAccident || 0) +
        Number(record.longTermCare || 0);

      // 실지급액 계산
      const netPay = dailyWage + allowances - totalDeduction;

      console.log(
        `레코드 계산 결과 - 소득세: ${incomeTax}, 지방세: ${localTax}, 고용보험: ${employmentInsurance}, 총공제: ${totalDeduction}, 실지급: ${netPay}`
      );

      // 업데이트된 레코드 반환
      return {
        ...record,
        incomeTax: incomeTax,
        localTax: localTax,
        employmentInsurance: employmentInsurance,
        totalDeduction: totalDeduction,
        netPay: netPay,
      };
    });

    // 세금 및 공제 합계 계산
    const totalIncomeTax = completedRecords.reduce((sum, r) => sum + Number(r.incomeTax || 0), 0);
    const totalLocalTax = completedRecords.reduce((sum, r) => sum + Number(r.localTax || 0), 0);
    const totalEmploymentInsurance = completedRecords.reduce(
      (sum, r) => sum + Number(r.employmentInsurance || 0),
      0
    );
    const totalDeductions = completedRecords.reduce(
      (sum, r) => sum + Number(r.totalDeduction || 0),
      0
    );

    // 총 실지급액 계산
    const totalWage = Number(worker.totalWage) || 0;
    const totalAllowance = Number(worker.totalAllowance) || 0;
    const netPay = totalWage + totalAllowance - totalDeductions;

    // 디버깅용 요약 로그
    console.log("급여명세서 요약:", {
      총일당: totalWage,
      총수당: totalAllowance,
      총소득세: totalIncomeTax,
      총지방세: totalLocalTax,
      총고용보험: totalEmploymentInsurance,
      총공제액: totalDeductions,
      총실지급액: netPay,
    });

    // 명세서 데이터 설정
    setPayslipInfo({
      worker_id: worker.worker_id,
      name: worker.name,
      resident_number: worker.resident_number,
      contact_number: worker.contact_number,
      job: worker.job_code || "일용직",
      workRecords: completedRecords,
      totalHours: worker.totalHours || 0,
      totalWage: totalWage,
      totalAllowance: totalAllowance,
      totalTaxExemption: worker.totalTaxExemption || 0,
      totalIncomeTax: totalIncomeTax,
      totalLocalTax: totalLocalTax,
      totalNationalPension: worker.totalNationalPension || 0,
      totalHealthInsurance: worker.totalHealthInsurance || 0,
      totalEmploymentInsurance: totalEmploymentInsurance,
      totalDeductions: totalDeductions,
      netPay: netPay,
      yearMonth: yearMonth,
    });

    setShowPayslipModal(true);
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
        <div className="w-full mx-auto px-4 py-8">
          <header className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">일용근로자 일당 지급 관리</h1>

            {/* 컨트롤 패널 */}
            <div className="bg-white p-4 rounded-lg shadow-md mb-6 print:hidden">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center space-x-4">
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
                      className="mt-1 block w-40 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                    />
                  </div>

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
                      className="mt-1 block w-48 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
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
                </div>

                {/* <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      const allDates = Object.keys(dailySummaries);
                      if (allDates.length > 0) {
                        handleBulkPayment("전체", allDates);
                      } else {
                        toast.info("미지급 항목이 없습니다.");
                      }
                    }}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    disabled={loading || Object.keys(dailySummaries).length === 0}
                  >
                    미지급 일당 일괄 지급
                  </button>
                  <button
                    onClick={goToAddWorkRecord}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    근무기록 추가
                  </button>
                  <button
                    onClick={handlePrint}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <Printer size={16} className="mr-2" />
                    인쇄
                  </button>
                </div> */}
              </div>
            </div>

            {/* 현장 정보 및 요약 */}
            {selectedSite && (
              <div className="bg-white p-4 rounded-lg shadow-md mb-6 border border-gray-300">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">현장 정보</h2>
                    <p className="text-gray-700">
                      현장명:{" "}
                      {(sites && sites.find((site) => site.site_id == selectedSite)?.site_name) ||
                        (directSites &&
                          directSites.find((site) => site.site_id == selectedSite)?.site_name) ||
                        "선택된 현장 없음"}
                    </p>
                    <p className="text-gray-700">
                      조회 월:{" "}
                      {yearMonth && `${yearMonth.split("-")[0]}년 ${yearMonth.split("-")[1]}월`}
                    </p>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">지급 요약</h2>
                    <p className="text-gray-700">근로자 수: {payrollSummary.totalWorkers}명</p>
                    <p className="text-gray-700">
                      총 근무 건수:{" "}
                      {workerData.reduce((sum, worker) => sum + worker.records.length, 0)}건
                    </p>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">금액 요약</h2>
                    <p className="text-gray-700">
                      지급액: {formatNumber(payrollSummary.totalPaid)}원
                    </p>
                    <p className="text-gray-700">
                      미지급액: {formatNumber(payrollSummary.totalUnpaid)}원
                    </p>
                  </div>
                </div>
              </div>
            )}
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
                  updateRecord={updateRecord} // 이 라인을 추가합니다
                  updatePaymentStatus={updatePaymentStatus} // 추가된 props
                />
              ) : (
                <div className="bg-white p-4 rounded-lg shadow-md mb-6 text-center">
                  <p className="text-gray-500">
                    해당 기간에 등록된 일용직 근로자 급여 내역이 없습니다.
                  </p>
                </div>
              )}

              {/* 일자별 요약 */}
              {Object.keys(dailySummaries).length > 0 && (
                <DailyWorkerSummary
                  dailySummaries={dailySummaries}
                  handleBulkPayment={handleBulkPayment}
                />
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

        {/* 일괄 지급 모달 */}
        {showBulkPaymentModal && (
          <BulkPaymentModal
            bulkPaymentInfo={bulkPaymentInfo}
            onClose={() => setShowBulkPaymentModal(false)}
            onConfirm={confirmBulkPayment}
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
        <ToastContainer position="bottom-right" />
      </div>
    </RoleGuard>
  );
}

/***
 *
 *
 *
 *
 *
 *
 *
 *
 *
 */
// "use client";
// import React, { useState } from "react";

// export default function DailyWorkerManagement() {
//   const [yearMonth, setYearMonth] = useState("2024-05");
//   const [selectedSite, setSelectedSite] = useState("1");
//   const [showPaymentModal, setShowPaymentModal] = useState(false);
//   const [showBulkPaymentModal, setShowBulkPaymentModal] = useState(false);
//   const [showPayslipModal, setShowPayslipModal] = useState(false);
//   const [paymentInfo, setPaymentInfo] = useState({
//     worker: "홍길동",
//     date: "2024년 5월 17일",
//     amount: "170,000원",
//   });
//   const [bulkPaymentInfo, setBulkPaymentInfo] = useState({
//     date: "5월 21일",
//     items: [
//       { name: "홍길동", job: "목수", amount: "150,000원" },
//       { name: "김철수", job: "전기공", amount: "210,000원" },
//     ],
//     totalAmount: "360,000원",
//   });
//   const [payslipInfo, setPayslipInfo] = useState({
//     worker: "",
//     job: "",
//     workRecords: [],
//     totalPay: 0,
//     totalDeductions: 0,
//     netPay: 0,
//   });

//   const handlePayment = (worker, date, amount) => {
//     setPaymentInfo({
//       worker,
//       date,
//       amount,
//     });
//     setShowPaymentModal(true);
//   };

//   const handleBulkPayment = (date, items, totalAmount) => {
//     setBulkPaymentInfo({
//       date,
//       items,
//       totalAmount,
//     });
//     setShowBulkPaymentModal(true);
//   };

//   const confirmPayment = () => {
//     // 실제 구현에서는 DB 연결 및 데이터 업데이트 로직이 들어갈 것
//     setShowPaymentModal(false);
//     alert("지급이 완료되었습니다.");
//   };

//   const confirmBulkPayment = () => {
//     // 실제 구현에서는 DB 연결 및 데이터 업데이트 로직이 들어갈 것
//     setShowBulkPaymentModal(false);
//     alert("일괄 지급이 완료되었습니다.");
//   };

//   const handlePrint = () => {
//     window.print();
//   };

//   const showPayslip = (worker, job) => {
//     // 해당 근로자의 근무 기록을 찾음 (실제 구현에서는 DB에서 조회)
//     let workRecords = [];
//     let totalPay = 0;

//     if (worker === "홍길동") {
//       workRecords = [
//         {
//           date: "5월 14일",
//           hours: 8,
//           dailyPay: 170000,
//           taxFree: 12000,
//           incomeTax: 5100,
//           residentTax: 510,
//           pension: 7650,
//           healthIns: 5950,
//           employmentIns: 1700,
//           longTermCareIns: 850,
//           unionDues: 10000,
//           netPay: 138240,
//         },
//         {
//           date: "5월 17일",
//           hours: 8,
//           dailyPay: 170000,
//           taxFree: 12000,
//           incomeTax: 5100,
//           residentTax: 510,
//           pension: 7650,
//           healthIns: 5950,
//           employmentIns: 1700,
//           longTermCareIns: 850,
//           unionDues: 10000,
//           netPay: 138240,
//         },
//         {
//           date: "5월 21일",
//           hours: 7,
//           dailyPay: 150000,
//           taxFree: 12000,
//           incomeTax: 4140,
//           residentTax: 414,
//           pension: 6930,
//           healthIns: 5270,
//           employmentIns: 1500,
//           longTermCareIns: 785,
//           unionDues: 10000,
//           netPay: 120961,
//         },
//         {
//           date: "5월 30일",
//           hours: 7.5,
//           dailyPay: 160000,
//           taxFree: 12000,
//           incomeTax: 4440,
//           residentTax: 444,
//           pension: 7110,
//           healthIns: 5600,
//           employmentIns: 1600,
//           longTermCareIns: 800,
//           unionDues: 10000,
//           netPay: 130006,
//         },
//       ];
//       totalPay = 650000;
//     } else if (worker === "김철수") {
//       workRecords = [
//         {
//           date: "5월 14일",
//           hours: 8,
//           dailyPay: 210000,
//           taxFree: 12000,
//           incomeTax: 6540,
//           residentTax: 654,
//           pension: 9270,
//           healthIns: 7350,
//           employmentIns: 2100,
//           longTermCareIns: 1050,
//           unionDues: 10000,
//           netPay: 173036,
//         },
//         {
//           date: "5월 21일",
//           hours: 8,
//           dailyPay: 210000,
//           taxFree: 12000,
//           incomeTax: 6540,
//           residentTax: 654,
//           pension: 9270,
//           healthIns: 7350,
//           employmentIns: 2100,
//           longTermCareIns: 1050,
//           unionDues: 10000,
//           netPay: 173036,
//         },
//       ];
//       totalPay = 420000;
//     }

//     // 공제 합계 계산
//     const totalDeductions = workRecords.reduce((sum, record) => {
//       return (
//         sum +
//         record.incomeTax +
//         record.residentTax +
//         record.pension +
//         record.healthIns +
//         record.employmentIns +
//         record.longTermCareIns +
//         record.unionDues
//       );
//     }, 0);

//     // 실지급액 합계 계산
//     const netPay = workRecords.reduce((sum, record) => {
//       return sum + record.netPay;
//     }, 0);

//     setPayslipInfo({
//       worker,
//       job,
//       workRecords,
//       totalPay,
//       totalDeductions,
//       netPay,
//     });

//     setShowPayslipModal(true);
//   };

//   // 숫자 포맷팅 함수: 천 단위 콤마
//   const formatNumber = (num) => {
//     return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
//   };

//   return (
//     <div className="bg-gray-50 min-h-screen">
//       <div className="w-full mx-auto px-4 py-8">
//         <header className="mb-6">
//           <h1 className="text-2xl font-bold text-gray-900 mb-4">일용근로자 일당 지급 관리</h1>

//           {/* 컨트롤 패널 */}
//           <div className="bg-white p-4 rounded-lg shadow-md mb-6 print:hidden">
//             <div className="flex flex-wrap items-center justify-between gap-4">
//               <div className="flex items-center space-x-4">
//                 <div>
//                   <label htmlFor="year-month" className="block text-sm font-medium text-gray-700">
//                     조회 년월:
//                   </label>
//                   <input
//                     type="month"
//                     id="year-month"
//                     name="year-month"
//                     value={yearMonth}
//                     onChange={(e) => setYearMonth(e.target.value)}
//                     className="mt-1 block w-40 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
//                   />
//                 </div>

//                 <div>
//                   <label htmlFor="site-select" className="block text-sm font-medium text-gray-700">
//                     현장 선택:
//                   </label>
//                   <select
//                     id="site-select"
//                     name="site-select"
//                     value={selectedSite}
//                     onChange={(e) => setSelectedSite(e.target.value)}
//                     className="mt-1 block w-48 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
//                   >
//                     <option value="1">신도림 아파트 신축공사</option>
//                     <option value="2">강남역 복합상가 리모델링</option>
//                     <option value="3">판교 오피스빌딩 신축</option>
//                   </select>
//                 </div>
//               </div>

//               <div className="flex space-x-3">
//                 <button
//                   onClick={() =>
//                     handleBulkPayment(
//                       "전체",
//                       [
//                         { name: "홍길동", job: "목수", amount: "170,000원" },
//                         { name: "홍길동", job: "목수", amount: "150,000원" },
//                         { name: "홍길동", job: "목수", amount: "160,000원" },
//                         { name: "김철수", job: "전기공", amount: "210,000원" },
//                       ],
//                       "690,000원"
//                     )
//                   }
//                   className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
//                 >
//                   미지급 일당 일괄 지급
//                 </button>
//                 <button className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
//                   근무기록 추가
//                 </button>
//                 <button
//                   onClick={handlePrint}
//                   className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
//                 >
//                   인쇄
//                 </button>
//               </div>
//             </div>
//           </div>

//           {/* 현장 정보 및 요약 */}
//           <div className="bg-white p-4 rounded-lg shadow-md mb-6 border border-gray-300">
//             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//               <div>
//                 <h2 className="text-lg font-semibold text-gray-900">현장 정보</h2>
//                 <p className="text-gray-700">현장명: 신도림 아파트 신축공사</p>
//                 <p className="text-gray-700">담당자: 김현장</p>
//               </div>
//               <div>
//                 <h2 className="text-lg font-semibold text-gray-900">지급 요약</h2>
//                 <p className="text-gray-700">근로자 수: 2명</p>
//                 <p className="text-gray-700">총 근무 건수: 6건</p>
//               </div>
//               <div>
//                 <h2 className="text-lg font-semibold text-gray-900">금액 요약</h2>
//                 <p className="text-gray-700">지급액: 380,000원</p>
//                 <p className="text-gray-700">미지급액: 690,000원</p>
//               </div>
//             </div>
//           </div>
//         </header>

//         {/* 일용근로자 일당 관리 테이블 */}
//         <div className="overflow-x-auto bg-white rounded-lg shadow-md mb-6 p-4">
//           <style jsx>{`
//             .highlight-row:hover td {
//               background-color: rgba(59, 130, 246, 0.1);
//               transition: background-color 0.2s;
//             }

//             .highlight-row.special-row:hover td {
//               background-color: rgba(59, 130, 246, 0.2);
//             }

//             .highlight-row.total-row:hover td {
//               background-color: rgba(107, 114, 128, 0.2);
//             }
//           `}</style>

//           <table className="w-full border-collapse text-sm">
//             <thead className="bg-gray-50">
//               <tr>
//                 {/* 최상단 카테고리 헤더 */}
//                 <th className="border border-gray-200 p-2 bg-blue-100" colSpan="3">
//                   근로자
//                 </th>
//                 <th className="border border-gray-200 p-2 bg-green-100" colSpan="2">
//                   근무
//                 </th>
//                 <th className="border border-gray-200 p-2 bg-yellow-100" colSpan="3">
//                   지급
//                 </th>
//                 <th rowSpan="2" className="border border-gray-200 p-2 bg-purple-100" colSpan="1">
//                   비과세
//                 </th>
//                 <th className="border border-gray-200 p-2 bg-red-100" colSpan="7">
//                   공제액
//                 </th>
//                 <th rowSpan="2" className="border border-gray-200 p-2 bg-indigo-100" colSpan="1">
//                   실지급액
//                 </th>
//                 <th className="border border-gray-200 p-2 bg-gray-100" colSpan="2">
//                   지급상태
//                 </th>
//               </tr>
//               <tr className="text-center">
//                 {/* 세부 항목 헤더 */}
//                 {/* 근로자 */}
//                 <th className="border border-gray-200 p-2">이름</th>
//                 <th className="border border-gray-200 p-2">주민번호</th>
//                 <th className="border border-gray-200 p-2">직종</th>

//                 {/* 근무 */}
//                 <th className="border border-gray-200 p-2">근무일</th>
//                 <th className="border border-gray-200 p-2">근무시간</th>

//                 {/* 지급 */}
//                 <th className="border border-gray-200 p-2">일당</th>
//                 <th className="border border-gray-200 p-2">수당</th>
//                 <th className="border border-gray-200 p-2">지급계</th>

//                 {/* 비과세 */}
//                 {/* <th className="border border-gray-200 p-2">비과세</th> */}

//                 {/* 공제액 */}
//                 <th className="border border-gray-200 p-2">소득세</th>
//                 <th className="border border-gray-200 p-2">주민세</th>
//                 <th className="border border-gray-200 p-2">국민연금</th>
//                 <th className="border border-gray-200 p-2">건강보험</th>
//                 <th className="border border-gray-200 p-2">고용보험</th>
//                 <th className="border border-gray-200 p-2">장기요양</th>
//                 <th className="border border-gray-200 p-2">공제계</th>

//                 {/* 실지급액 */}
//                 {/* <th className="border border-gray-200 p-2">실지급액</th> */}

//                 {/* 지급상태 */}
//                 <th className="border border-gray-200 p-2">지급상태</th>
//                 <th className="border border-gray-200 p-2 print:hidden">지급일</th>
//               </tr>
//             </thead>
//             <tbody>
//               {/* 홍길동 근무 데이터 */}
//               <tr className="highlight-row">
//                 <td className="border border-gray-200 p-2" rowSpan="5">
//                   홍길동
//                 </td>
//                 <td className="border border-gray-200 p-2" rowSpan="5">
//                   901212-1******
//                 </td>
//                 <td className="border border-gray-200 p-2" rowSpan="5">
//                   목수
//                 </td>
//                 <td className="border border-gray-200 p-2">14일</td>
//                 <td className="border border-gray-200 p-2">8시간</td>
//                 <td className="border border-gray-200 p-2 text-right">170,000</td>
//                 <td className="border border-gray-200 p-2 text-right">0</td>
//                 <td className="border border-gray-200 p-2 text-right">170,000</td>
//                 <td className="border border-gray-200 p-2 text-right">12,000</td>
//                 <td className="border border-gray-200 p-2 text-right">5,100</td>
//                 <td className="border border-gray-200 p-2 text-right">510</td>
//                 <td className="border border-gray-200 p-2 text-right">7,650</td>
//                 <td className="border border-gray-200 p-2 text-right">5,950</td>
//                 <td className="border border-gray-200 p-2 text-right">1,700</td>
//                 <td className="border border-gray-200 p-2 text-right">850</td>
//                 <td className="border border-gray-200 p-2 text-right">31,760</td>
//                 <td className="border border-gray-200 p-2 text-right">138,240</td>
//                 <td className="border border-gray-200 p-2 text-center text-green-700 font-medium">
//                   지급
//                 </td>
//                 <td className="border border-gray-200 p-2 text-center print:hidden">2025.4.14</td>
//               </tr>
//               <tr className="highlight-row">
//                 <td className="border border-gray-200 p-2">17일</td>
//                 <td className="border border-gray-200 p-2">8시간</td>
//                 <td className="border border-gray-200 p-2 text-right">170,000</td>
//                 <td className="border border-gray-200 p-2 text-right">0</td>
//                 <td className="border border-gray-200 p-2 text-right">170,000</td>
//                 <td className="border border-gray-200 p-2 text-right">12,000</td>
//                 <td className="border border-gray-200 p-2 text-right">5,100</td>
//                 <td className="border border-gray-200 p-2 text-right">510</td>
//                 <td className="border border-gray-200 p-2 text-right">7,650</td>
//                 <td className="border border-gray-200 p-2 text-right">5,950</td>
//                 <td className="border border-gray-200 p-2 text-right">1,700</td>
//                 <td className="border border-gray-200 p-2 text-right">850</td>
//                 <td className="border border-gray-200 p-2 text-right">31,760</td>
//                 <td className="border border-gray-200 p-2 text-right">138,240</td>
//                 <td className="border border-gray-200 p-2 text-center text-red-600 font-medium">
//                   미지급
//                 </td>
//                 <td className="border border-gray-200 p-2 text-center print:hidden">
//                   <button
//                     onClick={() => handlePayment("홍길동", "2024년 5월 17일", "170,000원")}
//                     className="text-green-600 hover:text-green-900 focus:outline-none px-2 py-1 bg-green-100 rounded"
//                   >
//                     지급처리
//                   </button>
//                 </td>
//               </tr>
//               <tr className="highlight-row">
//                 <td className="border border-gray-200 p-2">21일</td>
//                 <td className="border border-gray-200 p-2">7시간</td>
//                 <td className="border border-gray-200 p-2 text-right">150,000</td>
//                 <td className="border border-gray-200 p-2 text-right">0</td>
//                 <td className="border border-gray-200 p-2 text-right">150,000</td>
//                 <td className="border border-gray-200 p-2 text-right">12,000</td>
//                 <td className="border border-gray-200 p-2 text-right">4,140</td>
//                 <td className="border border-gray-200 p-2 text-right">414</td>
//                 <td className="border border-gray-200 p-2 text-right">6,930</td>
//                 <td className="border border-gray-200 p-2 text-right">5,270</td>
//                 <td className="border border-gray-200 p-2 text-right">1,500</td>
//                 <td className="border border-gray-200 p-2 text-right">785</td>
//                 <td className="border border-gray-200 p-2 text-right">29,039</td>
//                 <td className="border border-gray-200 p-2 text-right">120,961</td>
//                 <td className="border border-gray-200 p-2 text-center text-red-600 font-medium">
//                   미지급
//                 </td>
//                 <td className="border border-gray-200 p-2 text-center print:hidden">
//                   <button
//                     onClick={() => handlePayment("홍길동", "2024년 5월 21일", "150,000원")}
//                     className="text-green-600 hover:text-green-900 focus:outline-none px-2 py-1 bg-green-100 rounded"
//                   >
//                     지급처리
//                   </button>
//                 </td>
//               </tr>
//               <tr className="highlight-row">
//                 <td className="border border-gray-200 p-2">30일</td>
//                 <td className="border border-gray-200 p-2">7.5시간</td>
//                 <td className="border border-gray-200 p-2 text-right">160,000</td>
//                 <td className="border border-gray-200 p-2 text-right">0</td>
//                 <td className="border border-gray-200 p-2 text-right">160,000</td>
//                 <td className="border border-gray-200 p-2 text-right">12,000</td>
//                 <td className="border border-gray-200 p-2 text-right">4,440</td>
//                 <td className="border border-gray-200 p-2 text-right">444</td>
//                 <td className="border border-gray-200 p-2 text-right">7,110</td>
//                 <td className="border border-gray-200 p-2 text-right">5,600</td>
//                 <td className="border border-gray-200 p-2 text-right">1,600</td>
//                 <td className="border border-gray-200 p-2 text-right">800</td>
//                 <td className="border border-gray-200 p-2 text-right">29,994</td>
//                 <td className="border border-gray-200 p-2 text-right">130,006</td>
//                 <td className="border border-gray-200 p-2 text-center text-red-600 font-medium">
//                   미지급
//                 </td>
//                 <td className="border border-gray-200 p-2 text-center print:hidden">
//                   <button
//                     onClick={() => handlePayment("홍길동", "2024년 5월 30일", "160,000원")}
//                     className="text-green-600 hover:text-green-900 focus:outline-none px-2 py-1 bg-green-100 rounded"
//                   >
//                     지급처리
//                   </button>
//                 </td>
//               </tr>
//               <tr className="highlight-row special-row bg-blue-50 font-medium">
//                 <td colSpan="2" className="border border-gray-200 p-2 text-right">
//                   소계
//                 </td>
//                 <td className="border border-gray-200 p-2 text-right">650,000</td>
//                 <td className="border border-gray-200 p-2 text-right">0</td>
//                 <td className="border border-gray-200 p-2 text-right">650,000</td>
//                 <td className="border border-gray-200 p-2 text-right">48,000</td>
//                 <td className="border border-gray-200 p-2 text-right">18,780</td>
//                 <td className="border border-gray-200 p-2 text-right">1,878</td>
//                 <td className="border border-gray-200 p-2 text-right">29,340</td>
//                 <td className="border border-gray-200 p-2 text-right">22,770</td>
//                 <td className="border border-gray-200 p-2 text-right">6,500</td>
//                 <td className="border border-gray-200 p-2 text-right">3,285</td>
//                 <td className="border border-gray-200 p-2 text-right">122,553</td>
//                 <td className="border border-gray-200 p-2 text-right">527,447</td>
//                 <td className="border border-gray-200 p-2" colSpan="2">
//                   <button
//                     onClick={() => showPayslip("홍길동", "목수")}
//                     className="w-full px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 focus:outline-none"
//                   >
//                     급여명세서
//                   </button>
//                 </td>
//               </tr>

//               {/* 김철수 근무 데이터 */}
//               <tr className="highlight-row">
//                 <td className="border border-gray-200 p-2" rowSpan="3">
//                   김철수
//                 </td>
//                 <td className="border border-gray-200 p-2" rowSpan="3">
//                   891010-1******
//                 </td>
//                 <td className="border border-gray-200 p-2" rowSpan="3">
//                   전기공
//                 </td>
//                 <td className="border border-gray-200 p-2">14일</td>
//                 <td className="border border-gray-200 p-2">8시간</td>
//                 <td className="border border-gray-200 p-2 text-right">210,000</td>
//                 <td className="border border-gray-200 p-2 text-right">0</td>
//                 <td className="border border-gray-200 p-2 text-right">210,000</td>
//                 <td className="border border-gray-200 p-2 text-right">12,000</td>
//                 <td className="border border-gray-200 p-2 text-right">6,540</td>
//                 <td className="border border-gray-200 p-2 text-right">654</td>
//                 <td className="border border-gray-200 p-2 text-right">9,270</td>
//                 <td className="border border-gray-200 p-2 text-right">7,350</td>
//                 <td className="border border-gray-200 p-2 text-right">2,100</td>
//                 <td className="border border-gray-200 p-2 text-right">1,050</td>
//                 <td className="border border-gray-200 p-2 text-right">36,964</td>
//                 <td className="border border-gray-200 p-2 text-right">173,036</td>
//                 <td className="border border-gray-200 p-2 text-center text-green-700 font-medium">
//                   지급
//                 </td>
//                 <td className="border border-gray-200 p-2 text-center print:hidden">2025.4.14</td>
//               </tr>
//               <tr className="highlight-row">
//                 <td className="border border-gray-200 p-2">21일</td>
//                 <td className="border border-gray-200 p-2">8시간</td>
//                 <td className="border border-gray-200 p-2 text-right">210,000</td>
//                 <td className="border border-gray-200 p-2 text-right">0</td>
//                 <td className="border border-gray-200 p-2 text-right">210,000</td>
//                 <td className="border border-gray-200 p-2 text-right">12,000</td>
//                 <td className="border border-gray-200 p-2 text-right">6,540</td>
//                 <td className="border border-gray-200 p-2 text-right">654</td>
//                 <td className="border border-gray-200 p-2 text-right">9,270</td>
//                 <td className="border border-gray-200 p-2 text-right">7,350</td>
//                 <td className="border border-gray-200 p-2 text-right">2,100</td>
//                 <td className="border border-gray-200 p-2 text-right">1,050</td>
//                 <td className="border border-gray-200 p-2 text-right">36,964</td>
//                 <td className="border border-gray-200 p-2 text-right">173,036</td>
//                 <td className="border border-gray-200 p-2 text-center text-red-600 font-medium">
//                   미지급
//                 </td>
//                 <td className="border border-gray-200 p-2 text-center print:hidden">
//                   <button
//                     onClick={() => handlePayment("김철수", "2024년 5월 21일", "210,000원")}
//                     className="text-green-600 hover:text-green-900 focus:outline-none px-2 py-1 bg-green-100 rounded"
//                   >
//                     지급처리
//                   </button>
//                 </td>
//               </tr>
//               <tr className="highlight-row special-row bg-blue-50 font-medium">
//                 <td colSpan="2" className="border border-gray-200 p-2 text-right">
//                   소계
//                 </td>
//                 <td className="border border-gray-200 p-2 text-right">420,000</td>
//                 <td className="border border-gray-200 p-2 text-right">0</td>
//                 <td className="border border-gray-200 p-2 text-right">420,000</td>
//                 <td className="border border-gray-200 p-2 text-right">24,000</td>
//                 <td className="border border-gray-200 p-2 text-right">13,080</td>
//                 <td className="border border-gray-200 p-2 text-right">1,308</td>
//                 <td className="border border-gray-200 p-2 text-right">18,540</td>
//                 <td className="border border-gray-200 p-2 text-right">14,700</td>
//                 <td className="border border-gray-200 p-2 text-right">4,200</td>
//                 <td className="border border-gray-200 p-2 text-right">2,100</td>
//                 <td className="border border-gray-200 p-2 text-right">73,928</td>
//                 <td className="border border-gray-200 p-2 text-right">346,072</td>
//                 <td className="border border-gray-200 p-2" colSpan="2">
//                   <button
//                     onClick={() => showPayslip("김철수", "전기공")}
//                     className="w-full px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 focus:outline-none"
//                   >
//                     급여명세서
//                   </button>
//                 </td>
//               </tr>

//               {/* 합계 행 */}
//               <tr className="highlight-row total-row bg-gray-200 font-medium">
//                 <td className="border border-gray-200 p-2 text-right" colSpan="5">
//                   합계
//                 </td>
//                 <td className="border border-gray-200 p-2 text-right">1,070,000</td>
//                 <td className="border border-gray-200 p-2 text-right">0</td>
//                 <td className="border border-gray-200 p-2 text-right">1,070,000</td>
//                 <td className="border border-gray-200 p-2 text-right">72,000</td>
//                 <td className="border border-gray-200 p-2 text-right">31,860</td>
//                 <td className="border border-gray-200 p-2 text-right">3,186</td>
//                 <td className="border border-gray-200 p-2 text-right">47,880</td>
//                 <td className="border border-gray-200 p-2 text-right">37,470</td>
//                 <td className="border border-gray-200 p-2 text-right">10,700</td>
//                 <td className="border border-gray-200 p-2 text-right">5,385</td>
//                 <td className="border border-gray-200 p-2 text-right">196,481</td>
//                 <td className="border border-gray-200 p-2 text-right">873,519</td>
//                 <td className="border border-gray-200 p-2" colSpan="2"></td>
//               </tr>
//             </tbody>
//           </table>
//         </div>

//         {/* 일자별 요약 */}
//         <div className="mb-8">
//           <h2 className="text-xl font-bold text-gray-900 mb-4">일자별 요약</h2>

//           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//             {/* 14일 요약 */}
//             <div className="bg-white p-4 rounded-lg shadow-md">
//               <div className="flex justify-between items-center mb-3">
//                 <h3 className="text-lg font-semibold">5월 14일</h3>
//                 <span className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded-full">
//                   모두 지급 완료
//                 </span>
//               </div>
//               <table className="w-full mb-3">
//                 <thead className="bg-gray-50 text-xs">
//                   <tr>
//                     <th className="px-2 py-1 text-left">이름</th>
//                     <th className="px-2 py-1 text-left">시간</th>
//                     <th className="px-2 py-1 text-right">일당</th>
//                     <th className="px-2 py-1 text-center">상태</th>
//                   </tr>
//                 </thead>
//                 <tbody className="text-sm">
//                   <tr>
//                     <td className="px-2 py-1">홍길동</td>
//                     <td className="px-2 py-1">8시간</td>
//                     <td className="px-2 py-1 text-right">170,000</td>
//                     <td className="px-2 py-1 text-center text-green-700 font-medium">지급</td>
//                   </tr>
//                   <tr>
//                     <td className="px-2 py-1">김철수</td>
//                     <td className="px-2 py-1">8시간</td>
//                     <td className="px-2 py-1 text-right">210,000</td>
//                     <td className="px-2 py-1 text-center text-green-700 font-medium">지급</td>
//                   </tr>
//                 </tbody>
//                 <tfoot className="border-t text-sm font-medium">
//                   <tr>
//                     <td className="px-2 py-1" colSpan="2">
//                       합계
//                     </td>
//                     <td className="px-2 py-1 text-right">380,000</td>
//                     <td className="px-2 py-1"></td>
//                   </tr>
//                 </tfoot>
//               </table>
//             </div>

//             {/* 17일 요약 */}
//             <div className="bg-white p-4 rounded-lg shadow-md">
//               <div className="flex justify-between items-center mb-3">
//                 <h3 className="text-lg font-semibold">5월 17일</h3>
//                 <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded-full">
//                   미지급 있음
//                 </span>
//               </div>
//               <table className="w-full mb-3">
//                 <thead className="bg-gray-50 text-xs">
//                   <tr>
//                     <th className="px-2 py-1 text-left">이름</th>
//                     <th className="px-2 py-1 text-left">시간</th>
//                     <th className="px-2 py-1 text-right">일당</th>
//                     <th className="px-2 py-1 text-center">상태</th>
//                   </tr>
//                 </thead>
//                 <tbody className="text-sm">
//                   <tr>
//                     <td className="px-2 py-1">홍길동</td>
//                     <td className="px-2 py-1">8시간</td>
//                     <td className="px-2 py-1 text-right">170,000</td>
//                     <td className="px-2 py-1 text-center text-red-600 font-medium">미지급</td>
//                   </tr>
//                 </tbody>
//                 <tfoot className="border-t text-sm font-medium">
//                   <tr>
//                     <td className="px-2 py-1" colSpan="2">
//                       합계
//                     </td>
//                     <td className="px-2 py-1 text-right">170,000</td>
//                     <td className="px-2 py-1"></td>
//                   </tr>
//                 </tfoot>
//               </table>
//               <div className="mt-2 print:hidden text-right">
//                 <button
//                   onClick={() =>
//                     handleBulkPayment(
//                       "5월 17일",
//                       [{ name: "홍길동", job: "목수", amount: "170,000원" }],
//                       "170,000원"
//                     )
//                   }
//                   className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none"
//                 >
//                   일괄 지급처리
//                 </button>
//               </div>
//             </div>

//             {/* 21일 요약 */}
//             <div className="bg-white p-4 rounded-lg shadow-md">
//               <div className="flex justify-between items-center mb-3">
//                 <h3 className="text-lg font-semibold">5월 21일</h3>
//                 <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded-full">
//                   미지급 있음
//                 </span>
//               </div>
//               <table className="w-full mb-3">
//                 <thead className="bg-gray-50 text-xs">
//                   <tr>
//                     <th className="px-2 py-1 text-left">이름</th>
//                     <th className="px-2 py-1 text-left">시간</th>
//                     <th className="px-2 py-1 text-right">일당</th>
//                     <th className="px-2 py-1 text-center">상태</th>
//                   </tr>
//                 </thead>
//                 <tbody className="text-sm">
//                   <tr>
//                     <td className="px-2 py-1">홍길동</td>
//                     <td className="px-2 py-1">7시간</td>
//                     <td className="px-2 py-1 text-right">150,000</td>
//                     <td className="px-2 py-1 text-center text-red-600 font-medium">미지급</td>
//                   </tr>
//                   <tr>
//                     <td className="px-2 py-1">김철수</td>
//                     <td className="px-2 py-1">8시간</td>
//                     <td className="px-2 py-1 text-right">210,000</td>
//                     <td className="px-2 py-1 text-center text-red-600 font-medium">미지급</td>
//                   </tr>
//                 </tbody>
//                 <tfoot className="border-t text-sm font-medium">
//                   <tr>
//                     <td className="px-2 py-1" colSpan="2">
//                       합계
//                     </td>
//                     <td className="px-2 py-1 text-right">360,000</td>
//                     <td className="px-2 py-1"></td>
//                   </tr>
//                 </tfoot>
//               </table>
//               <div className="mt-2 print:hidden text-right">
//                 <button
//                   onClick={() =>
//                     handleBulkPayment(
//                       "5월 21일",
//                       [
//                         { name: "홍길동", job: "목수", amount: "150,000원" },
//                         { name: "김철수", job: "전기공", amount: "210,000원" },
//                       ],
//                       "360,000원"
//                     )
//                   }
//                   className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none"
//                 >
//                   일괄 지급처리
//                 </button>
//               </div>
//             </div>

//             {/* 30일 요약 */}
//             <div className="bg-white p-4 rounded-lg shadow-md">
//               <div className="flex justify-between items-center mb-3">
//                 <h3 className="text-lg font-semibold">5월 30일</h3>
//                 <span className="text-xs px-2 py-1 bg-red-100 text-red-800 rounded-full">
//                   미지급 있음
//                 </span>
//               </div>
//               <table className="w-full mb-3">
//                 <thead className="bg-gray-50 text-xs">
//                   <tr>
//                     <th className="px-2 py-1 text-left">이름</th>
//                     <th className="px-2 py-1 text-left">시간</th>
//                     <th className="px-2 py-1 text-right">일당</th>
//                     <th className="px-2 py-1 text-center">상태</th>
//                   </tr>
//                 </thead>
//                 <tbody className="text-sm">
//                   <tr>
//                     <td className="px-2 py-1">홍길동</td>
//                     <td className="px-2 py-1">7.5시간</td>
//                     <td className="px-2 py-1 text-right">160,000</td>
//                     <td className="px-2 py-1 text-center text-red-600 font-medium">미지급</td>
//                   </tr>
//                 </tbody>
//                 <tfoot className="border-t text-sm font-medium">
//                   <tr>
//                     <td className="px-2 py-1" colSpan="2">
//                       합계
//                     </td>
//                     <td className="px-2 py-1 text-right">160,000</td>
//                     <td className="px-2 py-1"></td>
//                   </tr>
//                 </tfoot>
//               </table>
//               <div className="mt-2 print:hidden text-right">
//                 <button
//                   onClick={() =>
//                     handleBulkPayment(
//                       "5월 30일",
//                       [{ name: "홍길동", job: "목수", amount: "160,000원" }],
//                       "160,000원"
//                     )
//                   }
//                   className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none"
//                 >
//                   일괄 지급처리
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       </div>
//       {/* 지급 처리 모달 */}
//       {showPaymentModal && (
//         <div className="fixed inset-0 overflow-y-auto z-50">
//           <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
//             <div className="fixed inset-0 transition-opacity" aria-hidden="true">
//               <div
//                 className="absolute inset-0 bg-gray-500 opacity-75"
//                 onClick={() => setShowPaymentModal(false)}
//               ></div>
//             </div>
//             <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
//               &#8203;
//             </span>
//             <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
//               <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
//                 <div className="sm:flex sm:items-start">
//                   <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
//                     <svg
//                       className="h-6 w-6 text-green-600"
//                       xmlns="http://www.w3.org/2000/svg"
//                       fill="none"
//                       viewBox="0 0 24 24"
//                       stroke="currentColor"
//                     >
//                       <path
//                         strokeLinecap="round"
//                         strokeLinejoin="round"
//                         strokeWidth="2"
//                         d="M5 13l4 4L19 7"
//                       />
//                     </svg>
//                   </div>
//                   <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
//                     <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
//                       일당 지급 처리
//                     </h3>
//                     <div className="mt-2">
//                       <p className="text-sm text-gray-500">
//                         {paymentInfo.worker} 근로자의 {paymentInfo.date} 일당을 지급하시겠습니까?
//                       </p>
//                       <p className="mt-2 text-sm font-medium">일당: {paymentInfo.amount}</p>
//                     </div>
//                     <div className="mt-4">
//                       <div className="mb-3">
//                         <label
//                           htmlFor="payment-method"
//                           className="block text-sm font-medium text-gray-700"
//                         >
//                           지급 방법
//                         </label>
//                         <select
//                           id="payment-method"
//                           name="payment-method"
//                           className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
//                         >
//                           <option>계좌이체</option>
//                           <option>현금</option>
//                           <option>현금영수증</option>
//                         </select>
//                       </div>
//                       <div>
//                         <label
//                           htmlFor="payment-memo"
//                           className="block text-sm font-medium text-gray-700"
//                         >
//                           메모 (선택사항)
//                         </label>
//                         <textarea
//                           id="payment-memo"
//                           name="payment-memo"
//                           rows="2"
//                           className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
//                           placeholder="지급 관련 메모"
//                         ></textarea>
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//               <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
//                 <button
//                   type="button"
//                   onClick={confirmPayment}
//                   className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
//                 >
//                   지급 처리
//                 </button>
//                 <button
//                   type="button"
//                   onClick={() => setShowPaymentModal(false)}
//                   className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
//                 >
//                   취소
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//       {/* 일괄 지급 모달 */}
//       {showBulkPaymentModal && (
//         <div className="fixed inset-0 overflow-y-auto z-50">
//           <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
//             <div className="fixed inset-0 transition-opacity" aria-hidden="true">
//               <div
//                 className="absolute inset-0 bg-gray-500 opacity-75"
//                 onClick={() => setShowBulkPaymentModal(false)}
//               ></div>
//             </div>
//             <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
//               &#8203;
//             </span>
//             <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
//               <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
//                 <div className="sm:flex sm:items-start">
//                   <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
//                     <svg
//                       className="h-6 w-6 text-green-600"
//                       xmlns="http://www.w3.org/2000/svg"
//                       fill="none"
//                       viewBox="0 0 24 24"
//                       stroke="currentColor"
//                     >
//                       <path
//                         strokeLinecap="round"
//                         strokeLinejoin="round"
//                         strokeWidth="2"
//                         d="M5 13l4 4L19 7"
//                       />
//                     </svg>
//                   </div>
//                   <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
//                     <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
//                       일괄 지급 처리
//                     </h3>
//                     <div className="mt-2">
//                       <p className="text-sm text-gray-500">
//                         {bulkPaymentInfo.date} 모든 미지급 일당을 일괄 지급하시겠습니까?
//                       </p>
//                       <div className="mt-3 bg-gray-50 p-3 rounded-md">
//                         <p className="text-sm font-medium mb-2">미지급 항목 목록:</p>
//                         <ul className="text-sm space-y-1 list-disc pl-5">
//                           {bulkPaymentInfo.items.map((item, index) => (
//                             <li key={index}>
//                               {item.name} ({item.job}) - {item.amount}
//                             </li>
//                           ))}
//                         </ul>
//                         <p className="mt-2 text-sm font-medium">
//                           총 금액: {bulkPaymentInfo.totalAmount}
//                         </p>
//                       </div>
//                     </div>
//                     <div className="mt-4">
//                       <div className="mb-3">
//                         <label
//                           htmlFor="bulk-payment-method"
//                           className="block text-sm font-medium text-gray-700"
//                         >
//                           지급 방법
//                         </label>
//                         <select
//                           id="bulk-payment-method"
//                           name="bulk-payment-method"
//                           className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
//                         >
//                           <option>계좌이체</option>
//                           <option>현금</option>
//                           <option>현금영수증</option>
//                         </select>
//                       </div>
//                       <div>
//                         <label
//                           htmlFor="bulk-payment-memo"
//                           className="block text-sm font-medium text-gray-700"
//                         >
//                           메모 (선택사항)
//                         </label>
//                         <textarea
//                           id="bulk-payment-memo"
//                           name="bulk-payment-memo"
//                           rows="2"
//                           className="mt-1 focus:ring-indigo-500 focus:border-indigo-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
//                           placeholder="지급 관련 메모"
//                         ></textarea>
//                       </div>
//                     </div>
//                   </div>
//                 </div>
//               </div>
//               <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
//                 <button
//                   type="button"
//                   onClick={confirmBulkPayment}
//                   className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
//                 >
//                   지급 처리
//                 </button>
//                 <button
//                   type="button"
//                   onClick={() => setShowBulkPaymentModal(false)}
//                   className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
//                 >
//                   취소
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//       {/* 급여명세서 모달 */}
//       // 급여명세서 모달
//       {showPayslipModal && (
//         <div className="fixed inset-0 overflow-y-auto z-50">
//           <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
//             {/* 배경 오버레이 */}
//             <div className="fixed inset-0 transition-opacity" aria-hidden="true">
//               <div
//                 className="absolute inset-0 bg-gray-500 opacity-75"
//                 onClick={() => setShowPayslipModal(false)}
//               ></div>
//             </div>

//             {/* 모달 컨텐츠 */}
//             <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
//               &#8203;
//             </span>
//             <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
//               <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
//                 <div className="flex justify-between items-start">
//                   <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
//                     급여명세서 - {payslipInfo.worker} ({payslipInfo.job})
//                   </h3>
//                   <button
//                     onClick={() => window.print()}
//                     className="text-sm px-3 py-1 border border-gray-300 rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none print:hidden"
//                   >
//                     인쇄
//                   </button>
//                 </div>

//                 <div className="mt-4 bg-gray-50 p-4 rounded-lg">
//                   {/* 근로자 정보 및 지급 요약 */}
//                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
//                     <div>
//                       <h4 className="text-sm font-medium text-gray-700 mb-2">근로자 정보</h4>
//                       <p className="text-sm text-gray-600">이름: {payslipInfo.worker}</p>
//                       <p className="text-sm text-gray-600">직종: {payslipInfo.job}</p>
//                       <p className="text-sm text-gray-600">지급 월: 2024년 5월</p>
//                     </div>
//                     <div>
//                       <h4 className="text-sm font-medium text-gray-700 mb-2">지급 요약</h4>
//                       <p className="text-sm text-gray-600">
//                         총 지급액: {formatNumber(payslipInfo.totalPay)}원
//                       </p>
//                       <p className="text-sm text-gray-600">
//                         총 공제액: {formatNumber(payslipInfo.totalDeductions)}원
//                       </p>
//                       <p className="text-sm font-medium text-gray-800">
//                         최종 실지급액: {formatNumber(payslipInfo.netPay)}원
//                       </p>
//                     </div>
//                   </div>

//                   {/* 근무 내역 테이블 */}
//                   <h4 className="text-sm font-medium text-gray-700 mb-2">근무 내역</h4>
//                   <div className="overflow-x-auto">
//                     <table className="w-full border-collapse text-sm">
//                       <thead className="bg-gray-100">
//                         <tr>
//                           <th className="border border-gray-300 p-2 text-left">근무일</th>
//                           <th className="border border-gray-300 p-2 text-left">근무시간</th>
//                           <th className="border border-gray-300 p-2 text-right">일당</th>
//                           <th className="border border-gray-300 p-2 text-right">비과세</th>
//                           <th className="border border-gray-300 p-2 text-right">소득세</th>
//                           <th className="border border-gray-300 p-2 text-right">주민세</th>
//                           <th className="border border-gray-300 p-2 text-right">국민연금</th>
//                           <th className="border border-gray-300 p-2 text-right">건강보험</th>
//                           <th className="border border-gray-300 p-2 text-right">고용보험</th>
//                           <th className="border border-gray-300 p-2 text-right">장기요양</th>

//                           <th className="border border-gray-300 p-2 text-right">실지급액</th>

//                           <th className="border border-gray-300 p-2 text-center">상태</th>
//                           <th className="border border-gray-300 p-2 text-right">지급일</th>
//                         </tr>
//                       </thead>
//                       <tbody>
//                         {payslipInfo.workRecords.map((record, index) => (
//                           <tr key={index}>
//                             <td className="border border-gray-300 p-2">{record.date}</td>
//                             <td className="border border-gray-300 p-2">{record.hours}시간</td>
//                             <td className="border border-gray-300 p-2 text-right">
//                               {formatNumber(record.dailyPay)}
//                             </td>
//                             <td className="border border-gray-300 p-2 text-right">
//                               {formatNumber(record.taxFree)}
//                             </td>
//                             <td className="border border-gray-300 p-2 text-right">
//                               {formatNumber(record.incomeTax)}
//                             </td>
//                             <td className="border border-gray-300 p-2 text-right">
//                               {formatNumber(record.residentTax)}
//                             </td>
//                             <td className="border border-gray-300 p-2 text-right">
//                               {formatNumber(record.pension)}
//                             </td>
//                             <td className="border border-gray-300 p-2 text-right">
//                               {formatNumber(record.healthIns)}
//                             </td>
//                             <td className="border border-gray-300 p-2 text-right">
//                               {formatNumber(record.employmentIns)}
//                             </td>
//                             <td className="border border-gray-300 p-2 text-right">
//                               {formatNumber(record.longTermCareIns)}
//                             </td>

//                             <td className="border border-gray-300 p-2 text-right">
//                               {formatNumber(record.netPay)}
//                             </td>
//                             <td className="border border-gray-300 p-2 text-center">
//                               {index === 0 ? (
//                                 <span className="text-green-700 font-medium">지급</span>
//                               ) : (
//                                 <span className="text-red-600 font-medium">미지급</span>
//                               )}
//                             </td>
//                             <td className="border border-gray-300 p-2 text-right"></td>
//                           </tr>
//                         ))}
//                       </tbody>
//                       <tfoot className="bg-blue-50 font-medium">
//                         <tr>
//                           <td colSpan="2" className="border border-gray-300 p-2 text-right">
//                             합계
//                           </td>
//                           <td className="border border-gray-300 p-2 text-right">
//                             {formatNumber(payslipInfo.totalPay)}
//                           </td>
//                           <td className="border border-gray-300 p-2 text-right">
//                             {formatNumber(
//                               payslipInfo.workRecords.reduce((sum, r) => sum + r.taxFree, 0)
//                             )}
//                           </td>
//                           <td className="border border-gray-300 p-2 text-right">
//                             {formatNumber(
//                               payslipInfo.workRecords.reduce((sum, r) => sum + r.incomeTax, 0)
//                             )}
//                           </td>
//                           <td className="border border-gray-300 p-2 text-right">
//                             {formatNumber(
//                               payslipInfo.workRecords.reduce((sum, r) => sum + r.residentTax, 0)
//                             )}
//                           </td>
//                           <td className="border border-gray-300 p-2 text-right">
//                             {formatNumber(
//                               payslipInfo.workRecords.reduce((sum, r) => sum + r.pension, 0)
//                             )}
//                           </td>
//                           <td className="border border-gray-300 p-2 text-right">
//                             {formatNumber(
//                               payslipInfo.workRecords.reduce((sum, r) => sum + r.healthIns, 0)
//                             )}
//                           </td>
//                           <td className="border border-gray-300 p-2 text-right">
//                             {formatNumber(
//                               payslipInfo.workRecords.reduce((sum, r) => sum + r.employmentIns, 0)
//                             )}
//                           </td>
//                           <td className="border border-gray-300 p-2 text-right">
//                             {formatNumber(
//                               payslipInfo.workRecords.reduce((sum, r) => sum + r.longTermCareIns, 0)
//                             )}
//                           </td>
//                           <td className="border border-gray-300 p-2 text-right">
//                             {formatNumber(
//                               payslipInfo.workRecords.reduce((sum, r) => sum + r.unionDues, 0)
//                             )}
//                           </td>
//                           <td className="border border-gray-300 p-2 text-right">
//                             {formatNumber(payslipInfo.netPay)}
//                           </td>
//                           <td className="border border-gray-300 p-2"></td>
//                         </tr>
//                       </tfoot>
//                     </table>
//                   </div>

//                   {/* 공제 내역 및 지급 계산 */}
//                   <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
//                     <div>
//                       <h4 className="text-sm font-medium text-gray-700 mb-2">공제 내역</h4>
//                       <div className="bg-white p-3 rounded-md border border-gray-300">
//                         <ul className="text-sm space-y-1">
//                           <li className="flex justify-between">
//                             <span>소득세:</span>
//                             <span>
//                               {formatNumber(
//                                 payslipInfo.workRecords.reduce((sum, r) => sum + r.incomeTax, 0)
//                               )}
//                               원
//                             </span>
//                           </li>
//                           <li className="flex justify-between">
//                             <span>주민세:</span>
//                             <span>
//                               {formatNumber(
//                                 payslipInfo.workRecords.reduce((sum, r) => sum + r.residentTax, 0)
//                               )}
//                               원
//                             </span>
//                           </li>
//                           <li className="flex justify-between">
//                             <span>국민연금:</span>
//                             <span>
//                               {formatNumber(
//                                 payslipInfo.workRecords.reduce((sum, r) => sum + r.pension, 0)
//                               )}
//                               원
//                             </span>
//                           </li>
//                           <li className="flex justify-between">
//                             <span>건강보험:</span>
//                             <span>
//                               {formatNumber(
//                                 payslipInfo.workRecords.reduce((sum, r) => sum + r.healthIns, 0)
//                               )}
//                               원
//                             </span>
//                           </li>
//                           <li className="flex justify-between">
//                             <span>고용보험:</span>
//                             <span>
//                               {formatNumber(
//                                 payslipInfo.workRecords.reduce((sum, r) => sum + r.employmentIns, 0)
//                               )}
//                               원
//                             </span>
//                           </li>
//                           <li className="flex justify-between">
//                             <span>장기요양보험:</span>
//                             <span>
//                               {formatNumber(
//                                 payslipInfo.workRecords.reduce(
//                                   (sum, r) => sum + r.longTermCareIns,
//                                   0
//                                 )
//                               )}
//                               원
//                             </span>
//                           </li>
//                           <li className="flex justify-between">
//                             <span>조합비:</span>
//                             <span>
//                               {formatNumber(
//                                 payslipInfo.workRecords.reduce((sum, r) => sum + r.unionDues, 0)
//                               )}
//                               원
//                             </span>
//                           </li>
//                           <li className="flex justify-between font-medium pt-1 border-t">
//                             <span>총 공제액:</span>
//                             <span>{formatNumber(payslipInfo.totalDeductions)}원</span>
//                           </li>
//                         </ul>
//                       </div>
//                     </div>
//                     <div>
//                       <h4 className="text-sm font-medium text-gray-700 mb-2">지급 계산</h4>
//                       <div className="bg-white p-3 rounded-md border border-gray-300">
//                         <ul className="text-sm space-y-1">
//                           <li className="flex justify-between">
//                             <span>총 일당:</span>
//                             <span>{formatNumber(payslipInfo.totalPay)}원</span>
//                           </li>
//                           <li className="flex justify-between">
//                             <span>비과세:</span>
//                             <span>
//                               {formatNumber(
//                                 payslipInfo.workRecords.reduce((sum, r) => sum + r.taxFree, 0)
//                               )}
//                               원
//                             </span>
//                           </li>
//                           <li className="flex justify-between">
//                             <span>과세 대상액:</span>
//                             <span>
//                               {formatNumber(
//                                 payslipInfo.totalPay -
//                                   payslipInfo.workRecords.reduce((sum, r) => sum + r.taxFree, 0)
//                               )}
//                               원
//                             </span>
//                           </li>
//                           <li className="flex justify-between text-red-600">
//                             <span>총 공제액:</span>
//                             <span>-{formatNumber(payslipInfo.totalDeductions)}원</span>
//                           </li>
//                           <li className="flex justify-between font-medium pt-1 border-t">
//                             <span>최종 실지급액:</span>
//                             <span>{formatNumber(payslipInfo.netPay)}원</span>
//                           </li>
//                         </ul>
//                       </div>
//                     </div>
//                   </div>
//                 </div>

//                 {/* 급여명세서 하단 메모 */}
//                 <div className="mt-4 text-sm text-gray-500">
//                   <p>* 본 급여명세서는 정보 제공을 위한 것이며, 공식 문서로 사용될 수 없습니다.</p>
//                   <p>* 문의사항은 담당자(김현장, 010-1234-5678)에게 연락 바랍니다.</p>
//                 </div>
//               </div>

//               {/* 푸터 버튼 */}
//               <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse print:hidden">
//                 <button
//                   type="button"
//                   onClick={() => setShowPayslipModal(false)}
//                   className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm"
//                 >
//                   닫기
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
