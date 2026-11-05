"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn, Card, T } from "@/components/admin/kit";

/* /admin/shop — ANTAQOR SUPPLY: бараа (зураг, .glb 3D, өнгө, хэмжээ/үлдэгдэл,
   цагаан/хар цуглуулга, онцлох=hero) + захиалга (төлөв солих). */

type Size = { label: string; stock: number };
type Color = { name: string; hex: string };
interface Prod {
  _id?: string; name: string; slug?: string; kind: string; tagline: string; description: string;
  price: number; compareAtPrice: number; images: string[]; model3d: string;
  colors: Color[]; sizes: Size[]; tone: "light" | "dark"; featured: boolean; active: boolean; sort: number;
}
interface Order {
  _id: string; orderNo: string; status: string; total: number; createdAt: string;
  customer: { name: string; phone: string; address: string; note: string };
  items: { name: string; size: string; color: string; qty: number; price: number }[];
}

const BLANK: Prod = {
  name: "", kind: "hoodie", tagline: "", description: "", price: 0, compareAtPrice: 0, images: [], model3d: "",
  colors: [{ name: "Хар", hex: "#111111" }], sizes: ["S", "M", "L", "XL"].map((label) => ({ label, stock: 0 })),
  tone: "light", featured: false, active: true, sort: 0,
};
const STATUS: Record<string, string> = { pending: "Төлөөгүй", paid: "Төлсөн", shipped: "Илгээсэн", done: "Хүргэсэн", cancelled: "Цуцалсан" };
const inp = "w-full rounded-[4px] border border-[rgba(255,255,255,0.14)] bg-[#141414] px-3 py-2.5 text-[13px] text-[#F2F2F4] outline-none focus:border-[#1F1AD9]";
const lab = "mb-1.5 block text-[11px] font-bold";

export default function AdminShopPage() {
  const [tab, setTab] = useState<"products" | "orders">("products");
  const [rows, setRows] = useState<Prod[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [d, setD] = useState<Prod | null>(null);
  const [msg, setMsg] = useState("");
  const [up, setUp] = useState("");

  const load = useCallback(async () => {
    const j = await fetch("/api/admin/shop").then((r) => r.json()).catch(() => ({}));
    setRows(Array.isArray(j.products) ? j.products : []);
  }, []);
  const loadO = useCallback(async () => {
    const j = await fetch("/api/admin/shop?view=orders").then((r) => r.json()).catch(() => ({}));
    setOrders(Array.isArray(j.orders) ? j.orders : []);
  }, []);
  useEffect(() => { void load(); void loadO(); }, [load, loadO]);

  const set = <K extends keyof Prod>(k: K, v: Prod[K]) => setD((p) => (p ? { ...p, [k]: v } : p));

  async function upload(files: FileList | null, kind: "image" | "model") {
    if (!files?.length || !d) return;
    for (const f of Array.from(files)) {
      setUp(`${f.name} хуулж байна…`);
      const fd = new FormData(); fd.append("file", f);
      const r = await fetch("/api/admin/shop/upload", { method: "POST", body: fd }).then((x) => x.json()).catch(() => ({}));
      if (!r.url) { setUp(r.error || "Хуулахад алдаа"); return; }
      if (kind === "model" || r.kind === "model") setD((p) => (p ? { ...p, model3d: r.url } : p));
      else setD((p) => (p ? { ...p, images: [...p.images, r.url].slice(0, 8) } : p));
    }
    setUp("✓ Хуулагдлаа");
  }

  async function save() {
    if (!d?.name || !d.price) { setMsg("Нэр, үнэ шаардлагатай"); return; }
    const res = await fetch("/api/admin/shop", { method: d._id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); setMsg(j.error || "Алдаа гарлаа"); return; }
    setD(null); setMsg("✓ Хадгаллаа"); await load();
  }
  async function del(x: Prod) {
    if (!x._id || !confirm(`"${x.name}" барааг устгах уу? (Захиалгад орсон бол зөвхөн нуугдана)`)) return;
    await fetch(`/api/admin/shop?id=${x._id}`, { method: "DELETE" }); await load();
  }
  async function setStatus(o: Order, status: string) {
    await fetch("/api/admin/shop", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: o._id, status }) });
    await loadO();
  }

  const paid = (orders || []).filter((o) => ["paid", "shipped", "done"].includes(o.status));
  const revenue = paid.reduce((a, o) => a + o.total, 0);

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="chrome text-[11px] font-bold" style={{ color: T.faint }}>ANTAQOR SUPPLY</div>
          <h1 className="mt-1 text-[24px] font-bold" style={{ color: T.primaryInk, fontFamily: "var(--font-display)" }}>Дэлгүүр</h1>
          <p className="mt-1 text-[12px]" style={{ color: T.muted }}>{paid.length} төлсөн захиалга · {revenue.toLocaleString()}₮ · <a href="/shop" target="_blank" className="underline">/shop нээх ↗</a></p>
        </div>
        <Btn onClick={() => { setD({ ...BLANK, colors: [...BLANK.colors], sizes: BLANK.sizes.map((s) => ({ ...s })) }); setMsg(""); setUp(""); }}>+ Шинэ бараа</Btn>
      </div>

      <div className="mb-5 flex gap-2">
        <Btn variant={tab === "products" ? "primary" : "secondary"} size="sm" onClick={() => setTab("products")}>Бараа {rows?.length ?? ""}</Btn>
        <Btn variant={tab === "orders" ? "primary" : "secondary"} size="sm" onClick={() => setTab("orders")}>Захиалга {orders?.length ?? ""}</Btn>
      </div>
      {msg && <p className="mb-4 text-[13px]" style={{ color: msg.startsWith("✓") ? "#4ADE80" : "#C81E4A" }}>{msg}</p>}

      {d && (
        <Card hud className="mb-6 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className={lab} style={{ color: T.faint }}>НЭР</span><input className={inp} value={d.name} onChange={(e) => set("name", e.target.value)} /></label>
            <label className="block"><span className={lab} style={{ color: T.faint }}>ТӨРӨЛ (3D загвар)</span>
              <select className={inp} value={d.kind} onChange={(e) => set("kind", e.target.value)}>
                <option value="hoodie">Hoodie</option><option value="tee">Футболк</option><option value="cap">Малгай</option><option value="other">Бусад</option>
              </select></label>
            <label className="block sm:col-span-2"><span className={lab} style={{ color: T.faint }}>БОГИНО ТАЙЛБАР (tagline)</span><input className={inp} value={d.tagline} onChange={(e) => set("tagline", e.target.value)} /></label>
            <label className="block"><span className={lab} style={{ color: T.faint }}>ҮНЭ ₮</span><input className={inp} type="number" value={d.price} onChange={(e) => set("price", Number(e.target.value))} /></label>
            <label className="block"><span className={lab} style={{ color: T.faint }}>ХУУЧИН ҮНЭ ₮ (хямдрал)</span><input className={inp} type="number" value={d.compareAtPrice} onChange={(e) => set("compareAtPrice", Number(e.target.value))} /></label>
            <label className="block"><span className={lab} style={{ color: T.faint }}>ЦУГЛУУЛГА</span>
              <select className={inp} value={d.tone} onChange={(e) => set("tone", e.target.value as Prod["tone"])}><option value="light">White (цагаан хэсэг)</option><option value="dark">Black (хар хэсэг)</option></select></label>
            <label className="block"><span className={lab} style={{ color: T.faint }}>ДАРААЛАЛ (их нь эхэнд)</span><input className={inp} type="number" value={d.sort} onChange={(e) => set("sort", Number(e.target.value))} /></label>
          </div>
          <label className="mt-3 block"><span className={lab} style={{ color: T.faint }}>ДЭЛГЭРЭНГҮЙ</span>
            <textarea className={`${inp} resize-y`} rows={4} value={d.description} onChange={(e) => set("description", e.target.value)} /></label>

          <p className={`${lab} mt-4`} style={{ color: T.faint }}>ЗУРАГ (эхнийх нь нүүр, 2 дахь нь hover)</p>
          <div className="flex flex-wrap gap-2">
            {d.images.map((u, i) => (
              <div key={u} className="relative h-24 w-20 overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.14)]">
                <img src={u} alt="" className="h-full w-full object-cover" />
                <button className="absolute right-0 top-0 bg-black/70 px-1.5 text-[12px] text-white" onClick={() => set("images", d.images.filter((_, k) => k !== i))}>×</button>
                {i > 0 && <button className="absolute bottom-0 left-0 bg-black/70 px-1.5 text-[11px] text-white" onClick={() => { const a = [...d.images]; [a[i - 1], a[i]] = [a[i], a[i - 1]]; set("images", a); }}>←</button>}
              </div>
            ))}
            <label className="flex h-24 w-20 cursor-pointer items-center justify-center rounded-[4px] border border-dashed border-[rgba(255,255,255,0.25)] text-[22px]" style={{ color: T.faint }}>
              +<input type="file" accept="image/*" multiple hidden onChange={(e) => void upload(e.target.files, "image")} />
            </label>
          </div>

          <p className={`${lab} mt-4`} style={{ color: T.faint }}>3D ЗАГВАР (.glb) — онцлох бол hero-д эргэнэ</p>
          <div className="flex flex-wrap items-center gap-2">
            <input className={inp} style={{ maxWidth: 380 }} value={d.model3d} placeholder="/uploads/shop/….glb" onChange={(e) => set("model3d", e.target.value)} />
            <label className="cursor-pointer rounded-[4px] bg-[rgba(46,41,255,0.14)] px-3 py-2 text-[12px] font-semibold text-[#2E29FF]">.glb хуулах<input type="file" accept=".glb,model/gltf-binary" hidden onChange={(e) => void upload(e.target.files, "model")} /></label>
          </div>
          {up && <p className="mt-2 text-[12px]" style={{ color: up.startsWith("✓") ? "#4ADE80" : T.muted }}>{up}</p>}

          <p className={`${lab} mt-4`} style={{ color: T.faint }}>ӨНГӨ</p>
          <div className="grid gap-2">
            {d.colors.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="color" value={c.hex} onChange={(e) => { const a = [...d.colors]; a[i] = { ...c, hex: e.target.value }; set("colors", a); }} className="h-10 w-12 cursor-pointer rounded-[4px] border-0 bg-transparent" />
                <input className={inp} value={c.name} placeholder="Нэр (Хар, Цагаан…)" onChange={(e) => { const a = [...d.colors]; a[i] = { ...c, name: e.target.value }; set("colors", a); }} />
                <button className="px-2 text-[18px]" style={{ color: T.faint }} onClick={() => set("colors", d.colors.filter((_, k) => k !== i))}>×</button>
              </div>
            ))}
            <Btn variant="secondary" size="sm" onClick={() => set("colors", [...d.colors, { name: "", hex: "#ffffff" }])}>+ Өнгө</Btn>
          </div>

          <p className={`${lab} mt-4`} style={{ color: T.faint }}>ХЭМЖЭЭ / ҮЛДЭГДЭЛ (бүгд 0 бол &quot;Удахгүй&quot;)</p>
          <div className="flex flex-wrap gap-2">
            {d.sizes.map((z, i) => (
              <div key={i} className="flex items-center gap-1 rounded-[4px] border border-[rgba(255,255,255,0.14)] p-1.5">
                <input className={`${inp} !w-14 !px-2`} value={z.label} onChange={(e) => { const a = [...d.sizes]; a[i] = { ...z, label: e.target.value }; set("sizes", a); }} />
                <input className={`${inp} !w-16 !px-2`} type="number" min={0} value={z.stock} onChange={(e) => { const a = [...d.sizes]; a[i] = { ...z, stock: Number(e.target.value) }; set("sizes", a); }} />
                <button className="px-1 text-[16px]" style={{ color: T.faint }} onClick={() => set("sizes", d.sizes.filter((_, k) => k !== i))}>×</button>
              </div>
            ))}
            <Btn variant="secondary" size="sm" onClick={() => set("sizes", [...d.sizes, { label: "", stock: 0 }])}>+ Хэмжээ</Btn>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-[12px]" style={{ color: T.muted }}><input type="checkbox" checked={d.active} onChange={(e) => set("active", e.target.checked)} /> Нийтлэх</label>
            <label className="flex items-center gap-2 text-[12px]" style={{ color: T.muted }}><input type="checkbox" checked={d.featured} onChange={(e) => set("featured", e.target.checked)} /> Онцлох (3D hero)</label>
            <div className="ml-auto flex gap-2">
              <Btn variant="secondary" size="sm" onClick={() => setD(null)}>Болих</Btn>
              <Btn size="sm" onClick={save}>Хадгалах</Btn>
            </div>
          </div>
        </Card>
      )}

      {tab === "products" ? (
        rows === null ? <p className="text-[13px]" style={{ color: T.muted }}>Ачаалж байна…</p>
        : !rows.length ? <p className="text-[13px]" style={{ color: T.muted }}>Бараа алга.</p>
        : <div className="space-y-2">{rows.map((x) => {
            const stock = x.sizes.reduce((a, z) => a + (z.stock || 0), 0);
            return (
              <Card key={x._id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="h-14 w-11 shrink-0 overflow-hidden rounded-[3px]" style={{ background: x.colors[0]?.hex || "#333" }}>{x.images[0] && <img src={x.images[0]} alt="" className="h-full w-full object-cover" />}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold" style={{ color: T.text }}>{x.featured && "★ "}{x.name} {!x.active && <span style={{ color: T.faint }}>· нуусан</span>}</p>
                  <p className="truncate text-[12px]" style={{ color: T.muted }}>{x.tone === "dark" ? "Black" : "White"} · {x.price.toLocaleString()}₮ · үлдэгдэл {stock}{x.model3d ? " · 3D" : ""}</p>
                </div>
                <Btn variant="secondary" size="sm" onClick={() => { setD({ ...BLANK, ...x }); setMsg(""); setUp(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Засах</Btn>
                <button onClick={() => void del(x)} className="rounded-[4px] bg-[#FF3D69] px-3 py-2 text-[12px] font-bold text-white">Устгах</button>
              </Card>
            );
          })}</div>
      ) : (
        orders === null ? <p className="text-[13px]" style={{ color: T.muted }}>Ачаалж байна…</p>
        : !orders.length ? <p className="text-[13px]" style={{ color: T.muted }}>Захиалга алга.</p>
        : <div className="space-y-2">{orders.map((o) => (
            <Card key={o._id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold" style={{ color: T.text }}>{o.orderNo} · {o.total.toLocaleString()}₮</p>
                  <p className="text-[12px]" style={{ color: T.muted }}>{new Date(o.createdAt).toLocaleString("mn-MN")} — {o.customer.name} · {o.customer.phone}</p>
                </div>
                <select className={`${inp} !w-auto`} value={o.status} onChange={(e) => void setStatus(o, e.target.value)}>
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <p className="mt-2 text-[12px]" style={{ color: T.muted }}>{o.items.map((i) => `${i.name} ${[i.color, i.size].filter(Boolean).join("/")} ×${i.qty}`).join(", ")}</p>
              <p className="mt-1 text-[12px]" style={{ color: T.faint }}>📍 {o.customer.address}{o.customer.note ? ` — ${o.customer.note}` : ""}</p>
            </Card>
          ))}</div>
      )}
    </div>
  );
}
