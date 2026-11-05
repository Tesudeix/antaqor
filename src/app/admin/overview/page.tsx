"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Spark, Area, Donut } from "@/components/admin/dash/charts";

/* ─── Бизнесийн тойм (2026-10-17) ─────────────────────────────────────────
   Нэг харцаар: мөнгө орж байна уу (орлого, хөрвөлт), өсч байна уу
   (бүртгэл, гишүүд), хэрэглэгчид бүтээгдэхүүнийг ашиглаж байна уу (AI),
   мөн ӨНӨӨДӨР юу хийх вэ (шийдвэр хүлээж буй ажил, сунгалт). Бүх тоо
   /api/admin/dashboard-аас, сонгосон хугацааг өмнөх ижил хугацаатай харьцуулна. */

type K = { value: number; prev: number; series: number[]; prevSeries?: number[]; gained?: number };
type D = {
  range: number; days: string[]; online: number; active24: number;
  kpis: { revenue: K; signups: K; members: K; conversion: K; ai: K };
  chart: { revenue: K; signups: K; payments: K };
  activity: { kind: string; title: string; sub: string; at: string; tone: "ok" | "warn" | "bad" | "info" | "violet" }[];
  sources: { label: string; paid: number; total: number; amount: number }[];
  queue: { key: string; label: string; sub: string; count: number; oldest: string | null; href: string }[];
  membership: { total: number; active: number; expiring: number; expired: number; never: number };
};

/* хар/цагаан: өгөгдөл цагаан/саарал, зөвхөн бууралт улаан */
const C = { green: "#FAFAFA", violet: "#D4D4D8", blue: "#A1A1AA", orange: "#71717A", teal: "#E4E4E7", red: "#F87171", brand: "#FAFAFA" };
const TONE: Record<string, string> = { ok: C.green, warn: C.orange, bad: C.red, info: C.blue, violet: C.violet };
const mnt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}сая₮` : n >= 1e3 ? `${Math.round(n / 1e3)}мян₮` : `${n}₮`);
const num = (n: number) => (n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K` : String(Math.round(n)));
function ago(iso: string | null) {
  if (!iso) return "";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 6e4);
  if (m < 1) return "саяхан"; if (m < 60) return `${m} мин`; const h = Math.floor(m / 60); if (h < 24) return `${h} цаг`; return `${Math.floor(h / 24)} хоног`;
}
function delta(v: number, p: number) {
  if (!p) return v ? { txt: "шинэ", up: true } : { txt: "0%", up: true };
  const d = ((v - p) / Math.abs(p)) * 100;
  return { txt: `${Math.abs(d) >= 100 ? Math.round(d) : d.toFixed(1)}%`, up: d >= 0 };
}

const ICON: Record<string, string> = {
  revenue: "M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  signups: "M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.512-.645-6.374-1.766z",
  members: "M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z",
  conversion: "M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941",
  ai: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z",
};
function Ico({ d, color }: { d: string; color: string }) {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-[4px]" style={{ background: `${color}1f`, color }}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
    </span>
  );
}

const card = "rounded-[4px] border border-white/[0.07] bg-white/[0.025] backdrop-blur-sm";

export default function BusinessOverview() {
  const { data: session } = useSession();
  const [range, setRange] = useState(30);
  const [d, setD] = useState<D | null>(null);
  const [metric, setMetric] = useState<"revenue" | "signups" | "payments">("revenue");
  const [auto, setAuto] = useState<boolean | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);

  const load = useCallback(async (r: number) => {
    const j = await fetch(`/api/admin/dashboard?range=${r}`).then((x) => (x.ok ? x.json() : null)).catch(() => null);
    if (j) setD(j);
  }, []);
  useEffect(() => { setD(null); void load(range); }, [range, load]);
  useEffect(() => { const t = setInterval(() => void load(range), 60_000); return () => clearInterval(t); }, [range, load]);
  useEffect(() => {
    fetch("/api/admin/meta/settings").then((r) => (r.ok ? r.json() : null)).then((m) => setAuto(m?.settings?.automationEnabled !== false)).catch(() => {});
  }, []);
  const toggleAuto = async () => {
    if (auto === null || autoBusy) return;
    setAutoBusy(true);
    try {
      const r = await fetch("/api/admin/meta/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ automationEnabled: !auto }) });
      if (r.ok) setAuto(!auto);
    } finally { setAutoBusy(false); }
  };

  const name = (session?.user?.name || "Antaqor").split(" ")[0];
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Ulaanbaatar", hour: "numeric", hour12: false }).format(new Date()));
  const greet = hour < 11 ? "Өглөөний мэнд" : hour < 18 ? "Сайн байна уу" : "Оройн мэнд";

  const kpis = useMemo(() => d ? [
    { key: "revenue", label: "Орлого", value: mnt(d.kpis.revenue.value), k: d.kpis.revenue, color: C.green },
    { key: "signups", label: "Шинэ бүртгэл", value: num(d.kpis.signups.value), k: d.kpis.signups, color: C.violet },
    { key: "members", label: "Идэвхтэй гишүүд", value: num(d.kpis.members.value), k: d.kpis.members, color: C.blue, note: `+${d.kpis.members.gained || 0} шинэ төлбөр` },
    { key: "conversion", label: "Төлбөрийн хөрвөлт", value: `${d.kpis.conversion.value}%`, k: d.kpis.conversion, color: C.orange, pts: true },
    { key: "ai", label: "AI ашиглалт", value: num(d.kpis.ai.value), k: d.kpis.ai, color: C.teal },
  ] : [], [d]);

  const chartK = d?.chart[metric];
  const chartColor = metric === "revenue" ? C.green : metric === "signups" ? C.violet : C.blue;
  const chartFmt = metric === "revenue" ? mnt : num;
  const m = d?.membership;
  const maxSrc = Math.max(1, ...(d?.sources || []).map((s) => s.amount));

  return (
    <div className="dash mx-auto max-w-[1240px] pb-10 text-white">
      <style>{`
        .dash .dash-draw{stroke-dasharray:2400;stroke-dashoffset:2400;animation:dDraw 1.4s cubic-bezier(.2,.7,.2,1) forwards}
        .dash .dash-fade{opacity:0;animation:dFade 1s ease .35s forwards}
        .dash .dash-ring{animation:dRing 1.1s cubic-bezier(.2,.7,.2,1) both}
        .dash .rise{opacity:0;transform:translateY(14px);filter:blur(6px);animation:dRise .8s cubic-bezier(.16,.84,.24,1) forwards}
        @keyframes dDraw{to{stroke-dashoffset:0}} @keyframes dFade{to{opacity:1}} @keyframes dRing{from{stroke-dasharray:0 999}}
        @keyframes dRise{to{opacity:1;transform:none;filter:none}}
        @media (prefers-reduced-motion:reduce){.dash .dash-draw,.dash .dash-fade,.dash .dash-ring,.dash .rise{animation:none;opacity:1;transform:none;filter:none;stroke-dashoffset:0}}
      `}</style>

      {/* ── Header ── */}
      <div className="rise mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.02em]">{greet}, {name} 👋</h1>
          <p className="mt-1 text-[14px] text-white/55">Antaqor-ийн бизнес яг одоо ийм байна.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px]">
            <i className="h-2 w-2 animate-pulse rounded-full bg-[#34D399]" /> <b>{d?.online ?? "—"}</b> онлайн · <span className="text-white/55">{d?.active24 ?? "—"} өнөөдөр</span>
          </span>
          <button onClick={() => void toggleAuto()} disabled={auto === null || autoBusy}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[12px] disabled:opacity-50" title="Comment/DM автомат хариулт">
            <i className="h-2 w-2 rounded-full" style={{ background: auto ? C.green : C.red }} /> DM автомат {auto ? "асаалттай" : "унтраалттай"}
          </button>
          <div className="flex rounded-full border border-white/10 bg-white/[0.04] p-0.5 text-[12px]">
            {[7, 30, 90].map((r) => (
              <button key={r} onClick={() => setRange(r)} className={`rounded-full px-3 py-1 transition ${range === r ? "bg-white text-black" : "text-white/60 hover:text-white"}`}>{r} хоног</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPI cards ── */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {(d ? kpis : Array.from({ length: 5 }, () => null)).map((x, i) => (
          <div key={i} className={`${card} rise p-4`} style={{ animationDelay: `${80 + i * 60}ms` }}>
            {x ? (() => {
              const dl = x.pts ? { txt: `${Math.abs(x.k.value - x.k.prev).toFixed(1)}pt`, up: x.k.value >= x.k.prev } : delta(x.k.value, x.k.prev);
              return (<>
                <div className="flex items-center gap-2.5"><Ico d={ICON[x.key]} color={x.color} /><span className="text-[13px] text-white/65">{x.label}</span></div>
                <div className="mt-3 text-[28px] font-bold leading-none tracking-[-0.02em]">{x.value}</div>
                <div className="mt-2 flex items-center gap-1 text-[12px]">
                  <span style={{ color: dl.up ? C.green : C.red }}>{dl.up ? "↗" : "↘"} {dl.txt}</span>
                  <span className="truncate text-white/40">{x.note || `өмнөх ${range} хоногоос`}</span>
                </div>
                <div className="mt-2"><Spark data={x.k.series} color={x.color} height={40} /></div>
              </>);
            })() : <div className="h-[148px] animate-pulse rounded-[4px] bg-white/[0.03]" />}
          </div>
        ))}
      </div>

      {/* ── Main chart + activity ── */}
      <div className="mt-3 grid gap-3 lg:grid-cols-[1.75fr_1fr]">
        <div className={`${card} rise p-5`} style={{ animationDelay: "380ms" }}>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold">Өсөлтийн тойм</h2>
              <p className="text-[12px] text-white/45">Сүүлийн {range} хоног · тасархай шугам = өмнөх {range} хоног</p>
            </div>
            <div className="flex rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-[12px]">
              {([["revenue", "Орлого", C.green], ["signups", "Бүртгэл", C.violet], ["payments", "Төлбөр", C.blue]] as const).map(([k, l, c]) => (
                <button key={k} onClick={() => setMetric(k)} className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition ${metric === k ? "bg-white/10 text-white" : "text-white/55 hover:text-white"}`}>
                  <i className="h-2 w-2 rounded-full" style={{ background: c }} />{l}
                </button>
              ))}
            </div>
          </div>
          {chartK && d ? (<>
            <div className="mb-1 flex items-baseline gap-3">
              <span className="text-[24px] font-bold">{chartFmt(chartK.value)}</span>
              {(() => { const dl = delta(chartK.value, chartK.prev); return <span className="text-[13px]" style={{ color: dl.up ? C.green : C.red }}>{dl.up ? "↗" : "↘"} {dl.txt}</span>; })()}
            </div>
            <Area key={metric + range} days={d.days} cur={chartK.series} prev={chartK.prevSeries || []} color={chartColor} fmt={chartFmt} />
          </>) : <div className="h-[300px] animate-pulse rounded-[4px] bg-white/[0.03]" />}
        </div>

        <div className={`${card} rise p-5`} style={{ animationDelay: "440ms" }}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold">Сүүлийн үйлдэл</h2>
            <Link href="/admin/payments" className="rounded-full border border-white/10 px-3 py-1 text-[12px] text-white/70 hover:text-white">Бүгд</Link>
          </div>
          <ul className="divide-y divide-white/[0.05]">
            {(d?.activity || []).map((a, i) => (
              <li key={i} className="flex items-center gap-3 py-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px]" style={{ background: `${TONE[a.tone]}22`, color: TONE[a.tone] }}>
                  {a.kind === "payment" ? (a.tone === "ok" ? "✓" : a.tone === "bad" ? "✕" : "₮") : a.kind === "signup" ? "+" : a.kind === "shop" ? "◆" : "✎"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{a.title}</p>
                  <p className="truncate text-[12px] text-white/45">{a.sub}</p>
                </div>
                <span className="shrink-0 text-[11px] text-white/40">{ago(a.at)}</span>
                <i className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: TONE[a.tone] }} />
              </li>
            ))}
            {!d && Array.from({ length: 6 }).map((_, i) => <li key={i} className="my-2 h-10 animate-pulse rounded bg-white/[0.03]" />)}
          </ul>
        </div>
      </div>

      {/* ── Sources · Queue · Membership ── */}
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <div className={`${card} rise p-5`} style={{ animationDelay: "500ms" }}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[16px] font-semibold">Орлогын эх үүсвэр</h2>
            <Link href="/admin/payments" className="rounded-full border border-white/10 px-3 py-1 text-[12px] text-white/70 hover:text-white">Бүгд</Link>
          </div>
          <div className="mb-1 grid grid-cols-[1fr_64px_80px] text-[11px] text-white/40"><span /><span className="text-right">Амжилт</span><span className="text-right">Орлого</span></div>
          {(d?.sources || []).map((s) => (
            <div key={s.label} className="py-2">
              <div className="grid grid-cols-[1fr_64px_80px] items-center text-[13px]">
                <span className="truncate font-medium">{s.label}</span>
                <span className="text-right text-white/70">{s.total ? Math.round((s.paid / s.total) * 100) : 0}%</span>
                <span className="text-right font-semibold">{mnt(s.amount)}</span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.05]"><div className="h-full rounded-full" style={{ width: `${(s.amount / maxSrc) * 100}%`, background: `linear-gradient(90deg, ${C.green}, ${C.teal})` }} /></div>
              <div className="mt-1 text-[11px] text-white/40">{s.paid} төлсөн / {s.total} оролдлого</div>
            </div>
          ))}
          {d && !d.sources.length && <p className="text-[13px] text-white/45">Энэ хугацаанд төлбөр алга.</p>}
        </div>

        <div className={`${card} rise p-5`} style={{ animationDelay: "560ms" }}>
          <h2 className="mb-3 text-[16px] font-semibold">Өнөөдөр хийх</h2>
          <div className="space-y-2">
            {(d?.queue || []).map((q) => (
              <Link key={q.key} href={q.href} className={`flex items-center gap-3 rounded-[4px] border p-3 transition hover:bg-white/[0.04] ${q.count ? "border-white/10" : "border-white/[0.04] opacity-60"}`}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px] text-[15px] font-bold"
                  style={{ background: q.count ? `${q.key === "abandoned" ? C.orange : q.key === "receipts" ? C.brand : C.blue}22` : "rgba(255,255,255,.04)", color: q.count ? (q.key === "abandoned" ? C.orange : q.key === "receipts" ? "#FF8A8F" : C.blue) : "rgba(255,255,255,.4)" }}>{q.count}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{q.label}</p>
                  <p className="truncate text-[12px] text-white/45">{q.oldest ? `Хамгийн хуучин нь ${ago(q.oldest)} хүлээж байна` : q.sub}</p>
                </div>
                <span className="text-white/30">→</span>
              </Link>
            ))}
          </div>
        </div>

        <div className={`${card} rise p-5`} style={{ animationDelay: "620ms" }}>
          <h2 className="mb-2 text-[16px] font-semibold">Гишүүнчлэлийн төлөв</h2>
          {m ? (<>
            <div className="flex items-center gap-5">
              <Donut size={150} label={num(m.active + m.expiring)} sub="Идэвхтэй"
                parts={[{ v: m.active, color: C.green }, { v: m.expiring, color: C.orange }, { v: m.expired, color: C.red }]} />
              <ul className="flex-1 space-y-2 text-[13px]">
                {([["Идэвхтэй", m.active, C.green], ["7 хоногт дуусна", m.expiring, C.orange], ["Хугацаа дууссан", m.expired, C.red], ["Төлж байгаагүй", m.never, "rgba(255,255,255,.3)"]] as const).map(([l, v, c]) => (
                  <li key={l} className="flex items-center gap-2"><i className="h-2 w-2 rounded-full" style={{ background: c }} /><span className="flex-1 text-white/65">{l}</span><b>{v}</b></li>
                ))}
              </ul>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link href="/admin/email" className="rounded-[4px] bg-[#2E29FF] px-3 py-2.5 text-center text-[12px] font-semibold text-white hover:bg-[#1F1AD9]">Сунгалт сануулах →</Link>
              <Link href="/admin/email" className="rounded-[4px] border border-white/10 px-3 py-2.5 text-center text-[12px] font-semibold text-white/80 hover:bg-white/[0.05]">Буцааж татах →</Link>
            </div>
            <p className="mt-2 text-[11px] text-white/40">{m.expiring} хүний хугацаа 7 хоногт дуусна — одоо сануулбал сунгалт хамгийн өндөр.</p>
          </>) : <div className="h-[220px] animate-pulse rounded-[4px] bg-white/[0.03]" />}
        </div>
      </div>
    </div>
  );
}
