"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ReactNode, useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/admin", label: "Хянах самбар", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { href: "/admin/members", label: "Гишүүд", icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
  { href: "/admin/threads", label: "Нийтлэлүүд", icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" },
  { href: "/admin/threads/replies", label: "Хариултууд", icon: "M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" },
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
          <div className="mb-4 h-8 w-8 animate-spin border-2 border-[#cc2200] border-t-transparent mx-auto" />
          <p className="text-[10px] uppercase tracking-[3px] text-[#5a5550]">
            Хандалт шалгаж байна
          </p>
        </div>
      </div>
    );
  }

  if (!session || !isAdmin) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="card max-w-md p-10 text-center">
          <div className="mb-6 font-[Bebas_Neue] text-4xl tracking-[6px] text-[#cc2200]">
            ХАНДАЛТ ХОРИГЛОГДСОН
          </div>
          <p className="mb-6 text-[12px] leading-relaxed text-[#5a5550]">
            Энэ хэсэг зөвхөн админд зориулагдсан.
          </p>
          <Link href="/" className="btn-blood inline-block">
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
        className="fixed bottom-20 right-4 z-50 flex h-12 w-12 items-center justify-center bg-[#cc2200] md:hidden"
        aria-label="Админ цэс"
      >
        <svg className="h-5 w-5 text-[#ede8df]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {sidebarOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h8" />
          )}
        </svg>
      </button>

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-56 transform border-r border-[#1c1c1c] bg-[#0a0a0a] pt-20 transition-transform md:relative md:inset-auto md:z-auto md:translate-x-0 md:pt-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-[#1c1c1c] px-5 py-6">
            <div className="text-[9px] uppercase tracking-[4px] text-[#cc2200]">
              Удирдлагын төв
            </div>
            <div className="mt-1 font-[Bebas_Neue] text-xl tracking-[3px]">
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
                  className={`mb-1 flex items-center gap-3 px-3 py-3 text-[11px] uppercase tracking-[2px] transition-all ${
                    active
                      ? "bg-[rgba(204,34,0,0.1)] text-[#cc2200] border-l-2 border-[#cc2200]"
                      : "text-[#5a5550] hover:bg-[rgba(240,236,227,0.03)] hover:text-[#c8c8c0]"
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

          <div className="border-t border-[#1c1c1c] px-5 py-4">
            <Link
              href="/"
              className="flex items-center gap-2 text-[10px] uppercase tracking-[2px] text-[#3a3835] transition hover:text-[#c8c8c0]"
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
