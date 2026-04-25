"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import PostCard from "@/components/PostCard";
import Link from "next/link";
import { motion } from "framer-motion";

import { useMembership } from "@/lib/useMembership";
import HeroSlider from "@/components/HeroSlider";
import Testimonials from "@/components/Testimonials";

interface Post {
  _id: string;
  content: string;
  image?: string;
  visibility?: string;
  category?: string;
  likes: string[];
  reactions?: Record<string, string[]>;
  commentsCount: number;
  createdAt: string;
  author: {
    _id: string;
    name: string;
    avatar?: string;
  } | null;
}

interface LeaderUser {
  _id: string;
  name: string;
  avatar?: string;
  xp: number;
  level: number;
}

interface StatsData {
  totalUsers: number;
  paidMembers: number;
  goal: number;
  progress: number;
}

type CategoryFilter = "all" | "мэдээлэл" | "ялалт" | "промт" | "бүтээл" | "танилцуулга";

// ─── Stat counter with animation ───
function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) return;
    const duration = 1200;
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display.toLocaleString()}{suffix}</>;
}

// ─── Live Stats Bar ───
function StatsBar() {
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => { if (d.totalUsers) setStats(d); })
      .catch(() => {});
  }, []);

  if (!stats) return null;

  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: "Нийт гишүүд", value: stats.totalUsers, icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
        { label: "Идэвхтэй", value: stats.paidMembers, icon: "M13 10V3L4 14h7v7l9-11h-7z" },
        { label: "Зорилго", value: stats.goal, icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" },
      ].map((s) => (
        <div key={s.label} className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] p-4 text-center">
          <svg className="mx-auto mb-2 h-5 w-5 text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={s.icon} />
          </svg>
          <div className="text-[22px] font-bold text-[#E8E8E8]">
            <AnimatedNumber value={s.value} />
          </div>
          <div className="mt-0.5 text-[10px] font-medium text-[#666666]">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Latest AI News (public, editorial) ───
interface NewsItem {
  _id: string;
  title: string;
  slug: string;
  excerpt: string;
  coverImage: string;
  category: "AI" | "LLM" | "Agents" | "Research" | "Бизнес" | "Tool" | "Монгол";
  tags: string[];
  authorName: string;
  readingMinutes: number;
  publishedAt: string;
  views: number;
}

const NEWS_CATEGORY_COLORS: Record<NewsItem["category"], string> = {
  AI: "#EF2C58",
  LLM: "#A855F7",
  Agents: "#22C55E",
  Research: "#3B82F6",
  "Бизнес": "#F59E0B",
  Tool: "#06B6D4",
  "Монгол": "#EC4899",
};

function newsRelative(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "сая";
  if (m < 60) return `${m}мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}ц`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} өдөр`;
  return new Date(iso).toLocaleDateString("mn-MN", { month: "short", day: "numeric" });
}

function LatestNews() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/news?limit=4")
      .then((r) => r.json())
      .then((d) => setItems(d.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div>
        <div className="mb-3 flex items-center gap-2">
          <div className="h-[2px] w-4 bg-[#EF2C58]" />
          <span className="text-[12px] font-bold tracking-[0.1em] text-[#E8E8E8]">AI МЭДЭЭ</span>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F0F]">
              <div className="aspect-[16/9] animate-pulse bg-[#181818]" />
              <div className="space-y-2 p-3">
                <div className="h-3 w-3/4 animate-pulse rounded bg-[#181818]" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-[#181818]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  const [featured, ...rest] = items;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-[2px] w-4 bg-[#EF2C58]" />
          <span className="text-[12px] font-bold tracking-[0.1em] text-[#E8E8E8]">AI МЭДЭЭ</span>
          <span className="flex items-center gap-1 rounded-full bg-[rgba(34,197,94,0.1)] px-1.5 py-0.5 text-[9px] font-bold text-[#22C55E]">
            <span className="h-1 w-1 animate-pulse rounded-full bg-[#22C55E]" />
            LIVE
          </span>
        </div>
        <Link href="/news" className="text-[11px] font-bold text-[#666] transition hover:text-[#EF2C58]">
          Бүх мэдээ →
        </Link>
      </div>

      {/* Featured hero */}
      <Link
        href={`/news/${featured.slug}`}
        className="group relative block overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0D0D0D] transition hover:border-[rgba(239,44,88,0.25)]"
      >
        <div className="relative aspect-[16/9] bg-[#1A1A1A]">
          {featured.coverImage ? (
            <img
              src={featured.coverImage}
              alt={featured.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#181818] to-[#0D0D0D]">
              <span className="text-[10px] tracking-[0.3em] text-[#333]">ANTAQOR · AI</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
            <span
              className="rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
              style={{ background: `${NEWS_CATEGORY_COLORS[featured.category]}F2`, color: "#FFF" }}
            >
              {featured.category}
            </span>
            <span className="rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-bold text-white/80 backdrop-blur">
              {featured.readingMinutes} мин
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="line-clamp-2 text-[16px] font-bold leading-tight text-white md:text-[18px]">
              {featured.title}
            </h3>
            {featured.excerpt && (
              <p className="mt-1.5 line-clamp-2 text-[11px] text-white/70">{featured.excerpt}</p>
            )}
            <div className="mt-2 flex items-center gap-2 text-[10px] text-white/60">
              <span className="font-semibold text-white/80">{featured.authorName}</span>
              <span className="text-white/30">·</span>
              <span>{newsRelative(featured.publishedAt)}</span>
            </div>
          </div>
        </div>
      </Link>

      {/* Sub-cards */}
      {rest.length > 0 && (
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {rest.slice(0, 3).map((n) => {
            const color = NEWS_CATEGORY_COLORS[n.category];
            return (
              <Link
                key={n._id}
                href={`/news/${n.slug}`}
                className="group flex gap-3 rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F0F] p-2 transition hover:border-[rgba(239,44,88,0.25)] sm:flex-col sm:gap-0 sm:p-0"
              >
                <div className="relative h-[68px] w-[96px] shrink-0 overflow-hidden rounded-[4px] bg-[#1A1A1A] sm:h-auto sm:w-full sm:aspect-[16/10] sm:rounded-b-none">
                  {n.coverImage ? (
                    <img
                      src={n.coverImage}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1A1A1A] to-[#0D0D0D]">
                      <span className="text-[8px] tracking-[0.3em] text-[#2A2A2A]">ANT.</span>
                    </div>
                  )}
                  <div className="absolute inset-0 hidden bg-gradient-to-t from-black/40 via-transparent to-transparent sm:block" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-1 sm:p-3">
                  <div>
                    <div className="mb-1 flex items-center gap-1.5">
                      <span className="text-[9px] font-black uppercase tracking-wider" style={{ color }}>
                        {n.category}
                      </span>
                      <span className="text-[#2A2A2A]">·</span>
                      <span className="text-[9px] text-[#555]">{newsRelative(n.publishedAt)}</span>
                    </div>
                    <h4 className="line-clamp-2 text-[12px] font-bold leading-snug text-[#E8E8E8] transition-colors group-hover:text-white">
                      {n.title}
                    </h4>
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-[#555]">
                    <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {n.readingMinutes} мин
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      <Link
        href="/news"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F0F] py-2.5 text-[12px] font-bold text-[#888] transition hover:border-[rgba(239,44,88,0.3)] hover:text-[#EF2C58]"
      >
        AI мэдээний блог үзэх
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

// ─── Latest Танилцуулга Posts ───
function LatestTanilts() {
  const [posts, setPosts] = useState<{ _id: string; content: string; image?: string; author: { name: string; avatar?: string } | null; createdAt: string }[]>([]);

  useEffect(() => {
    fetch("/api/posts?category=танилцуулга&limit=3&visibility=free")
      .then((r) => r.json())
      .then((d) => {
        if (d.posts) setPosts(d.posts.filter((p: { author: unknown }) => p.author !== null).slice(0, 3));
      })
      .catch(() => {});
  }, []);

  if (posts.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-[2px] w-4 bg-[#A855F7]" />
          <span className="text-[12px] font-bold tracking-[0.1em] text-[#E8E8E8]">ТАНИЛЦУУЛГА</span>
        </div>
        <Link href="/auth/signup" className="text-[11px] font-bold text-[#666666] transition hover:text-[#EF2C58]">
          Бүгдийг үзэх →
        </Link>
      </div>
      <div className="space-y-2">
        {posts.map((post) => (
          <Link
            key={post._id}
            href="/auth/signup"
            className="group block rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] overflow-hidden transition hover:border-[rgba(239,44,88,0.3)]"
          >
            {post.image && (
              <div className="relative aspect-[16/9] bg-[#1A1A1A]">
                <img
                  src={post.image}
                  alt=""
                  loading="eager"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    const img = e.currentTarget;
                    if (!img.dataset.retried) {
                      img.dataset.retried = "1";
                      img.src = img.src + (img.src.includes("?") ? "&" : "?") + "t=" + Date.now();
                    } else {
                      img.style.display = "none";
                    }
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent" />
              </div>
            )}
            <div className="p-3">
              <div className="flex items-center gap-2 mb-1.5">
                {post.author?.avatar ? (
                  <img src={post.author.avatar} alt="" className="h-5 w-5 rounded-[4px] object-cover" />
                ) : (
                  <div className="flex h-5 w-5 items-center justify-center rounded-[4px] bg-[rgba(168,85,247,0.15)] text-[8px] font-bold text-[#A855F7]">
                    {post.author?.name?.charAt(0) || "?"}
                  </div>
                )}
                <span className="text-[10px] font-semibold text-[#666]">{post.author?.name}</span>
                <span className="rounded-[4px] bg-[rgba(168,85,247,0.15)] px-1.5 py-0.5 text-[8px] font-bold text-[#A855F7]">ТАНИЛЦУУЛГА</span>
              </div>
              <p className="line-clamp-2 text-[12px] text-[#999]">{post.content}</p>
            </div>
          </Link>
        ))}
      </div>
      <Link
        href="/auth/signup"
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] py-2.5 text-[12px] font-bold text-[#666] transition hover:border-[rgba(239,44,88,0.3)] hover:text-[#EF2C58]"
      >
        Цааш үзэхийн тулд Cyber Empire нэгдэх
        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

// ─── Бүтээлүүд Showcase Gallery ───
function ShowcaseGallery({ guest = false }: { guest?: boolean }) {
  const [posts, setPosts] = useState<{ _id: string; image: string; content: string; author: { name: string; avatar?: string } | null; likes: string[] }[]>([]);

  useEffect(() => {
    fetch("/api/showcase?limit=6")
      .then((r) => r.json())
      .then((d) => {
        if (d.posts) setPosts(d.posts.filter((p: { author: unknown }) => p.author !== null).slice(0, 6));
      })
      .catch(() => {});
  }, []);

  if (posts.length === 0) return null;

  const allHref = guest ? "/auth/signup" : "/";
  const postHref = (id: string) => guest ? "/auth/signup" : `/posts/${id}`;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-[2px] w-4 bg-[#22C55E]" />
          <span className="text-[12px] font-bold tracking-[0.1em] text-[#E8E8E8]">БҮТЭЭЛҮҮД</span>
        </div>
        <Link href={allHref} className="text-[11px] font-bold text-[#666666] transition hover:text-[#EF2C58]">
          Бүгдийг үзэх →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {posts.map((post, idx) => (
          <Link
            key={post._id}
            href={postHref(post._id)}
            className="group relative aspect-square overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A]"
          >
            <img
              src={post.image}
              alt=""
              loading={idx < 2 ? "eager" : "lazy"}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
              onError={(e) => {
                const img = e.currentTarget;
                if (!img.dataset.retried) {
                  img.dataset.retried = "1";
                  img.src = img.src + (img.src.includes("?") ? "&" : "?") + "t=" + Date.now();
                } else {
                  img.style.display = "none";
                }
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-2.5">
              <div className="flex items-center gap-1.5 mb-1">
                {post.author?.avatar ? (
                  <img src={post.author.avatar} alt="" className="h-4 w-4 rounded-[4px] object-cover" />
                ) : (
                  <div className="flex h-4 w-4 items-center justify-center rounded-[4px] bg-[rgba(34,197,94,0.2)] text-[7px] font-bold text-[#22C55E]">
                    {post.author?.name?.charAt(0) || "?"}
                  </div>
                )}
                <span className="text-[9px] font-semibold text-white/80">{post.author?.name}</span>
              </div>
              <p className="line-clamp-1 text-[10px] text-white/60">{post.content}</p>
            </div>
            {post.likes?.length > 0 && (
              <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded-[4px] bg-black/50 px-1.5 py-0.5 text-[9px] font-bold text-white/80 backdrop-blur-sm">
                <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /></svg>
                {post.likes.length}
              </div>
            )}
          </Link>
        ))}
      </div>
      {guest && (
        <Link
          href="/auth/signup"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] py-2.5 text-[12px] font-bold text-[#666] transition hover:border-[rgba(239,44,88,0.3)] hover:text-[#EF2C58]"
        >
          Бүтээлүүд үзэхийн тулд Cyber Empire нэгдэх
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      )}
    </div>
  );
}

// ─── XP Leaderboard ───
function Leaderboard() {
  const [users, setUsers] = useState<LeaderUser[]>([]);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => { if (d.users) setUsers(d.users); })
      .catch(() => {});
  }, []);

  if (users.length === 0) return null;

  const medals = ["#EF2C58", "#C0C0C0", "#CD7F32"];

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <div className="h-[2px] w-4 bg-[#EF2C58]" />
        <span className="text-[12px] font-bold tracking-[0.1em] text-[#E8E8E8]">ТЭРГҮҮЛЭГЧИД</span>
      </div>
      <div className="space-y-1.5">
        {users.slice(0, 5).map((user, i) => (
          <div
            key={user._id}
            className={`flex items-center gap-3 rounded-[4px] px-4 py-3 transition ${
              i === 0
                ? "border border-[rgba(239,44,88,0.2)] bg-[rgba(239,44,88,0.06)]"
                : "border border-[rgba(255,255,255,0.08)] bg-[#141414]"
            }`}
          >
            <div
              className="flex h-6 w-6 items-center justify-center rounded-[4px] text-[11px] font-black"
              style={{
                backgroundColor: i < 3 ? `${medals[i]}20` : "rgba(255,255,255,0.04)",
                color: i < 3 ? medals[i] : "#666666",
              }}
            >
              {i + 1}
            </div>
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="h-8 w-8 rounded-[4px] object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-[4px] bg-[#1A1A1A] text-[11px] font-bold text-[#EF2C58]">
                {user.name.charAt(0)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold text-[#E8E8E8]">{user.name}</div>
              <div className="text-[10px] text-[#666666]">Level {user.level}</div>
            </div>
            <div className="text-right">
              <div className="text-[14px] font-bold text-[#EF2C58]">{user.xp.toLocaleString()}</div>
              <div className="text-[9px] text-[#666666]">XP</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Social Proof Ticker ───
function SocialProof({ stats }: { stats: StatsData | null }) {
  if (!stats || stats.paidMembers === 0) return null;
  return (
    <div className="flex items-center justify-center gap-2 rounded-[4px] border border-[rgba(239,44,88,0.15)] bg-[rgba(239,44,88,0.06)] px-4 py-2.5">
      <span className="h-2 w-2 animate-pulse rounded-[4px] bg-green-400" />
      <span className="text-[12px] text-[#999999]">
        <span className="font-bold text-[#E8E8E8]">{stats.paidMembers}</span> хүн одоо идэвхтэй
      </span>
    </div>
  );
}

// ─── Value Proposition Cards ───
// Icon registry — admin picks a name; SVG path lives here so the visual stays on-brand.
const LANDING_ICON_PATHS: Record<string, string> = {
  ai: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
  money: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  community: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  lightning: "M13 10V3L4 14h7v7l9-11h-7z",
  target: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
  growth: "M13 7h8m0 0v8m0-8l-8 8-4-4-6 6",
  rocket: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
  tool: "M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.121 2.121 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z",
  shield: "M12 2L3 7v6c0 5 4 9 9 10 5-1 9-5 9-10V7l-9-5z",
  spark: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
};

interface LandingCardData {
  _id: string;
  title: string;
  description: string;
  icon: string;
  ctaLabel?: string;
  ctaHref?: string;
}

function ValueProps() {
  const [cards, setCards] = useState<LandingCardData[]>([]);

  useEffect(() => {
    fetch("/api/landing-cards")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.cards)) setCards(d.cards); })
      .catch(() => {});
  }, []);

  if (cards.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <div className="h-[2px] w-4 bg-[#EF2C58]" />
        <span className="text-[12px] font-bold tracking-[0.1em] text-[#E8E8E8]">ЯАГААД ANTAQOR</span>
      </div>
      <div className="space-y-2">
        {cards.map((p, i) => {
          const iconPath = LANDING_ICON_PATHS[p.icon] || LANDING_ICON_PATHS.ai;
          const Inner = (
            <div className="flex items-start gap-3 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] p-4 transition group-hover:border-[rgba(239,44,88,0.3)]">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] bg-[rgba(239,44,88,0.1)]">
                <svg className="h-4.5 w-4.5 text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={iconPath} />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-bold text-[#E8E8E8]">{p.title}</div>
                <div className="mt-0.5 text-[12px] text-[#666666]">{p.description}</div>
                {p.ctaLabel && p.ctaHref && (
                  <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#EF2C58]">
                    {p.ctaLabel}
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          );

          return (
            <motion.div
              key={p._id}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              viewport={{ once: true }}
              className="group"
            >
              {p.ctaHref ? <Link href={p.ctaHref}>{Inner}</Link> : Inner}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Members Preview ───
function MembersPreview({ guest = false }: { guest?: boolean }) {
  const [members, setMembers] = useState<{ _id: string; name: string; avatar?: string; aiLevel?: string }[]>([]);

  useEffect(() => {
    fetch("/api/members?limit=8")
      .then((r) => r.json())
      .then((d) => { if (d.members) setMembers(d.members); })
      .catch(() => {});
  }, []);

  if (members.length === 0) return null;

  const memberHref = (id: string) => guest ? "/auth/signup" : `/profile/${id}`;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-[2px] w-4 bg-[#EF2C58]" />
          <span className="text-[12px] font-bold tracking-[0.1em] text-[#E8E8E8]">ИДЭВХТЭЙ ГИШҮҮД</span>
        </div>
        <Link href="/members" className="text-[11px] font-bold text-[#666666] transition hover:text-[#EF2C58]">
          Бүгдийг үзэх
        </Link>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {members.map((m) => (
          <Link
            key={m._id}
            href={memberHref(m._id)}
            className="flex w-[80px] shrink-0 flex-col items-center gap-1.5 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] p-3 transition hover:border-[rgba(239,44,88,0.3)]"
          >
            {m.avatar ? (
              <img src={m.avatar} alt={m.name} className="h-10 w-10 rounded-[4px] object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-[4px] bg-[rgba(239,44,88,0.1)] text-[14px] font-bold text-[#EF2C58]">
                {m.name.charAt(0)}
              </div>
            )}
            <span className="w-full truncate text-center text-[10px] font-semibold text-[#E8E8E8]">{m.name.split(" ")[0]}</span>
            {m.aiLevel && (
              <span className="rounded-[4px] bg-[#1A1A1A] px-1.5 py-0.5 text-[8px] font-bold text-[#666]">
                {m.aiLevel === "beginner" ? "Эхлэгч" : m.aiLevel === "intermediate" ? "Дунд" : "Ахисан"}
              </span>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Classroom Preview (drives signup intent: show value before paywall) ───
interface CoursePreview {
  _id: string;
  title: string;
  description: string;
  thumbnail: string;
  lessonsCount: number;
  requiredLevel: number;
}

const PREVIEW_TEASERS: { title: string; description: string; emoji: string }[] = [
  { emoji: "🧠", title: "Промпт инженеринг", description: "ChatGPT/Claude-аас 10x илүү гаргах" },
  { emoji: "🤖", title: "AI Agent барих", description: "Бизнесийн процессыг автоматжуулах" },
  { emoji: "💸", title: "AI-аар орлого", description: "Freelance, tool, дижитал бүтээгдэхүүн" },
];

function ClassroomPreview({ guest = false }: { guest?: boolean }) {
  const [courses, setCourses] = useState<CoursePreview[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/classroom/courses")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.courses)) setCourses(d.courses); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return null;

  const hasReal = courses.length > 0;
  const items = hasReal ? courses.slice(0, 4) : [];
  const ctaHref = guest ? "/auth/signup" : "/classroom";

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="h-[2px] w-4 bg-[#EF2C58]" />
          <span className="text-[12px] font-bold tracking-[0.1em] text-[#E8E8E8]">AI ХИЧЭЭЛ</span>
          {hasReal && (
            <span className="rounded-full border border-[rgba(34,197,94,0.3)] bg-[rgba(34,197,94,0.08)] px-1.5 py-0.5 text-[9px] font-black text-[#22C55E]">
              {courses.length} курс
            </span>
          )}
        </div>
        <Link href={ctaHref} className="text-[11px] font-bold text-[#666] transition hover:text-[#EF2C58]">
          {hasReal ? "Бүгдийг үзэх →" : "Эхлэх →"}
        </Link>
      </div>

      {hasReal ? (
        <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
          {items.map((c) => (
            <Link
              key={c._id}
              href={ctaHref}
              className="group flex w-[180px] shrink-0 flex-col overflow-hidden rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#141414] transition hover:border-[rgba(239,44,88,0.3)]"
            >
              <div className="relative aspect-video w-full overflow-hidden bg-[#0A0A0A]">
                {c.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.thumbnail}
                    alt={c.title}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-[28px]">🎓</div>
                )}
                <div className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-[4px] bg-black/70 px-1.5 py-0.5 backdrop-blur">
                  <svg className="h-2.5 w-2.5 text-[#EF2C58]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span className="text-[9px] font-bold text-white">{c.lessonsCount} хичээл</span>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-1 p-2.5">
                <div className="line-clamp-2 text-[12px] font-bold leading-tight text-[#E8E8E8]">
                  {c.title}
                </div>
                {c.description && (
                  <div className="line-clamp-2 text-[10px] leading-tight text-[#666]">
                    {c.description}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : (
        // Coming-soon teaser — keeps energy up while admin builds the catalog
        <div className="rounded-[10px] border border-[rgba(239,44,88,0.18)] bg-gradient-to-br from-[rgba(239,44,88,0.05)] via-[#0E0E0E] to-[#0B0B0B] p-4">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[rgba(239,44,88,0.3)] bg-[rgba(239,44,88,0.08)] px-2 py-0.5 text-[9px] font-black tracking-[0.14em] text-[#EF2C58]">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#EF2C58]" />
            ТУН УДАХГҮЙ
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {PREVIEW_TEASERS.map((t) => (
              <div
                key={t.title}
                className="rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-3"
              >
                <div className="text-[20px] leading-none">{t.emoji}</div>
                <div className="mt-1.5 text-[12px] font-bold text-[#E8E8E8]">{t.title}</div>
                <div className="mt-0.5 text-[10px] leading-tight text-[#666]">{t.description}</div>
              </div>
            ))}
          </div>
          <Link
            href={ctaHref}
            className="mt-3 inline-flex items-center gap-1.5 rounded-[8px] bg-[#EF2C58] px-3.5 py-2 text-[11px] font-black text-white transition hover:bg-[#D4264E]"
          >
            Эхэлсэн үед мэдэгдэх
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Hero Landing (for non-members) ───
function HeroLanding() {
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => { if (d.totalUsers) setStats(d); })
      .catch(() => {});
  }, []);

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <HeroSlider />
      <SocialProof stats={stats} />

      {/* ─── Hero copy — clean Mongolian style, minimal text ─── */}
      <div className="text-center">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-[rgba(34,197,94,0.25)] bg-[rgba(34,197,94,0.08)] px-2.5 py-0.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#22C55E]" />
          <span className="text-[9px] font-bold tracking-[0.14em] text-[#22C55E]">
            МОНГОЛ
            {stats?.paidMembers ? ` · ${stats.paidMembers} ГИШҮҮН` : ""}
          </span>
        </div>

        <h2 className="text-[26px] font-black leading-[1.05] text-[#E8E8E8] md:text-[32px]">
          AI-аар орлого олох<br />
          <span className="text-[#EF2C58]">Монгол community</span>
        </h2>

        <div className="mt-3 inline-flex items-baseline gap-2">
          <span className="text-[20px] font-black text-[#E8E8E8]">₮49,000</span>
          <span className="text-[12px] text-[#666]">/ сар</span>
        </div>
      </div>

      {/* ─── Single CTA + 1 trust line ─── */}
      <div className="space-y-3">
        <Link
          href="/auth/signup"
          className="group relative block w-full overflow-hidden rounded-[10px] bg-[#EF2C58] py-4 text-center text-[15px] font-black text-white shadow-[0_0_32px_rgba(239,44,88,0.3)] transition hover:bg-[#D4264E] hover:shadow-[0_0_48px_rgba(239,44,88,0.5)]"
        >
          <span className="relative z-10 inline-flex items-center gap-2">
            Нэгдэх
            <svg className="h-4 w-4 transition group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </span>
          <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
        </Link>

        <div className="flex flex-wrap items-center justify-center gap-x-2 text-[10px] text-[#666]">
          <span className="inline-flex items-center gap-1">
            <svg className="h-3 w-3 text-[#22C55E]" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            14 хоног буцаалт
          </span>
          <span className="text-[#333]">·</span>
          <span>QPay · SocialPay · Хаан</span>
        </div>

        <p className="text-center text-[11px] text-[#555]">
          Гишүүн үү?{" "}
          <Link href="/auth/signin" className="font-bold text-[#EF2C58] hover:underline">
            Нэвтрэх
          </Link>
        </p>
      </div>

      {/* Social proof — faces + results */}
      <Testimonials
        variant="grid"
        limit={3}
        eyebrow="ГИШҮҮДИЙН ҮР ДҮН"
        heading="Бодит хүмүүс · Бодит AI ажил"
      />

      <StatsBar />
      <ClassroomPreview guest />
      <LatestNews />
      <ValueProps />
      <ShowcaseGallery guest />
      <LatestTanilts />
      <Leaderboard />

      {/* Final CTA — short closer */}
      <div className="rounded-[10px] border border-[rgba(239,44,88,0.22)] bg-gradient-to-br from-[rgba(239,44,88,0.06)] via-[#0D0D0D] to-[#0D0D0D] p-6 text-center">
        <h3 className="text-[18px] font-black leading-tight text-[#E8E8E8]">
          14 хоног туршаад<br />
          <span className="text-[#22C55E]">таалагдахгүй бол буцаана</span>
        </h3>
        <Link
          href="/auth/signup"
          className="mt-4 inline-flex items-center gap-2 rounded-[10px] bg-[#EF2C58] px-7 py-3 text-[13px] font-black text-white shadow-[0_0_28px_rgba(239,44,88,0.3)] transition hover:bg-[#D4264E]"
        >
          Нэгдэх · ₮49,000
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
        </Link>
      </div>

      {/* Members Танилцуулга */}
      <MembersPreview guest />
    </div>
  );
}

// ─── Upgrade banner for logged-in free users ───
function FreeTierBanner({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <Link
      href="/clan?pay=1"
      className="group relative flex items-center gap-3 overflow-hidden rounded-[8px] border border-[rgba(239,44,88,0.25)] bg-gradient-to-r from-[rgba(239,44,88,0.1)] via-[#111] to-[#111] p-3 transition hover:border-[rgba(239,44,88,0.5)]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(239,44,88,0.15)]">
        <svg className="h-5 w-5 text-[#EF2C58]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-bold text-[#E8E8E8]">Cyber Empire нэгдэх</span>
          <span className="rounded-full bg-[#EF2C58] px-1.5 py-0.5 text-[9px] font-black text-white">₮49k</span>
        </div>
        <div className="mt-0.5 text-[11px] text-[#888]">
          Хязгааргүй пост · Бүх хичээл · 1.5× XP · Level дээшлүүл
        </div>
      </div>
      <svg className="h-4 w-4 shrink-0 text-[#EF2C58] transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
      </svg>
    </Link>
  );
}

// ─── Main Page ───
export default function Home() {
  const { data: session } = useSession();
  const { loading: memberLoading, isLoggedIn, isMember, isAdmin } = useMembership();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [category, setCategory] = useState<CategoryFilter>("all");

  const fetchPosts = async (pageNum: number, cat?: CategoryFilter) => {
    const activeCat = cat ?? category;
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: "20" });
      if (activeCat !== "all") params.set("category", activeCat);
      const res = await fetch(`/api/posts?${params}`);
      const data = await res.json();
      if (res.ok) {
        const safePosts = (data.posts || []).filter((p: Post) => p.author !== null);
        if (pageNum === 1) {
          setPosts(safePosts);
        } else {
          setPosts((prev) => [...prev, ...safePosts]);
        }
        setHasMore(pageNum < data.pagination.pages);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (memberLoading) return;
    // Feed loads for every logged-in user now (free users too).
    // Backend level-gate decides what they actually see.
    if (isLoggedIn) {
      setPage(1);
      setLoading(true);
      fetchPosts(1, category);
    } else {
      setLoading(false);
    }
  }, [memberLoading, isLoggedIn, category]);

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
        <div className="h-2 w-2 animate-pulse-gold rounded-[4px] bg-[#EF2C58]" />
      </div>
    );
  }

  // Anonymous visitors only — logged-in free users drop to the feed below.
  if (!isLoggedIn) {
    return <HeroLanding />;
  }

  const isFreeUser = isLoggedIn && !isMember && !isAdmin;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <FreeTierBanner visible={isFreeUser} />
      <LatestNews />
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-1.5 pb-1">
          {([
            { key: "all" as CategoryFilter, label: "Бүгд", color: "#EF2C58" },
            { key: "промт" as CategoryFilter, label: "Промт", color: "#0F81CA" },
            { key: "бүтээл" as CategoryFilter, label: "Бүтээл", color: "#22C55E" },
            { key: "ялалт" as CategoryFilter, label: "Ялалт", color: "#EF2C58" },
            { key: "мэдээлэл" as CategoryFilter, label: "Мэдээлэл", color: "#3B82F6" },
            { key: "танилцуулга" as CategoryFilter, label: "Танилцуулга", color: "#A855F7" },
          ]).map((tab) => {
            const active = category === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => switchCategory(tab.key)}
                className="group shrink-0 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-200"
                style={{
                  background: active ? tab.color : "rgba(255,255,255,0.04)",
                  color: active ? "#FFFFFF" : "#888888",
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full transition-opacity"
                  style={{
                    background: active ? "rgba(255,255,255,0.9)" : tab.color,
                    opacity: active ? 1 : 0.7,
                  }}
                />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-2 w-2 animate-pulse-gold rounded-[4px] bg-[#EF2C58]" />
        </div>
      ) : posts.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-[15px] text-[#666666]">Одоогоор нийтлэл байхгүй</p>
          <Link href="/posts/new" className="mt-6 inline-block rounded-[4px] bg-[#EF2C58] px-6 py-2.5 text-[13px] font-bold text-white">
            Пост үүсгэх
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post._id} post={post} onDelete={handleDelete} />
          ))}
          {hasMore && (
            <div className="flex justify-center py-8">
              <button onClick={loadMore} className="text-[13px] font-bold text-[#666666] transition hover:text-[#EF2C58]">
                Цааш үзэх
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
