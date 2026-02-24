"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface Reply {
  id: string;
  text?: string;
  username?: string;
  permalink?: string;
  timestamp: string;
  media_type?: string;
  has_replies?: boolean;
  hide_status?: string;
}

export default function ThreadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [replying, setReplying] = useState(false);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ type: string; msg: string } | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const showFlash = (type: string, msg: string) => {
    setFlash({ type, msg });
    setTimeout(() => setFlash(null), 4000);
  };

  const loadReplies = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/threads/replies?threadId=${id}&mode=conversation`
      );
      const data = await res.json();
      setReplies(data.data || []);
    } catch {
      showFlash("error", "Failed to load conversation");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadReplies();
  }, [loadReplies]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replies]);

  const handleReply = async () => {
    if (!replyText.trim() || replying) return;
    setReplying(true);
    try {
      const res = await fetch("/api/admin/threads/replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: id, text: replyText.trim() }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setReplyText("");
      showFlash("success", "Reply published!");
      setTimeout(() => loadReplies(), 2000);
    } catch (err) {
      showFlash("error", err instanceof Error ? err.message : "Failed to reply");
    } finally {
      setReplying(false);
    }
  };

  const handleToggleHide = async (replyId: string, currentlyHidden: boolean) => {
    setManagingId(replyId);
    try {
      const res = await fetch("/api/admin/threads/replies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replyId, hide: !currentlyHidden }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setReplies((prev) =>
        prev.map((r) =>
          r.id === replyId
            ? { ...r, hide_status: currentlyHidden ? "not_hushed" : "hushed" }
            : r
        )
      );
    } catch (err) {
      showFlash("error", err instanceof Error ? err.message : "Failed to update");
    } finally {
      setManagingId(null);
    }
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin border-2 border-[#cc2200] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-200px)] flex-col">
      {/* Header */}
      <div className="mb-4 flex items-center gap-4">
        <Link
          href="/admin/threads"
          className="flex h-8 w-8 items-center justify-center border border-[#1c1c1c] text-[#5a5550] transition hover:border-[#cc2200] hover:text-[#cc2200]"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="font-[Bebas_Neue] text-2xl tracking-[1px]">
            THREAD <span className="text-[#cc2200]">CONVERSATION</span>
          </h1>
          <p className="text-[10px] tracking-[2px] text-[#3a3835]">
            ID: {id}
          </p>
        </div>
        <button
          onClick={loadReplies}
          className="ml-auto flex h-8 w-8 items-center justify-center border border-[#1c1c1c] text-[#5a5550] transition hover:border-[#c8c8c0] hover:text-[#c8c8c0]"
          title="Refresh"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {flash && (
        <div
          className={`mb-4 border px-4 py-3 text-[12px] ${
            flash.type === "error"
              ? "border-red-900/50 bg-red-950/30 text-red-400"
              : "border-green-900/50 bg-green-950/30 text-green-400"
          }`}
        >
          {flash.msg}
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto border border-[#1c1c1c] bg-[#0a0a0a] p-4">
        {replies.length === 0 ? (
          <div className="flex h-full items-center justify-center text-[12px] text-[#3a3835]">
            No replies yet. Start the conversation!
          </div>
        ) : (
          <div className="space-y-4">
            {replies.map((reply) => {
              const isHidden = reply.hide_status === "hushed";
              const isOwn = reply.username?.toLowerCase() === "antaqor";
              return (
                <div
                  key={reply.id}
                  className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`group relative max-w-[80%] ${
                      isOwn
                        ? "bg-[rgba(204,34,0,0.15)] border border-[rgba(204,34,0,0.2)]"
                        : "bg-[#0f0f0f] border border-[#1c1c1c]"
                    } ${isHidden ? "opacity-40" : ""} p-4`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-[2px] ${
                          isOwn ? "text-[#cc2200]" : "text-[#c8c8c0]"
                        }`}
                      >
                        @{reply.username || "unknown"}
                      </span>
                      <span className="text-[9px] text-[#3a3835]">
                        {formatTime(reply.timestamp)}
                      </span>
                      {isHidden && (
                        <span className="text-[8px] uppercase tracking-[1px] text-yellow-600">
                          hidden
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] leading-relaxed text-[#ede8df] whitespace-pre-wrap break-words">
                      {reply.text || "[Media]"}
                    </p>

                    {/* Actions */}
                    <div className="mt-2 flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
                      {reply.permalink && (
                        <a
                          href={reply.permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[9px] uppercase tracking-[1px] text-[#3a3835] transition hover:text-[#c8c8c0]"
                        >
                          View
                        </a>
                      )}
                      {!isOwn && (
                        <button
                          onClick={() => handleToggleHide(reply.id, isHidden)}
                          disabled={managingId === reply.id}
                          className="text-[9px] uppercase tracking-[1px] text-[#3a3835] transition hover:text-yellow-500"
                        >
                          {managingId === reply.id
                            ? "..."
                            : isHidden
                            ? "Unhide"
                            : "Hide"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Reply Input */}
      <div className="mt-4 flex gap-3">
        <textarea
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Write a reply..."
          className="input-dark flex-1 resize-none"
          rows={2}
          maxLength={500}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleReply();
            }
          }}
        />
        <button
          onClick={handleReply}
          disabled={!replyText.trim() || replying}
          className="btn-blood self-end"
        >
          {replying ? "..." : "Reply"}
        </button>
      </div>
      <p className="mt-1 text-[9px] text-[#3a3835]">
        {replyText.length}/500 &middot; Cmd+Enter to send
      </p>
    </div>
  );
}
