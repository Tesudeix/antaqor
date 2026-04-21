"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ReactNode, useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/admin", label: "Хянах самбар", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/admin/members", label: "Гишүүд", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { href: "/classroom", label: "Хичээл", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  { href: "/admin/services", label: "Үйлчилгээ", icon: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" },
  { href: "/admin/events", label: "Эвентүүд", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { href: "/admin/poster", label: "Постер", icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" },
  { href: "/admin/threads", label: "Threads", icon: "M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" },
];

const ADMIN_EMAIL = "antaqor@gmail.com";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isAdmin =
    session?.user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[#EF2C58] border-t-transparent mx-auto" />
          <p className="text-[10px] uppercase tracking-[0.5px] text-[#555555]">
            Хандалт шалгаж байна
          </p>
        </div>
      </div>
    );
  }

  if (!session || !isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="max-w-md rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-10 text-center">
          <div className="mb-6 text-2xl font-bold tracking-[4px] text-[#EF2C58]">
            ХАНДАЛТ ХОРИГЛОГДСОН
          </div>
          <p className="mb-6 text-[12px] leading-relaxed text-[#555555]">
            Энэ хэсэг зөвхөн админд зориулагдсан.
          </p>
          <Link href="/" className="inline-block rounded-[8px] bg-[#EF2C58] px-6 py-2.5 text-[12px] font-bold text-white transition hover:bg-[#D4264E]">
            Нүүр хуудас руу буцах
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] gap-0 -mx-6 -my-8 md:-mx-10">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="fixed bottom-20 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#EF2C58] shadow-lg md:hidden"
        aria-label="Админ цэс"
      >
        <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {sidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h8" />
          )}
        </svg>
      </button>

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-56 transform border-r border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] pt-20 transition-transform md:relative md:inset-auto md:z-auto md:translate-x-0 md:pt-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-[rgba(255,255,255,0.06)] px-5 py-6">
            <div className="text-[9px] uppercase tracking-[1px] text-[#EF2C58]">
              Удирдлагын төв
            </div>
            <div className="mt-1 text-xl font-bold tracking-[1px] text-[#E8E8E8]">
              АДМИН
            </div>
          </div>

          <nav className="flex-1 px-3 py-4">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mb-1 flex items-center gap-3 rounded-[6px] px-3 py-3 text-[11px] uppercase tracking-[2px] transition-all ${
                    active
                      ? "bg-[rgba(239,44,88,0.1)] text-[#EF2C58] border-l-2 border-[#EF2C58]"
                      : "text-[#666666] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#CCCCCC]"
                  }`}
                >
                  <svg
                    className="h-4 w-4 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d={item.icon}
                    />
                  </svg>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-[rgba(255,255,255,0.06)] px-5 py-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-[10px] uppercase tracking-[2px] text-[#555555] transition hover:text-[#E8E8E8]"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
              </svg>
              Сайт руу буцах
            </Link>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="flex-1 overflow-x-hidden p-6 md:p-8">
        {children}
      </main>
    </div>
  );
}
