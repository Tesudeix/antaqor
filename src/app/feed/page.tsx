"use client";

// ─── Community feed — гурван баганат dashboard. ───
// Зүүн: profile/streak/7 хоног. Гол: composer + tag tabs + post stream.
// Баруун: өнөөдрийн mission, мэдээ, лидерборд. Guests resolve to / .

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PostCard from "@/components/PostCard";
import FeedProfileRail from "@/components/FeedProfileRail";
import FeedDiscoveryRail from "@/components/FeedDiscoveryRail";
import { useMembership } from "@/lib/useMembership";

interface Post {
  _id: string;
  content: string;
  image?: string;
  visibility?: string;
  category?: string;
  likes: string[];
  reactions?: Record<string, string[]>;
  commentsCount: number;
  viewsCount?: number;
  createdAt: string;
  author: {
    _id: string;
    name: string;
    avatar?: string;
  } | null;
}

interface FeedCategory {
  slug: string;
  name: string;
  color: string;
  iconPath: string;
}

// "all" | "reels" | any DB category slug — tabs are DB-driven.
type CategoryFilter = string;

export default function FeedPage() {
  const router = useRouter();
  const { loading: memberLoading, isLoggedIn, isMember, isAdmin } = useMembership();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [feedCats, setFeedCats] = useState<FeedCategory[]>([]);

  // Category tabs come from the same admin-ordered source as the composer.
  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.categories)) setFeedCats(d.categories);
      })
      .catch(() => {});
  }, []);

  const fetchPosts = async (pageNum: number, cat?: CategoryFilter) => {
    const activeCat = cat ?? category;
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: "20" });
      if (activeCat !== "all") params.set("category", activeCat);
      const res = await fetch(`/api/posts?${params}`);
      const data = await res.json();
      if (res.ok) {
        const safePosts = (data.posts || []).filter((p: Post) => p.author !== null);
        setPosts((prev) => (pageNum === 1 ? safePosts : [...prev, ...safePosts]));
        // Seen тоолуур — session-д пост тус бүрийг нэг л удаа тоолуулна.
        try {
          const seen = new Set<string>(JSON.parse(sessionStorage.getItem("seenPosts") || "[]"));
          const fresh = safePosts.map((p: Post) => p._id).filter((id: string) => !seen.has(id));
          if (fresh.length > 0) {
            fresh.forEach((id: string) => seen.add(id));
            sessionStorage.setItem("seenPosts", JSON.stringify(Array.from(seen)));
            void fetch("/api/posts/seen", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ids: fresh }),
            });
          }
        } catch {
          /* sessionStorage байхгүй орчинд алгасна */
        }
        setHasMore(pageNum < data.pagination.pages);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (memberLoading) return;
    if (isLoggedIn && (isMember || isAdmin)) {
      setPage(1);
      setLoading(true);
      fetchPosts(1, category);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberLoading, isLoggedIn, isMember, isAdmin, category]);

  const switchCategory = (cat: CategoryFilter) => {
    setCategory(cat);
    setPosts([]);
    setPage(1);
    setHasMore(true);
    setLoading(true);
  };

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPosts(next);
  };

  const handleDelete = (id: string) => {
    setPosts((prev) => prev.filter((p) => p._id !== id));
  };

  if (memberLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-2 w-2 animate-pulse bg-[#1080CA]" />
      </div>
    );
  }

  if (!isLoggedIn) {
    router.replace("/");
    return null;
  }

  // Feed нь гишүүдийн орон зай — үнэгүй хэрэглэгч шууд төлбөр рүү.
  if (!isMember && !isAdmin) {
    router.replace("/pricing");
    return null;
  }

  const tabs: { key: CategoryFilter; label: string }[] = [
    { key: "all", label: "Бүгд" },
    { key: "reels", label: "Reels" },
    ...feedCats.map((c) => ({
      key: c.slug,
      label: c.name.charAt(0).toUpperCase() + c.name.slice(1),
    })),
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl gap-6 px-4 pb-24 pt-6 md:px-8 lg:px-8 lg:pb-12">
      <FeedProfileRail />

      <div className="w-full max-w-2xl mx-auto lg:mx-0 lg:max-w-none lg:flex-1 lg:min-w-0">
        {/* Header */}
        <div className="mb-5 flex items-end justify-between gap-3">
          <div>
            <div className="chrome mb-2 flex items-center gap-2 text-[9px] font-bold">
              <span className="text-[#1080CA]">[FEED]</span>
              <span className="text-[#1080CA]">/////</span>
              <span className="text-[#84848C]">COMMUNITY</span>
            </div>
            <h1 className="headline text-[24px]">Community feed</h1>
          </div>
          <Link
            href="/posts/new"
            className="inline-flex h-11 shrink-0 items-center rounded-[4px] bg-[#1080CA] px-5 text-[12px] font-bold uppercase tracking-[0.01em] text-[#0E0E10] transition hover:bg-[#4FA8E8]"
          >
            + Пост
          </Link>
        </div>

        {/* Composer — "SHIP" launcher, нэг товшилтоор /posts/new руу */}
        <Link
          href="/posts/new"
          className="mb-4 flex h-12 items-center gap-3 rounded-[4px] border border-[#2E2E33] bg-[#1E1E21] px-4 text-[13px] text-[#84848C] transition hover:border-[#1080CA] hover:text-[#B4B4BA]"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#161618] text-[11px] font-bold text-[#1080CA]">
            +
          </span>
          Юу бүтээв? Ship хий…
          <span className="chrome ml-auto shrink-0 text-[9px] font-bold text-[#1080CA]">SHIP ››</span>
        </Link>

        {/* Category tags */}
        <div className="scrollbar-hide -mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <div className="flex items-center gap-2 pb-3">
            {tabs.map((tab) => {
              const active = category === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => switchCategory(tab.key)}
                  className={`chrome shrink-0 rounded-[4px] px-3.5 py-2 text-[9px] font-bold transition ${
                    active
                      ? "bg-[#1080CA] text-[#161618]"
                      : "border border-[#2E2E33] text-[#84848C] hover:border-[#3A3A40] hover:text-[#FFFFFF]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stream */}
        {loading ? (
          <div className="mt-4 space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 animate-pulse rounded-[4px] bg-[#1E1E21]" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="relative mt-4 rounded-[4px] border border-[#2E2E33] bg-[#1E1E21] p-10 text-center">
            {["left-0 top-0 border-l-2 border-t-2", "right-0 top-0 border-r-2 border-t-2", "bottom-0 left-0 border-b-2 border-l-2", "bottom-0 right-0 border-b-2 border-r-2"].map((c, i) => (
              <span key={i} className={`pointer-events-none absolute h-3 w-3 border-[#1080CA] ${c}`} />
            ))}
            <p className="text-[14px] text-[#B4B4BA]">Энэ ангилалд пост алга — эхнийхийг нь чи бич.</p>
            <Link
              href="/posts/new"
              className="mt-5 inline-flex h-12 items-center rounded-[4px] bg-[#1080CA] px-7 text-[13px] font-bold uppercase text-[#0E0E10] transition hover:bg-[#4FA8E8]"
            >
              Пост үүсгэх &gt;
            </Link>
          </div>
        ) : (
          <>
            {/* Threads-style full-width stream — hairline dividers, no boxes */}
            <div className="-mx-4 mt-2 border-t border-[#2E2E33] sm:mx-0">
              {posts.map((post) => (
                <PostCard key={post._id} post={post} onDelete={handleDelete} />
              ))}
            </div>
            {hasMore && (
              <button
                onClick={loadMore}
                className="chrome mt-4 flex h-12 w-full items-center justify-center rounded-[4px] border border-[#2E2E33] text-[10px] font-bold text-[#84848C] transition hover:border-[#1080CA] hover:text-[#1080CA]"
              >
                ЦААШ ҮЗЭХ ▼
              </button>
            )}
          </>
        )}
      </div>

      <FeedDiscoveryRail />
    </div>
  );
}
