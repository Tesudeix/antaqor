"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import PostCard from "@/components/PostCard";
import Link from "next/link";
import { useMembership } from "@/lib/useMembership";
import PricingCalculator from "@/components/PricingCalculator";

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
    <div className="border-b border-[#1a1a22] px-4 py-4">
      <div className="mb-3 flex items-center gap-2">
        <svg className="h-4 w-4 text-[#FFD300]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-[12px] font-semibold tracking-wide text-[#e8e6e1]">Эвентүүд</span>
      </div>
      <div className="space-y-2">
        {events.map((ev) => {
          const isLive = ev.status === "live";
          const joined = userId ? ev.attendees.includes(userId) : false;
          return (
            <div
              key={ev._id}
              className={`rounded-[10px] border p-3 transition ${
                isLive
                  ? "border-green-500/30 bg-[rgba(34,197,94,0.04)]"
                  : "border-[#1a1a22] bg-[#0e0e12]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {isLive && (
                      <span className="flex items-center gap-1 rounded-[4px] bg-green-500/15 px-1.5 py-0.5 text-[9px] font-bold text-green-400">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                        LIVE
                      </span>
                    )}
                    <h3 className="truncate text-[13px] font-semibold text-[#e8e6e1]">{ev.title}</h3>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#5a5550]">
                    <span>{formatEventDate(ev.date)}</span>
                    {ev.location && <span>· {ev.location}</span>}
                    <span>· {ev.attendees.length} оролцогч</span>
                  </div>
                  {ev.description && (
                    <p className="mt-1.5 text-[12px] leading-relaxed text-[#4a4a55] line-clamp-2">{ev.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {isLive && ev.liveLink ? (
                    <a
                      href={ev.liveLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-[8px] bg-green-500 px-3 py-1.5 text-[11px] font-bold text-black transition hover:bg-green-400"
                    >
                      Үзэх →
                    </a>
                  ) : ev.liveLink ? (
                    <a
                      href={ev.liveLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-[8px] border border-[#2a2a2e] px-3 py-1.5 text-[11px] font-medium text-[#6a6a72] transition hover:text-[#FFD300]"
                    >
                      Линк →
                    </a>
                  ) : null}
                  {userId ? (
                    <button
                      onClick={() => handleJoin(ev._id)}
                      disabled={joiningId === ev._id}
                      className={`rounded-[8px] px-3 py-1.5 text-[11px] font-semibold transition ${
                        joined
                          ? "bg-[rgba(255,211,0,0.1)] text-[#FFD300] border border-[rgba(255,211,0,0.3)]"
                          : "bg-[#1a1a22] text-[#6a6a72] hover:text-[#e8e6e1]"
                      }`}
                    >
                      {joiningId === ev._id ? "..." : joined ? "Нэгдсэн" : "Нэгдэх"}
                    </button>
                  ) : (
                    <Link
                      href="/auth/signin"
                      className="rounded-[8px] bg-[#1a1a22] px-3 py-1.5 text-[11px] font-medium text-[#6a6a72] transition hover:text-[#FFD300]"
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
    <div className="flex min-h-[85vh] flex-col items-center justify-center px-5 text-center">
      {/* Logo */}
      <div className="mb-6">
        <h1 className="font-[Bebas_Neue] text-6xl tracking-[6px] text-[#ede8df] sm:text-7xl">
          ANTA<span className="text-[#FFD300]">QOR</span>
        </h1>
        <p className="mt-2 text-[12px] tracking-[4px] text-[#5a5550]">
          ДИЖИТАЛ ҮНДЭСТЭН
        </p>
      </div>

      {/* Description */}
      <p className="mb-6 max-w-sm text-[14px] leading-relaxed text-[#6a6a72]">
        AI, технологи, бизнесийн ирээдүйг хамтдаа бүтээх клан.
      </p>

      {/* Value props */}
      <div className="mb-8 flex flex-col items-start gap-2.5 text-left">
        {[
          "Бүх хичээл, контентэд бүрэн хандалт",
          "Гишүүдтэй чат, нийгэмлэг",
          "Менторшип, хамтын ажиллагаа",
        ].map((b) => (
          <div key={b} className="flex items-center gap-2.5">
            <svg className="h-4 w-4 shrink-0 text-[#FFD300]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="text-[13px] text-[#6b6b78]">{b}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <Link
        href="/auth/signup"
        className="mb-4 inline-flex items-center gap-2 rounded-[10px] bg-[#FFD300] px-8 py-3 text-[15px] font-bold text-black transition hover:bg-[#e6be00] active:scale-[0.98]"
      >
        Кланд нэгдэх
      </Link>

      {/* Socials */}
      <div className="flex items-center gap-5">
        <a href="https://www.facebook.com/antaqor" target="_blank" rel="noopener noreferrer" className="text-[#5a5550] transition hover:text-[#FFD300]" aria-label="Facebook">
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        </a>
        <a href="https://www.instagram.com/antaqor" target="_blank" rel="noopener noreferrer" className="text-[#5a5550] transition hover:text-[#FFD300]" aria-label="Instagram">
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
        </a>
        <a href="https://www.tiktok.com/@antaqor" target="_blank" rel="noopener noreferrer" className="text-[#5a5550] transition hover:text-[#FFD300]" aria-label="TikTok">
          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 0010.86 4.46V13a8.28 8.28 0 005.58 2.16v-3.44a4.85 4.85 0 01-3.77-1.26V6.69h3.77z"/></svg>
        </a>
      </div>

      {/* Already a member */}
      <p className="mt-8 text-[12px] text-[#5a5550]">
        Гишүүн үү?{" "}
        <Link href="/auth/signin" className="text-[#FFD300] transition hover:text-[#e6be00]">
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
        <div className="h-2 w-2 animate-pulse rounded-full bg-[#FFD300]" />
      </div>
    );
  }

  const userId = session ? (session.user as { id?: string })?.id ?? null : null;

  // Non-members see landing hero + pricing + events
  if (!isMember && !isAdmin) {
    return (
      <div>
        <HeroLanding />
        <PricingCalculator />
        <div className="mx-auto max-w-lg">
          <EventsSection userId={userId} />
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-5">
      {/* Feed header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a1a22]">
        <div className="flex items-center gap-1">
          {([
            { key: "all" as CategoryFilter, label: "Бүгд" },
            { key: "мэдээлэл" as CategoryFilter, label: "Мэдээлэл" },
            { key: "ялалт" as CategoryFilter, label: "Ялалт" },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => switchCategory(tab.key)}
              className={`rounded-[8px] px-3 py-1.5 text-[12px] font-semibold transition ${
                category === tab.key
                  ? "bg-[#FFD300] text-black"
                  : "text-[#5a5550] hover:text-[#e8e6e1]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 pr-1">
          <Link href="/posts/new" className="rounded-[10px] bg-[#FFD300] px-4 py-1.5 text-[12px] font-semibold text-black transition hover:bg-[#e6be00]">
            + Пост
          </Link>
        </div>
      </div>

      {/* Events */}
      <EventsSection userId={userId} />

      {/* Posts */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#FFD300]" />
        </div>
      ) : posts.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-[14px] text-[#3a3a48]">Одоогоор нийтлэл байхгүй</p>
          <Link href="/posts/new" className="mt-6 inline-block rounded-[10px] bg-[#FFD300] px-5 py-2 text-[13px] font-semibold text-black transition hover:bg-[#e6be00]">
            Пост үүсгэх
          </Link>
        </div>
      ) : (
        <div>
          {posts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              onDelete={handleDelete}
            />
          ))}

          {hasMore && (
            <div className="flex justify-center py-6">
              <button onClick={loadMore} className="text-[13px] font-medium text-[#3a3a48] transition hover:text-[#6b6b78]">
                Цааш үзэх
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
