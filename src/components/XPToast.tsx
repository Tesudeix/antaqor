"use client";

import { useEffect, useState } from "react";
import { XP_EVENT, type XPEventDetail } from "@/lib/xpToast";

/* ─── XP toast ──────────────────────────────────────────────────────────
   Дэлгэцийн доод хэсэгт, доод цэсний ДЭЭР 2.4 секунд гарч ирнэ.

   Дүрэм: энэ бол ХАРИУ ҮЙЛДЭЛ, үзүүлбэр биш. Тиймээс
   — нэг мөр, хоёр утга: юу хийсэн, хэдэн XP;
   — товч байхгүй (дарах зүйлгүй, өөрөө алга болно);
   — агуулгыг халхлахгүй (доод цэсний өндрөөс дээш суудаг);
   — дараалалд ордоггүй: шинэ дохио ирвэл хуучныг СОЛИНО. Гурван toast
     дараалан хүлээх нь мэдээлэл биш, дараалал болно.

   Түвшин ахих нь өөр үйл явдал: тэр үед дүүрэн улбар гадаргуу гарна —
   жилд хэдхэн удаа тохиолддог мөчид өнгө зарцуулах нь зөв. */

type Toast = XPEventDetail & { key: number };

export default function XPToast() {
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    let timer = 0;
    const onXP = (e: Event) => {
      const detail = (e as CustomEvent<XPEventDetail>).detail;
      if (!detail?.amount) return;
      setToast({ ...detail, key: Date.now() });
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setToast(null), 2400);
    };
    window.addEventListener(XP_EVENT, onXP);
    return () => {
      window.removeEventListener(XP_EVENT, onXP);
      window.clearTimeout(timer);
    };
  }, []);

  if (!toast) return null;

  const levelUp = !!toast.leveledUp;

  return (
    <div
      key={toast.key}
      role="status"
      aria-live="polite"
      className={`r-float fixed left-1/2 z-[60] flex items-center gap-[var(--sp-3)] px-4 py-2.5 backdrop-blur-xl ${
        levelUp ? "bg-[#2E29FF] text-[#0A0A0A]" : "bg-[#1B1B1F]/95 text-[#F2F2F4]"
      }`}
      style={{
        /* Доод цэсний дээр. Цэс байхгүй дэлгэцэд ч (ширээний) энэ өндөр
           хор хөнөөлгүй — зүгээр л ирмэгээс арай дээр зогсоно. */
        bottom: "calc(var(--nav-h) + var(--nav-safe) + var(--sp-4))",
        animation: "xpToastIn 220ms cubic-bezier(0.2, 0, 0, 1) both",
        boxShadow: "0 10px 30px -12px rgba(0,0,0,0.6)",
      }}
    >
      <span className="chrome text-[10px] font-bold uppercase tracking-[0.16em] opacity-80">
        {levelUp ? `LV.${toast.level ?? ""}` : toast.label || "XP"}
      </span>
      <span
        className="text-[15px] font-extrabold"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {levelUp ? "Түвшин ахилаа" : `+${toast.amount} XP`}
      </span>
    </div>
  );
}
