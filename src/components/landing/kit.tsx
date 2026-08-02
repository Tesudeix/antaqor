"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { LANDING_DEFAULTS, type LandingContentFields } from "@/lib/landingContent";

// ─────────────────────────────────────────────────────────────────────────
// Landing kit — Нүүр ба Курс хуудасны хуваалцсан хэсгүүд.
// v8 EVENT HORIZON: void масс, ганц signal (#1080CA), mono chrome, HUD рам.
// Хөдөлгөөн бүр `prefers-reduced-motion`-г хүндэтгэнэ.
// ─────────────────────────────────────────────────────────────────────────

export type LandingContent = LandingContentFields;

/** Админаас удирдагдах контент — сүлжээ унасан ч кодон дахь default-аар ажиллана. */
export function useLandingContent(): LandingContent {
  const [content, setContent] = useState<LandingContent>(LANDING_DEFAULTS);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/landing-content")
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.content) setContent({ ...LANDING_DEFAULTS, ...d.content });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return content;
}

export interface LandingStats {
  seatsTotal: number;
  seatsLeft: number;
  seatsTaken: number;
  seatsPct: number;
  newMembers: number;
}

const FALLBACK_STATS: LandingStats = {
  seatsTotal: 20,
  seatsLeft: 20,
  seatsTaken: 0,
  seatsPct: 0,
  newMembers: 0,
};

/** Өнөөдрийн элсэлтийн бодит тоо — /api/stats. */
export function useLandingStats(): LandingStats {
  const [stats, setStats] = useState<LandingStats>(FALLBACK_STATS);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled || !d) return;
        const seatsTotal = Number(d.seatsTotal) || 20;
        const rawLeft = Number(d.seatsLeft);
        const seatsLeft = Math.max(0, Math.min(seatsTotal, Number.isFinite(rawLeft) ? rawLeft : seatsTotal));
        const seatsTaken = seatsTotal - seatsLeft;
        setStats({
          seatsTotal,
          seatsLeft,
          seatsTaken,
          seatsPct: Math.round((seatsTaken / seatsTotal) * 100),
          newMembers: Number(d.newMembers) || 0,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return stats;
}

/** Улаанбаатарын 18:00 — Day 1 нээгдэх хүртэлх тоолуур. */
const UB_OFFSET_MS = 8 * 3600 * 1000;
export function useReleaseCountdown(releaseHour = 18): string {
  const [left, setLeft] = useState("--:--:--");
  useEffect(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const tick = () => {
      const now = Date.now();
      const ub = new Date(now + UB_OFFSET_MS);
      let target =
        Date.UTC(ub.getUTCFullYear(), ub.getUTCMonth(), ub.getUTCDate(), releaseHour) - UB_OFFSET_MS;
      if (target <= now) target += 86_400_000;
      const s = Math.max(0, Math.floor((target - now) / 1000));
      setLeft(`${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [releaseHour]);
  return left;
}

// ── Motion ────────────────────────────────────────────────────────────────
// Signal acquisition: агуулга доороос "олдож" ирнэ, огцом биш.
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const riseVariants: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
};

export const staggerVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

/** Scroll дээр нэг л удаа гарч ирэх блок. */
export function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.55, ease: EASE_OUT, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Хүүхдүүдээ дараалуулан гаргах контейнер (`RevealItem`-тэй хослоно). */
export function RevealGroup({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={staggerVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={riseVariants}>
      {children}
    </motion.div>
  );
}

// ── HUD чимэглэл ──────────────────────────────────────────────────────────

/** Дөрвөн булангийн хаалт — гол гадаргуу дээр л хэрэглэнэ. */
export function HudCorners({ color = "#1080CA" }: { color?: string }) {
  const base = "pointer-events-none absolute h-3 w-3";
  return (
    <>
      <span className={`${base} left-0 top-0 border-l-2 border-t-2`} style={{ borderColor: color }} />
      <span className={`${base} right-0 top-0 border-r-2 border-t-2`} style={{ borderColor: color }} />
      <span className={`${base} bottom-0 left-0 border-b-2 border-l-2`} style={{ borderColor: color }} />
      <span className={`${base} bottom-0 right-0 border-b-2 border-r-2`} style={{ borderColor: color }} />
    </>
  );
}

/** Хэсгийн индекс + гарчиг — макетын `[02] ///// META` хэв маяг. */
export function SectionHead({
  index,
  meta,
  title,
  action,
}: {
  index: string;
  meta: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <Reveal className="mb-10">
      <div className="chrome mb-4 flex items-center gap-3 text-[9px] font-bold">
        <span className="text-[#1080CA]">[{index}]</span>
        <span className="text-[#1080CA]">/////</span>
        <span className="text-[#84848C]">{meta}</span>
        <span className="hidden h-px flex-1 bg-[#2E2E33] md:block" />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-[clamp(28px,5vw,52px)] font-medium leading-[1.08] text-[#FFFFFF]" style={{ fontFamily: "var(--font-display)" }}>
          {title}
        </h2>
        {action}
      </div>
    </Reveal>
  );
}

/** Мono шошготой тоон блок — hero/курсын статистик мөрөнд. */
export function StatCell({
  label,
  value,
  accent = false,
  onDark = true,
}: {
  label: string;
  value: string;
  accent?: boolean;
  onDark?: boolean;
}) {
  return (
    <div>
      <div className={`chrome mb-1.5 text-[9px] font-bold ${onDark ? "text-[#84848C]" : "text-[#0D2338]"}`}>
        {label}
      </div>
      <div
        className={`text-[clamp(18px,2.4vw,22px)] font-bold leading-none ${
          accent ? "text-[#1080CA]" : "text-[#F2F2F4]"
        }`}
        style={{ fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </div>
    </div>
  );
}

/** Өнөөдрийн суудлын явц — hero, plan, enroll картанд дахин ашиглагдана. */
export function SeatsMeter({ stats, label = "ӨНӨӨДРИЙН ЭЛСЭЛТ" }: { stats: LandingStats; label?: string }) {
  const reduced = useReducedMotion();
  return (
    <div>
      <div className="chrome mb-2.5 flex items-center justify-between text-[9px] font-bold">
        <span className="text-[#84848C]">{label}</span>
        <span className="text-[#1080CA]" style={{ fontVariantNumeric: "tabular-nums" }}>
          {stats.seatsTaken}/{stats.seatsTotal} СУУДАЛ
        </span>
      </div>
      <div className="h-[3px] overflow-hidden bg-[#2E2E33]">
        {reduced ? (
          <div className="h-full bg-[#1080CA]" style={{ width: `${stats.seatsPct}%` }} />
        ) : (
          <motion.div
            className="h-full bg-[#1080CA]"
            initial={{ width: 0 }}
            whileInView={{ width: `${stats.seatsPct}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: EASE_OUT }}
          />
        )}
      </div>
    </div>
  );
}

/** LIVE чип — цохилдог цэгтэй. */
export function LiveChip({ children, tone = "signal" }: { children: React.ReactNode; tone?: "signal" | "static" }) {
  const color = tone === "signal" ? "#1080CA" : "#8C96A6";
  return (
    <span
      className="chrome inline-flex items-center gap-2 rounded-full border border-[#3A3A40] px-3.5 py-1.5 text-[9px] font-bold"
      style={{ color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, animation: "landingPulse 2s linear infinite" }} />
      {children}
    </span>
  );
}

/** Signal товч — макетын үндсэн CTA. */
export function SignalButton({
  href,
  children,
  onClick,
  variant = "solid",
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
  variant?: "solid" | "outline" | "inverse";
  className?: string;
}) {
  const styles =
    variant === "solid"
      ? "bg-[#1080CA] text-[#0E0E10] hover:bg-[#4FA8E8]"
      : variant === "inverse"
        ? "bg-[#0E0E10] text-[#FFFFFF] hover:bg-[#26262A]"
        : "border border-[#84848C] text-[#F2F2F4] hover:border-[#1080CA] hover:text-[#1080CA]";
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`inline-flex h-12 items-center gap-3 px-7 text-[14px] font-semibold transition-all duration-150 active:translate-y-[1px] ${styles} ${className}`}
    >
      {children}
      <span style={{ fontFamily: "var(--font-mono)" }}>››</span>
    </Link>
  );
}

/** Хуудсын доод HUD зурвас — серийн дугаар + координат. */
export function HudFooterStrip({ serial, coords }: { serial: string; coords: string }) {
  return (
    <div className="chrome flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-[#2E2E33] py-6 text-[9px] text-[#5C5C64]">
      <span>{serial}</span>
      <span>{coords}</span>
      <span className="ml-auto tracking-[0.3em]">░▒▓█</span>
    </div>
  );
}
