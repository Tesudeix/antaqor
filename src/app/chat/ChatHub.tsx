"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "@/lib/utils";

const TELEGRAM_URL = "https://t.me/+s_lMH8HmpCM0YWRl";

type Surface = "antaqor" | "telegram";

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

const STORAGE_KEY = "antaqor.chat.surface";

export default function ChatHub() {
  const { data: session, status } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const [surface, setSurface] = useState<Surface>("antaqor");
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  // Restore last-used tab so the user lands where they left off.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "telegram" || saved === "antaqor") setSurface(saved);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, surface);
    } catch {}
  }, [surface]);

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

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-4 md:pt-6">
      {/* Header */}
      <div className="mb-4 flex items-end justify-between">
        <div>
          <div className="text-[10px] font-bold tracking-[0.22em] text-[#666]">INBOX</div>
          <h1 className="mt-1 text-[24px] font-black leading-tight text-[#E8E8E8] md:text-[28px]">
            Чатууд
          </h1>
        </div>
        <div className="text-right text-[11px] text-[#666]">
          <div>Antaqor + Telegram</div>
          <div className="font-semibold text-[#888]">нэг газар</div>
        </div>
      </div>

      {/* Segmented tabs */}
      <div
        role="tablist"
        aria-label="Chat surfaces"
        className="relative mb-4 grid grid-cols-2 gap-1 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] p-1"
      >
        <TabButton
          active={surface === "antaqor"}
          onClick={() => setSurface("antaqor")}
          accent="#EF2C58"
          label="Antaqor"
          sublabel="Шууд мессеж"
          badge={totalUnread > 0 ? (totalUnread > 99 ? "99+" : String(totalUnread)) : undefined}
          icon={
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a8 8 0 01-12.3 6.7L3 20l1.3-5.4A8 8 0 1121 12z" />
            </svg>
          }
        />
        <TabButton
          active={surface === "telegram"}
          onClick={() => setSurface("telegram")}
          accent="#2AABEE"
          label="Telegram"
          sublabel="Community"
          icon={
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.198 2.433a2.242 2.242 0 00-1.022.215l-16.5 7.5a2.25 2.25 0 00.126 4.147l4.012 1.484 1.48 4.012a2.25 2.25 0 004.148.126l7.5-16.5a2.25 2.25 0 00-.217-2.022 2.25 2.25 0 00-1.527-.962z" />
            </svg>
          }
        />
      </div>

      {/* Surface content */}
      {surface === "antaqor" ? (
        <AntaqorPanel
          status={status}
          loading={loading}
          conversations={filtered}
          totalConversations={conversations.length}
          userId={userId}
          query={query}
          onQueryChange={setQuery}
        />
      ) : (
        <TelegramPanel />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  sublabel,
  icon,
  accent,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  accent: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`group relative flex items-center justify-between gap-2 rounded-[4px] px-3 py-2.5 text-left transition ${
        active
          ? "bg-[#161618] shadow-[0_0_0_1px_rgba(255,255,255,0.05)]"
          : "hover:bg-[rgba(255,255,255,0.03)]"
      }`}
      style={active ? { boxShadow: `inset 0 0 0 1px ${accent}40, 0 0 24px -10px ${accent}` } : undefined}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] text-white"
          style={{ backgroundColor: active ? accent : "#1A1A1C", color: active ? "#fff" : "#888" }}
        >
          {icon}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-bold leading-tight" style={{ color: active ? "#E8E8E8" : "#999" }}>
            {label}
          </span>
          <span className="block truncate text-[10px] font-medium" style={{ color: active ? "#888" : "#555" }}>
            {sublabel}
          </span>
        </span>
      </div>
      {badge && (
        <span
          className="ml-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-black text-white"
          style={{ backgroundColor: accent }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function AntaqorPanel({
  status,
  loading,
  conversations,
  totalConversations,
  userId,
  query,
  onQueryChange,
}: {
  status: "loading" | "authenticated" | "unauthenticated";
  loading: boolean;
  conversations: ConversationItem[];
  totalConversations: number;
  userId?: string;
  query: string;
  onQueryChange: (v: string) => void;
}) {
  if (status === "unauthenticated") {
    return <SignInCTA />;
  }

  return (
    <div className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10]">
      {/* Search + new */}
      <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.06)] p-2">
        <div className="relative flex-1">
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
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Хэрэглэгч хайх…"
            className="w-full rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] py-2 pl-8 pr-3 text-[12px] text-[#E8E8E8] placeholder-[#555] outline-none transition focus:border-[#EF2C58]/50"
          />
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

      {/* List */}
      {loading ? (
        <SkeletonList />
      ) : conversations.length === 0 ? (
        totalConversations === 0 ? (
          <EmptyAntaqor />
        ) : (
          <div className="px-4 py-10 text-center text-[12px] text-[#666]">
            «{query}» гэсэн нэртэй чат олдсонгүй
          </div>
        )
      ) : (
        <ul className="divide-y divide-[rgba(255,255,255,0.05)]">
          {conversations.map((c) => {
            const other = c.participants.find((p) => p._id !== userId) ?? c.participants[0];
            const initials =
              other?.name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2) || "?";
            const time = c.lastMessageAt || c.updatedAt;
            return (
              <li key={c._id}>
                <Link
                  href={`/chat/${c._id}`}
                  className="flex items-center gap-3 px-3 py-3 transition hover:bg-[rgba(255,255,255,0.03)]"
                >
                  <div className="relative shrink-0">
                    {other?.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={other.avatar}
                        alt={other.name}
                        className="h-11 w-11 rounded-[4px] object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-[4px] bg-[#1A1A1C] text-[12px] font-black text-[#999]">
                        {initials}
                      </div>
                    )}
                    {c.unreadCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#EF2C58] px-1 text-[10px] font-black text-white shadow-[0_0_0_2px_#0F0F10]">
                        {c.unreadCount > 99 ? "99+" : c.unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className={`truncate text-[13px] ${
                          c.unreadCount > 0 ? "font-black text-[#E8E8E8]" : "font-semibold text-[#CCC]"
                        }`}
                      >
                        {other?.name || "Хэрэглэгч"}
                      </span>
                      {time && (
                        <span className="shrink-0 text-[10px] text-[#666]">
                          {formatDistanceToNow(time)}
                        </span>
                      )}
                    </div>
                    <div
                      className={`mt-0.5 truncate text-[12px] leading-snug ${
                        c.unreadCount > 0 ? "text-[#BBB]" : "text-[#666]"
                      }`}
                    >
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
  );
}

function TelegramPanel() {
  return (
    <div className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] p-5 md:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[4px] bg-gradient-to-br from-[#2AABEE] to-[#229ED9] shadow-[0_0_28px_rgba(42,171,238,0.3)]">
          <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.198 2.433a2.242 2.242 0 00-1.022.215l-16.5 7.5a2.25 2.25 0 00.126 4.147l4.012 1.484 1.48 4.012a2.25 2.25 0 004.148.126l7.5-16.5a2.25 2.25 0 00-.217-2.022 2.25 2.25 0 00-1.527-.962z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold tracking-[0.2em] text-[#2AABEE]">TELEGRAM · COMMUNITY</div>
          <h2 className="mt-1 text-[18px] font-black leading-tight text-[#E8E8E8]">
            Antaqor бүтээгчдийн чат
          </h2>
          <p className="mt-1.5 text-[12px] leading-relaxed text-[#888]">
            AI бүтээгчид, инженерүүд, антрепренёрууд хоорондоо шууд ярилцдаг нийтийн өрөө.
          </p>
        </div>
      </div>

      <ul className="mt-5 grid grid-cols-3 gap-2 text-center">
        <Stat label="Realtime" value="< 1s" />
        <Stat label="Хэлэлцүүлэг" value="24/7" />
        <Stat label="Үнэ" value="Үнэгүй" />
      </ul>

      <a
        href={TELEGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative mt-5 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-[4px] bg-[#2AABEE] px-6 py-3 text-[13px] font-black text-white shadow-[0_0_28px_rgba(42,171,238,0.25)] transition hover:shadow-[0_0_44px_rgba(42,171,238,0.4)]"
      >
        <span className="relative z-10">Telegram-аар нэгдэх</span>
        <svg className="relative z-10 h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
        <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      </a>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-[rgba(255,255,255,0.06)] pt-4 text-[11px]">
        <span className="text-[#666]">Telegram байхгүй?</span>
        <span className="flex gap-2">
          <a
            href="https://apps.apple.com/app/telegram-messenger/id686449807"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-2.5 py-1.5 text-[10px] font-bold text-[#AAA] transition hover:border-[rgba(42,171,238,0.4)] hover:text-[#2AABEE]"
          >
            iOS
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=org.telegram.messenger"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-2.5 py-1.5 text-[10px] font-bold text-[#AAA] transition hover:border-[rgba(42,171,238,0.4)] hover:text-[#2AABEE]"
          >
            Android
          </a>
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <li className="rounded-[4px] border border-[rgba(255,255,255,0.05)] bg-[#0A0A0A] py-2">
      <div className="text-[14px] font-black text-[#E8E8E8]">{value}</div>
      <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.15em] text-[#555]">{label}</div>
    </li>
  );
}

function SkeletonList() {
  return (
    <ul className="divide-y divide-[rgba(255,255,255,0.05)]">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i} className="flex items-center gap-3 px-3 py-3">
          <div className="h-11 w-11 shrink-0 animate-pulse rounded-[4px] bg-[#161618]" />
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
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414]">
        <svg className="h-5 w-5 text-[#888]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a8 8 0 01-12.3 6.7L3 20l1.3-5.4A8 8 0 1121 12z" />
        </svg>
      </div>
      <h3 className="text-[14px] font-black text-[#E8E8E8]">Шууд мессеж байхгүй</h3>
      <p className="mt-1.5 max-w-xs text-[12px] leading-relaxed text-[#777]">
        Antaqor доторх гишүүдтэй шууд ярилцаж эхлэе. Гишүүдийн хуудаснаас сонгож чат нээгээрэй.
      </p>
      <Link
        href="/members"
        className="mt-4 inline-flex items-center gap-1.5 rounded-[4px] bg-[#EF2C58] px-4 py-2 text-[12px] font-black text-white transition hover:bg-[#D4264E]"
      >
        Гишүүд харах
        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </Link>
    </div>
  );
}

function SignInCTA() {
  return (
    <div className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] p-8 text-center">
      <h3 className="text-[14px] font-black text-[#E8E8E8]">Чат ашиглахын тулд нэвтэрнэ үү</h3>
      <p className="mt-1.5 text-[12px] text-[#777]">
        Гишүүдтэй шууд ярилцахын тулд эхлээд бүртгэлдээ нэвтэрнэ үү.
      </p>
      <Link
        href="/auth/signin"
        className="mt-4 inline-flex items-center gap-1.5 rounded-[4px] bg-[#EF2C58] px-4 py-2 text-[12px] font-black text-white transition hover:bg-[#D4264E]"
      >
        Нэвтрэх
      </Link>
    </div>
  );
}
