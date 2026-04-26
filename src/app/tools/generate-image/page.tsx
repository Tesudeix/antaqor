"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { IMAGE_STYLES, ASPECT_RATIOS, findStyle, findAspect } from "@/lib/imageGen";

const COST = 10;
const QUICK_PROMPTS = [
  "A futuristic cyber city at night with neon pink lights",
  "Cute anime girl with traditional Mongolian deel, soft lighting",
  "Minimal product shot of a coffee cup on white marble",
  "Logo for a tech startup called Antaqor, vector",
  "A snow leopard sitting on a Mongolian mountain at sunrise",
];

type OpenPanel = null | "style" | "aspect";

export default function GenerateImagePage() {
  const { data: session, status } = useSession();
  const [prompt, setPrompt] = useState("");
  const [styleId, setStyleId] = useState<string>("auto");
  const [aspectId, setAspectId] = useState<string>("1:1");
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [busy, setBusy] = useState(false);
  const [resultUrl, setResultUrl] = useState("");
  const [resultAspect, setResultAspect] = useState<string>("1:1");
  const [error, setError] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [history, setHistory] = useState<{ url: string; prompt: string; aspectRatio: string }[]>([]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/credits")
      .then((r) => r.json())
      .then((d) => { if (typeof d.balance === "number") setBalance(d.balance); })
      .catch(() => {});
  }, [status]);

  const submit = async () => {
    if (!prompt.trim() || busy) return;
    setError("");
    setResultUrl("");
    setBusy(true);
    setOpenPanel(null);
    try {
      const res = await fetch("/api/tools/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style: styleId, aspectRatio: aspectId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data.balance === "number") setBalance(data.balance);
        setError(data.error || "Үүсгэх амжилтгүй");
        return;
      }
      setResultUrl(data.url);
      setResultAspect(data.aspectRatio || aspectId);
      if (typeof data.balance === "number") setBalance(data.balance);
      setHistory((h) => [{ url: data.url, prompt, aspectRatio: data.aspectRatio || aspectId }, ...h].slice(0, 6));
      // Scroll the result into view on mobile
      setTimeout(() => {
        document.getElementById("gen-result")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    } catch {
      setError("Сүлжээний алдаа. Дахин оролдоно уу.");
    } finally {
      setBusy(false);
    }
  };

  const canGenerate = !!prompt.trim() && !busy && (balance === null || balance >= COST);
  const lowBalance = balance !== null && balance < COST;
  const previewAspect = findAspect(resultUrl ? resultAspect : aspectId);
  const currentStyle = findStyle(styleId);
  const currentAspect = findAspect(aspectId);

  return (
    <div className="relative mx-auto max-w-[720px] px-1 pb-16 sm:px-0">
      {/* Subtle ambient glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[380px] w-[380px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(239,44,88,0.16)_0%,transparent_70%)] blur-3xl" />
      </div>

      {/* Top bar */}
      <div className="mb-3 flex items-center justify-between">
        <Link href="/tools" className="inline-flex items-center gap-1 text-[11px] text-[#666] transition hover:text-[#EF2C58]">
          ← Бүх хэрэгсэл
        </Link>
        {session && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(239,44,88,0.4)] bg-black/40 px-2 py-0.5 text-[10px] font-black text-[#EF2C58] backdrop-blur-md">
            <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>
            {balance ?? "…"}₵
          </span>
        )}
      </div>

      {/* Title */}
      <div className="mb-4">
        <h1 className="text-[22px] font-black leading-tight text-[#E8E8E8] sm:text-[28px]">
          AI зураг үүсгэх
        </h1>
        <p className="mt-1 text-[12px] text-[#888]">
          Промпт + стиль + хэлбэр сонгож <strong className="text-[#EF2C58]">{COST}₵</strong>-аар зураг авна.
        </p>
      </div>

      {/* ─── PROMPT PANEL — top, hero ─── */}
      <div className="rounded-[4px] border border-[rgba(239,44,88,0.3)] bg-[#0A0A0A] shadow-[0_0_24px_rgba(239,44,88,0.12)]">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Жишээ нь: A futuristic cyber city at night, neon pink lights, ultra detailed..."
          rows={4}
          maxLength={1000}
          className="w-full resize-none rounded-t-[4px] bg-transparent p-4 text-[14px] leading-relaxed text-[#E8E8E8] placeholder-[#555] outline-none"
        />

        {/* Inline option pills — Style / Aspect / Counter */}
        <div className="flex flex-wrap items-center gap-2 border-t border-[rgba(255,255,255,0.06)] px-3 py-2">
          <OptionPill
            label={currentStyle.label}
            sublabel="Стиль"
            active={openPanel === "style"}
            onClick={() => setOpenPanel(openPanel === "style" ? null : "style")}
          />
          <OptionPill
            label={currentAspect.label}
            sublabel="Хэлбэр"
            active={openPanel === "aspect"}
            onClick={() => setOpenPanel(openPanel === "aspect" ? null : "aspect")}
            iconRight={
              <span
                className="ml-1 inline-block rounded-[1px] border border-current"
                style={{
                  width: currentAspect.w >= currentAspect.h ? 14 : 14 * (currentAspect.w / currentAspect.h),
                  height: currentAspect.h > currentAspect.w ? 14 : 14 * (currentAspect.h / currentAspect.w),
                }}
              />
            }
          />
          <span className="ml-auto text-[10px] text-[#555]">{prompt.length}/1000</span>
        </div>

        {/* Expandable option panel */}
        {openPanel === "style" && (
          <div className="border-t border-[rgba(255,255,255,0.06)] p-3">
            <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.15em] text-[#666]">Стиль сонгох</div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {IMAGE_STYLES.map((s) => {
                const sel = styleId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setStyleId(s.id); setOpenPanel(null); }}
                    className={`flex flex-col items-start gap-0.5 rounded-[4px] border px-3 py-2 text-left transition ${
                      sel
                        ? "border-[#EF2C58] bg-[rgba(239,44,88,0.1)]"
                        : "border-[rgba(255,255,255,0.08)] bg-[#0F0F10] hover:border-[rgba(239,44,88,0.4)]"
                    }`}
                  >
                    <span className={`text-[11px] font-black ${sel ? "text-[#EF2C58]" : "text-[#E8E8E8]"}`}>{s.label}</span>
                    <span className="text-[9px] text-[#666]">{s.blurb}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {openPanel === "aspect" && (
          <div className="border-t border-[rgba(255,255,255,0.06)] p-3">
            <div className="mb-2 text-[9px] font-bold uppercase tracking-[0.15em] text-[#666]">Хэлбэр сонгох</div>
            <div className="flex flex-wrap gap-2">
              {ASPECT_RATIOS.map((a) => {
                const sel = aspectId === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => { setAspectId(a.id); setOpenPanel(null); }}
                    className={`flex flex-col items-center gap-1 rounded-[4px] border px-3 py-2 transition ${
                      sel
                        ? "border-[#EF2C58] bg-[rgba(239,44,88,0.1)]"
                        : "border-[rgba(255,255,255,0.08)] bg-[#0F0F10] hover:border-[rgba(239,44,88,0.4)]"
                    }`}
                    aria-pressed={sel}
                  >
                    <span
                      className={`shrink-0 rounded-[2px] border ${sel ? "border-[#EF2C58] bg-[rgba(239,44,88,0.2)]" : "border-[#444] bg-[#1A1A1A]"}`}
                      style={{
                        width: a.w >= a.h ? 30 : 30 * (a.w / a.h),
                        height: a.h > a.w ? 30 : 30 * (a.h / a.w),
                      }}
                    />
                    <span className={`text-[11px] font-black ${sel ? "text-[#EF2C58]" : "text-[#CCC]"}`}>{a.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Quick prompts — collapsible to reduce noise */}
      <details className="mt-3 rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F10] p-3 open:pb-2">
        <summary className="cursor-pointer text-[11px] font-bold text-[#888] transition hover:text-[#EF2C58]">
          Түргэн санаа сонгох ▾
        </summary>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPrompt(p)}
              className="rounded-full border border-[rgba(239,44,88,0.2)] bg-[rgba(239,44,88,0.05)] px-3 py-1 text-[10px] font-medium text-[#CCC] transition hover:border-[rgba(239,44,88,0.5)] hover:text-[#EF2C58]"
            >
              {p.length > 56 ? p.slice(0, 53) + "…" : p}
            </button>
          ))}
        </div>
      </details>

      {/* Low balance / error */}
      {lowBalance && !error && (
        <div className="mt-3 flex items-center justify-between rounded-[4px] border border-[rgba(239,44,88,0.3)] bg-[rgba(239,44,88,0.06)] px-4 py-3">
          <div>
            <div className="text-[12px] font-bold text-[#EF2C58]">Кредит дутуу</div>
            <div className="text-[11px] text-[#888]">Танд {balance}₵ байна, {COST}₵ шаардлагатай.</div>
          </div>
          <Link href="/credits/buy" className="rounded-[4px] bg-[#EF2C58] px-3 py-1.5 text-[11px] font-black text-white">
            Кредит авах →
          </Link>
        </div>
      )}
      {error && (
        <div className="mt-3 rounded-[4px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-[11px] text-[#EF4444]">
          {error}
        </div>
      )}

      {/* Generate — sticky on mobile, normal on desktop */}
      <div className="sticky bottom-[80px] z-10 mt-4 sm:static sm:bottom-auto">
        <button
          onClick={submit}
          disabled={!canGenerate}
          className="inline-flex w-full items-center justify-center gap-2 rounded-[4px] bg-[#EF2C58] px-6 py-3.5 text-[13px] font-black text-white shadow-[0_0_20px_rgba(239,44,88,0.4)] transition hover:bg-[#D4264E] disabled:opacity-40 disabled:shadow-none"
        >
          {busy ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Үүсгэж байна...
            </>
          ) : (
            <>Үүсгэх · {COST}₵</>
          )}
        </button>
      </div>

      {/* ─── RESULT — bottom ─── */}
      {(busy || resultUrl) && (
        <div id="gen-result" className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#666]">Үр дүн</div>
            <div className="text-[10px] text-[#555]">{previewAspect.label}</div>
          </div>
          <div className="relative rounded-[4px] border border-[rgba(239,44,88,0.3)] bg-[#0A0A0A] p-1">
            <div className={`relative w-full overflow-hidden rounded-[3px] bg-[#0F0F10] ${previewAspect.cls}`}>
              {busy ? (
                <NeonSkeleton />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resultUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
              )}
            </div>
          </div>
          {resultUrl && !busy && (
            <div className="mt-3 flex gap-2">
              <a
                href={resultUrl}
                download={`antaqor-${Date.now()}.png`}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-[4px] bg-[#EF2C58] py-2.5 text-[12px] font-black text-white transition hover:bg-[#D4264E]"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Татах
              </a>
              <button
                onClick={() => { setResultUrl(""); setError(""); }}
                className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-4 py-2.5 text-[12px] font-bold text-[#888] transition hover:text-[#E8E8E8]"
              >
                Цэвэрлэх
              </button>
            </div>
          )}
        </div>
      )}

      {/* History — at the very bottom */}
      {history.length > 0 && (
        <div className="mt-8">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#666]">Сүүлийн үүсгэлт</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {history.map((h, i) => {
              const cls = findAspect(h.aspectRatio).cls;
              return (
                <a
                  key={i}
                  href={h.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group relative overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F10] transition hover:border-[rgba(239,44,88,0.4)] ${cls}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={h.url} alt="" className="absolute inset-0 h-full w-full object-cover transition group-hover:scale-[1.04]" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2">
                    <p className="line-clamp-2 text-[9px] text-white/70">{h.prompt}</p>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function OptionPill({
  label, sublabel, active, onClick, iconRight,
}: {
  label: string;
  sublabel: string;
  active: boolean;
  onClick: () => void;
  iconRight?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-[4px] border px-2.5 py-1.5 text-[11px] font-bold transition ${
        active
          ? "border-[#EF2C58] bg-[rgba(239,44,88,0.1)] text-[#EF2C58]"
          : "border-[rgba(255,255,255,0.08)] bg-[#0F0F10] text-[#CCC] hover:border-[rgba(239,44,88,0.4)]"
      }`}
    >
      <span className="text-[8px] font-bold uppercase tracking-wider opacity-70">{sublabel}</span>
      <span>{label}</span>
      {iconRight}
      <svg className={`h-3 w-3 opacity-70 transition ${active ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}

function NeonSkeleton() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden bg-[#0A0A0A]">
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(239,44,88,0.18) 50%, transparent 100%)",
          animation: "neonShimmer 1.4s ease-in-out infinite",
        }}
      />
      <div className="relative z-10 flex flex-col items-center gap-2.5">
        <span className="flex h-14 w-14 items-center justify-center rounded-[4px] bg-[rgba(239,44,88,0.1)] shadow-[0_0_24px_rgba(239,44,88,0.5)]">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#EF2C58] border-t-transparent" />
        </span>
        <p className="text-[12px] font-bold text-[#E8E8E8]">AI зураг үүсгэж байна</p>
        <p className="text-[10px] text-[#666]">10–25 секунд хүртэл хүлээгээрэй</p>
      </div>
      <style jsx>{`
        @keyframes neonShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
