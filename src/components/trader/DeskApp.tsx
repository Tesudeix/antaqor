"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import DeskChart, { type ChartData, type Draw, type Layer, type Plan, type Tick } from "./DeskChart";
import s from "./desk.module.css";

/* ─── TESLA TRADER v9 · НЭГ ДЭЛГЭЦ (2026-11-06) ──────────────────────────────
   Сонголт, алхам, товч алга: хугацаа дармагц 18 индикатор бүгд уншигдаж, зургаан асуултад хариулна.
   Хаашаа? Итгэж болох уу? Хэр хол? Алдагдлын хязгаар хэр хол? Хэзээ? Төлөвлөгөө?
   Чарт 1-3 хугацаагаар зэрэгцэж, бүгд нэг tick авна. Сонгосон чарт баруун талын уншилтыг удирдана.
   Гол мессеж нь чиглэл биш, тэр чиглэл түүхэнд ажилласан эсэх. Ихэнх үед хариулт нь «зоос шидэхтэй адил» бөгөөд
   үүнийг нуухгүй. Төлөвлөгөө батлагдаагүй бол чартад зурахгүй. Арилжаа хэзээ ч автоматаар хийгдэхгүй. */

type Cell = { id: string; label: string; g: number; v: number; read: string; n?: number; hit?: number; exp?: number; ok?: boolean };
type Truth = { kind: string; p: number | null; base: number | null; lo: number | null; hi: number | null; n: number; wins: number; up: boolean };
type Row = { k: string; mn: string; exp: number | null; se: number | null; n: number; ok: boolean; live: number; has: boolean };
type Stop = { p: number; d: number; oos: number };
type Hours = { rel: number[]; w: number; len: number; lift: number };
type News = { next: { t: number; name: string; also: number; soon: boolean } | null; line: { t: number; high: boolean }[] };
type Read = {
  sym: string; tf: string; barAt: number; px: number; horizon: number; cells: Cell[]; up: number; dn: number; flat: number; dir: number; neff: number | null; voters: number; truth: Truth | null; sentence: string;
  range: { half: number; pct: number; lo: number; hi: number; unit: number; cov: number; covN: number; ratio: number; lift: number } | null; stops: Stop[] | null; hours: Hours | null; levels: { sup: number | null; res: number | null }; plans: Row[]; plan: Plan | null; levelsPlan: Plan | null; verified: boolean; draw: Draw;
  live: { fired: number; tp: number; sl: number; open: number } | null; news: News | null; matrix: { tf: string; dir: number }[];
};
type Msg = { role: "user" | "ai"; text: string };
type Live = Tick & { got: number; moved: number };

const SYMS = [{ id: "XAUUSD", mn: "Алт", d: 2 }, { id: "BTCUSDT", mn: "Биткойн", d: 2 }];
const TFS = [{ id: "1m", mn: "1 мин", after: "12 минутын дараа", within: "12 минутад" }, { id: "5m", mn: "5 мин", after: "1 цагийн дараа", within: "1 цагт" }, { id: "15m", mn: "15 мин", after: "3 цагийн дараа", within: "3 цагт" }, { id: "1H", mn: "1 цаг", after: "12 цагийн дараа", within: "12 цагт" }, { id: "4H", mn: "4 цаг", after: "2 өдрийн дараа", within: "2 өдөрт" }, { id: "1D", mn: "1 өдөр", after: "12 өдрийн дараа", within: "12 өдөрт" }];
const GROUPS = ["Тренд", "Импульс", "Хэмжээ"];
const HINT: Record<string, string> = { ema: "Сүүлийн үнэд жинтэй дундаж", sma: "Энгийн дундаж үнэ", st: "Тренд дагагч шугам", ichi: "Богино ба дунд трендийн харьцаа", sar: "Тренд эргэх цэгүүд", vwap: "Өнөөдрийн дундаж арилжааны үнэ", bb: "Үнийн ердийн хязгаар", rsi: "Хөдөлгөөний хүч, 0-100", macd: "Хоёр дунджийн зөрүү", stoch: "Үнэ хүрээнийхээ аль хэсэгт байна", kst: "Олон хугацааны хурд", pctb: "Bollinger доторх байрлал", mfi: "Мөнгөний урсгалын хүч", dpo: "Трендийг хассан мөчлөг", atr: "Хэлбэлзлийн хэмжээ, чиглэл заахгүй", adx: "Трендийн хүч", rvol: "Хэмжээ ердийнхөөс хэд дахин их", ad: "Хуримтлал эсвэл тархалт" };
/* индикаторын өөрийн түүхэн нарийвчлал: санамсаргүй хүлээлттэй шууд жишнэ */
const cellNote = (c: Cell) => `${c.label}: ${c.read}. ${HINT[c.id] ?? ""}.${c.hit === undefined ? "" : ` Санал өгөхдөө ${Math.round(c.hit)}% зөв, санамсаргүй бол ${Math.round(c.exp ?? 0)}%.${c.ok ? " Батлагдсан." : ""}`}`;
const volWord = (r: number) => (r >= 1.1 ? `Ердийнхөөс ${r.toFixed(1)} дахин их` : r && r <= 0.9 ? `Ердийнхөөс ${(1 / r).toFixed(1)} дахин бага` : "Ердийн хэмжээнд");
const KIND: Record<string, string> = { coin: "Зоос шидэхтэй адил", edge: "Түүхэнд давуу талтай", weak: "Тогтвортой биш", few: "Жишээ хангалтгүй", opposite: "Түүхэнд эсрэгээрээ", mixed: "Чиглэл алга" };
const fx = (n: number | null | undefined, d = 2) => (typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
const glyph = (v: number) => (v > 0 ? "▲" : v < 0 ? "▼" : "–");
const sgn = (n: number) => (n > 0 ? "+" : n < 0 ? "−" : "");
function load<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } }
function save(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* хувийн горим */ } }
const HOUR = 3600e3, clock = (t: number) => `${String(new Date(t).getHours()).padStart(2, "0")}:00`;
function until(ms: number) { const m = Math.max(0, Math.floor(ms / 60000)); if (m < 60) return `${m} минут`; const h = Math.floor(m / 60); return h < 48 ? `${h} цаг ${m % 60} мин` : `${Math.floor(h / 24)} өдөр`; }

/* 18 нүд: өнгө, тэмдэг хоёулаа чиглэлийг заана. Дарвал чартад зурна. */
function Strip({ rd, drawn, onCell }: { rd: Read; drawn: string[]; onCell: (id: string) => void }) {
  return (
    <div className={s.strip} key={`${rd.sym}${rd.tf}`}>
      {GROUPS.map((g, k) => (
        <div key={g} className={s.row}>
          <span>{g}</span>
          <div>{rd.cells.filter((c) => c.g === k).map((c, i) => <button key={c.id} type="button" data-v={c.v > 0 ? "up" : c.v < 0 ? "dn" : "mid"} aria-pressed={drawn.includes(c.id)} aria-label={`${c.label}: ${c.v > 0 ? "өсөх" : c.v < 0 ? "унах" : "саармаг"}`} title={`${c.label}: ${c.read}`} style={{ "--i": k * 7 + i } as React.CSSProperties} onClick={() => onCell(c.id)}>{glyph(c.v)}</button>)}</div>
        </div>
      ))}
    </div>
  );
}
/* Магадлалыг 0-100 бүтэн тэнхлэгт тавина: зөрүү бага бол бага харагдах ёстой */
function Odds({ t }: { t: Truth }) {
  if (t.p === null || t.base === null) return null;
  return (
    <div className={s.odds}>
      <div className={s.scale} role="img" aria-label={`Ийм үед ${t.p}%, ердийн үед ${t.base}%`}><i className={s.ci} style={{ left: `${t.lo}%`, width: `${(t.hi ?? 0) - (t.lo ?? 0)}%` }} /><i className={s.tickMark} style={{ left: `${t.base}%` }} /><i className={s.dot} style={{ left: `${t.p}%` }} /></div>
      <div className={s.ends} data-flip={t.p > t.base || undefined}><span><i className={s.keyDot} /><b>{Math.round(t.p)}%</b> ийм үед</span><span><i className={s.keyTick} /><b>{Math.round(t.base)}%</b> ердийн үед</span></div>
    </div>
  );
}
function Rows({ rows }: { rows: Row[] }) {
  return <ul className={s.plans}>{rows.map((r) => { const e = r.exp ?? 0, w = Math.min(50, (Math.abs(e) / 0.5) * 50); return <li key={r.k}><span>{r.mn}</span><div className={s.bar} role="img" aria-label={`${r.mn}: ${e}R`}><i data-d={e >= 0 ? "up" : "dn"} style={{ width: `${w}%`, [e >= 0 ? "left" : "right"]: "50%" }} /></div><b>{r.n ? `${sgn(e)}${Math.abs(e).toFixed(2)}R` : "—"}</b></li>; })}</ul>;
}

/* Багана нь бодит зайтай пропорциональ: ойр хязгаарыг ердийн савлагаа илүү олон удаа дайрна */
function Stops({ rows }: { rows: Stop[] }) {
  const far = rows[rows.length - 1].d;
  return <ul className={s.stops}>{rows.map((r) => <li key={r.p}><b>${fx(r.d, r.d < 100 ? 2 : 0)}</b><div className={s.meter} role="img" aria-label={`${r.p}% магадлал`}><i style={{ width: `${(r.d / far) * 100}%` }} /></div><span>{Math.round(100 / r.p)} удаад 1</span></li>)}</ul>;
}
/* Ойрын 24 цаг нэг тэнхлэгт: багана нь тухайн цагийн түүхэн хөдөлгөөн, цэг нь том мэдээ. Цаг нь үзэгчийн орон нутгийн цаг. */
function Day({ hours, dots, start }: { hours: Hours | null; dots: News["line"]; start: number }) {
  const top = hours ? Math.max(...hours.rel) : 1;
  return (
    <div className={s.day} role="img" aria-label="Ойрын 24 цагийн идэвх ба том мэдээ">
      {!!dots.length && <div className={s.timeline}>{dots.map((e) => <i key={e.t} data-h={e.high || undefined} style={{ left: `${((e.t - start) / (24 * HOUR)) * 100}%` }} />)}</div>}
      {hours && <div className={s.hours}>{Array.from({ length: 24 }, (_, k) => { const t = start + k * HOUR, u = new Date(t).getUTCHours(), r = hours.rel[u]; return <i key={t} data-p={(u - hours.w + 24) % 24 < hours.len || undefined} style={{ height: `${Math.max(6, (r / top) * 100)}%` }} title={`${clock(t)}: ердийн цагаас ${r.toFixed(1)} дахин`} />; })}</div>}
      <div className={s.ends}><span>Одоо</span><span>{clock(start + 12 * HOUR)}</span><span>{clock(start + 24 * HOUR)}</span></div>
    </div>
  );
}

/* Нэг хугацааны чарт: өөрийн лаа, уншилттай. Идэвхтэй бол уншилтаа дээш өгнө. */
function Pane({ sym, tf, d, active, onPick, onRead, tick, indQ, pro }: { sym: string; tf: string; d: number; active: boolean; onPick: (t: string) => void; onRead: (r: Read | null, err: string) => void; tick: Tick | null; indQ: string; pro: boolean }) {
  const [data, setData] = useState<ChartData | null>(null), [rd, setRd] = useState<Read | null>(null), [loadErr, setLoadErr] = useState(""), [readErr, setReadErr] = useState("");
  const viewKey = `${sym}:${tf}`, dataKey = `${viewKey}:${indQ}`, T = TFS.find((x) => x.id === tf) ?? TFS[3];

  useEffect(() => {
    let alive = true;
    const b = async () => { if (document.hidden) return; try { const r = await fetch(`/api/trader-agent/desk?sym=${sym}&tf=${tf}&ind=${indQ}`, { cache: "no-store" }), j = await r.json(); if (!alive) return; if (r.ok) { setData({ ...j, key: dataKey }); setLoadErr(""); } else setLoadErr(j.error || "Лаа ачаалж чадсангүй. Дахин оролдож байна"); } catch { if (alive) setLoadErr("Сүлжээ тасарсан. Дахин оролдож байна"); } };
    setLoadErr(""); b();
    const t = setInterval(b, 15000), vis = () => { if (!document.hidden) b(); };
    document.addEventListener("visibilitychange", vis);
    return () => { alive = false; clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [sym, tf, indQ, dataKey]);
  useEffect(() => {
    let alive = true;
    const b = async () => { if (document.hidden) return; try { const r = await fetch(`/api/trader-agent/desk?q=read&sym=${sym}&tf=${tf}`, { cache: "no-store" }), j = await r.json(); if (!alive) return; if (r.ok) { setRd(j); setReadErr(""); } else setReadErr(j.error || "Уншилт ирсэнгүй. Дахин оролдож байна"); } catch { if (alive) setReadErr("Сүлжээ тасарсан. Дахин оролдож байна"); } };
    setReadErr(""); b();
    const t = setInterval(b, 20000), vis = () => { if (!document.hidden) b(); };
    document.addEventListener("visibilitychange", vis);
    return () => { alive = false; clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [sym, tf]);

  const view = rd?.sym === sym && rd?.tf === tf ? rd : null, shownPlan = view ? (view.verified ? view.plan : pro ? view.levelsPlan : null) : null;
  useEffect(() => { if (active) onRead(view, readErr); }, [active, view, readErr, onRead]);
  const layer: Layer | null = useMemo(() => (view ? { unit: view.range?.unit ?? null, horizon: view.horizon, sup: view.levels.sup, res: view.levels.res, plan: shownPlan, marks: pro ? view.draw : null } : null), [view, shownPlan, pro]);
  const layerSig = view ? `${viewKey}:${view.barAt}:${pro}:${view.levels.sup}:${view.levels.res}:${view.range?.unit}:${shownPlan?.entry}` : "";
  const subs = data?.key.startsWith(`${viewKey}:`) ? data.inds.filter((x) => x.pane === "sub").length : 0;
  return (
    <section className={s.pane} data-active={active || undefined} onPointerDownCapture={() => onPick(tf)}>
      <button type="button" className={s.paneTop} aria-pressed={active} onClick={() => onPick(tf)}>{T.mn}{view && <i data-d={view.dir > 0 ? "up" : view.dir < 0 ? "dn" : "mid"}>{glyph(view.dir)}</i>}</button>
      <DeskChart tf={tf} digits={d} viewKey={viewKey} data={data} tick={tick} layer={layer} layerSig={layerSig} subs={subs} loadErr={loadErr} />
    </section>
  );
}

export default function DeskApp() {
  const [sym, setSym] = useState("XAUUSD"), [panes, setPanes] = useState(["1H", "1m", "15m"]), [count, setCount] = useState(3), [tf, setTf] = useState("1H"), [drawn, setDrawn] = useState<string[]>([]), [focus, setFocus] = useState<string | null>(null), [pro, setPro] = useState(false);
  const [view, setView] = useState<Read | null>(null), [readErr, setReadErr] = useState(""), [tick, setTick] = useState<Live | null>(null), [now, setNow] = useState(0);
  const [msgs, setMsgs] = useState<Msg[]>([]), [q, setQ] = useState(""), [asking, setAsking] = useState(false), [matrix, setMatrix] = useState<Read["matrix"]>([]);
  const lastPx = useRef({ px: 0, at: 0 }), S = SYMS.find((x) => x.id === sym)!, d = S.d, T = TFS.find((x) => x.id === tf) ?? TFS[3], shown = panes.slice(0, count);
  const indQ = useMemo(() => drawn.map((x) => `${x}:`).join(","), [drawn]);

  useEffect(() => {
    const c = load<{ sym?: string; tf?: string; panes?: string[]; count?: number; drawn?: string[]; pro?: boolean }>("td.cfg9", {}), ok = (x?: string) => TFS.some((t) => t.id === x);
    if (c.sym && SYMS.some((x) => x.id === c.sym)) setSym(c.sym);
    const list = c.panes?.length === 3 && c.panes.every(ok) ? c.panes : ["1H", "1m", "15m"], n = c.count === 1 || c.count === 2 || c.count === 3 ? c.count : matchMedia("(max-width: 560px)").matches ? 1 : 3;
    setPanes(list); setCount(n); setTf(ok(c.tf) && list.slice(0, n).includes(c.tf!) ? c.tf! : list[0]);
    if (c.drawn) setDrawn(c.drawn); if (c.pro) setPro(true);
    setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t);
  }, []);
  useEffect(() => { save("td.cfg9", { sym, tf, panes, count, drawn, pro }); }, [sym, tf, panes, count, drawn, pro]);

  useEffect(() => {
    let es: EventSource | null = null, alive = true, got = 0;
    const on = (t: Tick) => { if (!alive) return; const n = Date.now(); got = n; if (t.px !== lastPx.current.px) lastPx.current = { px: t.px, at: n }; setTick({ ...t, got: n, moved: lastPx.current.at }); };
    const open = () => { es?.close(); es = new EventSource(`/api/trader-agent/desk/live?sym=${sym}`); es.onmessage = (e) => { try { on(JSON.parse(e.data) as Tick); } catch { /* дараагийн tick */ } }; };
    const vis = () => { if (document.hidden) { es?.close(); es = null; } else open(); };
    lastPx.current = { px: 0, at: 0 }; setTick(null); open();
    document.addEventListener("visibilitychange", vis);
    const back = setInterval(async () => { if (document.hidden || Date.now() - got < 4000) return; try { const r = await fetch(`/api/trader-agent/desk?q=price&sym=${sym}`, { cache: "no-store" }); if (r.ok) on(await r.json()); } catch { /* дараагийн удаа */ } }, 4000);
    return () => { alive = false; es?.close(); clearInterval(back); document.removeEventListener("visibilitychange", vis); };
  }, [sym]);

  const onRead = useCallback((r: Read | null, err: string) => { setView(r); setReadErr(err); if (r) setMatrix(r.matrix); }, []);
  /* идэвхтэй чарт хугацаагаа сольсон ч бусад чарт хэвээр үлдэнэ; нэг хугацаа давхардахгүй */
  const pickTab = (t: string) => { if (shown.includes(t)) { setTf(t); return; } setPanes((c) => c.map((x) => (x === tf ? t : x))); setTf(t); };
  const pickPane = useCallback((t: string) => { setTf(t); }, []);
  useEffect(() => { setMsgs([]); }, [sym, tf]);
  const changeCount = (n: number) => { setCount(n); const list = panes.slice(0, n); if (!list.includes(tf)) setTf(list[0]); };
  const onCell = (id: string) => { setFocus(id); setDrawn((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id])); };
  const ask = async (text: string) => {
    const t = text.trim();
    if (!t || asking) return;
    const history = msgs.slice(-6);
    setMsgs((c) => [...c, { role: "user", text: t }]); setQ(""); setAsking(true);
    try { const r = await fetch("/api/trader-agent/desk/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sym, tf, q: t, history }) }), j = await r.json(); setMsgs((c) => [...c, { role: "ai", text: r.ok ? j.answer : j.error || "Хариулт ирсэнгүй. Дахин оролдоно уу" }]); }
    catch { setMsgs((c) => [...c, { role: "ai", text: "Сүлжээ тасарсан. Дахин оролдоно уу" }]); } finally { setAsking(false); }
  };

  const live = !tick || !now ? "wait" : now - tick.got > 6000 ? "lost" : now - tick.moved > 240000 ? "closed" : "live";
  const liveTxt = { wait: "Холбогдож байна", lost: "Дахин холбогдож байна", closed: "Зах зээл хаалттай", live: "Шууд" }[live];
  const cell = view?.cells.find((c) => c.id === focus), nx = view?.news?.next, t = view?.truth, heat = view?.hours ?? null;
  const hourStart = now - (now % HOUR), dots = (view?.news?.line ?? []).filter((e) => e.t >= now && e.t < hourStart + 24 * HOUR);
  const peakAt = heat ? (() => { const x = now - (now % (24 * HOUR)) + heat.w * HOUR; return x > now ? x : x + 24 * HOUR; })() : 0, inPeak = !!heat && !!now && (new Date(now).getUTCHours() - heat.w + 24) % 24 < heat.len, shut = live === "closed";
  const peakFrom = inPeak && heat ? hourStart - ((new Date(now).getUTCHours() - heat.w + 24) % 24) * HOUR : peakAt;
  const dayNote = [heat && `Ихэвчлэн ${clock(peakFrom)}–${clock(peakFrom + heat.len * HOUR)}, бусад цагаас ${heat.lift.toFixed(1)} дахин их хөдөлдөг.`, dots.length ? "Цэг бол том мэдээ." : "", nx?.soon ? "Мэдээ ойрхон байна, энэ үед хөдөлгөөн ихэсч болно." : ""].filter(Boolean).join(" ");

  return (
    <div className={s.app}>
      <header className={s.top}>
        <div className={s.syms} role="tablist" aria-label="Хэрэгсэл">{SYMS.map((x) => <button key={x.id} type="button" role="tab" aria-selected={sym === x.id} onClick={() => { setSym(x.id); setMatrix([]); }}>{x.mn}</button>)}</div>
        <div className={s.quote}><span className={s.status} data-s={live} title={liveTxt}><i /><em>{liveTxt}</em></span><strong>{tick ? fx(tick.px, d) : "—"}</strong>{tick && <span className={s.chg}><i data-d={tick.chg >= 0 ? "up" : "dn"}>{glyph(tick.chg)}</i>{Math.abs(tick.chg).toFixed(2)}%</span>}</div>
        <button type="button" className={s.out} onClick={() => signOut({ callbackUrl: `${window.location.origin}/` })}>Гарах</button>
      </header>

      <div className={s.page}>
        <main className={s.read}>
          <h1 data-wait={!view || undefined}>{view?.sentence ?? (readErr || "Уншиж байна")}</h1>
          <div className={s.tabBar}>
            <div className={s.tabs} role="tablist" aria-label="Хугацаа">{TFS.map((x) => { const m = matrix.find((q) => q.tf === x.id); return <button key={x.id} type="button" role="tab" aria-selected={tf === x.id} data-on={shown.includes(x.id) || undefined} onClick={() => pickTab(x.id)}><span>{x.mn}</span>{m && <i data-d={m.dir > 0 ? "up" : m.dir < 0 ? "dn" : "mid"} aria-label={m.dir > 0 ? "өсөх" : m.dir < 0 ? "унах" : "тодорхойгүй"}>{glyph(m.dir)}</i>}</button>; })}</div>
            <div className={s.split} role="group" aria-label="Чартын тоо">{[1, 2, 3].map((k) => <button key={k} type="button" aria-pressed={count === k} aria-label={`${k} чарт`} title={`${k} чарт`} onClick={() => changeCount(k)}>{Array.from({ length: k }, (_, i) => <i key={i} />)}</button>)}</div>
          </div>
          <div className={s.splits} data-n={count} style={{ "--n": count } as React.CSSProperties}>{shown.map((x, i) => <Pane key={i} sym={sym} tf={x} d={d} active={x === tf} onPick={pickPane} onRead={onRead} tick={tick} indQ={indQ} pro={pro} />)}</div>
          <div className={s.under}>
            <p>Цайвар бүс: дараагийн 12 лаанд үнэ байх магадлалтай 80% хүрээ.</p>
            <button type="button" aria-pressed={pro} onClick={() => setPro((c) => !c)}>{pro ? "Тэмдэглэгээ нуух" : "Тэмдэглэгээ харуулах"}</button>
          </div>
        </main>

        <aside className={s.side} data-wait={!view || undefined} aria-label="Уншилт">
          <section>
            <h2>Хаашаа?</h2>
            <p className={s.big}><i data-d={view ? (view.dir > 0 ? "up" : view.dir < 0 ? "dn" : "mid") : "mid"}>{glyph(view?.dir ?? 0)}</i>{view ? (view.dir > 0 ? "Өсөх" : view.dir < 0 ? "Унах" : "Тодорхойгүй") : "—"}<small>{view ? `${view.up} өсөх, ${view.dn} унах, ${view.flat} саармаг` : ""}</small></p>
            {view && <Strip rd={view} drawn={drawn} onCell={onCell} />}
            <p className={s.note}>{cell ? cellNote(cell) : view?.neff ? `Бие даасан санал ойролцоогоор ${view.neff}. Дангаараа батлагдсан индикатор ${view.cells.filter((c) => c.ok).length}/${view.voters}.` : ""}</p>
          </section>
          <section>
            <h2>Итгэж болох уу?</h2>
            <p className={s.big}>{t ? KIND[t.kind] : "Хэмжиж байна"}</p>
            {t && <Odds t={t} />}
            {t && t.n > 0 && <p className={s.note}>{T.after} {t.wins}/{t.n} удаа {t.up ? "өссөн" : "унасан"}.</p>}
          </section>
          <section>
            <h2>Хэр хол хөдлөх вэ?</h2>
            {view?.range ? <><p className={s.big}>±${fx(view.range.half, view.range.half < 100 ? 2 : 0)}<small>{volWord(view.range.ratio)}</small></p>
              <div className={s.span} role="img" aria-label={`${fx(view.range.lo, d)} ба ${fx(view.range.hi, d)} хооронд`}><i /></div>
              <div className={s.ends}><span>{fx(view.range.lo, d)}</span><span>{fx(view.range.hi, d)}</span></div>
              <p className={s.note}>{T.after} энэ хооронд байх магадлал 80%, шалгахад {Math.round(view.range.cov)}% таарсан.{view.range.lift >= 1.3 ? ` Хэлбэлзэл өндөр үед дараагийн хөдөлгөөн ${view.range.lift} дахин их байсан.` : ""}</p></> : <p className={s.big}>Хэмжиж байна</p>}
          </section>
          {view?.stops && <section>
            <h2>Алдагдлын хязгаар хэр хол?</h2>
            <Stops rows={view.stops} />
            <p className={s.note}>Ердийн савлагаа {T.within} ийм зайд хүрэх давтамж. Шалгахад {view.stops.map((x) => `${Math.round(x.oos)}%`).join(", ")} гарсан.</p>
          </section>}
          <section>
            <h2>Хэзээ хөдлөх вэ?</h2>
            <div className={s.pair} data-one={!heat || undefined}>
              {heat && <p className={s.big}>{shut ? "Хаалттай" : inPeak ? "Одоо" : until(peakAt - now)}<small>{shut ? "зах зээл" : inPeak ? "идэвхтэй цаг" : "идэвхтэй цаг хүртэл"}</small></p>}
              <p className={s.big}>{nx ? until(nx.t - now) : view ? "48 цагт алга" : "—"}<small>{nx ? `${nx.name}${nx.also ? ` ба өөр ${nx.also}` : ""}` : "том мэдээ"}</small></p>
            </div>
            {view && !!now && <Day hours={heat} dots={dots} start={hourStart} />}
            {dayNote && <p className={s.note}>{dayNote}</p>}
          </section>
          <section>
            <h2>Төлөвлөгөө</h2>
            {view?.verified && view.plan ? <><p className={s.big}><i data-d={view.plan.dir > 0 ? "up" : "dn"}>{glyph(view.plan.dir)}</i>{view.plan.dir > 0 ? "Авах" : "Зарах"} бүс {fx(view.plan.lo, d)}–{fx(view.plan.hi, d)}</p><dl className={s.levels}><div><dt>Орох</dt><dd>{fx(view.plan.entry, d)}</dd></div><div><dt>SL</dt><dd>{fx(view.plan.sl, d)}</dd></div><div><dt>TP</dt><dd>{fx(view.plan.tp1, d)}</dd></div></dl></> : <p className={s.big}>Батлагдсан нь алга</p>}
            {view && <Rows rows={view.plans} />}
            {view && <p className={s.note}>Шимтгэл хассан дундаж үр дүн, эрсдэлийн нэгжээр.{view.live?.fired ? ` Амьд шалгалт: ${view.live.fired} хаагдсан, TP ${view.live.tp}, SL ${view.live.sl}.` : ""}</p>}
          </section>
          <section className={s.ask}>
            {!!msgs.length && <div className={s.msgs} aria-live="polite">{msgs.map((m, k) => <p key={k} data-r={m.role}>{m.text}</p>)}{asking && <p data-r="ai">Бодож байна</p>}</div>}
            <form onSubmit={(e) => { e.preventDefault(); ask(q); }}><input value={q} onChange={(e) => setQ(e.target.value)} maxLength={600} placeholder="Ойлгомжгүй зүйлээ асуух" aria-label="Асуулт" /><button type="submit" disabled={asking || !q.trim()}>Асуух</button></form>
          </section>
        </aside>
      </div>
      <footer className={s.foot}>
        <p>Санхүүгийн зөвлөгөө биш. Түүхэн дүн ирээдүйг баталгаажуулахгүй. Арилжаа автоматаар хийгдэхгүй.</p>
        <nav aria-label="Өмнөх хувилбар"><Link href="/1" prefetch={false}>v4</Link><Link href="/2" prefetch={false}>v5</Link><Link href="/3" prefetch={false}>v6</Link></nav>
      </footer>
    </div>
  );
}
