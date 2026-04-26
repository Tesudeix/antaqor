"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { IMAGE_STYLES, ASPECT_RATIOS, findAspect } from "@/lib/imageGen";

const COST = 10;
const QUICK_PROMPTS = [
  "A futuristic cyber city at night with neon pink lights",
  "Cute anime girl with traditional Mongolian deel, soft lighting",
  "Minimal product shot of a coffee cup on white marble",
  "Logo for a tech startup called Antaqor, vector",
  "A snow leopard sitting on a Mongolian mountain at sunrise",
];

export default function GenerateImagePage() {
  const { data: session, status } = useSession();
  const [prompt, setPrompt] = useState("");
  const [styleId, setStyleId] = useState<string>("auto");
  const [aspectId, setAspectId] = useState<string>("1:1");
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
      setHistory((h) => [{ url: data.url, prompt, aspectRatio: data.aspectRatio || aspectId }, ...h].slice(0, 8));
    } catch {
      setError("Сүлжээний алдаа. Дахин оролдоно уу.");
    } finally {
      setBusy(false);
    }
  };

  const canGenerate = !!prompt.trim() && !busy && (balance === null || balance >= COST);
  const lowBalance = balance !== null && balance < COST;
  const aspectCls = findAspect(resultUrl ? resultAspect : aspectId).cls;

  return (
    <div className="relative mx-auto max-w-[1100px] pb-16">
      {/* Neon ambient glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(239,44,88,0.18)_0%,transparent_70%)] blur-3xl" />
        <div className="absolute bottom-0 right-0 h-[300px] w-[300px] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.12)_0%,transparent_70%)] blur-3xl" />
      </div>

      <div className="mb-3 flex items-center justify-between">
        <Link href="/tools" className="inline-flex items-center gap-1 text-[11px] text-[#666] transition hover:text-[#EF2C58]">
          ← Бүх хэрэгсэл
        </Link>
        {session && (
          <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(239,44,88,0.4)] bg-black/40 px-2 py-0.5 text-[10px] font-black text-[#EF2C58] backdrop-blur-md shadow-[0_0_12px_rgba(239,44,88,0.3)]">
            <svg className="h-2.5 w-2.5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>
            {balance ?? "…"}₵
          </span>
        )}
      </div>

      {/* Neon header */}
      <div className="relative mb-6 overflow-hidden rounded-[4px] border border-[rgba(239,44,88,0.25)] bg-gradient-to-br from-[rgba(239,44,88,0.08)] via-[#0B0B0D] to-[#0B0B0D] p-5 sm:p-6">
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "linear-gradient(rgba(239,44,88,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(239,44,88,0.6) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }} />
        <div className="relative">
          <span className="rounded-full bg-[rgba(239,44,88,0.15)] px-2 py-0.5 text-[9px] font-black tracking-[0.18em] text-[#EF2C58] shadow-[0_0_12px_rgba(239,44,88,0.4)]">
            ✦ NEON · AI IMAGE
          </span>
          <h1 className="mt-2.5 bg-gradient-to-r from-white via-[#FFB3C5] to-[#EF2C58] bg-clip-text text-[24px] font-black leading-tight text-transparent sm:text-[32px]"
              style={{ filter: "drop-shadow(0 0 18px rgba(239,44,88,0.25))" }}>
            Зураг үүсгэх
          </h1>
          <p className="mt-1 text-[12px] text-[#9A9AA0]">
            Промпт + стиль + хэлбэр сонгож <strong className="text-[#EF2C58]">{COST} кредитээр</strong> AI зураг авна.
          </p>
        </div>
      </div>

      {/* Two-column workspace on desktop, stacked on mobile */}
      <div className="grid gap-5 lg:grid-cols-[1fr_minmax(320px,420px)]">
        {/* LEFT — composer */}
        <div className="space-y-4">
          {/* Prompt */}
          <div className="relative">
            <div className="absolute -inset-[1px] rounded-[5px] bg-gradient-to-r from-[#EF2C58] via-[#A855F7] to-[#EF2C58] opacity-30 blur-md" />
            <div className="relative rounded-[4px] border border-[rgba(239,44,88,0.3)] bg-[#0A0A0A]">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Жнь: A futuristic cyber city at night, neon pink lights, ultra detailed..."
                rows={4}
                maxLength={1000}
                className="w-full resize-none rounded-[4px] bg-transparent p-4 text-[14px] leading-relaxed text-[#E8E8E8] placeholder-[#555] outline-none"
              />
              <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.06)] px-3 py-2">
                <div className="text-[10px] text-[#555]">{prompt.length}/1000</div>
                <button
                  onClick={() => setPrompt("")}
                  disabled={!prompt}
                  className="text-[10px] font-bold text-[#666] transition hover:text-[#EF2C58] disabled:opacity-30"
                >
                  Цэвэрлэх
                </button>
              </div>
            </div>
          </div>

          {/* Quick prompts */}
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#666]">Түргэн санаа</div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPrompt(p)}
                  className="rounded-full border border-[rgba(239,44,88,0.2)] bg-[rgba(239,44,88,0.05)] px-3 py-1 text-[10px] font-medium text-[#CCC] transition hover:border-[rgba(239,44,88,0.5)] hover:bg-[rgba(239,44,88,0.1)] hover:text-[#EF2C58]"
                >
                  {p.length > 56 ? p.slice(0, 53) + "…" : p}
                </button>
              ))}
            </div>
          </div>

          {/* Style chooser — horizontal scroll on mobile */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#888]">Стиль</div>
              <span className="text-[10px] text-[#555]">Нэг сонго</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {IMAGE_STYLES.map((s) => {
                const active = styleId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setStyleId(s.id)}
                    className={`group flex shrink-0 flex-col items-start gap-0.5 rounded-[4px] border px-3 py-2 text-left transition ${
                      active
                        ? "border-[#EF2C58] bg-[rgba(239,44,88,0.1)] shadow-[0_0_12px_rgba(239,44,88,0.3)]"
                        : "border-[rgba(255,255,255,0.08)] bg-[#0F0F10] hover:border-[rgba(239,44,88,0.3)]"
                    }`}
                  >
                    <span className={`text-[12px] font-black ${active ? "text-[#EF2C58]" : "text-[#E8E8E8]"}`}>
                      {s.label}
                    </span>
                    <span className="text-[9px] text-[#666]">{s.blurb}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Aspect ratio chooser */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#888]">Хэлбэр</div>
              <span className="text-[10px] text-[#555]">{findAspect(aspectId).label}</span>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
              {ASPECT_RATIOS.map((a) => {
                const active = aspectId === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAspectId(a.id)}
                    className={`flex shrink-0 flex-col items-center gap-1 rounded-[4px] border px-3 py-2 transition ${
                      active
                        ? "border-[#EF2C58] bg-[rgba(239,44,88,0.1)] shadow-[0_0_12px_rgba(239,44,88,0.3)]"
                        : "border-[rgba(255,255,255,0.08)] bg-[#0F0F10] hover:border-[rgba(239,44,88,0.3)]"
                    }`}
                    aria-pressed={active}
                    title={a.id}
                  >
                    <span
                      className={`shrink-0 rounded-[2px] border ${active ? "border-[#EF2C58] bg-[rgba(239,44,88,0.2)]" : "border-[#444] bg-[#1A1A1A]"}`}
                      style={{
                        width: a.w >= a.h ? 28 : 28 * (a.w / a.h),
                        height: a.h > a.w ? 28 : 28 * (a.h / a.w),
                      }}
                    />
                    <span className={`text-[10px] font-black ${active ? "text-[#EF2C58]" : "text-[#CCC]"}`}>
                      {a.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Low balance / error */}
          {lowBalance && !error && (
            <div className="flex items-center justify-between rounded-[4px] border border-[rgba(239,44,88,0.3)] bg-[rgba(239,44,88,0.06)] px-4 py-3">
              <div>
                <div className="text-[12px] font-bold text-[#EF2C58]">Кредит дутуу</div>
                <div className="text-[11px] text-[#888]">Танд {balance}₵ байна, {COST}₵ шаардлагатай.</div>
              </div>
              <Link href="/credits/buy" className="rounded-[4px] bg-[#EF2C58] px-3 py-1.5 text-[11px] font-black text-white shadow-[0_0_18px_rgba(239,44,88,0.5)]">
                Кредит авах →
              </Link>
            </div>
          )}
          {error && (
            <div className="rounded-[4px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-[11px] text-[#EF4444]">
              {error}
            </div>
          )}

          {/* Generate button — sticky on mobile */}
          <div className="sticky bottom-[80px] z-10 lg:static lg:bottom-auto">
            <button
              onClick={submit}
              disabled={!canGenerate}
              className="group relative inline-flex w-full items-center justify-center gap-2 rounded-[4px] bg-gradient-to-r from-[#EF2C58] to-[#A855F7] px-6 py-3.5 text-[13px] font-black text-white shadow-[0_0_24px_rgba(239,44,88,0.45)] transition hover:shadow-[0_0_36px_rgba(239,44,88,0.7)] disabled:opacity-40 disabled:shadow-none"
            >
              {busy ? (
                <>
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Үүсгэж байна...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  Үүсгэх · {COST}₵
                </>
              )}
            </button>
          </div>
        </div>

        {/* RIGHT — result preview (sticky on desktop) */}
        <div className="lg:sticky lg:top-[72px] lg:self-start">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#666]">Үр дүн</div>
            <div className="text-[10px] text-[#555]">{findAspect(resultUrl ? resultAspect : aspectId).label}</div>
          </div>
          <div className="relative rounded-[4px] border border-[rgba(239,44,88,0.3)] bg-[#0A0A0A] p-1 shadow-[0_0_28px_rgba(239,44,88,0.15)]">
            <div className={`relative w-full overflow-hidden rounded-[3px] bg-[#0F0F10] ${aspectCls}`}>
              {busy ? (
                <NeonSkeleton />
              ) : resultUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resultUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
                  <svg className="h-8 w-8 text-[#333]" fill="none" stroke="currentColor" strokeWidth={1.4} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  <p className="text-[11px] text-[#555]">Үр дүн энд гарч ирнэ</p>
                </div>
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
      </div>

      {/* History strip */}
      {history.length > 0 && (
        <div className="mt-8">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#666]">Сүүлийн үүсгэлт</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {history.map((h, i) => {
              const cls = findAspect(h.aspectRatio).cls;
              return (
                <a
                  key={i}
                  href={h.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`group relative overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F10] transition hover:border-[rgba(239,44,88,0.4)] hover:shadow-[0_0_18px_rgba(239,44,88,0.25)] ${cls}`}
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

      <p className="mt-8 text-center text-[10px] text-[#444]">
        Powered by Google Gemini · Зөвхөн нэвтэрсэн хэрэглэгч ашиглана
      </p>
    </div>
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
