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
    likes: string[];
    commentsCount: number;
    createdAt: string;
    author: {
      _id: string;
      name: string;
      avatar?: string;
    } | null;
  };
  onDelete?: (id: string) => void;
}

export default function PostCard({ post, onDelete }: PostCardProps) {
  const { data: session } = useSession();
  const userId = session?.user ? (session.user as { id?: string }).id ?? null : null;
  const userIsAdmin = isAdminEmail(session?.user?.email);
  const [likes, setLikes] = useState(post.likes?.length ?? 0);
  const [liked, setLiked] = useState(userId ? (post.likes || []).includes(userId) : false);
  const [liking, setLiking] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  if (!post.author) return null;

  const canDelete = userId === post.author._id || userIsAdmin;
  const hasText = post.content && post.content.trim().length > 0;
  const hasImage = !!post.image;
  const isImageOnly = hasImage && !hasText;

  const handleLike = async () => {
    if (!session || liking) return;
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
    if (!confirm("Delete this post?")) return;
    const res = await fetch(`/api/posts/${post._id}`, { method: "DELETE" });
    if (res.ok && onDelete) {
      onDelete(post._id);
    }
  };

  const initials = post.author.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <article className="card overflow-hidden">
      {/* Header — always shown */}
      <div className="flex items-center justify-between px-5 pt-5 md:px-6 md:pt-6">
        <Link href={`/profile/${post.author._id}`} className="flex items-center gap-3">
          {post.author.avatar ? (
            <img
              src={post.author.avatar}
              alt={post.author.name}
              className="h-9 w-9 rounded-full object-cover ring-1 ring-[rgba(240,236,227,0.1)]"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center bg-[#1c1c1c] text-[11px] font-bold tracking-wider text-[#c8c8c0]">
              {initials}
            </div>
          )}
          <div>
            <p className="text-[13px] font-bold text-[#ede8df]">
              {post.author.name}
            </p>
            <p className="text-[10px] tracking-[2px] text-[#5a5550]">
              {formatDistanceToNow(post.createdAt)}
            </p>
          </div>
        </Link>

        {canDelete && (
          <button
            onClick={handleDelete}
            className="text-[#5a5550] transition hover:text-[#cc2200]"
            title="Delete post"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </div>

      {/* Text content */}
      {hasText && (
        <Link href={`/posts/${post._id}`} className="block px-5 md:px-6">
          <p className={`whitespace-pre-wrap text-[13px] leading-[1.9] text-[rgba(240,236,227,0.7)] ${hasImage ? "mt-3 mb-3" : "mt-4 mb-4"}`}>
            {post.content}
          </p>
        </Link>
      )}

      {/* Image — full width, dark border, max aspect ratio */}
      {hasImage && (
        <Link href={`/posts/${post._id}`} className="block">
          <div className={`relative overflow-hidden border-y border-[#1c1c1c] bg-[#0a0a0a] ${isImageOnly ? "mt-4" : ""}`}>
            {!imgLoaded && (
              <div className="flex items-center justify-center py-24">
                <div className="h-3 w-3 animate-pulse rounded-full bg-[#cc2200]" />
              </div>
            )}
            <img
              src={post.image}
              alt="Post"
              onLoad={() => setImgLoaded(true)}
              className={`w-full object-contain transition-opacity duration-300 ${
                imgLoaded ? "opacity-100" : "h-0 opacity-0"
              }`}
              style={{ maxHeight: "600px" }}
            />
          </div>
        </Link>
      )}

      {/* Actions */}
      <div className="flex items-center gap-6 border-t border-[rgba(240,236,227,0.06)] px-5 py-4 md:px-6">
        <button
          onClick={handleLike}
          disabled={!session}
          className={`flex items-center gap-2 text-[11px] tracking-[2px] transition ${
            liked
              ? "font-bold text-[#cc2200]"
              : "text-[#5a5550] hover:text-[#cc2200]"
          }`}
        >
          <svg className="h-4 w-4" fill={liked ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          {likes}
        </button>

        <Link
          href={`/posts/${post._id}`}
          className="flex items-center gap-2 text-[11px] tracking-[2px] text-[#5a5550] transition hover:text-[#c8c8c0]"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {post.commentsCount}
        </Link>
      </div>
    </article>
  );
}
