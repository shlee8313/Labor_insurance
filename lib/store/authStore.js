// lib/store/authStore.js

// lib/store/authStore.js (즉시 적용 버전)
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { hasPermission as checkPermission } from "@/lib/permissions";

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      isAuthenticated: false,
      isHydrated: false,

      // 🚀 캐시 맵 추가 (이게 핵심!)
      permissionCache: new Map(),

      setAuth: (session, user) => {
        set({
          session,
          user,
          isAuthenticated: !!session,
          permissionCache: new Map(), // 로그인 시 캐시 초기화
        });
      },

      clearAuth: () => {
        set({
          session: null,
          user: null,
          isAuthenticated: false,
          permissionCache: new Map(),
        });
      },

      // 🎯 캐싱된 권한 체크 함수 (이 함수만 추가하면 됨!)
      hasPermission: (permission) => {
        const state = get();
        const { user, permissionCache } = state;

        if (!user || !user.role) {
          return false;
        }

        // 캐시 키 생성
        const cacheKey = `${user.role}-${permission}`;

        // 🔥 캐시에서 먼저 확인 (이게 성능 향상의 핵심!)
        if (permissionCache.has(cacheKey)) {
          // 개발환경에서 캐시 히트 확인
          if (process.env.NODE_ENV === "development") {
            console.log(`🎯 캐시 HIT: ${user.role} ${permission}`);
          }
          return permissionCache.get(cacheKey);
        }

        // 캐시에 없으면 계산 후 저장
        const result = checkPermission(user.role, permission);

        // 캐시 크기 제한 (메모리 누수 방지)
        if (permissionCache.size > 50) {
          const firstKey = permissionCache.keys().next().value;
          permissionCache.delete(firstKey);
        }

        permissionCache.set(cacheKey, result);

        // 개발환경에서 새 계산 확인
        if (process.env.NODE_ENV === "development") {
          console.log(`💾 캐시 MISS (새 계산): ${user.role} ${permission}`);
        }

        return result;
      },
    }),
    {
      name: "auth-storage",
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isHydrated = true;
          state.permissionCache = new Map(); // 하이드레이션 시 캐시 초기화
        }
      },
      // 캐시는 메모리에서만 관리 (persist 제외)
      partialize: (state) => ({
        user: state.user,
        session: state.session,
        isAuthenticated: state.isAuthenticated,
        isHydrated: state.isHydrated,
      }),
    }
  )
);

/**
 *
 *
 *
 *
 *
 */
// import { create } from "zustand";
// import { persist } from "zustand/middleware";

// export const useAuthStore = create(
//   persist(
//     (set) => ({
//       user: null,
//       session: null,
//       isAuthenticated: false,
//       isHydrated: false,

//       setAuth: (session, user) =>
//         set({
//           session,
//           user,
//           isAuthenticated: !!session,
//         }),

//       clearAuth: () =>
//         set({
//           session: null,
//           user: null,
//           isAuthenticated: false,
//         }),
//     }),
//     {
//       name: "auth-storage",
//       onRehydrateStorage: () => (state) => {
//         state.isHydrated = true;
//       },
//     }
//   )
// );
