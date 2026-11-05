// Серверийн шийдэгч: анхдагч үнэ ← SiteSettings-ийн дарж бичилт.
// `src/lib/imagePricingServer.ts`-тэй ижил хэв маяг: төлбөр авдаг ч,
// үнэ харуулдаг ч бүх зүйл ЭНД дамжина — тэгэхээр хоёр нь зөрж чадахгүй.

import { getSetting, setSetting } from "@/lib/siteSettings";
import { VIDEO_MODELS, defaultVideoPricing, type VideoPricing } from "@/lib/videoPricing";

export async function loadVideoPricing(): Promise<VideoPricing> {
  const p = defaultVideoPricing();
  /* 2026-10-13: үнэ нь өртгөөс ТООЦОГДОНО (videoPricing VIDEO_COST_MODEL) —
     админы секунд тутмын дарж бичилтийг ашиглахгүй болсон (тэр нь алдагдал
     үүсгэж байсан). */
  void getSetting; void VIDEO_MODELS;
  return p;
}

export type VideoPricingPatch = Partial<{ perSecond: Partial<Record<string, number>> }>;

export async function saveVideoPricing(patch: VideoPricingPatch): Promise<VideoPricing> {
  const writes: Promise<void>[] = [];
  if (patch.perSecond) {
    for (const m of VIDEO_MODELS) {
      const v = patch.perSecond[m.id];
      // 1..500 ₵/сек — хязгаар нь бөглөх алдаанаас хамгаална (0 бол үнэгүй,
      // 5000 бол хэн ч видео хийхгүй).
      if (typeof v === "number" && v >= 1 && v <= 500) writes.push(setSetting(m.settingKey, Math.round(v)));
    }
  }
  await Promise.all(writes);
  return loadVideoPricing();
}
