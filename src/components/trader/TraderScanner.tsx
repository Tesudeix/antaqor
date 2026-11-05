"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import s from "./trader.module.css";

/* ─── TESLA TRADER · AI CHART SCANNER (v2 2026-10-25, v3 2026-11-01) ────────
   v3: шинэ нэр, хар + neon ногоон, үнэгүй (кредитгүй), толгойн hero хасагдсан, trader.antaqor.com дээр сайтын цэсгүй тул
   өөрийн дээд мөр (desktop) ба доод цэс (утас): Скан · Түүх · AI чат · Гарах.
   Зүүн: сканнер → үр дүн (зурган дээр Entry/SL/TP шугам, түүхэн тохиолдол) → түүх.
   Баруун (утсан дээр доороос): Tesla Trader AI туслах — скан дээр эсвэл ерөнхий асуулт, санах ойгоос
   хариулж, чатаас суралцана (lib/traderLearn.ts). Итгэлцэл = тохирол × бодит түүхэн статистик.
   v4 (2026-11-04): чат бүрэн хасагдсан (эзний шийдвэр); TraderApp-ийн «Зураг» таб дотор embedded байдлаар л харагдана. */

type Factor = { key: string; label: string; value: number; text: string };
type Levels = { entry: number; sl: number; tp1: number; tp2: number; risk: number; rr1: number; rr2: number; slPips: number; tp1Pips: number; tp2Pips: number; limit: number | null };
type Hist = { n: number; win: number; loss: number; winRate: number; avgR: number; live: number };
type Scan = {
  _id: string; image: string; symbol: string; tf: string; kind: string; createdAt: string;
  read: { patterns?: string[]; quality?: number };
  snap: { price: number; rsi: number; atr: number } | null;
  decision: { dir: "BUY" | "SELL" | "WAIT"; confidence: number; grade: string; factors: Factor[] };
  levels: Levels | null; text: { summary?: string; reasons?: string[]; invalidation?: string; plan?: string; risk?: string };
  warnings: string[]; quoteUsd: number; contract: number; pip: number; digits: number;
  outcome: { status: string; r?: number }; hist?: Hist | null; overlay?: { a: number; b: number } | null; feedback?: { vote: string } | null;
};

const PAIRS = ["", "EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "GBPJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD", "EURJPY", "EURGBP", "US30", "NAS100", "US500", "BTCUSD", "ETHUSD", "USOIL"];
const TFS = ["", "M5", "M15", "M30", "H1", "H4", "D1"];
const STEPS = ["Зургийг уншиж байна", "Хос, хугацааг таньж байна", "Бодит ханш татаж байна", "EMA · RSI · ATR тооцож байна", "Түүхэн тохиолдол хайж байна", "SL / TP тооцож байна"];
const OUT: Record<string, [string, string]> = {
  open: ["Нээлттэй", "open"], pending: ["Limit хүлээж буй", "open"], tp1: ["TP1 ✓", "win"], tp2: ["TP2 ✓", "win"],
  sl: ["SL ✗", "loss"], expired: ["Хугацаа дууссан", "muted"], nofill: ["Орох цэгт хүрээгүй", "muted"], na: ["Арилжаагүй", "muted"],
};
const DIR_MN = { BUY: "BUY · АВАХ", SELL: "SELL · ЗАРАХ", WAIT: "ХҮЛЭЭХ" };

const fx = (n: number | null | undefined, d = 5) => (typeof n === "number" && Number.isFinite(n) ? n.toFixed(d) : "—");
const ago = (d: string) => { const m = Math.round((Date.now() - new Date(d).getTime()) / 60000); return m < 60 ? `${Math.max(1, m)} мин` : m < 1440 ? `${Math.round(m / 60)} цаг` : `${Math.round(m / 1440)} өдөр`; };
function load<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } }
function save(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* хувийн горим */ } }
/** Утасны 8–12MB screenshot-ыг ≤1800px JPEG болгоно — хуулах хугацаа 5–10 дахин багасна */
async function shrink(f: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    if (k === 1 && f.size < 1.5e6) return f;
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b || f), "image/jpeg", 0.9));
  } catch { return f; }
}

function Ring({ value, dir }: { value: number; dir: string }) {
  const r = 44, c = 2 * Math.PI * r, k = Math.max(0, Math.min(100, value)) / 100;
  return (
    <svg viewBox="0 0 100 100" className={s.ring} aria-label={`Итгэлцэл ${value}%`}>
      <circle cx="50" cy="50" r={r} className={s.ringBg} />
      <circle cx="50" cy="50" r={r} className={s.ringFg} data-dir={dir} strokeDasharray={c} strokeDashoffset={c * (1 - k)} />
      <text x="50" y="50" className={s.ringNum}>{dir === "WAIT" ? "—" : `${value}%`}</text>
      <text x="50" y="66" className={s.ringLbl}>итгэлцэл</text>
    </svg>
  );
}

/** Зурган дээр Entry/SL/TP шугам — AI үнийн тэнхлэгийг найдвартай уншсан үед л.
    Зургийн хүрээнээс гарсан түвшинг ирмэгт нь сумтай харуулна (TP ихэвчлэн доор/дээр гардаг). */
function ChartOverlay({ x }: { x: Scan }) {
  const L = x.levels, o = x.overlay;
  const raw = L && o ? [
    { k: "tp2", label: "TP2", p: L.tp2 }, { k: "tp1", label: "TP1", p: L.tp1 },
    { k: "entry", label: L.limit ? "LIMIT" : "ENTRY", p: L.entry }, { k: "sl", label: "SL", p: L.sl },
  ].map((q) => ({ ...q, y: (o.a * q.p + o.b) * 100 })) : [];
  const entry = raw.find((q) => q.k === "entry");
  const ok = !!entry && entry.y > -5 && entry.y < 105;
  const lines = ok ? raw.map((q) => ({ ...q, off: q.y < 1 ? "up" : q.y > 99 ? "down" : "", yc: Math.max(1.5, Math.min(98.5, q.y)) })) : [];
  const zone = (a: number, b: number) => { const t = Math.max(0, Math.min(a, b)), btm = Math.min(100, Math.max(a, b)); return { top: `${t}%`, height: `${Math.max(0, btm - t)}%` }; };
  const yy = (k: string) => raw.find((q) => q.k === k)?.y ?? 0;
  return (
    <div className={s.overlay}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={x.image} alt="Шинжилсэн график" />
      {ok && (
        <>
          <div className={s.ovZone} data-k="win" style={zone(yy("entry"), yy("tp2"))} />
          <div className={s.ovZone} data-k="loss" style={zone(yy("entry"), yy("sl"))} />
          {lines.map((q) => (
            <div key={q.k} className={s.ovLine} data-k={q.k} data-off={q.off || undefined} style={{ top: `${q.yc}%` }}>
              <span>{q.off === "up" ? "↑ " : q.off === "down" ? "↓ " : ""}{q.label} {fx(q.p, x.digits)}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default function TraderScanner({ embedded = false }: { embedded?: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [pair, setPair] = useState("");
  const [tf, setTf] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const [cur, setCur] = useState<Scan | null>(null);
  const [scans, setScans] = useState<Scan[] | null>(null);
  const [drag, setDrag] = useState(false);
  const [bal, setBal] = useState(1000); const [riskPct, setRiskPct] = useState(1);
  const [copied, setCopied] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setBal(load("tt.bal", 1000)); setRiskPct(load("tt.risk", 1)); setPair(load("tt.pair", "")); setTf(load("tt.tf", "")); }, []);
  useEffect(() => { save("tt.bal", bal); save("tt.risk", riskPct); }, [bal, riskPct]);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/trader-agent", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Алдаа");
      setScans(d.scans);
      setCur((c) => (c ? (d.scans as Scan[]).find((x) => x._id === c._id) || c : c));
    } catch (e) { setScans([]); setErr((e as Error).message); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const pick = (f: File | null | undefined) => {
    if (!f || !f.type.startsWith("image/")) return;
    setFile(f); setErr(""); setCur(null);
    const u = URL.createObjectURL(f); setPreview((p) => { if (p) URL.revokeObjectURL(p); return u; });
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); };
  useEffect(() => {
    const h = (e: globalThis.ClipboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.("textarea, input")) return;
      const f = Array.from(e.clipboardData?.files || []).find((x) => x.type.startsWith("image/")); if (f) pick(f);
    };
    window.addEventListener("paste", h); return () => window.removeEventListener("paste", h);
  }, []);

  async function scan() {
    if (!file || busy) return;
    setBusy(true); setErr(""); setStep(0); setCur(null);
    const iv = setInterval(() => setStep((x) => Math.min(STEPS.length - 1, x + 1)), 3600);
    try {
      const fd = new FormData(); fd.append("image", await shrink(file), "chart.jpg"); if (pair) fd.append("symbol", pair); if (tf) fd.append("tf", tf);
      save("tt.pair", pair); save("tt.tf", tf);
      const r = await fetch("/api/trader-agent", { method: "POST", body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || `Алдаа (${r.status})`);
      setCur(d.scan as Scan);
      refresh();
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    } catch (e) { setErr((e as Error).message); } finally { clearInterval(iv); setBusy(false); }
  }
  async function del(id: string) {
    await fetch(`/api/trader-agent?id=${id}`, { method: "DELETE" }).catch(() => {});
    if (cur?._id === id) setCur(null);
    refresh();
  }
  async function vote(v: "up" | "down") {
    if (!cur) return;
    setCur({ ...cur, feedback: { vote: v } });
    await fetch("/api/trader-agent", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: cur._id, vote: v }) }).catch(() => {});
    refresh();
  }

  const x = cur;
  const lot = useMemo(() => {
    if (!x?.levels || !x.contract || !x.quoteUsd) return null;
    const riskUsd = (bal * riskPct) / 100, perLot = x.levels.risk * x.contract * x.quoteUsd;
    if (!perLot) return null;
    return { riskUsd, lots: Math.floor((riskUsd / perLot) * 100) / 100, tp1Usd: riskUsd * x.levels.rr1, tp2Usd: riskUsd * x.levels.rr2 };
  }, [x, bal, riskPct]);
  const copy = () => {
    if (!x) return;
    const L = x.levels, d = x.digits;
    const t = x.decision.dir === "WAIT" || !L
      ? `TESLA TRADER · ${x.symbol} ${x.tf}\nХҮЛЭЭХ — тодорхой давуу тал алга\n${x.text.plan || ""}`
      : `TESLA TRADER · ${x.symbol} ${x.tf}\n${x.decision.dir} ${L.limit ? "LIMIT" : "@"} ${fx(L.entry, d)}\nSL ${fx(L.sl, d)} (${L.slPips} pips)\nTP1 ${fx(L.tp1, d)} (${L.rr1}R)\nTP2 ${fx(L.tp2, d)} (${L.rr2}R)\nИтгэлцэл ${x.decision.confidence}% (${x.decision.grade})`;
    navigator.clipboard?.writeText(t).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); }).catch(() => {});
  };
  const reset = () => { setCur(null); setFile(null); setPreview(""); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return (
    <div className={`${s.root} ${embedded ? s.embed : ""}`}>
      <div className={s.shell}>
        <div className={s.main}>
          <section className={s.scanner}>
            <div className={s.drop} data-drag={drag || undefined} data-has={!!preview || undefined}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop} onClick={() => !busy && input.current?.click()}>
              {preview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={preview} alt="Таны график" />
                  {busy && <div className={s.scanFx} aria-hidden="true"><i className={s.scanLine} /><div className={s.scanGrid} /></div>}
                  {!busy && <span className={s.change}>Солих</span>}
                </>
              ) : (
                <div className={s.dropIn}>
                  <svg viewBox="0 0 48 48" width="44" height="44" aria-hidden="true"><path d="M6 38l10-12 8 7 9-14 9 11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M6 6v36h36" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
                  <b>Графикийн зургаа энд оруул</b>
                  <span>Дарж сонгох · чирж тавих · Ctrl+V · утасны screenshot</span>
                  <em>MT4/MT5, TradingView — үнийн тэнхлэг харагдаж байвал хамгийн сайн</em>
                </div>
              )}
              <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
            <div className={s.controls}>
              <label className={s.sel}><span>Хос</span>
                <select value={pair} onChange={(e) => setPair(e.target.value)} disabled={busy}>{PAIRS.map((p) => <option key={p} value={p}>{p || "Автоматаар таних"}</option>)}</select>
              </label>
              <div className={s.tfs} role="group" aria-label="Хугацаа">
                {TFS.map((t) => <button key={t || "auto"} type="button" aria-pressed={tf === t} onClick={() => setTf(t)} disabled={busy}>{t || "Авто"}</button>)}
              </div>
              <button type="button" className={s.scanBtn} onClick={scan} disabled={!file || busy}>
                {busy ? <><i className={s.spin} />Сканнердаж байна</> : <><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M4 12h16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>SCAN</>}
              </button>
            </div>
            {busy && <ol className={s.steps}>{STEPS.map((t, i) => <li key={t} data-s={i < step ? "done" : i === step ? "on" : ""}><i />{t}</li>)}</ol>}
            {err && <p className={s.err}>{err}</p>}
          </section>

          {x && (
            <section className={s.result} ref={resultRef}>
              <div className={s.signal} data-dir={x.decision.dir}>
                <div className={s.sigMain}>
                  <span className={s.sigMeta}>{x.symbol || "?"} · {x.tf} · {x.levels?.limit ? "LIMIT захиалга" : x.decision.dir === "WAIT" ? "Арилжаа хийхгүй" : "Market"}</span>
                  <b className={s.sigDir}>{DIR_MN[x.decision.dir]}</b>
                  <p>{x.text.summary}</p>
                </div>
                <div className={s.sigConf}><Ring value={x.decision.confidence} dir={x.decision.dir} />{x.decision.grade !== "—" && <span className={s.grade}>Зэрэглэл {x.decision.grade}</span>}</div>
              </div>

              <ChartOverlay x={x} />

              {x.levels && (
                <div className={s.levels}>
                  <div data-k="entry"><span>{x.levels.limit ? "Entry · LIMIT" : "Entry · одоо"}</span><b>{fx(x.levels.entry, x.digits)}</b><em>{x.levels.limit ? `Одоо ${fx(x.snap?.price, x.digits)} — буцалтыг хүлээ` : "Зах зээлийн үнээр"}</em></div>
                  <div data-k="sl"><span>Stop Loss</span><b>{fx(x.levels.sl, x.digits)}</b><em>{x.levels.slPips} pips · 1R</em></div>
                  <div data-k="tp"><span>Take Profit 1</span><b>{fx(x.levels.tp1, x.digits)}</b><em>{x.levels.tp1Pips} pips · {x.levels.rr1}R</em></div>
                  <div data-k="tp"><span>Take Profit 2</span><b>{fx(x.levels.tp2, x.digits)}</b><em>{x.levels.tp2Pips} pips · {x.levels.rr2}R</em></div>
                </div>
              )}

              {x.hist && x.hist.n >= 15 && (
                <div className={s.histCard} data-k={x.hist.avgR >= 0 ? "pos" : "neg"}>
                  <div className={s.histTop}><b>Түүхэн тохиолдол</b><span>{x.hist.n} ижил төстэй арилжаа{x.hist.live ? ` (${x.hist.live} нь бодит скан)` : ""}</span></div>
                  <div className={s.histBar}><u style={{ width: `${x.hist.winRate}%` }} /></div>
                  <p><b>{x.hist.winRate}%</b> нь TP-д түрүүлж хүрсэн · {x.hist.win} TP / {x.hist.loss} SL · дундаж <b>{x.hist.avgR > 0 ? "+" : ""}{x.hist.avgR}R</b> {x.hist.avgR >= 0 ? "— эерэг хүлээлт" : "— сөрөг хүлээлт, болгоомжтой"}</p>
                </div>
              )}

              {x.levels && (
                <div className={s.calc}>
                  <h3>Лотын хэмжээ</h3>
                  <div className={s.calcRow}>
                    <label><span>Данс ($)</span><input type="number" min={10} step={10} value={bal} onChange={(e) => setBal(Math.max(0, Number(e.target.value) || 0))} /></label>
                    <label><span>Эрсдэл (%)</span><div className={s.riskChips}>{[0.5, 1, 2].map((v) => <button key={v} type="button" aria-pressed={riskPct === v} onClick={() => setRiskPct(v)}>{v}%</button>)}</div></label>
                    <div className={s.lot}><span>Лот</span><b>{lot ? lot.lots.toFixed(2) : "—"}</b><em>{lot ? `Эрсдэл $${lot.riskUsd.toFixed(0)} · TP1 +$${lot.tp1Usd.toFixed(0)} · TP2 +$${lot.tp2Usd.toFixed(0)}` : "Энэ хосын лотын үнэ тооцогдсонгүй"}</em></div>
                  </div>
                  {lot && lot.lots < 0.01 && <p className={s.note}>Дансны хэмжээнд энэ SL хэт өргөн — 0.01 лотоос бага гарч байна. Алгасах эсвэл жижиг timeframe сонго.</p>}
                </div>
              )}

              <div className={s.grid2}>
                <div className={s.card}>
                  <h3>Тохирлын шалгалт</h3>
                  <ul className={s.factors}>
                    {x.decision.factors.map((f) => {
                      const sign = x.decision.dir === "BUY" ? 1 : x.decision.dir === "SELL" ? -1 : 0;
                      const ok = sign ? Math.sign(f.value) === sign && Math.abs(f.value) >= 0.2 : false;
                      const bad = sign ? Math.sign(f.value) === -sign && Math.abs(f.value) >= 0.2 : false;
                      return (
                        <li key={f.key} data-s={ok ? "ok" : bad ? "bad" : "mid"}>
                          <i>{ok ? "✓" : bad ? "✗" : "•"}</i>
                          <div><b>{f.label}</b><span>{f.text}</span></div>
                          <em className={s.bar}><u style={{ width: `${Math.min(100, Math.abs(f.value) * 100)}%` }} data-up={f.value >= 0 || undefined} /></em>
                        </li>
                      );
                    })}
                  </ul>
                  {x.snap && <p className={s.live}>Бодит ханш: <b>{fx(x.snap.price, x.digits)}</b> · RSI {x.snap.rsi.toFixed(0)} · ATR {fx(x.snap.atr, x.digits)}</p>}
                </div>
                <div className={s.card}>
                  <h3>Шинжилгээ</h3>
                  {!!x.text.reasons?.length && <ul className={s.reasons}>{x.text.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
                  {x.text.plan && <div className={s.block}><span>Төлөвлөгөө</span><p>{x.text.plan}</p></div>}
                  {x.text.invalidation && <div className={s.block} data-k="bad"><span>Хүчингүй болох нөхцөл</span><p>{x.text.invalidation}</p></div>}
                  {x.text.risk && <div className={s.block}><span>Эрсдэл</span><p>{x.text.risk}</p></div>}
                  {!!x.read.patterns?.length && <div className={s.tags}>{x.read.patterns.map((p) => <em key={p}>{p}</em>)}</div>}
                </div>
              </div>

              {x.warnings.length > 0 && <ul className={s.warns}>{x.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
              <div className={s.actions}>
                <button type="button" onClick={copy}>{copied ? "Хуулагдлаа ✓" : "Сигнал хуулах"}</button>
                <button type="button" onClick={reset}>Шинэ скан</button>
                <span className={s.vote}>Шинжилгээ хэрэгтэй байсан уу?
                  <button type="button" aria-pressed={x.feedback?.vote === "up"} onClick={() => vote("up")} aria-label="Тийм">▲</button>
                  <button type="button" aria-pressed={x.feedback?.vote === "down"} onClick={() => vote("down")} aria-label="Үгүй">▼</button>
                </span>
              </div>
            </section>
          )}

          <section className={s.history}>
            <div className={s.hHead}><h2>Миний сканууд</h2><span>TP/SL-ийг бодит ханшаар 10 мин тутам шалгана</span></div>
            {scans === null ? <div className={s.sk} /> : scans.length === 0 ? (
              <p className={s.empty}>Одоогоор скан алга. Эхний графикаа оруулаад SCAN дар.</p>
            ) : (
              <ul className={s.hList}>
                {scans.map((h) => {
                  const o = OUT[h.outcome?.status] || OUT.na;
                  return (
                    <li key={h._id} data-on={cur?._id === h._id || undefined}>
                      <button type="button" className={s.hItem} onClick={() => { setCur(h); setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80); }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={h.image} alt="" loading="lazy" />
                        <div className={s.hTxt}>
                          <b>{h.symbol || "?"} <small>{h.tf}</small></b>
                          <span data-dir={h.decision.dir}>{h.decision.dir === "WAIT" ? "ХҮЛЭЭХ" : `${h.decision.dir} · ${h.decision.confidence}%`}</span>
                        </div>
                        <div className={s.hSide}><em data-k={o[1]}>{o[0]}{h.outcome?.r != null && ["tp1", "tp2", "sl", "expired"].includes(h.outcome.status) ? ` (${h.outcome.r > 0 ? "+" : ""}${h.outcome.r}R)` : ""}</em><small>{ago(h.createdAt)}</small></div>
                      </button>
                      <button type="button" className={s.hDel} onClick={() => del(h._id)} aria-label="Устгах">×</button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

        </div>
      </div>
    </div>
  );
}
