"use client";

import { useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";

// ─── Tab matcher ───
type Tab = {
  href: string;
  label: string;
  badge?: number;
  icon: React.ReactNode;
  match: (p: string) => boolean;
};

export default function BottomBar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  const myId = (session?.user as { id?: string })?.id || "";

  const tabs: Tab[] = useMemo(() => {
    const iconHome = (
      <svg className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.5 1.5 0 012.122 0L21.75 12M4.5 9.75v9.75A2.25 2.25 0 006.75 21.75H18a2.25 2.25 0 002.25-2.25V9.75M9 21.75V15a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 15v6.75" />
      </svg>
    );
    const iconExplore = (
      <svg className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    );
    const iconChat = (
      <svg className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.132a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
      </svg>
    );
    const iconServices = (
      // Heroicon: squares-2x2 — represents a grid of services/apps
      <svg className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    );
    const iconMarket = (
      <svg className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
      </svg>
    );
    const iconClassroom = (
      <svg className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
      </svg>
    );
    const iconMe = session?.user?.image ? (
      <img src={session.user.image} alt="" className="h-6 w-6 rounded-full object-cover" />
    ) : (
      <svg className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
    const iconJoin = (
      <span className="relative inline-flex items-center justify-center">
        <svg className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="absolute -right-1 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#EF2C58] ring-2 ring-[#0A0A0A]">
          <svg className="h-2 w-2 text-white" fill="none" stroke="currentColor" strokeWidth={3.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </span>
      </span>
    );

    if (session) {
      return [
        {
          href: "/",
          label: "Нүүр",
          icon: iconHome,
          match: (p) => p === "/" || p.startsWith("/posts") || p.startsWith("/news") || p.startsWith("/explore"),
        },
        {
          href: "/market",
          label: "Market",
          icon: iconMarket,
          match: (p) => p.startsWith("/market"),
        },
        {
          href: "/classroom",
          label: "Хичээл",
          icon: iconClassroom,
          match: (p) => p.startsWith("/classroom"),
        },
        {
          href: "/chat",
          label: "Чат",
          icon: iconChat,
          match: (p) => p.startsWith("/chat"),
        },
        {
          href: myId ? `/profile/${myId}` : "/credits",
          label: "Би",
          icon: iconMe,
          match: (p) =>
            p.startsWith("/profile") ||
            p.startsWith("/credits") ||
            p.startsWith("/calendar") ||
            p.startsWith("/services") ||
            p.startsWith("/tools"),
        },
      ];
    }

    return [
      {
        href: "/",
        label: "Нүүр",
        icon: iconHome,
        match: (p) => p === "/" || p.startsWith("/posts") || p.startsWith("/explore"),
      },
      {
        href: "/market",
        label: "Market",
        icon: iconMarket,
        match: (p) => p.startsWith("/market"),
      },
      {
        href: "/classroom",
        label: "Classroom",
        icon: iconClassroom,
        match: (p) => p.startsWith("/classroom"),
      },
      {
        href: "/services",
        label: "Үйлчилгээ",
        icon: iconServices,
        match: (p) => p.startsWith("/services"),
      },
      {
        href: "/auth/signup",
        label: "Би",
        icon: iconJoin,
        match: (p) => p.startsWith("/auth"),
      },
    ];
  }, [session, myId]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[rgba(255,255,255,0.08)] bg-[rgba(10,10,10,0.95)] backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)] pt-1.5">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={`group relative flex flex-1 min-w-0 flex-col items-center gap-0.5 px-0.5 py-2 transition-colors duration-200 ${
                active ? "text-[#EF2C58]" : "text-[#888]"
              }`}
            >
              <div className="relative">
                <div
                  className={`flex h-[30px] w-[30px] items-center justify-center rounded-[8px] transition ${
                    active ? "bg-[rgba(239,44,88,0.12)]" : "bg-transparent"
                  }`}
                >
                  {tab.icon}
                </div>
                {typeof tab.badge === "number" && tab.badge > 0 && (
                  <span className="absolute -right-1 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#EF2C58] px-1 text-[9px] font-black text-white ring-2 ring-[#0A0A0A]">
                    {tab.badge > 99 ? "99+" : tab.badge}
                  </span>
                )}
              </div>
              <span className={`w-full truncate text-center text-[10px] font-semibold tracking-tight ${active ? "text-[#EF2C58]" : "text-[#888]"}`}>
                {tab.label}
              </span>
              {active && (
                <span className="absolute -top-[1px] left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full bg-[#EF2C58]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
