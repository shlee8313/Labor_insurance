// //file: app/dashboard/insurance/daily-work-report/page.js
// "use client";

// import { useState, useEffect } from "react";
// import { supabase } from "@/lib/supabase";

// export default function DailyWorkReportPage() {
//   const [workers, setWorkers] = useState([]);
//   const [sites, setSites] = useState([]);
//   const [loading, setLoading] = useState(true);
//   const [selectedWorker, setSelectedWorker] = useState(null);
//   const [selectedSite, setSelectedSite] = useState(null);
//   const [reportMonth, setReportMonth] = useState(new Date().toISOString().substring(0, 7));
//   const [workDays, setWorkDays] = useState({});

//   // 근로자 및 현장 데이터 로드
//   useEffect(() => {
//     async function loadData() {
//       setLoading(true);

//       // 근로자 목록 로드
//       const { data: workersData, error: workersError } = await supabase
//         .from("workers")
//         .select("*")
//         .order("name");

//       if (!workersError) {
//         setWorkers(workersData);
//       }

//       // 현장 목록 로드
//       const { data: sitesData, error: sitesError } = await supabase
//         .from("construction_sites")
//         .select("*")
//         .order("site_name");

//       if (!sitesError) {
//         setSites(sitesData);
//       }

//       setLoading(false);
//     }

//     loadData();
//   }, []);

//   // 날짜 체크 처리
//   const handleDateCheck = (day, isChecked) => {
//     setWorkDays((prev) => ({
//       ...prev,
//       [day]: isChecked,
//     }));
//   };

//   // 신고서 제출
//   const handleSubmit = async () => {
//     if (!selectedWorker || !selectedSite || !reportMonth) {
//       alert("근로자, 현장, 신고월을 모두 선택해주세요.");
//       return;
//     }

//     const workDaysList = Object.entries(workDays)
//       .filter(([_, isChecked]) => isChecked)
//       .map(([day]) => parseInt(day));

//     const totalWorkDays = workDaysList.length;

//     if (totalWorkDays === 0) {
//       alert("최소한 하나의 근무일을 선택해주세요.");
//       return;
//     }

//     try {
//       // 신고서 기본 정보 저장
//       const { data, error } = await supabase
//         .from("daily_work_reports")
//         .insert([
//           {
//             worker_id: selectedWorker,
//             site_id: selectedSite,
//             report_month: reportMonth,
//             insurance_type: "5", // 산재+고용
//             total_work_days: totalWorkDays,
//             avg_daily_work_hours: 8, // 기본값
//             total_paid_days: totalWorkDays,
//             total_wage: totalWorkDays * 150000, // 가정: 일당 15만원
//             total_compensation: totalWorkDays * 150000,
//             payment_month: reportMonth,
//             report_status: "draft",
//           },
//         ])
//         .select();

//       if (error) throw error;

//       // 신고서 상세 정보(근무일) 저장
//       const reportId = data[0].report_id;

//       // 선택된 각 근무일에 대한 상세 정보 저장
//       const detailInserts = workDaysList.map((day) => {
//         const workDate = `${reportMonth}-${day.toString().padStart(2, "0")}`;
//         return {
//           report_id: reportId,
//           work_date: workDate,
//           work_hours: 8,
//           daily_wage: 150000,
//         };
//       });

//       const { error: detailError } = await supabase
//         .from("daily_work_report_details")
//         .insert(detailInserts);

//       if (detailError) throw detailError;

//       alert("일용근로자 근로확인신고서가 저장되었습니다.");
//       // 폼 리셋 또는 다음 페이지로 이동
//     } catch (error) {
//       console.error("저장 중 오류가 발생했습니다.", error);
//       alert(`오류: ${error.message}`);
//     }
//   };

//   // 날짜 목록 생성 (해당 월의 모든 날짜)
//   const getDaysInMonth = () => {
//     const year = parseInt(reportMonth.split("-")[0]);
//     const month = parseInt(reportMonth.split("-")[1]) - 1;
//     const daysInMonth = new Date(year, month + 1, 0).getDate();
//     return Array.from({ length: daysInMonth }, (_, i) => i + 1);
//   };

//   return (
//     <div className="container mx-auto p-4">
//       <h1 className="text-2xl font-bold mb-6">일용근로자 근로확인신고서</h1>

//       {loading ? (
//         <p>데이터를 불러오는 중...</p>
//       ) : (
//         <div>
//           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
//             <div>
//               <label className="block text-gray-700 mb-2">근로자 선택</label>
//               <select
//                 className="w-full p-2 border rounded"
//                 value={selectedWorker || ""}
//                 onChange={(e) => setSelectedWorker(e.target.value)}
//               >
//                 <option value="">선택하세요</option>
//                 {workers.map((worker) => (
//                   <option key={worker.worker_id} value={worker.worker_id}>
//                     {worker.name} ({worker.resident_number})
//                   </option>
//                 ))}
//               </select>
//             </div>

//             <div>
//               <label className="block text-gray-700 mb-2">현장 선택</label>
//               <select
//                 className="w-full p-2 border rounded"
//                 value={selectedSite || ""}
//                 onChange={(e) => setSelectedSite(e.target.value)}
//               >
//                 <option value="">선택하세요</option>
//                 {sites.map((site) => (
//                   <option key={site.site_id} value={site.site_id}>
//                     {site.site_name}
//                   </option>
//                 ))}
//               </select>
//             </div>

//             <div>
//               <label className="block text-gray-700 mb-2">신고월</label>
//               <input
//                 type="month"
//                 className="w-full p-2 border rounded"
//                 value={reportMonth}
//                 onChange={(e) => setReportMonth(e.target.value)}
//               />
//             </div>
//           </div>

//           <div className="mb-6">
//             <h2 className="text-xl font-semibold mb-4">근로일 체크</h2>
//             <div className="grid grid-cols-7 gap-2">
//               {getDaysInMonth().map((day) => (
//                 <div key={day} className="border p-2 text-center">
//                   <div>{day}일</div>
//                   <input
//                     type="checkbox"
//                     checked={workDays[day] || false}
//                     onChange={(e) => handleDateCheck(day, e.target.checked)}
//                   />
//                 </div>
//               ))}
//             </div>
//           </div>

//           <div className="mt-4">
//             <button
//               onClick={handleSubmit}
//               className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
//             >
//               신고서 저장
//             </button>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
