"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Chart, Shot, type A } from "./GoldApp";
import g from "./gold.module.css";
import s from "./five.module.css";

/* ─── TESLA TRADER v6 · 5 SCAN (2026-11-05) ──────────────────────────────────
   Алтыг таван өөр аргаар нэг мөчид сканнердаж (lib/gold/scans.ts), дундаж, санал нийлэлт, 30 минутын
   хүрээ ба таамгийн бүсийг нэг хуудсанд гаргана. Хуудас бүх тоог хэмжилттэй нь хамт харуулна: 4 сарын
   шалгалт + M5 хаалт бүрийн амьд бүртгэл. «Дундаж» чиглэлийг сайжруулаагүй бол хуудас ингэж л хэлнэ. */

type Vote = { k: string; mn: string; v: number; txt: string };
type Stat = { id: string; mn: string; active: number; hit: number; ic: number; h1: number; h2: number };
type Rule = { k: number; n: number; hit: number; trades: number; tp1: number; exp: number | null; se: number | null; h1: number | null; h2: number | null; totalR: number; on: boolean };
type Five = {
  con: { mean: number; sd: number; up: number; dn: number; dir: number; agree: number; against: number; label: string };
  scans: { id: string; mn: string; sub: string; score: number; active: number; votes: Vote[]; range: number | null; rangeSrc: string; stat: Stat | null }[];
  trail: { t: number; m: number }[];
  range: null | { preds: number[]; avg: number; band: { lo: number; hi: number }; noiseStop: number; touch: { d: number; p: number }[] };
  report: null | { fittedAt: number; from: number; to: number; n: number; base: number; scans: Stat[]; mean: Stat; rules: Rule[]; corr: number[][]; neff: number; calib: { lo: number; hi: number; n: number; pUp: number }[]; on: boolean; onK: number };
  rangeStat: null | { src: string[]; r2: number[]; ape: number[]; w: number[]; r2Eq: number; apeEq: number; r2W: number; apeW: number; band80: number; n: number };
  live: null | { n: number; from: number | null; scans: { id: string; n: number; hit: number | null }[]; mean: { n: number; hit: number | null }; strong: { n: number; hit: number | null }; rangeApe: number | null };
};
type R = A & { five: Five };

/* Судалгаа: бүтээгдэхүүн бүр нүүр хуудсандаа ЮУ нэрлэсэн (2026-11-05 шалгасан) ба ямар scan-д орсон */
const SOURCES = [
  { name: "GPTChart.ai", named: "EMA, SMA, RSI, MACD, Stochastic, KST, DPO, Bollinger, %B, ATR, ADX, Ichimoku, VWAP, SAR, Supertrend, MFI, RelVol, A/D · BOS, Liquidity Sweep, SMC", to: "1 · 4" },
  { name: "ChartScanner.ai", named: "MACD (хистограм, огтлолцол, зөрөлт), Фибоначчи 23.6–61.8%, S/R, момент, олон хугацаа, Volume profile, Weinstein стадий, 29 загвар", to: "2" },
  { name: "OneRoyal (Autochartist · Acuity)", named: "Гол түвшин, тэгш өнцөгт, Фибоначчи, ABCD, Gartley, Butterfly, хэлбэлзлийн таамаг, пивот, үнийн тренд, эдийн засгийн календарь", to: "3 · 5" },
  { name: "TraderSignal.ai", named: "Индикатор нэрлээгүй — MT4/MT5 автомат арилжаа, «10×» гэсэн баталгаагүй мэдэгдэл", to: "—" },
];
const VERS = [{ h: "/", t: "v4" }, { h: "/2", t: "v5" }, { h: "/3", t: "v6" }, { h: "/4", t: "v7" }];
const DEC = { BUY: "BUY · АВАХ", SELL: "SELL · ЗАРАХ", WAIT: "ХҮЛЭЭХ" };
const f2 = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? n.toFixed(2) : "—");
const sg = (n: number) => (n > 0 ? "+" : "");
const ub = (t: number) => new Date(t).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ulaanbaatar" });
const ubDate = (t: number) => new Date(t).toLocaleDateString("mn-MN", { month: "2-digit", day: "2-digit", timeZone: "Asia/Ulaanbaatar" });
const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${n}%`);
const xp = (v: number) => `${((Math.max(-1, Math.min(1, v)) + 1) / 2) * 100}%`;
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file), k = Math.min(1, 1800 / Math.max(bmp.width, bmp.height));
    if (k === 1 && file.size < 1.5e6) return file;
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b || file), "image/jpeg", 0.9));
  } catch { return file; }
}

function ScanCard({ x, i, open, onToggle }: { x: Five["scans"][number]; i: number; open: boolean; onToggle: () => void }) {
  const act = x.votes.filter((v) => v.v).sort((a, b) => Math.abs(b.v) - Math.abs(a.v)), dir = x.score >= 0.15 ? "up" : x.score <= -0.15 ? "dn" : "";
  return (
    <article className={s.scan} data-d={dir || undefined}>
      <header><span>{i + 1}</span><div><b>{x.mn}</b><em>{x.sub}</em></div></header>
      <div className={s.scanRow}><strong data-d={dir || undefined}>{dir === "up" ? "▲ Өсөх" : dir === "dn" ? "▼ Унах" : "• Саармаг"}</strong><code>{sg(x.score)}{x.score.toFixed(2)}</code></div>
      <div className={s.bar}><u style={{ [x.score >= 0 ? "left" : "right"]: "50%", width: `${Math.abs(x.score) * 50}%` }} data-up={x.score >= 0 || undefined} /></div>
      <ul className={s.votes}>{(open ? x.votes : act.slice(0, 3)).map((v) => <li key={v.k} data-d={v.v > 0 ? "up" : v.v < 0 ? "dn" : undefined}><span>{v.mn}</span><em>{v.txt}</em></li>)}</ul>
      <button type="button" className={s.more} onClick={onToggle}>{open ? "Хураах" : `Бүх ${x.votes.length} хэмжүүр`}</button>
      <footer><span>Түүхэнд зөв <b>{pct(x.stat?.hit)}</b></span><span>Хүрээ <b>${f2(x.range)}</b></span></footer>
    </article>
  );
}

export default function FiveApp() {
  const [a, setA] = useState<R | null>(null);
  const [busy, setBusy] = useState<"" | "live" | "image">("");
  const [step, setStep] = useState(0);
  const [err, setErr] = useState("");
  const [px, setPx] = useState<{ bid: number; ask: number; spread: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const file = useRef<HTMLInputElement>(null), result = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      if (document.hidden) return;
      try { const r = await fetch("/api/trader-agent/five?q=price", { cache: "no-store" }), d = await r.json(); if (alive && r.ok && d?.bid) setPx(d); } catch { /* дараагийн удаа */ }
    };
    tick(); const t = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const run = useCallback(async (img?: File) => {
    if (busy) return;
    setBusy(img ? "image" : "live"); setErr(""); setStep(0);
    const iv = setInterval(() => setStep((x) => Math.min(5, x + 1)), img ? 4000 : 500);
    try {
      let r: Response;
      if (img) { const fd = new FormData(); fd.append("image", await shrink(img), "chart.jpg"); r = await fetch("/api/trader-agent/five", { method: "POST", body: fd }); }
      else r = await fetch("/api/trader-agent/five", { cache: "no-store" });
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

  const mid = px ? (px.bid + px.ask) / 2 : a ? (a.price.bid + a.price.ask) / 2 : 0, F = a?.five, R = F?.report, RS = F?.rangeStat;
  const rule = R && F ? R.rules.find((x) => x.k === Math.min(5, Math.max(2, F.con.agree))) : null;
  const best = R ? Math.max(...R.scans.map((x) => x.hit)) : 0, r2Avg = RS ? RS.r2.reduce((p, x) => p + x, 0) / RS.r2.length : 0;

  return (
    <div className={g.app} onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop} data-drag={drag || undefined}>
      <header className={g.top}>
        <div className={g.brand}><span className={g.mark}>T</span><div className={s.brandTxt}><b>TESLA TRADER</b><em>5 SCAN · XAU/USD</em></div></div>
        <nav className={s.ver} aria-label="Хувилбар">{VERS.map((v) => v.h === "/3" ? <b key={v.h}>{v.t}</b> : <Link key={v.h} href={v.h} prefetch={false}>{v.t}</Link>)}</nav>
        <div className={g.tick}><b>{mid ? f2(mid) : "—"}</b><span>{px ? `${f2(px.bid)} / ${f2(px.ask)} · $${f2(px.spread)}` : "ханш ачаалж байна"}</span></div>
        <button type="button" className={g.out} onClick={() => signOut({ callbackUrl: `${window.location.origin}/` })}>Гарах</button>
      </header>

      <main className={g.main}>
        <section className={g.hero}>
          <p className={g.kicker}>АЛТ · ТАВАН SCAN ЗЭРЭГ</p>
          <h1>{mid ? `$${f2(mid)}` : "XAU/USD"}</h1>
          <p className={g.sub}>Нэг товчоор таван өөр аргаар нэг мөчид сканнердаж, дундаж ба санал нийлэлтийг гаргана. Тоо бүрийг хэр зөв байсных нь хэмжилттэй хамт харуулна.</p>
          <div className={g.cta}>
            <button type="button" className={g.go} onClick={() => run()} disabled={!!busy}>{busy === "live" ? <><i className={g.spin} />Сканнердаж байна</> : <>⚡ 5 SCAN</>}</button>
            <button type="button" className={g.img} onClick={() => file.current?.click()} disabled={!!busy}>{busy === "image" ? <><i className={g.spin} />Зураг уншиж байна</> : "Графикийн зураг оруулах"}</button>
            <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          </div>
          <p className={g.hint}>Зураг оруулбал AI түвшнийг дээр нь давхарлана. Таван scan-ийн оноог бодит ханш гаргана.</p>
          {busy && <ol className={g.steps}>{["Индикаторын зөвлөл", "Загвар ба момент", "Түвшин ба гармоник", "SMC · хөрвөх чадвар", "Тренд ба DXY", "Дундаж ба хэмжилт"].map((t, i) => <li key={t} data-s={i < step ? "done" : i === step ? "on" : ""}><i />{t}</li>)}</ol>}
          {err && <p className={g.err}>{err}</p>}
        </section>

        {a && F && (
          <div className={g.result} ref={result}>
            <section className={g.dec} data-d={a.decision}>
              <div className={g.decTop}>
                <div>
                  <span className={g.meta}>{ub(a.barT)} M5 хаалт · {a.sessionMn} · дундаж: {F.con.label}</span>
                  <b className={g.decTxt}>{DEC[a.decision]}</b>
                </div>
                <span className={s.agree} data-n={F.con.agree}><b>{F.con.agree}/5</b>санал нийлсэн</span>
              </div>
              <p className={g.reason}>{a.reason}</p>
              <div className={s.meter}>
                <div className={s.track}>
                  <i className={s.zero} />
                  {F.scans.map((x, k) => <span key={x.id} className={s.pt} data-row={k % 2 || undefined} style={{ left: xp(x.score) }} title={x.mn}>{k + 1}</span>)}
                  <b className={s.avg} style={{ left: xp(F.con.mean) }} aria-label={`Дундаж ${F.con.mean}`} />
                </div>
                <div className={s.scale}><span>Унах −1</span><span>0</span><span>Өсөх +1</span></div>
              </div>
              <p className={s.line}>Дундаж <b>{sg(F.con.mean)}{F.con.mean.toFixed(2)}</b> · тархалт ±{F.con.sd.toFixed(2)} · дараагийн 30 минутад өсөх магадлал <b>{a.pUp}%</b>{rule ? <> · {F.con.agree}+/5 санал нийлэлт түүхэнд <b>{rule.hit}%</b> зөв</> : null}</p>
              {R && !R.on && <p className={s.truth}>{R.n.toLocaleString("en-US")} дээж дээр 5 scan-ийн дундаж {R.mean.hit}% зөв, хамгийн сайн ганц scan {best}%. Spread давах давуу тал батлагдаагүй тул систем BUY/SELL хэлэхгүй — хүрээний таамгийг ашиглаарай.</p>}
              {a.plan && <div className={g.lv}><div><span>Entry</span><b>{f2(a.plan.entry)}</b></div><div data-k="sl"><span>Stop</span><b>{f2(a.plan.sl)}</b><em>${f2(a.plan.risk)} · −1R</em></div><div data-k="tp"><span>TP1 · 50%</span><b>{f2(a.plan.tp1)}</b><em>+1R</em></div><div data-k="tp"><span>TP2</span><b>{f2(a.plan.tp2)}</b><em>+2R</em></div></div>}
            </section>

            {F.range && (
              <section className={g.vol}>
                <div className={`${g.volTop} ${s.volTop}`}>
                  <div><span>30 минутын дараах үнэ (80% бүс)</span><b className={s.band}>{f2(F.range.band.lo)} – {f2(F.range.band.hi)}</b><em>одоогийн үнээс ±${f2(F.range.avg * (RS?.band80 ?? 0))}</em></div>
                  <div><span>Хүлээгдэх хүрээ · 5 таамгийн дундаж</span><b>${f2(F.range.avg)}</b><em>шуугиан давах SL ≥ ${f2(F.range.noiseStop)}</em></div>
                </div>
                <table className={g.touch}>
                  <thead><tr><th>Зай (SL эсвэл TP)</th>{F.range.touch.map((t) => <th key={t.d}>${t.d}</th>)}</tr></thead>
                  <tbody><tr><th>30 минутад хүрэх магадлал</th>{F.range.touch.map((t) => <td key={t.d}>{t.p}%</td>)}</tr></tbody>
                </table>
              </section>
            )}

            <div className={s.scans}>{F.scans.map((x, i) => <ScanCard key={x.id} x={x} i={i} open={!!open[x.id]} onToggle={() => setOpen((o) => ({ ...o, [x.id]: !o[x.id] }))} />)}</div>

            {a.image && (
              <section className={g.card}>
                <h3>Таны зураг <small>{a.read?.timeframe ? `${a.read.timeframe} · ` : ""}AI уншилт + бодит түвшин</small></h3>
                <Shot a={a} />
                {!!a.warnings?.length && <ul className={g.warn}>{a.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
                {a.read?.structure && <p className={g.note}>{a.read.structure}</p>}
              </section>
            )}

            <Chart a={a} />

            {R && (
              <section className={g.card}>
                <h3>Хэмжилт <small>{ubDate(R.from)}–{ubDate(R.to)} · {R.n.toLocaleString("en-US")} дээж · дүрэм тогтмол, энэ датан дээр тохируулаагүй</small></h3>
                <div className={s.scroll}>
                  <table className={s.tbl}>
                    <thead><tr><th>Scan</th><th>Идэвх</th><th>Чиглэл зөв</th><th>1-р хагас</th><th>2-р хагас</th><th>IC</th><th>Хүрээ R²</th><th>Амьд</th></tr></thead>
                    <tbody>
                      {R.scans.map((x, k) => <tr key={x.id}><th>{k + 1}. {x.mn}</th><td>{x.active}%</td><td>{x.hit}%</td><td>{x.h1}%</td><td>{x.h2}%</td><td>{x.ic}</td><td>{RS?.r2[k] ?? "—"}<small>{RS?.src[k]}</small></td><td>{pct(F.live?.scans[k]?.hit)}<small>{F.live?.scans[k]?.n ?? 0}</small></td></tr>)}
                      <tr data-sum><th>5 scan-ийн дундаж</th><td>{R.mean.active}%</td><td>{R.mean.hit}%</td><td>{R.mean.h1}%</td><td>{R.mean.h2}%</td><td>{R.mean.ic}</td><td>{RS?.r2W ?? "—"}<small>жинтэй · тэнцүү {RS?.r2Eq}</small></td><td>{pct(F.live?.mean.hit)}<small>{F.live?.mean.n ?? 0}</small></td></tr>
                    </tbody>
                  </table>
                </div>
                <div className={s.scroll}>
                  <table className={s.tbl}>
                    <thead><tr><th>Санал нийлэлт</th><th>Тохиолдол</th><th>Чиглэл зөв</th><th>Арилжаа</th><th>Дундаж (spread хассан)</th><th>1 / 2-р хагас</th><th>Дүн</th></tr></thead>
                    <tbody>{R.rules.map((x) => <tr key={x.k}><th>{x.k}+ / 5</th><td>{x.n.toLocaleString("en-US")}</td><td>{x.hit}%</td><td>{x.trades}</td><td data-up={(x.exp ?? 0) > 0 || undefined} data-dn={(x.exp ?? 0) < 0 || undefined}>{sg(x.exp ?? 0)}{f2(x.exp)}R<small>±{f2(x.se)}</small></td><td>{f2(x.h1)} / {f2(x.h2)}</td><td>{x.on ? "Эерэг" : "Давуу талгүй"}</td></tr>)}</tbody>
                  </table>
                </div>
                <ul className={s.finds}>
                  <li><b>Чиглэл:</b> таван scan {Math.min(...R.scans.map((x) => x.hit))}–{best}% зөв, дундаж {R.mean.hit}%. {R.mean.hit > best ? "Дундаж хамгийн сайн ганц scan-аас дээгүүр байна." : "Дундаж хамгийн сайн ганц scan-аас сайжраагүй."} 50% нь зоос шидэхтэй ижил.</li>
                  <li><b>Яагаад:</b> таван scan нэг үнээс гардаг тул бодитоор ≈{R.neff} бие даасан дохио.{Math.abs(R.mean.ic) < 0.03 ? " Хамгийн гол нь дохио тус бүрт ирээдүйн чиглэлийн мэдээлэл бараг алга (IC ≈ 0) — тэгийг дундажлавал тэг." : ""}</li>
                  {RS && <li><b>Хүрээ:</b> энд дундажлах ажилладаг. Таван эх үүсвэр дунджаар R² {r2Avg.toFixed(2)} байхад нэгтгэсэн жинтэй дундаж {RS.r2W} ({RS.n.toLocaleString("en-US")} шинэ таамаг, дундаж алдаа {RS.apeW}%). Хамгийн сайн ганц эх үүсвэр {Math.max(...RS.r2)}.</li>}
                  <li><b>Амьд туршилт:</b> M5 хаалт бүрт 5 оноог бүртгэж, 30 минутын дараа бодит үнээр шалгана. {F.live?.n ? `Одоогоор ${F.live.n} таамаг: дундаж ${pct(F.live.mean.hit)} зөв, 4+/5 үед ${pct(F.live.strong.hit)} (${F.live.strong.n}).` : "Бүртгэл дөнгөж эхэлсэн."} Сүүлд {ub(R.fittedAt)}-д хэмжсэн, 12 цаг тутам шинэчлэгдэнэ.</li>
                </ul>
              </section>
            )}

            <section className={g.card}>
              <h3>Индикатор хаанаас ирсэн <small>бүтээгдэхүүн бүр нүүр хуудсандаа нэрлэсэн зүйл</small></h3>
              <div className={s.scroll}><table className={s.src}><thead><tr><th>Бүтээгдэхүүн</th><th>Нэрлэсэн арга</th><th>Scan</th></tr></thead><tbody>{SOURCES.map((x) => <tr key={x.name}><th>{x.name}</th><td>{x.named}</td><td>{x.to}</td></tr>)}</tbody></table></div>
              <p className={g.expl}>Аргын нэрс л авсан, тэдний код, жин, өгөгдлийг мэдэхгүй тул эдгээр нь тэдний бүтээгдэхүүний гүйцэтгэлийг төлөөлөхгүй. «94% итгэлцэл», «60% win rate» гэх мэт тоонуудад арга зүй, хөндлөнгийн шалгалт нүүр хуудсанд нь олдоогүй.</p>
            </section>

            <div className={g.grid}>
              <section className={g.card}>
                <h3>Шүүлтүүр <small>нэг нь ч ✗ бол арилжаа хийхгүй</small></h3>
                <ul className={g.gates}>{a.gates.map((x) => <li key={x.key} data-s={!x.ok ? "bad" : x.warn ? "warn" : "ok"}><i>{!x.ok ? "✗" : x.warn ? "!" : "✓"}</i><div><b>{x.label}</b><span>{x.text}</span></div></li>)}</ul>
              </section>
              <section className={g.card}>
                <h3>Түлхүүр түвшин <small>одоогийн үнээс зай</small></h3>
                <ul className={g.lvl}>{a.levels.map((l) => <li key={l.k}><span>{l.label}</span><b>{f2(l.p)}</b><em data-up={l.dist > 0 || undefined} data-dn={l.dist < 0 || undefined}>{sg(l.dist)}{f2(l.dist)}</em></li>)}</ul>
              </section>
            </div>
            <button type="button" className={g.again} onClick={() => run()} disabled={!!busy}>{busy ? "…" : "⚡ Дахин 5 SCAN"}</button>
          </div>
        )}
        <p className={g.disc}>Tesla Trader нь техник шинжилгээ, сургалтын хэрэгсэл — <b>санхүүгийн зөвлөгөө биш</b>. Магадлал ба хэмжилтийн тоо нь өнгөрсөн датан дээрх дүн, ирээдүйг баталгаажуулахгүй. Ханш: Dukascopy (спот XAU/USD), spread: Swissquote — брокерынхоос бага зөрж болно.</p>
      </main>
    </div>
  );
}
