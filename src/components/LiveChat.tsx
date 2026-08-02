"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

// ─── LIVE room — бүх гишүүн автоматаар нэг өрөөнд (WhatsApp групп шиг). ───
// Realtime: SSE (RealtimeBridge → window "chat:message") + 15с fallback poll.

interface Msg {
  id: string;
  userId: string;
  name: string;
  avatar: string;
  text: string;
  createdAt: string;
}

function timeShort(iso: string): string {
  return new Date(iso).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" });
}

export default function LiveChat() {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [me, setMe] = useState("");
  const [gate, setGate] = useState<"ok" | "login" | "plan" | "error">("ok");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastAtRef = useRef<string>("");

  const scrollDown = () => bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });

  const append = useCallback((list: Msg[]) => {
    setMsgs((prev) => {
      const seen = new Set((prev || []).map((m) => m.id));
      const fresh = list.filter((m) => !seen.has(m.id));
      if (fresh.length === 0) return prev;
      const next = [...(prev || []), ...fresh];
      const last = next[next.length - 1];
      if (last) lastAtRef.current = last.createdAt;
      return next.slice(-200);
    });
    setTimeout(scrollDown, 80);
  }, []);

  const load = useCallback(async (after?: string) => {
    try {
      const res = await fetch(`/api/chat/live${after ? `?after=${encodeURIComponent(after)}` : ""}`);
      if (res.status === 401) return setGate("login");
      if (res.status === 402) return setGate("plan");
      if (!res.ok) return setGate("error");
      const d = await res.json();
      setMe(d.me);
      setGate("ok");
      if (after) append(d.messages);
      else {
        setMsgs(d.messages);
        const last = d.messages[d.messages.length - 1];
        if (last) lastAtRef.current = last.createdAt;
        setTimeout(scrollDown, 120);
      }
    } catch {
      setGate("error");
    }
  }, [append]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: RealtimeBridge SSE → window event
  useEffect(() => {
    const onMsg = (e: Event) => {
      const d = (e as CustomEvent).detail as Msg | undefined;
      if (d?.id) append([d]);
    };
    window.addEventListener("chat:message", onMsg);
    return () => window.removeEventListener("chat:message", onMsg);
  }, [append]);

  // Fallback poll — SSE тасарсан ч 15с тутам гүйцээнэ.
  useEffect(() => {
    const t = setInterval(() => {
      if (gate === "ok" && lastAtRef.current) load(lastAtRef.current);
    }, 15000);
    return () => clearInterval(t);
  }, [gate, load]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");
    try {
      const res = await fetch("/api/chat/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: body }),
      });
      const d = await res.json();
      if (res.ok && d.message) append([d.message]);
      else setText(body);
    } catch {
      setText(body);
    } finally {
      setSending(false);
    }
  };

  if (gate === "login") {
    return (
      <div className="rounded-[4px] border border-[#2E2E33] bg-[#1E1E21] p-8 text-center">
        <p className="mb-4 text-[13px] text-[#B4B4BA]">LIVE room-д орохын тулд нэвтэрнэ үү.</p>
        <Link href="/auth/signin" className="inline-flex h-12 items-center rounded-[4px] bg-[#1080CA] px-7 text-[13px] font-bold uppercase text-[#0E0E10]">
          Нэвтрэх →
        </Link>
      </div>
    );
  }
  if (gate === "plan") {
    return (
      <div className="relative rounded-[4px] border border-[#1080CA] p-8 text-center">
        {["left-0 top-0 border-l-2 border-t-2", "right-0 top-0 border-r-2 border-t-2", "bottom-0 left-0 border-b-2 border-l-2", "bottom-0 right-0 border-b-2 border-r-2"].map((c, i) => (
          <span key={i} className={`pointer-events-none absolute h-3 w-3 border-[#1080CA] ${c}`} />
        ))}
        <p className="mb-1 text-[15px] font-bold text-[#FFFFFF]">LIVE room — гишүүдийн орон зай</p>
        <p className="mb-5 text-[13px] text-[#B4B4BA]">Бүх гишүүн автоматаар нэг өрөөнд. Төлбөр төлөгдмөгц шууд нэгдэнэ.</p>
        <Link href="/pricing?plan=starter" className="inline-flex h-12 items-center rounded-[4px] bg-[#1080CA] px-7 text-[13px] font-bold uppercase text-[#0E0E10]">
          Гишүүн болох →
        </Link>
      </div>
    );
  }
  if (gate === "error") {
    return (
      <div className="rounded-[4px] border border-[#2E2E33] bg-[#1E1E21] p-8 text-center">
        <p className="mb-4 text-[13px] text-[#B4B4BA]">Чат ачаалж чадсангүй.</p>
        <button onClick={() => load()} className="h-11 rounded-[4px] bg-[#1080CA] px-6 text-[12px] font-bold text-[#0E0E10]">
          Дахин оролдох
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-200px)] min-h-[420px] flex-col rounded-[4px] border border-[#2E2E33] bg-[#161618]">
      {/* Stream */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {msgs === null && (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 w-2/3 animate-pulse rounded-[4px] bg-[#1E1E21]" />
            ))}
          </div>
        )}
        {msgs?.length === 0 && (
          <p className="pt-10 text-center text-[13px] text-[#84848C]">
            Өрөө нам гүм байна — эхний мессежийг чи бич 🔥
          </p>
        )}
        {(msgs || []).map((m, i) => {
          const mine = m.userId === me;
          const prev = msgs?.[i - 1];
          const showHead = !mine && (!prev || prev.userId !== m.userId);
          return (
            <div key={m.id} className={`flex gap-2 ${mine ? "justify-end" : ""}`}>
              {!mine && (
                <span className="h-7 w-7 shrink-0 overflow-hidden rounded-[4px] bg-[#1E1E21]">
                  {showHead &&
                    (m.avatar ? (
                      <img src={m.avatar} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[11px] font-bold text-[#1080CA]">
                        {m.name.charAt(0)}
                      </span>
                    ))}
                </span>
              )}
              <div className={`max-w-[78%] ${mine ? "text-right" : ""}`}>
                {showHead && <div className="mb-0.5 text-[10px] font-bold text-[#B4B4BA]">{m.name}</div>}
                <div
                  className={`inline-block rounded-[4px] px-3 py-2 text-left text-[13px] leading-snug ${
                    mine ? "bg-[#1080CA] text-[#0E0E10]" : "bg-[#1E1E21] text-[#FFFFFF]"
                  }`}
                >
                  {m.text}
                  <span className={`ml-2 align-bottom text-[8px] ${mine ? "text-[#1080CA]/60" : "text-[#84848C]"}`} style={{ fontVariantNumeric: "tabular-nums" }}>
                    {timeShort(m.createdAt)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="flex gap-2 border-t border-[#2E2E33] p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          maxLength={500}
          placeholder="Мессеж бичих…"
          aria-label="Мессеж"
          className="h-12 flex-1 rounded-[4px] border border-[rgba(255,255,255,0.12)] bg-[#0a0a0c] px-3 text-[14px] text-[#FFFFFF] outline-none transition focus:border-[#1080CA]"
        />
        <button
          onClick={send}
          disabled={sending || !text.trim()}
          className="h-12 shrink-0 rounded-[4px] bg-[#1080CA] px-6 text-[13px] font-bold uppercase text-[#0E0E10] transition hover:bg-[#4FA8E8] active:translate-y-[1px] disabled:opacity-50"
        >
          {sending ? "…" : "Илгээх"}
        </button>
      </div>
    </div>
  );
}
