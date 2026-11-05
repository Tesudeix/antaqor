"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import s from "./desk.module.css";

/* ─── TESLA TRADER v7 · ШИНЖИЛГЭЭНИЙ ШИРЭЭ (2026-11-06) ──────────────────────
   Зүүн: хөрөнгийн толгой, бодит чарт, олон хугацааны тайлан. Баруун: агент — стратеги, ≤3 хугацаа, ≤3 индикатор.
   Тайлан: чиглэл → бүтэц → setup хүснэгт → хүчингүй болох нөхцөл → таамгийн замтай чартууд.
   Лавлах хэлбэр нь AI чарт шинжээчид; ялгаа нь төлөвлөгөө бүрийн хажууд ижил дүрмийн түүхэн хэмжилт байна. */

type Line = { name: string; dots?: boolean; v: (number | null)[] };
type Ind = { label: string; pane: "price" | "sub"; ref?: number[]; lines: Line[] };
type Plan = { strat: string; dir: number; lo: number; hi: number; entry: number; sl: number; tp1: number; tp2: number; rr: number; rr2: number; rsiConfirm: boolean; live: boolean; basis: string };
type PaneD = { bars: [number, number, number, number, number][]; inds: Ind[]; swings: { t: number; p: number; label: string }[]; plan: Plan | null; pattern: { neck: number; name: string } | null };
type Stat = { plans: number; fired: number; tp: number; sl: number; exp: number | null; se: number | null; h1: number | null; h2: number | null };
type Sec = { tf: string; empty?: boolean; score: number; state: string; price: number; swings: { label: string; p: number; t: number }[]; notes: string[]; pattern: string | null; inds: { label: string; read: string }[]; plan: Plan | null; none: string | null; confirm: string | null; invalid: string; atr: number; stat: Stat | null; verdict: { k: string; mn: string }; pane: PaneD };
type Ev = { t: number; ccy: string; title: string; impact: string; forecast: string; previous: string };
type Rep = { sym: string; pair: string; stratMn: string; now: number; bias: { k: number; mn: string }; summary: string; sections: Sec[]; statsAt: number | null; measuring: boolean; news: Ev[] };

const SYMS = [{ id: "XAUUSD", pair: "XAU/USD", mn: "Алт", ic: "Au", d: 2 }, { id: "BTCUSDT", pair: "BTC/USDT", mn: "Биткойн", ic: "₿", d: 2 }];
const TFS = ["1m", "5m", "15m", "30m", "1H", "4H", "1D", "1W"];
const STRATS = [{ id: "pullback", mn: "Трендийн буцалт", sub: "Импульсийн дараах буцалт, EMA чиглэл, RSI батлалт" }, { id: "sweep", mn: "Liquidity Sweep", sub: "Swing шүүрдээд эргэж хаагдахад" }, { id: "smc", mn: "SMC · Order block", sub: "BOS-ийн дараах order block руу буцалт" }];
const INDS = [{ id: "ema", mn: "EMA", p: 9 }, { id: "sma", mn: "SMA", p: 20 }, { id: "rsi", mn: "RSI", p: 14 }, { id: "macd", mn: "MACD" }, { id: "bb", mn: "Bollinger Bands", p: 20 }, { id: "atr", mn: "ATR", p: 14 }, { id: "adx", mn: "ADX", p: 14 }, { id: "stoch", mn: "Stochastic", p: 14 }, { id: "ichi", mn: "Ichimoku" }, { id: "vwap", mn: "VWAP" }, { id: "sar", mn: "SAR" }, { id: "st", mn: "Supertrend", p: 10 }, { id: "kst", mn: "KST" }, { id: "pctb", mn: "Percent B", p: 20 }, { id: "mfi", mn: "MFI", p: 14 }, { id: "dpo", mn: "DPO", p: 20 }, { id: "rvol", mn: "Relative Volume", p: 20 }, { id: "ad", mn: "Accumulation/Distribution" }] as { id: string; mn: string; p?: number }[];
const VERS = [{ h: "/", t: "v4" }, { h: "/2", t: "v5" }, { h: "/3", t: "v6" }, { h: "/4", t: "v7" }];
const COL = ["#E8C15A", "#7FB2FF", "#B07CFF", "#FF9F6B"];
const fx = (n: number | null | undefined, d = 2) => (typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
const ub = (t: number) => new Date(t).toLocaleString("en-GB", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ulaanbaatar" }).replace(",", "");
const sg = (n: number) => (n > 0 ? "+" : "");
function load<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } }
function save(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* хувийн горим */ } }

/* ── чарт: лаа, overlay, swing шошго, бүс, түвшин, таамгийн зам + доод самбар ── */
function Pane({ d, digits, height = 340, live }: { d: PaneD; digits: number; height?: number; live?: number }) {
  const box = useRef<HTMLDivElement>(null), [W, setW] = useState(760), [hov, setHov] = useState<number | null>(null);
  useEffect(() => {
    if (!box.current) return;
    const o = new ResizeObserver((e) => setW(Math.max(280, Math.round(e[0].contentRect.width))));
    o.observe(box.current);
    return () => o.disconnect();
  }, []);
  const narrow = W < 520, take = narrow ? 70 : 120, cut = Math.max(0, d.bars.length - take), bars = d.bars.slice(cut), n = bars.length;
  const p = d.plan, R = p ? 92 : 66, future = p ? (W - R) * (narrow ? 0.24 : 0.18) : 10, cw0 = (W - R - future) / Math.max(1, n);
  if (!n) return <div ref={box} className={s.sk} style={{ height }} />;
  let lo = Math.min(...bars.map((b) => b[3])), hi = Math.max(...bars.map((b) => b[2]));
  const span = hi - lo || 1;
  const within = (x: number) => x > lo - span * 0.9 && x < hi + span * 0.9;
  if (p) for (const v of [p.lo, p.hi, p.entry, p.sl, p.tp1]) if (within(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
  const x = (k: number) => (k + 0.5) * cw0, y = (v: number) => ((hi - v) / (hi - lo)) * height, cw = Math.max(1.4, cw0 * 0.62);
  const overlays = d.inds.filter((q) => q.pane === "price"), subs = d.inds.filter((q) => q.pane === "sub");
  const path = (v: (number | null)[]) => { let o = "", on = false; v.slice(cut).forEach((q, k) => { if (q === null || q < lo || q > hi) { on = false; return; } o += `${on ? "L" : "M"}${x(k).toFixed(1)},${y(q).toFixed(1)}`; on = true; }); return o; };
  const idx = new Map(bars.map((b, k) => [b[0], k]));
  const last = bars[n - 1][4], now = live ?? last, end = W - R, x0 = x(n - 1);
  const rows = p ? [{ k: "tp", t: "TP2", v: p.tp2 }, { k: "tp", t: "TP1", v: p.tp1 }, { k: "en", t: "Entry", v: p.entry }, { k: "sl", t: "SL", v: p.sl }].filter((q) => q.v > lo && q.v < hi) : [];
  const h = hov === null ? null : bars[hov];
  const pts = p && within(p.entry) ? [[x0, y(last)], [x0 + future * 0.4, y(p.entry)], ...(within(p.tp1) ? [[end - 4, y(Math.max(lo, Math.min(hi, p.tp1)))]] : [])] : [];
  const alt = p && within(p.sl) ? [[x0 + future * 0.4, y(p.entry)], [end - 4, y(Math.max(lo, Math.min(hi, p.sl)))]] : [];
  return (
    <div ref={box} className={s.pane}>
      <div className={s.ohlc}>{h ? <>{ub(h[0])} · O {fx(h[1], digits)} · H {fx(h[2], digits)} · L {fx(h[3], digits)} · C {fx(h[4], digits)}</> : overlays.length ? overlays.map((q, k) => <span key={q.label} style={{ color: COL[k % 4] }}>{q.label}</span>) : <span>&nbsp;</span>}</div>
      <svg viewBox={`0 0 ${W} ${height}`} width={W} height={height} role="img" aria-label="Үнийн график"
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(), k = Math.floor((e.clientX - r.left) / cw0); setHov(k >= 0 && k < n ? k : null); }} onPointerLeave={() => setHov(null)}>
        {Array.from({ length: 6 }, (_, k) => lo + ((hi - lo) * (k + 0.5)) / 6).map((v) => <g key={v}><line x1={0} x2={end} y1={y(v)} y2={y(v)} className={s.gl} /><text x={end + 6} y={y(v) + 4} className={s.ax}>{fx(v, v > 9999 ? 0 : digits)}</text></g>)}
        {p && within(p.lo) && within(p.hi) && <rect x={Math.max(0, x0 - cw0 * 18)} width={end - Math.max(0, x0 - cw0 * 18)} y={y(p.hi)} height={Math.max(2, y(p.lo) - y(p.hi))} className={s.zone} data-d={p.dir > 0 ? "up" : "dn"} />}
        {d.pattern && d.pattern.neck > lo && d.pattern.neck < hi && <g className={s.neck}><line x1={0} x2={end} y1={y(d.pattern.neck)} y2={y(d.pattern.neck)} /><text x={4} y={y(d.pattern.neck) - 4}>{d.pattern.name} · хүзүү</text></g>}
        {overlays.flatMap((q, k) => q.lines.map((l, m) => l.dots
          ? <g key={q.label + m} fill={COL[k % 4]}>{l.v.slice(cut).map((v, c) => (v !== null && v > lo && v < hi ? <circle key={c} cx={x(c)} cy={y(v)} r={1.5} /> : null))}</g>
          : <path key={q.label + m} d={path(l.v)} fill="none" stroke={COL[k % 4]} strokeWidth={1.3} opacity={q.lines.length > 1 && m !== 1 ? 0.65 : 1} />))}
        {bars.map((b, k) => <g key={b[0]} className={b[4] >= b[1] ? s.up : s.dn}><line x1={x(k)} x2={x(k)} y1={y(b[2])} y2={y(b[3])} /><rect x={x(k) - cw / 2} width={cw} y={y(Math.max(b[1], b[4]))} height={Math.max(1, Math.abs(y(b[1]) - y(b[4])))} /></g>)}
        {d.swings.map((w) => { const k = idx.get(w.t); if (k === undefined) return null; const up = w.label.endsWith("H") || w.label === "H"; return <text key={w.t + w.label} x={x(k)} y={y(w.p) + (up ? -6 : 14)} textAnchor="middle" className={s.sw} data-up={/^(HH|HL)$/.test(w.label) || undefined} data-dn={/^(LH|LL)$/.test(w.label) || undefined}>{w.label}</text>; })}
        {rows.map((q) => <g key={q.t} className={s.lv} data-k={q.k}><line x1={x0 - cw0 * 18 > 0 ? x0 - cw0 * 18 : 0} x2={end} y1={y(q.v)} y2={y(q.v)} /><rect x={end + 1} y={y(q.v) - 9} width={R - 2} height={18} rx={3} /><text x={end + 5} y={y(q.v) + 4}>{q.t} {fx(q.v, q.v > 9999 ? 0 : digits)}</text></g>)}
        {pts.length > 1 && <polyline points={pts.map((q) => q.join(",")).join(" ")} className={s.path} data-d={p!.dir > 0 ? "up" : "dn"} />}
        {alt.length > 1 && <polyline points={alt.map((q) => q.join(",")).join(" ")} className={s.alt} />}
        {now > lo && now < hi && !rows.length && <g className={s.now}><line x1={0} x2={end} y1={y(now)} y2={y(now)} /><rect x={end + 1} y={y(now) - 9} width={R - 2} height={18} rx={3} /><text x={end + 5} y={y(now) + 4}>{fx(now, now > 9999 ? 0 : digits)}</text></g>}
        {hov !== null && <line x1={x(hov)} x2={x(hov)} y1={0} y2={height} className={s.cross} />}
      </svg>
      {subs.map((q) => { const all = q.lines.flatMap((l) => l.v.slice(cut)).filter((v): v is number => v !== null); if (!all.length) return null;
        const a = Math.min(...all, ...(q.ref || [])), b = Math.max(...all, ...(q.ref || [])), H2 = 70, yy = (v: number) => 4 + ((b - v) / (b - a || 1)) * (H2 - 8), lastV = all[all.length - 1];
        return <div key={q.label} className={s.sub}><span>{q.label} <b>{Math.abs(lastV) < 10 ? lastV.toFixed(2) : lastV.toFixed(1)}</b></span><svg viewBox={`0 0 ${W} ${H2}`} width={W} height={H2} aria-hidden="true">{(q.ref || []).map((r) => <line key={r} x1={0} x2={end} y1={yy(r)} y2={yy(r)} className={s.gl2} />)}{q.lines.map((l, m) => { let o = "", on = false; l.v.slice(cut).forEach((v, k) => { if (v === null) { on = false; return; } o += `${on ? "L" : "M"}${x(k).toFixed(1)},${yy(v).toFixed(1)}`; on = true; }); return <path key={l.name} d={o} fill="none" stroke={m ? "#8E8E8E" : "#39FF88"} strokeWidth={1.3} />; })}</svg></div>;
      })}
    </div>
  );
}

function Setup({ secs, d }: { secs: Sec[]; d: number }) {
  const rows: [string, (x: Sec) => React.ReactNode][] = [
    ["Чиглэл", (x) => (x.plan ? <b data-d={x.plan.dir > 0 ? "up" : "dn"}>{x.plan.dir > 0 ? "Авах" : "Зарах"}</b> : "—")],
    ["Хүлээх бүс", (x) => (x.plan ? `${fx(x.plan.lo, d)} – ${fx(x.plan.hi, d)}` : "—")],
    ["Үндэс", (x) => x.plan?.basis ?? "—"],
    ["Батлалт", (x) => x.confirm ?? "—"],
    ["Орох", (x) => (x.plan ? fx(x.plan.entry, d) : "—")],
    ["SL", (x) => (x.plan ? <b data-d="dn">{fx(x.plan.sl, d)}</b> : "—")],
    ["TP1", (x) => (x.plan ? <b data-d="up">{fx(x.plan.tp1, d)}</b> : "—")],
    ["TP2", (x) => (x.plan ? <b data-d="up">{fx(x.plan.tp2, d)}</b> : "—")],
    ["R/R", (x) => (x.plan ? <span data-weak={x.plan.rr < 1 || undefined}>≈{x.plan.rr}R{x.plan.rr < 1 ? " · сул" : ""}</span> : "—")],
    ["Хэмжилт", (x) => (x.stat?.fired ? <span className={s.st} data-k={x.verdict.k}><b>{x.verdict.mn}</b><small>{x.stat.fired} удаа идэвхжсэн · TP {Math.round((x.stat.tp / x.stat.fired) * 100)}% · {sg(x.stat.exp ?? 0)}{x.stat.exp}R ±{x.stat.se}</small></span> : <span className={s.st} data-k="none"><b>{x.verdict.mn}</b></span>)],
  ];
  return <div className={s.scroll}><table className={s.setup}><thead><tr><th />{secs.map((x) => <th key={x.tf}>{x.tf}</th>)}</tr></thead><tbody>{rows.map(([t, f]) => <tr key={t}><th>{t}</th>{secs.map((x) => <td key={x.tf}>{f(x)}</td>)}</tr>)}</tbody></table></div>;
}

export default function DeskApp() {
  const [sym, setSym] = useState("XAUUSD"), [tf, setTf] = useState("1H"), [tab, setTab] = useState<"chart" | "news">("chart");
  const [strat, setStrat] = useState("pullback"), [tfs, setTfs] = useState<string[]>(["4H", "1H", "15m"]), [inds, setInds] = useState<{ id: string; p?: number }[]>([{ id: "ema", p: 9 }, { id: "rsi", p: 14 }]);
  const [pane, setPane] = useState<PaneD | null>(null), [px, setPx] = useState<{ px: number; bid: number; ask: number; chg: number } | null>(null), [rep, setRep] = useState<Rep | null>(null), [news, setNews] = useState<Ev[] | null>(null);
  const [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const out = useRef<HTMLDivElement>(null), agent = useRef<HTMLElement>(null), S = SYMS.find((x) => x.id === sym)!;
  const indQ = useMemo(() => inds.map((q) => `${q.id}:${q.p ?? ""}`).join(","), [inds]);

  useEffect(() => { const c = load<{ sym?: string; strat?: string; tfs?: string[]; inds?: { id: string; p?: number }[]; tf?: string }>("td.cfg", {}); if (c.sym && SYMS.some((x) => x.id === c.sym)) setSym(c.sym); if (c.strat) setStrat(c.strat); if (c.tfs?.length) setTfs(c.tfs); if (c.inds) setInds(c.inds); if (c.tf) setTf(c.tf); }, []);
  useEffect(() => { save("td.cfg", { sym, strat, tfs, inds, tf }); }, [sym, strat, tfs, inds, tf]);
  useEffect(() => {
    let alive = true;
    const a = async () => { if (document.hidden) return; try { const r = await fetch(`/api/trader-agent/desk?q=price&sym=${sym}`, { cache: "no-store" }), d = await r.json(); if (alive && r.ok) setPx(d); } catch { /* дараагийн удаа */ } };
    const b = async () => { if (document.hidden) return; try { const r = await fetch(`/api/trader-agent/desk?sym=${sym}&tf=${tf}&ind=${indQ}`, { cache: "no-store" }), d = await r.json(); if (alive && r.ok) setPane(d); } catch { /* дараагийн удаа */ } };
    setPane(null); a(); b();
    const t1 = setInterval(a, 5000), t2 = setInterval(b, 15000);
    return () => { alive = false; clearInterval(t1); clearInterval(t2); };
  }, [sym, tf, indQ]);
  useEffect(() => { if (tab !== "news") return; setNews(null); fetch(`/api/trader-agent/desk?q=news&sym=${sym}`, { cache: "no-store" }).then((r) => r.json()).then((d) => setNews(d.news || [])).catch(() => setNews([])); }, [tab, sym]);

  const toggleTf = (t: string) => setTfs((c) => (c.includes(t) ? (c.length > 1 ? c.filter((x) => x !== t) : c) : c.length < 3 ? [...c, t] : [...c.slice(1), t]));
  const toggleInd = (id: string, p?: number) => setInds((c) => (c.some((x) => x.id === id) ? c.filter((x) => x.id !== id) : c.length < 3 ? [...c, { id, p }] : c));
  const run = useCallback(async () => {
    if (busy) return;
    setBusy(true); setErr("");
    try {
      const r = await fetch("/api/trader-agent/desk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sym, strat, tfs, inds }) }), d = await r.json();
      if (!r.ok) throw new Error(d.error || `Алдаа (${r.status})`);
      setRep(d);
      setTimeout(() => out.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }, [busy, sym, strat, tfs, inds]);
  const secs = (rep?.sections || []).filter((x) => !x.empty), d = S.d;

  return (
    <div className={s.app}>
      <header className={s.top}>
        <span className={s.mark}>T</span>
        <select className={s.search} value={sym} aria-label="Хэрэгсэл" onChange={(e) => { setSym(e.target.value); setRep(null); }}>{SYMS.map((x) => <option key={x.id} value={x.id}>{x.pair}</option>)}</select>
        <nav className={s.ver} aria-label="Хувилбар">{VERS.map((v) => (v.h === "/4" ? <b key={v.h}>{v.t}</b> : <Link key={v.h} href={v.h} prefetch={false}>{v.t}</Link>))}</nav>
        <button type="button" className={s.out} onClick={() => signOut({ callbackUrl: `${window.location.origin}/` })}>Гарах</button>
      </header>
      <div className={s.shell}>
        <main className={s.main}>
          <section className={s.asset}>
            <span className={s.coin}>{S.ic}</span>
            <div className={s.name}><h1>{S.mn}</h1><em>{S.pair}</em></div>
            <div className={s.px}><b>{px ? fx(px.px, d) : "—"}</b>{px && <span data-up={px.chg >= 0 || undefined} data-dn={px.chg < 0 || undefined}>{sg(px.chg)}{px.chg.toFixed(2)}% · 24ц</span>}</div>
            <button type="button" className={s.ask} onClick={() => agent.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>AI-аар шинжлэх</button>
          </section>
          <div className={s.tabs} role="tablist"><button type="button" role="tab" aria-selected={tab === "chart"} onClick={() => setTab("chart")}>График</button><button type="button" role="tab" aria-selected={tab === "news"} onClick={() => setTab("news")}>Эдийн засгийн мэдээ</button></div>
          {tab === "chart" ? (
            <section className={s.card}>
              <div className={s.tfRow}>{TFS.map((t) => <button key={t} type="button" aria-pressed={tf === t} onClick={() => setTf(t)}>{t}</button>)}</div>
              {pane ? <Pane d={pane} digits={d} live={px?.px} /> : <div className={s.sk} style={{ height: 340 }} />}
            </section>
          ) : (
            <section className={s.card}>{news === null ? <div className={s.sk} /> : !news.length ? <p className={s.dim}>Ойрын хугацаанд мэдээ алга.</p> : <ul className={s.news}>{news.map((e) => <li key={e.t + e.title} data-i={e.impact}><span>{ub(e.t)}</span><b>{e.ccy}</b><p>{e.title}{e.forecast ? <small> · таамаг {e.forecast} · өмнөх {e.previous}</small> : null}</p></li>)}</ul>}</section>
          )}
        </main>

        <aside className={s.agent} ref={agent} aria-label="Агент">
          <h3><span>✦</span> Агент</h3>
          <label className={s.lb}>Стратеги</label>
          <div className={s.strats}>{STRATS.map((x) => <button key={x.id} type="button" aria-pressed={strat === x.id} onClick={() => setStrat(x.id)}><b>{x.mn}</b><small>{x.sub}</small></button>)}</div>
          <div className={s.lbr}><label className={s.lb}>Хугацаа</label><span>{tfs.length}/3</span></div>
          <div className={s.chips}>{TFS.map((t) => <button key={t} type="button" aria-pressed={tfs.includes(t)} onClick={() => toggleTf(t)}>{t}</button>)}</div>
          <div className={s.lbr}><label className={s.lb}>Индикатор</label><span>{inds.length}/3</span></div>
          <div className={s.chips}>{INDS.map((q) => { const on = inds.find((x) => x.id === q.id); return <button key={q.id} type="button" aria-pressed={!!on} disabled={!on && inds.length >= 3} onClick={() => toggleInd(q.id, q.p)}>{q.mn}{on?.p ? `(${on.p})` : ""}</button>; })}</div>
          {inds.some((q) => q.p) && <div className={s.params}>{inds.filter((q) => q.p).map((q) => <label key={q.id}><span>{INDS.find((x) => x.id === q.id)?.mn}</span><input type="number" min={2} max={400} value={q.p} onChange={(e) => { const v = Math.max(2, Math.min(400, Number(e.target.value) || 2)); setInds((c) => c.map((x) => (x.id === q.id ? { ...x, p: v } : x))); }} /></label>)}</div>}
          <button type="button" className={s.go} onClick={run} disabled={busy}>{busy ? "Шинжилж байна…" : `${S.pair} шинжлэх`}</button>
          {err && <p className={s.err}>{err}</p>}
          <p className={s.dim}>Тоо бүр бодит лаанаас тооцогдоно. Кредит шаардахгүй.</p>
        </aside>

        <div className={s.rest}>
          {rep && (
            <div className={s.report} ref={out}>
              <section className={s.card} data-b={rep.bias.k > 0 ? "up" : rep.bias.k < 0 ? "dn" : "mid"}>
                <span className={s.meta}>{rep.pair} · {rep.stratMn} · {ub(rep.now)}</span>
                <h2>Чиглэл: {rep.bias.mn}</h2>
                <p className={s.lead}>{rep.summary}</p>
                <p className={s.warn}>Энэ бол нөхцөлт төлөвлөгөө, дохио биш. Хэмжилтийн мөр нь ижил дүрэм түүхэнд хэрхэн ажилласныг spread, шимтгэл хассан R-ээр харуулна.{rep.measuring ? " Хэмжилт яг одоо шинэчлэгдэж байна." : ""}</p>
              </section>
              <section className={s.card}><h3>Бүтэц</h3>
                {secs.map((x) => (
                  <article key={x.tf} className={s.tfBlock}>
                    <h4>{x.tf} <em>{x.state}</em></h4>
                    <div className={s.chain}>{x.swings.map((w) => <span key={w.t + w.label} data-up={/^(HH|HL)$/.test(w.label) || undefined} data-dn={/^(LH|LL)$/.test(w.label) || undefined}><b>{w.label}</b>{fx(w.p, d)}<small>{ub(w.t)}</small></span>)}</div>
                    <ul>{x.notes.map((n) => <li key={n}>{n}</li>)}{x.pattern && <li>{x.pattern}</li>}</ul>
                    {!!x.inds.length && <div className={s.indr}>{x.inds.map((q) => <span key={q.label}><b>{q.label}</b> {q.read}</span>)}</div>}
                  </article>
                ))}
              </section>
              <section className={s.card}><h3>Setup <small>{rep.stratMn}</small></h3><Setup secs={secs} d={d} />{secs.filter((x) => x.none).map((x) => <p key={x.tf} className={s.dim}>{x.tf}: {x.none}</p>)}</section>
              <section className={s.card}><h3>Хүчингүй болох нөхцөл</h3><ul className={s.inv}>{secs.filter((x) => x.plan).map((x) => <li key={x.tf}><b>{x.tf}</b> {x.invalid}</li>)}</ul>{!!rep.news.length && <><h3>Ойрын эрсдэл</h3><ul className={s.news}>{rep.news.map((e) => <li key={e.t + e.title} data-i={e.impact}><span>{ub(e.t)}</span><b>{e.ccy}</b><p>{e.title}</p></li>)}</ul></>}</section>
              {secs.map((x) => <section key={x.tf} className={s.card}><h3>{x.tf} <small>түвшин, таамгийн зам</small></h3><Pane d={x.pane} digits={d} height={300} live={px?.px} /></section>)}
            </div>
          )}
          <p className={s.disc}>Tesla Trader нь техник шинжилгээ, сургалтын хэрэгсэл — <b>санхүүгийн зөвлөгөө биш</b>. Төлөвлөгөө нь бодит лаанаас тооцсон нөхцөлт хувилбар, хэмжилт нь өнгөрсөн дата. Ханш: Dukascopy, Binance.</p>
        </div>
      </div>
    </div>
  );
}
