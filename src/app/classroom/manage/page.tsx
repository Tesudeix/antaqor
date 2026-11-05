"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "@/components/Icon";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useMembership } from "@/lib/useMembership";
import { motion, AnimatePresence } from "framer-motion";
import PaywallGate from "@/components/PaywallGate";

const NEON = "var(--accent-ink, #2E29FF)";
const NEON_GLOW_SOFT = "none";

interface Course {
  _id: string;
  title: string;
  description: string;
  thumbnail: string;
  lessonsCount: number;
  completedLessons?: number;
  category?: string;
  totalDurationSec?: number;
  requiredLevel?: number;
  createdAt: string;
}

interface CalEvent {
  _id: string;
  title: string;
  type: string;
  date: string;
  endDate: string;
  liveLink: string;
  location: string;
  status: "upcoming" | "live" | "ended";
}

function gradientFor(seed: string) {
  const hash = Array.from(seed).reduce((a, c) => a + c.charCodeAt(0), 0);
  return `linear-gradient(${hash % 360}deg, #dde3ea 0%, #ffffff 80%)`;
}

const MN_MONTHS_SHORT = ["1-р", "2-р", "3-р", "4-р", "5-р", "6-р", "7-р", "8-р", "9-р", "10-р", "11-р", "12-р"];
const MN_DAYS_SHORT = ["Ня", "Да", "Мя", "Лх", "Пү", "Ба", "Бя"];

const EVENT_TYPE_LABEL: Record<string, string> = {
  live: "LIVE",
  class: "Хичээл",
  workshop: "Воркшоп",
  challenge: "Challenge",
  mentor: "Mentor",
  event: "Эвент",
  deadline: "Дедлайн",
};

function formatTime(s: string) {
  return new Date(s).toLocaleTimeString("mn-MN", { hour: "2-digit", minute: "2-digit" });
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function dayLabel(d: Date) {
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  if (sameDay(d, today)) return "ӨНӨӨДӨР";
  if (sameDay(d, tomorrow)) return "МАРГААШ";
  return `${MN_MONTHS_SHORT[d.getMonth()]} сар ${d.getDate()} · ${MN_DAYS_SHORT[d.getDay()]}`;
}

// ─── Learning Timeline — events grouped by day, LIVE pinned ─────────────
function LearningTimeline({ events }: { events: CalEvent[] }) {
  const upcoming = useMemo(() => {
    const cutoff = Date.now() - 60 * 60 * 1000;
    return events
      .filter((e) => e.status !== "ended" && +new Date(e.date) >= cutoff)
      .sort((a, b) => +new Date(a.date) - +new Date(b.date))
      .slice(0, 8);
  }, [events]);

  const live = upcoming.filter((e) => e.status === "live");
  const queued = upcoming.filter((e) => e.status !== "live");

  const groups = useMemo(() => {
    const byDay = new Map<string, CalEvent[]>();
    for (const ev of queued) {
      const d = new Date(ev.date);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key)!.push(ev);
    }
    return Array.from(byDay.entries());
  }, [queued]);

  if (upcoming.length === 0) return null;

  return (
    <div className="mb-7">
      <div className="mb-3 flex items-center gap-2">
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full"
          style={{ background: NEON, boxShadow: "none" }}
        />
        <span className="text-[10px] font-black uppercase tracking-[0.25em]" style={{ color: NEON }}>УДАХГҮЙ</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#E2E4E8]">·</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#E2E4E8]">{upcoming.length} ЭВЕНТ</span>
      </div>

      {/* LIVE pin */}
      {live.length > 0 && (
        <div className="mb-3 space-y-2">
          {live.map((ev) => (
            <div
              key={ev._id}
              className="flex items-center gap-3 rounded-[4px] border p-3"
              style={{
                borderColor: "rgba(0,0,0,0.16)",
                background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, #FFFFFF 70%)",
              }}
            >
              <span
                className="flex shrink-0 items-center gap-1.5 rounded-[4px] px-2 py-1 text-[11px] font-black tracking-wider text-white"
                style={{ background: NEON, boxShadow: NEON_GLOW_SOFT }}
              >
                <span className="h-1 w-1 animate-pulse rounded-full bg-black" />
                LIVE
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[14px] font-black text-[#0e1726]">{ev.title}</div>
                <div className="truncate text-[11px] text-[#E2E4E8]">
                  {formatTime(ev.date)}{ev.location && <> · {ev.location}</>}
                </div>
              </div>
              {ev.liveLink && (
                <a
                  href={ev.liveLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-[4px] px-3 py-1.5 text-[11px] font-black text-white transition hover:opacity-90"
                  style={{ background: NEON, boxShadow: NEON_GLOW_SOFT }}
                >
                  Нэгдэх →
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Day groups */}
      {groups.length > 0 && (
        <div className="overflow-hidden rounded-[4px] border border-[rgba(15,23,38,0.10)] bg-black">
          {groups.map(([key, evs], gi) => {
            const d = new Date(evs[0].date);
            const label = dayLabel(d);
            const isToday = sameDay(d, new Date());
            return (
              <div key={key} className={gi > 0 ? "border-t border-[rgba(15,23,38,0.08)]" : ""}>
                <div className="flex items-baseline justify-between px-3 pb-1.5 pt-2.5 sm:px-4">
                  <span
                    className="text-[10px] font-black uppercase tracking-[0.2em]"
                    style={isToday ? { color: NEON } : { color: "var(--t-body, #30333F)" }}
                  >
                    {label}
                  </span>
                  <span className="text-[10px] tabular-nums text-[#E2E4E8]">{evs.length}</span>
                </div>
                <div className="divide-y divide-[rgba(15,23,38,0.08)]">
                  {evs.map((ev) => (
                    <Link
                      key={ev._id}
                      href={`/calendar`}
                      className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-[rgba(15,23,38,0.05)] sm:px-4"
                    >
                      <span
                        className="w-[46px] shrink-0 text-[12px] font-black tabular-nums"
                        style={{ color: NEON, textShadow: NEON_GLOW_SOFT }}
                      >
                        {formatTime(ev.date)}
                      </span>
                      <span className="rounded-[4px] bg-[rgba(15,23,38,0.08)] px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#52525B]">
                        {EVENT_TYPE_LABEL[ev.type] || "Эвент"}
                      </span>
                      <div className="min-w-0 flex-1 truncate text-[12px] font-bold text-[#0e1726]">
                        {ev.title}
                      </div>
                      <Icon name="chevron" className="h-3 w-3 shrink-0 text-[#E2E4E8]" />
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Link
        href="/calendar"
        className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold transition hover:translate-x-[1px]"
        style={{ color: NEON }}
      >
        Бүх хуваарь үзэх →
      </Link>
    </div>
  );
}

export default function ClassroomPageWrapper() {
  return (
    <PaywallGate>
      <ClassroomPage />
    </PaywallGate>
  );
}

function ClassroomPage() {
  const { data: session } = useSession();
  const { isAdmin: admin } = useMembership();
  const [courses, setCourses] = useState<Course[]>([]);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("");
  const [showCreate, setShowCreate] = useState(false);

  // ─── Editable meta (title + description) ───
  // Pulled from /api/classroom/meta on mount; admin can click-to-edit inline.
  const [meta, setMeta] = useState<{ title: string; description: string }>({
    title: "Сургалт",
    description: "Эвент · хичээл — нэг газар",
  });
  const refreshMeta = async () => {
    try {
      const r = await fetch("/api/classroom/meta", { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        if (typeof d.title === "string" && typeof d.description === "string") {
          setMeta({ title: d.title, description: d.description });
        }
      }
    } catch { /* keep defaults */ }
  };

  useEffect(() => {
    refreshMeta();
    if (!session) { setLoading(false); return; }
    fetchCourses();
    fetch("/api/events")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d.events)) setEvents(d.events); })
      .catch(() => {});
  }, [session]);

  const fetchCourses = async () => {
    try {
      const res = await fetch("/api/classroom/courses");
      const data = await res.json();
      if (res.ok) setCourses(data.courses || []);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Энэ курс болон бүх хичээлийг устгах уу?")) return;
    await fetch(`/api/classroom/courses/${id}`, { method: "DELETE" });
    fetchCourses();
  };

  // ─── Reorder mode (admin only) ───
  const [reorderMode, setReorderMode] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  const moveCourse = async (id: string, dir: -1 | 1) => {
    setCourses((cur) => {
      const idx = cur.findIndex((c) => c._id === id);
      if (idx === -1) return cur;
      const target = idx + dir;
      if (target < 0 || target >= cur.length) return cur;
      const next = [...cur];
      [next[idx], next[target]] = [next[target], next[idx]];
      // Persist new order — fire-and-forget; UI is already optimistic
      persistOrder(next.map((c) => c._id));
      return next;
    });
  };

  const persistOrder = async (ids: string[]) => {
    setSavingOrder(true);
    try {
      await fetch("/api/classroom/courses/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
    } finally {
      setSavingOrder(false);
    }
  };

  const cats = useMemo(
    () => Array.from(new Set(courses.map((c) => c.category).filter(Boolean) as string[])).sort(),
    [courses]
  );
  const filtered = useMemo(() => {
    let list = courses;
    if (activeCat) list = list.filter((c) => c.category === activeCat);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.description || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [courses, search, activeCat]);

  return (
    <div className="mx-auto max-w-[1200px] pb-12">
      {/* ─── SKILL.md page header — eyebrow + Handjet + divider ─────── */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#E2E4E8]">
              Classroom
            </span>
          </div>
          <div className="flex items-center gap-2">
            {courses.length > 0 && (
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#E2E4E8]">
                {courses.length} КУРС
              </span>
            )}
            {admin && (
              <>
                <button
                  onClick={() => setReorderMode((v) => !v)}
                  disabled={courses.length < 2}
                  title="Курсуудын дарааллыг солих"
                  className={`inline-flex items-center gap-1.5 rounded-[4px] border px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] transition disabled:opacity-30 ${
                    reorderMode
                      ? "border-[rgba(15,23,38,0.40)] bg-[rgba(23,23,23,0.06)] text-[#0e1726]"
                      : "border-[rgba(15,23,38,0.10)] bg-black text-[#E2E4E8] hover:border-[rgba(0,0,0,0.4)] hover:text-[#0e1726]"
                  }`}
                >
                  <Icon name="menu" className="h-3 w-3" />
                  {reorderMode ? "ДУУССАН" : "ДАРААЛАЛ"}
                </button>
                <button
                  onClick={() => setShowCreate(true)}
                  disabled={reorderMode}
                  className="inline-flex items-center gap-1.5 rounded-[4px] bg-[#2E29FF] px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-white transition hover:shadow-[0_0_18px_rgba(46,41,255,0.4)] disabled:opacity-30"
                >
                  <Icon name="plus" className="h-3 w-3" />
                  + КУРС
                </button>
              </>
            )}
          </div>
        </div>

        {admin ? (
          <ClassroomTitleEditor value={meta.title} onSaved={refreshMeta} />
        ) : (
          <h1
            className="text-[20px] font-bold leading-tight text-[#0e1726] sm:text-[24px]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {meta.title.split(" ").slice(0, -1).join(" ") || meta.title}
            {meta.title.includes(" ") && (
              <> <span className="text-[#0e1726]">{meta.title.split(" ").pop()}</span></>
            )}
            <span className="text-[#0e1726]">.</span>
          </h1>
        )}

        {admin ? (
          <ClassroomDescEditor value={meta.description} onSaved={refreshMeta} reorderMode={reorderMode} savingOrder={savingOrder} />
        ) : (
          <p className="mt-1.5 max-w-[640px] text-[13px] text-[#E2E4E8]">
            {meta.description || "—"}
            {reorderMode && (
              <>
                <span className="text-[#E2E4E8]"> · </span>
                <span className="font-bold text-[#0e1726]">Дараалал засаж байна</span>
                {savingOrder && <span className="ml-1 text-[10px] text-[#E2E4E8]">хадгалж байна…</span>}
              </>
            )}
          </p>
        )}

        {/* minimal divider */}
        <div className="mt-5 h-px w-full bg-[rgba(15,23,38,0.12)]" />
      </div>

      {/* Time-based events — synthesis with calendar */}
      <LearningTimeline events={events} />

      {/* Search — only when there are enough courses to need it */}
      {courses.length > 4 && (
        <div className="relative mb-5">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#E2E4E8]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Курс хайх"
            className="w-full rounded-[4px] border border-[rgba(15,23,38,0.10)] bg-black py-2.5 pl-9 pr-3 text-[14px] text-[#0e1726] placeholder-[#62666F] outline-none transition focus:border-[rgba(0,0,0,0.4)]"
          />
        </div>
      )}

      {/* ─── Two-tier: featured hero + compact grid (SKILL.md hierarchy) ── */}
      {loading ? (
        <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-video animate-pulse rounded-[4px] bg-[rgba(15,23,38,0.08)]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          hasSearch={search !== ""}
          onClear={() => setSearch("")}
          admin={admin}
          onCreate={() => setShowCreate(true)}
        />
      ) : (
        <section>
          <SectionEyebrow label="БҮХ КУРС" sub={`${(reorderMode ? courses : filtered).length} НИЙТ`} />
          {cats.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-1.5">
              <button type="button" onClick={() => setActiveCat("")} className={`rounded-[4px] px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition ${activeCat === "" ? "bg-[rgba(15,23,38,0.14)] text-white" : "border border-[rgba(15,23,38,0.10)] bg-black text-[#E2E4E8] hover:border-[rgba(0,0,0,0.4)] hover:text-[#0e1726]"}`}>Бүгд</button>
              {cats.map((cat) => (
                <button key={cat} type="button" onClick={() => setActiveCat(cat)} className={`rounded-[4px] px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition ${activeCat === cat ? "bg-[rgba(15,23,38,0.14)] text-white" : "border border-[rgba(15,23,38,0.10)] bg-black text-[#E2E4E8] hover:border-[rgba(0,0,0,0.4)] hover:text-[#0e1726]"}`}>{cat}</button>
              ))}
            </div>
          )}
          {/* Product-list density — 2-col mobile, 3-col tablet, 4-col desktop */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-3">
            {(reorderMode ? courses : filtered).map((c, i, arr) => (
              <CourseCard
                key={c._id}
                course={c}
                index={i}
                admin={admin}
                onUpdate={fetchCourses}
                onDelete={handleDelete}
                reorderMode={reorderMode}
                canMoveUp={reorderMode && i > 0}
                canMoveDown={reorderMode && i < arr.length - 1}
                onMoveUp={() => moveCourse(c._id, -1)}
                onMoveDown={() => moveCourse(c._id, 1)}
              />
            ))}
          </div>
        </section>
      )}

      <CreateCourseModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); fetchCourses(); }}
        nextOrder={courses.length}
      />

      {/* ─── Mobile FAB — primary "+ Курс" action in the thumb zone.
            Sits above the global BottomBar (≈56px + safe-area). Hidden on
            md+ since the header button is already visible there. Disabled
            while reorder-mode is on to avoid mixed-state clicks. */}
      {admin && (
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          disabled={reorderMode}
          aria-label="Шинэ курс үүсгэх"
          className="fixed right-4 z-40 flex h-14 w-14 items-center justify-center rounded-[4px] bg-[#2E29FF] text-white transition active:scale-95 disabled:opacity-40 md:hidden"
          style={{
            bottom: "calc(72px + env(safe-area-inset-bottom))",
            boxShadow:
              "0 12px 28px rgba(46,41,255,0.45), 0 0 0 1px rgba(15,23,38,0.06) inset",
          }}
        >
          <Icon name="plus" className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}

// ─── Section eyebrow — SKILL.md mono-tracked label with rotated diamond ─
function SectionEyebrow({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#E2E4E8]">
        {label}
      </span>
      {sub && (
        <>
          <span className="font-mono text-[10px] text-[#E2E4E8]">·</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#E2E4E8]">{sub}</span>
        </>
      )}
    </div>
  );
}

// ─── Featured hero card — wide, bigger thumbnail, description + CTA ──────
// ─── Course card — uniform 16:9 cover, clean meta, no chips ──────────────
function fmtDur(sec?: number): string {
  const m = Math.round((sec || 0) / 60);
  if (m <= 0) return "";
  if (m < 60) return `${m}м`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h}ц ${r}м` : `${h}ц`;
}

function CourseCard({
  course,
  index,
  admin,
  onUpdate,
  onDelete,
  reorderMode = false,
  canMoveUp = false,
  canMoveDown = false,
  onMoveUp,
  onMoveDown,
}: {
  course: Course;
  index: number;
  admin: boolean;
  onUpdate: () => void;
  onDelete: (id: string) => void;
  reorderMode?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const total = course.lessonsCount || 0;
  const done = course.completedLessons || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const isDone = pct === 100;

  // In reorder mode the card is no longer navigable — every tap belongs to
  // the up/down move buttons.
  const wrapperClass = `group block overflow-hidden rounded-[4px] border bg-black transition ${
    reorderMode
      ? "border-[rgba(0,0,0,0.25)] cursor-default"
      : "border-[rgba(15,23,38,0.10)] hover:border-[rgba(0,0,0,0.22)]"
  }`;

  const inner = (
    <>
        {/* Cover — fixed 16:9 aspect, image absolutely fills it */}
        <div
          className="relative aspect-video w-full overflow-hidden bg-black"
          style={!course.thumbnail ? { background: gradientFor(course._id) } : undefined}
        >
          {course.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={course.thumbnail}
              alt={course.title}
              loading={index < 3 ? "eager" : "lazy"}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          )}

          {/* Subtle bottom-edge progress indicator (no bar, no number unless > 0) */}
          {pct > 0 && !isDone && (
            <div className="absolute inset-x-0 bottom-0 h-[3px] bg-[rgba(0,0,0,0.5)]">
              <div
                className="h-full bg-[rgba(15,23,38,0.14)] transition-all duration-700"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}

          {/* Done badge — only when actually finished */}
          {isDone && (
            <div className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-[4px] bg-black/70 px-2 py-1 text-[11px] font-black text-white backdrop-blur-md">
              <Icon name="check" className="h-3 w-3" />
              ДУУССАН
            </div>
          )}

          {/* Admin actions — single hover cluster */}
          {admin && (
            <div className="absolute left-2 top-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
              <CoverEditButton courseId={course._id} onUpdate={onUpdate} />
              <DeleteButton onDelete={() => onDelete(course._id)} />
            </div>
          )}
        </div>

        {/* Body — Handjet pixel-block title + visible description + meta */}
        <div className="p-4">
          <h3 className="line-clamp-2 text-[13px] font-semibold leading-snug tracking-normal text-[#0e1726] transition group-hover:text-[#E2E4E8] sm:text-[15px]">
            {course.title}
          </h3>
          {course.description && (
            <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-[#E2E4E8]">
              {course.description}
            </p>
          )}
          <div className="mt-3 flex items-center justify-between border-t border-[rgba(15,23,38,0.08)] pt-2.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#E2E4E8]">
              {course.category ? `${course.category.toUpperCase()} · ` : ""}{total} ХИЧЭЭЛ{course.totalDurationSec ? ` · ${fmtDur(course.totalDurationSec)}` : ""}{pct > 0 && !isDone ? ` · ${pct}%` : ""}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0e1726] opacity-0 transition group-hover:opacity-100">
              ҮЗЭХ →
            </span>
          </div>
        </div>

        {/* Reorder controls — visible only in reorder mode */}
        {reorderMode && (
          <div className="flex items-center justify-between gap-2 border-t border-[rgba(0,0,0,0.12)] bg-[rgba(0,0,0,0.03)] px-3 py-2">
            <span className="text-[10px] font-black uppercase tracking-[0.15em] text-[#0e1726]">
              #{index + 1}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMoveUp?.(); }}
                disabled={!canMoveUp}
                aria-label="Дээш"
                className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-[rgba(15,23,38,0.10)] bg-black text-[#334155] transition hover:border-[rgba(0,0,0,0.4)] hover:text-[#0e1726] disabled:opacity-30"
              >
                <Icon name="chevronUp" className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMoveDown?.(); }}
                disabled={!canMoveDown}
                aria-label="Доош"
                className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-[rgba(15,23,38,0.10)] bg-black text-[#334155] transition hover:border-[rgba(0,0,0,0.4)] hover:text-[#0e1726] disabled:opacity-30"
              >
                <Icon name="chevronDown" className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.4) }}
    >
      {reorderMode ? (
        <div className={wrapperClass}>{inner}</div>
      ) : (
        <Link href={`/classroom/course/${course._id}`} className={wrapperClass}>
          {inner}
        </Link>
      )}
    </motion.div>
  );
}

// ─── Admin micro-buttons ────────────────────────────────────────────────
function CoverEditButton({ courseId, onUpdate }: { courseId: string; onUpdate: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      const upData = await up.json();
      if (!up.ok || !upData.url) return;
      await fetch(`/api/classroom/courses/${courseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thumbnail: upData.url }),
      });
      onUpdate();
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); fileRef.current?.click(); }}
        disabled={busy}
        title="Cover солих"
        className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-black/70 text-white backdrop-blur-md transition hover:bg-[rgba(15,23,38,0.14)] disabled:opacity-50"
      >
        {busy ? (
          <span className="h-2 w-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <Icon name="edit" className="h-3.5 w-3.5" />
        )}
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
    </>
  );
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete(); }}
      title="Устгах"
      className="flex h-7 w-7 items-center justify-center rounded-[4px] bg-black/70 text-white hover:text-white backdrop-blur-md transition hover:bg-[#2E29FF]"
    >
      <Icon name="trash" className="h-3.5 w-3.5" />
    </button>
  );
}

// ─── Empty state ────────────────────────────────────────────────────────
function EmptyState({
  hasSearch,
  onClear,
  admin,
  onCreate,
}: {
  hasSearch: boolean;
  onClear: () => void;
  admin: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="rounded-[4px] border-2 border-dashed border-[rgba(15,23,38,0.10)] p-12 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[4px] bg-[rgba(0,0,0,0.06)]">
        <Icon name="skills" className="h-5 w-5 text-[#0e1726]" />
      </div>
      <p className="text-[14px] font-bold text-[#0e1726]">
        {hasSearch ? "Хайлтанд тохирох курс олдсонгүй" : "Курс хараахан нэмэгдээгүй"}
      </p>
      <p className="mt-1.5 text-[11px] text-[#E2E4E8]">
        {hasSearch ? "Өөр түлхүүр үг туршаарай" : "Удахгүй шинэ хичээлүүд нэмэгдэнэ"}
      </p>
      {hasSearch ? (
        <button
          onClick={onClear}
          className="mt-4 rounded-[4px] bg-[#2E29FF] px-4 py-2 text-[12px] font-black text-white transition hover:bg-[#1F1AD9]"
        >
          Хайлт арилгах
        </button>
      ) : admin ? (
        <button
          onClick={onCreate}
          className="mt-4 rounded-[4px] bg-[#2E29FF] px-4 py-2 text-[12px] font-black text-white transition hover:bg-[#1F1AD9]"
        >
          + Эхний курс үүсгэх
        </button>
      ) : null}
    </div>
  );
}

// ─── Create course modal ────────────────────────────────────────────────
function CreateCourseModal({
  open, onClose, onCreated, nextOrder,
}: {
  open: boolean; onClose: () => void; onCreated: () => void; nextOrder: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [thumbnail, setThumbnail] = useState("");
  const [reqLevel, setReqLevel] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const handleThumb = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) setThumbnail(data.url);
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!title.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/classroom/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description: desc, thumbnail, order: nextOrder, requiredLevel: reqLevel }),
      });
      if (res.ok) {
        setTitle(""); setDesc(""); setThumbnail(""); setReqLevel(0);
        onCreated();
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
        >
          <motion.div
            initial={{ y: 32 }} animate={{ y: 0 }} exit={{ y: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[520px] max-h-[88vh] overflow-y-auto rounded-t-[4px] border-t border-[rgba(15,23,38,0.10)] bg-black sm:max-h-[85vh] sm:rounded-[4px] sm:border"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[rgba(15,23,38,0.10)] bg-black px-4 py-3">
              <h2 className="text-[14px] font-black text-[#0e1726]">Шинэ курс</h2>
              <button onClick={onClose} aria-label="Хаах" className="flex h-7 w-7 items-center justify-center rounded-[4px] text-[#E2E4E8] transition hover:bg-[rgba(15,23,38,0.08)] hover:text-[#0e1726]">
                <Icon name="cancel" className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 p-4">
              {/* Cover preview / upload — 16:9 to match cards */}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="relative block aspect-video w-full overflow-hidden rounded-[4px] border border-dashed border-[rgba(15,23,38,0.14)] bg-black transition hover:border-[rgba(0,0,0,0.4)]"
                style={!thumbnail ? { background: gradientFor(title || "new") } : undefined}
              >
                {thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 text-white opacity-0 transition hover:opacity-100">
                  <Icon name="edit" className="h-6 w-6" />
                  <span className="mt-1 text-[11px] font-bold">{thumbnail ? "Cover солих" : "Cover нэмэх"}</span>
                </div>
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <div className="h-3 w-3 animate-pulse rounded-full bg-[rgba(15,23,38,0.14)]" />
                  </div>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleThumb} className="hidden" />

              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Курсийн нэр"
                autoFocus
                className="w-full rounded-[4px] border border-[rgba(15,23,38,0.10)] bg-black px-3 py-2.5 text-[14px] text-[#0e1726] placeholder-[#62666F] outline-none transition focus:border-[rgba(0,0,0,0.4)]"
              />
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Тайлбар (заавал биш)"
                rows={2}
                className="w-full resize-y rounded-[4px] border border-[rgba(15,23,38,0.10)] bg-black px-3 py-2.5 text-[13px] text-[#0e1726] placeholder-[#62666F] outline-none transition focus:border-[rgba(0,0,0,0.4)]"
              />

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#E2E4E8]">Шаардах түвшин:</span>
                <input
                  type="number" min={0} max={100}
                  value={reqLevel}
                  onChange={(e) => setReqLevel(parseInt(e.target.value) || 0)}
                  className="w-20 rounded-[4px] border border-[rgba(15,23,38,0.10)] bg-black px-3 py-1.5 text-center text-[12px] text-[#0e1726] outline-none focus:border-[rgba(0,0,0,0.4)]"
                />
              </div>
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[rgba(15,23,38,0.10)] bg-black px-4 py-3">
              <button onClick={onClose} className="text-[12px] font-semibold text-[#E2E4E8] transition hover:text-[#0e1726]">
                Болих
              </button>
              <button
                onClick={submit}
                disabled={!title.trim() || creating}
                className="rounded-[4px] bg-[#2E29FF] px-4 py-2 text-[12px] font-black text-white transition hover:bg-[#1F1AD9] disabled:opacity-40"
              >
                {creating ? "Үүсгэж байна..." : "Үүсгэх"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Inline title editor (admin only) ─────────────────────────────────────
// Same pattern as the course-detail editors: click → input, Enter saves,
// Esc cancels, blur saves if changed. Persists to /api/classroom/meta.
function ClassroomTitleEditor({ value, onSaved }: { value: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(value); }, [value]);
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);

  const save = async () => {
    const next = val.trim();
    if (!next || next === value) { setEditing(false); setVal(value); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/classroom/meta", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (res.ok) { onSaved(); setEditing(false); }
    } finally { setBusy(false); }
  };

  if (editing) {
    return (
      <input
        ref={ref}
        value={val}
        disabled={busy}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); save(); }
          if (e.key === "Escape") { setEditing(false); setVal(value); }
        }}
        maxLength={80}
        className="block w-full rounded-[4px] border border-[rgba(15,23,38,0.40)] bg-black px-2 py-1 text-[20px] font-bold leading-tight text-[#0e1726] outline-none sm:text-[24px]"
      />
    );
  }
  return (
    <h1
      onClick={() => setEditing(true)}
      title="Дарж засах"
      className="group inline-block cursor-text rounded-[4px] text-[20px] font-bold leading-tight text-[#0e1726] transition hover:bg-[rgba(15,23,38,0.06)] sm:text-[24px]"
    >
      {value}
      <Icon name="edit" className="ml-2 inline h-3 w-3 align-middle text-[#E2E4E8] opacity-0 transition group-hover:opacity-100" />
    </h1>
  );
}

// ─── Inline description editor (admin only) ───
function ClassroomDescEditor({
  value,
  onSaved,
  reorderMode,
  savingOrder,
}: {
  value: string;
  onSaved: () => void;
  reorderMode: boolean;
  savingOrder: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(value);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { setVal(value); }, [value]);
  useEffect(() => { if (editing) { ref.current?.focus(); ref.current?.select(); } }, [editing]);

  const save = async () => {
    const next = val.trim();
    if (next === (value || "").trim()) { setEditing(false); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/classroom/meta", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: next }),
      });
      if (res.ok) { onSaved(); setEditing(false); }
    } finally { setBusy(false); }
  };

  if (editing) {
    return (
      <input
        ref={ref}
        value={val}
        disabled={busy}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); save(); }
          if (e.key === "Escape") { setEditing(false); setVal(value); }
        }}
        maxLength={240}
        placeholder="Богино тайлбар (заавал биш)"
        className="mt-1 block w-full rounded-[4px] border border-[rgba(15,23,38,0.40)] bg-black px-2 py-1 text-[12px] text-[#0e1726] outline-none placeholder:text-[#E2E4E8]"
      />
    );
  }
  return (
    <p
      onClick={() => setEditing(true)}
      title="Дарж засах"
      className="group mt-1 cursor-text rounded-[4px] text-[12px] text-[#E2E4E8] transition hover:bg-[rgba(15,23,38,0.06)] hover:text-[#E2E4E8]"
    >
      {value || <span className="italic text-[#E2E4E8]">+ Тайлбар нэмэх</span>}
      {value && <Icon name="edit" className="ml-1 inline h-3 w-3 align-middle text-[#E2E4E8] opacity-0 transition group-hover:opacity-100" />}
      {reorderMode && (
        <>
          <span className="text-[#E2E4E8]"> · </span>
          <span className="font-bold text-[#0e1726]">Дараалал засаж байна</span>
          {savingOrder && <span className="ml-1 text-[10px] text-[#E2E4E8]">хадгалж байна…</span>}
        </>
      )}
    </p>
  );
}
