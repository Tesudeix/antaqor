"use client";

import { useMemo, useState } from "react";
import type { Ctx } from "../types";
import PostCard from "../PostCard";
import s from "../agent.module.css";

/* Сан — бүх контент: ноорог (хувилбарууд), товлосон, нийтэлсэн, анхаарах, infographic. */
const F = [["all", "Бүгд"], ["draft", "Ноорог"], ["scheduled", "Товлосон"], ["published", "Нийтэлсэн"], ["held", "Анхаарах"], ["infographic", "Зураг / видео"]] as const;
export default function Library(ctx: Ctx) {
  const { st } = ctx;
  const [f, setF] = useState<string>("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(30);
  const list = useMemo(() => st.posts.filter((p) => (f === "all" ? true : f === "infographic" ? (p.kind || "text") !== "text" : f === "held" ? ["held", "failed"].includes(p.status) : p.status === f))
    .filter((p) => !q.trim() || (p.text + " " + p.idea).toLowerCase().includes(q.toLowerCase())), [st.posts, f, q]);
  return (
    <div className={s.page}>
      <div className={s.pageHead}><div><h1>Сан</h1><p>Бүх контент нэг дор — хувилбар бүр хадгалагдана, дахин ашиглана.</p></div><input style={{ maxWidth: 280 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Хайх…" /></div>
      <div className={s.rowx}>{F.map(([k, l]) => <button key={k} className={s.chip} aria-pressed={f === k} onClick={() => setF(k)}>{l} <span className={s.muted}>{k === "all" ? st.posts.length : st.posts.filter((p) => (k === "infographic" ? (p.kind || "text") !== "text" : k === "held" ? ["held", "failed"].includes(p.status) : p.status === k)).length}</span></button>)}</div>
      {list.length ? <div className={s.stack}>{list.slice(0, limit).map((p) => <PostCard key={p._id} p={p} ctx={ctx} />)}</div> : <div className={s.empty}><b>Хоосон</b></div>}
      {list.length > limit && <button className={s.btn} onClick={() => setLimit(limit + 30)}>Цааш харах ({list.length - limit})</button>}
    </div>
  );
}
