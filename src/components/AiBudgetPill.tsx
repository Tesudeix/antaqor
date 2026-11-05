"use client";

import { useCallback, useEffect, useState } from "react";

/* Зөвхөн эзэнд харагдана (API бусдад 404 → энэ компонент юу ч зурахгүй).
   AI зураг / видео хуудсын баруун дээд буланд: provider бүрийн үлдэгдэл
   ба "≈ хэдэн зураг/видео үлдсэн", төлбөрийн алдаа гарсан эсэх. */

type Cap = { label: string; usd: number; count: number | null };
type Prov = { provider: string; label: string; home: string; status: "ok" | "blocked" | "unknown"; lastError: string; total: number; spent: number; remaining: number; hasLedger: boolean; topups: { usd: number; note: string; at: string }[]; capacity: Cap[] };

export default function AiBudgetPill({ focus }: { focus?: "image" | "video" }) {
  const [list, setList] = useState<Prov[] | null>(null);
  const [open, setOpen] = useState(false);
  const [add, setAdd] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const r = await fetch("/api/admin/ai-budget", { cache: "no-store" }).catch(() => null);
    if (r?.ok) setList((await r.json()).providers);
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (!list) return null;

  const mine = list.filter((p) => (focus === "video" ? p.provider === "higgsfield" : focus === "image" ? p.provider !== "higgsfield" : true));
  const dot = (s: Prov["status"]) => (s === "ok" ? "#4ADE80" : s === "blocked" ? "#F87171" : "#A1A1AA");
  const short = (p: Prov) => (p.status === "blocked" ? "цэнэглэ" : p.hasLedger ? `$${p.remaining}` : "—");
  const topup = async (p: string) => {
    const usd = Number(add[p]); if (!(usd > 0)) return;
    await fetch("/api/admin/ai-budget", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ provider: p, usd }) });
    setAdd({ ...add, [p]: "" }); await load();
  };

  return (
    <div className="fixed right-4 top-4 z-[60] font-[Manrope,system-ui,sans-serif] text-[13px] text-white">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 rounded-full border border-white/15 bg-black/80 px-3 py-1.5 backdrop-blur-md hover:border-white/30" title="Зөвхөн танд харагдана">
        <span className="text-[11px] font-bold text-white/50">PROVIDER</span>
        {mine.map((p) => <span key={p.provider} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: dot(p.status) }} /><b className="tabular-nums">{short(p)}</b></span>)}
      </button>
      {open && (
        <div className="mt-2 w-[min(380px,calc(100vw-32px))] rounded-[4px] border border-white/12 bg-[#0B0B0C]/95 p-3 shadow-2xl backdrop-blur-md">
          <div className="mb-2 flex items-center justify-between text-[11.5px] text-white/50"><span>Зөвхөн танд харагдана · бодит зарцуулалтаар</span><button onClick={() => setOpen(false)} className="text-white/60 hover:text-white">×</button></div>
          {mine.map((p) => (
            <div key={p.provider} className="mb-2 rounded-[4px] border border-white/[0.08] p-3 last:mb-0">
              <div className="flex items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ background: dot(p.status) }} /><b className="text-[13px]">{p.label}</b>
                <a href={p.home} target="_blank" rel="noopener" className="ml-auto text-[11.5px] text-white/50 hover:text-white">Цэнэглэх ↗</a></div>
              {p.status === "blocked" && <p className="mt-1.5 rounded-[4px] bg-[rgba(248,113,113,0.1)] px-2 py-1 text-[11.5px] text-[#FCA5A5]">Төлбөр дууссан — хэрэглэгчид алдаа авч, кредит буцаагдаж байна.</p>}
              {p.hasLedger ? (
                <>
                  <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                    {[["Цэнэглэсэн", p.total], ["Зарцуулсан", p.spent], ["Үлдсэн", p.remaining]].map(([l, v]) => <div key={String(l)} className="rounded-[4px] bg-white/[0.04] py-1.5"><div className="text-[14px] font-bold tabular-nums">${v}</div><div className="text-[10.5px] text-white/45">{l}</div></div>)}
                  </div>
                  <div className="mt-2 space-y-1">{p.capacity.map((c) => <div key={c.label} className="flex justify-between text-[12px]"><span className="text-white/60">{c.label} · ${c.usd}</span><b className="tabular-nums">≈ {c.count ?? "—"}</b></div>)}</div>
                </>
              ) : (
                <p className="mt-1.5 text-[12px] text-white/55">Цэнэглэлтээ бүртгэвэл үлдэгдэл ба &quot;хэдэн {p.provider === "higgsfield" ? "видео" : "зураг"} үлдсэн&quot;-ийг автоматаар тооцно. Нэгж өртөг: {p.capacity.map((c) => `${c.label} $${c.usd}`).join(" · ")}</p>
              )}
              <div className="mt-2 flex gap-1.5">
                <input value={add[p.provider] || ""} onChange={(e) => setAdd({ ...add, [p.provider]: e.target.value })} inputMode="decimal" placeholder="Цэнэглэсэн $ (жишээ: 10)"
                  className="min-w-0 flex-1 rounded-[4px] border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[12.5px] outline-none focus:border-white/30" />
                <button onClick={() => topup(p.provider)} className="rounded-[4px] bg-white px-3 py-1.5 text-[12px] font-bold text-black">Бүртгэх</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
