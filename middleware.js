import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });

  try {
    // 명시적으로 쿠키에서 세션 가져오기
    const {
      data: { session },
    } = await supabase.auth.getSession();

    console.log("미들웨어 세션 확인:", !!session, req.nextUrl.pathname);

    // 인증 필요한 경로에 대한 처리
    if (!session && req.nextUrl.pathname.startsWith("/dashboard")) {
      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = "/login";
      redirectUrl.searchParams.set("redirectedFrom", req.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // 세션 정보를 응답 헤더에 추가 (미들웨어 간 일관성 유지)
    if (session) {
      res.headers.set("x-user-id", session.user.id);
    }
  } catch (error) {
    console.error("미들웨어 세션 확인 오류:", error);
  }

  return res;
}

export const config = {
  matcher: ["/api/:path*"],
};
