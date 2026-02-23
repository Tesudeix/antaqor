"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface ThreadPost {
  id: string;
  text?: string;
  permalink?: string;
  timestamp: string;
  has_replies?: boolean;
}

interface Reply {
  id: string;
  text?: string;
  username?: string;
  permalink?: string;
  timestamp: string;
  hide_status?: string;
}

export default function RepliesManagementPage() {
  const [posts, setPosts] = useState<ThreadPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<string | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [flash, setFlash] = useState<{ type: string; msg: string } | null>(null);

  const showFlash = (type: string, msg: string) => {
    setFlash({ type, msg });
    setTimeout(() => setFlash(null), 4000);
  };

  const loadPosts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/threads/posts?limit=50");
      const data = await res.json();
      setPosts(data.data || []);
    } catch {
      showFlash("error", "Failed to load posts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const loadReplies = async (threadId: string) => {
    setSelectedPost(threadId);
    setLoadingReplies(true);
    setReplies([]);
    try {
      const res = await fetch(
        `/api/admin/threads/replies?threadId=${threadId}&mode=replies`
      );
      const data = await res.json();
      setReplies(data.data || []);
    } catch {
      showFlash("error", "Failed to load replies");
    } finally {
      setLoadingReplies(false);
    }
  };

  const handleToggleHide = async (replyId: string, isHidden: boolean) => {
    setManagingId(replyId);
    try {
      const res = await fetch("/api/admin/threads/replies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyId, hide: !isHidden }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setReplies((prev) =>
        prev.map((r) =>
          r.id === replyId
            ? { ...r, hide_status: isHidden ? "not_hushed" : "hushed" }
            : r
        )
      );
      showFlash("success", isHidden ? "Reply unhidden" : "Reply hidden");
    } catch (err) {
      showFlash("error", err instanceof Error ? err.message : "Failed");
    } finally {
      setManagingId(null);
    }
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedPost || replying) return;
    setReplying(true);
    try {
      const res = await fetch("/api/admin/threads/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: selectedPost, text: replyText.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setReplyText("");
      showFlash("success", "Reply published!");
      setTimeout(() => loadReplies(selectedPost), 2000);
    } catch (err) {
      showFlash("error", err instanceof Error ? err.message : "Failed to reply");
    } finally {
      setReplying(false);
    }
  };

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
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
    <div className="space-y-6">
      <div>
        <h1 className="font-[Bebas_Neue] text-3xl tracking-[5px] md:text-4xl">
          REPLY <span className="text-[#cc2200]">MANAGEMENT</span>
        </h1>
        <p className="mt-2 text-[11px] tracking-[2px] text-[#5a5550]">
          SELECT A THREAD TO VIEW AND MANAGE ITS REPLIES
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

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Thread Selector */}
        <div className="lg:col-span-2">
          <div className="text-[9px] uppercase tracking-[3px] text-[#5a5550] mb-3">
            Your Threads
          </div>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto border border-[#1c1c1c] bg-[#0a0a0a] p-3">
            {posts
              .filter((p) => p.has_replies)
              .map((post) => (
                <button
                  key={post.id}
                  onClick={() => loadReplies(post.id)}
                  className={`w-full text-left p-3 border transition ${
                    selectedPost === post.id
                      ? "border-[#cc2200] bg-[rgba(204,34,0,0.08)]"
                      : "border-[#1c1c1c] hover:border-[rgba(240,236,227,0.1)]"
                  }`}
                >
                  <p className="text-[12px] leading-relaxed text-[#c8c8c0] line-clamp-2">
                    {post.text || "[Media post]"}
                  </p>
                  <span className="mt-1 block text-[9px] text-[#3a3835]">
                    {formatDate(post.timestamp)}
                  </span>
                </button>
              ))}
            {posts.filter((p) => p.has_replies).length === 0 && (
              <p className="py-6 text-center text-[11px] text-[#3a3835]">
                No threads with replies yet
              </p>
            )}
          </div>
        </div>

        {/* Replies Panel */}
        <div className="lg:col-span-3">
          {!selectedPost ? (
            <div className="flex h-full min-h-[300px] items-center justify-center border border-[#1c1c1c] bg-[#0a0a0a] p-8">
              <p className="text-[12px] text-[#3a3835]">
                Select a thread to view its replies
              </p>
            </div>
          ) : loadingReplies ? (
            <div className="flex h-full min-h-[300px] items-center justify-center border border-[#1c1c1c] bg-[#0a0a0a]">
              <div className="h-6 w-6 animate-spin border-2 border-[#cc2200] border-t-transparent" />
            </div>
          ) : (
            <div className="border border-[#1c1c1c] bg-[#0a0a0a]">
              <div className="flex items-center justify-between border-b border-[#1c1c1c] px-4 py-3">
                <span className="text-[10px] uppercase tracking-[2px] text-[#5a5550]">
                  {replies.length} {replies.length === 1 ? "Reply" : "Replies"}
                </span>
                <Link
                  href={`/admin/threads/${selectedPost}`}
                  className="text-[10px] uppercase tracking-[2px] text-[#cc2200] transition hover:text-[#e8440f]"
                >
                  Open Chat View
                </Link>
              </div>

              <div className="max-h-[40vh] space-y-0 overflow-y-auto">
                {replies.length === 0 ? (
                  <p className="py-8 text-center text-[11px] text-[#3a3835]">
                    No replies to this thread
                  </p>
                ) : (
                  replies.map((reply) => {
                    const isHidden = reply.hide_status === "hushed";
                    return (
                      <div
                        key={reply.id}
                        className={`group flex items-start gap-3 border-b border-[#0f0f0f] p-4 ${
                          isHidden ? "opacity-40" : ""
                        }`}
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center border border-[#1c1c1c] text-[10px] font-bold text-[#5a5550]">
                          {reply.username?.charAt(0).toUpperCase() || "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-[#c8c8c0]">
                              @{reply.username || "unknown"}
                            </span>
                            <span className="text-[9px] text-[#3a3835]">
                              {formatDate(reply.timestamp)}
                            </span>
                            {isHidden && (
                              <span className="text-[8px] uppercase tracking-[1px] text-yellow-600 border border-yellow-900/30 px-1.5 py-0.5">
                                Hidden
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[12px] leading-relaxed text-[#ede8df] break-words">
                            {reply.text || "[Media]"}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5 opacity-0 transition group-hover:opacity-100">
                          {reply.permalink && (
                            <a
                              href={reply.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex h-7 w-7 items-center justify-center border border-[#1c1c1c] text-[#3a3835] hover:text-[#c8c8c0]"
                              title="View on Threads"
                            >
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                          <button
                            onClick={() => handleToggleHide(reply.id, isHidden)}
                            disabled={managingId === reply.id}
                            className={`flex h-7 w-7 items-center justify-center border border-[#1c1c1c] transition ${
                              isHidden
                                ? "text-green-600 hover:text-green-400"
                                : "text-yellow-600 hover:text-yellow-400"
                            }`}
                            title={isHidden ? "Unhide" : "Hide"}
                          >
                            {managingId === reply.id ? (
                              <span className="h-2.5 w-2.5 animate-spin border border-current border-t-transparent" />
                            ) : (
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                {isHidden ? (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                ) : (
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                                )}
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Quick reply */}
              <div className="border-t border-[#1c1c1c] p-4">
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Quick reply..."
                    className="input-dark flex-1"
                    maxLength={500}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleReply();
                      }
                    }}
                  />
                  <button
                    onClick={handleReply}
                    disabled={!replyText.trim() || replying}
                    className="btn-blood !py-2 !px-4"
                  >
                    {replying ? "..." : "Send"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
