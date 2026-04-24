"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import NotificationBell from "./NotificationBell";

function CreditChip() {
  const { data: session } = useSession();
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    const load = () => {
      fetch("/api/credits")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (!cancelled && typeof d?.balance === "number") setBalance(d.balance); })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 60000);
    return () => { cancelled = true; clearInterval(t); };
  }, [session]);

  if (!session?.user || balance === null) return null;
  return (
    <Link
      href="/credits"
      title="Миний кредит"
      className="group hidden items-center gap-1.5 rounded-[4px] border border-[rgba(239,44,88,0.2)] bg-[rgba(239,44,88,0.06)] px-2.5 py-1 text-[12px] font-bold text-[#EF2C58] transition hover:bg-[rgba(239,44,88,0.12)] sm:flex"
    >
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      <span className="tabular-nums">{balance.toLocaleString()}</span>
    </Link>
  );
}

// ─── Direct-to-payment CTA shown only to logged-in non-members ───
function JoinEmpireChip() {
  const { data: session, status } = useSession();
  const [isMember, setIsMember] = useState<boolean | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    let cancelled = false;
    fetch("/api/clan/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d) setIsMember(!!d.isMember);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [status, session]);

  if (!session?.user || isMember !== false) return null;

  return (
    <Link
      href="/clan?pay=1"
      title="Cyber Empire нэгдэх"
      className="group relative inline-flex items-center gap-1.5 overflow-hidden rounded-[6px] bg-gradient-to-r from-[#EF2C58] to-[#ff6685] px-3 py-1.5 text-[11px] font-black text-white shadow-[0_0_16px_rgba(239,44,88,0.3)] transition hover:shadow-[0_0_28px_rgba(239,44,88,0.5)]"
    >
      <span className="relative z-10">Empire</span>
      <span className="relative z-10 rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-black tracking-tight">₮49k</span>
      <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
    </Link>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const myId = (session?.user as { id?: string })?.id || "";

  const tabs = session
    ? [
        {
          href: "/",
          label: "Нүүр",
          check: (p: string) =>
            p === "/" || p.startsWith("/posts") || p.startsWith("/news") || p.startsWith("/explore"),
        },
        { href: "/market", label: "Market", check: (p: string) => p.startsWith("/market") },
        { href: "/classroom", label: "Хичээл", check: (p: string) => p.startsWith("/classroom") },
        { href: "/chat", label: "Чат", check: (p: string) => p.startsWith("/chat") },
        {
          href: myId ? `/profile/${myId}` : "/credits",
          label: "Би",
          check: (p: string) =>
            p.startsWith("/profile") ||
            p.startsWith("/credits") ||
            p.startsWith("/calendar") ||
            p.startsWith("/services") ||
            p.startsWith("/tools"),
        },
      ]
    : [
        {
          href: "/",
          label: "Нүүр",
          check: (p: string) => p === "/" || p.startsWith("/posts") || p.startsWith("/explore"),
        },
        { href: "/market", label: "Market", check: (p: string) => p.startsWith("/market") },
        { href: "/classroom", label: "Хичээл", check: (p: string) => p.startsWith("/classroom") },
        { href: "/news", label: "Блог", check: (p: string) => p.startsWith("/news") },
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
                className={`rounded-[4px] px-4 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
                  active
                    ? "bg-[#EF2C58] text-white"
                    : "text-[#AAAAAA] hover:text-[#E8E8E8]"
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
              <JoinEmpireChip />
              <CreditChip />
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
                className="text-[13px] font-medium text-[#AAAAAA] transition-colors duration-200 hover:text-[#E8E8E8]"
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
