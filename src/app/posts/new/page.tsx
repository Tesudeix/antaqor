"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function NewPost() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      router.push("/");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex justify-center py-16">
        <div className="h-3 w-3 animate-pulse rounded-full bg-[#cc2200]" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-2 font-[Bebas_Neue] text-4xl tracking-[4px] text-[#ede8df]">
        Create a Post
      </h1>
      <p className="mb-8 text-[11px] tracking-[2px] text-[#5a5550]">
        SHARE WITH THE DIGITAL NATION
      </p>

      {error && (
        <div className="mb-6 border-l-2 border-[#cc2200] bg-[rgba(204,34,0,0.08)] px-4 py-3 text-[12px] text-[#cc2200]">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card p-5 md:p-6">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What's on your mind?"
            rows={6}
            maxLength={2000}
            required
            className="w-full resize-none border-0 bg-transparent text-[13px] leading-[1.9] text-[#ede8df] placeholder-[#5a5550] focus:outline-none"
          />
          <div className="flex items-center justify-between border-t border-[rgba(240,236,227,0.06)] pt-4">
            <span className="text-[10px] tracking-[2px] text-[#5a5550]">
              {content.length}/2000
            </span>
            <button
              type="submit"
              disabled={loading || !content.trim()}
              className="btn-blood !py-2 !px-6 !text-[10px]"
            >
              {loading ? "Posting..." : "Post"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
