"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CreditIcon } from "@/components/CreditIcon";

/* ─── ГИШҮҮДИЙН БҮТЭЭЛ — постерийн хана ──────────────────────────────────

   МОЗАЙКААС ПОСТЕР РУУ (2026-09-04, эзний шийдвэр). Өөр өөр хэмжээтэй
   мозайк нь "амьд" боловч ХЭМНЭЛГҮЙ байв: нүд мөр бүрт шинэ хэлбэр тааралдаж
   зогсдог, харин каталог нь ГҮЙЛГЭХ ёстой. Netflix-ийн зарчим — хавтан бүр
   ЯГ ижил, зөрүү нь зөвхөн АГУУЛГАД. Ижил хэмжээ нь уйтгартай биш,
   ХАРЬЦУУЛАХ боломжтой болгодог.

   2:3 постер нь квадрат зураг, босоо видео хоёуланд тохирдог цорын ганц
   харьцаа: зураг бага зэрэг тайрагдана, видео бараг бүтнээрээ багтана.

   ХӨДӨЛГӨӨН нь чимэг биш, дохио: хана нь шатлан гарч ирнэ (эхнийх нь
   эхэлж), хулгана ойртоход хавтан урагшилна. "Энд юм болж байна" гэдгийг
   өгүүлбэргүйгээр хэлнэ — бүртгүүлэх шалтгаан нь тайлбар биш, ХӨДӨЛГӨӨН. */

interface Tile {
  _id: string;
  kind: "image" | "video";
  src: string;
  poster: string;
  author: string;
  avatar: string;
  createdAt: string;
}

const TABS: { id: "all" | "image" | "video"; label: string }[] = [
  { id: "all", label: "Бүгд" },
  { id: "image", label: "Зураг" },
  { id: "video", label: "Видео" },
];

function VideoTile({ t }: { t: Tile }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) el.play().catch(() => {}); else el.pause(); },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <video
      ref={ref}
      src={t.src}
      poster={t.poster || undefined}
      autoPlay
      muted
      loop
      playsInline
      preload="metadata"
      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]"
    />
  );
}

export default function AiWorkWall() {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [loading, setLoading] = useState(true);
  const [cost, setCost] = useState(10);
  const [tab, setTab] = useState<"all" | "image" | "video">("all");

  useEffect(() => {
    let cancel = false;
    Promise.allSettled([
      fetch("/api/ai-gallery?limit=24").then((r) => r.json()),
      fetch("/api/ai-videos?limit=12").then((r) => r.json()),
    ])
      .then(([img, vid]) => {
        if (cancel) return;
        const out: Tile[] = [];
        if (img.status === "fulfilled" && Array.isArray(img.value?.items)) {
          for (const i of img.value.items) {
            out.push({ _id: i._id, kind: "image", src: i.image, poster: "", author: i.author, avatar: i.avatar, createdAt: i.createdAt });
          }
        }
        if (vid.status === "fulfilled" && Array.isArray(vid.value?.items)) {
          for (const v of vid.value.items) {
            out.push({ _id: v._id, kind: "video", src: v.video, poster: v.poster, author: v.author, avatar: v.avatar, createdAt: v.createdAt });
          }
        }
        out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setTiles(out);
      })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoading(false); });

    fetch("/api/tools/image-pricing")
      .then((r) => r.json())
      .then((d) => { if (!cancel && d?.costs?.nano2) setCost(d.costs.nano2); })
      .catch(() => {});
    return () => { cancel = true; };
  }, []);

  const counts = useMemo(() => ({
    all: tiles.length,
    image: tiles.filter((t) => t.kind === "image").length,
    video: tiles.filter((t) => t.kind === "video").length,
  }), [tiles]);

  const shown = useMemo(
    () => (tab === "all" ? tiles : tiles.filter((t) => t.kind === (tab === "image" ? "image" : "video"))).slice(0, 18),
    [tiles, tab]
  );

  if (loading) {
    return (
      <section className="px-4 py-14 sm:px-5" aria-busy="true">
        <div className="mx-auto max-w-[1000px]">
          <div className="flex items-center justify-between gap-4">
            <div className="h-7 w-52 rounded-[4px] skeleton-brand" />
            <div className="h-10 w-40 rounded-[4px] skeleton-brand" />
          </div>
          <div className="mt-5 flex gap-2">
            {[54, 60, 60].map((w, i) => <div key={i} className="h-8 rounded-full skeleton-brand" style={{ width: w }} />)}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
              <div key={i} className="aspect-[2/3] w-full rounded-[4px] skeleton-brand" />
            ))}
          </div>
        </div>
      </section>
    );
  }
  if (tiles.length === 0) return null;

  return (
    <section className="px-4 py-14 sm:px-5">
      <div className="mx-auto max-w-[1000px]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-[22px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[var(--nav-fg-strong)] sm:text-[26px]">
            Гишүүдийн бүтээл
          </h2>
          <Link
            href="/pricing"
            className="press inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#2E29FF] px-5 py-2.5 text-[12.5px] font-bold text-white transition hover:bg-[#1F1AD9]"
          >
            <CreditIcon size={13} />
            {cost} кредитээр эхлэх
          </Link>
        </div>

        {/* Ангилал — дугуй чипс. Тоо нь ХООСОН ангиллыг ил гаргана;
            дарж ороод хоосон дэлгэц олохоос нэг товшилт өмнө мэднэ. */}
        <div className="mt-5 flex flex-wrap gap-2">
          {TABS.map((t) => {
            const n = counts[t.id];
            if (t.id !== "all" && n === 0) return null;
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`ww-chip rounded-full px-4 py-2 text-[12.5px] font-bold transition ${on ? "" : "hover:text-[var(--nav-fg-strong)]"}`}
                style={on
                  ? { background: "#2E29FF", color: "#FFFFFF" }
                  : { background: "rgba(128,128,128,0.10)", color: "var(--t-body, #30333F)" }}
              >
                {t.label}
                <span className="ml-1.5 tabular-nums opacity-60">{n}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {shown.map((t, i) => (
            <Link
              key={`${t.kind}-${t._id}`}
              href={`/posts/${t._id}`}
              className="ww-tile group relative aspect-[2/3] overflow-hidden rounded-[4px] bg-[rgba(128,128,128,0.08)] transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_20px_44px_rgba(0,0,0,0.45)]"
              style={{ animationDelay: `${Math.min(i, 12) * 45}ms` }}
            >
              {t.kind === "video" ? (
                <VideoTile t={t} />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.src} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.06]" />
              )}

              {t.kind === "video" && (
                <span className="pointer-events-none absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 backdrop-blur-[2px]">
                  <svg className="h-3 w-3 translate-x-[1px] text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                </span>
              )}

              <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/85 to-transparent px-2.5 pb-2 pt-8 opacity-0 transition duration-300 group-hover:opacity-100">
                {t.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.avatar} alt="" className="h-4 w-4 rounded-full object-cover" />
                ) : (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#2E29FF] text-[8px] font-black text-white">
                    {t.author.charAt(0)}
                  </span>
                )}
                <span className="truncate text-[10.5px] font-semibold text-white">{t.author}</span>
              </span>
            </Link>
          ))}
        </div>
      </div>

      <style jsx global>{`
        @keyframes ww-in {
          from { opacity: 0; transform: translateY(14px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .ww-tile { animation: ww-in 0.5s cubic-bezier(0.2, 0.8, 0.3, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .ww-tile { animation: none; }
        }
      `}</style>
    </section>
  );
}
