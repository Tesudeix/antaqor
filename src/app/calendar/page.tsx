"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface CalEvent {
  _id: string;
  title: string;
  description: string;
  type: string;
  date: string;
  endDate: string;
  liveLink: string;
  location: string;
  status: "upcoming" | "live" | "ended";
  image: string;
  attendeeCount: number;
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; iconPath: string }> = {
  live:      { label: "LIVE",       color: "#EF2C58", bg: "rgba(239,44,88,0.18)",  iconPath: "M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" },
  class:     { label: "Хичээл",     color: "#EF2C58", bg: "rgba(239,44,88,0.18)", iconPath: "M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84" },
  workshop:  { label: "Воркшоп",    color: "#A855F7", bg: "rgba(168,85,247,0.18)", iconPath: "M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3" },
  challenge: { label: "Challenge",  color: "#06B6D4", bg: "rgba(6,182,212,0.18)",  iconPath: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" },
  mentor:    { label: "1:1 Mentor", color: "#14B8A6", bg: "rgba(20,184,166,0.18)", iconPath: "M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
  event:     { label: "Эвент",      color: "#EF2C58", bg: "rgba(239,44,88,0.18)",  iconPath: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25" },
  deadline:  { label: "Дедлайн",    color: "#EF2C58", bg: "rgba(239,44,88,0.18)",  iconPath: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" },
};
const FILTER_ORDER = ["all", "live", "class", "workshop", "challenge", "mentor"] as const;

const MN_MONTHS_SHORT = ["1-р", "2-р", "3-р", "4-р", "5-р", "6-р", "7-р", "8-р", "9-р", "10-р", "11-р", "12-р"];
const MN_DAYS_SHORT = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];

function formatDate(d: Date) {
  return `${MN_MONTHS_SHORT[d.getMonth()]} сар ${d.getDate()} · ${MN_DAYS_SHORT[d.getDay()]}`;
}

function formatTime(s: string) {
  return new Date(s).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" });
}

function relativeWhen(date: Date, now: Date): string {
  const diffMs = date.getTime() - now.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 0) return "Эхэлсэн";
  if (diffMin < 60) return `${diffMin} минутын дараа`;
  if (diffHr < 24) return `${diffHr} цаг ${diffMin % 60}мин дараа`;
  if (diffDay === 1) return "Маргааш";
  if (diffDay < 7) return `${diffDay} хоногийн дараа`;
  if (diffDay < 30) return `${Math.floor(diffDay / 7)} долоо хоногийн дараа`;
  return formatDate(date);
}

// Generate a deterministic gradient cover for events with no image
function gradientFor(seed: string, color: string) {
  const hash = Array.from(seed).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const angle = hash % 360;
  return `linear-gradient(${angle}deg, ${color} 0%, #0A0A0A 80%)`;
}

// ─── iCal export ───
function makeICS(ev: CalEvent) {
  const dt = (s: string) => new Date(s).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = dt(ev.date);
  const end = ev.endDate ? dt(ev.endDate) : dt(new Date(+new Date(ev.date) + 60 * 60 * 1000).toISOString());
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Antaqor//Calendar//MN",
    "BEGIN:VEVENT",
    `UID:${start}-${ev._id}@antaqor.com`,
    `DTSTAMP:${dt(new Date().toISOString())}`,
    `DTSTART:${start}`, `DTEND:${end}`,
    `SUMMARY:${ev.title}`,
    ev.description ? `DESCRIPTION:${ev.description.replace(/\n/g, "\\n")}` : "",
    ev.location ? `LOCATION:${ev.location}` : "",
    ev.liveLink ? `URL:${ev.liveLink}` : "",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

function downloadIcs(ev: CalEvent) {
  const blob = new Blob([makeICS(ev)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${ev.title.replace(/[^\wЀ-ӿ\s-]/g, "").trim() || "antaqor-event"}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Hero card — biggest, next event ───
function HeroCard({ event, onOpen }: { event: CalEvent; onOpen: (e: CalEvent) => void }) {
  const cfg = TYPE_CONFIG[event.type] || TYPE_CONFIG.event;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const date = new Date(event.date);
  const isLive = event.status === "live";
  const when = isLive ? "ОДОО ЯВЖ БАЙНА" : relativeWhen(date, new Date(now));

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onOpen(event)}
      className="group relative block w-full overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] text-left transition hover:border-[rgba(239,44,88,0.4)]"
    >
      {/* Cover */}
      <div
        className="relative aspect-[16/8] sm:aspect-[16/7]"
        style={!event.image ? { background: gradientFor(event._id, cfg.color) } : undefined}
      >
        {event.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.image}
            alt={event.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        )}
        {/* Bottom gradient for legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        {/* No-image overlay icon — large, faint */}
        {!event.image && (
          <svg className="absolute inset-0 m-auto h-24 w-24 opacity-15" fill="none" stroke={cfg.color} strokeWidth={1.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d={cfg.iconPath} />
          </svg>
        )}
        {/* Top-left date stamp */}
        <div className="absolute left-3 top-3 flex flex-col items-center justify-center rounded-[4px] bg-black/70 px-3 py-2 backdrop-blur-md">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#888]">{MN_DAYS_SHORT[date.getDay()]}</span>
          <span className="text-[20px] font-black leading-none text-white">{date.getDate()}</span>
          <span className="text-[9px] font-bold uppercase text-[#888]">{MN_MONTHS_SHORT[date.getMonth()]}</span>
        </div>
        {/* Top-right type chip */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {isLive && (
            <span className="flex items-center gap-1 rounded-full bg-[#EF2C58] px-2 py-1 text-[9px] font-black tracking-wider text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              LIVE
            </span>
          )}
          <span className="rounded-full px-2 py-1 text-[9px] font-black tracking-wider text-white" style={{ background: cfg.color }}>
            {cfg.label}
          </span>
        </div>
        {/* Bottom title block */}
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#EF2C58]">ДАРААГИЙН · {when}</div>
          <h2 className="mt-1.5 line-clamp-2 text-[20px] font-black leading-tight text-white sm:text-[26px]">
            {event.title}
          </h2>
          <div className="mt-2 flex items-center gap-3 text-[11px] text-[#CCC]">
            <span>{formatTime(event.date)}</span>
            {event.location && <><span className="text-[#444]">·</span><span>{event.location}</span></>}
            {event.attendeeCount > 0 && <><span className="text-[#444]">·</span><span>{event.attendeeCount} нэгдсэн</span></>}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

// ─── Compact event card ───
function EventCard({ event, index, onOpen }: { event: CalEvent; index: number; onOpen: (e: CalEvent) => void }) {
  const cfg = TYPE_CONFIG[event.type] || TYPE_CONFIG.event;
  const date = new Date(event.date);
  const isLive = event.status === "live";

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={() => onOpen(event)}
      className="group flex flex-col overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F10] text-left transition hover:border-[rgba(239,44,88,0.3)] hover:-translate-y-[1px]"
    >
      {/* Cover */}
      <div
        className="relative aspect-[16/9]"
        style={!event.image ? { background: gradientFor(event._id, cfg.color) } : undefined}
      >
        {event.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.image} alt={event.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        )}
        {!event.image && (
          <svg className="absolute inset-0 m-auto h-12 w-12 opacity-25" fill="none" stroke={cfg.color} strokeWidth={1.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d={cfg.iconPath} />
          </svg>
        )}
        <div className="absolute left-2 top-2 flex flex-col items-center rounded-[4px] bg-black/70 px-2 py-1 backdrop-blur-md">
          <span className="text-[8px] font-bold uppercase text-[#999]">{MN_DAYS_SHORT[date.getDay()]}</span>
          <span className="text-[14px] font-black leading-none text-white">{date.getDate()}</span>
        </div>
        <div className="absolute right-2 top-2 flex items-center gap-1">
          {isLive && (
            <span className="flex items-center gap-1 rounded-full bg-[#EF2C58] px-1.5 py-0.5 text-[8px] font-black text-white">
              <span className="h-1 w-1 animate-pulse rounded-full bg-white" />
              LIVE
            </span>
          )}
          <span className="rounded-full px-1.5 py-0.5 text-[8px] font-black text-white" style={{ background: cfg.color }}>
            {cfg.label}
          </span>
        </div>
      </div>
      {/* Body */}
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 text-[13px] font-bold leading-tight text-[#E8E8E8]">{event.title}</h3>
        <div className="mt-auto flex items-center gap-1.5 text-[10px] text-[#666]">
          <span>{formatTime(event.date)}</span>
          {event.location && <><span className="text-[#333]">·</span><span className="truncate">{event.location}</span></>}
        </div>
      </div>
    </motion.button>
  );
}

// ─── Detail drawer (bottom-sheet on mobile, modal centered on desktop) ───
function EventDrawer({ event, onClose }: { event: CalEvent | null; onClose: () => void }) {
  if (!event) return null;
  const cfg = TYPE_CONFIG[event.type] || TYPE_CONFIG.event;
  const date = new Date(event.date);
  return (
    <AnimatePresence>
      {event && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center"
        >
          <motion.div
            initial={{ y: 32 }} animate={{ y: 0 }} exit={{ y: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-t-[4px] border-t border-[rgba(255,255,255,0.08)] bg-[#0F0F10] sm:max-h-[85vh] sm:rounded-[4px] sm:border"
          >
            {/* Cover */}
            <div
              className="relative aspect-[16/8]"
              style={!event.image ? { background: gradientFor(event._id, cfg.color) } : undefined}
            >
              {event.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={event.image} alt={event.title} className="h-full w-full object-cover" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <button
                onClick={onClose}
                aria-label="Хаах"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-md transition hover:bg-black/80"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="absolute left-3 top-3 flex items-center gap-1.5">
                {event.status === "live" && (
                  <span className="flex items-center gap-1 rounded-full bg-[#EF2C58] px-2 py-1 text-[9px] font-black text-white">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                    LIVE
                  </span>
                )}
                <span className="rounded-full px-2 py-1 text-[9px] font-black text-white" style={{ background: cfg.color }}>
                  {cfg.label}
                </span>
              </div>
            </div>

            {/* Body */}
            <div className="p-5">
              <h2 className="text-[18px] font-black leading-tight text-[#E8E8E8] sm:text-[20px]">{event.title}</h2>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] text-[#999]">
                <span className="inline-flex items-center gap-1">
                  <svg className="h-3.5 w-3.5 text-[#666]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 7.5h18M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25M3 18.75A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75" />
                  </svg>
                  {formatDate(date)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <svg className="h-3.5 w-3.5 text-[#666]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {formatTime(event.date)}
                  {event.endDate && <> – {formatTime(event.endDate)}</>}
                </span>
                {event.location && (
                  <span className="inline-flex items-center gap-1">
                    <svg className="h-3.5 w-3.5 text-[#666]" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    {event.location}
                  </span>
                )}
              </div>

              {event.description && (
                <p className="mt-4 whitespace-pre-wrap text-[13px] leading-relaxed text-[#AAA]">{event.description}</p>
              )}

              <div className="mt-5 flex gap-2">
                {event.liveLink && (
                  <a
                    href={event.liveLink}
                    target="_blank" rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-2 rounded-[4px] bg-[#EF2C58] py-3 text-[13px] font-black text-white transition hover:bg-[#D4264E]"
                  >
                    {event.status === "live" ? "LIVE нэгдэх" : "Линк нээх"}
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </a>
                )}
                <button
                  onClick={() => downloadIcs(event)}
                  className="flex shrink-0 items-center justify-center gap-1.5 rounded-[4px] border border-[rgba(255,255,255,0.08)] px-4 py-3 text-[12px] font-bold text-[#AAA] transition hover:border-[rgba(239,44,88,0.4)] hover:text-[#EF2C58]"
                  title="Календар руугаа нэмэх"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75M12 12v6m-3-3h6" />
                  </svg>
                  .ics
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Main page ───
export default function CalendarPage() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<CalEvent | null>(null);
  const [showPast, setShowPast] = useState(false);

  useEffect(() => {
    let cancel = false;
    fetch("/api/events")
      .then((r) => r.json())
      .then((d) => { if (!cancel && Array.isArray(d.events)) setEvents(d.events); })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoading(false); });
    return () => { cancel = true; };
  }, []);

  const now = new Date();

  const visible = useMemo(
    () => events.filter((e) => filter === "all" || e.type === filter),
    [events, filter]
  );

  const upcoming = useMemo(
    () => visible
      .filter((e) => e.status !== "ended")
      .sort((a, b) => +new Date(a.date) - +new Date(b.date)),
    [visible]
  );

  const past = useMemo(
    () => visible
      .filter((e) => e.status === "ended" || +new Date(e.endDate || e.date) < +now)
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
      .slice(0, 12),
    [visible, now]
  );

  const hero = upcoming[0];
  const rest = upcoming.slice(1);

  return (
    <div className="mx-auto max-w-[1100px] pb-8">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <div className="h-[2px] w-4 bg-[#EF2C58]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#EF2C58]">ANTAQOR · ХУВААРЬ</span>
        </div>
        <h1 className="mt-2 text-[26px] font-black leading-tight text-[#E8E8E8] sm:text-[32px]">Удахгүй болох</h1>
        <p className="mt-1 text-[13px] text-[#888]">
          AI хичээл · LIVE · challenge · 1:1 mentor — нэг товчоор календартаа нэм
        </p>
      </div>

      {/* Filter pills — sticky on scroll */}
      <div className="sticky top-[60px] z-30 -mx-4 mb-5 border-y border-[rgba(255,255,255,0.06)] bg-[#0A0A0A]/80 px-4 py-2 backdrop-blur-xl">
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
          {FILTER_ORDER.map((key) => {
            const cfg = key === "all" ? null : TYPE_CONFIG[key];
            const active = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-black transition ${
                  active
                    ? key === "all"
                      ? "bg-[#EF2C58] text-white"
                      : "text-white"
                    : "border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] text-[#888] hover:border-[rgba(239,44,88,0.3)] hover:text-[#E8E8E8]"
                }`}
                style={active && cfg ? { background: cfg.color } : undefined}
              >
                {key === "all" ? "Бүгд" : cfg!.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-[16/12] animate-pulse rounded-[4px] bg-[#141414]" />
          ))}
        </div>
      ) : upcoming.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          {/* Hero next event */}
          <HeroCard event={hero} onOpen={setSelected} />

          {/* Upcoming grid */}
          {rest.length > 0 && (
            <div className="mt-6">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-[#666]">УДАХГҮЙ</div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((ev, i) => (
                  <EventCard key={ev._id} event={ev} index={i} onOpen={setSelected} />
                ))}
              </div>
            </div>
          )}

          {/* Past — collapsible */}
          {past.length > 0 && (
            <div className="mt-8">
              <button
                onClick={() => setShowPast((v) => !v)}
                className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[#666] transition hover:text-[#E8E8E8]"
              >
                <span>ӨНГӨРСӨН ({past.length})</span>
                <svg className={`h-3 w-3 transition-transform ${showPast ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showPast && (
                <div className="mt-3 grid gap-3 opacity-70 sm:grid-cols-2 lg:grid-cols-3">
                  {past.map((ev, i) => (
                    <EventCard key={ev._id} event={ev} index={i} onOpen={setSelected} />
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Sign-in nudge */}
      {!session && (
        <div className="mt-8 rounded-[4px] border border-[rgba(239,44,88,0.18)] bg-[rgba(239,44,88,0.04)] p-5 text-center">
          <p className="text-[13px] text-[#888]">
            Эвентэд нэгдэх + сануулга авахын тулд{" "}
            <Link href="/auth/signin" className="font-black text-[#EF2C58]">нэвтрэх</Link>
          </p>
        </div>
      )}

      {/* Detail drawer */}
      <EventDrawer event={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-[4px] border-2 border-dashed border-[rgba(255,255,255,0.08)] p-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[4px] bg-[rgba(239,44,88,0.1)]">
        <svg className="h-5 w-5 text-[#EF2C58]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75" />
        </svg>
      </div>
      <p className="text-[14px] font-bold text-[#E8E8E8]">Удахгүй болох эвент байхгүй</p>
      <p className="mx-auto mt-1.5 max-w-[300px] text-[11px] leading-relaxed text-[#666]">
        Шинэ хичээл, LIVE session-уудыг 7 хоног бүр зарлана — энд эхэлж харагдана.
      </p>
    </div>
  );
}
