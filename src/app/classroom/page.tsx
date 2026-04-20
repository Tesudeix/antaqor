"use client";

import { useSession } from "next-auth/react";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useMembership } from "@/lib/useMembership";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ───
interface Course {
  _id: string;
  title: string;
  description: string;
  thumbnail: string;
  lessonsCount: number;
  completedLessons?: number;
  createdAt: string;
}

type StatusFilter = "all" | "new" | "active" | "done";
type CoverStyle = "grid" | "orbit" | "pulse" | "wave";

// ─── Abstract SVG Cover Art ───
function CourseCover({ style, index }: { style: CoverStyle; index: number }) {
  const hue = (index * 47 + 15) % 360;
  const goldOpacity = 0.15;

  switch (style) {
    case "grid":
      return (
        <svg viewBox="0 0 280 140" className="h-full w-full">
          <rect width="280" height="140" fill="#141414" />
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={`v${i}`} x1={35 * (i + 1)} y1="0" x2={35 * (i + 1)} y2="140" stroke={`rgba(239,44,88,${goldOpacity})`} strokeWidth="0.5" />
          ))}
          {Array.from({ length: 4 }).map((_, i) => (
            <line key={`h${i}`} x1="0" y1={35 * (i + 1)} x2="280" y2={35 * (i + 1)} stroke={`rgba(239,44,88,${goldOpacity})`} strokeWidth="0.5" />
          ))}
          <circle cx={140 + Math.sin(index) * 40} cy={70 + Math.cos(index) * 20} r="24" fill="none" stroke="rgba(239,44,88,0.3)" strokeWidth="1" />
          <circle cx={140 + Math.sin(index) * 40} cy={70 + Math.cos(index) * 20} r="4" fill="#EF2C58" opacity="0.6" />
        </svg>
      );
    case "orbit":
      return (
        <svg viewBox="0 0 280 140" className="h-full w-full">
          <rect width="280" height="140" fill="#141414" />
          <circle cx="140" cy="70" r="50" fill="none" stroke={`rgba(239,44,88,${goldOpacity})`} strokeWidth="0.5" />
          <circle cx="140" cy="70" r="35" fill="none" stroke={`rgba(239,44,88,${goldOpacity + 0.05})`} strokeWidth="0.5" />
          <circle cx="140" cy="70" r="20" fill="none" stroke={`rgba(239,44,88,${goldOpacity + 0.1})`} strokeWidth="0.5" />
          <circle cx={140 + 50 * Math.cos(index * 0.8)} cy={70 + 50 * Math.sin(index * 0.8)} r="3" fill="#EF2C58" opacity="0.8" />
          <circle cx={140 + 35 * Math.cos(index * 1.3 + 1)} cy={70 + 35 * Math.sin(index * 1.3 + 1)} r="2" fill="#0F81CA" opacity="0.7" />
          <circle cx="140" cy="70" r="5" fill="#EF2C58" opacity="0.3" />
        </svg>
      );
    case "pulse":
      return (
        <svg viewBox="0 0 280 140" className="h-full w-full">
          <rect width="280" height="140" fill="#141414" />
          <polyline
            points={Array.from({ length: 28 }).map((_, i) => {
              const x = i * 10;
              const y = 70 + Math.sin((i + index) * 0.6) * 30 + Math.sin((i + index) * 1.5) * 10;
              return `${x},${y}`;
            }).join(" ")}
            fill="none"
            stroke="#EF2C58"
            strokeWidth="1.5"
            opacity="0.4"
          />
          <polyline
            points={Array.from({ length: 28 }).map((_, i) => {
              const x = i * 10;
              const y = 70 + Math.cos((i + index) * 0.4) * 20;
              return `${x},${y}`;
            }).join(" ")}
            fill="none"
            stroke="#0F81CA"
            strokeWidth="0.5"
            opacity="0.3"
          />
        </svg>
      );
    case "wave":
      return (
        <svg viewBox="0 0 280 140" className="h-full w-full">
          <rect width="280" height="140" fill="#141414" />
          {Array.from({ length: 5 }).map((_, i) => (
            <path
              key={i}
              d={`M0,${50 + i * 15} Q70,${30 + i * 15 + Math.sin(index + i) * 15} 140,${50 + i * 15} T280,${50 + i * 15}`}
              fill="none"
              stroke={i === 2 ? "rgba(239,44,88,0.35)" : `rgba(239,44,88,${0.08 + i * 0.03})`}
              strokeWidth={i === 2 ? "1.5" : "0.5"}
            />
          ))}
        </svg>
      );
  }
}

// ─── Progress Ring ───
function ProgressRing({ percent, size = 44 }: { percent: number; size?: number }) {
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="block">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="rgba(20,20,20,0.8)"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#EF2C58"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="progress-ring-circle"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-[#E8E8E8]">
        {percent}%
      </span>
    </div>
  );
}

// ─── Status Badge ───
function StatusBadge({ status }: { status: "new" | "active" | "done" }) {
  const config = {
    new: { label: "ШИНЭ", bg: "rgba(15,129,202,0.2)", text: "#0F81CA" },
    active: { label: "ҮРГЭЛЖИЛЖ БУЙ", bg: "rgba(239,44,88,0.15)", text: "#EF2C58" },
    done: { label: "ДУУССАН", bg: "rgba(34,197,94,0.15)", text: "#22c55e" },
  };
  const c = config[status];
  return (
    <span
      className="rounded-[4px] px-2 py-0.5 text-[9px] font-bold tracking-[0.06em] backdrop-blur-sm"
      style={{ background: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  );
}

// ─── Cover styles per index ───
const COVER_STYLES: CoverStyle[] = ["grid", "orbit", "pulse", "wave"];

// ─── Course Card ───
function CourseCard({
  course,
  index,
  admin,
  onDelete,
}: {
  course: Course;
  index: number;
  admin: boolean;
  onDelete: (id: string) => void;
}) {
  const completed = course.completedLessons || 0;
  const total = course.lessonsCount || 0;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const status: "new" | "active" | "done" =
    percent === 100 ? "done" : percent > 0 ? "active" : "new";
  const coverStyle = COVER_STYLES[index % COVER_STYLES.length];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut", delay: index * 0.04 }}
    >
      <Link
        href={`/classroom/course/${course._id}`}
        className="group relative flex flex-col overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] transition-all duration-200 hover:-translate-y-[3px] hover:border-[rgba(239,44,88,0.4)] hover:shadow-[0_0_24px_rgba(239,44,88,0.08)]"
        style={{ minHeight: 280 }}
      >
        {/* Cover art or thumbnail */}
        <div className="relative h-[140px] shrink-0 overflow-hidden">
          {course.thumbnail ? (
            <img src={course.thumbnail} alt={course.title} className="h-full w-full object-cover" />
          ) : (
            <CourseCover style={coverStyle} index={index} />
          )}
          {/* Status badge - top left */}
          <div className="absolute left-3 top-3">
            <StatusBadge status={status} />
          </div>
          {/* Progress ring - top right */}
          {total > 0 && (
            <div className="absolute right-3 top-3" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`Явц: ${percent}%`}>
              <ProgressRing percent={percent} />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex flex-1 flex-col p-5">
          <h3 className="text-[18px] font-medium leading-snug text-[#E8E8E8] transition-colors duration-200 group-hover:text-[#EF2C58]">
            {course.title}
          </h3>
          {course.description && (
            <p className="mt-2 text-[13px] leading-relaxed text-[#666666] line-clamp-2">
              {course.description}
            </p>
          )}
          <div className="mt-auto flex items-center justify-between pt-4">
            <span className="text-[12px] text-[#666666]">
              {total} хичээл
            </span>
            <span className="text-[12px] font-bold text-[#EF2C58] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              Нээх →
            </span>
          </div>
        </div>

        {/* Admin delete — inside Link, onClick prevents navigation */}
        {admin && (
          <button
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); onDelete(course._id); }}
            className="absolute left-3 bottom-4 z-30 flex items-center gap-1.5 rounded-[4px] bg-red-500 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-colors duration-200 hover:bg-red-600"
            aria-label="Курс устгах"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Устгах
          </button>
        )}
      </Link>
    </motion.div>
  );
}

// ─── Ghost Add Card ───
function GhostAddCard({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut", delay: 0.15 }}
      className="flex flex-col items-center justify-center rounded-[4px] border-2 border-dashed border-[rgba(239,44,88,0.3)] bg-transparent transition-all duration-200 hover:border-[#EF2C58] hover:bg-[rgba(239,44,88,0.03)] hover:shadow-[0_0_24px_rgba(239,44,88,0.08)]"
      style={{ minHeight: 280 }}
      aria-label="Шинэ курс нэмэх"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-[rgba(239,44,88,0.3)] text-[#EF2C58] transition-all duration-200">
        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </div>
      <span className="mt-3 text-[13px] font-medium text-[#666666]">Курс нэмэх</span>
    </motion.button>
  );
}

// ─── Empty State ───
function EmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="col-span-full flex flex-col items-center justify-center rounded-[4px] border-2 border-dashed border-[rgba(239,44,88,0.2)] px-8 py-16 text-center"
    >
      <svg className="mb-4 h-10 w-10 text-[#666666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
      <p className="text-[15px] font-medium text-[#666666]">
        {hasFilters ? "Шүүлтэд тохирох курс олдсонгүй" : "Эхний курсаа үүсгэж, аянаа эхлүүл"}
      </p>
      {hasFilters && (
        <button
          onClick={onClear}
          className="mt-4 rounded-[4px] bg-[#EF2C58] px-5 py-2 text-[13px] font-bold text-[#F8F8F6] transition-all duration-200 hover:shadow-[0_0_24px_rgba(239,44,88,0.25)]"
        >
          Шүүлт арилгах
        </button>
      )}
    </motion.div>
  );
}

// ─── Main Page ───
export default function ClassroomPage() {
  const { data: session } = useSession();
  const { loading: memberLoading, isMember, isAdmin: admin } = useMembership();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Admin: new course
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [newCourseTitle, setNewCourseTitle] = useState("");
  const [newCourseDesc, setNewCourseDesc] = useState("");
  const [newCourseThumbnail, setNewCourseThumbnail] = useState("");
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!memberLoading && session) {
      fetchCourses();
    } else if (!memberLoading) {
      setLoading(false);
    }
  }, [memberLoading, session]);

  const fetchCourses = async () => {
    try {
      const res = await fetch("/api/classroom/courses");
      const data = await res.json();
      if (res.ok) setCourses(data.courses);
    } finally {
      setLoading(false);
    }
  };

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok && data.url) setNewCourseThumbnail(data.url);
    } finally {
      setUploading(false);
    }
  };

  const handleCreateCourse = async () => {
    if (!newCourseTitle.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/classroom/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newCourseTitle, description: newCourseDesc, thumbnail: newCourseThumbnail, order: courses.length }),
      });
      if (res.ok) {
        setNewCourseTitle("");
        setNewCourseDesc("");
        setNewCourseThumbnail("");
        setShowNewCourse(false);
        fetchCourses();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCourse = async (id: string) => {
    if (!confirm("Энэ курс болон бүх хичээлийг устгах уу?")) return;
    await fetch(`/api/classroom/courses/${id}`, { method: "DELETE" });
    fetchCourses();
  };

  // Client-side filtering
  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      // Search
      if (search) {
        const q = search.toLowerCase();
        if (!c.title.toLowerCase().includes(q) && !c.description?.toLowerCase().includes(q)) return false;
      }
      // Status
      if (statusFilter !== "all") {
        const completed = c.completedLessons || 0;
        const total = c.lessonsCount || 0;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        const status = percent === 100 ? "done" : percent > 0 ? "active" : "new";
        if (status !== statusFilter) return false;
      }
      return true;
    });
  }, [courses, search, statusFilter]);

  // Stats
  const totalLessons = courses.reduce((s, c) => s + (c.lessonsCount || 0), 0);
  const totalCompleted = courses.reduce((s, c) => s + (c.completedLessons || 0), 0);
  const overallProgress = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  // ─── Loading ───
  if (memberLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-2 w-2 animate-pulse-gold rounded-full bg-[#EF2C58]" />
      </div>
    );
  }

  // ─── Not signed in ───
  if (!session) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414]">
          <svg className="h-7 w-7 text-[#EF2C58]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <h1 className="mb-2 text-[24px] font-bold text-[#E8E8E8]">Хичээлийн танхим</h1>
        <p className="mb-6 text-[14px] text-[#666666]">Хичээлд хандахын тулд нэвтэрнэ үү</p>
        <Link href="/auth/signin" className="rounded-[4px] bg-[#EF2C58] px-8 py-3 text-[13px] font-bold text-[#F8F8F6] transition-all duration-200 hover:shadow-[0_0_24px_rgba(239,44,88,0.25)]">
          Нэвтрэх
        </Link>
      </div>
    );
  }

  const filters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "Бүгд" },
    { key: "active", label: "Үргэлжилж буй" },
    { key: "new", label: "Шинэ" },
    { key: "done", label: "Дууссан" },
  ];

  return (
    <div className="mx-auto max-w-[1200px]">
      {/* ─── Hero Section ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <span className="meta-label text-[#666666]">Classroom</span>
          <h1 className="mt-1 text-[28px] font-medium tracking-[-0.02em] text-[#E8E8E8] sm:text-[38px]">
            Хичээлийн танхим
          </h1>
        </div>
        {/* Stat strip */}
        <div className="flex items-center gap-6">
          {[
            { label: "Курс", value: courses.length },
            { label: "Хичээл", value: totalLessons },
            { label: "Явц", value: `${overallProgress}%` },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-[20px] font-bold text-[#E8E8E8]">{stat.value}</div>
              <div className="text-[11px] font-medium tracking-[0.08em] uppercase text-[#666666]">{stat.label}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ─── Toolbar ─── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: "easeOut", delay: 0.05 }}
        className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        {/* Search */}
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666666]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Курс хайх..."
            className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] py-2.5 pl-10 pr-4 text-[14px] text-[#E8E8E8] placeholder-[#888888] outline-none transition-colors duration-200 focus:border-[rgba(239,44,88,0.4)]"
          />
        </div>

        {/* Filter chips */}
        <div className="flex items-center gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`rounded-[4px] px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-200 ${
                statusFilter === f.key
                  ? "bg-[#EF2C58] text-[#F8F8F6]"
                  : "border border-[rgba(255,255,255,0.08)] bg-[#141414] text-[#666666] hover:text-[#666666]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* New course CTA */}
        {admin && (
          <button
            onClick={() => setShowNewCourse(!showNewCourse)}
            className="rounded-[4px] bg-[#EF2C58] px-5 py-2.5 text-[13px] font-bold text-[#F8F8F6] transition-all duration-200 hover:shadow-[0_0_24px_rgba(239,44,88,0.25)]"
          >
            {showNewCourse ? "Цуцлах" : "+ Шинэ курс"}
          </button>
        )}
      </motion.div>

      {/* ─── Admin: New course form ─── */}
      <AnimatePresence>
        {admin && showNewCourse && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="mb-6 overflow-hidden"
          >
            <div className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#141414] p-6 space-y-4">
              <input
                value={newCourseTitle}
                onChange={(e) => setNewCourseTitle(e.target.value)}
                placeholder="Курсийн нэр"
                className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-4 py-3 text-[15px] text-[#E8E8E8] placeholder-[#888888] outline-none transition-colors duration-200 focus:border-[rgba(239,44,88,0.4)]"
              />
              <textarea
                value={newCourseDesc}
                onChange={(e) => setNewCourseDesc(e.target.value)}
                placeholder="Тайлбар (заавал биш)"
                rows={2}
                className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-4 py-3 text-[15px] text-[#E8E8E8] placeholder-[#888888] outline-none transition-colors duration-200 focus:border-[rgba(239,44,88,0.4)] resize-none"
              />

              {/* Thumbnail upload */}
              <div>
                <label className="mb-1.5 block text-[12px] font-medium text-[#666666]">Зураг (thumbnail)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailUpload}
                    disabled={uploading}
                    className="text-[13px] text-[#666666] file:mr-3 file:rounded-[4px] file:border-0 file:bg-[#EF2C58] file:px-4 file:py-2 file:text-[12px] file:font-bold file:text-[#F8F8F6] file:cursor-pointer file:transition-all file:duration-200 hover:file:shadow-[0_0_16px_rgba(239,44,88,0.2)]"
                  />
                  {uploading && (
                    <span className="text-[12px] text-[#666666]">Байршуулж байна...</span>
                  )}
                </div>
                {newCourseThumbnail && (
                  <div className="mt-2 relative inline-block">
                    <img
                      src={newCourseThumbnail}
                      alt="Preview"
                      className="h-[100px] w-auto rounded-[4px] border border-[rgba(255,255,255,0.08)] object-cover"
                    />
                    <button
                      onClick={() => setNewCourseThumbnail("")}
                      className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#EF2C58] text-[10px] font-bold text-white shadow-sm hover:bg-red-600"
                    >✕</button>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleCreateCourse}
                  disabled={creating || !newCourseTitle.trim()}
                  className="rounded-[4px] bg-[#EF2C58] px-6 py-2.5 text-[13px] font-bold text-[#F8F8F6] transition-all duration-200 hover:shadow-[0_0_24px_rgba(239,44,88,0.25)] disabled:opacity-50"
                >
                  {creating ? "..." : "Үүсгэх"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Course Grid ─── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="h-2 w-2 animate-pulse-gold rounded-full bg-[#EF2C58]" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          <AnimatePresence mode="popLayout">
            {filteredCourses.length === 0 && !admin ? (
              <EmptyState
                hasFilters={search !== "" || statusFilter !== "all"}
                onClear={() => { setSearch(""); setStatusFilter("all"); }}
              />
            ) : (
              <>
                {filteredCourses.map((course, i) => (
                  <CourseCard
                    key={course._id}
                    course={course}
                    index={i}
                    admin={admin}
                    onDelete={handleDeleteCourse}
                  />
                ))}
                {/* Ghost add card */}
                {admin && <GhostAddCard onClick={() => setShowNewCourse(true)} />}
                {filteredCourses.length === 0 && admin && (
                  <EmptyState
                    hasFilters={search !== "" || statusFilter !== "all"}
                    onClear={() => { setSearch(""); setStatusFilter("all"); }}
                  />
                )}
              </>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
