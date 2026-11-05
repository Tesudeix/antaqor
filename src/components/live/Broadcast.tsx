"use client";
import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import css from "./live.module.css";

/* ─── Шууд хичээл — үзэгчийн тал (2026-10-09 шинэчлэл) ────────────────────
   • Live эхэлмэгц ӨӨРӨӨ холбогдоно (өмнө нь "Шууд үзэх" товч дарах ёстой
     байв). Видео дуугүй эхэлнэ — хөтөч дуутай autoplay-г хориглодог.
   • Live биш үед: хамгийн ойрын хичээлийн том тоолуур + бусад товлолтын
     жагсаалт (олон товлолт). */

const Player = dynamic(() => import("./BroadcastPlayer"), {
  ssr: false,
  loading: () => <div className={css.stage}><p className={css.center}>Холбогдож байна…</p></div>,
});

export type Connection = { token: string; serverUrl: string; room: string; identity?: string; canChat?: boolean };
export type Schedule = { id?: string; title: string; startsAt: string; room?: string };
export type BroadcastState = {
  live: boolean; room: string | null; title: string; viewers: number; startedAt?: string | null;
  schedule?: Schedule | null; schedules?: Schedule[]; error?: string;
};

export function useBroadcast() {
  const [state, setState] = useState<BroadcastState>({ live: false, room: null, title: "Шууд хичээл", viewers: 0 });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const response = await fetch("/api/broadcast", { cache: "no-store" });
        const data = await response.json();
        if (alive) setState(data);
      } catch {
        if (alive) setState((s) => ({ ...s, error: "Холболт түр тасарлаа." }));
      }
    };
    void load();
    const timer = setInterval(load, 5000);
    return () => { alive = false; clearInterval(timer); };
  }, [tick]);
  /** Хуваарь өөрчилсний дараа шууд дахин уншуулах. */
  const refresh = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, refresh };
}

export async function broadcastRequest(body: Record<string, string>): Promise<Connection> {
  const response = await fetch("/api/broadcast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Холболт амжилтгүй.");
  return data;
}

/** "10 сарын 12 · 20:00" — Улаанбаатарын цагаар. */
export function formatUB(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ulaanbaatar", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", weekday: "short", hour12: false,
  }).formatToParts(new Date(iso));
  const p = (t: string) => parts.find((x) => x.type === t)?.value || "";
  const wd: Record<string, string> = { Mon: "Даваа", Tue: "Мягмар", Wed: "Лхагва", Thu: "Пүрэв", Fri: "Баасан", Sat: "Бямба", Sun: "Ням" };
  return `${p("month")} сарын ${p("day")} · ${wd[p("weekday")] || ""} · ${p("hour")}:${p("minute")}`;
}

function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearTimeout(first); clearInterval(t); };
  }, []);
  return now;
}

/** Том тоолуур: хоног · цаг · мин · сек. */
export function Countdown({ startsAt }: { startsAt: string }) {
  const now = useNow();
  if (now === null) return null;
  const s = Math.max(0, Math.floor((new Date(startsAt).getTime() - now) / 1000));
  if (s === 0) return <p className={css.when}>Эхлэх цаг боллоо · хөтлөгчийг хүлээж байна…</p>;
  const cells: [number, string][] = [[Math.floor(s / 86400), "ХОНОГ"], [Math.floor((s % 86400) / 3600), "ЦАГ"], [Math.floor((s % 3600) / 60), "МИН"], [s % 60, "СЕК"]];
  return (
    <div className={css.countdown} aria-label="Эхлэх хүртэл">
      {cells.filter(([v], i) => i > 0 || v > 0).map(([v, l]) => (
        <span key={l}>{String(v).padStart(2, "0")}<small>{l}</small></span>
      ))}
    </div>
  );
}

/** Хуучин нэр — гадны импорт эвдрэхгүйн тулд. */
export function ScheduleTime({ schedule }: { schedule: Schedule }) {
  return <div><p className={css.when}>{formatUB(schedule.startsAt)} · Улаанбаатар</p><Countdown startsAt={schedule.startsAt} /></div>;
}

export function SchedulePanel({ schedules }: { schedules: Schedule[] }) {
  const [next, ...rest] = schedules;
  return (
    <div className={css.panel}>
      <div className={css.eyebrow}>ШУУД ХИЧЭЭЛ · ХУВААРЬ</div>
      {next ? (
        <div className={css.next}>
          <span className={css.when}>Дараагийн live</span>
          <div className={css.nextTitle}>{next.title}</div>
          <span className={css.when}>{formatUB(next.startsAt)} · Улаанбаатар</span>
          <Countdown startsAt={next.startsAt} />
        </div>
      ) : (
        <div className={css.next}>
          <div className={css.nextTitle}>Дараагийн live удахгүй</div>
          <p className={css.muted}>Өдөр, цагийг энд зарлана. Live эхлэхэд энэ хуудас өөрөө тоглуулна.</p>
        </div>
      )}
      {rest.length > 0 && (
        <div className={css.list}>
          {rest.map((s) => (
            <div key={s.id || s.startsAt} className={css.item}>
              <div><div className={css.itemTitle}>{s.title}</div><div className={css.itemWhen}>{formatUB(s.startsAt)}</div></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LiveHero({ state }: { state: BroadcastState }) {
  return <BroadcastViewer state={state} compact />;
}

export function BroadcastViewer({ state, compact = false }: { state: BroadcastState; compact?: boolean }) {
  const [connection, setConnection] = useState<Connection | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setConnection(null); setError(""); }, [state.room]);

  const join = useCallback(async () => {
    setBusy(true); setError("");
    try { setConnection(await broadcastRequest({ action: "watch" })); }
    catch (e) { setError(e instanceof Error ? e.message : "Холболт амжилтгүй."); }
    finally { setBusy(false); }
  }, []);

  // Live эхэлмэгц өөрөө нэгдэнэ — нэг товшилт хэмнэнэ.
  useEffect(() => {
    if (state.live && !connection && !busy && !error) void join();
  }, [state.live, connection, busy, error, join]);

  if (state.live && connection) {
    return (
      <Player
        connection={connection}
        viewers={state.viewers}
        title={state.title}
        startedAt={state.startedAt ?? null}
        compact={compact}
        onDisconnected={() => setConnection(null)}
      />
    );
  }
  if (state.live) {
    return (
      <div className={`${css.stage} ${compact ? css.compact : ""}`}>
        <div className={css.center}>
          <span className={css.liveBadge}>LIVE</span>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#14151C" }}>{state.title}</div>
          {error ? (
            <>
              <p className={css.error}>{error}</p>
              <button className={css.primary} onClick={() => void join()} disabled={busy}>Дахин холбогдох</button>
            </>
          ) : <p>Холбогдож байна…</p>}
        </div>
      </div>
    );
  }
  return <SchedulePanel schedules={state.schedules ?? (state.schedule ? [state.schedule] : [])} />;
}

export { Player as BroadcastPlayer };
