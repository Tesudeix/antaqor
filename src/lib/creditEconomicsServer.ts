import dbConnect from "@/lib/mongodb";
import SiteSettings from "@/models/SiteSettings";
import { ECON_DEFAULT, normalizeEcon, type Econ } from "@/lib/creditEconomics";

/* Кредитийн эдийн засгийн тохиргоо — SiteSettings `credit_econ` (JSON). 30с кэш. */
export const ECON_KEY = "credit_econ";
let cache: { at: number; v: Econ } | null = null;

export async function getEcon(): Promise<Econ> {
  if (cache && Date.now() - cache.at < 30_000) return cache.v;
  try {
    await dbConnect();
    const row = await SiteSettings.findOne({ key: ECON_KEY }).lean<{ value?: string }>();
    const v = row?.value ? normalizeEcon(JSON.parse(row.value)) : ECON_DEFAULT;
    cache = { at: Date.now(), v };
    return v;
  } catch {
    return cache?.v || ECON_DEFAULT;
  }
}

export async function saveEcon(next: unknown): Promise<Econ> {
  const v = normalizeEcon(next);
  await dbConnect();
  await SiteSettings.findOneAndUpdate({ key: ECON_KEY }, { $set: { value: JSON.stringify(v) } }, { upsert: true });
  cache = { at: Date.now(), v };
  return v;
}
