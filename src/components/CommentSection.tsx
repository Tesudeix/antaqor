"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { formatDistanceToNow } from "@/lib/utils";
import Link from "next/link";

interface Comment {
  _id: string;
  content: string;
  createdAt: string;
  author: {
    _id: string;
    name: string;
    avatar?: string;
  };
}

export default function CommentSection({ postId }: { postId: string }) {
  const { data: session } = useSession();
  const [comments, setComments] = useState<Comment[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [postId]);

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/posts/${postId}/comments`);
      const data = await res.json();
      if (res.ok) setComments(data.comments);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setComments([data.comment, ...comments]);
        setContent("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mt-8">
      <div className="section-label !mb-6">Сэтгэгдэл</div>

      {session ? (
        <form onSubmit={handleSubmit} className="mb-8">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Сэтгэгдэл бичих..."
            rows={3}
            maxLength={500}
            className="input-dark mb-3 resize-none"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="btn-blood !py-2 !px-5 !text-[10px]"
            >
              {submitting ? "Нийтэлж байна..." : "Сэтгэгдэл нийтлэх"}
            </button>
          </div>
        </form>
      ) : (
        <p className="mb-8 text-[12px] text-[#5a5550]">
          <Link href="/auth/signin" className="text-[#cc2200] hover:text-[#e8440f]">
            Нэвтэрнэ үү
          </Link>{" "}
          сэтгэгдэл бичихийн тулд.
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-3 w-3 animate-pulse rounded-full bg-[#cc2200]" />
        </div>
      ) : comments.length === 0 ? (
        <p className="py-6 text-center text-[12px] text-[#5a5550]">
          Сэтгэгдэл байхгүй байна. Эхлээд та бичээрэй.
        </p>
      ) : (
        <div className="space-y-3">
          {comments.map((comment) => {
            const initials = comment.author.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return (
              <div
                key={comment._id}
                className="border-l-2 border-[#1c1c1c] bg-[rgba(15,15,15,0.5)] p-4 transition hover:border-[#cc2200]"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Link href={`/profile/${comment.author._id}`} className="flex items-center gap-2">
                    {comment.author.avatar ? (
                      <img src={comment.author.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-6 w-6 items-center justify-center bg-[#1c1c1c] text-[9px] font-bold text-[#c8c8c0]">
                        {initials}
                      </div>
                    )}
                    <span className="text-[12px] font-bold text-[#ede8df]">
                      {comment.author.name}
                    </span>
                  </Link>
                  <span className="text-[10px] tracking-[2px] text-[#5a5550]">
                    {formatDistanceToNow(comment.createdAt)}
                  </span>
                </div>
                <p className="text-[12px] leading-[1.8] text-[rgba(240,236,227,0.6)]">
                  {comment.content}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
