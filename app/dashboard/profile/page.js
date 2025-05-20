//file: app/dashboard/profile/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/store/authStore";
import {
  FaUser,
  FaEnvelope,
  FaPhone,
  FaBuilding,
  FaUserTag,
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";

export default function ProfilePage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [userData, setUserData] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  // 비밀번호 표시 상태 관리
  const [showPasswords, setShowPasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  useEffect(() => {
    // 사용자 데이터가 없으면 로그인 페이지로 리디렉션
    if (!user) {
      router.push("/login");
      return;
    }

    // 사용자 상세 정보 및 소속 회사 조회
    async function fetchUserDetails() {
      try {
        // 사용자 정보 조회
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single();

        if (userError) throw userError;
        setUserData(userData);

        // 소속 회사 조회
        const { data: companyLink, error: linkError } = await supabase
          .from("user_companies")
          .select("company_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!linkError && companyLink?.company_id) {
          const { data: companyData, error: companyError } = await supabase
            .from("companies")
            .select("*")
            .eq("company_id", companyLink.company_id)
            .single();

          if (!companyError) {
            setCompany(companyData);
          }
        }
      } catch (error) {
        console.error("사용자 정보 조회 오류:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchUserDetails();
  }, [user, router]);

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // 비밀번호 표시/숨김 토글 함수
  const togglePasswordVisibility = (field) => {
    setShowPasswords((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // 유효성 검사
    if (passwordData.newPassword.length < 6) {
      setError("새 비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError("새 비밀번호와 확인 비밀번호가 일치하지 않습니다.");
      return;
    }

    // 새 비밀번호가 현재 비밀번호와 같은지 확인 (클라이언트 측)
    if (passwordData.currentPassword === passwordData.newPassword) {
      setError("새 비밀번호는 현재 비밀번호와 달라야 합니다.");
      return;
    }

    try {
      // 현재 supabase.auth.updateUser는 현재 비밀번호 확인 없이
      // 바로 비밀번호를 변경하려고 시도합니다.
      // Supabase에서는 현재 비밀번호를 확인하는 API를 직접 제공하지 않으므로
      // 해결 방법으로 signInWithPassword를 사용해 현재 비밀번호를 먼저 확인합니다.

      // 1. 먼저 현재 비밀번호가 맞는지 확인
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userData.email, // userData에서 이메일 가져옴
        password: passwordData.currentPassword,
      });

      if (signInError) {
        console.error("현재 비밀번호 확인 오류:", signInError);
        setError("현재 비밀번호가 올바르지 않습니다.");
        return;
      }

      // 2. 현재 비밀번호가 맞으면 비밀번호 변경 시도
      // 로그인 세션 충돌을 방지하기 위해 약간의 지연 적용
      setTimeout(async () => {
        try {
          const { error: updateError } = await supabase.auth.updateUser({
            password: passwordData.newPassword,
          });

          if (updateError) {
            console.error("비밀번호 업데이트 오류:", updateError);

            if (updateError.message.includes("should be different")) {
              setError("새 비밀번호는 현재 비밀번호와 달라야 합니다.");
            } else if (updateError.status === 422) {
              setError("비밀번호 변경이 처리되지 않았습니다. 다시 로그인 후 시도해보세요.");
            } else {
              setError("비밀번호 변경 중 오류가 발생했습니다: " + updateError.message);
            }
            return;
          }

          // 성공 메시지 표시
          setSuccess("비밀번호가 성공적으로 변경되었습니다.");
          setShowSuccessMessage(true); // 성공 메시지 표시 상태 활성화
          setPasswordData({
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
          });
          setShowPasswordChange(false);
        } catch (error) {
          console.error("비밀번호 변경 처리 중 오류:", error);
          setError("비밀번호 변경 중 예상치 못한 오류가 발생했습니다.");
        }
      }, 500);
    } catch (error) {
      console.error("비밀번호 변경 프로세스 오류:", error);
      setError("비밀번호 변경 중 오류가 발생했습니다: " + error.message);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">로딩 중...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">내 프로필</h1>

        {/* 사용자 정보 카드 */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden mb-8">
          <div className="p-6 bg-blue-50 border-b">
            <div className="flex items-center">
              <div className="w-20 h-20 rounded-full bg-blue-500 flex items-center justify-center text-white text-3xl font-bold mr-6">
                {userData?.name ? userData.name.charAt(0).toUpperCase() : <FaUser />}
              </div>
              <div>
                <h2 className="text-2xl font-bold">{userData?.name}</h2>
                <p className="text-gray-600">{userData?.role}</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <h3 className="text-lg font-semibold mb-4">기본 정보</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 mr-3 mt-1">
                  <FaUser />
                </div>
                <div>
                  <p className="text-sm text-gray-500">사용자명</p>
                  <p className="font-medium">{userData?.username}</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-500 mr-3 mt-1">
                  <FaEnvelope />
                </div>
                <div>
                  <p className="text-sm text-gray-500">이메일</p>
                  <p className="font-medium">{userData?.email}</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-500 mr-3 mt-1">
                  <FaPhone />
                </div>
                <div>
                  <p className="text-sm text-gray-500">연락처</p>
                  <p className="font-medium">{userData?.contact_number || "-"}</p>
                </div>
              </div>

              <div className="flex items-start">
                <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-500 mr-3 mt-1">
                  <FaUserTag />
                </div>
                <div>
                  <p className="text-sm text-gray-500">역할</p>
                  <p className="font-medium">
                    {userData?.role === "admin"
                      ? "최고 관리자"
                      : userData?.role === "manager"
                      ? "관리자"
                      : userData?.role === "site_manager"
                      ? "현장 관리자"
                      : "일반 사용자"}
                  </p>
                </div>
              </div>
            </div>

            {company && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-4">소속 회사</h3>
                <div className="flex items-start">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-500 mr-3 mt-1">
                    <FaBuilding />
                  </div>
                  <div>
                    <p className="font-medium">{company.company_name}</p>
                    <p className="text-sm text-gray-500">
                      사업자등록번호: {company.business_number}
                    </p>
                    <p className="text-sm text-gray-500">{company.address}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 비밀번호 변경 섹션 */}
        <div className="bg-white shadow-md rounded-lg overflow-hidden">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">계정 보안</h3>
          </div>

          <div className="p-6">
            {/* 성공 메시지 표시 */}
            {showSuccessMessage && (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                {success}
              </div>
            )}

            {!showPasswordChange ? (
              <button
                onClick={() => {
                  setShowPasswordChange(true);
                  setShowSuccessMessage(false); // 비밀번호 변경 폼을 열 때 성공 메시지 숨김
                }}
                className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded"
              >
                비밀번호 변경
              </button>
            ) : (
              <div>
                {error && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    {error}
                  </div>
                )}

                <form onSubmit={handlePasswordSubmit}>
                  <div className="mb-4">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="currentPassword"
                    >
                      현재 비밀번호
                    </label>
                    <div className="relative">
                      <input
                        id="currentPassword"
                        name="currentPassword"
                        type={showPasswords.currentPassword ? "text" : "password"}
                        value={passwordData.currentPassword}
                        onChange={handlePasswordChange}
                        required
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline pr-10"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                        onClick={() => togglePasswordVisibility("currentPassword")}
                      >
                        {showPasswords.currentPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="newPassword"
                    >
                      새 비밀번호
                    </label>
                    <div className="relative">
                      <input
                        id="newPassword"
                        name="newPassword"
                        type={showPasswords.newPassword ? "text" : "password"}
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                        required
                        minLength={6}
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline pr-10"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                        onClick={() => togglePasswordVisibility("newPassword")}
                      >
                        {showPasswords.newPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      비밀번호는 최소 6자 이상이어야 합니다.
                    </p>
                  </div>

                  <div className="mb-6">
                    <label
                      className="block text-gray-700 text-sm font-bold mb-2"
                      htmlFor="confirmPassword"
                    >
                      새 비밀번호 확인
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showPasswords.confirmPassword ? "text" : "password"}
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                        required
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline pr-10"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                        onClick={() => togglePasswordVisibility("confirmPassword")}
                      >
                        {showPasswords.confirmPassword ? <FaEyeSlash /> : <FaEye />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => setShowPasswordChange(false)}
                      className="text-gray-600 hover:text-gray-800 mr-4"
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded"
                    >
                      변경 저장
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
