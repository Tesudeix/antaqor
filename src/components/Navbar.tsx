"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import NotificationBell from "./NotificationBell";

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-[#1a1a22] bg-[rgba(6,6,8,0.92)] backdrop-blur-lg">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-3">
        {/* Logo */}
        <Link href="/" className="text-lg font-bold tracking-[3px] text-[#e8e6e1]">
          ANTA<span className="text-[#FFD300]">QOR</span>
        </Link>

        {/* Center tabs - desktop */}
        <div className="hidden items-center gap-0.5 md:flex">
          <Link
            href="/"
            className={`px-4 py-2 text-[13px] font-semibold transition ${
              isActive("/") && !isActive("/classroom") && !isActive("/members")
                ? "text-[#e8e6e1]"
                : "text-[#3a3a48] hover:text-[#6b6b78]"
            }`}
          >
            Мэдээ
          </Link>
          <Link
            href="/classroom"
            className={`px-4 py-2 text-[13px] font-semibold transition ${
              isActive("/classroom")
                ? "text-[#e8e6e1]"
                : "text-[#3a3a48] hover:text-[#6b6b78]"
            }`}
          >
            Хичээл
          </Link>
          <Link
            href="/members"
            className={`px-4 py-2 text-[13px] font-semibold transition ${
              isActive("/members")
                ? "text-[#e8e6e1]"
                : "text-[#3a3a48] hover:text-[#6b6b78]"
            }`}
          >
            Гишүүд
          </Link>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {session ? (
            <>
              <NotificationBell />
              <Link
                href={`/profile/${(session.user as { id?: string })?.id || ""}`}
                className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[#1a1a22] text-[12px] font-bold text-[#6b6b78] transition hover:text-[#e8e6e1]"
              >
                {session.user?.name?.charAt(0).toUpperCase() || "U"}
              </Link>
            </>
          ) : (
            <>
              <Link href="/auth/signin" className="text-[13px] text-[#3a3a48] transition hover:text-[#e8e6e1]">
                Нэвтрэх
              </Link>
              <Link href="/auth/signup" className="rounded-[4px] bg-[#FFD300] px-4 py-1.5 text-[12px] font-semibold text-black transition hover:bg-[#e6be00]">
                Бүртгүүлэх
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
