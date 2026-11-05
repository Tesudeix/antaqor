"use client";

import { useEffect, useState } from "react";
import Icon from "@/components/Icon";
import { api, asParam, type Ctx } from "../types";
import s from "../agent.module.css";

/* Хуудас холбох — «Facebook + Instagram» ба «Threads» гэсэн 2 том товч. Facebook-ээс буцаж
   ирэхэд (?meta=ok) хуудсуудаа жагсааж «Холбох» дарна. Бид зөвхөн нийтлэх эрх авна. */
type Page = { id: string; name: string; picture: string; igId: string; igUsername: string; connected: boolean };

export default function Connect(ctx: Ctx) {
  const { st, reload, say, go, params } = ctx;
  const owner = st.me.ws === "main";
  const [pages, setPages] = useState<Page[] | null>(null);
  const [busy, setBusy] = useState("");
  const [help, setHelp] = useState(false);
  const metaMsg = params.meta, thMsg = params.threads;
  const q = asParam();
  const href = (p: string) => `/api/content-agent/connect?p=${p}${q ? `&${q}` : ""}`;

  async function loadPages() {
    setBusy("pages");
    try { const r = await api<{ pages: Page[]; needsAuth?: boolean; error?: string }>({ action: "conn-pages" }); setPages(r.needsAuth ? [] : r.pages); if (r.error) say(r.error, true); }
    catch (e) { say((e as Error).message, true); } finally { setBusy(""); }
  }
  useEffect(() => {
    if (metaMsg === "ok") { say("Facebook-ээр нэвтэрлээ — холбох хуудсаа сонгоно уу"); loadPages(); }
    else if (metaMsg) say(`Facebook: ${metaMsg}`, true);
    if (thMsg === "ok") { say("Threads холбогдлоо"); reload(); }
    else if (thMsg) say(`Threads: ${thMsg}`, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function connect(p: Page) {
    setBusy(p.id);
    try { const r = await api<{ name: string; instagram: boolean }>({ action: "conn-meta", pageId: p.id }); say(`«${r.name}» холбогдлоо${r.instagram ? " · Instagram ч мөн" : ""}`); setPages((x) => x && x.map((y) => (y.id === p.id ? { ...y, connected: true } : y))); await reload(); }
    catch (e) { say((e as Error).message, true); } finally { setBusy(""); }
  }
  async function remove(platform: "meta" | "threads", key: string) {
    try { await api({ action: "conn-remove", platform, key }); say("Салгалаа"); await reload(); } catch (e) { say((e as Error).message, true); }
  }
  const any = st.accounts.meta.length + st.accounts.threads.length > 0;

  return (
    <div className={s.page}>
      {params.step === "2" && <div className={s.onbSteps}><span>1. Бизнес ✓</span><i /><span data-on>2. Хуудас холбох</span><i /><span>3. Анхны пост</span></div>}
      <div className={s.pageHead}><div><h1>Хуудас холбох</h1><p>Агент таны хуудсууд руу шууд нийтэлнэ. Бид зөвхөн <b>нийтлэх</b> эрх авна — хүссэн үедээ салгана.</p></div></div>

      <div className={s.grid2}>
        <section className={s.connCard}>
          <div className={s.connHead}><span className={s.connIco} data-p="fb">f</span><div><h3>Facebook + Instagram</h3><p className={s.muted}>Facebook хуудас, түүнтэй холбоотой Instagram</p></div></div>
          {st.accounts.meta.length > 0 && (
            <div className={s.connList}>{st.accounts.meta.map((m) => (
              <div key={m.key}><Icon name="check" size={16} /><b>{m.label}</b>{m.instagram && <span className={s.pill}>Instagram{m.igUsername ? ` @${m.igUsername}` : ""}</span>}
                {!owner && <button className={s.ghost} onClick={() => remove("meta", m.key)}>Салгах</button>}</div>
            ))}</div>
          )}
          <a className={`${s.pri} ${s.big}`} href={href("meta")}><Icon name="link" size={20} />{st.accounts.meta.length ? "Өөр хуудас нэмэх" : "Facebook-ээр холбох"}</a>
          {pages !== null && (
            <div className={s.pickList} style={{ maxHeight: 360 }}>
              {pages.length === 0 && <div className={s.empty}><b>Хуудас олдсонгүй</b><span>Facebook дээр хуудасныхаа админ байх ёстой. Дахин «Facebook-ээр холбох» дарж бүх хуудсаа зөвшөөрнө үү.</span></div>}
              {pages.map((p) => (
                <div key={p.id} className={s.pageRow}>
                  {p.picture ? <img src={p.picture} alt="" /> : <span className={s.orbSm}>{p.name.slice(0, 1)}</span>}
                  <div><b>{p.name}</b><small>{p.igUsername ? `Instagram @${p.igUsername}` : "Instagram холбоогүй"}</small></div>
                  {p.connected ? <span className={s.pill} data-s="published">Холбогдсон</span> : <button className={s.pri} disabled={!!busy} onClick={() => connect(p)}>{busy === p.id ? <i className={s.spin} /> : "Холбох"}</button>}
                </div>
              ))}
            </div>
          )}
          {pages === null && st.accounts.meta.length > 0 && <button className={s.ghost} onClick={loadPages} disabled={busy === "pages"}>{busy === "pages" ? <i className={s.spinB} /> : null}Хуудсуудаа харах</button>}
        </section>

        <section className={s.connCard}>
          <div className={s.connHead}><span className={s.connIco} data-p="th">@</span><div><h3>Threads</h3><p className={s.muted}>Instagram-ын Threads аккаунт</p></div></div>
          {st.accounts.threads.length > 0 && (
            <div className={s.connList}>{st.accounts.threads.map((t) => (
              <div key={t.id}><Icon name={t.ok ? "check" : "alert"} size={16} /><b>@{t.username || t.id}</b>{!t.ok && <span className={s.pill} data-s="held">Дахин холбох</span>}
                {!owner && <button className={s.ghost} onClick={() => remove("threads", t.id)}>Салгах</button>}</div>
            ))}</div>
          )}
          <a className={`${s.btn} ${s.big}`} href={href("threads")}><Icon name="link" size={20} />{st.accounts.threads.length ? "Дахин холбох" : "Threads холбох"}</a>
          <p className={s.muted}>Threads нь таны өмнөх постуудыг уншиж, агент таны хэв маягийг сурахад тусална.</p>
        </section>
      </div>

      <section className={s.card}>
        <button className={s.helpBtn} onClick={() => setHelp(!help)} aria-expanded={help}><Icon name={help ? "chevronUp" : "chevronDown"} size={16} />Instagram харагдахгүй байна уу? Тусламж</button>
        {help && (
          <ol className={s.helpList}>
            <li>Instagram аккаунтаа <b>Professional (Business эсвэл Creator)</b> болгоно: Instagram → Settings → Account type.</li>
            <li>Instagram-аа Facebook хуудастайгаа холбоно: Facebook хуудас → Settings → Linked accounts → Instagram.</li>
            <li>Энд буцаж ирээд «Өөр хуудас нэмэх» дарж, хуудсаа дахин «Холбох».</li>
            <li>Facebook-ийн цонхонд бүх хуудсаа сонгож «Continue» дарахаа мартуузай.</li>
          </ol>
        )}
      </section>

      {params.step === "2" && (
        <div className={s.rowx} style={{ justifyContent: "flex-end" }}>
          <button className={s.ghost} onClick={() => go("home", { step: "3" })}>Дараа холбоно</button>
          <button className={`${s.pri} ${s.big}`} onClick={() => go("home", { step: "3" })} disabled={!any}>Дараагийн алхам: анхны пост <Icon name="arrow" size={20} /></button>
        </div>
      )}
    </div>
  );
}
