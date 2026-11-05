"use client";

import { useEffect, useState } from "react";
import { programDay, type ProgramWeek as PW } from "@/lib/programWeek";
import s from "./ProgramWeek.module.css";

/* ─── «Day N / 7» — нэгдсэн хөтөлбөрийн явц ─────────────────────────────────
   Эхлэх өдөр, хоногийн тоо, өдөр бүрийн сэдэв нь /admin/hero дээр засагдана
   (SiteSettings `program_week`). Хөтөлбөр дуусмагц эсвэл админ унтраамагц
   карт өөрөө алга болно — хуучирсан «Day 7» нүүрэнд үлдэхгүй.

   Өнгө нь CSS module-д ШУУД бичигдсэн: theme-day генератор Tailwind
   классыг л хөрвүүлдэг, module-ийг хөндөхгүй. */

export default function ProgramWeek({ compact = false }: { compact?: boolean }) {
  const [p, setP] = useState<PW | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/program-week")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && d?.program && setP(d.program))
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!p || !p.active) return null;
  const info = programDay(p);
  if (info.state === "done") return null;

  const live = info.state === "live";
  const range = `${info.dates[0]} – ${info.dates[info.dates.length - 1]}`;
  const today = live ? p.items[info.day - 1] : "";
  const hasTopics = p.items.some(Boolean);

  const cells = (
    <ol className={s.cells} style={{ "--n": Math.min(p.days, 10) } as React.CSSProperties} aria-label="Өдрүүд">
      {info.dates.map((d, i) => {
        const n = i + 1;
        const st = !live ? "next" : n < info.day ? "past" : n === info.day ? "now" : "next";
        return (
          <li key={n} className={s.cell} data-st={st} title={p.items[i] || undefined} aria-current={st === "now" ? "step" : undefined}>
            <b>D{n}</b>
            {!compact && <span>{d}</span>}
          </li>
        );
      })}
    </ol>
  );

  if (compact) {
    return (
      <section className={`${s.card} ${s.compact}`} aria-label={p.title}>
        <div className={s.row}>
          <div className={s.big}>
            {live ? <>Day {info.day}<small>/{p.days}</small></> : <>{info.startsIn}<small> өдөр</small></>}
          </div>
          <div className={s.meta}>
            <div className={s.eyebrow}>{p.title} · {range}</div>
            {(today || !live) && (
              <div className={s.today}>
                {live ? <>Өнөөдөр: <b>{today}</b></> : `${info.dates[0]}-нд эхэлнэ`}
              </div>
            )}
          </div>
        </div>
        {cells}
      </section>
    );
  }

  return (
    <section className={s.card} aria-label={p.title}>
      <div className={s.head}>
        <span className={s.badge} data-live={live || undefined}>
          {live && <i aria-hidden />}
          {live ? "Явагдаж байна" : `${info.startsIn} өдрийн дараа эхэлнэ`}
        </span>
        <span className={s.range}>{range}</span>
      </div>
      <h2 className={s.title}>
        {live ? <>Day {info.day} <small>/ {p.days}</small></> : p.title}
      </h2>
      {live && <p className={s.sub}>{p.title}</p>}
      {cells}
      {/* Сэдвийн жагсаалт өнөөдрийг өөрөө тодруулна — тусдаа «Өнөөдөр:» мөр давхардал болно. */}
      {hasTopics && (
        <ol className={s.topics}>
          {p.items.map((t, i) =>
            t ? (
              <li key={i} data-now={live && i + 1 === info.day ? "" : undefined}>
                <span>Day {i + 1}</span>
                {t}
              </li>
            ) : null
          )}
        </ol>
      )}
    </section>
  );
}
