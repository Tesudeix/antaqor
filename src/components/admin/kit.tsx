"use client";

// ─────────────────────────────────────────────────────────────────────────
// Antaqor Admin — "Cyberpunk Futurism · Clean" design system.
// Define tokens ONCE here; pages compose these primitives, never hardcode.
// ─────────────────────────────────────────────────────────────────────────

import { ReactNode } from "react";
import Link from "next/link";
import { fmtMNT } from "@/lib/money";

// ── Tokens ──────────────────────────────────────────────────────────────
export const T = {
  canvas: "#0A0A0A",
  surface: "#0E0E12",
  surfaceHi: "#141419",
  border: "rgba(255,255,255,0.08)",
  borderHi: "rgba(255,255,255,0.16)",
  text: "#E8E8E8", // off-white (no pure #FFF on #000 — halation)
  muted: "#8A8A92",
  faint: "#56565E",
  primary: "#1080CA", // signature neon
  secondary: "#1080CA", // signal yellow (Edgerunner)
  ok: "#4ADE80",
  warn: "#FBBF24",
  bad: "#4FA8E8",
} as const;

// JetBrains Mono is loaded in the root layout — use it for all data/metrics/IDs.
export const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace";

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

// ── HUD bracket corners (used sparingly on key surfaces) ───────────────────
function HudCorners({ color = T.border }: { color?: string }) {
  const c = "pointer-events-none absolute h-2.5 w-2.5";
  return (
    <>
      <span className={`${c} left-0 top-0 border-l border-t`} style={{ borderColor: color }} />
      <span className={`${c} right-0 top-0 border-r border-t`} style={{ borderColor: color }} />
      <span className={`${c} bottom-0 left-0 border-b border-l`} style={{ borderColor: color }} />
      <span className={`${c} bottom-0 right-0 border-b border-r`} style={{ borderColor: color }} />
    </>
  );
}

// ── Card ───────────────────────────────────────────────────────────────────
export function Card({ children, className = "", hud = false, hover = false }: {
  children: ReactNode; className?: string; hud?: boolean; hover?: boolean;
}) {
  return (
    <div
      className={`relative rounded-[4px] border bg-[#0E0E12] ${hover ? "transition-colors hover:border-[rgba(16,128,202,0.45)]" : ""} ${className}`}
      style={{ borderColor: T.border }}
    >
      {hud && <HudCorners />}
      {children}
    </div>
  );
}

// ── Metric tile (number-led: SIZE > WEIGHT > COLOR) ────────────────────────
export function Metric({ label, value, sub, accent, hud = true }: {
  label: string; value: ReactNode; sub?: ReactNode; accent?: "primary" | "secondary" | "ok"; hud?: boolean;
}) {
  const color = accent === "primary" ? T.primary : accent === "secondary" ? T.secondary : accent === "ok" ? T.ok : T.text;
  return (
    <Card hud={hud} className="p-5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: T.faint }}>{label}</div>
      <div className="mt-2 text-[28px] font-bold leading-none tracking-tight" style={{ fontFamily: MONO, color }}>{value}</div>
      {sub != null && <div className="mt-1.5 text-[11px]" style={{ color: T.muted }}>{sub}</div>}
    </Card>
  );
}

// ── Money (₮) inline ───────────────────────────────────────────────────────
export function Money({ value, className = "" }: { value: number | null | undefined; className?: string }) {
  return <span className={className} style={{ fontFamily: MONO }}>{fmtMNT(value)}</span>;
}

// ── Button (all states; one primary per screen) ───────────────────────────
type BtnProps = {
  children: ReactNode; variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md"; onClick?: () => void; href?: string; disabled?: boolean; loading?: boolean; className?: string;
};
export function Btn({ children, variant = "primary", size = "md", onClick, href, disabled, loading, className = "" }: BtnProps) {
  const base = "inline-flex items-center justify-center gap-2 rounded-[4px] font-semibold transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A] disabled:cursor-not-allowed disabled:opacity-40";
  const sizes = size === "sm" ? "px-3 py-1.5 text-[12px]" : "px-4 py-2.5 text-[13px]";
  const variants: Record<string, string> = {
    primary: "bg-[#1080CA] text-[#0E0E10] hover:bg-[#0C669E] focus-visible:ring-[#1080CA]",
    secondary: "border border-[#1080CA] text-[#1080CA] hover:bg-[#1080CA] hover:text-[#161618] focus-visible:ring-[#1080CA]",
    ghost: "border border-[rgba(255,255,255,0.1)] text-[#A8A8B0] hover:border-[rgba(255,255,255,0.22)] hover:text-[#E8E8E8] focus-visible:ring-[rgba(255,255,255,0.3)]",
    danger: "border border-[rgba(79,168,232,0.5)] text-[#4FA8E8] hover:bg-[rgba(79,168,232,0.1)] focus-visible:ring-[#4FA8E8]",
  };
  const cls = `${base} ${sizes} ${variants[variant]} ${className}`;
  const inner = loading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : children;
  if (href && !disabled) return <Link href={href} className={cls}>{inner}</Link>;
  return <button onClick={onClick} disabled={disabled || loading} className={cls}>{inner}</button>;
}

// ── Status pill (icon + text — never color-only, per A11y) ─────────────────
const STATUS_MAP: Record<string, { label: string; color: string; icon: string }> = {
  running: { label: "Идэвхтэй", color: T.ok, icon: ICONS.play },
  live: { label: "Нийтэлсэн", color: T.ok, icon: ICONS.check },
  paused: { label: "Зогссон", color: T.warn, icon: ICONS.pause },
  draft: { label: "Ноорог", color: T.faint, icon: ICONS.pause },
  done: { label: "Дууссан", color: T.secondary, icon: ICONS.check },
  paid: { label: "Төлсөн", color: T.ok, icon: ICONS.check },
  pending: { label: "Хүлээгдэж буй", color: T.warn, icon: ICONS.pause },
  failed: { label: "Алдаа", color: T.bad, icon: ICONS.alert },
};
export function Status({ kind, labelOverride }: { kind: keyof typeof STATUS_MAP | string; labelOverride?: string }) {
  const s = STATUS_MAP[kind] || { label: kind, color: T.muted, icon: ICONS.check };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-[11px] font-semibold"
      style={{ color: s.color, background: `${s.color}1A` }}>
      <Ico d={s.icon} className="h-3 w-3" />
      {labelOverride || s.label}
    </span>
  );
}

// ── Section header (anchor for the eye) ────────────────────────────────────
export function SectionHeader({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="h-[2px] w-4" style={{ background: T.primary }} />
        <span className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: "#1080CA" }}>{title}</span>
        {hint && <span className="text-[11px]" style={{ color: T.faint }}>{hint}</span>}
      </div>
      {action}
    </div>
  );
}

// ── Empty state (explain + CTA, never "no data") ───────────────────────────
export function Empty({ title, hint, cta }: { title: string; hint?: string; cta?: ReactNode }) {
  return (
    <Card className="px-6 py-12 text-center">
      <div className="text-[14px] font-semibold" style={{ color: T.text }}>{title}</div>
      {hint && <div className="mx-auto mt-1.5 max-w-sm text-[12px] leading-relaxed" style={{ color: T.faint }}>{hint}</div>}
      {cta && <div className="mt-5 flex justify-center">{cta}</div>}
    </Card>
  );
}

// ── Skeleton (loading — never blank) ───────────────────────────────────────
export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`animate-pulse rounded-[4px] bg-[rgba(255,255,255,0.05)] ${className}`} />;
}

// ── Spinner ────────────────────────────────────────────────────────────────
export function Spinner({ className = "h-6 w-6" }: { className?: string }) {
  return <div className={`animate-spin rounded-full border-2 border-[rgba(16,128,202,0.25)] border-t-[#1080CA] ${className}`} />;
}
