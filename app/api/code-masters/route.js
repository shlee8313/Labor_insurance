//file: app/api/code-masters/route.js

import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request) {
  try {
    // URL 검색 파라미터 가져오기
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const format = searchParams.get("format");
    const search = searchParams.get("search"); // 검색어 파라미터 추가

    // format=types 파라미터가 있으면 코드 타입 목록만 조회
    if (format === "types") {
      // distinctOn 메서드 대신 일반 쿼리로 고유 코드 타입 조회
      try {
        // 먼저 RPC 함수가 있는지 시도
        const { data: rpcData, error: rpcError } = await supabase.rpc("get_distinct_code_types");

        if (!rpcError && rpcData) {
          return NextResponse.json(rpcData);
        }

        // RPC 실패시 대체 방법으로 일반 쿼리 사용
        console.log("Falling back to direct query for distinct code types");
      } catch (e) {
        console.log("RPC method not available, using fallback", e);
      }

      // 대체 쿼리: 직접 코드 타입 조회
      const { data, error } = await supabase.from("code_masters").select("code_type");

      if (error) throw error;

      // Set을 이용한 중복 제거
      const uniqueTypes = [...new Set(data.map((item) => item.code_type))];
      return NextResponse.json(uniqueTypes);
    }

    // type 파라미터가 있으면 해당 코드 타입만 조회
    if (type) {
      let query = supabase.from("code_masters").select("*").eq("code_type", type);

      // 검색어가 있는 경우 필터링
      if (search) {
        query = query.or(
          `code_value.ilike.%${search}%,code_name.ilike.%${search}%,description.ilike.%${search}%`
        );
      }

      // 활성 상태와 정렬 적용
      query = query.eq("is_active", true).order("sort_order").order("code_value");

      const { data, error } = await query;

      if (error) throw error;

      return NextResponse.json(data);
    }

    // 기본: 모든 코드 데이터 조회
    const { data, error } = await supabase
      .from("code_masters")
      .select("*")
      .eq("is_active", true)
      .order("code_type")
      .order("sort_order")
      .order("code_value");

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err) {
    console.error("Error fetching code masters:", err);

    return NextResponse.json(
      {
        error: "코드 데이터를 불러오는 중 오류가 발생했습니다.",
        details: process.env.NODE_ENV === "development" ? err.message : undefined,
      },
      { status: 500 }
    );
  }
}
