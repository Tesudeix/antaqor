"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { api, when, type Ctx } from "../types";
import s from "../agent.module.css";

/* Үр дүн — таамаг vs бодит (1/6/24 цаг), агент юу сурсан, хамгийн сайн постууд (сайжруулах). */
export default function Insights(ctx: Ctx) {
  const { st, reload, say, go } = ctx;
  const [busy, setBusy] = useState(false);
  const pub = st.posts.filter((p) => p.status === "published").sort((a, b) => +new Date(b.at) - +new Date(a.at)).slice(0, 30);
  const max = Math.max(1, ...pub.map((p) => Math.max(p.metrics.score, p.pred.score)));
  const lift = st.stats.avgPred ? st.stats.avgActual / st.stats.avgPred : 0;
  async function check() {
    setBusy(true);
    try { await api({ action: "run" }); say("Хяналт дууслаа — хэмжүүр шинэчлэгдлээ"); await reload(); } catch (e) { say((e as Error).message, true); } finally { setBusy(false); }
  }
  return (
    <div className={s.page}>
      <div className={s.pageHead}><div><h1>Үр дүн</h1><p>Агент цаг тутам хянаж, таамгаа бодит үр дүнтэй харьцуулж суралцана.{st.cfg.lastHourlyAt ? ` Сүүлд: ${when(st.cfg.lastHourlyAt).day} ${when(st.cfg.lastHourlyAt).time}` : ""}</p></div>
        <button className={s.btn} onClick={check} disabled={busy}>{busy ? <i className={s.spinB} /> : <Icon name="refresh" size={16} />}Одоо хянах</button></div>
      <div className={s.kpis}>
        <div className={s.kpi}><b>{st.stats.published}</b><span>Агентын нийтлэл</span></div>
        <div className={s.kpi}><b>{st.stats.avgActual || "—"}</b><span>Бодит дундаж оноо</span></div>
        <div className={s.kpi}><b>{st.stats.avgPred || "—"}</b><span>Таамаг</span></div>
        <div className={s.kpi}><b style={{ color: lift >= 1 ? "#047857" : lift ? "#C81E4A" : undefined }}>{lift ? `${lift >= 1 ? "+" : ""}${Math.round((lift - 1) * 100)}%` : "—"}</b><span>Таамгаас зөрөө</span></div>
        <div className={s.kpi}><b>{st.stats.vectors}</b><span>Vector санах ой</span></div>
      </div>
      {st.learned.length > 0 && <ul className={s.learn}>{st.learned.map((l) => <li key={l}>{l}</li>)}</ul>}
      <section className={s.card}>
        <div className={s.cardHead}><h3>Нийтэлсэн постууд</h3><small>Оноо = like + 2×reply + 3×repost · 1ц / 6ц / 24ц</small></div>
        {pub.length ? (
          <div style={{ overflowX: "auto" }}><table className={s.tbl}><thead><tr><th>Хэзээ</th><th>Пост</th><th>Таамаг / бодит</th><th>1ц</th><th>6ц</th><th>24ц</th><th>❤ 💬 👁</th></tr></thead>
            <tbody>{pub.map((p) => (
              <tr key={p._id}>
                <td>{when(p.at).day} {when(p.at).time}</td>
                <td className={s.txt}>{p.kind === "video" ? "🎬 " : (p.kind || "text") !== "text" ? "🖼 " : ""}{p.text.split("\n")[0]}</td>
                <td><div className={s.bar}><i style={{ width: `${(p.pred.score / max) * 100}%` }} /><i data-real style={{ width: `${(p.metrics.score / max) * 100}%` }} /></div></td>
                <td>{p.snaps && p.snaps.h1 >= 0 ? p.snaps.h1 : "—"}</td><td>{p.snaps && p.snaps.h6 >= 0 ? p.snaps.h6 : "—"}</td><td>{p.snaps && p.snaps.h24 >= 0 ? p.snaps.h24 : "—"}</td>
                <td>{p.metrics.likes} · {p.metrics.comments}{p.metrics.views ? ` · ${p.metrics.views}` : ""}</td>
              </tr>
            ))}</tbody></table></div>
        ) : <div className={s.empty}><b>Одоогоор нийтэлсэн пост алга</b><span>Агентын пост нийтлэгдмэгц энд гарна.</span></div>}
      </section>
      <section className={s.card}>
        <div className={s.cardHead}><h3>Таны хамгийн сайн постууд</h3><small>Нэг дарж шинэ хувилбарууд бүтээнэ</small></div>
        <div className={s.stack}>{st.top.slice(0, 10).map((t) => (
          <div key={t.key} className={s.rowx} style={{ alignItems: "flex-start", borderBottom: "1px solid rgba(20,21,40,.08)", paddingBottom: 10 }}>
            <span className={s.pill} data-k="test">{t.score}</span>
            <span style={{ flex: 1, minWidth: 0 }} className={s.pcText}>{t.text.slice(0, 220)}{t.text.length > 220 ? "…" : ""}</span>
            <button className={s.btn} onClick={() => go("create", { src: "top", post: t.key })}><Icon name="refresh" size={16} />Сайжруулах</button>
          </div>
        ))}</div>
      </section>
    </div>
  );
}
