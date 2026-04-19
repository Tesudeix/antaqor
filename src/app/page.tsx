"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import PostCard from "@/components/PostCard";
import Link from "next/link";
import Image from "next/image";
import { useMembership } from "@/lib/useMembership";
import HeroSlider from "@/components/HeroSlider";

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

interface ShowcasePost {
  _id: string;
  image: string;
  content: string;
  author: { name: string; avatar?: string; xp?: number; level?: number } | null;
  likes: string[];
  createdAt: string;
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

type CategoryFilter = "all" | "мэдээлэл" | "ялалт";

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
        <div key={s.label} className="rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] p-4 text-center">
          <svg className="mx-auto mb-2 h-5 w-5 text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={s.icon} />
          </svg>
          <div className="text-[22px] font-bold text-[#1A1A1A]">
            <AnimatedNumber value={s.value} />
          </div>
          <div className="mt-0.5 text-[10px] font-medium text-[#888888]">{s.label}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Showcase Gallery ───
function ShowcaseGallery() {
  const [posts, setPosts] = useState<ShowcasePost[]>([]);

  useEffect(() => {
    fetch("/api/showcase?limit=6")
      .then((r) => r.json())
      .then((d) => { if (d.posts) setPosts(d.posts); })
      .catch(() => {});
  }, []);

  if (posts.length === 0) return null;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-[2px] w-4 bg-[#EF2C58]" />
          <span className="text-[12px] font-bold tracking-[0.1em] text-[#1A1A1A]">БҮТЭЭЛҮҮД</span>
        </div>
        <Link href="/auth/signup" className="text-[11px] font-bold text-[#888888] transition hover:text-[#EF2C58]">
          Бүгдийг үзэх
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {posts.map((post) => (
          <Link
            key={post._id}
            href="/auth/signup"
            className="group relative aspect-square overflow-hidden rounded-[4px] bg-[#FFFFFF]"
          >
            <Image
              src={post.image}
              alt={post.content?.slice(0, 30) || "Showcase"}
              fill
              className="object-cover transition duration-300 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, 33vw"
            />
            {/* Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
            {/* Author */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center gap-2 p-2.5 opacity-0 transition group-hover:opacity-100">
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#EF2C58] text-[8px] font-bold text-[#F8F8F6]">
                {post.author?.name?.charAt(0) || "?"}
              </div>
              <span className="text-[10px] font-bold text-white">{post.author?.name}</span>
              {post.author?.level && post.author.level > 0 && (
                <span className="rounded-[4px] bg-[rgba(239,44,88,0.2)] px-1 py-0.5 text-[8px] font-bold text-[#EF2C58]">
                  LV.{post.author.level}
                </span>
              )}
            </div>
            {/* Like count */}
            {post.likes?.length > 0 && (
              <div className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-[rgba(0,0,0,0.6)] px-2 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
                <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" /></svg>
                {post.likes.length}
              </div>
            )}
          </Link>
        ))}
      </div>
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
        <span className="text-[12px] font-bold tracking-[0.1em] text-[#1A1A1A]">ТЭРГҮҮЛЭГЧИД</span>
      </div>
      <div className="space-y-1.5">
        {users.slice(0, 5).map((user, i) => (
          <div
            key={user._id}
            className={`flex items-center gap-3 rounded-[4px] px-4 py-3 transition ${
              i === 0
                ? "border border-[rgba(239,44,88,0.15)] bg-[rgba(239,44,88,0.04)]"
                : "border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF]"
            }`}
          >
            {/* Rank */}
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black"
              style={{
                backgroundColor: i < 3 ? `${medals[i]}20` : "rgba(255,255,255,0.04)",
                color: i < 3 ? medals[i] : "#888888",
              }}
            >
              {i + 1}
            </div>

            {/* Avatar */}
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F8F8F6] text-[11px] font-bold text-[#EF2C58]">
                {user.name.charAt(0)}
              </div>
            )}

            {/* Name + Level */}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold text-[#1A1A1A]">{user.name}</div>
              <div className="text-[10px] text-[#888888]">Level {user.level}</div>
            </div>

            {/* XP */}
            <div className="text-right">
              <div className="text-[14px] font-bold text-[#EF2C58]">{user.xp.toLocaleString()}</div>
              <div className="text-[9px] text-[#888888]">XP</div>
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
    <div className="flex items-center justify-center gap-2 rounded-[4px] border border-[rgba(239,44,88,0.1)] bg-[rgba(239,44,88,0.03)] px-4 py-2.5">
      <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
      <span className="text-[12px] text-[#666666]">
        <span className="font-bold text-[#1A1A1A]">{stats.paidMembers}</span> хүн одоо идэвхтэй
      </span>
    </div>
  );
}

// ─── Value Proposition Cards ───
function ValueProps() {
  const props = [
    {
      icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
      title: "AI Сургалт",
      desc: "Промпт инженеринг, автоматжуулалт, AI бизнес",
    },
    {
      icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
      title: "Орлого олох",
      desc: "Дижитал бүтээгдэхүүн, freelance, AI tool бизнес",
    },
    {
      icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
      title: "Community",
      desc: "Бүтээгчдийн нийгэмлэг, хамтын ажиллагаа",
    },
  ];

  return (
    <div className="space-y-2">
      {props.map((p) => (
        <div key={p.title} className="flex items-start gap-3 rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] p-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] bg-[rgba(239,44,88,0.08)]">
            <svg className="h-4.5 w-4.5 text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={p.icon} />
            </svg>
          </div>
          <div>
            <div className="text-[13px] font-bold text-[#1A1A1A]">{p.title}</div>
            <div className="mt-0.5 text-[12px] text-[#888888]">{p.desc}</div>
          </div>
        </div>
      ))}
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
      {/* Hero Slider — full width, video capable */}
      <HeroSlider />

      {/* Social proof */}
      <SocialProof stats={stats} />

      {/* Tagline */}
      <div className="text-center">
        <h2 className="text-[18px] font-bold leading-tight text-[#1A1A1A]">
          AI-г эзэмшиж, орлогоо өсгө
        </h2>
        <p className="mt-1.5 text-[13px] text-[#888888]">
          Монголын хамгийн идэвхтэй AI бүтээгчдийн нийгэмлэг
        </p>
      </div>

      {/* CTA — urgent */}
      <Link
        href="/auth/signup"
        className="group relative block w-full overflow-hidden rounded-[4px] bg-[#EF2C58] py-4 text-center text-[14px] font-bold text-[#F8F8F6] transition-all duration-200 hover:shadow-[0_0_40px_rgba(239,44,88,0.35)]"
      >
        <span className="relative z-10">Үнэгүй эхлэх</span>
        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      </Link>

      {/* Stats */}
      <StatsBar />

      {/* Value props */}
      <ValueProps />

      {/* Showcase */}
      <ShowcaseGallery />

      {/* Leaderboard */}
      <Leaderboard />

      {/* Final CTA */}
      <div className="rounded-[4px] border border-[rgba(239,44,88,0.15)] bg-[rgba(239,44,88,0.03)] p-6 text-center">
        <h3 className="text-[16px] font-bold text-[#1A1A1A]">Бэлэн үү?</h3>
        <p className="mt-1 text-[12px] text-[#888888]">
          Өнөөдрөөс AI-н ирээдүйд хөрөнгө оруулаарай
        </p>
        <Link
          href="/auth/signup"
          className="mt-4 inline-block rounded-[4px] bg-[#EF2C58] px-8 py-3 text-[13px] font-bold text-[#F8F8F6] transition hover:shadow-[0_0_32px_rgba(239,44,88,0.3)]"
        >
          Нэгдэх
        </Link>
        <p className="mt-3 text-[11px] text-[#888888]">
          Гишүүн үү?{" "}
          <Link href="/auth/signin" className="font-bold text-[#EF2C58] hover:underline">
            Нэвтрэх
          </Link>
        </p>
      </div>

      {/* Socials */}
      <div className="flex items-center justify-center gap-2">
        {[
          { href: "https://www.facebook.com/antaqor", label: "Facebook", d: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" },
          { href: "https://www.instagram.com/antaqor", label: "Instagram", d: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" },
          { href: "https://www.youtube.com/@antaqor", label: "YouTube", d: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" },
          { href: "https://www.tiktok.com/@antaqor", label: "TikTok", d: "M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46V13a8.28 8.28 0 005.58 2.16v-3.44a4.85 4.85 0 01-3.77-1.26V6.69h3.77z" },
        ].map((s) => (
          <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[#FFFFFF] text-[#888888] transition hover:text-[#EF2C58]" aria-label={s.label}>
            <svg className="h-[14px] w-[14px]" fill="currentColor" viewBox="0 0 24 24"><path d={s.d} /></svg>
          </a>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ───
export default function Home() {
  const { data: session } = useSession();
  const { loading: memberLoading, isMember, isAdmin } = useMembership();
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
    if (isMember || isAdmin) {
      setPage(1);
      setLoading(true);
      fetchPosts(1, category);
    } else {
      setLoading(false);
    }
  }, [memberLoading, isMember, isAdmin, category]);

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
        <div className="h-2 w-2 animate-pulse-gold rounded-full bg-[#EF2C58]" />
      </div>
    );
  }

  // ─── Non-member: Sales landing page ───
  if (!isMember && !isAdmin) {
    return <HeroLanding />;
  }

  // ─── Member feed ───
  return (
    <div className="mx-auto max-w-3xl">
      {/* Feed header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-[4px] border border-[rgba(0,0,0,0.08)] bg-[#FFFFFF] p-1">
          {([
            { key: "all" as CategoryFilter, label: "Бүгд" },
            { key: "мэдээлэл" as CategoryFilter, label: "Мэдээлэл" },
            { key: "ялалт" as CategoryFilter, label: "Ялалт" },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => switchCategory(tab.key)}
              className={`rounded-[4px] px-4 py-1.5 text-[13px] font-semibold transition-all duration-200 ${
                category === tab.key
                  ? "bg-[#EF2C58] text-[#F8F8F6]"
                  : "text-[#888888] hover:text-[#666666]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Link href="/posts/new" className="rounded-[4px] bg-[#EF2C58] px-5 py-2 text-[12px] font-bold text-[#F8F8F6] transition-all duration-200 hover:shadow-[0_0_24px_rgba(239,44,88,0.25)]">
          + Пост
        </Link>
      </div>

      {/* Posts */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-2 w-2 animate-pulse-gold rounded-full bg-[#EF2C58]" />
        </div>
      ) : posts.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-[15px] text-[#888888]">Одоогоор нийтлэл байхгүй</p>
          <Link href="/posts/new" className="mt-6 inline-block rounded-[4px] bg-[#EF2C58] px-6 py-2.5 text-[13px] font-bold text-[#F8F8F6]">
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
              <button onClick={loadMore} className="text-[13px] font-bold text-[#888888] transition hover:text-[#EF2C58]">
                Цааш үзэх
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
