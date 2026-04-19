"use client";

import { useEffect, useState } from "react";

interface IGPost {
  _id: string;
  igId: string;
  mediaType: "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM" | "REEL";
  mediaUrl: string;
  thumbnailUrl?: string;
  permalink: string;
  caption?: string;
  timestamp: string;
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

export default function InstagramReels() {
  const [posts, setPosts] = useState<IGPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/instagram?limit=12")
      .then((r) => r.json())
      .then((d) => {
        if (d.posts) setPosts(d.posts);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <div className="h-4 w-4 animate-pulse rounded-full bg-[rgba(0,0,0,0.08)]" />
          <div className="h-3 w-16 animate-pulse rounded bg-[rgba(0,0,0,0.06)]" />
        </div>
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="aspect-[9/16] w-[120px] shrink-0 animate-pulse rounded-[4px] bg-[rgba(0,0,0,0.06)]"
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
    <div className="py-4">
      {/* Reels row */}
      {reels.length > 0 && (
        <div className="mb-4">
          <div className="mb-3 flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4 text-[#F8F8F6]"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
              <span className="text-[12px] font-black tracking-wide text-[#F8F8F6]">
                Instagram Reels
              </span>
            </div>
            <a
              href="https://www.instagram.com/antaqor"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-bold text-[rgba(0,0,0,0.3)] transition hover:text-[#F8F8F6]"
            >
              @antaqor
            </a>
          </div>
          <div className="flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide" style={{ scrollbarWidth: "none" }}>
            {reels.map((reel) => (
              <a
                key={reel._id}
                href={reel.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative aspect-[9/16] w-[120px] shrink-0 overflow-hidden rounded-[4px] bg-[#F8F8F6] shadow-[0_2px_8px_rgba(0,0,0,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(0,0,0,0.2)] active:scale-[0.97]"
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
                    className="h-full w-full object-cover"
                  />
                )}
                {/* Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                {/* Play icon */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 transition group-hover:opacity-100">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(239,44,88,0.9)]">
                    <svg className="ml-0.5 h-3.5 w-3.5 text-[#F8F8F6]" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
                {/* Reel badge */}
                <div className="absolute right-1.5 top-1.5">
                  <svg className="h-3.5 w-3.5 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M21 3H3a2 2 0 00-2 2v14a2 2 0 002 2h18a2 2 0 002-2V5a2 2 0 00-2-2zm-9 13l-5-3 5-3v6z" />
                  </svg>
                </div>
                {/* Caption + time */}
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  {reel.caption && (
                    <p className="mb-1 line-clamp-2 text-[9px] leading-tight text-[rgba(255,255,255,0.8)]">
                      {reel.caption.slice(0, 60)}
                    </p>
                  )}
                  <span className="text-[8px] font-bold text-[rgba(255,255,255,0.4)]">
                    {timeAgo(reel.timestamp)}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Image posts grid */}
      {images.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2 px-4">
            <svg
              className="h-4 w-4 text-[#F8F8F6]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="text-[12px] font-black tracking-wide text-[#F8F8F6]">
              Постууд
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1 px-4">
            {images.slice(0, 9).map((post) => (
              <a
                key={post._id}
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative aspect-square overflow-hidden rounded-[4px] bg-[#F8F8F6] shadow-[0_1px_4px_rgba(0,0,0,0.08)] transition hover:scale-[1.02] active:scale-[0.97]"
              >
                <img
                  src={post.mediaUrl}
                  alt={post.caption?.slice(0, 50) || "Post"}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
