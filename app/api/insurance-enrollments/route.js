import { NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export async function GET(req) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // 사용자 인증 확인
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "인증되지 않은 사용자입니다" }, { status: 401 });
    }

    // 쿼리 파라미터 추출
    const url = new URL(req.url);
    const siteId = url.searchParams.get("site_id");
    const yearMonth = url.searchParams.get("year_month");

    if (!siteId || !yearMonth) {
      return NextResponse.json({ error: "필수 파라미터가 누락되었습니다" }, { status: 400 });
    }

    // 보험 가입 정보 조회
    const { data, error } = await supabase
      .from("insurance_enrollments")
      .select("*")
      .eq("site_id", siteId)
      .eq("year_month", yearMonth);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("보험 가입 정보 조회 오류:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // 사용자 인증 확인
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "인증되지 않은 사용자입니다" }, { status: 401 });
    }

    // 요청 본문 파싱
    const body = await req.json();

    // 필수 필드 검증
    const requiredFields = ["worker_id", "site_id", "year_month"];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json({ error: `${field} 필드는 필수입니다` }, { status: 400 });
      }
    }

    // 보험 가입 정보 생성/수정
    const { data, error } = await supabase
      .from("insurance_enrollments")
      .upsert(
        {
          ...body,
          created_by: user.id,
          updated_by: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "worker_id,site_id,year_month",
        }
      )
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("보험 가입 정보 저장 오류:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
