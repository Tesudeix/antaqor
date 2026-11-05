"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { signOut } from "next-auth/react";
import s from "./gold.module.css";

/* ─── TESLA TRADER v5 · XAU/USD (2026-11-05) ─────────────────────────────────
   Зөвхөн алт. Нүүр дээр хоёр зам: «ШИНЖЛЭХ» (бодит 1 мин дата) эсвэл графикийн зураг (AI уншаад
   ЯГ ТЭР бодит шинжилгээтэй тулгана). Шийдвэр: 86 онцлог → сигнал/шуугиан шүүлт → walk-forward-оор
   шалгасан модель (lib/gold/*). Давуу тал батлагдаагүй бол ХҮЛЭЭХ — хандлага, магадлалыг ил харуулна. */

type Gate = { key: string; label: string; ok: boolean; warn?: boolean; text: string };
type Ev = { n: number; ic: number | null; signals: number; hit: number | null; trades: number; tp1: number; win: number; exp: number | null; se: number | null; totalR: number; maxDD: number };
type Plan = { entry: number; sl: number; tp1: number; tp2: number; risk: number; rr2: number; costR: number };
export type A = {
  now: number; price: { bid: number; ask: number; spread: number }; barT: number; age: number; session: string; sessionMn: string;
  regime: { kind: string; adx: number; er: number; atrPct: number; chop: number; hurst: number }; gates: Gate[];
  decision: "BUY" | "SELL" | "WAIT"; reason: string; score: number; thr: number; pUp: number; dirNote: string; horizon: number; plan: Plan | null;
  vol: null | { range: number; hi80: number; noiseStop: number; r2: number; n: number; mape: number; touch: { d: number; p: number }[] };
  drivers: { key: string; fam: string; mn: string; z: number; w: number; c: number }[];
  levels: { k: string; label: string; p: number; dist: number }[]; famCount: { fam: string; mn: string; total: number; picked: number }[]; atr5: number;
  model: null | { fittedAt: number; from: number; to: number; samples: number; folds: number; wfFrom: number; on: [boolean, boolean]; wf: [Ev, Ev]; total: number;
    sel: { key: string; mn: string; fam: string; ic: number }[][]; thr: number[]; calib: { lo: number; hi: number; n: number; pUp: number }[]; recent: { t: number; dir: number; r: number; regime: number }[]; noise: number };
  training: boolean; news: { t: number; ccy: string; title: string; impact: string; forecast: string; previous: string }[];
  chart: { bars: [number, number, number, number, number][]; e20: number[]; e50: number[]; vwap: number[] };
  /** 5 SCAN (v6): дараагийн 30 минутын 80%-ийн таамгийн бүс — чартын баруун захад зурна */
  band?: { lo: number; hi: number };
  image?: string; overlay?: { a: number; b: number } | null; warnings?: string[];
  read?: { symbol: string; timeframe: string; lastPrice: number | null; structure: string; patterns: string[]; notes: string; quality: number };
};

const f2 = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : "—");
const sg = (n: number) => (n > 0 ? "+" : "");
const ub = (t: number, sec = false) => new Date(t).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit", ...(sec ? { second: "2-digit" } : {}), hour12: false, timeZone: "Asia/Ulaanbaatar" });
const ubDate = (t: number) => new Date(t).toLocaleDateString("mn-MN", { month: "2-digit", day: "2-digit", timeZone: "Asia/Ulaanbaatar" });
const inMin = (t: number, now: number) => { const m = Math.round((t - now) / 60000); return m <= 0 ? (m > -15 ? "яг одоо" : `${-m} мин өмнө`) : m < 60 ? `${m} мин` : `${Math.floor(m / 60)} ц ${m % 60} мин`; };
function load<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } }
function save(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* хувийн горим */ } }
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file), k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size < 1.5e6) return file;
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b || file), "image/jpeg", 0.9));
  } catch { return file; }
}
const DEC = { BUY: "BUY · АВАХ", SELL: "SELL · ЗАРАХ", WAIT: "ХҮЛЭЭХ" };
const STEPS = ["Бодит алтны ханш татаж байна", "86 онцлогийг 6 хугацаанд тооцож байна", "Сигналыг шуугианаас ялгаж байна", "Шалгагдсан моделиор шийдвэр гаргаж байна"];

/* ── онооны хэмжүүр: −3σ … +3σ, ±босго ── */
function Meter({ score, thr, pUp, horizon, note }: { score: number; thr: number; pUp: number; horizon: number; note: string }) {
  const x = (v: number) => `${((Math.max(-3, Math.min(3, v)) + 3) / 6) * 100}%`, t = Math.min(3, thr);
  return (
    <div className={s.meter}>
      <div className={s.mTrack}>
        <i className={s.mNoise} style={{ left: x(-t), width: `calc(${x(t)} - ${x(-t)})` }} />
        <i className={s.mMid} />
        <b className={s.mDot} style={{ left: x(score) }} data-up={score > 0 || undefined} />
      </div>
      <div className={s.mLbl}><span>Буурах −3σ</span><span>шуугиан ±{thr > 9 ? "—" : thr}σ</span><span>Өсөх +3σ</span></div>
      <p className={s.mTxt}>Оноо <b>{sg(score)}{score.toFixed(2)}σ</b> · Дараагийн {horizon} минутад өсөх магадлал <b>{pUp}%</b>, буурах <b>{(100 - pUp).toFixed(1)}%</b> <span>(сургалтад ороогүй датагаар тохируулсан)</span></p>
      {note && <p className={s.mNote}>{note}</p>}
    </div>
  );
}

/* ── M5 чарт: 8 цаг, EMA20/50, VWAP, түлхүүр түвшин, дохионы түвшин ── */
export function Chart({ a }: { a: A }) {
  /* SVG-г савны жинхэнэ өргөнөөр зурна — сунгахгүй тул утсан дээр текст шахагдахгүй */
  const box = useRef<HTMLDivElement>(null), [W, setW] = useState(760);
  useEffect(() => {
    if (!box.current) return;
    const o = new ResizeObserver((e) => setW(Math.max(280, Math.round(e[0].contentRect.width))));
    o.observe(box.current);
    return () => o.disconnect();
  }, []);
  const H = W < 520 ? 260 : 320, R = 62, take = W < 520 ? 54 : a.chart.bars.length, cut = Math.max(0, a.chart.bars.length - take);
  const bars = a.chart.bars.slice(cut), e20 = a.chart.e20.slice(cut), e50 = a.chart.e50.slice(cut), vwap = a.chart.vwap.slice(cut), n = bars.length;
  const plan = a.plan, lv = plan ? [plan.sl, plan.tp1, plan.tp2, plan.entry] : [];
  const bandV = a.band ? [a.band.lo, a.band.hi] : [];
  let lo = Math.min(...bars.map((b) => b[3]), ...lv, ...bandV), hi = Math.max(...bars.map((b) => b[2]), ...lv, ...bandV);
  const pad = (hi - lo) * 0.06 || 1; lo -= pad; hi += pad;
  const key = a.levels.filter((l) => l.p > lo && l.p < hi);
  const x = (k: number) => ((k + 0.5) * (W - R)) / n, y = (p: number) => ((hi - p) / (hi - lo)) * H, cw = Math.max(1.5, ((W - R) / n) * 0.62);
  const path = (v: number[]) => v.map((p, k) => (Number.isFinite(p) && p > lo && p < hi ? `${k && Number.isFinite(v[k - 1]) && v[k - 1] > lo && v[k - 1] < hi ? "L" : "M"}${x(k).toFixed(1)},${y(p).toFixed(1)}` : "")).join("");
  const last = bars[n - 1]?.[4];
  return (
    <figure className={s.chart}>
      <figcaption><b>XAU/USD · M5</b> · сүүлийн {Math.round(n / 12)} цаг <span><i data-k="e20" />EMA20 <i data-k="e50" />EMA50 <i data-k="vwap" />VWAP</span></figcaption>
      <div ref={box}><svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Алтны 5 минутын график">
        {Array.from({ length: 5 }, (_, k) => lo + ((hi - lo) * (k + 0.5)) / 5).map((p) => <g key={p}><line x1={0} x2={W - R} y1={y(p)} y2={y(p)} className={s.gl} /><text x={W - R + 6} y={y(p) + 4} className={s.ax}>{f2(p)}</text></g>)}
        {key.map((l) => <g key={l.k} className={s.key}><line x1={0} x2={W - R} y1={y(l.p)} y2={y(l.p)} /><text x={W - R - 4} y={y(l.p) - 3} textAnchor="end">{l.label}</text></g>)}
        {plan && <rect x={0} width={W - R} y={Math.min(y(plan.entry), y(plan.tp2))} height={Math.abs(y(plan.tp2) - y(plan.entry))} className={s.winZ} />}
        {plan && <rect x={0} width={W - R} y={Math.min(y(plan.entry), y(plan.sl))} height={Math.abs(y(plan.sl) - y(plan.entry))} className={s.lossZ} />}
        <path d={path(vwap)} className={s.lV} /><path d={path(e50)} className={s.l50} /><path d={path(e20)} className={s.l20} />
        {bars.map((b, k) => <g key={b[0]} className={b[4] >= b[1] ? s.up : s.dn}><line x1={x(k)} x2={x(k)} y1={y(b[2])} y2={y(b[3])} /><rect x={x(k) - cw / 2} width={cw} y={y(Math.max(b[1], b[4]))} height={Math.max(1, Math.abs(y(b[1]) - y(b[4])))} /></g>)}
        {plan && [["TP2", plan.tp2, "tp"], ["TP1", plan.tp1, "tp"], ["ENTRY", plan.entry, "en"], ["SL", plan.sl, "sl"]].map(([t, p, k]) => <g key={t as string} className={s.pl} data-k={k}><line x1={0} x2={W - R} y1={y(p as number)} y2={y(p as number)} /><text x={6} y={y(p as number) - 4}>{t} {f2(p as number)}</text></g>)}
        {a.band && last !== undefined && <polygon className={s.cone} points={`${x(n - 1)},${y(last)} ${W - R},${y(a.band.hi)} ${W - R},${y(a.band.lo)}`} />}
        {last !== undefined && <g className={s.now}><rect x={W - R + 1} y={y(last) - 9} width={R - 2} height={18} rx={3} /><text x={W - R + 6} y={y(last) + 4}>{f2(last)}</text></g>}
      </svg></div>
    </figure>
  );
}

export function Shot({ a }: { a: A }) {
  const o = a.overlay, pts = a.plan ? [{ k: "tp", t: "TP2", p: a.plan.tp2 }, { k: "tp", t: "TP1", p: a.plan.tp1 }, { k: "en", t: "ENTRY", p: a.plan.entry }, { k: "sl", t: "SL", p: a.plan.sl }]
    : a.levels.filter((l) => !l.k.startsWith("r")).map((l) => ({ k: "key", t: l.label, p: l.p }));
  const lines = o ? pts.map((q) => ({ ...q, y: (o.a * q.p + o.b) * 100 })).filter((q) => q.y > 1 && q.y < 99) : [];
  return (
    <figure className={s.shot}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={a.image} alt="Таны график" />
      {lines.map((q) => <div key={q.t + q.p} className={s.shLine} data-k={q.k} style={{ top: `${q.y}%` }}><span>{q.t} {f2(q.p)}</span></div>)}
      {!o && <figcaption>Үнийн тэнхлэг найдвартай уншигдсангүй — түвшинг зураг дээр давхарлаагүй.</figcaption>}
    </figure>
  );
}

export default function GoldApp() {
  const [a, setA] = useState<A | null>(null);
  const [busy, setBusy] = useState<"" | "live" | "image">("");
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const [px, setPx] = useState<{ bid: number; ask: number; spread: number } | null>(null);
  const [prev, setPrev] = useState(0);
  const [drag, setDrag] = useState(false);
  const [bal, setBal] = useState(1000);
  const [risk, setRisk] = useState(1);
  const [allDrivers, setAllDrivers] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const result = useRef<HTMLDivElement>(null);

  useEffect(() => { setBal(load("tg.bal", 1000)); setRisk(load("tg.risk", 1)); }, []);
  useEffect(() => { save("tg.bal", bal); save("tg.risk", risk); }, [bal, risk]);
  /* дээд мөрийн тикер — 5 с */
  const lastMid = useRef(0);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (document.hidden) return;
      try {
        const r = await fetch("/api/trader-agent/gold?q=price", { cache: "no-store" }), d = await r.json();
        if (alive && r.ok && d?.bid) { setPrev(lastMid.current); lastMid.current = (d.bid + d.ask) / 2; setPx(d); }
      } catch { /* дараагийн удаа */ }
    };
    tick(); const t = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const run = useCallback(async (img?: File) => {
    if (busy) return;
    setBusy(img ? "image" : "live"); setErr(""); setStep(0);
    const iv = setInterval(() => setStep((x) => Math.min(STEPS.length - 1, x + 1)), img ? 2600 : 700);
    try {
      let r: Response;
      if (img) { const fd = new FormData(); fd.append("image", await shrink(img), "chart.jpg"); r = await fetch("/api/trader-agent/gold", { method: "POST", body: fd }); }
      else r = await fetch("/api/trader-agent/gold", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `Алдаа (${r.status})`);
      setA(d);
      setTimeout(() => result.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    } catch (e) { setErr((e as Error).message); } finally { clearInterval(iv); setBusy(""); }
  }, [busy]);
  const pick = (f?: File | null) => { if (f && f.type.startsWith("image/")) run(f); };
  useEffect(() => {
    const h = (e: ClipboardEvent) => { const f = Array.from(e.clipboardData?.files || []).find((x) => x.type.startsWith("image/")); if (f) pick(f); };
    window.addEventListener("paste", h); return () => window.removeEventListener("paste", h);
  });
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); };

  const lot = useMemo(() => {
    if (!a?.plan) return null;
    const usd = (bal * risk) / 100, perLot = a.plan.risk * 100;
    return { usd, lots: Math.floor((usd / perLot) * 100) / 100, perLot };
  }, [a, bal, risk]);
  const copy = () => {
    if (!a?.plan) return;
    navigator.clipboard?.writeText(`TESLA TRADER · XAU/USD\n${a.decision} @ ${f2(a.plan.entry)}\nSL ${f2(a.plan.sl)} · TP1 ${f2(a.plan.tp1)} (50%) · TP2 ${f2(a.plan.tp2)}\nОноо ${sg(a.score)}${a.score}σ · ${a.horizon} мин`).catch(() => {});
  };
  const mid = px ? (px.bid + px.ask) / 2 : a ? (a.price.bid + a.price.ask) / 2 : 0;
  const rg = a ? (a.regime.kind === "trend" ? 1 : 0) : 0, M = a?.model;
  const drivers = a ? (allDrivers ? a.drivers : a.drivers.slice(0, 6)) : [];
  const maxC = Math.max(0.001, ...(a?.drivers || []).map((d) => Math.abs(d.c)));

  return (
    <div className={s.app} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop} data-drag={drag || undefined}>
      <header className={s.top}>
        <div className={s.brand}><span className={s.mark}>T</span><div><b>TESLA TRADER</b><em>XAU/USD · SPOT</em></div></div>
        <div className={s.tick}>
          <b data-up={prev && mid > prev ? true : undefined} data-dn={prev && mid < prev ? true : undefined}>{mid ? f2(mid) : "—"}</b>
          <span>{px ? `${f2(px.bid)} / ${f2(px.ask)} · $${f2(px.spread)}` : "ханш ачаалж байна"}</span>
        </div>
        <button type="button" className={s.out} onClick={() => signOut({ callbackUrl: `${window.location.origin}/` })}>Гарах</button>
      </header>

      <main className={s.main}>
        <section className={s.hero}>
          <p className={s.kicker}>АЛТ · БОДИТ ЦАГ</p>
          <h1>{mid ? `$${f2(mid)}` : "XAU/USD"}</h1>
          <p className={s.sub}>Нэг товч: бодит 1 минутын алтны дата → 6 хугацааны 86 онцлог → сигналыг шуугианаас ялгаж, сургалтад ороогүй датагаар шалгасан модель шийдвэр гаргана.</p>
          <div className={s.cta}>
            <button type="button" className={s.go} onClick={() => run()} disabled={!!busy}>{busy === "live" ? <><i className={s.spin} />Шинжилж байна</> : <>⚡ ШИНЖЛЭХ</>}</button>
            <button type="button" className={s.img} onClick={() => file.current?.click()} disabled={!!busy}>{busy === "image" ? <><i className={s.spin} />Зураг уншиж байна</> : "Графикийн зураг оруулах"}</button>
            <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
          <p className={s.hint}>Зургийг чирж тавих эсвэл Ctrl+V-ээр буулгаж болно. Шийдвэрийг зураг биш, бодит ханш гаргана — зураг дээр түвшинг давхарлана.</p>
          {busy && <ol className={s.steps}>{STEPS.map((t, i) => <li key={t} data-s={i < step ? "done" : i === step ? "on" : ""}><i />{t}</li>)}</ol>}
          {err && <p className={s.err}>{err}</p>}
        </section>

        {a && (
          <div className={s.result} ref={result}>
            <section className={s.dec} data-d={a.decision}>
              <div className={s.decTop}>
                <div>
                  <span className={s.meta}>{ub(a.barT)} M5 хаалт · {a.sessionMn} · {a.regime.kind === "trend" ? "Тренд горим" : "Хүрээ / холимог горим"}</span>
                  <b className={s.decTxt}>{DEC[a.decision]}</b>
                </div>
                {M && <span className={s.chip} data-on={M.on[rg] || undefined}>{M.on[rg] ? "Давуу тал батлагдсан" : "Давуу тал батлагдаагүй"}</span>}
              </div>
              <p className={s.reason}>{a.reason}</p>
              {a.training && !M && <p className={s.dim}>Модель анх удаа 4 сарын датагаар сургагдаж байна — 1 минутын дараа дахин дарна уу.</p>}
              <Meter score={a.score} thr={a.thr} pUp={a.pUp} horizon={a.horizon} note={a.dirNote} />
              {a.plan && (
                <>
                  <div className={s.lv}>
                    <div><span>Entry</span><b>{f2(a.plan.entry)}</b></div>
                    <div data-k="sl"><span>Stop</span><b>{f2(a.plan.sl)}</b><em>${f2(a.plan.risk)} · −1R</em></div>
                    <div data-k="tp"><span>TP1 · 50%</span><b>{f2(a.plan.tp1)}</b><em>+1R</em></div>
                    <div data-k="tp"><span>TP2</span><b>{f2(a.plan.tp2)}</b><em>+2R</em></div>
                  </div>
                  <div className={s.calc}>
                    <label><span>Данс $</span><input type="number" min={10} step={10} value={bal} onChange={(e) => setBal(Math.max(0, Number(e.target.value) || 0))} /></label>
                    <div className={s.rc}>{[0.25, 0.5, 1].map((v) => <button key={v} type="button" aria-pressed={risk === v} onClick={() => setRisk(v)}>{v}%</button>)}</div>
                    <div className={s.lot}><b>{lot ? lot.lots.toFixed(2) : "—"}</b><span>лот</span></div>
                    <p>{lot && <>Эрсдэл ${lot.usd.toFixed(2)} · 0.01 лот = ${(lot.perLot * 0.01).toFixed(2)}{lot.lots < 0.01 ? " — данс энэ SL-д хэт жижиг, алгас" : ""} · {a.horizon * 1.5} мин цагийн зогсоолт</>}</p>
                  </div>
                  <button type="button" className={s.copy} onClick={copy}>Сигнал хуулах</button>
                </>
              )}
            </section>

            {a.vol && (
              <section className={s.vol}>
                <div className={s.volTop}>
                  <div><span>Дараагийн {a.horizon} минутын хүлээгдэх хүрээ</span><b>${f2(a.vol.range)}</b><em>80% тохиолдолд ≤ ${f2(a.vol.hi80)}</em></div>
                  <div><span>Шуугианаас зайлсхих SL</span><b>≥ ${f2(a.vol.noiseStop)}</b><em>{a.horizon} минутад ≈25% л хүрнэ</em></div>
                </div>
                <table className={s.touch}>
                  <thead><tr><th>Зай (SL эсвэл TP)</th>{a.vol.touch.map((t) => <th key={t.d}>${t.d}</th>)}</tr></thead>
                  <tbody><tr><th>{a.horizon} минутад хүрэх магадлал</th>{a.vol.touch.map((t) => <td key={t.d}>{t.p}%</td>)}</tr></tbody>
                </table>
                <p className={s.expl}>Алтанд чиглэлээс хамаагүй сайн таамаглагддаг зүйл бол <b>хэлбэлзэл</b>. Сургалтад ороогүй {a.vol.n.toLocaleString("en-US")} таамаг дээр R² = {a.vol.r2}, дундаж алдаа {a.vol.mape}%. Хүснэгт нэг талын зайд хүрэх магадлал — чиглэл таахгүй, SL/TP-ийн хэмжээг шийдэхэд хэрэглэнэ.</p>
              </section>
            )}

            {a.image && (
              <section className={s.card}>
                <h3>Таны зураг <small>{a.read?.timeframe ? `${a.read.timeframe} · ` : ""}AI уншилт + бодит түвшин</small></h3>
                <Shot a={a} />
                {!!a.warnings?.length && <ul className={s.warn}>{a.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
                {a.read?.structure && <p className={s.note}>{a.read.structure}</p>}
                {!!a.read?.patterns?.length && <div className={s.tags}>{a.read.patterns.map((p) => <em key={p}>{p}</em>)}</div>}
              </section>
            )}

            <Chart a={a} />

            <div className={s.grid}>
              <section className={s.card}>
                <h3>Сигнал ба шуугиан <small>{M ? `${M.total} онцлог → энэ горимд ${M.sel[rg].length} сигнал · ${M.noise} нь шуугиан гэж хасагдсан` : ""}</small></h3>
                {drivers.length ? (
                  <ul className={s.drv}>
                    {drivers.map((d) => (
                      <li key={d.key}>
                        <span>{d.mn}<small>z {sg(d.z)}{d.z}</small></span>
                        <div className={s.bar}><u style={{ [d.c >= 0 ? "left" : "right"]: "50%", width: `${(Math.abs(d.c) / maxC) * 50}%` }} data-up={d.c >= 0 || undefined} /></div>
                        <b data-up={d.c > 0 || undefined} data-dn={d.c < 0 || undefined}>{d.c > 0 ? "▲" : "▼"}</b>
                      </li>
                    ))}
                  </ul>
                ) : <p className={s.dim}>Энэ горимд тогтвортой сигнал алга.</p>}
                {a.drivers.length > 6 && <button type="button" className={s.more} onClick={() => setAllDrivers((v) => !v)}>{allDrivers ? "Хураах" : "Бүгдийг харах"}</button>}
                <table className={s.fam}><tbody>{a.famCount.map((f) => <tr key={f.fam}><th>{f.mn}</th><td><i style={{ width: `${(f.picked / Math.max(1, f.total)) * 100}%` }} /></td><td>{f.picked}/{f.total}</td></tr>)}</tbody></table>
                <p className={s.expl}>Онцлог бүрийн ирээдүйн 30 минуттай хамаарлыг (IC) сургалтын датаг хоёр хувааж хэмжинэ. Хоёуланд нь ижил тэмдэгтэй, хангалттай хүчтэй бол л «сигнал». Хоорондоо 55%-иас илүү төстэй онцлогуудын зөвхөн хамгийн хүчтэйг нь үлдээнэ — нэг мэдээллийг хоёр удаа тоолохгүй.</p>
              </section>

              <section className={s.card}>
                <h3>Модель шалгалт <small>walk-forward · spread хассан</small></h3>
                {M ? (
                  <>
                    <table className={s.wf}>
                      <thead><tr><th /><th>Арилжаа</th><th>Чиглэл зөв</th><th>Дундаж</th><th>Нийт</th></tr></thead>
                      <tbody>{[1, 0].map((r) => { const e = M.wf[r]; return (
                        <tr key={r} data-cur={r === rg || undefined}><th>{r ? "Тренд" : "Хүрээ"} <em data-on={M.on[r] || undefined}>{M.on[r] ? "ON" : "OFF"}</em></th><td>{e.trades}</td><td>{e.hit ?? "—"}%</td><td data-up={(e.exp ?? 0) > 0 || undefined} data-dn={(e.exp ?? 0) < 0 || undefined}>{sg(e.exp ?? 0)}{f2(e.exp)}R<small>±{f2(e.se)}</small></td><td>{sg(e.totalR)}{e.totalR}R</td></tr>
                      ); })}</tbody>
                    </table>
                    <div className={s.dots} aria-label="Сүүлийн шалгалтын арилжаанууд">{M.recent.slice().reverse().map((t) => <i key={t.t} data-w={t.r > 0 || undefined} title={`${ubDate(t.t)} ${t.dir > 0 ? "BUY" : "SELL"} ${sg(t.r)}${t.r}R`} />)}</div>
                    <table className={s.cal}><thead><tr><th>Оноо</th>{M.calib.map((b) => <th key={b.lo}>{b.lo <= -9 ? `< ${b.hi}` : b.hi >= 9 ? `> ${b.lo}` : `${b.lo}…${b.hi}`}</th>)}</tr></thead>
                      <tbody><tr><th>Өссөн</th>{M.calib.map((b) => <td key={b.lo} data-up={b.pUp > 52 || undefined} data-dn={b.pUp < 48 || undefined}>{b.pUp}%</td>)}</tr><tr><th>n</th>{M.calib.map((b) => <td key={b.lo}>{b.n}</td>)}</tr></tbody></table>
                    <p className={s.expl}>{ubDate(M.from)}–{ubDate(M.to)}-ны {M.samples.toLocaleString("en-US")} дээж. {ubDate(M.wfFrom)}-аас хойш {M.folds} удаа зөвхөн өмнөх датагаар дахин сургаж, дараагийн 14 хоногийг таасан — энэ хүснэгт бүхэлдээ сургалтад ороогүй дата. ±-тэй тоо стандарт алдаа. Сүүлд {ub(M.fittedAt)}-д сургасан, 12 цаг тутам шинэчлэгдэнэ.</p>
                  </>
                ) : <p className={s.dim}>Модель сургагдаж байна…</p>}
              </section>

              <section className={s.card}>
                <h3>Шүүлтүүр <small>нэг нь ч ✗ бол арилжаа хийхгүй</small></h3>
                <ul className={s.gates}>{a.gates.map((g) => <li key={g.key} data-s={!g.ok ? "bad" : g.warn ? "warn" : "ok"}><i>{!g.ok ? "✗" : g.warn ? "!" : "✓"}</i><div><b>{g.label}</b><span>{g.text}</span></div></li>)}</ul>
                <div className={s.kv}>
                  <span>ADX · ER</span><b>{a.regime.adx} · {a.regime.er}</b>
                  <span>Choppiness</span><b>{a.regime.chop}</b>
                  <span>Hurst (M1)</span><b>{a.regime.hurst}</b>
                  <span>ATR (M5)</span><b>${f2(a.atr5)} · {a.regime.atrPct}%</b>
                </div>
              </section>

              <section className={s.card}>
                <h3>Түлхүүр түвшин <small>одоогийн үнээс зай</small></h3>
                <ul className={s.lvl}>{a.levels.map((l) => <li key={l.k}><span>{l.label}</span><b>{f2(l.p)}</b><em data-up={l.dist > 0 || undefined} data-dn={l.dist < 0 || undefined}>{sg(l.dist)}{f2(l.dist)}</em></li>)}</ul>
                {a.news.length > 0 && (
                  <>
                    <h4>USD мэдээ</h4>
                    <ul className={s.news}>{a.news.map((e) => <li key={e.t + e.title} data-i={e.impact}><span>{ub(e.t)}</span><p>{e.title}{e.forecast ? <small> · таамаг {e.forecast}</small> : null}</p><em>{inMin(e.t, a.now)}</em></li>)}</ul>
                  </>
                )}
              </section>
            </div>
            <button type="button" className={s.again} onClick={() => run()} disabled={!!busy}>{busy ? "…" : "⚡ Дахин шинжлэх"}</button>
          </div>
        )}

        <p className={s.disc}>Tesla Trader нь техник шинжилгээ, сургалтын хэрэгсэл — <b>санхүүгийн зөвлөгөө биш</b>. Магадлал ба давуу талын тоо нь өнгөрсөн датан дээрх хэмжилт, ирээдүйг баталгаажуулахгүй. Ханш: Dukascopy (спот XAU/USD), spread: Swissquote — брокерынхоос бага зөрж болно. Нэг арилжаанд дансныхаа 1%-иас илүүг бүү эрсдэлд оруул.</p>
      </main>
    </div>
  );
}
