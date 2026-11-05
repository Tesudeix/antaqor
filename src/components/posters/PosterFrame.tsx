// Minimal poster frame — scan-friendly, fewer accent lines.
// Replaces the busy v1 (brackets, side rails, edge segments, double divider,
// pulsing LIVE pill, ▶ eyebrow square). New language: clean editorial. A
// thin accent dot in the top-left marks brand; everything else is content.

import { ReactNode } from "react";

export interface PosterFrameProps {
  children: ReactNode;
  /** Aspect ratio of the frame. Default 3:4 (Threads + IG carousel). */
  aspect?: "3:4" | "1:1" | "4:5" | "9:16" | "16:9";
  /** Top-left brand wordmark. Defaults to "ANTAQOR". */
  brand?: string;
  /** Sub-label below the brand (small caps mono). Defaults to "POSTER". */
  subBrand?: string;
  /** Footer left meta (e.g. URL or section). */
  footerMeta?: string;
  /** Footer right text. Empty hides the right column entirely. */
  footerRight?: string;
  /** Optional background image — fills the frame edge-to-edge with a dark
   *  scrim so foreground content stays legible. */
  backgroundImage?: string;
}

const ACCENT = "#2E29FF";

export function PosterFrame({
  children,
  aspect = "3:4",
  brand = "ANTAQOR",
  subBrand = "POSTER",
  footerMeta = "ANTAQOR.COM",
  footerRight = "",
  backgroundImage,
}: PosterFrameProps) {
  const ratio =
    aspect === "3:4" ? "aspect-[3/4]"
    : aspect === "1:1" ? "aspect-square"
    : aspect === "4:5" ? "aspect-[4/5]"
    : aspect === "9:16" ? "aspect-[9/16]"
    : "aspect-video";

  return (
    <div
      className={`relative ${ratio} w-full overflow-hidden bg-[#0A0A0A] text-[#f5f5f7]`}
    >
      {/* ─── Optional full-bleed background image ─── */}
      {backgroundImage && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backgroundImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          {/* Scrim — bottom-weighted so footer chrome stays readable */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/35" />
        </>
      )}

      {/* ─── Quiet diagonal accent (only when no background image) ─── */}
      {!backgroundImage && (
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(70% 50% at 0% 0%, rgba(46,41,255,0.14) 0%, transparent 55%), radial-gradient(60% 45% at 100% 100%, rgba(192,20,74,0.16) 0%, transparent 55%)`,
          }}
        />
      )}

      {/* ─── Top bar — brand + sub. No diamond, no pulse pill ─── */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-7 py-6">
        <div className="flex items-center gap-2.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ background: ACCENT, boxShadow: `0 0 8px ${ACCENT}` }}
          />
          <div className="leading-[1.1]">
            <div className="font-mono text-[10px] font-bold tracking-[0.28em] text-white">
              {brand}
            </div>
            {subBrand && (
              <div
                className="font-mono text-[8.5px] font-bold uppercase tracking-[0.28em]"
                style={{ color: ACCENT }}
              >
                {subBrand}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Content slot ─── */}
      <div className="absolute inset-x-7 top-[88px] bottom-[72px] flex flex-col">
        {children}
      </div>

      {/* ─── Footer ─── */}
      <div className="absolute inset-x-7 bottom-6 z-10 flex items-center justify-between">
        <div
          className="font-mono text-[10px] font-bold uppercase tracking-[0.22em]"
          style={{ color: "#9a9aa3" }}
        >
          {footerMeta}
        </div>
        {footerRight && (
          <div
            className="font-mono text-[10px] font-bold uppercase tabular-nums tracking-[0.22em]"
            style={{ color: ACCENT }}
          >
            {footerRight}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Lean dividers + eyebrow — drop-ins matching the new minimal language ─

/** A single thin accent line. No second dotted layer. */
export function PosterDivider({ className = "" }: { className?: string }) {
  return (
    <div className={`my-3 h-px w-12 ${className}`} style={{ background: ACCENT }} />
  );
}

/** Mono uppercase eyebrow. No leading ▶ square. */
export function PosterEyebrow({ children }: { children: ReactNode }) {
  return (
    <span
      className="font-mono text-[10px] font-bold uppercase tracking-[0.28em]"
      style={{ color: ACCENT }}
    >
      {children}
    </span>
  );
}
