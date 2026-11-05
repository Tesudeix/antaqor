"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MagArticle } from "@/lib/magazine";
import { MAG_CATEGORIES } from "@/lib/magazineRender";
import css from "./magazine.module.css";

/* ─── Нийтлэл унших (2026-10-11) ───────────────────────────────────────────
   Дээд талд бэхлэгдсэн уншилтын явц (teal) + "Уншиж байна · N%".
   Төгсгөлд "Уншиж дууслаа ✓ · N хүн үзсэн", хуваалцах, бусад ангилал (тоотой),
   ижил ангиллын нийтлэлүүд. Бүх зураг хар-цагаан. */

const SITE = "https://antaqor.com";

export default function MagazineReader({
  article, html, counts, related,
}: { article: MagArticle; html: string; counts: Record<string, number>; related: MagArticle[] }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(0);
  const [copied, setCopied] = useState(false);
  const url = `${SITE}/magazine/${encodeURIComponent(article.slug)}`;
  const border = "rgba(255,255,255,0.16)";

  useEffect(() => {
    const onScroll = () => {
      const el = bodyRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight * 0.6;
      const done = Math.min(1, Math.max(0, (-r.top + window.innerHeight * 0.2) / Math.max(1, total)));
      setPct(Math.round(done * 100));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, []);

  const share = (href: string) => window.open(href, "_blank", "noopener,noreferrer,width=640,height=560");
  const enc = encodeURIComponent;
  const targets = [
    { name: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { name: "X", href: `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(article.title)}` },
    { name: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}` },
    { name: "Threads", href: `https://www.threads.net/intent/post?text=${enc(`${article.title} ${url}`)}` },
  ];
  const date = new Intl.DateTimeFormat("mn-MN", { timeZone: "Asia/Ulaanbaatar", year: "numeric", month: "long", day: "numeric" }).format(new Date(article.publishedAt));

  return (
    <>
      {/* Уншилтын явц */}
      <div className="fixed inset-x-0 top-0 z-[70] h-1 bg-white/10" aria-hidden>
        <div className="h-full bg-[#2E29FF] transition-[width] duration-150" style={{ width: `${pct}%` }} />
      </div>

      <article className="mx-auto w-full max-w-[760px] px-4 pb-24 pt-4 lg:px-0">
        <div className="flex items-center justify-between gap-3 border-b-2 pb-3 font-mono text-[11.5px] tracking-[0.08em]" style={{ borderColor: border }}>
          <Link href="/magazine" className="text-[#2E29FF]">← MAGAZINE</Link>
          <span className="text-[#9C9CA6]">{pct >= 99 ? "Уншиж дууслаа ✓" : `Уншиж байна · ${pct}%`}</span>
        </div>

        <header className="py-6">
          <div className="font-mono text-[12px] tracking-[0.06em] text-[#2E29FF]">
            {article.category} · {article.readingMinutes} мин · {article.views.toLocaleString()} үзсэн
          </div>
          <h1 className="mt-3 text-[clamp(32px,6vw,56px)] font-extrabold leading-[1.02] tracking-[-0.035em] text-white">{article.title}</h1>
          {article.excerpt && <p className="mt-4 text-[19px] leading-[1.55] text-[#C9C9D1]">{article.excerpt}</p>}
          <div className="mt-4 text-[13px] text-[#9C9CA6]">{article.authorName} · {date}</div>
        </header>

        {article.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={article.coverImage} alt="" className={`${css.bw} mb-8 aspect-[16/9] w-full rounded-[4px] object-cover`} />
        )}

        <div ref={bodyRef} className={css.prose} dangerouslySetInnerHTML={{ __html: html }} />

        {/* Төгсгөл */}
        <div className="mt-10 flex items-center justify-between border-t-2 pt-3 text-[14px]" style={{ borderColor: border }}>
          <span className="text-[#C9C9D1]">Уншиж дууслаа ✓</span>
          <strong className="text-white">{article.views.toLocaleString()} хүн үзсэн</strong>
        </div>

        {/* Хуваалцах */}
        <div className="mt-6 grid grid-cols-2 border-2 sm:grid-cols-5" style={{ borderColor: border }}>
          <button
            type="button"
            onClick={() => { navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {}); }}
            className="col-span-2 border-b-2 px-4 py-3 text-left text-[14px] font-bold sm:col-span-1 sm:border-b-0 sm:border-r-2"
            style={{ borderColor: border, background: "#2E29FF", color: "#FFFFFF" }}
          >
            {copied ? "Хуулсан ✓" : "Линк хуулах"}
          </button>
          {targets.map((t, i) => (
            <button key={t.name} type="button" onClick={() => share(t.href)}
              className={`px-4 py-3 text-left text-[14px] font-semibold text-[#E2E4E8] transition hover:bg-white/5 ${i < targets.length - 1 ? "border-r-2" : ""}`}
              style={{ borderColor: border }}>
              {t.name}
            </button>
          ))}
        </div>

        {/* Бусад ангилал */}
        <div className="mt-10 font-mono text-[11.5px] tracking-[0.12em] text-[#9C9CA6]">БУСАД АНГИЛАЛ</div>
        <div className="mt-2 grid grid-cols-2 border-l-2 border-t-2 sm:grid-cols-3" style={{ borderColor: border }}>
          {MAG_CATEGORIES.filter((c) => c !== article.category).map((c) => (
            <Link key={c} href={`/magazine?category=${encodeURIComponent(c)}`} className="flex flex-col gap-0.5 border-b-2 border-r-2 p-3.5 transition hover:bg-white/5" style={{ borderColor: border }}>
              <strong className="text-[15px] text-white">{c}</strong>
              <span className="text-[12px] text-[#9C9CA6]">{counts[c] || 0} нийтлэл</span>
            </Link>
          ))}
        </div>

        {related.length > 0 && (
          <>
            <div className="mt-10 font-mono text-[11.5px] tracking-[0.12em] text-[#9C9CA6]">{article.category} · ИЖИЛ СЭДЭВ</div>
            <div className="mt-2 flex flex-col">
              {related.map((r) => (
                <Link key={r.slug} href={`/magazine/${encodeURIComponent(r.slug)}`} className="group flex gap-4 border-b-2 py-4" style={{ borderColor: border }}>
                  <div className="aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-[4px] bg-[#141414]">
                    {r.coverImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.coverImage} alt="" loading="lazy" className={`${css.bw} h-full w-full object-cover`} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] text-[#2E29FF]">{r.readingMinutes} мин · {r.views.toLocaleString()} үзсэн</div>
                    <div className="mt-1 text-[17px] font-extrabold leading-tight text-white group-hover:text-[#2E29FF]">{r.title}</div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </article>
    </>
  );
}
