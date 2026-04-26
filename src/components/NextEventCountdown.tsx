"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

interface EventItem {
  _id: string;
  title: string;
  type: "event" | "live" | "class" | "deadline" | "workshop";
  date: string;
  endDate?: string;
  status: "upcoming" | "live" | "ended";
  liveLink?: string;
  attendeeCount?: number;
}

const TYPE_LABEL: Record<EventItem["type"], string> = {
  live: "LIVE",
  class: "ХИЧЭЭЛ",
  workshop: "ВОРКШОП",
  event: "ЭВЕНТ",
  deadline: "ДЕДЛАЙН",
};

function pickNext(events: EventItem[]): EventItem | null {
  if (!events || events.length === 0) return null;
  // Prefer currently-live, otherwise the soonest upcoming
  const live = events.find((e) => e.status === "live");
  if (live) return live;
  const upcoming = events
    .filter((e) => e.status === "upcoming")
    .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  return upcoming[0] || null;
}

function diffParts(target: number, now: number) {
  const diff = Math.max(0, target - now);
  const total = Math.floor(diff / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { days, hours, minutes, seconds, total };
}

export default function NextEventCountdown() {
  const [event, setEvent] = useState<EventItem | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancel = false;
    fetch("/api/events")
      .then((r) => r.json())
      .then((d) => { if (!cancel && Array.isArray(d.events)) setEvent(pickNext(d.events)); })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoaded(true); });
    return () => { cancel = true; };
  }, []);

  // Tick every second only when an event is loaded — saves battery on idle pages
  useEffect(() => {
    if (!event) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [event]);

  const { isLive, label, parts } = useMemo(() => {
    if (!event) return { isLive: false, label: "", parts: null as ReturnType<typeof diffParts> | null };
    const startMs = +new Date(event.date);
    const endMs = event.endDate ? +new Date(event.endDate) : startMs + 60 * 60 * 1000;
    const live = event.status === "live" || (now >= startMs && now < endMs);
    if (live) {
      return { isLive: true, label: "ОДОО ЯВЖ БАЙНА", parts: diffParts(endMs, now) };
    }
    return { isLive: false, label: "ЭХЛЭХ ХҮРТЭЛ", parts: diffParts(startMs, now) };
  }, [event, now]);

  if (!loaded || !event || !parts) return null;

  // Don't show "ended" leftovers — pickNext already filters but defensive
  if (parts.total === 0 && !isLive) return null;

  const typeLabel = TYPE_LABEL[event.type] || "ЭВЕНТ";

  // Hide days unit if 0; hide hours if 0 days+hours; collapse smartly
  const showDays = parts.days > 0;
  const showHours = parts.days > 0 || parts.hours > 0;

  return (
    <Link
      href="/calendar"
      className={`group relative block overflow-hidden rounded-[4px] border transition ${
        isLive
          ? "border-[rgba(239,44,88,0.5)] bg-[rgba(239,44,88,0.08)] hover:border-[rgba(239,44,88,0.7)]"
          : "border-[rgba(255,255,255,0.08)] bg-[#0F0F10] hover:border-[rgba(239,44,88,0.3)]"
      }`}
    >
      <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
        {/* Pulse + type badge */}
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-[4px] bg-[#EF2C58] px-2 py-1 text-[9px] font-black tracking-[0.14em] text-white">
          {isLive && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
          {typeLabel}
        </span>

        {/* Title */}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-bold text-[#E8E8E8] sm:text-[13px]">
            {event.title}
          </div>
          <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#666] sm:text-[10px]">
            {label}
          </div>
        </div>

        {/* Countdown */}
        <div className="flex shrink-0 items-center gap-1 font-mono text-[11px] font-black sm:gap-1.5 sm:text-[13px]">
          {showDays && (
            <>
              <span className="text-[#EF2C58]">{parts.days}</span>
              <span className="text-[8px] text-[#666] sm:text-[9px]">х</span>
            </>
          )}
          {showHours && (
            <>
              <span className="text-[#EF2C58]">{String(parts.hours).padStart(2, "0")}</span>
              <span className="text-[8px] text-[#666] sm:text-[9px]">ц</span>
            </>
          )}
          <span className="text-[#EF2C58]">{String(parts.minutes).padStart(2, "0")}</span>
          <span className="text-[8px] text-[#666] sm:text-[9px]">м</span>
          <span className="text-[#EF2C58]">{String(parts.seconds).padStart(2, "0")}</span>
          <span className="text-[8px] text-[#666] sm:text-[9px]">с</span>
        </div>

        {/* Arrow */}
        <svg
          className="h-3.5 w-3.5 shrink-0 text-[#666] transition group-hover:translate-x-0.5 group-hover:text-[#EF2C58]"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </div>
    </Link>
  );
}
