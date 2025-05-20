// lib/store/authStore.js
import { create } from "zustand";
import { persist } from "zustand/middleware";

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      session: null,
      isAuthenticated: false,
      isHydrated: false,

      setAuth: (session, user) =>
        set({
          session,
          user,
          isAuthenticated: !!session,
        }),

      clearAuth: () =>
        set({
          session: null,
          user: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: "auth-storage",
      onRehydrateStorage: () => (state) => {
        state.isHydrated = true;
      },
    }
  )
);
