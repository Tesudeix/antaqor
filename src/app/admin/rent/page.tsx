"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn, Card, T } from "@/components/admin/kit";

/* /admin/rent — түрээсийн зар + viewing захиалга. */

interface Route { km: number; off: number; peak: number }
interface L {
  _id?: string; title: string; price: number; location: string; district: string;
  area: number; rooms: number; baths: number; floor: number; badge: string; photo: string; desc: string;
  hoa: number; orient: string; sunPeak: number; noise: number; road: string;
  fee: number; deposit: number; routes: Route[]; published: boolean; order: number;
}
interface B { _id: string; listingTitle: string; name: string; phone: string; dayLabel: string; slot: string; mode: string; status: string }

const BLANK: L = {
  title: "", price: 0, location: "", district: "", area: 0, rooms: 0, baths: 0, floor: 0,
  badge: "", photo: "", desc: "", hoa: 45000, orient: "Өмнө", sunPeak: 13, noise: 48,
  road: "", fee: 0, deposit: 1,
  routes: [{ km: 0, off: 0, peak: 0 }, { km: 0, off: 0, peak: 0 }, { km: 0, off: 0, peak: 0 }, { km: 0, off: 0, peak: 0 }],
  published: true, order: 0,
};
const DESTS = ["Төв талбай", "Их тойруу", "МУИС", "Зайсан"];
const inp = "w-full rounded-[4px] border border-[rgba(255,255,255,0.14)] bg-[#141414] px-3 py-2.5 text-[13px] text-[#F2F2F4] outline-none focus:border-[#14306F]";

export default function AdminRentPage() {
  const [tab, setTab] = useState<"listings" | "bookings">("listings");
  const [rows, setRows] = useState<L[] | null>(null);
  const [books, setBooks] = useState<B[] | null>(null);
  const [d, setD] = useState<L | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/rent"); const j = await r.json();
    setRows(Array.isArray(j.listings) ? j.listings : []);
  }, []);
  const loadB = useCallback(async () => {
    const r = await fetch("/api/admin/rent?view=bookings"); const j = await r.json();
    setBooks(Array.isArray(j.bookings) ? j.bookings : []);
  }, []);
  useEffect(() => { void load(); void loadB(); }, [load, loadB]);

  const set = <K extends keyof L>(k: K, v: L[K]) => setD((p) => (p ? { ...p, [k]: v } : p));
  const setRoute = (i: number, k: keyof Route, v: number) =>
    setD((p) => { if (!p) return p; const r = [...p.routes]; r[i] = { ...r[i], [k]: v }; return { ...p, routes: r }; });

  async function save() {
    if (!d?.title || !d.price) { setMsg("Гарчиг, үнэ шаардлагатай"); return; }
    const res = await fetch("/api/admin/rent", {
      method: d._id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d),
    });
    if (!res.ok) { setMsg("Алдаа гарлаа"); return; }
    setD(null); setMsg("✓ Хадгаллаа"); await load();
  }
  async function del(x: L) {
    if (!x._id || !confirm(`"${x.title}" зарыг устгах уу?`)) return;
    await fetch(`/api/admin/rent?id=${x._id}`, { method: "DELETE" }); await load();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="chrome text-[11px] font-bold" style={{ color: T.faint }}>UB RENT</div>
          <h1 className="mt-1 text-[24px] font-bold" style={{ color: T.primaryInk, fontFamily: "var(--font-display)" }}>Түрээс</h1>
        </div>
        <Btn onClick={() => { setD({ ...BLANK }); setMsg(""); }}>+ Шинэ зар</Btn>
      </div>

      <div className="mb-5 flex gap-2">
        <Btn variant={tab === "listings" ? "primary" : "secondary"} size="sm" onClick={() => setTab("listings")}>Зар {rows?.length ?? ""}</Btn>
        <Btn variant={tab === "bookings" ? "primary" : "secondary"} size="sm" onClick={() => setTab("bookings")}>Захиалга {books?.length ?? ""}</Btn>
      </div>
      {msg && <p className="mb-4 text-[13px]" style={{ color: msg.startsWith("✓") ? "#4ADE80" : "#C81E4A" }}>{msg}</p>}

      {d && (
        <Card hud className="mb-6 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {([["title", "ГАРЧИГ"], ["location", "БАЙРШИЛ"], ["district", "ДҮҮРЭГ"], ["badge", "ТЭМДЭГ"], ["photo", "ЗУРГИЙН ЗАМ"], ["road", "ЗАМЫН БАЙДАЛ"], ["orient", "ЦОНХНЫ ЧИГ"]] as [keyof L, string][]).map(([k, lab]) => (
              <label key={k} className="block"><span className="mb-1.5 block text-[11px] font-bold" style={{ color: T.faint }}>{lab}</span>
                <input className={inp} value={String(d[k] ?? "")} onChange={(e) => set(k, e.target.value as L[typeof k])} /></label>
            ))}
            {([["price", "ҮНЭ ₮/сар"], ["area", "М²"], ["rooms", "ӨРӨӨ"], ["baths", "УГААЛГА"], ["floor", "ДАВХАР"], ["hoa", "СӨХ ₮"], ["sunPeak", "НАР ОРГИЛ (0-23)"], ["noise", "ЧИМЭЭ dB"], ["fee", "ШИМТГЭЛ (0 / 0.5)"], ["deposit", "БАРЬЦАА (сар)"], ["order", "ДАРААЛАЛ"]] as [keyof L, string][]).map(([k, lab]) => (
              <label key={k} className="block"><span className="mb-1.5 block text-[11px] font-bold" style={{ color: T.faint }}>{lab}</span>
                <input className={inp} type="number" step="any" value={Number(d[k] ?? 0)} onChange={(e) => set(k, Number(e.target.value) as L[typeof k])} /></label>
            ))}
          </div>
          <label className="mt-3 block"><span className="mb-1.5 block text-[11px] font-bold" style={{ color: T.faint }}>ТАЙЛБАР</span>
            <textarea className={`${inp} resize-y`} rows={3} value={d.desc} onChange={(e) => set("desc", e.target.value)} /></label>

          <p className="mb-2 mt-4 text-[11px] font-bold" style={{ color: T.faint }}>ЗАМ — чиглэл бүрт км / энгийн мин / оргил мин</p>
          <div className="grid gap-2">
            {d.routes.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-[12px]" style={{ color: T.muted }}>{DESTS[i]}</span>
                {(["km", "off", "peak"] as (keyof Route)[]).map((k) => (
                  <input key={k} className={inp} type="number" placeholder={k} value={r[k]} onChange={(e) => setRoute(i, k, Number(e.target.value))} />
                ))}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-4">
            <label className="flex items-center gap-2 text-[12px]" style={{ color: T.muted }}>
              <input type="checkbox" checked={d.published} onChange={(e) => set("published", e.target.checked)} /> Нийтлэх
            </label>
            <div className="ml-auto flex gap-2">
              <Btn variant="secondary" size="sm" onClick={() => setD(null)}>Болих</Btn>
              <Btn size="sm" onClick={save}>Хадгалах</Btn>
            </div>
          </div>
        </Card>
      )}

      {tab === "listings" ? (
        rows === null ? <p className="text-[13px]" style={{ color: T.muted }}>Ачаалж байна…</p>
        : !rows.length ? <p className="text-[13px]" style={{ color: T.muted }}>Зар алга.</p>
        : <div className="space-y-2">{rows.map((x) => (
            <Card key={x._id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold" style={{ color: T.text }}>{x.title} {!x.published && <span style={{ color: T.faint }}>· нуусан</span>}</p>
                <p className="truncate text-[12px]" style={{ color: T.muted }}>{x.location} · {Number(x.price).toLocaleString()}₮ · {x.area}м²</p>
              </div>
              <Btn variant="secondary" size="sm" onClick={() => { setD({ ...BLANK, ...x }); setMsg(""); }}>Засах</Btn>
              <button onClick={() => void del(x)} className="rounded-[4px] bg-[#FF3D69] px-3 py-2 text-[12px] font-bold text-white">Устгах</button>
            </Card>
          ))}</div>
      ) : (
        books === null ? <p className="text-[13px]" style={{ color: T.muted }}>Ачаалж байна…</p>
        : !books.length ? <p className="text-[13px]" style={{ color: T.muted }}>Захиалга алга.</p>
        : <div className="space-y-2">{books.map((b) => (
            <Card key={b._id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold" style={{ color: T.text }}>{b.listingTitle}</p>
                <p className="truncate text-[12px]" style={{ color: T.muted }}>{b.dayLabel} · {b.slot} · {b.mode} — {b.name || "нэргүй"} {b.phone}</p>
              </div>
              <span className="text-[11px] font-bold" style={{ color: b.status === "confirmed" ? "#4ADE80" : T.faint }}>{b.status}</span>
            </Card>
          ))}</div>
      )}
    </div>
  );
}
