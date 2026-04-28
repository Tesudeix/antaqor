"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface Action { label: string; href: string }
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

const GUEST_KEY_STORAGE = "antaqor.budjargalGuestId";
const ACCENT = "#6366F1"; // indigo — calmer counterpoint to Antaqor's #EF2C58
const ACCENT_SOFT = "rgba(99,102,241,0.08)";
const ACCENT_BORDER = "rgba(99,102,241,0.3)";

function getOrCreateGuestId(): string {
  if (typeof window === "undefined") return "";
  let id = window.localStorage.getItem(GUEST_KEY_STORAGE);
  if (!id || !/^[a-zA-Z0-9_-]{8,64}$/.test(id)) {
    id = "g_" + (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 24)
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
    window.localStorage.setItem(GUEST_KEY_STORAGE, id);
  }
  return id;
}

function pickGreeting({ guest, returning, totalMsgs }: { guest: boolean; returning: boolean; totalMsgs: number }): {
  text: string; suggestions: string[]; actions: Action[];
} {
  if (returning) {
    return {
      text: `Эргэн ирлээ үү. Бид өмнө ${totalMsgs} удаа ярьсан. Чимээгүй сэтгэлийн хаалга үргэлж нээлттэй.`,
      suggestions: ["Бясалгал хийе.", "Сэтгэл маань үймсэн.", "Юунаас эхлэх вэ?"],
      actions: [],
    };
  }
  if (guest) {
    return {
      text: "Сайн уу. Би Буджаргал. Гүйж бясалгадаг хүн. Юу мэдэх гэсэн юм, шууд асуу.",
      suggestions: ["Чи хэн бэ?", "Гүйлтийн бясалгал гэж юу вэ?", "Бодлоосоо яаж салах вэ?"],
      actions: [],
    };
  }
  return {
    text: "Тавтай морил. Энэ цаг зөвхөн чинийх. Юу хэлэх вэ?",
    suggestions: ["Сэтгэлийн төлөв муу байна.", "Дисциплин олох уу?", "Бясалгал заа."],
    actions: [],
  };
}

const STARTER_CATEGORIES = [
  {
    id: "self",
    label: "Өөрийгөө",
    chips: ["Өөрийгөө яаж ялах вэ?", "Хэн би гэдгээ яаж олох вэ?", "Өөрийгөө хатуу шалгах уу?"],
  },
  {
    id: "meditation",
    label: "Бясалгал",
    chips: ["Гүйлтийн бясалгал гэж юу вэ?", "Бодлоосоо яаж салах вэ?", "Эхлэгчдэд practice байна уу?"],
  },
  {
    id: "discipline",
    label: "Дисциплин",
    chips: ["Дисциплинийг яаж тогтоох вэ?", "Уйдвал юу хийх вэ?", "Бууж өгөх дургүй болсон."],
  },
  {
    id: "life",
    label: "Амьдрал",
    chips: ["Энэ ертөнцөд яагаад ирсэн вэ?", "Нэгэн өдөр алдах гэж бид яагаад зүтгэдэг вэ?", "Айдсаасаа яаж салах вэ?"],
  },
  {
    id: "story",
    label: "Чиний түүх",
    chips: ["10 хоногт 1315 км гүйх ямар санагддаг?", "Бурхны тамга гэж юу вэ?", "Хэт ультра-д яаж бэлдэх вэ?"],
  },
];

export default function BudjargalPage() {
  const { data: session, status } = useSession();
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
  const [hasHistory, setHasHistory] = useState(false);
  const [pastMessages, setPastMessages] = useState<Message[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [starterCategory, setStarterCategory] = useState<string>("self");
  const [typingId, setTypingId] = useState<string | null>(null);
  const [typedWords, setTypedWords] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const guestIdRef = useRef<string>("");

  useEffect(() => { guestIdRef.current = getOrCreateGuestId(); }, []);

  const headers = (): HeadersInit => ({
    "Content-Type": "application/json",
    "X-Guest-Id": guestIdRef.current || "",
  });

  useEffect(() => {
    if (!guestIdRef.current && !session) return;
    fetch("/api/budjargal/state", { headers: headers() })
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

  useEffect(() => {
    const ta = inputRef.current; if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(140, ta.scrollHeight) + "px";
  }, [input]);

  // Word-by-word typing — slower than Antaqor (40ms) — meditative pacing
  useEffect(() => {
    if (!typingId) return;
    const target = messages.find((m) => m._id === typingId);
    if (!target) { setTypingId(null); return; }
    const totalWords = target.content.split(/\s+/).filter(Boolean).length;
    if (typedWords >= totalWords) { setTypingId(null); return; }
    const t = setTimeout(() => setTypedWords((n) => n + 1), 40);
    return () => clearTimeout(t);
  }, [typingId, typedWords, messages]);

  const skipTyping = () => {
    if (!typingId) return;
    const target = messages.find((m) => m._id === typingId);
    if (!target) return;
    setTypedWords(target.content.split(/\s+/).filter(Boolean).length);
  };

  const send = async (text?: string) => {
    const payload = (text ?? input).trim();
    if (!payload || sending) return;
    setError("");
    setSending(true);

    const tempId = `tmp-${Date.now()}`;
    setMessages((m) => [...m, { _id: tempId, role: "user", content: payload, createdAt: new Date().toISOString() }]);
    setInput("");

    try {
      const r = await fetch("/api/budjargal/chat", {
        method: "POST", headers: headers(), body: JSON.stringify({ message: payload }),
      });
      const data = await r.json();
      if (!r.ok) {
        if (data.signupRequired) setSignupBlocked(true);
        setError(data.error || "Алдаа гарлаа");
        setMessages((m) => m.filter((mm) => mm._id !== tempId));
        return;
      }
      setMessages((m) => [...m, data.reply]);
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
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const reset = async () => {
    if (!confirm("Ярианы түүх бүгдийг дахин эхлүүлэх үү?")) return;
    setResetting(true);
    try {
      await fetch("/api/budjargal/reset", { method: "POST", headers: headers() });
      setPastMessages([]);
      setHasHistory(false);
      setShowHistory(false);
      setMemory((m) => m ? { ...m, affection: 30, totalMessages: 0, facts: [], affectionLabel: "Шинэ танил" } : null);
      setShowSettings(false);
      const greeting = pickGreeting({ guest: isGuest, returning: false, totalMsgs: 0 });
      const greetMsg: Message = {
        _id: `local-greeting-${Date.now()}`, role: "assistant", content: greeting.text,
        createdAt: new Date().toISOString(),
        suggestedReplies: greeting.suggestions, actions: greeting.actions,
      };
      setMessages([greetMsg]);
      setTypingId(greetMsg._id);
      setTypedWords(0);
    } finally { setResetting(false); }
  };

  const affection = memory?.affection ?? 30;
  const affectionLabel = memory?.affectionLabel || "Шинэ танил";
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const isLastTyping = typingId !== null && typingId === lastAssistant?._id;
  const aiSuggestions = lastAssistant?.suggestedReplies || [];
  const categoryStarters = STARTER_CATEGORIES.find((c) => c.id === starterCategory)?.chips || [];
  const suggestions = messages.length > 1 ? (isLastTyping ? [] : aiSuggestions) : aiSuggestions.length ? aiSuggestions : categoryStarters;

  return (
    <div className="mx-auto flex h-[calc(100vh-180px)] max-w-[760px] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.08)] pb-3">
        <Link href="/tools" className="text-[#666] transition hover:text-[color:var(--accent)]" style={{ ["--accent" as string]: ACCENT }} aria-label="Буцах">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <BudjargalAvatar size={40} online />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-black text-[#E8E8E8]">Буджаргал</span>
            <span className="text-[10px] text-[#666]">· {affectionLabel}</span>
          </div>
          <DepthBar value={affection} />
        </div>
        {(isGuest || !session) && !signupBlocked && (
          <Link href="/auth/signup?next=/budjargal" className="hidden sm:inline-flex items-center gap-1 rounded-[4px] border px-2.5 py-1 text-[10px] font-black"
                style={{ borderColor: ACCENT_BORDER, backgroundColor: ACCENT_SOFT, color: ACCENT }}>
            Бүртгүүлэх
          </Link>
        )}
        <button onClick={() => setShowSettings(true)} aria-label="Тохиргоо" className="flex h-8 w-8 items-center justify-center rounded-[4px] text-[#666] transition hover:bg-[rgba(255,255,255,0.06)] hover:text-[#E8E8E8]">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zm0 6a.75.75 0 110-1.5.75.75 0 010 1.5zm0 6a.75.75 0 110-1.5.75.75 0 010 1.5z" />
          </svg>
        </button>
      </div>

      {/* Chat scroll */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: ACCENT }} />
          </div>
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

      {/* Starter categories */}
      {!sending && messages.length <= 1 && (
        <div className="mb-1.5 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1 scrollbar-hide">
          {STARTER_CATEGORIES.map((c) => {
            const active = c.id === starterCategory;
            return (
              <button
                key={c.id}
                onClick={() => setStarterCategory(c.id)}
                className="shrink-0 rounded-[4px] px-2.5 py-1 text-[10px] font-black tracking-wide transition"
                style={
                  active
                    ? { backgroundColor: ACCENT, color: "#fff" }
                    : { border: "1px solid rgba(255,255,255,0.08)", backgroundColor: "#0F0F10", color: "#888" }
                }
              >
                {c.label}
              </button>
            );
          })}
        </div>
      )}

      {!sending && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-2">
          {suggestions.map((s, i) => (
            <button
              key={`${s}-${i}`}
              onClick={() => send(s)}
              className="rounded-[4px] border px-3 py-1.5 text-[11px] font-medium text-[#CCC] transition"
              style={{ borderColor: ACCENT_BORDER, backgroundColor: ACCENT_SOFT }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {signupBlocked && (
        <div className="mb-2 rounded-[4px] border px-4 py-3" style={{ borderColor: ACCENT_BORDER, backgroundColor: ACCENT_SOFT }}>
          <p className="text-[12px] font-bold text-[#E8E8E8]">Зочны хязгаар хүрлээ</p>
          <p className="mt-0.5 text-[11px] text-[#888]">Бүртгүүлбэл хязгааргүй яриа.</p>
          <Link href="/auth/signup?next=/budjargal" className="mt-2 inline-block rounded-[4px] py-2 px-3 text-center text-[12px] font-black text-white" style={{ backgroundColor: ACCENT }}>
            Бүртгүүлэх (үнэгүй)
          </Link>
        </div>
      )}

      {error && !signupBlocked && (
        <div className="mb-2 rounded-[4px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-3 py-1.5 text-[11px] text-[#EF4444]">
          {error}
        </div>
      )}

      {/* Composer */}
      <div className="border-t border-[rgba(255,255,255,0.08)] pt-3 pb-2">
        <div className="flex items-end gap-2 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] p-1.5 transition focus-within:border-[color:var(--accent)]" style={{ ["--accent" as string]: ACCENT }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Буджаргалд юу хэлэх вэ..."
            rows={1}
            maxLength={1500}
            disabled={signupBlocked}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] leading-relaxed text-[#E8E8E8] placeholder-[#555] outline-none disabled:opacity-50"
            style={{ maxHeight: 140 }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || sending || signupBlocked}
            className="shrink-0 rounded-[4px] px-3 py-2 text-[12px] font-black text-white transition disabled:opacity-40"
            style={{ backgroundColor: ACCENT }}
          >
            {sending ? (
              <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a1 1 0 00-1.39 1.18L4 11l9 1-9 1-1.99 6.22a1 1 0 001.39 1.18z" /></svg>
            )}
          </button>
        </div>
        <p className="mt-1 text-center text-[9px] text-[#555]">
          Гүйлтийн бясалгагч. Чимээгүй сонсож, тайван хариулна.
        </p>
      </div>

      {/* Settings sheet */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={() => setShowSettings(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] p-5 sm:rounded-[4px]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] font-black text-[#E8E8E8]">Буджаргал · Тохиргоо</h2>
              <button onClick={() => setShowSettings(false)} className="text-[#666] hover:text-[#E8E8E8]" aria-label="Хаах">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="space-y-3">
              <Row label="Гүн түвшин" value={`${affection}/100 · ${affectionLabel}`} />
              <Row label="Нийт мессеж" value={String(memory?.totalMessages ?? 0)} />
              <Row label="Mode" value={isGuest ? "Зочин" : "Гишүүн"} />
              {(memory?.facts && memory.facts.length > 0) && (
                <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-3">
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#666]">Буджаргалын санасан зүйл</div>
                  <ul className="space-y-1 text-[11px] text-[#CCC]">
                    {memory.facts.map((f, i) => <li key={i}>• {f}</li>)}
                  </ul>
                </div>
              )}
              {hasHistory && !showHistory && (
                <button
                  onClick={() => { setShowHistory(true); setMessages((cur) => [...pastMessages, ...cur]); setShowSettings(false); }}
                  className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] py-2 text-[11px] font-bold text-[#888]"
                >
                  Өмнөх ярианыг харах
                </button>
              )}
            </div>
            <button
              onClick={reset}
              disabled={resetting}
              className="mt-4 w-full rounded-[4px] border border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.05)] py-2.5 text-[12px] font-bold text-[#EF4444]"
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

function BudjargalAvatar({ size = 40, online = false }: { size?: number; online?: boolean }) {
  const [idx, setIdx] = useState(0);
  const [allFailed, setAllFailed] = useState(false);
  const sources = ["/budjargal.png", "/antaqorr.png"]; // fallback to brand img
  const fontSize = Math.max(14, Math.round(size * 0.42));
  const dot = Math.max(8, Math.round(size * 0.22));
  return (
    <div className="relative shrink-0 overflow-hidden rounded-[4px] bg-gradient-to-br from-[#6366F1] to-[#A855F7] shadow-[0_0_18px_rgba(99,102,241,0.35)]" style={{ width: size, height: size }}>
      {!allFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={sources[idx]}
          alt="Буджаргал"
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => { if (idx < sources.length - 1) setIdx(i => i + 1); else setAllFailed(true); }}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-black text-white" style={{ fontSize }}>Б</span>
      )}
      {online && <span className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[#22C55E] ring-2 ring-[#0A0A0A]" style={{ width: dot, height: dot }} />}
    </div>
  );
}

function DepthBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="mt-1 flex items-center gap-1.5">
      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24" style={{ color: ACCENT }}>
        <circle cx="12" cy="12" r="10" />
      </svg>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
        <div className="h-full transition-all duration-700" style={{ width: `${pct}%`, background: `linear-gradient(to right, ${ACCENT}, #A855F7)` }} />
      </div>
      <span className="w-8 text-right text-[9px] font-bold text-[#888]">{pct}</span>
    </div>
  );
}

function Bubble({ m, isTyping = false, typedWords, onSkip }: {
  m: Message; isTyping?: boolean; typedWords?: number; onSkip?: () => void;
}) {
  const isUser = m.role === "user";
  let visible = m.content;
  if (isTyping && typeof typedWords === "number") {
    const parts = m.content.split(/(\s+)/);
    let wordsSeen = 0; let cut = 0;
    for (let i = 0; i < parts.length; i++) {
      if (/\S/.test(parts[i])) { if (wordsSeen >= typedWords) break; wordsSeen++; }
      cut = i + 1;
    }
    visible = parts.slice(0, cut).join("");
  }
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        onClick={isTyping ? onSkip : undefined}
        className={`max-w-[80%] rounded-[4px] px-3.5 py-2.5 text-[14px] leading-relaxed ${isTyping ? "cursor-pointer" : ""}`}
        style={isUser
          ? { backgroundColor: ACCENT, color: "#fff" }
          : { border: "1px solid rgba(255,255,255,0.08)", backgroundColor: "#0F0F10", color: "#E8E8E8" }
        }
      >
        <p className="whitespace-pre-wrap">
          {visible}
          {isTyping && (
            <span className="ml-0.5 inline-block h-3 w-[3px] translate-y-[2px] animate-[bjblink_0.9s_steps(2)_infinite]" style={{ backgroundColor: ACCENT }} />
          )}
        </p>
        {!isUser && !isTyping && Array.isArray(m.actions) && m.actions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {m.actions.map((a, i) => (
              <Link key={`${a.href}-${i}`} href={a.href}
                className="inline-flex items-center gap-1 rounded-[4px] px-2.5 py-1 text-[10px] font-black text-white"
                style={{ backgroundColor: ACCENT }}>
                {a.label} →
              </Link>
            ))}
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes bjblink {
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
      <div className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] px-3.5 py-3">
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ backgroundColor: ACCENT, animationDelay: "0ms" }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ backgroundColor: ACCENT, animationDelay: "150ms" }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full" style={{ backgroundColor: ACCENT, animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] px-3 py-2">
      <span className="text-[11px] text-[#888]">{label}</span>
      <span className="text-[12px] font-bold text-[#E8E8E8]">{value}</span>
    </div>
  );
}
