//file: app/register/user/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { FaEye, FaEyeSlash } from "react-icons/fa"; // 눈 아이콘 import

export default function UserRegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const companyIdFromURL = searchParams.get("company_id");

  const [companyData, setCompanyData] = useState(null);
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    contact_number: "",
    address: "",
    role: "user",
    company_id: companyIdFromURL || "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [companies, setCompanies] = useState([]);
  const [passwordError, setPasswordError] = useState(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    // 회사 목록 가져오기 (URL에 company_id가 없는 경우에만)
    async function fetchCompanies() {
      if (!companyIdFromURL) {
        const { data, error } = await supabase
          .from("companies")
          .select("company_id, company_name, business_number");

        if (!error && data) {
          setCompanies(data);
        }
      }
    }

    // 특정 회사 정보 가져오기 (URL 파라미터로 회사 ID가 제공된 경우)
    async function fetchCompanyData() {
      if (companyIdFromURL) {
        const { data, error } = await supabase
          .from("companies")
          .select("*")
          .eq("company_id", companyIdFromURL)
          .single();

        if (!error && data) {
          setCompanyData(data);
          setFormData((prev) => ({
            ...prev,
            company_id: companyIdFromURL,
          }));
        }
      }
    }

    fetchCompanies();
    fetchCompanyData();
  }, [companyIdFromURL]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (name === "password") {
      setPasswordError(value.length < 6 ? "비밀번호는 6자 이상이어야 합니다." : null);
    }
    if (name === "confirmPassword") {
      setConfirmPasswordError(value !== formData.password ? "비밀번호가 일치하지 않습니다." : null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);
    setPasswordError(formData.password.length < 6 ? "비밀번호는 6자 이상이어야 합니다." : null);
    setConfirmPasswordError(
      formData.confirmPassword !== formData.password ? "비밀번호가 일치하지 않습니다." : null
    );

    if (formData.password.length < 6 || formData.confirmPassword !== formData.password) {
      setLoading(false);
      return;
    }

    try {
      // 사용자명 중복 확인
      const { data: existingUsername } = await supabase
        .from("users")
        .select("id")
        .eq("username", formData.username)
        .maybeSingle();

      if (existingUsername) {
        throw new Error("이미 사용 중인 아이디입니다.");
      }

      // 이메일 중복 확인 - Supabase Auth와 커스텀 users 테이블 모두 확인
      // 1. 먼저 커스텀 users 테이블에서 확인
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", formData.email)
        .maybeSingle();

      if (existingUser) {
        throw new Error("이미 등록된 이메일입니다.");
      }

      // 2. Supabase Auth에서 이메일 확인
      try {
        // Supabase Auth로 사용자 등록 (이메일 확인 요청 활성화)
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              username: formData.username,
              name: formData.name,
            },
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

        // 사용자 정보 저장 (email_confirmed_at은 null로 유지)
        const { error: insertUserError } = await supabase.from("users").insert([
          {
            id: authUserId, // Supabase Auth의 uid를 users 테이블의 id로 사용
            username: formData.username,
            name: formData.name,
            email: formData.email,
            contact_number: formData.contact_number,
            role: formData.role,
            business_number: companyData?.business_number || "",
            status: "pending", // 이메일 확인 전 상태
          },
        ]);

        if (insertUserError) {
          console.error("사용자 정보 저장 오류:", insertUserError);
          // 클라이언트에서는 admin API를 호출할 수 없으므로, 오류만 표시
          // 서버 측에서 처리가 필요한 부분입니다
          throw new Error(`사용자 정보 저장에 실패했습니다. 관리자에게 문의하세요.`);
        }

        // 사용자-회사 연결 테이블에 데이터 추가
        if (formData.company_id) {
          const { error: insertLinkError } = await supabase.from("user_companies").insert([
            {
              user_id: authUserId,
              company_id: parseInt(formData.company_id), // company_id는 integer로 가정
              assigned_date: new Date().toISOString().split("T")[0],
            },
          ]);

          if (insertLinkError) {
            console.error("사용자-회사 연결 오류:", insertLinkError);
            // 클라이언트에서는 admin API를 호출할 수 없으므로 간단한 삭제만 시도
            await supabase.from("users").delete().eq("id", authUserId);
            throw new Error(`사용자-회사 연결에 실패했습니다. 다시 시도해주세요.`);
          }
        }

        setSuccessMessage(
          "회원가입이 완료되었습니다. 입력하신 이메일 주소로 인증 메일이 발송되었습니다. 메일함을 확인하여 인증을 완료해주세요."
        );
      } catch (error) {
        // 이미 등록된 사용자인 경우 처리
        if (error.message.includes("이미 등록된 이메일")) {
          setError(error.message);
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error("회원가입 오류:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">사용자 등록</h1>
          <p className="text-gray-600 mt-2">
            {companyData
              ? `${companyData.company_name} 의 사용자를 등록합니다.`
              : "건설 현장 4대보험 관리 시스템에 사용자를 등록해주세요."}
          </p>
        </div>

        {successMessage ? (
          <div className="bg-green-100 text-green-700 p-4 rounded mb-6">
            {successMessage}
            <p className="mt-2">
              <Link href="/login" className="text-blue-500 hover:text-blue-700">
                로그인 화면으로 돌아가기
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && <div className="bg-red-100 text-red-700 p-4 rounded mb-6">{error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <label className="block text-gray-700 mb-2" htmlFor="username">
                  아이디 <span className="text-red-500">*</span>
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2" htmlFor="name">
                  이름
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2" htmlFor="email">
                  이메일 <span className="text-red-500">*</span>
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-gray-700 mb-2" htmlFor="contact_number">
                  연락처
                </label>
                <input
                  id="contact_number"
                  name="contact_number"
                  type="text"
                  placeholder="010-0000-0000"
                  value={formData.contact_number}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                />
              </div>

              <div className="relative">
                <label className="block text-gray-700 mb-2" htmlFor="password">
                  비밀번호 <span className="text-red-500">*</span>
                </label>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                />
                <button
                  type="button"
                  className="absolute right-2 top-8 text-gray-500 cursor-pointer"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
                {passwordError && <p className="text-red-500 text-xs mt-1">{passwordError}</p>}
              </div>

              <div className="relative">
                <label className="block text-gray-700 mb-2" htmlFor="confirmPassword">
                  비밀번호 확인 <span className="text-red-500">*</span>
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                />
                <button
                  type="button"
                  className="absolute right-2 top-8 text-gray-500 cursor-pointer"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
                {confirmPasswordError && (
                  <p className="text-red-500 text-xs mt-1">{confirmPasswordError}</p>
                )}
              </div>

              {!companyIdFromURL && (
                <div>
                  <label className="block text-gray-700 mb-2" htmlFor="company_id">
                    회사 <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="company_id"
                    name="company_id"
                    required
                    value={formData.company_id}
                    onChange={handleChange}
                    className="w-full p-2 border rounded"
                  >
                    <option value="">회사 선택</option>
                    {companies.map((company) => (
                      <option key={company.company_id} value={company.company_id}>
                        {company.company_name} ({company.business_number})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-gray-700 mb-2" htmlFor="role">
                  권한 <span className="text-red-500">*</span>
                </label>
                <select
                  id="role"
                  name="role"
                  required
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full p-2 border rounded"
                >
                  <option value="user">일반 사용자</option>
                  <option value="site_manager">현장 관리자</option>
                  <option value="manager">관리자</option>
                  <option value="admin">최고고관리자</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between mt-8">
              <div>
                {!companyIdFromURL && (
                  <Link href="/company/register" className="text-blue-500 hover:text-blue-700">
                    회사 등록으로 돌아가기
                  </Link>
                )}
                {companyIdFromURL && (
                  <Link href={`/company/register`} className="text-blue-500 hover:text-blue-700">
                    회사 등록으로 돌아가기
                  </Link>
                )}
              </div>
              <div>
                <Link
                  href="/login"
                  className="mr-4 inline-block px-4 py-2 text-blue-600 border border-blue-600 rounded hover:bg-blue-50"
                >
                  로그인 화면으로
                </Link>
                <button
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                  disabled={loading || passwordError || confirmPasswordError}
                >
                  {loading ? "처리 중..." : "사용자 등록하기"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
