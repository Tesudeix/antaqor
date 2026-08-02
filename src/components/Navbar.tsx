"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import NotificationBell from "./NotificationBell";

// ─── Edgerunner header — sticky 56px, hairline border, slash-mark logo. ───
// Desktop tabs mirror the mobile BottomBar funnels. Active = brand-accent underline.

// Live credit balance — polls /api/credits so a purchase/spend reflects
// without a full page reload.
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
      className="group hidden items-center gap-1.5 rounded-[4px] border border-[#2E2E33] bg-[#1E1E21] px-2.5 py-1 text-[12px] font-bold text-[#1080CA] transition hover:border-[#1080CA] sm:flex"
    >
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      <span className="tabular-nums">{balance.toLocaleString()}</span>
    </Link>
  );
}

// Plan CTA shown only to logged-in non-members. Command-button style (dark,
// brand-accent border) so it reads as the one attention item without glow noise.
function PlanChip() {
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
    return () => {
      cancelled = true;
    };
  }, [status, session]);

  if (!session?.user || isMember !== false) return null;

  return (
    <Link
      href="/pricing"
      title="Plan сонгох"
      className="chrome inline-flex items-center gap-1.5 rounded-[4px] border border-[#1080CA] px-3 py-1.5 text-[9px] font-bold text-[#1080CA] transition hover:bg-[#1080CA] hover:text-[#161618]"
    >
      PLAN &gt;
    </Link>
  );
}

// Мокапын `LIVE · 18/20` чип — зочдод өнөөдрийн элсэлтийг амьдаар харуулна.
function LiveSeatsChip() {
  const [seats, setSeats] = useState<{ taken: number; total: number } | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const total = Number(d?.seatsTotal) || 20;
        const rawLeft = Number(d?.seatsLeft);
        const left = Math.max(0, Math.min(total, Number.isFinite(rawLeft) ? rawLeft : total));
        setSeats({ taken: total - left, total });
      })
      .catch(() => {});
  }, []);

  if (!seats) return null;
  return (
    <span
      className="chrome hidden items-center gap-2 rounded-full border border-[#3A3A40] px-3.5 py-1.5 text-[9px] font-bold text-[#B4B4BA] lg:inline-flex"
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-[#1080CA]"
        style={{ animation: "landingPulse 2s linear infinite" }}
      />
      LIVE · {seats.taken}/{seats.total}
    </span>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [hidden, setHidden] = useState(false);

  // Auto-hide nav on scroll-down — only when running as installed PWA.
  // Browser tabs keep the nav visible always.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const nav = window.navigator as Navigator & { standalone?: boolean };
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: minimal-ui)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      nav.standalone === true ||
      document.referrer.startsWith("android-app://");
    if (!isStandalone) return;

    let lastY = window.scrollY;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const dy = y - lastY;
        if (dy > 4 && y > 80) setHidden(true);
        else if (dy < -4) setHidden(false);
        lastY = y;
        ticking = false;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ─── Yuki/Erchis takeover — those areas own their entire chrome ───
  // (checked after hooks so the hook order stays stable across routes)
  if (pathname.startsWith("/yuki")) return null;
  if (pathname.startsWith("/erchis")) return null;

  const myId = (session?.user as { id?: string })?.id || "";
  const profileHref = myId ? `/profile/${myId}` : "/profile";

  const tabs = session
    ? [
        { href: "/", label: "Нүүр", check: (p: string) => p === "/" || p.startsWith("/onboarding") },
        { href: "/classroom", label: "Курс", check: (p: string) => p.startsWith("/classroom") || p.startsWith("/calendar") },
        { href: "/chat/live", label: "Chat", check: (p: string) => p.startsWith("/chat") },
        { href: "/prompts", label: "Prompt", check: (p: string) => p.startsWith("/prompts") },
        { href: "/feed", label: "Feed", check: (p: string) => p.startsWith("/feed") || p.startsWith("/posts") || p.startsWith("/community") },
        { href: profileHref, label: "Профайл", check: (p: string) => p.startsWith("/profile") || p.startsWith("/credits") || p.startsWith("/services") },
      ]
    : [
        { href: "/", label: "Нүүр", check: (p: string) => p === "/" },
        { href: "/classroom", label: "Курс", check: (p: string) => p.startsWith("/classroom") || p.startsWith("/reels") },
        { href: "/prompts", label: "Prompt", check: (p: string) => p.startsWith("/prompts") },
        { href: "/pricing", label: "Plan", check: (p: string) => p.startsWith("/pricing") || p.startsWith("/clan") },
      ];

  return (
    <nav
      className="sticky top-0 z-50 border-b"
      style={{
        transform: hidden ? "translateY(-100%)" : "translateY(0)",
        transition: "transform 0.25s ease",
        willChange: "transform",
        background: "rgba(22,22,24,0.85)",
        borderColor: "#2E2E33",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 md:px-8 lg:px-12">
        {/* Left — slash-mark logo + desktop tabs */}
        <div className="flex items-center gap-5 md:gap-8">
          <Link href="/" aria-label="Antaqor" className="flex items-center gap-2">
            <span className="block h-3.5 w-3.5 bg-[#1080CA]" />
            <span
              className="text-[13px] font-extrabold tracking-[0.08em] text-[#FFFFFF]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              ANTAQOR<span className="text-[#1080CA]">///</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {tabs.map((tab) => {
              const active = tab.check(pathname);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`chrome relative inline-flex items-center px-3.5 py-2 text-[10px] font-bold transition-colors duration-150 ${
                    active ? "text-[#1080CA]" : "text-[#B4B4BA] hover:text-[#FFFFFF]"
                  }`}
                >
                  {tab.label}
                  {active && <span className="absolute bottom-0 left-3.5 right-3.5 h-[2px] bg-[#1080CA]" />}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2.5">
          {session ? (
            <>
              <Link
                href="/posts/new"
                className="hidden items-center gap-1.5 bg-[#1080CA] px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.04em] text-[#0E0E10] transition hover:bg-[#4FA8E8] md:inline-flex"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="square" d="M12 5v14M5 12h14" />
                </svg>
                Пост
              </Link>
              <CreditChip />
              <PlanChip />
              <NotificationBell />
              <Link
                href={profileHref}
                className="flex h-8 w-8 items-center justify-center overflow-hidden border border-[#3A3A40] bg-[#1E1E21] text-[12px] font-bold text-[#1080CA] transition hover:border-[#1080CA]"
              >
                {session.user?.image ? (
                  <img src={session.user.image} alt={session.user?.name || ""} className="h-8 w-8 object-cover" />
                ) : (
                  session.user?.name?.charAt(0).toUpperCase() || "U"
                )}
              </Link>
            </>
          ) : (
            <>
              <LiveSeatsChip />
              <Link
                href="/auth/signin"
                className="chrome hidden px-2 py-2 text-[10px] font-bold text-[#B4B4BA] transition hover:text-[#1080CA] sm:inline-block"
              >
                Нэвтрэх
              </Link>
              <Link
                href="/auth/signup?plan=starter"
                className="inline-flex items-center gap-1.5 bg-[#1080CA] px-5 py-2.5 text-[13px] font-semibold text-[#0E0E10] transition hover:bg-[#4FA8E8] hover:shadow-[0_0_0_1px_#1080CA,0_0_24px_0_rgba(16,128,202,.30)]"
              >
                Бүртгүүл
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="square" d="M14 5l7 7-7 7M21 12H3" />
                </svg>
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
