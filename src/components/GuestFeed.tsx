"use client";

import { useCallback, useEffect, useState } from "react";
import PostCard from "@/components/PostCard";
import { openAuth } from "@/components/AuthModal";

/* ─── ЗОЧНЫ УРСГАЛ (2026-10-06) ───────────────────────────────────────────
   Нэвтрээгүй хүн нүүрэн дээр жинхэнэ постуудыг УНШИНА — юу болж байгааг
   харахгүйгээр бүртгүүлэх шалтгаан байхгүй. `/api/posts` нь зочинд зөвхөн
   нийтийн постыг буцаадаг (гишүүдийн пост серверт шүүгдэнэ).

   ХАРИЛЦАХ нь нэвтрэлт шаардана: карт доторх ямар ч товч, холбоос,
   талбар (лайк, сэтгэгдэл, профайл, хуваалцах) дарвал CAPTURE шатанд
   барьж, нэвтрэх цонх нээнэ. Капчур нь PostCard-ийн өөрийн handler-аас
   ӨМНӨ ажилладаг тул 401 хүлээж алдаа харуулах зүйл үүсэхгүй. Видео
   тоглуулагч (<video controls>) нь товч биш тул тоглоно. */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPost = any;

export default function GuestFeed() {
  const [posts, setPosts] = useState<AnyPost[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/posts?page=${p}&limit=10`);
      const d = await r.json();
      if (!r.ok) return;
      const list = (d.posts || []).filter((x: AnyPost) => x.author !== null);
      setPosts((prev) => (p === 1 ? list : [...prev, ...list]));
      setHasMore(p < (d.pagination?.pages || 1));
      setPage(p);
    } catch {
      /* сүлжээ — зочинд алдаа харуулах шаардлагагүй */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  const gate = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest("button, a, input, textarea, select, [role='button']");
    if (!el) return;
    e.preventDefault();
    e.stopPropagation();
    openAuth("signin");
  };

  return (
    <section className="mx-auto mt-10 w-full max-w-[760px]" aria-label="Урсгал">
      <h2 className="mb-3 px-4 text-[20px] font-extrabold tracking-[-0.01em] text-[var(--nav-fg-strong)] sm:px-1">
        Урсгал
      </h2>

      {/* "Юу бүтээв?" — зочинд бичих мөр, дарвал нэвтрэлт. */}
      <button
        type="button"
        onClick={() => openAuth("signup")}
        className="press mb-4 flex w-full items-center gap-3 px-4 text-left sm:px-1"
      >
        <span className="h-10 w-10 shrink-0 rounded-full" style={{ background: "var(--nav-hover-bg, #FFFFFF)" }} />
        <span className="flex-1 text-[15px] text-[var(--t-sub,#9C9CA6)]">Юу бүтээв? Нэвтэрч бичээрэй…</span>
        <span className="rounded-[4px] bg-[#2E29FF] px-3 py-1.5 text-[12.5px] font-bold text-white">Нэвтрэх</span>
      </button>

      <div className="flex flex-col gap-4" onClickCapture={gate}>
        {posts.map((post) => (
          <PostCard key={post._id} post={post} variant="boxed" />
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#2E29FF]" />
        </div>
      )}
      {!loading && hasMore && (
        <div className="flex justify-center py-6">
          <button
            type="button"
            onClick={() => load(page + 1)}
            className="press h-10 rounded-[4px] px-5 text-[14px] font-semibold text-[var(--nav-fg-strong)]"
            style={{ background: "var(--nav-hover-bg, #FFFFFF)" }}
          >
            Цааш үзэх
          </button>
        </div>
      )}
    </section>
  );
}
