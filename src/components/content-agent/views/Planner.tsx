"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { api, when, weekStart, ubDay, p2, PL, WD, FMT, SRC, type Ctx, type Plat, type Rule } from "../types";
import s from "../agent.module.css";

/* Төлөвлөгөө — 7 хоног × суваг календарь, AI төлөвлөгч, хуваарийн дүрэм
   («Өдөр бүр 08:00 — AI мэдээ богино цочрол»). Дүрэм бүр цагаасаа 3 цагийн өмнө
   2 хувилбар бичиж, тестээр шилдгийг нь товлоно. */
const PLATS: Plat[] = ["threads", "facebook", "instagram"];
/** зурагтай хэлбэрүүд — Instagram зөвхөн эдгээрт */
const VIS: string[] = ["infographic", "image", "video"];
const blank: Omit<Rule, "_id" | "lastRunDay"> = { name: "", active: true, days: [], hour: 8, minute: 0, format: "spark", source: "auto", topic: "", audienceId: "", productId: "", platforms: ["threads"] };

export default function Planner(ctx: Ctx) {
  const { st, reload, say } = ctx;
  const [ws, setWs] = useState(weekStart());
  const [prompt, setPrompt] = useState("");
  const [pPlats, setPPlats] = useState<Plat[]>(["threads"]);
  const [perDay, setPerDay] = useState(2);
  const [aud, setAud] = useState(st.audiences.find((a) => a.isDefault)?._id || "");
  const [busy, setBusy] = useState("");
  const [edit, setEdit] = useState<(Omit<Rule, "_id" | "lastRunDay"> & { _id?: string }) | null>(null);
  const days = Array.from({ length: 7 }, (_, i) => ws + i * 864e5);
  const today = ubDay(Date.now());
  const items = (pl: Plat, d: number) => [
    ...st.posts.filter((p) => p.status !== "deleted" && p.platforms.includes(pl) && (p.status !== "draft" || p.day) && +new Date(p.at) >= d && +new Date(p.at) < d + 864e5).map((p) => ({ id: p._id, at: p.at, text: p.text, st: p.status, ghost: false })),
    ...st.others.filter((o) => o.platforms.includes(pl) && +new Date(o.at) >= d && +new Date(o.at) < d + 864e5).map((o) => ({ id: o._id, at: o.at, text: o.text, st: o.state, ghost: true })),
  ].sort((a, b) => +new Date(a.at) - +new Date(b.at));

  async function plan() {
    setBusy("plan");
    try { const r = await api<{ made: number; scheduled: number }>({ action: "plan", prompt, platforms: pPlats, perDay, audienceId: aud || undefined, days: 7 }); say(`${r.made} пост бэлэн${r.scheduled ? ` · ${r.scheduled} товлогдлоо` : " · ноорог"}`); setPrompt(""); await reload(); }
    catch (e) { say((e as Error).message, true); } finally { setBusy(""); }
  }
  async function saveRule() {
    if (!edit) return;
    setBusy("rule");
    try { const { _id, ...doc } = edit; await api({ action: "rule", id: _id, doc }); say("Дүрэм хадгаллаа"); setEdit(null); await reload(); }
    catch (e) { say((e as Error).message, true); } finally { setBusy(""); }
  }
  async function ruleOp(r: Rule, op: "toggle" | "delete") {
    try { await api(op === "delete" ? { action: "rule", op: "delete", id: r._id } : { action: "rule", id: r._id, doc: { ...r, active: !r.active } }); await reload(); }
    catch (e) { say((e as Error).message, true); }
  }
  const sched = (r: { days: number[]; hour: number; minute: number }) => `${r.days.length && r.days.length < 7 ? r.days.map((d) => WD[d]).join(", ") : "Өдөр бүр"} ${p2(r.hour)}:${p2(r.minute)}`;

  return (
    <div className={s.page}>
      <div className={s.pageHead}>
        <div><h1>Төлөвлөгөө</h1><p>7 хоногийн хуваарь, тогтмол дүрэм, AI төлөвлөгч.</p></div>
        <div className={s.rowx}>
          <button className={s.btn} onClick={() => setWs(ws - 7 * 864e5)} aria-label="Өмнөх"><Icon name="chevronLeft" size={16} /></button>
          <b>{when(new Date(ws)).day === "Өнөөдөр" ? "Энэ 7 хоног" : `${new Date(ws + 8 * 3600e3).getUTCMonth() + 1}/${new Date(ws + 8 * 3600e3).getUTCDate()} – ${new Date(ws + 6 * 864e5 + 8 * 3600e3).getUTCMonth() + 1}/${new Date(ws + 6 * 864e5 + 8 * 3600e3).getUTCDate()}`}</b>
          <button className={s.btn} onClick={() => setWs(ws + 7 * 864e5)} aria-label="Дараах"><Icon name="chevron" size={16} /></button>
          <button className={s.ghost} onClick={() => setWs(weekStart())}>Өнөөдөр</button>
        </div>
      </div>

      <div className={s.planWrap}>
        <div className={s.cal}>
          <div className={s.calGrid}>
            <div className={s.calHd} />
            {days.map((d, i) => <div key={d} className={s.calHd} data-today={d === today}>{WD[i]} {new Date(d + 8 * 3600e3).getUTCDate()}</div>)}
            {PLATS.map((pl) => [
              <div key={pl} className={s.calPl}>{PL[pl]}</div>,
              ...days.map((d) => (
                <div key={pl + d} className={s.calCell}>
                  {items(pl, d).map((it) => <div key={it.id} className={s.calItem} data-s={it.st} data-ghost={it.ghost} title={it.text}><b>{when(it.at).time}{it.ghost ? " · бусад" : ""}</b><span>{it.text}</span></div>)}
                </div>
              )),
            ])}
          </div>
        </div>

        <div className={s.stack}>
          <section className={s.card}>
            <div className={s.cardHead}><h3>AI төлөвлөгч</h3><small>7 хоног</small></div>
            <div className={s.stack}>
              <textarea rows={5} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Жишээ: Ирэх 7 хоногт Claude-ийн хичээл зарлана. AI creator system, бүтээмжийн сэдвүүдээр урам өгч, 2 удаа курсээ санал болго." />
              <label className={s.field}><span>Audience</span><select value={aud} onChange={(e) => setAud(e.target.value)}><option value="">Ерөнхий</option>{st.audiences.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}</select></label>
              <div className={s.field}><span>Суваг</span><div className={s.rowx}>{(["threads", "facebook"] as Plat[]).map((x) => <button key={x} className={s.chip} aria-pressed={pPlats.includes(x)} onClick={() => setPPlats(pPlats.includes(x) ? pPlats.filter((y) => y !== x) : [...pPlats, x])}>{PL[x]}</button>)}</div></div>
              <div className={s.field}><span>Өдөрт</span><div className={s.seg}>{[1, 2, 3].map((n) => <button key={n} aria-pressed={perDay === n} onClick={() => setPerDay(n)}>{n}</button>)}</div></div>
              <button className={`${s.pri} ${s.big}`} disabled={!prompt.trim() || !pPlats.length || !!busy} onClick={plan}>{busy === "plan" ? <><i className={s.spin} />Төлөвлөж байна (1-2 мин)…</> : <><Icon name="spark" size={16} />Төлөвлөгөө гаргах</>}</button>
              <p className={s.muted}>{st.cfg.auto ? "Автомат асаалттай тул шалгалтад тэнцсэн постууд шууд товлогдоно." : "Автомат зогссон — ноорог болж Санд орно."}</p>
            </div>
          </section>
        </div>
      </div>

      <section className={s.card}>
        <div className={s.cardHead}><h3>Хуваарийн дүрэм</h3><button className={s.btn} onClick={() => setEdit({ ...blank })}><Icon name="plus" size={16} />Дүрэм нэмэх</button></div>
        {st.rules.map((r) => (
          <div key={r._id} className={s.ruleRow}>
            <label className={s.switch}><input type="checkbox" checked={r.active} onChange={() => ruleOp(r, "toggle")} /><i /></label>
            <div><b>{r.name}</b><small>{sched(r)}</small></div>
            <div><b>{FMT[r.format]}</b><small>{SRC[r.source]}</small></div>
            <div><small>{r.platforms.map((p) => PL[p]).join(", ")}</small></div>
            <div className={s.rowx}><button className={s.ghost} onClick={() => setEdit({ ...r })}><Icon name="edit" size={16} /></button><button className={s.ghost} onClick={() => ruleOp(r, "delete")}><Icon name="trash" size={16} /></button></div>
          </div>
        ))}
        {edit && (
          <div className={s.pcPanel} style={{ marginTop: 12 }}>
            <div className={s.grid2}>
              <label className={s.field}><span>Нэр</span><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Өглөөний AI мэдээ" /></label>
              <label className={s.field}><span>Цаг</span><input type="time" value={`${p2(edit.hour)}:${p2(edit.minute)}`} onChange={(e) => { const [h, m] = e.target.value.split(":").map(Number); setEdit({ ...edit, hour: h || 0, minute: m || 0 }); }} /></label>
            </div>
            <div className={s.field}><span>Өдрүүд (хоосон = өдөр бүр)</span><div className={s.days}>{WD.map((d, i) => <button key={d} aria-pressed={edit.days.includes(i)} onClick={() => setEdit({ ...edit, days: edit.days.includes(i) ? edit.days.filter((x) => x !== i) : [...edit.days, i].sort() })}>{d}</button>)}</div></div>
            <div className={s.grid2}>
              <div className={s.field}><span>Хэлбэр</span><div className={s.seg}>{(["spark", "value", "offer", "infographic", ...(st.hf.ready ? (["image", "video"] as const) : [])] as const).map((f) => <button key={f} aria-pressed={edit.format === f} onClick={() => setEdit({ ...edit, format: f, platforms: VIS.includes(f) ? Array.from(new Set([...edit.platforms, "instagram" as Plat])) : edit.platforms.filter((p) => p !== "instagram") })}>{FMT[f]}</button>)}</div></div>
              <label className={s.field}><span>Эх сурвалж</span><select value={edit.source} onChange={(e) => setEdit({ ...edit, source: e.target.value as Rule["source"] })}>{Object.entries(SRC).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            </div>
            <label className={s.field}><span>Сэдэв / заавар</span><input value={edit.topic} onChange={(e) => setEdit({ ...edit, topic: e.target.value })} placeholder="AI салбарын шинэ хөдөлгөөн — богино, цочир" /></label>
            <div className={s.grid2}>
              <label className={s.field}><span>Audience</span><select value={edit.audienceId} onChange={(e) => setEdit({ ...edit, audienceId: e.target.value })}><option value="">Ерөнхий</option>{st.audiences.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}</select></label>
              {edit.source === "product" && <label className={s.field}><span>Бүтээгдэхүүн</span><select value={edit.productId} onChange={(e) => setEdit({ ...edit, productId: e.target.value })}><option value="">Ээлжлэн</option>{st.products.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}</select></label>}
            </div>
            <div className={s.rowx}>{PLATS.map((x) => <button key={x} className={s.chip} aria-pressed={edit.platforms.includes(x)} disabled={x === "instagram" && !VIS.includes(edit.format)} onClick={() => setEdit({ ...edit, platforms: edit.platforms.includes(x) ? edit.platforms.filter((y) => y !== x) : [...edit.platforms, x] })}>{PL[x]}</button>)}
              <span style={{ flex: 1 }} /><button className={s.ghost} onClick={() => setEdit(null)}>Болих</button><button className={s.pri} disabled={!edit.name.trim() || !edit.platforms.length || busy === "rule"} onClick={saveRule}>Хадгалах</button></div>
          </div>
        )}
      </section>
    </div>
  );
}
