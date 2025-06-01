// components/RoleGuard.js
import React, { useMemo } from "react";
import { useAuthStore } from "@/lib/store/authStore";

const RoleGuard = React.memo(({ requiredPermission, children, fallback = null }) => {
  const { hasPermission, user } = useAuthStore();

  // 🎯 메모이제이션으로 불필요한 재계산 방지
  const hasAccess = useMemo(() => {
    return hasPermission(requiredPermission);
  }, [requiredPermission, hasPermission, user?.role]); // user.role 의존성 추가

  // 권한이 없을 때 표시할 내용
  if (!hasAccess) {
    return (
      fallback || (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="text-gray-500 text-lg mb-2">접근 권한이 없습니다</div>
            <div className="text-sm text-gray-400">{requiredPermission} 권한이 필요합니다</div>
          </div>
        </div>
      )
    );
  }

  return children;
});

RoleGuard.displayName = "RoleGuard";

export default RoleGuard;

// //file: components/RoleGuard.js

// "use client";

// import { useEffect } from "react";
// import { useRouter } from "next/navigation";
// import { useAuthStore } from "@/lib/store/authStore";
// import { hasPermission } from "@/lib/permissions"; // 경로 수정

// export default function RoleGuard({ children, requiredPermission }) {
//   const { user, isAuthenticated, isHydrated } = useAuthStore();
//   const router = useRouter();

//   useEffect(() => {
//     if (isHydrated && !isAuthenticated) {
//       router.push("/login");
//       return;
//     }

//     if (isHydrated && isAuthenticated && requiredPermission) {
//       if (!hasPermission(user?.role, requiredPermission)) {
//         router.push("/dashboard");
//       }
//     }
//   }, [isAuthenticated, isHydrated, user, requiredPermission, router]);

//   if (!isHydrated || !isAuthenticated) {
//     return <div className="flex justify-center items-center min-h-screen">로딩 중...</div>;
//   }

//   if (requiredPermission && !hasPermission(user?.role, requiredPermission)) {
//     return <div className="text-center p-8">접근 권한이 없습니다.</div>;
//   }

//   return children;
// }
