"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { isAdminEmail } from "@/lib/adminClient";
import FeedComposer from "@/components/FeedComposer";
import { FEED_CATEGORIES, feedCat, CatIcon } from "@/lib/feedCategories";
import s from "./BrandFeed.module.css";

/* ─── BRAND FEED — хувийн брэндийн урсгал (2026-10-11) ────────────────────
   Reel-only урсгалыг сольсон. Нэг багана, X/Threads маягийн мөрүүд —
   хүний нэр, бичвэр нь гол; медиа нь ӨӨРИЙН харьцаагаараа:
     • Текст — энгийн, эсвэл "брэнд карт" (textStyle:"card") — 4:5 хэмжээтэй
       брэндийн ишлэл: том бичиг, зохиогчийн нэр, ANTAQOR тамга. Хуваалцахад
       шууд постер болж харагдана.
     • Зураг/карусель — 1:1 · 4:5 · 16:9 · 9:16 эсвэл эх харьцаа (эхний
       зургаас, 4:5–1.91:1 хооронд хавчина). Карусель нь НАТИВ scroll-snap
       (JS drag биш — утсан дээр байгалийн шударга гүйлгээ), тоолуур + цэг,
       desktop дээр сум.
     • Видео — 9:16 (эсвэл заасан харьцаа), харагдах үед дуугүй тоглоно.
   Зохион байгуулалт: 2px биш 1px шугам (theme-light давхарга rgba-г
   хувиргадаг), бүх булан 4px. Өнгө: класс (§11 өдөр/шөнө хувиргана);
   медиа доторх цагаан бичиг нь inline — дэвсгэр нь үргэлж бараан. */

type Author = { _id: string; name: string; username?: string; avatar?: string } | null;
export interface FeedPost {
  _id: string;
  content?: string;
  image?: string;
  images?: string[];
  video?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  aspect?: string;
  textStyle?: string;
  category?: string;
  createdAt: string;
  viewsCount?: number;
  commentsCount?: number;
  reactions?: Record<string, string[]>;
  pinned?: boolean;
  author: Author;
}

/* 2026-10-11 (эзний загвар): "Танд" = бүх урсгал, "Дагаж буй" = дагасан хүмүүсийн пост. */
const FEEDS = [
  { id: "", label: "Танд" },
  { id: "following", label: "Дагаж буй" },
] as const;

const RATIO: Record<string, number> = { "1:1": 1, "4:5": 4 / 5, "16:9": 16 / 9, "9:16": 9 / 16 };

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

function ago(iso: string) {
  const t = new Date(iso).getTime();
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "дөнгөж сая";
  if (s < 3600) return `${Math.floor(s / 60)}м`;
  if (s < 86400) return `${Math.floor(s / 3600)}ц`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}ө`;
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${sameYear ? "" : d.getFullYear() + "."}${d.getMonth() + 1}-р сарын ${d.getDate()}`;
}

function likeState(p: FeedPost, uid: string | null) {
  let total = 0;
  let mine = false;
  for (const users of Object.values(p.reactions || {})) {
    if (!Array.isArray(users)) continue;
    total += users.length;
    if (uid && users.map(String).includes(uid)) mine = true;
  }
  return { total, mine };
}

function markSeen(id: string) {
  try {
    const seen = new Set<string>(JSON.parse(sessionStorage.getItem("seenPosts") || "[]"));
    if (seen.has(id)) return;
    seen.add(id);
    sessionStorage.setItem("seenPosts", JSON.stringify(Array.from(seen).slice(-500)));
  } catch { /* storage алга */ }
  void fetch("/api/posts/seen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [id] }),
  }).catch(() => {});
}

function posterFor(v: string) {
  return /\/vid-[a-f0-9-]+\.mp4$/.test(v) ? v.replace(/\.mp4$/, "-poster.jpg") : undefined;
}

function Avatar({ a, size = 40 }: { a: Author; size?: number }) {
  const name = a?.name || "?";
  const dim = { width: size, height: size };
  return a?.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={a.avatar} alt="" className={s.av} style={dim} />
  ) : (
    <span className={s.av} data-txt style={{ ...dim, fontSize: size * 0.38 }}>
      {name.slice(0, 2).toUpperCase()}
    </span>
  );
}

/* ── Карусель / ганц зураг ───────────────────────────────────────────────
   2026-10-11 v2 — Threads маяг (эзний жишээ): олон зураг нь ХАЖУУ ХАЖУУДАА,
   НЭГ ӨНДӨРТЭЙ мөр, зураг бүр ӨӨРИЙН харьцаатай, дараагийнх нь ирмэгээсээ
   шагайна → "гүйлгэ" гэдгийг тоолуургүйгээр хэлнэ. Натив scroll-snap
   (JS drag биш). Харьцаа сонгосон бол бүгд тэр хэлбэрт. Ганц зураг нь
   өргөнөөрөө, эх харьцаагаар (4:5 – 1.91:1). */
function Carousel({ images, aspect }: { images: string[]; aspect?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [natural, setNatural] = useState<number | null>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const fixed = aspect ? RATIO[aspect] : undefined;

  if (images.length === 1) {
    const ratio = fixed ?? (natural ? Math.min(1.91, Math.max(0.8, natural)) : 4 / 5);
    return (
      <div className="overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-black" style={{ aspectRatio: String(ratio) }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[0]}
          alt=""
          draggable={false}
          onLoad={fixed ? undefined : (e) => {
            const im = e.currentTarget;
            if (im.naturalWidth && im.naturalHeight) setNatural(im.naturalWidth / im.naturalHeight);
          }}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  };
  const go = (d: number) => {
    const el = track.current;
    if (el) el.scrollBy({ left: d * el.clientWidth * 0.7, behavior: "smooth" });
  };

  return (
    <div className="group/car relative">
      <div
        ref={track}
        onScroll={onScroll}
        className="scrollbar-hide flex h-[290px] snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain sm:h-[360px]"
      >
        {images.map((src, i) => (
          <div
            key={src + i}
            className="h-full shrink-0 snap-start overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-black"
            style={fixed ? { aspectRatio: String(fixed) } : { minWidth: 120 }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              loading={i < 2 ? "eager" : "lazy"}
              draggable={false}
              className={fixed ? "h-full w-full object-cover" : "h-full w-auto max-w-[78vw] object-cover sm:max-w-[520px]"}
            />
          </div>
        ))}
      </div>
      {!edge.start && (
        <button type="button" onClick={() => go(-1)} aria-label="Өмнөх"
          className="absolute left-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[4px] opacity-0 transition group-hover/car:opacity-100 sm:flex"
          style={{ background: "rgba(0,0,0,0.6)", color: "#FFFFFF" }}>‹</button>
      )}
      {!edge.end && (
        <button type="button" onClick={() => go(1)} aria-label="Дараах"
          className="absolute right-2 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-[4px] opacity-0 transition group-hover/car:opacity-100 sm:flex"
          style={{ background: "rgba(0,0,0,0.6)", color: "#FFFFFF" }}>›</button>
      )}
    </div>
  );
}

/* ── Видео: харагдах үед дуугүй тоглоно ───────────────────────────────── */
function InlineVideo({ src, aspect, onSeen }: { src: string; aspect?: string; onSeen: () => void }) {
  const box = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const ratio = (aspect && RATIO[aspect]) || 9 / 16;

  useEffect(() => {
    const el = box.current;
    const v = vid.current;
    if (!el || !v) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && e.intersectionRatio >= 0.6) {
        v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
        onSeen();
      } else {
        v.pause();
        setPlaying(false);
      }
    }, { threshold: [0, 0.6, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, [onSeen]);

  const toggle = () => {
    const v = vid.current;
    if (!v) return;
    if (v.paused) { v.play().then(() => setPlaying(true)).catch(() => {}); }
    else if (muted) { v.muted = false; setMuted(false); }
    else { v.pause(); setPlaying(false); }
  };

  return (
    <div
      ref={box}
      className="relative overflow-hidden rounded-[4px] bg-black"
      style={{ aspectRatio: String(ratio), maxWidth: ratio < 1 ? 380 : undefined }}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={vid}
        src={src}
        poster={posterFor(src)}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        onClick={toggle}
        className="absolute inset-0 h-full w-full cursor-pointer object-cover"
      />
      {!playing && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(0,0,0,0.45)", color: "#FFFFFF" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M7 4.5v15l12-7.5z" /></svg>
          </span>
        </span>
      )}
      <button
        type="button"
        onClick={() => { const v = vid.current; if (v) { v.muted = !muted; setMuted(!muted); } }}
        aria-label={muted ? "Дуу нээх" : "Дуу хаах"}
        className="absolute bottom-2.5 right-2.5 flex h-8 w-8 items-center justify-center rounded-[4px]"
        style={{ background: "rgba(0,0,0,0.6)", color: "#FFFFFF" }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
          <path d="M11 5 6 9H2v6h4l5 4z" strokeLinejoin="round" />
          {muted ? <path d="m22 9-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />}
        </svg>
      </button>
    </div>
  );
}

/* ── Брэнд карт: текст пост → 4:5 ишлэлийн постер ─────────────────────── */
export function BrandCard({ p }: { p: FeedPost }) {
  const text = (p.content || "").trim();
  const size = text.length <= 70 ? 30 : text.length <= 160 ? 24 : text.length <= 320 ? 19 : 16;
  const a = p.author;
  return (
    <div
      className="relative flex flex-col overflow-hidden rounded-[4px] p-6 sm:p-8"
      style={{
        aspectRatio: "4 / 5",
        maxWidth: 460,
        background: "radial-gradient(120% 90% at 0% 0%, #F1F2F7 0%, #F8F9FD 62%)",
        border: "1px solid rgba(46,41,255,0.35)",
        color: "#14151C",
      }}
    >
      <div className="flex items-center gap-2">
        <span style={{ width: 22, height: 3, background: "#2E29FF" }} />
        <span className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "#2E29FF" }}>
          {a?.username ? `@${a.username}` : a?.name}
        </span>
      </div>
      <p
        className="my-auto whitespace-pre-line font-extrabold tracking-[-0.02em]"
        style={{ fontSize: size, lineHeight: 1.22, color: "#12131A", textWrap: "pretty" as React.CSSProperties["textWrap"] }}
      >
        {text}
      </p>
      {/* 2026-11-01: цайвар дэвсгэр дээр цагаан бичиг байсан (уншигдахгүй) → бараан */}
      <div className="flex items-center justify-between gap-3 pt-4" style={{ borderTop: "1px solid rgba(18,19,26,0.1)" }}>
        <span className="flex min-w-0 items-center gap-2">
          <Avatar a={a} size={26} />
          <span className="truncate text-[13px] font-bold" style={{ color: "#12131A" }}>{a?.name}</span>
        </span>
        <span className="shrink-0 text-[11px] font-extrabold tracking-[0.12em]" style={{ color: "#2E29FF" }}>ANTAQOR</span>
      </div>
    </div>
  );
}

function Stat({ d, n, onClick, href, active, label, fill }: { d: string; n?: string; onClick?: () => void; href?: string; active?: boolean; label: string; fill?: boolean }) {
  const inner = (
    <>
      <svg width="20" height="20" viewBox="0 0 24 24" fill={active && fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
        <path d={d} />
      </svg>
      {n !== undefined && <span>{n}</span>}
    </>
  );
  return href ? (
    <Link href={href} aria-label={label} className={s.act}>{inner}</Link>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} aria-pressed={fill ? !!active : undefined} className={s.act} data-on={active || undefined}>{inner}</button>
  );
}

/* 2026-11-01: нэг гэр бүлийн тэмдгүүд (24px сүлжээ, 1.75 зураас, бөөрөнхий төгсгөл).
   «Үзэлт» багана биш нүд болов — баганан диаграм нь «статистик» гэж уншигддаг байв. */
const ICON = {
  comment: "M7.9 20A9 9 0 1 0 4 16.1L2 22z",
  share: "M12 3v12M7.5 7.5 12 3l4.5 4.5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6",
  heart: "M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z",
  views: "M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  trash: "M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6",
};

/** compact = профайлын жагсаалт: аватар/нэргүй, "@handle · огноо" толгой.
 *  onCat — ангиллын тэмдгийг дарахад урсгалыг тэр ангиллаар шүүнэ (байхгүй бол тэмдэг энгийн). */
export function PostRow({ p, uid, compact, onCat }: { p: FeedPost; uid: string | null; compact?: boolean; onCat?: (slug: string) => void }) {
  const a = p.author;
  const imgs = (p.images && p.images.length ? p.images : p.image ? [p.image] : []).filter(Boolean);
  const initial = likeState(p, uid);
  const [liked, setLiked] = useState(initial.mine);
  const [likes, setLikes] = useState(initial.total);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const [gone, setGone] = useState(false);
  const { data: sessData } = useSession();
  const canDel = !!uid && (uid === a?._id || isAdminEmail(sessData?.user?.email));
  const cat = feedCat(p.category);
  const del = async () => {
    if (!confirm("Энэ постыг устгах уу? Буцаах боломжгүй.")) return;
    const r = await fetch(`/api/posts/${p._id}`, { method: "DELETE" }).catch(() => null);
    if (r?.ok) setGone(true); else alert("Устгаж чадсангүй");
  };
  const row = useRef<HTMLElement>(null);
  const seenOnce = useRef(false);
  const seen = useCallback(() => {
    if (seenOnce.current) return;
    seenOnce.current = true;
    markSeen(p._id);
  }, [p._id]);

  // Видеогүй пост: харагдахад үзэлт тоолно.
  useEffect(() => {
    if (p.video) return;
    const el = row.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { seen(); io.disconnect(); } }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [p.video, seen]);

  const toggleLike = async () => {
    if (!uid) { window.location.href = "/?login=1"; return; }
    if (busy) return;
    setBusy(true);
    const was = liked;
    setLiked(!was);
    setLikes((n) => n + (was ? -1 : 1));
    try {
      const r = await fetch(`/api/posts/${p._id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji: "love" }),
      });
      if (!r.ok) throw new Error();
    } catch {
      setLiked(was);
      setLikes((n) => n + (was ? 1 : -1));
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/posts/${p._id}`;
    try {
      if (navigator.share) await navigator.share({ url, title: a?.name ? `${a.name} · Antaqor` : "Antaqor" });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch { /* цуцалсан */ }
  };

  const card = p.textStyle === "card" && !imgs.length && !p.video && !!p.content?.trim();
  const text = (p.content || "").trim();
  const long = text.length > 420 || text.split("\n").length > 8;

  if (gone) return null;
  return (
    <article ref={row} className={s.row} data-compact={compact || undefined} aria-label={a?.name ? `${a.name}-ийн пост` : "Пост"}>
      {!compact && (
        <Link href={a ? `/profile/${a._id}` : "#"} aria-label={a?.name || ""}>
          <Avatar a={a} />
        </Link>
      )}
      <div className={s.main}>
        <div className={s.head}>
          {!compact && (
            <Link href={a ? `/profile/${a._id}` : "#"} className={s.name}>
              {a?.name || "Гишүүн"}
            </Link>
          )}
          {a?.username && <span className={s.meta}>@{a.username}</span>}
          <time className={s.time} dateTime={p.createdAt}>· {ago(p.createdAt)}</time>
          {(p.pinned || canDel) && (
            <span className={s.end}>
              {p.pinned && <span className={s.pin}>Тогтоосон</span>}
              {canDel && (
                <button type="button" onClick={del} aria-label="Постыг устгах" title="Устгах" className={s.icoBtn}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={ICON.trash} /></svg>
                </button>
              )}
            </span>
          )}
        </div>

        {cat && (onCat ? (
          <button type="button" className={s.badge} onClick={() => onCat(cat.slug)} title={`${cat.mn} — энэ ангиллыг харах`}>
            <CatIcon d={cat.icon} size={14} />{cat.label}
          </button>
        ) : (
          <span className={s.badge} title={cat.mn}><CatIcon d={cat.icon} size={14} />{cat.label}</span>
        ))}

        {card ? (
          <Link href={`/posts/${p._id}`} className="block"><BrandCard p={p} /></Link>
        ) : (
          text && (
            <div>
              <p className={s.text} data-clamp={(!open && long) || undefined}>{text}</p>
              {long && !open && (
                <button type="button" onClick={() => setOpen(true)} className={s.more}>
                  Цааш унших
                </button>
              )}
            </div>
          )
        )}

        {p.video ? (
          <InlineVideo src={p.video} aspect={p.aspect} onSeen={seen} />
        ) : imgs.length > 0 ? (
          <Carousel images={imgs} aspect={p.aspect} />
        ) : null}

        {p.fileUrl && (
          <a href={p.fileUrl} target="_blank" rel="noopener noreferrer" className={s.file}>
            <span className={s.fileTag}>PDF</span>
            <span className="min-w-0 flex-1">
              <b className="block truncate text-[14px]">{p.fileName || "Хавсралт.pdf"}</b>
              {!!p.fileSize && <span className="text-[12.5px] text-[#5B6070]">{(p.fileSize / 1048576).toFixed(1)} MB · нээх / татах</span>}
            </span>
          </a>
        )}

        <div className={s.acts}>
          <Stat d={ICON.comment} n={fmt(p.commentsCount || 0)} href={`/posts/${p._id}`} label={`Сэтгэгдэл ${p.commentsCount || 0}`} />
          <Stat d={ICON.heart} n={fmt(likes)} onClick={toggleLike} active={liked} fill label={liked ? "Таалагдсанаа болих" : "Таалагдлаа"} />
          <Stat d={ICON.share} n={copied ? "Хуулсан" : undefined} onClick={share} label="Хуваалцах" />
          <Stat d={ICON.views} n={fmt(p.viewsCount || 0)} href={`/posts/${p._id}`} label={`Үзэлт ${p.viewsCount || 0}`} />
        </div>
      </div>
    </article>
  );
}

export default function BrandFeed({ meAvatar, meName }: { meAvatar?: string; meName?: string }) {
  const { data: session } = useSession();
  const uid = (session?.user as { id?: string } | undefined)?.id ?? null;
  const [feed, setFeed] = useState<string>("");
  const [cat, setCat] = useState<string>("");
  const isAdmin = isAdminEmail(session?.user?.email);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const top = useRef<HTMLElement>(null);

  const load = useCallback(async (pg: number) => {
    const my = ++seq.current;
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(pg), limit: "10" });
      if (feed === "following") q.set("following", "1");
      if (cat) q.set("category", cat);
      const r = await fetch(`/api/posts?${q}`);
      const d = await r.json();
      if (my !== seq.current) return;
      const list = ((d.posts || []) as FeedPost[]).filter((x) => x.author);
      setPosts((prev) => {
        if (pg === 1) return list;
        const have = new Set(prev.map((x) => x._id));
        return [...prev, ...list.filter((x) => !have.has(x._id))];
      });
      setHasMore(pg < (d.pagination?.pages || 0));
      setPage(pg);
    } catch { /* сүлжээ */ }
    finally { if (my === seq.current) setLoading(false); }
  }, [feed, cat]);

  useEffect(() => { setPosts([]); load(1); }, [load]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && !loading) load(page + 1); }, { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, page, load]);

  /* Постын тэмдгээс шүүхэд дээд тал руу буцаана — шүүлтүүр яг хаана идэвхжснийг харуулна. */
  const pickCat = (slug: string) => {
    setCat(slug);
    if (top.current && top.current.getBoundingClientRect().top < 0) top.current.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const active = feedCat(cat);

  return (
    <section ref={top} className={s.feed} aria-label="Урсгал">
      <div className={s.tabs} role="tablist" aria-label="Урсгалын төрөл">
        {FEEDS.map((k) => (
          <button key={k.id || "all"} type="button" role="tab" aria-selected={feed === k.id} onClick={() => setFeed(k.id)} className={s.tab}>
            {k.label}
          </button>
        ))}
      </div>

      <div className={s.cats} role="group" aria-label="Ангиллаар шүүх">
        <button type="button" className={s.chip} aria-pressed={!cat} onClick={() => pickCat("")}>Бүгд</button>
        {FEED_CATEGORIES.map((c) => (
          <button key={c.slug} type="button" className={s.chip} aria-pressed={cat === c.slug} title={c.mn} onClick={() => pickCat(cat === c.slug ? "" : c.slug)}>
            <CatIcon d={c.icon} size={16} />{c.label}
          </button>
        ))}
      </div>

      {/* Бичих мөр — текст + зураг/видео + ангилал, админд сошиалд хуваалцах сонголт. */}
      <FeedComposer meAvatar={meAvatar} meName={meName} isAdmin={isAdmin} defaultCategory={cat}
        onPosted={(p) => setPosts((prev) => [{ ...p, author: { ...(p.author as object), username: (p.author as { username?: string } | undefined)?.username || undefined } } as unknown as FeedPost, ...prev])} />

      <div aria-live="polite" aria-busy={loading}>
        {posts.map((p) => <PostRow key={p._id} p={p} uid={uid} onCat={pickCat} />)}

        {!loading && posts.length === 0 && (
          <p className={s.empty}>
            {active
              ? <>«{active.label}» ангилалд пост алга.<br />Эхнийхийг нь чи бич.</>
              : feed === "following" ? "Дагасан хүмүүсийн пост алга. Баруун талын «Дагах хүмүүс»-ээс эхэл." : "Пост алга байна — эхнийхийг нь чи нийтэл."}
          </p>
        )}
      </div>
      <div ref={sentinel} />
      {loading && (
        <div className={s.load} role="status" aria-label="Ачаалж байна">
          <span className={s.dot} />
        </div>
      )}
    </section>
  );
}
