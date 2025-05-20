//file: app/login/page.js
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/lib/store/authStore";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const redirectToDashboard = () => {
    router.push("/dashboard");

    // fallback: push 실패 시 강제 이동
    setTimeout(() => {
      if (window.location.pathname !== "/dashboard") {
        window.location.href = "/dashboard";
      }
    }, 1000);
  };

  // 사용자 정보를 가져와서 Auth 스토어에 저장하는 함수
  const fetchUserAndSetAuth = async (session) => {
    if (!session) return null;

    try {
      // 커스텀 사용자 테이블에서 추가 정보 가져오기
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", session.user.id)
        .single();

      if (userError) {
        console.error("사용자 상세 정보 조회 오류:", userError);
        // 오류가 있어도 기본 세션 정보로 진행
        setAuth(session, session.user);
        return session.user;
      }

      // 인증 데이터와 커스텀 사용자 데이터 병합
      const enrichedUser = {
        ...session.user,
        // 커스텀 필드 추가
        role: userData.role,
        name: userData.name,
        username: userData.username,
        status: userData.status,
        contact_number: userData.contact_number,
      };

      // 저장소에 저장
      setAuth(session, enrichedUser);
      console.log("사용자 정보 업데이트 완료:", enrichedUser);
      return enrichedUser;
    } catch (error) {
      console.error("사용자 정보 처리 오류:", error);
      // 오류 시 기본 세션 정보 사용
      setAuth(session, session.user);
      return session.user;
    }
  };

  useEffect(() => {
    const checkInitialSession = async () => {
      const urlHasToken = window.location.hash.includes("access_token");
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("세션 확인 오류:", sessionError);
        return;
      }

      if (sessionData?.session) {
        console.log(urlHasToken ? "이메일 확인 후 로그인됨" : "기존 세션 로그인됨");
        await fetchUserAndSetAuth(sessionData.session);
        redirectToDashboard();
      }
    };

    checkInitialSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session) {
        console.log("로그인 이벤트 감지");
        await fetchUserAndSetAuth(session);
        redirectToDashboard();
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [router, setAuth]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      console.log("로그인 시도 - 이메일:", email);

      // Supabase Auth로 로그인
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("로그인 오류:", error);

        if (error.message === "Invalid login credentials") {
          throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
        } else if (error.message.includes("Email not confirmed")) {
          throw new Error("이메일 인증이 완료되지 않았습니다. 메일함(또는 스팸함)을 확인해주세요.");
        } else {
          throw error;
        }
      }

      // 커스텀 사용자 정보 가져오기 및 저장
      await fetchUserAndSetAuth(data.session);
      console.log("로그인 성공!");
      redirectToDashboard();
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center">일용근로자 근로관리 시스템</h1>

        <form onSubmit={handleLogin}>
          {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

          <div className="mb-4">
            <label className="block text-gray-700 mb-2" htmlFor="email">
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-gray-700 mb-2" htmlFor="password">
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
            disabled={loading}
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <div className="mt-4 text-right">
          <Link href="/password-reset" className="text-blue-500 hover:text-blue-700 text-sm">
            비밀번호를 잊으셨나요?
          </Link>
        </div>

        <div className="mt-6 text-center">
          <p className="text-gray-600">아직 계정이 없으신가요?</p>
          <Link
            href="/register/company"
            className="text-blue-500 hover:text-blue-700 font-semibold mt-2 inline-block"
          >
            회사 등록하기
          </Link>
        </div>
      </div>
    </div>
  );
}
