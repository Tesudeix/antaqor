import MetaTrigger, { IMetaTrigger, TriggerSurface, TriggerPlatform } from "@/models/MetaTrigger";

const WORD_CACHE = new Map<string, RegExp>();

function wordHit(haystack: string, kw: string): boolean {
  let re = WORD_CACHE.get(kw);
  if (!re) {
    const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(`(^|[^\\p{L}\\p{N}])${esc}($|[^\\p{L}\\p{N}])`, "u");
    WORD_CACHE.set(kw, re);
  }
  return re.test(haystack);
}

export function matchKeyword(trigger: IMetaTrigger, text: string): boolean {
  const haystack = trigger.caseSensitive ? text : text.toLowerCase();
  for (const kwRaw of trigger.keywords) {
    const kw = trigger.caseSensitive ? kwRaw : kwRaw.toLowerCase();
    if (!kw) continue;
    if (trigger.matchMode === "exact" && haystack.trim() === kw) return true;
    if (trigger.matchMode === "contains" && haystack.includes(kw)) return true;
    if (trigger.matchMode === "starts_with" && haystack.startsWith(kw)) return true;
    // "word" — the keyword as a standalone word. This is what short keywords
    // need: "ai" on `contains` also fires on sain, baina, hair, email, again,
    // which would DM half the commenters. JS \b is ASCII-only, so Cyrillic is
    // matched by explicitly excluding letters/digits on either side.
    if (trigger.matchMode === "word" && wordHit(haystack, kw)) return true;
  }
  return false;
}

export async function findMatchingTrigger(
  text: string,
  surface: TriggerSurface,
  platform: TriggerPlatform,
  account: string = "antaqor",
  postId: string = ""
): Promise<IMetaTrigger | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const triggers = await MetaTrigger.find({
    enabled: true,
    surface: { $in: [surface, "both"] },
    platform: { $in: [platform, "both"] },
    ...(account === "antaqor" ? { account: { $in: ["antaqor", null] } } : { account }),
    ...(surface === "comment" && postId
      ? { $or: [{ postId: "" }, { postId: { $exists: false } }, { postId: null }, { postId }] }
      : {}),
  }).lean<IMetaTrigger[]>();
  for (const t of triggers) {
    if (matchKeyword(t, trimmed)) return t;
  }
  return null;
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_m, k) => vars[k] ?? "");
}
