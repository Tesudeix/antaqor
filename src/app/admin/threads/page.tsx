"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface ThreadPost {
  id: string;
  text?: string;
  permalink?: string;
  timestamp: string;
  media_type?: string;
  media_url?: string;
  is_quote_post?: boolean;
  has_replies?: boolean;
}

interface PostsResponse {
  data: ThreadPost[];
  paging?: {
    cursors?: { before?: string; after?: string };
    next?: string;
  };
}

export default function ThreadsManagementPage() {
  const [posts, setPosts] = useState<ThreadPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [afterCursor, setAfterCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [postText, setPostText] = useState("");
  const [posting, setPosting] = useState(false);
  const [flash, setFlash] = useState<{ type: string; msg: string } | null>(null);

  const showFlash = (type: string, msg: string) => {
    setFlash({ type, msg });
    setTimeout(() => setFlash(null), 4000);
  };

  const loadPosts = useCallback(async (cursor?: string) => {
    try {
      const url = cursor
        ? `/api/admin/threads/posts?limit=20&after=${cursor}`
        : "/api/admin/threads/posts?limit=20";
      const res = await fetch(url);
      const data: PostsResponse = await res.json();
      if (data.data) {
        if (cursor) {
          setPosts((prev) => [...prev, ...data.data]);
        } else {
          setPosts(data.data);
        }
        setAfterCursor(data.paging?.cursors?.after || null);
        setHasMore(!!data.paging?.next);
      }
    } catch {
      showFlash("error", "Failed to load posts");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleLoadMore = () => {
    if (!afterCursor || loadingMore) return;
    setLoadingMore(true);
    loadPosts(afterCursor);
  };

  const handlePost = async () => {
    if (!postText.trim() || posting) return;
    setPosting(true);
    try {
      const res = await fetch("/api/admin/threads/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: postText.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPostText("");
      showFlash("success", "Published successfully!");
      setTimeout(() => loadPosts(), 2000);
    } catch (err) {
      showFlash("error", err instanceof Error ? err.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (threadId: string) => {
    if (!confirm("Delete this thread permanently?")) return;
    setDeletingId(threadId);
    try {
      const res = await fetch("/api/admin/threads/posts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPosts((prev) => prev.filter((p) => p.id !== threadId));
      showFlash("success", "Thread deleted");
    } catch (err) {
      showFlash("error", err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin border-2 border-[#cc2200] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[Bebas_Neue] text-3xl tracking-[5px] md:text-4xl">
          THREADS <span className="text-[#cc2200]">POSTS</span>
        </h1>
        <p className="mt-2 text-[11px] tracking-[2px] text-[#5a5550]">
          CREATE, VIEW, AND MANAGE YOUR THREADS
        </p>
      </div>

      {flash && (
        <div
          className={`border px-4 py-3 text-[12px] ${
            flash.type === "error"
              ? "border-red-900/50 bg-red-950/30 text-red-400"
              : "border-green-900/50 bg-green-950/30 text-green-400"
          }`}
        >
          {flash.msg}
        </div>
      )}

      {/* Compose */}
      <div className="card p-6">
        <div className="section-label !mb-4">New Thread</div>
        <textarea
          value={postText}
          onChange={(e) => setPostText(e.target.value)}
          placeholder="Write your thread..."
          className="input-dark mb-4 min-h-[100px] resize-y"
          maxLength={500}
        />
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#3a3835]">
            {postText.length}/500
          </span>
          <button
            onClick={handlePost}
            disabled={!postText.trim() || posting}
            className="btn-blood"
          >
            {posting ? "Publishing..." : "Publish"}
          </button>
        </div>
      </div>

      {/* Posts List */}
      <div className="space-y-3">
        {posts.length === 0 ? (
          <div className="card p-8 text-center text-[12px] text-[#5a5550]">
            No threads yet. Create your first post above!
          </div>
        ) : (
          posts.map((post) => (
            <div key={post.id} className="card group p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] leading-relaxed text-[#ede8df] whitespace-pre-wrap break-words">
                    {post.text || "[Media post]"}
                  </p>
                  {post.media_url && post.media_type === "IMAGE" && (
                    <img
                      src={post.media_url}
                      alt=""
                      className="mt-3 max-h-48 border border-[#1c1c1c] object-cover"
                    />
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-[#3a3835]">
                    <span>{formatDate(post.timestamp)}</span>
                    {post.is_quote_post && (
                      <span className="border border-[#1c1c1c] px-2 py-0.5 text-[9px] uppercase tracking-[1px]">
                        Quote
                      </span>
                    )}
                    {post.has_replies && (
                      <span className="border border-[#1c1c1c] px-2 py-0.5 text-[9px] uppercase tracking-[1px]">
                        Has Replies
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 opacity-0 transition group-hover:opacity-100">
                  <Link
                    href={`/admin/threads/${post.id}`}
                    className="flex h-8 w-8 items-center justify-center border border-[#1c1c1c] text-[#5a5550] transition hover:border-[#cc2200] hover:text-[#cc2200]"
                    title="View replies"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </Link>
                  {post.permalink && (
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-8 w-8 items-center justify-center border border-[#1c1c1c] text-[#5a5550] transition hover:border-[#c8c8c0] hover:text-[#c8c8c0]"
                      title="View on Threads"
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(post.id)}
                    disabled={deletingId === post.id}
                    className="flex h-8 w-8 items-center justify-center border border-[#1c1c1c] text-[#5a5550] transition hover:border-red-800 hover:text-red-500 disabled:opacity-50"
                    title="Delete"
                  >
                    {deletingId === post.id ? (
                      <span className="h-3 w-3 animate-spin border border-current border-t-transparent" />
                    ) : (
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {hasMore && (
        <div className="text-center">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="btn-ghost"
          >
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
