// Thread post → shareable poster (Threads / IG carousel, 3:4).
//
// Pattern (SKILL.md-true): eyebrow → divider → giant pixel-block accent word
// (always Handjet with magenta glow + outline) → Inter quote body → author.
//
// The accent word is rendered standalone — NOT inline inside the body — so
// it always lands as a pixel-block focal point, never squished mid-sentence.
// If no accent word is given we auto-pick a short uppercase candidate from
// the text. The body reads as the supporting quote.

import { PosterFrame, PosterDivider } from "./PosterFrame";

export interface ThreadPosterProps {
  /** The post body text. Rendered as a Threads-style quote below the accent. */
  text: string;
  /** Category slug or label — shown in the eyebrow. */
  category?: string;
  /** Author display name. */
  author?: string;
  /** Author handle / role / one-word descriptor below the name. */
  authorMeta?: string;
  /** "Pulled from /classroom" or similar provenance copy for the footer. */
  source?: string;
  /**
   * The one focal word rendered in Handjet pixel-block + magenta glow.
   * If omitted, we auto-pick a punchy short word from the text.
   */
  accentWord?: string;
  /** Override the standalone headline shown above the body. Defaults to accentWord. */
  headline?: string;
  /** Optional background image — fills the frame; foreground stays readable. */
  image?: string;
}

const ACCENT = "#2E29FF";

export function ThreadPoster({
  text,
  category = "ПОСТ",
  author = "ANTAQOR",
  authorMeta = "АНДРЕПРЕНЁР",
  source,
  accentWord,
  headline,
  image,
}: ThreadPosterProps) {
  // Pick the focal headline word. Priority: explicit `headline` prop → explicit
  // `accentWord` prop → auto-pick from text (shortest punchy candidate).
  const focal = (headline || accentWord || pickFocalWord(text)).toUpperCase();
  const focalSize = focalFontSize(focal);

  // Body length determines quote scale — keeps the card readable in 3:4
  // even when the post runs long.
  const bodyLen = text.length;
  const bodySize = bodyLen < 90 ? 22 : bodyLen < 180 ? 19 : bodyLen < 280 ? 16 : 14;

  return (
    <PosterFrame
      brand="ANTAQOR"
      subBrand={category.toUpperCase()}
      backgroundImage={image}
      footerMeta={source ? source.toUpperCase() : `@${author.replace(/\s+/g, "").toLowerCase()}`}
      footerRight="POST"
    >
      {/* Top spacer — pushes the focal word into the visual center, where the
          eye lands. The minimal frame already carries the brand/sub in the
          top bar, so we don't repeat an eyebrow here. */}
      <div className="flex-1" />

      <PosterDivider />

      {/* ─── Focal pixel-block accent word (always Handjet, always glow) ─── */}
      <h1
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 900,
          fontSize: `${focalSize}px`,
          lineHeight: 0.92,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          color: ACCENT,
          textShadow:
            "0 0 24px rgba(46,41,255,0.55), 0 0 48px rgba(46,41,255,0.35)",
          WebkitTextStroke: "1px rgba(15,23,38,0.12)",
          margin: 0,
        }}
        className="break-words"
      >
        {focal}
        <span
          style={{
            color: ACCENT,
            textShadow: `0 0 20px ${ACCENT}`,
            WebkitTextStroke: "0",
          }}
        >
          .
        </span>
      </h1>

      {/* ─── Body — clean Inter quote with first-word emphasis ─── */}
      <p
        style={{
          fontFamily: "var(--font-sans)",
          fontWeight: 500,
          fontSize: `${bodySize}px`,
          lineHeight: 1.45,
          letterSpacing: "-0.005em",
          color: "#d9d9e1",
          marginTop: "20px",
          maxWidth: "560px",
        }}
        className="break-words"
      >
        <span style={{ fontWeight: 900, color: "#ffffff" }}>
          {firstWord(text)}
        </span>
        {restOfText(text)}
      </p>

      {/* Spacer pushes author block to the bottom */}
      <div className="flex-1" />

      {/* ─── Author block — mono chrome attribution ─── */}
      <div className="mt-4">
        <div
          className="font-mono text-[11px] font-bold uppercase tracking-[0.24em]"
          style={{ color: ACCENT, textShadow: `0 0 8px rgba(46,41,255,0.4)` }}
        >
          — {author.toUpperCase()}
        </div>
        {authorMeta && (
          <div
            className="mt-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.28em]"
            style={{ color: "#6b6b73" }}
          >
            {authorMeta}
          </div>
        )}
      </div>
    </PosterFrame>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────

// Pick a focal candidate from the text — prefer short, ALL-CAPS words first,
// then short Latin-only words (Handjet hits hardest in Latin per SKILL.md),
// then fall back to the first word.
function pickFocalWord(text: string): string {
  const words = text.match(/[\p{L}]+/gu) || [];
  if (words.length === 0) return "ANTAQOR";

  // Try ALL-CAPS standalone (e.g. "API", "AGENT") first.
  const caps = words.find((w) => w.length >= 3 && w === w.toUpperCase());
  if (caps) return caps;

  // Latin word, 4–9 chars — the sweet spot for Handjet pixel rendering.
  const latinSweet = words.find((w) => /^[A-Za-z]+$/.test(w) && w.length >= 4 && w.length <= 9);
  if (latinSweet) return latinSweet;

  // Cyrillic word, 4–9 chars — same length window.
  const cyrSweet = words.find((w) => w.length >= 4 && w.length <= 9);
  if (cyrSweet) return cyrSweet;

  return words[0] || "ANTAQOR";
}

// Headline size auto-scales so the word fills the available width without
// truncating, but doesn't dominate when very short (avoids "T H E" mega-stretch).
function focalFontSize(word: string): number {
  const len = word.length;
  if (len <= 3) return 140;
  if (len <= 5) return 124;
  if (len <= 7) return 104;
  if (len <= 9) return 84;
  if (len <= 12) return 68;
  return 56;
}

function firstWord(text: string): string {
  const trimmed = text.trim();
  const i = trimmed.indexOf(" ");
  return i === -1 ? trimmed : trimmed.slice(0, i);
}
function restOfText(text: string): string {
  const trimmed = text.trim();
  const i = trimmed.indexOf(" ");
  return i === -1 ? "" : trimmed.slice(i);
}
