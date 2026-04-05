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

// Branded SVG reaction icons
const ReactionIcon = ({ type, active }: { type: string; active: boolean }) => {
  const color = active ? "#FFD300" : "currentColor";
  const props = { className: "h-[15px] w-[15px]", fill: "none", stroke: color, viewBox: "0 0 24 24", strokeWidth: active ? 2 : 1.5 };
  switch (type) {
    case "fire": return (<svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M15.362 5.214A8.252 8.252 0 0112 21 8.25 8.25 0 016.038 7.048 8.287 8.287 0 009 9.6a8.983 8.983 0 013.361-6.867 8.21 8.21 0 003 2.48z" /><path strokeLinecap="round" strokeLinejoin="round" d="M12 18a3.75 3.75 0 00.495-7.467 5.99 5.99 0 00-1.925 3.546 5.974 5.974 0 01-2.133-1A3.75 3.75 0 0012 18z" fill={active ? "rgba(255,211,0,0.2)" : "none"} /></svg>);
    case "heart": return (<svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" fill={active ? "rgba(255,211,0,0.2)" : "none"} /></svg>);
    case "clap": return (<svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M6.633 10.25c.806 0 1.533-.446 2.031-1.08a9.041 9.041 0 012.861-2.4c.723-.384 1.35-.956 1.653-1.715a4.498 4.498 0 00.322-1.672V3a.75.75 0 01.75-.75 2.25 2.25 0 012.25 2.25c0 1.152-.26 2.243-.723 3.218-.266.558.107 1.282.725 1.282m0 0h3.126c1.026 0 1.945.694 2.054 1.715.045.422.068.85.068 1.285a11.95 11.95 0 01-2.649 7.521c-.388.482-.987.729-1.605.729H13.48c-.483 0-.964-.078-1.423-.23l-3.114-1.04a4.501 4.501 0 00-1.423-.23H5.904m10.598-9.75H14.25M5.904 18.5c.083.205.173.405.27.602.197.4-.078.898-.523.898h-.908c-.889 0-1.713-.518-1.972-1.368a12 12 0 01-.521-3.507c0-1.553.295-3.036.831-4.398C3.387 9.953 4.167 9.5 5 9.5h1.053c.472 0 .745.556.5.96a8.958 8.958 0 00-1.302 4.665c0 1.194.232 2.333.654 3.375z" /></svg>);
    case "rocket": return (<svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" /></svg>);
    case "think": return (<svg {...props}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" /></svg>);
    case "hundred": return (<svg {...props} fill={active ? "rgba(255,211,0,0.2)" : "none"}><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>);
    case "haha": return (<svg {...props}><circle cx="12" cy="12" r="9" fill={active ? "rgba(255,211,0,0.15)" : "none"} /><path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" /></svg>);
    default: return null;
  }
};

const REACTION_KEYS = ["fire", "heart", "clap", "rocket", "think", "hundred", "haha"];

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
  // Migrate old likes to heart if no reactions exist
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

  if (!post.author) return null;

  const canDelete = userId === post.author._id || userIsAdmin;
  const hasText = post.content && post.content.trim().length > 0;
  const hasImage = !!post.image;
  const isImageOnly = hasImage && !hasText;
  const totalReactions = Object.values(reactions).reduce((sum, r) => sum + r.count, 0);

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
      <article className="border-b border-[#1a1a22]">
        <div className="px-4 pt-3 pb-3">
          <div className="flex items-center gap-3">
            {post.author.avatar ? (
              <img src={post.author.avatar} alt={post.author.name} className="h-9 w-9 rounded-[4px] object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[#1a1a22] text-[11px] font-bold text-[#6b6b78]">{initials}</div>
            )}
            <div>
              <p className="text-[13px] font-semibold text-[#e8e6e1]">{post.author.name}</p>
              <p className="text-[11px] text-[#6b6b78]">{formatDistanceToNow(post.createdAt)}</p>
            </div>
          </div>
        </div>
        <div className="relative px-4 pb-4">
          <div className="select-none blur-[6px]">
            <p className="text-[13px] text-[#6b6b78]">
              {post.content?.slice(0, 120) || "Энэ нийтлэлийн агуулгыг зөвхөн гишүүд харах боломжтой..."}
            </p>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[12px] font-medium text-[#6b6b78]">Гишүүдэд зориулсан</span>
            <Link href="/clan" className="mt-2 text-[12px] font-medium text-[#FFD300]">
              Кланд нэгдэх →
            </Link>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="border-b border-[#1a1a22]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3">
        <Link href={`/profile/${post.author._id}`} className="flex items-center gap-3">
          {post.author.avatar ? (
            <img src={post.author.avatar} alt={post.author.name} className="h-9 w-9 rounded-[4px] object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[#1a1a22] text-[11px] font-bold text-[#6b6b78]">{initials}</div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-semibold text-[#e8e6e1]">{post.author.name}</p>
              <span className="text-[11px] text-[#3a3a48]">{formatDistanceToNow(post.createdAt)}</span>
              {post.category === "ялалт" && (
                <span className="rounded-[4px] bg-[rgba(255,211,0,0.1)] px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-[#FFD300]">ЯЛАЛТ</span>
              )}
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-1">
          {canDelete && (
            <button onClick={handleDelete} className="rounded-[4px] p-1.5 text-[#3a3a48] transition hover:text-[#6b6b78]">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {hasText && (
        <Link href={`/posts/${post._id}`} className="block px-4">
          <p className={`whitespace-pre-wrap text-[14px] leading-[1.7] text-[rgba(232,230,225,0.8)] ${hasImage ? "mt-2 mb-2.5" : "mt-2 mb-0.5"}`}>
            {post.content}
          </p>
        </Link>
      )}

      {/* Image */}
      {hasImage && (
        <Link href={`/posts/${post._id}`} className="block">
          <div className={`relative overflow-hidden bg-[#0c0c10] ${isImageOnly ? "mt-2.5" : ""}`}>
            {!imgLoaded && (
              <div className="flex items-center justify-center py-24">
                <div className="h-2 w-2 animate-pulse rounded-full bg-[#FFD300]" />
              </div>
            )}
            <img
              src={post.image}
              alt="Пост"
              onLoad={() => setImgLoaded(true)}
              className={`w-full object-contain transition-opacity ${imgLoaded ? "opacity-100" : "h-0 opacity-0"}`}
              style={{ maxHeight: "500px" }}
            />
          </div>
        </Link>
      )}

      {/* Reactions + comments */}
      <div className="flex items-center justify-between px-4 py-2">
        {/* Reaction buttons */}
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
                className={`inline-flex items-center gap-1 rounded-[4px] px-1.5 py-1 transition-all ${
                  reacted
                    ? "bg-[rgba(255,211,0,0.08)] shadow-[0_0_6px_rgba(255,211,0,0.08)]"
                    : "text-[#3a3a48] hover:bg-[rgba(255,255,255,0.03)] hover:text-[#6b6b78]"
                } ${reactingEmoji === key ? "scale-110" : "active:scale-90"}`}
              >
                <ReactionIcon type={key} active={reacted} />
                {count > 0 && (
                  <span className={`text-[10px] font-semibold tabular-nums ${reacted ? "text-[#FFD300]" : "text-[#4a4a55]"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Comment link */}
        <div className="flex items-center gap-3">
          {totalReactions > 0 && (
            <span className="text-[11px] text-[#3a3a48]">{totalReactions}</span>
          )}
          <Link
            href={`/posts/${post._id}`}
            className="flex items-center gap-1.5 text-[13px] text-[#3a3a48] transition hover:text-[#6b6b78]"
          >
            <svg className="h-[16px] w-[16px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {post.commentsCount > 0 && post.commentsCount}
          </Link>
        </div>
      </div>
    </article>
  );
}
