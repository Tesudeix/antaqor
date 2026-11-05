"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { reelCategoryName } from "@/lib/reelCategories";

/* ─── REEL УРСГАЛ — TikTok маягийн босоо тоглуулагч (2026-10-06) ──────────
   Сайт зөвхөн reel контенттой болсон. Reel бүр бараг бүтэн дэлгэцийн 9:16
   хавтан; харагдаж буй нь л өөрөө тоглоно (IntersectionObserver), бусад
   нь зогсоно — нэг зэрэг арван видео тоглуулж утсыг хайлуулахгүй.

   Баруун талын эгнээ: зохиогч (профайл руу), зүрх (love reaction),
   сэтгэгдэл (пост хуудас руу), хуваалцах. Доод зүүнд: нэр, тайлбар,
   ангилал.

   Хуудас өөрөө гүйлгэгдэнэ — дотор нь тусдаа scroll-snap контейнер
   БАЙХГҮЙ. Hero, хичээлийн мөр дээрээ байгаа тул үүрлэсэн гүйлгээ нь
   утсан дээр "аль нь гүйлгэгдэж байна" гэсэн будлиан үүсгэнэ. */

interface Reel {
  _id: string;
  content?: string;
  video: string;
  videoDurationSec?: number;
  category?: string;
  viewsCount?: number;
  commentsCount?: number;
  reactions?: Record<string, string[]>;
  author: { _id: string; name: string; username?: string; avatar?: string } | null;
}

function likeState(r: Reel, uid: string | null) {
  let total = 0;
  let mine = false;
  for (const [, users] of Object.entries(r.reactions || {})) {
    if (!Array.isArray(users)) continue;
    total += users.length;
    if (uid && users.map(String).includes(uid)) mine = true;
  }
  return { total, mine };
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

/** Session бүрд reel бүрийг НЭГ удаа үзсэнд тооцно (/api/posts/seen). */
function markSeen(id: string) {
  try {
    const seen = new Set<string>(JSON.parse(sessionStorage.getItem("seenPosts") || "[]"));
    if (seen.has(id)) return;
    seen.add(id);
    sessionStorage.setItem("seenPosts", JSON.stringify(Array.from(seen).slice(-500)));
  } catch {
    /* sessionStorage байхгүй — тоолохоо алгасахгүй, давхар тоолж болзошгүй */
  }
  void fetch("/api/posts/seen", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [id] }),
  }).catch(() => {});
}

function RailButton({
  onClick, href, label, count, active, children,
}: {
  onClick?: () => void; href?: string; label: string; count?: string; active?: boolean; children: React.ReactNode;
}) {
  const inner = (
    <>
      <span
        className="flex h-12 w-12 items-center justify-center rounded-full backdrop-blur-sm transition"
        style={{ background: "rgba(0,0,0,0.35)", color: active ? "#FF3D69" : "#FFFFFF" }}
      >
        {children}
      </span>
      {count !== undefined && (
        <span className="text-[12.5px] font-bold tabular-nums" style={{ color: "#FFFFFF", textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}>
          {count}
        </span>
      )}
    </>
  );
  const cls = "press flex flex-col items-center gap-1";
  return href ? (
    <Link href={href} aria-label={label} className={cls}>{inner}</Link>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} className={cls}>{inner}</button>
  );
}

function ReelItem({ reel, uid, onSeen }: { reel: Reel; uid: string | null; onSeen: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const vid = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const initial = likeState(reel, uid);
  const [liked, setLiked] = useState(initial.mine);
  const [likes, setLikes] = useState(initial.total);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Харагдаж буй reel л тоглоно.
  useEffect(() => {
    const el = ref.current;
    const v = vid.current;
    if (!el || !v) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && e.intersectionRatio >= 0.6) {
          v.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
          onSeen(reel._id);
        } else {
          v.pause();
          setPlaying(false);
        }
      },
      { threshold: [0, 0.6, 1] }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reel._id, onSeen]);

  const togglePlay = () => {
    const v = vid.current;
    if (!v) return;
    if (v.paused) { v.play().then(() => setPlaying(true)).catch(() => {}); }
    else { v.pause(); setPlaying(false); }
  };

  const toggleLike = async () => {
    if (!uid) {
      window.location.href = "/?login=1";
      return;
    }
    if (busy) return;
    setBusy(true);
    const was = liked;
    setLiked(!was);
    setLikes((n) => n + (was ? -1 : 1));
    try {
      const r = await fetch(`/api/posts/${reel._id}/react`, {
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
    const url = `${window.location.origin}/posts/${reel._id}`;
    try {
      if (navigator.share) await navigator.share({ url, title: "Antaqor reel" });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      /* хэрэглэгч цуцалсан */
    }
  };

  const a = reel.author;
  const cat = reelCategoryName(reel.category);

  return (
    <div
      ref={ref}
      className="relative mx-auto overflow-hidden rounded-[4px] bg-black"
      style={{ height: "min(calc(100svh - 150px), 820px)", aspectRatio: "9 / 16", maxWidth: "100%" }}
    >
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        ref={vid}
        src={reel.video}
        poster={reel.video.match(/\/vid-[a-f0-9-]+\.mp4$/) ? reel.video.replace(/\.mp4$/, "-poster.jpg") : undefined}
        loop
        muted={muted}
        playsInline
        preload="metadata"
        onClick={togglePlay}
        className="absolute inset-0 h-full w-full cursor-pointer object-cover"
      />

      {!playing && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Тоглуулах"
          className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full"
          style={{ background: "rgba(0,0,0,0.4)", color: "#FFFFFF" }}
        >
          <svg viewBox="0 0 24 24" className="ml-1 h-8 w-8" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
        </button>
      )}

      {/* Дуу — зүүн дээд буланд, TikTok шиг */}
      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        aria-label={muted ? "Дуу асаах" : "Дуу хаах"}
        className="absolute left-3 top-3 flex h-10 w-10 items-center justify-center rounded-full"
        style={{ background: "rgba(0,0,0,0.35)", color: "#FFFFFF" }}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M11 5L6 9H3v6h3l5 4z" fill="currentColor" />
          {muted ? <path d="M22 9l-6 6M16 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />}
        </svg>
      </button>

      {/* Баруун эгнээ */}
      <div className="absolute bottom-24 right-2.5 flex flex-col items-center gap-4">
        {a && (
          <Link href={`/profile/${a._id}`} aria-label={a.name} className="press relative mb-1">
            {a.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.avatar} alt="" className="h-12 w-12 rounded-full border-2 object-cover" style={{ borderColor: "#FFFFFF" }} />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 text-[16px] font-bold" style={{ borderColor: "#FFFFFF", background: "#2E29FF", color: "#FFFFFF" }}>
                {(a.name || "?").charAt(0).toUpperCase()}
              </span>
            )}
          </Link>
        )}
        <RailButton onClick={toggleLike} label={liked ? "Таалагдсанаа болих" : "Таалагдлаа"} count={fmt(likes)} active={liked}>
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
            <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.8 4.5c2.1 0 3.6 1.2 5.2 3 1.6-1.8 3.1-3 5.2-3 3.8 0 5.9 3.9 4.4 7.3C19.5 16.4 12 21 12 21z" />
          </svg>
        </RailButton>
        <RailButton href={`/posts/${reel._id}`} label="Сэтгэгдэл" count={fmt(reel.commentsCount || 0)}>
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
            <path d="M12 3C6.5 3 2 6.9 2 11.6c0 2.5 1.3 4.8 3.4 6.4L4.6 21l3.6-1.9c1.2.4 2.5.6 3.8.6 5.5 0 10-3.9 10-8.6S17.5 3 12 3z" />
          </svg>
        </RailButton>
        <RailButton onClick={share} label="Хуваалцах" count={copied ? "✓" : "Хуваах"}>
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden>
            <path d="M14 4l8 7.5-8 7.5v-4.6c-5.4 0-9 1.6-12 5.6 1-5.6 4.4-10.6 12-11.6z" />
          </svg>
        </RailButton>
      </div>

      {/* Доод зүүн: зохиогч, тайлбар, ангилал */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 px-3.5 pb-4 pr-20 pt-16"
        style={{ background: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 100%)" }}
      >
        {a && (
          <div className="text-[16px] font-bold" style={{ color: "#FFFFFF" }}>
            {a.username || a.name}
          </div>
        )}
        {reel.content && (
          <p className="mt-1 line-clamp-2 text-[14px] leading-snug" style={{ color: "rgba(255,255,255,0.92)" }}>
            {reel.content}
          </p>
        )}
        <div className="mt-1.5 flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
          {cat && <span className="rounded-[4px] px-1.5 py-0.5" style={{ background: "#FCEE0A", color: "#0A0A0A" }}>{cat}</span>}
          <span>▷ {fmt(reel.viewsCount || 0)}</span>
        </div>
      </div>
    </div>
  );
}

export default function ReelFeed({ category }: { category: string | null }) {
  const { data: session } = useSession();
  const uid = (session?.user as { id?: string } | undefined)?.id ?? null;
  const [reels, setReels] = useState<Reel[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const sentinel = useRef<HTMLDivElement>(null);

  const load = useCallback(async (p: number) => {
    const my = ++seq.current;
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(p), limit: "8" });
      if (category) q.set("category", category);
      const r = await fetch(`/api/posts?${q}`);
      const d = await r.json();
      if (my !== seq.current) return;
      const list = ((d.posts || []) as Reel[]).filter((x) => x.author && x.video);
      setReels((prev) => (p === 1 ? list : [...prev, ...list]));
      setHasMore(p < (d.pagination?.pages || 0));
      setPage(p);
    } catch {
      /* сүлжээ */
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [category]);

  useEffect(() => { setReels([]); load(1); }, [load]);

  // Төгсгөлд ойртоход дараагийн хуудсыг өөрөө татна.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !loading) load(page + 1);
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, page, load]);

  const onSeen = useCallback((id: string) => markSeen(id), []);

  if (!loading && reels.length === 0) {
    return (
      <div className="px-4 py-12 text-center">
        <p className="text-[15px] text-[var(--t-sub,#9C9CA6)]">
          {category ? "Энэ ангилалд reel алга байна." : "Reel алга байна — эхнийхийг нь чи нийтэл."}
        </p>
        <Link
          href="/posts/new"
          className="press mt-5 inline-flex h-11 items-center rounded-[4px] bg-[#2E29FF] px-6 text-[15px] font-bold text-white transition hover:bg-[#1F1AD9]"
        >
          Reel нийтлэх
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {reels.map((r) => (
        <ReelItem key={r._id} reel={r} uid={uid} onSeen={onSeen} />
      ))}
      <div ref={sentinel} />
      {loading && (
        <div className="flex justify-center py-6">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#2E29FF]" />
        </div>
      )}
    </div>
  );
}
