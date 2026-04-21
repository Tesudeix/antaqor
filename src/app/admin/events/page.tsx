"use client";

import { useEffect, useState } from "react";

interface Attendee {
  _id: string;
  name: string;
  email: string;
}

interface EventData {
  _id: string;
  title: string;
  description: string;
  image: string;
  date: string;
  endDate: string;
  liveLink: string;
  location: string;
  status: "upcoming" | "live" | "ended";
  attendees: Attendee[];
  createdAt: string;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  upcoming: { label: "Төлөвлөсөн", color: "text-blue-400 bg-blue-400/10" },
  live: { label: "LIVE", color: "text-green-400 bg-green-400/10" },
  ended: { label: "Дууссан", color: "text-[#999999] bg-[#999999]/10" },
};

function formatDate(d: string) {
  return new Date(d).toLocaleString("mn-MN", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function toLocalDatetime(d: string) {
  const date = new Date(d);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

export default function AdminEventsPage() {
  const [events, setEvents] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    image: "",
    date: "",
    endDate: "",
    liveLink: "",
    location: "",
    status: "upcoming" as string,
  });

  const fetchEvents = async () => {
    try {
      const res = await fetch("/api/admin/events");
      const data = await res.json();
      if (res.ok) setEvents(data.events);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 3000);
  };

  const resetForm = () => {
    setForm({ title: "", description: "", image: "", date: "", endDate: "", liveLink: "", location: "", status: "upcoming" });
    setEditingId(null);
    setShowForm(false);
  };

  const startEdit = (ev: EventData) => {
    setForm({
      title: ev.title,
      description: ev.description,
      image: ev.image,
      date: toLocalDatetime(ev.date),
      endDate: ev.endDate ? toLocalDatetime(ev.endDate) : "",
      liveLink: ev.liveLink,
      location: ev.location,
      status: ev.status,
    });
    setEditingId(ev._id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.date) {
      showFlash("Гарчиг болон огноо заавал шаардлагатай");
      return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/api/admin/events/${editingId}` : "/api/admin/events";
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        showFlash(editingId ? "Эвент шинэчлэгдлээ" : "Эвент үүслээ");
        resetForm();
        fetchEvents();
      } else {
        const data = await res.json();
        showFlash(data.error || "Алдаа гарлаа");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Энэ эвентийг устгах уу?")) return;
    const res = await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
    if (res.ok) {
      showFlash("Эвент устгагдлаа");
      fetchEvents();
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    const res = await fetch(`/api/admin/events/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      showFlash(`Статус: ${STATUS_MAP[status]?.label}`);
      fetchEvents();
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-6 w-6 animate-spin border-2 border-[#EF2C58] border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-[2px] text-[#E8E8E8]">Эвентүүд</h1>
          <p className="mt-1 text-[11px] text-[#999999]">{events.length} эвент</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="rounded-[4px] bg-[#EF2C58] px-5 py-2 text-[12px] font-semibold text-white transition hover:bg-[#D4264E]"
        >
          {showForm ? "Цуцлах" : "+ Шинэ эвент"}
        </button>
      </div>

      {flash && (
        <div className="mb-4 border-l-2 border-[#EF2C58] bg-[rgba(239,44,88,0.05)] px-4 py-3 text-[12px] text-[#EF2C58]">
          {flash}
        </div>
      )}

      {/* Create/Edit Form */}
      {showForm && (
        <div className="card mb-6 p-5 md:p-6">
          <h2 className="mb-4 text-[14px] font-semibold text-[#E8E8E8]">
            {editingId ? "Эвент засах" : "Шинэ эвент"}
          </h2>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.5px] text-[#999999]">Гарчиг *</label>
              <input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className="input-dark"
                placeholder="Эвентийн нэр"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.5px] text-[#999999]">Тайлбар</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                rows={3}
                className="input-dark resize-none"
                placeholder="Эвентийн тайлбар"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.5px] text-[#999999]">Эхлэх огноо *</label>
                <input
                  type="datetime-local"
                  value={form.date}
                  onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
                  className="input-dark"
                />
              </div>
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.5px] text-[#999999]">Дуусах огноо</label>
                <input
                  type="datetime-local"
                  value={form.endDate}
                  onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
                  className="input-dark"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.5px] text-[#999999]">Live линк (Zoom, YouTube, гэх мэт)</label>
              <input
                value={form.liveLink}
                onChange={(e) => setForm((p) => ({ ...p, liveLink: e.target.value }))}
                className="input-dark"
                placeholder="https://zoom.us/j/... эсвэл YouTube live линк"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.5px] text-[#999999]">Байршил</label>
              <input
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                className="input-dark"
                placeholder="Онлайн / Байршлын хаяг"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] uppercase tracking-[0.5px] text-[#999999]">Зураг URL</label>
              <input
                value={form.image}
                onChange={(e) => setForm((p) => ({ ...p, image: e.target.value }))}
                className="input-dark"
                placeholder="https://..."
              />
            </div>
            {editingId && (
              <div>
                <label className="mb-1 block text-[10px] uppercase tracking-[0.5px] text-[#999999]">Статус</label>
                <div className="flex gap-2">
                  {(["upcoming", "live", "ended"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, status: s }))}
                      className={`rounded-[4px] px-3 py-1.5 text-[11px] font-semibold transition ${
                        form.status === s
                          ? STATUS_MAP[s].color + " border border-current"
                          : "text-[#999999] border border-[rgba(255,255,255,0.08)] hover:text-[#CCCCCC]"
                      }`}
                    >
                      {STATUS_MAP[s].label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-[4px] bg-[#EF2C58] px-5 py-2 text-[12px] font-semibold text-white transition hover:bg-[#D4264E] disabled:opacity-50"
              >
                {saving ? "..." : editingId ? "Хадгалах" : "Үүсгэх"}
              </button>
              <button
                onClick={resetForm}
                className="rounded-[4px] border border-[rgba(255,255,255,0.08)] px-4 py-2 text-[12px] font-medium text-[#888888] transition hover:text-[#F8F8F6]"
              >
                Цуцлах
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Events List */}
      {events.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-[14px] text-[#999999]">Эвент байхгүй</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => {
            const st = STATUS_MAP[ev.status] || STATUS_MAP.upcoming;
            const isExpanded = expandedId === ev._id;
            return (
              <div key={ev._id} className="card overflow-hidden">
                <div className="flex items-center justify-between p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-[4px] px-2 py-0.5 text-[10px] font-bold ${st.color}`}>
                        {st.label}
                      </span>
                      <h3 className="truncate text-[14px] font-semibold text-[#E8E8E8]">{ev.title}</h3>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-[#999999]">
                      <span>{formatDate(ev.date)}</span>
                      {ev.location && <span>· {ev.location}</span>}
                      <span>· {ev.attendees.length} оролцогч</span>
                      {ev.liveLink && (
                        <a href={ev.liveLink} target="_blank" rel="noopener noreferrer" className="text-[#EF2C58] hover:text-[#D4264E]">
                          Live линк →
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {ev.status !== "live" && (
                      <button
                        onClick={() => handleStatusChange(ev._id, "live")}
                        className="rounded-[4px] bg-green-500/10 px-3 py-1.5 text-[10px] font-bold text-green-400 transition hover:bg-green-500/20"
                      >
                        LIVE
                      </button>
                    )}
                    {ev.status === "live" && (
                      <button
                        onClick={() => handleStatusChange(ev._id, "ended")}
                        className="rounded-[4px] bg-[#999999]/10 px-3 py-1.5 text-[10px] font-bold text-[#999999] transition hover:bg-[#999999]/20"
                      >
                        Дуусгах
                      </button>
                    )}
                    <button
                      onClick={() => startEdit(ev)}
                      className="rounded-[4px] p-2 text-[#999999] transition hover:text-[#E8E8E8]"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : ev._id)}
                      className="rounded-[4px] p-2 text-[#999999] transition hover:text-[#E8E8E8]"
                    >
                      <svg className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDelete(ev._id)}
                      className="rounded-[4px] p-2 text-red-400/60 transition hover:text-red-400"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-[rgba(255,255,255,0.08)] px-4 py-3">
                    {ev.description && (
                      <p className="mb-3 text-[13px] leading-relaxed text-[#888888]">{ev.description}</p>
                    )}
                    {ev.image && (
                      <img src={ev.image} alt={ev.title} className="mb-3 max-h-40 rounded-[4px] object-cover" />
                    )}
                    {ev.endDate && (
                      <p className="mb-2 text-[11px] text-[#999999]">Дуусах: {formatDate(ev.endDate)}</p>
                    )}
                    {ev.attendees.length > 0 && (
                      <div>
                        <p className="mb-1 text-[10px] uppercase tracking-[0.5px] text-[#999999]">Оролцогчид ({ev.attendees.length})</p>
                        <div className="flex flex-wrap gap-1">
                          {ev.attendees.map((a) => (
                            <span key={a._id} className="rounded-[4px] bg-[rgba(0,0,0,0.08)] px-2 py-1 text-[11px] text-[#888888]">
                              {a.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
