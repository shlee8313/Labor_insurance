// lib/store/siteStore.js
import { create } from "zustand";
import { supabase } from "@/lib/supabase";

/**
 * 공사현장 관리를 위한 스토어 (역할별 현장 접근 제어 포함)
 */
const useSiteStore = create((set, get) => ({
  // 상태
  sites: [],
  selectedSite: null,
  companyName: "",
  userCompanyId: null,
  userRole: null, // 사용자 역할 추가
  isLoading: false,
  isSiteLoading: false,
  error: null,

  // 초기화 함수 - 사용자 역할에 따라 분기
  initialize: async (userId) => {
    try {
      set({ isLoading: true, error: null });

      // 1. 사용자 정보 가져오기 (역할 포함)
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("id, role")
        .eq("id", userId)
        .single();

      if (userError) throw userError;

      const userRole = userData?.role;
      set({ userRole });

      // 2. 역할에 따라 다른 방식으로 현장 조회
      if (userRole === "admin") {
        // admin: 회사 ID 가져온 후 회사의 모든 현장 조회
        await get().fetchUserCompany(userId);
        await get().fetchAllCompanySites();
      } else {
        // 일반 사용자: 할당된 현장만 조회
        await get().fetchUserCompany(userId);
        await get().fetchAssignedSites(userId);
      }

      set({ isLoading: false });
    } catch (error) {
      console.error("초기화 오류:", error);
      set({ isLoading: false, error: error.message });
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

  // admin용: 회사의 모든 현장 조회
  fetchAllCompanySites: async () => {
    const { userCompanyId } = get();
    if (!userCompanyId) return;

    try {
      set({ isSiteLoading: true, error: null });

      const { data, error } = await supabase
        .from("location_sites")
        .select(
          `
          site_id,
          site_name,
          address,
          start_date,
          end_date,
          status,
          industrial_accident_rate
        `
        )
        .eq("company_id", userCompanyId)
        .order("site_name");

      if (error) throw error;

      set({ sites: data || [], isSiteLoading: false });
    } catch (error) {
      console.error("전체 현장 목록 조회 오류:", error);
      set({ isSiteLoading: false, error: error.message });
    }
  },

  // 일반 사용자용: 할당된 현장만 조회
  fetchAssignedSites: async (userId) => {
    if (!userId) {
      set({ sites: [] });
      return;
    }

    try {
      set({ isSiteLoading: true, error: null });

      // user_location_sites 테이블을 통해 할당된 현장만 조회
      const { data, error } = await supabase
        .from("user_location_sites")
        .select(
          `
          site_id,
          assigned_date,
          location_sites (
            site_id,
            site_name,
            address,
            start_date,
            end_date,
            status,
            industrial_accident_rate
          )
        `
        )
        .eq("user_id", userId)
        .is("removed_date", null) // 제거되지 않은 현장만
        .order("location_sites(site_name)");

      if (error) throw error;

      // 데이터 구조 변환
      const sites =
        data?.map((item) => ({
          ...item.location_sites,
          assigned_date: item.assigned_date,
        })) || [];

      set({ sites, isSiteLoading: false });
    } catch (error) {
      console.error("할당된 현장 목록 조회 오류:", error);
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
        .from("location_sites")
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

  // 전체 상태 초기화
  resetStore: () =>
    set({
      sites: [],
      selectedSite: null,
      companyName: "",
      userCompanyId: null,
      userRole: null,
      isLoading: false,
      isSiteLoading: false,
      error: null,
    }),
}));

export default useSiteStore;
