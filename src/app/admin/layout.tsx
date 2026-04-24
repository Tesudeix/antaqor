"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ReactNode, useEffect, useState } from "react";
import { useMembership } from "@/lib/useMembership";

// ─── Navigation Structure ───
const NAV_MAIN = [
  { href: "/admin",          label: "Dashboard",  shortLabel: "Home",     icon: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" },
  { href: "/admin/calendar", label: "Календар",   shortLabel: "Календар", icon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" },
  { href: "/admin/members",  label: "Гишүүд",     shortLabel: "Гишүүд",  icon: "M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" },
  { href: "/classroom",      label: "Хичээл",     shortLabel: "Хичээл",  icon: "M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" },
];

const NAV_TOOLS = [
  { href: "/admin/testimonials", label: "Testimonials", shortLabel: "Reviews",  icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" },
  { href: "/admin/security",   label: "Security",   shortLabel: "Security",icon: "M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" },
  { href: "/admin/level-gate", label: "Level Gate", shortLabel: "Levels",  icon: "M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" },
  { href: "/admin/market",   label: "Market",     shortLabel: "Market",  icon: "M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" },
  { href: "/admin/credits",  label: "Credits",    shortLabel: "Credits", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  { href: "/admin/news",     label: "AI Мэдээ",   shortLabel: "Мэдээ",   icon: "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" },
  { href: "/admin/events",   label: "Эвентүүд",   shortLabel: "Эвент",   icon: "M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" },
  { href: "/admin/services",  label: "Үйлчилгээ",  shortLabel: "Сервис",  icon: "M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.241-.438.613-.431.992a7.723 7.723 0 010 .255c-.007.378.138.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" },
  { href: "/admin/poster",   label: "Постер",      shortLabel: "Постер",  icon: "M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.764m3.42 3.42a6.776 6.776 0 00-3.42-3.42" },
  { href: "/admin/threads",  label: "Threads",     shortLabel: "Threads", icon: "M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" },
];

// Mobile bottom tabs — most important 5
const MOBILE_TABS = [
  NAV_MAIN[0], // Dashboard
  NAV_MAIN[1], // Calendar
  NAV_MAIN[2], // Members
  NAV_MAIN[3], // Classroom
  { href: "/admin/more", label: "Бусад", shortLabel: "Бусад", icon: "M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" },
];

const SUPER_ADMIN_EMAILS = ["antaqor@gmail.com"];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const { isAdmin: dbAdmin } = useMembership();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(
    session?.user?.email?.toLowerCase() || ""
  );
  const isAdmin = isSuperAdmin || dbAdmin;

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border-2 border-[rgba(239,44,88,0.2)]" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#EF2C58]" />
          </div>
          <p className="text-[11px] tracking-[0.1em] text-[#444444]">LOADING</p>
        </div>
      </div>
    );
  }

  if (!session || !isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-[12px] border border-[rgba(255,255,255,0.06)] bg-[#111111] p-8 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[rgba(239,44,88,0.1)]">
            <svg className="h-6 w-6 text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <h2 className="text-[18px] font-bold text-[#E8E8E8]">Хандалт хориглогдсон</h2>
          <p className="mt-2 text-[13px] text-[#555555]">Зөвхөн админ эрхтэй хэрэглэгч</p>
          <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-[10px] bg-[#EF2C58] px-6 py-3 text-[13px] font-bold text-white transition hover:bg-[#D4264E]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            Нүүр хуудас
          </Link>
        </div>
      </div>
    );
  }

  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  const allTools = NAV_TOOLS;

  return (
    <div className="flex min-h-[60vh] -mx-6 -my-8 md:-mx-10">

      {/* ═══════════════════════════════════════════
          DESKTOP SIDEBAR
          ═══════════════════════════════════════════ */}
      <aside className={`hidden md:flex flex-col border-r border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] transition-all duration-300 ${sidebarCollapsed ? "w-[68px]" : "w-[220px]"}`}>
        {/* Brand */}
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-4 py-5">
          {!sidebarCollapsed && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#EF2C58]">
                Antaqor
              </div>
              <div className="mt-0.5 text-[15px] font-bold tracking-[0.5px] text-[#E8E8E8]">
                Admin
              </div>
            </div>
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#555555] transition hover:bg-[rgba(255,255,255,0.06)] hover:text-[#E8E8E8]">
            <svg className={`h-4 w-4 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
            </svg>
          </button>
        </div>

        {/* Main Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {!sidebarCollapsed && (
            <div className="mb-1 px-3 text-[9px] font-bold uppercase tracking-[0.12em] text-[#333333]">Ерөнхий</div>
          )}
          {NAV_MAIN.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={`group relative mb-0.5 flex items-center gap-3 rounded-[10px] px-3 py-2.5 transition-all duration-200 ${
                  active
                    ? "bg-[rgba(239,44,88,0.12)] text-[#EF2C58]"
                    : "text-[#666666] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#CCCCCC]"
                }`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                {active && <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#EF2C58]" />}
                <svg className={`h-[18px] w-[18px] shrink-0 transition-colors ${active ? "text-[#EF2C58]" : "text-[#555555] group-hover:text-[#888888]"}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {!sidebarCollapsed && (
                  <span className={`text-[13px] font-medium ${active ? "font-semibold" : ""}`}>{item.label}</span>
                )}
              </Link>
            );
          })}

          {/* Tools section */}
          <div className={`mt-4 ${sidebarCollapsed ? "" : "px-3"}`}>
            {!sidebarCollapsed && (
              <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[#333333]">Хэрэгслүүд</div>
            )}
            {sidebarCollapsed && <div className="mx-auto my-2 h-[1px] w-6 bg-[rgba(255,255,255,0.08)]" />}
          </div>
          {NAV_TOOLS.map((item) => {
            const active = isActive(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={`group relative mb-0.5 flex items-center gap-3 rounded-[10px] px-3 py-2.5 transition-all duration-200 ${
                  active
                    ? "bg-[rgba(239,44,88,0.12)] text-[#EF2C58]"
                    : "text-[#666666] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#CCCCCC]"
                }`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                {active && <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#EF2C58]" />}
                <svg className={`h-[18px] w-[18px] shrink-0 transition-colors ${active ? "text-[#EF2C58]" : "text-[#555555] group-hover:text-[#888888]"}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                </svg>
                {!sidebarCollapsed && (
                  <span className={`text-[13px] font-medium ${active ? "font-semibold" : ""}`}>{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-[rgba(255,255,255,0.06)] p-3">
          <Link href="/"
            className={`flex items-center gap-2.5 rounded-[10px] px-3 py-2.5 text-[#555555] transition hover:bg-[rgba(255,255,255,0.04)] hover:text-[#E8E8E8] ${sidebarCollapsed ? "justify-center" : ""}`}
            title={sidebarCollapsed ? "Сайт руу буцах" : undefined}
          >
            <svg className="h-[18px] w-[18px] shrink-0" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            {!sidebarCollapsed && <span className="text-[12px] font-medium">Сайт харах</span>}
          </Link>
          {/* User */}
          {!sidebarCollapsed && session?.user && (
            <div className="mt-2 flex items-center gap-2.5 rounded-[10px] bg-[rgba(255,255,255,0.03)] px-3 py-2.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(239,44,88,0.15)] text-[10px] font-bold text-[#EF2C58]">
                {session.user.name?.charAt(0) || "A"}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[12px] font-semibold text-[#CCCCCC]">{session.user.name}</div>
                <div className="truncate text-[10px] text-[#444444]">{isSuperAdmin ? "Super Admin" : "Admin"}</div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ═══════════════════════════════════════════
          MAIN CONTENT
          ═══════════════════════════════════════════ */}
      <main className="flex-1 overflow-x-hidden pb-20 md:pb-0">
        <div className="p-4 sm:p-6 md:p-8">
          {children}
        </div>
      </main>

      {/* ═══════════════════════════════════════════
          MOBILE BOTTOM TAB BAR
          ═══════════════════════════════════════════ */}
      <div className="fixed inset-x-0 bottom-0 z-50 md:hidden">
        {/* More menu overlay */}
        {moreOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setMoreOpen(false)} />
            <div className="relative z-50 mx-3 mb-2 rounded-[16px] border border-[rgba(255,255,255,0.08)] bg-[#111111] p-3 shadow-2xl backdrop-blur-xl">
              <div className="mb-2 px-2 text-[10px] font-bold uppercase tracking-[0.1em] text-[#444444]">Хэрэгслүүд</div>
              <div className="grid grid-cols-4 gap-1">
                {allTools.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <Link key={item.href} href={item.href}
                      className={`flex flex-col items-center gap-1.5 rounded-[12px] px-2 py-3 transition ${active ? "bg-[rgba(239,44,88,0.12)]" : "hover:bg-[rgba(255,255,255,0.04)]"}`}>
                      <svg className={`h-5 w-5 ${active ? "text-[#EF2C58]" : "text-[#666666]"}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                      </svg>
                      <span className={`text-[10px] font-medium ${active ? "text-[#EF2C58]" : "text-[#888888]"}`}>{item.shortLabel}</span>
                    </Link>
                  );
                })}
              </div>
              <div className="mt-2 border-t border-[rgba(255,255,255,0.06)] pt-2">
                <Link href="/" className="flex items-center gap-2 rounded-[10px] px-3 py-2.5 text-[#666666] transition hover:bg-[rgba(255,255,255,0.04)]">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                  <span className="text-[12px] font-medium">Сайт руу буцах</span>
                </Link>
              </div>
            </div>
          </>
        )}

        {/* Tab bar */}
        <div className="border-t border-[rgba(255,255,255,0.08)] bg-[#0A0A0A]/95 backdrop-blur-xl">
          <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
            {MOBILE_TABS.map((item) => {
              if (item.href === "/admin/more") {
                const anyToolActive = allTools.some(t => isActive(t.href));
                return (
                  <button key="more" onClick={() => setMoreOpen(!moreOpen)}
                    className="flex flex-1 flex-col items-center gap-0.5 py-2.5 transition">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-[8px] transition ${anyToolActive || moreOpen ? "bg-[rgba(239,44,88,0.15)]" : ""}`}>
                      <svg className={`h-5 w-5 transition ${anyToolActive || moreOpen ? "text-[#EF2C58]" : "text-[#555555]"}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                      </svg>
                    </div>
                    <span className={`text-[9px] font-semibold ${anyToolActive || moreOpen ? "text-[#EF2C58]" : "text-[#555555]"}`}>{item.shortLabel}</span>
                  </button>
                );
              }

              const active = isActive(item.href);
              return (
                <Link key={item.href} href={item.href}
                  className="flex flex-1 flex-col items-center gap-0.5 py-2.5 transition">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-[8px] transition ${active ? "bg-[rgba(239,44,88,0.15)]" : ""}`}>
                    <svg className={`h-5 w-5 transition ${active ? "text-[#EF2C58]" : "text-[#555555]"}`} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                    </svg>
                  </div>
                  <span className={`text-[9px] font-semibold ${active ? "text-[#EF2C58]" : "text-[#555555]"}`}>{item.shortLabel}</span>
                  {active && <div className="h-[2px] w-4 rounded-full bg-[#EF2C58]" />}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
