// Server-side resolver: pricing defaults ← SiteSettings overrides.
// Admin edits the numbers at /admin/ai-images; everything that charges or
// displays a credit price reads through here so the two can never disagree.

import { getSetting, setSetting } from "@/lib/siteSettings";
import { IMAGE_MODELS, defaultPricing, type ImagePricing } from "@/lib/imagePricing";

export async function loadImagePricing(): Promise<ImagePricing> {
  const p = defaultPricing();
  const [hd, lpc, lmc, ...costs] = await Promise.all([
    getSetting("imgHdMultiplier"),
    getSetting("likesPerCredit"),
    getSetting("likeMilestoneCredits"),
    ...IMAGE_MODELS.map((m) => getSetting(m.settingKey)),
  ]);
  IMAGE_MODELS.forEach((m, i) => {
    const v = costs[i];
    if (Number.isFinite(v) && v > 0) p.costs[m.id] = Math.round(v);
  });
  if (Number.isFinite(hd) && hd >= 1) p.hdMultiplier = hd;
  if (Number.isFinite(lpc) && lpc >= 1) p.likesPerCredit = Math.round(lpc);
  if (Number.isFinite(lmc) && lmc >= 0) p.likeMilestoneCredits = Math.round(lmc);
  return p;
}

export type PricingPatch = Partial<{
  hdMultiplier: number;
  likesPerCredit: number;
  likeMilestoneCredits: number;
  costs: Partial<Record<string, number>>;
}>;

export async function saveImagePricing(patch: PricingPatch): Promise<ImagePricing> {
  const writes: Promise<void>[] = [];
  if (typeof patch.hdMultiplier === "number" && patch.hdMultiplier >= 1 && patch.hdMultiplier <= 5) {
    writes.push(setSetting("imgHdMultiplier", patch.hdMultiplier));
  }
  if (typeof patch.likesPerCredit === "number" && patch.likesPerCredit >= 1 && patch.likesPerCredit <= 1000) {
    writes.push(setSetting("likesPerCredit", Math.round(patch.likesPerCredit)));
  }
  if (typeof patch.likeMilestoneCredits === "number" && patch.likeMilestoneCredits >= 0 && patch.likeMilestoneCredits <= 100) {
    writes.push(setSetting("likeMilestoneCredits", Math.round(patch.likeMilestoneCredits)));
  }
  if (patch.costs) {
    for (const m of IMAGE_MODELS) {
      const v = patch.costs[m.id];
      if (typeof v === "number" && v >= 1 && v <= 1000) writes.push(setSetting(m.settingKey, Math.round(v)));
    }
  }
  await Promise.all(writes);
  return loadImagePricing();
}
