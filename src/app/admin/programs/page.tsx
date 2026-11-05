"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn, Card, T } from "@/components/admin/kit";

/* ─── /admin/programs — хөтөлбөрийн агуулгыг эзэн өөрөө засна ──────────
   Нүүр хуудас ба бүртгэлийн сонголт хоёулаа ЭНД бичсэн зүйлийг шууд
   харуулна. Кодод хатуу бичсэн бичвэр байхгүй. */

interface Stat { value: string; label: string }
interface Program {
  _id?: string;
  slug: string; code: string; title: string; kicker: string; audience: string;
  scheduleDays: string; scheduleTime: string; summary: string; lessonCount: number;
  stats: Stat[]; takeaway: string; bullets: string[]; accent: string;
  order: number; enabled: boolean;
}

const BLANK: Program = {
  slug: "", code: "", title: "", kicker: "", audience: "",
  scheduleDays: "", scheduleTime: "", summary: "", lessonCount: 0,
  stats: [], takeaway: "", bullets: [], accent: "#1F1AD9", order: 100, enabled: true,
};

const input =
  "w-full rounded-[4px] border border-[rgba(255,255,255,0.14)] bg-[#141414] px-3 py-2.5 text-[13px] text-[#F2F2F4] outline-none transition focus:border-[#1F1AD9]";

export default function AdminProgramsPage() {
  const [rows, setRows] = useState<Program[] | null>(null);
  const [draft, setDraft] = useState<Program | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/programs");
    const d = await r.json();
    setRows(Array.isArray(d.programs) ? d.programs : []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const set = <K extends keyof Program>(k: K, v: Program[K]) =>
    setDraft((p) => (p ? { ...p, [k]: v } : p));

  async function save() {
    if (!draft?.slug.trim() || !draft.title.trim()) { setMsg("slug ба нэр шаардлагатай"); return; }
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/admin/programs", {
        method: draft._id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const d = await res.json();
      if (!res.ok) { setMsg(d.error === "slug_taken" ? "Энэ slug аль хэдийн бий" : `Алдаа: ${d.error}`); return; }
      setDraft(null); await load(); setMsg("✓ Хадгаллаа");
    } catch { setMsg("Сүлжээний алдаа"); }
    finally { setBusy(false); }
  }

  async function remove(p: Program) {
    if (!p._id || !confirm(`"${p.title}" хөтөлбөрийг устгах уу?`)) return;
    await fetch(`/api/admin/programs?id=${p._id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <div className="chrome text-[11px] font-bold" style={{ color: T.faint }}>CONTENT</div>
          <h1 className="mt-1 text-[24px] font-bold" style={{ color: T.primaryInk, fontFamily: "var(--font-display)" }}>
            Хөтөлбөрүүд
          </h1>
          <p className="mt-1 text-[12px]" style={{ color: T.muted }}>
            Нүүр хуудасны карт ба бүртгэлийн сонголт эндээс уншина.
          </p>
        </div>
        <Btn onClick={() => { setDraft({ ...BLANK }); setMsg(""); }}>+ Шинэ</Btn>
      </div>

      {msg && <p className="mb-4 text-[13px]" style={{ color: msg.startsWith("✓") ? "#15803D" : "#C81E4A" }}>{msg}</p>}

      {/* ── Засварын маягт ── */}
      {draft && (
        <Card hud className="mb-6 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-[11px] font-bold" style={{ color: T.faint }}>SLUG (өөрчлөгдөхгүй)</span>
              <input className={input} value={draft.slug} disabled={!!draft._id}
                onChange={(e) => set("slug", e.target.value)} placeholder="ai-creator" /></label>
            <label className="block"><span className="mb-1.5 block text-[11px] font-bold" style={{ color: T.faint }}>НЭР</span>
              <input className={input} value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="AI Creator" /></label>
            <label className="block"><span className="mb-1.5 block text-[11px] font-bold" style={{ color: T.faint }}>КОД</span>
              <input className={input} value={draft.code} onChange={(e) => set("code", e.target.value)} placeholder="ХӨТӨЛБӨР 01" /></label>
            <label className="block"><span className="mb-1.5 block text-[11px] font-bold" style={{ color: T.faint }}>ТӨРӨЛ</span>
              <input className={input} value={draft.kicker} onChange={(e) => set("kicker", e.target.value)} placeholder="CONTENT & DESIGN" /></label>
            <label className="block sm:col-span-2"><span className="mb-1.5 block text-[11px] font-bold" style={{ color: T.faint }}>ХЭНД ЗОРИУЛСАН</span>
              <input className={input} value={draft.audience} onChange={(e) => set("audience", e.target.value)} /></label>
            <label className="block"><span className="mb-1.5 block text-[11px] font-bold" style={{ color: T.faint }}>ӨДРҮҮД</span>
              <input className={input} value={draft.scheduleDays} onChange={(e) => set("scheduleDays", e.target.value)} placeholder="Даваа, Лхагва" /></label>
            <label className="block"><span className="mb-1.5 block text-[11px] font-bold" style={{ color: T.faint }}>ЦАГ</span>
              <input className={input} value={draft.scheduleTime} onChange={(e) => set("scheduleTime", e.target.value)} placeholder="12:00–13:30" /></label>
            <label className="block sm:col-span-2"><span className="mb-1.5 block text-[11px] font-bold" style={{ color: T.faint }}>ТОВЧ ТАЙЛБАР</span>
              <textarea className={`${input} resize-y`} rows={2} value={draft.summary} onChange={(e) => set("summary", e.target.value)} /></label>
            <label className="block"><span className="mb-1.5 block text-[11px] font-bold" style={{ color: T.faint }}>ХИЧЭЭЛИЙН ТОО</span>
              <input className={input} type="number" min={0} value={draft.lessonCount} onChange={(e) => set("lessonCount", Number(e.target.value))} /></label>
            <label className="block"><span className="mb-1.5 block text-[11px] font-bold" style={{ color: T.faint }}>ӨНГӨ (hex)</span>
              <input className={input} value={draft.accent} onChange={(e) => set("accent", e.target.value)} placeholder="#1F1AD9" /></label>
            <label className="block sm:col-span-2"><span className="mb-1.5 block text-[11px] font-bold" style={{ color: T.faint }}>ТАНД ҮЛДЭХ ЗҮЙЛС</span>
              <input className={input} value={draft.takeaway} onChange={(e) => set("takeaway", e.target.value)} /></label>
          </div>

          {/* Тоон сүлжээ — ЯГ 4, учир нь карт дээр 2×2 байрлана. */}
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-bold" style={{ color: T.faint }}>ТООН СҮЛЖЭЭ (дээд тал нь 4)</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex gap-2">
                  <input className={`${input} w-1/3`} placeholder="24/7" value={draft.stats[i]?.value || ""}
                    onChange={(e) => { const s = [...draft.stats]; while (s.length <= i) s.push({ value: "", label: "" }); s[i] = { ...s[i], value: e.target.value }; set("stats", s); }} />
                  <input className={input} placeholder="тайлбар" value={draft.stats[i]?.label || ""}
                    onChange={(e) => { const s = [...draft.stats]; while (s.length <= i) s.push({ value: "", label: "" }); s[i] = { ...s[i], label: e.target.value }; set("stats", s); }} />
                </div>
              ))}
            </div>
          </div>

          <label className="mt-4 block"><span className="mb-1.5 block text-[11px] font-bold" style={{ color: T.faint }}>ЖАГСААЛТ (мөр тутамд нэг)</span>
            <textarea className={`${input} resize-y`} rows={4} value={draft.bullets.join("\n")}
              onChange={(e) => set("bullets", e.target.value.split("\n"))} /></label>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-[12px]" style={{ color: T.muted }}>
              <input type="checkbox" checked={draft.enabled} onChange={(e) => set("enabled", e.target.checked)} /> Идэвхтэй
            </label>
            <label className="flex items-center gap-2 text-[12px]" style={{ color: T.muted }}>
              Дараалал <input className={`${input} w-20`} type="number" value={draft.order} onChange={(e) => set("order", Number(e.target.value))} />
            </label>
            <div className="ml-auto flex gap-2">
              <Btn variant="secondary" size="sm" onClick={() => setDraft(null)}>Болих</Btn>
              <Btn size="sm" onClick={save} loading={busy}>Хадгалах</Btn>
            </div>
          </div>
        </Card>
      )}

      {/* ── Жагсаалт ── */}
      {rows === null ? <p className="text-[13px]" style={{ color: T.muted }}>Ачаалж байна…</p>
        : !rows.length ? <p className="text-[13px]" style={{ color: T.muted }}>Хөтөлбөр алга. «+ Шинэ» дарж нэмнэ үү.</p>
        : <div className="space-y-2">
            {rows.map((p) => (
              <Card key={p._id} className="flex flex-wrap items-center gap-3 p-4">
                <span className="h-9 w-1.5 shrink-0 rounded-[4px]" style={{ background: p.accent }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold" style={{ color: T.text }}>
                    {p.title} {!p.enabled && <span style={{ color: T.faint }}>· нуусан</span>}
                  </p>
                  <p className="truncate text-[12px]" style={{ color: T.muted }}>
                    {[p.code, p.scheduleDays, p.scheduleTime].filter(Boolean).join(" · ") || p.slug}
                  </p>
                </div>
                <Btn variant="secondary" size="sm" onClick={() => { setDraft({ ...BLANK, ...p }); setMsg(""); }}>Засах</Btn>
                <button onClick={() => void remove(p)} className="rounded-[4px] bg-[#FF3D69] px-3 py-2 text-[12px] font-bold text-white">Устгах</button>
              </Card>
            ))}
          </div>}
    </div>
  );
}
