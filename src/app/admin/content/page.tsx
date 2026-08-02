"use client";

import Link from "next/link";
import { T, Ico, Card, SectionHeader } from "@/components/admin/kit";

const CONTENT_MODULES = [
  { href: "/admin/site", label: "Сайтын контент", desc: "Hero · landing карт · таск · мэдэгдэл", icon: "M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" },
  { href: "/admin/homepage-cards", label: "Нүүр карт", desc: "Нүүр хуудасны картууд", icon: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25z" },
  { href: "/admin/news", label: "AI Мэдээ", desc: "Мэдээ · нийтлэл", icon: "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" },
  { href: "/admin/prompts", label: "Trending промпт", desc: "Онцлох промпт", icon: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" },
  { href: "/admin/poster", label: "Постер", desc: "Дизайн · постер үүсгэх", icon: "M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.764" },
  { href: "/admin/stories", label: "Түүхүүд", desc: "Story контент", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
];

export default function ContentHub() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-7">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: T.primary }}>Контент</div>
        <h1 className="mt-1 text-[26px] font-semibold tracking-tight" style={{ color: T.text }}>Content</h1>
        <p className="mt-0.5 text-[12px]" style={{ color: T.faint }}>Сайтад харагдах бүх контентыг нэг дороос удирд</p>
      </div>

      <SectionHeader title="Контент модулиуд" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CONTENT_MODULES.map((m) => (
          <Link key={m.href} href={m.href}>
            <Card hover className="flex h-full items-start gap-3 p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-none" style={{ background: "rgba(16,128,202,0.1)", color: T.primary }}>
                <Ico d={m.icon} className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold" style={{ color: T.text }}>{m.label}</div>
                <div className="mt-0.5 text-[11px] leading-relaxed" style={{ color: T.faint }}>{m.desc}</div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
