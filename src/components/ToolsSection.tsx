"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* ─── НҮҮРНИЙ "ХЭРЭГСЭЛ" ХЭСЭГ ──────────────────────────────────────────
   Картууд нь админаас засагддаг (HomepageCard, section="tool",
   /admin/homepage-cards). Код дээр хатуу бичихгүй — шинэ хэрэгсэл
   нэмэхэд build хийх шаардлагагүй байх ёстой.

   Хоосон бол юу ч харуулахгүй: хагас дүүрэн хэсэг нь нүүрийг
   эмх гэхээсээ эвдэрсэн шиг харагдуулдаг. */

const INK = "var(--t-ink, #F2F2F4)";
const SUB = "var(--t-sub, #9C9CA6)";
const LINE = "var(--t-line, rgba(255,255,255,0.12))";
const SURFACE = "var(--t-surface, #171320)";
const TEAL = "var(--accent-ink, #2E29FF)";

interface Card {
  _id: string; section: string; title: string; desc: string;
  emoji: string; coverImage?: string; href: string; order: number; enabled?: boolean;
}

export default function ToolsSection() {
  const [cards, setCards] = useState<Card[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/homepage-cards", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const all: Card[] = Array.isArray(d.cards) ? d.cards : Array.isArray(d) ? d : [];
        setCards(
          all.filter((c) => c.section === "tool" && c.enabled !== false)
             .sort((a, b) => (a.order || 0) - (b.order || 0)),
        );
      })
      .catch(() => { if (alive) setCards([]); });
    return () => { alive = false; };
  }, []);

  if (!cards || cards.length === 0) return null;

  return (
    <section className="w-full px-4 py-14 md:px-8">
      <div className="mx-auto w-full max-w-[1100px]">
        <p className="text-[11px] font-bold uppercase" style={{ color: TEAL, letterSpacing: "0.16em" }}>
          Хэрэгсэл
        </p>
        <h2 className="mt-1.5 text-[26px] font-extrabold leading-[1.15] md:text-[32px]" style={{ color: INK }}>
          Бүтээхэд хэрэгтэй бүхэн
        </h2>
        <p className="mt-2 max-w-[560px] text-[14px] leading-[1.7]" style={{ color: SUB }}>
          Кредитээр ажилладаг AI хэрэгслүүд. Нэвтрээд шууд хэрэглэнэ.
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((c) => (
            <Link key={c._id} href={c.href}
              className="group block overflow-hidden transition"
              style={{ borderRadius: 4, border: `1px solid ${LINE}`, background: SURFACE, textDecoration: "none" }}>
              {c.coverImage && (
                <div style={{ aspectRatio: "16/9", overflow: "hidden" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.coverImage} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start gap-2.5">
                  <span className="text-[20px] leading-none" aria-hidden>{c.emoji || "✨"}</span>
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-extrabold" style={{ color: INK }}>{c.title}</p>
                    {c.desc && (
                      <p className="mt-1 line-clamp-2 text-[12.5px] leading-[1.6]" style={{ color: SUB }}>{c.desc}</p>
                    )}
                  </div>
                </div>
                <span className="mt-3 inline-block text-[12px] font-bold" style={{ color: TEAL }}>
                  Нээх →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
