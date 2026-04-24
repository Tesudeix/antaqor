import dbConnect from "@/lib/mongodb";
import SiteSettings from "@/models/SiteSettings";

// ─── Typed SiteSettings accessors with defaults ───

export const DEFAULTS = {
  feedLevelBand: 2,      // ±N levels around user's effective level
  freeLevelCap: 5,       // free users' effective level ceiling
  paidXpMultiplier: 1.5, // XP earnings multiplier for paying members
  levelGateEnabled: 1,   // 1 = on, 0 = off (admin kill switch)
} as const;

type SettingKey = keyof typeof DEFAULTS;

const cache = new Map<string, { value: number; at: number }>();
const TTL_MS = 30_000; // 30s cache — settings change rarely

export async function getSetting(key: SettingKey): Promise<number> {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  try {
    await dbConnect();
    const doc = await SiteSettings.findOne({ key }).lean();
    const raw = (doc as unknown as { value?: string } | null)?.value;
    const parsed = raw === undefined || raw === null || raw === "" ? NaN : Number(raw);
    const value = Number.isFinite(parsed) ? parsed : DEFAULTS[key];
    cache.set(key, { value, at: Date.now() });
    return value;
  } catch {
    return DEFAULTS[key];
  }
}

export async function setSetting(key: SettingKey, value: number): Promise<void> {
  await dbConnect();
  await SiteSettings.findOneAndUpdate(
    { key },
    { value: String(value) },
    { upsert: true, new: true }
  );
  cache.set(key, { value, at: Date.now() });
}

export async function getAllLevelSettings() {
  const [band, cap, multiplier, enabled] = await Promise.all([
    getSetting("feedLevelBand"),
    getSetting("freeLevelCap"),
    getSetting("paidXpMultiplier"),
    getSetting("levelGateEnabled"),
  ]);
  return { band, cap, multiplier, enabled: enabled === 1 };
}
