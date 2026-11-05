"use client";

// ─────────────────────────────────────────────────────────────────────────
// Antaqor Admin — цайвар premium design system (2026-10-26; өмнө нь "Cyberpunk Futurism · Clean").
// Define tokens ONCE here; pages compose these primitives, never hardcode.
// ─────────────────────────────────────────────────────────────────────────

import { ReactNode } from "react";
import Link from "next/link";
import { fmtMNT } from "@/lib/money";
import k from "./kit.module.css";

// ── Tokens ──────────────────────────────────────────────────────────────
/* ЭДГЭЭР НЬ INLINE `style={{…}}` ДОТОР ЯВДАГ тул ЯМАР Ч CSS давхарга,
   сэдвийн override тэдэнд ХҮРЭХГҮЙ — 21 файл эндээс уншдаг.

   2026-10-26 (цайвар premium, dark байхгүй): брэнд #2E29FF нь цагаан дээр
   бичиг ч (7.3:1), дүүргэлт ч (дээрээ цагаан 7.3:1) болно. `*Ink` = бичигт,
   төгсгөлгүй = дүүргэлтэд. Бүх Ink утга #FFFFFF дээр ≥4.5:1 (WCAG AA). */
export const T = {
  canvas: "#FFFFFF",
  surface: "#FFFFFF",
  surfaceHi: "#F6F7FB",
  border: "#E6E8EF",
  borderHi: "#D2D5E0",
  text: "#12131A",        // 18.6:1
  muted: "#4A4D5A",       //  8.6:1
  faint: "#6B6F7D",       //  5.0:1
  // ── ДҮҮРГЭЛТЭД (background) ──
  primary: "#2E29FF",
  secondary: "#2E29FF",
  ok: "#22C55E",
  warn: "#F59E0B",
  bad: "#E5484D",
  // ── БИЧИГТ (color) — цагаан дээр уншигдана ──
  primaryInk: "#2E29FF",  //  7.3:1
  secondaryInk: "#2E29FF",
  okInk: "#15803D",       //  5.0:1
  warnInk: "#A16207",     //  4.9:1
  badInk: "#C81E4A",      //  5.9:1
} as const;

// Тоо, ID — системийн monospace (тусдаа фонт ачаалахгүй).
export const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";

// ── Icon (single set, single weight) ──────────────────────────────────────
export function Ico({ d, className = "h-4 w-4" }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}
export const ICONS = {
  arrow: "M8.25 4.5l7.5 7.5-7.5 7.5",
  bolt: "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z",
  alert: "M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.626zM12 15.75h.007v.008H12v-.008z",
  check: "M4.5 12.75l6 6 9-13.5",
  pause: "M15.75 5.25v13.5m-7.5-13.5v13.5",
  play: "M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z",
};

// ── Card ───────────────────────────────────────────────────────────────────
/* `hud` prop хуучин HUD булангийн үлдэгдэл — хүлээн авна, юу ч зурахгүй (premium = цэвэр). */
export function Card({ children, className = "", hover = false }: {
  children: ReactNode; className?: string; hud?: boolean; hover?: boolean;
}) {
  return <div className={`${k.card} ${hover ? k.hover : ""} ${className}`}>{children}</div>;
}

// ── Metric tile (number-led: SIZE > WEIGHT > COLOR) ────────────────────────
export function Metric({ label, value, sub, accent }: {
  label: string; value: ReactNode; sub?: ReactNode; accent?: "primary" | "secondary" | "ok"; hud?: boolean;
}) {
  const color = accent === "primary" ? T.primaryInk : accent === "secondary" ? T.secondaryInk : accent === "ok" ? T.okInk : T.text;
  return (
    <Card className="p-5">
      <div className={k.metricLabel}>{label}</div>
      <div className={k.metricValue} style={{ color }}>{value}</div>
      {sub != null && <div className={k.metricSub}>{sub}</div>}
    </Card>
  );
}

// ── Money (₮) inline ───────────────────────────────────────────────────────
export function Money({ value, className = "" }: { value: number | null | undefined; className?: string }) {
  return <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>{fmtMNT(value)}</span>;
}

// ── Button (all states; one primary per screen) ───────────────────────────
type BtnProps = {
  children: ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md"; onClick?: () => void; href?: string; disabled?: boolean; loading?: boolean; className?: string;
};
export function Btn({ children, variant = "primary", size = "md", onClick, href, disabled, loading, className = "" }: BtnProps) {
  const cls = `${k.btn} ${size === "sm" ? k.sm : k.md} ${k[variant] || k.primary} ${className}`;
  const inner = loading ? <span className={k.spin} aria-label="Түр хүлээнэ үү" /> : children;
  if (href && !disabled) return <Link href={href} className={cls}>{inner}</Link>;
  return <button onClick={onClick} disabled={disabled || loading} className={cls}>{inner}</button>;
}

// ── Status pill (icon + text — never color-only, per A11y) ─────────────────
const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  running: { label: "Идэвхтэй", color: T.okInk, icon: ICONS.play },
  live: { label: "Нийтэлсэн", color: T.okInk, icon: ICONS.check },
  paused: { label: "Зогссон", color: T.warnInk, icon: ICONS.pause },
  draft: { label: "Ноорог", color: T.faint, icon: ICONS.pause },
  done: { label: "Дууссан", color: T.secondaryInk, icon: ICONS.check },
  paid: { label: "Төлсөн", color: T.okInk, icon: ICONS.check },
  pending: { label: "Хүлээгдэж буй", color: T.warnInk, icon: ICONS.pause },
  failed: { label: "Алдаа", color: T.badInk, icon: ICONS.alert },
};
export function Status({ kind, labelOverride }: { kind: keyof typeof STATUS_MAP | string; labelOverride?: string }) {
  const s = STATUS_MAP[kind] || { label: kind, color: T.muted, icon: ICONS.check };
  return (
    <span className={k.pill} style={{ color: s.color, background: `${s.color}14` }}>
      <Ico d={s.icon} className="h-3 w-3" />
      {labelOverride || s.label}
    </span>
  );
}

// ── Section header (anchor for the eye) ────────────────────────────────────
export function SectionHeader({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className={k.section}>
      <div className={k.sectionTitle}><b>{title}</b>{hint && <span>{hint}</span>}</div>
      {action}
    </div>
  );
}

// ── Empty state (explain + CTA, never "no data") ───────────────────────────
export function Empty({ title, hint, cta }: { title: string; hint?: string; cta?: ReactNode }) {
  return (
    <Card className={k.empty}>
      <div className={k.emptyTitle}>{title}</div>
      {hint && <div className={k.emptyHint}>{hint}</div>}
      {cta && <div className="mt-5 flex justify-center">{cta}</div>}
    </Card>
  );
}

// ── Skeleton (loading — never blank) ───────────────────────────────────────
export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`${k.skel} ${className}`} />;
}

// ── Spinner ────────────────────────────────────────────────────────────────
export function Spinner({ className = "h-6 w-6" }: { className?: string }) {
  return <div className={`${k.spinner} ${className}`} />;
}
