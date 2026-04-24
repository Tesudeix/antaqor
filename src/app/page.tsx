"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import PostCard from "@/components/PostCard";
import Link from "next/link";
import { useMembership } from "@/lib/useMembership";
import PricingCalculator from "@/components/PricingCalculator";
import HeroSlider from "@/components/HeroSlider";
import Announcements from "@/components/Announcements";
import InstagramReels from "@/components/InstagramReels";

interface Post {
  _id: string;
  content: string;
  richContent?: string;
  image?: string;
  visibility?: string;
  category?: string;
  promptData?: {
    title: string;
    model: string;
    tags: string[];
  };
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

type CategoryFilter = "all" | "мэдээлэл" | "ялалт" | "prompt";

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
              className={`rounded-[4px] border p-3 transition ${
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
                      className="rounded-[4px] bg-green-500 px-3 py-1.5 text-[11px] font-bold text-black transition hover:bg-green-400"
                    >
                      Үзэх →
                    </a>
                  ) : ev.liveLink ? (
                    <a
                      href={ev.liveLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-[4px] border border-[#2a2a2e] px-3 py-1.5 text-[11px] font-medium text-[#6a6a72] transition hover:text-[#FFD300]"
                    >
                      Линк →
                    </a>
                  ) : null}
                  {userId ? (
                    <button
                      onClick={() => handleJoin(ev._id)}
                      disabled={joiningId === ev._id}
                      className={`rounded-[4px] px-3 py-1.5 text-[11px] font-semibold transition ${
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
                      className="rounded-[4px] bg-[#1a1a22] px-3 py-1.5 text-[11px] font-medium text-[#6a6a72] transition hover:text-[#FFD300]"
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
        <div className="px-4 pt-3 pb-2">
          <HeroSlider />
        </div>
        <InstagramReels />
        <PricingCalculator />
        <div className="mx-auto max-w-lg">
          <EventsSection userId={userId} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Hero Slider */}
      <div className="pt-3 pb-2">
        <HeroSlider />
      </div>

      {/* Announcements */}
      <div className="pb-2">
        <Announcements />
      </div>

      {/* Instagram Reels */}
      <InstagramReels />

      {/* Feed header */}
      <div className="flex items-center justify-between py-3 border-b border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-1">
          {([
            { key: "all" as CategoryFilter, label: "Бүгд" },
            { key: "мэдээлэл" as CategoryFilter, label: "Мэдээлэл" },
            { key: "ялалт" as CategoryFilter, label: "Ялалт" },
            { key: "prompt" as CategoryFilter, label: "🧠 Prompt" },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => switchCategory(tab.key)}
              className={`rounded-[4px] px-3 py-1.5 text-[12px] font-semibold transition ${
                category === tab.key
                  ? "bg-[#EF2C58] text-white"
                  : "text-[#555555] hover:text-[#E8E8E8]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/posts/new" className="rounded-[4px] bg-[#EF2C58] px-4 py-1.5 text-[12px] font-bold text-white transition hover:shadow-[0_0_16px_rgba(239,44,88,0.25)]">
            + Пост
          </Link>
        </div>
      </div>

      {/* Events */}
      <EventsSection userId={userId} />

      {/* Posts */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-2 w-2 animate-pulse rounded-full bg-[#EF2C58]" />
        </div>
      ) : posts.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-[14px] text-[#555555]">Одоогоор нийтлэл байхгүй</p>
          <Link href="/posts/new" className="mt-6 inline-block rounded-[4px] bg-[#EF2C58] px-5 py-2 text-[13px] font-bold text-white transition hover:shadow-[0_0_16px_rgba(239,44,88,0.25)]">
            Пост үүсгэх
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-[rgba(255,255,255,0.06)]">
          {posts.map((post) => (
            <PostCard
              key={post._id}
              post={post}
              onDelete={handleDelete}
            />
          ))}

          {hasMore && (
            <div className="flex justify-center py-6">
              <button onClick={loadMore} className="text-[13px] font-medium text-[#555555] transition hover:text-[#E8E8E8]">
                Цааш үзэх
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
