"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

// ─── Feed right rail — өнөөдрийн mission, мэдээ, лидерборд. ───

interface JourneyDay {
  day: number;
  title: string;
  description: string;
  xpReward: number;
  status: string;
  releaseAt: string;
}
interface JourneyResponse {
  isPaid: boolean;
  currentDay: number | null;
  nextUnlockAt: string | null;
  days: JourneyDay[];
}
interface NewsItem {
  _id: string;
  title: string;
  slug: string;
  category: string;
}
interface LeaderRow {
  _id: string;
  name: string;
  avatar?: string;
  xp: number;
}

/** Дараагийн unlock хүртэлх HH:MM:SS тоолуур. */
function useCountdown(target: string | null): string {
  const [left, setLeft] = useState("--:--:--");
  useEffect(() => {
    if (!target) {
      setLeft("--:--:--");
      return;
    }
    const pad = (n: number) => String(n).padStart(2, "0");
    const tick = () => {
      const diff = new Date(target).getTime() - Date.now();
      const s = Math.max(0, Math.floor(diff / 1000));
      setLeft(`${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [target]);
  return left;
}

export default function FeedDiscoveryRail() {
  const [journey, setJourney] = useState<JourneyResponse | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);

  useEffect(() => {
    fetch("/api/users/me/journey")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && !d.error) setJourney(d);
      })
      .catch(() => {});
    fetch("/api/news?limit=3")
      .then((r) => r.json())
      .then((d) => setNews(Array.isArray(d.items) ? d.items : []))
      .catch(() => {});
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((d) => setLeaders(Array.isArray(d.leaders) ? d.leaders : []))
      .catch(() => {});
  }, []);

  const currentDayDef = journey?.days.find((d) => d.day === journey.currentDay) || null;
  const nextLockedDay = journey?.days.find((d) => d.status === "locked" || d.status === "preordered") || null;
  const countdownTarget = currentDayDef ? null : journey?.nextUnlockAt || nextLockedDay?.releaseAt || null;
  const countdown = useCountdown(countdownTarget);

  if (!journey && news.length === 0 && leaders.length === 0) return null;

  return (
    <aside className="hidden xl:flex xl:w-[272px] xl:shrink-0 xl:flex-col xl:gap-4">
      {/* Mission of the day */}
      {journey?.isPaid && currentDayDef ? (
        <div className="border border-[#1080CA] bg-[#0D2338] p-5">
          <div className="chrome mb-2 text-[9px] font-bold text-[#1080CA]">● ӨНӨӨДРИЙН MISSION</div>
          <div className="mb-1.5 text-[15px] font-semibold text-[#FFFFFF]">{currentDayDef.title}</div>
          <p className="mb-4 text-[12px] leading-relaxed text-[#B4B4BA]">{currentDayDef.description}</p>
          <div className="flex items-center justify-between text-[10px] font-bold">
            <span className="chrome text-[#84848C]" style={{ fontVariantNumeric: "tabular-nums" }}>
              ДУУСАХАД {countdown}
            </span>
            <span className="chrome text-[#1080CA]">+{currentDayDef.xpReward} XP</span>
          </div>
        </div>
      ) : journey && !journey.isPaid ? (
        <div className="border border-[#2E2E33] bg-[#1E1E21] p-5">
          <div className="chrome mb-2 text-[9px] font-bold text-[#84848C]">○ MISSION ТҮГЖЭЭТЭЙ</div>
          <p className="text-[12px] leading-relaxed text-[#84848C]">
            Өдөр бүрийн mission, XP — Runner гишүүдэд нээлттэй.
          </p>
        </div>
      ) : null}

      {/* News */}
      {news.length > 0 && (
        <div className="border border-[#2E2E33] bg-[#1E1E21] p-5">
          <div className="chrome mb-3 text-[9px] font-bold text-[#84848C]">МЭДЭЭ</div>
          <div className="flex flex-col gap-3">
            {news.map((n) => (
              <Link key={n._id} href={`/news/${n.slug}`} className="group block">
                <div className="text-[13px] font-medium leading-snug text-[#F2F2F4] group-hover:text-[#1080CA]">
                  {n.title}
                </div>
                <div className="chrome mt-1 text-[8px] font-bold text-[#5C5C64]">{n.category}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {leaders.length > 0 && (
        <div className="border border-[#2E2E33] bg-[#1E1E21] p-5">
          <div className="chrome mb-3 text-[9px] font-bold text-[#84848C]">TOP RUNNERS · 7 ХОНОГ</div>
          <div className="flex flex-col gap-2.5">
            {leaders.map((l, i) => (
              <div key={l._id} className="flex items-center gap-2.5">
                <span className="chrome w-4 text-[10px] font-bold text-[#5C5C64]">{i + 1}</span>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#161618] text-[9px] font-bold text-[#84848C]">
                  {l.avatar ? (
                    <img src={l.avatar} alt="" className="h-full w-full object-cover" />
                  ) : (
                    (l.name[0] || "?").toUpperCase()
                  )}
                </span>
                <span className="flex-1 truncate text-[12px] text-[#F2F2F4]">{l.name}</span>
                <span className="chrome text-[10px] font-bold text-[#1080CA]" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {l.xp} XP
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}
