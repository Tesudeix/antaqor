"use client";

import { useEffect, useMemo, useState } from "react";
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
  cta?: boolean; // visually distinct (signup)
};

export default function BottomBar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!session) return;
    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/chat/unread");
        const data = await res.json();
        if (typeof data.count === "number") setUnread(data.count);
      } catch { /* ignore */ }
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, [session]);

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
    const iconBlog = (
      <svg className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
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
      <svg className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    );

    if (session) {
      return [
        {
          href: "/",
          label: "Нүүр",
          icon: iconHome,
          match: (p) => p === "/" || p.startsWith("/posts"),
        },
        {
          href: "/explore",
          label: "Танилцах",
          icon: iconExplore,
          match: (p) =>
            p.startsWith("/explore") ||
            p.startsWith("/news") ||
            p.startsWith("/classroom") ||
            p.startsWith("/calendar") ||
            p.startsWith("/services") ||
            p.startsWith("/tools"),
        },
        {
          href: "/chat",
          label: "Чат",
          badge: unread,
          icon: iconChat,
          match: (p) => p.startsWith("/chat"),
        },
        {
          href: myId ? `/profile/${myId}` : "/credits",
          label: "Би",
          icon: iconMe,
          match: (p) => p.startsWith("/profile") || p.startsWith("/credits"),
        },
      ];
    }

    return [
      {
        href: "/",
        label: "Нүүр",
        icon: iconHome,
        match: (p) => p === "/" || p.startsWith("/posts"),
      },
      {
        href: "/explore",
        label: "Танилцах",
        icon: iconExplore,
        match: (p) =>
          p.startsWith("/explore") ||
          p.startsWith("/classroom") ||
          p.startsWith("/calendar") ||
          p.startsWith("/services") ||
          p.startsWith("/tools"),
      },
      {
        href: "/news",
        label: "Блог",
        icon: iconBlog,
        match: (p) => p.startsWith("/news"),
      },
      {
        href: "/auth/signup",
        label: "Нэгдэх",
        icon: iconJoin,
        match: (p) => p.startsWith("/auth"),
        cta: true,
      },
    ];
  }, [session, unread, myId]);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[rgba(255,255,255,0.08)] bg-[rgba(10,10,10,0.95)] backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-1.5">
        {tabs.map((tab) => {
          const active = tab.match(pathname);
          if (tab.cta) {
            return (
              <Link
                key={tab.label}
                href={tab.href}
                className="group relative flex flex-1 items-center justify-center py-2"
              >
                <div
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 transition-all duration-200 ${
                    active
                      ? "bg-[#EF2C58] text-white shadow-[0_0_20px_rgba(239,44,88,0.4)]"
                      : "bg-[#EF2C58] text-white shadow-[0_0_14px_rgba(239,44,88,0.25)]"
                  }`}
                >
                  <span className="h-4 w-4">{tab.icon}</span>
                  <span className="text-[11px] font-bold tracking-wide">{tab.label}</span>
                </div>
              </Link>
            );
          }
          return (
            <Link
              key={tab.label}
              href={tab.href}
              className={`group relative flex flex-1 flex-col items-center gap-0.5 px-1 py-2 transition-colors duration-200 ${
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
              <span className={`text-[10px] font-semibold tracking-wide ${active ? "text-[#EF2C58]" : "text-[#888]"}`}>
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
