"use client";

// LessonEditor — markdown editor with live preview + image upload.
// Two-column on desktop (editor / preview), tabbed on mobile so the textarea
// gets full width. Toolbar has 6 actions: H1, H2, Bold, Italic, Link, Image.
// Image button (and paste / drag-drop) uploads to /api/upload and inserts the
// returned `/uploads/...` URL as a markdown image tag at the cursor.

import { useRef, useState } from "react";
import { LessonArticle } from "./LessonArticle";

const ACCENT = "var(--accent-ink, #2E29FF)";

interface Props {
  value: string;
  onChange: (next: string) => void;
}

export function LessonEditor({ value, onChange }: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit"); // mobile tabs
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Cursor-aware text utilities ────────────────────────────────────
  // Wrap the current selection (or insert a marker token if nothing is
  // selected) with `before` / `after` strings. The cursor lands inside the
  // wrapped span so the user can keep typing without reaching for the mouse.
  const wrap = (before: string, after: string, placeholder = "") => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end) || placeholder;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  };

  // Same as wrap but for line-start tokens (`# `, `> `, `- `).
  const prefixLine = (prefix: string) => {
    const ta = taRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, start + prefix.length);
    });
  };

  // Insert raw text at the cursor (no wrapping).
  const insertAtCursor = (text: string) => {
    const ta = taRef.current;
    if (!ta) {
      onChange(value + text);
      return;
    }
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start + text.length, start + text.length);
    });
  };

  // ─── Image upload ────────────────────────────────────────────────────
  // Hits the existing /api/upload route which writes to /public/uploads and
  // returns { url }. We insert the URL into the textarea as a markdown image
  // tag, leaving the cursor between the alt-brackets so the user can label.
  const uploadAndInsert = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Зөвхөн зураг файл");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.url) {
        setError(data.error || "Ачаалж чадсангүй");
        return;
      }
      const tag = `\n\n![Тайлбар](${data.url})\n\n`;
      insertAtCursor(tag);
    } catch {
      setError("Сүлжээний алдаа");
    } finally {
      setUploading(false);
    }
  };

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) await uploadAndInsert(f);
    if (fileRef.current) fileRef.current.value = "";
  };

  // Paste / drop on the textarea — most natural way to add an image while writing.
  const onPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items || []);
    const file = items.find((it) => it.kind === "file" && it.type.startsWith("image/"))?.getAsFile();
    if (file) {
      e.preventDefault();
      await uploadAndInsert(file);
    }
  };

  const onDrop = async (e: React.DragEvent<HTMLTextAreaElement>) => {
    const file = Array.from(e.dataTransfer.files || []).find((f) => f.type.startsWith("image/"));
    if (file) {
      e.preventDefault();
      await uploadAndInsert(file);
    }
  };

  return (
    <div className="rounded-[4px] border border-[rgba(15,23,38,0.08)] bg-[#f2f5f8]">
      {/* ─── Toolbar ─── */}
      <div className="flex flex-wrap items-center gap-1 border-b border-[rgba(15,23,38,0.06)] px-2 py-1.5">
        <ToolBtn label="H1" title="Гарчиг" onClick={() => prefixLine("# ")} />
        <ToolBtn label="H2" title="Дэд гарчиг" onClick={() => prefixLine("## ")} />
        <ToolBtn label="B" title="Тод (Cmd+B)" bold onClick={() => wrap("**", "**", "тод")} />
        <ToolBtn label="I" title="Налуу (Cmd+I)" italic onClick={() => wrap("*", "*", "налуу")} />
        <ToolBtn label='""' title="Иш татлага" onClick={() => prefixLine("> ")} />
        <ToolBtn label="•" title="Жагсаалт" onClick={() => prefixLine("- ")} />
        <ToolBtn label="🔗" title="Холбоос" onClick={() => wrap("[", "](https://)", "текст")} />
        <span className="mx-1 h-5 w-px bg-[rgba(15,23,38,0.06)]" />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Зураг нэмэх"
          className="inline-flex items-center gap-1.5 rounded-[4px] px-2.5 py-1 text-[11px] font-bold transition hover:bg-[rgba(46,41,255,0.08)] disabled:opacity-50"
          style={{ color: ACCENT }}
        >
          {uploading ? (
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
            </svg>
          )}
          Зураг
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />

        {/* Mobile tabs */}
        <div className="ml-auto inline-flex rounded-[4px] border border-[rgba(15,23,38,0.08)] p-0.5 md:hidden">
          {(["edit", "preview"] as const).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="rounded-[4px] px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] transition"
                style={{
                  background: active ? ACCENT : "transparent",
                  color: active ? "#fff" : "#30333F",
                }}
              >
                {m === "edit" ? "Бичих" : "Харах"}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="border-b border-[rgba(46,41,255,0.25)] bg-[rgba(46,41,255,0.06)] px-3 py-1.5 text-[11px] text-[#2E29FF]">
          {error}
        </div>
      )}

      {/* ─── Editor + Preview ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2">
        {/* Editor */}
        <div className={`${mode === "edit" || "md:block"} ${mode === "preview" ? "hidden md:block" : ""}`}>
          <textarea
            ref={taRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onPaste={onPaste}
            onDrop={onDrop}
            onDragOver={(e) => e.preventDefault()}
            onKeyDown={(e) => {
              // Markdown shortcuts — wrap-on-keystroke.
              if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "b") {
                e.preventDefault();
                wrap("**", "**", "тод");
              } else if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === "i") {
                e.preventDefault();
                wrap("*", "*", "налуу");
              }
            }}
            rows={18}
            placeholder={"# Гарчиг\n\nЭхний параграф — анхдагч санаа.\n\n## Дэд гарчиг\n\nЗурагтай хэсэг:\n\n![Тайлбар](зургийн URL)\n\n> Иш татлага бичих..."}
            spellCheck={false}
            className="w-full resize-y border-0 bg-transparent px-5 py-4 font-mono text-[14px] leading-[1.7] text-[#0e1726] placeholder-[#62666F] outline-none md:border-r md:border-[rgba(15,23,38,0.06)]"
            style={{ minHeight: "480px" }}
          />
        </div>

        {/* Preview */}
        <div
          className={`overflow-y-auto bg-[#0A0A0A] ${mode === "preview" || "md:block"} ${mode === "edit" ? "hidden md:block" : ""}`}
          style={{ minHeight: "480px" }}
        >
          {value.trim() ? (
            <LessonArticle content={value} />
          ) : (
            <div className="flex h-full min-h-[480px] items-center justify-center px-5 text-center">
              <div className="text-[12px] font-mono uppercase tracking-[0.22em] text-[#E2E4E8]">
                preview · бичих хэсэг хоосон
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Markdown cheat sheet (collapsible footer) ─── */}
      <details className="border-t border-[rgba(15,23,38,0.06)] px-3 py-2">
        <summary className="cursor-pointer font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#E2E4E8] transition hover:text-[#0e1726]">
          markdown зөвлөмж
        </summary>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-[#E2E4E8] sm:grid-cols-3">
          <span><code className="text-[#475569]"># Гарчиг</code> → H1</span>
          <span><code className="text-[#475569]">## Гарчиг</code> → H2</span>
          <span><code className="text-[#475569]">**тод**</code> → <strong>тод</strong></span>
          <span><code className="text-[#475569]">*налуу*</code> → <em>налуу</em></span>
          <span><code className="text-[#475569]">[текст](url)</code> → холбоос</span>
          <span><code className="text-[#475569]">![alt](url)</code> → зураг</span>
          <span><code className="text-[#475569]">&gt; иш</code> → иш татлага</span>
          <span><code className="text-[#475569]">- зүйл</code> → жагсаалт</span>
          <span><code className="text-[#475569]">---</code> → таслагч</span>
        </div>
      </details>
    </div>
  );
}

function ToolBtn({
  label, title, onClick, bold, italic,
}: { label: string; title: string; onClick: () => void; bold?: boolean; italic?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="rounded-[4px] px-2.5 py-1 font-mono text-[11px] transition hover:bg-[rgba(15,23,38,0.06)]"
      style={{
        color: "#475569",
        fontWeight: bold ? 900 : 500,
        fontStyle: italic ? "italic" : "normal",
      }}
    >
      {label}
    </button>
  );
}
