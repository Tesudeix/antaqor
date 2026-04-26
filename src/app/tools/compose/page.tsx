"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

const COST = 10;
const MAX_BYTES = 5 * 1024 * 1024;
const MIN_IMAGES = 2;
const MAX_IMAGES = 5;

interface Slot {
  id: string;
  file: File | null;
  preview: string;
  label: string; // user-defined reference name (e.g. "subject", "background")
}

const TEMPLATE_LABELS = ["subject", "background", "product", "outfit", "style"];

const PROMPT_TEMPLATES = [
  {
    title: "Бараа + хүн",
    body: "Place {product} in {subject}'s hand naturally. Keep the subject's pose and lighting unchanged.",
    needs: ["subject", "product"],
  },
  {
    title: "Хүн + фон",
    body: "Place {subject} into the scene from {background}. Match the lighting and perspective of the background.",
    needs: ["subject", "background"],
  },
  {
    title: "Хувцас солих",
    body: "Replace the outfit on {subject} with {outfit}. Keep face, pose, and background of {subject} the same.",
    needs: ["subject", "outfit"],
  },
  {
    title: "Стиль шилжүүлэх",
    body: "Recreate {subject} in the visual style of {style}.",
    needs: ["subject", "style"],
  },
];

export default function ComposePage() {
  const { data: session, status } = useSession();
  const [slots, setSlots] = useState<Slot[]>(() => [
    { id: cryptoRandom(), file: null, preview: "", label: "subject" },
    { id: cryptoRandom(), file: null, preview: "", label: "product" },
  ]);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [resultUrl, setResultUrl] = useState("");
  const [error, setError] = useState("");
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/credits")
      .then((r) => r.json())
      .then((d) => { if (typeof d.balance === "number") setBalance(d.balance); })
      .catch(() => {});
  }, [status]);

  // Cleanup blob URLs
  useEffect(() => () => slots.forEach((s) => s.preview && URL.revokeObjectURL(s.preview)), [slots]);

  const setSlotFile = (id: string, file: File | null) => {
    setError("");
    setResultUrl("");
    if (file && !file.type.startsWith("image/")) {
      setError("Зөвхөн зургийн файл (JPG, PNG, WebP)");
      return;
    }
    if (file && file.size > MAX_BYTES) {
      setError("Зураг 5MB-аас бага байх ёстой");
      return;
    }
    setSlots((prev) => prev.map((s) => {
      if (s.id !== id) return s;
      if (s.preview) URL.revokeObjectURL(s.preview);
      return { ...s, file, preview: file ? URL.createObjectURL(file) : "" };
    }));
  };

  const setSlotLabel = (id: string, label: string) => {
    setSlots((prev) => prev.map((s) => s.id === id ? { ...s, label: label.replace(/[^a-zA-Z0-9_\- ]/g, "").slice(0, 40) } : s));
  };

  const addSlot = () => {
    if (slots.length >= MAX_IMAGES) return;
    const taken = new Set(slots.map((s) => s.label));
    const next = TEMPLATE_LABELS.find((l) => !taken.has(l)) || `image${slots.length + 1}`;
    setSlots((prev) => [...prev, { id: cryptoRandom(), file: null, preview: "", label: next }]);
  };

  const removeSlot = (id: string) => {
    if (slots.length <= MIN_IMAGES) return;
    setSlots((prev) => {
      const out = prev.filter((s) => s.id !== id);
      const removed = prev.find((s) => s.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return out;
    });
  };

  const insertReference = (label: string) => {
    setPrompt((p) => `${p}${p && !p.endsWith(" ") ? " " : ""}{${label}} `);
  };

  const applyTemplate = (tpl: typeof PROMPT_TEMPLATES[number]) => {
    // Make sure each {label} the template needs has a slot — auto-rename or add
    setSlots((prev) => {
      const out = [...prev];
      tpl.needs.forEach((needed, i) => {
        if (out[i]) {
          out[i] = { ...out[i], label: needed };
        } else if (out.length < MAX_IMAGES) {
          out.push({ id: cryptoRandom(), file: null, preview: "", label: needed });
        }
      });
      return out;
    });
    setPrompt(tpl.body);
  };

  const submit = async () => {
    const filledSlots = slots.filter((s) => s.file);
    if (filledSlots.length < MIN_IMAGES) {
      setError(`Хамгийн багадаа ${MIN_IMAGES} зураг сонгоно уу`);
      return;
    }
    if (!prompt.trim()) {
      setError("Промпт оруулна уу");
      return;
    }
    setBusy(true);
    setError("");
    setResultUrl("");
    try {
      const fd = new FormData();
      for (const s of filledSlots) {
        fd.append("images", s.file as File);
        fd.append("labels", s.label || "image");
      }
      fd.append("prompt", prompt);
      const res = await fetch("/api/tools/compose", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        if (typeof data.balance === "number") setBalance(data.balance);
        setError(data.error || "Compose амжилтгүй");
        return;
      }
      setResultUrl(data.url);
      if (typeof data.balance === "number") setBalance(data.balance);
    } catch {
      setError("Сүлжээний алдаа. Дахин оролдоно уу.");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    slots.forEach((s) => s.preview && URL.revokeObjectURL(s.preview));
    setSlots([
      { id: cryptoRandom(), file: null, preview: "", label: "subject" },
      { id: cryptoRandom(), file: null, preview: "", label: "product" },
    ]);
    setPrompt("");
    setResultUrl("");
    setError("");
  };

  const filledCount = slots.filter((s) => s.file).length;
  const canSubmit = filledCount >= MIN_IMAGES && prompt.trim().length > 0 && !busy && (balance === null || balance >= COST);
  const lowBalance = balance !== null && balance < COST;

  return (
    <div className="relative mx-auto max-w-[1100px] pb-16">
      {/* Neon ambient glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(239,44,88,0.16)_0%,transparent_70%)] blur-3xl" />
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

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[rgba(239,44,88,0.12)] px-2 py-0.5 text-[9px] font-black tracking-[0.18em] text-[#EF2C58]">
            ✦ AI WORKFLOW
          </span>
          <span className="rounded-full bg-[rgba(168,85,247,0.12)] px-2 py-0.5 text-[9px] font-black tracking-[0.18em] text-[#A855F7]">
            ШИНЭ
          </span>
        </div>
        <h1 className="mt-2 bg-gradient-to-r from-white via-[#FFB3C5] to-[#A855F7] bg-clip-text text-[24px] font-black leading-tight text-transparent sm:text-[32px]"
            style={{ filter: "drop-shadow(0 0 18px rgba(239,44,88,0.25))" }}>
          Зураг хослуулах
        </h1>
        <p className="mt-1.5 max-w-[640px] text-[13px] leading-relaxed text-[#9A9AA0]">
          2–5 зургийг холбоод нэг шинэ зураг бүтээ. Зураг бүрд label өгөөд промпт-д <code className="rounded-[3px] bg-[rgba(239,44,88,0.1)] px-1 text-[#EF2C58]">{"{label}"}</code> хэлбэрээр дурд.
        </p>
      </div>

      {/* Template chips */}
      <div className="mb-4">
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-[#666]">Жишээ workflow</div>
        <div className="flex flex-wrap gap-1.5">
          {PROMPT_TEMPLATES.map((t) => (
            <button
              key={t.title}
              type="button"
              onClick={() => applyTemplate(t)}
              className="rounded-full border border-[rgba(239,44,88,0.2)] bg-[rgba(239,44,88,0.05)] px-3 py-1 text-[10px] font-bold text-[#CCC] transition hover:border-[rgba(239,44,88,0.5)] hover:bg-[rgba(239,44,88,0.1)] hover:text-[#EF2C58]"
            >
              {t.title}
            </button>
          ))}
        </div>
      </div>

      {/* Workflow strip — image slots in a row with chevrons */}
      <div className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] p-3 sm:p-4">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#888]">Workflow ({filledCount}/{slots.length} бөглөгдсөн)</div>
          <button
            type="button"
            onClick={addSlot}
            disabled={slots.length >= MAX_IMAGES}
            className="inline-flex items-center gap-1 rounded-[4px] border border-dashed border-[rgba(239,44,88,0.4)] px-2.5 py-1 text-[10px] font-black text-[#EF2C58] transition hover:bg-[rgba(239,44,88,0.06)] disabled:opacity-30"
          >
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
            Зураг нэмэх
          </button>
        </div>

        {/* Horizontal scroll on mobile, wrap on desktop */}
        <div className="flex flex-wrap items-stretch gap-2 sm:gap-3 overflow-x-auto pb-1">
          {slots.map((slot, i) => (
            <div key={slot.id} className="flex items-center gap-2 sm:gap-3">
              <ImageSlot
                slot={slot}
                index={i}
                canRemove={slots.length > MIN_IMAGES}
                onPick={(f) => setSlotFile(slot.id, f)}
                onLabel={(v) => setSlotLabel(slot.id, v)}
                onRemove={() => removeSlot(slot.id)}
              />
              {i < slots.length - 1 && (
                <svg className="h-4 w-4 shrink-0 text-[#EF2C58]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              )}
            </div>
          ))}

          {/* Trailing chevron + AI step */}
          <div className="flex items-center gap-2 sm:gap-3">
            <svg className="h-4 w-4 shrink-0 text-[#EF2C58]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
            <div className="flex h-[140px] w-[140px] flex-col items-center justify-center gap-1.5 rounded-[4px] border border-[rgba(168,85,247,0.4)] bg-gradient-to-br from-[rgba(239,44,88,0.08)] to-[rgba(168,85,247,0.08)] p-2 text-center shadow-[0_0_18px_rgba(239,44,88,0.2)]">
              <svg className="h-5 w-5 text-[#A855F7]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              <div className="text-[11px] font-black text-[#A855F7]">AI</div>
              <div className="text-[9px] text-[#888]">{COST}₵</div>
            </div>
          </div>
        </div>
      </div>

      {/* Prompt composer */}
      <div className="relative mt-4">
        <div className="absolute -inset-[1px] rounded-[5px] bg-gradient-to-r from-[#EF2C58] via-[#A855F7] to-[#EF2C58] opacity-25 blur-md" />
        <div className="relative rounded-[4px] border border-[rgba(239,44,88,0.3)] bg-[#0A0A0A]">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={`Жнь: Place {${slots[0]?.label || "subject"}} into the scene from {${slots[1]?.label || "background"}}. Match the lighting...`}
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

      {/* Reference chips — insert {label} into prompt */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="text-[10px] font-bold text-[#666]">Зургаа дурд:</span>
        {slots.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => insertReference(s.label || "image")}
            className="rounded-[3px] border border-[rgba(239,44,88,0.25)] bg-[rgba(239,44,88,0.05)] px-2 py-0.5 text-[10px] font-bold text-[#EF2C58] transition hover:bg-[rgba(239,44,88,0.12)]"
          >
            {`{${s.label || "image"}}`}
          </button>
        ))}
      </div>

      {lowBalance && !error && (
        <div className="mt-4 flex items-center justify-between rounded-[4px] border border-[rgba(239,44,88,0.3)] bg-[rgba(239,44,88,0.06)] px-4 py-3">
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
        <div className="mt-4 rounded-[4px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.08)] px-3 py-2 text-[11px] text-[#EF4444]">
          {error}
        </div>
      )}

      {/* Generate — sticky on mobile */}
      <div className="sticky bottom-[80px] z-10 mt-4 lg:static lg:bottom-auto">
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="inline-flex w-full items-center justify-center gap-2 rounded-[4px] bg-gradient-to-r from-[#EF2C58] to-[#A855F7] px-6 py-3.5 text-[13px] font-black text-white shadow-[0_0_24px_rgba(239,44,88,0.45)] transition hover:shadow-[0_0_36px_rgba(239,44,88,0.7)] disabled:opacity-40 disabled:shadow-none"
        >
          {busy ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Хослуулж байна...
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              Хослуулах · {COST}₵
            </>
          )}
        </button>
      </div>

      {/* Result */}
      {(busy || resultUrl) && (
        <div className="mt-6">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#666]">Үр дүн</div>
          <div className="relative rounded-[4px] border border-[rgba(239,44,88,0.3)] bg-[#0A0A0A] p-1 shadow-[0_0_28px_rgba(239,44,88,0.15)]">
            <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[3px] bg-[#0F0F10]">
              {busy ? (
                <Skeleton />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={resultUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
              )}
            </div>
          </div>
          {resultUrl && !busy && (
            <div className="mt-3 flex flex-wrap gap-2">
              <a
                href={resultUrl}
                download={`compose-${Date.now()}.png`}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-[4px] bg-[#EF2C58] py-2.5 text-[12px] font-black text-white transition hover:bg-[#D4264E]"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Татах
              </a>
              <button
                onClick={reset}
                className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-4 py-2.5 text-[12px] font-bold text-[#888] transition hover:text-[#E8E8E8]"
              >
                Шинээр
              </button>
            </div>
          )}
        </div>
      )}

      {/* How-to */}
      <details className="mt-8 rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F10] p-4">
        <summary className="cursor-pointer text-[12px] font-bold text-[#E8E8E8]">
          Workflow яаж ажилладаг вэ?
        </summary>
        <div className="mt-3 space-y-2 text-[12px] leading-relaxed text-[#888]">
          <p><strong className="text-[#EF2C58]">1.</strong> 2–5 зураг нэм. Зураг тус бүрд label өг (subject, background, product г.м).</p>
          <p><strong className="text-[#EF2C58]">2.</strong> Промпт-ондоо тэр label-уудыг <code className="rounded-[3px] bg-[rgba(239,44,88,0.1)] px-1 text-[#EF2C58]">{"{subject}"}</code> хэлбэрээр дурд.</p>
          <p><strong className="text-[#EF2C58]">3.</strong> AI бүх зургийг нэг шинэ зураг болгож хослуулна.</p>
          <p className="text-[11px] text-[#666]">Powered by Google Gemini Nano Banana — multi-image AI workflow.</p>
        </div>
      </details>
    </div>
  );
}

function ImageSlot({
  slot, index, canRemove, onPick, onLabel, onRemove,
}: {
  slot: Slot;
  index: number;
  canRemove: boolean;
  onPick: (f: File | null) => void;
  onLabel: (v: string) => void;
  onRemove: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  return (
    <div className="flex w-[140px] shrink-0 flex-col gap-1.5">
      {/* Image picker */}
      {slot.preview ? (
        <div className="relative aspect-square w-full overflow-hidden rounded-[4px] border border-[rgba(239,44,88,0.3)] bg-[#0A0A0A]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slot.preview} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[9px] font-black text-white backdrop-blur">
            {index + 1}
          </span>
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 bg-gradient-to-t from-black/85 to-transparent p-1">
            <button
              onClick={() => inputRef.current?.click()}
              className="rounded-[3px] bg-black/70 px-2 py-0.5 text-[9px] font-bold text-white backdrop-blur transition hover:bg-black/90"
            >
              Солих
            </button>
            {canRemove && (
              <button
                onClick={onRemove}
                className="rounded-[3px] bg-black/70 p-1 text-white backdrop-blur transition hover:bg-[#EF4444]"
                aria-label="Устгах"
              >
                <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            )}
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); onPick(e.dataTransfer.files?.[0] || null); }}
          className={`relative flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-[4px] border-2 border-dashed bg-[#0A0A0A] p-2 text-center transition ${
            drag ? "border-[#EF2C58] bg-[rgba(239,44,88,0.05)]" : "border-[rgba(239,44,88,0.25)] hover:border-[rgba(239,44,88,0.5)]"
          }`}
        >
          <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[rgba(239,44,88,0.15)] text-[9px] font-black text-[#EF2C58]">
            {index + 1}
          </span>
          {canRemove && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/40 text-[#666] backdrop-blur transition hover:bg-black/70 hover:text-[#EF4444]"
              aria-label="Устгах"
            >
              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
          <svg className="h-5 w-5 text-[#EF2C58]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
          </svg>
          <span className="text-[10px] font-bold text-[#888]">Сонгох</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={(e) => onPick(e.target.files?.[0] || null)} className="hidden" />

      {/* Label input */}
      <div className="relative">
        <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-[#666]">{"{"}</span>
        <input
          value={slot.label}
          onChange={(e) => onLabel(e.target.value)}
          placeholder="нэр"
          maxLength={40}
          className="w-full rounded-[3px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3.5 py-1 text-[10px] font-bold text-[#EF2C58] outline-none focus:border-[rgba(239,44,88,0.4)]"
        />
        <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-[#666]">{"}"}</span>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden bg-[#0A0A0A]">
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(90deg, transparent 0%, rgba(239,44,88,0.18) 50%, transparent 100%)",
          animation: "composeShimmer 1.4s ease-in-out infinite",
        }}
      />
      <div className="relative z-10 flex flex-col items-center gap-2.5">
        <span className="flex h-14 w-14 items-center justify-center rounded-[4px] bg-[rgba(168,85,247,0.1)] shadow-[0_0_24px_rgba(168,85,247,0.5)]">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-[#A855F7] border-t-transparent" />
        </span>
        <p className="text-[12px] font-bold text-[#E8E8E8]">Workflow ажиллаж байна</p>
        <p className="text-[10px] text-[#666]">15–30 секунд хүртэл хүлээгээрэй</p>
      </div>
      <style jsx>{`
        @keyframes composeShimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

function cryptoRandom(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}
