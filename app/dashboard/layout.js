//file: app/dashboard/layout.js

"use client";

import { useState } from "react";
import { useAuthStore } from "@/lib/store/authStore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isAuthenticated, isHydrated } = useAuthStore();
  const router = useRouter();

  // 인증 상태 확인
  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isHydrated, router]);

  // 사이드바 토글 함수
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  if (!isHydrated || !isAuthenticated) {
    return <div className="flex justify-center items-center min-h-screen">로딩 중...</div>;
  }

  return (
    <div className="flex h-screen ">
      {/* 사이드바 */}
      <Sidebar isOpen={sidebarOpen} toggle={toggleSidebar} />

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header toggleSidebar={toggleSidebar} />

        <main className="flex-1 overflow-x-hidden overflow-y-auto  p-4">{children}</main>
      </div>
    </div>
  );
}
