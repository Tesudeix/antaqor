"use client";

import { useEffect, useState, useRef, use } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { formatDistanceToNow } from "@/lib/utils";

interface MessageItem {
  _id: string;
  content: string;
  sender: { _id: string; name: string; avatar?: string };
  read: boolean;
  createdAt: string;
}

interface Participant {
  _id: string;
  name: string;
  avatar?: string;
}

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: conversationId } = use(params);
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string })?.id;

  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [other, setOther] = useState<Participant | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!userId) return;
    fetchMessages();
    fetchConversationInfo();
    const interval = setInterval(fetchMessages, 4000);
    return () => clearInterval(interval);
  }, [userId, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchConversationInfo = async () => {
    const res = await fetch("/api/chat/conversations");
    const data = await res.json();
    if (res.ok) {
      const conv = data.conversations.find((c: { _id: string }) => c._id === conversationId);
      if (conv) {
        const otherUser = conv.participants.find((p: Participant) => p._id !== userId);
        setOther(otherUser || null);
      }
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`);
      const data = await res.json();
      if (res.ok) setMessages(data.messages);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/chat/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: input.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [...prev, data.message]);
        setInput("");
        inputRef.current?.focus();
      }
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!session) {
    return (
      <div className="py-20 text-center">
        <p className="text-[14px] text-[#E2E4E8]">Нэвтрэх шаардлагатай</p>
        <Link href="/auth/signin" className="btn-primary mt-4 inline-flex text-[12px]">Нэвтрэх</Link>
      </div>
    );
  }

  const otherInitials = other?.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  return (
    <div className="-mx-5 flex h-[calc(100vh-120px)] flex-col md:h-[calc(100vh-80px)] lg:mx-0 lg:h-full">
      {/* Chat header */}
      <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: "var(--line, rgba(255,255,255,0.12))" }}>
        <Link href="/chat" aria-label="Буцах" className="rounded-full p-1.5 text-[var(--nav-fg-strong)] transition hover:bg-[var(--nav-hover-bg)] lg:hidden">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        {other && (
          <Link href={`/profile/${other._id}`} className="flex items-center gap-2.5">
            {other.avatar ? (
              <img src={other.avatar} alt={other.name} className="h-11 w-11 rounded-full object-cover" />
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-full text-[13px] font-bold" style={{ background: "var(--nav-hover-bg, #FFFFFF)", color: "var(--t-sub, #565967)" }}>
                {otherInitials}
              </div>
            )}
            <span className="text-[16px] font-bold text-[var(--nav-fg-strong)]">{other.name}</span>
          </Link>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-2 w-2 animate-pulse rounded-[4px] bg-[#2E29FF]" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[4px] bg-[#eef2f6] border border-[rgba(15,23,38,0.08)]">
              <svg className="h-5 w-5 text-[#475569]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-[13px] text-[#475569]">Мессеж бичиж эхлээрэй</p>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((msg, i) => {
              const isMine = msg.sender._id === userId;
              const showTime =
                i === 0 ||
                new Date(msg.createdAt).getTime() - new Date(messages[i - 1].createdAt).getTime() > 300000;

              return (
                <div key={msg._id}>
                  {showTime && (
                    <div className="py-2 text-center">
                      <span className="text-[10px] text-[#475569]">
                        {formatDistanceToNow(msg.createdAt)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div
                      /* Instagram-ын бөмбөлөг: дугуйрсан, өөрийнх нь өргөлт өнгөтэй,
                         бусдынх нь саарал гадаргуу. */
                      className={`max-w-[75%] rounded-[4px] px-3.5 py-2 text-[14.5px] leading-snug ${
                        isMine ? "bg-[#2E29FF] text-white" : ""
                      }`}
                      style={isMine ? undefined : { background: "var(--nav-hover-bg, #FFFFFF)", color: "var(--nav-fg-strong, #FFFFFF)" }}
                    >
                      {msg.content}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Мессеж бичих..."
            maxLength={2000}
            className="h-11 flex-1 rounded-full border bg-transparent px-4 text-[15px] text-[var(--nav-fg-strong)] outline-none transition placeholder:text-[var(--t-sub,#9C9CA6)] focus:border-[#2E29FF]"
            style={{ borderColor: "var(--line, rgba(255,255,255,0.12))" }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#2E29FF] text-white transition hover:bg-[#1F1AD9] disabled:opacity-30"
          >
            {sending ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-[4px] border-2 border-black border-t-transparent" />
            ) : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
