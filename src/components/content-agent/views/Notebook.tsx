"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { api, when, type Ctx, type Note } from "../types";
import s from "../agent.module.css";

/* Тэмдэглэлийн дэвтэр — эзэн бичнэ, агент эндээс хэв маяг, сэтгэлгээг сурна (vector +
   cognitive профайл). Бичих үед автоматаар хадгална. Тэмдэглэл бүрээс шууд пост. */
export default function Notebook(ctx: Ctx) {
  const { st, reload, say, go } = ctx;
  const [cur, setCur] = useState<Note | null>(st.notes[0] || null);
  const [title, setTitle] = useState(cur?.title || "");
  const [body, setBody] = useState(cur?.body || "");
  const [q, setQ] = useState("");
  const [saving, setSaving] = useState(false);
  const [cogBusy, setCogBusy] = useState(false);
  const dirty = useRef(false);
  useEffect(() => { setTitle(cur?.title || ""); setBody(cur?.body || ""); dirty.current = false; }, [cur?._id]); // eslint-disable-line react-hooks/exhaustive-deps
  async function save(silent = false) {
    if (!dirty.current && cur) return cur;
    if (!title.trim() && !body.trim()) return cur;
    setSaving(true);
    try {
      const r = await api<{ note: Note }>({ action: "note", id: cur?._id, title, body, tags: cur?.tags || [] });
      dirty.current = false; setCur(r.note); if (!silent) say("Хадгаллаа"); await reload(); return r.note;
    } catch (e) { say((e as Error).message, true); return cur; } finally { setSaving(false); }
  }
  useEffect(() => { const t = setInterval(() => { if (dirty.current) save(true); }, 8000); return () => clearInterval(t); }); // автомат хадгалалт
  const list = st.notes.filter((n) => !q.trim() || (n.title + n.body).toLowerCase().includes(q.toLowerCase()));
  const c = st.cfg.cognitive;
  async function cognitive() {
    setCogBusy(true);
    try { if (dirty.current) await save(true); await api({ action: "cognitive" }); say("Сэтгэлгээний профайл шинэчлэгдлээ"); await reload(); }
    catch (e) { say((e as Error).message, true); } finally { setCogBusy(false); }
  }
  return (
    <div className={s.page}>
      <div className={s.pageHead}><div><h1>Тэмдэглэлийн дэвтэр</h1><p>Энд бодлоо чөлөөтэй бич — агент таны хэв маяг, сэтгэлгээг сурч, пост бүрт тааруулна.</p></div>
        <button className={s.pri} onClick={() => { setCur(null); setTitle(""); setBody(""); }}><Icon name="plus" size={16} />Шинэ тэмдэглэл</button></div>

      <section className={s.card}>
        <div className={s.cardHead}><h3>Таны сэтгэлгээ (cognitive профайл)</h3>
          <div className={s.rowx}><small>{st.notes.length} тэмдэглэл{c?.updatedAt ? ` · ${when(c.updatedAt).day} ${when(c.updatedAt).time}` : ""}</small><button className={s.btn} onClick={cognitive} disabled={cogBusy}>{cogBusy ? <i className={s.spinB} /> : <Icon name="refresh" size={16} />}Шинэчлэх</button></div></div>
        {c?.summary ? (
          <div className={s.cog}>
            <p>{c.summary}</p>
            {c.tone && <div className={s.cogRow}><b>Өнгө аяс</b><em>{c.tone}</em></div>}
            <div className={s.cogRow}><b>Итгэл</b>{c.beliefs.map((x) => <em key={x}>{x}</em>)}</div>
            <div className={s.cogRow}><b>Хүрээ</b>{c.frames.map((x) => <em key={x}>{x}</em>)}</div>
            <div className={s.cogRow}><b>Үгс</b>{c.vocabulary.map((x) => <em key={x}>{x}</em>)}</div>
            {c.avoid.length > 0 && <div className={s.cogRow}><b>Хэзээ ч</b>{c.avoid.map((x) => <em key={x}>{x}</em>)}</div>}
          </div>
        ) : <p className={s.muted}>Хэдэн тэмдэглэл бичээд «Шинэчлэх» дарна уу — агент таны Threads + тэмдэглэлээс сэтгэлгээний профайл гаргана.</p>}
      </section>

      <div className={s.nb}>
        <div className={s.stack}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Хайх…" />
          <div className={s.nbList}>
            {list.map((n) => <button key={n._id} className={s.nbItem} aria-pressed={cur?._id === n._id} onClick={async () => { if (dirty.current) await save(true); setCur(n); }}><b>{n.title || "Гарчиггүй"}</b><span>{n.body}</span></button>)}
            {!list.length && <div className={s.empty}><b>Тэмдэглэл алга</b></div>}
          </div>
        </div>
        <section className={s.card}>
          <input className={s.nbTitle} value={title} onChange={(e) => { setTitle(e.target.value); dirty.current = true; }} placeholder="Гарчиг" />
          <textarea className={s.nbBody} value={body} onChange={(e) => { setBody(e.target.value); dirty.current = true; }} placeholder="Өнөөдөр юу бодов? Юу харсан, юу сурсан, ямар байр суурьтай вэ…" onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); save(); } }} />
          <div className={s.rowx}>
            <span className={s.muted}>{saving ? "Хадгалж байна…" : cur ? `Хадгалсан · ${when(cur.updatedAt).day} ${when(cur.updatedAt).time}` : "Шинэ"}</span>
            <span style={{ flex: 1 }} />
            {cur && <button className={s.ghost} onClick={async () => { await api({ action: "note", op: "delete", id: cur._id }); setCur(null); setTitle(""); setBody(""); await reload(); }}><Icon name="trash" size={16} /></button>}
            <button className={s.btn} onClick={() => save()} disabled={saving}>Хадгалах</button>
            <button className={s.pri} disabled={!body.trim()} onClick={async () => { const n = await save(true); if (n?._id) go("create", { src: "note", note: n._id }); }}><Icon name="spark" size={16} />Пост бүтээх</button>
          </div>
        </section>
      </div>
    </div>
  );
}
