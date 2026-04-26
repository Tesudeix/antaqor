"use client";

import { useState, useEffect, useRef, use } from "react";
import Link from "next/link";
import { useMembership } from "@/lib/useMembership";
import { motion, AnimatePresence } from "framer-motion";
import PaywallGate from "@/components/PaywallGate";

// Strip extension + tidy filename → human-readable title
function titleFromFilename(name: string): string {
  return name
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Stable pink-leaning gradient when no thumbnail (mirrors listing page)
function gradientFor(seed: string) {
  const hash = Array.from(seed).reduce((a, c) => a + c.charCodeAt(0), 0);
  return `linear-gradient(${hash % 360}deg, #EF2C58 0%, #0A0A0A 80%)`;
}

// ─── Types matching /api/classroom/courses/[id]/tree response ───
interface TaskSummary {
  _id: string;
  title: string;
  maxScore: number;
  deadline?: string;
}
interface LessonSummary {
  _id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnail: string;
  attachments?: { url: string; name: string; size?: number }[];
  order: number;
  task: TaskSummary | null;
}
interface SectionNode {
  _id: string;
  title: string;
  description: string;
  order: number;
  lessons: LessonSummary[];
  legacyTask: TaskSummary | null;
}
interface CourseInfo {
  _id: string;
  title: string;
  description: string;
  thumbnail: string;
  lessonsCount: number;
}

export default function CourseDetailPageWrapper({ params }: { params: Promise<{ id: string }> }) {
  return (
    <PaywallGate>
      <CourseDetail params={params} />
    </PaywallGate>
  );
}

function CourseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isAdmin: admin } = useMembership();

  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [sections, setSections] = useState<SectionNode[]>([]);
  const [orphanLessons, setOrphanLessons] = useState<LessonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState<string | null>(null);

  const fetchTree = async () => {
    const res = await fetch(`/api/classroom/courses/${id}/tree`);
    const data = await res.json();
    if (res.ok) {
      setCourse(data.course);
      setSections(data.sections || []);
      setOrphanLessons(data.orphanLessons || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTree(); }, [id]);

  const toggleSection = (sid: string) => setOpenSection((s) => (s === sid ? null : sid));

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-3 w-3 animate-pulse rounded-[4px] bg-[#EF2C58]" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="py-20 text-center text-[14px] text-[#888]">Курс олдсонгүй</div>
    );
  }

  return (
    <div className="mx-auto max-w-[900px] pb-12">
      {/* Back */}
      <Link href="/classroom" className="mb-3 inline-flex items-center gap-1 text-[11px] text-[#666] transition hover:text-[#EF2C58]">
        ← Бүх курс
      </Link>

      {/* Course hero — image-led, no double cropping */}
      <div
        className="relative mb-6 overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A]"
        style={!course.thumbnail ? { background: gradientFor(course._id) } : undefined}
      >
        {/* 3:2 aspect — matches the listing card so the image never gets re-cropped */}
        <div className="relative aspect-[3/2] w-full">
          {course.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={course.thumbnail}
              alt={course.title}
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
          )}
          {/* Bottom fade so the title is always legible */}
          <div className="absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black via-black/55 to-transparent" />

          {/* Admin cover swap — single floating control */}
          {admin && <CourseCoverEditButton courseId={id} onUpdate={fetchTree} />}

          {/* Title block — overlaid */}
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
            <h1 className="text-[22px] font-black leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] sm:text-[28px]">
              {course.title}
            </h1>
            {course.description && (
              <p className="mt-1.5 line-clamp-2 max-w-[640px] text-[12px] leading-relaxed text-white/75 sm:text-[13px]">
                {course.description}
              </p>
            )}
            <div className="mt-2.5 flex items-center gap-2 text-[11px] font-bold text-white/70">
              <span>{sections.length} бүлэг</span>
              <span className="text-white/30">·</span>
              <span>{course.lessonsCount} хичээл</span>
            </div>
          </div>
        </div>
      </div>

      {/* Admin section toolbar */}
      {admin && (
        <div className="mb-3 flex items-center justify-end">
          <AddSectionInline courseId={id} nextOrder={sections.length} onAdded={fetchTree} />
        </div>
      )}

      {/* Sections — collapsed by default, click to expand → lessons + task */}
      <div className="space-y-2">
        {sections.length === 0 && orphanLessons.length === 0 ? (
          <div className="rounded-[4px] border-2 border-dashed border-[rgba(255,255,255,0.08)] p-8 text-center">
            <p className="text-[13px] font-bold text-[#E8E8E8]">Бүлэг хараахан нэмэгдээгүй</p>
            {admin && (
              <p className="mt-1.5 text-[11px] text-[#666]">Дээрх "+ Бүлэг" товчоор эхэл</p>
            )}
          </div>
        ) : null}

        {sections.map((sec) => {
          const isOpen = openSection === sec._id;
          return (
            <div key={sec._id} className="overflow-hidden rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10]">
              {/* Section header */}
              <button
                type="button"
                onClick={() => toggleSection(sec._id)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[rgba(255,255,255,0.02)]"
              >
                <Chevron open={isOpen} />
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-bold text-[#E8E8E8]">{sec.title}</div>
                  {sec.description && <div className="mt-0.5 text-[11px] text-[#666]">{sec.description}</div>}
                </div>
                <span className="text-[10px] font-bold text-[#666]">
                  {sec.lessons.length} хичээл
                </span>
                {admin && <SectionAdminMenu sectionId={sec._id} title={sec.title} onChange={fetchTree} />}
              </button>

              {/* Lessons (each with its own task) */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="overflow-hidden border-t border-[rgba(255,255,255,0.06)]"
                  >
                    <div className="space-y-2 p-3 pl-6">
                      {sec.lessons.map((l) => (
                        <LessonBlock key={l._id} lesson={l} admin={admin} onChange={fetchTree} />
                      ))}
                      {sec.lessons.length === 0 && !admin && !sec.legacyTask && (
                        <div className="px-2 py-3 text-center text-[11px] text-[#555]">Хичээл хараахан байхгүй</div>
                      )}
                      {admin && (
                        <AddLessonInline
                          courseId={id}
                          sectionId={sec._id}
                          nextOrder={sec.lessons.length}
                          onAdded={fetchTree}
                        />
                      )}
                      {/* Legacy section-level task (read-only) */}
                      {sec.legacyTask && (
                        <Link
                          href={`/classroom/task/${sec.legacyTask._id}`}
                          className="mt-2 flex items-center gap-2 rounded-[4px] border border-dashed border-[rgba(239,44,88,0.25)] bg-[rgba(239,44,88,0.04)] px-3 py-2 text-left transition hover:bg-[rgba(239,44,88,0.08)]"
                        >
                          <span className="text-[14px]">📝</span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[10px] font-black text-[#EF2C58]">ХУУЧИН ДААЛГАВАР</div>
                            <div className="text-[12px] font-bold text-[#E8E8E8]">{sec.legacyTask.title}</div>
                          </div>
                          <span className="text-[10px] text-[#666]">{sec.legacyTask.maxScore} оноо</span>
                        </Link>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}

        {/* Orphan lessons (legacy migration leftover — still browsable) */}
        {orphanLessons.length > 0 && (
          <div className="overflow-hidden rounded-[4px] border border-dashed border-[rgba(255,255,255,0.08)] bg-[#0F0F10] p-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#666]">Бусад хичээл</div>
            <div className="space-y-2">
              {orphanLessons.map((l) => (
                <LessonBlock key={l._id} lesson={l} admin={admin} onChange={fetchTree} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Lesson block: lesson row + its task (or admin add-task) underneath ───
function LessonBlock({ lesson, admin, onChange }: { lesson: LessonSummary; admin: boolean; onChange: () => void }) {
  const pdfCount = lesson.attachments?.length || 0;
  return (
    <div className="rounded-[4px] border border-[rgba(255,255,255,0.05)] bg-[#0A0A0A] p-1.5">
      {/* Lesson row → /classroom/[id] */}
      <Link
        href={`/classroom/${lesson._id}`}
        className="group flex items-center gap-2 rounded-[4px] px-2 py-1.5 transition hover:bg-[rgba(239,44,88,0.06)]"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[4px] bg-[rgba(239,44,88,0.12)] text-[#EF2C58]">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-[#CCC] transition group-hover:text-[#EF2C58]">
          {lesson.title}
        </span>
        {pdfCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(255,255,255,0.05)] px-1.5 py-0.5 text-[9px] font-bold text-[#888]">
            <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            {pdfCount}
          </span>
        )}
      </Link>

      {/* Task — per-lesson */}
      {lesson.task ? (
        <Link
          href={`/classroom/task/${lesson.task._id}`}
          className="ml-7 mt-1 flex items-center gap-2 rounded-[4px] border border-[rgba(239,44,88,0.3)] bg-[rgba(239,44,88,0.06)] px-2.5 py-1.5 transition hover:bg-[rgba(239,44,88,0.12)]"
        >
          <span className="text-[12px]">📝</span>
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-black uppercase tracking-[0.15em] text-[#EF2C58]">ДААЛГАВАР</div>
            <div className="truncate text-[11px] font-bold text-[#E8E8E8]">{lesson.task.title}</div>
          </div>
          <span className="text-[9px] text-[#666]">{lesson.task.maxScore} оноо</span>
        </Link>
      ) : admin ? (
        <div className="ml-7 mt-1">
          <AddTaskInline lessonId={lesson._id} onAdded={onChange} />
        </div>
      ) : null}
    </div>
  );
}

function Chevron({ open, small = false }: { open: boolean; small?: boolean }) {
  return (
    <svg
      className={`shrink-0 text-[#666] transition-transform duration-200 ${small ? "h-3 w-3" : "h-4 w-4"} ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// ═══════ ADMIN INLINE FORMS ═══════════════════════════════════════════════

function AddSectionInline({ courseId, nextOrder, onAdded }: { courseId: string; nextOrder: number; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/classroom/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ course: courseId, title, order: nextOrder }),
      });
      if (res.ok) { setTitle(""); setOpen(false); onAdded(); }
    } finally { setBusy(false); }
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-[4px] bg-[#EF2C58] px-3 py-1.5 text-[11px] font-black text-white transition hover:bg-[#D4264E]">
      <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
      Бүлэг
    </button>
  );
  return (
    <div className="flex items-center gap-1.5">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Шинэ бүлэг" autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }}
        className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-2.5 py-1.5 text-[12px] text-[#E8E8E8] outline-none focus:border-[rgba(239,44,88,0.4)]" />
      <button onClick={submit} disabled={!title.trim() || busy} className="rounded-[4px] bg-[#EF2C58] px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-40">
        {busy ? "..." : "Нэмэх"}
      </button>
      <button onClick={() => { setOpen(false); setTitle(""); }} className="text-[11px] text-[#666]">×</button>
    </div>
  );
}

function AddLessonInline({
  courseId, sectionId, nextOrder, onAdded,
}: {
  courseId: string; sectionId: string; nextOrder: number; onAdded: () => void;
}) {
  const videoRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoName, setVideoName] = useState("");
  const [videoSize, setVideoSize] = useState(0);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [pdfs, setPdfs] = useState<{ url: string; name: string; size?: number }[]>([]);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleVideoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideoError("");
    if (!file.type.startsWith("video/")) {
      setVideoError("Зөвхөн видео файл (mp4, webm, mov)");
      e.target.value = "";
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      setVideoError("Видео 200MB-аас бага байх ёстой");
      e.target.value = "";
      return;
    }
    setVideoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/classroom/upload-video", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setVideoError(data.error || "Upload алдаа");
        return;
      }
      setVideoUrl(data.url);
      setVideoName(file.name);
      setVideoSize(file.size);
      setTitle((t) => t.trim() || titleFromFilename(file.name));
    } finally {
      setVideoUploading(false);
      if (videoRef.current) videoRef.current.value = "";
    }
  };

  const handlePdfPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setPdfUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/classroom/upload-pdf", { method: "POST", body: fd });
        const data = await res.json();
        if (res.ok && data.url) {
          setPdfs((p) => [...p, { url: data.url, name: file.name, size: file.size }]);
          setTitle((t) => t.trim() || titleFromFilename(file.name));
        }
      }
    } finally {
      setPdfUploading(false);
      if (pdfRef.current) pdfRef.current.value = "";
    }
  };

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/classroom/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course: courseId,
          section: sectionId,
          title,
          videoUrl: videoUrl,
          videoType: "upload",
          order: nextOrder,
          attachments: pdfs,
        }),
      });
      if (res.ok) {
        setTitle(""); setVideoUrl(""); setVideoName(""); setVideoSize(0); setPdfs([]); setOpen(false); onAdded();
      }
    } finally { setBusy(false); }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="mt-1 inline-flex items-center gap-1 rounded-[4px] border border-dashed border-[rgba(255,255,255,0.1)] px-3 py-1.5 text-[10px] font-bold text-[#666] hover:border-[rgba(239,44,88,0.3)] hover:text-[#EF2C58]">
      + Хичээл нэмэх
    </button>
  );

  return (
    <div className="mt-2 space-y-2 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] p-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Хичээлийн нэр (файл сонгоход автомат)" autoFocus
        className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-2.5 py-1.5 text-[12px] text-[#E8E8E8] outline-none focus:border-[rgba(239,44,88,0.4)]" />

      {/* Video file upload */}
      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#888]">Видео файл</div>
        {videoUrl ? (
          <div className="flex items-center gap-2 rounded-[4px] border border-[rgba(34,197,94,0.25)] bg-[rgba(239,44,88,0.04)] px-2.5 py-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px] bg-[rgba(239,44,88,0.15)] text-[#EF2C58]">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[11px] font-bold text-[#E8E8E8]">{videoName || "video"}</div>
              <div className="text-[10px] text-[#666]">{formatSize(videoSize)} · хадгалагдсан</div>
            </div>
            <button onClick={() => { setVideoUrl(""); setVideoName(""); setVideoSize(0); }} className="text-[#666] hover:text-[#EF4444]" aria-label="Устгах">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => videoRef.current?.click()}
            disabled={videoUploading}
            className="flex w-full items-center gap-2.5 rounded-[4px] border-2 border-dashed border-[rgba(239,44,88,0.3)] bg-[#0A0A0A] px-3 py-2.5 text-left transition hover:border-[rgba(239,44,88,0.5)] disabled:opacity-50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-[rgba(239,44,88,0.1)] text-[#EF2C58]">
              {videoUploading ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#EF2C58] border-t-transparent" />
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
              )}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-[12px] font-bold text-[#E8E8E8]">
                {videoUploading ? "Хадгалж байна..." : "Видео сонгох"}
              </span>
              <span className="block text-[10px] text-[#666]">MP4 / WebM / MOV · 200MB хүртэл</span>
            </span>
          </button>
        )}
        <input ref={videoRef} type="file" accept="video/*" onChange={handleVideoPick} className="hidden" />
        {videoError && <div className="mt-1 text-[10px] text-[#EF4444]">{videoError}</div>}
      </div>

      {/* PDF attachments */}
      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#888]">PDF / Slide хавсралт</div>
        <button type="button" onClick={() => pdfRef.current?.click()} disabled={pdfUploading} className="inline-flex items-center gap-1 rounded-[4px] border border-dashed border-[rgba(239,44,88,0.3)] px-2.5 py-1.5 text-[10px] font-bold text-[#EF2C58] hover:bg-[rgba(239,44,88,0.05)] disabled:opacity-50">
          {pdfUploading ? "Хадгалж байна..." : "+ PDF нэмэх"}
        </button>
        <input ref={pdfRef} type="file" accept=".pdf,application/pdf" multiple onChange={handlePdfPick} className="hidden" />
        {pdfs.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {pdfs.map((p, i) => (
              <li key={i} className="flex items-center gap-1.5 text-[10px] text-[#888]">
                <span className="rounded-[3px] bg-[#1A1A1A] px-1 py-0.5 text-[8px] font-black text-[#EF2C58]">PDF</span>
                <span className="truncate">{p.name}</span>
                <button onClick={() => setPdfs((arr) => arr.filter((_, j) => j !== i))} className="ml-auto text-[#555] hover:text-[#EF4444]">×</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-1.5 pt-1">
        <button onClick={submit} disabled={!title.trim() || busy || videoUploading} className="rounded-[4px] bg-[#EF2C58] px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-40">
          {busy ? "Үүсгэж байна..." : "Үүсгэх"}
        </button>
        <button onClick={() => { setOpen(false); setTitle(""); setVideoUrl(""); setVideoName(""); setVideoSize(0); setPdfs([]); setVideoError(""); }} className="text-[11px] text-[#666]">Болих</button>
      </div>
    </div>
  );
}

function AddTaskInline({ lessonId, onAdded }: { lessonId: string; onAdded: () => void }) {
  const pdfRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [maxScore, setMaxScore] = useState(10);
  const [deadline, setDeadline] = useState("");
  const [pdfs, setPdfs] = useState<{ url: string; name: string; size?: number }[]>([]);
  const [pdfUploading, setPdfUploading] = useState(false);
  const [busy, setBusy] = useState(false);

  const handlePdfPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setPdfUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/classroom/upload-pdf", { method: "POST", body: fd });
        const data = await res.json();
        if (res.ok && data.url) {
          setPdfs((p) => [...p, { url: data.url, name: file.name, size: file.size }].slice(0, 3));
          setTitle((t) => t.trim() || titleFromFilename(file.name));
        }
      }
    } finally {
      setPdfUploading(false);
      if (pdfRef.current) pdfRef.current.value = "";
    }
  };

  const submit = async () => {
    if (!title.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/classroom/lesson-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lesson: lessonId, title, description: desc, maxScore, deadline: deadline || undefined, attachments: pdfs }),
      });
      if (res.ok) { setTitle(""); setDesc(""); setMaxScore(10); setDeadline(""); setPdfs([]); setOpen(false); onAdded(); }
    } finally { setBusy(false); }
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-[4px] border border-dashed border-[rgba(239,44,88,0.4)] px-2.5 py-1 text-[10px] font-bold text-[#EF2C58] hover:bg-[rgba(239,44,88,0.05)]">
      📝 + Даалгавар
    </button>
  );
  return (
    <div className="space-y-2 rounded-[4px] border border-[rgba(239,44,88,0.3)] bg-[rgba(239,44,88,0.04)] p-2.5">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Даалгаврын нэр (PDF сонгоход автомат)" autoFocus
        className="w-full rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-2.5 py-1.5 text-[12px] text-[#E8E8E8] outline-none focus:border-[rgba(239,44,88,0.4)]" />

      {/* Task PDF — main content of the task */}
      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#888]">Даалгаврын PDF <span className="text-[#555] normal-case font-normal tracking-normal">(заавар, асуултууд)</span></div>
        <button type="button" onClick={() => pdfRef.current?.click()} disabled={pdfUploading || pdfs.length >= 3} className="inline-flex items-center gap-1 rounded-[4px] border border-dashed border-[rgba(239,44,88,0.3)] px-2.5 py-1.5 text-[10px] font-bold text-[#EF2C58] hover:bg-[rgba(239,44,88,0.05)] disabled:opacity-50">
          {pdfUploading ? "Хадгалж байна..." : "+ PDF нэмэх"}
        </button>
        <input ref={pdfRef} type="file" accept=".pdf,application/pdf" multiple onChange={handlePdfPick} className="hidden" />
        {pdfs.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {pdfs.map((p, i) => (
              <li key={i} className="flex items-center gap-1.5 text-[10px] text-[#888]">
                <span className="rounded-[3px] bg-[#1A1A1A] px-1 py-0.5 text-[8px] font-black text-[#EF2C58]">PDF</span>
                <span className="truncate">{p.name}</span>
                <button onClick={() => setPdfs((arr) => arr.filter((_, j) => j !== i))} className="ml-auto text-[#555] hover:text-[#EF4444]">×</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="Богино тайлбар (заавал биш)"
        className="w-full resize-y rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-2.5 py-1.5 text-[11px] text-[#E8E8E8] outline-none focus:border-[rgba(239,44,88,0.4)]" />
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1 text-[10px] text-[#888]">
          Хамгийн их оноо:
          <input type="number" min={1} max={1000} value={maxScore} onChange={(e) => setMaxScore(parseInt(e.target.value) || 10)}
            className="w-14 rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-1.5 py-0.5 text-center text-[11px] text-[#E8E8E8]" />
        </label>
        <label className="flex items-center gap-1 text-[10px] text-[#888]">
          Дедлайн:
          <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)}
            className="rounded-[4px] border border-[rgba(255,255,255,0.08)] bg-[#0A0A0A] px-1.5 py-0.5 text-[11px] text-[#E8E8E8]" />
        </label>
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={submit} disabled={!title.trim() || busy || pdfUploading} className="rounded-[4px] bg-[#EF2C58] px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-40">
          {busy ? "..." : "Үүсгэх"}
        </button>
        <button onClick={() => setOpen(false)} className="text-[11px] text-[#666]">Болих</button>
      </div>
    </div>
  );
}

function SectionAdminMenu({ sectionId, title, onChange }: { sectionId: string; title: string; onChange: () => void }) {
  const onDelete = async (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    if (!confirm(`"${title}" бүлэг + бүх хичээл + даалгавар устах. Үргэлжлүүлэх үү?`)) return;
    await fetch(`/api/classroom/sections/${sectionId}`, { method: "DELETE" });
    onChange();
  };
  return (
    <button onClick={onDelete} className="ml-1 rounded-[4px] p-1 text-[#666] hover:bg-[rgba(239,68,68,0.1)] hover:text-[#EF4444]" aria-label="Устгах">
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9M19.228 5.79L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79M7.5 5.79h9" /></svg>
    </button>
  );
}

function CourseCoverEditButton({ courseId, onUpdate }: { courseId: string; onUpdate: () => void }) {
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
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        title="Cover солих"
        className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-md transition hover:bg-[#EF2C58] disabled:opacity-50"
      >
        {busy ? (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
          </svg>
        )}
        Cover
      </button>
      <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
    </>
  );
}
