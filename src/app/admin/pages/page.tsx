"use client";

import { useEffect, useState } from "react";

type Page = { key: string; pageId: string; name: string; igBusinessId: string; pageType?: string; enabled: boolean };
const PAGE_TYPES = [
  { v: "massage_spa", l: "💆 Массаж / Спа" },
  { v: "restaurant", l: "🍽️ Ресторан / Кафе" },
  { v: "beauty", l: "💅 Гоо сайхан / Салон" },
  { v: "clinic", l: "🏥 Эмнэлэг / Эрүүл мэнд" },
  { v: "retail", l: "🛍️ Дэлгүүр / Худалдаа" },
  { v: "fitness", l: "🏋️ Фитнес / Спорт" },
  { v: "education", l: "📚 Боловсрол" },
  { v: "services", l: "🔧 Үйлчилгээ" },
  { v: "other", l: "📦 Бусад" },
];
const ptLabel = (v?: string) => PAGE_TYPES.find((p) => p.v === v)?.l || "📦 Бусад";
type Manage = { id: string; name: string; ig: string };

export default function PagesPage() {
  const [pages, setPages] = useState<Page[]>([]);
  const [token, setToken] = useState("");
  const [manage, setManage] = useState<Manage[]>([]);
  const [busy, setBusy] = useState(false);
  const [pageType, setPageType] = useState("other");
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const r = await fetch("/api/admin/meta/pages", { cache: "no-store" });
    const d = await r.json();
    if (r.ok) setPages(d.pages || []);
  }
  useEffect(() => { load(); }, []);

  async function listPages() {
    if (!token.trim()) return;
    setBusy(true); setMsg(null); setManage([]);
    const r = await fetch("/api/admin/meta/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
    const d = await r.json();
    setBusy(false);
    if (r.ok && d.managePages) { setManage(d.managePages); if (!d.managePages.length) setMsg("Энэ token-д удирдах page алга."); }
    else setMsg(d.error || "Алдаа");
  }
  async function connect(pageId: string) {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/admin/meta/pages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, pageId, pageType }) });
    const d = await r.json();
    setBusy(false);
    if (r.ok && d.ok) { setMsg(`${d.page.name} холбогдлоо ✓ ${d.subscribed ? "(webhook OK)" : "(webhook?)"}`); await load(); }
    else setMsg(d.error || "Холбоход алдаа");
  }
  async function toggle(p: Page) {
    await fetch("/api/admin/meta/pages", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: p.key, enabled: !p.enabled }) });
    await load();
  }
  async function remove(key: string) {
    if (!confirm("Энэ page-ийг салгах уу?")) return;
    await fetch(`/api/admin/meta/pages?key=${encodeURIComponent(key)}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-[#1080CA]">Pages</div>
        <h1 className="mt-0.5 text-[22px] font-bold text-[#E8E8E8]">Хуудас холбох (multi-page)</h1>
        <p className="mt-1 text-[12px] text-[#8A8A92]">Facebook token буулгаад → page сонгоод → Холбох. Permanent token + webhook автоматаар. Кодгүйгээр хязгааргүй page нэмнэ.</p>
      </div>
      {msg && <div className="mb-4 rounded-none border border-[rgba(34,211,238,0.3)] bg-[rgba(34,211,238,0.08)] px-3 py-2 text-[11px] text-[#22D3EE]">{msg}</div>}

      <div className="mb-6 rounded-none border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] p-4">
        <div className="mb-1 text-[11px] font-medium text-[#8A8A92]">Facebook access token (user эсвэл page)</div>
        <textarea value={token} onChange={(e) => setToken(e.target.value)} rows={2} className="pinp mb-2" placeholder="EAAR..." />
        <div className="mb-2 text-[11px] font-medium text-[#8A8A92]">Бизнесийн төрөл (холбохдоо)</div>
        <select value={pageType} onChange={(e) => setPageType(e.target.value)} className="pinp mb-2">
          {PAGE_TYPES.map((p) => (<option key={p.v} value={p.v}>{p.l}</option>))}
        </select>
        <button onClick={listPages} disabled={busy} className="rounded-none bg-[#22D3EE] px-4 py-2 text-[11px] font-bold text-[#E8E8E8] hover:bg-[#1bb8d4] disabled:opacity-50">{busy ? "..." : "Page-үүдийг харах"}</button>
        {manage.length > 0 && (
          <div className="mt-3 space-y-2">
            {manage.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-none bg-[#141419] px-3 py-2">
                <div>
                  <div className="text-[12px] font-semibold text-[#E8E8E8]">{m.name}</div>
                  <div className="text-[10px] text-[#8A8A92]">{m.id}{m.ig ? ` · IG ${m.ig}` : ""}</div>
                </div>
                <button onClick={() => connect(m.id)} disabled={busy} className="rounded-none bg-[#1080CA] px-3 py-1.5 text-[10px] font-bold text-[#0E0E10] hover:bg-[#4FA8E8] disabled:opacity-50">Холбох</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-[#8A8A92]">Холбогдсон хуудсууд</div>
      <div className="space-y-2">
        {pages.length === 0 && <div className="rounded-none border border-dashed border-[rgba(255,255,255,0.1)] p-6 text-center text-[12px] text-[#8A8A92]">Дайнамик page алга. (Antaqor/joymassage/joybilliard нь суурьт суулгасан.)</div>}
        {pages.map((p) => (
          <div key={p.key} className="flex items-center justify-between rounded-none border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-3">
            <div>
              <div className="text-[13px] font-bold text-[#E8E8E8]">{p.name} <span className="ml-1 text-[10px] font-normal text-[#22D3EE]">{ptLabel(p.pageType)}</span></div>
              <div className="text-[10px] text-[#8A8A92]">{p.pageId}{p.igBusinessId ? ` · IG ${p.igBusinessId}` : " · IG холбоогүй"}</div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => toggle(p)} className="rounded-none bg-[#141419] px-2 py-1 text-[10px] font-bold text-[#8A8A92] hover:bg-[#F2F2F4]">{p.enabled ? "Идэвхтэй" : "Унтарсан"}</button>
              <button onClick={() => remove(p.key)} className="rounded-none bg-[rgba(16,128,202,0.15)] px-2 py-1 text-[10px] font-bold text-[#1080CA]">Салгах</button>
            </div>
          </div>
        ))}
      </div>
      <style jsx>{`
        :global(.pinp) { width: 100%; background: #141419; border: 1px solid rgba(255,255,255,0.08); color: #E8E8E8; font-size: 12px; padding: 8px 10px; border-radius: 4px; font-family: monospace; }
        :global(.pinp:focus) { outline: none; border-color: #22d3ee; }
      `}</style>
    </div>
  );
}
