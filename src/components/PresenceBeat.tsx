"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

/* Нэвтэрсэн хүн сайтын аль ч хуудсанд байхад 60с тутам "амьд" дохио илгээнэ
   (/api/presence). Таб далд байхад илгээхгүй — "онлайн" гэдэг нь жинхэнэ
   идэвх. Таб буцаж нээгдэхэд шууд илгээнэ. */
export default function PresenceBeat() {
  const { status } = useSession();
  useEffect(() => {
    if (status !== "authenticated") return;
    const beat = () => {
      if (document.visibilityState !== "visible") return;
      fetch("/api/presence", { method: "POST" }).catch(() => {});
    };
    beat();
    const t = setInterval(beat, 60_000);
    document.addEventListener("visibilitychange", beat);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", beat); };
  }, [status]);
  return null;
}
