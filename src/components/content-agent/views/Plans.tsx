"use client";

import { useState } from "react";
import Icon, { type IconName } from "@/components/Icon";
import { mnt, type Me } from "../types";
import s from "../agent.module.css";

/* ─── Багцууд (2026-10-26) — Гишүүн / Бизнес ─────────────────────────────────
   Гурван газар: зочны танилцуулга (guest), эрхгүй хэрэглэгчийн сонголт (paywall),
   апп доторх «Бизнес багц» хуудас. Нэг л харьцуулалт — хоёр карт, ялгаа нь тод. */

const MEMBER: { i: IconName; t: string }[] = [
  { i: "image", t: "AI зураг — GPT Image, Grok, Z-Image" },
  { i: "video", t: "AI видео — Kling 4.0, Wan, Seedance" },
  { i: "profile", t: "AI ихэр — өөрийн дүрийг бүтээж зурагт оруулах" },
  { i: "users", t: "Бүтээлээ community-д хуваалцах" },
  { i: "bolt", t: "Кредитгүй — гишүүдэд үнэгүй" },
];
const BUSINESS: { i: IconName; t: string }[] = [
  { i: "compose", t: "Пост бүтээх — таны бизнесийн өнгө аясаар" },
  { i: "link", t: "Facebook, Instagram, Threads хуудас холбох" },
  { i: "calendar", t: "Хуанли, автомат нийтлэл" },
  { i: "layout", t: "Бүтээгдэхүүний студи, AI видео" },
  { i: "image", t: "AI зураг + AI ихэр (өдөрт 60 бүтээлт)" },
];

/** QPay (Wire) checkout эхлүүлнэ — хуудас QPay руу шилжинэ. */
export async function payBusiness(): Promise<{ paid?: boolean }> {
  const r = await fetch("/api/content-agent/billing", { method: "POST" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Алдаа (${r.status})`);
  if (d.url) { window.location.href = d.url; return {}; }
  return { paid: !!d.paid };
}

export default function Plans({ me, guest = false, onPaid, onOpen }: { me?: Me | null; guest?: boolean; onPaid?: () => void; onOpen?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const cb = encodeURIComponent("/content-agent");
  const price = me?.price || 99000;
  const bizActive = me?.mode === "business" && (me.plan === "active" || me.plan === "owner");
  const until = me?.paidUntil ? new Date(me.paidUntil).toISOString().slice(0, 10) : "";

  async function pay() {
    if (guest) { window.location.href = `/auth/signup?callbackUrl=${cb}`; return; }
    setBusy(true); setErr("");
    try { const r = await payBusiness(); if (r.paid) onPaid?.(); }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  }

  return (
    <div className={s.plans}>
      <section className={s.plan}>
        <span className={s.planTag}>Antaqor гишүүнчлэлд багтсан</span>
        <h3>Гишүүн</h3>
        <p className={s.planPrice}><b>0₮</b><span> · нэмэлт төлбөргүй</span></p>
        <ul>{MEMBER.map((x) => <li key={x.t}><Icon name={x.i} size={16} />{x.t}</li>)}</ul>
        {guest ? <a className={`${s.btn} ${s.big}`} href={`/auth/signin?callbackUrl=${cb}`}>Нэвтрэх</a>
          : me?.isMember ? (onOpen ? <button className={`${s.btn} ${s.big}`} onClick={onOpen}><Icon name="check" size={16} />Таны эрх нээлттэй — AI зураг руу</button> : <span className={s.planOn}><Icon name="check" size={16} />Таны эрх нээлттэй</span>)
          : <a className={`${s.btn} ${s.big}`} href="/pricing">Гишүүн болох</a>}
      </section>

      <section className={s.plan} data-pro>
        <span className={s.planTag}>Байгууллага, брэнд, дэлгүүрт</span>
        <h3>Бизнес</h3>
        <p className={s.planPrice}><b>{mnt(price)}</b><span> / сар</span></p>
        <ul>{BUSINESS.map((x) => <li key={x.t}><Icon name={x.i} size={16} />{x.t}</li>)}</ul>
        {bizActive && me?.plan === "active" && <span className={s.planOn}><Icon name="check" size={16} />Идэвхтэй{until ? ` · ${until} хүртэл` : ""}</span>}
        {me?.plan !== "owner" && (
          <button className={`${s.pri} ${s.big}`} onClick={pay} disabled={busy}>
            {busy ? <><i className={s.spin} />QPay нээж байна…</> : guest ? <>Бүртгүүлээд эхлэх <Icon name="arrow" size={16} /></> : bizActive ? <>QPay-ээр сунгах · {mnt(price)}</> : <>QPay-ээр төлөх · {mnt(price)}</>}
          </button>
        )}
        {err && <p className={s.pcReason}>{err}</p>}
        <small className={s.muted}>30 хоног · QPay-ээр төлмөгц шууд нээгдэнэ</small>
      </section>
    </div>
  );
}
