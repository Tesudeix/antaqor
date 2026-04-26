"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ───
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
  color: string;
  attendeeCount: number;
  image: string;
}

type ViewMode = "month" | "list";

// ─── Config — AI community event types ───
const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  live:      { label: "LIVE",       color: "#EF2C58", bg: "rgba(239,44,88,0.12)",  icon: "M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" },
  class:     { label: "Хичээл",     color: "#0F81CA", bg: "rgba(15,129,202,0.12)", icon: "M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342" },
  workshop:  { label: "Воркшоп",    color: "#A855F7", bg: "rgba(168,85,247,0.12)", icon: "M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0012 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" },
  challenge: { label: "Challenge",  color: "#06B6D4", bg: "rgba(6,182,212,0.12)",  icon: "M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" },
  mentor:    { label: "1:1 Mentor", color: "#14B8A6", bg: "rgba(20,184,166,0.12)", icon: "M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" },
  event:     { label: "Эвент",      color: "#EF2C58", bg: "rgba(239,44,88,0.12)", icon: "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" },
  deadline:  { label: "Дедлайн",    color: "#EF2C58", bg: "rgba(239,44,88,0.12)",  icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" },
};

// ─── Generate iCalendar (.ics) for "Add to calendar" ───
function makeICS(ev: { title: string; description?: string; date: string; endDate?: string; location?: string; liveLink?: string }) {
  const dt = (s: string) => new Date(s).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = dt(ev.date);
  const end = ev.endDate ? dt(ev.endDate) : dt(new Date(+new Date(ev.date) + 60 * 60 * 1000).toISOString());
  const desc = (ev.description || "").replace(/\n/g, "\\n");
  const url = ev.liveLink || "";
  const uid = `${start}-${Math.random().toString(36).slice(2, 9)}@antaqor.com`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Antaqor//Calendar//MN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dt(new Date().toISOString())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${ev.title}`,
    desc ? `DESCRIPTION:${desc}` : "",
    ev.location ? `LOCATION:${ev.location}` : "",
    url ? `URL:${url}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ].filter(Boolean).join("\r\n");
}

function downloadIcs(ev: { title: string; description?: string; date: string; endDate?: string; location?: string; liveLink?: string }) {
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

const MN_MONTHS = ["1 сар","2 сар","3 сар","4 сар","5 сар","6 сар","7 сар","8 сар","9 сар","10 сар","11 сар","12 сар"];
const MN_DAYS = ["Ня","Да","Мя","Лх","Пү","Ба","Бя"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function timeStr(d: string) {
  return new Date(d).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" });
}

function dateStr(d: string) {
  return new Date(d).toLocaleDateString("mn-MN", { month: "short", day: "numeric", weekday: "short" });
}

function relativeDay(d: Date): string {
  const now = new Date();
  now.setHours(0,0,0,0);
  const target = new Date(d);
  target.setHours(0,0,0,0);
  const diff = Math.round((target.getTime() - now.getTime()) / (1000*60*60*24));
  if (diff === 0) return "Өнөөдөр";
  if (diff === 1) return "Маргааш";
  if (diff === -1) return "Өчигдөр";
  if (diff > 1 && diff <= 7) return `${diff} хоногийн дараа`;
  return "";
}

// ─── This-week featured strip — horizontal scroll of next 7 days ───
function ThisWeekStrip({ events, onSelect }: { events: CalEvent[]; onSelect: (e: CalEvent) => void }) {
  const next7 = useMemo(() => {
    const now = new Date();
    return events
      .filter((e) => {
        const d = new Date(e.date);
        const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
        return diff >= -1 && diff <= 7;
      })
      .sort((a, b) => +new Date(a.date) - +new Date(b.date))
      .slice(0, 8);
  }, [events]);

  if (next7.length === 0) return null;

  return (
    <div className="mb-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#EF2C58]">ЭНЭ 7 ХОНОГ</span>
          <span className="rounded-full bg-[rgba(239,44,88,0.1)] px-1.5 py-0.5 text-[10px] font-black text-[#EF2C58]">
            {next7.length}
          </span>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {next7.map((ev) => {
          const cfg = TYPE_CONFIG[ev.type] || TYPE_CONFIG.event;
          const rel = relativeDay(new Date(ev.date));
          const isLive = ev.status === "live";
          return (
            <button
              key={ev._id}
              onClick={() => onSelect(ev)}
              className="group flex w-[200px] shrink-0 flex-col gap-1.5 rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F10] p-3 text-left transition hover:border-[rgba(239,44,88,0.3)]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="rounded-full px-1.5 py-0.5 text-[9px] font-black tracking-wider" style={{ background: cfg.bg, color: cfg.color }}>
                  {cfg.label}
                </span>
                {isLive && (
                  <span className="flex items-center gap-1 text-[9px] font-black text-[#EF2C58]">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#EF2C58]" />
                    LIVE
                  </span>
                )}
              </div>
              <div className="line-clamp-2 text-[12px] font-bold leading-tight text-[#E8E8E8]">
                {ev.title}
              </div>
              <div className="mt-auto text-[10px] font-semibold text-[#666]">
                {rel || dateStr(ev.date)} · {timeStr(ev.date)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Monthly cadence stats — sets community pace expectation ───
function MonthlyStats({ events }: { events: CalEvent[] }) {
  const stats = useMemo(() => {
    const m = new Map<string, number>();
    events.forEach((e) => m.set(e.type, (m.get(e.type) || 0) + 1));
    return [
      { type: "class", n: m.get("class") || 0 },
      { type: "live", n: m.get("live") || 0 },
      { type: "workshop", n: m.get("workshop") || 0 },
      { type: "challenge", n: m.get("challenge") || 0 },
      { type: "mentor", n: m.get("mentor") || 0 },
    ];
  }, [events]);

  const total = stats.reduce((s, x) => s + x.n, 0);
  if (total === 0) return null;

  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#666]">Энэ сард</span>
      {stats
        .filter((s) => s.n > 0)
        .map((s) => {
          const cfg = TYPE_CONFIG[s.type];
          return (
            <span
              key={s.type}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: cfg.bg, color: cfg.color }}
            >
              <span className="font-black">{s.n}</span>
              {cfg.label}
            </span>
          );
        })}
    </div>
  );
}

// ─── Event Card ───
function EventCard({ event, onSelect }: { event: CalEvent; onSelect: (e: CalEvent) => void }) {
  const cfg = TYPE_CONFIG[event.type] || TYPE_CONFIG.event;
  const rel = relativeDay(new Date(event.date));
  const isLive = event.status === "live";

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => onSelect(event)}
      className="w-full text-left rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#111111] p-4 transition hover:border-[rgba(255,255,255,0.12)] hover:bg-[#141414] active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        {/* Type icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[4px]" style={{ background: cfg.bg }}>
          <svg className="h-5 w-5" style={{ color: cfg.color }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon} />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          {/* Tags */}
          <div className="flex items-center gap-2 mb-1">
            <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
            {isLive && (
              <span className="flex items-center gap-1 rounded-full bg-[rgba(239,44,88,0.15)] px-2 py-0.5 text-[9px] font-bold text-[#EF2C58]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#EF2C58] animate-pulse" />
                LIVE
              </span>
            )}
            {rel && <span className="text-[10px] font-semibold text-[#555555]">{rel}</span>}
          </div>

          {/* Title */}
          <h3 className="text-[14px] font-bold text-[#E8E8E8] leading-tight">{event.title}</h3>
          {event.description && (
            <p className="mt-1 text-[12px] text-[#666666] line-clamp-2">{event.description}</p>
          )}

          {/* Meta */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-[#555555]">
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {dateStr(event.date)} · {timeStr(event.date)}
            </span>
            {event.location && (
              <span className="flex items-center gap-1">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                {event.location}
              </span>
            )}
            {event.attendeeCount > 0 && (
              <span className="flex items-center gap-1">
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>
                {event.attendeeCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

// ─── Main Page ───
export default function CalendarPage() {
  const { data: session } = useSession();
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [typeFilter, setTypeFilter] = useState("all");

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ month: monthKey });
      if (typeFilter !== "all") params.set("type", typeFilter);
      const res = await fetch(`/api/events?${params}`);
      const data = await res.json();
      if (res.ok) setEvents(data.events || []);
    } finally { setLoading(false); }
  }, [monthKey, typeFilter]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const today = new Date();
  today.setHours(0,0,0,0);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const pad = first.getDay();
    const days: { date: Date; inMonth: boolean }[] = [];
    for (let i = pad - 1; i >= 0; i--) days.push({ date: new Date(year, month, -i), inMonth: false });
    for (let d = 1; d <= last.getDate(); d++) days.push({ date: new Date(year, month, d), inMonth: true });
    const rem = 42 - days.length;
    for (let i = 1; i <= rem; i++) days.push({ date: new Date(year, month + 1, i), inMonth: false });
    return days;
  }, [year, month]);

  const eventsForDate = (date: Date) => events.filter(ev => isSameDay(new Date(ev.date), date));

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return events
      .filter(e => new Date(e.date) >= now || e.status === "live")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);

  const selectedDayEvents = selectedDate ? eventsForDate(selectedDate) : [];

  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + dir);
    setCurrentDate(d);
    setSelectedDate(null);
    setSelectedEvent(null);
  };

  // Live count
  const liveNow = events.filter(e => e.status === "live");

  return (
    <div className="mx-auto max-w-[960px] pb-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-5">
        <div className="flex items-center gap-2">
          <div className="h-[2px] w-4 bg-[#EF2C58]" />
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#EF2C58]">ANTAQOR · СУРГАЛТЫН РИТМ</span>
        </div>
        <h1 className="mt-2 text-[26px] font-black text-[#E8E8E8] sm:text-[34px]">Хуваарь</h1>
        <p className="mt-1 text-[13px] text-[#888]">
          AI хичээл · LIVE · challenge · 1:1 mentor — гишүүний 7 хоногийн ритм
        </p>
      </motion.div>

      {/* This-week featured strip — most actionable timeframe */}
      <ThisWeekStrip events={upcomingEvents} onSelect={setSelectedEvent} />

      {/* Monthly stats */}
      <MonthlyStats events={events} />


      {/* Live now banner */}
      <AnimatePresence>
        {liveNow.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-5 overflow-hidden"
          >
            {liveNow.map(ev => (
              <button key={ev._id} onClick={() => setSelectedEvent(ev)}
                className="w-full flex items-center gap-3 rounded-[4px] border border-[rgba(239,44,88,0.2)] bg-[rgba(239,44,88,0.06)] p-4 transition hover:bg-[rgba(239,44,88,0.1)]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[rgba(239,44,88,0.15)]">
                  <span className="h-3 w-3 rounded-full bg-[#EF2C58] animate-pulse" />
                </div>
                <div className="min-w-0 flex-1 text-left">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#EF2C58]">ОДОО LIVE</div>
                  <div className="text-[14px] font-bold text-[#E8E8E8] truncate">{ev.title}</div>
                </div>
                {ev.liveLink && (
                  <a href={ev.liveLink} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                    className="shrink-0 rounded-[4px] bg-[#EF2C58] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-[#D4264E]">
                    Нэгдэх
                  </a>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* View toggle */}
        <div className="flex items-center gap-1 rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#111111] p-1">
          {(["month", "list"] as ViewMode[]).map(v => (
            <button key={v} onClick={() => { setView(v); setSelectedEvent(null); }}
              className={`rounded-[4px] px-4 py-2 text-[12px] font-semibold transition ${view === v ? "bg-[#EF2C58] text-white" : "text-[#666666] hover:text-[#999999]"}`}>
              {v === "month" ? "Календар" : "Жагсаалт"}
            </button>
          ))}
        </div>

        {/* Month nav */}
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="rounded-[4px] border border-[rgba(255,255,255,0.08)] p-2 text-[#666666] transition hover:text-[#E8E8E8]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={() => { setCurrentDate(new Date()); setSelectedDate(null); }}
            className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-3 py-2 text-[11px] font-bold text-[#666666] transition hover:text-[#EF2C58] hover:border-[rgba(239,44,88,0.3)]">
            Өнөөдөр
          </button>
          <span className="min-w-[130px] text-center text-[15px] font-bold text-[#E8E8E8]">
            {year} {MN_MONTHS[month]}
          </span>
          <button onClick={() => navigate(1)} className="rounded-[4px] border border-[rgba(255,255,255,0.08)] p-2 text-[#666666] transition hover:text-[#E8E8E8]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* Type chips */}
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => setTypeFilter("all")}
            className={`rounded-full px-3 py-1.5 text-[10px] font-bold transition ${typeFilter === "all" ? "bg-[rgba(255,255,255,0.1)] text-[#E8E8E8]" : "text-[#555555] hover:text-[#888888]"}`}>
            Бүгд
          </button>
          {Object.entries(TYPE_CONFIG).map(([k, c]) => (
            <button key={k} onClick={() => setTypeFilter(k)}
              className={`rounded-full px-3 py-1.5 text-[10px] font-bold transition ${typeFilter === k ? "text-white" : "text-[#555555] hover:text-[#888888]"}`}
              style={typeFilter === k ? { background: c.bg, color: c.color } : {}}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#EF2C58] border-t-transparent" />
        </div>
      )}

      {!loading && view === "month" && (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
          {/* Calendar grid */}
          <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#111111] overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-[rgba(255,255,255,0.06)]">
              {MN_DAYS.map(d => (
                <div key={d} className="py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-[#444444]">{d}</div>
              ))}
            </div>
            {/* Grid */}
            <div className="grid grid-cols-7">
              {calendarDays.map((day, i) => {
                const dayEvts = eventsForDate(day.date);
                const isToday = isSameDay(day.date, today);
                const isSel = selectedDate && isSameDay(day.date, selectedDate);
                const hasLive = dayEvts.some(e => e.status === "live");

                return (
                  <button key={i} onClick={() => { setSelectedDate(day.date); setSelectedEvent(null); }}
                    className={`relative min-h-[72px] sm:min-h-[85px] border-b border-r border-[rgba(255,255,255,0.04)] p-1.5 text-left transition hover:bg-[rgba(255,255,255,0.03)] ${!day.inMonth ? "opacity-25" : ""} ${isSel ? "bg-[rgba(239,44,88,0.06)] ring-1 ring-inset ring-[rgba(239,44,88,0.2)]" : ""}`}>
                    {/* Date number */}
                    <div className="flex items-center gap-1">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${isToday ? "bg-[#EF2C58] text-white" : "text-[#888888]"}`}>
                        {day.date.getDate()}
                      </span>
                      {hasLive && <span className="h-1.5 w-1.5 rounded-full bg-[#EF2C58] animate-pulse" />}
                    </div>

                    {/* Event dots */}
                    <div className="mt-1 space-y-0.5">
                      {dayEvts.slice(0, 2).map(ev => {
                        const cfg = TYPE_CONFIG[ev.type] || TYPE_CONFIG.event;
                        return (
                          <div key={ev._id}
                            className="rounded-[3px] px-1 py-0.5 text-[8px] font-bold leading-tight truncate sm:text-[9px]"
                            style={{ background: cfg.bg, color: cfg.color }}>
                            {ev.title}
                          </div>
                        );
                      })}
                      {dayEvts.length > 2 && (
                        <div className="px-1 text-[8px] font-bold text-[#555555]">+{dayEvts.length - 2}</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Selected day detail */}
            <AnimatePresence mode="wait">
              {selectedEvent ? (
                <motion.div key="detail" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#111111] p-5">
                  <button onClick={() => setSelectedEvent(null)} className="mb-3 flex items-center gap-1 text-[11px] text-[#555555] transition hover:text-[#EF2C58]">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                    Буцах
                  </button>

                  {selectedEvent.image && (
                    <img src={selectedEvent.image} alt={selectedEvent.title} className="mb-3 w-full rounded-[4px] object-cover max-h-[160px]" />
                  )}

                  <div className="flex items-center gap-2 mb-2">
                    {(() => { const c = TYPE_CONFIG[selectedEvent.type] || TYPE_CONFIG.event; return (
                      <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: c.bg, color: c.color }}>{c.label}</span>
                    ); })()}
                    {selectedEvent.status === "live" && (
                      <span className="flex items-center gap-1 rounded-full bg-[rgba(239,44,88,0.15)] px-2 py-0.5 text-[9px] font-bold text-[#EF2C58]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#EF2C58] animate-pulse" /> LIVE
                      </span>
                    )}
                  </div>

                  <h3 className="text-[16px] font-bold text-[#E8E8E8] leading-tight">{selectedEvent.title}</h3>
                  {selectedEvent.description && (
                    <p className="mt-2 text-[12px] leading-relaxed text-[#888888]">{selectedEvent.description}</p>
                  )}

                  <div className="mt-3 space-y-2 text-[11px]">
                    <div className="flex items-center gap-2 text-[#888888]">
                      <svg className="h-3.5 w-3.5 text-[#555555]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {dateStr(selectedEvent.date)} · {timeStr(selectedEvent.date)}
                      {selectedEvent.endDate && <span className="text-[#555555]">— {timeStr(selectedEvent.endDate)}</span>}
                    </div>
                    {selectedEvent.location && (
                      <div className="flex items-center gap-2 text-[#888888]">
                        <svg className="h-3.5 w-3.5 text-[#555555]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                        {selectedEvent.location}
                      </div>
                    )}
                  </div>

                  {selectedEvent.liveLink && (
                    <a href={selectedEvent.liveLink} target="_blank" rel="noopener noreferrer"
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-[4px] bg-[#EF2C58] py-3 text-[13px] font-bold text-white transition hover:bg-[#D4264E]">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" /></svg>
                      {selectedEvent.status === "live" ? "LIVE нэгдэх" : "Линк нээх"}
                    </a>
                  )}
                  <button
                    onClick={() => downloadIcs(selectedEvent)}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-[4px] border border-[rgba(255,255,255,0.08)] py-2.5 text-[12px] font-bold text-[#AAA] transition hover:border-[rgba(239,44,88,0.4)] hover:text-[#EF2C58]"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5M12 12v6m-3-3h6" />
                    </svg>
                    Календар руугаа нэмэх
                  </button>
                </motion.div>
              ) : selectedDate ? (
                <motion.div key="daylist" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#111111] p-4">
                  <h3 className="mb-3 text-[13px] font-bold text-[#E8E8E8]">
                    {selectedDate.toLocaleDateString("mn-MN", { month: "long", day: "numeric", weekday: "long" })}
                  </h3>
                  {selectedDayEvents.length === 0 ? (
                    <p className="py-6 text-center text-[12px] text-[#555555]">Энэ өдөр хуваарь байхгүй</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedDayEvents.map(ev => {
                        const cfg = TYPE_CONFIG[ev.type] || TYPE_CONFIG.event;
                        return (
                          <button key={ev._id} onClick={() => setSelectedEvent(ev)}
                            className="w-full rounded-[4px] p-3 text-left transition hover:brightness-110"
                            style={{ background: cfg.bg }}>
                            <div className="flex items-center gap-2">
                              {ev.status === "live" && <span className="h-1.5 w-1.5 rounded-full bg-[#EF2C58] animate-pulse" />}
                              <span className="text-[10px] font-bold" style={{ color: cfg.color }}>{timeStr(ev.date)} · {cfg.label}</span>
                            </div>
                            <div className="text-[13px] font-bold text-[#E8E8E8] mt-1">{ev.title}</div>
                            {ev.location && <div className="text-[10px] text-[#666666] mt-0.5">{ev.location}</div>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div key="upcoming" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#111111] p-4">
                  <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#EF2C58]">Удахгүй болох</h3>
                  {upcomingEvents.length === 0 ? (
                    <p className="py-4 text-center text-[12px] text-[#555555]">Энэ сард хуваарь байхгүй</p>
                  ) : (
                    <div className="space-y-1.5">
                      {upcomingEvents.slice(0, 8).map(ev => {
                        const cfg = TYPE_CONFIG[ev.type] || TYPE_CONFIG.event;
                        const d = new Date(ev.date);
                        const rel = relativeDay(d);
                        return (
                          <button key={ev._id} onClick={() => setSelectedEvent(ev)}
                            className="w-full flex items-center gap-3 rounded-[4px] p-2.5 transition hover:bg-[rgba(255,255,255,0.04)] text-left">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px]" style={{ background: cfg.bg }}>
                              <svg className="h-4 w-4" style={{ color: cfg.color }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d={cfg.icon} />
                              </svg>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-[12px] font-semibold text-[#E8E8E8] truncate">{ev.title}</div>
                              <div className="flex items-center gap-1.5 text-[10px] text-[#555555]">
                                {ev.status === "live" && <span className="h-1.5 w-1.5 rounded-full bg-[#EF2C58] animate-pulse" />}
                                <span>{rel || dateStr(ev.date)}</span>
                                <span>·</span>
                                <span>{timeStr(ev.date)}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* List view */}
      {!loading && view === "list" && (
        <div className="space-y-3">
          {events.length === 0 ? (
            <div className="rounded-[4px] border-2 border-dashed border-[rgba(255,255,255,0.08)] p-8 text-center">
              <svg className="mx-auto mb-3 h-10 w-10 text-[#333333]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
              <p className="text-[14px] font-bold text-[#E8E8E8]">Энэ сард хуваарь зарлагдаагүй</p>
              <p className="mt-1.5 text-[11px] text-[#666]">
                Гишүүний 7 хоногийн ритм бэлтгэгдэж байна — Лхагба LIVE · Бямба хичээл · Ням challenge
              </p>
            </div>
          ) : (
            events.map(ev => <EventCard key={ev._id} event={ev} onSelect={setSelectedEvent} />)
          )}

          {/* Event detail modal for list view */}
          <AnimatePresence>
            {selectedEvent && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4"
                onClick={() => setSelectedEvent(null)}>
                <motion.div initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }}
                  onClick={e => e.stopPropagation()}
                  className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#111111] p-6">

                  {selectedEvent.image && (
                    <img src={selectedEvent.image} alt={selectedEvent.title} className="mb-4 w-full rounded-[4px] object-cover max-h-[200px]" />
                  )}

                  <div className="flex items-center gap-2 mb-2">
                    {(() => { const c = TYPE_CONFIG[selectedEvent.type] || TYPE_CONFIG.event; return (
                      <span className="rounded-full px-2.5 py-0.5 text-[10px] font-bold" style={{ background: c.bg, color: c.color }}>{c.label}</span>
                    ); })()}
                    {selectedEvent.status === "live" && (
                      <span className="flex items-center gap-1 rounded-full bg-[rgba(239,44,88,0.15)] px-2 py-0.5 text-[10px] font-bold text-[#EF2C58]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#EF2C58] animate-pulse" /> LIVE
                      </span>
                    )}
                  </div>

                  <h2 className="text-[18px] font-bold text-[#E8E8E8]">{selectedEvent.title}</h2>
                  {selectedEvent.description && (
                    <p className="mt-2 text-[13px] leading-relaxed text-[#888888]">{selectedEvent.description}</p>
                  )}

                  <div className="mt-4 space-y-2 text-[12px] text-[#888888]">
                    <div className="flex items-center gap-2">
                      <svg className="h-4 w-4 text-[#555555]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {dateStr(selectedEvent.date)} · {timeStr(selectedEvent.date)}
                      {selectedEvent.endDate && <span>— {timeStr(selectedEvent.endDate)}</span>}
                    </div>
                    {selectedEvent.location && (
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 text-[#555555]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                        {selectedEvent.location}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex gap-2">
                    {selectedEvent.liveLink && (
                      <a href={selectedEvent.liveLink} target="_blank" rel="noopener noreferrer"
                        className="flex flex-1 items-center justify-center gap-2 rounded-[4px] bg-[#EF2C58] py-3 text-[13px] font-bold text-white transition hover:bg-[#D4264E]">
                        {selectedEvent.status === "live" ? "LIVE нэгдэх" : "Линк нээх"}
                      </a>
                    )}
                    <button
                      onClick={() => downloadIcs(selectedEvent)}
                      className="flex shrink-0 items-center justify-center gap-1.5 rounded-[4px] border border-[rgba(255,255,255,0.08)] px-3 py-3 text-[12px] font-bold text-[#AAA] transition hover:border-[rgba(239,44,88,0.4)] hover:text-[#EF2C58]"
                      title="Календар руугаа нэмэх"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75M12 12v6m-3-3h6" />
                      </svg>
                      .ics
                    </button>
                    <button onClick={() => setSelectedEvent(null)}
                      className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-5 py-3 text-[13px] text-[#666666] transition hover:text-[#E8E8E8]">
                      Хаах
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Not signed in prompt */}
      {!session && (
        <div className="mt-6 rounded-[4px] border border-[rgba(239,44,88,0.15)] bg-[rgba(239,44,88,0.04)] p-5 text-center">
          <p className="text-[13px] text-[#888888]">
            Хуваарьт бүртгүүлэх, live-д нэгдэхийн тулд{" "}
            <Link href="/auth/signin" className="font-bold text-[#EF2C58]">нэвтрэх</Link>
          </p>
        </div>
      )}
    </div>
  );
}
