"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

interface Message {
  _id: string;
  role: "user" | "assistant";
  content: string;
  affectionDelta?: number;
  affectionAfter?: number;
  createdAt: string;
}

interface MemoryState {
  affection: number;
  affectionLabel: string;
  preferredName: string;
  totalMessages: number;
  facts: string[];
}

export default function CompanionPage() {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState<Message[]>([]);
  const [memory, setMemory] = useState<MemoryState | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [resetting, setResetting] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load state on mount
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/companion/state")
      .then((r) => r.json())
      .then((d) => {
        if (d.memory) setMemory(d.memory);
        if (Array.isArray(d.messages)) setMessages(d.messages);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = inputRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(140, ta.scrollHeight) + "px";
  }, [input]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setError("");
    setSending(true);

    // Optimistic user message
    const tempId = `tmp-${Date.now()}`;
    setMessages((m) => [
      ...m,
      { _id: tempId, role: "user", content: text, createdAt: new Date().toISOString() },
    ]);
    setInput("");

    try {
      const r = await fetch("/api/companion/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data.error || "Алдаа гарлаа");
        // Roll back optimistic
        setMessages((m) => m.filter((mm) => mm._id !== tempId));
        return;
      }
      setMessages((m) => [...m, data.reply]);
      if (data.memory) {
        setMemory((prev): MemoryState => ({
          affection: data.memory.affection,
          affectionLabel: prev?.affectionLabel || "",
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
      await fetch("/api/companion/reset", { method: "POST" });
      setMessages([]);
      setMemory((m) => m ? { ...m, affection: 30, totalMessages: 0, facts: [], affectionLabel: "Шинээр танилцсан" } : null);
      setShowSettings(false);
    } finally {
      setResetting(false);
    }
  };

  if (status === "unauthenticated") {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <h1 className="text-[20px] font-black text-[#E8E8E8]">Antaqor</h1>
        <p className="mt-2 text-[13px] text-[#888]">Найзаа танихын тулд эхлээд нэвтэрнэ үү.</p>
        <Link href="/auth/signin?next=/companion" className="mt-4 inline-block rounded-[4px] bg-[#EF2C58] px-5 py-2.5 text-[12px] font-black text-white">
          Нэвтрэх
        </Link>
      </div>
    );
  }

  const affection = memory?.affection ?? 30;
  const affectionLabel = memory?.affectionLabel || "Шинээр танилцсан";

  return (
    <div className="mx-auto flex h-[calc(100vh-180px)] max-w-[760px] flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.08)] pb-3">
        <Link href="/tools" className="text-[#666] transition hover:text-[#EF2C58]" aria-label="Буцах">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <AntaqorAvatar size={40} online />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-black text-[#E8E8E8]">Antaqor</span>
            <span className="text-[10px] text-[#666]">· {affectionLabel}</span>
          </div>
          <AffectionBar value={affection} />
        </div>
        <button
          onClick={() => setShowSettings(true)}
          aria-label="Тохиргоо"
          className="flex h-8 w-8 items-center justify-center rounded-[4px] text-[#666] transition hover:bg-[rgba(255,255,255,0.06)] hover:text-[#E8E8E8]"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zm0 6a.75.75 0 110-1.5.75.75 0 010 1.5zm0 6a.75.75 0 110-1.5.75.75 0 010 1.5z" />
          </svg>
        </button>
      </div>

      {/* Chat scroll */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-4">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <div className="h-2 w-2 animate-pulse rounded-full bg-[#EF2C58]" />
          </div>
        ) : messages.length === 0 ? (
          <EmptyChat onPick={(t) => setInput(t)} />
        ) : (
          <div className="space-y-3">
            {messages.map((m) => <Bubble key={m._id} m={m} />)}
            {sending && <TypingBubble />}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-2 rounded-[4px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-3 py-1.5 text-[11px] text-[#EF4444]">
          {error}
        </div>
      )}

      {/* Composer — sticky bottom */}
      <div className="border-t border-[rgba(255,255,255,0.08)] pt-3 pb-2">
        <div className="flex items-end gap-2 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] p-1.5 transition focus-within:border-[rgba(239,44,88,0.4)]">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Antaqor-т юу гэж бичих вэ..."
            rows={1}
            maxLength={1500}
            className="flex-1 resize-none bg-transparent px-2 py-1.5 text-[14px] leading-relaxed text-[#E8E8E8] placeholder-[#555] outline-none"
            style={{ maxHeight: 140 }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            className="shrink-0 rounded-[4px] bg-[#EF2C58] px-3 py-2 text-[12px] font-black text-white shadow-[0_0_12px_rgba(239,44,88,0.4)] transition hover:bg-[#D4264E] disabled:opacity-40 disabled:shadow-none"
          >
            {sending ? (
              <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M3.4 20.4l17.45-7.48a1 1 0 000-1.84L3.4 3.6a1 1 0 00-1.39 1.18L4 11l9 1-9 1-1.99 6.22a1 1 0 001.39 1.18z" /></svg>
            )}
          </button>
        </div>
        <p className="mt-1 text-[9px] text-[#555] text-center">
          Antaqor бол чиний AI байлдан дагуулагч. Mongolian-аар чөлөөтэй ярь.
        </p>
      </div>

      {/* Settings sheet */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center" onClick={() => setShowSettings(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-md rounded-t-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] p-5 sm:rounded-[4px]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[16px] font-black text-[#E8E8E8]">Antaqor · Тохиргоо</h2>
              <button onClick={() => setShowSettings(false)} className="text-[#666] hover:text-[#E8E8E8]" aria-label="Хаах">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="space-y-3">
              <StatRow label="Мэдрэмжийн түвшин" value={`${affection}/100 · ${affectionLabel}`} />
              <StatRow label="Нийт мессеж" value={String(memory?.totalMessages ?? 0)} />
              {(memory?.facts && memory.facts.length > 0) && (
                <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-3">
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#666]">Antaqor-ын санасан зүйл</div>
                  <ul className="space-y-1 text-[11px] text-[#CCC]">
                    {memory.facts.map((f, i) => <li key={i}>• {f}</li>)}
                  </ul>
                </div>
              )}
            </div>

            <button
              onClick={reset}
              disabled={resetting}
              className="mt-4 w-full rounded-[4px] border border-[rgba(239,68,68,0.4)] bg-[rgba(239,68,68,0.05)] py-2.5 text-[12px] font-bold text-[#EF4444] transition hover:bg-[rgba(239,68,68,0.12)] disabled:opacity-40"
            >
              {resetting ? "Дахин эхлүүлж байна..." : "Шинээр танилцах · Memory reset"}
            </button>
            <p className="mt-2 text-[10px] text-[#555] text-center">
              Бүх дурсамж + ярианы түүх устах. Буцаах боломжгүй.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────

// Branded avatar — uses /antaqor.png when present, falls back to a clean
// gradient "A" if the asset 404s so the page never shows a broken image.
function AntaqorAvatar({ size = 40, online = false }: { size?: number; online?: boolean }) {
  const [broken, setBroken] = useState(false);
  const fontSize = Math.max(14, Math.round(size * 0.42));
  const dotSize = Math.max(8, Math.round(size * 0.22));
  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[4px] bg-gradient-to-br from-[#EF2C58] to-[#A855F7] shadow-[0_0_18px_rgba(239,44,88,0.35)]"
      style={{ width: size, height: size }}
    >
      {!broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/antaqor.png"
          alt="Antaqor"
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
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
          className="absolute -bottom-0.5 -right-0.5 rounded-full bg-[#22C55E] ring-2 ring-[#0A0A0A]"
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
      <svg className="h-3 w-3 text-[#EF2C58]" fill="currentColor" viewBox="0 0 24 24">
        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
      </svg>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
        <div className="h-full bg-gradient-to-r from-[#EF2C58] to-[#FF6685] transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right text-[9px] font-bold text-[#888]">{pct}</span>
    </div>
  );
}

function Bubble({ m }: { m: Message }) {
  const isUser = m.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] rounded-[4px] px-3.5 py-2.5 text-[14px] leading-relaxed ${
        isUser
          ? "bg-[#EF2C58] text-white"
          : "border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] text-[#E8E8E8]"
      }`}>
        <p className="whitespace-pre-wrap">{m.content}</p>
        {!isUser && typeof m.affectionDelta === "number" && m.affectionDelta !== 0 && (
          <span className={`mt-1 inline-block text-[9px] font-bold ${
            m.affectionDelta > 0 ? "text-[#EF2C58]" : "text-[#EF4444]"
          }`}>
            {m.affectionDelta > 0 ? "+" : ""}{m.affectionDelta} мэдрэмж
          </span>
        )}
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] px-3.5 py-3">
        <div className="flex gap-1">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#EF2C58]" style={{ animationDelay: "0ms" }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#EF2C58]" style={{ animationDelay: "150ms" }} />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#EF2C58]" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] px-3 py-2">
      <span className="text-[11px] text-[#888]">{label}</span>
      <span className="text-[12px] font-bold text-[#E8E8E8]">{value}</span>
    </div>
  );
}

function EmptyChat({ onPick }: { onPick: (t: string) => void }) {
  const starters = [
    "Сайн уу Antaqor, чи хэн бэ?",
    "Би AI startup эхлэхээр төлөвлөж байна. Юунаас эхлэх вэ?",
    "Өнөөдөр сэтгэл санаа муу байна, ярья.",
    "Маркетингаа сайжруулах 3 идея өг.",
  ];
  return (
    <div className="flex h-full flex-col items-center justify-center px-4 text-center">
      <div className="mb-4">
        <AntaqorAvatar size={72} />
      </div>
      <h2 className="text-[18px] font-black text-[#E8E8E8]">Сайн байна уу!</h2>
      <p className="mt-2 max-w-[400px] text-[12px] leading-relaxed text-[#888]">
        Би Antaqor — чиний AI байлдан дагуулагч. Бизнес, AI, мөрөөдөл, өдөр тутмын асуудал — юу ч ярь.
        Чамайг сайн таниж аваад цаашид ойр явна.
      </p>
      <div className="mt-5 flex max-w-[420px] flex-wrap justify-center gap-1.5">
        {starters.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-[4px] border border-[rgba(239,44,88,0.3)] bg-[rgba(239,44,88,0.05)] px-3 py-1.5 text-[11px] font-medium text-[#CCC] transition hover:border-[rgba(239,44,88,0.6)] hover:text-[#EF2C58]"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
