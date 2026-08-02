"use client";

// Yuki — Сормуусны салон. Light surface, pink brand. Mobile-first.
// Single-focus: eyelash extensions only. Stylist showcase is the centerpiece
// (this is a personality-driven trade) so cards are larger here.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

const PINK = "#EC4899";
const PINK_SOFT = "#FBCFE8";
const PINK_DEEP = "#BE185D";
const PINK_TINT = "#FDF2F8";
const INK = "#2A1B2A";
const DIM = "#94889A";

interface Service { _id: string; slug: string; name: string; description?: string; durationMin: number; priceMnt: number; image?: string; }
interface Stylist { _id: string; slug: string; name: string; role?: string; bio?: string; avatar?: string; }

export default function YukiLandingPage() {
  const { data: session, status } = useSession();
  const [services, setServices] = useState<Service[]>([]);
  const [stylists, setStylists] = useState<Stylist[]>([]);

  useEffect(() => {
    fetch("/api/yuki/services").then((r) => r.json()).then((d) => setServices(d.services || [])).catch(() => {});
    fetch("/api/yuki/stylists").then((r) => r.json()).then((d) => setStylists(d.stylists || [])).catch(() => {});
  }, []);

  const userName = session?.user?.name || "";

  return (
    <div className="mx-auto max-w-[1100px] px-5 pb-32 pt-6 sm:px-8 lg:pt-12">
      {/* ─── Top bar ─── */}
      <header className="mb-8 flex items-center justify-between gap-4">
        <Link href="/yuki" className="flex items-center gap-2.5">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full text-[16px] font-black text-white"
            style={{
              background: `linear-gradient(135deg, ${PINK} 0%, ${PINK_DEEP} 100%)`,
              boxShadow: `0 8px 22px rgba(236,72,153,0.35)`,
            }}
          >
            Y
          </span>
          <div className="leading-tight">
            <div className="text-[16px] font-black tracking-[2px]" style={{ color: INK }}>
              YUKI
            </div>
            <div className="font-mono text-[9px] font-bold uppercase tracking-[0.24em]" style={{ color: PINK }}>
              СОРМУУСНЫ САЛОН
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          {status === "authenticated" ? (
            <>
              <span className="hidden text-[12px] sm:inline" style={{ color: DIM }}>{userName || "Тавтай морил"}</span>
              <Link
                href="/yuki/me"
                className="rounded-full px-3.5 py-1.5 text-[12px] font-bold transition"
                style={{
                  color: PINK_DEEP,
                  border: `1px solid ${PINK_SOFT}`,
                  background: "#FFFFFF",
                }}
              >
                Миний захиалга
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/auth/signin?callbackUrl=/yuki"
                className="rounded-full px-3.5 py-1.5 text-[12px] font-bold transition hover:bg-[#FDF2F8]"
                style={{ color: INK }}
              >
                Нэвтрэх
              </Link>
              <Link
                href="/auth/signup?callbackUrl=/yuki"
                className="rounded-full px-3.5 py-1.5 text-[12px] font-bold text-white transition hover:opacity-90"
                style={{ background: PINK, boxShadow: `0 6px 18px rgba(236,72,153,0.3)` }}
              >
                Бүртгүүлэх
              </Link>
            </>
          )}
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="mb-12 sm:mb-16">
        <span
          className="inline-block rounded-full px-3 py-1 font-mono text-[10px] font-black uppercase tracking-[0.25em]"
          style={{ background: PINK_TINT, color: PINK_DEEP, border: `1px solid ${PINK_SOFT}` }}
        >
          YUKI · LASH STUDIO
        </span>
        <h1
          className="mt-4 text-[36px] font-black leading-[1.05] tracking-tight sm:text-[56px] lg:text-[72px]"
          style={{ color: INK }}
        >
          Нүд чинь<br />
          <span style={{ color: PINK }}>ярина.</span>
        </h1>
        <p className="mt-4 max-w-[520px] text-[14px] leading-relaxed sm:text-[16px]" style={{ color: "#5C4A5A" }}>
          Сормуус хийлгэх — 30 секундэд цаг ав. Юүки мастерууд классик, гибрид,
          мега болон лифт хийнэ. Зөвхөн чанартай материал, цэвэрхэн орчин.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <Link
            href="/yuki/book"
            className="inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-[14px] font-black text-white transition hover:scale-[1.02]"
            style={{ background: PINK, boxShadow: `0 12px 28px rgba(236,72,153,0.35)` }}
          >
            Цаг авах
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
          <Link
            href="#stylists"
            className="text-[13px] font-bold transition hover:opacity-100"
            style={{ color: PINK_DEEP }}
          >
            Стилистүүд ↓
          </Link>
        </div>
      </section>

      {/* ─── Stylists — compact horizontal row, IG-story aesthetic ─── */}
      <section id="stylists" className="mb-12">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-[20px] font-black sm:text-[24px]" style={{ color: INK }}>
            Мастерууд
          </h2>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: PINK }}>
            {stylists.length} МАСТЕР
          </span>
        </div>
        {stylists.length === 0 ? (
          <EmptyHint>Мастер бэлдэж байна…</EmptyHint>
        ) : (
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 scrollbar-hide sm:gap-4">
            {stylists.map((st) => (
              <StylistCard key={st._id} stylist={st} />
            ))}
          </div>
        )}
      </section>

      {/* ─── Services ─── */}
      <section id="services" className="mb-12">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-[20px] font-black sm:text-[24px]" style={{ color: INK }}>Үйлчилгээ</h2>
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em]" style={{ color: PINK }}>
            {services.length} ҮЙЛЧИЛГЭЭ
          </span>
        </div>
        {services.length === 0 ? (
          <EmptyHint>Үйлчилгээ бэлдэж байна…</EmptyHint>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((s) => (
              <ServiceCard key={s._id} service={s} />
            ))}
          </div>
        )}
      </section>

      {/* ─── Final CTA ─── */}
      <section
        className="overflow-hidden rounded-none border p-6 text-center sm:p-10"
        style={{
          borderColor: PINK_SOFT,
          background: `linear-gradient(135deg, ${PINK_TINT} 0%, #FFFFFF 60%)`,
        }}
      >
        <h3 className="text-[24px] font-black sm:text-[32px]" style={{ color: INK }}>
          Цагаа <span style={{ color: PINK }}>одоо</span> авъя.
        </h3>
        <p className="mt-1.5 text-[13px]" style={{ color: DIM }}>30 секундийн зайтай.</p>
        <Link
          href="/yuki/book"
          className="mt-5 inline-flex items-center gap-2 rounded-full px-6 py-3 text-[13px] font-black text-white transition hover:scale-[1.02]"
          style={{ background: PINK, boxShadow: `0 10px 24px rgba(236,72,153,0.3)` }}
        >
          Захиалгаа эхлүүлэх
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </Link>
      </section>
    </div>
  );
}

// ─── Cards ─────────────────────────────────────────────────────────────

function ServiceCard({ service }: { service: Service }) {
  return (
    <Link
      href={`/yuki/book?service=${service._id}`}
      className="group block overflow-hidden rounded-none border bg-white transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(236,72,153,0.12)]"
      style={{ borderColor: "#F1E3EC" }}
    >
      {service.image && (
        <div className="aspect-[16/9] w-full overflow-hidden" style={{ background: PINK_TINT }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={service.image} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[15px] font-black" style={{ color: INK }}>
            {service.name}
          </h3>
          <span className="shrink-0 font-mono text-[11px] font-bold tabular-nums" style={{ color: PINK_DEEP }}>
            ₮{service.priceMnt.toLocaleString()}
          </span>
        </div>
        {service.description && (
          <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed" style={{ color: "#7A6A78" }}>
            {service.description}
          </p>
        )}
        <div className="mt-3 flex items-center justify-between font-mono text-[10px] font-bold uppercase tracking-[0.22em]">
          <span style={{ color: DIM }}>{service.durationMin} МИН</span>
          <span style={{ color: PINK }}>ЦАГ АВАХ →</span>
        </div>
      </div>
    </Link>
  );
}

// Stylist card — compact IG-story style: pink gradient ring around square
// avatar, name + role caption below. Sits in a horizontal scroll row.
function StylistCard({ stylist }: { stylist: Stylist }) {
  return (
    <Link
      href={`/yuki/book?stylist=${stylist._id}`}
      className="group flex w-[96px] shrink-0 flex-col items-center gap-1.5 text-center sm:w-[112px]"
    >
      <div
        className="relative aspect-square w-full rounded-none p-[2px]"
        style={{
          background: `conic-gradient(from 215deg, ${PINK} 0deg, ${PINK_SOFT} 90deg, ${PINK_DEEP} 180deg, ${PINK_SOFT} 270deg, ${PINK} 360deg)`,
          boxShadow: `0 4px 14px rgba(236,72,153,0.18)`,
        }}
      >
        <div
          className="relative h-full w-full overflow-hidden rounded-none"
          style={{ background: PINK_TINT }}
        >
          {stylist.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={stylist.avatar}
              alt={stylist.name}
              className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]"
            />
          ) : (
            <div
              className="flex h-full w-full items-center justify-center text-[28px] font-black"
              style={{ color: PINK_SOFT }}
            >
              {stylist.name.charAt(0)}
            </div>
          )}
        </div>
      </div>
      <div className="w-full px-0.5 leading-tight">
        <div className="truncate text-[12px] font-black" style={{ color: INK }}>
          {stylist.name}
        </div>
        {stylist.role && (
          <div
            className="truncate font-mono text-[8px] font-bold uppercase tracking-[0.18em]"
            style={{ color: PINK }}
          >
            {stylist.role}
          </div>
        )}
      </div>
    </Link>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-none border border-dashed py-12 text-center"
      style={{ borderColor: PINK_SOFT, background: PINK_TINT }}
    >
      <p className="text-[13px]" style={{ color: DIM }}>{children}</p>
    </div>
  );
}
