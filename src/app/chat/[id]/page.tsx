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
        <p className="text-[14px] text-[#999999]">Нэвтрэх шаардлагатай</p>
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
    <div className="-mx-5 flex h-[calc(100vh-120px)] flex-col md:h-[calc(100vh-80px)]">
      {/* Chat header */}
      <div className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.08)] px-4 py-3">
        <Link href="/chat" className="rounded-[4px] p-1.5 text-[#AAAAAA] transition hover:text-[#E8E8E8]">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        {other && (
          <Link href={`/profile/${other._id}`} className="flex items-center gap-2.5">
            {other.avatar ? (
              <img src={other.avatar} alt={other.name} className="h-9 w-9 rounded-[4px] object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-[4px] bg-[rgba(0,0,0,0.08)] text-[11px] font-bold text-[#999999]">
                {otherInitials}
              </div>
            )}
            <span className="text-[14px] font-semibold text-[#E8E8E8]">{other.name}</span>
          </Link>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-2 w-2 animate-pulse rounded-[4px] bg-[#EF2C58]" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[4px] bg-[#141414] border border-[rgba(255,255,255,0.08)]">
              <svg className="h-5 w-5 text-[#AAAAAA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="text-[13px] text-[#AAAAAA]">Мессеж бичиж эхлээрэй</p>
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
                      <span className="text-[10px] text-[#AAAAAA]">
                        {formatDistanceToNow(msg.createdAt)}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-[4px] px-3 py-2 text-[13px] leading-relaxed ${
                        isMine
                          ? "bg-[#EF2C58] text-white"
                          : "bg-[rgba(0,0,0,0.08)] text-[#E8E8E8]"
                      }`}
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
      <div className="border-t border-[rgba(255,255,255,0.08)] bg-[rgba(6,6,8,0.95)] px-4 py-3">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Мессеж бичих..."
            maxLength={2000}
            className="flex-1 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] px-3.5 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#AAAAAA] outline-none transition focus:border-[#EF2C58]/50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[4px] bg-[#EF2C58] text-white transition hover:bg-[#D4264E] disabled:opacity-30"
          >
            {sending ? (
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black border-t-transparent" />
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
