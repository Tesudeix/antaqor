"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useMembership } from "@/lib/useMembership";
import { motion, AnimatePresence } from "framer-motion";
import PaywallGate from "@/components/PaywallGate";

interface Course {
  _id: string;
  title: string;
  description: string;
  thumbnail: string;
  lessonsCount: number;
  completedLessons?: number;
  requiredLevel?: number;
  createdAt: string;
}

type StatusFilter = "all" | "active" | "new" | "done";

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "Бүгд",
  active: "Үргэлжлэх",
  new: "Шинэ",
  done: "Дууссан",
};

function gradientFor(seed: string) {
  const hash = Array.from(seed).reduce((a, c) => a + c.charCodeAt(0), 0);
  return `linear-gradient(${hash % 360}deg, #EF2C58 0%, #0A0A0A 80%)`;
}

function statusOf(c: Course): StatusFilter {
  const total = c.lessonsCount || 0;
  const done = c.completedLessons || 0;
  if (total === 0) return "new";
  const pct = Math.round((done / total) * 100);
  if (pct === 100) return "done";
  if (pct > 0) return "active";
  return "new";
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    if (!session) { setLoading(false); return; }
    fetchCourses();
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

  const filtered = useMemo(() => {
    return courses.filter((c) => {
      if (search) {
        const q = search.toLowerCase();
        if (!c.title.toLowerCase().includes(q) && !c.description?.toLowerCase().includes(q)) return false;
      }
      if (filter !== "all" && statusOf(c) !== filter) return false;
      return true;
    });
  }, [courses, search, filter]);

  const totalLessons = courses.reduce((s, c) => s + (c.lessonsCount || 0), 0);
  const totalDone = courses.reduce((s, c) => s + (c.completedLessons || 0), 0);
  const overallPct = totalLessons > 0 ? Math.round((totalDone / totalLessons) * 100) : 0;

  const counts: Record<StatusFilter, number> = {
    all: courses.length,
    active: courses.filter((c) => statusOf(c) === "active").length,
    new: courses.filter((c) => statusOf(c) === "new").length,
    done: courses.filter((c) => statusOf(c) === "done").length,
  };

  const featured = filtered[0];
  const rest = filtered.slice(1);

  return (
    <div className="mx-auto max-w-[1200px] pb-8">
      {/* Header */}
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-[2px] w-4 bg-[#EF2C58]" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#EF2C58]">ANTAQOR · CLASSROOM</span>
          </div>
          <h1 className="mt-2 text-[26px] font-black leading-tight text-[#E8E8E8] sm:text-[32px]">Хичээл</h1>
          <p className="mt-1 text-[13px] text-[#888]">
            {courses.length} курс · {totalLessons} хичээл · {overallPct}% дууссан
          </p>
        </div>
        {admin && (
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-[4px] bg-[#EF2C58] px-3 py-2 text-[12px] font-black text-white transition hover:bg-[#D4264E]"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Курс нэмэх
          </button>
        )}
      </div>

      {/* Sticky search + filters */}
      <div className="sticky top-[60px] z-30 -mx-4 mb-5 border-y border-[rgba(255,255,255,0.06)] bg-[#0A0A0A]/80 px-4 py-2 backdrop-blur-xl">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <svg className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#666]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Курс хайх…"
              className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] py-2 pl-8 pr-3 text-[12px] text-[#E8E8E8] placeholder-[#555] outline-none transition focus:border-[rgba(239,44,88,0.4)]"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
            {(Object.keys(STATUS_LABEL) as StatusFilter[]).map((k) => {
              const active = filter === k;
              return (
                <button
                  key={k}
                  onClick={() => setFilter(k)}
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black transition ${
                    active
                      ? "bg-[#EF2C58] text-white"
                      : "border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] text-[#888] hover:border-[rgba(239,44,88,0.3)] hover:text-[#E8E8E8]"
                  }`}
                >
                  {STATUS_LABEL[k]}
                  {counts[k] > 0 && (
                    <span className={`text-[9px] ${active ? "text-white/70" : "text-[#555]"}`}>{counts[k]}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[16/12] animate-pulse rounded-[4px] bg-[#141414]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState hasFilters={search !== "" || filter !== "all"} onClear={() => { setSearch(""); setFilter("all"); }} admin={admin} onCreate={() => setShowCreate(true)} />
      ) : (
        <>
          {/* Featured hero card (only on "all" filter, no search) */}
          {featured && filter === "all" && !search && (
            <FeaturedCard course={featured} admin={admin} onUpdate={fetchCourses} onDelete={handleDelete} />
          )}

          {/* Grid */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(featured && filter === "all" && !search ? rest : filtered).map((c, i) => (
              <CourseCard key={c._id} course={c} index={i} admin={admin} onUpdate={fetchCourses} onDelete={handleDelete} />
            ))}
          </div>
        </>
      )}

      {/* Create modal */}
      <CreateCourseModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); fetchCourses(); }}
        nextOrder={courses.length}
      />
    </div>
  );
}

// ─── Featured (hero) card ─────────────────────────────────────────────
function FeaturedCard({ course, admin, onUpdate, onDelete }: { course: Course; admin: boolean; onUpdate: () => void; onDelete: (id: string) => void }) {
  const total = course.lessonsCount || 0;
  const done = course.completedLessons || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const status = statusOf(course);

  return (
    <Link
      href={`/classroom/course/${course._id}`}
      className="group relative block overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] transition hover:border-[rgba(239,44,88,0.4)]"
    >
      <div
        className="relative aspect-[16/8] sm:aspect-[16/7]"
        style={!course.thumbnail ? { background: gradientFor(course._id) } : undefined}
      >
        {course.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={course.thumbnail} alt={course.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
        {/* Top chips */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          <StatusChip s={status} />
          {admin && <CoverEditButton courseId={course._id} onUpdate={onUpdate} />}
          {admin && <DeleteButton onDelete={() => onDelete(course._id)} />}
        </div>
        {/* Bottom title block */}
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#EF2C58]">CHOSEN BY ANTAQOR</div>
          <h2 className="mt-1.5 line-clamp-2 text-[20px] font-black leading-tight text-white sm:text-[26px]">
            {course.title}
          </h2>
          {course.description && (
            <p className="mt-1.5 line-clamp-2 max-w-[640px] text-[12px] leading-relaxed text-[#CCC] sm:text-[13px]">
              {course.description}
            </p>
          )}
          <div className="mt-3 flex items-center gap-3 text-[11px] text-[#CCC]">
            <span className="inline-flex items-center gap-1">
              <svg className="h-3.5 w-3.5 text-[#EF2C58]" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
              {total} хичээл
            </span>
            {pct > 0 && <span className="font-bold text-[#EF2C58]">{pct}% дууссан</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Compact card ─────────────────────────────────────────────────────
function CourseCard({ course, index, admin, onUpdate, onDelete }: { course: Course; index: number; admin: boolean; onUpdate: () => void; onDelete: (id: string) => void }) {
  const total = course.lessonsCount || 0;
  const done = course.completedLessons || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const status = statusOf(course);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.5) }}
    >
      <Link
        href={`/classroom/course/${course._id}`}
        className="group flex h-full flex-col overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.06)] bg-[#0F0F10] transition hover:border-[rgba(239,44,88,0.3)] hover:-translate-y-[1px]"
      >
        {/* Cover */}
        <div
          className="relative aspect-[16/9]"
          style={!course.thumbnail ? { background: gradientFor(course._id) } : undefined}
        >
          {course.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={course.thumbnail} alt={course.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
          )}
          <div className="absolute right-2 top-2 flex items-center gap-1.5">
            <StatusChip s={status} small />
          </div>
          {admin && (
            <div className="absolute left-2 top-2 flex items-center gap-1.5 opacity-0 transition group-hover:opacity-100">
              <CoverEditButton courseId={course._id} onUpdate={onUpdate} small />
              <DeleteButton onDelete={() => onDelete(course._id)} small />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col p-3.5">
          <h3 className="line-clamp-2 text-[14px] font-bold leading-tight text-[#E8E8E8] transition group-hover:text-[#EF2C58]">
            {course.title}
          </h3>
          {course.description && (
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[#666]">{course.description}</p>
          )}
          <div className="mt-auto pt-3">
            <div className="flex items-center justify-between text-[10px] font-bold text-[#888]">
              <span>{total} хичээл</span>
              {pct > 0 && <span className="text-[#EF2C58]">{pct}%</span>}
            </div>
            {pct > 0 && (
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.06)]">
                <div className="h-full rounded-full bg-[#EF2C58] transition-all duration-700" style={{ width: `${pct}%` }} />
              </div>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ─── Reusable UI bits ─────────────────────────────────────────────────
function StatusChip({ s, small = false }: { s: StatusFilter; small?: boolean }) {
  if (s === "all") return null;
  const cfg = {
    new:    { label: "ШИНЭ",     bg: "rgba(15,129,202,0.18)", color: "#EF2C58" }, // pink in current palette
    active: { label: "ЯВЖ БУЙ",  bg: "rgba(239,44,88,0.18)",  color: "#EF2C58" },
    done:   { label: "ДУУССАН",  bg: "rgba(239,44,88,0.18)",  color: "#EF2C58" },
  }[s];
  const sz = small ? "px-1.5 py-0.5 text-[8px]" : "px-2 py-1 text-[9px]";
  return (
    <span className={`rounded-full font-black tracking-wider ${sz}`} style={{ background: cfg.bg, color: cfg.color }}>
      {cfg.label}
    </span>
  );
}

function CoverEditButton({ courseId, onUpdate, small = false }: { courseId: string; onUpdate: () => void; small?: boolean }) {
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

  const sz = small ? "h-6 w-6" : "h-8 w-8";

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); fileRef.current?.click(); }}
        disabled={busy}
        title="Cover солих"
        className={`flex ${sz} items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-md transition hover:bg-[#EF2C58] disabled:opacity-50`}
      >
        {busy ? (
          <span className="h-2 w-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <svg className={small ? "h-3 w-3" : "h-3.5 w-3.5"} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          </svg>
        )}
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
    </>
  );
}

function DeleteButton({ onDelete, small = false }: { onDelete: () => void; small?: boolean }) {
  const sz = small ? "h-6 w-6" : "h-8 w-8";
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete(); }}
      title="Устгах"
      className={`flex ${sz} items-center justify-center rounded-full bg-black/70 text-white backdrop-blur-md transition hover:bg-[#EF4444]`}
    >
      <svg className={small ? "h-3 w-3" : "h-3.5 w-3.5"} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
      </svg>
    </button>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────
function EmptyState({ hasFilters, onClear, admin, onCreate }: { hasFilters: boolean; onClear: () => void; admin: boolean; onCreate: () => void }) {
  return (
    <div className="rounded-[4px] border-2 border-dashed border-[rgba(255,255,255,0.08)] p-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[4px] bg-[rgba(239,44,88,0.1)]">
        <svg className="h-5 w-5 text-[#EF2C58]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84" />
        </svg>
      </div>
      <p className="text-[14px] font-bold text-[#E8E8E8]">
        {hasFilters ? "Шүүлтэд тохирох курс олдсонгүй" : "Курс хараахан нэмэгдээгүй"}
      </p>
      <p className="mt-1.5 text-[11px] text-[#666]">
        {hasFilters ? "Шүүлтийг арилгаад дахин үзнэ үү" : "Удахгүй шинэ хичээлүүд нэмэгдэнэ"}
      </p>
      {hasFilters ? (
        <button
          onClick={onClear}
          className="mt-3 rounded-[4px] bg-[#EF2C58] px-4 py-2 text-[12px] font-black text-white transition hover:bg-[#D4264E]"
        >
          Шүүлт арилгах
        </button>
      ) : admin ? (
        <button
          onClick={onCreate}
          className="mt-3 rounded-[4px] bg-[#EF2C58] px-4 py-2 text-[12px] font-black text-white transition hover:bg-[#D4264E]"
        >
          + Эхний курс үүсгэх
        </button>
      ) : null}
    </div>
  );
}

// ─── Create course modal ──────────────────────────────────────────────
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
            className="w-full max-w-[520px] max-h-[88vh] overflow-y-auto rounded-t-[4px] border-t border-[rgba(255,255,255,0.08)] bg-[#0F0F10] sm:max-h-[85vh] sm:rounded-[4px] sm:border"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] bg-[#0F0F10] px-4 py-3">
              <h2 className="text-[14px] font-black text-[#E8E8E8]">Шинэ курс</h2>
              <button onClick={onClose} aria-label="Хаах" className="flex h-7 w-7 items-center justify-center rounded-full text-[#666] transition hover:bg-[rgba(255,255,255,0.06)] hover:text-[#E8E8E8]">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 p-4">
              {/* Cover preview / upload */}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="relative block aspect-[16/9] w-full overflow-hidden rounded-[4px] border border-dashed border-[rgba(255,255,255,0.12)] bg-[#0A0A0A] transition hover:border-[rgba(239,44,88,0.4)]"
                style={!thumbnail ? { background: gradientFor(title || "new") } : undefined}
              >
                {thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbnail} alt="" className="h-full w-full object-cover" />
                )}
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/30 text-white opacity-0 transition hover:opacity-100">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  </svg>
                  <span className="mt-1 text-[11px] font-bold">{thumbnail ? "Cover солих" : "Cover нэмэх"}</span>
                </div>
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <div className="h-3 w-3 animate-pulse rounded-full bg-[#EF2C58]" />
                  </div>
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleThumb} className="hidden" />

              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Курсийн нэр"
                autoFocus
                className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[14px] text-[#E8E8E8] placeholder-[#555] outline-none transition focus:border-[rgba(239,44,88,0.4)]"
              />
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Тайлбар (заавал биш)"
                rows={2}
                className="w-full resize-y rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-2.5 text-[13px] text-[#E8E8E8] placeholder-[#555] outline-none transition focus:border-[rgba(239,44,88,0.4)]"
              />

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#888]">Шаардах түвшин:</span>
                <input
                  type="number" min={0} max={100}
                  value={reqLevel}
                  onChange={(e) => setReqLevel(parseInt(e.target.value) || 0)}
                  className="w-20 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-3 py-1.5 text-center text-[12px] text-[#E8E8E8] outline-none focus:border-[rgba(239,44,88,0.4)]"
                />
              </div>
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[rgba(255,255,255,0.06)] bg-[#0F0F10] px-4 py-3">
              <button onClick={onClose} className="text-[12px] font-semibold text-[#666] transition hover:text-[#E8E8E8]">
                Болих
              </button>
              <button
                onClick={submit}
                disabled={!title.trim() || creating}
                className="rounded-[4px] bg-[#EF2C58] px-4 py-2 text-[12px] font-black text-white transition hover:bg-[#D4264E] disabled:opacity-40"
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
