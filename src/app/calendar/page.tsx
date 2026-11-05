"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

interface CalEvent {
  _id: string;
  /* Давтагдах цуврал нь нэг баримтаас ОЛОН мөр төрүүлдэг тул `_id` нь энэ
     жагсаалтад давхардана. React-ийн түлхүүр болон "аль тохиолдол" гэдгийг
     ялгах цорын ганц найдвартай утга нь энэ. Хуучин хариултад байхгүй байж
     болох тул заавал биш. */
  occurrenceId?: string;
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

interface Course {
  _id: string;
  title: string;
  description: string;
  thumbnail: string;
  order: number;
  requiredLevel: number;
}

const NEON = "var(--accent-ink, #2E29FF)";
const NEON_GLOW = "0 0 24px rgba(46,41,255,0.5)";
const NEON_GLOW_SOFT = "0 0 12px rgba(46,41,255,0.35)";

const TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  live:      { label: "LIVE",       color: "var(--accent-ink, #2E29FF)" },
  class:     { label: "Хичээл",     color: "var(--accent-ink, #2E29FF)" },
  workshop:  { label: "Воркшоп",    color: "var(--accent-ink, #2E29FF)" },
  challenge: { label: "Challenge",  color: "#06B6D4" },
  mentor:    { label: "1:1 Mentor", color: "#14B8A6" },
  event:     { label: "Эвент",      color: "var(--accent-ink, #2E29FF)" },
  deadline:  { label: "Дедлайн",    color: "var(--accent-ink, #2E29FF)" },
};

const MN_MONTHS_SHORT = ["1-р", "2-р", "3-р", "4-р", "5-р", "6-р", "7-р", "8-р", "9-р", "10-р", "11-р", "12-р"];
const MN_DAYS_SHORT = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];

function formatDate(d: Date) {
  return `${MN_MONTHS_SHORT[d.getMonth()]} сар ${d.getDate()} · ${MN_DAYS_SHORT[d.getDay()]}`;
}

function formatTime(s: string) {
  return new Date(s).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" });
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function useTick(ms: number) {
  const [n, setN] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setN(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
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

// ─── Live countdown ───
function Countdown({ to, big }: { to: Date; big?: boolean }) {
  const now = useTick(1000);
  const diff = Math.max(0, to.getTime() - now);
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff / 3_600_000) % 24);
  const m = Math.floor((diff / 60_000) % 60);
  const s = Math.floor((diff / 1000) % 60);

  if (d > 0) {
    return (
      <div
        className={`font-black tabular-nums ${big ? "text-[26px] md:text-[40px] sm:text-[52px]" : "text-[20px]"}`}
        style={{ color: NEON, textShadow: big ? NEON_GLOW : NEON_GLOW_SOFT, lineHeight: 1 }}
      >
        {d}<span className="text-[0.45em] text-[#E2E4E8] font-bold ml-1.5">хоног</span>
        <span className="ml-3">{String(h).padStart(2, "0")}<span className="opacity-30">ц</span></span>
      </div>
    );
  }

  return (
    <div
      className={`font-black tabular-nums ${big ? "text-[26px] md:text-[44px] sm:text-[64px]" : "text-[20px]"}`}
      style={{ color: NEON, textShadow: big ? NEON_GLOW : NEON_GLOW_SOFT, lineHeight: 1, letterSpacing: "-0.02em" }}
    >
      {String(h).padStart(2, "0")}
      <span className="opacity-30">:</span>
      {String(m).padStart(2, "0")}
      <span className="opacity-30">:</span>
      {String(s).padStart(2, "0")}
    </div>
  );
}

// ─── Today hero — countdown to next event OR live indicator ───
function TodayHero({ next, todayCount }: { next: CalEvent | null; todayCount: number }) {
  const now = useTick(1000);
  const today = new Date();

  if (!next) {
    return (
      <div className="relative overflow-hidden rounded-[4px] border border-[#0e1726] bg-white p-7 text-center">
        <div className="text-[10px] font-black uppercase tracking-[0.25em] text-[#E2E4E8]">ӨНӨӨДӨР</div>
        <div className="mt-3 text-[16px] font-bold text-[#6B6B72]">{formatDate(today)}</div>
        <div className="mt-1 text-[12px] text-[#9A9A9F]">Эвент байхгүй · хичээлээ үргэлжлүүл</div>
      </div>
    );
  }

  const isLive = next.status === "live";
  const date = new Date(next.date);
  const isToday = sameDay(date, new Date(now));

  if (isLive) {
    return (
      <div
        className="relative overflow-hidden rounded-[4px] border p-6 sm:p-7"
        style={{ borderColor: "rgba(46,41,255,0.4)", background: "linear-gradient(135deg, rgba(46,41,255,0.10) 0%, #F2F2F4 60%)" }}
      >
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 animate-pulse rounded-full"
            style={{ background: NEON, boxShadow: "0 0 14px #2E29FF, 0 0 28px rgba(46,41,255,0.5)" }}
          />
          <span className="text-[10px] font-black tracking-[0.3em]" style={{ color: NEON }}>ОДОО · LIVE</span>
        </div>
        <h2 className="mt-3 text-[22px] font-black leading-tight text-white sm:text-[26px]">{next.title}</h2>
        <div className="mt-1.5 text-[12px] text-[#6B6B72]">
          {formatTime(next.date)}{next.endDate && <> – {formatTime(next.endDate)}</>}
          {next.location && <> · {next.location}</>}
        </div>
        {next.liveLink && (
          <a
            href={next.liveLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex items-center gap-2 rounded-[4px] px-5 py-2.5 text-[12px] font-black text-white transition hover:opacity-90"
            style={{ background: NEON, boxShadow: NEON_GLOW }}
          >
            ОДОО НЭГДЭХ
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[4px] border border-[#E6E6E6] bg-white p-6 sm:p-7">
      <div className="absolute inset-x-0 top-0 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${NEON}, transparent)`, opacity: 0.5 }} />
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: NEON }}>
          {isToday ? "ӨНӨӨДӨР" : "ДАРААГИЙН"}
        </div>
        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9A9A9F]">{formatDate(today)}</div>
      </div>

      <div className="mt-4">
        <Countdown to={date} big />
      </div>

      <h2 className="mt-4 line-clamp-2 text-[18px] font-black leading-tight text-white sm:text-[20px]">{next.title}</h2>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[#6B6B72]">
        <span className="font-bold tabular-nums" style={{ color: NEON }}>{formatTime(next.date)}</span>
        {!isToday && <span>{formatDate(date)}</span>}
        {next.location && <span>· {next.location}</span>}
      </div>

      {todayCount > 1 && (
        <div className="mt-4 inline-flex items-center gap-1.5 rounded-[4px] bg-[rgba(46,41,255,0.1)] px-2.5 py-1 text-[10px] font-bold" style={{ color: NEON }}>
          ӨНӨӨДӨР {todayCount} ЭВЕНТ
        </div>
      )}
    </div>
  );
}

// ─── Compact event row ───
function EventRow({ event, onOpen, showDate }: { event: CalEvent; onOpen: (e: CalEvent) => void; showDate?: boolean }) {
  const cfg = TYPE_CONFIG[event.type] || TYPE_CONFIG.event;
  const date = new Date(event.date);
  const isLive = event.status === "live";
  return (
    <button
      onClick={() => onOpen(event)}
      className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-[#F4F4F2]"
    >
      <div className="flex w-[58px] shrink-0 flex-col items-center">
        <span className="text-[13px] font-black tabular-nums" style={{ color: NEON, textShadow: NEON_GLOW_SOFT }}>{formatTime(event.date)}</span>
        {showDate && <span className="text-[11px] font-bold uppercase text-[#9A9A9F] mt-0.5">{MN_DAYS_SHORT[date.getDay()]} {date.getDate()}</span>}
      </div>
      <span className="rounded-[4px] px-2 py-0.5 text-[8px] font-black tracking-wider text-white" style={{ background: cfg.color }}>
        {cfg.label}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-bold text-[#171717]">{event.title}</div>
        {event.location && <div className="truncate text-[10px] text-[#E2E4E8]">{event.location}</div>}
      </div>
      {isLive && (
        <span className="flex shrink-0 items-center gap-1 rounded-[4px] px-2 py-0.5 text-[8px] font-black text-white" style={{ background: NEON, boxShadow: NEON_GLOW_SOFT }}>
          <span className="h-1 w-1 animate-pulse rounded-full bg-white" />
          LIVE
        </span>
      )}
      <svg className="h-3 w-3 shrink-0 text-[#E2E4E8]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

// ─── Today view ───
function TodayView({ events, next, onOpen }: { events: CalEvent[]; next: CalEvent | null; onOpen: (e: CalEvent) => void }) {
  return (
    <div>
      <TodayHero next={next} todayCount={events.length} />
      {events.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="h-[1px] w-3" style={{ background: NEON }} />
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#E2E4E8]">Бүгд ({events.length})</span>
          </div>
          <div className="overflow-hidden rounded-[4px] border border-[#0e1726] bg-white divide-y divide-[#EFEFEF]">
            {events.map((ev) => (
              <EventRow key={ev.occurrenceId || ev._id} event={ev} onOpen={onOpen} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Upcoming view — grouped by day ───
function UpcomingView({ events, onOpen }: { events: CalEvent[]; onOpen: (e: CalEvent) => void }) {
  const groups = useMemo(() => {
    const byDay = new Map<string, CalEvent[]>();
    for (const ev of events) {
      const d = new Date(ev.date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(ev);
    }
    return Array.from(byDay.entries());
  }, [events]);

  if (events.length === 0) {
    return <EmptyState text="Удахгүй болох эвент байхгүй" />;
  }

  return (
    <div className="space-y-5">
      {groups.map(([key, evs]) => {
        const d = new Date(evs[0].date);
        const isToday = sameDay(d, new Date());
        return (
          <div key={key}>
            <div className="mb-2 flex items-end gap-3">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[20px] font-black tabular-nums text-white" style={isToday ? { color: NEON, textShadow: NEON_GLOW_SOFT } : undefined}>{d.getDate()}</span>
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9A9A9F]">{MN_MONTHS_SHORT[d.getMonth()]} · {MN_DAYS_SHORT[d.getDay()]}</span>
              </div>
              {isToday && (
                <span className="rounded-[4px] px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-white" style={{ background: NEON, boxShadow: NEON_GLOW_SOFT }}>Өнөөдөр</span>
              )}
            </div>
            <div className="overflow-hidden rounded-[4px] border border-[#0e1726] bg-white divide-y divide-[#EFEFEF]">
              {evs.map((ev) => (
                <EventRow key={ev.occurrenceId || ev._id} event={ev} onOpen={onOpen} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Courses view ───
function CoursesView({ courses, loading }: { courses: Course[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="aspect-[16/12] animate-pulse rounded-[4px] bg-[#F0F0EE]" />
        ))}
      </div>
    );
  }
  if (courses.length === 0) return <EmptyState text="Хичээл удахгүй нэмэгдэнэ" />;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((c) => (
        <Link
          key={c._id}
          href={`/classroom/course/${c._id}`}
          className="group flex flex-col overflow-hidden rounded-[4px] border border-[#0e1726] bg-white transition hover:-translate-y-[1px]"
          style={{ transitionProperty: "border-color, transform" }}
        >
          <div
            className="relative aspect-[16/9] overflow-hidden"
            style={{ background: `linear-gradient(135deg, rgba(46,41,255,0.12) 0%, #e2e8ef 70%)` }}
          >
            {c.thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.thumbnail} alt={c.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
            ) : (
              <svg className="absolute inset-0 m-auto h-12 w-12 opacity-25" fill="none" stroke={NEON} strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.5l9-5 9 5-9 5-9-5z" />
              </svg>
            )}
            {c.requiredLevel > 0 && (
              <span className="absolute right-2 top-2 rounded-[4px] border border-[#E6E6E6] bg-white/90 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-[#2E29FF] backdrop-blur-md">L{c.requiredLevel}+</span>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-1 p-3">
            <h3 className="line-clamp-2 text-[13px] font-black leading-tight text-[#171717] transition-colors group-hover:text-white">{c.title}</h3>
            {c.description && <p className="line-clamp-2 text-[11px] leading-relaxed text-[#E2E4E8]">{c.description}</p>}
            <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold transition" style={{ color: NEON }}>
              Эхлэх
              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

// ─── Empty state ───
function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[4px] border-2 border-dashed border-[#0e1726] p-8 text-center">
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-[4px]" style={{ background: "rgba(46,41,255,0.1)", boxShadow: NEON_GLOW_SOFT }}>
        <svg className="h-4 w-4" fill="none" stroke={NEON} strokeWidth={1.8} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25" />
        </svg>
      </div>
      <p className="text-[12px] font-bold text-[#6B6B72]">{text}</p>
    </div>
  );
}

// ─── Detail drawer ───
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
            className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-t-[4px] border-t border-[#E6E6E6] bg-white sm:max-h-[85vh] sm:rounded-[4px] sm:border"
          >
            <div className="border-b border-[#0e1726] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-1.5">
                  {event.status === "live" && (
                    <span className="flex items-center gap-1 rounded-[4px] px-2 py-0.5 text-[11px] font-black text-white" style={{ background: NEON, boxShadow: NEON_GLOW_SOFT }}>
                      <span className="h-1 w-1 animate-pulse rounded-full bg-white" />
                      LIVE
                    </span>
                  )}
                  <span className="rounded-[4px] px-2 py-0.5 text-[11px] font-black tracking-wider text-white" style={{ background: cfg.color }}>{cfg.label}</span>
                </div>
                <button onClick={onClose} aria-label="Хаах" className="flex h-8 w-8 items-center justify-center rounded-[4px] text-[#6B6B72] transition hover:bg-[#EFEFED] hover:text-white">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <h2 className="mt-3 text-[19px] font-black leading-tight text-[#171717] sm:text-[22px]">{event.title}</h2>
              {event.status === "upcoming" && (
                <div className="mt-3">
                  <Countdown to={date} />
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-[#6B6B72]">
                <span>{formatDate(date)}</span>
                <span className="font-bold tabular-nums" style={{ color: NEON }}>
                  {formatTime(event.date)}{event.endDate && <> – {formatTime(event.endDate)}</>}
                </span>
                {event.location && <span>· {event.location}</span>}
              </div>
            </div>

            <div className="p-5">
              {event.description && (
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-[#52525B]">{event.description}</p>
              )}

              <div className="mt-5 flex gap-2">
                {event.liveLink && (
                  <a
                    href={event.liveLink}
                    target="_blank" rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-2 rounded-[4px] py-3 text-[13px] font-black text-white transition hover:opacity-90"
                    style={{ background: NEON, boxShadow: NEON_GLOW }}
                  >
                    {event.status === "live" ? "LIVE нэгдэх" : "Линк нээх"}
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </a>
                )}
                <button
                  onClick={() => downloadIcs(event)}
                  className="flex shrink-0 items-center justify-center gap-1.5 rounded-[4px] border border-[#E6E6E6] px-4 py-3 text-[12px] font-bold text-[#52525B] transition hover:border-[rgba(46,41,255,0.4)] hover:text-[#2E29FF]"
                  title="Календар руугаа нэмэх"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25M12 12v6m-3-3h6" />
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
type Tab = "today" | "upcoming" | "courses";

const TABS: { key: Tab; label: string }[] = [
  { key: "today", label: "Өнөөдөр" },
  { key: "upcoming", label: "Удахгүй" },
  { key: "courses", label: "Хичээл" },
];

export default function CalendarPage() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<Tab>("today");
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [coursesLoaded, setCoursesLoaded] = useState(false);
  const [selected, setSelected] = useState<CalEvent | null>(null);

  useEffect(() => {
    let cancel = false;
    fetch("/api/events")
      .then((r) => r.json())
      .then((d) => { if (!cancel && Array.isArray(d.events)) setEvents(d.events); })
      .catch(() => {})
      .finally(() => { if (!cancel) setLoadingEvents(false); });
    return () => { cancel = true; };
  }, []);

  useEffect(() => {
    if (tab !== "courses" || coursesLoaded) return;
    let cancel = false;
    setLoadingCourses(true);
    fetch("/api/classroom/courses")
      .then((r) => r.json())
      .then((d) => { if (!cancel && Array.isArray(d.courses)) setCourses(d.courses); })
      .catch(() => {})
      .finally(() => { if (!cancel) { setLoadingCourses(false); setCoursesLoaded(true); } });
    return () => { cancel = true; };
  }, [tab, coursesLoaded]);

  const todayEvents = useMemo(() => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    return events
      .filter((e) => {
        const d = new Date(e.date);
        return (d >= start && d <= end && e.status !== "ended") || e.status === "live";
      })
      .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  }, [events]);

  const next = useMemo(() => {
    const cutoff = Date.now() - 60 * 60 * 1000;
    return events
      .filter((e) => e.status !== "ended" && +new Date(e.date) >= cutoff)
      .sort((a, b) => +new Date(a.date) - +new Date(b.date))[0] || null;
  }, [events]);

  const upcomingEvents = useMemo(() => {
    const now = Date.now();
    return events
      .filter((e) => e.status !== "ended" && +new Date(e.date) >= now)
      .sort((a, b) => +new Date(a.date) - +new Date(b.date));
  }, [events]);

  const counts = {
    today: todayEvents.length,
    upcoming: upcomingEvents.length,
    courses: courses.length,
  };

  return (
    <div className="mx-auto max-w-[900px] pb-10">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <div className="h-[6px] w-[6px] animate-pulse rounded-[4px]" style={{ background: NEON, boxShadow: "0 0 10px #2E29FF" }} />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: NEON }}>ANTAQOR · ХУВААРЬ</span>
        </div>
        <h1 className="mt-2 text-[26px] font-black leading-tight text-[#171717] sm:text-[22px] md:text-[30px]">Цаг чухал.</h1>
        <p className="mt-1 text-[12px] text-[#6B6B72]">Live, хичээл, challenge — алдалгүй нэгд</p>
      </div>

      {/* Tabs */}
      <div className="sticky top-[60px] z-30 -mx-4 mb-5 px-4 py-2 backdrop-blur-xl" style={{ background: "rgba(15,23,38,0.85)" }}>
        <div className="flex gap-1 rounded-[4px] border border-[#E6E6E6] bg-white p-1">
          {TABS.map((t) => {
            const active = tab === t.key;
            const c = counts[t.key];
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-[4px] px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${
                  active ? "text-white" : "text-[#6B6B72] hover:text-[#171717]"
                }`}
                style={active ? { background: NEON, boxShadow: NEON_GLOW_SOFT } : undefined}
              >
                {t.label}
                {c > 0 && (
                  <span
                    className="rounded-[4px] px-1.5 py-0.5 text-[11px] font-black tabular-nums"
                    style={active
                      ? { background: "rgba(0,0,0,0.25)", color: "#fff" }
                      : { background: "rgba(46,41,255,0.15)", color: NEON }}
                  >
                    {c}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
        >
          {tab === "today" && (
            loadingEvents ? <div className="h-48 animate-pulse rounded-[4px] bg-[#F0F0EE]" /> : <TodayView events={todayEvents} next={next} onOpen={setSelected} />
          )}
          {tab === "upcoming" && (
            loadingEvents ? <div className="space-y-3"><div className="h-24 animate-pulse rounded-[4px] bg-[#F0F0EE]" /><div className="h-24 animate-pulse rounded-[4px] bg-[#F0F0EE]" /></div> : <UpcomingView events={upcomingEvents} onOpen={setSelected} />
          )}
          {tab === "courses" && <CoursesView courses={courses} loading={loadingCourses} />}
        </motion.div>
      </AnimatePresence>

      {/* Sign-in nudge */}
      {!session && (
        <div className="mt-8 rounded-[4px] border p-5 text-center" style={{ borderColor: "rgba(46,41,255,0.18)", background: "rgba(46,41,255,0.04)" }}>
          <p className="text-[13px] text-[#6B6B72]">
            Эвентэд нэгдэх + сануулга авахын тулд{" "}
            <Link href="/auth/signin" className="font-black" style={{ color: NEON }}>нэвтрэх</Link>
          </p>
        </div>
      )}

      <EventDrawer event={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
