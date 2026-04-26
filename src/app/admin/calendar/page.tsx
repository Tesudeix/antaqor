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
  attendees: { _id: string; name: string; email: string }[];
  createdAt: string;
}

type ViewMode = "month" | "week" | "list";

// ─── Constants ───
const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  event:    { label: "Эвент",       color: "#EF2C58", bg: "rgba(239,44,88,0.15)",   icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
  live:     { label: "LIVE хичээл", color: "#EF2C58", bg: "rgba(239,44,88,0.15)",    icon: "M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" },
  class:    { label: "Хичээл",     color: "#0F81CA", bg: "rgba(15,129,202,0.15)",   icon: "M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" },
  deadline: { label: "Дедлайн",    color: "#EF2C58", bg: "rgba(239,44,88,0.15)",    icon: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" },
  workshop: { label: "Воркшоп",    color: "#A855F7", bg: "rgba(168,85,247,0.15)",   icon: "M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  upcoming: { label: "Төлөвлөсөн", color: "#0F81CA" },
  live:     { label: "LIVE",       color: "#EF2C58" },
  ended:    { label: "Дууссан",    color: "#666666" },
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
    type: "event", color: "", recurring: "none",
  });

  const showFlash = (msg: string) => { setFlash(msg); setTimeout(() => setFlash(""), 3000); };

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/events");
      const data = await res.json();
      if (res.ok) setEvents(data.events || []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const resetForm = () => {
    setForm({ title: "", description: "", image: "", date: "", endDate: "", liveLink: "", location: "", status: "upcoming", type: "event", color: "", recurring: "none" });
    setEditingId(null);
    setShowForm(false);
  };

  const openFormForDate = (date: Date) => {
    const d = new Date(date);
    d.setHours(10, 0, 0, 0);
    const end = new Date(d);
    end.setHours(12, 0, 0, 0);
    resetForm();
    setForm(f => ({ ...f, date: toLocal(d.toISOString()), endDate: toLocal(end.toISOString()) }));
    setShowForm(true);
    setSelectedEvent(null);
  };

  const startEdit = (ev: CalEvent) => {
    setForm({
      title: ev.title, description: ev.description, image: ev.image,
      date: toLocal(ev.date), endDate: ev.endDate ? toLocal(ev.endDate) : "",
      liveLink: ev.liveLink, location: ev.location, status: ev.status,
      type: ev.type || "event", color: ev.color || "", recurring: ev.recurring || "none",
    });
    setEditingId(ev._id);
    setShowForm(true);
    setSelectedEvent(null);
  };

  const handleSave = async () => {
    if (!form.title || !form.date) { showFlash("Гарчиг болон огноо шаардлагатай"); return; }
    setSaving(true);
    try {
      const url = editingId ? `/api/admin/events/${editingId}` : "/api/admin/events";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
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

  // ─── Loading ───
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#EF2C58] border-t-transparent" />
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
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-[4px] bg-[#1A1A1A] border border-[rgba(255,255,255,0.08)] px-4 py-2.5 shadow-xl">
          <svg className="h-4 w-4 text-[#EF2C58] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          <span className="text-[13px] text-[#E8E8E8]">{flash}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#E8E8E8]">Календар</h1>
          <p className="mt-0.5 text-[12px] text-[#555555]">Хичээл, эвент, live хуваарь</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { resetForm(); setShowForm(!showForm); setSelectedEvent(null); }}
            className="rounded-[4px] bg-[#EF2C58] px-4 py-2 text-[12px] font-bold text-white transition hover:bg-[#D4264E]">
            {showForm ? "Цуцлах" : "+ Шинэ хуваарь"}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Энэ сар", value: thisMonthCount, color: "text-[#E8E8E8]" },
          { label: "Төлөвлөсөн", value: upcomingCount, color: "text-[#0F81CA]" },
          { label: "LIVE", value: liveCount, color: "text-[#EF2C58]" },
        ].map(s => (
          <div key={s.label} className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-[#555555]">{s.label}</div>
            <div className={`mt-0.5 text-xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Controls: View Mode + Navigation + Type Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-1">
          {(["month", "week", "list"] as ViewMode[]).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`rounded-[4px] px-3 py-1.5 text-[11px] font-semibold transition ${view === v ? "bg-[#EF2C58] text-white" : "text-[#666666] hover:text-[#999999]"}`}>
              {v === "month" ? "Сар" : v === "week" ? "7 хоног" : "Жагсаалт"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="rounded-[4px] border border-[rgba(255,255,255,0.08)] p-1.5 text-[#666666] transition hover:text-[#E8E8E8]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={goToday} className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[11px] font-semibold text-[#666666] transition hover:text-[#EF2C58] hover:border-[rgba(239,44,88,0.3)]">
            Өнөөдөр
          </button>
          <span className="min-w-[140px] text-center text-[14px] font-bold text-[#E8E8E8]">
            {year} {MN_MONTHS[month]}
          </span>
          <button onClick={() => navigate(1)} className="rounded-[4px] border border-[rgba(255,255,255,0.08)] p-1.5 text-[#666666] transition hover:text-[#E8E8E8]">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => setTypeFilter("all")}
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${typeFilter === "all" ? "bg-[rgba(255,255,255,0.12)] text-[#E8E8E8]" : "text-[#555555] hover:text-[#999999]"}`}>
            Бүгд
          </button>
          {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
            <button key={key} onClick={() => setTypeFilter(key)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${typeFilter === key ? "text-white" : "text-[#555555] hover:text-[#999999]"}`}
              style={typeFilter === key ? { background: cfg.bg, color: cfg.color } : {}}>
              {cfg.label}
            </button>
          ))}
        </div>
      </div>

      {/* Event form */}
      {showForm && (
        <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-5">
          <h2 className="mb-4 text-[14px] font-bold text-[#E8E8E8]">
            {editingId ? "Хуваарь засах" : "Шинэ хуваарь"}
          </h2>
          <div className="space-y-3">
            {/* Type selector */}
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-[0.5px] text-[#555555]">Төрөл</label>
              <div className="flex flex-wrap gap-2">
                {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
                  <button key={key} type="button" onClick={() => setForm(f => ({ ...f, type: key }))}
                    className={`flex items-center gap-1.5 rounded-[4px] px-3 py-2 text-[11px] font-semibold transition ${form.type === key ? "border-2" : "border border-[rgba(255,255,255,0.08)] text-[#666666] hover:text-[#999999]"}`}
                    style={form.type === key ? { borderColor: cfg.color, background: cfg.bg, color: cfg.color } : {}}>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={cfg.icon} /></svg>
                    {cfg.label}
                  </button>
                ))}
              </div>
            </div>

            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Гарчиг *" maxLength={200}
              className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444444] outline-none transition focus:border-[#EF2C58]" />

            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Тайлбар" rows={2} maxLength={2000}
              className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444444] outline-none transition focus:border-[#EF2C58] resize-none" />

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.5px] text-[#555555]">Эхлэх *</label>
                <input type="datetime-local" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] outline-none transition focus:border-[#EF2C58]" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.5px] text-[#555555]">Дуусах</label>
                <input type="datetime-local" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] outline-none transition focus:border-[#EF2C58]" />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.5px] text-[#555555]">Live линк</label>
                <input value={form.liveLink} onChange={e => setForm(f => ({ ...f, liveLink: e.target.value }))}
                  placeholder="https://zoom.us/j/..."
                  className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444444] outline-none transition focus:border-[#EF2C58]" />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.5px] text-[#555555]">Байршил</label>
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="Онлайн / Хаяг"
                  className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#444444] outline-none transition focus:border-[#EF2C58]" />
              </div>
            </div>

            {/* Recurring */}
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.5px] text-[#555555]">Давталт</label>
              <div className="flex gap-2">
                {([["none", "Нэг удаа"], ["daily", "Өдөр бүр"], ["weekly", "7 хоног бүр"], ["monthly", "Сар бүр"]] as const).map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setForm(f => ({ ...f, recurring: k }))}
                    className={`rounded-[4px] px-3 py-1.5 text-[11px] font-semibold transition ${form.recurring === k ? "bg-[rgba(239,44,88,0.15)] text-[#EF2C58] border border-[#EF2C58]" : "border border-[rgba(255,255,255,0.08)] text-[#666666] hover:text-[#999999]"}`}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Status (edit only) */}
            {editingId && (
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.5px] text-[#555555]">Статус</label>
                <div className="flex gap-2">
                  {(["upcoming", "live", "ended"] as const).map(s => (
                    <button key={s} type="button" onClick={() => setForm(f => ({ ...f, status: s }))}
                      className={`rounded-[4px] px-3 py-1.5 text-[11px] font-semibold transition ${form.status === s ? "border border-current" : "border border-[rgba(255,255,255,0.08)] text-[#666666] hover:text-[#999999]"}`}
                      style={form.status === s ? { color: STATUS_CONFIG[s].color, background: `${STATUS_CONFIG[s].color}15` } : {}}>
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={handleSave} disabled={saving || !form.title || !form.date}
                className="rounded-[4px] bg-[#EF2C58] px-5 py-2.5 text-[12px] font-bold text-white transition hover:bg-[#D4264E] disabled:opacity-40">
                {saving ? "..." : editingId ? "Хадгалах" : "Үүсгэх"}
              </button>
              <button onClick={resetForm}
                className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-4 py-2 text-[12px] text-[#666666] transition hover:text-[#999999]">
                Цуцлах
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        {/* Calendar / List */}
        <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] overflow-hidden">
          {/* Month View */}
          {view === "month" && (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 border-b border-[rgba(255,255,255,0.06)]">
                {MN_DAYS_SHORT.map(d => (
                  <div key={d} className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-[#555555]">{d}</div>
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
                      className={`relative min-h-[80px] border-b border-r border-[rgba(255,255,255,0.04)] p-1 text-left transition hover:bg-[rgba(255,255,255,0.03)] ${!day.inMonth ? "opacity-30" : ""} ${isSelected ? "bg-[rgba(239,44,88,0.06)]" : ""}`}>
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${isToday ? "bg-[#EF2C58] text-white" : "text-[#888888]"}`}>
                        {day.date.getDate()}
                      </span>
                      <div className="mt-0.5 space-y-0.5">
                        {dayEvents.slice(0, 3).map(ev => {
                          const cfg = TYPE_CONFIG[ev.type || "event"] || TYPE_CONFIG.event;
                          return (
                            <div key={ev._id} onClick={(e) => { e.stopPropagation(); setSelectedEvent(ev); setSelectedDate(day.date); }}
                              className="flex items-center gap-1 rounded-[3px] px-1 py-0.5 text-[9px] font-semibold leading-tight truncate cursor-pointer transition hover:brightness-125"
                              style={{ background: cfg.bg, color: cfg.color }}>
                              {ev.status === "live" && <span className="h-1.5 w-1.5 rounded-full bg-[#EF2C58] animate-pulse shrink-0" />}
                              <span className="truncate">{ev.title}</span>
                            </div>
                          );
                        })}
                        {dayEvents.length > 3 && (
                          <div className="px-1 text-[8px] font-bold text-[#555555]">+{dayEvents.length - 3}</div>
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
                    <div key={i} className={`py-3 text-center ${isToday ? "bg-[rgba(239,44,88,0.06)]" : ""}`}>
                      <div className="text-[10px] font-bold uppercase text-[#555555]">{MN_DAYS_SHORT[i]}</div>
                      <div className={`mt-0.5 text-[16px] font-bold ${isToday ? "text-[#EF2C58]" : "text-[#888888]"}`}>{d.getDate()}</div>
                    </div>
                  );
                })}
              </div>
              <div className="grid grid-cols-7 min-h-[400px]">
                {weekDays.map((d, i) => {
                  const dayEvents = eventsForDate(d);
                  const isToday = isSameDay(d, today);
                  return (
                    <div key={i} className={`border-r border-[rgba(255,255,255,0.04)] p-2 space-y-1 ${isToday ? "bg-[rgba(239,44,88,0.03)]" : ""}`}
                      onDoubleClick={() => openFormForDate(d)}>
                      {dayEvents.map(ev => {
                        const cfg = TYPE_CONFIG[ev.type || "event"] || TYPE_CONFIG.event;
                        const time = new Date(ev.date).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" });
                        return (
                          <button key={ev._id} onClick={() => { setSelectedEvent(ev); setSelectedDate(d); }}
                            className="w-full rounded-[4px] p-2 text-left transition hover:brightness-125"
                            style={{ background: cfg.bg }}>
                            <div className="flex items-center gap-1">
                              {ev.status === "live" && <span className="h-1.5 w-1.5 rounded-full bg-[#EF2C58] animate-pulse shrink-0" />}
                              <span className="text-[9px] font-bold" style={{ color: cfg.color }}>{time}</span>
                            </div>
                            <div className="text-[10px] font-semibold text-[#E8E8E8] truncate mt-0.5">{ev.title}</div>
                          </button>
                        );
                      })}
                      {dayEvents.length === 0 && (
                        <div className="flex h-full items-center justify-center text-[10px] text-[#333333]">---</div>
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
                <div className="py-16 text-center text-[13px] text-[#555555]">Хуваарь байхгүй</div>
              ) : (
                filteredEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(ev => {
                  const cfg = TYPE_CONFIG[ev.type || "event"] || TYPE_CONFIG.event;
                  const st = STATUS_CONFIG[ev.status] || STATUS_CONFIG.upcoming;
                  const isPast = new Date(ev.date) < today;
                  return (
                    <div key={ev._id} className={`flex items-center gap-3 p-4 transition hover:bg-[rgba(255,255,255,0.02)] ${isPast ? "opacity-50" : ""}`}>
                      {/* Date badge */}
                      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[4px] border border-[rgba(255,255,255,0.08)]">
                        <span className="text-[10px] font-bold uppercase text-[#555555]">{MN_MONTHS[new Date(ev.date).getMonth()]}</span>
                        <span className="text-[16px] font-bold text-[#E8E8E8]">{new Date(ev.date).getDate()}</span>
                      </div>
                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                          <span className="rounded-full px-2 py-0.5 text-[9px] font-bold" style={{ color: st.color, background: `${st.color}15` }}>{st.label}</span>
                          {ev.status === "live" && <span className="h-2 w-2 rounded-full bg-[#EF2C58] animate-pulse" />}
                        </div>
                        <div className="text-[13px] font-bold text-[#E8E8E8] truncate">{ev.title}</div>
                        <div className="text-[11px] text-[#555555]">
                          {fmt(ev.date)}
                          {ev.location && <span> · {ev.location}</span>}
                          {ev.attendees?.length > 0 && <span> · {ev.attendees.length} оролцогч</span>}
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="flex shrink-0 items-center gap-1">
                        {ev.liveLink && (
                          <a href={ev.liveLink} target="_blank" rel="noopener noreferrer"
                            className="rounded-[4px] bg-[rgba(239,44,88,0.1)] px-2.5 py-1.5 text-[10px] font-bold text-[#EF2C58] transition hover:bg-[rgba(239,44,88,0.2)]">
                            Нэгдэх
                          </a>
                        )}
                        {ev.status !== "live" && ev.status !== "ended" && (
                          <button onClick={() => handleStatusChange(ev._id, "live")}
                            className="rounded-[4px] bg-[rgba(239,44,88,0.1)] px-2 py-1.5 text-[10px] font-bold text-[#EF2C58] transition hover:bg-[rgba(239,44,88,0.2)]">
                            LIVE
                          </button>
                        )}
                        {ev.status === "live" && (
                          <button onClick={() => handleStatusChange(ev._id, "ended")}
                            className="rounded-[4px] bg-[rgba(102,102,102,0.1)] px-2 py-1.5 text-[10px] font-bold text-[#666666] transition hover:bg-[rgba(102,102,102,0.2)]">
                            Дуусгах
                          </button>
                        )}
                        <button onClick={() => startEdit(ev)}
                          className="rounded-[4px] p-1.5 text-[#555555] transition hover:text-[#E8E8E8]">
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        <button onClick={() => handleDelete(ev._id)}
                          className="rounded-[4px] p-1.5 text-red-400/50 transition hover:text-red-400">
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
            <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                    style={{ background: (TYPE_CONFIG[selectedEvent.type || "event"] || TYPE_CONFIG.event).bg, color: (TYPE_CONFIG[selectedEvent.type || "event"] || TYPE_CONFIG.event).color }}>
                    {(TYPE_CONFIG[selectedEvent.type || "event"] || TYPE_CONFIG.event).label}
                  </span>
                  <h3 className="mt-2 text-[15px] font-bold text-[#E8E8E8]">{selectedEvent.title}</h3>
                </div>
                <button onClick={() => setSelectedEvent(null)} className="text-[#555555] hover:text-[#999999]">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {selectedEvent.description && (
                <p className="mb-3 text-[12px] leading-relaxed text-[#888888]">{selectedEvent.description}</p>
              )}

              <div className="space-y-2 text-[11px]">
                <div className="flex items-center gap-2 text-[#888888]">
                  <svg className="h-3.5 w-3.5 text-[#555555]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  {fmt(selectedEvent.date)}
                  {selectedEvent.endDate && <span>- {fmt(selectedEvent.endDate)}</span>}
                </div>
                {selectedEvent.location && (
                  <div className="flex items-center gap-2 text-[#888888]">
                    <svg className="h-3.5 w-3.5 text-[#555555]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                    {selectedEvent.location}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="rounded-full px-2 py-0.5 text-[9px] font-bold"
                    style={{ color: STATUS_CONFIG[selectedEvent.status]?.color, background: `${STATUS_CONFIG[selectedEvent.status]?.color}15` }}>
                    {STATUS_CONFIG[selectedEvent.status]?.label}
                  </span>
                  {selectedEvent.attendees?.length > 0 && (
                    <span className="text-[#555555]">{selectedEvent.attendees.length} оролцогч</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-4 flex flex-wrap gap-2">
                {selectedEvent.liveLink && (
                  <a href={selectedEvent.liveLink} target="_blank" rel="noopener noreferrer"
                    className="rounded-[4px] bg-[#EF2C58] px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-[#D4264E]">
                    Live нэгдэх
                  </a>
                )}
                {selectedEvent.status !== "live" && selectedEvent.status !== "ended" && (
                  <button onClick={() => { handleStatusChange(selectedEvent._id, "live"); setSelectedEvent({ ...selectedEvent, status: "live" }); }}
                    className="rounded-[4px] bg-[rgba(239,44,88,0.15)] px-3 py-1.5 text-[11px] font-bold text-[#EF2C58]">
                    LIVE эхлүүлэх
                  </button>
                )}
                {selectedEvent.status === "live" && (
                  <button onClick={() => { handleStatusChange(selectedEvent._id, "ended"); setSelectedEvent({ ...selectedEvent, status: "ended" }); }}
                    className="rounded-[4px] bg-[rgba(102,102,102,0.15)] px-3 py-1.5 text-[11px] font-bold text-[#666666]">
                    Дуусгах
                  </button>
                )}
                <button onClick={() => startEdit(selectedEvent)}
                  className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-[11px] font-bold text-[#888888] transition hover:text-[#E8E8E8]">
                  Засах
                </button>
                <button onClick={() => handleDelete(selectedEvent._id)}
                  className="rounded-[4px] border border-[rgba(239,68,68,0.2)] px-3 py-1.5 text-[11px] font-bold text-red-400/70 transition hover:text-red-400">
                  Устгах
                </button>
              </div>
            </div>
          )}

          {/* Selected date events */}
          {selectedDate && !selectedEvent && (
            <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[13px] font-bold text-[#E8E8E8]">
                  {selectedDate.toLocaleDateString("mn-MN", { month: "long", day: "numeric", weekday: "long" })}
                </h3>
                <button onClick={() => openFormForDate(selectedDate)}
                  className="rounded-[4px] bg-[#EF2C58] px-2.5 py-1 text-[10px] font-bold text-white transition hover:bg-[#D4264E]">
                  + Нэмэх
                </button>
              </div>
              {eventsForDate(selectedDate).length === 0 ? (
                <p className="text-[12px] text-[#555555]">Хуваарь байхгүй</p>
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
                          {ev.status === "live" && <span className="h-2 w-2 rounded-full bg-[#EF2C58] animate-pulse" />}
                          <span className="text-[10px] font-bold" style={{ color: cfg.color }}>{time} · {cfg.label}</span>
                        </div>
                        <div className="text-[12px] font-semibold text-[#E8E8E8] mt-1">{ev.title}</div>
                        {ev.location && <div className="text-[10px] text-[#666666] mt-0.5">{ev.location}</div>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Upcoming schedule */}
          <div className="rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#141414] p-4">
            <h3 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#EF2C58]">Удахгүй болох</h3>
            {upcomingEvents.length === 0 ? (
              <p className="text-[12px] text-[#555555]">Төлөвлөсөн хуваарь байхгүй</p>
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
                        <div className="flex items-center gap-1.5 text-[10px] text-[#555555]">
                          {ev.status === "live" && <span className="h-1.5 w-1.5 rounded-full bg-[#EF2C58] animate-pulse" />}
                          <span style={ev.status === "live" ? { color: "#EF2C58", fontWeight: 700 } : {}}>{timeLabel}</span>
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
