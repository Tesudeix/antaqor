"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PostCard from "@/components/PostCard";

// "all" | "reels" | any DB category slug. Tabs are DB-driven (same ordered
// /api/categories source as the composer + members' feed).
type CatKey = string;

interface Tab { key: CatKey; label: string; icon: string }

const BASE_TABS: Tab[] = [
  { key: "all", label: "Бүгд", icon: "M3.75 6h16.5M3.75 12h16.5m-16.5 6h16.5" },
  { key: "reels", label: "Reels", icon: "M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" },
];
const FALLBACK_ICON = "M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z";

interface FeedPost {
  _id: string;
  content: string;
  category?: string;
  image?: string;
  images?: string[];
  video?: string;
  likes: string[];
  reactions?: Record<string, string[]>;
  commentsCount: number;
  createdAt: string;
  author: { _id: string; name: string; avatar?: string; level?: number } | null;
}

export default function CommunityFeed() {
  const [active, setActive] = useState<CatKey>("all");
  const [tabs, setTabs] = useState<Tab[]>(BASE_TABS);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/categories")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.categories) && d.categories.length) {
          const dyn: Tab[] = d.categories
            .filter((c: { slug: string }) => c.slug !== "пост")
            .map((c: { slug: string; name: string; iconPath?: string }) => ({
              key: c.slug,
              label: c.name.charAt(0).toUpperCase() + c.name.slice(1),
              icon: c.iconPath || FALLBACK_ICON,
            }));
          setTabs([...BASE_TABS, ...dyn]);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "8", visibility: "free" });
    if (active !== "all") params.set("category", active);
    fetch(`/api/posts?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => setPosts((d.posts || []).filter((p: FeedPost) => p.author !== null)))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [active]);

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="h-[2px] w-4 bg-[#2E29FF]" />
        <span className="text-[12px] font-bold tracking-[0.1em] text-[#0E1726]">ФИД</span>
      </div>

      {/* Category nav with icons — identical to the members' connected feed */}
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-1.5 pb-1">
          {tabs.map((tab) => {
            const on = active === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActive(tab.key)}
                className="group shrink-0 inline-flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-[12px] font-semibold transition-all duration-200"
                style={{ background: on ? "#2E29FF" : "rgba(15,23,38,0.04)", color: on ? "#FFFFFF" : "#30333F" }}
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-2 w-2 animate-pulse rounded-[4px] bg-[#2E29FF]" />
        </div>
      ) : posts.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-[14px] text-[#E2E4E8]">Одоогоор нийтлэл байхгүй</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <PostCard key={p._id} post={p} />
          ))}
          <Link
            href="/clan"
            className="flex w-full items-center justify-center gap-2 rounded-[4px] border border-[rgba(15,23,38,0.1)] bg-[#F6F8FB] py-3 text-[12px] font-bold text-[#E2E4E8] transition hover:border-[rgba(46,41,255,0.4)] hover:text-[#2E29FF]"
          >
            Бүх постыг үзэхийн тулд Хүрээлэлд нэгдэх →
          </Link>
        </div>
      )}
    </section>
  );
}
