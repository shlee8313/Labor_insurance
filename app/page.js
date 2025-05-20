import Link from "next/link";

export default function Home() {
  return (
    <div>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "1rem",
        }}
      >
        <div>
          <Link href="/login">
            <button style={{ marginRight: "1rem" }}>로그인</button>
          </Link>
          <Link href="/register/company">
            <button>회원가입</button>
          </Link>
        </div>
      </header>

      <main style={{ padding: "1rem" }}>여기는 Home 페이지입니다.</main>
    </div>
  );
}
