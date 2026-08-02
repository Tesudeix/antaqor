"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { trackOnce } from "@/lib/analytics";

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const COST = 5;

export default function AgentChat({
  slug,
  name,
  color,
  handle,
}: {
  slug: string;
  name: string;
  color: string;
  handle: string;
}) {
  const { data: session, status } = useSession();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [credits, setCredits] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // ─── Magic-moment onboarding ───
  // When signup redirects here with ?starter=..., pre-fill the textarea so
  // the user's first action is a single tap on Send. Reading window.location
  // directly (instead of useSearchParams) keeps the slug page as static SSG.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const s = new URLSearchParams(window.location.search).get("starter");
    if (s) setInput(s.slice(0, 1000));
  }, []);

  // Auto-scroll on new message
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  // Pull current credits to display
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/users/me/credits", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.credits === "number") setCredits(d.credits);
      })
      .catch(() => {});
  }, [status]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    if (status !== "authenticated") {
      setErr("Нэвтэрнэ үү");
      return;
    }
    setErr("");
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          messages: next.slice(-12), // cap context
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Алдаа гарлаа");
        // Roll back the user message visually so they can retry — keeps state honest
        setMessages(messages);
      } else {
        setMessages([...next, { role: "assistant", content: data.reply }]);
        if (typeof data.credits === "number") setCredits(data.credits);
        // Funnel: user just had their first successful agent reply. Once per user.
        trackOnce("first_agent_chat", { agent: slug });
      }
    } catch {
      setErr("Сүлжээний алдаа");
      setMessages(messages);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6">
      {/* Status row */}
      <div className="mb-3 flex items-center justify-between font-mono text-[10px] tracking-[0.18em] text-[#F4EFE6]/45">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-[5px] w-[5px] animate-pulse rounded-full" style={{ background: color }} />
          {name} · {COST} CREDITS / MSG
        </span>
        {credits !== null && (
          <Link href="/credits/buy" className="rounded-none border border-[rgba(244,239,230,0.1)] px-2 py-0.5 transition hover:border-[#1080CA]/50 hover:text-[#1080CA]">
            БАЛАНС {credits}
          </Link>
        )}
      </div>

      {/* Conversation */}
      <div className="rounded-none border border-[rgba(244,239,230,0.08)] bg-[#0A0A0F] p-3 sm:p-4">
        {messages.length === 0 && !busy && (
          <div className="px-2 py-10 text-center">
            <p className="font-mono text-[11px] tracking-wide text-[#F4EFE6]/40">
              {handle} is online. Ask anything in their domain.
            </p>
          </div>
        )}
        <div className="space-y-3">
          {messages.map((m, i) => (
            <Bubble key={i} msg={m} color={color} name={name} />
          ))}
          {busy && (
            <div className="flex items-start gap-2">
              <div
                className="grid h-7 w-7 shrink-0 place-items-center rounded-none font-mono text-[11px] font-black"
                style={{ background: `${color}1A`, color, border: `1px solid ${color}33` }}
              >
                {name.slice(0, 1)}
              </div>
              <div
                className="rounded-none border px-3 py-2 font-mono text-[11px]"
                style={{
                  borderColor: `${color}33`,
                  background: `${color}0A`,
                  color: `${color}`,
                }}
              >
                <span className="inline-flex items-center gap-1">
                  <Dot d={0} c={color} />
                  <Dot d={150} c={color} />
                  <Dot d={300} c={color} />
                  <span className="ml-2 opacity-70">thinking…</span>
                </span>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="sticky bottom-0 z-10 mt-3">
        <div className="rounded-none border border-[rgba(244,239,230,0.1)] bg-[#0A0A0F] p-2">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={status === "authenticated" ? `Message ${name}…` : "Нэвтэрч мессеж бичээрэй"}
              rows={1}
              maxLength={2000}
              disabled={status !== "authenticated" || busy}
              className="min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-[13px] leading-relaxed text-[#F4EFE6] placeholder-[#F4EFE6]/30 outline-none disabled:opacity-40"
            />
            <button
              type="button"
              onClick={send}
              disabled={!input.trim() || busy || status !== "authenticated"}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-none font-mono text-[14px] font-black transition disabled:opacity-30"
              style={{
                background: color,
                color: "#0A0A0F",
                boxShadow: `0 0 18px ${color}55`,
              }}
              aria-label="Илгээх"
            >
              ↗
            </button>
          </div>
          {err && (
            <p className="mt-1 px-1 font-mono text-[10px] text-[#1080CA]">
              {err} {err.includes("credit") || err.includes("Кредит") ? <Link href="/credits/buy" className="underline">Цэнэглэх →</Link> : null}
            </p>
          )}
        </div>
        {status !== "authenticated" && status !== "loading" && (
          <div className="mt-2 text-center font-mono text-[10px] tracking-wide text-[#F4EFE6]/50">
            <Link href="/auth/signin" className="text-[#1080CA] underline">Нэвтрэх</Link>
            {" эсвэл "}
            <Link href="/auth/signup" className="text-[#1080CA] underline">бүртгүүлж</Link>
            {" агенттай ярилцаарай"}
          </div>
        )}
      </div>
    </div>
  );
}

function Bubble({ msg, color, name }: { msg: Msg; color: string; name: string }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex items-start gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className="grid h-7 w-7 shrink-0 place-items-center rounded-none font-mono text-[11px] font-black"
        style={
          isUser
            ? { background: "#1B1B25", color: "#F4EFE6", border: "1px solid rgba(244,239,230,0.15)" }
            : { background: `${color}1A`, color, border: `1px solid ${color}33` }
        }
      >
        {isUser ? "你" : name.slice(0, 1)}
      </div>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-none border px-3 py-2 text-[13px] leading-relaxed ${
          isUser ? "bg-[#1B1B25] text-[#F4EFE6]" : ""
        }`}
        style={
          isUser
            ? { borderColor: "rgba(244,239,230,0.1)" }
            : {
                borderColor: `${color}33`,
                background: `${color}0A`,
                color: "#F4EFE6",
              }
        }
      >
        {msg.content}
      </div>
    </div>
  );
}

function Dot({ d, c }: { d: number; c: string }) {
  return (
    <span
      className="inline-block h-[5px] w-[5px] rounded-full"
      style={{
        background: c,
        animation: `chatDot 1.1s ${d}ms infinite ease-in-out`,
      }}
    />
  );
}

// Inject keyframes once at module load
if (typeof document !== "undefined" && !document.getElementById("agent-chat-keyframes")) {
  const s = document.createElement("style");
  s.id = "agent-chat-keyframes";
  s.textContent = `@keyframes chatDot { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.85); } 40% { opacity: 1; transform: scale(1); } }`;
  document.head.appendChild(s);
}
