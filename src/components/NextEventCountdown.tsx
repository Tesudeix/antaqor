"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface EventItem {
  _id: string;
  title: string;
  type: "event" | "live" | "class" | "deadline" | "workshop" | "challenge" | "mentor";
  date: string;
  endDate?: string;
  status: "upcoming" | "live" | "ended";
  liveLink?: string;
  image?: string;
  attendeeCount?: number;
}

const TYPE_CFG: Record<EventItem["type"], { label: string; color: string }> = {
  live:      { label: "LIVE",       color: "#EF2C58" },
  class:     { label: "ХИЧЭЭЛ",     color: "#0F81CA" },
  workshop:  { label: "ВОРКШОП",    color: "#A855F7" },
  challenge: { label: "CHALLENGE",  color: "#06B6D4" },
  mentor:    { label: "MENTOR",     color: "#14B8A6" },
  event:     { label: "ЭВЕНТ",      color: "#EF2C58" },
  deadline:  { label: "ДЕДЛАЙН",    color: "#EF2C58" },
};

const MN_DAYS = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];

function pickNext(events: EventItem[]): EventItem | null {
  if (!events?.length) return null;
  const live = events.find((e) => e.status === "live");
  if (live) return live;
  return events
    .filter((e) => e.status === "upcoming")
    .sort((a, b) => +new Date(a.date) - +new Date(b.date))[0] || null;
}

function deterministicGradient(seed: string, color: string) {
  const hash = Array.from(seed).reduce((a, c) => a + c.charCodeAt(0), 0);
  return `linear-gradient(${hash % 360}deg, ${color} 0%, #0A0A0A 80%)`;
}

// Smart, scannable phrase — no zero-padded "187 х 18 ц 14 м 02 с" wall.
function whenLabel(target: number, now: number, isLive: boolean, endMs: number): { phrase: string; ticking: boolean } {
  if (isLive) {
    const minLeft = Math.max(0, Math.floor((endMs - now) / 60000));
    if (minLeft <= 0) return { phrase: "ОДОО ЯВЖ БАЙНА", ticking: false };
    return { phrase: `ОДОО ЯВЖ БАЙНА · ${minLeft} мин үлдсэн`, ticking: true };
  }
  const diffMs = target - now;
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const d = new Date(target);
  const hhmm = d.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" });

  // Far future (> 30 days) → just date
  if (day > 30) {
    return { phrase: `${d.getMonth() + 1}/${d.getDate()} · ${MN_DAYS[d.getDay()]} · ${hhmm}`, ticking: false };
  }
  // 7-30 days → "X хоногийн дараа · 11/13"
  if (day >= 7) {
    return { phrase: `${day} хоногийн дараа · ${d.getMonth() + 1}/${d.getDate()}`, ticking: false };
  }
  // 1-6 days → "Маргааш · 19:00" / "X хоногийн дараа · 19:00"
  if (day >= 1) {
    return { phrase: `${day === 1 ? "Маргааш" : `${day} хоногийн дараа`} · ${hhmm}`, ticking: false };
  }
  // < 24 hours → "X цаг Y минутын дараа"
  if (hr >= 1) {
    return { phrase: `${hr} цаг ${min % 60} минутын дараа`, ticking: false };
  }
  // < 1 hour → ticking
  if (min >= 10) {
    return { phrase: `${min} минутын дараа`, ticking: false };
  }
  if (min >= 1) {
    return { phrase: `${min} минут ${sec % 60} секундын дараа`, ticking: true };
  }
  return { phrase: `${sec} секундын дараа`, ticking: true };
}

export default function NextEventCountdown() {
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    let cancel = false;
    fetch("/api/events")
      .then((r) => r.json())
      .then((d) => { if (!cancel && Array.isArray(d.events)) setEvent(pickNext(d.events)); })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoaded(true); });
    return () => { cancel = true; };
  }, []);

  // Adaptive ticker: 1s when very close, 1min otherwise. Battery-friendly.
  const targetMs = event ? +new Date(event.date) : 0;
  const endMs = event ? (event.endDate ? +new Date(event.endDate) : targetMs + 60 * 60 * 1000) : 0;
  const isClose = event ? (now >= targetMs && now < endMs) || (targetMs - now < 60 * 60 * 1000) : false;

  useEffect(() => {
    if (!event) return;
    const interval = isClose ? 1000 : 60_000;
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [event, isClose]);

  const info = useMemo(() => {
    if (!event) return null;
    const isLive = event.status === "live" || (now >= targetMs && now < endMs);
    return { isLive, ...whenLabel(targetMs, now, isLive, endMs) };
  }, [event, now, targetMs, endMs]);

  if (!loaded || !event || !info) return null;
  // Defensive: hide ended events that pickNext somehow returned
  if (!info.isLive && targetMs - now <= 0) return null;

  const cfg = TYPE_CFG[event.type] || TYPE_CFG.event;
  const date = new Date(event.date);

  return (
    <Link
      href="/calendar"
      className={`group relative flex items-center gap-3 overflow-hidden rounded-[4px] border p-2 pr-3 transition ${
        info.isLive
          ? "border-[rgba(239,44,88,0.45)] bg-[rgba(239,44,88,0.06)] hover:border-[rgba(239,44,88,0.7)]"
          : "border-[rgba(255,255,255,0.08)] bg-[#0F0F10] hover:border-[rgba(239,44,88,0.3)]"
      }`}
    >
      {/* Cover thumb (image OR seeded gradient with date stamp) */}
      <div
        className="relative h-12 w-12 shrink-0 overflow-hidden rounded-[4px] sm:h-14 sm:w-14"
        style={!event.image ? { background: deterministicGradient(event._id, cfg.color) } : undefined}
      >
        {event.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.image} alt="" className="h-full w-full object-cover" />
        )}
        {/* Date stamp overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
          <span className="text-[8px] font-bold uppercase leading-none text-white/80">{MN_DAYS[date.getDay()]}</span>
          <span className="text-[16px] font-black leading-none text-white sm:text-[18px]">{date.getDate()}</span>
        </div>
      </div>

      {/* Body */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {info.isLive && (
            <span className="inline-flex h-1.5 w-1.5 animate-pulse rounded-full bg-[#EF2C58]" />
          )}
          <span
            className="rounded-full px-1.5 py-0.5 text-[8px] font-black tracking-wider text-white"
            style={{ background: cfg.color }}
          >
            {cfg.label}
          </span>
          <span
            className={`truncate text-[10px] font-bold uppercase tracking-[0.06em] ${
              info.isLive ? "text-[#EF2C58]" : "text-[#888]"
            }`}
          >
            {info.phrase}
          </span>
        </div>
        <div className="mt-0.5 truncate text-[13px] font-bold text-[#E8E8E8] sm:text-[14px]">
          {event.title}
        </div>
      </div>

      {/* Arrow */}
      <svg
        className="h-4 w-4 shrink-0 text-[#666] transition group-hover:translate-x-0.5 group-hover:text-[#EF2C58]"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
      </svg>
    </Link>
  );
}
