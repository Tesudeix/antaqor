"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/* ─── REEL АНГИЛЛЫН МӨР — "Хичээлүүд"-тэй ижил Netflix маяг (2026-10-09) ────
   Танилцуулга · Story · Mission гэх мэт reel ангилал бүр нүүрэн дээр өөрийн
   хэвтээ мөртэй. Карт нь 3:4 (Хичээлүүдтэй ижил хэмжээ), видеоны poster
   зураг, доор нь гарчиг + үзэлт, дээр нь coral ангиллын шошго.

   Өгөгдөл: /api/posts?category=<slug> — сервер зөвхөн reel (видеотой пост)
   буцаана; эрхгүй хүнд хоосон. Хоосон үед мөр УСТАХГҮЙ — "Удахгүй" гэсэн
   хоосон картууд харагдана (эзний LessonRow-ийн дүрэмтэй ижил: мөр
   хоосон харагдах ёсгүй). */

interface ReelPost {
  _id: string;
  content?: string;
  video?: string;
  viewsCount?: number;
  author?: { name?: string; username?: string } | null;
}

const GRADIENTS = [
  "linear-gradient(160deg,#2E29FF 0%,#5B3BFF 100%)",
  "linear-gradient(160deg,#5B3BFF 0%,#2563FF 100%)",
  "linear-gradient(160deg,#1F1AD9 0%,#0E7490 100%)",
  "linear-gradient(160deg,#4C47FF 0%,#7C3AED 100%)",
];

function poster(video?: string) {
  return video && /\/vid-[a-f0-9-]+\.mp4$/.test(video) ? video.replace(/\.mp4$/, "-poster.jpg") : undefined;
}

export default function ReelRow({ slug, title, hint }: { slug: string; title: string; hint?: string }) {
  const [items, setItems] = useState<ReelPost[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/posts?category=${encodeURIComponent(slug)}&limit=12`)
      .then((r) => (r.ok ? r.json() : { posts: [] }))
      .then((d) => { if (alive) setItems((d.posts || []).filter((p: ReelPost) => p.video)); })
      .catch(() => { if (alive) setItems([]); });
    return () => { alive = false; };
  }, [slug]);

  const card = "aspect-[3/4] w-[44%] shrink-0 snap-start overflow-hidden rounded-[4px] sm:w-[210px]";

  return (
    <section className="mt-6" aria-label={title}>
      <div className="mb-3 flex items-baseline justify-between gap-3 px-4 sm:px-1">
        <div className="min-w-0">
          <h2 className="text-[20px] font-extrabold tracking-[-0.01em] text-[var(--nav-fg-strong)]">{title}</h2>
          {hint && <p className="truncate text-[12.5px] text-[#9C9CA6]">{hint}</p>}
        </div>
        <Link href={`/posts/new`} className="shrink-0 text-[13px] font-semibold text-[#2E29FF] transition hover:text-[#4C47FF]">
          ＋ Reel
        </Link>
      </div>

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:px-1" style={{ scrollbarWidth: "none" }}>
        {items === null
          ? Array.from({ length: 4 }, (_, i) => (
              <div key={i} className={`${card} animate-pulse`} style={{ background: "var(--nav-hover-bg, #FFFFFF)" }} />
            ))
          : items.length === 0
            ? Array.from({ length: 4 }, (_, i) => (
                <div key={i} className={`${card} relative flex items-end p-3`} style={{ background: GRADIENTS[i % GRADIENTS.length] }}>
                  <div>
                    <span className="rounded-[4px] px-2 py-0.5 text-[11px] font-bold" style={{ background: "#2E29FF", color: "#FFFFFF" }}>{title}</span>
                    <div className="mt-2 text-[14px] font-bold" style={{ color: "var(--t-ink, #FFFFFF)" }}>Удахгүй</div>
                  </div>
                </div>
              ))
            : items.map((p) => (
                <Link key={p._id} href={`/posts/${p._id}`} className={`${card} press group relative block bg-black`}>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <video
                    src={p.video}
                    poster={poster(p.video)}
                    preload="metadata"
                    muted
                    playsInline
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 45%, rgba(0,0,0,0.78) 100%)" }} />
                  <span className="absolute left-2 top-2 rounded-[4px] px-1.5 py-0.5 text-[10.5px] font-bold" style={{ background: "#2E29FF", color: "#FFFFFF" }}>{title}</span>
                  <div className="absolute inset-x-0 bottom-0 p-2.5">
                    {p.content && <div className="line-clamp-2 text-[13px] font-bold leading-tight" style={{ color: "#FFFFFF" }}>{p.content}</div>}
                    <div className="mt-1 flex items-center justify-between text-[11px]" style={{ color: "rgba(255,255,255,0.8)" }}>
                      <span className="truncate">@{p.author?.username || p.author?.name || "antaqor"}</span>
                      <span className="shrink-0">▷ {(p.viewsCount || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </Link>
              ))}
      </div>
    </section>
  );
}
