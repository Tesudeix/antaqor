"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import PostCard from "@/components/PostCard";
import Link from "next/link";
import Image from "next/image";
import { useMembership } from "@/lib/useMembership";
import PricingCalculator from "@/components/PricingCalculator";
import InstagramReels from "@/components/InstagramReels";
import Announcements from "@/components/Announcements";

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

interface EventData {
  _id: string;
  title: string;
  description: string;
  image: string;
  date: string;
  endDate: string;
  liveLink: string;
  location: string;
  status: "upcoming" | "live" | "ended";
  attendees: string[];
}

type CategoryFilter = "all" | "мэдээлэл" | "ялалт";

function formatEventDate(d: string) {
  const date = new Date(d);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const timeStr = date.toLocaleString("mn-MN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  if (diffDays === 0) return `Өнөөдөр · ${date.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })}`;
  if (diffDays === 1) return `Маргааш · ${date.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })}`;
  return timeStr;
}

function EventsSection({ userId }: { userId: string | null }) {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((d) => { if (d.events) setEvents(d.events); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleJoin = async (eventId: string) => {
    if (!userId || joiningId) return;
    setJoiningId(eventId);
    try {
      const res = await fetch(`/api/events/${eventId}/join`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setEvents((prev) =>
          prev.map((ev) => {
            if (ev._id !== eventId) return ev;
            return {
              ...ev,
              attendees: data.joined
                ? [...ev.attendees, userId]
                : ev.attendees.filter((a) => a !== userId),
            };
          })
        );
      }
    } finally {
      setJoiningId(null);
    }
  };

  if (loading) return null;
  if (events.length === 0) return null;

  return (
    <div className="py-6">
      <div className="mb-4 flex items-center gap-2">
        <svg className="h-4 w-4 text-[#0a0a0a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-[12px] font-bold tracking-[2px] uppercase text-[#0a0a0a]">Эвентүүд</span>
      </div>
      <div className="space-y-2">
        {events.map((ev) => {
          const isLive = ev.status === "live";
          const joined = userId ? ev.attendees.includes(userId) : false;
          return (
            <div
              key={ev._id}
              className={`rounded-[4px] p-4 transition ${
                isLive
                  ? "bg-[rgba(34,197,94,0.08)] border border-green-500/20"
                  : "bg-[#0a0a0a]"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {isLive && (
                      <span className="flex items-center gap-1 rounded-[4px] bg-green-500/15 px-1.5 py-0.5 text-[9px] font-bold text-green-400">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                        LIVE
                      </span>
                    )}
                    <h3 className={`truncate text-[14px] font-bold ${isLive ? "text-[#0a0a0a]" : "text-white"}`}>{ev.title}</h3>
                  </div>
                  <div className={`mt-1.5 flex flex-wrap items-center gap-2 text-[12px] ${isLive ? "text-[rgba(0,0,0,0.4)]" : "text-[rgba(255,255,255,0.35)]"}`}>
                    <span>{formatEventDate(ev.date)}</span>
                    {ev.location && <span>· {ev.location}</span>}
                    <span>· {ev.attendees.length} оролцогч</span>
                  </div>
                  {ev.description && (
                    <p className={`mt-2 text-[13px] leading-relaxed line-clamp-2 ${isLive ? "text-[rgba(0,0,0,0.35)]" : "text-[rgba(255,255,255,0.3)]"}`}>{ev.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {isLive && ev.liveLink ? (
                    <a
                      href={ev.liveLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-[4px] bg-green-500 px-4 py-2 text-[11px] font-bold text-black transition hover:bg-green-400"
                    >
                      Үзэх
                    </a>
                  ) : ev.liveLink ? (
                    <a
                      href={ev.liveLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-[4px] border border-[rgba(255,255,255,0.1)] px-4 py-2 text-[11px] font-semibold text-[rgba(255,255,255,0.4)] transition hover:text-[#FFFF01]"
                    >
                      Линк
                    </a>
                  ) : null}
                  {userId ? (
                    <button
                      onClick={() => handleJoin(ev._id)}
                      disabled={joiningId === ev._id}
                      className={`rounded-[4px] px-4 py-2 text-[11px] font-bold transition ${
                        joined
                          ? "bg-[rgba(255,255,1,0.15)] text-[#FFFF01] border border-[rgba(255,255,1,0.3)]"
                          : "bg-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.4)] hover:text-white"
                      }`}
                    >
                      {joiningId === ev._id ? "..." : joined ? "Нэгдсэн" : "Нэгдэх"}
                    </button>
                  ) : (
                    <Link
                      href="/auth/signin"
                      className="rounded-[4px] bg-[rgba(255,255,255,0.08)] px-4 py-2 text-[11px] font-semibold text-[rgba(255,255,255,0.4)] transition hover:text-[#FFFF01]"
                    >
                      Нэгдэх
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeroLanding() {
  return (
    <div className="flex min-h-[85vh] flex-col items-center justify-center text-center">
      {/* Logo mark */}
      <div className="mb-8">
        <Image src="/logo.png" alt="Antaqor" width={72} height={72} className="rounded-[8px] mx-auto mb-6" />
        <h1 className="text-[48px] font-black tracking-[4px] text-[#0a0a0a] sm:text-[64px] lg:text-[80px]">
          ANTAQOR
        </h1>
        <p className="mt-2 text-[12px] font-bold tracking-[6px] text-[rgba(0,0,0,0.3)] uppercase">
          Дижитал Үндэстэн
        </p>
      </div>

      {/* Description */}
      <p className="mb-10 max-w-md text-[15px] leading-relaxed text-[rgba(0,0,0,0.5)]">
        AI, технологи, бизнесийн ирээдүйг хамтдаа бүтээх клан.
      </p>

      {/* 4 Navigation cards */}
      <div className="mb-12 grid w-full max-w-lg grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253", title: "Хичээл", sub: "AI & Tech", href: "/classroom" },
          { icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", title: "Гишүүд", sub: "Нийгэмлэг", href: "/members" },
          { icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z", title: "Чат", sub: "Харилцаа", href: "/chat" },
          { icon: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z", title: "Эвент", sub: "Уулзалт", href: "/" },
        ].map((item) => (
          <Link
            key={item.title}
            href={item.href}
            className="group flex flex-col items-center gap-3 rounded-[4px] bg-[#0a0a0a] px-4 py-6 text-center shadow-[0_2px_12px_rgba(0,0,0,0.12)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.2)] active:scale-[0.98]"
          >
            <svg className="h-6 w-6 text-[#FFFF01]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
            </svg>
            <div>
              <div className="text-[12px] font-black text-white">{item.title}</div>
              <div className="text-[10px] font-medium text-[rgba(255,255,255,0.35)]">{item.sub}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Value props */}
      <div className="mb-10 flex flex-col items-start gap-3 text-left">
        {[
          "Бүх хичээл, контентэд бүрэн хандалт",
          "Гишүүдтэй чат, нийгэмлэг",
          "Менторшип, хамтын ажиллагаа",
        ].map((b) => (
          <div key={b} className="flex items-center gap-3">
            <svg className="h-4 w-4 shrink-0 text-[#0a0a0a]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-[14px] text-[rgba(0,0,0,0.5)]">{b}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <Link
        href="/auth/signup"
        className="rounded-[4px] bg-[#0a0a0a] px-10 py-4 text-[15px] font-black text-[#FFFF01] shadow-[0_4px_20px_rgba(0,0,0,0.15)] transition hover:-translate-y-0.5 hover:shadow-[0_8px_32px_rgba(0,0,0,0.25)] active:scale-[0.98]"
      >
        Кланд нэгдэх
      </Link>

      {/* Socials */}
      <div className="mt-10 flex items-center gap-3">
        {[
          { href: "https://www.facebook.com/antaqor", label: "Facebook", d: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" },
          { href: "https://www.instagram.com/antaqor", label: "Instagram", d: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" },
          { href: "https://www.youtube.com/@antaqor", label: "YouTube", d: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" },
          { href: "https://www.tiktok.com/@antaqor", label: "TikTok", d: "M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46V13a8.28 8.28 0 005.58 2.16v-3.44a4.85 4.85 0 01-3.77-1.26V6.69h3.77z" },
        ].map((s) => (
          <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-[4px] bg-[#0a0a0a] text-[#FFFF01] transition hover:-translate-y-0.5 hover:scale-105" aria-label={s.label}>
            <svg className="h-[16px] w-[16px]" fill="currentColor" viewBox="0 0 24 24"><path d={s.d} /></svg>
          </a>
        ))}
      </div>

      {/* Already a member */}
      <p className="mt-8 text-[13px] text-[rgba(0,0,0,0.35)]">
        Гишүүн үү?{" "}
        <Link href="/auth/signin" className="font-bold text-[#0a0a0a] transition hover:underline">
          Нэвтрэх
        </Link>
      </p>
    </div>
  );
}

export default function Home() {
  const { data: session } = useSession();
  const { loading: memberLoading, isMember, isAdmin, isLoggedIn } = useMembership();
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
        <div className="h-3 w-3 animate-pulse rounded-full bg-[#0a0a0a]" />
      </div>
    );
  }

  const userId = session ? (session.user as { id?: string })?.id ?? null : null;

  // Non-members see landing hero + pricing + events
  if (!isMember && !isAdmin) {
    return (
      <div>
        <HeroLanding />
        <div className="mx-auto max-w-2xl">
          <Announcements />
        </div>
        <div className="mx-auto max-w-2xl">
          <InstagramReels />
        </div>
        <PricingCalculator />
        <div className="mx-auto max-w-2xl">
          <EventsSection userId={userId} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Feed header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {([
            { key: "all" as CategoryFilter, label: "Бүгд" },
            { key: "мэдээлэл" as CategoryFilter, label: "Мэдээлэл" },
            { key: "ялалт" as CategoryFilter, label: "Ялалт" },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => switchCategory(tab.key)}
              className={`rounded-[4px] px-4 py-2 text-[13px] font-bold transition ${
                category === tab.key
                  ? "bg-[#0a0a0a] text-[#FFFF01]"
                  : "text-[rgba(0,0,0,0.3)] hover:text-[#0a0a0a]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Link href="/posts/new" className="rounded-[4px] bg-[#0a0a0a] px-5 py-2 text-[12px] font-bold text-[#FFFF01] transition hover:scale-105">
          + Пост
        </Link>
      </div>

      {/* Announcements */}
      <Announcements />

      {/* Instagram */}
      <InstagramReels />

      {/* Events */}
      <EventsSection userId={userId} />

      {/* Posts */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-3 w-3 animate-pulse rounded-full bg-[#0a0a0a]" />
        </div>
      ) : posts.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-[15px] text-[rgba(0,0,0,0.3)]">Одоогоор нийтлэл байхгүй</p>
          <Link href="/posts/new" className="mt-6 inline-block rounded-[4px] bg-[#0a0a0a] px-6 py-2.5 text-[13px] font-bold text-[#FFFF01] transition hover:scale-105">
            Пост үүсгэх
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              onDelete={handleDelete}
            />
          ))}

          {hasMore && (
            <div className="flex justify-center py-8">
              <button onClick={loadMore} className="text-[13px] font-bold text-[rgba(0,0,0,0.3)] transition hover:text-[#0a0a0a]">
                Цааш үзэх
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
