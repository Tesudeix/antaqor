export const CREATOR_PROGRAM_START = "2026-09-01T00:00:00+08:00";
export const CREATOR_PROGRAM_END = "2026-10-01T00:00:00+08:00";
export const CREATOR_SEATS = 100;
export function creatorProgram(now = new Date()) {
  const start = new Date(CREATOR_PROGRAM_START).getTime();
  const elapsed = Math.floor((now.getTime() - start) / 86400000);
  return { day: Math.max(0, Math.min(30, elapsed + 1)), days: 30, ended: now.getTime() >= new Date(CREATOR_PROGRAM_END).getTime(), started: now.getTime() >= start };
}
