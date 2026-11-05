"use client";

import RagTester from "./RagTester";
import { useCallback, useEffect, useRef, useState } from "react";

/* ─── "Намайг сурга" — Antaqor AI-д өөрийн өгөгдөл оруулах (2026-10-13) ─────
   Мэдлэг (тэмдэглэл, транскрипт, түүх) ба Хэв маяг (миний бичсэн текст) гэсэн
   хоёр төрөл. Текст буулгах эсвэл .txt/.md/.csv файл (олноор) оруулна —
   сервер хэсэглээд хадгална, чат бүрд хамааралтайг нь татна. */

type Src = { source: string; kind: "knowledge" | "voice"; chunks: number; chars: number; at: string; sample: string };

export default function CompanionLearnPanel() {
  const [kind, setKind] = useState<"knowledge" | "voice">("knowledge");
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [sources, setSources] = useState<Src[]>([]);
  const [totals, setTotals] = useState({ knowledge: 0, voice: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/companion-docs");
    if (!r.ok) return;
    const d = await r.json();
    setSources(d.sources || []);
    setTotals(d.totals || { knowledge: 0, voice: 0 });
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (body: { text: string; source: string; kind: string }) => {
    const r = await fetch("/api/admin/companion-docs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Хадгалж чадсангүй");
    return d as { chunks: number; source: string };
  };

  const submit = async () => {
    if (text.trim().length < 20 || busy) return;
    setBusy(true); setMsg("");
    try {
      const d = await save({ text, source: title, kind });
      setMsg(`✓ "${d.source}" — ${d.chunks} хэсэг болгон сургалаа`);
      setText(""); setTitle("");
      load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Алдаа"); }
    finally { setBusy(false); }
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setMsg("");
    let ok = 0, chunks = 0;
    for (const f of Array.from(files)) {
      if (!/\.(txt|md|markdown|csv|json)$/i.test(f.name) && !f.type.startsWith("text/")) { setMsg(`Алгассан: ${f.name} (зөвхөн текст файл)`); continue; }
      if (f.size > 2 * 1024 * 1024) { setMsg(`Алгассан: ${f.name} (2MB-аас их)`); continue; }
      try {
        const d = await save({ text: await f.text(), source: f.name.replace(/\.[^.]+$/, ""), kind });
        ok++; chunks += d.chunks;
      } catch (e) { setMsg(`${f.name}: ${e instanceof Error ? e.message : "алдаа"}`); }
    }
    if (ok) setMsg(`✓ ${ok} файл — ${chunks} хэсэг сургалаа`);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    load();
  };

  const importPosts = async () => {
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/admin/companion-docs/import-posts", { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Алдаа");
      setMsg(d.imported ? `✓ ${d.imported} шинэ пост хэв маягийн жишээ болов (${d.scanned} шалгасан)` : `Шинэ пост алга (${d.scanned} шалгасан — бүгд аль хэдийн орсон эсвэл хэт богино)`);
      load();
    } catch (e) { setMsg(e instanceof Error ? e.message : "Алдаа"); }
    finally { setBusy(false); }
  };

  const remove = async (s: Src) => {
    if (!confirm(`"${s.source}" (${s.chunks} хэсэг)-ийг устгах уу?`)) return;
    await fetch(`/api/admin/companion-docs?source=${encodeURIComponent(s.source)}&kind=${s.kind}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="mb-6 rounded-[4px] border border-[#FCEE0A]/50 bg-[#141414] p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.16em] text-[#FCEE0A]">Намайг сурга</div>
          <h2 className="mt-1 text-[20px] font-extrabold text-[#F2F2F4]">Өөрийн өгөгдлөөр AI-гаа сурга</h2>
        </div>
        <div className="flex gap-2 text-[12.5px] font-bold">
          <span className="rounded-[4px] bg-[#1E1E1E] px-2 py-1 text-[#F2F2F4]">Мэдлэг · {totals.knowledge}</span>
          <span className="rounded-[4px] bg-[#1E1E1E] px-2 py-1 text-[#F2F2F4]">Хэв маяг · {totals.voice}</span>
        </div>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[#C9C9D1]">
        Оруулсан бүхэн хэсэглэгдэж хадгалагдана. Хүн юу асууснаас хамаарч хамгийн хамааралтай хэсгүүдийг AI татаж хариулна,
        хэв маягийн жишээнүүдээр чинийх шиг бичнэ. Баримт, тоо, түүх → <b>Мэдлэг</b>. Чиний бичсэн пост, захидал, яриа → <b>Хэв маяг</b>.
      </p>

      <div className="mt-3 flex gap-2">
        {([["knowledge", "Мэдлэг"], ["voice", "Хэв маяг"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setKind(k)}
            className={`rounded-[4px] px-3 py-1.5 text-[13px] font-bold ${kind === k ? "bg-[#2E29FF] text-white" : "bg-[#1E1E1E] text-[#E2E4E8]"}`}>{l}</button>
        ))}
      </div>

      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Нэр (заавал биш) — жишээ: 2026 Подкаст #3, Миний түүх"
        maxLength={120} className="mt-3 h-10 w-full rounded-[4px] bg-[#0A0A0A] px-3 text-[14px] text-[#F2F2F4] outline-none placeholder:text-[#9C9CA6] focus:ring-1 focus:ring-[#FCEE0A]" />
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={7}
        placeholder={kind === "voice" ? "Өөрийн бичсэн текстүүдээ буулга (пост, захидал, яриа)… Догол мөрөөр тусгаарлавал тус бүр нэг жишээ болно." : "Тэмдэглэл, подкастын транскрипт, түүх, үзэл бодол, бизнесийн тоо… юу ч хамаагүй буулга."}
        className="mt-2 w-full resize-y rounded-[4px] bg-[#0A0A0A] px-3 py-2.5 text-[14px] leading-relaxed text-[#F2F2F4] outline-none placeholder:text-[#9C9CA6] focus:ring-1 focus:ring-[#FCEE0A]" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" onClick={submit} disabled={busy || text.trim().length < 20}
          className="h-10 rounded-[4px] bg-[#2E29FF] px-5 text-[14px] font-extrabold text-white transition hover:bg-[#1F1AD9] disabled:opacity-40">
          {busy ? "Сургаж байна…" : "Сурга"}
        </button>
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
          className="h-10 rounded-[4px] border border-[#FCEE0A]/60 px-4 text-[14px] font-bold text-[#FCEE0A] disabled:opacity-40">
          Файл оруулах (.txt .md .csv)
        </button>
        <button type="button" onClick={importPosts} disabled={busy}
          className="h-10 rounded-[4px] border border-[#FCEE0A]/60 px-4 text-[14px] font-bold text-[#FCEE0A] disabled:opacity-40">
          Миний постуудаас сур
        </button>
        <span className="text-[12px] tabular-nums text-[#9C9CA6]">{text.length.toLocaleString()} тэмдэгт</span>
        <input ref={fileRef} type="file" multiple accept=".txt,.md,.markdown,.csv,.json,text/*" className="hidden" onChange={(e) => onFiles(e.target.files)} />
      </div>
      {msg && <p className="mt-2 text-[13px] font-semibold text-[#FCEE0A]">{msg}</p>}
      <RagTester refreshKey={sources.length * 1000 + totals.knowledge + totals.voice} />

      {sources.length > 0 && (
        <div className="mt-4 divide-y divide-[rgba(255,255,255,0.08)] rounded-[4px] border border-[rgba(255,255,255,0.1)]">
          {sources.map((s) => (
            <div key={s.kind + s.source} className="flex items-start gap-3 px-3 py-2.5">
              <span className={`mt-0.5 shrink-0 rounded-[4px] px-1.5 py-0.5 text-[10.5px] font-black ${s.kind === "voice" ? "bg-[#FCEE0A] text-[#0A0A0A]" : "bg-[#2E29FF] text-white"}`}>
                {s.kind === "voice" ? "ХЭВ МАЯГ" : "МЭДЛЭГ"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-bold text-[#F2F2F4]">{s.source}</div>
                <div className="truncate text-[12px] text-[#9C9CA6]">{s.chunks} хэсэг · {s.chars.toLocaleString()} тэмдэгт · {s.sample}</div>
              </div>
              <button type="button" onClick={() => remove(s)} className="shrink-0 text-[12px] font-bold text-[#9C9CA6] hover:text-[#2E29FF]">Устгах</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
