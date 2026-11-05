"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

interface Props {
  text: string;
  /** Used to generate the download filename (e.g. "промт", "пост"). */
  category?: string;
  /** Author display name — folded into the filename. */
  authorName?: string;
  /** When false, content is hidden behind a paywall skeleton. */
  unlocked: boolean;
  /** Deprecated — the in-app AI CTA was removed. Kept for caller compat. */
  hideAiLink?: boolean;
  /** Compact (true) hides the variables/sections row to save vertical space. */
  compact?: boolean;
}

/* ─── slug helpers ─── */
function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9а-яёөүңі\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "prompt";
}

function makeFilename(text: string, category?: string, author?: string): string {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim().length > 0) || "";
  const cleaned = firstLine
    .replace(/^[#*\->\s]+/, "")
    .replace(/[*_`~]/g, "")
    .trim();
  const base = cleaned || category || "prompt";
  const tag = category && category !== "пост" ? `_${slugify(category)}` : "";
  const name = `${slugify(base)}${tag}`.slice(0, 60);
  const auth = author ? `_by-${slugify(author).slice(0, 20)}` : "";
  return `${name}${auth}.md`;
}

/* ─── stats ─── */
function countTokensApprox(s: string): number {
  // Rough approximation: 1 token ≈ 4 chars (English/Cyrillic mix lands close).
  return Math.max(1, Math.round(s.length / 4));
}
function countLines(s: string): number {
  return s.split(/\r?\n/).length;
}
function countVars(s: string): number {
  // Detect {var}, {{var}}, [var], <var> — common templating styles.
  const matches = s.match(/(\{\{?\w[\w\s]*\}?\}|\[\w[\w\s]*\]|<\w[\w\s-]*>)/g);
  return matches ? new Set(matches).size : 0;
}
function detectSections(s: string): string[] {
  // Markdown headings (## SYSTEM) and CAPITAL_HEADER lines.
  const out: string[] = [];
  for (const line of s.split(/\r?\n/)) {
    const md = line.match(/^#{1,6}\s+(.{1,40})/);
    if (md) { out.push(md[1].trim()); continue; }
    const caps = line.match(/^\s*([A-ZА-ЯӨҮ][A-ZА-ЯӨҮ_\s]{3,30}):\s*$/);
    if (caps) out.push(caps[1].trim());
    if (out.length >= 6) break;
  }
  return out;
}
function bytesLabel(s: string): string {
  const bytes = new Blob([s]).size;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

/* ─── variable highlighter ─── */
function renderHighlighted(text: string): React.ReactNode {
  const re = /(\{\{?\w[\w\s]*\}?\}|\[\w[\w\s]*\]|<\w[\w\s-]*>)/g;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <span
        key={`v${i++}`}
        className="rounded-[4px] bg-[rgba(46,41,255,0.18)] px-0.5 text-[#7E22CE]"
      >
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/* ─── component ─── */
export default function PromptFile({
  text,
  category,
  authorName,
  unlocked,
  compact,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const stats = useMemo(() => {
    const lines = countLines(text);
    const tokens = countTokensApprox(text);
    const vars = countVars(text);
    const sections = detectSections(text);
    const filename = makeFilename(text, category, authorName);
    return { lines, tokens, vars, sections, filename };
  }, [text, category, authorName]);

  const copy = async () => {
    if (!unlocked) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const download = () => {
    if (!unlocked) return;
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = stats.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ── locked view (non-members) ── */
  if (!unlocked) {
    return (
      <Link
        href="/auth/signup"
        className="group block overflow-hidden rounded-[4px] border border-[rgba(46,41,255,0.28)] bg-gradient-to-br from-[rgba(46,41,255,0.10)] via-[#ffffff] to-[#ffffff] transition hover:border-[#2E29FF]"
      >
        <div className="flex items-center justify-between gap-2 border-b border-[rgba(46,41,255,0.18)] px-3 py-2">
          <div className="flex items-center gap-2">
            <FileGlyph color="#2E29FF" />
            <span
              className="font-mono text-[10px] font-black tracking-[0.22em] text-[#2E29FF]"
              style={{ fontFamily: "Inter, system-ui, sans-serif" }}
            >
              PROMPT.FILE · ТҮГЖЭЭТЭЙ
            </span>
          </div>
          <span className="font-mono text-[11px] tracking-[0.18em] text-[#E2E4E8] group-hover:text-[#2E29FF]">
            ГИШҮҮН БОЛОХ →
          </span>
        </div>
        <div className="space-y-1.5 p-3">
          <div className="h-2 w-[88%] animate-pulse rounded-[4px] bg-[rgba(46,41,255,0.16)]" />
          <div className="h-2 w-[72%] animate-pulse rounded-[4px] bg-[rgba(46,41,255,0.13)]" style={{ animationDelay: "120ms" }} />
          <div className="h-2 w-[56%] animate-pulse rounded-[4px] bg-[rgba(46,41,255,0.10)]" style={{ animationDelay: "240ms" }} />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-[rgba(46,41,255,0.18)] px-3 py-2 text-[10px] text-[#E2E4E8]">
          <span>{stats.lines} мөр · ~{stats.tokens.toLocaleString()} token</span>
          <span className="font-mono tracking-wide text-[#E2E4E8]">{bytesLabel(text)}</span>
        </div>
      </Link>
    );
  }

  /* ── unlocked view ── */
  const previewText = open ? text : (() => {
    const lines = text.split(/\r?\n/);
    const head = lines.slice(0, 6).join("\n");
    return head.length > 320 ? head.slice(0, 320) : head;
  })();

  return (
    <div className="overflow-hidden rounded-[4px] border border-[rgba(46,41,255,0.22)] bg-gradient-to-br from-[rgba(46,41,255,0.08)] via-[#ffffff] to-[#ffffff]">
      {/* header */}
      <div className="flex items-center justify-between gap-2 border-b border-[rgba(46,41,255,0.16)] px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <FileGlyph color="#2E29FF" />
          <span
            className="font-mono text-[10px] font-black tracking-[0.22em] text-[#2E29FF]"
            style={{ fontFamily: "Inter, system-ui, sans-serif" }}
          >
            PROMPT.FILE
          </span>
          <span className="truncate font-mono text-[10px] text-[#E2E4E8]" title={stats.filename}>
            · {stats.filename}
          </span>
        </div>
        <span className="shrink-0 font-mono text-[11px] tracking-wide text-[#E2E4E8]">{bytesLabel(text)}</span>
      </div>

      {/* stats bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[rgba(46,41,255,0.10)] px-3 py-1.5 text-[10px] text-[#E2E4E8]">
        <span><b className="text-[#0e1726]">{stats.lines}</b> мөр</span>
        <span><b className="text-[#0e1726]">{text.length.toLocaleString()}</b> chars</span>
        <span>~<b className="text-[#0e1726]">{stats.tokens.toLocaleString()}</b> token</span>
        {stats.vars > 0 && (
          <span title="Хувьсагч {var}, [var], <var> хэлбэрээр илэрсэн">
            <b className="text-[#7E22CE]">{stats.vars}</b> хувьсагч
          </span>
        )}
        {!compact && stats.sections.length > 0 && (
          <span className="truncate" title={stats.sections.join(" · ")}>
            <b className="text-[#0e1726]">{stats.sections.length}</b> хэсэг
          </span>
        )}
      </div>

      {/* sections preview chips (only when expanded + non-compact) */}
      {!compact && open && stats.sections.length > 0 && (
        <div className="flex flex-wrap gap-1 border-b border-[rgba(46,41,255,0.10)] px-3 py-1.5">
          {stats.sections.map((sec, i) => (
            <span
              key={i}
              className="rounded-[4px] border border-[rgba(46,41,255,0.25)] bg-[rgba(46,41,255,0.08)] px-1.5 py-0.5 font-mono text-[11px] tracking-wide text-[#7E22CE]"
            >
              {sec.slice(0, 24)}
            </span>
          ))}
        </div>
      )}

      {/* content body — code-block style */}
      <div className="relative">
        <pre
          className={`overflow-y-auto whitespace-pre-wrap break-words px-3 py-2.5 font-mono text-[12px] leading-relaxed text-[#0e1726] ${
            open ? "max-h-[420px]" : "max-h-[156px]"
          }`}
          style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
        >
          {renderHighlighted(previewText)}
        </pre>
        {!open && text.length > previewText.length && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black to-transparent" />
        )}
      </div>

      {/* actions */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-[rgba(46,41,255,0.16)] px-3 py-2">
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-[4px] bg-[#2E29FF] px-3 py-1.5 font-mono text-[10px] font-black tracking-[0.2em] text-white transition hover:bg-[#FF3D69]"
        >
          {copied ? (
            <>
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              COPIED
            </>
          ) : (
            <>
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              COPY
            </>
          )}
        </button>
        <button
          type="button"
          onClick={download}
          className="inline-flex items-center gap-1.5 rounded-[4px] border border-[rgba(15,23,38,0.14)] bg-[rgba(15,23,38,0.04)] px-2.5 py-1.5 font-mono text-[10px] font-black tracking-[0.2em] text-[#0e1726] transition hover:border-[#2E29FF] hover:text-[#2E29FF]"
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
          </svg>
          .MD
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="ml-auto inline-flex items-center gap-1 font-mono text-[10px] font-black tracking-[0.2em] text-[#E2E4E8] transition hover:text-[#0e1726]"
        >
          {open ? "БУУЛГАХ" : "БҮТНЭЭР"}
          <svg
            className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function FileGlyph({ color }: { color: string }) {
  return (
    <svg className="h-3.5 w-3.5" style={{ color }} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}
