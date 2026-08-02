"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { PAID_PLANS, PLANS, formatMNT, annualPrice } from "@/lib/plans";
import { track, trackOnce } from "@/lib/analytics";
import { PROGRAM_DAYS } from "@/lib/program";
import {
  EASE_OUT,
  HudCorners,
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
  useReleaseCountdown,
  type LandingContent,
  type LandingStats,
} from "@/components/landing/kit";

// ─────────────────────────────────────────────────────────────────────────
// Нүүр — "Antaqor Home" макет, v8 EVENT HORIZON дээр.
// [01] Hero → [02] Хэрэгсэл → [03] 7 хоногийн хөтөлбөр → [04] Community → [05] Plan → PAYOFF.
// Бүх текст /api/landing-content-ээс (админ /admin/landing), карт /api/homepage-cards-аас
// (админ /admin/homepage-cards), тоо /api/stats-аас.
// ─────────────────────────────────────────────────────────────────────────

interface Stats {
  seatsTotal?: number;
  seatsLeft?: number;
  newMembers?: number;
}

interface HomepageCard {
  _id: string;
  section: "ai_solution" | "resource";
  title: string;
  desc: string;
  emoji: string;
  href: string;
  order: number;
}

/** Админ /admin/homepage-cards-аас — AI шийдэл ба эх сурвалжийн карт. */
function useHomepageCards(): HomepageCard[] {
  const [cards, setCards] = useState<HomepageCard[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/homepage-cards")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && Array.isArray(d.cards)) setCards(d.cards);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return cards;
}

interface HeroSlideData {
  key: string;
  chrome: string;
  title: string;
  sub: string;
  ctaLabel: string;
  ctaHref: string;
  image: string;
}

/** LandingContent-оос үндсэн слайд — админ hero слайд оруулаагүй үед энэ харагдана. */
function baseSlide(c: LandingContent): HeroSlideData {
  return {
    key: "base",
    chrome: c.homeEyebrow,
    title: c.homeTitle,
    sub: c.homeSub,
    ctaLabel: c.homeCtaLabel,
    ctaHref: c.homeCtaHref,
    image: c.homeImage,
  };
}

// ── Hero арт — эргэлдэх HUD цагираг + дугуй зураг ──
function HeroArt({ image, coords, serial }: { image: string; coords: string; serial: string }) {
  const reduced = useReducedMotion();
  return (
    <div className="relative hidden min-h-[420px] items-center justify-center lg:flex">
      <div
        className="pointer-events-none absolute h-[600px] w-[600px]"
        style={{ background: "radial-gradient(circle, rgba(16,128,202,.07) 0%, transparent 70%)" }}
      />

      <motion.svg
        width="440"
        height="440"
        viewBox="0 0 440 440"
        fill="none"
        className="absolute"
        animate={reduced ? undefined : { rotate: 360 }}
        transition={{ duration: 90, ease: "linear", repeat: Infinity }}
      >
        <circle cx="220" cy="220" r="214" stroke="#5C5C64" strokeWidth="1" strokeDasharray="1183 161" />
      </motion.svg>
      <motion.svg
        width="440"
        height="440"
        viewBox="0 0 440 440"
        fill="none"
        className="absolute"
        animate={reduced ? undefined : { rotate: -360 }}
        transition={{ duration: 140, ease: "linear", repeat: Infinity }}
      >
        <circle cx="220" cy="220" r="196" stroke="#1080CA" strokeWidth="1" strokeDasharray="4 8" opacity="0.45" />
      </motion.svg>

      <motion.div
        className="relative h-[340px] w-[340px] overflow-hidden rounded-full border border-[#2E2E33] bg-[#0E0E10]"
        initial={reduced ? false : { opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
      >
        {image ? (
          <img src={image} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span
              className="text-[64px] font-bold text-[#26262A]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              A///
            </span>
          </div>
        )}
      </motion.div>

      <div className="chrome absolute left-0 top-2 text-[9px] text-[#84848C]">{serial}</div>
      <div className="chrome absolute bottom-2 right-0 text-[9px] text-[#84848C]">{coords}</div>
    </div>
  );
}

// ── [01] Hero — cold open ──
// `stats` prop-оор MemberDashboard-той хуваалцана (нэвтэрсэн нүүр ижил hero-той).
export function HeroSlider({ stats }: { stats: Stats | null }) {
  const content = useLandingContent();
  const live = useLandingStats();
  const countdown = useReleaseCountdown();
  const reduced = useReducedMotion();

  const [slides, setSlides] = useState<HeroSlideData[]>([baseSlide(content)]);
  const [adminSlides, setAdminSlides] = useState<HeroSlideData[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);

  // Админ /admin/hero дээр слайд оруулсан бол тэдгээр нь давуу эрхтэй.
  useEffect(() => {
    fetch("/api/hero-slides")
      .then((r) => r.json())
      .then((d) => {
        const raw = d?.slides;
        if (!Array.isArray(raw) || raw.length === 0) return;
        setAdminSlides(
          raw.map((s: { id: string; chrome: string; line1: string; line2: string; sub: string; ctaLabel: string; ctaHref: string; image: string }) => ({
            key: s.id,
            chrome: s.chrome || "ANTAQOR ///",
            title: [s.line1, s.line2].filter(Boolean).join(" "),
            sub: s.sub,
            ctaLabel: s.ctaLabel || "Эхлэх",
            ctaHref: s.ctaHref || "/auth/signup?plan=starter",
            image: s.image || "",
          }))
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setSlides(adminSlides && adminSlides.length > 0 ? adminSlides : [baseSlide(content)]);
    setIdx(0);
  }, [adminSlides, content]);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), 6000);
    return () => clearInterval(t);
  }, [paused, slides.length]);

  const slide = slides[idx] ?? slides[0];
  const go = (i: number) => {
    setPaused(true);
    setIdx((i + slides.length) % slides.length);
  };

  // Props-оор ирсэн stats (MemberDashboard) давуу; эс бөгөөс өөрөө татсан нь.
  const seatsTotal = stats?.seatsTotal ?? live.seatsTotal;
  const seatsLeft = stats?.seatsLeft ?? live.seatsLeft;
  const seatsTaken = Math.max(0, seatsTotal - seatsLeft);
  const newMembers = stats?.newMembers ?? live.newMembers;

  return (
    <section
      className="full-bleed relative -mt-6 overflow-hidden border-b border-[#2E2E33] bg-[#0E0E10] md:-mt-8"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 48 && slides.length > 1) go(idx + (dx < 0 ? 1 : -1));
        touchX.current = null;
      }}
    >
      {/* Grain — void-д бодит гадаргуу өгнө */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
        }}
      />

      <div className="relative mx-auto grid max-w-6xl gap-14 px-4 pb-20 pt-16 md:px-8 md:pb-24 md:pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:px-12">
        <motion.div
          key={slide.key}
          initial={reduced ? false : { opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
        >
          <div className="chrome mb-6 flex flex-wrap items-center gap-3 text-[9px] font-bold">
            <span className="text-[#1080CA]">[01]</span>
            <span className="text-[#1080CA]">/////</span>
            <span className="text-[#84848C]">{slide.chrome}</span>
          </div>

          <h1
            className="text-[clamp(40px,7.5vw,84px)] font-bold leading-[0.96] text-[#FFFFFF]"
            style={{ fontFamily: "var(--font-display)", textWrap: "balance" }}
          >
            {slide.title}
          </h1>

          <p className="mt-6 max-w-[46ch] text-[16px] leading-relaxed text-[#B4B4BA]">{slide.sub}</p>

          <div className="mt-9 flex flex-wrap gap-4">
            <SignalButton
              href={slide.ctaHref}
              onClick={() => track("free_signup_clicked", { source: "hero" })}
              className="shadow-[0_0_0_1px_#1080CA,0_0_24px_0_rgba(16,128,202,.30)]"
            >
              {slide.ctaLabel}
            </SignalButton>
            <Link
              href={content.homeCta2Href}
              onClick={() => track("course_cta_clicked", { source: "hero" })}
              className="inline-flex h-12 items-center border border-[#84848C] px-7 text-[14px] font-medium text-[#F2F2F4] transition-all duration-150 hover:border-[#1080CA] hover:text-[#1080CA] active:translate-y-[1px]"
            >
              {content.homeCta2Label}
            </Link>
          </div>

          <div className="mt-11 flex flex-wrap gap-x-10 gap-y-6">
            <StatCell label="ЭЛСЭЛТ ХААГДАХАД" value={countdown} accent />
            <StatCell label="ӨНӨӨДРИЙН СУУДАЛ" value={`${seatsTaken}/${seatsTotal}`} />
            <StatCell label="ӨНӨӨДӨР НЭГДСЭН" value={`+${newMembers}`} />
          </div>

          {slides.length > 1 && (
            <div className="mt-9 flex items-center gap-3">
              {slides.map((s, i) => (
                <button key={s.key} onClick={() => go(i)} aria-label={`Слайд ${i + 1}`} className="py-2">
                  <span className={`block h-[3px] w-10 transition-colors ${i === idx ? "bg-[#1080CA]" : "bg-[#3A3A40]"}`} />
                </button>
              ))}
              <span className="chrome ml-auto text-[9px] font-bold text-[#84848C]">
                {String(idx + 1).padStart(2, "0")}/{String(slides.length).padStart(2, "0")}
              </span>
            </div>
          )}
        </motion.div>

        <HeroArt image={slide.image} coords={content.coords} serial={content.courseCode} />
      </div>
    </section>
  );
}

// ── Карт мозайк — AI шийдэл / эх сурвалж (нэг хэсэгт) ──
function CardTile({ card }: { card: HomepageCard }) {
  return (
    <Link
      href={card.href}
      className="group flex flex-col gap-3 bg-[#161618] p-6 transition-colors duration-150 hover:bg-[#1E1E21]"
    >
      <span className="text-[26px] leading-none">{card.emoji}</span>
      <div className="text-[14px] font-semibold text-[#F2F2F4] group-hover:text-[#FFFFFF]">{card.title}</div>
      <p className="flex-1 text-[12px] leading-relaxed text-[#84848C]">{card.desc}</p>
      <span className="chrome text-[8px] font-bold text-[#5C5C64] group-hover:text-[#1080CA]">ОРОХ ››</span>
    </Link>
  );
}

// ── [02] Хэрэгсэл — админ /admin/homepage-cards-аар удирдагдана ──
function ToolsGrid() {
  const cards = useHomepageCards();
  const solutions = cards.filter((c) => c.section === "ai_solution").sort((a, b) => a.order - b.order);
  const resources = cards.filter((c) => c.section === "resource").sort((a, b) => a.order - b.order);

  if (solutions.length === 0 && resources.length === 0) return null;

  return (
    <section id="tools" className="scroll-mt-20 border-b border-[#2E2E33] py-20 md:py-28">
      <SectionHead index="02" meta="///// БЭЛЭН ХЭРЭГСЭЛ" title="AI шийдэл, эх сурвалж" />

      {solutions.length > 0 && (
        <div className={resources.length > 0 ? "mb-10" : undefined}>
          <div className="chrome mb-4 text-[9px] font-bold text-[#84848C]">AI ШИЙДЭЛ</div>
          <RevealGroup className="grid grid-cols-2 gap-px border border-[#2E2E33] bg-[#2E2E33] md:grid-cols-4">
            {solutions.map((c) => (
              <RevealItem key={c._id}>
                <CardTile card={c} />
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      )}

      {resources.length > 0 && (
        <div>
          <div className="chrome mb-4 text-[9px] font-bold text-[#84848C]">ЭХ СУРВАЛЖ</div>
          <RevealGroup className="grid grid-cols-2 gap-px border border-[#2E2E33] bg-[#2E2E33] md:grid-cols-4">
            {resources.map((c) => (
              <RevealItem key={c._id}>
                <CardTile card={c} />
              </RevealItem>
            ))}
          </RevealGroup>
        </div>
      )}
    </section>
  );
}

// ── [03] 7 хоногийн хөтөлбөр — 1px сүлжээ ──
function ProgramGrid({ content }: { content: LandingContent }) {
  const totalXp = PROGRAM_DAYS.reduce((s, d) => s + d.xpReward, 0);
  const totalMin = PROGRAM_DAYS.reduce((s, d) => s + d.durationMin, 0);

  return (
    <section id="program" className="scroll-mt-20 border-b border-[#2E2E33] py-20 md:py-28">
      <SectionHead
        index="03"
        meta={content.programMeta}
        title={content.programHeading}
        action={
          <Link
            href="/classroom"
            className="chrome border-b border-[#5C5C64] pb-1 text-[9px] font-bold text-[#B4B4BA] transition-colors hover:border-[#1080CA] hover:text-[#1080CA]"
          >
            ДЭЛГЭРЭНГҮЙ ››
          </Link>
        }
      />

      {/* Mobile: snap carousel · Desktop: 1px hairline сүлжээ */}
      <RevealGroup className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:gap-px md:overflow-visible md:border md:border-[#2E2E33] md:bg-[#2E2E33] md:px-0 lg:grid-cols-4">
        {PROGRAM_DAYS.map((d) => (
          <RevealItem
            key={d.day}
            className="group flex w-[248px] shrink-0 snap-start flex-col gap-4 bg-[#161618] p-7 transition-colors duration-150 hover:bg-[#1E1E21] md:w-auto md:min-h-[224px]"
          >
            <div className="chrome flex items-center justify-between text-[9px] font-bold">
              <span style={{ color: d.day === 7 ? "#1080CA" : "#84848C" }}>DAY {d.day}</span>
              <span className="text-[#5C5C64]">0{d.day}/07</span>
            </div>
            <div className="text-[19px] font-semibold leading-tight text-[#F2F2F4]">{d.title}</div>
            <p className="flex-1 text-[13.5px] leading-relaxed text-[#B4B4BA]">{d.description}</p>
            <div
              className="chrome flex items-center justify-between border-t border-[#2E2E33] pt-3.5 text-[9px] text-[#84848C]"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              <span>~{d.durationMin} МИН</span>
              <span className="text-[#B4B4BA]">+{d.xpReward} XP</span>
            </div>
          </RevealItem>
        ))}

        <RevealItem className="flex w-[248px] shrink-0 snap-start flex-col justify-center gap-3 bg-[#161618] p-7 md:w-auto">
          <div className="chrome text-[9px] font-bold text-[#84848C]">НИЙТ</div>
          <div
            className="text-[40px] font-bold leading-none text-[#FFFFFF]"
            style={{ fontFamily: "var(--font-display)", fontVariantNumeric: "tabular-nums" }}
          >
            +{totalXp}
            <span className="ml-2 text-[15px] text-[#84848C]">XP</span>
          </div>
          <div className="text-[13.5px] text-[#B4B4BA]">
            ~{totalMin} минут · {PROGRAM_DAYS.length} mission · 1 бодит төсөл
          </div>
        </RevealItem>
      </RevealGroup>
    </section>
  );
}

// ── [04] Community — хэвтээ мөрүүд ──
function CommunitySystem({ content }: { content: LandingContent }) {
  return (
    <section id="community" className="scroll-mt-20 border-b border-[#2E2E33] py-20 md:py-28">
      <SectionHead index="04" meta={content.communityMeta} title={content.communityHeading} />
      <div className="flex flex-col">
        {content.features.map((f, i) => (
          <Reveal
            key={f.title}
            delay={i * 0.05}
            className="grid grid-cols-1 items-center gap-5 border-t border-[#2E2E33] py-8 transition-colors duration-150 hover:bg-[#1E1E21] md:grid-cols-[1.1fr_1.4fr_auto] md:gap-8 md:px-4"
          >
            <div className="flex items-center gap-5">
              <span className="chrome text-[9px] text-[#84848C]">[{String(i + 1).padStart(2, "0")}]</span>
              <span className="text-[19px] font-semibold text-[#F2F2F4]">{f.title}</span>
            </div>
            <p className="text-[13.5px] leading-relaxed text-[#B4B4BA]">{f.desc}</p>
            <div className="md:justify-self-end">
              <LiveChip tone={f.live ? "signal" : "static"}>{f.chip}</LiveChip>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

// ── [04] Plan — Runner нээлттэй, бусад нь удахгүй ──
function PlanSection({ content, stats }: { content: LandingContent; stats: LandingStats }) {
  const [period, setPeriod] = useState<"month" | "year">("month");
  const runner = PLANS.starter;
  const yearly = period === "year";
  const price = yearly ? annualPrice(runner) : runner.price;
  const perMonth = Math.round(annualPrice(runner) / 12 / 100) * 100;
  const soonPlans = PAID_PLANS.filter((p) => p.comingSoon);

  return (
    <section id="plan" className="scroll-mt-20 border-b border-[#2E2E33] py-20 md:py-28">
      <SectionHead index="05" meta={content.planMeta} title={content.planHeading} />

      <Reveal className="mb-8 inline-flex border border-[#3A3A40] p-1">
        {(
          [
            ["month", "САРААР"],
            ["year", "ЖИЛЭЭР −20%"],
          ] as ["month" | "year", string][]
        ).map(([p, label]) => (
          <button
            key={p}
            onClick={() => {
              setPeriod(p);
              track("billing_period_toggled", { period: p, source: "home" });
            }}
            className={`chrome px-5 py-2.5 text-[9px] font-bold transition-colors duration-150 ${
              period === p ? "bg-[#1080CA] text-[#0E0E10]" : "text-[#84848C] hover:text-[#FFFFFF]"
            }`}
          >
            {label}
          </button>
        ))}
      </Reveal>

      <div className="grid items-start gap-8 lg:grid-cols-[1.15fr_1fr]">
        <Reveal className="relative border border-[#1080CA] bg-[#1E1E21] p-8 md:p-10">
          <span className="tag absolute -top-3 left-6">● НЭЭЛТТЭЙ · ӨНӨӨДӨР ЭХЭЛНЭ</span>
          <div className="chrome mb-4 mt-2 text-[10px] font-bold text-[#B4B4BA]">
            {runner.name.toUpperCase()}
          </div>
          <div className="flex items-baseline gap-2" style={{ fontVariantNumeric: "tabular-nums" }}>
            <span
              className="text-[clamp(38px,6vw,54px)] font-bold leading-none text-[#FFFFFF]"
              style={{ fontFamily: "var(--font-display)" }}
            >
              {formatMNT(price)}
            </span>
            <span className="text-[14px] text-[#84848C]">/{yearly ? "жил" : "сар"}</span>
          </div>
          <div className="chrome mt-3 text-[9px] text-[#84848C]" style={{ fontVariantNumeric: "tabular-nums" }}>
            {yearly
              ? `САРД ${formatMNT(perMonth)} · −20% ХЭМНЭЛТ`
              : `ЖИЛЭЭР ${formatMNT(annualPrice(runner))} · −20%`}
          </div>

          <ul className="mb-9 mt-8 flex flex-col gap-3.5">
            {runner.benefits.slice(0, 5).map((b) => (
              <li key={b} className="flex items-center gap-3 text-[14.5px] text-[#F2F2F4]">
                <span className="h-2 w-2 shrink-0 bg-[#1080CA]" />
                {b}
              </li>
            ))}
          </ul>

          <Link
            href={`/pricing?plan=starter&period=${period}`}
            onClick={() => track("starter_plan_selected", { source: "home", period })}
            className="flex h-12 w-full items-center justify-center gap-3 bg-[#1080CA] text-[14px] font-semibold text-[#0E0E10] transition-colors duration-150 hover:bg-[#4FA8E8] active:translate-y-[1px]"
          >
            {runner.cta} <span style={{ fontFamily: "var(--font-mono)" }}>››</span>
          </Link>
          <p className="chrome mt-4 text-[8.5px] leading-relaxed text-[#84848C]">
            ТӨЛБӨР ТӨЛӨГДМӨГЦ ЭРХ АВТОМАТААР ИДЭВХЖИНЭ
          </p>
        </Reveal>

        <div className="flex flex-col gap-6">
          {soonPlans.map((plan, i) => (
            <Reveal key={plan.id} delay={0.06 * (i + 1)} className="border border-[#2E2E33] bg-[#1E1E21] p-7">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-4">
                <span className="chrome text-[10px] font-bold text-[#B4B4BA]">{plan.name.toUpperCase()}</span>
                <span
                  className="text-[24px] font-bold text-[#FFFFFF]"
                  style={{ fontFamily: "var(--font-display)", fontVariantNumeric: "tabular-nums" }}
                >
                  {formatMNT(plan.price)}
                  <span className="text-[12px] font-normal text-[#84848C]">/сар</span>
                </span>
              </div>
              <p className="mb-3 text-[15px] text-[#F2F2F4]">{plan.tagline}</p>
              <p className="chrome mb-6 text-[8.5px] leading-relaxed text-[#84848C]">
                {plan.benefits[0]?.toUpperCase()}
              </p>
              <span className="chrome inline-flex h-10 items-center border border-[#3A3A40] px-5 text-[9px] font-bold text-[#84848C]">
                УДАХГҮЙ
              </span>
            </Reveal>
          ))}

          <Reveal delay={0.18} className="relative border border-[#2E2E33] p-7">
            <HudCorners color="#2E2E33" />
            <SeatsMeter stats={stats} />
          </Reveal>
        </div>
      </div>
    </section>
  );
}

// ── PAYOFF — территори эргэлт (signal бүтэн дэвсгэр) ──
function Payoff({ content }: { content: LandingContent }) {
  return (
    <section className="full-bleed bg-[#1080CA]">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-24 md:px-8 md:py-32 lg:px-12">
        <Reveal>
          <h2
            className="max-w-[16ch] text-[clamp(36px,7vw,80px)] font-bold leading-[0.96] text-[#0E0E10]"
            style={{ fontFamily: "var(--font-display)", textWrap: "balance" }}
          >
            {content.payoffTitle}
          </h2>
        </Reveal>
        <Reveal delay={0.08}>
          <p className="max-w-[52ch] text-[16px] leading-relaxed text-[#0D2338]">{content.payoffSub}</p>
        </Reveal>
        <Reveal delay={0.14}>
          <SignalButton
            href={content.payoffCtaHref}
            onClick={() => track("free_signup_clicked", { source: "final" })}
            variant="inverse"
          >
            {content.payoffCtaLabel}
          </SignalButton>
        </Reveal>
      </div>
    </section>
  );
}

export default function HomeLanding() {
  const content = useLandingContent();
  const stats = useLandingStats();

  useEffect(() => {
    trackOnce("home_view");
  }, []);

  return (
    <div className="w-full">
      <HeroSlider stats={null} />

      <div className="mx-auto w-full max-w-6xl">
        <ToolsGrid />
        <ProgramGrid content={content} />
        <CommunitySystem content={content} />
        <PlanSection content={content} stats={stats} />
      </div>

      <Payoff content={content} />
    </div>
  );
}
