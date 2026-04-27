"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface ToolDef {
  href: string;
  title: string;
  blurb: string;
  cost: string;
  costTone: "neon" | "free" | "member";
  tag?: string;
  icon: React.ReactNode;
  accent: string; // gradient direction for the cover
}

const TOOLS: ToolDef[] = [
  {
    href: "/companion",
    title: "Antaqor · Чиний AI байлдан дагуулагч",
    blurb: "Mongolian-аар ярьдаг хувийн entrepreneur companion. Чамайг тогтмол санаж, бизнес, мөрөөдлийг тань дэмжинэ.",
    cost: "Үнэгүй · 200/өдөр",
    costTone: "neon",
    tag: "ШИНЭ ✦",
    accent: "from-[#EF2C58] via-[#A855F7] to-[#0A0A0A]",
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
      </svg>
    ),
  },
  {
    href: "/tools/generate-image",
    title: "AI зураг үүсгэх",
    blurb: "Промпт + стиль + хэлбэр сонгож AI-аар бэлэн зураг авна. 8 стиль, 5 хэлбэр.",
    cost: "10₵ / зураг",
    costTone: "neon",
    tag: "POPULAR",
    accent: "from-[#EF2C58] via-[#A855F7] to-[#3B82F6]",
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
      </svg>
    ),
  },
  {
    href: "/tools/compose",
    title: "Зураг хослуулах · Workflow",
    blurb: "2–5 зургийг label-тайгаар холбоод нэг шинэ зураг бүтээ. Subject + product + background + style гэх мэт чөлөөтэй recipe.",
    cost: "10₵ / workflow",
    costTone: "neon",
    tag: "ШИНЭ",
    accent: "from-[#A855F7] via-[#EF2C58] to-[#FFB3C5]",
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 7.5h16.5M3.75 12h16.5M3.75 16.5h16.5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 7.5L8 4M5 12l3-3M5 16.5L8 19.5M19 7.5L16 4M19 12l-3-3M19 16.5L16 19.5" opacity=".5" />
      </svg>
    ),
  },
  {
    href: "/tools/swap-product",
    title: "Бүтээгдэхүүн солих",
    blurb: "Хүний барьж байгаа бараа болон шинэ бүтээгдэхүүнийг AI-аар солино. Influencer marketing, brand deal-д бэлэн.",
    cost: "10₵ / swap",
    costTone: "neon",
    accent: "from-[#A855F7] via-[#EF2C58] to-[#3B82F6]",
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    ),
  },
  {
    href: "/tools/extract-product",
    title: "Бүтээгдэхүүний зураг гаргах",
    blurb: "Хүн өмссөн зургаас хувцас/бүтээгдэхүүнийг ялгаж цагаан фон дээр 1:1 product photo гаргана.",
    cost: "Гишүүнд үнэгүй",
    costTone: "member",
    accent: "from-[#EF2C58] via-[#FF6685] to-[#0A0A0A]",
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
      </svg>
    ),
  },
  {
    href: "/tools/youtube-mp3",
    title: "YouTube → MP3",
    blurb: "YouTube линкээс audio татаж авна. Подкаст, лекц, хичээлд тохиромжтой.",
    cost: "Үнэгүй",
    costTone: "free",
    accent: "from-[#A855F7] via-[#EF2C58] to-[#0A0A0A]",
    icon: (
      <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
      </svg>
    ),
  },
];

export default function ToolsIndexPage() {
  const { data: session, status } = useSession();
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/credits")
      .then((r) => r.json())
      .then((d) => { if (typeof d.balance === "number") setBalance(d.balance); })
      .catch(() => {});
  }, [status]);

  return (
    <div className="relative mx-auto max-w-[1100px] pb-12">
      {/* Subtle ambient glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(239,44,88,0.14)_0%,transparent_70%)] blur-3xl" />
      </div>

      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[rgba(239,44,88,0.12)] px-2 py-0.5 text-[9px] font-black tracking-[0.18em] text-[#EF2C58]">
              ANTAQOR · AI ХЭРЭГСЭЛ
            </span>
          </div>
          <h1 className="mt-2 text-[26px] font-black leading-tight text-[#E8E8E8] sm:text-[32px]">
            Бүх AI хэрэгсэл
          </h1>
          <p className="mt-1 text-[12px] text-[#888]">
            Гишүүдэд зориулсан AI tool-уудын цуглуулга. Олон үед бэлэн.
          </p>
        </div>
        {session && (
          <Link
            href="/credits/buy"
            className="inline-flex items-center gap-1.5 rounded-[4px] border border-[rgba(239,44,88,0.4)] bg-black/40 px-3 py-1.5 text-[11px] font-black text-[#EF2C58] backdrop-blur-md shadow-[0_0_12px_rgba(239,44,88,0.3)] transition hover:bg-[rgba(239,44,88,0.1)]"
          >
            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>
            {balance ?? "…"}₵ · кредит авах
          </Link>
        )}
      </div>

      {/* Tools grid — 2 col on every breakpoint, 3 col desktop+ */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {TOOLS.map((t) => (
          <ToolCard key={t.href} tool={t} />
        ))}

        {/* Coming soon placeholder */}
        <div className="flex flex-col gap-2 rounded-[4px] border-2 border-dashed border-[rgba(255,255,255,0.06)] bg-[#0A0A0A]/50 p-3 sm:p-4 opacity-60">
          <div className="flex items-center justify-between">
            <span className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[#141414] text-[#444]">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.4} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <span className="rounded-[4px] bg-[#141414] px-2 py-0.5 text-[8px] font-black tracking-wider text-[#666]">
              УДАХГҮЙ
            </span>
          </div>
          <h3 className="text-[13px] font-bold text-[#888]">Шинэ хэрэгсэл</h3>
          <p className="text-[10px] leading-snug text-[#555]">
            Voice → text · Background swap · Mockup generator
          </p>
        </div>
      </div>

      <p className="mt-8 text-center text-[10px] text-[#444]">
        Powered by Google Gemini Nano Banana · Шинэ tool санал болгох бол admin-руу холбогдоорой
      </p>
    </div>
  );
}

function ToolCard({ tool }: { tool: ToolDef }) {
  const costClass = tool.costTone === "neon"
    ? "bg-[#EF2C58] text-white"
    : tool.costTone === "free"
      ? "border border-[rgba(255,255,255,0.1)] bg-[#0A0A0A] text-[#999]"
      : "border border-[rgba(239,44,88,0.3)] bg-[rgba(239,44,88,0.05)] text-[#EF2C58]";

  return (
    <Link
      href={tool.href}
      className="group relative flex flex-col overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] transition hover:border-[rgba(239,44,88,0.4)] hover:shadow-[0_0_18px_rgba(239,44,88,0.15)]"
    >
      {/* Gradient cover — compact 4:3 aspect, scales naturally on every screen */}
      <div className={`relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br ${tool.accent}`}>
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0F0F10] via-transparent to-transparent" />
        {tool.tag && (
          <span className="absolute left-2 top-2 rounded-[4px] bg-black/70 px-1.5 py-0.5 text-[8px] font-black tracking-wider text-white backdrop-blur-md">
            {tool.tag}
          </span>
        )}
        <span className="absolute bottom-2 left-2 flex h-9 w-9 items-center justify-center rounded-[4px] bg-black/70 text-white backdrop-blur-md transition group-hover:scale-105">
          <span className="[&>svg]:h-5 [&>svg]:w-5">{tool.icon}</span>
        </span>
      </div>

      {/* Body — compact for 2-col mobile fit */}
      <div className="flex flex-1 flex-col gap-1.5 p-3 sm:gap-2 sm:p-3.5">
        <h3 className="text-[13px] font-black leading-snug text-[#E8E8E8] transition group-hover:text-[#EF2C58] sm:text-[14px]">
          {tool.title}
        </h3>
        <p className="line-clamp-2 text-[10px] leading-snug text-[#888] sm:line-clamp-3 sm:text-[11px] sm:leading-relaxed">{tool.blurb}</p>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className={`inline-flex items-center rounded-[4px] px-2 py-0.5 text-[9px] font-black sm:text-[10px] ${costClass}`}>
            {tool.cost}
          </span>
          <span className="text-[10px] font-bold text-[#666] transition group-hover:text-[#EF2C58] sm:text-[11px]">
            Нээх →
          </span>
        </div>
      </div>
    </Link>
  );
}
