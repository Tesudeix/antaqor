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
          ANTA<span className="text-[#006491]">QOR</span>
        </Link>

        {/* Center tabs - desktop */}
        <div className="hidden items-center gap-1 md:flex">
          <Link
            href="/"
            className={`rounded-lg px-4 py-2 text-[13px] font-medium transition ${
              isActive("/") && !isActive("/classroom")
                ? "bg-[#0c0c10] text-[#e8e6e1]"
                : "text-[#6b6b78] hover:text-[#e8e6e1]"
            }`}
          >
            Мэдээ
          </Link>
          <Link
            href="/classroom"
            className={`rounded-lg px-4 py-2 text-[13px] font-medium transition ${
              isActive("/classroom")
                ? "bg-[#0c0c10] text-[#e8e6e1]"
                : "text-[#6b6b78] hover:text-[#e8e6e1]"
            }`}
          >
            Хичээл
          </Link>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {session ? (
            <>
              <NotificationBell />
              <Link
                href={`/profile/${(session.user as { id?: string })?.id || ""}`}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0c0c10] text-[12px] font-bold text-[#e8e6e1] transition hover:bg-[#1a1a22]"
              >
                {session.user?.name?.charAt(0).toUpperCase() || "U"}
              </Link>
              <button
                onClick={() => signOut()}
                className="hidden text-[13px] text-[#6b6b78] transition hover:text-[#e8e6e1] md:block"
              >
                Гарах
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/signin" className="text-[13px] text-[#6b6b78] transition hover:text-[#e8e6e1]">
                Нэвтрэх
              </Link>
              <Link href="/auth/signup" className="btn-primary !py-2 !px-4 !text-[12px]">
                Бүртгүүлэх
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
