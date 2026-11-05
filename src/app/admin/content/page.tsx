"use client";

import Link from "next/link";
import { T, Ico, ICONS, Card, SectionHeader } from "@/components/admin/kit";

/* 2026-10-26: нүүр слайдер нэмэв; «Сайтын контент»-ийн тайлбар нь hero-г дурдахаа больсон
   (hero-г /admin/hero засна — хоёр газар нэг юм засагддаг шиг харагдаж байв). */
const CONTENT_MODULES = [
  { href: "/admin/hero", label: "Нүүр слайдер", desc: "Нүүрний зураг · гарчиг · 7 хоногийн «Day»", icon: "M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" },
  { href: "/admin/site", label: "Сайтын контент", desc: "Landing карт · таск · мэдэгдэл", icon: "M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z" },
  { href: "/admin/homepage-cards", label: "Нүүр карт", desc: "Нүүр хуудасны картууд", icon: "M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25z" },
  { href: "/admin/news", label: "AI Мэдээ", desc: "Мэдээ · нийтлэл", icon: "M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" },
  { href: "/admin/prompts", label: "Trending промпт", desc: "Онцлох промпт", icon: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" },
  { href: "/admin/poster", label: "Постер", desc: "Дизайн · постер үүсгэх", icon: "M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.764" },
  { href: "/admin/stories", label: "Түүхүүд", desc: "Story контент", icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
];

export default function ContentHub() {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="text-[28px] font-extrabold tracking-tight" style={{ color: T.text }}>Контент</h1>
        <p className="mt-1 text-[14px]" style={{ color: T.muted }}>Сайтад харагдах бүх контентыг нэг дороос удирдана.</p>
      </div>

      <SectionHeader title="Модулиуд" hint={`${CONTENT_MODULES.length} хэсэг`} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CONTENT_MODULES.map((m) => (
          <Link key={m.href} href={m.href} className="group">
            <Card hover className="flex h-full items-center gap-4 p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px]" style={{ background: "rgba(46,41,255,0.08)", color: T.primaryInk }}>
                <Ico d={m.icon} className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold" style={{ color: T.text }}>{m.label}</div>
                <div className="mt-0.5 text-[13px] leading-relaxed" style={{ color: T.faint }}>{m.desc}</div>
              </div>
              <Ico d={ICONS.arrow} className="h-4 w-4 shrink-0 opacity-40 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
