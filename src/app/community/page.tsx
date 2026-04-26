"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface Post {
  _id: string;
  content: string;
  image?: string;
  category?: string;
  likes: string[];
  commentsCount: number;
  createdAt: string;
  author: { _id: string; name: string; avatar?: string } | null;
}

interface Member {
  _id: string;
  name: string;
  avatar?: string;
  aiLevel?: string;
}

type Filter = "all" | "бүтээл" | "промт" | "ялалт";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "Бүгд" },
  { key: "бүтээл", label: "Бүтээл" },
  { key: "промт", label: "Промт" },
  { key: "ялалт", label: "Ялалт" },
];

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "сая";
  if (m < 60) return `${m}мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}ц`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}өд`;
  return new Date(iso).toLocaleDateString("mn-MN", { month: "short", day: "numeric" });
}

export default function CommunityPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Post | null>(null);

  // Guests browse the gallery freely but tapping a tile pushes them to sign in
  const handleOpen = (p: Post) => {
    if (!session) {
      router.push("/auth/signin?next=/community");
      return;
    }
    setOpen(p);
  };

  useEffect(() => {
    let cancel = false;
    setLoading(true);
    const params = new URLSearchParams({ limit: "60" });
    if (filter !== "all") params.set("category", filter);
    fetch(`/api/posts?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancel) return;
        const list = (d.posts || []) as Post[];
        setPosts(list.filter((p) => p.image && p.image.trim().length > 0));
      })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, [filter]);

  // Fetch members (only when logged-in to avoid leaking member identity to bots)
  useEffect(() => {
    if (!session) return;
    let cancel = false;
    fetch("/api/members?limit=20")
      .then((r) => r.json())
      .then((d) => { if (!cancel && Array.isArray(d.members)) setMembers(d.members); })
      .catch(() => {});
    return () => { cancel = true; };
  }, [session]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: posts.length };
    posts.forEach((p) => { if (p.category) c[p.category] = (c[p.category] || 0) + 1; });
    return c;
  }, [posts]);

  return (
    <div className="mx-auto max-w-[1200px] pb-8">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <div className="h-[2px] w-4 bg-[#EF2C58]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#EF2C58]">ANTAQOR · COMMUNITY</span>
        </div>
        <h1 className="mt-2 text-[26px] font-black leading-tight text-[#E8E8E8] sm:text-[32px]">
          Бүтээлүүд
        </h1>
      </div>

      {/* Members strip — logged-in only, headerless avatar carousel */}
      {session && members.length > 0 && (
        <div className="mb-5">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {members.map((m) => (
              <Link
                key={m._id}
                href={`/profile/${m._id}`}
                className="group flex w-[72px] shrink-0 flex-col items-center gap-1.5 rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F10] p-2 transition hover:border-[rgba(239,44,88,0.3)]"
              >
                {m.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.avatar} alt={m.name} className="h-10 w-10 rounded-full object-cover" />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[rgba(239,44,88,0.12)] text-[14px] font-black text-[#EF2C58]">
                    {m.name.charAt(0)}
                  </div>
                )}
                <span className="w-full truncate text-center text-[10px] font-bold text-[#E8E8E8] group-hover:text-[#EF2C58]">
                  {m.name.split(" ")[0]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Sticky filter pills */}
      <div className="sticky top-[60px] z-30 -mx-4 mb-5 border-y border-[rgba(255,255,255,0.06)] bg-[#0A0A0A]/80 px-4 py-2 backdrop-blur-xl">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const n = counts[f.key] ?? 0;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black transition ${
                  active
                    ? "bg-[#EF2C58] text-white"
                    : "border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] text-[#888] hover:border-[rgba(239,44,88,0.3)] hover:text-[#E8E8E8]"
                }`}
              >
                {f.label}
                {n > 0 && (
                  <span className={`ml-1 text-[9px] font-bold ${active ? "text-white/70" : "text-[#555]"}`}>
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Gallery */}
      {loading ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-[4px] bg-[#141414]" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
          {posts.map((p, i) => (
            <GalleryCard key={p._id} post={p} index={i} onOpen={handleOpen} />
          ))}
        </div>
      )}

      {/* Lightbox / detail drawer */}
      <Lightbox post={open} onClose={() => setOpen(null)} />
    </div>
  );
}

function GalleryCard({ post, index, onOpen }: { post: Post; index: number; onOpen: (p: Post) => void }) {
  const initial = post.author?.name?.charAt(0) || "?";
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.5) }}
      onClick={() => onOpen(post)}
      className="group relative aspect-square overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F10] transition hover:border-[rgba(239,44,88,0.3)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={post.image}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
      />

      {/* Hover/press overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/0 to-transparent opacity-100 transition group-hover:from-black/95" />

      {/* Top-right: likes */}
      <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-[10px] font-black text-white backdrop-blur-md">
        <svg className="h-3 w-3 text-[#EF2C58]" fill="currentColor" viewBox="0 0 24 24">
          <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
        </svg>
        {post.likes?.length || 0}
      </div>

      {/* Bottom: author + prompt snippet */}
      <div className="absolute inset-x-0 bottom-0 p-2 sm:p-3">
        <div className="flex items-center gap-1.5">
          {post.author?.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.author.avatar}
              alt=""
              className="h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-white/20"
            />
          ) : (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[rgba(239,44,88,0.4)] text-[9px] font-black text-white ring-1 ring-white/20">
              {initial}
            </span>
          )}
          <span className="truncate text-[10px] font-bold text-white">
            {post.author?.name || "Хэрэглэгч"}
          </span>
        </div>
        {post.content && (
          <p className="mt-1 line-clamp-2 text-[10px] leading-tight text-white/80 opacity-0 transition group-hover:opacity-100 sm:line-clamp-2">
            {post.content}
          </p>
        )}
      </div>
    </motion.button>
  );
}

function Lightbox({ post, onClose }: { post: Post | null; onClose: () => void }) {
  // Esc closes
  useEffect(() => {
    if (!post) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [post, onClose]);

  return (
    <AnimatePresence>
      {post && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            className="grid w-full max-w-5xl gap-0 overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] md:grid-cols-[1fr_360px]"
            style={{ maxHeight: "90vh" }}
          >
            {/* Image */}
            <div className="relative flex items-center justify-center bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={post.image}
                alt=""
                className="max-h-[90vh] w-full object-contain md:max-h-[90vh]"
              />
              <button
                onClick={onClose}
                aria-label="Хаах"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-md transition hover:bg-black/90"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Detail */}
            <div className="flex max-h-[40vh] flex-col overflow-y-auto p-5 md:max-h-[90vh]">
              {/* Author */}
              <Link
                href={`/profile/${post.author?._id}`}
                className="flex items-center gap-2.5 transition hover:opacity-80"
              >
                {post.author?.avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.author.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[rgba(239,44,88,0.15)] text-[14px] font-black text-[#EF2C58]">
                    {post.author?.name?.charAt(0) || "?"}
                  </span>
                )}
                <div className="min-w-0">
                  <div className="text-[13px] font-bold text-[#E8E8E8]">{post.author?.name || "Хэрэглэгч"}</div>
                  <div className="text-[10px] text-[#666]">{timeAgo(post.createdAt)}</div>
                </div>
              </Link>

              {/* Stats */}
              <div className="mt-3 flex items-center gap-3 text-[11px] text-[#999]">
                <span className="inline-flex items-center gap-1 font-bold text-[#EF2C58]">
                  <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
                  </svg>
                  {post.likes?.length || 0}
                </span>
                <span className="inline-flex items-center gap-1">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.132a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                  </svg>
                  {post.commentsCount || 0}
                </span>
                {post.category && (
                  <span className="ml-auto rounded-full bg-[rgba(239,44,88,0.1)] px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#EF2C58]">
                    {post.category}
                  </span>
                )}
              </div>

              {/* Prompt / content */}
              {post.content && (
                <div className="mt-4 rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#EF2C58]">ПРОМПТ / ТАЙЛБАР</span>
                    <button
                      onClick={() => navigator.clipboard.writeText(post.content)}
                      className="text-[10px] font-bold text-[#666] transition hover:text-[#EF2C58]"
                      title="Хуулах"
                    >
                      Хуулах
                    </button>
                  </div>
                  <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-[#CCC]">
                    {post.content}
                  </p>
                </div>
              )}

              <Link
                href={`/posts/${post._id}`}
                className="mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-[4px] bg-[#EF2C58] py-2.5 text-[12px] font-black text-white transition hover:bg-[#D4264E]"
              >
                Бүтэн пост үзэх
                <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[4px] border-2 border-dashed border-[rgba(255,255,255,0.08)] p-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[4px] bg-[rgba(239,44,88,0.1)]">
        <svg className="h-5 w-5 text-[#EF2C58]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      </div>
      <p className="text-[14px] font-bold text-[#E8E8E8]">Бүтээл хараахан байхгүй</p>
      <p className="mx-auto mt-1.5 max-w-[300px] text-[11px] leading-relaxed text-[#666]">
        Эхний AI бүтээлээ хуваалц.{" "}
        <Link href="/posts/new" className="font-black text-[#EF2C58] hover:underline">
          Пост үүсгэх →
        </Link>
      </p>
    </div>
  );
}
