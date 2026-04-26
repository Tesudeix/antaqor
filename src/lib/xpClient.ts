export const LEVEL_TITLES = [
  { minLevel: 1, maxLevel: 5, titleEN: "Punk", titleMN: "Панк" },
  { minLevel: 6, maxLevel: 15, titleEN: "Creator", titleMN: "Бүтээгч" },
  { minLevel: 16, maxLevel: 25, titleEN: "Engineer", titleMN: "Инженер" },
  { minLevel: 26, maxLevel: 40, titleEN: "Entrepreneur", titleMN: "Антрепренёр" },
  { minLevel: 41, maxLevel: 60, titleEN: "Conqueror", titleMN: "Байлдан дагуулагч" },
  { minLevel: 61, maxLevel: 80, titleEN: "Entaqor", titleMN: "Энтакор" },
  { minLevel: 81, maxLevel: 95, titleEN: "Emperor", titleMN: "Эзэн хаан" },
  { minLevel: 96, maxLevel: 100, titleEN: "Legend", titleMN: "Домог" },
] as const;

/** Role names for display */
export const ROLE_LABELS: Record<string, { en: string; mn: string; color: string }> = {
  punk: { en: "Punk", mn: "Панк", color: "#999999" },
  creator: { en: "Creator", mn: "Бүтээгч", color: "#3B82F6" },
  engineer: { en: "Engineer", mn: "Инженер", color: "#0F81CA" },
  entrepreneur: { en: "Entrepreneur", mn: "Антрепренёр", color: "#EF2C58" },
  conqueror: { en: "Conqueror", mn: "Байлдан дагуулагч", color: "#EF2C58" },
  entaqor: { en: "Entaqor", mn: "Энтакор", color: "#A855F7" },
  emperor: { en: "Emperor", mn: "Эзэн хаан", color: "#FF4473" },
  legend: { en: "Legend", mn: "Домог", color: "#F472B6" },
};

/** Total XP required to reach level N: 100 * N^2 */
export function xpForLevel(level: number): number {
  return 100 * level * level;
}

/** Calculate level from total XP */
export function calculateLevel(xp: number): number {
  if (xp <= 0) return 1;
  const level = Math.floor(Math.sqrt(xp / 100));
  return Math.max(1, Math.min(level, 100));
}

/** Get title for a given level */
export function getLevelTitle(level: number): { titleEN: string; titleMN: string } {
  const entry = LEVEL_TITLES.find((t) => level >= t.minLevel && level <= t.maxLevel);
  return entry || LEVEL_TITLES[0];
}

/** Get role key from level */
export function getRoleFromLevel(level: number): string {
  const title = getLevelTitle(level);
  return title.titleEN.toLowerCase();
}

/** Get progress within current level (0-1) */
export function getLevelProgress(xp: number, level: number): number {
  const currentLevelXP = xpForLevel(level);
  const nextLevelXP = xpForLevel(level + 1);
  if (level >= 100) return 1;
  const progress = (xp - currentLevelXP) / (nextLevelXP - currentLevelXP);
  return Math.max(0, Math.min(1, progress));
}
