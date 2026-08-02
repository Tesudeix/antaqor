"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";

type Msg = { role: "user" | "assistant"; content: string };
type Action = { label: string; href: string };

const ACTIONS_RE = /```actions\s*([\s\S]*?)```/i;

function parseActions(text: string): { clean: string; actions: Action[] } {
  const m = text.match(ACTIONS_RE);
  if (!m) return { clean: text, actions: [] };
  let actions: Action[] = [];
  try {
    const obj = JSON.parse(m[1].trim());
    if (Array.isArray(obj.actions)) {
      actions = obj.actions
        .filter((a: unknown): a is Action =>
          !!a && typeof (a as Action).label === "string" && typeof (a as Action).href === "string"
        )
        .slice(0, 5);
    }
  } catch {}
  return { clean: text.replace(ACTIONS_RE, "").trim(), actions };
}

const QUICK_PROMPTS = [
  "Эхэлж юу хийх вэ?",
  "Сургалт санал болго",
  "Хувийн брэндээ хэрхэн босгох вэ?",
  "Энэ хуудас юу хийдэг вэ?",
];

const PAGE_GREETING: Record<string, string> = {
  "/": "Сайн уу. Чи Антакорын нүүр дээр байна. AI империйг хаанаас эхлэх вэ?",
  "/classroom": "Сургалтын танхим. Аль чиглэлийн модулиар эхлэхийг хүсэж байна?",
  "/posts/new": "Шинэ пост бичих үе. Сэдэв олох, гарчиг бодох тусална.",
  "/vpn": "VPN үүсгэх. Алхамыг тайлбарлая.",
  "/auth/signin": "Бүртгэлийн алхам. Тусална.",
};

function greetingFor(path: string) {
  if (PAGE_GREETING[path]) return PAGE_GREETING[path];
  if (path.startsWith("/classroom/")) return "Энэ сургалтын хуудас. Дүгнэлт, дараагийн алхамыг хэлж өгнө үү?";
  if (path.startsWith("/posts/")) return "Энэ постын дэргэд байна. Хариу бичих, дүгнэлт хийхэд тус болъё.";
  return "Антакор AI — энд байна. Юунд тус болох вэ?";
}

export default function LivingAgent() {
  const { data: session } = useSession();
  const pathname = usePathname() || "/";
  const router = useRouter();
  const isAuthed = !!session?.user;

  const [open, setOpen] = useState(false);
  const [pulse, setPulse] = useState(true);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [actions, setActions] = useState<Action[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const greetedPathRef = useRef<string>("");

  // Initial greeting per-page (only when opening or path changes while open)
  useEffect(() => {
    if (!open) return;
    if (greetedPathRef.current === pathname) return;
    greetedPathRef.current = pathname;
    setMessages([{ role: "assistant", content: greetingFor(pathname) }]);
    setActions([]);
    setStreamText("");
  }, [open, pathname]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamText, open]);

  // Listen for global "open agent" events from anywhere in the app
  useEffect(() => {
    const handler = (e: Event) => {
      setOpen(true);
      setPulse(false);
      const detail = (e as CustomEvent<{ prompt?: string }>).detail;
      if (detail?.prompt) {
        setTimeout(() => sendPrompt(detail.prompt!), 80);
      }
    };
    window.addEventListener("antaqor:agent:open", handler as EventListener);
    return () => window.removeEventListener("antaqor:agent:open", handler as EventListener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, messages]);

  const sendPrompt = useCallback(
    async (raw: string) => {
      const text = raw.trim();
      if (!text || streaming) return;
      const nextMsgs: Msg[] = [...messages, { role: "user", content: text }];
      setMessages(nextMsgs);
      setInput("");
      setStreaming(true);
      setStreamText("");
      setActions([]);

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      try {
        const res = await fetch("/api/agent/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: nextMsgs, pagePath: pathname, isAuthed }),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) throw new Error("stream failed");

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let assembled = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() || "";
          for (const part of parts) {
            const line = part.split("\n").find((l) => l.startsWith("data: "));
            if (!line) continue;
            const payload = line.slice(6).trim();
            if (payload === "[DONE]") continue;
            try {
              const obj = JSON.parse(payload);
              if (obj.delta) {
                assembled += obj.delta;
                setStreamText(assembled);
              }
            } catch {}
          }
        }

        const { clean, actions: parsedActions } = parseActions(assembled);
        setMessages((prev) => [...prev, { role: "assistant", content: clean }]);
        setActions(parsedActions);
        setStreamText("");
      } catch {
        setMessages((prev) => [...prev, { role: "assistant", content: "Холболт тасарлаа. Дахин оролдоно уу." }]);
      } finally {
        setStreaming(false);
      }
    },
    [messages, pathname, isAuthed, streaming]
  );

  const stop = () => {
    abortRef.current?.abort();
    setStreaming(false);
  };

  const handleAction = (a: Action) => {
    setOpen(false);
    router.push(a.href);
  };

  return (
    <>
      {/* Floating orb */}
      {!open && (
        <button
          onClick={() => { setOpen(true); setPulse(false); }}
          aria-label="Антакор AI агент"
          className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-[#1080CA]/40 bg-[#f7f9fb] shadow-[0_0_28px_rgba(16,128,202,0.45)] backdrop-blur-md transition hover:scale-105 md:bottom-6"
        >
          <span className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(16,128,202,0.35),transparent_60%)]" />
          {pulse && (
            <>
              <span className="absolute inset-0 animate-ping rounded-full bg-[#1080CA]/30" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="absolute inset-0 animate-ping rounded-full bg-[#1080CA]/70" />
                <span className="relative h-3 w-3 rounded-full border border-[#f7f9fb] bg-[#1080CA]" />
              </span>
            </>
          )}
          <span className="font-mono text-[14px] font-bold tracking-wider text-[#1080CA]" style={{ textShadow: "0 0 12px rgba(16,128,202,0.7)" }}>
            A
          </span>
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col md:bottom-4 md:right-4 md:left-auto md:max-h-[78vh] md:w-[420px]">
          <div className="relative flex flex-col overflow-hidden rounded-t-[8px] border border-[#F2F2F4] bg-[#0a0a0c]/95 backdrop-blur-md shadow-[0_-12px_48px_rgba(0,0,0,0.7)] md:rounded-none md:shadow-[0_12px_64px_rgba(16,128,202,0.18)]"
               style={{ maxHeight: "calc(100vh - 40px)" }}>
            {/* HUD frame */}
            <span className="pointer-events-none absolute left-0 top-0 h-4 w-4 border-l-2 border-t-2 border-[#1080CA]" />
            <span className="pointer-events-none absolute right-0 top-0 h-4 w-4 border-r-2 border-t-2 border-[#1080CA]" />
            <span className="pointer-events-none absolute left-0 bottom-0 h-4 w-4 border-b-2 border-l-2 border-[#1080CA]" />
            <span className="pointer-events-none absolute right-0 bottom-0 h-4 w-4 border-b-2 border-r-2 border-[#1080CA]" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#F2F2F4] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-8 w-8 items-center justify-center rounded-none border border-[#1080CA]/40 bg-[#1080CA]/10">
                  <span className="font-mono text-[12px] font-bold text-[#1080CA]" style={{ textShadow: "0 0 10px rgba(16,128,202,0.6)" }}>A</span>
                  <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 animate-pulse rounded-full border border-[#0a0a0c] bg-[#1080CA]" />
                </div>
                <div>
                  <div className="text-[13px] font-bold text-[#f5f5f7]">Антакор AI</div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#1080CA]">
                    LIVE · GROK · {pathname.length > 22 ? pathname.slice(0, 22) + "…" : pathname}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Хаах"
                className="rounded-none p-1.5 text-[#6b7280] transition hover:bg-[#F2F2F4] hover:text-[#e8e6e1]"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" d="M6 6l12 12M6 18L18 6" />
                </svg>
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" style={{ maxHeight: "52vh" }}>
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "items-start gap-2"}`}>
                  {m.role === "assistant" && (
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-none border border-[#1080CA]/40 bg-[#1080CA]/10 font-mono text-[10px] font-bold text-[#1080CA]">
                      A
                    </div>
                  )}
                  <div
                    className={`max-w-[82%] whitespace-pre-wrap rounded-none px-3 py-2 text-[13px] leading-relaxed ${
                      m.role === "user"
                        ? "bg-[#F2F2F4] text-[#e8e6e1]"
                        : "border border-[#1080CA]/15 bg-[rgba(16,128,202,0.04)] text-[#f5f5f7]"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {streaming && (
                <div className="flex items-start gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-none border border-[#1080CA]/40 bg-[#1080CA]/10 font-mono text-[10px] font-bold text-[#1080CA]">A</div>
                  <div className="max-w-[82%] whitespace-pre-wrap rounded-none border border-[#1080CA]/15 bg-[rgba(16,128,202,0.04)] px-3 py-2 text-[13px] leading-relaxed text-[#f5f5f7]">
                    {streamText || (
                      <span className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#1080CA]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#1080CA]" style={{ animationDelay: "120ms" }} />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#1080CA]" style={{ animationDelay: "240ms" }} />
                      </span>
                    )}
                    {streamText && <span className="ml-0.5 inline-block h-[12px] w-[2px] animate-pulse bg-[#1080CA] align-middle" />}
                  </div>
                </div>
              )}

              {actions.length > 0 && !streaming && (
                <div className="ml-8 flex flex-wrap gap-1.5">
                  {actions.map((a, i) => (
                    <button
                      key={i}
                      onClick={() => handleAction(a)}
                      className="rounded-none border border-[#1080CA]/30 bg-[#1080CA]/10 px-2.5 py-1 text-[11px] font-semibold text-[#1080CA] transition hover:bg-[#1080CA]/20"
                    >
                      {a.label} →
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick chips (shown only if no convo yet) */}
            {messages.length <= 1 && (
              <div className="border-t border-[#F2F2F4] px-4 py-2">
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {QUICK_PROMPTS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendPrompt(q)}
                      disabled={streaming}
                      className="shrink-0 rounded-none border border-[#F2F2F4] px-2.5 py-1 text-[11px] text-[#6b7280] transition hover:border-[#1080CA]/40 hover:text-[#1080CA]"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input */}
            <form
              onSubmit={(e) => { e.preventDefault(); sendPrompt(input); }}
              className="flex items-center gap-2 border-t border-[#F2F2F4] bg-[#070709] px-3 py-2.5"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Антакор AI-аас асуу…"
                disabled={streaming}
                className="flex-1 bg-transparent text-[13px] text-[#f5f5f7] placeholder:text-[#4a4a55] focus:outline-none disabled:opacity-50"
              />
              {streaming ? (
                <button
                  type="button"
                  onClick={stop}
                  className="rounded-none border border-[#F2F2F4] px-2.5 py-1 text-[11px] font-semibold text-[#6b7280] hover:text-[#e8e6e1]"
                >
                  Зогсоох
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="rounded-none bg-[#1080CA] px-3 py-1.5 text-[12px] font-bold text-black transition hover:bg-[#f2547a] disabled:opacity-40"
                >
                  →
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </>
  );
}
