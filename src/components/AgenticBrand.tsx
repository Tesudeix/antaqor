"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

/* ─── Manifesto — god-tier ─── */
function openAgent(prompt?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("antaqor:agent:open", { detail: { prompt } }));
}

function Manifesto() {
  return (
    <section className="relative overflow-hidden border-t border-b border-[#F2F2F4] bg-[#060608] px-4 py-14">
      {/* Diagonal accent gradients */}
      <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-[#1080CA]/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 -bottom-20 h-64 w-64 rounded-full bg-[#1080CA]/10 blur-3xl" />

      <div className="relative mx-auto max-w-lg">
        <div className="chrome mb-6 flex items-center gap-2 text-[10px] text-[#6b7280]">
          <span className="inline-block h-1.5 w-1.5 rotate-45 bg-[#1080CA]" />
          MANIFEST · v2026
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-none border border-[#1080CA]/40 bg-[#1080CA]/10 px-2 py-0.5 text-[#1080CA]">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#1080CA]" />
            LIVE · GROK
          </span>
        </div>

        <h2
          className="text-[44px] font-black uppercase leading-[0.92] tracking-tight text-[#f5f5f7] sm:text-[56px]"
          style={{ fontFamily: 'Handjet, "Pixelify Sans", monospace', letterSpacing: "0.02em" }}
        >
          МОНГОЛЫН АНХНЫ <br />
          <span className="text-[#1080CA]" style={{ textShadow: "0 0 28px rgba(16,128,202,0.6), 0 0 56px rgba(16,128,202,0.35)", WebkitTextStroke: "1px rgba(15,23,38,0.1)" }}>
            АГЕНТИК AI
          </span>{" "}
          ИМПЕРИЙ<span className="text-[#1080CA]">.</span>
        </h2>

        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[#a8a8b0]">
          Антакор бол <span className="font-semibold text-[#f5f5f7]">амьд систем</span> — Грок дээр суурилсан, Монголоор боддог,
          хуудас бүртэй харьцдаг AI агент. Чи асууна — энэ хариулна. Чи зорилго өгнө — энэ хийнэ.
        </p>

        <div className="mt-6 grid grid-cols-3 gap-2">
          {[
            { k: "01", t: "Сэтгэнэ", v: "Grok-2" },
            { k: "02", t: "Үйлдэнэ", v: "Page-aware" },
            { k: "03", t: "Ялна", v: "24/7" },
          ].map((p) => (
            <div key={p.k} className="rounded-none border border-[#F2F2F4] bg-[#0a0a0c] p-3">
              <div className="chrome text-[9px] text-[#1080CA]">PROTO.{p.k}</div>
              <div className="mt-1 text-[15px] font-bold text-[#f5f5f7]">{p.t}</div>
              <div className="font-mono text-[10px] text-[#4a4a55]">{p.v}</div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={() => openAgent("Антакор юу хийж чадах вэ? Жишээгээр харуул.")}
            className="group relative flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-none bg-[#1080CA] px-5 py-3 text-[13px] font-bold text-black transition hover:bg-[#f2547a]"
          >
            <span className="relative z-10 flex items-center gap-2">
              <span className="font-mono text-[14px]">A</span>
              AI агент руу яриа эхлүүлэх
              <span className="text-[15px]">→</span>
            </span>
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
          </button>
          <button
            onClick={() => openAgent("Энэ платформ юу хийдгийг 3 өгүүлбэрээр тайлбарла.")}
            className="rounded-none border border-[#F2F2F4] px-5 py-3 text-[13px] font-medium text-[#e8e6e1] transition hover:border-[#1080CA]/40"
          >
            Танилцуулга
          </button>
        </div>
      </div>
    </section>
  );
}

/* ─── AI Companion REAL live preview (calls Grok via /api/agent/chat) ─── */
const SEED_QUESTIONS = [
  "Хувийн брэндээ хаанаас эхлэх вэ? 3 алхамаар.",
  "Долоо хоногийн контент календарь зохио.",
  "AI prompt инженерчлэлийн анхны зарчим юу вэ?",
  "Антакор гишүүн болоход юу авах вэ?",
];

function CompanionPreview() {
  const [question, setQuestion] = useState(SEED_QUESTIONS[0]);
  const [answer, setAnswer] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [mode, setMode] = useState<"grok" | "fallback" | null>(null);

  const runQuestion = useCallback(async (q: string) => {
    setQuestion(q);
    setAnswer("");
    setStreaming(true);
    try {
      const res = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: q }],
          pagePath: "/",
          isAuthed: false,
        }),
      });
      setMode((res.headers.get("X-Antaqor-Mode") as "grok" | "fallback") || "fallback");
      if (!res.ok || !res.body) throw new Error();
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
              setAnswer(assembled.replace(/```actions[\s\S]*?```/, "").trim());
            }
          } catch {}
        }
      }
    } catch {
      setAnswer("Холболт тогтворгүй. Дахин оролдоно уу.");
    } finally {
      setStreaming(false);
    }
  }, []);

  // Auto-run first question on mount
  useEffect(() => {
    runQuestion(SEED_QUESTIONS[0]);
  }, [runQuestion]);

  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-lg">
        <div className="chrome mb-4 flex items-center justify-between text-[10px] text-[#6b7280]">
          <span className="flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rotate-45 bg-[#1080CA]" />
            LIVE · COMPANION
          </span>
          <span className="flex items-center gap-1.5 text-[#4a4a55]">
            {mode === "grok" ? (
              <>
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#1080CA]" />
                <span className="text-[#1080CA]">GROK · streaming</span>
              </>
            ) : (
              <span>{streaming ? "loading…" : "ready"}</span>
            )}
          </span>
        </div>

        <div className="relative overflow-hidden rounded-none border border-[#F2F2F4] bg-[#f7f9fb]">
          <span className="absolute left-0 top-0 h-3 w-3 border-l border-t border-[#1080CA]" />
          <span className="absolute right-0 top-0 h-3 w-3 border-r border-t border-[#1080CA]" />
          <span className="absolute bottom-0 left-0 h-3 w-3 border-b border-l border-[#1080CA]" />
          <span className="absolute bottom-0 right-0 h-3 w-3 border-b border-r border-[#1080CA]" />

          <div className="space-y-3 p-5 pt-6">
            <div className="flex justify-end">
              <div className="max-w-[82%] rounded-none bg-[#F2F2F4] px-3 py-2 text-[13px] text-[#e8e6e1]">{question}</div>
            </div>
            <div className="flex items-start gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none border border-[#1080CA]/40 bg-[#1080CA]/10 text-[11px] font-bold text-[#1080CA]">
                A
              </div>
              <div className="min-h-[60px] max-w-[82%] whitespace-pre-wrap rounded-none border border-[#1080CA]/20 bg-[rgba(16,128,202,0.04)] px-3 py-2 text-[13px] leading-relaxed text-[#f5f5f7]">
                {answer || (
                  <span className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#1080CA]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#1080CA]" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#1080CA]" style={{ animationDelay: "300ms" }} />
                  </span>
                )}
                {streaming && answer && <span className="ml-0.5 inline-block h-[14px] w-[2px] animate-pulse bg-[#1080CA] align-middle" />}
              </div>
            </div>
          </div>

          <div className="border-t border-[#F2F2F4] bg-[#080809] px-4 py-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="chrome shrink-0 text-[9px] text-[#4a4a55]">SEED:</span>
              {SEED_QUESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => !streaming && runQuestion(q)}
                  disabled={streaming}
                  className={`shrink-0 rounded-none border px-2 py-0.5 text-[11px] transition disabled:opacity-50 ${
                    q === question
                      ? "border-[#1080CA]/50 bg-[#1080CA]/10 text-[#1080CA]"
                      : "border-[#F2F2F4] text-[#5a5550] hover:border-[#1080CA]/30 hover:text-[#1080CA]"
                  }`}
                >
                  Q{i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={() => openAgent(question)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-none border border-[#1080CA]/30 bg-transparent py-2 text-[12px] font-semibold text-[#1080CA] transition hover:bg-[#1080CA]/10"
        >
          Энэ AI-тай шууд ярь <span className="text-[14px]">→</span>
        </button>
      </div>
    </section>
  );
}

/* ─── Capability MOD grid ─── */
const MODS = [
  {
    code: "MOD.01",
    title: "MIND",
    label: "Сэтгэлийн булчин",
    body: "Сэтгэл-эрчмийн дасгал, амьсгаа, өдөр бүрийн focus check-in.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" d="M12 3v2m0 14v2M5 12H3m18 0h-2M6 6l1.5 1.5M16.5 16.5L18 18M6 18l1.5-1.5M16.5 7.5L18 6" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
  {
    code: "MOD.02",
    title: "GOAL",
    label: "Зорилгын агент",
    body: "Долоо хоногийн төлөвлөгөө гарга. AI чамайг ажиглаж, сануулна.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="5" />
        <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    code: "MOD.03",
    title: "FLOW",
    label: "Өдрийн ритуал",
    body: "Өглөө 5 минут · оройн 5 минут. Хабит ачаалал AI-аар автомат.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" d="M3 12c3-6 6-6 9 0s6 6 9 0" />
      </svg>
    ),
  },
  {
    code: "MOD.04",
    title: "VAULT",
    label: "Prompt сан",
    body: "Гишүүдийн хуваалцсан 500+ prompt, AI workflow, агентын загвар.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="4" y="6" width="16" height="14" rx="1" />
        <path strokeLinecap="round" d="M9 3v3m6-3v3M4 10h16" />
      </svg>
    ),
  },
];

function CapabilityGrid() {
  return (
    <section className="border-t border-[#F2F2F4] bg-[#070709] px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="chrome mb-2 flex items-center gap-2 text-[10px] text-[#6b7280]">
          <span className="inline-block h-1.5 w-1.5 rotate-45 bg-[#1080CA]" />
          MODULES · AGENT STACK
        </div>
        <h2 className="mb-6 text-[24px] font-bold tracking-tight text-[#e8e6e1]">
          AI чамд <span className="text-[#1080CA]" style={{ textShadow: "0 0 16px rgba(16,128,202,0.5)" }}>4 чиглэлээр</span> ажиллана.
        </h2>

        <div className="grid grid-cols-2 gap-2">
          {MODS.map((m) => (
            <div
              key={m.code}
              className="relative rounded-none border border-[#F2F2F4] bg-[#f7f9fb] p-4 transition hover:border-[#1080CA]/40"
            >
              <span className="absolute left-0 top-0 h-2.5 w-2.5 border-l border-t border-[#1080CA]/60" />
              <span className="absolute right-0 bottom-0 h-2.5 w-2.5 border-b border-r border-[#1080CA]/60" />

              <div className="chrome text-[9px] text-[#4a4a55]">{m.code}</div>
              <div className="mt-2 flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-none border border-[#1080CA]/30 text-[#1080CA]">
                  {m.icon}
                </span>
                <span className="text-[13px] font-bold tracking-wide text-[#e8e6e1]">{m.title}</span>
              </div>
              <div className="mt-2 text-[11px] font-semibold text-[#1080CA]">{m.label}</div>
              <p className="mt-1 text-[11px] leading-snug text-[#6b7280]">{m.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─── Founder card ─── */
function FounderCard() {
  return (
    <section className="px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="chrome mb-4 flex items-center gap-2 text-[10px] text-[#6b7280]">
          <span className="inline-block h-1.5 w-1.5 rotate-45 bg-[#1080CA]" />
          OPERATOR · FOUNDER
        </div>

        <div className="relative overflow-hidden rounded-none border border-[#F2F2F4] bg-[#f7f9fb] p-5">
          <span className="absolute left-0 top-0 h-3 w-3 border-l border-t border-[#1080CA]" />
          <span className="absolute right-0 bottom-0 h-3 w-3 border-b border-r border-[#1080CA]" />

          <div className="flex items-start gap-4">
            <div className="relative shrink-0">
              <div
                className="h-16 w-16 rounded-none bg-cover bg-center"
                style={{ backgroundImage: "url(/uploads/founder.jpg), linear-gradient(135deg, #1080CA 0%, #4FA8E8 100%)" }}
              />
              <span className="absolute -bottom-1 -right-1 rounded-none border border-[#f7f9fb] bg-[#1080CA] px-1 py-0.5 text-[8px] font-bold tracking-wider text-black">
                LIVE
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-bold text-[#e8e6e1]">Antaqor</div>
              <div className="chrome text-[9px] text-[#1080CA]">FOUNDER · AI OPERATOR</div>
              <p className="mt-2 text-[12px] leading-relaxed text-[#6b7280]">
                Би хувийн брэндээ AI агентаар барьж байна. Чи ч бас чадна — кодгүй, заавал техникч байх албагүй. Антакор бол энэ замын тэмдэг.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#F2F2F4] pt-4">
            {[
              { k: "AI runs", v: "12.4k" },
              { k: "Prompts", v: "538" },
              { k: "Days", v: "127" },
            ].map((s) => (
              <div key={s.k} className="text-center">
                <div className="text-[18px] font-bold tracking-tight text-[#1080CA]" style={{ textShadow: "0 0 12px rgba(16,128,202,0.4)" }}>
                  {s.v}
                </div>
                <div className="chrome text-[8px] text-[#4a4a55]">{s.k}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Stats strip ─── */
function StatsStrip() {
  const [memberCount, setMemberCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/pricing")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.paidMembers === "number") setMemberCount(d.paidMembers);
      })
      .catch(() => {});
  }, []);

  const stats = [
    { v: memberCount !== null ? String(memberCount) : "—", k: "гишүүд", sub: "идэвхтэй" },
    { v: "24/7", k: "AI агент", sub: "Mongolian-first" },
    { v: "∞", k: "Prompt", sub: "хуваалцаж буй" },
  ];

  return (
    <section className="border-t border-b border-[#F2F2F4] bg-[#070709] px-4 py-6">
      <div className="mx-auto grid max-w-lg grid-cols-3 gap-3">
        {stats.map((s, i) => (
          <div key={i} className="text-center">
            <div className="text-[22px] font-bold tracking-tight text-[#e8e6e1]">{s.v}</div>
            <div className="chrome mt-0.5 text-[9px] text-[#1080CA]">{s.k}</div>
            <div className="text-[10px] text-[#4a4a55]">{s.sub}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Final CTA ─── */
function CtaBanner() {
  return (
    <section className="px-4 py-10">
      <div className="mx-auto max-w-lg">
        <div className="relative overflow-hidden rounded-none border border-[#1080CA]/30 bg-gradient-to-br from-[#1080CA]/10 via-[#f7f9fb] to-[#f7f9fb] p-6">
          <span className="absolute left-0 top-0 h-3 w-3 border-l-2 border-t-2 border-[#1080CA]" />
          <span className="absolute right-0 top-0 h-3 w-3 border-r-2 border-t-2 border-[#1080CA]" />
          <span className="absolute bottom-0 left-0 h-3 w-3 border-b-2 border-l-2 border-[#1080CA]" />
          <span className="absolute bottom-0 right-0 h-3 w-3 border-b-2 border-r-2 border-[#1080CA]" />

          <div className="chrome text-[10px] text-[#1080CA]">ENTER · 01 / 01</div>
          <h3 className="mt-3 text-[26px] font-bold leading-tight text-[#f5f5f7]">
            Чиний AI империй <br />
            <span className="text-[#1080CA]" style={{ textShadow: "0 0 18px rgba(16,128,202,0.55)" }}>
              өнөөдрөөс эхэлнэ.
            </span>
          </h3>
          <p className="mt-3 text-[12px] leading-relaxed text-[#6b7280]">
            Бүртгүүлээд AI агенттай ярь. Эхний 7 хоног — бүхэл систем нээлттэй.
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Link
              href="/auth/signin"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-none bg-[#1080CA] px-4 py-2.5 text-[13px] font-bold text-black transition hover:bg-[#f2547a]"
            >
              Бүртгүүлэх <span className="text-[15px]">→</span>
            </Link>
            <button
              onClick={() => openAgent("Би хувийн брэндээ хаанаас эхлэх вэ? Жишээ + 3 алхам.")}
              className="flex flex-1 items-center justify-center rounded-none border border-[#1080CA]/30 px-4 py-2.5 text-[13px] font-semibold text-[#1080CA] transition hover:bg-[#1080CA]/10"
            >
              AI-тай зөвлөлд
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Public composite ─── */
export default function AgenticBrand() {
  return (
    <>
      <Manifesto />
      <CompanionPreview />
      <CapabilityGrid />
      <FounderCard />
      <StatsStrip />
      <CtaBanner />
    </>
  );
}
