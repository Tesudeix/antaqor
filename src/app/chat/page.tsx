"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "@/lib/utils";

interface Participant {
  _id: string;
  name: string;
  avatar?: string;
}

interface ConversationItem {
  _id: string;
  participants: Participant[];
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

export default function ChatListPage() {
  const { data: session, status } = useSession();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);

  const userId = (session?.user as { id?: string })?.id;

  useEffect(() => {
    if (status === "loading") return;
    if (!session) return;
    fetchConversations();
    const interval = setInterval(fetchConversations, 8000);
    return () => clearInterval(interval);
  }, [session, status]);

  const fetchConversations = async () => {
    try {
      const res = await fetch("/api/chat/conversations");
      const data = await res.json();
      if (res.ok) setConversations(data.conversations);
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-2 w-2 animate-pulse rounded-[4px] bg-[#EF2C58]" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="py-20 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[4px] bg-[#141414] border border-[rgba(255,255,255,0.08)]">
          <svg className="h-6 w-6 text-[#AAAAAA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="text-[14px] text-[#999999]">Чат ашиглахын тулд нэвтэрнэ үү</p>
        <Link href="/auth/signin" className="btn-primary mt-4 inline-flex text-[12px]">Нэвтрэх</Link>
      </div>
    );
  }

  return (
    <div className="-mx-5">
      {/* Header */}
      <div className="px-5 pb-4 pt-2">
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-bold text-[#E8E8E8]">Мессеж</h1>
          <Link
            href="/members"
            className="rounded-[4px] border border-[rgba(255,255,255,0.08)] p-2 text-[#AAAAAA] transition hover:border-[#2a2a35] hover:text-[#999999]"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Conversations */}
      {conversations.length === 0 ? (
        <div className="px-5 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[4px] bg-[#141414] border border-[rgba(255,255,255,0.08)]">
            <svg className="h-6 w-6 text-[#AAAAAA]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <p className="text-[14px] text-[#999999]">Мессеж байхгүй</p>
          <p className="mt-1 text-[12px] text-[#AAAAAA]">Гишүүдтэй чатлаж эхлээрэй</p>
          <Link href="/members" className="btn-primary mt-4 inline-flex text-[12px]">
            Гишүүд үзэх
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-[rgba(255,255,255,0.06)]">
          {conversations.map((conv) => {
            const other = conv.participants.find((p) => p._id !== userId);
            if (!other) return null;

            const initials = other.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return (
              <Link
                key={conv._id}
                href={`/chat/${conv._id}`}
                className="flex items-center gap-3 px-5 py-3.5 transition active:bg-[#141414]"
              >
                {other.avatar ? (
                  <img src={other.avatar} alt={other.name} className="h-11 w-11 rounded-[4px] object-cover" />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-[4px] bg-[rgba(0,0,0,0.08)] text-[12px] font-bold text-[#999999]">
                    {initials}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-[14px] font-semibold ${conv.unreadCount > 0 ? "text-[#E8E8E8]" : "text-[#E8E8E8]"}`}>
                      {other.name}
                    </p>
                    {conv.lastMessageAt && (
                      <span className="shrink-0 text-[10px] text-[#AAAAAA]">
                        {formatDistanceToNow(conv.lastMessageAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-[12px] ${conv.unreadCount > 0 ? "text-[#999999] font-medium" : "text-[#AAAAAA]"}`}>
                      {conv.lastMessage || "Шинэ харилцан яриа"}
                    </p>
                    {conv.unreadCount > 0 && (
                      <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#EF2C58] px-1.5 text-[10px] font-bold text-white">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
