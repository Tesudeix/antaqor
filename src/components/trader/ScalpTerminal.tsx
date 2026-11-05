"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import s from "./scalp.module.css";

/* ─── TESLA TRADER · SCALP TERMINAL (2026-11-04) ─────────────────────────────
   Зураг оруулахгүй — 13 хэрэгслийг бодит 1 мин лаагаар өөрөө хянана (lib/scalp/*).
   Самбар 20 с, сонгосон хэрэгсэл 10 с тутам шинэчлэгдэнэ (табыг нуувал зогсоно).
   Сигнал зөвхөн бүх шүүлтүүр нээлттэй + хэмжсэн давуу тал сөрөг биш үед «LIVE» болно.
   A/B сигнал шинээр гарвал дуу + мэдэгдэл (хэрэглэгч асаасан бол). */

type Gate = { key: string; label: string; ok: boolean; warn?: boolean; text: string };
type Stat = { n: number; tp1Rate: number | null; pTp1: number; exp: number; expShr: number; se: number | null; totalR: number; avgMin: number | null; n14: number; net14: number } | null;
type Sig = {
  play: string; playMn: string; dir: number; grade: string; status: "live" | "off" | "blocked" | "missed"; ageMin: number; why?: string; gradeWhy?: string;
  entry: number; sl: number; tp1: number; tp2: number; risk: number; rr2: number; costR: number; slPips: number; tp1Pips: number; tp2Pips: number;
  gates?: Gate[]; text?: { setup: string; manage: string; invalid: string; edge: string };
};
type Row = {
  sym: string; name: string; kind: string; digits: number; pip: number; ok: boolean; text?: string;
  price?: number; bid?: number | null; ask?: number | null; spreadPips?: number; spreadTxt?: string; age?: number; change?: number;
  session?: string; regime?: string; regimeMn?: string; bias?: number;
  blocked?: { label: string; text: string } | null; signal?: Sig | null; watch?: { kind: string; text: string } | null;
};
type Vote = { key: string; fam: string; label: string; vote: number; value: string };
type Detail = Row & {
  contract: number; quote: string; usdPerQuote: number; typicalPips: number; gates: Gate[]; usd: number; dxyZ: number | null;
  fam: { votes: Vote[]; trend: number | null; mom: number | null; flow: number | null; macro: number | null; count: number; neff: number;
    vol: { atrPct: number; bbwPct: number; er: number; adx: number; squeeze: boolean; atr5: number; atr1: number };
    loc: { vwap: number; vwapSig: number; vwapKind: string; bbPct: number; e20Atr: number; asiaHi: number | null; asiaLo: number | null };
    m15: { dir: number; adx: number }; rsi7: number };
  edge: Record<string, { name: string; mine: Stat; pooled: Stat }>; edgeUpdated: number | null; params: { slMin: number; slMax: number; maxBars: number };
  news: { t: number; ccy: string; title: string; impact: string; forecast: string; previous: string }[];
  chart: { bars: [number, number, number, number, number][]; e9: number[]; e20: number[]; vwap: number[]; vwapKind: string; watch: { lo: number; hi: number } | null };
};
type Board = { now: number; rows: Row[]; calibrating: boolean; edgeUpdated: number | null; news: Detail["news"]; clock: { tokyo: boolean; london: boolean; ny: boolean; fxOpen: boolean; fxName: string; nextOpen: number | null } };

const f = (n: number | null | undefined, d = 5) => (typeof n === "number" && Number.isFinite(n) ? n.toFixed(d) : "—");
const sgn = (n: number) => (n > 0 ? "+" : "");
const hm = (t: number) => new Date(t).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ulaanbaatar" });
const inMin = (t: number, now: number) => { const m = Math.round((t - now) / 60000); return m <= 0 ? (m > -15 ? "яг одоо" : `${-m} мин өмнө`) : m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ц ${m % 60} мин`; };
function load<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } }
function save(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* хувийн горим */ } }
function beep() {
  try {
    const C = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext, ctx = new C();
    [0, 0.18].forEach((d) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = 880; g.gain.setValueAtTime(0.12, ctx.currentTime + d); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.14); o.connect(g).connect(ctx.destination); o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.15); });
  } catch { /* дуугүй */ }
}

const DIR = (d: number) => (d > 0 ? "BUY" : "SELL");
/** зай: валютад пипс, алт/криптод $ */
const dist = (d: { kind: string; pip: number }, pips: number) => (d.kind === "fx" ? `${pips} пипс` : `$${(pips * d.pip).toFixed(d.kind === "crypto" ? 1 : 2)}`);
const ST_MN: Record<string, string> = { live: "LIVE", off: "Унтраалттай", blocked: "Хаалттай", missed: "Хоцорсон" };

/* ── чарт: 90 минутын лаа + EMA9, EMA20(M5), VWAP, хүлээх бүс, сигналын түвшин ── */
function Chart({ d }: { d: Detail }) {
  const { bars, e9, e20, vwap } = d.chart, sig = d.signal;
  const W = 720, H = 300, R = 64, n = bars.length;
  const lv = sig ? [sig.entry, sig.sl, sig.tp1, sig.tp2] : [];
  const zone = d.chart.watch;
  let lo = Math.min(...bars.map((b) => b[3]), ...lv, ...e20.filter(Number.isFinite)), hi = Math.max(...bars.map((b) => b[2]), ...lv, ...e20.filter(Number.isFinite));
  if (zone) { lo = Math.min(lo, zone.lo); hi = Math.max(hi, zone.hi); }
  const pad = (hi - lo) * 0.06 || 1e-6; lo -= pad; hi += pad;
  const x = (k: number) => ((k + 0.5) * (W - R)) / n, y = (p: number) => ((hi - p) / (hi - lo)) * H, cw = Math.max(1.5, ((W - R) / n) * 0.62);
  const path = (v: number[]) => v.map((p, k) => (Number.isFinite(p) ? `${k ? "L" : "M"}${x(k).toFixed(1)},${y(p).toFixed(1)}` : "")).join("");
  const ticks = Array.from({ length: 5 }, (_, k) => lo + ((hi - lo) * (k + 0.5)) / 5);
  const last = bars[n - 1]?.[4], vw = vwap[n - 1], vwOff = Number.isFinite(vw) && (vw > hi || vw < lo);
  const lines = sig ? [
    { k: "tp2", p: sig.tp2, t: `TP2 ${f(sig.tp2, d.digits)}` }, { k: "tp1", p: sig.tp1, t: `TP1 ${f(sig.tp1, d.digits)}` },
    { k: "entry", p: sig.entry, t: `ENTRY ${f(sig.entry, d.digits)}` }, { k: "sl", p: sig.sl, t: `SL ${f(sig.sl, d.digits)}` },
  ] : [];
  return (
    <figure className={s.chart}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${d.sym} 1 минутын график`}>
        {ticks.map((p) => <g key={p}><line x1={0} x2={W - R} y1={y(p)} y2={y(p)} className={s.gl} /><text x={W - R + 6} y={y(p) + 4} className={s.axis}>{f(p, d.digits)}</text></g>)}
        {zone && <rect x={0} width={W - R} y={y(zone.hi)} height={Math.max(1, y(zone.lo) - y(zone.hi))} className={s.zone} />}
        {sig && <rect x={0} width={W - R} y={Math.min(y(sig.entry), y(sig.tp2))} height={Math.abs(y(sig.tp2) - y(sig.entry))} className={s.winZ} />}
        {sig && <rect x={0} width={W - R} y={Math.min(y(sig.entry), y(sig.sl))} height={Math.abs(y(sig.sl) - y(sig.entry))} className={s.lossZ} />}
        <path d={path(vwap)} className={s.lVwap} />
        <path d={path(e20)} className={s.lE20} />
        <path d={path(e9)} className={s.lE9} />
        {bars.map((b, k) => {
          const up = b[4] >= b[1];
          return <g key={b[0]} className={up ? s.cUp : s.cDn}><line x1={x(k)} x2={x(k)} y1={y(b[2])} y2={y(b[3])} /><rect x={x(k) - cw / 2} width={cw} y={y(Math.max(b[1], b[4]))} height={Math.max(1, Math.abs(y(b[1]) - y(b[4])))} /></g>;
        })}
        {lines.map((q) => <g key={q.k} className={s.lv} data-k={q.k}><line x1={0} x2={W - R} y1={y(q.p)} y2={y(q.p)} /><text x={6} y={y(q.p) - 4}>{q.t}</text></g>)}
        {vwOff && <text x={W - R - 6} y={vw > hi ? 14 : H - 6} textAnchor="end" className={s.vwOff}>{d.chart.vwapKind} {vw > hi ? "↑" : "↓"} {f(vw, d.digits)}</text>}
        {last !== undefined && <g className={s.now}><line x1={0} x2={W - R} y1={y(last)} y2={y(last)} /><rect x={W - R + 1} y={y(last) - 9} width={R - 2} height={18} rx={3} /><text x={W - R + 6} y={y(last) + 4}>{f(last, d.digits)}</text></g>}
      </svg>
      <figcaption><i data-k="e9" />EMA 9 (M1)<i data-k="e20" />EMA 20 (M5)<i data-k="vwap" />{d.chart.vwapKind} (өдрийн){zone && <><i data-k="zone" />хүлээх бүс</>}</figcaption>
    </figure>
  );
}

function FamBar({ label, v, note }: { label: string; v: number | null; note?: string }) {
  if (v === null) return <div className={s.fam} data-off><span>{label}</span><em>{note || "Энэ хэрэгсэлд алга"}</em></div>;
  const pct = Math.min(50, Math.abs(v) * 50);
  return (
    <div className={s.fam}>
      <span>{label}</span>
      <div className={s.famBar}><u style={{ left: v >= 0 ? "50%" : `${50 - pct}%`, width: `${pct}%` }} data-up={v >= 0 || undefined} /></div>
      <b data-up={v > 0.15 || undefined} data-dn={v < -0.15 || undefined}>{v > 0.15 ? "▲" : v < -0.15 ? "▼" : "•"} {sgn(v)}{v.toFixed(2)}</b>
    </div>
  );
}

function StatCell({ st }: { st: Stat }) {
  if (!st || !st.n) return <td className={s.dim}>дата алга</td>;
  const few = st.n < 30;
  return <td data-few={few || undefined}><b data-up={(!few && st.exp > 0) || undefined} data-dn={(!few && st.exp < 0) || undefined}>{sgn(st.exp)}{st.exp.toFixed(2)}R</b><small>{st.n} удаа{few ? " — дата бага" : ""} · TP1 {st.tp1Rate}%{st.n14 ? ` · 14х ${sgn(st.net14)}${st.net14.toFixed(2)}R` : ""}</small></td>;
}

export default function ScalpTerminal({ onTaken }: { onTaken?: () => void }) {
  const [board, setBoard] = useState<Board | null>(null);
  const [sel, setSel] = useState<string>("");
  const [det, setDet] = useState<Detail | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const [bal, setBal] = useState(1000);
  const [riskPct, setRiskPct] = useState(1);
  const [alerts, setAlerts] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [showVotes, setShowVotes] = useState(false);
  const seen = useRef<Set<string>>(new Set());
  const first = useRef(true);

  useEffect(() => { setBal(load("ts.bal", 1000)); setRiskPct(load("ts.risk", 1)); setAlerts(load("ts.alerts", false)); setSel(load("ts.sel", "")); }, []);
  useEffect(() => { save("ts.bal", bal); save("ts.risk", riskPct); }, [bal, riskPct]);

  const loadBoard = useCallback(async () => {
    if (document.hidden) return;
    try {
      const r = await fetch("/api/trader-agent/scalp", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Алдаа");
      setBoard(d); setErr("");
      const fresh = (d.rows as Row[]).filter((x) => x.signal?.status === "live" && ["A", "B"].includes(x.signal.grade));
      const keys = fresh.map((x) => `${x.sym}:${x.signal!.play}:${x.signal!.entry}`);
      if (!first.current && alerts) {
        const nw = fresh.filter((x, k) => !seen.current.has(keys[k]));
        if (nw.length) {
          beep();
          try { if (Notification.permission === "granted") nw.forEach((x) => new Notification(`${x.sym} ${DIR(x.signal!.dir)} · ${x.signal!.grade}`, { body: `${x.signal!.playMn} · ${f(x.signal!.entry, x.digits)}` })); } catch { /* мэдэгдэлгүй */ }
        }
      }
      keys.forEach((k) => seen.current.add(k));
      first.current = false;
      setSel((cur) => cur || (d.rows as Row[])[0]?.sym || "");
    } catch (e) { setErr((e as Error).message); }
  }, [alerts]);
  const selRef = useRef("");
  const loadDet = useCallback(async (sym: string) => {
    if (!sym || document.hidden) return;
    try {
      const r = await fetch(`/api/trader-agent/scalp?sym=${sym}`, { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Алдаа");
      if (selRef.current === sym) setDet(d);
    } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { loadBoard(); const t = setInterval(loadBoard, 20_000); const v = () => !document.hidden && loadBoard(); document.addEventListener("visibilitychange", v); return () => { clearInterval(t); document.removeEventListener("visibilitychange", v); }; }, [loadBoard]);
  useEffect(() => { selRef.current = sel; if (!sel) return; save("ts.sel", sel); setDet((d) => (d?.sym === sel ? d : null)); loadDet(sel); const t = setInterval(() => loadDet(sel), 10_000); return () => clearInterval(t); }, [sel, loadDet]);

  const pick = (sym: string) => { setSel(sym); setOpen(true); setNote(""); setShowVotes(false); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const toggleAlerts = async () => {
    const v = !alerts; setAlerts(v); save("ts.alerts", v);
    if (v) { beep(); try { if (Notification.permission === "default") await Notification.requestPermission(); } catch { /* дэмжихгүй */ } }
  };

  const d = det && det.sym === sel ? det : null, sig = d?.signal || null;
  const lot = useMemo(() => {
    if (!d || !sig || !d.usdPerQuote) return null;
    const riskUsd = (bal * riskPct) / 100, perLot = sig.risk * d.contract * d.usdPerQuote;
    if (!perLot) return null;
    return { riskUsd, lots: Math.floor((riskUsd / perLot) * 100) / 100, perLot, tp1: riskUsd * 0.5, tp2: riskUsd * (0.5 + 0.5 * sig.rr2), cost: riskUsd * sig.costR };
  }, [d, sig, bal, riskPct]);

  async function take() {
    if (!d || !sig || busy) return;
    setBusy(true); setNote("");
    try {
      const r = await fetch("/api/trader-agent/journal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sym: d.sym, dir: sig.dir, play: sig.play, grade: sig.grade, entry: sig.entry, sl: sig.sl, tp1: sig.tp1, tp2: sig.tp2 }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Алдаа");
      setNote("Журналд бүртгэлээ — үр дүнг бодит лаагаар автоматаар шалгана."); onTaken?.();
    } catch (e) { setNote((e as Error).message); } finally { setBusy(false); }
  }
  const copy = () => {
    if (!d || !sig) return;
    const t = `TESLA TRADER · SCALP\n${d.sym} ${DIR(sig.dir)} @ ${f(sig.entry, d.digits)}\nSL ${f(sig.sl, d.digits)} (${dist(d, sig.slPips)})\nTP1 ${f(sig.tp1, d.digits)} (1R, 50%) · TP2 ${f(sig.tp2, d.digits)} (${sig.rr2}R)\n${sig.playMn} · ${sig.grade} · ${d.params.maxBars} мин цагийн зогсоолт`;
    navigator.clipboard?.writeText(t).then(() => setNote("Хуулагдлаа ✓")).catch(() => {});
  };

  const now = board?.now || Date.now();
  return (
    <div className={s.term} data-open={open || undefined}>
      {/* ── самбар ── */}
      <aside className={s.board} aria-label="Хэрэгслүүд">
        <div className={s.bHead}>
          <div className={s.sess}>
            {(["tokyo", "london", "ny"] as const).map((k) => <span key={k} data-on={board?.clock[k] || undefined}>{k === "tokyo" ? "Tokyo" : k === "london" ? "London" : "New York"}</span>)}
          </div>
          <button type="button" className={s.alertBtn} aria-pressed={alerts} onClick={toggleAlerts} title="A/B сигнал гарвал дуугаар мэдэгдэнэ">{alerts ? "🔔 Дохио асаалттай" : "🔕 Дохио"}</button>
        </div>
        {board && !board.clock.fxOpen && <p className={s.closed}>Валютын скальп цонх хаалттай ({board.clock.fxName}).{board.clock.nextOpen ? ` Дараагийн цонх ${inMin(board.clock.nextOpen, now)}-ийн дараа (УБ ${hm(board.clock.nextOpen)}).` : ""}</p>}
        {!board ? <div className={s.sk} /> : (
          <ul className={s.rows}>
            {board.rows.map((r) => {
              const sg = r.signal, live = sg?.status === "live";
              return (
                <li key={r.sym}>
                  <button type="button" className={s.row} aria-pressed={sel === r.sym} onClick={() => pick(r.sym)} data-live={live || undefined}>
                    <span className={s.rSym}><b>{r.sym}</b><small>{r.name}</small></span>
                    <span className={s.rPx}><b>{r.ok ? f(r.price, r.digits) : "—"}</b><small>{r.ok ? r.spreadTxt : ""}</small></span>
                    <span className={s.rSt}>
                      {!r.ok ? <em data-k="mut">{r.text}</em>
                        : sg ? <em data-k={live ? (sg.dir > 0 ? "buy" : "sell") : "mut"}>{live ? `${DIR(sg.dir)} · ${sg.grade}` : `${DIR(sg.dir)} · ${ST_MN[sg.status]}`}</em>
                        : r.blocked ? <em data-k="block">{r.blocked.label}</em>
                        : <em data-k={r.watch?.kind === "zone" || r.watch?.kind === "asia" ? "watch" : "mut"}>{r.watch?.kind === "zone" ? "Бүс хүлээж буй" : r.watch?.kind === "asia" ? "Эвдрэл хүлээж буй" : r.watch?.kind === "range" ? "Хүрээ" : "Хүлээх"}</em>}
                      {r.ok && <small>{r.regimeMn}{r.bias ? (r.bias > 0 ? " · M15 ▲" : " · M15 ▼") : ""}</small>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {board?.news?.length ? (
          <div className={s.bNews}>
            <h4>Өндөр нөлөөтэй мэдээ</h4>
            {board.news.map((e) => <p key={e.t + e.title}><b>{e.ccy}</b> {e.title}<span>{inMin(e.t, now)}</span></p>)}
          </div>
        ) : null}
        <p className={s.bFoot}>{board?.calibrating ? "Давуу талыг дахин хэмжиж байна…" : board?.edgeUpdated ? `Давуу тал ${hm(board.edgeUpdated)}-д хэмжигдсэн (28 хоног)` : ""}</p>
      </aside>

      {/* ── сонгосон хэрэгсэл ── */}
      <section className={s.detail} aria-live="polite">
        <button type="button" className={s.back} onClick={() => setOpen(false)}>← Бүх хэрэгсэл</button>
        {err && <p className={s.err}>{err}</p>}
        {!d ? <div className={s.sk} style={{ height: 420 }} /> : (
          <>
            <header className={s.dHead}>
              <div>
                <h2>{d.sym} <small>{d.name}</small></h2>
                <p className={s.meta}>
                  {d.ok && <>Bid {f(d.bid ?? d.price, d.digits)} · Ask {f(d.ask ?? d.price, d.digits)} · spread {d.spreadTxt} · {d.age} с</>}
                </p>
              </div>
              <div className={s.chips}>
                <span data-k={d.regime}>{d.regimeMn}</span>
                <span data-k={d.bias! > 0 ? "up" : d.bias! < 0 ? "dn" : ""}>M15 {d.bias! > 0 ? "▲ өсөх" : d.bias! < 0 ? "▼ унах" : "• саармаг"}</span>
                <span>{d.session}</span>
              </div>
            </header>

            {sig ? (
              <div className={s.sig} data-dir={sig.dir > 0 ? "BUY" : "SELL"} data-st={sig.status}>
                <div className={s.sigTop}>
                  <div>
                    <span className={s.sigMeta}>{sig.playMn} · {sig.ageMin ? `${sig.ageMin} мин өмнө` : "яг одоо"}</span>
                    <b className={s.sigDir}>{DIR(sig.dir)}</b>
                  </div>
                  <div className={s.sigGrade}><b data-g={sig.grade}>{sig.grade}</b><em>{ST_MN[sig.status]}</em></div>
                </div>
                {sig.status !== "live" && <p className={s.sigWhy}>{sig.why}</p>}
                <div className={s.lvls}>
                  <div data-k="entry"><span>Entry</span><b>{f(sig.entry, d.digits)}</b><em>Одоо {f(sig.dir > 0 ? d.ask ?? d.price : d.bid ?? d.price, d.digits)}</em></div>
                  <div data-k="sl"><span>Stop</span><b>{f(sig.sl, d.digits)}</b><em>{dist(d, sig.slPips)} · −1R</em></div>
                  <div data-k="tp"><span>TP1 · 50%</span><b>{f(sig.tp1, d.digits)}</b><em>{dist(d, sig.tp1Pips)} · +1R</em></div>
                  <div data-k="tp"><span>TP2</span><b>{f(sig.tp2, d.digits)}</b><em>{dist(d, sig.tp2Pips)} · +{sig.rr2}R</em></div>
                </div>
                <div className={s.calc}>
                  <label><span>Данс $</span><input type="number" min={10} step={10} value={bal} onChange={(e) => setBal(Math.max(0, Number(e.target.value) || 0))} /></label>
                  <div className={s.riskC}>{[0.25, 0.5, 1].map((v) => <button key={v} type="button" aria-pressed={riskPct === v} onClick={() => setRiskPct(v)}>{v}%</button>)}</div>
                  <div className={s.lot}><b>{lot ? (d.kind === "crypto" ? `${lot.lots}` : lot.lots.toFixed(2)) : "—"}</b><span>{d.kind === "crypto" ? d.sym.slice(0, 3) : "лот"}</span></div>
                  <p>{lot ? <>Эрсдэл ${lot.riskUsd.toFixed(2)} · TP1 +${lot.tp1.toFixed(2)} · TP2 +${lot.tp2.toFixed(2)} · spread ≈ ${lot.cost.toFixed(2)}</> : "Лотын үнэ тооцогдсонгүй"}
                    {lot && lot.lots < 0.01 && d.kind !== "crypto" ? <strong> Данс энэ SL-д хэт жижиг (0.01 лот = ${(lot.perLot * 0.01).toFixed(2)} эрсдэл) — алгас.</strong> : null}</p>
                </div>
                {sig.text && (
                  <div className={s.notes}>
                    <p>{sig.text.setup}</p>
                    <p><b>Удирдлага.</b> {sig.text.manage}</p>
                    <p><b>Хүчингүй.</b> {sig.text.invalid}</p>
                    <p><b>Хэмжсэн давуу тал.</b> {sig.text.edge} {sig.gradeWhy ? <span className={s.dim}>({sig.gradeWhy})</span> : null}</p>
                  </div>
                )}
                <div className={s.acts}>
                  <button type="button" data-k="pri" onClick={take} disabled={busy || sig.status === "missed"}>{busy ? "…" : "Авсан — журналд"}</button>
                  <button type="button" onClick={copy}>Хуулах</button>
                </div>
                {note && <p className={s.note}>{note}</p>}
              </div>
            ) : (
              <div className={s.wait}>
                <b>ХҮЛЭЭХ</b>
                <p>{d.gates.find((g) => !g.ok)?.text || d.watch?.text}</p>
                {d.gates.find((g) => !g.ok) && d.watch?.text && <p className={s.dim}>{d.watch.text}</p>}
              </div>
            )}

            <Chart d={d} />

            <div className={s.grid}>
              <div className={s.card}>
                <h3>Шүүлтүүр <small>нэг нь ч ✗ бол арилжаа хийхгүй</small></h3>
                <ul className={s.gates}>
                  {[...d.gates, ...(sig?.gates || [])].map((g) => <li key={g.key} data-s={!g.ok ? "bad" : g.warn ? "warn" : "ok"}><i>{!g.ok ? "✗" : g.warn ? "!" : "✓"}</i><div><b>{g.label}</b><span>{g.text}</span></div></li>)}
                </ul>
              </div>
              <div className={s.card}>
                <h3>Индикаторын гэр бүл <small>{d.fam.count} индикатор → ≈{d.fam.neff} бие даасан дохио</small></h3>
                <FamBar label="Тренд" v={d.fam.trend} />
                <FamBar label="Момент" v={d.fam.mom} />
                <FamBar label="Урсгал (эзлэхүүн)" v={d.fam.flow} note="Эзлэхүүн алга" />
                <FamBar label="Макро (DXY)" v={d.fam.macro} note="Доллартой хамааралгүй" />
                <p className={s.expl}>
                  Бүгд нэг лааны үнээс тооцогддог тул {d.fam.count} индикатор санал нийлэх нь {d.fam.count} нотолгоо биш. Сүүлийн 20 цагийн корреляциар хэмжвэл ≈{d.fam.neff} бие даасан мэдээлэл үлддэг — тиймээс гэр бүл тус бүрийг нэг л удаа тоолно.
                </p>
                <div className={s.kv}>
                  <span>ATR (M5)</span><b>{f(d.fam.vol.atr5, d.digits)} · {d.fam.vol.atrPct}%</b>
                  <span>ADX · ER</span><b>{d.fam.vol.adx} · {d.fam.vol.er}</b>
                  <span>{d.fam.loc.vwapKind}</span><b>{f(d.fam.loc.vwap, d.digits)} ({sgn(d.fam.loc.vwapSig)}{d.fam.loc.vwapSig}σ)</b>
                  <span>EMA20-оос</span><b>{sgn(d.fam.loc.e20Atr)}{d.fam.loc.e20Atr} ATR</b>
                  {d.fam.loc.asiaHi !== null && <><span>Азийн хүрээ</span><b>{f(d.fam.loc.asiaLo, d.digits)} – {f(d.fam.loc.asiaHi, d.digits)}</b></>}
                  {d.dxyZ !== null && d.usd !== 0 && <><span>DXY 30 мин</span><b>{sgn(d.dxyZ)}{d.dxyZ.toFixed(1)}σ</b></>}
                </div>
                <button type="button" className={s.more} onClick={() => setShowVotes((v) => !v)}>{showVotes ? "Хураах" : `${d.fam.count} индикаторыг харах`}</button>
                {showVotes && (
                  <ul className={s.votes}>
                    {d.fam.votes.map((v) => <li key={v.key}><span>{v.label}</span><em>{v.value}</em><b data-up={v.vote > 0.15 || undefined} data-dn={v.vote < -0.15 || undefined}>{sgn(v.vote)}{v.vote.toFixed(2)}</b></li>)}
                  </ul>
                )}
              </div>
            </div>

            <div className={s.card}>
              <h3>Давуу талын лаборатори <small>сүүлийн 28 хоног · 1 мин дата · spread хассан R</small></h3>
              <table className={s.edge}>
                <thead><tr><th>Загвар</th><th>{d.sym}</th><th>Бүх {d.kind === "fx" ? "валют" : d.kind === "metal" ? "металл" : "крипто"}</th></tr></thead>
                <tbody>{Object.entries(d.edge).map(([k, e]) => <tr key={k}><th>{e.name}</th><StatCell st={e.mine} /><StatCell st={e.pooled} /></tr>)}</tbody>
              </table>
              <p className={s.expl}>
                Дүрэм тогтмол: SL ≥ {d.params.slMin} ATR(M5), TP1 = 1R (50%) дараа нь SL орох цэг рүү, TP2 = 2R, {d.params.maxBars} мин цагийн зогсоолт, нэг лаанд SL ба TP хоёулаа бол SL. 30-аас доош тохиолдол санамсаргүй байж болно — тэр үед ижил төрлийн нийлбэрийг ашиглана. Сөрөг загварыг систем өөрөө унтраана.
                {d.edgeUpdated ? ` Хэмжсэн: УБ ${hm(d.edgeUpdated)}.` : ""}
              </p>
            </div>

            {d.news.length > 0 && (
              <div className={s.card}>
                <h3>Ойрын мэдээ <small>{d.sym}-д нөлөөлөх</small></h3>
                <ul className={s.news}>{d.news.map((e) => <li key={e.t + e.title} data-i={e.impact}><span>{hm(e.t)}</span><b>{e.ccy}</b><p>{e.title}{e.forecast ? <small> · таамаг {e.forecast} · өмнөх {e.previous}</small> : null}</p><em>{inMin(e.t, now)}</em></li>)}</ul>
              </div>
            )}

            <details className={s.card}>
              <summary>Яагаад ингэж ажилладаг вэ? — 10 аксиом</summary>
              <ol className={s.ax}>
                <li><b>Зардал эхний дайсан.</b> SL ≥ 5× spread, spread ≤ SL-ийн 0.2R. Үгүй бол хожих ч алдагдал.</li>
                <li><b>Хөрвөх чадвартай цагт л.</b> London 08:00 → NY 12:00 (JPY/AUD/NZD-д Токио). Rollover, баасан орой, мэдээний ±15 мин = 0 арилжаа.</li>
                <li><b>Эхлээд горим.</b> Тренд, хүрээ, эмх замбараагүй, үхмэл — горимд таарсан загвар л ажиллана.</li>
                <li><b>Том хугацаа чиглэл.</b> M15 чиглэл · M5 загвар · M1 гох.</li>
                <li><b>Байршил &gt; дохио.</b> Үнэ цэнийн бүсэд орно (EMA20, VWAP, хүрээний зах), дундуур нь хөөцөлдөхгүй.</li>
                <li><b>Индикатор нотолгоо биш.</b> 100 индикатор нэг үнээс гардаг — гэр бүлээр нь нэг удаа тоолно.</li>
                <li><b>Макро шүүлтүүр.</b> Доллартой хос, алтанд DXY эсрэг хүчтэй бол орохгүй.</li>
                <li><b>Давуу тал хэмжилт.</b> Итгэл биш — 28 хоногийн бодит дата дээр spread хассан R. Сөрөг бол унтарна.</li>
                <li><b>Эрсдэл тогтмол.</b> 1R = данс×0.25–1%. Өдөр −3R эсвэл дараалсан 3 алдагдал = зогс.</li>
                <li><b>Цаг бол эрсдэл.</b> {d.params.maxBars} минутад TP1 хүрэхгүй скальп = буруу санаа, гар.</li>
              </ol>
            </details>
          </>
        )}
      </section>
    </div>
  );
}
