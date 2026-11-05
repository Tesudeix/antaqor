"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PLANS, formatMNT } from "@/lib/plans";
import { track, trackOnce } from "@/lib/analytics";
import { PROGRAM_DAYS } from "@/lib/program";
import {
  EASE_OUT,
  LiveChip,
  Reveal,
  RevealGroup,
  RevealItem,
  SeatsMeter,
  SectionHead,
  SignalButton,
  StatCell,
  useLandingContent,
  useLandingStats,
  type LandingContent,
  type LandingStats,
} from "@/components/landing/kit";

// ─────────────────────────────────────────────────────────────────────────
// Курс — "Antaqor Course" макет. Зочид (нэвтрээгүй) /classroom дээр үүнийг
// хардаг; гишүүд курсын roadmap-аа хардаг (/classroom/page.tsx дээр салгасан).
// Хичээлүүд, mission — админ /admin/landing-ээс; хугацаа/XP — lib/program.ts.
// ─────────────────────────────────────────────────────────────────────────

interface MergedDay {
  day: number;
  title: string;
  description: string;
  durationMin: number;
  xpReward: number;
  mission: string;
  lessons: { t: string; m: number }[];
}

/** Хөтөлбөрийн код дахь өдрүүд + админаас засварласан хичээл/mission. */
function mergeDays(content: LandingContent): MergedDay[] {
  return PROGRAM_DAYS.map((def) => {
    const override = content.courseDays?.find((d) => d.day === def.day);
    // Админ хичээл оруулаагүй бол даалгаврын алхмуудыг хичээл болгож харуулна —
    // accordion хэзээ ч хоосон нээгдэхгүй.
    const fallback = def.assignment.instructions.map((t) => ({
      t,
      m: Math.max(5, Math.round(def.durationMin / def.assignment.instructions.length)),
    }));
    return {
      day: def.day,
      title: override?.title || def.title,
      description: def.description,
      durationMin: def.durationMin,
      xpReward: def.xpReward,
      mission: override?.mission || def.assignment.objective,
      lessons: override?.lessons?.length ? override.lessons : fallback,
    };
  });
}

// ── Элсэх карт — desktop дээр наалдаж, mobile дээр урсана ──
function EnrollCard({ content, stats }: { content: LandingContent; stats: LandingStats }) {
  const runner = PLANS.starter;
  return (
    <div className="relative bg-[#141414] bg-[#0A0A0A] p-8 md:p-10">
      <div className="flex items-baseline gap-2" style={{ fontVariantNumeric: "tabular-nums" }}>
        <span
          className="text-[clamp(22px,3.6vw,30px)] font-bold leading-none text-[#FFFFFF]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {formatMNT(runner.price)}
        </span>
        <span className="text-[14px] text-[#E2E4E8]">/сар</span>
      </div>
      <div className="chrome mt-3 text-[8.5px] text-[#E2E4E8]">
        {runner.name.toUpperCase()} ГИШҮҮНЧЛЭЛД БАГТАНА
      </div>

      <div className="my-8">
        <SeatsMeter stats={stats} label="ӨНӨӨДРИЙН СУУДАЛ" />
      </div>

      <div className="mb-9 flex flex-col gap-3">
        {content.enrollBullets.map((b) => (
          <div key={b} className="flex items-center gap-3 text-[14px] text-[#F2F2F4]">
            <span className="h-2 w-2 shrink-0 bg-[#2E29FF]" />
            {b}
          </div>
        ))}
      </div>

      <Link
        href="/auth/signup?plan=starter"
        onClick={() => track("course_cta_clicked", { source: "course_enroll_card" })}
        className="flex h-12 w-full items-center justify-center gap-3 bg-[#2E29FF] text-[14px] font-semibold text-white shadow-[0_0_0_1px_#2E29FF,0_0_24px_0_rgba(46,41,255,.28)] transition-colors duration-150 hover:bg-[#1F1AD9] active:translate-y-[1px]"
      >
        Элсэх <span style={{ fontFamily: "var(--font-mono)" }}>››</span>
      </Link>
      <div className="chrome mt-4 flex flex-col gap-1.5 text-[8.5px] leading-relaxed text-[#E2E4E8]">
        <span>✓ ТӨЛБӨРИЙН ДАРАА ШУУД ИДЭВХЖИНЭ</span>
        <span>✓ БАНКНЫ АПП-ААР ТӨЛНӨ · ХҮССЭН ҮЕДЭЭ ЦУЦАЛНА</span>
      </div>
    </div>
  );
}

// ── [01] Хичээлийн хөтөлбөр — accordion ──
function Curriculum({ content }: { content: LandingContent }) {
  const [open, setOpen] = useState(0);
  const reduced = useReducedMotion();
  const days = mergeDays(content);

  return (
    <section className="border-b border-[#262626] py-20 md:py-28">
      <SectionHead index="01" meta="ӨДӨР БҮРИЙН ТӨЛӨВЛӨГӨӨ" title={content.curriculumHeading} />

      <div className="border-t border-[#262626]">
        {days.map((d, i) => {
          const isOpen = open === i;
          return (
            <div key={d.day} className="border-b border-[#262626]">
              <button
                onClick={() => {
                  setOpen(isOpen ? -1 : i);
                  if (!isOpen) track("course_day_expanded", { day: d.day });
                }}
                aria-expanded={isOpen}
                className="grid w-full grid-cols-[64px_1fr_auto] items-center gap-4 px-2 py-7 text-left transition-colors duration-150 hover:bg-[#0A0A0A] md:grid-cols-[96px_1fr_auto_28px] md:gap-6"
              >
                <span
                  className="chrome text-[11px] font-bold"
                  style={{ color: d.day === 7 ? "#2E29FF" : "#30333F" }}
                >
                  ӨДӨР {d.day}
                </span>
                <span
                  className={`text-[16px] font-semibold leading-snug transition-colors md:text-[19px] ${
                    isOpen ? "text-[#FFFFFF]" : "text-[#F2F2F4]"
                  }`}
                >
                  {d.title}
                </span>
                <span
                  className="chrome hidden text-[11px] text-[#E2E4E8] md:block"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  ~{d.durationMin} МИН · +{d.xpReward} XP
                </span>
                <motion.span
                  className="text-center text-[18px] text-[#E2E4E8]"
                  style={{ fontFamily: "var(--font-mono)" }}
                  animate={reduced ? undefined : { rotate: isOpen ? 45 : 0 }}
                  transition={{ duration: 0.2, ease: EASE_OUT }}
                >
                  +
                </motion.span>
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    key="body"
                    initial={reduced ? false : { height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={reduced ? undefined : { height: 0, opacity: 0 }}
                    transition={{ duration: 0.32, ease: EASE_OUT }}
                    className="overflow-hidden"
                  >
                    <div className="grid gap-8 px-2 pb-9 lg:grid-cols-[1.3fr_1fr]">
                      <div className="flex flex-col gap-2">
                        {d.lessons.map((l, j) => (
                          <div
                            key={l.t}
                            className="flex items-center justify-between gap-4 bg-[#141414] bg-[#0A0A0A] px-4 py-3.5"
                          >
                            <div className="flex items-center gap-4 text-[13.5px] text-[#F2F2F4]">
                              <span className="chrome text-[11px] text-[#E2E4E8]">
                                {String(j + 1).padStart(2, "0")}
                              </span>
                              {l.t}
                            </div>
                            <span
                              className="chrome shrink-0 text-[11px] text-[#E2E4E8]"
                              style={{ fontVariantNumeric: "tabular-nums" }}
                            >
                              {l.m} МИН
                            </span>
                          </div>
                        ))}
                        <div
                          className="chrome mt-1 text-[11px] text-[#E2E4E8] md:hidden"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          ~{d.durationMin} МИН · +{d.xpReward} XP
                        </div>
                      </div>

                      <div className="self-start bg-[#141414] p-6">
                        <div className="chrome mb-3 text-[11px] font-bold text-[#2E29FF]">ДААЛГАВАР</div>
                        <p className="mb-4 text-[13.5px] leading-relaxed text-[#E2E4E8]">{d.mission}</p>
                        <div
                          className="chrome text-[11px] text-[#E2E4E8]"
                          style={{ fontVariantNumeric: "tabular-nums" }}
                        >
                          ДУУСГАВАЛ +{d.xpReward} XP
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── [02] Төгсөхөд чи: ──
function Outcomes({ content }: { content: LandingContent }) {
  return (
    <section className="border-b border-[#262626] py-20 md:py-28">
      <SectionHead index="02" meta="7 ХОНОГИЙН ДАРАА" title="Төгсөхөд чи:" />
      <RevealGroup className="grid gap-px bg-[#141414] bg-[#262626] sm:grid-cols-2 xl:grid-cols-4">
        {content.outcomes.map((o, i) => (
          <RevealItem key={o} className="flex flex-col gap-4 bg-[#0A0A0A] p-7">
            <span className="chrome text-[11px] text-[#E2E4E8]">[{String(i + 1).padStart(2, "0")}]</span>
            <p className="text-[15.5px] leading-relaxed text-[#F2F2F4]">{o}</p>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}

// ── [03] Оператор ──
function Operator({ content }: { content: LandingContent }) {
  const reduced = useReducedMotion();
  return (
    <section className="border-b border-[#262626] py-20 md:py-28">
      <div className="grid items-center gap-14 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <SectionHead index="03" meta="ХЭН ЗААХ ВЭ" title={content.operatorName} />
          <Reveal delay={0.06}>
            <p className="max-w-[48ch] text-[16px] leading-relaxed text-[#E2E4E8]">{content.operatorBio}</p>
            <div className="chrome mt-7 flex flex-wrap gap-6 text-[11px] text-[#E2E4E8]">
              <span>{content.coords}</span>
              <span>{content.operatorLocation}</span>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.1} className="relative mx-auto h-[260px] w-[260px] md:h-[300px] md:w-[300px]">
          <motion.svg
            viewBox="0 0 300 300"
            fill="none"
            className="absolute inset-0 h-full w-full"
            animate={reduced ? undefined : { rotate: 360 }}
            transition={{ duration: 110, ease: "linear", repeat: Infinity }}
          >
            <circle cx="150" cy="150" r="146" stroke="#E2E4E8" strokeWidth="1" strokeDasharray="806 110" />
          </motion.svg>
          <div className="absolute inset-4 overflow-hidden rounded-[4px] bg-[#141414] bg-[#0A0A0A]">
            {content.operatorPhoto ? (
              <img src={content.operatorPhoto} alt={content.operatorName} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="text-[52px] font-bold text-[#262626]" style={{ fontFamily: "var(--font-display)" }}>
                  A///
                </span>
              </div>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default function CourseLanding() {
  const content = useLandingContent();
  const stats = useLandingStats();
  const totalXp = PROGRAM_DAYS.reduce((s, d) => s + d.xpReward, 0);
  const totalMin = PROGRAM_DAYS.reduce((s, d) => s + d.durationMin, 0);

  useEffect(() => {
    trackOnce("course_landing_view");
  }, []);

  return (
    <div className="w-full">
      {/* ── COURSE HEADER ── */}
      <header className="full-bleed relative -mt-6 overflow-hidden border-b border-[#262626] bg-[#0A0A0A] md:-mt-8">
        <div
          className="pointer-events-none absolute left-[20%] top-[-120px] h-[600px] w-[600px]"
          style={{ background: "radial-gradient(circle, rgba(46,41,255,.06) 0%, transparent 70%)" }}
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-14 md:px-8 md:pb-24 md:pt-20 lg:px-12">
          <div className="chrome mb-9 flex flex-wrap items-center gap-2 text-[11px] text-[#E2E4E8]">
            <Link href="/" className="transition-colors hover:text-[#2E29FF]">
              НҮҮР
            </Link>
            <span>//</span>
            <span className="text-[#E2E4E8]">КУРС</span>
            <span>//</span>
            <span className="text-[#E2E4E8]">{content.courseCode}</span>
          </div>

          <div className="grid gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
            >
              <div className="mb-7 flex flex-wrap gap-3">
                <LiveChip>ШУУД БҮЛЭГ</LiveChip>
                <span className="chrome inline-flex items-center rounded-[4px] bg-[#1E1E1E] px-3.5 py-1.5 text-[11px] text-[#E2E4E8]">
                  {content.courseLevel}
                </span>
              </div>

              <h1
                className="text-[clamp(26px,4.6vw,42px)] font-bold leading-[1] text-[#FFFFFF]"
                style={{ fontFamily: "var(--font-display)", textWrap: "balance" }}
              >
                {content.courseTitle}
              </h1>
              <p className="mt-6 max-w-[52ch] text-[16px] leading-relaxed text-[#E2E4E8]">{content.courseSub}</p>

              <div className="mt-11 grid grid-cols-2 gap-x-8 gap-y-6 sm:flex sm:flex-wrap sm:gap-x-12">
                <StatCell label="ХУГАЦАА" value="7 ХОНОГ" />
                <StatCell label="НИЙТ ЦАГ" value={`~${totalMin} МИН`} />
                <StatCell label="XP" value={`+${totalXp}`} accent />
                <StatCell label="ФОРМАТ" value="LIVE" />
              </div>
            </motion.div>

            <motion.div
              id="enroll"
              className="scroll-mt-24 lg:sticky lg:top-24"
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.12 }}
            >
              <EnrollCard content={content} stats={stats} />
            </motion.div>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl">
        <Curriculum content={content} />
        <Outcomes content={content} />
        <Operator content={content} />
      </div>

      {/* ── CTA ── */}
      <section className="full-bleed bg-[#0A0A0A]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-8 px-4 py-20 md:px-8 md:py-24 lg:px-12">
          <Reveal>
            <h2
              className="mb-4 text-[clamp(26px,4.6vw,42px)] font-bold leading-[1] text-[#FFFFFF]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {content.courseCtaTitle}
            </h2>
            <p className="text-[16px] text-[#E2E4E8]">
              Бүртгүүл. Эрх чинь шууд идэвхжинэ — {stats.seatsLeft} суудал үлдсэн.
            </p>
          </Reveal>
          <Reveal delay={0.08}>
            <SignalButton
              href="/auth/signup?plan=starter"
              onClick={() => track("course_cta_clicked", { source: "course_footer" })}
              className="shadow-[0_0_0_1px_#2E29FF,0_0_24px_0_rgba(46,41,255,.28)]"
            >
              Элсэх
            </SignalButton>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
