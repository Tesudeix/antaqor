import MetaTrigger, { IMetaTrigger, TriggerSurface, TriggerPlatform } from "@/models/MetaTrigger";

export function matchKeyword(trigger: IMetaTrigger, text: string): boolean {
  const haystack = trigger.caseSensitive ? text : text.toLowerCase();
  for (const kwRaw of trigger.keywords) {
    const kw = trigger.caseSensitive ? kwRaw : kwRaw.toLowerCase();
    if (!kw) continue;
    if (trigger.matchMode === "exact" && haystack.trim() === kw) return true;
    if (trigger.matchMode === "contains" && haystack.includes(kw)) return true;
    if (trigger.matchMode === "starts_with" && haystack.startsWith(kw)) return true;
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
