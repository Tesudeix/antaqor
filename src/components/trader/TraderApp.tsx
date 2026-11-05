"use client";

import { useCallback, useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import ScalpTerminal from "./ScalpTerminal";
import TraderScanner from "./TraderScanner";
import s from "./scalp.module.css";

/* ─── TESLA TRADER v4 (2026-11-04) — скальп терминал ───
   Чат хасагдсан (эзний шийдвэр). Гурван таб: Скальп (бодит цагийн самбар) · Журнал (тоормостой) · Зураг (хуучин скан).
   trader.antaqor.com дээр сайтын цэс нуугдсан тул өөрийн дээд мөр + утсанд доод таб. */

type Trade = { _id: string; sym: string; play: string; dir: number; grade: string; entry: number; sl: number; tp1: number; tp2: number; rr2: number; costR: number; takenAt: string; outcome: { status: string; r?: number; net?: number; tp1?: boolean } };
type J = { trades: Trade[]; today: { n: number; win: number; r: number; streak: number; taken: number }; week: { n: number; win: number; r: number }; stop: string };
const OUT: Record<string, [string, string]> = { open: ["Нээлттэй", "open"], sl: ["SL −1R", "loss"], be: ["TP1 + BE", "win"], tp2: ["TP2", "win"], time: ["Цаг дууссан", "mut"], na: ["Шалгах боломжгүй", "mut"] };
const PLAY: Record<string, string> = { pullback: "Трендийн буцалт", fade: "Хүрээний эргэлт", breakout: "Сешний эвдрэл", manual: "Гараар" };
const dig = (sym: string) => (sym.endsWith("JPY") ? 3 : sym.startsWith("XAU") || sym === "ETHUSD" ? 2 : sym === "BTCUSD" ? 1 : 5);

function Journal({ tick }: { tick: number }) {
  const [j, setJ] = useState<J | null>(null);
  const [err, setErr] = useState("");
  const load = useCallback(async () => {
    try { const r = await fetch("/api/trader-agent/journal", { cache: "no-store" }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Алдаа"); setJ(d); } catch (e) { setErr((e as Error).message); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load, tick]);
  const del = async (id: string) => { await fetch(`/api/trader-agent/journal?id=${id}`, { method: "DELETE" }).catch(() => {}); load(); };
  const r = (x: number) => `${x > 0 ? "+" : ""}${x.toFixed(2)}R`;
  return (
    <section className={s.journal}>
      {err && <p className={s.err}>{err}</p>}
      {!j ? <div className={s.sk} /> : (
        <>
          {j.stop && <div className={s.stop}><b>ТООРМОС</b><p>{j.stop}</p></div>}
          <div className={s.jStats}>
            <div><span>Өнөөдөр</span><b data-up={j.today.r > 0 || undefined} data-dn={j.today.r < 0 || undefined}>{r(j.today.r)}</b><em>{j.today.n} хаагдсан · {j.today.win} ашигтай</em></div>
            <div><span>Дараалсан алдагдал</span><b data-dn={j.today.streak >= 2 || undefined}>{j.today.streak}</b><em>3 хүрвэл 1 цаг завсарла</em></div>
            <div><span>7 хоног</span><b data-up={j.week.r > 0 || undefined} data-dn={j.week.r < 0 || undefined}>{r(j.week.r)}</b><em>{j.week.n} арилжаа · {j.week.n ? Math.round((j.week.win / j.week.n) * 100) : 0}% ашигтай</em></div>
          </div>
          <p className={s.expl}>Үр дүнг таны брокер биш, бодит 1 минутын лаагаар ижил дүрмээр (TP1-д 50%, дараа нь орох цэг, {45} мин) тооцно — spread хассан. Өдрийн хязгаар −3R.</p>
          {j.trades.length === 0 ? <p className={s.dim}>Одоогоор арилжаа алга. Скальп табаас сигнал дээр «Авсан» дарна.</p> : (
            <ul className={s.jList}>
              {j.trades.map((t) => {
                const o = OUT[t.outcome?.status] || OUT.na, d = dig(t.sym);
                return (
                  <li key={t._id}>
                    <div><b>{t.sym} <span data-k={t.dir > 0 ? "buy" : "sell"}>{t.dir > 0 ? "BUY" : "SELL"}</span></b><small>{PLAY[t.play] || t.play}{t.grade ? ` · ${t.grade}` : ""} · {new Date(t.takenAt).toLocaleString("mn-MN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ulaanbaatar" })}</small></div>
                    <div className={s.jLv}>{t.entry.toFixed(d)} · SL {t.sl.toFixed(d)} · TP {t.tp1.toFixed(d)}/{t.tp2.toFixed(d)}</div>
                    <em data-k={o[1]}>{o[0]}{t.outcome?.net !== undefined && t.outcome.status !== "open" ? ` · ${r(t.outcome.net)}` : ""}</em>
                    <button type="button" onClick={() => del(t._id)} aria-label="Устгах">×</button>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

const TABS = [
  { k: "scalp", t: "Скальп", d: "M4 12h4l3-7 4 14 3-7h2" },
  { k: "journal", t: "Журнал", d: "M5 4h14v16H5zM9 8h6M9 12h6M9 16h4" },
  { k: "scan", t: "Зураг", d: "M4 8V5a1 1 0 011-1h3M16 4h3a1 1 0 011 1v3M20 16v3a1 1 0 01-1 1h-3M8 20H5a1 1 0 01-1-1v-3M4 12h16" },
] as const;

export default function TraderApp() {
  const [tab, setTab] = useState<string>("scalp");
  const [tick, setTick] = useState(0);
  const [clock, setClock] = useState("");
  useEffect(() => { try { const v = localStorage.getItem("ts.tab"); if (v && TABS.some((x) => x.k === v)) setTab(v); } catch { /* */ } }, []);
  useEffect(() => { try { localStorage.setItem("ts.tab", tab); } catch { /* */ } window.scrollTo({ top: 0 }); }, [tab]);
  useEffect(() => {
    const u = () => setClock(new Date().toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Ulaanbaatar" }));
    u(); const t = setInterval(u, 15_000); return () => clearInterval(t);
  }, []);
  const logout = () => signOut({ callbackUrl: `${window.location.origin}/` });
  return (
    <div className={s.app}>
      <header className={s.top}>
        <div className={s.brand}><span className={s.mark}>T</span><div><b>TESLA TRADER</b><em>SCALP TERMINAL</em></div></div>
        <nav className={s.dTabs} aria-label="Tesla Trader">{TABS.map((x) => <button key={x.k} type="button" aria-pressed={tab === x.k} onClick={() => setTab(x.k)}>{x.t}</button>)}</nav>
        <div className={s.topR}><span className={s.clock}>УБ {clock}</span><button type="button" className={s.logout} onClick={logout}>Гарах</button></div>
      </header>
      <main className={s.body}>
        {tab === "scalp" && <ScalpTerminal onTaken={() => setTick((x) => x + 1)} />}
        {tab === "journal" && <Journal tick={tick} />}
        {tab === "scan" && <TraderScanner embedded />}
        <p className={s.disc}>Tesla Trader нь техник шинжилгээ, сургалтын хэрэгсэл — <b>санхүүгийн зөвлөгөө биш</b>. Давуу талын тоо нь өнгөрсөн 28 хоногийн хэмжилт, ирээдүйг баталгаажуулахгүй. Ханш: Dukascopy (валют, алт), Binance (крипто) — брокерынхоос бага зөрж болно. Нэг арилжаанд дансныхаа 1%-иас илүүг бүү эрсдэлд оруул.</p>
      </main>
      <nav className={s.mTabs} aria-label="Tesla Trader">
        {TABS.map((x) => <button key={x.k} type="button" aria-pressed={tab === x.k} onClick={() => setTab(x.k)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d={x.d} /></svg>{x.t}</button>)}
        <button type="button" onClick={logout}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10" /></svg>Гарах</button>
      </nav>
    </div>
  );
}
