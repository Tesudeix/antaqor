"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

// ─── Edgerunner bottom bar ───
// 4 tabs + 1 center action. Guest funnel: free content left/right, brand
// signal "Нэгдэх" in the middle. Member: home · курс · [+пост] · feed · profile.

type Tab = {
  href: string;
  label: string;
  icon: React.ReactNode;
  match: (p: string) => boolean;
  center?: boolean;
  signal?: boolean; // brand-accent center (guest CTA)
};

const stroke = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "square" as const,
  strokeLinejoin: "miter" as const,
  viewBox: "0 0 24 24",
};

const ICONS = {
  home: (
    <svg className="h-[22px] w-[22px]" {...stroke}>
      <path d="M3 10L12 3l9 7v11h-6v-7H9v7H3z" />
    </svg>
  ),
  course: (
    <svg className="h-[22px] w-[22px]" {...stroke}>
      <rect x="3" y="4" width="18" height="14" />
      <path d="M3 8h18M10 12l4 2.5-4 2.5z" />
    </svg>
  ),
  reel: (
    <svg className="h-[22px] w-[22px]" {...stroke}>
      <rect x="6" y="3" width="12" height="18" />
      <path d="M10 9.5l5 2.5-5 2.5z" />
    </svg>
  ),
  prompt: (
    <svg className="h-[22px] w-[22px]" {...stroke}>
      <path d="M4 5h16v14H4z M8 9l3 3-3 3M13 15h4" />
    </svg>
  ),
  chat: (
    <svg className="h-[22px] w-[22px]" {...stroke}>
      <path d="M4 4h16v12h-6l-5 4v-4H4z" />
      <path d="M8 10h.01M12 10h.01M16 10h.01" />
    </svg>
  ),
  feed: (
    <svg className="h-[22px] w-[22px]" {...stroke}>
      <path d="M4 4h16v12H9l-5 4z M8 9h8M8 12h5" />
    </svg>
  ),
  plus: (
    <svg className="h-[22px] w-[22px]" {...stroke} strokeWidth={2.4}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  userPlus: (
    <svg className="h-[22px] w-[22px]" {...stroke}>
      <circle cx="10" cy="8" r="4" />
      <path d="M3 21a7 7 0 0 1 14 0M18 8v6M15 11h6" />
    </svg>
  ),
  user: (
    <svg className="h-[22px] w-[22px]" {...stroke}>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 21a7 7 0 0 1 14 0" />
    </svg>
  ),
};

export default function BottomBar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const myId = (session?.user as { id?: string })?.id || "";

  const tabs: Tab[] = useMemo(() => {
    const me = session?.user?.image ? (
      <img src={session.user.image} alt="" className="h-[22px] w-[22px] rounded-[4px] object-cover" />
    ) : (
      ICONS.user
    );

    if (session) {
      return [
        { href: "/", label: "Нүүр", icon: ICONS.home, match: (p) => p === "/" || p.startsWith("/onboarding") },
        { href: "/chat/live", label: "Chat", icon: ICONS.chat, match: (p) => p.startsWith("/chat") },
        { href: "/classroom", label: "Курс", icon: ICONS.course, match: (p) => p.startsWith("/classroom") || p.startsWith("/calendar") },
        { href: "/feed", label: "Feed", icon: ICONS.feed, match: (p) => p.startsWith("/feed") || p.startsWith("/posts") || p.startsWith("/community") },
        {
          href: myId ? `/profile/${myId}` : "/credits",
          label: "Профайл",
          icon: me,
          match: (p) => p.startsWith("/profile") || p.startsWith("/credits") || p.startsWith("/services"),
        },
      ];
    }

    // Guest: free-taste funnels either side, one brand signal action center.
    return [
      { href: "/", label: "Нүүр", icon: ICONS.home, match: (p) => p === "/" },
      { href: "/classroom", label: "Курс", icon: ICONS.course, match: (p) => p.startsWith("/classroom") || p.startsWith("/reels") },
      { href: "/auth/signup?plan=starter", label: "Нэгдэх", icon: ICONS.userPlus, center: true, signal: true, match: (p) => p.startsWith("/auth/signup") || p.startsWith("/pricing") },
      { href: "/prompts", label: "Prompt", icon: ICONS.prompt, match: (p) => p.startsWith("/prompts") },
      { href: "/auth/signin", label: "Нэвтрэх", icon: ICONS.user, match: (p) => p.startsWith("/auth/signin") },
    ];
  }, [session, myId]);

  if (pathname.startsWith("/admin")) return null;
  if (pathname.startsWith("/erchis")) return null;
  if (pathname.startsWith("/yuki")) {
    return <YukiBottomBar pathname={pathname} />;
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t md:hidden"
      style={{ background: "rgba(22,22,24,0.92)", borderColor: "#2E2E33", backdropFilter: "blur(12px)" }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around pb-[env(safe-area-inset-bottom)]">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          if (tab.center) {
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-label={tab.label}
                className="group flex flex-1 min-w-0 flex-col items-center justify-center gap-1 bg-[#1080CA] px-0.5 py-2 text-[#0E0E10] transition active:brightness-95"
              >
                <span className="flex h-[22px] w-[22px] items-center justify-center">{tab.icon}</span>
                <span className="chrome w-full truncate text-center text-[8px] font-bold">{tab.label}</span>
              </Link>
            );
          }
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`group relative flex flex-1 min-w-0 flex-col items-center gap-1 border-t-2 px-0.5 py-2 transition-colors duration-200 ${
                active ? "border-[#1080CA] text-[#1080CA]" : "border-transparent text-[#84848C]"
              }`}
            >
              <span className="flex h-[26px] w-[26px] items-center justify-center">{tab.icon}</span>
              <span className="chrome w-full truncate text-center text-[8px] font-bold">{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function YukiBottomBar({ pathname }: { pathname: string }) {
  const PINK = "#EC4899";
  const PINK_DEEP = "#BE185D";
  const tabs = [
    {
      href: "/yuki",
      label: "Нүүр",
      neon: false,
      match: (p: string) => p === "/yuki",
      icon: (
        <svg className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.5 1.5 0 012.122 0L21.75 12M4.5 9.75v9.75A2.25 2.25 0 006.75 21.75H18a2.25 2.25 0 002.25-2.25V9.75M9 21.75V15a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 15v6.75" />
        </svg>
      ),
    },
    {
      href: "/yuki/book",
      label: "",
      neon: true,
      match: (p: string) => p.startsWith("/yuki/book"),
      icon: (
        <svg className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
        </svg>
      ),
    },
    {
      href: "/yuki/me",
      label: "Миний",
      neon: false,
      match: (p: string) => p.startsWith("/yuki/me"),
      icon: (
        <svg className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/95 backdrop-blur-xl md:hidden"
      style={{ borderColor: "rgba(236,72,153,0.18)" }}
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-1.5">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          if (tab.neon) {
            return (
              <Link
                key="yuki-neon"
                href={tab.href}
                aria-label="Цаг захиалах"
                className="group relative flex flex-1 min-w-0 flex-col items-center justify-center px-0.5 py-2"
              >
                <span
                  className="flex h-[46px] w-[46px] items-center justify-center rounded-full text-white transition group-active:scale-90"
                  style={{
                    background: `linear-gradient(135deg, ${PINK} 0%, ${PINK_DEEP} 100%)`,
                    boxShadow: "0 8px 20px rgba(236,72,153,0.45), inset 0 1px 0 rgba(255,255,255,0.25)",
                  }}
                >
                  {tab.icon}
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className="group relative flex flex-1 min-w-0 flex-col items-center gap-0.5 px-0.5 py-2 transition-colors duration-200"
              style={{ color: active ? PINK : "#94889A" }}
            >
              <div className="relative">
                <div
                  className="flex h-[30px] w-[30px] items-center justify-center rounded-full transition"
                  style={{ background: active ? "rgba(236,72,153,0.12)" : "transparent" }}
                >
                  {tab.icon}
                </div>
              </div>
              <span
                className="w-full truncate text-center text-[10px] font-semibold tracking-tight"
                style={{ color: active ? PINK : "#94889A" }}
              >
                {tab.label}
              </span>
              {active && (
                <span
                  className="absolute -top-[1px] left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full"
                  style={{ background: PINK }}
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
