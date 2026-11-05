"use client";

// Poster Studio — minimal cyber-empire aesthetic per SKILL.md v2 (post the
// "remove red lines, more scannability" pass). Two variants:
//   • Thread post — single slide, single download
//   • Course slides — N slides as a carousel; each row has its own editor
//     and its own PNG download. Slides also share an image upload pool.
//
// PNG export uses the already-installed `html2canvas-pro` lib via a dynamic
// import so it doesn't bloat the page bundle. Exports at 1080×1440 native.

import { useRef, useState } from "react";
import Link from "next/link";
import { ThreadPoster } from "@/components/posters/ThreadPoster";
import { CourseSlidePoster } from "@/components/posters/CourseSlidePoster";

const ACCENT = "#2E29FF";

type Variant = "thread" | "course";

interface CourseSlideDraft {
  id: string;             // local-only key
  titleLine1: string;
  titleLine2: string;
  titleLine3: string;
  lead: string;
  image?: string;         // data URL or remote URL
}

function uid() { return Math.random().toString(36).slice(2, 9); }

export default function PosterStudioPage() {
  const [variant, setVariant] = useState<Variant>("thread");

  // ─── Shared upload helper ─────────────────────────────────────────────
  // Reads a file as a data URL so we can render immediately AND embed it in
  // the html2canvas export without any CORS dance.
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const readAsDataUrl = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(new Error("read failed"));
      r.readAsDataURL(file);
    });

  // ─── Thread state ─────────────────────────────────────────────────────
  const [text, setText] = useState(
    "Disciplin бол шинэ зэвсэг. Бүх зүйл хэвээрээ — гэхдээ үр дүн өөр."
  );
  const [category, setCategory] = useState("МЭДЭЭЛЭЛ");
  const [author, setAuthor] = useState("BUDJARGAL");
  const [authorMeta, setAuthorMeta] = useState("БЯСАЛГАГЧ");
  const [accentWord, setAccentWord] = useState("зэвсэг");
  const [threadImage, setThreadImage] = useState<string>("");
  const threadRef = useRef<HTMLDivElement>(null);

  // ─── Course slides state ──────────────────────────────────────────────
  const [courseTitle, setCourseTitle] = useState("CLAUDE EMPIRE");
  const [totalLessons, setTotalLessons] = useState(12);
  const [slides, setSlides] = useState<CourseSlideDraft[]>([
    { id: uid(), titleLine1: "AGENT", titleLine2: "AS A", titleLine3: "WEAPON", lead: "Build the agent in 24 hours. Default Sonnet. Opus only for strategy." },
    { id: uid(), titleLine1: "DEFAULT", titleLine2: "TO", titleLine3: "SONNET", lead: "Cheap, fast, smart enough. Opus only when strategy demands." },
    { id: uid(), titleLine1: "SHIP", titleLine2: "IN", titleLine3: "DAYS", lead: "Time-to-market is the moat. Stop polishing v1." },
  ]);

  // Refs for each course slide so we can capture them individually.
  const slideRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // ─── PNG export ───────────────────────────────────────────────────────
  const downloadPng = async (node: HTMLDivElement | null, filename: string) => {
    if (!node) return;
    setError(null);
    setBusyId(filename);
    try {
      const { default: html2canvas } = await import("html2canvas-pro");
      const rect = node.getBoundingClientRect();
      const scale = Math.max(1, 1080 / rect.width);
      const canvas = await html2canvas(node, {
        backgroundColor: "#0A0A0A",
        scale,
        useCORS: true,
        logging: false,
      });
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PNG export алдаа");
    } finally {
      setBusyId(null);
    }
  };

  const stamp = new Date().toISOString().slice(0, 10);

  // ─── Course slide mutators ────────────────────────────────────────────
  const updateSlide = (id: string, patch: Partial<CourseSlideDraft>) =>
    setSlides((s) => s.map((sl) => (sl.id === id ? { ...sl, ...patch } : sl)));
  const addSlide = () =>
    setSlides((s) => [...s, { id: uid(), titleLine1: "", titleLine2: "", titleLine3: "NEW", lead: "" }]);
  const removeSlide = (id: string) =>
    setSlides((s) => (s.length <= 1 ? s : s.filter((sl) => sl.id !== id)));

  return (
    <div className="mx-auto max-w-[1280px] px-4 pb-24 pt-6 sm:px-6 lg:pt-10">
      {/* ─── Header ─── */}
      <header className="mb-6 flex items-end justify-between gap-4 sm:mb-8">
        <div>
          <Link href="/" className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-[#E2E4E8] transition hover:text-[#0e1726]">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            HOME
          </Link>
          <h1 className="text-[28px] font-black leading-tight tracking-tight text-[#0e1726] sm:text-[22px] md:text-[36px]">
            Poster <span style={{ color: ACCENT }}>Studio</span>
          </h1>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[#E2E4E8]">
            Minimal cyber-empire posters. Upload an image, edit copy,
            download each slide as 1080×1440 PNG ready for Threads & IG.
          </p>
        </div>
      </header>

      {/* Variant tabs */}
      <div className="mb-6 inline-flex rounded-[4px] border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8] p-1">
        {([
          { k: "thread" as Variant, label: "Thread Post" },
          { k: "course" as Variant, label: "Course Slides" },
        ]).map((t) => {
          const active = variant === t.k;
          return (
            <button
              key={t.k}
              type="button"
              onClick={() => setVariant(t.k)}
              className={`rounded-[4px] px-4 py-2 text-[12px] font-bold transition ${
                active ? "bg-[#2E29FF] text-white shadow-[0_0_18px_rgba(46,41,255,0.3)]" : "text-[#E2E4E8] hover:text-[#0e1726]"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mb-4 rounded-[4px] border border-[#2E29FF]/30 bg-[#2E29FF]/5 px-3 py-2 text-[12px] text-[#8FC1EA]">
          {error}
        </div>
      )}

      {/* ═══ THREAD VARIANT ═══ */}
      {variant === "thread" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
          {/* Form */}
          <div className="space-y-4">
            <ImageUpload
              label="Background image"
              hint="Хоосон үлдээх боломжтой. Тавьсан зураг бүх постын фон болно."
              value={threadImage}
              onChange={async (file) => setThreadImage(file ? await readAsDataUrl(file) : "")}
            />
            <Field label="Post text" textarea value={text} onChange={setText} rows={4} maxLength={400} />
            <Field label="Category" value={category} onChange={setCategory} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Author" value={author} onChange={setAuthor} />
              <Field label="Author role" value={authorMeta} onChange={setAuthorMeta} />
            </div>
            <Field
              label="Accent word"
              hint="One word from the text — renders as the giant pixel headline."
              value={accentWord}
              onChange={setAccentWord}
            />
          </div>

          {/* Preview + download */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <div className="mx-auto w-full max-w-[540px]">
              <div ref={threadRef}>
                <ThreadPoster
                  text={text}
                  category={category}
                  author={author}
                  authorMeta={authorMeta}
                  accentWord={accentWord || undefined}
                  image={threadImage || undefined}
                />
              </div>
              <DownloadRow
                label="1080×1440 PNG"
                busy={busyId === `antaqor-thread-${author}-${stamp}.png`}
                onClick={() =>
                  downloadPng(
                    threadRef.current,
                    `antaqor-thread-${slugify(author)}-${stamp}.png`
                  )
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* ═══ COURSE CAROUSEL VARIANT ═══ */}
      {variant === "course" && (
        <div className="space-y-4">
          {/* Course-wide settings */}
          <div className="grid grid-cols-1 gap-3 rounded-[4px] border border-[rgba(15,23,38,0.06)] bg-[#f2f5f8] p-4 sm:grid-cols-[1fr_180px]">
            <Field label="Course title" value={courseTitle} onChange={setCourseTitle} />
            <Field
              label="Total lessons"
              type="number"
              value={String(totalLessons)}
              onChange={(v) => setTotalLessons(Math.max(1, parseInt(v) || 1))}
            />
          </div>

          {/* Slide rows */}
          {slides.map((slide, i) => (
            <SlideRow
              key={slide.id}
              index={i}
              total={slides.length}
              slide={slide}
              courseTitle={courseTitle}
              lessonNumber={i + 1}
              totalLessons={totalLessons}
              onChange={(patch) => updateSlide(slide.id, patch)}
              onRemove={slides.length > 1 ? () => removeSlide(slide.id) : undefined}
              registerRef={(el) => { slideRefs.current[slide.id] = el; }}
              busy={busyId === `antaqor-lesson-${String(i + 1).padStart(2, "0")}-${stamp}.png`}
              onDownload={() => {
                const filename = `antaqor-lesson-${String(i + 1).padStart(2, "0")}-${slugify(slide.titleLine1 || slide.titleLine3 || "slide")}-${stamp}.png`;
                downloadPng(slideRefs.current[slide.id], filename);
              }}
              readAsDataUrl={readAsDataUrl}
            />
          ))}

          {/* Add slide */}
          <button
            type="button"
            onClick={addSlide}
            className="flex w-full items-center justify-center gap-2 rounded-[4px] border border-dashed border-[rgba(15,23,38,0.1)] bg-[#ffffff] py-4 text-[12px] font-bold text-[#E2E4E8] transition hover:border-[rgba(46,41,255,0.4)] hover:text-[#2E29FF]"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Шинэ слайд
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Slide row (one row = one slide editor + preview + download) ────────
function SlideRow({
  index, total, slide, courseTitle, lessonNumber, totalLessons,
  onChange, onRemove, registerRef, busy, onDownload, readAsDataUrl,
}: {
  index: number;
  total: number;
  slide: CourseSlideDraft;
  courseTitle: string;
  lessonNumber: number;
  totalLessons: number;
  onChange: (patch: Partial<CourseSlideDraft>) => void;
  onRemove?: () => void;
  registerRef: (el: HTMLDivElement | null) => void;
  busy: boolean;
  onDownload: () => void;
  readAsDataUrl: (f: File) => Promise<string>;
}) {
  return (
    <div className="rounded-[4px] border border-[rgba(15,23,38,0.06)] bg-[#f2f5f8] p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.24em]" style={{ color: ACCENT }}>
            SLIDE {String(index + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </span>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-[4px] px-2 py-1 text-[10px] font-bold text-[#E2E4E8] transition hover:bg-[#2E29FF]/10 hover:text-[#4C47FF]"
            title="Слайд устгах"
          >
            УСТГАХ
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* Editor */}
        <div className="space-y-3">
          <ImageUpload
            label="Slide image"
            value={slide.image || ""}
            onChange={async (file) => onChange({ image: file ? await readAsDataUrl(file) : "" })}
            compact
          />
          <div className="space-y-1.5">
            <span className="block font-mono text-[11px] uppercase tracking-[0.22em] text-[#E2E4E8]">
              Title — 3 lines (last = accent)
            </span>
            <Field label="" value={slide.titleLine1} onChange={(v) => onChange({ titleLine1: v })} placeholder="Line 1" />
            <Field label="" value={slide.titleLine2} onChange={(v) => onChange({ titleLine2: v })} placeholder="Line 2" />
            <Field label="" value={slide.titleLine3} onChange={(v) => onChange({ titleLine3: v })} placeholder="Line 3 — accent" />
          </div>
          <Field label="Lead" textarea value={slide.lead} onChange={(v) => onChange({ lead: v })} rows={2} maxLength={200} />
        </div>

        {/* Preview + download */}
        <div className="mx-auto w-full max-w-[420px]">
          <div ref={registerRef}>
            <CourseSlidePoster
              courseTitle={courseTitle}
              lessonNumber={lessonNumber}
              totalLessons={totalLessons}
              titleLines={[slide.titleLine1, slide.titleLine2, slide.titleLine3].filter(Boolean)}
              lead={slide.lead}
              image={slide.image}
              closing={lessonNumber >= totalLessons}
            />
          </div>
          <DownloadRow label="1080×1440 PNG" busy={busy} onClick={onDownload} />
        </div>
      </div>
    </div>
  );
}

// ─── Download CTA row ───────────────────────────────────────────────────
function DownloadRow({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#E2E4E8]">
        EXPORT · {label}
      </span>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-[4px] px-4 py-2 text-[12px] font-black text-white transition disabled:opacity-50"
        style={{
          background: ACCENT,
          boxShadow: busy ? undefined : "0 6px 20px rgba(46,41,255,0.35)",
        }}
      >
        {busy ? (
          <>
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Гаргаж байна…
          </>
        ) : (
          <>
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            PNG татах
          </>
        )}
      </button>
    </div>
  );
}

// ─── Image upload control ───────────────────────────────────────────────
function ImageUpload({
  label, hint, value, onChange, compact,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (file: File | null) => Promise<void> | void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div>
      <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-[0.22em] text-[#E2E4E8]">
        {label}
      </span>
      <label
        className={`relative block w-full cursor-pointer overflow-hidden rounded-[4px] border border-dashed border-[rgba(15,23,38,0.1)] bg-[#ffffff] transition hover:border-[rgba(46,41,255,0.4)] ${
          compact ? "aspect-[3/2]" : "aspect-[16/9]"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0] || null;
            await onChange(f);
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
        {value ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); onChange(null); }}
              className="absolute right-2 top-2 rounded-[4px] bg-black/70 px-2 py-1 text-[10px] font-bold text-white hover:text-white backdrop-blur-sm hover:bg-[#2E29FF]"
            >
              УСТГАХ
            </button>
          </>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-center">
            <svg className="h-5 w-5 text-[#E2E4E8]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <span className="text-[11px] font-semibold text-[#E2E4E8]">Зураг сонгох</span>
          </div>
        )}
      </label>
      {hint && <p className="mt-1 text-[10px] text-[#E2E4E8]">{hint}</p>}
    </div>
  );
}

// ─── Form field ─────────────────────────────────────────────────────────
function Field({
  label, value, onChange, placeholder, hint, textarea, rows, maxLength, type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  textarea?: boolean;
  rows?: number;
  maxLength?: number;
  type?: string;
}) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1 block font-mono text-[11px] uppercase tracking-[0.22em] text-[#E2E4E8]">
          {label}
        </span>
      )}
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows || 3}
          maxLength={maxLength}
          className="w-full resize-y rounded-[4px] border border-[rgba(15,23,38,0.08)] bg-[#ffffff] px-2.5 py-2 text-[12.5px] leading-relaxed text-[#0e1726] placeholder-[#62666F] outline-none transition focus:border-[#2E29FF]"
        />
      ) : (
        <input
          type={type || "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-[4px] border border-[rgba(15,23,38,0.08)] bg-[#ffffff] px-2.5 py-2 text-[12.5px] text-[#0e1726] placeholder-[#62666F] outline-none transition focus:border-[#2E29FF]"
        />
      )}
      {hint && (
        <span className="mt-1 block text-[10px] text-[#E2E4E8]">{hint}</span>
      )}
    </label>
  );
}

// ─── Slug helper ────────────────────────────────────────────────────────
function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "untitled";
}
