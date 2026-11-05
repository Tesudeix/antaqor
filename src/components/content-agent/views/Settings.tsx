"use client";

import { useRef, useState } from "react";
import { signOut } from "next-auth/react";
import Icon from "@/components/Icon";
import { api, p2, PL, usd, upload, type Business, type Ctx, type Plat } from "../types";
import s from "../agent.module.css";

/* Тохиргоо — автомат горим, холбосон хуудсууд (олон аккаунт), үсэг засах, generic хэллэгийн
   жагсаалт, эзний жишээ постууд, өдөр бүр асуух цаг. */
export default function Settings(ctx: Ctx) {
  const { st, reload, say, go } = ctx;
  const owner = st.me.ws === "main";
  const capLocked = !owner && st.me.plan !== "active";
  const [biz, setBiz] = useState<Business | null>(st.me.business ? { ...st.me.business } : null);
  const [bizBusy, setBizBusy] = useState("");
  const logoRef = useRef<HTMLInputElement>(null);
  async function saveBiz() {
    if (!biz) return;
    setBizBusy("save");
    try { await api({ action: "business", business: biz }); say("Бизнесийн мэдээлэл хадгалагдлаа"); await reload(); } catch (e) { say((e as Error).message, true); } finally { setBizBusy(""); }
  }
  async function logo(f?: File | null) {
    if (!f || !biz) return;
    setBizBusy("logo");
    try { const r = await upload(f); setBiz({ ...biz, logoUrl: r.url }); } catch (e) { say((e as Error).message, true); } finally { setBizBusy(""); }
  }
  const [c, setC] = useState({ ...st.cfg, generic: [...st.cfg.generic], examples: [...st.cfg.examples], media: { ...st.cfg.media } });
  const vm = st.hf.models.find((x) => x.id === c.media.videoModel);
  const setM = (k: keyof typeof c.media, v: string | number) => setC({ ...c, media: { ...c.media, [k]: v } });
  const [g, setG] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try { await api({ action: "config", config: { auto: c.auto, spellFix: c.spellFix, channels: c.channels, generic: c.generic, examples: c.examples.filter((x) => x.trim()), runHour: c.runHour, accounts: c.accounts, media: c.media } }); say("Хадгаллаа"); await reload(); }
    catch (e) { say((e as Error).message, true); } finally { setBusy(false); }
  }
  return (
    <div className={s.page}>
      <div className={s.pageHead}><div><h1>Тохиргоо</h1><p>Агент хэрхэн ажиллахыг энд тохируулна.</p></div><button className={`${s.pri} ${s.big}`} onClick={save} disabled={busy}>{busy ? <i className={s.spin} /> : null}Хадгалах</button></div>
      {biz && (
        <section className={s.card}>
          <div className={s.cardHead}><h3>Бизнесийн мэдээлэл</h3><small>Агент үүгээр таны нэрийн өмнөөс бичнэ</small></div>
          <div className={s.stack}>
            <div className={s.grid2}>
              <label className={s.field}><span>Нэр</span><input value={biz.name} onChange={(e) => setBiz({ ...biz, name: e.target.value })} /></label>
              <label className={s.field}><span>Өнгө аяс</span><input value={biz.tone} onChange={(e) => setBiz({ ...biz, tone: e.target.value })} placeholder="Найрсаг, ойлгомжтой" /></label>
            </div>
            <label className={s.field}><span>Юу хийдэг вэ</span><textarea rows={3} value={biz.about} onChange={(e) => setBiz({ ...biz, about: e.target.value })} /></label>
            <label className={s.field}><span>Хэрэглэгчид</span><input value={biz.audience} onChange={(e) => setBiz({ ...biz, audience: e.target.value })} /></label>
            <div className={s.grid3}>
              <label className={s.field}><span>Утас / холбоо барих</span><input value={biz.contact} onChange={(e) => setBiz({ ...biz, contact: e.target.value })} /></label>
              <label className={s.field}><span>Вэб / хуудас</span><input value={biz.website} onChange={(e) => setBiz({ ...biz, website: e.target.value })} /></label>
              <label className={s.field}><span>Брэнд өнгө</span><input type="color" value={biz.brandColor || "#2E29FF"} onChange={(e) => setBiz({ ...biz, brandColor: e.target.value })} style={{ height: 42, padding: 4 }} /></label>
            </div>
            <div className={s.rowx}>
              <button className={s.btn} onClick={() => logoRef.current?.click()}>{bizBusy === "logo" ? <i className={s.spinB} /> : biz.logoUrl ? <img src={biz.logoUrl} alt="" className={s.logo} /> : <Icon name="upload" size={16} />}{biz.logoUrl ? "Лого солих" : "Лого оруулах"}</button>
              <input ref={logoRef} type="file" accept="image/*" hidden onChange={(e) => logo(e.target.files?.[0])} />
              <span style={{ flex: 1 }} />
              <button className={s.pri} disabled={!!bizBusy || biz.name.trim().length < 2} onClick={saveBiz}>{bizBusy === "save" ? <i className={s.spin} /> : null}Хадгалах</button>
            </div>
          </div>
        </section>
      )}
      <div className={s.grid2}>
        <section className={s.card}>
          <div className={s.cardHead}><h3>Автомат горим</h3></div>
          <div className={s.stack}>
            <label className={s.rowx}><span className={s.switch}><input type="checkbox" checked={c.auto} onChange={(e) => setC({ ...c, auto: e.target.checked })} /><i /></span><b>Батлалтгүй, өөрөө нийтлэх</b></label>
            <p className={s.muted}>Асаалттай үед агент хуваарийн дагуу өөрөө нийтэлнэ. Таны хэлээгүй үнэ, хямдрал, огноо агуулсан эсвэл өмнөхтэй хэт төстэй пост нийтлэгдэхгүй — «Анхаарах»-д үлдэж, та шалгана.</p>
            <label className={s.rowx}><span className={s.switch}><input type="checkbox" checked={c.spellFix} onChange={(e) => setC({ ...c, spellFix: e.target.checked })} /><i /></span><b>Үсгийн алдааг автоматаар засах</b></label>
            <label className={s.field}><span>Өдөр бүр санаа асуух цаг</span><select value={c.runHour} onChange={(e) => setC({ ...c, runHour: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{p2(h)}:00</option>)}</select></label>
          </div>
        </section>
        <section className={s.card}>
          <div className={s.cardHead}><h3>Холбосон хуудсууд</h3><button className={s.btn} onClick={() => go("connect")}><Icon name="plus" size={16} />Хуудас холбох</button></div>
          <div className={s.stack}>
            <div className={s.field}><span>Үндсэн сувгууд</span><div className={s.rowx}>{(["threads", "facebook", "instagram"] as Plat[]).map((x) => <button key={x} className={s.chip} aria-pressed={c.channels.includes(x)} onClick={() => setC({ ...c, channels: c.channels.includes(x) ? c.channels.filter((y) => y !== x) : [...c.channels, x] })}>{PL[x]}</button>)}</div></div>
            <label className={s.field}><span>Facebook / Instagram хуудас</span><select value={c.accounts.metaAccount} onChange={(e) => setC({ ...c, accounts: { ...c.accounts, metaAccount: e.target.value } })}>{st.accounts.meta.map((m) => <option key={m.key} value={m.key}>{m.label || m.key}{m.facebook ? " · FB" : ""}{m.instagram ? " · IG" : ""}</option>)}</select></label>
            <label className={s.field}><span>Threads аккаунт</span><select value={c.accounts.threadsUserId} onChange={(e) => setC({ ...c, accounts: { ...c.accounts, threadsUserId: e.target.value } })}><option value="">Автомат</option>{st.accounts.threads.map((t) => <option key={t.id} value={t.id}>@{t.username}{t.ok ? "" : " (дахин холбох)"}</option>)}</select></label>
            <p className={s.muted}>{st.accounts.meta.length} Meta хуудас · {st.accounts.threads.length} Threads аккаунт холбогдсон. Пост бүрийг нийтлэхдээ өөр хуудас сонгож болно.</p>
          </div>
        </section>
      </div>
      <section className={s.card}>
        <div className={s.cardHead}><h3>AI медиа — Higgsfield</h3><small>{st.hf.ready ? `Холбогдсон · өнөөдөр ${usd(st.hf.spentToday)} зарцуулсан` : "HF_CREDENTIALS тохируулаагүй"}</small></div>
        <div className={s.grid3}>
          <label className={s.field}><span>Зургийн загвар</span><select value={c.media.imageModel} onChange={(e) => setM("imageModel", e.target.value)}>{st.hf.models.filter((x) => x.kind === "image").map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
          <label className={s.field}><span>Видеоны загвар</span><select value={c.media.videoModel} onChange={(e) => setM("videoModel", e.target.value)}>{st.hf.models.filter((x) => x.kind === "video").map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
          <label className={s.field}><span>Анхдагч харьцаа</span><select value={c.media.ratio} onChange={(e) => setM("ratio", e.target.value)}>{["9:16", "4:5", "1:1", "3:4", "16:9"].map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
          <label className={s.field}><span>Видеоны чанар</span><select value={c.media.videoRes} onChange={(e) => setM("videoRes", e.target.value)}>{(vm?.res || ["720p"]).map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
          <label className={s.field}><span>Видеоны урт</span><select value={c.media.videoDur} onChange={(e) => setM("videoDur", Number(e.target.value))}>{(vm?.durations || [5]).map((d) => <option key={d} value={d}>{d} сек</option>)}</select></label>
          <label className={s.field}><span>Өдрийн хязгаар ($){capLocked ? " · туршилт" : ""}</span><input type="number" min={0} max={200} step={0.5} value={c.media.dailyUsd} disabled={capLocked} onChange={(e) => setM("dailyUsd", Number(e.target.value))} /></label>
        </div>
        <p className={s.muted} style={{ marginTop: 10 }}>Хуваарийн дүрэм (AI зураг/видео), Бүтээх, Медиа студи бүгд энэ хязгаарт багтана — хүрвэл агент медиа үүсгэхээ зогсоож, постыг «Анхаарах»-д үлдээнэ. Үнэ: Higgsfield-ийн одоогийн тариф.</p>
      </section>
      <section className={s.card}>
        <div className={s.cardHead}><h3>Generic хэллэг — агент хэзээ ч бичихгүй</h3><small>{c.generic.length}</small></div>
        <div className={s.rowx}>{c.generic.map((x) => <button key={x} className={s.chip} onClick={() => setC({ ...c, generic: c.generic.filter((y) => y !== x) })} title="Хасах">{x} ×</button>)}</div>
        <div className={s.rowx} style={{ marginTop: 10 }}><input style={{ flex: 1 }} value={g} onChange={(e) => setG(e.target.value)} placeholder="Нэмэх хэллэг…" onKeyDown={(e) => { if (e.key === "Enter" && g.trim()) { setC({ ...c, generic: [...c.generic, g.trim().toLowerCase()] }); setG(""); } }} /><button className={s.btn} disabled={!g.trim()} onClick={() => { setC({ ...c, generic: [...c.generic, g.trim().toLowerCase()] }); setG(""); }}>Нэмэх</button></div>
      </section>
      <section className={s.card}>
        <div className={s.cardHead}><h3>Таны жишээ постууд</h3><small>Агент энэ өнгө аяс, эрч хүчийг дуурайна</small></div>
        <div className={s.stack}>
          {c.examples.map((x, i) => <div key={i} className={s.rowx}><textarea style={{ flex: 1 }} rows={2} value={x} onChange={(e) => setC({ ...c, examples: c.examples.map((y, k) => (k === i ? e.target.value : y)) })} /><button className={s.ghost} onClick={() => setC({ ...c, examples: c.examples.filter((_, k) => k !== i) })}><Icon name="trash" size={16} /></button></div>)}
          <button className={s.btn} onClick={() => setC({ ...c, examples: [...c.examples, ""] })}><Icon name="plus" size={16} />Жишээ нэмэх</button>
        </div>
      </section>
      <section className={s.card}>
        <div className={s.cardHead}><h3>Бүртгэл</h3><small>Энэ төхөөрөмж дээрээс гарах</small></div>
        <div className={s.acct}>
          <span className={s.acctAv}>{(st.me.name || st.me.email || "?").slice(0, 1).toUpperCase()}</span>
          <div className={s.acctTx}><b>{st.me.name || st.me.email?.split("@")[0]}</b><span>{st.me.email}</span></div>
          <button className={s.danger} onClick={() => { if (window.confirm("Antaqor Agent-аас гарах уу?")) signOut({ callbackUrl: `${window.location.origin}/content-agent` }); }}><Icon name="logout" size={16} />Гарах</button>
        </div>
      </section>
    </div>
  );
}
