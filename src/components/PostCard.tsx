"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { formatDistanceToNow } from "@/lib/utils";
import { isAdminEmail } from "@/lib/adminClient";

interface PostCardProps {
  post: {
    _id: string;
    content: string;
    image?: string;
    visibility?: string;
    likes: string[];
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

export default function PostCard({ post, locked, onDelete }: PostCardProps) {
  const { data: session } = useSession();
  const userId = session?.user ? (session.user as { id?: string }).id ?? null : null;
  const userIsAdmin = isAdminEmail(session?.user?.email);
  const [likes, setLikes] = useState(post.likes?.length ?? 0);
  const [liked, setLiked] = useState(userId ? (post.likes || []).includes(userId) : false);
  const [liking, setLiking] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [visibility, setVisibility] = useState(post.visibility || "members");
  const [toggling, setToggling] = useState(false);

  if (!post.author) return null;

  const canDelete = userId === post.author._id || userIsAdmin;
  const hasText = post.content && post.content.trim().length > 0;
  const hasImage = !!post.image;
  const isImageOnly = hasImage && !hasText;
  const isFree = visibility === "free";

  const handleLike = async () => {
    if (!session || liking || locked) return;
    setLiking(true);
    try {
      const res = await fetch(`/api/posts/${post._id}/like`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setLikes(data.likes);
        setLiked(data.liked);
      }
    } finally {
      setLiking(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Энэ постыг устгах уу?")) return;
    const res = await fetch(`/api/posts/${post._id}`, { method: "DELETE" });
    if (res.ok && onDelete) onDelete(post._id);
  };

  const handleToggleVisibility = async () => {
    if (toggling) return;
    setToggling(true);
    const newVis = isFree ? "members" : "free";
    try {
      const res = await fetch(`/api/posts/${post._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: newVis }),
      });
      if (res.ok) setVisibility(newVis);
    } finally {
      setToggling(false);
    }
  };

  const initials = post.author.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  if (locked) {
    return (
      <article className="card relative overflow-hidden">
        <div className="p-5">
          <div className="flex items-center gap-3">
            {post.author.avatar ? (
              <img src={post.author.avatar} alt={post.author.name} className="h-9 w-9 rounded-full object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1a1a22] text-[11px] font-bold text-[#6b6b78]">{initials}</div>
            )}
            <div>
              <p className="text-[13px] font-semibold text-[#e8e6e1]">{post.author.name}</p>
              <p className="text-[11px] text-[#6b6b78]">{formatDistanceToNow(post.createdAt)}</p>
            </div>
          </div>
        </div>
        <div className="relative px-5 pb-5">
          <div className="select-none blur-[6px]">
            <p className="text-[13px] text-[#6b6b78]">
              {post.content?.slice(0, 120) || "Энэ нийтлэлийн агуулгыг зөвхөн гишүүд харах боломжтой..."}
            </p>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[12px] font-medium text-[#6b6b78]">Гишүүдэд зориулсан</span>
            <Link href="/clan" className="mt-2 text-[12px] font-medium text-[#006491]">
              Кланд нэгдэх →
            </Link>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-5 pb-0">
        <Link href={`/profile/${post.author._id}`} className="flex items-center gap-3">
          {post.author.avatar ? (
            <img src={post.author.avatar} alt={post.author.name} className="h-9 w-9 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1a1a22] text-[11px] font-bold text-[#6b6b78]">{initials}</div>
          )}
          <div>
            <p className="text-[13px] font-semibold text-[#e8e6e1]">{post.author.name}</p>
            <p className="text-[11px] text-[#6b6b78]">{formatDistanceToNow(post.createdAt)}</p>
          </div>
        </Link>

        <div className="flex items-center gap-1.5">
          {isFree && (
            <span className="rounded-full bg-[rgba(34,197,94,0.1)] px-2.5 py-0.5 text-[10px] font-medium text-green-500">
              Нээлттэй
            </span>
          )}
          {userIsAdmin && (
            <button
              onClick={handleToggleVisibility}
              disabled={toggling}
              className="rounded-lg p-1.5 text-[#6b6b78] transition hover:bg-[#1a1a22] hover:text-[#e8e6e1]"
            >
              {toggling ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border border-current border-t-transparent" />
              ) : isFree ? (
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              ) : (
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )}
            </button>
          )}
          {canDelete && (
            <button onClick={handleDelete} className="rounded-lg p-1.5 text-[#6b6b78] transition hover:bg-[#1a1a22] hover:text-[#e8e6e1]">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {hasText && (
        <Link href={`/posts/${post._id}`} className="block px-5">
          <p className={`whitespace-pre-wrap text-[14px] leading-[1.8] text-[rgba(232,230,225,0.75)] ${hasImage ? "mt-3 mb-3" : "mt-3 mb-1"}`}>
            {post.content}
          </p>
        </Link>
      )}

      {/* Image */}
      {hasImage && (
        <Link href={`/posts/${post._id}`} className="block">
          <div className={`relative mx-5 overflow-hidden rounded-lg bg-[#0c0c10] ${isImageOnly ? "mt-4" : ""} mb-1`}>
            {!imgLoaded && (
              <div className="flex items-center justify-center py-24">
                <div className="h-2 w-2 animate-pulse rounded-full bg-[#006491]" />
              </div>
            )}
            <img
              src={post.image}
              alt="Пост"
              onLoad={() => setImgLoaded(true)}
              className={`w-full rounded-lg object-contain transition-opacity ${imgLoaded ? "opacity-100" : "h-0 opacity-0"}`}
              style={{ maxHeight: "500px" }}
            />
          </div>
        </Link>
      )}

      {/* Actions */}
      <div className="flex items-center gap-5 px-5 py-3.5">
        <button
          onClick={handleLike}
          disabled={!session}
          className={`flex items-center gap-1.5 text-[13px] transition ${
            liked ? "font-semibold text-[#006491]" : "text-[#6b6b78] hover:text-[#e8e6e1]"
          }`}
        >
          <svg className="h-[18px] w-[18px]" fill={liked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          {likes > 0 && likes}
        </button>

        <Link
          href={`/posts/${post._id}`}
          className="flex items-center gap-1.5 text-[13px] text-[#6b6b78] transition hover:text-[#e8e6e1]"
        >
          <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {post.commentsCount > 0 && post.commentsCount}
        </Link>
      </div>
    </article>
  );
}
