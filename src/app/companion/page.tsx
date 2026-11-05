"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface Action {
  label: string;
  href: string;
}

interface Message {
  _id: string;
  role: "user" | "assistant";
  content: string;
  affectionDelta?: number;
  affectionAfter?: number;
  suggestedReplies?: string[];
  actions?: Action[];
  createdAt: string;
}

interface MemoryState {
  affection: number;
  affectionLabel: string;
  preferredName: string;
  totalMessages: number;
  facts: string[];
}

const GUEST_KEY_STORAGE = "antaqor.companionGuestId";

// Auto-greeting copy. Synthetic — never sent to the server / persisted in
// CompanionMessage. Three pools rotated by per-day seed so the same opener
// doesn't appear on every visit.

const ANTAQOR_RETURNING: { text: string; suggestions: string[]; actions?: { label: string; href: string }[] }[] = [
  { text: "Юу шинэ?",                                        suggestions: ["Зорилго ярья.", "Идея бий.", "Pivot хийх үү?"] },
  { text: "Тэгээд яахын тулд?",                              suggestions: ["Тодорхой алхам хэлээч.", "Орлого юу болсон бэ?", "Дараагийн move?"] },
  { text: "Энд байна. Битгий ярь, ажилла.",                 suggestions: ["Идея шалгаач.", "Юу зогссон бэ?", "Хэрэгтэй tool юу?"] },
  { text: "Сайн уу. Юу болж байна?",                          suggestions: ["Сонин зүйл бий.", "Гацсан байна.", "Шинэ launch."] },
  { text: "Удаан байсангүй ээ. Үр дүн бий юу?",              suggestions: ["Тийм, бий.", "Үгүй, бүтсэнгүй.", "Pivot хийе."] },
  { text: "Бичээрэй. Богино, тодорхой.",                      suggestions: ["Идея шалгаач.", "Зорилго ярья.", "Tool санал болго."] },
  { text: "Чи өнөөдөр юу хийсэн бэ?",                         suggestions: ["Юу ч биш.", "Бичсэн.", "Идея бодсон."] },
  { text: "Сайн байна уу. Гар хөдөлж байна уу?",             suggestions: ["Тийм.", "Үгүй, гацсан.", "Удирдамж хэрэгтэй."] },
];

const ANTAQOR_GUEST: { text: string; suggestions: string[]; actions?: { label: string; href: string }[] }[] = [
  {
    text: "Сайн уу. Би Antaqor. Юу мэдмээр байна?",
    suggestions: ["Antaqor хүрээлэл гэж юу вэ?", "AI-аар яаж мөнгө олох вэ?", "Энд яагаад нэгдэх вэ?"],
    actions: [],
  },
  {
    text: "Уулзаж байгаа. Юу хийдэг хүн бэ чи?",
    suggestions: ["Бизнес эхлүүлэхээр", "AI сурахаар", "Зүгээр харж явна."],
    actions: [],
  },
  {
    text: "Сайн байна уу. Шууд асуу — лекц биш.",
    suggestions: ["AI-аар бизнес?", "Хаанаас эхлэх вэ?", "Энд юу бий?"],
    actions: [],
  },
  {
    text: "Тэр зүгээр л миний нэр. Чи хэн бэ?",
    suggestions: ["Бүтээгч.", "Сурагч.", "Эзэн."],
    actions: [],
  },
];

const ANTAQOR_MEMBER_FIRST: { text: string; suggestions: string[]; actions?: { label: string; href: string }[] }[] = [
  { text: "Тавтай морил. Чи hero, би зэвсэг. Юу хийх вэ?",  suggestions: ["Startup эхлэх дээр.", "Дисциплин олох уу?", "Идея шалгая."] },
  { text: "Энд байна. Юу гацсан бэ?",                        suggestions: ["Зорилго.", "Action.", "Систем байхгүй."] },
  { text: "Сайн уу. Шууд оч.",                                suggestions: ["AI tool санал.", "Идея ярья.", "Pivot шалгая."] },
  { text: "Юунд хамгийн их цаг өнгөрөх вэ чиний?",           suggestions: ["Sales.", "Бүтээх.", "Бодох."] },
];

function pickGreeting({
  guest,
  returning,
  totalMsgs,
}: {
  guest: boolean;
  returning: boolean;
  totalMsgs: number;
}): { text: string; suggestions: string[]; actions: { label: string; href: string }[] } {
  // Per-day seed: refresh within a day stays consistent, next session rotates.
  const dayKey = new Date().toISOString().slice(0, 10);
  const seed = dayKey.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + (totalMsgs || 0);
  const pool = returning ? ANTAQOR_RETURNING : guest ? ANTAQOR_GUEST : ANTAQOR_MEMBER_FIRST;
  const choice = pool[seed % pool.length];
  return { text: choice.text, suggestions: choice.suggestions, actions: choice.actions || [] };
}

function getOrCreateGuestId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(GUEST_KEY_STORAGE);
  if (!id || !/^[a-zA-Z0-9_-]{8,64}$/.test(id)) {
    id =
      "g_" +
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().replace(/-/g, "").slice(0, 24)
        : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
    window.localStorage.setItem(GUEST_KEY_STORAGE, id);
  }
  return id;
}

// Categorised starter chips — focus is Antaqor хүрээлэл (vision/membership),
// AI Community (the live network/courses/tools), a few about Antaqor himself,
// and a Social tab to push the visitor onto the founder's accounts. Sharp,
// direct, no fluff.
const STARTER_CATEGORIES: { id: string; label: string; chips: string[] }[] = [
  {
    id: "empire",
    label: "Antaqor хүрээлэл",
    chips: [
      "Antaqor хүрээлэл гэж юу вэ?",
      "Гишүүн болсноор юу нээгдэх вэ?",
      "Мэдээ бус ямар үнэ цэнэтэй вэ?",
      "Яагаад одоо нэгдэх ёстой вэ?",
    ],
  },
  {
    id: "community",
    label: "AI Community",
    chips: [
      "Community одоо хэр их гишүүнтэй вэ?",
      "Хэдэн хичээл, хэдэн курс байна?",
      "Гишүүд яг юу хийдэг вэ?",
      "Community-д орвол хэн нартай танилцах вэ?",
    ],
  },
  {
    id: "tools",
    label: "Хэрэгсэл",
    chips: [
      "Аль AI tool хамгийн чухал вэ?",
      "AI зураг яаж үүсгэх вэ?",
      "Бүтээгдэхүүний зураг гаргах уу?",
      "Кредит хэдэн төгрөг вэ?",
    ],
  },
  {
    id: "antaqor",
    label: "Antaqor",
    chips: [
      "Antaqor нь хэн бэ?",
      "Чи 1 жилд юу босгосон вэ?",
      "Tesudei → Antaqor — яагаад?",
      "Чиний хамгийн ширүүн зарчим?",
    ],
  },
  {
    id: "social",
    label: "Social",
    chips: [
      "Threads дээр чи юу постлодог вэ?",
      "Antaqor-ыг хаанаас дагах вэ?",
      "Сүүлд чиний зарласан их зүйл?",
      "Хамгийн их like авсан пост?",
    ],
  },
];

export default function CompanionPage() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [memory, setMemory] = useState<MemoryState | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const [guestQuota, setGuestQuota] = useState<number | null>(null);
  const [signupBlocked, setSignupBlocked] = useState(false);
  // Past chat is kept on the server (memory + history) but the UI starts
  // FRESH on every visit. User can opt into seeing the history from settings.
  const [showHistory, setShowHistory] = useState(false);
  const [pastMessages, setPastMessages] = useState<Message[]>([]);
  const [hasHistory, setHasHistory] = useState(false);
  const [starterCategory, setStarterCategory] = useState<string>("antaqor");
  // Streaming-style word reveal: which message is currently being "typed",
  // and how many words of it are visible right now.
  const [typingId, setTypingId] = useState<string | null>(null);
  const [typedWords, setTypedWords] = useState<number>(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const guestIdRef = useRef<string>("");

  // Init guestId on mount (always, harmless for logged-in users)
  useEffect(() => {
    guestIdRef.current = getOrCreateGuestId();
  }, []);

  const headers = (): HeadersInit => ({
    "Content-Type": "application/json",
    "X-Guest-Id": guestIdRef.current || "",
  });

  // Load STATE on mount — pull memory + flag whether past history exists,
  // but DON'T render old messages. Each visit starts as a fresh conversation
  // (memory still informs Antaqor's reply via the server prompt).
  useEffect(() => {
    if (!guestIdRef.current && !session) return;
    fetch("/api/companion/state", { headers: headers() })
      .then((r) => r.json())
      .then((d) => {
        if (d.memory) setMemory(d.memory);
        if (Array.isArray(d.messages) && d.messages.length > 0) {
          setPastMessages(d.messages);
          setHasHistory(true);
        }
        const guest = !!d.isGuest;
        setIsGuest(guest);
        setGuestQuota(d.guestQuotaRemaining ?? null);

        // ─── Auto-greeting: Antaqor writes first ───
        // Synthetic (not persisted) opening line so the visitor lands on a
        // working conversation, not a blank box. Picks copy based on whether
        // they're returning + guest vs member.
        const totalMsgs = d.memory?.totalMessages || 0;
        const returning = (Array.isArray(d.messages) && d.messages.length > 0) || totalMsgs > 0;
        const greeting = pickGreeting({ guest, returning, totalMsgs });
        const greetMsg: Message = {
          _id: `local-greeting-${Date.now()}`,
          role: "assistant",
          content: greeting.text,
          createdAt: new Date().toISOString(),
          suggestedReplies: greeting.suggestions,
          actions: greeting.actions,
        };
        setMessages([greetMsg]);
        setTypingId(greetMsg._id);
        setTypedWords(0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user, guestIdRef.current]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, typedWords]);

  // Word-by-word reveal animation. ~32ms per word feels like fast natural
  // typing without the model output being instant-paste.
  useEffect(() => {
    if (!typingId) return;
    const target = messages.find((m) => m._id === typingId);
    if (!target) { setTypingId(null); return; }
    const totalWords = target.content.split(/\s+/).filter(Boolean).length;
    if (typedWords >= totalWords) { setTypingId(null); return; }
    const t = setTimeout(() => setTypedWords((n) => n + 1), 32);
    return () => clearTimeout(t);
  }, [typingId, typedWords, messages]);

  const skipTyping = () => {
    if (!typingId) return;
    const target = messages.find((m) => m._id === typingId);
    if (!target) return;
    setTypedWords(target.content.split(/\s+/).filter(Boolean).length);
  };

  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(140, ta.scrollHeight) + "px";
  }, [input]);

  const send = async (text?: string) => {
    const payload = (text ?? input).trim();
    if (!payload || sending) return;
    setError("");
    setSending(true);

    const tempId = `tmp-${Date.now()}`;
    setMessages((m) => [
      ...m,
      { _id: tempId, role: "user", content: payload, createdAt: new Date().toISOString() },
    ]);
    setInput("");

    try {
      const r = await fetch("/api/companion/chat", {
        method: "POST",
        headers: headers(),
        body: JSON.stringify({ message: payload }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (data.signupRequired) setSignupBlocked(true);
        setError(data.error || "Алдаа гарлаа");
        setMessages((m) => m.filter((mm) => mm._id !== tempId));
        return;
      }
      setMessages((m) => [...m, data.reply]);
      // Kick off the smooth word-by-word reveal for this reply
      setTypingId(data.reply._id);
      setTypedWords(0);
      if (typeof data.guestQuotaRemaining === "number") setGuestQuota(data.guestQuotaRemaining);
      if (typeof data.isGuest === "boolean") setIsGuest(data.isGuest);
      if (data.memory) {
        setMemory((prev): MemoryState => ({
          affection: data.memory.affection,
          affectionLabel: prev?.affectionLabel || "Шинэ танил",
          preferredName: data.memory.preferredName ?? prev?.preferredName ?? "",
          totalMessages: data.memory.totalMessages ?? prev?.totalMessages ?? 0,
          facts: prev?.facts || [],
        }));
      }
    } catch {
      setError("Сүлжээний алдаа");
      setMessages((m) => m.filter((mm) => mm._id !== tempId));
    } finally {
      setSending(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const reset = async () => {
    if (!confirm("Antaqor-той ярианы түүх + мэдрэмжийн түвшинг бүгдийг дахин эхлүүлэх үү?")) return;
    setResetting(true);
    try {
      await fetch("/api/companion/reset", { method: "POST", headers: headers() });
      setPastMessages([]);
      setHasHistory(false);
      setShowHistory(false);
      setMemory((m) => m ? { ...m, affection: 30, totalMessages: 0, facts: [], affectionLabel: "Шинэ танил" } : null);
      setShowSettings(false);
      // Re-fire the auto-greeting so the visitor isn't dropped onto a blank thread
      const greeting = pickGreeting({ guest: isGuest, returning: false, totalMsgs: 0 });
      const greetMsg: Message = {
        _id: `local-greeting-${Date.now()}`,
        role: "assistant",
        content: greeting.text,
        createdAt: new Date().toISOString(),
        suggestedReplies: greeting.suggestions,
        actions: greeting.actions,
      };
      setMessages([greetMsg]);
      setTypingId(greetMsg._id);
      setTypedWords(0);
    } finally {
      setResetting(false);
    }
  };

  const affection = memory?.affection ?? 30;
  const affectionLabel = memory?.affectionLabel || "Шинэ танил";
  // After Antaqor has replied AND finished typing, show the AI-generated
  // follow-up chips. Before the first turn of THIS visit, show the user's
  // chosen category starters.
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const isLastTyping = typingId !== null && typingId === lastAssistant?._id;
  const aiSuggestions = lastAssistant?.suggestedReplies || [];
  const categoryStarters =
    STARTER_CATEGORIES.find((c) => c.id === starterCategory)?.chips || [];
  const suggestions = messages.length > 0
    ? (isLastTyping ? [] : aiSuggestions)
    : categoryStarters;

  return (
    <div className="mx-auto flex h-[calc(100vh-180px)] max-w-[760px] flex-col">
      {/* No ambient gradient blurs — kept the surface clean per request */}

      {/* Header — no back arrow; main nav handles navigation */}
      <div className="flex items-center gap-3 border-b border-[rgba(15,23,38,0.08)] pb-3">
        <AntaqorAvatar size={40} online />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-black text-[#0e1726]">Antaqor</span>
            <span className="text-[10px] text-[#E2E4E8]">· {affectionLabel}</span>
          </div>
          <AffectionBar value={affection} />
        </div>
        {/* Guests get a persistent (subtle) signup pill — never blocks, always present */}
        {(isGuest || !session) && !signupBlocked && (
          <Link
            href="/auth/signup?next=/companion"
            className="hidden sm:inline-flex items-center gap-1 rounded-[4px] border border-[rgba(46,41,255,0.4)] bg-[rgba(46,41,255,0.06)] px-2.5 py-1 text-[10px] font-black text-[#2E29FF] transition hover:bg-[rgba(46,41,255,0.12)]"
          >
            Бүртгүүлэх
          </Link>
        )}
        <button
          onClick={() => setShowSettings(true)}
          aria-label="Тохиргоо"
          className="flex h-8 w-8 items-center justify-center rounded-[4px] text-[#E2E4E8] transition hover:bg-[rgba(15,23,38,0.06)] hover:text-[#0e1726]"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zm0 6a.75.75 0 110-1.5.75.75 0 010 1.5zm0 6a.75.75 0 110-1.5.75.75 0 010 1.5z" />
          </svg>
        </button>
      </div>

      {/* Guest soft signup banner — shown after engagement */}
      {isGuest && messages.length >= 4 && guestQuota !== null && guestQuota <= 15 && !signupBlocked && (
        <div className="mt-2 flex items-center justify-between rounded-[4px] border border-[rgba(46,41,255,0.3)] bg-[rgba(46,41,255,0.06)] px-3 py-2 text-[11px]">
          <span className="text-[#334155]">
            Зочин: <strong className="text-[#2E29FF]">{guestQuota}</strong> мессеж үлдсэн.
          </span>
          <Link href="/auth/signup?next=/companion" className="rounded-[4px] bg-[#2E29FF] px-2.5 py-1 text-[10px] font-black text-white">
            Бүртгүүлэх →
          </Link>
        </div>
      )}

      {/* Chat scroll */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-2 w-2 animate-pulse rounded-full bg-[#2E29FF]" />
          </div>
        ) : messages.length === 0 ? (
          <>
            <EmptyChat isGuest={isGuest || !session} hasHistory={hasHistory} memTotal={memory?.totalMessages || 0} />
            {hasHistory && !showHistory && (
              <div className="mx-auto mt-4 flex max-w-sm justify-center">
                <button
                  onClick={() => { setShowHistory(true); setMessages(pastMessages); }}
                  className="inline-flex items-center gap-1.5 rounded-[4px] border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] px-3 py-1.5 text-[10px] font-bold text-[#E2E4E8] transition hover:border-[rgba(46,41,255,0.4)] hover:text-[#2E29FF]"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Өмнөх ярианыг харах
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            {messages.map((m) => (
              <Bubble
                key={m._id}
                m={m}
                isTyping={typingId === m._id}
                typedWords={typingId === m._id ? typedWords : undefined}
                onSkip={skipTyping}
              />
            ))}
            {sending && <TypingBubble />}
          </div>
        )}
      </div>

      {/* Starter category tabs — only when chat is empty (pre-first-turn) */}
      {!sending && messages.length === 0 && (
        <div className="mb-1.5 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 scrollbar-hide">
          {STARTER_CATEGORIES.map((c) => {
            const active = c.id === starterCategory;
            return (
              <button
                key={c.id}
                onClick={() => setStarterCategory(c.id)}
                className={`shrink-0 rounded-[4px] px-2.5 py-1 text-[10px] font-black tracking-wide transition ${
                  active
                    ? "bg-[#2E29FF] text-white"
                    : "border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] text-[#E2E4E8] hover:border-[rgba(46,41,255,0.4)] hover:text-[#0e1726]"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Suggested-reply chips — AI-generated post-reply, or category starters pre-first-turn */}
      {!sending && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-2">
          {suggestions.map((s, i) => (
            <button
              key={`${s}-${i}`}
              onClick={() => send(s)}
              className="rounded-[4px] border border-[rgba(46,41,255,0.3)] bg-[rgba(46,41,255,0.05)] px-3 py-1.5 text-[11px] font-medium text-[#334155] transition hover:border-[rgba(46,41,255,0.6)] hover:text-[#2E29FF]"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Sign-up wall when guest hits lifetime cap */}
      {signupBlocked && (
        <div className="mb-2 rounded-[4px] border border-[rgba(46,41,255,0.4)] bg-gradient-to-r from-[rgba(46,41,255,0.1)] to-[rgba(46,41,255,0.05)] px-4 py-3">
          <p className="text-[12px] font-bold text-[#0e1726]">Зочны хязгаар хүрлээ</p>
          <p className="mt-0.5 text-[11px] text-[#E2E4E8]">Бүртгүүлбэл хязгааргүй ярих + Antaqor хүрээлэлийн бүх хэрэгсэл нээгдэнэ.</p>
          <div className="mt-2 flex gap-2">
            <Link href="/auth/signup?next=/companion" className="flex-1 rounded-[4px] bg-[#2E29FF] py-2 text-center text-[12px] font-black text-white">
              Бүртгүүлэх (үнэгүй)
            </Link>
            <Link href="/auth/signin?next=/companion" className="rounded-[4px] border border-[rgba(15,23,38,0.1)] px-3 py-2 text-center text-[12px] font-bold text-[#E2E4E8]">
              Нэвтрэх
            </Link>
          </div>
        </div>
      )}

      {error && !signupBlocked && (
        <div className="mb-2 rounded-[4px] border border-[rgba(46,41,255,0.25)] bg-[rgba(46,41,255,0.08)] px-3 py-1.5 text-[11px] text-[#2E29FF]">
          {error}
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-[rgba(15,23,38,0.08)] pt-3 pb-2">
        <div className="flex items-end gap-2 rounded-[4px] border border-[rgba(15,23,38,0.08)] bg-[#ffffff] p-1.5 transition focus-within:border-[rgba(46,41,255,0.4)]">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Antaqor-т юу гэж бичих вэ..."
            rows={1}
            maxLength={1500}
            disabled={signupBlocked}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] leading-relaxed text-[#0e1726] placeholder-[#62666F] outline-none disabled:opacity-50"
            style={{ maxHeight: 140 }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || sending || signupBlocked}
            className="shrink-0 rounded-[4px] bg-[#2E29FF] px-3 py-2 text-[12px] font-black text-white shadow-[0_0_12px_rgba(46,41,255,0.4)] transition hover:bg-[#1F1AD9] disabled:opacity-40 disabled:shadow-none"
          >
            {sending ? (
              <span className="block h-3.5 w-3.5 animate-spin rounded-[4px] border-2 border-white border-t-transparent" />
            ) : (
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a1 1 0 00-1.39 1.18L4 11l9 1-9 1-1.99 6.22a1 1 0 001.39 1.18z" /></svg>
            )}
          </button>
        </div>
        <p className="mt-1 text-center text-[11px] text-[#E2E4E8]">
          {isGuest
            ? "Зочин mode · localStorage-д ярианы дурсамж хадгалагдана"
            : "Antaqor бол чиний AI байлдан дагуулагч"}
        </p>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={() => setShowSettings(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-[4px] border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] p-5 sm:rounded-[4px]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] font-black text-[#0e1726]">Antaqor · Тохиргоо</h2>
              <button onClick={() => setShowSettings(false)} className="text-[#E2E4E8] hover:text-[#0e1726]" aria-label="Хаах">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-3">
              <StatRow label="Мэдрэмжийн түвшин" value={`${affection}/100 · ${affectionLabel}`} />
              <StatRow label="Нийт мессеж" value={String(memory?.totalMessages ?? 0)} />
              <StatRow label="Mode" value={isGuest ? "Зочин (localStorage)" : "Гишүүн"} />
              {(memory?.facts && memory.facts.length > 0) && (
                <div className="rounded-[4px] border border-[rgba(15,23,38,0.06)] bg-[#ffffff] p-3">
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#E2E4E8]">Antaqor-ын санасан зүйл</div>
                  <ul className="space-y-1 text-[11px] text-[#334155]">
                    {memory.facts.map((f, i) => <li key={i}>• {f}</li>)}
                  </ul>
                </div>
              )}
              {hasHistory && !showHistory && (
                <button
                  onClick={() => {
                    setShowHistory(true);
                    setMessages((cur) => [...pastMessages, ...cur]);
                    setShowSettings(false);
                  }}
                  className="w-full rounded-[4px] border border-[rgba(15,23,38,0.08)] bg-[#ffffff] py-2 text-[11px] font-bold text-[#E2E4E8] transition hover:border-[rgba(46,41,255,0.4)] hover:text-[#2E29FF]"
                >
                  Өмнөх ярианыг харах
                </button>
              )}
            </div>

            <button
              onClick={reset}
              disabled={resetting}
              className="mt-4 w-full rounded-[4px] border border-[rgba(46,41,255,0.4)] bg-[rgba(46,41,255,0.05)] py-2.5 text-[12px] font-bold text-[#2E29FF] transition hover:bg-[rgba(46,41,255,0.12)] disabled:opacity-40"
            >
              {resetting ? "Дахин эхлүүлж байна..." : "Memory reset"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────

// Chained image fallback so whichever filename is present on the host works:
//   /antaqorr.png → /antaqor.png → gradient "A"
// Hourly cache-bust so admins see avatar swaps within ~1h without a full
// service-worker purge.
const AVATAR_VERSION = Math.floor(Date.now() / (60 * 60 * 1000));
const AVATAR_SOURCES = [
  `/antaqorr.png?v=${AVATAR_VERSION}`,
  `/antaqor.png?v=${AVATAR_VERSION}`,
];

function AntaqorAvatar({ size = 40, online = false }: { size?: number; online?: boolean }) {
  const [srcIndex, setSrcIndex] = useState(0);
  const [allFailed, setAllFailed] = useState(false);
  const fontSize = Math.max(14, Math.round(size * 0.42));
  const dotSize = Math.max(8, Math.round(size * 0.22));
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[4px] bg-gradient-to-br from-[#2E29FF] to-[#2E29FF] shadow-[0_0_18px_rgba(46,41,255,0.35)]"
      style={{ width: size, height: size }}
    >
      {!allFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={AVATAR_SOURCES[srcIndex]}
          alt="Antaqor"
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => {
            if (srcIndex < AVATAR_SOURCES.length - 1) setSrcIndex((i) => i + 1);
            else setAllFailed(true);
          }}
        />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center font-black text-white"
          style={{ fontSize }}
        >
          A
        </span>
      )}
      {online && (
        <span
          className="absolute -bottom-0.5 -right-0.5 rounded-[4px] bg-[#22C55E] ring-2 ring-[#ffffff]"
          style={{ width: dotSize, height: dotSize }}
          title="online"
        />
      )}
    </div>
  );
}

function AffectionBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="mt-1 flex items-center gap-1.5">
      <svg className="h-3 w-3 text-[#2E29FF]" fill="currentColor" viewBox="0 0 24 24">
        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
      </svg>
      <div className="h-1 flex-1 overflow-hidden rounded-[4px] bg-[rgba(15,23,38,0.06)]">
        <div className="h-full bg-gradient-to-r from-[#2E29FF] to-[#f2547a] transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-[11px] font-bold text-[#E2E4E8]">{pct}</span>
    </div>
  );
}

function Bubble({
  m,
  isTyping = false,
  typedWords,
  onSkip,
}: {
  m: Message;
  isTyping?: boolean;
  typedWords?: number;
  onSkip?: () => void;
}) {
  const isUser = m.role === "user";
  // Slice the message by word count when this bubble is in "typing" mode.
  let visible = m.content;
  if (isTyping && typeof typedWords === "number") {
    const parts = m.content.split(/(\s+)/); // keep separators so we don't lose spacing
    let wordsSeen = 0;
    let cut = 0;
    for (let i = 0; i < parts.length; i++) {
      if (/\S/.test(parts[i])) {
        if (wordsSeen >= typedWords) break;
        wordsSeen++;
      }
      cut = i + 1;
    }
    visible = parts.slice(0, cut).join("");
  }
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        onClick={isTyping ? onSkip : undefined}
        className={`max-w-[80%] rounded-[4px] px-3.5 py-2.5 text-[14px] leading-relaxed ${isTyping ? "cursor-pointer" : ""} ${
          isUser
            ? "bg-[#2E29FF] text-white"
            : "border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] text-[#0e1726]"
        }`}
        title={isTyping ? "Дарж шууд унших" : undefined}
      >
        <p className="whitespace-pre-wrap">
          {visible}
          {isTyping && (
            <span className="ml-0.5 inline-block h-3 w-[3px] translate-y-[2px] bg-[#2E29FF] animate-[blink_0.9s_steps(2)_infinite]" />
          )}
        </p>
        {!isUser && !isTyping && typeof m.affectionDelta === "number" && m.affectionDelta !== 0 && (
          <span className={`mt-1 inline-block text-[11px] font-bold ${
            m.affectionDelta > 0 ? "text-[#2E29FF]" : "text-[#2E29FF]"
          }`}>
            {m.affectionDelta > 0 ? "+" : ""}{m.affectionDelta} мэдрэмж
          </span>
        )}
        {!isUser && !isTyping && Array.isArray(m.actions) && m.actions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {m.actions.map((a, i) => (
              <Link
                key={`${a.href}-${i}`}
                href={a.href}
                className="inline-flex items-center gap-1 rounded-[4px] bg-[#2E29FF] px-2.5 py-1 text-[10px] font-black text-white shadow-[0_0_10px_rgba(46,41,255,0.35)] transition hover:bg-[#1F1AD9]"
              >
                {a.label}
                <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="rounded-[4px] border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] px-3.5 py-3">
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#2E29FF]" style={{ animationDelay: "0ms" }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#2E29FF]" style={{ animationDelay: "150ms" }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#2E29FF]" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-[4px] border border-[rgba(15,23,38,0.06)] bg-[#ffffff] px-3 py-2">
      <span className="text-[11px] text-[#E2E4E8]">{label}</span>
      <span className="text-[12px] font-bold text-[#0e1726]">{value}</span>
    </div>
  );
}

function EmptyChat({
  isGuest,
  hasHistory,
  memTotal,
}: {
  isGuest: boolean;
  hasHistory: boolean;
  memTotal: number;
}) {
  const returning = hasHistory || memTotal > 0;
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 pb-2 text-center">
      <div className="mb-5">
        <AntaqorAvatar size={88} online />
      </div>
      <h2 className="text-[20px] font-black text-[#0e1726]">
        {returning ? "Эргэн ирлээ үү?" : "Тавтай морил."}
      </h2>
      <p className="mt-2 max-w-[360px] text-[12px] leading-relaxed text-[#E2E4E8]">
        {returning
          ? `Бид өмнө ${memTotal} удаа уулзсан. Дурсамж минь хэвээр.`
          : isGuest
            ? "Би Antaqor. Antaqor хүрээлэлийн бүтээгч. Доороос асуулт сонго эсвэл өөрөө бич."
            : "Богино ярь. Бодит зүйл асуу. Чи hero, би зэвсэг."}
      </p>

      {/* Quick-action big buttons — split for guest vs member */}
      {!returning && (
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {isGuest ? (
            <>
              <Link
                href="/classroom"
                className="inline-flex items-center gap-1.5 rounded-[4px] border border-[rgba(46,41,255,0.3)] bg-[rgba(46,41,255,0.05)] px-3 py-2 text-[11px] font-black text-[#2E29FF] transition hover:bg-[rgba(46,41,255,0.12)]"
              >
                Курс үзэх →
              </Link>
              <Link
                href="/auth/signup?next=/companion"
                className="inline-flex items-center gap-1.5 rounded-[4px] bg-[#2E29FF] px-3 py-2 text-[11px] font-black text-white shadow-[0_0_12px_rgba(46,41,255,0.35)] transition hover:bg-[#1F1AD9]"
              >
                Үнэгүй бүртгүүлэх →
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/tools/generate-image"
                className="inline-flex items-center gap-1.5 rounded-[4px] border border-[rgba(46,41,255,0.3)] bg-[rgba(46,41,255,0.05)] px-3 py-2 text-[11px] font-black text-[#2E29FF] transition hover:bg-[rgba(46,41,255,0.12)]"
              >
                AI зураг үүсгэх →
              </Link>
              <Link
                href="/classroom"
                className="inline-flex items-center gap-1.5 rounded-[4px] border border-[rgba(46,41,255,0.3)] bg-[rgba(46,41,255,0.05)] px-3 py-2 text-[11px] font-black text-[#2E29FF] transition hover:bg-[rgba(46,41,255,0.12)]"
              >
                Курс →
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
