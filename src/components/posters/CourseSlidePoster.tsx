// Course lesson cover slide — Variant 01 (Cover) from SKILL.md.
// Pattern: top eyebrow with course/lesson breadcrumb → giant Handjet
// pixel-block stack (2-3 lines, 1 accent word) → divider → lead Inter
// copy → MOD grid (4 bracketed cards, current lesson active).
// Footer uses "ENTER N/Total" (or "DEPLOY" for final lesson).

import { PosterFrame } from "./PosterFrame";

export interface CourseSlidePosterProps {
  /** Course title — shown in the top sub-brand. */
  courseTitle?: string;
  /** Module / lesson number (1-indexed). */
  lessonNumber: number;
  /** Total number of lessons (for "N/Total"). */
  totalLessons: number;
  /** Lesson title split into lines (2–3 words per line, see SKILL.md). */
  titleLines: string[];
  /** Which line (0-indexed) gets the accent treatment. Default last line. */
  accentLine?: number;
  /** One-sentence lead copy (Inter). */
  lead?: string;
  /** Is this the closing slide? Switches footer right to DEPLOY. */
  closing?: boolean;
  /** Optional progress dots strip at the bottom. Defaults to true. */
  showProgress?: boolean;
  /** Optional background image — fills the frame. */
  image?: string;
}

const ACCENT = "#1080CA";
const ACCENT_DEEP = "#4FA8E8";

export function CourseSlidePoster({
  courseTitle = "ANTAQOR · АКАДЕМИ",
  lessonNumber,
  totalLessons,
  titleLines,
  accentLine,
  lead,
  closing = false,
  showProgress = true,
  image,
}: CourseSlidePosterProps) {
  const accentIdx = accentLine ?? titleLines.length - 1;

  // Auto-scale headline font: more lines = smaller, longer-line = smaller.
  const longestLineLen = Math.max(...titleLines.map((l) => l.length));
  const baseSize =
    titleLines.length >= 4 ? 56
    : longestLineLen > 9 ? 80
    : longestLineLen > 6 ? 104
    : 128;

  const stepLabel = `${String(lessonNumber).padStart(2, "0")} / ${String(totalLessons).padStart(2, "0")}`;

  return (
    <PosterFrame
      brand={courseTitle.toUpperCase()}
      subBrand={`ХИЧЭЭЛ № ${String(lessonNumber).padStart(2, "0")}`}
      backgroundImage={image}
      footerMeta={`LESSON ${String(lessonNumber).padStart(2, "0")}`}
      footerRight={closing ? "DEPLOY" : stepLabel}
    >
      {/* Top spacer so the title block sits in the visual center */}
      <div className="flex-1" />

      {/* Giant Handjet pixel-block stack — 2–3 lines, one accent word */}
      <div className="flex-1">
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 800,
            fontSize: `${baseSize}px`,
            lineHeight: 0.92,
            letterSpacing: "0.02em",
            textTransform: "uppercase",
            color: "#f5f5f7",
            margin: 0,
          }}
        >
          {titleLines.map((line, i) => {
            const isAccent = i === accentIdx;
            const isLast = i === titleLines.length - 1;
            return (
              <span key={i} style={{ display: "block" }}>
                <span
                  style={
                    isAccent
                      ? {
                          color: ACCENT,
                          fontWeight: 900,
                          letterSpacing: "0.04em",
                          textShadow:
                            "0 0 24px rgba(16,128,202,0.55), 0 0 48px rgba(16,128,202,0.35)",
                          WebkitTextStroke: "1px rgba(15,23,38,0.12)",
                        }
                      : undefined
                  }
                >
                  {line}
                </span>
                {isLast && (
                  <span
                    style={{
                      color: ACCENT,
                      textShadow: `0 0 20px ${ACCENT}`,
                    }}
                  >
                    .
                  </span>
                )}
              </span>
            );
          })}
        </h1>

        {lead && (
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontWeight: 500,
              fontSize: "16px",
              lineHeight: 1.5,
              letterSpacing: "-0.005em",
              color: "#c9c9d1",
              marginTop: "24px",
              maxWidth: "440px",
            }}
          >
            <span style={{ fontWeight: 900, color: "#ffffff" }}>
              {lead.split(" ").slice(0, 1)[0]}
            </span>{" "}
            {lead.split(" ").slice(1).join(" ")}
          </p>
        )}
      </div>

      {/* ─── Progress strip — N dots, one per lesson. Past = filled small,
              current = bigger magenta block with glow, upcoming = outlined.
              Scales gracefully from 1 to ~30 lessons; beyond that we render
              a single bar with the index labels. ─── */}
      {showProgress && (
        <div className="mt-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span
              className="font-mono text-[9px] font-bold uppercase tracking-[0.24em]"
              style={{ color: ACCENT }}
            >
              MODULE · {String(lessonNumber).padStart(2, "0")}
            </span>
            <span
              className="font-mono text-[9px] font-bold uppercase tabular-nums tracking-[0.22em]"
              style={{ color: "#6b6b73" }}
            >
              {stepLabel}
            </span>
          </div>
          {totalLessons <= 24 ? (
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalLessons }).map((_, i) => {
                const idx = i + 1;
                const done = idx < lessonNumber;
                const current = idx === lessonNumber;
                return (
                  <div
                    key={i}
                    className="flex-1"
                    style={{
                      height: current ? "6px" : "3px",
                      background: current
                        ? ACCENT
                        : done
                          ? `${ACCENT_DEEP}aa`
                          : "rgba(15,23,38,0.08)",
                      boxShadow: current ? `0 0 10px ${ACCENT}` : undefined,
                      borderRadius: "1px",
                    }}
                  />
                );
              })}
            </div>
          ) : (
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-[rgba(15,23,38,0.06)]">
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${Math.round((lessonNumber / totalLessons) * 100)}%`,
                  background: `linear-gradient(90deg, ${ACCENT_DEEP}, ${ACCENT})`,
                  boxShadow: `0 0 10px ${ACCENT}`,
                }}
              />
            </div>
          )}
        </div>
      )}
    </PosterFrame>
  );
}
