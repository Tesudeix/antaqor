"use client";

import Link from "next/link";
import Image from "next/image";
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
    <nav className="sticky top-0 z-50 border-b border-[rgba(0,0,0,0.06)] bg-[rgba(255,255,1,0.95)] backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 md:px-8 lg:px-12">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="Antaqor" width={28} height={28} className="rounded-[4px]" />
          <span className="text-[16px] font-black tracking-[3px] text-[#0a0a0a]">ANTAQOR</span>
        </Link>

        {/* Center tabs - desktop */}
        <div className="hidden items-center gap-1 md:flex">
          {[
            { href: "/", label: "Мэдээ", check: (p: string) => p === "/" || p.startsWith("/posts") },
            { href: "/classroom", label: "Хичээл", check: (p: string) => p.startsWith("/classroom") },
            { href: "/members", label: "Гишүүд", check: (p: string) => p.startsWith("/members") },
          ].map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`rounded-[4px] px-5 py-2 text-[13px] font-bold transition ${
                tab.check(pathname)
                  ? "bg-[#0a0a0a] text-[#FFFF01]"
                  : "text-[rgba(0,0,0,0.35)] hover:text-[#0a0a0a]"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {session ? (
            <>
              <NotificationBell />
              <Link
                href={`/profile/${(session.user as { id?: string })?.id || ""}`}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0a0a0a] text-[12px] font-bold text-[#FFFF01] transition hover:scale-105"
              >
                {session.user?.name?.charAt(0).toUpperCase() || "U"}
              </Link>
            </>
          ) : (
            <>
              <Link href="/auth/signin" className="text-[13px] font-semibold text-[rgba(0,0,0,0.4)] transition hover:text-[#0a0a0a]">
                Нэвтрэх
              </Link>
              <Link href="/auth/signup" className="rounded-[4px] bg-[#0a0a0a] px-5 py-2 text-[12px] font-bold text-[#FFFF01] transition hover:scale-105">
                Бүртгүүлэх
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
