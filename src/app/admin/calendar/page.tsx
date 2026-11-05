"use client";

import { useEffect, useState, useMemo, useCallback } from "react";

// ─── Types ───
interface CalEvent {
  _id: string;
  title: string;
  description: string;
  image: string;
  type: "event" | "live" | "class" | "deadline" | "workshop";
  date: string;
  endDate: string;
  liveLink: string;
  location: string;
  status: "upcoming" | "live" | "ended";
  color: string;
  recurring: "none" | "daily" | "weekly" | "monthly";
  recurringUntil?: string;
  attendees: { _id: string; name: string; email: string }[];
  createdAt: string;
}

type ViewMode = "month" | "week" | "list";

// ─── Constants ───
const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  event:    { label: "Эвент",       color: "#2E29FF", bg: "rgba(46,41,255,0.15)",   icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  live:     { label: "LIVE хичээл", color: "#2E29FF", bg: "rgba(46,41,255,0.15)",    icon: "M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" },
  class:    { label: "Хичээл",     color: "#2E29FF", bg: "rgba(46,41,255,0.15)",   icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  deadline: { label: "Дедлайн",    color: "#2E29FF", bg: "rgba(46,41,255,0.15)",    icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" },
  workshop: { label: "Воркшоп",    color: "#2E29FF", bg: "rgba(46,41,255,0.15)",   icon: "M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  upcoming: { label: "Төлөвлөсөн", color: "#2E29FF" },
  live:     { label: "LIVE",       color: "#2E29FF" },
  ended:    { label: "Дууссан",    color: "#30333F" },
};

const MN_MONTHS = [
  "1 сар", "2 сар", "3 сар", "4 сар", "5 сар", "6 сар",
  "7 сар", "8 сар", "9 сар", "10 сар", "11 сар", "12 сар",
];

const MN_DAYS_SHORT = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];

function fmt(d: string) {
  return new Date(d).toLocaleString("mn-MN", {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function toLocal(d: string) {
  const date = new Date(d);
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60000).toISOString().slice(0, 16);
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function dateToLocal(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

// Default start for a brand-new schedule: today at 19:00,
// or the next full hour if it is already past 19:00.
function defaultStart(): Date {
  const d = new Date();
  d.setSeconds(0, 0);
  if (d.getHours() < 19) d.setHours(19, 0, 0, 0);
  else d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

const TIME_CHIPS: [string, number][] = [["18:00", 18], ["19:00", 19], ["20:00", 20], ["21:00", 21]];
const DURATIONS: [number, string][] = [[60, "1 цаг"], [90, "1.5 цаг"], [120, "2 цаг"], [180, "3 цаг"]];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ─── Main Component ───
export default function AdminCalendarPage() {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<CalEvent | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const [form, setForm] = useState({
    title: "", description: "", image: "", date: "", endDate: "",
    liveLink: "", location: "", status: "upcoming",
    type: "event", color: "", recurring: "none", recurringUntil: "",
  });
  const [durationMin, setDurationMin] = useState(60);
  const [endTouched, setEndTouched] = useState(false);
  const [advanced, setAdvanced] = useState(false);

  const showFlash = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(""), 3000); };

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/events");
      const data = await res.json();
      if (res.ok) setEvents(data.events || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const BLANK = { title: "", description: "", image: "", date: "", endDate: "", liveLink: "", location: "", status: "upcoming", type: "event", color: "", recurring: "none", recurringUntil: "" };

  const resetForm = () => {
    setForm({ ...BLANK });
    setEditingId(null);
    setDurationMin(60);
    setEndTouched(false);
    setAdvanced(false);
    setShowForm(false);
  };

  // Open a fresh form. Date is ALWAYS pre-filled (today / clicked day),
  // so the admin never faces an empty date field.
  const openNewForm = (date?: Date) => {
    const start = defaultStart();
    if (date) start.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    setForm({ ...BLANK, date: dateToLocal(start) });
    setEditingId(null);
    setDurationMin(60);
    setEndTouched(false);
    setAdvanced(false);
    setSelectedEvent(null);
    setShowForm(true);
  };

  const openFormForDate = (date: Date) => openNewForm(date);

  const startEdit = (ev: CalEvent) => {
    const hasEnd = !!ev.endDate;
    setForm({
      title: ev.title, description: ev.description, image: ev.image,
      date: toLocal(ev.date), endDate: hasEnd ? toLocal(ev.endDate) : "",
      liveLink: ev.liveLink, location: ev.location, status: ev.status,
      type: ev.type || "event", color: ev.color || "", recurring: ev.recurring || "none",
      recurringUntil: ev.recurringUntil ? toLocal(ev.recurringUntil) : "",
    });
    if (hasEnd) {
      const mins = Math.round((new Date(ev.endDate).getTime() - new Date(ev.date).getTime()) / 60000);
      setDurationMin(mins > 0 ? mins : 60);
      setEndTouched(true);
    } else {
      setDurationMin(60);
      setEndTouched(false);
    }
    setAdvanced(!!(ev.description || ev.liveLink || ev.location || (ev.recurring && ev.recurring !== "none") || hasEnd));
    setEditingId(ev._id);
    setShowForm(true);
    setSelectedEvent(null);
  };

  const handleSave = async () => {
    if (!form.title || !form.date) { showFlash("Гарчиг болон огноо шаардлагатай"); return; }
    setSaving(true);
    try {
      const start = new Date(form.date);
      const endDate = endTouched && form.endDate
        ? form.endDate
        : dateToLocal(new Date(start.getTime() + durationMin * 60000));
      const payload = { ...form, endDate };
      const url = editingId ? `/api/admin/events/${editingId}` : "/api/admin/events";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (res.ok) {
        showFlash(editingId ? "Шинэчлэгдлээ" : "Үүслээ");
        resetForm();
        fetchEvents();
      } else {
        const data = await res.json();
        showFlash(data.error || "Алдаа");
      }
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Устгах уу?")) return;
    const res = await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
    if (res.ok) { showFlash("Устгагдлаа"); setSelectedEvent(null); fetchEvents(); }
  };

  const handleStatusChange = async (id: string, status: string) => {
    const res = await fetch(`/api/admin/events/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    if (res.ok) { showFlash(`Статус: ${STATUS_CONFIG[status]?.label}`); fetchEvents(); }
  };

  // ─── Calendar Data ───
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const days: { date: Date; inMonth: boolean }[] = [];

    for (let i = startPad - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month, -i), inMonth: false });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(year, month, d), inMonth: true });
    }
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), inMonth: false });
    }
    return days;
  }, [year, month]);

  const weekDays = useMemo(() => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  const filteredEvents = useMemo(() => {
    if (typeFilter === "all") return events;
    return events.filter(e => (e.type || "event") === typeFilter);
  }, [events, typeFilter]);

  const eventsForDate = (date: Date) => {
    return filteredEvents.filter(ev => isSameDay(new Date(ev.date), date));
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return filteredEvents
      .filter(e => new Date(e.date) >= now || e.status === "live")
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10);
  }, [filteredEvents]);

  const navigate = (dir: number) => {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    setCurrentDate(d);
  };

  const goToday = () => setCurrentDate(new Date());

  // ─── Form date helpers (derived) ───
  const startD = form.date ? new Date(form.date) : defaultStart();
  const datePart = form.date ? form.date.slice(0, 10) : "";
  const timePart = form.date ? form.date.slice(11, 16) : "";
  const timeActive = startD.getMinutes() === 0 ? startD.getHours() : -1;
  const _t0 = new Date(); _t0.setHours(0, 0, 0, 0);
  const dayChips = [0, 1, 2].map(off => {
    const d = new Date(_t0); d.setDate(d.getDate() + off);
    return { key: off, label: off === 0 ? "Өнөөдөр" : off === 1 ? "Маргааш" : "Нөгөөдөр", date: d, active: isSameDay(d, startD) };
  });
  const endD = endTouched && form.endDate ? new Date(form.endDate) : new Date(startD.getTime() + durationMin * 60000);
  const previewLabel = form.date
    ? `${MN_DAYS_SHORT[startD.getDay()]} · ${startD.getMonth() + 1}/${startD.getDate()} · ${pad2(startD.getHours())}:${pad2(startD.getMinutes())}–${pad2(endD.getHours())}:${pad2(endD.getMinutes())}`
    : "";

  const writeDate = (d: Date) => setForm(f => ({ ...f, date: dateToLocal(d) }));
  const pickDay = (target: Date) => { const d = new Date(form.date || dateToLocal(defaultStart())); d.setFullYear(target.getFullYear(), target.getMonth(), target.getDate()); writeDate(d); };
  const pickDayStr = (s: string) => { if (!s) return; const [y, m, dd] = s.split("-").map(Number); const d = new Date(form.date || dateToLocal(defaultStart())); d.setFullYear(y, m - 1, dd); writeDate(d); };
  const pickTime = (h: number, mi: number) => { const d = new Date(form.date || dateToLocal(defaultStart())); d.setHours(h, mi, 0, 0); writeDate(d); };
  const pickTimeStr = (s: string) => { if (!s) return; const [h, mi] = s.split(":").map(Number); const d = new Date(form.date || dateToLocal(defaultStart())); d.setHours(h, mi, 0, 0); writeDate(d); };

  // ─── Loading ───
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-[4px] border-2 border-[#2E29FF] border-t-transparent" />
      </div>
    );
  }

  const liveCount = events.filter(e => e.status === "live").length;
  const upcomingCount = events.filter(e => e.status === "upcoming").length;
  const thisMonthCount = events.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === month && d.getFullYear() === year;
  }).length;

  return (
    <div className="space-y-5 pb-6">
      {/* Flash */}
      {flash && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-[4px] bg-[#F2F2F4] border border-[rgba(255,255,255,0.08)] px-4 py-2.5 shadow-xl">
          <svg className="h-4 w-4 text-[#2E29FF] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          <span className="text-[13px] text-[#E8E8E8]">{flash}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E8E8E8]">Календар</h1>
          <p className="mt-0.5 text-[12px] text-[#E2E4E8]">Хичээл, эвент, live хуваарь</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => (showForm ? resetForm() : openNewForm())}
            className="rounded-[4px] bg-[#2E29FF] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-[#1F1AD9]">
            {showForm ? "Цуцлах" : "+ Шинэ хуваарь"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Энэ сар", value: thisMonthCount, color: "text-[#30333F]" },
          { label: "Төлөвлөсөн", value: upcomingCount, color: "text-[#2E29FF]" },
          { label: "LIVE", value: liveCount, color: "text-[#2E29FF]" },
        ].map(s => (
          <div key={s.label} className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-[#E2E4E8]">{s.label}</div>
            <div className={`mt-0.5 text-xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Controls: View Mode + Navigation + Type Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-1">
          {(["month", "week", "list"] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`rounded-[4px] px-3 py-1.5 text-[11px] font-semibold transition ${view === v ? "bg-[#2E29FF] text-white" : "text-[#E2E4E8] hover:text-[#E2E4E8]"}`}>
              {v === "month" ? "Сар" : v === "week" ? "7 хоног" : "Жагсаалт"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="rounded-[4px] border border-[rgba(255,255,255,0.08)] p-1.5 text-[#E2E4E8] transition hover:text-[#E8E8E8]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={goToday} className="rounded-[4px] bg-[#141414] px-3 py-1.5 text-[11px] font-semibold text-[#E2E4E8] transition hover:bg-[#1E1E1E] hover:text-[#2E29FF]">
            Өнөөдөр
          </button>
          <span className="min-w-[140px] text-center text-[14px] font-bold text-[#E8E8E8]">
            {year} {MN_MONTHS[month]}
          </span>
          <button onClick={() => navigate(1)} className="rounded-[4px] border border-[rgba(255,255,255,0.08)] p-1.5 text-[#E2E4E8] transition hover:text-[#E8E8E8]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => setTypeFilter("all")}
            className={`rounded-[4px] px-2.5 py-1 text-[10px] font-bold transition ${typeFilter === "all" ? "bg-[rgba(255,255,255,0.12)] text-[#E8E8E8]" : "text-[#E2E4E8] hover:text-[#E2E4E8]"}`}>
            Бүгд
          </button>
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
            <button key={key} onClick={() => setTypeFilter(key)}
              className={`rounded-[4px] px-2.5 py-1 text-[10px] font-bold transition ${typeFilter === key ? "text-white" : "text-[#E2E4E8] hover:text-[#E2E4E8]"}`}
              style={typeFilter === key ? { background: cfg.bg, color: cfg.color } : {}}>
              {cfg.label}
            </button>
          ))}
        </div>
      </div>

      {/* Event form — minimal, tap-first */}
      {showForm && (
        <div className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-bold text-[#E8E8E8]">
              {editingId ? "Хуваарь засах" : "Шинэ хуваарь"}
            </h2>
            {previewLabel && (
              <span className="rounded-[4px] bg-[rgba(46,41,255,0.12)] px-3 py-1 text-[11px] font-bold text-[#2E29FF]">
                {previewLabel}
              </span>
            )}
          </div>

          <div className="space-y-4">
            {/* 1 · Type */}
            <div className="flex flex-wrap gap-2">
              {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                <button key={key} type="button" onClick={() => setForm(f => ({ ...f, type: key }))}
                  className={`flex items-center gap-1.5 rounded-[4px] px-3.5 py-2 text-[12px] font-semibold transition ${form.type === key ? "" : "border border-[rgba(255,255,255,0.1)] text-[#E2E4E8] hover:text-[#B0B0B0]"}`}
                  style={form.type === key ? { background: cfg.bg, color: cfg.color } : {}}>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={cfg.icon} /></svg>
                  {cfg.label}
                </button>
              ))}
            </div>

            {/* 2 · Title */}
            <input autoFocus value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Юу болох вэ?" maxLength={200}
              className="w-full rounded-[4px] border border-[rgba(255,255,255,0.1)] bg-[#0A0A0A] px-4 py-3.5 text-[16px] font-semibold text-[#E8E8E8] placeholder-[#62666F] outline-none transition focus:border-[#2E29FF]" />

            {/* 3 · When — day / time / duration, all one-tap */}
            <div className="space-y-3 rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-4">
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[1px] text-[#E2E4E8]">Аль өдөр</label>
                <div className="flex flex-wrap items-center gap-2">
                  {dayChips.map(c => (
                    <button key={c.key} type="button" onClick={() => pickDay(c.date)}
                      className={`rounded-[4px] px-3.5 py-2 text-[13px] font-semibold transition ${c.active ? "bg-[#2E29FF] text-white" : "border border-[rgba(255,255,255,0.12)] text-[#E2E4E8] hover:text-[#E8E8E8]"}`}>
                      {c.label}
                    </button>
                  ))}
                  <input type="date" value={datePart} onChange={e => pickDayStr(e.target.value)}
                    className="rounded-[4px] border border-[rgba(255,255,255,0.12)] bg-transparent px-3 py-2 text-[13px] text-[#E2E4E8] outline-none transition focus:border-[#2E29FF] [color-scheme:dark]" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[1px] text-[#E2E4E8]">Хэдэн цагт</label>
                <div className="flex flex-wrap items-center gap-2">
                  {TIME_CHIPS.map(([lbl, h]) => (
                    <button key={lbl} type="button" onClick={() => pickTime(h, 0)}
                      className={`rounded-[4px] px-3.5 py-2 text-[13px] font-semibold transition ${timeActive === h ? "bg-[#2E29FF] text-white" : "border border-[rgba(255,255,255,0.12)] text-[#E2E4E8] hover:text-[#E8E8E8]"}`}>
                      {lbl}
                    </button>
                  ))}
                  <input type="time" value={timePart} onChange={e => pickTimeStr(e.target.value)}
                    className="rounded-[4px] border border-[rgba(255,255,255,0.12)] bg-transparent px-3 py-2 text-[13px] text-[#E2E4E8] outline-none transition focus:border-[#2E29FF] [color-scheme:dark]" />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase tracking-[1px] text-[#E2E4E8]">Үргэлжлэх хугацаа</label>
                <div className="flex flex-wrap gap-2">
                  {DURATIONS.map(([min, lbl]) => (
                    <button key={min} type="button" onClick={() => { setDurationMin(min); setEndTouched(false); }}
                      className={`rounded-[4px] px-3.5 py-2 text-[13px] font-semibold transition ${!endTouched && durationMin === min ? "border border-[#2E29FF] bg-[rgba(46,41,255,0.15)] text-[#2E29FF]" : "border border-[rgba(255,255,255,0.12)] text-[#E2E4E8] hover:text-[#E8E8E8]"}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Advanced — collapsed by default so the form stays light */}
            <button type="button" onClick={() => setAdvanced(a => !a)}
              className="flex items-center gap-1.5 text-[12px] font-semibold text-[#E2E4E8] transition hover:text-[#E2E4E8]">
              <svg className={`h-3.5 w-3.5 transition-transform ${advanced ? "rotate-90" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              Дэлгэрэнгүй (тайлбар, линк, давталт)
            </button>

            {advanced && (
              <div className="space-y-3 rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-4">
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Тайлбар" rows={2} maxLength={2000}
                  className="w-full rounded-[4px] border border-[rgba(255,255,255,0.1)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#62666F] outline-none transition focus:border-[#2E29FF] resize-none" />

                <div className="grid gap-3 sm:grid-cols-2">
                  <input value={form.liveLink} onChange={e => setForm(f => ({ ...f, liveLink: e.target.value }))}
                    placeholder="Live линк (Zoom / YouTube)"
                    className="w-full rounded-[4px] border border-[rgba(255,255,255,0.1)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#62666F] outline-none transition focus:border-[#2E29FF]" />
                  <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="Байршил (Онлайн / хаяг)"
                    className="w-full rounded-[4px] border border-[rgba(255,255,255,0.1)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#62666F] outline-none transition focus:border-[#2E29FF]" />
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[1px] text-[#E2E4E8]">Давталт</label>
                  <div className="flex flex-wrap gap-2">
                    {([["none", "Нэг удаа"], ["daily", "Өдөр бүр"], ["weekly", "7 хоног бүр"], ["monthly", "Сар бүр"]] as const).map(([k, l]) => (
                      <button key={k} type="button" onClick={() => setForm(f => ({ ...f, recurring: k }))}
                        className={`rounded-[4px] px-3 py-1.5 text-[12px] font-semibold transition ${form.recurring === k ? "border border-[#2E29FF] bg-[rgba(46,41,255,0.15)] text-[#2E29FF]" : "border border-[rgba(255,255,255,0.1)] text-[#E2E4E8] hover:text-[#E2E4E8]"}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Цуврал хэзээ дуусах вэ. Хоосон = хязгааргүй. Зөвхөн давталттай
                    үед л утгатай тул давталт "Нэг удаа" бол огт харагдахгүй —
                    хэрэглэгдэхгүй талбар нь маягтыг л уншихад хүндрүүлнэ. */}
                {form.recurring !== "none" && (
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[1px] text-[#E2E4E8]">Давталт дуусах (хоосон = хязгааргүй)</label>
                    <input type="datetime-local" value={form.recurringUntil || ""}
                      onChange={e => setForm(f => ({ ...f, recurringUntil: e.target.value }))}
                      className="rounded-[4px] border border-[rgba(255,255,255,0.1)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] outline-none transition focus:border-[#2E29FF] [color-scheme:dark]" />
                    <p className="mt-1.5 text-[11px] leading-snug text-[#E2E4E8]">
                      Давталттай эвент нь хуанли дээр цаашид ДАВТАГДАН гарна. Доорх
                      "Дуусах хугацаа" нь НЭГ удаагийн үргэлжлэх хугацаа — өөр зүйл.
                    </p>
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[1px] text-[#E2E4E8]">Дуусах хугацаа (заавал биш)</label>
                  <input type="datetime-local" value={form.endDate}
                    onChange={e => { setForm(f => ({ ...f, endDate: e.target.value })); setEndTouched(true); }}
                    className="rounded-[4px] border border-[rgba(255,255,255,0.1)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] outline-none transition focus:border-[#2E29FF] [color-scheme:dark]" />
                </div>

                {editingId && (
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[1px] text-[#E2E4E8]">Статус</label>
                    <div className="flex flex-wrap gap-2">
                      {(["upcoming", "live", "ended"] as const).map(s => (
                        <button key={s} type="button" onClick={() => setForm(f => ({ ...f, status: s }))}
                          className={`rounded-[4px] px-3 py-1.5 text-[12px] font-semibold transition ${form.status === s ? "border border-current" : "border border-[rgba(255,255,255,0.1)] text-[#E2E4E8] hover:text-[#E2E4E8]"}`}
                          style={form.status === s ? { color: STATUS_CONFIG[s].color, background: `${STATUS_CONFIG[s].color}15` } : {}}>
                          {STATUS_CONFIG[s].label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button onClick={handleSave} disabled={saving || !form.title}
                className="rounded-[4px] bg-[#2E29FF] px-6 py-3 text-[13px] font-bold text-white transition hover:bg-[#1F1AD9] disabled:opacity-40">
                {saving ? "..." : editingId ? "Хадгалах" : "Үүсгэх"}
              </button>
              <button onClick={resetForm}
                className="rounded-[4px] border border-[rgba(255,255,255,0.1)] px-4 py-3 text-[13px] text-[#E2E4E8] transition hover:text-[#E2E4E8]">
                Цуцлах
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* Calendar / List */}
        <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] overflow-hidden">
          {/* Month View */}
          {view === "month" && (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-[rgba(255,255,255,0.06)]">
                {MN_DAYS_SHORT.map(d => (
                  <div key={d} className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-[#E2E4E8]">{d}</div>
                ))}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7">
                {calendarDays.map((day, i) => {
                  const dayEvents = eventsForDate(day.date);
                  const isToday = isSameDay(day.date, today);
                  const isSelected = selectedDate && isSameDay(day.date, selectedDate);
                  return (
                    <button key={i} onClick={() => { setSelectedDate(day.date); setSelectedEvent(null); }}
                      onDoubleClick={() => openFormForDate(day.date)}
                      className={`relative min-h-[80px] border-b border-r border-[rgba(255,255,255,0.04)] p-1 text-left transition hover:bg-[rgba(255,255,255,0.03)] ${!day.inMonth ? "opacity-30" : ""} ${isSelected ? "bg-[rgba(46,41,255,0.06)]" : ""}`}>
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-[4px] text-[11px] font-bold ${isToday ? "bg-[#2E29FF] text-white" : "text-[#E2E4E8]"}`}>
                        {day.date.getDate()}
                      </span>
                      <div className="mt-0.5 space-y-0.5">
                        {dayEvents.slice(0, 3).map(ev => {
                          const cfg = TYPE_CONFIG[ev.type || "event"] || TYPE_CONFIG.event;
                          return (
                            <div key={ev._id} onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); setSelectedDate(day.date); }}
                              className="flex items-center gap-1 rounded-[4px] px-1 py-0.5 text-[11px] font-semibold leading-tight truncate cursor-pointer transition hover:brightness-125"
                              style={{ background: cfg.bg, color: cfg.color }}>
                              {ev.status === "live" && <span className="h-1.5 w-1.5 rounded-full bg-[#2E29FF] animate-pulse shrink-0" />}
                              <span className="truncate">{ev.title}</span>
                            </div>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <div className="px-1 text-[8px] font-bold text-[#E2E4E8]">+{dayEvents.length - 3}</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Week View */}
          {view === "week" && (
            <div>
              <div className="grid grid-cols-7 border-b border-[rgba(255,255,255,0.06)]">
                {weekDays.map((d, i) => {
                  const isToday = isSameDay(d, today);
                  return (
                    <div key={i} className={`py-3 text-center ${isToday ? "bg-[rgba(46,41,255,0.06)]" : ""}`}>
                      <div className="text-[10px] font-bold uppercase text-[#E2E4E8]">{MN_DAYS_SHORT[i]}</div>
                      <div className={`mt-0.5 text-[16px] font-bold ${isToday ? "text-[#2E29FF]" : "text-[#E2E4E8]"}`}>{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-7 min-h-[400px]">
                {weekDays.map((d, i) => {
                  const dayEvents = eventsForDate(d);
                  const isToday = isSameDay(d, today);
                  return (
                    <div key={i} className={`border-r border-[rgba(255,255,255,0.04)] p-2 space-y-1 ${isToday ? "bg-[rgba(46,41,255,0.03)]" : ""}`}
                      onDoubleClick={() => openFormForDate(d)}>
                      {dayEvents.map(ev => {
                        const cfg = TYPE_CONFIG[ev.type || "event"] || TYPE_CONFIG.event;
                        const time = new Date(ev.date).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" });
                        return (
                          <button key={ev._id} onClick={() => { setSelectedEvent(ev); setSelectedDate(d); }}
                            className="w-full rounded-[4px] p-2 text-left transition hover:brightness-125"
                            style={{ background: cfg.bg }}>
                            <div className="flex items-center gap-1">
                              {ev.status === "live" && <span className="h-1.5 w-1.5 rounded-full bg-[#2E29FF] animate-pulse shrink-0" />}
                              <span className="text-[11px] font-bold" style={{ color: cfg.color }}>{time}</span>
                            </div>
                            <div className="text-[10px] font-semibold text-[#E8E8E8] truncate mt-0.5">{ev.title}</div>
                          </button>
                        );
                      })}
                      {dayEvents.length === 0 && (
                        <div className="flex h-full items-center justify-center text-[10px] text-[#d5dce3]">---</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* List View */}
          {view === "list" && (
            <div className="divide-y divide-[rgba(255,255,255,0.06)]">
              {filteredEvents.length === 0 ? (
                <div className="py-16 text-center text-[13px] text-[#E2E4E8]">Хуваарь байхгүй</div>
              ) : (
                filteredEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(ev => {
                  const cfg = TYPE_CONFIG[ev.type || "event"] || TYPE_CONFIG.event;
                  const st = STATUS_CONFIG[ev.status] || STATUS_CONFIG.upcoming;
                  const isPast = new Date(ev.date) < today;
                  return (
                    <div key={ev._id} className={`flex items-center gap-3 p-4 transition hover:bg-[rgba(255,255,255,0.02)] ${isPast ? "opacity-50" : ""}`}>
                      {/* Date badge */}
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[4px] border border-[rgba(255,255,255,0.08)]">
                        <span className="text-[10px] font-bold uppercase text-[#E2E4E8]">{MN_MONTHS[new Date(ev.date).getMonth()]}</span>
                        <span className="text-[16px] font-bold text-[#E8E8E8]">{new Date(ev.date).getDate()}</span>
                      </div>
                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="rounded-[4px] px-2 py-0.5 text-[11px] font-bold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                          <span className="rounded-[4px] px-2 py-0.5 text-[11px] font-bold" style={{ color: st.color, background: `${st.color}15` }}>{st.label}</span>
                          {ev.status === "live" && <span className="h-2 w-2 rounded-full bg-[#2E29FF] animate-pulse" />}
                        </div>
                        <div className="text-[13px] font-bold text-[#E8E8E8] truncate">{ev.title}</div>
                        <div className="text-[11px] text-[#E2E4E8]">
                          {fmt(ev.date)}
                          {ev.location && <span> · {ev.location}</span>}
                          {ev.attendees?.length > 0 && <span> · {ev.attendees.length} оролцогч</span>}
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex shrink-0 items-center gap-1">
                        {ev.liveLink && (
                          <a href={ev.liveLink} target="_blank" rel="noopener noreferrer"
                            className="rounded-[4px] bg-[rgba(46,41,255,0.1)] px-2.5 py-1.5 text-[10px] font-bold text-[#2E29FF] transition hover:bg-[rgba(46,41,255,0.2)]">
                            Нэгдэх
                          </a>
                        )}
                        {ev.status !== "live" && ev.status !== "ended" && (
                          <button onClick={() => handleStatusChange(ev._id, "live")}
                            className="rounded-[4px] bg-[rgba(46,41,255,0.1)] px-2 py-1.5 text-[10px] font-bold text-[#2E29FF] transition hover:bg-[rgba(46,41,255,0.2)]">
                            LIVE
                          </button>
                        )}
                        {ev.status === "live" && (
                          <button onClick={() => handleStatusChange(ev._id, "ended")}
                            className="rounded-[4px] bg-[rgba(102,102,102,0.1)] px-2 py-1.5 text-[10px] font-bold text-[#E2E4E8] transition hover:bg-[rgba(102,102,102,0.2)]">
                            Дуусгах
                          </button>
                        )}
                        <button onClick={() => startEdit(ev)}
                          className="rounded-[4px] p-1.5 text-[#E2E4E8] transition hover:text-[#E8E8E8]">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => handleDelete(ev._id)}
                          className="rounded-[4px] p-1.5 text-[#4C47FF]/50 transition hover:text-[#4C47FF]">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Selected event detail */}
          {selectedEvent && (
            <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="rounded-[4px] px-2 py-0.5 text-[11px] font-bold"
                    style={{ background: (TYPE_CONFIG[selectedEvent.type || "event"] || TYPE_CONFIG.event).bg, color: (TYPE_CONFIG[selectedEvent.type || "event"] || TYPE_CONFIG.event).color }}>
                    {(TYPE_CONFIG[selectedEvent.type || "event"] || TYPE_CONFIG.event).label}
                  </span>
                  <h3 className="mt-2 text-[15px] font-bold text-[#E8E8E8]">{selectedEvent.title}</h3>
                </div>
                <button onClick={() => setSelectedEvent(null)} className="text-[#E2E4E8] hover:text-[#E2E4E8]">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {selectedEvent.description && (
                <p className="mb-3 text-[12px] leading-relaxed text-[#E2E4E8]">{selectedEvent.description}</p>
              )}

              <div className="space-y-2 text-[11px]">
                <div className="flex items-center gap-2 text-[#E2E4E8]">
                  <svg className="h-3.5 w-3.5 text-[#E2E4E8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {fmt(selectedEvent.date)}
                  {selectedEvent.endDate && <span>- {fmt(selectedEvent.endDate)}</span>}
                </div>
                {selectedEvent.location && (
                  <div className="flex items-center gap-2 text-[#E2E4E8]">
                    <svg className="h-3.5 w-3.5 text-[#E2E4E8]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                    {selectedEvent.location}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="rounded-[4px] px-2 py-0.5 text-[11px] font-bold"
                    style={{ color: STATUS_CONFIG[selectedEvent.status]?.color, background: `${STATUS_CONFIG[selectedEvent.status]?.color}15` }}>
                    {STATUS_CONFIG[selectedEvent.status]?.label}
                  </span>
                  {selectedEvent.attendees?.length > 0 && (
                    <span className="text-[#E2E4E8]">{selectedEvent.attendees.length} оролцогч</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedEvent.liveLink && (
                  <a href={selectedEvent.liveLink} target="_blank" rel="noopener noreferrer"
                    className="rounded-[4px] bg-[#2E29FF] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#1F1AD9]">
                    Live нэгдэх
                  </a>
                )}
                {selectedEvent.status !== "live" && selectedEvent.status !== "ended" && (
                  <button onClick={() => { handleStatusChange(selectedEvent._id, "live"); setSelectedEvent({ ...selectedEvent, status: "live" }); }}
                    className="rounded-[4px] bg-[rgba(46,41,255,0.15)] px-3 py-1.5 text-[11px] font-bold text-[#2E29FF]">
                    LIVE эхлүүлэх
                  </button>
                )}
                {selectedEvent.status === "live" && (
                  <button onClick={() => { handleStatusChange(selectedEvent._id, "ended"); setSelectedEvent({ ...selectedEvent, status: "ended" }); }}
                    className="rounded-[4px] bg-[rgba(102,102,102,0.15)] px-3 py-1.5 text-[11px] font-bold text-[#E2E4E8]">
                    Дуусгах
                  </button>
                )}
                <button onClick={() => startEdit(selectedEvent)}
                  className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[11px] font-bold text-[#E2E4E8] transition hover:text-[#E8E8E8]">
                  Засах
                </button>
                <button onClick={() => handleDelete(selectedEvent._id)}
                  className="rounded-[4px] border border-[rgba(46,41,255,0.2)] px-3 py-1.5 text-[11px] font-bold text-[#4C47FF]/70 transition hover:text-[#4C47FF]">
                  Устгах
                </button>
              </div>
            </div>
          )}

          {/* Selected date events */}
          {selectedDate && !selectedEvent && (
            <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-bold text-[#E8E8E8]">
                  {selectedDate.toLocaleDateString("mn-MN", { month: "long", day: "numeric", weekday: "long" })}
                </h3>
                <button onClick={() => openFormForDate(selectedDate)}
                  className="rounded-[4px] bg-[#2E29FF] px-2.5 py-1 text-[10px] font-bold text-white transition hover:bg-[#1F1AD9]">
                  + Нэмэх
                </button>
              </div>
              {eventsForDate(selectedDate).length === 0 ? (
                <p className="text-[12px] text-[#E2E4E8]">Хуваарь байхгүй</p>
              ) : (
                <div className="space-y-2">
                  {eventsForDate(selectedDate).map(ev => {
                    const cfg = TYPE_CONFIG[ev.type || "event"] || TYPE_CONFIG.event;
                    const time = new Date(ev.date).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" });
                    return (
                      <button key={ev._id} onClick={() => setSelectedEvent(ev)}
                        className="w-full rounded-[4px] p-3 text-left transition hover:brightness-110"
                        style={{ background: cfg.bg }}>
                        <div className="flex items-center gap-2">
                          {ev.status === "live" && <span className="h-2 w-2 rounded-full bg-[#2E29FF] animate-pulse" />}
                          <span className="text-[10px] font-bold" style={{ color: cfg.color }}>{time} · {cfg.label}</span>
                        </div>
                        <div className="text-[12px] font-semibold text-[#E8E8E8] mt-1">{ev.title}</div>
                        {ev.location && <div className="text-[10px] text-[#E2E4E8] mt-0.5">{ev.location}</div>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Upcoming schedule */}
          <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0A0A0A] p-4">
            <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#2E29FF]">Удахгүй болох</h3>
            {upcomingEvents.length === 0 ? (
              <p className="text-[12px] text-[#E2E4E8]">Төлөвлөсөн хуваарь байхгүй</p>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map(ev => {
                  const cfg = TYPE_CONFIG[ev.type || "event"] || TYPE_CONFIG.event;
                  const d = new Date(ev.date);
                  const diffMs = d.getTime() - Date.now();
                  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
                  let timeLabel = "";
                  if (ev.status === "live") timeLabel = "ОДОО";
                  else if (diffDays === 0) timeLabel = "Өнөөдөр";
                  else if (diffDays === 1) timeLabel = "Маргааш";
                  else if (diffDays < 0) timeLabel = `${Math.abs(diffDays)} өдрийн өмнө`;
                  else timeLabel = `${diffDays} хоногийн дараа`;

                  return (
                    <button key={ev._id} onClick={() => { setSelectedEvent(ev); setSelectedDate(d); }}
                      className="w-full flex items-center gap-3 rounded-[4px] p-2 transition hover:bg-[rgba(255,255,255,0.04)] text-left">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px]" style={{ background: cfg.bg }}>
                        <svg className="h-4 w-4" style={{ color: cfg.color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={cfg.icon} />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] font-semibold text-[#E8E8E8] truncate">{ev.title}</div>
                        <div className="flex items-center gap-1.5 text-[10px] text-[#E2E4E8]">
                          {ev.status === "live" && <span className="h-1.5 w-1.5 rounded-full bg-[#2E29FF] animate-pulse" />}
                          <span style={ev.status === "live" ? { color: "#2E29FF", fontWeight: 700 } : {}}>{timeLabel}</span>
                          <span>·</span>
                          <span>{d.toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
