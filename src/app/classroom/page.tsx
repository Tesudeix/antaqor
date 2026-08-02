"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMembership } from "@/lib/useMembership";
import UpgradeModal from "@/components/UpgradeModal";
import CourseLanding from "@/components/CourseLanding";
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
        <div className="h-2 w-2 animate-pulse bg-[#1080CA]" />
      </div>
    );
  }

  return status === "authenticated" ? <ClassroomRoadmap /> : <CourseLanding />;
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

const TRACK_LABEL: Record<string, string> = {
  foundation: "Анхан",
  builder: "Дунд",
  operator: "Ахисан",
};

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

  const byTrack = useMemo(() => {
    const m = new Map<string, Course[]>();
    for (const t of TRACKS) m.set(t.id, []);
    for (const c of courses) {
      const t = c.track && m.has(c.track) ? c.track : "foundation";
      m.get(t)!.push(c);
    }
    return m;
  }, [courses]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-2 w-2 animate-pulse bg-[#1080CA]" />
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6">
      <Reveal className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="chrome mb-2 flex items-center gap-2 text-[9px] font-bold">
            <span className="text-[#1080CA]">[КУРС]</span>
            <span className="text-[#1080CA]">/////</span>
            <span className="text-[#84848C]">ROADMAP</span>
          </div>
          <h1 className="headline text-[clamp(24px,4vw,34px)]">Курсын зам</h1>
          <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-[#B4B4BA]">
            Курс бүр нэг бодит output гаргана. Төлбөр төлөгдмөгц гишүүнчлэл чинь
            автоматаар идэвхжиж, бүгд шууд нээгдэнэ.
          </p>
        </div>
        {admin && (
          <Link href="/classroom/manage" className="chrome rounded-[4px] border border-[#3A3A40] px-4 py-2 text-[9px] text-[#B4B4BA] hover:border-[#1080CA] hover:text-[#1080CA]">
            УДИРДАХ →
          </Link>
        )}
      </Reveal>

      <div className="space-y-10">
        {TRACKS.map((t) => {
          const list = byTrack.get(t.id) || [];
          if (list.length === 0) return null;
          const trackColor = t.id === "foundation" ? "#3B82F6" : t.id === "builder" ? "#1080CA" : "#F59E0B";
          return (
            <section key={t.id}>
              <Reveal className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[#2E2E33] pb-3">
                <div className="flex items-center gap-3">
                  <span className="tag">{t.name}</span>
                  <span className="text-[13px] text-[#B4B4BA]">{t.desc}</span>
                </div>
                <span className="chrome text-[9px] font-bold" style={{ color: trackColor }}>
                  {`${PLANS[t.requiredPlan === "free" ? "starter" : t.requiredPlan].name.toUpperCase()} PLAN-ААС`}
                </span>
              </Reveal>
              <RevealGroup className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 xl:grid-cols-4">
                {list.map((c) => {
                  // Business rule: no free courses — everything needs at least Runner.
                  const rawPlan = (c.requiredPlan || "free") as PlanId;
                  const reqPlan: PlanId = rawPlan === "free" ? "starter" : rawPlan;
                  const unlocked = hasPlanAccess(myPlan, reqPlan) || admin;
                  const soon = !!c.comingSoon;
                  const dur = fmtDur(c);
                  const cover = c.coverImage || c.thumbnail || "";
                  const inner = (
                    <div
                      className={`flex aspect-[3/4] h-full w-[220px] shrink-0 snap-start flex-col rounded-[4px] border transition lg:w-auto ${
                        soon
                          ? "border-[#2E2E33] bg-[#161618] opacity-60"
                          : unlocked
                            ? "border-[#2E2E33] bg-[#1E1E21] hover:-translate-y-0.5 hover:border-[#1080CA]"
                            : "border-[#2E2E33] bg-[#1E1E21] hover:-translate-y-0.5 hover:border-[#1080CA]"
                      }`}
                    >
                      {/* Poster cover — 3/4 картын дээд тал */}
                      <div className="relative h-[46%] w-full shrink-0 overflow-hidden rounded-t-[3px] bg-[#1E1E21]">
                        {cover ? (
                          <img src={cover} alt="" className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="flex h-full items-center justify-center">
                            <span className="chrome text-[24px] font-bold text-[#2E2E33]">{t.name.slice(0, 2)}</span>
                          </div>
                        )}
                        <span className="tag absolute left-2 top-2 text-[7px]">{TRACK_LABEL[t.id]}</span>
                      </div>
                      <div className="flex flex-1 flex-col p-4">
                      <div className="mb-2.5 flex items-center justify-between">
                        <span className="chrome text-[8.5px] font-bold text-[#84848C]">{c.lessonsCount > 0 ? "КУРС" : "СООН"}</span>
                        {soon ? (
                          <span className="chrome text-[8.5px] text-[#84848C]">ТУН УДАХГҮЙ</span>
                        ) : unlocked ? (
                          <span className="chrome text-[8.5px] font-bold text-[#1080CA]">НЭЭЛТТЭЙ</span>
                        ) : (
                          <span className="chrome text-[8.5px]" style={{ color: PLANS[reqPlan].accent }}>
                            🔒 {PLANS[reqPlan].name.toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="mb-1.5 text-[16px] font-bold leading-snug text-[#FFFFFF]">{c.title}</div>
                      {c.outcome && (
                        <div className="mb-3 text-[13px] leading-snug text-[#B4B4BA]">
                          <span className="text-[#84848C]">Output:</span> {c.outcome}
                        </div>
                      )}
                      <div className="chrome mt-auto flex items-center gap-3 border-t border-[#2E2E33] pt-3 text-[8.5px] text-[#84848C]" style={{ fontVariantNumeric: "tabular-nums" }}>
                        {c.lessonsCount > 0 && <span>{c.lessonsCount} ХИЧЭЭЛ</span>}
                        {dur && <span>{dur}</span>}
                      </div>
                      </div>
                    </div>
                  );
                  if (soon) return <RevealItem key={c._id}>{inner}</RevealItem>;
                  if (unlocked) {
                    return (
                      <RevealItem key={c._id}>
                        <Link href={`/classroom/course/${c._id}`}>{inner}</Link>
                      </RevealItem>
                    );
                  }
                  return (
                    <RevealItem key={c._id}>
                      <button
                        className="text-left"
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
