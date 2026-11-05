"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Platform = "instagram" | "messenger";

interface LinkedUser {
  _id: string;
  name: string;
  ghost: boolean;
  credits: number;
  daysLeft: number;
  level: number;
  streakDays: number;
}

interface LinkedUserDetail extends LinkedUser {
  email: string | null;
  creditsLifetime: number;
  xp: number;
  clan: string;
  subscriptionExpiresAt?: string;
}

interface Conversation {
  _id: string;
  platform: Platform;
  partnerId: string;
  partnerName?: string;
  partnerProfilePic?: string;
  lastMessagePreview: string;
  lastMessageDirection: "in" | "out";
  lastMessageAt: string;
  unreadCount: number;
  status: "open" | "archived";
  aiDisabled: boolean;
  intentScore: number;
  intentLabel: "hot" | "warm" | "cold" | "support" | "fan" | "unknown";
  internalNote?: string;
  safetyFlag?: "distress" | "violence" | null;
  escalatedToHuman?: boolean;
  linkedUser: LinkedUser | null;
}
interface Message {
  _id: string;
  direction: "in" | "out";
  source: "user" | "ai" | "manual" | "trigger";
  text: string;
  errorBody?: string;
  manualSenderEmail?: string;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const sec = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${Math.floor(sec)}с`;
  if (sec < 3600) return `${Math.floor(sec / 60)}м`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}ц`;
  return `${Math.floor(sec / 86400)}ө`;
}

const PlatformBadge = ({ platform }: { platform: Platform }) => (
  <span
    className="inline-flex items-center rounded-[4px] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider"
    style={{
      background: platform === "instagram" ? "rgba(225, 48, 108, 0.15)" : "rgba(0, 132, 255, 0.15)",
      color: platform === "instagram" ? "#E1306C" : "#0084FF",
    }}
  >
    {platform === "instagram" ? "IG" : "FB"}
  </span>
);

function IntentBadge({ label, score }: { label: string; score: number }) {
  if (label === "unknown" || score === 0) return null;
  const colors: Record<string, string> = {
    hot: "bg-[rgba(46,41,255,0.2)] text-[#2E29FF]",
    warm: "bg-[rgba(255,165,0,0.15)] text-[#FFA500]",
    cold: "bg-[rgba(100,100,100,0.2)] text-[#E2E4E8]",
    support: "bg-[rgba(0,132,255,0.15)] text-[#0084FF]",
    fan: "bg-[rgba(167,139,250,0.15)] text-[#a78bfa]",
  };
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-[4px] px-1 py-0.5 text-[11px] font-bold uppercase tracking-wider ${colors[label] || ""}`}
      title={`Intent: ${label} (${score}/10)`}
    >
      {label} {score}
    </span>
  );
}

function UserBadge({ user, full = false }: { user: LinkedUser | LinkedUserDetail; full?: boolean }) {
  if (user.ghost) {
    return (
      <span className="text-[10px] text-[#E2E4E8]">👻 Ghost · {user.credits}₵</span>
    );
  }
  return (
    <span className="text-[10px] text-[#23B450]">
      ✓ {user.name}
      {user.daysLeft > 0 ? ` · ${user.daysLeft}өд` : ""}
      {` · ${user.credits}₵`}
      {full && user.level ? ` · LV${user.level}` : ""}
      {full && user.streakDays ? ` · 🔥${user.streakDays}` : ""}
    </span>
  );
}

export default function InboxPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [linkedUser, setLinkedUser] = useState<LinkedUserDetail | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"open" | "archived">("open");
  const [intentFilter, setIntentFilter] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ status: filter });
      if (intentFilter) qs.set("intent", intentFilter);
      const r = await fetch(`/api/admin/meta/conversations?${qs}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Load failed");
      setConversations(d.conversations || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [filter, intentFilter]);

  const loadMessages = useCallback(async (id: string) => {
    try {
      const r = await fetch(`/api/admin/meta/conversations/${id}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Load failed");
      setMessages(d.messages || []);
      setConversation(d.conversation || null);
      setLinkedUser(d.linkedUser || null);
      fetch(`/api/admin/meta/conversations/${id}/read`, { method: "POST" }).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    }
  }, []);

  useEffect(() => {
    loadConversations();
    const t = setInterval(loadConversations, 8000);
    return () => clearInterval(t);
  }, [loadConversations]);

  useEffect(() => {
    if (!selectedId) return;
    loadMessages(selectedId);
    const t = setInterval(() => loadMessages(selectedId), 5000);
    return () => clearInterval(t);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages.length]);

  async function send() {
    if (!selectedId || !reply.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/meta/conversations/${selectedId}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: reply }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) throw new Error(d.error || "Send failed");
      setReply("");
      await loadMessages(selectedId);
      await loadConversations();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  }

  async function toggleArchive() {
    if (!conversation) return;
    const next = conversation.status === "open" ? "archived" : "open";
    const r = await fetch(`/api/admin/meta/conversations/${conversation._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (r.ok) {
      setSelectedId(null);
      setConversation(null);
      await loadConversations();
    }
  }

  async function toggleAI() {
    if (!conversation) return;
    const r = await fetch(`/api/admin/meta/conversations/${conversation._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aiDisabled: !conversation.aiDisabled }),
    });
    if (r.ok) await loadMessages(conversation._id);
  }

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col bg-[#0A0A0A] text-[#E8E8E8]">
      <header className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-6 py-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#2E29FF]">Inbox</div>
          <div className="mt-0.5 text-[18px] font-bold">Instagram &amp; Messenger</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["", "hot", "warm", "support", "fan"] as const).map((s) => (
            <button
              key={s || "all"}
              onClick={() => setIntentFilter(s)}
              className={`rounded-[4px] px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition ${
                intentFilter === s
                  ? "bg-[#2E29FF] text-white"
                  : "bg-[#0A0A0A] text-[#E2E4E8] hover:bg-[#F2F2F4]"
              }`}
            >
              {s || "Бүгд"}
            </button>
          ))}
          <span className="mx-1 self-center text-[#d5dce3]">|</span>
          {(["open", "archived"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-[4px] px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition ${
                filter === s
                  ? "bg-[#2E29FF] text-white"
                  : "bg-[#0A0A0A] text-[#E2E4E8] hover:bg-[#F2F2F4]"
              }`}
            >
              {s === "open" ? "Идэвхтэй" : "Архив"}
            </button>
          ))}
        </div>
      </header>

      {error && (
        <div className="border-b border-[rgba(46,41,255,0.3)] bg-[rgba(46,41,255,0.1)] px-6 py-2 text-[12px] text-[#2E29FF]">
          {error}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-[340px] flex-shrink-0 overflow-y-auto border-r border-[rgba(255,255,255,0.06)] bg-[#0A0A0A]">
          {loading && <div className="p-6 text-[12px] text-[#E2E4E8]">Уншиж байна…</div>}
          {!loading && conversations.length === 0 && (
            <div className="p-6 text-[12px] text-[#E2E4E8]">Ярианы түүх алга байна.</div>
          )}
          {conversations.map((c) => (
            <button
              key={c._id}
              onClick={() => setSelectedId(c._id)}
              className={`w-full border-b border-[rgba(255,255,255,0.04)] px-4 py-3 text-left transition ${
                selectedId === c._id ? "bg-[#F2F2F4]" : "hover:bg-[#0A0A0A]"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <PlatformBadge platform={c.platform} />
                  <span className="truncate text-[13px] font-bold">
                    {c.partnerName || c.partnerId}
                  </span>
                </div>
                <span className="flex-shrink-0 text-[10px] text-[#E2E4E8]">
                  {timeAgo(c.lastMessageAt)}
                </span>
              </div>
              {c.linkedUser && (
                <div className="mt-1">
                  <UserBadge user={c.linkedUser} />
                </div>
              )}
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="truncate text-[11px] text-[#E2E4E8]">
                  {c.lastMessageDirection === "out" ? "→ " : ""}
                  {c.lastMessagePreview || "(хоосон)"}
                </span>
                <div className="flex flex-shrink-0 items-center gap-1">
                  {c.safetyFlag === "distress" && (
                    <span className="rounded-[4px] bg-[rgba(46,41,255,0.25)] px-1 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#2E29FF]" title="Distress signal — needs human">
                      ⚠ SOS
                    </span>
                  )}
                  {c.escalatedToHuman && !c.safetyFlag && (
                    <span className="rounded-[4px] bg-[rgba(0,132,255,0.15)] px-1 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#0084FF]" title="Escalated to human">
                      👤
                    </span>
                  )}
                  <IntentBadge label={c.intentLabel} score={c.intentScore} />
                  {c.unreadCount > 0 && (
                    <span className="rounded-[4px] bg-[#2E29FF] px-1.5 py-0.5 text-[11px] font-bold text-white">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </aside>

        <main className="flex flex-1 flex-col bg-[#070707]">
          {!conversation && (
            <div className="flex flex-1 items-center justify-center text-[12px] text-[#E2E4E8]">
              Ярилцлага сонгоно уу
            </div>
          )}
          {conversation && (
            <>
              <div className="flex items-start justify-between gap-4 border-b border-[rgba(255,255,255,0.06)] px-6 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <PlatformBadge platform={conversation.platform} />
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-bold">
                      {conversation.partnerName || conversation.partnerId}
                    </div>
                    <div className="text-[10px] text-[#E2E4E8]">{conversation.partnerId}</div>
                    {linkedUser && (
                      <div className="mt-1">
                        <UserBadge user={linkedUser} full />
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-shrink-0 gap-2">
                  <IntentBadge
                    label={conversation.intentLabel}
                    score={conversation.intentScore}
                  />
                  <button
                    onClick={toggleAI}
                    className={`rounded-[4px] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider transition ${
                      conversation.aiDisabled
                        ? "bg-[#F2F2F4] text-[#E2E4E8]"
                        : "bg-[rgba(46,41,255,0.15)] text-[#2E29FF]"
                    }`}
                  >
                    {conversation.aiDisabled ? "AI унтарсан" : "AI идэвхтэй"}
                  </button>
                  <button
                    onClick={toggleArchive}
                    className="rounded-[4px] bg-[#0A0A0A] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[#E2E4E8] transition hover:bg-[#F2F2F4]"
                  >
                    {conversation.status === "open" ? "Архивлах" : "Сэргээх"}
                  </button>
                </div>
              </div>

              <div ref={scrollerRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {messages.map((m) => {
                  const isOut = m.direction === "out";
                  return (
                    <div key={m._id} className={`flex ${isOut ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[70%]">
                        <div
                          className={`rounded-[4px] px-3 py-2 text-[13px] whitespace-pre-wrap ${
                            isOut
                              ? m.errorBody
                                ? "bg-[rgba(46,41,255,0.15)] text-[#FFB3C6]"
                                : "bg-[#2E29FF] text-white"
                              : "bg-[#F2F2F4] text-[#E8E8E8]"
                          }`}
                        >
                          {m.text}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-[11px] text-[#E2E4E8]">
                          <span>{timeAgo(m.createdAt)}</span>
                          {isOut && (
                            <span className="uppercase tracking-wider">
                              {m.source === "ai" ? "AI" : m.source === "trigger" ? "TRIG" : m.manualSenderEmail || "MANUAL"}
                            </span>
                          )}
                          {m.errorBody && <span className="text-[#2E29FF]">FAIL</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-4">
                <div className="flex gap-2">
                  <input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder="Хариу бичих…"
                    className="flex-1 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2 text-[13px] text-[#E8E8E8] placeholder:text-[#E2E4E8] focus:border-[#2E29FF] focus:outline-none"
                  />
                  <button
                    onClick={send}
                    disabled={!reply.trim() || sending}
                    className="rounded-[4px] bg-[#2E29FF] px-5 py-2 text-[12px] font-bold uppercase tracking-wider text-white transition hover:bg-[#1F1AD9] disabled:bg-[#d5dce3] disabled:text-[#E2E4E8]"
                  >
                    {sending ? "Илгээж…" : "Илгээх"}
                  </button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
