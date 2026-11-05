"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { formatDistanceToNow } from "@/lib/utils";

/* ─── ЧАТЫН ЖАГСААЛТ — Instagram DM маяг (2026-10-06) ──────────────────────
   ChatShell (layout) дотор ЗҮҮН багана: ширээн дээр үргэлж харагдаж, баруун
   талд нээлттэй яриа сууна; утсан дээр /chat-д л бүтэн дэлгэцээр гарна.

   Instagram-аас авсан зүйлс: "Мессеж" гарчиг + бичих дүрс, дугуй хайлтын
   талбар, хоёр чип (Бүгд / Уншаагүй — Instagram-ын Inbox/Requests-ийн
   оронд; бидэнд "хүсэлт" гэсэн ойлголт байхгүй), дугуй аватар,
   "мессеж · хугацаа" нэг мөрөнд, уншаагүйд цэнхэр цэг.

   Админ руу бичих мөр нь ЖАГСААЛТЫН ЭХНИЙ МӨР болж үлдсэн — тусламж нь
   сайтаас гадагш биш, яг энэ inbox дотор байх ёстой (2026-09 шийдвэр). */

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

function Avatar({ src, name, size = 56 }: { src?: string; name?: string; size?: number }) {
  const initials =
    name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full text-[15px] font-bold"
      style={{ width: size, height: size, background: "var(--nav-hover-bg, #FFFFFF)", color: "var(--t-sub, #565967)" }}
    >
      {initials}
    </span>
  );
}

export default function ChatHub() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [adminBusy, setAdminBusy] = useState(false);
  const [adminErr, setAdminErr] = useState("");

  /* Админтай яриа нээх. Админы id-г сервер өөрөө олно (`/api/chat/admin`);
     яриа аль хэдийн байвал түүнийг нь нээнэ. */
  const dmAdmin = async () => {
    if (adminBusy) return;
    setAdminBusy(true);
    setAdminErr("");
    try {
      const r = await fetch("/api/chat/admin", { method: "POST" });
      const d = await r.json();
      if (!r.ok || !d.conversationId) {
        setAdminErr(
          d?.error === "admin_unavailable"
            ? "Админ түр боломжгүй байна."
            : "Яриа нээж чадсангүй. Дахин оролдоно уу."
        );
        return;
      }
      router.push(`/chat/${d.conversationId}`);
    } catch {
      setAdminErr("Сүлжээний алдаа.");
    } finally {
      setAdminBusy(false);
    }
  };

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

  const unreadTotal = useMemo(
    () => conversations.filter((c) => c.unreadCount > 0).length,
    [conversations]
  );

  const filtered = useMemo(() => {
    let list = tab === "unread" ? conversations.filter((c) => c.unreadCount > 0) : conversations;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((c) =>
        c.participants.some((p) => p._id !== userId && p.name?.toLowerCase().includes(q))
      );
    }
    return list;
  }, [conversations, query, tab, userId]);

  const chip = (id: "all" | "unread", label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      aria-pressed={tab === id}
      className="h-9 rounded-full border px-4 text-[13.5px] font-semibold transition"
      style={
        tab === id
          ? { background: "var(--nav-fg-strong, #FFFFFF)", color: "var(--l-canvas, #0A0A0A)", borderColor: "transparent" }
          : { background: "transparent", color: "var(--nav-fg-strong, #FFFFFF)", borderColor: "var(--line, rgba(255,255,255,0.12))" }
      }
    >
      {label}
    </button>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Гарчиг + бичих дүрс */}
      <div className="flex items-center justify-between px-5 pb-4 pt-5">
        <h1 className="text-[22px] font-bold text-[var(--nav-fg-strong)]">Мессеж</h1>
        <Link
          href="/members"
          aria-label="Шинэ мессеж"
          title="Шинэ мессеж"
          className="press flex h-10 w-10 items-center justify-center rounded-full text-[var(--nav-fg-strong)] transition hover:bg-[var(--nav-hover-bg)]"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M12 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
            <path d="M18.4 2.6a2 2 0 0 1 2.9 2.9L12 14.8l-3.6.8.8-3.6z" />
          </svg>
        </Link>
      </div>

      {/* Хайлт — дугуй талбар */}
      <div className="px-5">
        <label className="flex h-11 items-center gap-2.5 rounded-full px-4" style={{ background: "var(--nav-hover-bg, #FFFFFF)" }}>
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] shrink-0 text-[var(--t-sub,#9C9CA6)]" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Хайх"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-[var(--nav-fg-strong)] outline-none placeholder:text-[var(--t-sub,#9C9CA6)]"
          />
        </label>
      </div>

      <div className="flex gap-2 px-5 pb-2 pt-4">
        {chip("all", "Бүгд")}
        {chip("unread", unreadTotal > 0 ? `Уншаагүй · ${unreadTotal}` : "Уншаагүй")}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-24 lg:pb-4">
        {/* Админ — үргэлж эхэнд */}
        {tab === "all" && !query && (
          <button
            type="button"
            onClick={dmAdmin}
            disabled={adminBusy}
            className="flex w-full items-center gap-3.5 px-5 py-3 text-left transition hover:bg-[var(--nav-hover-bg)] disabled:opacity-50"
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#2E29FF] text-[18px] font-black text-white">
              A
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-[var(--nav-fg-strong)]">
                {adminBusy ? "Нээж байна…" : "Antaqor админ"}
              </span>
              <span className="block truncate text-[14px] text-[var(--t-sub,#9C9CA6)]">
                Асуулт, төлбөр, гишүүнчлэл — шууд бич
              </span>
            </span>
          </button>
        )}
        {adminErr && <div className="px-5 pb-2 text-[12.5px] text-[#D81B4A]">{adminErr}</div>}

        {loading ? (
          <ul>
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="flex items-center gap-3.5 px-5 py-3">
                <div className="h-14 w-14 shrink-0 animate-pulse rounded-full" style={{ background: "var(--nav-hover-bg, #FFFFFF)" }} />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-1/3 animate-pulse rounded-full" style={{ background: "var(--nav-hover-bg, #FFFFFF)" }} />
                  <div className="h-3 w-2/3 animate-pulse rounded-full" style={{ background: "var(--nav-hover-bg, #FFFFFF)" }} />
                </div>
              </li>
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-[14px] text-[var(--t-sub,#9C9CA6)]">
            {query
              ? `«${query}» нэртэй яриа олдсонгүй`
              : tab === "unread"
                ? "Уншаагүй мессеж алга."
                : (
                  <>
                    Яриа алга байна.{" "}
                    <Link href="/members" className="font-semibold text-[#2E29FF]">Гишүүд харах</Link>
                  </>
                )}
          </div>
        ) : (
          <ul>
            {filtered.map((c) => {
              const other = c.participants.find((p) => p._id !== userId) ?? c.participants[0];
              const time = c.lastMessageAt || c.updatedAt;
              const unread = c.unreadCount > 0;
              const active = pathname === `/chat/${c._id}`;
              return (
                <li key={c._id}>
                  <Link
                    href={`/chat/${c._id}`}
                    className="flex items-center gap-3.5 px-5 py-3 transition hover:bg-[var(--nav-hover-bg)]"
                    style={active ? { background: "var(--nav-hover-bg, #FFFFFF)" } : undefined}
                  >
                    <Avatar src={other?.avatar} name={other?.name} />
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-[15px] text-[var(--nav-fg-strong)] ${unread ? "font-bold" : "font-semibold"}`}>
                        {other?.name || "Хэрэглэгч"}
                      </div>
                      <div className="flex min-w-0 items-baseline gap-1 text-[14px]">
                        <span
                          className={`truncate ${unread ? "font-semibold" : ""}`}
                          style={{ color: unread ? "var(--nav-fg-strong, #FFFFFF)" : "var(--t-sub, #9C9CA6)" }}
                        >
                          {c.lastMessage || "Чат эхлүүлээрэй"}
                        </span>
                        {time && (
                          <span className="shrink-0" style={{ color: "var(--t-sub, #565967)" }}>
                            · {formatDistanceToNow(time)}
                          </span>
                        )}
                      </div>
                    </div>
                    {unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[#2E29FF]" aria-label="Уншаагүй" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
