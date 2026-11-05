"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import s from "./z.module.css";

/* ─── /z — Z: худалдааны ментор (2026-11-03, 2026-11-04 мессенжер болгосон) ───
   Хүнтэй чатлаж буй мэт: хариу 1–3 бөмбөлөг болж stream-ээр ээлжлэн ирнэ
   (дунд нь «бичиж байна»), доор нь тулгуурласан аксиом, бэлэн текст (хуулах),
   хурдан хариултууд. Баруун самбар (утсанд товчоор нээгдэнэ): энэ 7 хоногийн
   туршилт · таны бизнес · Z санаж буй зүйл (мартуулах) · өмнөх туршилтууд. */

type Msg = {
  id: string; role: "user" | "agent"; parts: string[]; at?: string;
  axiom?: { id: string; name: string }; draft?: { kind: string; text: string }; quick?: string[];
};
type Test = { _id: string; action: string; metric: string; threshold: string; due: string; status: string; value?: string; beliefUpdate?: string };
type Card = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type State = { name: string; card: Card; memory: string; biz: Record<string, string>; turns: number; messages: Msg[]; tests: Test[] };
type Body = { message?: string; checkin?: { testId: string; value: string } };

const BIZ: [string, string][] = [["product", "Бараа"], ["channel", "Суваг"], ["price", "Үнэ"], ["volume", "Борлуулалт"], ["margin", "Ашиг"], ["bottleneck", "Гол саад"]];
const STATUS: Record<string, string> = { keep: "Үргэлжлүүлнэ", tweak: "Засна", kill: "Зогсооно", dropped: "Орхисон", open: "Явагдаж буй" };
const DRAFT: Record<string, string> = { post: "Пост", caption: "Тайлбар", ad: "Реклам", dm: "Чат скрипт", reply: "Хариу", other: "Текст" };
const STARTERS = [
  "Онлайнаар бараа зардаг, сүүлийн үед захиалга буурчихлаа.",
  "Юу зарахаа шийдэж чадахгүй байна.",
  "Пэйж маань дагагчтай ч хүмүүс авахгүй байна.",
  "Бүтээгдэхүүнийхээ постын текстийг хамт бичье.",
];

const daysLeft = (due: string) => Math.ceil((new Date(due).getTime() - Date.now()) / 86400e3);
const hhmm = (at?: string) => (at ? new Date(at).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "");
function dayLabel(at?: string) {
  if (!at) return "Өнөөдөр";
  const d = new Date(at);
  if (d.toDateString() === new Date().toDateString()) return "Өнөөдөр";
  if (d.toDateString() === new Date(Date.now() - 86400e3).toDateString()) return "Өчигдөр";
  return `${d.getMonth() + 1}-р сарын ${d.getDate()}`;
}
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x : x?.k || "")).filter(Boolean) : []);

export default function ZApp() {
  const [st, setSt] = useState<State | null>(null);
  const [auth, setAuth] = useState(true);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [value, setValue] = useState("");
  const [panel, setPanel] = useState(false);
  const [copied, setCopied] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const ta = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/z").then(async (r) => {
      if (r.status === 401) { setAuth(false); return; }
      setSt(await r.json());
    }).catch(() => setErr("Ачаалж чадсангүй"));
  }, []);
  const loaded = useRef(false);
  useEffect(() => {
    if (!st) return;
    /* анх нээхэд шууд сүүлийн мессеж рүү, дараа нь зөөлөн гүйлгэнэ */
    end.current?.scrollIntoView({ behavior: loaded.current ? "smooth" : "auto", block: "end" });
    loaded.current = true;
  }, [st, st?.messages.length, live.length, busy]);
  useEffect(() => { const el = ta.current; if (!el) return; el.style.height = "auto"; el.style.height = `${Math.min(el.scrollHeight, 160)}px`; }, [text]);

  async function send(body: Body, shown: string) {
    if (busy || !st) return;
    const prev = st;
    setBusy(true); setErr(""); setLive([]); setText("");
    setSt({ ...st, messages: [...st.messages, { id: "tmp", role: "user", parts: [shown], at: new Date().toISOString() }] });
    try {
      const r = await fetch("/api/z", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok || !r.body) { const d = await r.json().catch(() => ({})); throw new Error(d.error || "Алдаа гарлаа"); }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let final: State | null = null;
      for (;;) {
        const { value: chunk, done } = await reader.read();
        if (done) break;
        buf += dec.decode(chunk, { stream: true });
        for (let nl = buf.indexOf("\n"); nl >= 0; nl = buf.indexOf("\n")) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line);
          if (ev.t === "bubble") setLive((l) => [...l, String(ev.text)]);
          else if (ev.t === "state") final = ev.state;
          else if (ev.t === "error") throw new Error(ev.error);
        }
      }
      if (!final) throw new Error("Холболт тасарлаа. Дахиад илгээгээд үзээрэй.");
      setSt(final); setValue("");
    } catch (e) {
      setErr((e as Error).message);
      setSt(prev);
      if (body.message) setText(body.message);
    } finally { setBusy(false); setLive([]); }
  }

  async function forget() {
    if (busy || !confirm("Z таны тухай санаж буй бүх зүйл — яриа, бизнесийн мэдээлэл, туршилтууд устна. Үргэлжлүүлэх үү?")) return;
    const r = await fetch("/api/z", { method: "DELETE" });
    if (r.ok) { setSt(await r.json()); setPanel(false); }
  }

  async function copy(t: string, id: string) {
    try { await navigator.clipboard.writeText(t); setCopied(id); setTimeout(() => setCopied(""), 1600); } catch { /* clipboard хориотой */ }
  }

  if (!auth) {
    return (
      <div className={s.gate}>
        <b className={s.mark}>Z</b>
        <h1>Z · Худалдааны ментор</h1>
        <p>Юу зардаг, хэнд, хэдээр — тоон дээр тулгуурлаж шударга хариулна. Яриагаа санаж явна.</p>
        <Link className={s.pri} href="/?login=1">Нэвтрэх</Link>
      </div>
    );
  }
  if (!st) return <div className={s.gate} aria-busy="true"><b className={s.mark}>Z</b>{err && <p role="alert">{err}</p>}</div>;

  const open = st.tests.find((t) => t.status === "open");
  const past = st.tests.filter((t) => t.status !== "open" && t.status !== "dropped").slice(0, 4);
  const facts = arr(st.card?.facts).slice(-5);
  const bizRows = BIZ.filter(([k]) => st.biz?.[k]);
  const last = st.messages[st.messages.length - 1];
  const quick = !busy && last?.role === "agent" ? last.quick || [] : [];
  const empty = st.messages.length === 0;

  const Panel = (
    <>
      <section className={s.box} aria-label="Энэ 7 хоногийн туршилт">
        <p className={s.meta}>ЭНЭ 7 ХОНОГ</p>
        {open ? (
          <>
            <p className={s.action}>{open.action}</p>
            <dl className={s.kv}>
              {open.metric && <><dt>Хэмжих</dt><dd>{open.metric}</dd></>}
              {open.threshold && <><dt>Босго</dt><dd>{open.threshold}</dd></>}
              <dt>Хугацаа</dt>
              <dd>{daysLeft(open.due) > 0 ? `${daysLeft(open.due)} хоног үлдсэн` : <b className={s.flare}>Шалгах өдөр боллоо</b>}</dd>
            </dl>
            <form className={s.check} onSubmit={(e) => { e.preventDefault(); if (value.trim()) send({ checkin: { testId: open._id, value: value.trim() } }, `7 хоногийн үр дүн: ${value.trim()}`); }}>
              <label htmlFor="zval">Үр дүнгээ бичээрэй</label>
              <div><input id="zval" value={value} onChange={(e) => setValue(e.target.value)} placeholder="ж: 10 хүнээс 3 нь хариулсан" maxLength={200} /><button type="submit" className={s.pri} disabled={busy || !value.trim()}>Илгээх</button></div>
            </form>
          </>
        ) : (
          <p className={s.muted}>Одоохондоо туршилт алга. Нөхцөлөө бичихэд Z нэг алхам санал болгоно.</p>
        )}
      </section>

      <section className={s.box} aria-label="Таны бизнес">
        <p className={s.meta}>ТАНЫ БИЗНЕС</p>
        {bizRows.length ? (
          <dl className={s.kv}>{bizRows.map(([k, l]) => <Fragment key={k}><dt>{l}</dt><dd>{st.biz[k]}</dd></Fragment>)}</dl>
        ) : (
          <p className={s.muted}>Яриа явах тусам энд бөглөгдөнө: юу, хэнд, хэдээр, аль сувгаар.</p>
        )}
      </section>

      <section className={s.box} aria-label="Z санаж буй зүйл">
        <p className={s.meta}>Z САНАЖ БАЙГАА</p>
        {st.memory ? <p className={s.memory}>{st.memory}</p> : <p className={s.muted}>Одоохондоо юу ч санаагүй байна.</p>}
        {facts.length > 0 && <ul className={s.facts}>{facts.map((f, i) => <li key={i}>{f}</li>)}</ul>}
        {st.turns > 0 && <button type="button" className={s.forget} onClick={forget} disabled={busy}>Бүгдийг мартуулах</button>}
      </section>

      {past.length > 0 && (
        <section className={s.box} aria-label="Өмнөх туршилтууд">
          <p className={s.meta}>ӨМНӨХ ТУРШИЛТ</p>
          <ul className={s.past}>
            {past.map((t) => (
              <li key={t._id}><span data-s={t.status}>{STATUS[t.status] || t.status}</span><p>{t.action}</p>{t.value && <small>Үр дүн: {t.value}</small>}{t.beliefUpdate && <small>{t.beliefUpdate}</small>}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );

  let prevDay = "";
  return (
    <div className={s.app}>
      <header className={s.head}>
        <span className={s.avatar} aria-hidden><b className={s.mark}>Z</b><i className={s.dot} /></span>
        <div className={s.title}>
          <h1>Z</h1>
          <span aria-live="polite">{busy ? "бичиж байна…" : "Худалдааны ментор · онлайн"}</span>
        </div>
        <button type="button" className={s.panelBtn} onClick={() => setPanel(!panel)} aria-expanded={panel}>
          {open ? (daysLeft(open.due) > 0 ? `Туршилт · ${daysLeft(open.due)} хоног` : "Шалгах өдөр") : "Миний бизнес"}
        </button>
      </header>

      <div className={s.body}>
        <main className={s.chat}>
          <div className={s.log} aria-live="polite">
            {empty && (
              <div className={s.msg} data-r="agent">
                <span className={s.who} aria-hidden>Z</span>
                <div className={s.bubble}>
                  <p>Сайн байна уу{st.name ? `, ${st.name}` : ""}. Би Z — онлайн худалдаа, борлуулалт дээр тань хамт бодъё.</p>
                  <p>Юу зардаг вэ, одоо юу хамгийн их гацаад байна? Тоо байвал бүр сайн: үнэ, сард хэдэн захиалга, аль сувгаар.</p>
                </div>
              </div>
            )}
            {st.messages.map((m) => {
              const day = dayLabel(m.at);
              const divider = day !== prevDay;
              prevDay = day;
              return (
                <Fragment key={m.id}>
                  {divider && <p className={s.day}><span>{day}</span></p>}
                  <div className={s.msg} data-r={m.role}>
                    {m.role === "agent" && <span className={s.who} aria-hidden>Z</span>}
                    <div className={s.bubble}>
                      {m.parts.map((p, i) => <p key={i}>{p}</p>)}
                      {m.draft && (
                        <figure className={s.draft}>
                          <figcaption>
                            <span>БЭЛЭН ТЕКСТ · {(DRAFT[m.draft.kind] || "Текст").toUpperCase()}</span>
                            <button type="button" className={s.copy} onClick={() => copy(m.draft!.text, m.id)}>{copied === m.id ? "Хуулсан" : "Хуулах"}</button>
                          </figcaption>
                          <pre>{m.draft.text}</pre>
                        </figure>
                      )}
                      <span className={s.foot}>
                        {m.axiom && <span className={s.ax} title="Энэ хариулт тулгуурласан бизнесийн зарчим">{m.axiom.name}</span>}
                        <time>{hhmm(m.at)}</time>
                      </span>
                    </div>
                  </div>
                </Fragment>
              );
            })}
            {busy && (
              <div className={s.msg} data-r="agent">
                <span className={s.who} aria-hidden>Z</span>
                <div className={s.bubble}>
                  {live.map((p, i) => <p key={i} className={s.enter}>{p}</p>)}
                  <span className={s.typing} role="status" aria-label="Z бичиж байна"><i /><i /><i /></span>
                </div>
              </div>
            )}
            <div ref={end} className={s.end} />
          </div>

          <div className={s.dock}>
            {err && <p className={s.err} role="alert">{err}</p>}
            {(empty || quick.length > 0) && !busy && (
              <div className={s.quick} role="group" aria-label="Хурдан хариулт">
                {(empty ? STARTERS : quick).map((q) => <button key={q} type="button" className={s.qb} onClick={() => send({ message: q }, q)}>{q}</button>)}
              </div>
            )}
            <form className={s.composer} onSubmit={(e) => { e.preventDefault(); if (text.trim()) send({ message: text.trim() }, text.trim()); }}>
              <textarea ref={ta} rows={1} value={text} onChange={(e) => setText(e.target.value)} maxLength={4000}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (text.trim()) send({ message: text.trim() }, text.trim()); } }}
                placeholder="Z-д бичих…" aria-label="Мессеж" />
              <button type="submit" className={s.pri} disabled={busy || !text.trim()} aria-label="Илгээх">Илгээх</button>
            </form>
          </div>
        </main>

        <aside className={s.side} data-open={panel || undefined}>{Panel}</aside>
      </div>
    </div>
  );
}
