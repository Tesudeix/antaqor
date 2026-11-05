"use client";

import type { Seats } from "../types";
import Plans from "./Plans";
import s from "../agent.module.css";

/* Зочин — Antaqor Agent-ийн танилцуулга (2026-10-26). Туршилт/суудал байхгүй боллоо:
   хоёр багц л — Antaqor гишүүн (AI зураг + AI ихэр) ба Бизнес (99,000₮/сар). */
const STEPS: { n: string; t: string; d: string }[] = [
  { n: "1", t: "Багцаа сонго", d: "Гишүүн бол шууд эхэлнэ. Бизнес бол QPay-ээр төлөөд нээгдэнэ." },
  { n: "2", t: "Бизнесээ танилцуул", d: "Юу хийдэг, хэнд зориулдгаа 2 минутад бичнэ." },
  { n: "3", t: "Агент бичиж, нийтэлнэ", d: "Санаагаа нэг өгүүлбэрээр хэл — бэлэн пост, зураг гарна." },
];

export default function Landing({ seats }: { seats?: Seats }) {
  void seats;
  const cb = encodeURIComponent("/content-agent");
  return (
    <div className={s.app} style={{ display: "block" }}>
      <div className={s.land}>
        <header className={s.landTop}>
          <span className={s.orbSm}>A</span><b>Antaqor Agent</b><span style={{ flex: 1 }} />
          <a className={s.ghost} href={`/auth/signin?callbackUrl=${cb}`}>Нэвтрэх</a>
        </header>

        <section className={s.landHero}>
          <span className={s.landKicker}>AI зураг · AI ихэр · бизнесийн сошиал</span>
          <h1>Бүтээлээ AI-аар хий.<br />Бизнесээ AI-д хөтлүүл.</h1>
          <p>Antaqor-ийн гишүүд AI зураг, өөрийн AI ихрийг бүтээж community-д хуваалцана. Бизнесүүд пост бичүүлж, Facebook, Instagram, Threads-д автоматаар нийтэлнэ.</p>
        </section>

        <Plans guest />

        <section className={s.landSteps}>
          {STEPS.map((x) => <div key={x.n}><em>{x.n}</em><b>{x.t}</b><span>{x.d}</span></div>)}
        </section>

        <section className={s.landEnd}>
          <p className={s.muted}>Antaqor · antaqor.com</p>
        </section>
      </div>
    </div>
  );
}
