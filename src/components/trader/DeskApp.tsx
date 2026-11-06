"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import DeskChart, { bucket, PALETTE, TF_MIN, type ChartData, type Draw, type Plan, type Tick } from "./DeskChart";
import s from "./desk.module.css";

/* ─── TESLA TRADER v8 · АМЬД ШИНЖИЛГЭЭНИЙ ШИРЭЭ (2026-11-06) ─────────────────
   Үнэ секунд тутам SSE-ээр ирж ханшийн самбар, сүүлийн лааг зэрэг хөдөлгөнө. Индикатор 18 хүртэл, санал нь бодит
   цагаар тоологдоно. Агент 6 алхмаар ажиллана: хугацаа унших → бүтэц → төлөвлөгөө → мэдээ → асуулт → үр дүн.
   Төлөвлөгөө бол хэмжилттэй нөхцөлт хувилбар, дохио биш. Арилжаа автоматаар хийхгүй. */

type Stat = { plans: number; fired: number; tp: number; sl: number; exp: number | null; se: number | null; h1: number | null; h2: number | null };
type Live = { n: number; open: number; tp: number; sl: number; exp: number | null };
type Best = { k: string; mn: string; n: number; score: number };
type IndRead = { id: string; label: string; read: string; vote: number };
type Sec = { tf: string; empty?: boolean; score: number; state: string; price: number; swings: { label: string; p: number; t: number }[]; notes: string[]; pattern: string | null; inds: IndRead[]; votes: { up: number; dn: number; flat: number }; plan: Plan | null; none: string | null; confirm: string | null; invalid: string; atr: number; stat: Stat | null; verdict: { k: string; mn: string }; live: Live | null; best: Best | null; draw: Draw };
type Ev = { t: number; ccy: string; title: string; impact: string; forecast?: string; previous?: string };
type Learn = { total: number; open: number; fired: number; tp: number; sl: number; recent: { tf: string; strat: string; dir: number; status: string; r: number | null; t: number }[] };
type Rep = { sym: string; pair: string; stratMn: string; now: number; bias: { k: number; mn: string }; summary: string; sections: Sec[]; statsAt: number | null; measuring: boolean; news: Ev[]; learn: Learn | null };
type Head = { title: string; src: string; url: string; t: number; tone: number | null };
type Weigh = { risk: "low" | "medium" | "high"; text: string; calendar: Ev[]; items: Head[]; tone: number | null; note: string };
type Sel = { id: string; p?: number; hide?: boolean };
type Msg = { role: "user" | "ai"; text: string };
type Live2 = Tick & { got: number; moved: number };

const SYMS = [{ id: "XAUUSD", pair: "XAU/USD", mn: "Алт", ic: "Au", d: 2, src: "Swissquote · Dukascopy" }, { id: "BTCUSD", pair: "BTC/USD", mn: "Биткойн", ic: "₿", d: 2, src: "Bitstamp" }, { id: "BTCUSDT", pair: "BTC/USDT", mn: "Биткойн USDT", ic: "₿", d: 2, src: "Binance" }];
/* Биткойн: хөтөч биржийн урсгалд шууд холбогдож, арилжаа бүрийг серверээр дамжуулахгүй авна */
type WsMsg = { e?: string; p?: string; T?: number; event?: string; data?: { price?: number; microtimestamp?: string } };
const DIRECT: Record<string, { url: string; sub?: string; read: (m: WsMsg) => { px: number; t: number } | null }> = {
  BTCUSD: { url: "wss://ws.bitstamp.net", sub: JSON.stringify({ event: "bts:subscribe", data: { channel: "live_trades_btcusd" } }), read: (m) => (m.event === "trade" && m.data?.price ? { px: +m.data.price, t: Math.floor(+(m.data.microtimestamp ?? 0) / 1000) || Date.now() } : null) },
  BTCUSDT: { url: "wss://stream.binance.com:9443/ws/btcusdt@aggTrade", read: (m) => (m.e === "aggTrade" && m.p ? { px: +m.p, t: m.T ?? Date.now() } : null) },
};
const TFS = ["1m", "5m", "15m", "30m", "1H", "4H", "1D", "1W"];
const STRATS = [{ id: "pullback", mn: "Буцалт", full: "Трендийн буцалт", sub: "Импульсийн дараах буцалт, EMA чиглэл, RSI батлалт" }, { id: "sweep", mn: "Sweep", full: "Liquidity Sweep", sub: "Swing шүүрдээд эргэж хаагдахад" }, { id: "smc", mn: "SMC", full: "SMC · Order block", sub: "BOS-ийн дараах order block руу буцалт" }];
const INDS: { id: string; mn: string; p?: number }[] = [{ id: "ema", mn: "EMA", p: 9 }, { id: "sma", mn: "SMA", p: 20 }, { id: "st", mn: "Supertrend", p: 10 }, { id: "ichi", mn: "Ichimoku" }, { id: "sar", mn: "Parabolic SAR" }, { id: "vwap", mn: "VWAP" }, { id: "bb", mn: "Bollinger Bands", p: 20 }, { id: "rsi", mn: "RSI", p: 14 }, { id: "macd", mn: "MACD" }, { id: "stoch", mn: "Stochastic", p: 14 }, { id: "kst", mn: "KST" }, { id: "pctb", mn: "Percent B", p: 20 }, { id: "mfi", mn: "MFI", p: 14 }, { id: "dpo", mn: "DPO", p: 20 }, { id: "atr", mn: "ATR", p: 14 }, { id: "adx", mn: "ADX", p: 14 }, { id: "rvol", mn: "Relative Volume", p: 20 }, { id: "ad", mn: "Accumulation/Distribution" }];
const GROUPS: [string, string[]][] = [["Тренд", ["ema", "sma", "st", "ichi", "sar", "vwap", "bb"]], ["Импульс", ["rsi", "macd", "stoch", "kst", "pctb", "mfi", "dpo"]], ["Хэлбэлзэл, хэмжээ", ["atr", "adx", "rvol", "ad"]]];
const DEF: Sel[] = [{ id: "st", p: 10 }, { id: "ema", p: 9 }, { id: "rsi", p: 14 }];
const VERS = [{ h: "/1", t: "v4" }, { h: "/2", t: "v5" }, { h: "/3", t: "v6" }, { h: "/", t: "v8" }];
const STEPS = [
  { n: "01", t: "Хугацаа унших", d: "Сонгосон хугацааны лаа, индикаторыг зэрэг уншина" },
  { n: "02", t: "Бүтэц тэмдэглэх", d: "HH, HL, LH, LL, BOS, шүүрдэлт, rejection-ийг чарт дээр тэмдэглэнэ" },
  { n: "03", t: "Төлөвлөгөө зурах", d: "Бүс, орох цэг, SL, TP, таамгийн замыг зурна" },
  { n: "04", t: "Мэдээ жигнэх", d: "Эдийн засгийн календарь, гарчгийг эрсдэлд тооцно" },
  { n: "05", t: "Асуултад хариулах", d: "Шинжилгээний бодит тоон дээр тулгуурлан хариулна" },
  { n: "06", t: "Үр дүнгээс суралцах", d: "Төлөвлөгөө бүрийг бодит лаагаар дагаж, дүнг хэмжинэ" },
];
const QUICK = ["Яагаад энэ чиглэл гэж үзэв?", "SL яагаад тэнд байна?", "Мэдээ нөлөөлөх үү?"];
const RISK = { low: "Бага", medium: "Дунд", high: "Өндөр" };
const END: Record<string, string> = { tp: "TP хүрсэн", sl: "SL цохисон", time: "Хугацаа дууссан", cancel: "Цуцлагдсан", missed: "Алдсан", expired: "Идэвхжээгүй" };
const fx = (n: number | null | undefined, d = 2) => (typeof n === "number" && Number.isFinite(n) ? n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }) : "—");
const ub = (t: number) => new Date(t).toLocaleString("en-GB", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ulaanbaatar" }).replace(",", "");
const sg = (n: number) => (n > 0 ? "+" : "");
const dirOf = (n: number) => (n > 0 ? "up" : n < 0 ? "dn" : "mid");
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
function load<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } }
function save(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* хувийн горим */ } }
function left(ms: number) { const m = Math.floor(ms / 60000), c = Math.floor((ms % 60000) / 1000); if (m >= 1440) return `${Math.floor(m / 1440)}ө ${Math.floor((m % 1440) / 60)}ц`; if (m >= 60) return `${Math.floor(m / 60)}ц ${m % 60}м`; return `${String(m).padStart(2, "0")}:${String(c).padStart(2, "0")}`; }

/* өөрчлөгдсөн орнуудыг л тодруулдаг ханш */
function Price({ v, d }: { v: number | null; d: number }) {
  const str = v === null ? "—" : fx(v, d), [m, set] = useState({ now: str, was: str, dir: 0 });
  useEffect(() => { set((c) => (c.now === str ? c : { now: str, was: c.now, dir: Number(str.replace(/,/g, "")) >= Number(c.now.replace(/,/g, "")) ? 1 : -1 })); }, [str]);
  let k = 0; while (k < m.now.length && m.now[k] === m.was[k]) k++;
  return <b className={s.price} aria-live="off">{m.now.slice(0, k)}<span key={m.now} data-d={m.dir > 0 ? "up" : "dn"}>{m.now.slice(k)}</span></b>;
}
const Vote = ({ v }: { v: { up: number; dn: number; flat: number } }) => { const n = v.up + v.dn + v.flat || 1; return <div className={s.vote} role="img" aria-label={`${v.up} өсөх, ${v.dn} унах, ${v.flat} саармаг`}><u data-d="up" style={{ width: `${(v.up / n) * 100}%` }} /><u data-d="mid" style={{ width: `${(v.flat / n) * 100}%` }} /><u data-d="dn" style={{ width: `${(v.dn / n) * 100}%` }} /></div>; };

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
    ["Түүхэн хэмжилт", (x) => (x.stat?.fired ? <span className={s.st} data-k={x.verdict.k}><b>{x.verdict.mn}</b><small>{x.stat.fired} удаа идэвхжсэн · TP {Math.round((x.stat.tp / x.stat.fired) * 100)}% · {sg(x.stat.exp ?? 0)}{x.stat.exp}R ±{x.stat.se}</small></span> : <span className={s.st} data-k="none"><b>{x.verdict.mn}</b></span>)],
  ];
  return <div className={s.scroll}><table className={s.setup}><thead><tr><th />{secs.map((x) => <th key={x.tf}>{x.tf}</th>)}</tr></thead><tbody>{rows.map(([t, f]) => <tr key={t}><th>{t}</th>{secs.map((x) => <td key={x.tf}>{f(x)}</td>)}</tr>)}</tbody></table></div>;
}

const Report = memo(function Report({ rep, secs, sec, tf, d, news, pick, useStrat }: { rep: Rep; secs: Sec[]; sec: Sec | null; tf: string; d: number; news: Weigh | null; pick: (t: string) => void; useStrat: (k: string) => void }) {
  const x = sec ?? secs[0];
  return (
    <div className={s.report}>
      <section className={s.card} data-b={dirOf(rep.bias.k)}>
        <span className={s.meta}>{rep.pair} · {rep.stratMn} · {ub(rep.now)}</span>
        <h2>Чиглэл: {rep.bias.mn}</h2>
        <p className={s.lead}>{rep.summary}</p>
        <p className={s.warn}>Энэ бол нөхцөлт төлөвлөгөө, дохио биш. Түүхэн хэмжилт нь ижил дүрэм өнгөрсөн датад хэрхэн ажилласныг spread, шимтгэл хассан R-ээр харуулна.{rep.measuring ? " Хэмжилт яг одоо шинэчлэгдэж байна." : ""}</p>
      </section>
      {x && <section className={s.card}>
        <div className={s.secTabs} role="tablist" aria-label="Шинжилсэн хугацаа">{secs.map((q) => <button key={q.tf} type="button" role="tab" aria-selected={q.tf === x.tf} data-d={q.plan ? dirOf(q.plan.dir) : "mid"} onClick={() => pick(q.tf)}>{q.tf}</button>)}</div>
        <h3>{x.state}</h3>
        <div className={s.chain}>{x.swings.map((w) => <span key={w.t + w.label} data-d={/^(HH|HL)$/.test(w.label) ? "up" : /^(LH|LL)$/.test(w.label) ? "dn" : undefined}><b>{w.label}</b>{fx(w.p, d)}<small>{ub(w.t)}</small></span>)}</div>
        <ul className={s.notes}>{x.notes.map((n) => <li key={n}>{n}</li>)}{x.pattern && <li>{x.pattern}</li>}</ul>
        {!!x.inds.length && <>
          <div className={s.lbr}><b>Индикаторын санал</b><span><em data-d="up">{x.votes.up} өсөх</em> · <em data-d="dn">{x.votes.dn} унах</em> · {x.votes.flat} саармаг</span></div>
          <Vote v={x.votes} />
          <div className={s.reads}>{x.inds.map((q) => <span key={q.id} data-d={dirOf(q.vote)}><b>{q.label}</b>{q.read}</span>)}</div>
          <p className={s.dim}>Индикаторууд нэг лаанаас тооцогддог тул хамтдаа хөдөлдөг. 22,878 жишээн дээрх туршилтаар таван scan бүгд санал нийлэхэд чиглэл 50.3% таасан — санал бол зураглал, нэмэлт батлалт биш.</p>
        </>}
      </section>}
      <section className={s.card}><h3>Төлөвлөгөө <small>{rep.stratMn}</small></h3><Setup secs={secs} d={d} />{secs.filter((q) => q.none).map((q) => <p key={q.tf} className={s.dim}>{q.tf}: {q.none}</p>)}{secs.some((q) => q.plan) && <><h3>Хүчингүй болох нөхцөл</h3><ul className={s.notes}>{secs.filter((q) => q.plan).map((q) => <li key={q.tf}><b>{q.tf}</b> {q.invalid}</li>)}</ul></>}</section>
      <section className={s.card}>
        <h3>Мэдээ {news && <small className={s.risk} data-r={news.risk}>Эрсдэл: {RISK[news.risk]}</small>}</h3>
        {news ? <><p className={s.lead}>{news.text}{news.note ? ` ${news.note}` : ""}</p>
          {!!news.calendar.length && <ul className={s.news}>{news.calendar.map((e) => <li key={e.t + e.title} data-i={e.impact}><span>{ub(e.t)}</span><b>{e.ccy}</b><p>{e.title}{e.forecast ? <small> · таамаг {e.forecast} · өмнөх {e.previous}</small> : null}</p></li>)}</ul>}
          {!!news.items.length && <ul className={s.heads}>{news.items.slice(0, 6).map((h) => <li key={h.url} data-d={h.tone === null ? "mid" : dirOf(h.tone)}><i aria-hidden="true" /><a href={h.url} target="_blank" rel="noopener noreferrer">{h.title}</a><small>{h.src}</small></li>)}</ul>}
        </> : <p className={s.dim}>Мэдээ ачаалж байна…</p>}
      </section>
      <section className={s.card}>
        <h3>Үр дүнгээс суралцах</h3>
        <div className={s.kpis}><span><b>{rep.learn?.total ?? 0}</b>бүртгэсэн</span><span><b>{rep.learn?.open ?? 0}</b>нээлттэй</span><span><b>{rep.learn?.fired ?? 0}</b>идэвхжсэн</span><span><b data-d="up">{rep.learn?.tp ?? 0}</b>TP</span><span><b data-d="dn">{rep.learn?.sl ?? 0}</b>SL</span></div>
        <div className={s.scroll}><table className={s.learn}><thead><tr><th>Хугацаа</th><th>Түүхэн</th><th>Амьд бүртгэл</th><th>Хамгийн сайн стратеги</th></tr></thead><tbody>{secs.map((q) => <tr key={q.tf}><th>{q.tf}</th><td>{q.stat?.fired ? `${sg(q.stat.exp ?? 0)}${q.stat.exp}R · ${q.stat.fired}` : "—"}</td><td>{q.live?.n ? `${sg(q.live.exp ?? 0)}${q.live.exp}R · ${q.live.n}` : q.live?.open ? `${q.live.open} нээлттэй` : "Хүлээж байна"}</td><td>{q.best ? <button type="button" onClick={() => useStrat(q.best!.k)} disabled={q.best.score <= 0}>{q.best.score > 0 ? `${q.best.mn} ${sg(q.best.score)}${q.best.score}R` : "Эерэг стратеги алга"}</button> : "Дата хангалтгүй"}</td></tr>)}</tbody></table></div>
        {!!rep.learn?.recent.length && <ul className={s.recent}>{rep.learn.recent.slice(0, 6).map((r) => <li key={`${r.t}${r.tf}${r.strat}`}><span>{ub(r.t)}</span><b>{r.tf}</b><em data-d={r.dir > 0 ? "up" : "dn"}>{r.dir > 0 ? "Авах" : "Зарах"}</em><span>{END[r.status] ?? r.status}</span><strong data-d={dirOf(r.r ?? 0)}>{sg(r.r ?? 0)}{r.r ?? 0}R</strong></li>)}</ul>}
        <p className={s.dim}>Систем 15м, 1ц, 4ц дээрх төлөвлөгөө бүрийг 5 минут тутам бүртгэж, дараа нь бодит лаагаар шалгана. Эрэмбэ нь түүхэн ба амьд дүнг нэгтгэх ба амьд дүн 3 дахин жинтэй. Гурван стратегиас хамгийн сайныг нь сонгож байгаа тул тоо бага зэрэг өөдрөг гардаг. Босгыг автоматаар сулруулдаггүй.</p>
      </section>
    </div>
  );
});

export default function DeskApp() {
  const [sym, setSym] = useState("XAUUSD"), [tf, setTf] = useState("1H"), [strat, setStrat] = useState("pullback"), [tfs, setTfs] = useState<string[]>(["4H", "1H", "15m"]), [inds, setInds] = useState<Sel[]>(DEF);
  const [data, setData] = useState<ChartData | null>(null), [tick, setTick] = useState<Live2 | null>(null), [rep, setRep] = useState<Rep | null>(null), [news, setNews] = useState<Weigh | null>(null);
  const [step, setStep] = useState(0), [err, setErr] = useState(""), [loadErr, setLoadErr] = useState(""), [menu, setMenu] = useState(false), [gear, setGear] = useState<string | null>(null), [now, setNow] = useState(0), [small, setSmall] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]), [q, setQ] = useState(""), [asking, setAsking] = useState(false);
  const frame = useRef<HTMLDivElement>(null), S = SYMS.find((x) => x.id === sym)!, d = S.d, busy = step >= 1 && step <= 6, stages = useRef<ReturnType<typeof setTimeout>[]>([]), lastPx = useRef({ px: 0, at: 0 });
  const indQ = useMemo(() => inds.map((x) => `${x.id}:${x.p ?? ""}`).join(","), [inds]), viewKey = `${sym}:${tf}`, dataKey = `${viewKey}:${indQ}`;

  useEffect(() => { const c = load<{ sym?: string; strat?: string; tfs?: string[]; inds?: Sel[]; tf?: string; usd?: number }>("td.cfg8", {}), was = c.sym === "BTCUSDT" && !c.usd ? "BTCUSD" : c.sym; if (was && SYMS.some((x) => x.id === was)) setSym(was); if (c.strat) setStrat(c.strat); if (c.tfs?.length) setTfs(c.tfs); if (c.inds) setInds(c.inds); if (c.tf) setTf(c.tf); const m = matchMedia("(max-width: 560px)"), f = () => setSmall(m.matches); f(); m.addEventListener("change", f); setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => { clearInterval(t); m.removeEventListener("change", f); }; }, []);
  useEffect(() => { save("td.cfg8", { sym, strat, tfs, inds, tf, usd: 1 }); }, [sym, strat, tfs, inds, tf]);

  /* секунд тутмын үнэ: SSE, тасарвал 4 сек тутам татна */
  useEffect(() => {
    let es: EventSource | null = null, ws: WebSocket | null = null, alive = true, got = 0, base: Tick | null = null, tradePx = 0, tradeAt = 0, pending: Tick | null = null, shown = 0, timer: ReturnType<typeof setTimeout> | null = null, retry: ReturnType<typeof setTimeout> | null = null;
    const direct = DIRECT[sym];
    const on = (t: Tick) => { if (!alive) return; const n = Date.now(); got = n; if (t.px !== lastPx.current.px) lastPx.current = { px: t.px, at: n }; setTick({ ...t, got: n, moved: lastPx.current.at }); };
    /* эхний арилжаа шууд дэлгэцэнд гарна, дараалсан арилжаа 100 мс тутамд нэгтгэгдэж хамгийн сүүлийн үнэ үлдэнэ */
    const flush = () => { timer = null; if (pending) { const x = pending; pending = null; shown = Date.now(); on(x); } };
    const trade = (px: number, t: number) => { tradePx = px; tradeAt = Date.now(); if (!base) return; pending = { ...base, px, t }; if (timer) return; const wait = shown + 100 - tradeAt; if (wait <= 0) flush(); else timer = setTimeout(flush, wait); };
    /* серверийн tick: шууд урсгал ажиллаж байвал үнэ нь биржийнх хэвээр, бусад талбар л шинэчлэгдэнэ */
    const feed = (t: Tick) => { base = t; on(tradePx && Date.now() - tradeAt < 3000 ? { ...t, px: tradePx } : t); };
    const openWs = () => {
      if (!direct || !alive || document.hidden) return;
      ws?.close();
      const c = new WebSocket(direct.url);
      ws = c;
      c.onopen = () => { if (direct.sub) c.send(direct.sub); };
      c.onmessage = (e) => { try { const r = direct.read(JSON.parse(e.data) as WsMsg); if (r && r.px > 0) trade(r.px, r.t); } catch { /* дараагийн арилжаа */ } };
      c.onclose = () => { if (ws === c && alive) { ws = null; retry = setTimeout(openWs, 3000); } };
    };
    const open = () => { es?.close(); es = new EventSource(`/api/trader-agent/desk/live?sym=${sym}`); es.onmessage = (e) => { try { feed(JSON.parse(e.data) as Tick); } catch { /* дараагийн tick */ } }; openWs(); };
    const vis = () => { if (document.hidden) { es?.close(); es = null; const c = ws; ws = null; c?.close(); } else open(); };
    lastPx.current = { px: 0, at: 0 }; setTick(null); open();
    document.addEventListener("visibilitychange", vis);
    const back = setInterval(async () => { if (document.hidden || Date.now() - got < 4000) return; try { const r = await fetch(`/api/trader-agent/desk?q=price&sym=${sym}`, { cache: "no-store" }); if (r.ok) on(await r.json()); } catch { /* дараагийн удаа */ } }, 4000);
    return () => { alive = false; es?.close(); ws?.close(); if (timer) clearTimeout(timer); if (retry) clearTimeout(retry); clearInterval(back); document.removeEventListener("visibilitychange", vis); };
  }, [sym]);

  /* лаа, индикатор 15 сек тутам; секунд хооронд tick хөдөлгөнө */
  useEffect(() => {
    let alive = true;
    const b = async () => { if (document.hidden) return; try { const r = await fetch(`/api/trader-agent/desk?sym=${sym}&tf=${tf}&ind=${indQ}`, { cache: "no-store" }), j = await r.json(); if (!alive) return; if (r.ok) { setData({ ...j, key: dataKey }); setLoadErr(""); } else setLoadErr(j.error || "Лаа ачаалж чадсангүй — дахин оролдож байна"); } catch { if (alive) setLoadErr("Сүлжээний алдаа — дахин оролдож байна"); } };
    setLoadErr(""); b();
    const t = setInterval(b, 15000), vis = () => { if (!document.hidden) b(); };
    document.addEventListener("visibilitychange", vis);
    return () => { alive = false; clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [sym, tf, indQ, dataKey]);
  useEffect(() => { let on = true; setNews(null); fetch(`/api/trader-agent/desk?q=weigh&sym=${sym}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((j) => { if (on) setNews(j); }).catch(() => {}); return () => { on = false; }; }, [sym]);
  useEffect(() => { const g = stages.current; return () => g.forEach(clearTimeout); }, []);

  const toggleTf = (t: string) => setTfs((c) => (c.includes(t) ? (c.length > 1 ? c.filter((x) => x !== t) : c) : c.length < 3 ? [...c, t] : [...c.slice(1), t]));
  const toggleInd = (id: string) => setInds((c) => (c.some((x) => x.id === id) ? c.filter((x) => x.id !== id) : [...c, { id, p: INDS.find((q) => q.id === id)?.p }]));
  const allInds = () => setInds((c) => INDS.map((q) => c.find((x) => x.id === q.id) ?? { id: q.id, p: q.p, hide: true }));
  const changeSym = (v: string) => { setSym(v); setRep(null); setStep(0); setMsgs([]); };
  const run = useCallback(async () => {
    if (step >= 1 && step <= 6) return;
    stages.current.forEach(clearTimeout); stages.current = [];
    /* чартын хугацаа хэрэглэгчийнх: түүнийг хэзээ ч өөрөө солихгүй, харин шинжилгээнд заавал оруулна */
    const use = tfs.includes(tf) ? tfs : [...tfs.slice(-2), tf];
    if (use !== tfs) setTfs(use);
    setStep(1); setErr(""); setMsgs([]);
    if (small) frame.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    try {
      const [r, w] = await Promise.all([fetch("/api/trader-agent/desk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sym, strat, tfs: use, inds }) }), fetch(`/api/trader-agent/desk?q=weigh&sym=${sym}`, { cache: "no-store" }).catch(() => null), wait(1000)]);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || `Алдаа (${r.status})`);
      if (w?.ok) setNews(await w.json());
      setRep(j);
      const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
      setStep(2);
      ([[1400, 3], [3000, 4], [3700, 5], [4300, 6], [4900, 7]] as const).forEach(([ms, n]) => stages.current.push(setTimeout(() => setStep(n), calm ? 0 : ms)));
    } catch (e) { setErr((e as Error).message); setStep(0); }
  }, [step, small, sym, tf, strat, tfs, inds]);
  const ask = async (text: string) => {
    const t = text.trim();
    if (!t || asking || !rep) return;
    const history = msgs.slice(-6);
    setMsgs((c) => [...c, { role: "user", text: t }]); setQ(""); setAsking(true);
    try {
      const r = await fetch("/api/trader-agent/desk/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sym, strat, tfs, inds, q: t, history }) }), j = await r.json();
      setMsgs((c) => [...c, { role: "ai", text: r.ok ? j.answer : j.error || "Хариулт ирсэнгүй" }]);
    } catch { setMsgs((c) => [...c, { role: "ai", text: "Сүлжээний алдаа — дахин оролдоно уу" }]); } finally { setAsking(false); }
  };

  const secs = useMemo(() => (rep?.sections || []).filter((x) => !x.empty), [rep]), sec = secs.find((x) => x.tf === tf) ?? null;
  const shown = useMemo(() => (data ? { ...data, inds: data.inds.filter((x) => !inds.find((q) => q.id === x.id)?.hide) } : null), [data, inds]);
  const subs = shown?.inds.filter((x) => x.pane === "sub").length ?? 0, height = (small ? 400 : 540) + subs * 78;
  const votes = useMemo(() => { const c = { up: 0, dn: 0, flat: 0 }; data?.inds.forEach((x) => { if ((x.vote ?? 0) > 0) c.up++; else if ((x.vote ?? 0) < 0) c.dn++; else c.flat++; }); return c; }, [data]);
  const liveState = !tick || !now ? "wait" : now - tick.got > 6000 ? "lost" : now - tick.moved > 240000 ? "closed" : "live";
  const liveTxt = { wait: "Холбогдож байна", lost: "Дахин холбогдож байна", closed: "Зах зээл хаалттай", live: "Live" }[liveState];
  const closeIn = now ? bucket(now, tf) + TF_MIN[tf] * 60000 - now : 0, spread = tick && tick.ask > tick.bid ? tick.ask - tick.bid : 0;
  const status = (n: number) => (step > n ? "done" : step === n ? "run" : "idle");
  const other = secs.find((x) => x.plan && x.tf !== tf) ?? null, marks = sec?.draw?.marks.length ?? 0;
  const planTxt = (x: Sec) => `${x.tf} ${x.plan!.dir > 0 ? "Авах" : "Зарах"} · орох ${fx(x.plan!.entry, d)} · SL ${fx(x.plan!.sl, d)} · TP ${fx(x.plan!.tp1, d)} · ≈${x.plan!.rr}R${x.plan!.rr < 1 ? " (сул)" : ""}`;
  const firstPlan = secs.find((x) => x.plan), stepPlan = sec?.plan ? planTxt(sec) : firstPlan ? `${tf} ${sec ? "дээр төлөвлөгөө алга" : "хугацааг шинжлээгүй"}. ${planTxt(firstPlan)}` : "Энэ стратегид тохирох нөхцөл алга — албаар үүсгэхгүй.", indOf = (id: string) => data?.inds.find((x) => x.id === id);

  return (
    <div className={s.app}>
      <header className={s.top}>
        <span className={s.mark} aria-hidden="true">T</span>
        <select className={s.search} value={sym} aria-label="Хэрэгсэл" onChange={(e) => changeSym(e.target.value)}>{SYMS.map((x) => <option key={x.id} value={x.id}>{x.pair}</option>)}</select>
        <span className={s.live} data-s={liveState} title={`Эх сурвалж: ${S.src}`}><i /><em>{liveTxt}</em></span>
        <nav className={s.ver} aria-label="Хувилбар">{VERS.map((v) => (v.h === "/" ? <b key={v.h}>{v.t}</b> : <Link key={v.h} href={v.h} prefetch={false}>{v.t}</Link>))}</nav>
        <button type="button" className={s.out} onClick={() => signOut({ callbackUrl: `${window.location.origin}/` })}>Гарах</button>
      </header>

      <div className={s.shell}>
        <main className={s.main}>
          <section className={s.head}>
            <span className={s.coin}>{S.ic}</span>
            <div className={s.name}><h1>{S.mn}</h1><em>{S.pair}</em></div>
            <div className={s.px}><Price v={tick?.px ?? null} d={d} />{tick && <span data-d={tick.chg >= 0 ? "up" : "dn"}>{sg(tick.chg)}{tick.chg.toFixed(2)}% · 24ц</span>}{tick && tick.ask > tick.bid && <small className={s.ba}>Bid {fx(tick.bid, d)} · Ask {fx(tick.ask, d)}</small>}</div>
            <dl className={s.facts}>
              {spread > 0 && <div><dt>Spread</dt><dd>{fx(spread, d)}</dd></div>}
              <div><dt>Лаа хаагдах</dt><dd>{now ? left(closeIn) : "—"}</dd></div>
              <div><dt>Мэдээний эрсдэл</dt><dd className={s.risk} data-r={news?.risk}>{news ? RISK[news.risk] : "—"}</dd></div>
            </dl>
          </section>

          <section className={s.card} data-chart>
            <div className={s.bar}>
              <div className={s.tfRow} role="group" aria-label="Чартын хугацаа">{TFS.map((t) => { const q = secs.find((x) => x.tf === t); return <button key={t} type="button" aria-pressed={tf === t} data-a={q ? (q.plan ? dirOf(q.plan.dir) : "mid") : undefined} onClick={() => setTf(t)}>{t}</button>; })}</div>
              <div className={s.indWrap}>
                <button type="button" className={s.indBtn} aria-expanded={menu} onClick={() => setMenu((c) => !c)}>Индикатор <b>{inds.length}/18</b></button>
                {menu && <><button type="button" className={s.scrim} aria-label="Хаах" onClick={() => setMenu(false)} />
                  <div className={s.menu}>
                    <div className={s.menuTop}><button type="button" onClick={allInds}>Бүгдийг нэмэх</button><button type="button" onClick={() => setInds([])}>Цэвэрлэх</button></div>
                    {GROUPS.map(([g, ids]) => <div key={g}><h5>{g}</h5><div className={s.menuGrid}>{ids.map((id) => { const q = INDS.find((x) => x.id === id)!; return <button key={id} type="button" aria-pressed={inds.some((x) => x.id === id)} onClick={() => toggleInd(id)}>{q.mn}</button>; })}</div></div>)}
                    <p className={s.dim}>«Бүгдийг нэмэх» нь шинэ индикаторуудыг чартад нуугаад санал тоололтод оруулна. Чипийн нэр дээр дарж харуулна.</p>
                  </div></>}
              </div>
            </div>
            <div className={s.chipRow}>
              {!!inds.length && <div className={s.sum} title="Одоогийн лаан дээрх индикаторын санал"><Vote v={votes} /><span><em data-d="up">{votes.up}</em>/<em data-d="dn">{votes.dn}</em>/{votes.flat}</span></div>}
              {inds.map((x) => { const q = indOf(x.id), def = INDS.find((i) => i.id === x.id), vis = (shown?.inds.findIndex((i) => i.id === x.id) ?? -1), col = q?.pane === "price" && vis >= 0 ? PALETTE[vis % PALETTE.length] : undefined; return (
                <span key={x.id} className={s.chip} data-v={dirOf(q?.vote ?? 0)} data-off={x.hide || undefined}>
                  <button type="button" aria-pressed={!x.hide} title={q?.read ?? ""} onClick={() => setInds((c) => c.map((i) => (i.id === x.id ? { ...i, hide: !i.hide } : i)))}><i style={col ? { background: col } : undefined} />{q?.label ?? def?.mn}</button>
                  {def?.p && (gear === x.id ? <input type="number" min={2} max={400} value={x.p ?? def.p} aria-label={`${def.mn} үе`} autoFocus onBlur={() => setGear(null)} onChange={(e) => { const v = Math.max(2, Math.min(400, Number(e.target.value) || 2)); setInds((c) => c.map((i) => (i.id === x.id ? { ...i, p: v } : i))); }} /> : <button type="button" aria-label={`${def.mn} тохиргоо`} onClick={() => setGear(x.id)}><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path fill="currentColor" d="M8 5.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6Zm6.3 3.7.9.7-1.2 2.1-1.1-.4c-.4.3-.8.6-1.3.8L11.4 14H9l-.2-1.2h-1.6L7 14H4.6l-.2-1.9c-.5-.2-.9-.5-1.3-.8l-1.1.4L.8 9.6l.9-.7V7.1l-.9-.7L2 4.3l1.1.4c.4-.3.8-.6 1.3-.8L4.6 2H7l.2 1.2h1.6L9 2h2.4l.2 1.9c.5.2.9.5 1.3.8l1.1-.4 1.2 2.1-.9.7v1.8Z" /></svg></button>)}
                  <button type="button" aria-label={`${def?.mn} хасах`} onClick={() => toggleInd(x.id)}>×</button>
                </span>); })}
            </div>
            <div ref={frame}><DeskChart tf={tf} digits={d} viewKey={viewKey} data={shown} tick={tick} draw={sec?.draw ?? null} plan={sec?.plan ?? null} runKey={`${rep?.now ?? 0}:${tf}`} scanning={step === 1} scanText={`${tfs.join(" · ")} уншиж байна`} height={height} loadErr={loadErr} /></div>
            <p className={s.foot}>{liveState === "closed" ? "Зах зээл хаалттай — сүүлийн ханш харагдаж байна. " : ""}Ханш ба сүүлийн лаа нэг tick-ээс шинэчлэгдэнэ · {S.src}{rep && !sec ? " · Энэ хугацааг шинжлээгүй" : ""}{sec ? " · Шинжилгээ хаагдсан лаанаас" : ""}{sec && !sec.plan && other ? <> · <button type="button" className={s.toPlan} onClick={() => setTf(other.tf)}>{other.tf} төлөвлөгөө харах</button></> : null}</p>
          </section>
        </main>

        <aside className={s.agent} aria-label="Агент">
          <div className={s.agHead}><h3>Агент</h3><span>{inds.length} индикатор · {tfs.length} хугацаа</span></div>
          <ol className={s.steps} data-p={Math.min(step, 7)}>
            <li data-s={status(1)}><i>01</i><div><b>{STEPS[0].t}</b><p>{secs.length ? secs.map((x) => `${x.tf} ${x.state}`).join(" · ") : STEPS[0].d}</p><div className={s.chips} role="group" aria-label="Шинжлэх хугацаа">{TFS.map((t) => <button key={t} type="button" aria-pressed={tfs.includes(t)} onClick={() => toggleTf(t)}>{t}</button>)}</div></div></li>
            <li data-s={status(2)}><i>02</i><div><b>{STEPS[1].t}</b><p>{step > 1 && sec ? `${sec.tf} дээр ${marks} тэмдэг, ${sec.draw.trends.length} трендийн шугам${sec.pattern ? " · загвар илэрсэн" : ""}` : STEPS[1].d}</p></div></li>
            <li data-s={status(3)}><i>03</i><div><b>{STEPS[2].t}</b><p>{step > 2 ? stepPlan : STEPS[2].d}</p>
              <div className={s.seg} role="group" aria-label="Стратеги">{STRATS.map((x) => <button key={x.id} type="button" aria-pressed={strat === x.id} title={x.sub} onClick={() => setStrat(x.id)}>{x.mn}</button>)}</div><small className={s.segSub}>{STRATS.find((x) => x.id === strat)?.sub}</small></div></li>
            <li data-s={status(4)}><i>04</i><div><b>{STEPS[3].t}</b><p>{step > 3 && news ? news.text : STEPS[3].d}</p></div></li>
            <li data-s={status(5)}><i>05</i><div><b>{STEPS[4].t}</b><p>{STEPS[4].d}</p>
              {step > 4 && <div className={s.qa}>
                {!!msgs.length && <div className={s.msgs} aria-live="polite">{msgs.map((m, k) => <p key={k} data-r={m.role}>{m.text}</p>)}{asking && <p data-r="ai" className={s.typing}>Бодож байна…</p>}</div>}
                {!msgs.length && <div className={s.quick}>{QUICK.map((t) => <button key={t} type="button" onClick={() => ask(t)}>{t}</button>)}</div>}
                <form onSubmit={(e) => { e.preventDefault(); ask(q); }}><input value={q} onChange={(e) => setQ(e.target.value)} maxLength={600} placeholder="Асуултаа бичнэ үү" aria-label="Асуулт" /><button type="submit" disabled={asking || !q.trim()}>Асуух</button></form>
              </div>}</div></li>
            <li data-s={status(6)}><i>06</i><div><b>{STEPS[5].t}</b><p>{step > 5 && rep?.learn ? `${rep.learn.total} төлөвлөгөө бүртгэсэн · ${rep.learn.fired} идэвхжсэн · TP ${rep.learn.tp} · SL ${rep.learn.sl}` : STEPS[5].d}</p></div></li>
          </ol>
          <div className={s.goBox}>
            <button type="button" className={s.go} onClick={run} disabled={busy} data-busy={busy || undefined}>{busy ? `${STEPS[Math.min(step, 6) - 1].t}…` : step === 7 ? "Дахин шинжлэх" : `${S.pair} шинжлэх`}</button>
            {err && <p className={s.err} role="alert">{err}</p>}
          </div>
        </aside>

        <div className={s.rest}>
          {rep && step >= 2 && <Report rep={rep} secs={secs} sec={sec} tf={tf} d={d} news={news} pick={setTf} useStrat={setStrat} />}
          <p className={s.disc}>Tesla Trader нь техник шинжилгээ, сургалтын хэрэгсэл — <b>санхүүгийн зөвлөгөө биш</b>. Төлөвлөгөө нь бодит лаанаас тооцсон нөхцөлт хувилбар, хэмжилт нь өнгөрсөн дата. Арилжаа автоматаар хийгдэхгүй. Ханш: Dukascopy, Swissquote, Binance.</p>
        </div>
      </div>
    </div>
  );
}
