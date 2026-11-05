"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { CreditIcon } from "@/components/CreditIcon";
import Icon from "@/components/Icon";

/* ─── Дээд мөрний кредитийн чип ──────────────────────────────────────────
   Хонхны хажууд, аватарын өмнө. Хоёр л зүйл хэлнэ: ХЭДЭН кредиттэй вэ,
   дарвал ХААНААС авах вэ.

   ХЭЗЭЭ ЮУ Ч ХАРУУЛАХГҮЙ ВЭ: нэвтрээгүй үед. Зочинд "0 кредит" гэж
   харуулах нь утгагүй — тэр хүн эхлээд бүртгүүлэх ёстой, чип нь зөвхөн
   ойлгомжгүй тоо нэмнэ.

   ШИНЭЧЛЭЛТ: mount дээр нэг, цонх руу буцаж ирэхэд дахин уншина. Зураг
   үүсгэсэн, видео хийсэн, кредит худалдаж авсны дараа хүн энэ тоог
   ЗӨВ харах ёстой — тогтмол poll хийхгүйгээр. Кредит зарцуулсан хуудас
   бүр өөрийн балансаа мэддэг тул тэднээс `antaqor:credits` дохио ирвэл
   бас шинэчилнэ. */
export default function CreditPill({ className = "" }: { className?: string }) {
  const { status } = useSession();
  const [balance, setBalance] = useState<number | null>(null);
  /** Гишүүнчлэл дуусах огноо (ISO) — идэвхгүй бол null. */
  const [memberUntil, setMemberUntil] = useState<string | null>(null);

  const load = useCallback(() => {
    if (status !== "authenticated") return;
    fetch("/api/credits")
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.balance === "number") setBalance(d.balance);
        setMemberUntil(typeof d.memberUntil === "string" ? d.memberUntil : null);
      })
      .catch(() => {});
  }, [status]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (status !== "authenticated") return;
    const onFocus = () => load();
    const onCredits = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener("antaqor:credits", onCredits);
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("antaqor:credits", onCredits);
    };
  }, [status, load]);

  if (status !== "authenticated") return null;

  /* ГИШҮҮНЧЛЭЛИЙН ХОНОГ — кредитийн хажууд. Идэвхтэй гишүүнд л харагдана;
     сүүлийн 5 хоногт анхааруулгын өнгөтэй болж /pricing руу сунгахыг
     сануулна. Хоног нь дээш бөөрөнхийлнө: 2.1 хоног үлдсэн хүнд "2" гэвэл
     маргааш нь "1" биш "0" харагдах эрсдэлтэй. */
  const days = memberUntil
    ? Math.max(0, Math.ceil((new Date(memberUntil).getTime() - Date.now()) / 86_400_000))
    : null;
  const ending = days !== null && days <= 5;

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {days !== null && (
        <Link
          href="/pricing"
          aria-label={`Гишүүнчлэл: ${days} хоног үлдсэн`}
          title="Гишүүнчлэл — үлдсэн хоног"
          className="press inline-flex h-9 items-center gap-1 rounded-[4px] px-2 text-[12.5px] font-bold tabular-nums transition"
          style={
            ending
              ? { background: "rgba(216,27,74,0.12)", color: "#D81B4A" }
              : { background: "rgba(252,238,10,0.14)", color: "#FCEE0A" }
          }
        >
          <Icon name="calendar" size={12} />
          {days} хоног
        </Link>
      )}
      <Link
        href="/credits/buy"
        aria-label={`Кредит: ${balance ?? "…"}`}
        title="Кредит нэмэх"
        className="press inline-flex h-9 items-center gap-1 rounded-[4px] px-2 text-[12.5px] font-bold tabular-nums transition"
        style={{ background: "rgba(46,41,255,0.12)", color: "var(--accent-ink, #2E29FF)" }}
      >
        <CreditIcon size={12} />
        {balance === null ? "…" : balance.toLocaleString()}
        <Icon name="plus" size={12} />
      </Link>
    </span>
  );
}
