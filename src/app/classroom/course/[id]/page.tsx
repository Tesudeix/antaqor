"use client";

import { useState, useEffect, useRef, useMemo, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMembership } from "@/lib/useMembership";
import { motion, AnimatePresence } from "framer-motion";
import { LessonArticle } from "@/components/classroom/LessonArticle";
import UpgradeModal from "@/components/UpgradeModal";
import { PLANS, type PlanId } from "@/lib/plans";
import { track } from "@/lib/analytics";

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
  return `linear-gradient(${hash % 360}deg, #1080CA 0%, #ffffff 80%)`;
}

// ─── Video URL → embed URL (YouTube / Vimeo) ───
// Mirrors the helper on /classroom/[id] so the inline course player handles
// the same input shapes the lesson page does.
function getEmbedUrl(url: string): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}?rel=0&modestbranding=1`;
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

function videoMimeFor(url: string): string {
  if (/\.webm($|\?)/i.test(url)) return "video/webm";
  if (/\.mov($|\?)/i.test(url)) return "video/quicktime";
  return "video/mp4";
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
  coverImage?: string;
  lessonsCount: number;
}

export default function CourseDetailPageWrapper({ params }: { params: Promise<{ id: string }> }) {
  return (
    <LoginGate>
      <CourseDetail params={params} />
    </LoginGate>
  );
}

// Login-only gate — free members CAN open course pages; per-course plan
// locking is enforced by the /tree API (locked:true) + upgrade modal below.
function LoginGate({ children }: { children: React.ReactNode }) {
  const { loading, isLoggedIn } = useMembership();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !isLoggedIn) router.replace("/auth/signup");
  }, [loading, isLoggedIn, router]);
  if (loading || !isLoggedIn) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-3 w-3 animate-pulse bg-[#1080CA]" />
      </div>
    );
  }
  return <>{children}</>;
}

function CourseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { isAdmin: admin } = useMembership();

  const [course, setCourse] = useState<CourseInfo | null>(null);
  const [sections, setSections] = useState<SectionNode[]>([]);
  const [orphanLessons, setOrphanLessons] = useState<LessonSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState<PlanId | null>(null);

  const fetchTree = async () => {
    const res = await fetch(`/api/classroom/courses/${id}/tree`);
    const data = await res.json();
    if (res.ok) {
      setCourse(data.course);
      setSections(data.sections || []);
      setOrphanLessons(data.orphanLessons || []);
      if (data.locked && data.requiredPlan) {
        setLocked(data.requiredPlan as PlanId);
        track("premium_course_locked_viewed", { course: data.course?.title });
      } else {
        setLocked(null);
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchTree(); }, [id]);


  // ─── Inline lesson player ──────────────────────────────────────────────
  // Click the cover or any carousel card → that lesson's video swaps in
  // place of the cover. Auto-advances to the next lesson on end.
  const allLessons = useMemo<LessonSummary[]>(() => {
    return [
      ...sections.slice().sort((a, b) => a.order - b.order)
        .flatMap((s) => s.lessons.slice().sort((a, b) => a.order - b.order)),
      ...orphanLessons.slice().sort((a, b) => a.order - b.order),
    ];
  }, [sections, orphanLessons]);

  const [activeLesson, setActiveLesson] = useState<LessonSummary | null>(null);
  // Track whether the user explicitly picked a lesson — controls whether
  // we autoplay vs. just preload the first lesson into the player frame.
  const [userInitiated, setUserInitiated] = useState(false);
  const playerRef = useRef<HTMLDivElement>(null);

  // Auto-load DISABLED — was hijacking the hero so the cover image, title,
  // and description never showed. Page now opens like a Notion document:
  // cover → title → description → lesson grid. User taps a card to play.

  const playLesson = (lesson: LessonSummary) => {
    if (!lesson.videoUrl) return; // nothing to play
    setActiveLesson(lesson);
    setUserInitiated(true);
    requestAnimationFrame(() => {
      playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const playNextLesson = () => {
    if (!activeLesson) return;
    const idx = allLessons.findIndex((l) => l._id === activeLesson._id);
    const next = allLessons[idx + 1];
    if (next) playLesson(next);
  };

  // ─── Sidebar curriculum: per-course, per-device completion (localStorage) ──
  const LS_KEY = `antaqor:course:${id}:done`;
  const [doneSet, setDoneSet] = useState<Set<string>>(new Set());
  const [openSecs, setOpenSecs] = useState<Set<string>>(new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      setDoneSet(raw ? new Set<string>(JSON.parse(raw)) : new Set());
    } catch { setDoneSet(new Set()); }
  }, [LS_KEY]);

  const toggleDone = (lid: string) => {
    setDoneSet((prev) => {
      const n = new Set(prev);
      if (n.has(lid)) n.delete(lid); else n.add(lid);
      try { localStorage.setItem(LS_KEY, JSON.stringify([...n])); } catch {}
      return n;
    });
  };

  const toggleSec = (sid: string) =>
    setOpenSecs((p) => { const n = new Set(p); if (n.has(sid)) n.delete(sid); else n.add(sid); return n; });

  const selectLesson = (lesson: LessonSummary) => {
    setActiveLesson(lesson);
    setUserInitiated(true);
    requestAnimationFrame(() =>
      playerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
    );
  };

  // First lesson selected by default (no autoplay — poster shows).
  useEffect(() => {
    if (!activeLesson && allLessons.length) setActiveLesson(allLessons[0]);
  }, [allLessons, activeLesson]);

  // Auto-expand the section holding the active lesson.
  useEffect(() => {
    if (!activeLesson) return;
    const sec = sections.find((s) => s.lessons.some((l) => l._id === activeLesson._id));
    if (sec) setOpenSecs((p) => (p.has(sec._id) ? p : new Set(p).add(sec._id)));
  }, [activeLesson, sections]);

  // Unified curriculum groups: real sections (with lessons) + an "orphan" group.
  const groups = useMemo(() => {
    const g = sections
      .slice()
      .sort((a, b) => a.order - b.order)
      .filter((s) => s.lessons.length > 0)
      .map((s) => ({
        _id: s._id,
        title: s.title,
        lessons: s.lessons.slice().sort((a, b) => a.order - b.order),
        synthetic: false,
      }));
    const orph = orphanLessons.slice().sort((a, b) => a.order - b.order);
    if (orph.length)
      g.push({ _id: "__orphan__", title: g.length ? "Бусад хичээл" : "Хичээлүүд", lessons: orph, synthetic: true });
    return g;
  }, [sections, orphanLessons]);

  const pct = allLessons.length ? Math.round((doneSet.size / allLessons.length) * 100) : 0;


  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-3 w-3 animate-pulse rounded-none bg-[#1080CA]" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="py-20 text-center text-[14px] text-[#5b6573]">Курс олдсонгүй</div>
    );
  }

  // ─── Plan-locked course — show what it is, sell the unlock ───
  if (locked) {
    const reqPlan = PLANS[locked];
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-4 text-center">
        <div className="chrome mb-3 text-[10px]" style={{ color: reqPlan.accent }}>
          🔒 {reqPlan.name.toUpperCase()} PLAN // ШААРДЛАГАТАЙ
        </div>
        <h1 className="headline mb-3 text-[26px]">{course.title}</h1>
        {course.description && (
          <p className="mb-6 text-[13px] leading-relaxed text-[#B4B4BA]">{course.description}</p>
        )}
        <UpgradeModal
          requiredPlan={locked}
          contextTitle={course.title}
          unlocks={[
            "Энэ курсын бүх хичээл",
            ...reqPlan.benefits.slice(0, 3),
          ]}
          onClose={() => history.back()}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1240px] pb-16">
      {/* Top bar — back + admin entry */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          href="/classroom"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#6b7280] transition hover:text-[#1080CA]"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Бүх курс
        </Link>
        {admin && (
          <div className="flex items-center gap-2">
            <CourseCoverEditButton courseId={id} hasCover={!!course.coverImage} onUpdate={fetchTree} />
            <Link
              href={`/admin/classroom/courses/${id}`}
              className="inline-flex items-center gap-1.5 rounded-none border border-[rgba(15,23,38,0.10)] bg-black px-3 py-1.5 text-[11px] font-bold text-[#5b6573] transition hover:border-[rgba(16,128,202,0.35)] hover:text-[#1080CA]"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={1.7} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Курс хяналт
            </Link>
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[336px_minmax(0,1fr)]">
        {/* ─────────────── Curriculum sidebar ─────────────── */}
        <aside className="order-2 lg:order-1 lg:sticky lg:top-[68px] lg:self-start">
          <div className="overflow-hidden rounded-none border border-[rgba(15,23,38,0.10)] bg-black">
            <div className="border-b border-[rgba(15,23,38,0.08)] px-4 py-4">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">
                Курс
              </div>
              <h1
                className="mt-1 text-[15px] font-extrabold leading-snug text-[#0e1726]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {course.title}
              </h1>
              <div className="mt-3.5 flex items-center justify-between">
                <span className="rounded-full bg-[#1080CA] px-2 py-[3px] text-[10px] font-black tabular-nums text-[#0E0E10]">
                  {pct}%
                </span>
                <span className="font-mono text-[10px] tabular-nums text-[#6b7280]">
                  {doneSet.size} / {allLessons.length} хичээл
                </span>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[rgba(15,23,38,0.10)]">
                <div
                  className="h-full rounded-full bg-[#1080CA] transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            <nav className="max-h-[68vh] overflow-y-auto p-2">
              {groups.length === 0 && (
                <p className="px-3 py-8 text-center font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-[#6b7280]">
                  Хичээл хоосон
                </p>
              )}
              {groups.map((sec) => {
                const open = sec.synthetic || openSecs.has(sec._id);
                const secDone = sec.lessons.filter((l) => doneSet.has(l._id)).length;
                return (
                  <div key={sec._id} className="mb-1">
                    {!sec.synthetic && (
                      <button
                        type="button"
                        onClick={() => toggleSec(sec._id)}
                        className="flex w-full items-center gap-2 rounded-none px-2.5 py-2 text-left transition hover:bg-[rgba(15,23,38,0.05)]"
                      >
                        <svg
                          className={`h-3.5 w-3.5 shrink-0 text-[#6b7280] transition-transform duration-200 ${open ? "rotate-90" : ""}`}
                          fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                        <span className="flex-1 truncate text-[11px] font-bold uppercase tracking-[0.06em] text-[#334155]">
                          {sec.title}
                        </span>
                        <span className="font-mono text-[10px] tabular-nums text-[#B8B8BD]">
                          {secDone}/{sec.lessons.length}
                        </span>
                      </button>
                    )}
                    {sec.synthetic && (
                      <div className="px-2.5 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.06em] text-[#6b7280]">
                        {sec.title}
                      </div>
                    )}
                    {open && (
                      <ul className="mb-1 mt-0.5 space-y-0.5">
                        {sec.lessons.map((l) => {
                          const isActive = activeLesson?._id === l._id;
                          const isDone = doneSet.has(l._id);
                          return (
                            <li key={l._id}>
                              <button
                                type="button"
                                onClick={() => selectLesson(l)}
                                className={`group flex w-full items-center gap-2.5 rounded-none px-2.5 py-2 text-left transition ${
                                  isActive
                                    ? "bg-[rgba(16,128,202,0.07)] ring-1 ring-inset ring-[rgba(16,128,202,0.2)]"
                                    : "hover:bg-[rgba(15,23,38,0.05)]"
                                }`}
                              >
                                <span
                                  className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border ${
                                    isDone
                                      ? "border-[#19A463] bg-[#19A463] text-white"
                                      : isActive
                                        ? "border-[#1080CA]"
                                        : "border-[rgba(15,23,38,0.14)] group-hover:border-[rgba(15,23,38,0.22)]"
                                  }`}
                                >
                                  {isDone ? (
                                    <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={3.5} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  ) : isActive ? (
                                    <span className="h-[7px] w-[7px] rounded-full bg-[#1080CA]" />
                                  ) : null}
                                </span>
                                <span
                                  className={`flex-1 truncate text-[12.5px] leading-snug transition ${
                                    isActive
                                      ? "font-bold text-[#1080CA]"
                                      : isDone
                                        ? "text-[#6b7280]"
                                        : "text-[#334155] group-hover:text-[#0e1726]"
                                  }`}
                                >
                                  {l.title}
                                </span>
                                {l.videoUrl && (
                                  <svg className="h-3 w-3 shrink-0 text-[#C4C4C8]" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M8 5v14l11-7z" />
                                  </svg>
                                )}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* ─────────────── Lesson content pane ─────────────── */}
        <main ref={playerRef} className="order-1 min-w-0 lg:order-2">
          {activeLesson ? (
            <>
              <div className="overflow-hidden rounded-none border border-[rgba(15,23,38,0.10)] bg-black">
                <div className="relative aspect-video w-full bg-black">
                  {(() => {
                    const url = activeLesson.videoUrl || "";
                    const embed = getEmbedUrl(url);
                    const isUpload =
                      url.startsWith("/uploads/") || /\.(mp4|webm|mov)($|\?)/i.test(url);
                    const poster = url.match(/\/vid-[a-f0-9-]+\.mp4$/)
                      ? url.replace(/\.mp4$/, "-poster.jpg")
                      : activeLesson.thumbnail || course.coverImage || course.thumbnail || undefined;
                    if (embed) {
                      return (
                        <iframe
                          key={activeLesson._id}
                          src={embed + (userInitiated ? (embed.includes("?") ? "&autoplay=1" : "?autoplay=1") : "")}
                          className="absolute inset-0 h-full w-full"
                          allowFullScreen
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        />
                      );
                    }
                    if (isUpload) {
                      return (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <video
                          key={activeLesson._id}
                          poster={poster}
                          controls
                          autoPlay={userInitiated}
                          playsInline
                          preload="metadata"
                          controlsList="nodownload noplaybackrate"
                          disableRemotePlayback
                          disablePictureInPicture
                          onEnded={playNextLesson}
                          className="absolute inset-0 h-full w-full bg-black"
                        >
                          <source src={url} type={videoMimeFor(url)} />
                        </video>
                      );
                    }
                    if (url) {
                      return (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="absolute inset-0 flex items-center justify-center text-[14px] font-bold text-[#1080CA] hover:underline"
                        >
                          Гадаад видео нээх →
                        </a>
                      );
                    }
                    return (
                      <div className="absolute inset-0 flex items-center justify-center font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-white/40">
                        Видео алга
                      </div>
                    );
                  })()}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
                <h2
                  className="min-w-0 flex-1 text-[19px] font-extrabold leading-tight text-[#0e1726] sm:text-[23px]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {activeLesson.title}
                </h2>
                <button
                  type="button"
                  onClick={() => toggleDone(activeLesson._id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-none border px-3 py-2 text-[12px] font-bold transition ${
                    doneSet.has(activeLesson._id)
                      ? "border-[#19A463] bg-[rgba(25,164,99,0.08)] text-[#19A463]"
                      : "border-[rgba(15,23,38,0.10)] bg-black text-[#5b6573] hover:border-[rgba(16,128,202,0.4)] hover:text-[#1080CA]"
                  }`}
                >
                  <svg
                    className="h-4 w-4"
                    fill={doneSet.has(activeLesson._id) ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {doneSet.has(activeLesson._id) ? "Дууссан" : "Дуусгасан гэж тэмдэглэх"}
                </button>
              </div>

              {activeLesson.description && activeLesson.description.trim().length > 0 && (
                <div className="mt-3">
                  <LessonArticle content={activeLesson.description} />
                </div>
              )}

              {activeLesson.attachments && activeLesson.attachments.length > 0 && (
                <div className="mt-5 rounded-none border border-[rgba(15,23,38,0.10)] bg-black p-4">
                  <div className="mb-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#6b7280]">
                    Хавсралт
                  </div>
                  <ul className="space-y-1.5">
                    {activeLesson.attachments.map((a) => (
                      <li key={a.url}>
                        <a
                          href={a.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#334155] transition hover:text-[#1080CA]"
                        >
                          <svg className="h-4 w-4 shrink-0 text-[#6b7280]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                          </svg>
                          {a.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {activeLesson.task && (
                <Link
                  href={`/classroom/task/${activeLesson.task._id}`}
                  className="mt-5 flex items-center justify-between gap-3 rounded-none border border-[rgba(16,128,202,0.25)] bg-[rgba(16,128,202,0.04)] px-4 py-3.5 transition hover:border-[rgba(16,128,202,0.5)] hover:bg-[rgba(16,128,202,0.07)]"
                >
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#1080CA]">
                      Даалгавар
                    </div>
                    <div className="mt-0.5 truncate text-[13px] font-bold text-[#0e1726]">
                      {activeLesson.task.title}
                    </div>
                  </div>
                  <svg className="h-4 w-4 shrink-0 text-[#1080CA]" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
                  </svg>
                </Link>
              )}

              {(() => {
                const idx = allLessons.findIndex((l) => l._id === activeLesson._id);
                const prev = idx > 0 ? allLessons[idx - 1] : null;
                const next = idx >= 0 && idx < allLessons.length - 1 ? allLessons[idx + 1] : null;
                if (!prev && !next) return null;
                return (
                  <div className="mt-6 flex items-center justify-between gap-3 border-t border-[rgba(15,23,38,0.08)] pt-5">
                    {prev ? (
                      <button
                        type="button"
                        onClick={() => selectLesson(prev)}
                        className="group inline-flex max-w-[46%] items-center gap-2 text-left text-[12px] text-[#5b6573] transition hover:text-[#1080CA]"
                      >
                        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="truncate font-semibold">{prev.title}</span>
                      </button>
                    ) : <span />}
                    {next ? (
                      <button
                        type="button"
                        onClick={() => selectLesson(next)}
                        className="group inline-flex max-w-[46%] items-center gap-2 text-right text-[12px] font-semibold text-white"
                      >
                        <span className="truncate rounded-none bg-[#1080CA] px-3 py-2 transition group-hover:bg-[#4FA8E8]">
                          {next.title}
                        </span>
                      </button>
                    ) : <span />}
                  </div>
                );
              })()}
            </>
          ) : (
            <div className="rounded-none border-2 border-dashed border-[rgba(15,23,38,0.10)] p-14 text-center">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-[#6b7280]">
                Хичээл хоосон
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
// ─── Lesson card — YouTube-style: 16:9 thumbnail, Handjet pink title, desc ─
function LessonCard({
  lesson,
  index,
  admin,
  onChange,
  isActive = false,
  onPlay,
}: {
  lesson: LessonSummary;
  index: number;
  admin: boolean;
  onChange: () => void;
  isActive?: boolean;
  onPlay?: () => void;
}) {
  const hasAttachments = !!(lesson.attachments && lesson.attachments.length > 0);
  // When `onPlay` is provided we behave as an inline trigger (carousel mode);
  // otherwise we fall back to a navigational Link (legacy callers / direct
  // deep links).
  const Wrapper: React.ElementType = onPlay ? "button" : Link;
  const wrapperProps = onPlay
    ? ({ type: "button" as const, onClick: onPlay } as const)
    : ({ href: `/classroom/${lesson._id}` } as const);
  // Wrap in a relative div so the admin thumbnail-edit pill can live as a
  // sibling (rather than nested in the clickable Wrapper — invalid for a
  // <button> inside <button>).
  return (
    <div className="group relative">
      {admin && (
        <LessonThumbEditButton
          lessonId={lesson._id}
          hasThumb={!!lesson.thumbnail}
          onUpdate={onChange}
        />
      )}
    <Wrapper
      {...wrapperProps}
      className={`block w-full overflow-hidden rounded-none border bg-black text-left transition hover:shadow-[0_18px_40px_rgba(0,0,0,0.5)] ${
        isActive
          ? "border-[#1080CA] shadow-[0_0_20px_rgba(16,128,202,0.35)]"
          : "border-[rgba(15,23,38,0.10)] hover:border-[rgba(16,128,202,0.45)]"
      }`}
    >
      {/* 16:9 cover */}
      <div
        className="relative aspect-video w-full overflow-hidden bg-black"
        style={!lesson.thumbnail ? { background: gradientFor(lesson._id) } : undefined}
      >
        {lesson.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={lesson.thumbnail}
            alt={lesson.title}
            loading={index < 4 ? "eager" : "lazy"}
            className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        )}
        {/* Subtle bottom gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />

        {/* Play indicator removed — the thumbnail itself + the hover scale
            are enough affordance. Less visual clutter on each card. */}

        {/* Attachments badge — bottom right */}
        {hasAttachments && (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-none border border-[rgba(15,23,38,0.14)] bg-black/75 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white backdrop-blur">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
            </svg>
            {lesson.attachments!.length}
          </span>
        )}

        {/* Lesson order tag — top left (hidden when this is the playing card) */}
        {!isActive && (
          <span className="absolute left-2 top-2 rounded-none border border-[rgba(15,23,38,0.14)] bg-black/75 px-1.5 py-0.5 font-mono text-[9px] font-bold tabular-nums text-white backdrop-blur">
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
      </div>

      {/* Body — compact, tighter typographic rhythm */}
      <div className="p-2.5">
        <h3
          style={{
            fontWeight: 700,
            letterSpacing: "-0.005em",
            lineHeight: 1.25,
            color: "#F2F2F4",
          }}
          className="line-clamp-2 text-[12.5px] transition group-hover:text-white"
        >
          {lesson.title}
        </h3>
        {lesson.description && (
          <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-[#5b6573]">
            {lesson.description}
          </p>
        )}
      </div>

      {isActive && (
        <span className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-none border border-[rgba(16,128,202,0.5)] bg-[rgba(16,128,202,0.15)] px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-[#1080CA] backdrop-blur">
          <span className="h-1 w-1 animate-pulse rounded-full bg-[#1080CA] shadow-[0_0_6px_#1080CA]" />
          ОДОО ҮЗЭЖ БАЙНА
        </span>
      )}
    </Wrapper>
    </div>
  );
}

// ─── Lesson block: lesson row + its task (or admin add-task) underneath ───
function LessonBlock({ lesson, admin, onChange }: { lesson: LessonSummary; admin: boolean; onChange: () => void }) {
  const pdfCount = lesson.attachments?.length || 0;
  return (
    <div className="rounded-none border border-[rgba(15,23,38,0.08)] bg-black p-1.5">
      {/* Lesson row → /classroom/[id] */}
      <Link
        href={`/classroom/${lesson._id}`}
        className="group flex items-center gap-2 rounded-none px-2 py-1.5 transition hover:bg-[rgba(16,128,202,0.06)]"
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-none bg-[rgba(16,128,202,0.12)] text-[#1080CA]">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        </span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-[#334155] transition group-hover:text-[#1080CA]">
          {lesson.title}
        </span>
        {pdfCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-[rgba(15,23,38,0.06)] px-1.5 py-0.5 text-[9px] font-bold text-[#5b6573]">
            <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            {pdfCount}
          </span>
        )}
      </Link>

      {/* Per-lesson task UI removed in v20 */}
    </div>
  );
}

function Chevron({ open, small = false }: { open: boolean; small?: boolean }) {
  return (
    <svg
      className={`shrink-0 text-[#6b7280] transition-transform duration-200 ${small ? "h-3 w-3" : "h-4 w-4"} ${open ? "rotate-180" : ""}`}
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
    <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-none bg-[#1080CA] px-3 py-1.5 text-[11px] font-black text-[#0E0E10] transition hover:bg-[#4FA8E8]">
      <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
      Бүлэг
    </button>
  );
  return (
    <div className="flex items-center gap-1.5">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Шинэ бүлэг" autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") setOpen(false); }}
        className="rounded-none border border-[rgba(15,23,38,0.10)] bg-black px-2.5 py-1.5 text-[12px] text-[#0e1726] outline-none focus:border-[rgba(16,128,202,0.4)]" />
      <button onClick={submit} disabled={!title.trim() || busy} className="rounded-none bg-[#1080CA] px-3 py-1.5 text-[11px] font-black text-[#0E0E10] disabled:opacity-40">
        {busy ? "..." : "Нэмэх"}
      </button>
      <button onClick={() => { setOpen(false); setTitle(""); }} className="text-[11px] text-[#6b7280]">×</button>
    </div>
  );
}

function AddLessonInline({
  courseId, sectionId = "", nextOrder, onAdded, label,
}: {
  courseId: string;
  sectionId?: string;       // empty → orphan lesson (no section). Lessons API allows this.
  nextOrder: number;
  onAdded: () => void;
  label?: string;            // optional override for the closed-state button
}) {
  const videoRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [videoName, setVideoName] = useState("");
  const [videoSize, setVideoSize] = useState(0);
  const [videoUploading, setVideoUploading] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
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
    setVideoProgress(0);
    // XHR (not fetch) so we can stream progress events for multi-minute uploads.
    try {
      const data = await new Promise<{ url?: string; error?: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/classroom/upload-video");
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setVideoProgress(Math.round((ev.loaded / ev.total) * 100));
          }
        };
        xhr.onload = () => {
          try {
            const body = JSON.parse(xhr.responseText || "{}");
            if (xhr.status >= 200 && xhr.status < 300) resolve(body);
            else resolve({ error: body.error || `Upload алдаа (${xhr.status})` });
          } catch {
            resolve({ error: `Upload алдаа (${xhr.status})` });
          }
        };
        xhr.onerror = () => reject(new Error("Сүлжээний алдаа"));
        xhr.ontimeout = () => reject(new Error("Хугацаа дууссан"));
        const fd = new FormData();
        fd.append("file", file);
        xhr.send(fd);
      });
      if (!data.url) {
        setVideoError(data.error || "Upload алдаа");
        return;
      }
      setVideoUrl(data.url);
      setVideoName(file.name);
      setVideoSize(file.size);
      setTitle((t) => t.trim() || titleFromFilename(file.name));
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : "Upload алдаа");
    } finally {
      setVideoUploading(false);
      setVideoProgress(0);
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
      // Server-hosted files live under /uploads/. Anything else is treated as
      // a link (YouTube/Vimeo/external CDN/direct .mp4) — the lesson player
      // already handles both shapes.
      const videoType = videoUrl.startsWith("/uploads/") ? "upload" : "link";
      const res = await fetch("/api/classroom/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course: courseId,
          section: sectionId || undefined,  // omit when empty → orphan lesson
          title,
          videoUrl: videoUrl,
          videoType,
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
    <button onClick={() => setOpen(true)} className="mt-1 inline-flex items-center gap-1 rounded-none border border-dashed border-[rgba(15,23,38,0.12)] px-3 py-1.5 text-[10px] font-bold text-[#6b7280] hover:border-[rgba(16,128,202,0.3)] hover:text-[#1080CA]">
      {label || "+ Хичээл нэмэх"}
    </button>
  );

  return (
    <div className="mt-2 space-y-2 rounded-none border border-[rgba(15,23,38,0.10)] bg-black p-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Хичээлийн нэр (файл сонгоход автомат)" autoFocus
        className="w-full rounded-none border border-[rgba(15,23,38,0.10)] bg-black px-2.5 py-1.5 text-[12px] text-[#0e1726] outline-none focus:border-[rgba(16,128,202,0.4)]" />

      {/* Video file upload */}
      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#5b6573]">Видео файл</div>
        {videoUrl ? (
          <div className="flex items-center gap-2 rounded-none border border-[rgba(34,197,94,0.25)] bg-[rgba(16,128,202,0.04)] px-2.5 py-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none bg-[rgba(16,128,202,0.15)] text-[#1080CA]">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[11px] font-bold text-[#0e1726]">{videoName || "video"}</div>
              <div className="text-[10px] text-[#6b7280]">{formatSize(videoSize)} · хадгалагдсан</div>
            </div>
            <button onClick={() => { setVideoUrl(""); setVideoName(""); setVideoSize(0); }} className="text-[#6b7280] hover:text-[#1080CA]" aria-label="Устгах">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => videoRef.current?.click()}
            disabled={videoUploading}
            className="flex w-full items-center gap-2.5 rounded-none border-2 border-dashed border-[rgba(16,128,202,0.3)] bg-black px-3 py-2.5 text-left transition hover:border-[rgba(16,128,202,0.5)] disabled:opacity-50"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-none bg-[rgba(16,128,202,0.1)] text-[#1080CA]">
              {videoUploading ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-[#1080CA] border-t-transparent" />
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.6} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9A2.25 2.25 0 0013.5 5.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
              )}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block text-[12px] font-bold text-[#0e1726]">
                {videoUploading ? `Хадгалж байна... ${videoProgress}%` : "Видео сонгох"}
              </span>
              <span className="block text-[10px] text-[#6b7280]">MP4 / WebM / MOV · 200MB хүртэл</span>
            </span>
          </button>
        )}
        <input ref={videoRef} type="file" accept="video/*" onChange={handleVideoPick} className="hidden" />
        {videoUploading && (
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[rgba(15,23,38,0.08)]">
            <div className="h-full bg-[#1080CA] transition-all duration-200" style={{ width: `${videoProgress}%` }} />
          </div>
        )}
        {videoError && <div className="mt-1 text-[10px] text-[#1080CA]">{videoError}</div>}

        {/* OR paste a video URL — YouTube / Vimeo / direct .mp4 / external CDN.
            Mutually exclusive with file upload: typing here clears the file marker. */}
        <div className="mt-2 flex items-center gap-2 text-[10px] text-[#6b7280]">
          <span>эсвэл URL:</span>
          <input
            value={videoUrl.startsWith("/uploads/") ? "" : videoUrl}
            onChange={(e) => {
              setVideoUrl(e.target.value);
              setVideoName("");
              setVideoSize(0);
              setVideoError("");
            }}
            placeholder="https://youtube.com/... or https://cdn.../clip.mp4"
            className="flex-1 rounded-none border border-[rgba(15,23,38,0.10)] bg-black px-2.5 py-1 text-[11px] text-[#334155] outline-none focus:border-[rgba(16,128,202,0.4)]"
          />
        </div>
      </div>

      {/* PDF attachments */}
      <div>
        <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#5b6573]">PDF / Slide хавсралт</div>
        <button type="button" onClick={() => pdfRef.current?.click()} disabled={pdfUploading} className="inline-flex items-center gap-1 rounded-none border border-dashed border-[rgba(16,128,202,0.3)] px-2.5 py-1.5 text-[10px] font-bold text-[#1080CA] hover:bg-[rgba(16,128,202,0.05)] disabled:opacity-50">
          {pdfUploading ? "Хадгалж байна..." : "+ PDF нэмэх"}
        </button>
        <input ref={pdfRef} type="file" accept=".pdf,application/pdf" multiple onChange={handlePdfPick} className="hidden" />
        {pdfs.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {pdfs.map((p, i) => (
              <li key={i} className="flex items-center gap-1.5 text-[10px] text-[#5b6573]">
                <span className="rounded-none bg-[#F2F2F4] px-1 py-0.5 text-[8px] font-black text-[#1080CA]">PDF</span>
                <span className="truncate">{p.name}</span>
                <button onClick={() => setPdfs((arr) => arr.filter((_, j) => j !== i))} className="ml-auto text-[#6b7280] hover:text-[#1080CA]">×</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-1.5 pt-1">
        <button onClick={submit} disabled={!title.trim() || busy || videoUploading} className="rounded-none bg-[#1080CA] px-3 py-1.5 text-[11px] font-black text-[#0E0E10] disabled:opacity-40">
          {busy ? "Үүсгэж байна..." : "Үүсгэх"}
        </button>
        <button onClick={() => { setOpen(false); setTitle(""); setVideoUrl(""); setVideoName(""); setVideoSize(0); setPdfs([]); setVideoError(""); }} className="text-[11px] text-[#6b7280]">Болих</button>
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
    <button onClick={onDelete} className="ml-1 rounded-none p-1 text-[#6b7280] hover:bg-[rgba(16,128,202,0.1)] hover:text-[#1080CA]" aria-label="Устгах">
      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9M19.228 5.79L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79M7.5 5.79h9" /></svg>
    </button>
  );
}

// ─── Course cover picker ─────────────────────────────────────────────────
// Two ways in: upload an image file OR paste an external image URL.
// Cover is independent of `thumbnail` (listing card); hero falls back to
// thumbnail when cover is empty, so "Clear" reverts that gracefully.
function CourseCoverEditButton({
  courseId,
  hasCover,
  onUpdate,
}: { courseId: string; hasCover: boolean; onUpdate: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={hasCover ? "Cover засах" : "Cover нэмэх"}
        className="inline-flex items-center gap-1.5 rounded-none border border-[rgba(16,128,202,0.35)] bg-[rgba(16,128,202,0.08)] px-3 py-1.5 text-[11px] font-bold text-[#1080CA] transition hover:bg-[#1080CA] hover:text-white"
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
        {hasCover ? "Cover" : "+ Cover"}
        {hasCover && (
          <span className="ml-1 h-1.5 w-1.5 rounded-full bg-[#5DDF9F] shadow-[0_0_6px_rgba(93,223,159,0.6)]" />
        )}
      </button>
      <ImagePickerSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Course cover image"
        subtitle="Hero дээр харагдах зураг. Хоосон бол thumbnail-руу буцна."
        current={hasCover ? "set" : "empty"}
        canClear={hasCover}
        onSave={async (url) => {
          await fetch(`/api/classroom/courses/${courseId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ coverImage: url }),
          });
          onUpdate();
        }}
      />
    </>
  );
}

// ─── Reusable image picker sheet — file upload OR URL paste ──────────────
// Used by both course cover and lesson thumbnail flows. Centered modal,
// backdrop blur, esc-to-close, body scroll locked, optimistic preview.
function ImagePickerSheet({
  open,
  onClose,
  title,
  subtitle,
  current,
  canClear,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  current: "set" | "empty";
  canClear: boolean;
  onSave: (url: string) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setUrlInput("");
    setPreview(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const commit = async (url: string) => {
    setBusy(true);
    try {
      await onSave(url);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Local preview while the upload runs — feels instant.
    const localUrl = URL.createObjectURL(file);
    setPreview(localUrl);
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const up = await fetch("/api/upload", { method: "POST", body: fd });
      const upData = await up.json();
      if (!up.ok || !upData.url) {
        setBusy(false);
        return;
      }
      await commit(upData.url);
    } finally {
      URL.revokeObjectURL(localUrl);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const onSubmitUrl = async () => {
    const v = urlInput.trim();
    if (!v) return;
    setPreview(v);
    await commit(v);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[60] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-4"
      >
        <motion.div
          initial={{ y: 32, opacity: 0.6 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 32, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-[480px] max-h-[90vh] overflow-y-auto rounded-t-[8px] border-t border-[rgba(15,23,38,0.10)] bg-black sm:max-h-[85vh] sm:rounded-none sm:border"
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[rgba(15,23,38,0.10)] bg-black px-5 py-4">
            <div>
              <h2 className="text-[14px] font-black text-[#0e1726]">{title}</h2>
              {subtitle && <p className="mt-1 text-[11px] leading-relaxed text-[#5b6573]">{subtitle}</p>}
            </div>
            <button onClick={onClose} aria-label="Хаах" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-none text-[#6b7280] transition hover:bg-[rgba(15,23,38,0.08)] hover:text-[#0e1726]">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="space-y-4 p-5">
            {/* Preview slot */}
            <div className="aspect-[16/9] w-full overflow-hidden rounded-none border border-dashed border-[rgba(15,23,38,0.12)] bg-black">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-[0.2em] text-[#A1A1A6]">
                  {current === "set" ? "одоогийн зураг хадгалагдсан" : "зураг сонгоогүй"}
                </div>
              )}
            </div>

            {/* File upload — primary */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-none border border-[rgba(16,128,202,0.35)] bg-[rgba(16,128,202,0.06)] px-4 py-3 text-[13px] font-bold text-[#1080CA] transition hover:bg-[#1080CA] hover:text-white disabled:opacity-50"
            >
              {busy ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              )}
              {busy ? "Хадгалж байна..." : "Файлаас upload"}
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickFile} className="hidden" />

            <div className="flex items-center gap-3 text-[9px] uppercase tracking-[0.2em] text-[#6b7280]">
              <div className="h-px flex-1 bg-[rgba(15,23,38,0.08)]" />
              эсвэл URL-аар
              <div className="h-px flex-1 bg-[rgba(15,23,38,0.08)]" />
            </div>

            {/* URL paste — secondary */}
            <div className="space-y-2">
              <input
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && urlInput.trim()) onSubmitUrl(); }}
                placeholder="https://cdn.example.com/image.jpg"
                disabled={busy}
                className="w-full rounded-none border border-[rgba(15,23,38,0.10)] bg-black px-3 py-2.5 text-[13px] text-[#0e1726] placeholder-[#A1A1A6] outline-none transition focus:border-[rgba(16,128,202,0.4)] disabled:opacity-50"
              />
              <button
                type="button"
                onClick={onSubmitUrl}
                disabled={busy || !urlInput.trim()}
                className="w-full rounded-none border border-[rgba(15,23,38,0.10)] bg-black px-4 py-2.5 text-[12px] font-bold text-[#0e1726] transition hover:border-[rgba(16,128,202,0.4)] hover:text-white disabled:opacity-40"
              >
                Link-ийг ашиглах
              </button>
            </div>

            {canClear && (
              <button
                type="button"
                onClick={() => commit("")}
                disabled={busy}
                className="block w-full text-center text-[11px] font-semibold text-[#5b6573] transition hover:text-[#1080CA] disabled:opacity-40"
              >
                Зургийг устгах
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Per-lesson thumbnail picker ─────────────────────────────────────────
// Same sheet as the course cover, scoped to a single lesson. Renders as a
// small floating edit pill on the LessonCard for admins.
function LessonThumbEditButton({
  lessonId,
  hasThumb,
  onUpdate,
}: { lessonId: string; hasThumb: boolean; onUpdate: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        title={hasThumb ? "Зураг солих" : "Зураг нэмэх"}
        className="absolute right-2 top-2 z-20 inline-flex items-center gap-1 rounded-none border border-[rgba(16,128,202,0.4)] bg-black/75 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#1080CA] backdrop-blur-sm opacity-0 transition hover:bg-[#1080CA] hover:text-white group-hover:opacity-100"
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
        </svg>
        {hasThumb ? "edit" : "+ image"}
      </button>
      <ImagePickerSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Lesson thumbnail"
        subtitle="Хичээлийн картын дээр харагдах зураг."
        current={hasThumb ? "set" : "empty"}
        canClear={hasThumb}
        onSave={async (url) => {
          await fetch(`/api/classroom/lessons/${lessonId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ thumbnail: url }),
          });
          onUpdate();
        }}
      />
    </>
  );
}

// ─── Inline title editor (admin only) ───
// Click the title to edit. Enter saves, Esc cancels, blur saves if changed.
function CourseTitleEditor({ courseId, title, onSaved }: { courseId: string; title: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(title);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep local state aligned when the upstream value updates (after save).
  useEffect(() => { setVal(title); }, [title]);
  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const save = async () => {
    const next = val.trim();
    if (!next || next === title) { setEditing(false); setVal(title); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/classroom/courses/${courseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: next }),
      });
      if (res.ok) {
        onSaved();
        setEditing(false);
      }
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={val}
        disabled={busy}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); save(); }
          if (e.key === "Escape") { setEditing(false); setVal(title); }
        }}
        maxLength={120}
        className="block w-full rounded-none border border-[#1080CA] bg-black/70 px-2 py-1 text-[22px] font-black leading-tight text-white outline-none backdrop-blur-md sm:text-[28px]"
      />
    );
  }
  return (
    <h1
      onClick={() => setEditing(true)}
      title="Click to edit"
      style={{
        fontWeight: 600,
        letterSpacing: "-0.015em",
        lineHeight: 1.1,
        color: "#FFFFFF",
        textShadow: "0 2px 10px rgba(0,0,0,0.55)",
      }}
      className="group relative inline-block cursor-text rounded-none text-[22px] transition hover:opacity-90 sm:text-[28px] lg:text-[34px]"
    >
      {title}
      <svg className="ml-2 inline h-4 w-4 align-middle text-white/40 opacity-0 transition group-hover:opacity-100" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
      </svg>
    </h1>
  );
}

// ─── Inline description editor (admin only) ───
// Same pattern as the title editor, but textarea + Cmd/Ctrl+Enter to save.
function CourseDescEditor({ courseId, description, onSaved }: { courseId: string; description: string; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(description);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setVal(description); }, [description]);
  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      // Auto-resize once on open
      if (ref.current) {
        ref.current.style.height = "auto";
        ref.current.style.height = `${Math.min(ref.current.scrollHeight, 240)}px`;
      }
    }
  }, [editing]);

  const save = async () => {
    const next = val.trim();
    if (next === (description || "").trim()) { setEditing(false); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/classroom/courses/${courseId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: next }),
      });
      if (res.ok) {
        onSaved();
        setEditing(false);
      }
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={val}
        disabled={busy}
        onChange={(e) => {
          setVal(e.target.value);
          // grow with content
          e.currentTarget.style.height = "auto";
          e.currentTarget.style.height = `${Math.min(e.currentTarget.scrollHeight, 240)}px`;
        }}
        onBlur={save}
        onKeyDown={(e) => {
          // Cmd/Ctrl+Enter saves; plain Enter inserts a newline.
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
          }
          if (e.key === "Escape") { setEditing(false); setVal(description); }
        }}
        maxLength={500}
        placeholder="Курсын товч тайлбар…"
        className="mt-1.5 block w-full max-w-[640px] resize-none rounded-none border border-[#1080CA] bg-black/70 px-2 py-1 text-[12px] leading-relaxed text-white outline-none backdrop-blur-md sm:text-[13px]"
      />
    );
  }
  if (!description) {
    return (
      <p
        onClick={() => setEditing(true)}
        className="mt-1.5 cursor-text text-[12px] italic leading-relaxed text-white/40 transition hover:text-white/70 sm:text-[13px]"
      >
        + Тайлбар нэмэх
      </p>
    );
  }
  return (
    <p
      onClick={() => setEditing(true)}
      title="Click to edit"
      className="group mt-1.5 line-clamp-3 max-w-[640px] cursor-text rounded-none text-[12px] leading-relaxed text-white/75 transition hover:bg-black/20 hover:text-white sm:text-[13px]"
    >
      {description}
      <span className="ml-1 align-middle text-[10px] text-white/40 opacity-0 transition group-hover:opacity-100">✎</span>
    </p>
  );
}
