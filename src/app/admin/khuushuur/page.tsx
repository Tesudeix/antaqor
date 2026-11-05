"use client";

import { useCallback, useEffect, useState } from "react";
import { Btn, Card, T } from "@/components/admin/kit";
import KhArt from "@/components/khuushuur/KhArt";

/* /admin/khuushuur — Тал Хуушуур: цэс (ангилал, нэр, үнэ, ккал, тайлбар,
   зураг эсвэл кодоор зурсан дүрс, шошго, дууссан) + захиалга (төлөв солих). */

interface Item {
  _id?: string; slug?: string; category: string; name: string; kcal: string; description: string;
  price: number; image: string; art: string; tag: string; soldOut: boolean; active: boolean; sort: number;
}
interface Order {
  _id: string; orderNo: string; status: string; mode: string; total: number; deliveryFee: number; createdAt: string;
  customer: { name: string; phone: string; address: string; note: string };
  items: { name: string; qty: number; price: number }[];
}

const CATS: [string, string][] = [["khuushuur", "Хуушуур"], ["bagts", "Багц"], ["shol", "Шөл"], ["khachir", "Хачир"], ["undaa", "Ундаа"]];
const ARTS: [string, string][] = [["one", "1 хуушуур"], ["two", "2 хуушуур"], ["stack", "Овоо (багц)"], ["combo", "Хуушуур + шөл"], ["combotea", "Хуушуур + цай"], ["soup", "Шөл"], ["salad", "Салат"], ["pickle", "Даршилсан ногоо"], ["tea", "Цай"], ["airag", "Айраг"], ["cola", "Кола"], ["water", "Ус"]];
const BLANK: Item = { category: "khuushuur", name: "", kcal: "", description: "", price: 0, image: "", art: "one", tag: "", soldOut: false, active: true, sort: 0 };
const STATUS: Record<string, string> = { pending: "Төлөөгүй", paid: "Төлсөн", cooking: "Хийж байна", delivering: "Хүргэлтэнд", done: "Хүргэсэн", cancelled: "Цуцалсан" };
const inp = "w-full rounded-[4px] border border-[rgba(255,255,255,0.14)] bg-[#141414] px-3 py-2.5 text-[13px] text-[#F2F2F4] outline-none focus:border-[#1F1AD9]";
const lab = "mb-1.5 block text-[11px] font-bold";
const mnt = (n: number) => n.toLocaleString("en-US") + "₮";

export default function AdminKhuushuurPage() {
  const [tab, setTab] = useState<"items" | "orders">("items");
  const [rows, setRows] = useState<Item[] | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [d, setD] = useState<Item | null>(null);
  const [msg, setMsg] = useState("");
  const [up, setUp] = useState("");

  const load = useCallback(async () => {
    const j = await fetch("/api/admin/khuushuur").then((r) => r.json()).catch(() => ({}));
    setRows(Array.isArray(j.items) ? j.items : []);
  }, []);
  const loadO = useCallback(async () => {
    const j = await fetch("/api/admin/khuushuur?view=orders").then((r) => r.json()).catch(() => ({}));
    setOrders(Array.isArray(j.orders) ? j.orders : []);
  }, []);
  useEffect(() => { void load(); void loadO(); }, [load, loadO]);
  /* шинэ захиалга орж ирэхийг харахын тулд захиалгын таб нээлттэй үед 20 сек тутам */
  useEffect(() => {
    if (tab !== "orders") return;
    const t = setInterval(() => void loadO(), 20000);
    return () => clearInterval(t);
  }, [tab, loadO]);

  const set = <K extends keyof Item>(k: K, v: Item[K]) => setD((p) => (p ? { ...p, [k]: v } : p));

  async function upload(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setUp(`${f.name} хуулж байна…`);
    const fd = new FormData(); fd.append("file", f);
    const r = await fetch("/api/admin/khuushuur/upload", { method: "POST", body: fd }).then((x) => x.json()).catch(() => ({}));
    if (!r.url) { setUp(r.error || "Хуулахад алдаа"); return; }
    set("image", r.url); setUp("✓ Хуулагдлаа");
  }
  async function save() {
    if (!d?.name || !d.price) { setMsg("Нэр, үнэ шаардлагатай"); return; }
    const res = await fetch("/api/admin/khuushuur", { method: d._id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
    if (!res.ok) { const j = await res.json().catch(() => ({})); setMsg(j.error || "Алдаа гарлаа"); return; }
    setD(null); setMsg("✓ Хадгаллаа"); await load();
  }
  async function toggleOut(x: Item) {
    await fetch("/api/admin/khuushuur", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ _id: x._id, soldOut: !x.soldOut }) });
    await load();
  }
  async function del(x: Item) {
    if (!x._id || !confirm(`"${x.name}"-ыг цэснээс устгах уу? (Захиалгад орсон бол зөвхөн нуугдана)`)) return;
    await fetch(`/api/admin/khuushuur?id=${x._id}`, { method: "DELETE" }); await load();
  }
  async function setStatus(o: Order, status: string) {
    await fetch("/api/admin/khuushuur", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: o._id, status }) });
    await loadO();
  }

  const paid = (orders || []).filter((o) => !["pending", "cancelled"].includes(o.status));
  const today = new Date().toDateString();
  const todayRev = paid.filter((o) => new Date(o.createdAt).toDateString() === today).reduce((a, o) => a + o.total, 0);
  const open = paid.filter((o) => o.status !== "done").length;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <div className="chrome text-[11px] font-bold" style={{ color: T.faint }}>ТАЛ ХУУШУУР</div>
          <h1 className="mt-1 text-[24px] font-bold" style={{ color: T.primaryInk, fontFamily: "var(--font-display)" }}>Хуушуур меню</h1>
          <p className="mt-1 text-[12px]" style={{ color: T.muted }}>{open} идэвхтэй захиалга · өнөөдөр {mnt(todayRev)} · <a href="/khuushuur" target="_blank" className="underline">/khuushuur нээх ↗</a></p>
        </div>
        <Btn onClick={() => { setD({ ...BLANK }); setMsg(""); setUp(""); }}>+ Шинэ хоол</Btn>
      </div>

      <div className="mb-5 flex gap-2">
        <Btn variant={tab === "items" ? "primary" : "secondary"} size="sm" onClick={() => setTab("items")}>Цэс {rows?.length ?? ""}</Btn>
        <Btn variant={tab === "orders" ? "primary" : "secondary"} size="sm" onClick={() => { setTab("orders"); void loadO(); }}>Захиалга {orders?.length ?? ""}</Btn>
      </div>
      {msg && <p className="mb-4 text-[13px]" style={{ color: msg.startsWith("✓") ? "#4ADE80" : "#C81E4A" }}>{msg}</p>}

      {d && (
        <Card hud className="mb-6 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className={lab} style={{ color: T.faint }}>НЭР</span><input className={inp} value={d.name} onChange={(e) => set("name", e.target.value)} /></label>
            <label className="block"><span className={lab} style={{ color: T.faint }}>АНГИЛАЛ</span>
              <select className={inp} value={d.category} onChange={(e) => set("category", e.target.value)}>{CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
            <label className="block"><span className={lab} style={{ color: T.faint }}>ҮНЭ ₮</span><input className={inp} type="number" min={0} value={d.price} onChange={(e) => set("price", Number(e.target.value))} /></label>
            <label className="block"><span className={lab} style={{ color: T.faint }}>ИЛЧЛЭГ (ж: 412 ккал)</span><input className={inp} value={d.kcal} onChange={(e) => set("kcal", e.target.value)} /></label>
            <label className="block"><span className={lab} style={{ color: T.faint }}>ШОШГО (ж: Шинэ, Хамгийн их)</span><input className={inp} value={d.tag} maxLength={20} onChange={(e) => set("tag", e.target.value)} /></label>
            <label className="block"><span className={lab} style={{ color: T.faint }}>ДАРААЛАЛ (их нь эхэнд)</span><input className={inp} type="number" value={d.sort} onChange={(e) => set("sort", Number(e.target.value))} /></label>
          </div>
          <label className="mt-3 block"><span className={lab} style={{ color: T.faint }}>ОРЦ / ТАЙЛБАР (карт дээр hover-д гарна)</span>
            <textarea className={`${inp} resize-y`} rows={2} maxLength={400} value={d.description} onChange={(e) => set("description", e.target.value)} /></label>

          <p className={`${lab} mt-4`} style={{ color: T.faint }}>ЗУРАГ — байхгүй бол доорх дүрс зурагдана</p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-24 w-32 items-center justify-center overflow-hidden rounded-[4px] bg-[#f6f4f1]">
              {d.image ? <img src={d.image} alt="" className="h-full w-full object-contain" /> : <KhArt art={d.art} className="h-full w-full" />}
            </div>
            <div className="flex flex-col gap-2">
              <label className="cursor-pointer rounded-[4px] bg-[rgba(46,41,255,0.14)] px-3 py-2 text-[12px] font-semibold text-[#2E29FF]">Зураг хуулах<input type="file" accept="image/*" hidden onChange={(e) => void upload(e.target.files)} /></label>
              {d.image && <button className="text-left text-[12px] underline" style={{ color: T.muted }} onClick={() => set("image", "")}>Зургийг авах</button>}
            </div>
            <label className="block min-w-[180px] flex-1"><span className={lab} style={{ color: T.faint }}>ДҮРС</span>
              <select className={inp} value={d.art} onChange={(e) => set("art", e.target.value)}>{ARTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          </div>
          {up && <p className="mt-2 text-[12px]" style={{ color: up.startsWith("✓") ? "#4ADE80" : T.muted }}>{up}</p>}

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-[12px]" style={{ color: T.muted }}><input type="checkbox" checked={d.active} onChange={(e) => set("active", e.target.checked)} /> Цэсэнд харуулах</label>
            <label className="flex items-center gap-2 text-[12px]" style={{ color: T.muted }}><input type="checkbox" checked={d.soldOut} onChange={(e) => set("soldOut", e.target.checked)} /> Өнөөдөр дууссан</label>
            <div className="ml-auto flex gap-2">
              <Btn variant="secondary" size="sm" onClick={() => setD(null)}>Болих</Btn>
              <Btn size="sm" onClick={save}>Хадгалах</Btn>
            </div>
          </div>
        </Card>
      )}

      {tab === "items" ? (
        rows === null ? <p className="text-[13px]" style={{ color: T.muted }}>Ачаалж байна…</p>
        : !rows.length ? <p className="text-[13px]" style={{ color: T.muted }}>Цэс хоосон.</p>
        : <div className="space-y-6">{CATS.map(([cid, cname]) => {
            const list = rows.filter((x) => x.category === cid);
            if (!list.length) return null;
            return (
              <div key={cid}>
                <p className="mb-2 text-[11px] font-bold" style={{ color: T.faint }}>{cname.toUpperCase()} · {list.length}</p>
                <div className="space-y-2">{list.map((x) => (
                  <Card key={x._id} className="flex flex-wrap items-center gap-3 p-3">
                    <div className="flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-[#f6f4f1]">
                      {x.image ? <img src={x.image} alt="" className="h-full w-full object-contain" /> : <KhArt art={x.art} className="h-full w-full" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-bold" style={{ color: T.text }}>{x.name}{x.tag ? ` · ${x.tag}` : ""} {!x.active && <span style={{ color: T.faint }}>· нуусан</span>}</p>
                      <p className="truncate text-[12px]" style={{ color: T.muted }}>{mnt(x.price)}{x.kcal ? ` · ${x.kcal}` : ""}</p>
                    </div>
                    <button onClick={() => void toggleOut(x)} className="rounded-[4px] px-3 py-2 text-[12px] font-bold" style={{ background: x.soldOut ? "#FCEE0A" : "rgba(255,255,255,0.08)", color: x.soldOut ? "#0A0A0A" : T.muted }}>{x.soldOut ? "Дууссан" : "Байгаа"}</button>
                    <Btn variant="secondary" size="sm" onClick={() => { setD({ ...BLANK, ...x }); setMsg(""); setUp(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Засах</Btn>
                    <button onClick={() => void del(x)} className="rounded-[4px] bg-[#FF3D69] px-3 py-2 text-[12px] font-bold text-white">Устгах</button>
                  </Card>
                ))}</div>
              </div>
            );
          })}</div>
      ) : (
        orders === null ? <p className="text-[13px]" style={{ color: T.muted }}>Ачаалж байна…</p>
        : !orders.length ? <p className="text-[13px]" style={{ color: T.muted }}>Захиалга алга.</p>
        : <div className="space-y-2">{orders.map((o) => (
            <Card key={o._id} className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold" style={{ color: T.text }}>{o.orderNo} · {mnt(o.total)} · {o.mode === "pickup" ? "Очиж авах" : "Хүргэлт"}</p>
                  <p className="text-[12px]" style={{ color: T.muted }}>{new Date(o.createdAt).toLocaleString("mn-MN")} — {o.customer.name} · {o.customer.phone}</p>
                </div>
                <select className={`${inp} !w-auto`} value={o.status} onChange={(e) => void setStatus(o, e.target.value)}>
                  {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <p className="mt-2 text-[12px]" style={{ color: T.muted }}>{o.items.map((i) => `${i.name} ×${i.qty}`).join(", ")}</p>
              <p className="mt-1 text-[12px]" style={{ color: T.faint }}>📍 {o.customer.address}{o.customer.note ? ` — ${o.customer.note}` : ""}</p>
            </Card>
          ))}</div>
      )}
    </div>
  );
}
