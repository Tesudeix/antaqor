"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn, Card, T } from "@/components/admin/kit";

interface C {
  _id?: string; slug: string; name: string; tagline: string; desc: string;
  cover: string; accent: string; memberCount?: number; published: boolean; order: number;
}
const BLANK: C = { slug: "", name: "", tagline: "", desc: "", cover: "", accent: "#2E29FF", published: true, order: 0 };
const inp = "w-full rounded-[4px] border border-[rgba(255,255,255,0.14)] bg-[#141414] px-3 py-2.5 text-[13px] text-[#F2F2F4] outline-none focus:border-[#1F1AD9]";

export default function AdminCirclesPage() {
  const [rows, setRows] = useState<C[] | null>(null);
  const [d, setD] = useState<C | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/circles"); const j = await r.json();
    setRows(Array.isArray(j.circles) ? j.circles : []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const set = <K extends keyof C>(k: K, v: C[K]) => setD((p) => (p ? { ...p, [k]: v } : p));

  async function save() {
    if (!d?.slug.trim() || !d.name.trim()) { setMsg("slug ба нэр шаардлагатай"); return; }
    const res = await fetch("/api/admin/circles", {
      method: d._id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d),
    });
    const j = await res.json();
    if (!res.ok) { setMsg(j.error === "slug давхардсан" ? "Энэ slug аль хэдийн бий" : `Алдаа: ${j.error}`); return; }
    setD(null); setMsg("✓ Хадгаллаа"); await load();
  }
  async function del(x: C) {
    if (!x._id || !confirm(`"${x.name}" хүрээллийг устгах уу? Гишүүдийн бүртгэл ч устана.`)) return;
    await fetch(`/api/admin/circles?id=${x._id}`, { method: "DELETE" }); await load();
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="chrome text-[11px] font-bold" style={{ color: T.faint }}>COMMUNITY</div>
          <h1 className="mt-1 text-[24px] font-bold" style={{ color: T.primaryInk, fontFamily: "var(--font-display)" }}>Хүрээлэл</h1>
        </div>
        <Btn onClick={() => { setD({ ...BLANK }); setMsg(""); }}>+ Шинэ</Btn>
      </div>
      {msg && <p className="mb-4 text-[13px]" style={{ color: msg.startsWith("✓") ? "#4ADE80" : "#C81E4A" }}>{msg}</p>}

      {d && (
        <Card hud className="mb-6 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-[11px] font-bold" style={{ color: T.faint }}>SLUG (өөрчлөгдөхгүй)</span>
              <input className={inp} value={d.slug} disabled={!!d._id} onChange={(e) => set("slug", e.target.value)} placeholder="truedamage" /></label>
            <label className="block"><span className="mb-1.5 block text-[11px] font-bold" style={{ color: T.faint }}>НЭР</span>
              <input className={inp} value={d.name} onChange={(e) => set("name", e.target.value)} /></label>
            <label className="block sm:col-span-2"><span className="mb-1.5 block text-[11px] font-bold" style={{ color: T.faint }}>УРИА</span>
              <input className={inp} value={d.tagline} onChange={(e) => set("tagline", e.target.value)} /></label>
            <label className="block sm:col-span-2"><span className="mb-1.5 block text-[11px] font-bold" style={{ color: T.faint }}>ТАЙЛБАР</span>
              <textarea className={`${inp} resize-y`} rows={3} value={d.desc} onChange={(e) => set("desc", e.target.value)} /></label>
            <label className="block"><span className="mb-1.5 block text-[11px] font-bold" style={{ color: T.faint }}>ЗУРАГ (заавал биш)</span>
              <input className={inp} value={d.cover} onChange={(e) => set("cover", e.target.value)} placeholder="/uploads/..." /></label>
            <label className="block"><span className="mb-1.5 block text-[11px] font-bold" style={{ color: T.faint }}>ӨНГӨ</span>
              <input className={inp} value={d.accent} onChange={(e) => set("accent", e.target.value)} placeholder="#2E29FF" /></label>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-[12px]" style={{ color: T.muted }}>
              <input type="checkbox" checked={d.published} onChange={(e) => set("published", e.target.checked)} /> Нийтлэх
            </label>
            <label className="flex items-center gap-2 text-[12px]" style={{ color: T.muted }}>
              Дараалал <input className={`${inp} w-20`} type="number" value={d.order} onChange={(e) => set("order", Number(e.target.value))} />
            </label>
            <div className="ml-auto flex gap-2">
              <Btn variant="secondary" size="sm" onClick={() => setD(null)}>Болих</Btn>
              <Btn size="sm" onClick={save}>Хадгалах</Btn>
            </div>
          </div>
        </Card>
      )}

      {rows === null ? <p className="text-[13px]" style={{ color: T.muted }}>Ачаалж байна…</p>
        : !rows.length ? <p className="text-[13px]" style={{ color: T.muted }}>Хүрээлэл алга.</p>
        : <div className="space-y-2">{rows.map((x) => (
            <Card key={x._id} className="flex flex-wrap items-center gap-3 p-4">
              <span className="h-9 w-1.5 shrink-0 rounded-[4px]" style={{ background: x.accent }} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold" style={{ color: T.text }}>
                  {x.name} {!x.published && <span style={{ color: T.faint }}>· нуусан</span>}
                </p>
                <p className="truncate text-[12px]" style={{ color: T.muted }}>/{x.slug} · {x.memberCount ?? 0} гишүүн</p>
              </div>
              <Btn variant="secondary" size="sm" onClick={() => { setD({ ...BLANK, ...x }); setMsg(""); }}>Засах</Btn>
              <button onClick={() => void del(x)} className="rounded-[4px] bg-[#FF3D69] px-3 py-2 text-[12px] font-bold text-white">Устгах</button>
            </Card>
          ))}</div>}
    </div>
  );
}
