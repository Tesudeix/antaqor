"use client";

import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import PostCard from "@/components/PostCard";
import Link from "next/link";
import { motion } from "framer-motion";

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
                  loading="lazy"
                  className="h-full w-full object-cover"
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
      {props.map((p, i) => (
        <motion.div
          key={p.title}
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: i * 0.1 }}
          viewport={{ once: true }}
          className="flex items-start gap-3 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] p-4"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] bg-[rgba(239,44,88,0.1)]">
            <svg className="h-4.5 w-4.5 text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={p.icon} />
            </svg>
          </div>
          <div>
            <div className="text-[13px] font-bold text-[#E8E8E8]">{p.title}</div>
            <div className="mt-0.5 text-[12px] text-[#666666]">{p.desc}</div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Members Preview ───
function MembersPreview() {
  const [members, setMembers] = useState<{ _id: string; name: string; avatar?: string; aiLevel?: string }[]>([]);

  useEffect(() => {
    fetch("/api/members?limit=8")
      .then((r) => r.json())
      .then((d) => { if (d.members) setMembers(d.members); })
      .catch(() => {});
  }, []);

  if (members.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-[2px] w-4 bg-[#EF2C58]" />
          <span className="text-[12px] font-bold tracking-[0.1em] text-[#E8E8E8]">ГИШҮҮД</span>
        </div>
        <Link href="/members" className="text-[11px] font-bold text-[#666666] transition hover:text-[#EF2C58]">
          Бүгдийг үзэх
        </Link>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {members.map((m) => (
          <Link
            key={m._id}
            href="/auth/signup"
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

      <div className="text-center">
        <h2 className="text-[18px] font-bold leading-tight text-[#E8E8E8]">
          AI-г эзэмшиж, орлогоо өсгө
        </h2>
        <p className="mt-1.5 text-[13px] text-[#666666]">
          Монголын хамгийн идэвхтэй AI бүтээгчдийн нийгэмлэг
        </p>
      </div>

      <Link
        href="/auth/signup"
        className="group relative block w-full overflow-hidden rounded-[4px] bg-[#EF2C58] py-4 text-center text-[14px] font-bold text-white transition-all duration-200 hover:shadow-[0_0_40px_rgba(239,44,88,0.35)]"
      >
        <span className="relative z-10">Cyber Empire нэгдэх</span>
        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      </Link>

      <StatsBar />
      <ValueProps />
      <LatestTanilts />
      <Leaderboard />

      {/* Final CTA */}
      <div className="rounded-[4px] border border-[rgba(239,44,88,0.2)] bg-[rgba(239,44,88,0.06)] p-6 text-center">
        <h3 className="text-[16px] font-bold text-[#E8E8E8]">Бэлэн үү?</h3>
        <p className="mt-1 text-[12px] text-[#666666]">
          Өнөөдрөөс AI-н ирээдүйд хөрөнгө оруулаарай
        </p>
        <Link
          href="/auth/signup"
          className="mt-4 inline-block rounded-[4px] bg-[#EF2C58] px-8 py-3 text-[13px] font-bold text-white transition hover:shadow-[0_0_32px_rgba(239,44,88,0.3)]"
        >
          Нэгдэх
        </Link>
        <p className="mt-3 text-[11px] text-[#666666]">
          Гишүүн үү?{" "}
          <Link href="/auth/signin" className="font-bold text-[#EF2C58] hover:underline">
            Нэвтрэх
          </Link>
        </p>
      </div>

      {/* Members Танилцуулга */}
      <MembersPreview />
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
        <div className="h-2 w-2 animate-pulse-gold rounded-[4px] bg-[#EF2C58]" />
      </div>
    );
  }

  if (!isMember && !isAdmin) {
    return <HeroLanding />;
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Post button - mobile fixed, desktop inline */}
      <Link
        href="/posts/new"
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-[4px] bg-[#EF2C58] text-white shadow-lg transition hover:shadow-[0_0_24px_rgba(239,44,88,0.4)] md:hidden"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </Link>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-1.5 pb-1">
            {([
              { key: "all" as CategoryFilter, label: "Бүгд" },
              { key: "мэдээлэл" as CategoryFilter, label: "Мэдээлэл" },
              { key: "ялалт" as CategoryFilter, label: "Ялалт" },
              { key: "промт" as CategoryFilter, label: "Промт" },
              { key: "бүтээл" as CategoryFilter, label: "Бүтээл" },
              { key: "танилцуулга" as CategoryFilter, label: "Танилцуулга" },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => switchCategory(tab.key)}
                className={`shrink-0 rounded-[4px] px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-200 ${
                  category === tab.key
                    ? "bg-[#EF2C58] text-white"
                    : "bg-[#141414] border border-[rgba(255,255,255,0.08)] text-[#666666] hover:text-[#999999]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <Link href="/posts/new" className="hidden shrink-0 rounded-[4px] bg-[#EF2C58] px-5 py-2 text-[12px] font-bold text-white transition-all duration-200 hover:shadow-[0_0_24px_rgba(239,44,88,0.25)] md:block">
          + Пост
        </Link>
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
