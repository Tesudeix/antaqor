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
  neon?: boolean; // styles the tab as a glowing center action (AI generate)
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
    const iconChat = (
      <svg className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a8 8 0 01-12.3 6.7L3 20l1.3-5.4A8 8 0 1121 12z" />
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

    // AI center tab — plain brand-pink "+" square. Routes straight into the
    // Antaqor companion (the brand's hero AI surface). Other tools are a tap
    // away inside the companion's recommendations.
    const neonAi: Tab = {
      href: "/companion",
      label: "AI",
      neon: true,
      match: (p) => p.startsWith("/companion") || p.startsWith("/tools"),
      icon: (
        <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      ),
    };

    if (session) {
      return [
        {
          href: "/",
          label: "Нүүр",
          icon: iconHome,
          match: (p) => p === "/" || p.startsWith("/posts") || p.startsWith("/news") || p.startsWith("/explore"),
        },
        {
          href: "/classroom",
          label: "Хичээл",
          icon: iconClassroom,
          match: (p) => p.startsWith("/classroom"),
        },
        neonAi,
        {
          href: "/chat",
          label: "Чат",
          icon: iconChat,
          match: (p) => p.startsWith("/chat"),
        },
        {
          href: myId ? `/profile/${myId}` : "/credits",
          label: "Profile",
          icon: iconMe,
          match: (p) =>
            p.startsWith("/profile") ||
            p.startsWith("/credits") ||
            p.startsWith("/calendar") ||
            p.startsWith("/services"),
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
        href: "/classroom",
        label: "Classroom",
        icon: iconClassroom,
        match: (p) => p.startsWith("/classroom"),
      },
      neonAi,
      {
        href: "/chat",
        label: "Чат",
        icon: iconChat,
        match: (p) => p.startsWith("/chat"),
      },
      {
        href: "/auth/signup",
        label: "Profile",
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
          if (tab.neon) {
            return (
              <Link
                key={tab.label}
                href={tab.href}
                className="group relative flex flex-1 min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-2"
              >
                <span className="flex h-[34px] w-[34px] items-center justify-center rounded-[4px] bg-[#EF2C58] text-white transition group-active:scale-95">
                  {tab.icon}
                </span>
                <span className={`w-full truncate text-center text-[10px] font-semibold tracking-tight ${active ? "text-[#EF2C58]" : "text-[#888]"}`}>
                  {tab.label}
                </span>
              </Link>
            );
          }
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
                  className={`flex h-[30px] w-[30px] items-center justify-center rounded-[4px] transition ${
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
