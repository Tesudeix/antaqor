"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { xpForLevel, getLevelProgress, getLevelTitle } from "@/lib/xpClient";

// ─── Feed left rail — profile card + 7 хоногийн явц. ───
// /api/users/me/journey-ийг дахин ашиглана (JourneyBoard-той адил эх сурвалж).

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

const DOT_ACTIVE = new Set(["available", "in_progress", "completed"]);

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
      <aside className="hidden lg:block lg:w-[248px] lg:shrink-0">
        <div className="h-64 animate-pulse bg-[#1E1E21]" />
      </aside>
    );
  }

  const { totals, isPaid, days, currentDay } = journey;
  const levelProgress = getLevelProgress(totals.xp, totals.level);
  const nextLevelXp = xpForLevel(totals.level + 1);
  const tierLabel = isPaid ? getLevelTitle(totals.level).titleMN.toUpperCase() : "FREE";

  return (
    <aside className="hidden lg:flex lg:w-[248px] lg:shrink-0 lg:flex-col lg:gap-4">
      {/* Profile card */}
      <div className="border border-[#2E2E33] bg-[#1E1E21] p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#161618] text-[15px] font-bold text-[#1080CA]">
            {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : initial}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold text-[#FFFFFF]">{name}</div>
            <div className="chrome text-[9px] font-bold text-[#84848C]">{tierLabel}</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold">
            <span className="chrome text-[#84848C]">LEVEL {totals.level}</span>
            <span className="chrome text-[#84848C]" style={{ fontVariantNumeric: "tabular-nums" }}>
              {totals.xp}/{nextLevelXp} XP
            </span>
          </div>
          <div className="h-[3px] overflow-hidden bg-[#2E2E33]">
            <div className="h-full bg-[#1080CA]" style={{ width: `${Math.round(levelProgress * 100)}%` }} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-px bg-[#2E2E33]">
          <div className="bg-[#1E1E21] p-3 text-center">
            <div className="text-[20px] font-bold leading-none text-[#FFFFFF]" style={{ fontFamily: "var(--font-display)" }}>
              {totals.streakDays}
            </div>
            <div className="chrome mt-1.5 text-[8px] font-bold text-[#84848C]">ӨДӨР STREAK</div>
          </div>
          <div className="bg-[#1E1E21] p-3 text-center">
            <div className="text-[20px] font-bold leading-none text-[#FFFFFF]" style={{ fontFamily: "var(--font-display)" }}>
              {totals.completedDays}
            </div>
            <div className="chrome mt-1.5 text-[8px] font-bold text-[#84848C]">MISSION</div>
          </div>
        </div>
      </div>

      {/* 7-day progress (Runner) or locked upsell (Free) */}
      {isPaid ? (
        <div className="border border-[#2E2E33] bg-[#1E1E21] p-5">
          <div className="chrome mb-3 text-[9px] font-bold text-[#84848C]">7 ХОНОГИЙН ЯВЦ</div>
          <div className="flex flex-wrap gap-1.5">
            {days.map((d) => {
              const active = DOT_ACTIVE.has(d.status);
              const done = d.status === "completed";
              return (
                <span
                  key={d.day}
                  className="flex h-7 w-7 items-center justify-center border text-[10px] font-bold"
                  style={{
                    background: done ? "#1080CA" : active ? "#0D2338" : "#161618",
                    color: done ? "#0E0E10" : active ? "#1080CA" : "#5C5C64",
                    borderColor: active ? "#1080CA" : "#2E2E33",
                  }}
                >
                  {d.day}
                </span>
              );
            })}
          </div>
          {currentDay ? (
            <Link href="/classroom" className="chrome mt-4 inline-block text-[9px] font-bold text-[#1080CA] hover:text-[#4FA8E8]">
              ҮРГЭЛЖЛҮҮЛЭХ ››
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="border border-[#2E2E33] bg-[#1E1E21] p-5">
          <div className="chrome mb-2 text-[9px] font-bold text-[#84848C]">○ ЯВЦ ТҮГЖЭЭТЭЙ</div>
          <p className="mb-4 text-[12px] leading-relaxed text-[#84848C]">
            Курс, mission, XP явц — Runner гишүүнчлэлээр нээгдэнэ.
          </p>
          <Link
            href="/pricing"
            className="chrome inline-flex h-9 items-center bg-[#1080CA] px-4 text-[9px] font-bold text-[#0E0E10] transition hover:bg-[#4FA8E8]"
          >
            RUNNER БОЛОХ ››
          </Link>
        </div>
      )}

      <div className="chrome text-[9px] text-[#5C5C64]">AQ-FEED-01</div>
    </aside>
  );
}
