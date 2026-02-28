export const LEVEL_TITLES = [
  { minLevel: 1, maxLevel: 10, titleEN: "Creator", titleMN: "Бүтээгч" },
  { minLevel: 11, maxLevel: 20, titleEN: "Engineer", titleMN: "Инженер" },
  { minLevel: 21, maxLevel: 40, titleEN: "Entrepreneur", titleMN: "Антрепренёр" },
  { minLevel: 41, maxLevel: 60, titleEN: "Conqueror", titleMN: "Байлдагч" },
  { minLevel: 61, maxLevel: 90, titleEN: "Entaqor", titleMN: "Энтакор" },
  { minLevel: 91, maxLevel: 100, titleEN: "Emperor", titleMN: "Эзэн хаан" },
] as const;

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

/** Get progress within current level (0-1) */
export function getLevelProgress(xp: number, level: number): number {
  const currentLevelXP = xpForLevel(level);
  const nextLevelXP = xpForLevel(level + 1);
  if (level >= 100) return 1;
  const progress = (xp - currentLevelXP) / (nextLevelXP - currentLevelXP);
  return Math.max(0, Math.min(1, progress));
}
