"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import NotificationBell from "./NotificationBell";

function NavTicker() {
  const [count, setCount] = useState<number | null>(null);
  const [display, setDisplay] = useState(0);
  const goal = 10000;

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/stats");
        const data = await res.json();
        if (res.ok) setCount(data.aiConquerors ?? data.paidMembers ?? 0);
      } catch {
        // silent
      }
    };
    load();
    const i = setInterval(load, 60000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (count === null) return;
    let start = display;
    const end = count;
    if (start === end) return;
    const step = Math.ceil(Math.abs(end - start) / 30);
    const t = setInterval(() => {
      start = start < end ? Math.min(start + step, end) : Math.max(start - step, end);
      setDisplay(start);
      if (start === end) clearInterval(t);
    }, 30);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  if (count === null) return null;
  const pct = Math.min((count / goal) * 100, 100);

  return (
    <div className="hidden items-center gap-2.5 md:flex">
      <div className="h-3 w-[1px] bg-[#1c1c1c]" />
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] uppercase tracking-[0.5px] text-[#3a3835]">
          Зорилго
        </span>
        <span className="font-[Bebas_Neue] text-[13px] leading-none tracking-[1px] text-[#cc2200]">
          {display.toLocaleString()}
        </span>
        <span className="text-[10px] text-[#3a3835]">/</span>
        <span className="font-[Bebas_Neue] text-[13px] leading-none tracking-[1px] text-[#3a3835]">
          10K
        </span>
        <span className="text-[10px] uppercase tracking-[0.5px] text-[#3a3835]">
          AI Байлдагч
        </span>
      </div>
      <div className="h-[2px] w-12 overflow-hidden bg-[#1c1c1c]">
        <div
          className="h-full bg-[#cc2200] transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function Navbar() {
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b border-[rgba(240,236,227,0.08)] bg-[rgba(3,3,3,0.85)] backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 md:px-10">
        <div className="flex items-center gap-4">
          <Link href="/" className="font-[Bebas_Neue] text-2xl tracking-[4px] text-[#ede8df]">
            ANTA<span className="text-[#cc2200]">QOR</span>
          </Link>
          <NavTicker />
        </div>

        {/* Desktop nav */}
        <div className="hidden items-center gap-5 md:flex">
          <Link href="/" className="text-[12px] font-medium text-[#c8c8c0] transition hover:text-[#ede8df]">
            Мэдээ
          </Link>
          <Link href="/classroom" className="text-[12px] font-medium text-[#c8c8c0] transition hover:text-[#ede8df]">
            Хичээл
          </Link>
          <Link href="/members" className="text-[12px] font-medium text-[#c8c8c0] transition hover:text-[#ede8df]">
            Гишүүд
          </Link>
          <Link href="/clan" className="text-[12px] font-medium text-[#c8c8c0] transition hover:text-[#ede8df]">
            Клан
          </Link>
          {session ? (
            <>
              <Link href="/posts/new" className="btn-blood !py-2 !px-5 !text-[11px]">
                Шинэ пост
              </Link>
              <NotificationBell />
              <Link
                href={`/profile/${(session.user as { id?: string })?.id || ""}`}
                className="flex h-9 w-9 items-center justify-center border border-[rgba(240,236,227,0.15)] text-[11px] font-bold text-[#c8c8c0] transition hover:border-[#cc2200] hover:text-[#ede8df]"
              >
                {session.user?.name?.charAt(0).toUpperCase() || "U"}
              </Link>
              <button
                onClick={() => signOut()}
                className="text-[12px] font-medium text-[#5a5550] transition hover:text-[#cc2200]"
              >
                Гарах
              </button>
            </>
          ) : (
            <>
              <Link href="/auth/signin" className="text-[12px] font-medium text-[#c8c8c0] transition hover:text-[#ede8df]">
                Нэвтрэх
              </Link>
              <Link href="/auth/signup" className="btn-blood !py-2 !px-5 !text-[11px]">
                Нэгдэх
              </Link>
            </>
          )}
        </div>

        {/* Mobile: notification bell + hamburger */}
        <div className="flex items-center gap-3 md:hidden">
          {session && <NotificationBell />}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Цэс нээх"
          >
            <svg className="h-6 w-6 text-[#c8c8c0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile mission ticker */}
      <div className="flex items-center justify-center gap-2 border-t border-[rgba(240,236,227,0.04)] py-1.5 md:hidden">
        <MobileTicker />
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="border-t border-[rgba(240,236,227,0.06)] bg-[#0f0f0f] px-6 py-5 md:hidden">
          <div className="flex flex-col gap-4">
            <Link href="/" className="text-[13px] font-medium text-[#c8c8c0]" onClick={() => setMenuOpen(false)}>
              Мэдээ
            </Link>
            <Link href="/classroom" className="text-[13px] font-medium text-[#c8c8c0]" onClick={() => setMenuOpen(false)}>
              Хичээл
            </Link>
            <Link href="/members" className="text-[13px] font-medium text-[#c8c8c0]" onClick={() => setMenuOpen(false)}>
              Гишүүд
            </Link>
            <Link href="/clan" className="text-[13px] font-medium text-[#c8c8c0]" onClick={() => setMenuOpen(false)}>
              Клан
            </Link>
            {session ? (
              <>
                <Link href="/posts/new" className="text-[13px] font-semibold text-[#cc2200]" onClick={() => setMenuOpen(false)}>
                  Шинэ пост
                </Link>
                <Link href={`/profile/${(session.user as { id?: string })?.id || ""}`} className="text-[13px] font-medium text-[#c8c8c0]" onClick={() => setMenuOpen(false)}>
                  Профайл
                </Link>
                <button onClick={() => { signOut(); setMenuOpen(false); }} className="text-left text-[13px] font-medium text-[#5a5550]">
                  Гарах
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/signin" className="text-[13px] font-medium text-[#c8c8c0]" onClick={() => setMenuOpen(false)}>
                  Нэвтрэх
                </Link>
                <Link href="/auth/signup" className="text-[13px] font-semibold text-[#cc2200]" onClick={() => setMenuOpen(false)}>
                  Кланд нэгдэх
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

function MobileTicker() {
  const [count, setCount] = useState<number | null>(null);
  const goal = 10000;

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/stats");
        const data = await res.json();
        if (res.ok) setCount(data.aiConquerors ?? data.paidMembers ?? 0);
      } catch {
        // silent
      }
    };
    load();
  }, []);

  if (count === null) return null;
  const pct = Math.min((count / goal) * 100, 100);

  return (
    <div className="flex w-full items-center gap-2 px-6">
      <span className="text-[9px] uppercase tracking-[0.5px] text-[#3a3835] shrink-0">Зорилго</span>
      <div className="relative flex-1 h-[2px] overflow-hidden bg-[#1c1c1c]">
        <div className="h-full bg-[#cc2200] transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-[Bebas_Neue] text-[11px] tracking-[1px] text-[#cc2200] shrink-0">
        {count.toLocaleString()}
      </span>
      <span className="text-[9px] text-[#3a3835] shrink-0">/10K AI Байлдагч</span>
    </div>
  );
}
