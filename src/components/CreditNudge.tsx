"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { isAdminEmail } from "@/lib/adminClient";
import s from "./CreditNudge.module.css";

/* ─── «Кредит бага» сануулга (2026-10-26) — community урсгалын дээд талд ─────
   Үлдэгдэл /admin/economics-ийн `lowAt`-аас доош бол AI Studio-д юу хийж
   чадахыг (GPT Image 2 «Сайн» ≈410 кр, Kling видео ≈5,630 кр) хэлээд цэнэглэхийг санал болгоно.
   Хаавал 24 цаг гарахгүй. Админд кредит хасагддаггүй ч эзэн шалгаж харах ёстой тул
   «гишүүдэд ингэж харагдана» гэсэн тэмдэгтэйгээр ҮРГЭЛЖ харагдана (2026-10-26). */
const KEY = "aq.creditNudge";

export default function CreditNudge({ className = "" }: { className?: string }) {
  const { data: session, status } = useSession();
  const [st, setSt] = useState<{ balance: number; lowAt: number; image: number; video: number; admin: boolean } | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    /* 2026-10-27: мобайл дээр сануулга (мөн админы урьдчилсан харагдац) гарахгүй. */
    if (window.matchMedia("(max-width: 767px)").matches) return;
    const admin = isAdminEmail(session?.user?.email);
    try { if (Date.now() - Number(localStorage.getItem(KEY) || 0) < 24 * 3600e3) return; } catch { /* хувийн цонх */ }
    let alive = true;
    Promise.all([fetch("/api/credits").then((r) => r.json()), fetch("/api/credits/prices").then((r) => r.json())])
      .then(([c, p]) => {
        if (!alive || typeof c?.balance !== "number" || !p?.lowAt) return;
        if (admin || c.balance < p.lowAt) setSt({ balance: c.balance, lowAt: p.lowAt, image: p.image, video: p.video, admin });
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [status, session?.user?.email]);

  if (!st) return null;
  const close = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* */ } setSt(null); };
  const n = (x: number) => x.toLocaleString("en-US");

  return (
    <div className={`${s.box} ${className}`} role="status">
      <div className={s.icon} aria-hidden>✦</div>
      <div className={s.text}>
        <b>Кредит бага байна — {n(st.balance)} кр</b>
        <span>AI Studio-д зураг ≈{n(st.image)} кр, Kling 4 видео ≈{n(st.video)} кр. 1 кр = 1₮.</span>
        {st.admin && <i className={s.admin}>Админ харагдац — гишүүний үлдэгдэл {n(st.lowAt)} кр-оос доош болоход ингэж гарна. Таны данс хязгааргүй.</i>}
      </div>
      <Link className={s.cta} href="/credits/buy?next=/content-agent">Кредит авах</Link>
      <button type="button" className={s.x} onClick={close} aria-label="Хаах">×</button>
    </div>
  );
}
