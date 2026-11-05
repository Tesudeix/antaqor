"use client";

import { useEffect, useRef, useState } from "react";

interface ThreadsPost {
  id: string;
  text: string;
  permalink: string;
  timestamp: string;
  mediaType: string;
  mediaUrl?: string;
  thumbnailUrl?: string;
}

function timeAgo(dateStr: string) {
  if (!dateStr) return "";
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

const THREADS_GLYPH = (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M16.5 11.6c-.2-2.9-1.8-4.6-4.4-4.7-1.6 0-2.9.7-3.7 2M12 21c-3.3 0-5.4-1.1-6.7-3-1.2-1.7-1.8-4-1.8-6s.6-4.3 1.8-6C6.6 4.1 8.7 3 12 3s5.4 1.1 6.7 3c.6.9 1.1 1.9 1.3 3M11.6 17c-1.4.1-2.6-.5-2.7-1.7-.1-1.1 1-1.9 2.5-2 2.6-.1 4.2 1.1 4.2 3.1 0 1.8-1.4 3.2-3.6 3.4" />
  </svg>
);

export default function ThreadsFeed() {
  const [posts, setPosts] = useState<ThreadsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const railRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/threads/feed")
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
          <div className="h-4 w-4 animate-pulse rounded-[4px] bg-[rgba(255,255,255,0.08)]" />
          <div className="h-3 w-16 animate-pulse rounded bg-[rgba(255,255,255,0.06)]" />
        </div>
        <div className="flex gap-2.5 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-[150px] w-[240px] shrink-0 animate-pulse rounded-[4px] bg-[rgba(255,255,255,0.05)]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (posts.length === 0) return null;

  return (
    <section className="py-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-[rgba(46,41,255,0.14)] text-[#4C47FF]">
            {THREADS_GLYPH}
          </span>
          <div>
            <div className="text-[13px] font-black tracking-wide text-[#F2F2F4]">Threads</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#E2E4E8]">
              Шууд яриа · бодол · update
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {posts.length > 2 && (
            <div className="hidden gap-1.5 md:flex">
              <button
                type="button"
                aria-label="Өмнөх"
                onClick={() => scrollRail(-1)}
                className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-[rgba(255,255,255,0.10)] text-[#E2E4E8] transition hover:border-[rgba(46,41,255,0.5)] hover:text-[#F2F2F4]"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button
                type="button"
                aria-label="Дараах"
                onClick={() => scrollRail(1)}
                className="flex h-8 w-8 items-center justify-center rounded-[4px] border border-[rgba(255,255,255,0.10)] text-[#E2E4E8] transition hover:border-[rgba(46,41,255,0.5)] hover:text-[#F2F2F4]"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          )}
          <a
            href="https://www.threads.net/@tesudei"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[4px] border border-[rgba(46,41,255,0.35)] bg-[rgba(46,41,255,0.10)] px-3 py-1.5 text-[11px] font-bold text-[#4C47FF] transition hover:bg-[rgba(46,41,255,0.2)] hover:text-[#F2F2F4]"
          >
            antaqor.com
          </a>
        </div>
      </div>

      {/* Thread cards rail */}
      <div
        ref={railRef}
        className="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        {posts.map((post) => (
          <a
            key={post.id}
            href={post.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex w-[240px] shrink-0 snap-start flex-col rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] p-3.5 transition hover:-translate-y-0.5 hover:border-[rgba(46,41,255,0.45)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.45)] active:scale-[0.98] sm:w-[260px]"
          >
            {/* Card head */}
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#F2F2F4]">
                <span className="text-[#E2E4E8]">{THREADS_GLYPH}</span>
                antaqor.com
              </span>
              <span className="text-[10px] font-semibold text-[#E2E4E8]">
                {timeAgo(post.timestamp)}
              </span>
            </div>

            {/* Text */}
            {post.text && (
              <p className={`whitespace-pre-line text-[12px] leading-relaxed text-[#E2E4E8] ${post.mediaUrl ? "line-clamp-3" : "line-clamp-6"}`}>
                {post.text}
              </p>
            )}

            {/* Media */}
            {(post.thumbnailUrl || (post.mediaUrl && post.mediaType !== "TEXT")) && (
              <div className="mt-2.5 overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.06)]">
                <img
                  src={post.thumbnailUrl || post.mediaUrl}
                  alt=""
                  loading="lazy"
                  className="aspect-video w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                />
              </div>
            )}

            {/* Foot */}
            <div className="mt-auto flex items-center gap-1 pt-2.5 text-[10px] font-bold text-[#4C47FF] opacity-0 transition group-hover:opacity-100">
              Үзэх
              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8" /></svg>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
