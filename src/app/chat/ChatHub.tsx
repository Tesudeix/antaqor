"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "@/lib/utils";

const TELEGRAM_URL = "https://t.me/+s_lMH8HmpCM0YWRl";

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
  updatedAt?: string;
  unreadCount: number;
}

export default function ChatHub() {
  const { data: session, status } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/chat/conversations");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setConversations(data.conversations ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const interval = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userId]);

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [conversations]
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.trim().toLowerCase();
    return conversations.filter((c) =>
      c.participants.some((p) => p._id !== userId && p.name?.toLowerCase().includes(q))
    );
  }, [conversations, query, userId]);

  if (status === "unauthenticated") return <SignInCTA />;

  return (
    <div className="mx-auto w-full max-w-2xl px-3 pb-24 pt-4 sm:px-4 md:pt-6">
      {/* Tight header */}
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[24px] font-black leading-tight text-[#E8E8E8] md:text-[28px]">
            Чат
          </h1>
          <p className="mt-0.5 text-[11px] text-[#666]">
            {totalUnread > 0
              ? `${totalUnread} шинэ мессеж`
              : conversations.length === 0
                ? "Гишүүдтэй шууд ярилц"
                : `${conversations.length} харилцан яриа`}
          </p>
        </div>
        <Link
          href="/members"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-[4px] bg-[#EF2C58] px-3 py-2 text-[11px] font-black text-white transition hover:bg-[#D4264E]"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
          </svg>
          Шинэ
        </Link>
      </div>

      {/* Search — only when there's something to search */}
      {conversations.length > 3 && (
        <div className="relative mb-3">
          <svg
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#666]"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Хэрэглэгч хайх…"
            className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] py-2.5 pl-8 pr-3 text-[13px] text-[#E8E8E8] placeholder-[#555] outline-none transition focus:border-[rgba(239,44,88,0.4)]"
          />
        </div>
      )}

      {/* Pinned Telegram row — always visible at top of the list */}
      <a
        href={TELEGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group mb-2 flex items-center gap-3 rounded-[4px] border border-[rgba(42,171,238,0.25)] bg-gradient-to-r from-[rgba(42,171,238,0.06)] to-transparent px-3 py-2.5 transition hover:border-[rgba(42,171,238,0.5)]"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] bg-[#2AABEE] text-white">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.198 2.433a2.242 2.242 0 00-1.022.215l-16.5 7.5a2.25 2.25 0 00.126 4.147l4.012 1.484 1.48 4.012a2.25 2.25 0 004.148.126l7.5-16.5a2.25 2.25 0 00-.217-2.022 2.25 2.25 0 00-1.527-.962z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-black text-[#E8E8E8] group-hover:text-[#2AABEE]">
              Antaqor Community
            </span>
            <span className="rounded-full bg-[rgba(42,171,238,0.15)] px-1.5 py-0.5 text-[8px] font-black tracking-wider text-[#2AABEE]">
              TELEGRAM
            </span>
          </div>
          <div className="mt-0.5 truncate text-[11px] text-[#888]">
            AI бүтээгчдийн нийтийн өрөө · 24/7
          </div>
        </div>
        <svg className="h-3.5 w-3.5 shrink-0 text-[#666] transition group-hover:translate-x-0.5 group-hover:text-[#2AABEE]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </a>

      {/* DM list */}
      <div className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10]">
        {loading ? (
          <SkeletonList />
        ) : filtered.length === 0 ? (
          conversations.length === 0 ? (
            <EmptyAntaqor />
          ) : (
            <div className="px-4 py-10 text-center text-[12px] text-[#666]">
              «{query}» нэртэй чат олдсонгүй
            </div>
          )
        ) : (
          <ul className="divide-y divide-[rgba(255,255,255,0.05)]">
            {filtered.map((c) => {
              const other = c.participants.find((p) => p._id !== userId) ?? c.participants[0];
              const initials =
                other?.name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2) || "?";
              const time = c.lastMessageAt || c.updatedAt;
              const unread = c.unreadCount > 0;
              return (
                <li key={c._id}>
                  <Link
                    href={`/chat/${c._id}`}
                    className="flex items-center gap-3 px-3 py-3 transition hover:bg-[rgba(255,255,255,0.03)] active:bg-[rgba(255,255,255,0.05)]"
                  >
                    <div className="relative shrink-0">
                      {other?.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={other.avatar}
                          alt={other.name}
                          className="h-12 w-12 rounded-[4px] object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-[4px] bg-[rgba(239,44,88,0.1)] text-[13px] font-black text-[#EF2C58]">
                          {initials}
                        </div>
                      )}
                      {unread && (
                        <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#EF2C58] px-1.5 text-[10px] font-black text-white shadow-[0_0_0_2px_#0F0F10]">
                          {c.unreadCount > 99 ? "99+" : c.unreadCount}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-[14px] ${unread ? "font-black text-[#E8E8E8]" : "font-bold text-[#CCC]"}`}>
                          {other?.name || "Хэрэглэгч"}
                        </span>
                        {time && (
                          <span className={`shrink-0 text-[10px] font-medium ${unread ? "text-[#EF2C58]" : "text-[#666]"}`}>
                            {formatDistanceToNow(time)}
                          </span>
                        )}
                      </div>
                      <div className={`mt-0.5 truncate text-[12px] leading-snug ${unread ? "text-[#CCC]" : "text-[#666]"}`}>
                        {c.lastMessage || "Чат эхлүүлээрэй…"}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Mobile floating "+" — quick way to start a new chat without scrolling up */}
      <Link
        href="/members"
        aria-label="Шинэ чат эхлүүлэх"
        className="fixed bottom-[96px] right-4 z-30 flex h-12 w-12 items-center justify-center rounded-[4px] bg-[#EF2C58] text-white shadow-[0_8px_24px_rgba(239,44,88,0.4)] transition hover:bg-[#D4264E] active:scale-95 sm:hidden"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m-7-7h14" />
        </svg>
      </Link>
    </div>
  );
}

function SkeletonList() {
  return (
    <ul className="divide-y divide-[rgba(255,255,255,0.05)]">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-3 py-3">
          <div className="h-12 w-12 shrink-0 animate-pulse rounded-[4px] bg-[#161618]" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/3 animate-pulse rounded bg-[#161618]" />
            <div className="h-2.5 w-2/3 animate-pulse rounded bg-[#141414]" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyAntaqor() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[4px] bg-[rgba(239,44,88,0.08)]">
        <svg className="h-5 w-5 text-[#EF2C58]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a8 8 0 01-12.3 6.7L3 20l1.3-5.4A8 8 0 1121 12z" />
        </svg>
      </div>
      <h3 className="text-[15px] font-black text-[#E8E8E8]">Шинэ ярианы эхлэл</h3>
      <p className="mt-1.5 max-w-xs text-[12px] leading-relaxed text-[#777]">
        Гишүүдийн жагсаалтаас сонгоод шууд ярилцаж эхлээрэй.
      </p>
      <Link
        href="/members"
        className="mt-4 inline-flex items-center gap-1.5 rounded-[4px] bg-[#EF2C58] px-4 py-2 text-[12px] font-black text-white transition hover:bg-[#D4264E]"
      >
        Гишүүд харах →
      </Link>
    </div>
  );
}

function SignInCTA() {
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-[4px] bg-[rgba(239,44,88,0.08)]">
        <svg className="h-6 w-6 text-[#EF2C58]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a8 8 0 01-12.3 6.7L3 20l1.3-5.4A8 8 0 1121 12z" />
        </svg>
      </div>
      <h1 className="text-[20px] font-black text-[#E8E8E8]">Чат ашиглахын тулд нэвтэрнэ үү</h1>
      <p className="mt-2 text-[12px] text-[#888]">
        Гишүүдтэй шууд ярилцахын тулд эхлээд бүртгэлдээ нэвтэрнэ үү.
      </p>
      <Link
        href="/auth/signin?next=/chat"
        className="mt-4 inline-flex items-center gap-1.5 rounded-[4px] bg-[#EF2C58] px-4 py-2.5 text-[12px] font-black text-white transition hover:bg-[#D4264E]"
      >
        Нэвтрэх
      </Link>
    </div>
  );
}
