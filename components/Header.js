"use client";

import { useState } from "react";
import { FaBars, FaBell, FaUser } from "react-icons/fa";
import { useAuthStore } from "@/lib/store/authStore";
import Link from "next/link";
export default function Header({ toggleSidebar }) {
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const { user, clearAuth } = useAuthStore();

  const handleLogout = async () => {
    // 로그아웃 로직
    const { supabase } = await import("@/lib/supabase");
    await supabase.auth.signOut();
    clearAuth();
    window.location.href = "/login";
  };

  return (
    <header className="bg-white shadow-md py-3 px-4 flex items-center justify-between">
      <button className="lg:hidden text-gray-600 focus:outline-none" onClick={toggleSidebar}>
        <FaBars size={24} />
      </button>

      <div className="lg:ml-4 flex-1 lg:flex-initial">
        <h1 className="text-xl font-bold text-gray-800 lg:hidden">일용근로자 관리</h1>
      </div>

      <div className="flex items-center">
        <button className="text-gray-600 hover:text-gray-800 mr-4 relative">
          <FaBell size={20} />
          <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500"></span>
        </button>

        <div className="relative">
          <button
            className="flex items-center text-gray-700 hover:text-gray-900 focus:outline-none"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
          >
            <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-700 mr-2">
              <FaUser />
            </div>
            <span className="hidden md:block">{user?.name || "사용자"}</span>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
              <Link
                href="/dashboard/profile"
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                onClick={() => setShowProfileMenu(false)}
              >
                내 프로필
              </Link>
              {/* <a href="#" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                설정
              </a> */}
              <button
                onClick={handleLogout}
                className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                로그아웃
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
