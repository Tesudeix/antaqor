"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ─── Edgerunners Q&A — instant, on-brand, no API call ───
// Update this list when you ship something material; it's hand-curated so the
// answers stay sharp instead of drifting into LLM-prose.
interface QA {
  q: string;
  a: string;
  cta?: { label: string; href: string };
}

const QA_LIST: QA[] = [
  {
    q: "Edgerunners гэж юу вэ?",
    a: "Монголын анхны AI-төвт business community. 19 AI агент, кредит эдийн засаг, daily live drops. Ганц газар — нэг таны бизнес найз нөхөд бүгд нийлж байгаа.",
    cta: { label: "Нэгдэх →", href: "/auth/signup" },
  },
  {
    q: "Хэдэн агенттай ярих боломжтой?",
    a: "Нийт 19 агент. CFO санхүүгээ удирдаж, Coder код бичиж, Designer брэнд босгож, Marketer/Sales хэрэглэгч авчирна. Бүгд gpt-5-mini-аар ажиллана.",
    cta: { label: "Бүх агентууд →", href: "/agents" },
  },
  {
    q: "Үнэ хэд вэ?",
    a: "₮9,000 / сар. Үнэгүй эхлэх боломжтой. Founding 100 хүн насан туршийн эрх авна. 50 кредит бэлэг бүртгэлтэй, цуцлах боломжтой.",
    cta: { label: "Үнэ харах →", href: "/credits/buy" },
  },
  {
    q: "Сүүлийн шинэчлэл юу вэ?",
    a: "v14 — 19 agent empire (/agents), homepage live agent stream, ChatGPT image v2, Mongolia AI news (Grok). Дараагийн drop: agent-to-agent feed-д ярилцах.",
    cta: { label: "Постууд →", href: "/" },
  },
];

const ROTATE_MS = 6000;

interface NewsItem {
  title: string;
  url: string;
  source: string;
  summary: string;
}

export default function AIBriefing() {
  // ─────── Q&A rotator state ───────
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setIdx((i) => (i + 1) % QA_LIST.length);
    }, ROTATE_MS);
    return () => clearInterval(t);
  }, [paused]);

  const current = QA_LIST[idx];

  // ─────── Mongolia AI news state ───────
  const [news, setNews] = useState<NewsItem[] | null>(null);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsErr, setNewsErr] = useState(false);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/news/mn-ai", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (Array.isArray(d.items) && d.items.length > 0) {
          setNews(d.items.slice(0, 3));
          setStale(!!d.stale);
        } else {
          setNewsErr(true);
        }
      })
      .catch(() => alive && setNewsErr(true))
      .finally(() => alive && setNewsLoading(false));
    return () => { alive = false; };
  }, []);

  return (
    <div className="space-y-3">
      {/* ═════════ Q&A CARD ═════════ */}
      <div
        className="relative overflow-hidden rounded-none border border-[rgba(16,128,202,0.22)] bg-gradient-to-b from-[#0E0E10] to-[#ffffff] p-4 sm:p-5"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <span
          className="pointer-events-none absolute left-4 right-4 top-0 h-[1px]"
          style={{ background: "linear-gradient(90deg, transparent, #1080CA, transparent)" }}
        />

        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-mono text-[9px] font-black uppercase tracking-[0.22em] text-[#F4EFE6]/65">
            <span className="relative flex h-[5px] w-[5px]">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1080CA] opacity-75" />
              <span className="relative inline-flex h-[5px] w-[5px] rounded-full bg-[#1080CA]" />
            </span>
            EDGERUNNERS · AI-Г АСУУ
          </div>
          {/* Pagination dots */}
          <div className="flex items-center gap-1">
            {QA_LIST.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                aria-label={`Q&A ${i + 1}`}
                className="h-[4px] rounded-full transition-all"
                style={{
                  width: i === idx ? 14 : 4,
                  background: i === idx ? "#1080CA" : "rgba(244,239,230,0.18)",
                }}
              />
            ))}
          </div>
        </div>

        <div key={idx} className="qa-fade">
          <p className="text-[14px] font-black leading-tight text-[#F4EFE6]">{current.q}</p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-[#F4EFE6]/70">{current.a}</p>
          {current.cta && (
            <Link
              href={current.cta.href}
              className="mt-3 inline-flex items-center gap-1 font-mono text-[10px] font-black tracking-[0.18em] text-[#1080CA] transition hover:text-white"
            >
              {current.cta.label.toUpperCase()}
            </Link>
          )}
        </div>

        <style>{`
          .qa-fade {
            animation: qaFade 380ms cubic-bezier(0.16, 1, 0.3, 1) both;
          }
          @keyframes qaFade {
            from { opacity: 0; transform: translateY(6px); }
            to   { opacity: 1; transform: none; }
          }
        `}</style>
      </div>

      {/* ═════════ MONGOLIA AI NEWS CARD ═════════ */}
      <div className="relative overflow-hidden rounded-none border border-[rgba(244,239,230,0.08)] bg-[#ffffff] p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-mono text-[9px] font-black uppercase tracking-[0.22em] text-[#F4EFE6]/60">
            <span className="relative flex h-[5px] w-[5px]">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4FE065] opacity-75" />
              <span className="relative inline-flex h-[5px] w-[5px] rounded-full bg-[#4FE065]" />
            </span>
            ӨНӨӨДРИЙН AI · ХОТ ДЭЛХИЙ
          </div>
          {stale && (
            <span className="font-mono text-[8px] tracking-[0.18em] text-[#6b7280]">CACHED</span>
          )}
        </div>

        {newsLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[58px] animate-pulse rounded-none bg-[rgba(15,23,38,0.03)]"
              />
            ))}
          </div>
        ) : newsErr || !news ? (
          <p className="font-mono text-[10px] text-[#6b7280]">
            Мэдээ татаж чадсангүй. Дараа дахин оролдоорой.
          </p>
        ) : (
          <ol className="space-y-2">
            {news.map((it, i) => (
              <li key={i}>
                <a
                  href={it.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 rounded-none border border-transparent p-1.5 transition hover:border-[rgba(16,128,202,0.25)] hover:bg-[rgba(16,128,202,0.04)]"
                >
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-none bg-[rgba(16,128,202,0.12)] font-mono text-[10px] font-black text-[#1080CA]">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[12px] font-bold leading-snug text-[#F4EFE6] transition group-hover:text-[#1080CA]">
                      {it.title}
                    </p>
                    {it.summary && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[#F4EFE6]/55">
                        {it.summary}
                      </p>
                    )}
                    <div className="mt-1 flex items-center gap-1.5 font-mono text-[9px] tracking-[0.15em] text-[#6b7280]">
                      <span>{it.source || hostname(it.url)}</span>
                      <span className="opacity-50">→</span>
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
