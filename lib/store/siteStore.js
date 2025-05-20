// lib/store/siteStore.js
import { create } from "zustand";
import { supabase } from "@/lib/supabase";

/**
 * 공사현장 관리를 위한 스토어
 */
const useSiteStore = create((set, get) => ({
  // 상태
  sites: [],
  selectedSite: null,
  companyName: "",
  userCompanyId: null,
  isLoading: false,
  isSiteLoading: false,
  error: null,

  // 초기화 함수
  initialize: async (userId) => {
    try {
      // 회사 ID 가져오기
      await get().fetchUserCompany(userId);

      // 현장 목록 가져오기
      await get().fetchSites();
    } catch (error) {
      console.error("초기화 오류:", error);
      set({ error: error.message });
    }
  },

  // 회사 ID 및 정보 가져오기
  fetchUserCompany: async (userId) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from("user_companies")
        .select("company_id, company:companies(company_name)")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        set({
          userCompanyId: data.company_id,
          companyName: data.company?.company_name || "",
        });
        return data.company_id;
      }
    } catch (error) {
      console.error("사용자 회사 정보 조회 오류:", error);
      set({ error: error.message });
    }

    return null;
  },

  // 현장 목록 가져오기
  fetchSites: async () => {
    const { userCompanyId } = get();
    if (!userCompanyId) return;

    try {
      set({ isSiteLoading: true, error: null });

      const { data, error } = await supabase
        .from("construction_sites")
        .select(
          "site_id, site_name, address, start_date, end_date, status, industrial_accident_rate"
        )
        .eq("company_id", userCompanyId)
        .order("site_name");

      if (error) throw error;

      set({ sites: data || [], isSiteLoading: false });

      // 첫 번째 현장 자동 선택
      // if (data && data.length > 0 && !get().selectedSite) {
      //   get().setSelectedSite(data[0].site_id);
      // }
    } catch (error) {
      console.error("현장 목록 조회 오류:", error);
      set({ isSiteLoading: false, error: error.message });
    }
  },

  // 선택된 사이트 설정
  setSelectedSite: (siteId) => {
    set({ selectedSite: siteId });
  },

  // 현장 상세 정보 가져오기
  fetchSiteDetails: async (siteId) => {
    if (!siteId) return null;

    try {
      set({ isLoading: true, error: null });

      const { data, error } = await supabase
        .from("construction_sites")
        .select("*")
        .eq("site_id", siteId)
        .single();

      if (error) throw error;

      set({ isLoading: false });
      return data;
    } catch (error) {
      console.error(`현장 상세 정보 조회 오류(ID: ${siteId}):`, error);
      set({ isLoading: false, error: error.message });
      return null;
    }
  },

  // 현장 이름으로 현장 ID 검색
  getSiteIdByName: (siteName) => {
    const { sites } = get();
    const site = sites.find((site) => site.site_name === siteName);
    return site ? site.site_id : null;
  },

  // 현장 ID로 현장 이름 검색
  getSiteNameById: (siteId) => {
    const { sites } = get();
    const site = sites.find((site) => site.site_id === siteId);
    return site ? site.site_name : null;
  },

  // 오류 지우기
  clearError: () => set({ error: null }),
  resetStore: () =>
    set({
      selectedSite: null,
      error: null,
      isLoading: false,
      isSiteLoading: false,
      // sites와 userCompanyId, companyName은 유지 (선택 사항)
    }),
}));

export default useSiteStore;
