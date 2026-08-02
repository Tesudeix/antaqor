"use client";

// Character Reference Sheet generator — focused product UX.
// User uploads a reference photo, fills a handful of identity fields + a
// freeform description, and the server assembles the full studio-grade
// prompt template and calls Nano Banana. Two-column on desktop; stacked
// on mobile. Pro fields collapsible — defaults give a clean first run.

import { useCallback, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

const PINK = "#1080CA";
const COST = 25;

interface CharForm {
  name: string;
  alias: string;
  role: string;
  age: string;
  heritage: string;
  description: string;
  height: string;
  build: string;
  faceShape: string;
  skinTone: string;
  eyes: string;
  hair: string;
  wardrobe: string;
  artifacts: string;
  traits: string;
}

const EMPTY: CharForm = {
  name: "", alias: "", role: "", age: "", heritage: "", description: "",
  height: "", build: "", faceShape: "", skinTone: "", eyes: "", hair: "",
  wardrobe: "", artifacts: "", traits: "",
};

// File → base64 data URL, with rough size check.
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("read failed"));
    r.readAsDataURL(file);
  });
}

export default function CharacterSheetPage() {
  const { data: session } = useSession();
  const [form, setForm] = useState<CharForm>(EMPTY);
  const [refs, setRefs] = useState<string[]>([]);
  const [pro, setPro] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; balance?: number } | null>(null);
  const dropRef = useRef<HTMLLabelElement>(null);
  const [dragging, setDragging] = useState(false);

  const set = <K extends keyof CharForm>(k: K, v: string) =>
    setForm((p) => ({ ...p, [k]: v }));

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    setErr(null);
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    const next: string[] = [];
    for (const f of arr) {
      if (f.size > 8 * 1024 * 1024) {
        setErr(`${f.name}: 8MB-аас бага зурагт хязгаар.`);
        continue;
      }
      try { next.push(await readFileAsDataUrl(f)); } catch { /* skip */ }
    }
    setRefs((prev) => [...prev, ...next].slice(0, 4));
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const removeRef = (i: number) =>
    setRefs((prev) => prev.filter((_, idx) => idx !== i));

  const canGenerate =
    !!form.name.trim() &&
    !!form.role.trim() &&
    !!form.description.trim() &&
    refs.length > 0 &&
    !busy;

  const generate = async () => {
    if (!canGenerate) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch("/api/tools/character-sheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, inputImages: refs }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Алдаа");
        return;
      }
      setResult({ url: data.url, balance: data.balance });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Сүлжээний алдаа");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-24 pt-6 sm:px-6 lg:pt-10">
      {/* ─── Hero ─── */}
      <header className="mb-6 flex items-start justify-between gap-4 sm:mb-8">
        <div>
          <Link href="/tools" className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-[#6b7280] transition hover:text-[#0e1726]">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            ALL TOOLS
          </Link>
          <h1 className="text-[28px] font-black leading-tight tracking-tight text-[#0e1726] sm:text-[36px]">
            Character Reference <span style={{ color: PINK }}>Sheet</span>
          </h1>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[#6b7280]">
            Studio-grade character bible — turnaround, expressions, postures,
            wardrobe details, color system. One reference photo in,
            production-ready sheet out.
          </p>
        </div>
        <div className="hidden flex-col items-end gap-1 sm:flex">
          <span className="rounded-none border border-[rgba(16,128,202,0.3)] bg-[rgba(16,128,202,0.08)] px-2.5 py-1 font-mono text-[10px] font-black tracking-[0.2em]" style={{ color: PINK }}>
            POWERED BY NANO BANANA
          </span>
          <span className="font-mono text-[10px] tracking-wider text-[#6b7280]">
            {COST} КРЕДИТ / SHEET
          </span>
        </div>
      </header>

      {/* ─── Layout: form left, preview right ─── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[440px_1fr]">

        {/* ═══ LEFT — FORM ═══ */}
        <div className="space-y-5">

          {/* 1. Reference photos */}
          <Section step={1} title="Reference photos" hint={`${refs.length} / 4`}>
            <label
              ref={dropRef}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex aspect-[16/9] w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-none border-2 border-dashed transition ${
                dragging
                  ? "border-[rgba(16,128,202,0.6)] bg-[rgba(16,128,202,0.05)]"
                  : "border-[rgba(15,23,38,0.1)] bg-[#ffffff] hover:border-[rgba(16,128,202,0.35)]"
              }`}
            >
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
              <svg className="h-7 w-7 text-[#94a3b8]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              <span className="text-[13px] font-semibold text-[#0e1726]">
                Зургаа чирж тавь эсвэл сонго
              </span>
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#94a3b8]">
                PNG · JPG · WEBP · 8MB
              </span>
            </label>

            {refs.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {refs.map((src, i) => (
                  <div key={i} className="group relative aspect-square overflow-hidden rounded-none border border-[rgba(15,23,38,0.08)] bg-[#ffffff]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeRef(i)}
                      aria-label="Устгах"
                      className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
                    >
                      <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* 2. Identity */}
          <Section step={2} title="Identity">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Name *" value={form.name} onChange={(v) => set("name", v)} placeholder="Бат-Эрдэнэ" />
              <Field label="Alias" value={form.alias} onChange={(v) => set("alias", v)} placeholder="Codename" />
              <Field label="Role *" value={form.role} onChange={(v) => set("role", v)} placeholder="Field Operative" />
              <Field label="Age" value={form.age} onChange={(v) => set("age", v)} placeholder="32" />
              <div className="col-span-2">
                <Field label="Heritage" value={form.heritage} onChange={(v) => set("heritage", v)} placeholder="Mongolian · ethnic Khalkha" />
              </div>
            </div>
          </Section>

          {/* 3. Description */}
          <Section step={3} title="Character description" hint="* required">
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={5}
              placeholder="Шинж чанар, төрх, хувцас, дадал зуршил, зэр зэвсэг — нэг параграф бичих. Хоосон үлдээсэн талбаруудыг энд бичсэнээс уншиж бөглөнө."
              className="w-full resize-y rounded-none border border-[rgba(15,23,38,0.08)] bg-[#ffffff] px-3 py-2.5 text-[13px] leading-relaxed text-[#0e1726] placeholder-[#94a3b8] outline-none transition focus:border-[rgba(16,128,202,0.4)]"
            />
            <p className="mt-1 text-[10px] text-[#94a3b8]">
              💡 Энэ нь хамгийн чухал input. Тодорхой бич — model үүнийг “authoritative source” болгож ашиглана.
            </p>
          </Section>

          {/* 4. Pro fields */}
          <div className="rounded-none border border-[rgba(15,23,38,0.06)] bg-[#0B0B0C]">
            <button
              type="button"
              onClick={() => setPro((p) => !p)}
              className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-[rgba(15,23,38,0.02)]"
            >
              <div className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-none bg-[rgba(15,23,38,0.05)] font-mono text-[10px] font-bold text-[#6b7280]">
                  4
                </span>
                <span className="text-[13px] font-bold text-[#0e1726]">Pro details</span>
                <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#94a3b8]">optional</span>
              </div>
              <svg className={`h-4 w-4 text-[#6b7280] transition-transform ${pro ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {pro && (
              <div className="border-t border-[rgba(15,23,38,0.06)] p-4">
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Height" value={form.height} onChange={(v) => set("height", v)} placeholder="178cm / 5'10&quot;" />
                  <Field label="Build" value={form.build} onChange={(v) => set("build", v)} placeholder="lean athletic" />
                  <Field label="Face shape" value={form.faceShape} onChange={(v) => set("faceShape", v)} placeholder="angular jaw, high cheekbones" />
                  <Field label="Skin tone" value={form.skinTone} onChange={(v) => set("skinTone", v)} placeholder="warm olive #C9966B" />
                  <Field label="Eyes" value={form.eyes} onChange={(v) => set("eyes", v)} placeholder="dark brown, deep-set" />
                  <Field label="Hair" value={form.hair} onChange={(v) => set("hair", v)} placeholder="black undercut, side part" />
                  <div className="col-span-2">
                    <Field label="Wardrobe" value={form.wardrobe} onChange={(v) => set("wardrobe", v)} placeholder="charcoal field jacket, gray henley, dark jeans, worn combat boots" />
                  </div>
                  <div className="col-span-2">
                    <Field label="Signature artifacts" value={form.artifacts} onChange={(v) => set("artifacts", v)} placeholder="vintage dive watch, silver signet ring on right hand" />
                  </div>
                  <div className="col-span-2">
                    <Field label="Core traits" value={form.traits} onChange={(v) => set("traits", v)} placeholder="vigilant, methodical, dry humor" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error */}
          {err && (
            <div className="rounded-none border border-[rgba(16,128,202,0.3)] bg-[rgba(16,128,202,0.05)] px-3 py-2 text-[12px] text-[#FF8B8B]">
              {err}
            </div>
          )}

          {/* Generate */}
          {!session ? (
            <Link
              href="/auth/signin"
              className="flex w-full items-center justify-center gap-2 rounded-none border border-[rgba(16,128,202,0.4)] bg-[rgba(16,128,202,0.06)] px-4 py-3.5 text-[13px] font-bold text-[#1080CA] transition hover:bg-[rgba(16,128,202,0.12)]"
            >
              Нэвтэрч ашиглах
            </Link>
          ) : (
            <button
              type="button"
              onClick={generate}
              disabled={!canGenerate}
              className="flex w-full items-center justify-center gap-2 rounded-none bg-[#1080CA] px-4 py-3.5 text-[13px] font-black text-[#0E0E10] transition hover:bg-[#FF3D69] disabled:cursor-not-allowed disabled:opacity-40"
              style={{ boxShadow: canGenerate ? "0 8px 28px rgba(16,128,202,0.35)" : undefined }}
            >
              {busy ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Үүсгэж байна… ~30 сек
                </>
              ) : (
                <>
                  Sheet үүсгэх
                  <span className="rounded-none bg-black/20 px-1.5 py-0.5 font-mono text-[10px]">
                    {COST} КРЕДИТ
                  </span>
                </>
              )}
            </button>
          )}
        </div>

        {/* ═══ RIGHT — RESULT ═══ */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="overflow-hidden rounded-none border border-[rgba(15,23,38,0.08)] bg-[#ffffff]">
            <div className="flex items-center justify-between border-b border-[rgba(15,23,38,0.06)] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rotate-45 bg-[#1080CA] shadow-[0_0_6px_rgba(16,128,202,0.7)]" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#6b7280]">
                  PREVIEW · 16:9
                </span>
              </div>
              {result && (
                <a
                  href={result.url}
                  download={`character-sheet-${form.name || "untitled"}.png`}
                  className="inline-flex items-center gap-1 rounded-none bg-[rgba(15,23,38,0.05)] px-2.5 py-1 text-[11px] font-bold text-[#0e1726] transition hover:bg-[rgba(15,23,38,0.1)]"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                  Татах
                </a>
              )}
            </div>
            <div className="aspect-video w-full bg-[#ffffff]">
              {result ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={result.url} alt="Character sheet" className="h-full w-full object-contain" />
              ) : busy ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-none border border-[rgba(16,128,202,0.3)] bg-[rgba(16,128,202,0.06)]">
                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-[#1080CA] border-t-transparent" />
                  </div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#6b7280]">
                    NANO BANANA RENDERING
                  </p>
                  <p className="max-w-xs text-[11px] leading-relaxed text-[#6b7280]">
                    Turnaround, expressions, postures, wardrobe details — 8 zones, single composition. Ihэвчлэн 20-40 сек.
                  </p>
                </div>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
                  <div className="grid grid-cols-4 gap-0.5">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="h-10 w-7 rounded-none bg-[rgba(15,23,38,0.04)]" />
                    ))}
                  </div>
                  <p className="text-[12px] font-semibold text-[#6b7280]">
                    Sheet тэнд гарна
                  </p>
                  <p className="max-w-xs text-[11px] leading-relaxed text-[#94a3b8]">
                    1. Reference зураг 2. Нэр + role 3. Тайлбар → Sheet үүсгэх
                  </p>
                </div>
              )}
            </div>
          </div>

          {result && (
            <div className="mt-3 flex items-center justify-between text-[11px] text-[#6b7280]">
              <span className="font-mono uppercase tracking-wider">
                {form.name} · {form.role}
              </span>
              <button
                type="button"
                onClick={generate}
                disabled={busy}
                className="font-bold text-[#6b7280] transition hover:text-[#1080CA] disabled:opacity-40"
              >
                ↻ Дахин үүсгэх
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Small UI primitives ────────────────────────────────────────────────
function Section({
  step, title, hint, children,
}: {
  step: number; title: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="flex h-5 w-5 items-center justify-center rounded-none bg-[rgba(16,128,202,0.1)] font-mono text-[10px] font-bold text-[#1080CA]">
          {step}
        </span>
        <h2 className="text-[13px] font-bold text-[#0e1726]">{title}</h2>
        {hint && <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#94a3b8]">{hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label, value, onChange, placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-mono text-[9px] uppercase tracking-[0.18em] text-[#6b7280]">
        {label}
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-none border border-[rgba(15,23,38,0.08)] bg-[#ffffff] px-2.5 py-2 text-[12px] text-[#0e1726] placeholder-[#94a3b8] outline-none transition focus:border-[rgba(16,128,202,0.4)]"
      />
    </label>
  );
}
