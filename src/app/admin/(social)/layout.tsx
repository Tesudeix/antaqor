"use client";

// Shared shell for the Social Automation section. Every tool below lives at its
// own URL but is presented as one tabbed workspace — Flow Builder is the hub,
// the rest (welcome, triggers, broadcast, inbox) are tabs. This is a Next.js
// route group: the "(social)" folder does NOT change any URL (e.g. /admin/flows
// stays /admin/flows), it only attaches this layout.
//
// Mobile-first: the tab strip is a sticky, horizontally-scrollable segmented
// control with 44px touch targets, icon + label, and a frosted backdrop so it
// stays reachable while a long page scrolls. Desktop keeps the same component.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { T } from "@/components/admin/kit";

const TABS: { href: string; label: string; icon: string }[] = [
  { href: "/admin/flows",     label: "Flow",      icon: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" },
  { href: "/admin/welcome",   label: "Тавтай морил", icon: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" },
  { href: "/admin/triggers",  label: "Триггер",   icon: "M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" },
  { href: "/admin/broadcast", label: "Broadcast", icon: "M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535" },
  { href: "/admin/inbox",     label: "Чат",       icon: "M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 011.037-.443 48.282 48.282 0 005.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" },
];

export default function SocialAutomationLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="mx-auto max-w-6xl">
      {/* Sticky section header + segmented tab strip (mobile-first) */}
      <div
        className="sticky top-0 z-20 -mx-4 mb-5 border-b px-4 pt-3 backdrop-blur-xl sm:-mx-6 sm:px-6 md:-mx-8 md:px-8"
        style={{ borderColor: T.border, background: "rgba(14,14,18,0.82)" }}
      >
        <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: T.primary }}>
          Social Automation
        </div>
        <div
          className="mt-2.5 flex gap-1.5 overflow-x-auto pb-2.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ scrollSnapType: "x proximity" }}
        >
          {TABS.map((t) => {
            const active = isActive(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-semibold transition active:scale-[0.97]"
                style={{
                  scrollSnapAlign: "start",
                  background: active ? T.primary : T.surface,
                  borderColor: active ? T.primary : T.border,
                  color: active ? "#fff" : T.muted,
                }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-[18px] w-[18px] shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d={t.icon} />
                </svg>
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>

      {children}
    </div>
  );
}
