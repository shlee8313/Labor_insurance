//file: components/RoleGuard.js

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/store/authStore";
import { hasPermission } from "@/lib/permissions"; // 경로 수정

export default function RoleGuard({ children, requiredPermission }) {
  const { user, isAuthenticated, isHydrated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.push("/login");
      return;
    }

    if (isHydrated && isAuthenticated && requiredPermission) {
      if (!hasPermission(user?.role, requiredPermission)) {
        router.push("/dashboard");
      }
    }
  }, [isAuthenticated, isHydrated, user, requiredPermission, router]);

  if (!isHydrated || !isAuthenticated) {
    return <div className="flex justify-center items-center min-h-screen">로딩 중...</div>;
  }

  if (requiredPermission && !hasPermission(user?.role, requiredPermission)) {
    return <div className="text-center p-8">접근 권한이 없습니다.</div>;
  }

  return children;
}
