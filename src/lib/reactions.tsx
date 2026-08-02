import { ReactNode } from "react";

export type ReactionKey = "like" | "love" | "fire" | "idea" | "haha" | "celebrate";

export interface ReactionConfig {
  key: ReactionKey;
  label: string;
  color: string;
  bg: string;
  Icon: (props: { size?: number; active?: boolean }) => ReactNode;
}

// ─── Cyberpunk icon system ──────────────────────────────────────────────
// Every icon is rendered inside a hex frame (HUD-style) with a sharp
// geometric glyph in its neon brand color. Same viewBox, same stroke
// language, same hex container — radically consistent.
//
//   - hex frame: 1.4px stroke in reaction color, color12 fill (low alpha)
//   - glyph: 1.6–2px stroke in same color, square joins, no curves
//   - active state: brighter inner glow + heavier glyph
//
// Hex coords:
//   (12, 2) - (21, 7) - (21, 17) - (12, 22) - (3, 17) - (3, 7)

const Hex = ({ color, active }: { color: string; active?: boolean }) => (
  <path
    d="M12 2 L21 7 L21 17 L12 22 L3 17 L3 7 Z"
    stroke={color}
    strokeWidth={active ? 1.7 : 1.3}
    fill={active ? `${color}28` : `${color}12`}
    strokeLinejoin="round"
  />
);

const baseSvg = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  "aria-hidden": true,
});

const Like = ({ size = 22, active }: { size?: number; active?: boolean }) => {
  const c = "#1B74E4";
  return (
    <svg {...baseSvg(size)}>
      <Hex color={c} active={active} />
      {/* Stacked upward chevron — power-up / level-up signal */}
      <path
        d="M8 14 L12 10 L16 14 M9.5 17 L12 14.5 L14.5 17"
        stroke={c}
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
};

const Love = ({ size = 22, active }: { size?: number; active?: boolean }) => {
  const c = "#F33E58";
  return (
    <svg {...baseSvg(size)}>
      <Hex color={c} active={active} />
      {/* Зүрх — гөлгөр heart SVG */}
      <path
        d="M12 17.2 C9.2 14.9 6.6 12.9 6.6 10.4 C6.6 8.7 8 7.4 9.7 7.4 C10.7 7.4 11.6 7.9 12 8.7 C12.4 7.9 13.3 7.4 14.3 7.4 C16 7.4 17.4 8.7 17.4 10.4 C17.4 12.9 14.8 14.9 12 17.2 Z"
        fill={active ? c : "none"}
        stroke={c}
        strokeWidth={active ? 1 : 1.6}
        strokeLinejoin="round"
      />
    </svg>
  );
};

const Fire = ({ size = 22, active }: { size?: number; active?: boolean }) => {
  const c = "#FF7847";
  return (
    <svg {...baseSvg(size)}>
      <Hex color={c} active={active} />
      {/* Triangular flame stack */}
      <path
        d="M12 7 L15 12 L13.5 12 L14.5 16 L9.5 16 L10.5 12 L9 12 Z"
        fill={active ? c : "none"}
        stroke={c}
        strokeWidth={active ? 1 : 1.6}
        strokeLinejoin="miter"
      />
    </svg>
  );
};

const Idea = ({ size = 22, active }: { size?: number; active?: boolean }) => {
  const c = "#FFD300";
  return (
    <svg {...baseSvg(size)}>
      <Hex color={c} active={active} />
      {/* Lightning bolt — sharp Z */}
      <path
        d="M13.5 7 L8.5 13 H11.5 L10.5 17 L15.5 11 H12.5 Z"
        fill={active ? c : "none"}
        stroke={c}
        strokeWidth={active ? 1 : 1.6}
        strokeLinejoin="miter"
      />
    </svg>
  );
};

const Haha = ({ size = 22, active }: { size?: number; active?: boolean }) => {
  const c = "#FFC700";
  return (
    <svg {...baseSvg(size)}>
      <Hex color={c} active={active} />
      {/* Square pixel eyes */}
      <rect x="8.5" y="10" width="2" height="2" fill={c} />
      <rect x="13.5" y="10" width="2" height="2" fill={c} />
      {/* V-grin — angular smile */}
      <path
        d="M8.5 14 L12 17 L15.5 14"
        stroke={c}
        strokeWidth={active ? 2.2 : 1.8}
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
      />
    </svg>
  );
};

const Celebrate = ({ size = 22, active }: { size?: number; active?: boolean }) => {
  const c = "#E0218A";
  return (
    <svg {...baseSvg(size)}>
      <Hex color={c} active={active} />
      {/* 4-point sparkle burst */}
      <path
        d="M12 7 L13 11 L17 12 L13 13 L12 17 L11 13 L7 12 L11 11 Z"
        fill={active ? c : "none"}
        stroke={c}
        strokeWidth={active ? 0.8 : 1.4}
        strokeLinejoin="miter"
      />
      {/* tiny corner sparks */}
      <circle cx="6.5" cy="8.5" r="0.6" fill={c} />
      <circle cx="17.5" cy="15.5" r="0.6" fill={c} />
    </svg>
  );
};

export const REACTIONS: Record<ReactionKey, ReactionConfig> = {
  like: { key: "like", label: "Like", color: "#1B74E4", bg: "rgba(27,116,228,0.12)", Icon: Like },
  love: { key: "love", label: "Love", color: "#F33E58", bg: "rgba(243,62,88,0.12)", Icon: Love },
  fire: { key: "fire", label: "Fire", color: "#FF7847", bg: "rgba(255,120,71,0.12)", Icon: Fire },
  idea: { key: "idea", label: "Idea", color: "#FFD300", bg: "rgba(255,211,0,0.12)", Icon: Idea },
  haha: { key: "haha", label: "Haha", color: "#FFC700", bg: "rgba(255,199,0,0.12)", Icon: Haha },
  celebrate: { key: "celebrate", label: "Баяр", color: "#E0218A", bg: "rgba(224,33,138,0.12)", Icon: Celebrate },
};

export const REACTION_ORDER: ReactionKey[] = ["like", "love", "fire", "idea", "haha", "celebrate"];

const LEGACY_MAP: Record<string, ReactionKey> = {
  heart: "love",
  clap: "celebrate",
  rocket: "fire",
  think: "idea",
  hundred: "love",
  haha: "haha",
  fire: "fire",
};

export function normalizeReactions(raw: Record<string, string[]> | undefined): Record<ReactionKey, string[]> {
  const out: Record<ReactionKey, string[]> = {
    like: [], love: [], fire: [], idea: [], haha: [], celebrate: [],
  };
  if (!raw) return out;
  for (const [key, users] of Object.entries(raw)) {
    if (!Array.isArray(users) || users.length === 0) continue;
    const target = (REACTION_ORDER as string[]).includes(key)
      ? (key as ReactionKey)
      : LEGACY_MAP[key];
    if (!target) continue;
    for (const u of users) {
      const id = String(u);
      if (!out[target].includes(id)) out[target].push(id);
    }
  }
  return out;
}

export function legacyToCanonical(emoji: string): ReactionKey | null {
  if ((REACTION_ORDER as string[]).includes(emoji)) return emoji as ReactionKey;
  return LEGACY_MAP[emoji] ?? null;
}
