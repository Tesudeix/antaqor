"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "@/components/Icon";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMembership } from "@/lib/useMembership";
import UpgradeModal from "@/components/UpgradeModal";
import CourseCatalog from "@/components/CourseCatalog";
import { PLANS, TRACKS, hasPlanAccess, type PlanId } from "@/lib/plans";
import { track as trackEvent } from "@/lib/analytics";
import { Reveal, RevealGroup, RevealItem } from "@/components/landing/kit";

// ─── /classroom — the same funnel switch as "/" ───
// Guest → CourseLanding (7-day course sales page). Logged-in → the roadmap
// below: FOUNDATION → BUILDER → OPERATOR, every card carrying level, duration,
// lessons, output, plan required and lock state. Admin CRUD: /classroom/manage.

export default function ClassroomPage() {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-2 w-2 animate-pulse bg-[#2E29FF]" />
      </div>
    );
  }

  return status === "authenticated" ? <ClassroomRoadmap /> : <CourseCatalog />;
}

interface Course {
  _id: string;
  title: string;
  description: string;
  thumbnail?: string;
  coverImage?: string;
  lessonsCount: number;
  totalDurationSec?: number;
  track?: "foundation" | "builder" | "operator";
  requiredPlan?: PlanId;
  outcome?: string;
  durationMin?: number;
  comingSoon?: boolean;
  doneCount?: number; // серверийн явц (completedBy) — localStorage-той нэгтгэнэ
}

function fmtDur(course: Course): string {
  const sec = course.totalDurationSec || 0;
  if (sec > 0) {
    const m = Math.round(sec / 60);
    return m >= 60 ? `${Math.floor(m / 60)}ц ${m % 60}мин` : `${m} мин`;
  }
  if (course.durationMin) {
    const m = course.durationMin;
    return m >= 60 ? `~${Math.floor(m / 60)}ц ${m % 60 || ""}${m % 60 ? "мин" : ""}` : `~${m} мин`;
  }
  return "";
}

function ClassroomRoadmap() {
  const { data: session } = useSession();
  const { isAdmin: admin } = useMembership();
  const [courses, setCourses] = useState<Course[]>([]);
  const [myPlan, setMyPlan] = useState<PlanId>("free");
  const [loading, setLoading] = useState(true);
  const [upgrade, setUpgrade] = useState<{ plan: PlanId; context: string } | null>(null);

  useEffect(() => {
    fetch("/api/classroom/courses")
      .then((r) => r.json())
      .then((d) => setCourses(d.courses || []))
      .finally(() => setLoading(false));
    if (session) {
      fetch("/api/clan/status")
        .then((r) => r.json())
        .then((d) => { if (d?.plan) setMyPlan(d.plan as PlanId); })
        .catch(() => {});
    }
  }, [session]);

  // Үзсэн хичээлийн тоо — курс үзэх хуудас бичдэг түлхүүрийг л уншина.
  // Төхөөрөмж тус бүрд, mount-ийн дараа → SSR-тэй зөрчилдөхгүй.
  const [done, setDone] = useState<Record<string, number>>({});
  useEffect(() => {
    if (courses.length === 0) return;
    const out: Record<string, number> = {};
    for (const c of courses) {
      try {
        const raw = localStorage.getItem(`antaqor:course:${c._id}:done`);
        const arr = raw ? JSON.parse(raw) : null;
        if (Array.isArray(arr) && arr.length > 0) out[c._id] = arr.length;
      } catch {
        /* corrupt entry — ignore, progress is a nicety not a source of truth */
      }
    }
    setDone(out);
  }, [courses]);

  /* ─── НИЙТ ЯВЦ ────────────────────────────────────────────────────
     Хуудас курс бүрийн явцыг тусад нь харуулдаг ч "би НИЙТДЭЭ хаана
     байна вэ" гэдэгт хэзээ ч хариулдаггүй байв — суралцагчийн хамгийн
     эхний асуулт нь яг тэр. Түгжээтэй курсыг тооцохгүй: аваагүй зүйл
     дээрээ хоцорсон мэт харагдах нь худал бөгөөд урам хугална. */
  const overall = useMemo(() => {
    let lessons = 0;
    let finished = 0;
    for (const c of courses) {
      if (c.comingSoon || !c.lessonsCount) continue;
      const raw = (c.requiredPlan || "free") as PlanId;
      const req: PlanId = raw === "free" ? "starter" : raw;
      if (!(hasPlanAccess(myPlan, req) || admin)) continue;
      lessons += c.lessonsCount;
      finished += Math.min(Math.max(done[c._id] || 0, c.doneCount || 0), c.lessonsCount);
    }
    return { lessons, finished, pct: lessons > 0 ? Math.round((finished / lessons) * 100) : 0 };
  }, [courses, done, myPlan, admin]);

  const byTrack = useMemo(() => {
    const m = new Map<string, Course[]>();
    for (const t of TRACKS) m.set(t.id, []);
    for (const c of courses) {
      const t = c.track && m.has(c.track) ? c.track : "foundation";
      m.get(t)!.push(c);
    }
    return m;
  }, [courses]);

  // Скелетон — эцсийн layout-тай ижил хэмжээтэй тул хуудас "үсрэхгүй".
  if (loading) {
    return (
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 lg:px-6" aria-busy="true">
        {/* Жинхэнэ агуулга нь утсан дээр хэвтээ зурвас, lg дээр сүлжээ —
            скелетон ЯГ түүнийг дуурайх ёстой. Өмнө нь энэ 2 баганат сүлжээ
            байсан нь өөрийнхөө тайлбарт бичсэн "үсрэхгүй" гэдгийг зөрчиж,
            ачаалал дуусахад зохиомж бүхэлдээ солигддог байв. */}
        {/* Скелетон нь эцсийн зохиомжийн ХЭЛБЭРИЙГ дуурайна — 16:9 хавтас
            дээр доод бие. Өөр хэлбэртэй скелетон нь ачаалал дуусахад
            хуудсыг үсрүүлдэг, тэр үсрэлт нь удаан мэдрэмж төрүүлнэ. */}
        <div className="mb-7 h-8 w-44 rounded-[4px] skeleton-brand" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-[4px] bg-[var(--chrome-bg,#0A0A0A)]">
              <div className="aspect-video w-full skeleton-brand" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-3/5 rounded-[3px] skeleton-brand" />
                <div className="h-3 w-1/4 rounded-[3px] skeleton-brand" />
              </div>
            </div>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 lg:px-6">
      {/* Хуудас өмнө нь ШУУД картуудаас эхэлдэг байв — нэргүй, хэмжүүргүй. */}
      <Reveal className="mb-6">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="text-[24px] font-extrabold leading-none tracking-[-0.02em] text-[var(--nav-fg-strong)] sm:text-[28px]">
            Сургалт
          </h1>
          {overall.lessons > 0 && (
            <span className="text-[12.5px] font-bold tabular-nums text-[#E2E4E8]">
              {overall.finished}/{overall.lessons} хичээл
              <span className="ml-2" style={{ color: "var(--accent-ink, #2E29FF)" }}>{overall.pct}%</span>
            </span>
          )}
        </div>
        {overall.lessons > 0 && (
          <div className="mt-3 h-[3px] w-full overflow-hidden bg-[rgba(128,128,128,0.2)]">
            <div className="h-full bg-[#2E29FF] transition-all duration-700" style={{ width: `${overall.pct}%` }} />
          </div>
        )}
      </Reveal>

      {admin && (
        <Reveal className="mb-6 flex justify-end">
          <Link href="/classroom/manage" className="chrome rounded-[4px] bg-[#1E1E1E] px-4 py-2 text-[11px] text-[#E2E4E8] hover:text-[#2E29FF]">
            УДИРДАХ →
          </Link>
        </Reveal>
      )}

      {/* Үргэлжлүүлэх — эхэлсэн ч дуусаагүй хамгийн ахисан курс. Хүн орж
          ирээд "хаана байсан билээ" гэж хайхгүй: нэг картанд, дээр нь. */}
      {(() => {
        const cont = courses
          .map((c) => ({ c, d: Math.min(Math.max(done[c._id] || 0, c.doneCount || 0), c.lessonsCount || 0) }))
          .filter((x) => x.d > 0 && x.d < (x.c.lessonsCount || 0))
          .sort((a, b) => b.d / (b.c.lessonsCount || 1) - a.d / (a.c.lessonsCount || 1))[0];
        if (!cont) return null;
        const p = Math.round((cont.d / (cont.c.lessonsCount || 1)) * 100);
        return (
          <Reveal className="mb-8">
            <Link
              href={`/classroom/course/${cont.c._id}`}
              className="group flex items-center gap-4 rounded-[4px] p-4 transition duration-300 hover:-translate-y-0.5"
              style={{ background: "var(--chrome-bg,#F8F9FD)", border: "1px solid rgba(46,41,255,0.4)" }}
            >
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#2E29FF]">Үргэлжлүүлэх</div>
                <div className="mt-1 truncate text-[16px] font-bold text-[var(--nav-fg-strong)]">{cont.c.title}</div>
                <div className="mt-2.5 h-[3px] w-full overflow-hidden bg-[rgba(128,128,128,0.2)]">
                  <div className="h-full bg-[#2E29FF] transition-all duration-700" style={{ width: `${p}%` }} />
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[22px] font-black tabular-nums text-[var(--nav-fg-strong)]">{p}%</div>
                <div className="text-[10px] text-[#E2E4E8]">{cont.d}/{cont.c.lessonsCount} хичээл</div>
              </div>
            </Link>
          </Reveal>
        );
      })()}

      {courses.length === 0 && (
        <div className="rounded-[4px] border border-[#262626] px-6 py-16 text-center">
          <p className="text-[14px] text-[#E2E4E8]">Курс алга байна.</p>
          {admin && (
            <Link
              href="/classroom/manage"
              className="chrome mt-4 inline-block rounded-[4px] bg-[#1E1E1E] px-4 py-2 text-[11px] text-[#E2E4E8] hover:text-[#2E29FF]"
            >
              КУРС НЭМЭХ →
            </Link>
          )}
        </div>
      )}

      <div className="space-y-14">
        {TRACKS.map((t) => {
          const list = byTrack.get(t.id) || [];
          if (list.length === 0) return null;
          return (
            <section key={t.id}>
              {/* Утсан дээр нэр ба тайлбар нэг мөрөнд шахагдаж, тайлбар нь
                  хоёр үг үлдээд тасардаг байв. Одоо тайлбар өөрийн мөртэй. */}
              <Reveal className="mb-4 border-b border-[#262626] pb-3.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="tag">{t.name}</span>
                  <span className="shrink-0 text-[11px] font-bold tabular-nums text-[#E2E4E8]">
                    {list.length} курс
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-snug text-[#E2E4E8]">{t.desc}</p>
              </Reveal>
              {/* ХЭВТЭЭ ГҮЙЛГЭЭГ ХАСАВ. Зам бүр өөрийн хэвтээ зурвастай
                  байсан нь гурван асуудал үүсгэв: (1) баруун талд үлдсэн
                  курсыг хэн ч олохгүй — хэвтээ агуулгыг хүн дунджаар нэг л
                  удаа гүйлгэдэг; (2) энэ хуудас нь ЗАМЫН ЗУРАГ, хэвтээ
                  зурвас нь дарааллыг нуудаг; (3) босоо гүйлгэж яваад
                  санамсаргүй хэвтээ зурвас барих нь түгээмэл алдаа.
                  Одоо утсан дээр 2 багана — бүх курс нэг дор. */}
              {/* Landscape хавтас нь өргөн — утсан дээр 2 багана болговол
                  16:9 зураг 170px өргөн болж, юу ч харагдахгүй. Нэг багана
                  нь хавтсыг бүтнээр нь харуулна. */}
              <RevealGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
                {list.map((c) => {
                  // Business rule: no free courses — everything needs at least Runner.
                  const rawPlan = (c.requiredPlan || "free") as PlanId;
                  const reqPlan: PlanId = rawPlan === "free" ? "starter" : rawPlan;
                  const unlocked = hasPlanAccess(myPlan, reqPlan) || admin;
                  const soon = !!c.comingSoon;
                  const dur = fmtDur(c);
                  const cover = c.coverImage || c.thumbnail || "";
                  const doneCount = Math.min(Math.max(done[c._id] || 0, c.doneCount || 0), c.lessonsCount || 0);
                  const pct =
                    c.lessonsCount > 0 && !soon ? Math.round((doneCount / c.lessonsCount) * 100) : 0;
                  const inner = (
                    /* ─── LANDSCAPE КАРТ ─────────────────────────────────
                       16:9 хавтас ДЭЭД талд, мэдээлэл ДООД биед. Босоо
                       постер дээр текст давхарлах нь зургийг нуудаг байсан;
                       хоёр давхарга салснаар хавтас бүтнээрээ харагдаж,
                       текст нь өөрийн тайван дэвсгэр дээр уншигдана.

                       СААРАЛ ХҮРЭЭ БАЙХГҮЙ. Карт нь хуудаснаас өөрийн
                       гадаргуугаар (чиг бараан) ялгарна — хүрээ нь зөвхөн
                       дуу чимээ нэмдэг. Идэвхжихэд л улаан хүрээ гарна. */
                    <div
                      className={`group flex h-full w-full flex-col overflow-hidden rounded-[4px] transition duration-300 ${
                        soon
                          ? "bg-[var(--chrome-bg,#0A0A0A)] opacity-60"
                          : "bg-[var(--chrome-bg,#0A0A0A)] hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(0,0,0,0.4)]"
                      }`}
                    >
                      <div className="relative aspect-video w-full shrink-0 overflow-hidden bg-[rgba(128,128,128,0.10)]">
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={cover}
                            alt=""
                            loading="lazy"
                            className={`absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04] ${
                              !unlocked && !soon ? "opacity-45 grayscale" : ""
                            }`}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-[26px] font-bold text-[#262626]">{t.name.slice(0, 2)}</span>
                          </div>
                        )}
                        {/* Төлөв — зөвхөн хэрэгтэй үед. Нээлттэй курс дээр
                            "нээлттэй" гэж бичих нь мэдээлэл биш, чимэг. */}
                        {(soon || !unlocked) && (
                          <span className="absolute right-2.5 top-2.5 flex items-center gap-1 rounded-[3px] bg-black/65 px-2 py-1 text-[10px] font-bold backdrop-blur-[2px]"
                            style={{ color: soon ? "rgba(255,255,255,0.7)" : "#d9a441" }}>
                            {soon ? "Удахгүй" : <><Icon name="lock" size={12} /> {PLANS[reqPlan].name}</>}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-1 flex-col p-4">
                        <div className="line-clamp-2 text-[15px] font-bold leading-snug text-[var(--nav-fg-strong)]">{c.title}</div>
                        {c.outcome && (
                          <div className="mt-1.5 line-clamp-2 text-[12.5px] leading-snug text-[#E2E4E8]">
                            {c.outcome}
                          </div>
                        )}
                        <div className="mt-auto pt-3.5">
                          {!soon && c.lessonsCount > 0 && (
                            <div
                              className="mb-2.5 h-[3px] w-full overflow-hidden bg-[rgba(128,128,128,0.18)]"
                              role="progressbar"
                              aria-valuenow={pct}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              aria-label={`${doneCount}/${c.lessonsCount} хичээл`}
                            >
                              <div className="h-full bg-[#2E29FF] transition-all duration-700" style={{ width: `${pct}%` }} />
                            </div>
                          )}
                          <div className="flex items-center gap-3 text-[11.5px] text-[#E2E4E8]" style={{ fontVariantNumeric: "tabular-nums" }}>
                            <span>{soon ? "Бэлтгэж байна" : c.lessonsCount > 0 ? `${c.lessonsCount} хичээл` : "Бэлтгэж байна"}</span>
                            {dur && <span>· {dur}</span>}
                            {!soon && c.lessonsCount > 0 && (
                              <span className="ml-auto font-bold text-[#2E29FF]">
                                {pct >= 100 ? "Дууссан ✓" : pct > 0 ? `${doneCount}/${c.lessonsCount} →` : unlocked ? "Эхлэх →" : ""}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                  if (soon) return <RevealItem key={c._id}>{inner}</RevealItem>;
                  if (unlocked) {
                    return (
                      <RevealItem key={c._id}>
                        <Link href={`/classroom/course/${c._id}`} className="block h-full w-full">
                          {inner}
                        </Link>
                      </RevealItem>
                    );
                  }
                  return (
                    <RevealItem key={c._id}>
                      <button
                        className="block h-full w-full text-left"
                        onClick={() => {
                          trackEvent("premium_course_locked_viewed", { course: c.title });
                          setUpgrade({ plan: reqPlan, context: c.title });
                        }}
                      >
                        {inner}
                      </button>
                    </RevealItem>
                  );
                })}
              </RevealGroup>
            </section>
          );
        })}
      </div>

      {upgrade && (
        <UpgradeModal
          requiredPlan={upgrade.plan}
          contextTitle={upgrade.context}
          unlocks={["Энэ курсын бүх хичээл", ...PLANS[upgrade.plan === "free" ? "starter" : upgrade.plan].benefits.slice(0, 3)]}
          onClose={() => setUpgrade(null)}
        />
      )}
    </main>
  );
}
