import dbConnect from "@/lib/mongodb";
import SiteSettings from "@/models/SiteSettings";

// ─── Typed SiteSettings accessors with defaults ───

/* 2026-10-26: КРЕДИТ = ₮. Доорх кредит үнэ бүгд ×100 болсон (өмнө 1 кр = ₮100). */
export const DEFAULTS = {
  feedLevelBand: 2,      // ±N levels around user's effective level
  freeLevelCap: 5,       // free users' effective level ceiling
  paidXpMultiplier: 1.5, // XP earnings multiplier for paying members
  levelGateEnabled: 1,   // 1 = on, 0 = off (admin kill switch)
  /* ─── AI зураг · кредит үнэ (2026-09-02) — /admin/ai-images дээр засна.
     Анхдагч утга src/lib/imagePricing.ts IMAGE_MODELS-тэй ИЖИЛ байх ёстой. */
  /* Холбоос→mp4 татац. Татац нь ХЭРЭГЛЭГЧИЙН машин дээр, тэдний
     интернэтээр гүйдэг тул Antaqor-ын ахиуц зардал ~тэг — үнэ нь
     зөвхөн үйлчилгээний төлбөр, тиймээс зургийнхаас (5–15) эрс хямд. */
  ytCostSd: 100,
  ytCostHd: 100,
  ytCostUhd: 200,
  imgCostNano2: 400,
  imgCostNanoPro: 800,
  imgCostNanoLite: 200,
  imgCostNano: 400,
  imgCostGpt: 100,
  imgCostKling: 200,
  imgHdMultiplier: 1.5,
  /* ─── AI видео · кредит үнэ (2026-09-03) — СЕКУНД тутмын үнэ.
     Нийт = үнэ × хугацаа. Анхдагч утга src/lib/videoPricing.ts
     VIDEO_MODELS-тэй ИЖИЛ байх ёстой. */
  vidCostSeedance25: 3000,
  vidCostSeedance20: 2000,
  /* Лайк → кредит: likesPerCredit лайк тутамд likeMilestoneCredits ₵. 0 = унтраах. */
  /* Промптын зах зээл: зохиогчид ногдох ХУВЬ (%). Үлдсэнийг тавцан авна.
     80 нь санамсаргүй тоо биш — тавцан бүх мөнгийг авбал гишүүд промптоо
     энд БИШ, өөр газар тавина. Зохиогчийн хувь нь урамшуулал биш,
     нийлүүлэлтийн НӨХЦӨЛ. */
  promptCreatorShare: 80,
  /* Tesla Trader (/trader-agent): нэг скан = gpt-5.5 vision + тайлбар ≈ $0.05 (≈₮180) → 400 кр (1 кр = 1₮). */
  traderScanCost: 400,
  likesPerCredit: 10,
  likeMilestoneCredits: 100,
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

/* ─── Тэмдэгт мөрийн тохиргоо ────────────────────────────────────────────
   Дээрх `getSetting` нь ТООН утгад зориулагдсан бөгөөд `DEFAULTS`-д
   бүртгэгдсэн түлхүүрүүдийг л мэднэ — тэр хатуу байдал нь зориуд:
   түвшний тохиргоо бүрийн анхдагч утга нэг газар байх ёстой.

   Загварын нэр гэх мэт зарим тохиргоо нь тоо биш. Тэднийг тоо болгон
   шахах гэж оролдвол утгагүй хөрвүүлэлт үүснэ, харин `DEFAULTS`-д хийвэл
   төрөл нь эвдэрнэ. Тиймээс ижил коллекц, ижил кэшийн хэв маягтай ч
   ТУСДАА хос функц. Түлхүүр нь чөлөөт — дуудагч өөрөө хариуцна. */
const textCache = new Map<string, { value: string; at: number }>();

export async function getTextSetting(key: string, fallback = ""): Promise<string> {
  const cached = textCache.get(key);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;

  try {
    await dbConnect();
    const doc = await SiteSettings.findOne({ key }).lean();
    const raw = (doc as unknown as { value?: string } | null)?.value;
    const value = typeof raw === "string" ? raw : fallback;
    textCache.set(key, { value, at: Date.now() });
    return value;
  } catch {
    return fallback;
  }
}

export async function setTextSetting(key: string, value: string): Promise<void> {
  await dbConnect();
  await SiteSettings.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
  textCache.set(key, { value, at: Date.now() });
}
