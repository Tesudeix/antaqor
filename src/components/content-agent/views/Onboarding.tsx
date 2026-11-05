"use client";

import { useRef, useState } from "react";
import Icon from "@/components/Icon";
import { api, upload, type Me, type Seats } from "../types";
import s from "../agent.module.css";

/* Онбординг — бизнес багц (99,000₮) төлөгдсөний ДАРАА: бизнесээ танилцуулах (2 заавал
   талбар). 2-р алхам (хуудас холбох) ба 3-р алхам (анхны пост) апп дотор үргэлжилнэ.
   Ямар ч насны хүнд ойлгомжтой: том талбар, жишээтэй placeholder, нэг үндсэн товч. */
const TONES = ["Найрсаг", "Мэргэжлийн", "Хөгжилтэй", "Урам өгөх", "Тайван, итгэлтэй"];

export default function Onboarding({ me, onDone }: { me: Me; seats?: Seats; onDone: () => void }) {
  const [b, setB] = useState({ name: "", about: "", audience: "", tone: "Найрсаг", logoUrl: "", brandColor: "", website: "", contact: "" });
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [wait, setWait] = useState(me.plan === "waitlist");
  const file = useRef<HTMLInputElement>(null);
  const ready = b.name.trim().length >= 2 && b.about.trim().length >= 10;

  async function logo(f?: File | null) {
    if (!f) return;
    setBusy("logo");
    try { const r = await upload(f); setB((x) => ({ ...x, logoUrl: r.url })); } catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  }
  async function submit() {
    if (!ready || busy) return;
    setBusy("save"); setErr("");
    try {
      const r = await api<{ ws?: string; waitlist?: boolean }>({ action: "onboard", business: b });
      if (r.waitlist) { setWait(true); return; }
      onDone();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(""); }
  }

  if (wait) return (
    <div className={s.app} style={{ display: "block" }}>
      <div className={s.gate}><span className={s.orb}>A</span><h2>Та хүлээлгийн жагсаалтад байна</h2>
        <p className={s.muted} style={{ maxWidth: 420 }}>Туршилтын 100 суудал дүүрсэн. Суудал гармагц бид танд мэдэгдэнэ — баярлалаа!</p>
        <a className={s.btn} href="/">antaqor.com руу буцах</a></div>
    </div>
  );

  return (
    <div className={s.app} style={{ display: "block" }}>
      <div className={s.onb}>
        <div className={s.onbSteps}><span data-on>1. Бизнес</span><i /><span>2. Хуудас холбох</span><i /><span>3. Анхны пост</span></div>
        <h1>Бизнес багц идэвхжлээ{me.name ? `, ${me.name}` : ""} 🎉</h1>
        <p className={s.lead}>Бизнесээ товч танилцуулаарай. Агент үүгээр таны хэв маягаар пост бичнэ. Дараа нь хүссэн үедээ засна.</p>

        <div className={s.card}>
          <div className={s.stack}>
            <label className={s.field}><span>Бизнесийн нэр *</span><input value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} placeholder="Ж: Нарны тавилга" autoFocus /></label>
            <label className={s.field}><span>Юу хийдэг вэ? *</span><textarea rows={4} value={b.about} onChange={(e) => setB({ ...b, about: e.target.value })} placeholder="Ж: Улаанбаатарт гэрийн тавилгыг захиалгаар хийдэг. 10 жилийн туршлагатай, 2 жилийн баталгаатай." /></label>
            <label className={s.field}><span>Хэрэглэгчид тань хэн бэ?</span><input value={b.audience} onChange={(e) => setB({ ...b, audience: e.target.value })} placeholder="Ж: Шинэ байранд орсон залуу гэр бүлүүд" /></label>
            <div className={s.field}><span>Ямар өнгө аястай бичих вэ?</span><div className={s.rowx}>{TONES.map((t) => <button key={t} className={s.chip} aria-pressed={b.tone === t} onClick={() => setB({ ...b, tone: t })}>{t}</button>)}</div></div>
            <div className={s.grid2}>
              <div className={s.field}><span>Лого (заавал биш)</span>
                <button className={s.btn} onClick={() => file.current?.click()} style={{ justifyContent: "flex-start" }}>
                  {busy === "logo" ? <i className={s.spinB} /> : b.logoUrl ? <img src={b.logoUrl} alt="" className={s.logo} /> : <Icon name="upload" size={16} />}{b.logoUrl ? "Солих" : "Лого оруулах"}
                </button>
                <input ref={file} type="file" accept="image/*" hidden onChange={(e) => logo(e.target.files?.[0])} />
              </div>
              <label className={s.field}><span>Утас / холбоо барих (заавал биш)</span><input value={b.contact} onChange={(e) => setB({ ...b, contact: e.target.value })} placeholder="Ж: 9911-2233" /></label>
            </div>
            {err && <p className={s.pcReason}>{err}</p>}
            <button className={`${s.pri} ${s.big}`} disabled={!ready || !!busy} onClick={submit}>{busy === "save" ? <><i className={s.spin} />Бэлдэж байна…</> : <>Үргэлжлүүлэх <Icon name="arrow" size={20} /></>}</button>
            {me.paidUntil && <p className={s.muted} style={{ textAlign: "center" }}>Бизнес багц · {new Date(me.paidUntil).toISOString().slice(0, 10)} хүртэл</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
