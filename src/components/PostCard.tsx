"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { formatDistanceToNow } from "@/lib/utils";
import { isAdminEmail } from "@/lib/adminClient";

interface ReactionData {
  count: number;
  reacted: boolean;
}

const ReactionIcon = ({ type, active }: { type: string; active: boolean }) => {
  const color = active ? "#EF2C58" : "currentColor";
  const props = { className: "h-[16px] w-[16px]", fill: "none", stroke: color, viewBox: "0 0 24 24", strokeWidth: active ? 2 : 1.5 };
  switch (type) {
    case "heart": return (
      <svg {...props} fill={active ? "#EF2C58" : "none"}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
      </svg>
    );
    case "fire": return (<svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" fill={active ? "rgba(239,44,88,0.2)" : "none"} /></svg>);
    case "rocket": return (<svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /></svg>);
    case "think": return (<svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>);
    default: return null;
  }
};

const REACTION_KEYS = ["heart", "fire", "rocket", "think"];

const CATEGORY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  "мэдээлэл": { bg: "bg-[rgba(59,130,246,0.15)]", text: "text-[#3B82F6]", label: "МЭДЭЭЛЭЛ" },
  "ялалт": { bg: "bg-[rgba(239,44,88,0.15)]", text: "text-[#EF2C58]", label: "ЯЛАЛТ" },
  "промт": { bg: "bg-[rgba(15,129,202,0.15)]", text: "text-[#0F81CA]", label: "ПРОМТ" },
  "бүтээл": { bg: "bg-[rgba(34,197,94,0.15)]", text: "text-[#22C55E]", label: "БҮТЭЭЛ" },
  "танилцуулга": { bg: "bg-[rgba(168,85,247,0.15)]", text: "text-[#A855F7]", label: "ТАНИЛЦУУЛГА" },
};

interface PostCardProps {
  post: {
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
  };
  locked?: boolean;
  onDelete?: (id: string) => void;
}

function buildReactions(post: PostCardProps["post"], userId: string | null): Record<string, ReactionData> {
  const result: Record<string, ReactionData> = {};
  for (const key of REACTION_KEYS) {
    const users: string[] = post.reactions?.[key] || [];
    result[key] = { count: users.length, reacted: userId ? users.includes(userId) : false };
  }
  // Migrate old likes to heart
  const hasAnyReaction = Object.values(result).some((r) => r.count > 0);
  if (!hasAnyReaction && post.likes?.length > 0) {
    result.heart = { count: post.likes.length, reacted: userId ? post.likes.includes(userId) : false };
  }
  return result;
}

export default function PostCard({ post, locked, onDelete }: PostCardProps) {
  const { data: session } = useSession();
  const userId = session?.user ? (session.user as { id?: string }).id ?? null : null;
  const userIsAdmin = isAdminEmail(session?.user?.email);
  const [reactions, setReactions] = useState<Record<string, ReactionData>>(() => buildReactions(post, userId));
  const [reactingEmoji, setReactingEmoji] = useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  if (!post.author) return null;

  const canDelete = userId === post.author._id || userIsAdmin;
  const hasText = post.content && post.content.trim().length > 0;
  const hasImage = !!post.image;
  const isLongPost = hasText && post.content.length > 400;
  const displayContent = isLongPost && !expanded ? post.content.slice(0, 400) : post.content;
  const catStyle = post.category ? CATEGORY_STYLES[post.category] : null;

  const handleReaction = async (emoji: string) => {
    if (!session || reactingEmoji || locked) return;
    setReactingEmoji(emoji);
    try {
      const res = await fetch(`/api/posts/${post._id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji }),
      });
      const data = await res.json();
      if (res.ok) setReactions(data.reactions);
    } finally {
      setReactingEmoji(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Энэ постыг устгах уу?")) return;
    const res = await fetch(`/api/posts/${post._id}`, { method: "DELETE" });
    if (res.ok && onDelete) onDelete(post._id);
  };

  const initials = post.author.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (locked) {
    return (
      <article className="rounded-[8px] border border-[rgba(255,255,255,0.08)] bg-[#141414] p-5">
        <div className="flex items-center gap-3 mb-4">
          {post.author.avatar ? (
            <img src={post.author.avatar} alt={post.author.name} className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1A1A1A] text-[11px] font-bold text-[#666666]">{initials}</div>
          )}
          <div>
            <p className="text-[13px] font-semibold text-[#E8E8E8]">{post.author.name}</p>
            <p className="text-[11px] text-[#666666]">{formatDistanceToNow(post.createdAt)}</p>
          </div>
        </div>
        <div className="relative">
          <div className="select-none blur-[6px]">
            <p className="text-[14px] text-[#666666]">
              {post.content?.slice(0, 120) || "Энэ нийтлэлийн агуулгыг зөвхөн гишүүд харах боломжтой..."}
            </p>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[12px] font-medium text-[#666666]">Гишүүдэд зориулсан</span>
            <Link href="/clan" className="mt-2 text-[12px] font-bold text-[#EF2C58]">
              Кланд нэгдэх
            </Link>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[#141414] transition-all duration-200 hover:border-[rgba(255,255,255,0.12)]">
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 sm:px-5">
        <Link href={`/profile/${post.author._id}`} className="flex items-center gap-2.5 min-w-0">
          {post.author.avatar ? (
            <img src={post.author.avatar} alt={post.author.name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1A1A1A] text-[11px] font-bold text-[#666666]">{initials}</div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-[13px] font-semibold text-[#E8E8E8] truncate">{post.author.name}</p>
              {catStyle && (
                <span className={`shrink-0 rounded-full ${catStyle.bg} px-2 py-0.5 text-[9px] font-bold ${catStyle.text}`}>
                  {catStyle.label}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#555555]">{formatDistanceToNow(post.createdAt)}</p>
          </div>
        </Link>

        {canDelete && (
          <button onClick={handleDelete} className="shrink-0 rounded-full p-2 text-[#555555] transition hover:bg-[rgba(255,255,255,0.04)] hover:text-[#999999]" aria-label="Устгах">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      {hasText && (
        <div className="px-4 mt-2.5 sm:px-5">
          <Link href={`/posts/${post._id}`} className="block">
            <p className="whitespace-pre-wrap text-[14px] leading-[1.7] text-[#CCCCCC]">
              {displayContent}
            </p>
          </Link>
          {isLongPost && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="mt-1 text-[13px] font-medium text-[#0F81CA] transition-colors duration-200 hover:text-[#EF2C58]"
            >
              Цааш унших...
            </button>
          )}
        </div>
      )}

      {/* Image */}
      {hasImage && (
        <Link href={`/posts/${post._id}`} className="block mt-3">
          <div className="relative overflow-hidden bg-[#0A0A0A]">
            {!imgLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-2 w-2 animate-pulse-gold rounded-full bg-[#EF2C58]" />
              </div>
            )}
            <img
              src={post.image}
              alt="Пост"
              onLoad={() => setImgLoaded(true)}
              onError={() => setImgLoaded(true)}
              className="w-full object-cover"
              style={{ maxHeight: "600px", minHeight: imgLoaded ? undefined : "200px", opacity: imgLoaded ? 1 : 0.01 }}
            />
          </div>
        </Link>
      )}

      {/* Reactions + comments */}
      <div className="flex items-center justify-between px-4 py-2.5 sm:px-5">
        <div className="flex items-center gap-0.5">
          {REACTION_KEYS.map((key) => {
            const data = reactions[key];
            const count = data?.count || 0;
            const reacted = data?.reacted || false;
            return (
              <button
                key={key}
                onClick={() => handleReaction(key)}
                disabled={!session || reactingEmoji === key}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 transition-all duration-200 ${
                  reacted
                    ? "bg-[rgba(239,44,88,0.12)]"
                    : "text-[#555555] hover:bg-[rgba(255,255,255,0.04)] hover:text-[#999999]"
                } ${reactingEmoji === key ? "scale-110" : "active:scale-95"}`}
              >
                <ReactionIcon type={key} active={reacted} />
                {count > 0 && (
                  <span className={`text-[11px] font-semibold tabular-nums ${reacted ? "text-[#EF2C58]" : "text-[#555555]"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <Link
          href={`/posts/${post._id}`}
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[#555555] transition-all duration-200 hover:bg-[rgba(255,255,255,0.04)] hover:text-[#999999]"
        >
          <svg className="h-[16px] w-[16px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {post.commentsCount > 0 && (
            <span className="text-[11px] font-semibold">{post.commentsCount}</span>
          )}
        </Link>
      </div>
    </article>
  );
}
