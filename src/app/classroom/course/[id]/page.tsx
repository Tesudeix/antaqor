"use client";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMembership } from "@/lib/useMembership";
import { LessonArticle } from "@/components/classroom/LessonArticle";
import CourseReviews from "@/components/classroom/CourseReviews";
import UpgradeModal from "@/components/UpgradeModal";
import { type PlanId } from "@/lib/plans";
import s from "@/components/classroom/skool.module.css";

/* Classroom — Skool маягийн хоёр баганатай байрлал.
   Зүүн: курсын нэр + явц + бүлэг (accordion) → хичээл (✓ үзсэн).
   Баруун: гарчиг + "дуусгах" · 16:9 видео · тайлбар · материал.
   Утсанд нэг багана; бүлгийн жагсаалт доороос гарах drawer болно. */

type Material = { url: string; name: string; size?: number; kind?: "file" | "link" };
type Lesson = {
  _id: string; title: string; description?: string; content?: string; thumbnail?: string; videoUrl?: string;
  durationSec?: number; order: number; scheduled?: boolean; premiumLocked?: boolean; releaseAt?: string;
  done?: boolean; attachments?: Material[]; task?: { _id: string; title: string };
};
type Group = { _id: string; title: string; order: number; lessons: Lesson[]; legacyTask?: { _id: string; title: string } };
type Course = { _id: string; title: string; description: string; thumbnail?: string; coverImage?: string };

function embedUrl(raw: string) {
  try {
    const u = new URL(raw); const host = u.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "youtu.be" || host === "m.youtube.com") {
      const id = host === "youtu.be" ? u.pathname.slice(1) : u.searchParams.get("v") || u.pathname.split("/")[2];
      if (id && /^[\w-]+$/.test(id)) return `https://www.youtube.com/embed/${id}?rel=0`;
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id && /^\d+$/.test(id)) return `https://player.vimeo.com/video/${id}`;
    }
  } catch { /* local upload */ }
  return null;
}
function duration(sec?: number) { return sec ? `${Math.floor(sec / 60)}:${String(Math.round(sec) % 60).padStart(2, "0")}` : ""; }
function size(n?: number) { return !n ? "" : n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`; }
function ext(m: Material) {
  if (m.kind === "link") return "LINK";
  const e = (m.url.split("?")[0].split(".").pop() || "").toUpperCase();
  return e.length <= 4 ? e : "FILE";
}

const Check = ({ className }: { className?: string }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
const Chevron = ({ open }: { open: boolean }) => <svg className={`${s.chev} ${open ? s.chevOpen : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 9l6 6 6-6" /></svg>;

export default function CoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const membership = useMembership();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeId, setActiveId] = useState("");
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [drawer, setDrawer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [locked, setLocked] = useState<PlanId | null>(null);
  const [autoplay, setAutoplay] = useState(false);
  const [autoNext, setAutoNext] = useState(true);
  const [saving, setSaving] = useState(false);
  const [playerError, setPlayerError] = useState("");

  useEffect(() => { if (!membership.loading && !membership.isLoggedIn) router.replace("/auth/signup"); }, [membership.loading, membership.isLoggedIn, router]);

  useEffect(() => {
    if (!membership.isLoggedIn) return;
    let cancelled = false;
    setLoading(true); setError("");
    fetch(`/api/classroom/courses/${id}/tree`).then(async (res) => {
      const data = await res.json(); if (!res.ok) throw new Error(data.error || "Курс ачаалсангүй");
      if (cancelled) return;
      const next: Group[] = (data.sections || []).sort((a: Group, b: Group) => a.order - b.order).map((g: Group) => ({ ...g, lessons: g.lessons.sort((a, b) => a.order - b.order) }));
      if (data.orphanLessons?.length) next.push({ _id: "other", title: next.length ? "Бусад хичээл" : "Бүх хичээл", order: 999, lessons: data.orphanLessons });
      const list = next.flatMap((g) => g.lessons);
      const wanted = typeof location !== "undefined" ? new URLSearchParams(location.search).get("lesson") : null;
      const first = list.find((l) => l._id === wanted) || list.find((l) => !l.done && !l.scheduled && !l.premiumLocked) || list[0];
      const home = next.find((g) => g.lessons.some((l) => l._id === first?._id)) || next[0];
      setCourse(data.course); setGroups(next); setActiveId(first?._id || "");
      setOpenIds(home ? { [home._id]: true } : {});
      setLocked(data.locked ? data.requiredPlan : null);
    }).catch((e) => { if (!cancelled) setError(e.message); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id, membership.isLoggedIn]);

  useEffect(() => {
    if (!drawer) return;
    const old = document.body.style.overflow; document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawer(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = old; window.removeEventListener("keydown", onKey); };
  }, [drawer]);

  const lessons = useMemo(() => groups.flatMap((g) => g.lessons), [groups]);
  const active = lessons.find((l) => l._id === activeId);
  const activeGroup = groups.find((g) => g.lessons.some((l) => l._id === activeId));
  const completed = lessons.filter((l) => l.done).length;
  const percent = lessons.length ? Math.round((completed / lessons.length) * 100) : 0;
  const index = lessons.findIndex((l) => l._id === activeId);
  const open = (l: Lesson) => !l.scheduled && !l.premiumLocked;
  const previous = lessons.slice(0, Math.max(index, 0)).reverse().find(open);
  const next = lessons.slice(index + 1).find(open);

  const select = useCallback((lesson: Lesson, auto = false) => {
    setActiveId(lesson._id); setAutoplay(auto); setPlayerError(""); setDrawer(false);
    setOpenIds((o) => { const g = groups.find((x) => x.lessons.some((l) => l._id === lesson._id)); return g ? { ...o, [g._id]: true } : o; });
    try { history.replaceState(null, "", `?lesson=${lesson._id}`); } catch { /* */ }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [groups]);

  async function markDone(value: boolean) {
    if (!active || saving || !open(active)) return;
    const lessonId = active._id; setSaving(true); setPlayerError("");
    try {
      const res = await fetch(`/api/classroom/lessons/${lessonId}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ done: value }) });
      if (!res.ok) throw new Error();
      setGroups((gs) => gs.map((g) => ({ ...g, lessons: g.lessons.map((l) => (l._id === lessonId ? { ...l, done: value } : l)) })));
    } catch { setPlayerError("Явцыг хадгалж чадсангүй. Дахин оролдоно уу."); }
    finally { setSaving(false); }
  }

  if (membership.loading || !membership.isLoggedIn || loading) return <div className={s.state} role="status">Хичээлүүдийг ачаалж байна…</div>;
  if (error || !course) return <div className={s.state}><p role="alert">{error || "Курс олдсонгүй"}</p><button onClick={() => location.reload()}>Дахин ачаалах</button><Link href="/classroom">Бүх курс</Link></div>;
  if (locked) return <UpgradeModal requiredPlan={locked} contextTitle={course.title} unlocks={["Энэ курсын бүх хичээл"]} onClose={() => router.push("/classroom")} />;

  const embed = embedUrl(active?.videoUrl || "");
  const playable = !!active && open(active);
  const native = !!active?.videoUrl && (active.videoUrl.startsWith("/uploads/") || /\.(mp4|webm|mov|m4v|ogg)(\?|$)/i.test(active.videoUrl));
  const materials = playable ? active?.attachments || [] : [];

  return (
    <div className={s.page}>
      <div className={s.topbar}>
        <Link href="/classroom">← Бүх курс</Link>
        {membership.isAdmin && <Link href={`/admin/classroom/courses/${id}`}>Курс удирдах ↗</Link>}
      </div>

      <button className={s.mobileBar} onClick={() => setDrawer(true)} aria-haspopup="dialog">
        <span className={s.mobileBarText}><b>{activeGroup?.title || course.title}</b><small>Хичээл {index + 1} / {lessons.length} · {percent}%</small></span>
        <span className={s.mobileBarBtn}>Жагсаалт ☰</span>
      </button>
      {drawer && <div className={s.backdrop} onClick={() => setDrawer(false)} aria-hidden />}

      <div className={s.layout}>
        <aside className={`${s.sidebar} ${drawer ? s.drawerOpen : ""}`} aria-label="Хичээлийн жагсаалт">
          <div className={s.sideHead}>
            <div className={s.sideTitleRow}>
              <h2 className={s.courseTitle}>{course.title}</h2>
              <button className={s.closeDrawer} onClick={() => setDrawer(false)} aria-label="Хаах">✕</button>
            </div>
            <div className={s.bar} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Курсын явц">
              <span style={{ width: `${percent}%` }} /><b>{percent}%</b>
            </div>
            <p className={s.barSub}><span>{completed} / {lessons.length} хичээл дууссан</span><b>{percent}%</b></p>
          </div>
          <nav className={s.chapters}>
            {groups.map((g) => {
              const isOpen = !!openIds[g._id];
              const done = g.lessons.filter((l) => l.done).length;
              return (
                <section key={g._id} className={s.chapter}>
                  <button className={s.chapterHead} aria-expanded={isOpen} onClick={() => setOpenIds((o) => ({ ...o, [g._id]: !o[g._id] }))}>
                    <span className={s.chapterName}>{g.title}</span>
                    <span className={s.chapterCount}>{done}/{g.lessons.length}</span>
                    <Chevron open={isOpen} />
                  </button>
                  {isOpen && <ul className={s.lessonList}>
                    {g.lessons.map((l) => {
                      const lockedRow = !open(l);
                      return (
                        <li key={l._id}>
                          <button className={`${s.lesson} ${activeId === l._id ? s.lessonActive : ""}`} onClick={() => select(l)} aria-current={activeId === l._id ? "true" : undefined} title={l.title}>
                            <span className={`${s.tick} ${l.done ? s.tickDone : ""}`} aria-label={l.done ? "Үзсэн" : lockedRow ? "Түгжээтэй" : "Үзээгүй"}>
                              {l.done ? <Check className={s.tickIcon} /> : lockedRow ? <span className={s.lockGlyph}>🔒</span> : null}
                            </span>
                            <span className={s.lessonTitle}>{l.title}</span>
                            {!!l.attachments?.length && <span className={s.clip} title={`${l.attachments.length} материал`}>📎</span>}
                          </button>
                        </li>
                      );
                    })}
                    {!g.lessons.length && <li className={s.noLessons}>Хичээл удахгүй нэмэгдэнэ.</li>}
                    {g.legacyTask && <li><Link className={s.groupTask} href={`/classroom/task/${g.legacyTask._id}`}>Бүлгийн даалгавар · {g.legacyTask.title} →</Link></li>}
                  </ul>}
                </section>
              );
            })}
          </nav>
        </aside>

        <main className={s.main}>
          {active ? (
            <article className={s.card}>
              <header className={s.lessonHead}>
                <h1>{active.title}</h1>
                {playable && (
                  <button className={`${s.doneBtn} ${active.done ? s.doneOn : ""}`} disabled={saving} onClick={() => void markDone(!active.done)} aria-pressed={!!active.done}>
                    <Check className={s.doneIcon} />{active.done ? "Дууссан" : "Дуусгах"}
                  </button>
                )}
              </header>
              {playerError && <p role="alert" className={s.error}>{playerError}</p>}

              {(active.videoUrl || !playable) && (
                <div className={s.player}>
                  {!playable ? (
                    <div className={s.locked}><span>🔒</span><h2>{active.scheduled ? "Тун удахгүй нээгдэнэ" : "Гишүүнчлэл шаардлагатай"}</h2><p>{active.scheduled && active.releaseAt ? new Date(active.releaseAt).toLocaleString("mn-MN") : "Энэ хичээлийг үзэх эрхээ шинэчилнэ үү."}</p></div>
                  ) : embed ? (
                    <iframe key={active._id} title={active.title} src={embed + (autoplay ? (embed.includes("?") ? "&" : "?") + "autoplay=1" : "")} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
                  ) : native ? (
                    <video key={active._id} src={active.videoUrl} poster={active.thumbnail || course.coverImage || course.thumbnail} controls controlsList="nodownload" playsInline autoPlay={autoplay} preload="metadata"
                      onError={() => setPlayerError("Видео ачаалсангүй. Холболтоо шалгаад дахин оролдоно уу.")}
                      onEnded={() => { void markDone(true); if (autoNext && next) select(next, true); }} />
                  ) : (
                    <a className={s.extVideo} href={active.videoUrl} target="_blank" rel="noopener noreferrer">Видео нээх ↗</a>
                  )}
                </div>
              )}

              {playable && (active.description || active.content) && (
                <div className={s.article}>
                  {active.description && <LessonArticle content={active.description} />}
                  {active.content && <LessonArticle content={active.content} />}
                </div>
              )}

              {!!materials.length && (
                <section className={s.materials} aria-label="Хичээлийн материал">
                  <h3>Хичээлийн материал <span>{materials.length}</span></h3>
                  <ul>
                    {materials.map((m, i) => (
                      <li key={m.url + i}>
                        <span className={s.fileBadge}>{ext(m)}</span>
                        <span className={s.fileInfo}><b title={m.name}>{m.name}</b>{size(m.size) && <small>{size(m.size)}</small>}</span>
                        <a href={m.url} target="_blank" rel="noopener noreferrer">{m.kind === "link" ? "Нээх ↗" : "Нээх"}</a>
                        {m.kind !== "link" && <a href={m.url} download={m.name}>Татах</a>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {playable && active.task && <Link className={s.task} href={`/classroom/task/${active.task._id}`}>Даалгавар · {active.task.title} →</Link>}
              {playable && !active.videoUrl && !active.description && !active.content && !materials.length && !active.task && <p className={s.emptyNote}>Энэ хичээлд контент хараахан нэмэгдээгүй байна.</p>}

              <nav className={s.lessonNav} aria-label="Хичээл солих">
                <button disabled={!previous} onClick={() => previous && select(previous)}>← Өмнөх</button>
                <label className={s.autoNext}><input type="checkbox" checked={autoNext} onChange={(e) => setAutoNext(e.target.checked)} /> Дараагийнх автоматаар</label>
                <button className={s.nextBtn} disabled={!next} onClick={() => next && select(next)}>Дараагийн хичээл →</button>
              </nav>
            </article>
          ) : <div className={s.state}>Энэ курст хичээл удахгүй нэмэгдэнэ.</div>}

          <details className={s.reviewsBox}>
            <summary>Курсын үнэлгээ</summary>
            <CourseReviews courseId={id} />
          </details>
        </main>
      </div>
    </div>
  );
}
