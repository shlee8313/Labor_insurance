//file: app/dashboard/users/add/page.js

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import RoleGuard from "@/components/RoleGuard";
import { useAuthStore } from "@/lib/store/authStore";

export default function AddUserPage() {
  const router = useRouter();
  const { user: currentUser } = useAuthStore();
  const [companies, setCompanies] = useState([]);
  const [currentCompany, setCurrentCompany] = useState(null);
  const [constructionSites, setConstructionSites] = useState([]);
  const [selectedSites, setSelectedSites] = useState([]);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    name: "",
    contact_number: "",
    role: "user",
    company_id: "",
    password: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [passwordError, setPasswordError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const formatPhoneNumber = (value) => {
    const cleaned = value.replace(/\D/g, "").slice(0, 11);
    if (cleaned.length <= 3) return cleaned;
    if (cleaned.length <= 7) return `${cleaned.slice(0, 3)}-${cleaned.slice(3)}`;
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  };

  // 페이지 로드시 폼 초기화 추가
  useEffect(() => {
    // 폼 데이터 초기화
    setFormData({
      username: "",
      email: "",
      name: "",
      contact_number: "",
      role: "user",
      company_id: "",
      password: "",
      confirmPassword: "",
    });
    setPasswordError(null);
    setError(null);
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        // 회사 목록 조회
        const { data: companiesData, error: companiesError } = await supabase
          .from("companies")
          .select("company_id, company_name")
          .order("company_name");

        if (companiesError) throw companiesError;
        setCompanies(companiesData || []);

        // 현재 사용자의 회사 정보 조회
        if (currentUser) {
          const { data: userCompany, error: userCompanyError } = await supabase
            .from("user_companies")
            .select("company:companies(*)")
            .eq("user_id", currentUser.id)
            .maybeSingle();

          if (userCompanyError) throw userCompanyError;

          if (userCompany?.company) {
            setCurrentCompany(userCompany.company);
            setFormData((prev) => ({
              ...prev,
              company_id: userCompany.company.company_id,
            }));

            // 해당 회사의 공사현장 목록 조회
            const { data: sitesData, error: sitesError } = await supabase
              .from("construction_sites")
              .select("site_id, site_name")
              .eq("company_id", userCompany.company.company_id)
              .order("site_name");

            if (sitesError) throw sitesError;
            setConstructionSites(sitesData || []);
          }
        }
      } catch (error) {
        console.error("데이터 조회 오류:", error);
        setError("초기 데이터를 불러오는 중 오류가 발생했습니다.");
      }
    }

    fetchData();
  }, [currentUser]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "contact_number") {
      const formattedValue = formatPhoneNumber(value);
      setFormData((prev) => ({
        ...prev,
        [name]: formattedValue,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }

    if (name === "password" || name === "confirmPassword") {
      validatePasswords(
        name === "password" ? value : formData.password,
        name === "confirmPassword" ? value : formData.confirmPassword
      );
    }

    // 회사가 변경되면 공사현장 목록도 업데이트
    if (name === "company_id" && value) {
      fetchConstructionSites(value);
      // 회사가 변경되면 선택된 공사현장 초기화
      setSelectedSites([]);
    }
  };

  const fetchConstructionSites = async (companyId) => {
    try {
      const { data, error } = await supabase
        .from("construction_sites")
        .select("site_id, site_name")
        .eq("company_id", companyId)
        .order("site_name");

      if (error) throw error;
      setConstructionSites(data || []);
    } catch (error) {
      console.error("공사현장 목록 조회 오류:", error);
      setError("공사현장 목록을 불러오는 중 오류가 발생했습니다.");
    }
  };

  const handleSiteSelect = (siteId) => {
    setSelectedSites((prev) => {
      if (prev.includes(siteId)) {
        return prev.filter((id) => id !== siteId);
      } else {
        return [...prev, siteId];
      }
    });
  };

  const handleSelectAllSites = () => {
    if (selectedSites.length === constructionSites.length) {
      // 모든 현장이 이미 선택되어 있다면 모두 선택 해제
      setSelectedSites([]);
    } else {
      // 그렇지 않다면 모든 현장 선택
      setSelectedSites(constructionSites.map((site) => site.site_id));
    }
  };

  const validatePasswords = (password, confirmPassword) => {
    if (password.length < 6) {
      setPasswordError("비밀번호는 최소 6자 이상이어야 합니다.");
    } else if (password !== confirmPassword) {
      setPasswordError("비밀번호가 일치하지 않습니다.");
    } else {
      setPasswordError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (passwordError) return;

    setLoading(true);
    setError(null);
    const cleanedContactNumber = formData.contact_number
      ? formData.contact_number.replace(/-/g, "")
      : null;

    try {
      // 1. 사용자명 중복 확인
      const { data: existingUsername } = await supabase
        .from("users")
        .select("id")
        .eq("username", formData.username)
        .maybeSingle();

      if (existingUsername) {
        throw new Error("이미 사용 중인 아이디입니다.");
      }

      // 2. 이메일 중복 확인 - 커스텀 users 테이블
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", formData.email)
        .maybeSingle();

      if (existingUser) {
        throw new Error("이미 등록된 이메일입니다.");
      }

      // 3. Supabase Auth로 사용자 등록 (이메일 확인 요청 활성화)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            username: formData.username,
            name: formData.name,
          },
          emailRedirectTo: window.location.origin + "/login", // 이메일 확인 후 리디렉션 URL
        },
      });

      if (authError) {
        // User already registered 에러 처리
        if (authError.message.includes("already registered")) {
          throw new Error("이미 등록된 이메일입니다. 로그인 페이지에서 로그인하세요.");
        } else {
          console.error("Auth 회원가입 오류:", authError);
          throw new Error(`회원가입 실패: ${authError.message}`);
        }
      }

      if (!authData?.user?.id) {
        throw new Error("사용자 생성에 실패했습니다.");
      }

      const authUserId = authData.user.id;

      // 4. 사용자 정보 저장 (email_confirmed_at은 null로 유지)
      const { error: insertUserError } = await supabase.from("users").insert([
        {
          id: authUserId, // Supabase Auth의 uid를 users 테이블의 id로 사용
          username: formData.username,
          name: formData.name,
          email: formData.email,
          contact_number: cleanedContactNumber,
          role: formData.role,
          status: "pending", // 이메일 확인 전 상태
        },
      ]);

      if (insertUserError) {
        console.error("사용자 정보 저장 오류:", insertUserError);
        throw new Error(`사용자 정보 저장에 실패했습니다: ${insertUserError.message}`);
      }

      // 5. 사용자-회사 연결 (회사 ID가 제공된 경우)
      if (formData.company_id) {
        const { error: insertLinkError } = await supabase.from("user_companies").insert([
          {
            user_id: authUserId,
            company_id: parseInt(formData.company_id),
            assigned_date: new Date().toISOString().split("T")[0],
          },
        ]);

        if (insertLinkError) {
          console.error("사용자-회사 연결 오류:", insertLinkError);
          // 오류 발생 시 사용자 정보 삭제 시도
          await supabase.from("users").delete().eq("id", authUserId);
          throw new Error(`사용자-회사 연결에 실패했습니다: ${insertLinkError.message}`);
        }
      }

      // 6. 사용자-현장 연결 (현장 ID 목록이 제공된 경우)
      if (selectedSites.length > 0) {
        const userSiteData = selectedSites.map((site_id) => ({
          user_id: authUserId,
          site_id,
          assigned_date: new Date().toISOString().split("T")[0],
        }));

        const { error: siteAssignError } = await supabase
          .from("user_construction_sites")
          .insert(userSiteData);

        if (siteAssignError) {
          console.error("사용자-현장 연결 오류:", siteAssignError);
        }
      }

      // 폼 초기화 (성공 후)
      setFormData({
        username: "",
        email: "",
        name: "",
        contact_number: "",
        role: "user",
        company_id: currentCompany ? currentCompany.company_id : "",
        password: "",
        confirmPassword: "",
      });

      // 성공 후 사용자 관리 페이지로 이동
      router.push("/dashboard/users");
    } catch (error) {
      console.error("사용자 등록 오류:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <RoleGuard requiredPermission="MANAGE_USERS">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {currentCompany && (
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-500" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-blue-700">
                    현재 접속 회사: <span className="font-bold">{currentCompany.company_name}</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          <h1 className="text-2xl font-bold mb-6">사용자 추가</h1>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4"
            autoComplete="off"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="username">
                  아이디 *
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleChange}
                  autoComplete="off"
                  required
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
                  이름 *
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  autoComplete="off"
                  required
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
                  이메일 *
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  autoComplete="off"
                  required
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>

              <div className="mb-4">
                <label
                  className="block text-gray-700 text-sm font-bold mb-2"
                  htmlFor="contact_number"
                >
                  연락처
                </label>
                <input
                  id="contact_number"
                  name="contact_number"
                  type="text"
                  value={formData.contact_number}
                  onChange={handleChange}
                  autoComplete="off"
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                />
              </div>

              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                  비밀번호 *
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={handleChange}
                    autoComplete="new-password"
                    required
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline pr-10"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-gray-500"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path
                          fillRule="evenodd"
                          d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-gray-500"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                          clipRule="evenodd"
                        />
                        <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label
                  className="block text-gray-700 text-sm font-bold mb-2"
                  htmlFor="confirmPassword"
                >
                  비밀번호 확인 *
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    autoComplete="new-password"
                    required
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline pr-10"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-gray-500"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path
                          fillRule="evenodd"
                          d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-gray-500"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z"
                          clipRule="evenodd"
                        />
                        <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {passwordError && (
                <div className="col-span-2 mb-4 text-red-500 text-sm">{passwordError}</div>
              )}

              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="role">
                  역할 *
                </label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  required
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                >
                  <option value="user">일반 사용자</option>
                  <option value="site_manager">현장 관리자</option>
                  <option value="sub_manager">서브 관리자</option>
                  <option value="manager">관리자</option>
                  <option value="admin">최고 관리자</option>
                </select>
              </div>
            </div>

            {/* 담당 공사현장 선택 섹션 */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <label className="block text-gray-700 text-sm font-bold">담당 공사현장</label>
                <button
                  type="button"
                  onClick={handleSelectAllSites}
                  className="text-sm text-blue-500 hover:text-blue-700"
                >
                  {selectedSites.length === constructionSites.length && constructionSites.length > 0
                    ? "전체 선택 해제"
                    : "전체 선택"}
                </button>
              </div>

              {constructionSites.length > 0 ? (
                <div className="bg-gray-50 p-3 rounded border max-h-60 overflow-y-auto">
                  {constructionSites.map((site) => (
                    <div key={site.site_id} className="mb-2 last:mb-0">
                      <label className="inline-flex items-center">
                        <input
                          type="checkbox"
                          className="form-checkbox h-5 w-5 text-blue-600"
                          checked={selectedSites.includes(site.site_id)}
                          onChange={() => handleSiteSelect(site.site_id)}
                        />
                        <span className="ml-2">{site.site_name}</span>
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 p-3 rounded border text-gray-500 text-center">
                  {formData.company_id
                    ? "등록된 공사현장이 없습니다."
                    : "회사를 선택하면 공사현장 목록이 표시됩니다."}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-6">
              <Link
                href="/dashboard/users"
                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
              >
                취소
              </Link>
              <button
                type="submit"
                disabled={loading || passwordError}
                className={`${
                  loading || passwordError ? "bg-blue-400" : "bg-blue-500 hover:bg-blue-700"
                } text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline`}
              >
                {loading ? "저장 중..." : "사용자 추가"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </RoleGuard>
  );
}
