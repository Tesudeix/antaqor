"use client";

import { useEffect, useRef, useState } from "react";

interface IGPost {
  _id: string;
  igId: string;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REEL";
  mediaUrl: string;
  thumbnailUrl?: string;
  permalink: string;
  caption?: string;
  timestamp: string;
  views?: number;
  likes?: number;
}

function fmtCount(n?: number) {
  if (!n) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}м`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}ц`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}ө`;
  const weeks = Math.floor(days / 7);
  return `${weeks}д`;
}

const IG_GLYPH = (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export default function InstagramReels() {
  const [posts, setPosts] = useState<IGPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/instagram?limit=16")
      .then((r) => r.json())
      .then((d) => {
        if (d.posts) setPosts(d.posts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const scrollRail = (dir: 1 | -1) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  if (loading) {
    return (
      <div className="py-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-4 w-4 animate-pulse rounded-full bg-[rgba(255,255,255,0.08)]" />
          <div className="h-3 w-16 animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
        </div>
        <div className="flex gap-2.5 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="aspect-[9/16] w-[150px] shrink-0 animate-pulse rounded-none bg-[rgba(255,255,255,0.05)]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (posts.length === 0) return null;

  const reels = posts.filter(
    (p) => p.mediaType === "VIDEO" || p.mediaType === "REEL"
  );
  const images = posts.filter(
    (p) => p.mediaType === "IMAGE" || p.mediaType === "CAROUSEL_ALBUM"
  );

  return (
    <section className="py-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-none bg-[rgba(16,128,202,0.14)] text-[#4E94D0]">
            {IG_GLYPH}
          </span>
          <div>
            <div className="text-[13px] font-black tracking-wide text-[#F2F2F4]">Сошиал</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#84848C]">
              Edgerunners амьдралаас
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Desktop rail arrows */}
          {reels.length > 3 && (
            <div className="hidden gap-1.5 md:flex">
              <button
                type="button"
                aria-label="Өмнөх"
                onClick={() => scrollRail(-1)}
                className="flex h-8 w-8 items-center justify-center rounded-none border border-[rgba(255,255,255,0.10)] text-[#B4B4BA] transition hover:border-[rgba(16,128,202,0.5)] hover:text-[#F2F2F4]"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button
                type="button"
                aria-label="Дараах"
                onClick={() => scrollRail(1)}
                className="flex h-8 w-8 items-center justify-center rounded-none border border-[rgba(255,255,255,0.10)] text-[#B4B4BA] transition hover:border-[rgba(16,128,202,0.5)] hover:text-[#F2F2F4]"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          )}
          <a
            href="https://www.instagram.com/tesudei"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-none border border-[rgba(16,128,202,0.35)] bg-[rgba(16,128,202,0.10)] px-3 py-1.5 text-[11px] font-bold text-[#4E94D0] transition hover:bg-[rgba(16,128,202,0.2)] hover:text-[#F2F2F4]"
          >
            @tesudei
          </a>
        </div>
      </div>

      {/* Reels rail — snap carousel, hover/tap to preview */}
      {reels.length > 0 && (
        <div
          ref={railRef}
          className="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-2"
          style={{ scrollbarWidth: "none" }}
        >
          {reels.map((reel) => (
            <a
              key={reel._id}
              href={reel.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-[9/16] w-[150px] shrink-0 snap-start overflow-hidden rounded-none border border-[rgba(255,255,255,0.08)] bg-[#1E1E21] transition hover:-translate-y-0.5 hover:border-[rgba(16,128,202,0.45)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.45)] active:scale-[0.97] sm:w-[170px]"
              onMouseEnter={() => setActiveVideo(reel._id)}
              onMouseLeave={() => setActiveVideo(null)}
            >
              {activeVideo === reel._id && reel.mediaUrl ? (
                <video
                  src={reel.mediaUrl}
                  className="h-full w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                <img
                  src={reel.thumbnailUrl || reel.mediaUrl}
                  alt={reel.caption?.slice(0, 50) || "Reel"}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
              {/* Play affordance */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 transition group-hover:opacity-100">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(16,128,202,0.92)] shadow-[0_0_18px_rgba(16,128,202,0.5)]">
                  <svg className="ml-0.5 h-4 w-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
              {/* Reel badge */}
              <div className="absolute right-2 top-2 rounded-none bg-black/45 p-1 backdrop-blur-sm">
                <svg className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <rect x="2" y="4" width="20" height="16" rx="3" />
                  <path d="M2 9h20M9.5 4l3 5M15.5 4l3 5M10.5 13.5l4 2.5-4 2.5v-5z" />
                </svg>
              </div>
              {/* Caption + views + time */}
              <div className="absolute bottom-0 left-0 right-0 p-2.5">
                {reel.caption && (
                  <p className="mb-1 line-clamp-2 text-[10px] font-medium leading-tight text-[#F2F2F4]">
                    {reel.caption.slice(0, 70)}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  {fmtCount(reel.views) && (
                    <span className="flex items-center gap-1 text-[9px] font-black text-[#F2F2F4]">
                      <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                      {fmtCount(reel.views)}
                    </span>
                  )}
                  {fmtCount(reel.likes) && (
                    <span className="flex items-center gap-1 text-[9px] font-bold text-[#B4B4BA]">
                      <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                      {fmtCount(reel.likes)}
                    </span>
                  )}
                  <span className="ml-auto text-[9px] font-bold text-[#B4B4BA]">
                    {timeAgo(reel.timestamp)}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Image posts grid */}
      {images.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {images.slice(0, 6).map((post) => (
            <a
              key={post._id}
              href={post.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square overflow-hidden rounded-none border border-[rgba(255,255,255,0.06)] bg-[#1E1E21] transition hover:border-[rgba(16,128,202,0.4)] active:scale-[0.97]"
            >
              <img
                src={post.mediaUrl}
                alt={post.caption?.slice(0, 50) || "Post"}
                loading="lazy"
                className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
              />
              <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/25" />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}
