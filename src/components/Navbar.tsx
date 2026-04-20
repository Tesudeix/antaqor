"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import NotificationBell from "./NotificationBell";

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const tabs = [
    { href: "/", label: "Мэдээ", check: (p: string) => p === "/" || p.startsWith("/posts") },
    { href: "/classroom", label: "Хичээл", check: (p: string) => p.startsWith("/classroom") },
    { href: "/services", label: "Үйлчилгээ", check: (p: string) => p.startsWith("/services") || p.startsWith("/tools") },
    { href: "/members", label: "Гишүүд", check: (p: string) => p.startsWith("/members") },
  ];

  return (
    <nav className="sticky top-0 z-50 border-b border-[rgba(255,255,255,0.08)] bg-[rgba(10,10,10,0.92)] backdrop-blur-xl">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6 md:px-8 lg:px-12">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/favicon.png" alt="Antaqor" width={28} height={28} className="rounded-[4px]" />
          <span className="text-[15px] font-bold tracking-[3px] text-[#E8E8E8]">
            ANTAQOR
          </span>
        </Link>

        {/* Center pill tabs - desktop */}
        <div className="hidden items-center rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] p-1 md:flex">
          {tabs.map((tab) => {
            const active = tab.check(pathname);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`rounded-[4px] px-5 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
                  active
                    ? "bg-[#EF2C58] text-white"
                    : "text-[#666666] hover:text-[#999999]"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {session ? (
            <>
              <NotificationBell />
              <Link
                href={`/profile/${(session.user as { id?: string })?.id || ""}`}
                className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] text-[12px] font-bold text-[#EF2C58] transition-all duration-200 hover:border-[rgba(239,44,88,0.4)] hover:shadow-[0_0_16px_rgba(239,44,88,0.1)] overflow-hidden"
              >
                {session.user?.image ? (
                  <img src={session.user.image} alt={session.user?.name || ""} className="h-8 w-8 rounded-[4px] object-cover" />
                ) : (
                  session.user?.name?.charAt(0).toUpperCase() || "U"
                )}
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/auth/signin"
                className="text-[13px] font-medium text-[#666666] transition-colors duration-200 hover:text-[#E8E8E8]"
              >
                Нэвтрэх
              </Link>
              <Link
                href="/auth/signup"
                className="rounded-[4px] bg-[#EF2C58] px-5 py-2 text-[12px] font-bold text-white transition-all duration-200 hover:shadow-[0_0_24px_rgba(239,44,88,0.25)]"
              >
                Бүртгүүлэх
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
