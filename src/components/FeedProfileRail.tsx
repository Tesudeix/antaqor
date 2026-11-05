"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { xpForLevel, getLevelProgress, getLevelTitle } from "@/lib/xpClient";

// ─── Feed rail — ЗӨВХӨН профайлын карт. ───
// 2026-09-04: streak тоолуур, даалгаврын тоолуур, 7 хоногийн явцын
// сүлжээ, ҮРГЭЛЖЛҮҮЛЭХ холбоос, мөн үнэгүй хэрэглэгчид харагддаг
// "явц түгжээтэй" санал — бүгдийг ХАСАВ (эзний шийдвэр). Хажуугийн
// багана нь хүн ХЭН болохыг хэлэх ёстой; өдөр бүрийн хөтөлбөр нь
// /classroom-ийн ажил, урсгалынх биш.
// `/api/users/me/journey` нь ХЭВЭЭР дуудагдана — түвшин, XP хоёр
// түүнээс ирдэг.

interface JourneyDayLite {
  day: number;
  status: string;
}
interface JourneyResponse {
  isPaid: boolean;
  currentDay: number | null;
  totals: { xp: number; level: number; streakDays: number; completedDays: number };
  days: JourneyDayLite[];
}

export default function FeedProfileRail() {
  const { data: session } = useSession();
  const [journey, setJourney] = useState<JourneyResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/users/me/journey")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled && d && !d.error) setJourney(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const name = session?.user?.name || "Гишүүн";
  const initial = (name[0] || "?").toUpperCase();
  const avatar = session?.user?.image;

  if (!journey) {
    return (
      <div className="h-64 animate-pulse bg-[#0A0A0A]" />
    );
  }

  const { totals, isPaid } = journey;
  const levelProgress = getLevelProgress(totals.xp, totals.level);
  const nextLevelXp = xpForLevel(totals.level + 1);
  const tierLabel = isPaid ? getLevelTitle(totals.level).titleMN.toUpperCase() : "FREE";

  return (
    // Hairline-joined stack — картууд 1px зайгаар нийлж нэг блок болно.
    <div className="flex flex-col gap-px bg-[#141414]">
      {/* Profile card */}
      <div className="bg-[#0A0A0A] p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[4px] bg-[#0A0A0A] text-[14px] font-bold text-[#E2E4E8]">
            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initial}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold text-[#FFFFFF]">{name}</div>
            <div className="chrome text-[11px] font-bold text-[#E2E4E8]">{tierLabel}</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold">
            <span className="chrome text-[#E2E4E8]">LEVEL {totals.level}</span>
            <span className="chrome text-[#E2E4E8]" style={{ fontVariantNumeric: "tabular-nums" }}>
              {totals.xp}/{nextLevelXp} XP
            </span>
          </div>
          <div className="h-[3px] overflow-hidden bg-[#141414]">
            <div className="h-full bg-[#2E29FF]" style={{ width: `${Math.round(levelProgress * 100)}%` }} />
          </div>
        </div>

      </div>

    </div>
  );
}
