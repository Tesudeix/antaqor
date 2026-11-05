export type SocialPlatform = "facebook" | "instagram" | "threads";
export const PLATFORMS: SocialPlatform[] = ["facebook", "instagram", "threads"];
export const PLATFORM_LABEL = { facebook: "Facebook", instagram: "Instagram", threads: "Threads" };
export const TEXT_LIMIT = { facebook: 63206, instagram: 2200, threads: 500 };
export const NEEDS_IMAGE = { facebook: false, instagram: true, threads: false };
export type ContentInput = { text: string; imageUrl?: string; videoUrl?: string; platforms: SocialPlatform[]; overrides?: Partial<Record<SocialPlatform, string>> };
export function textFor(input: ContentInput, platform: SocialPlatform) { return (input.overrides?.[platform]?.trim() || input.text || "").trim(); }
export function validate(input: ContentInput): string[] {
  const errors: string[] = [];
  if (!input.platforms.length) errors.push("Ядаж нэг суваг сонгоно уу.");
  if (input.imageUrl && input.videoUrl) errors.push("Зураг эсвэл видеоноос нэгийг сонгоно уу.");
  for (const url of [input.imageUrl, input.videoUrl].filter(Boolean)) {
    try { const u = new URL(url!); if (u.protocol !== "https:" || u.username || u.password) throw new Error(); }
    catch { errors.push("Медиа холбоос HTTPS байх ёстой."); }
  }
  for (const p of input.platforms) {
    const text = textFor(input, p);
    if (!text && !input.imageUrl && !input.videoUrl) errors.push(`${PLATFORM_LABEL[p]}: контент хоосон байна.`);
    if (Array.from(text).length > TEXT_LIMIT[p]) errors.push(`${PLATFORM_LABEL[p]}: ${TEXT_LIMIT[p]} тэмдэгтээс хэтэрсэн.`);
    if (p === "instagram" && !input.imageUrl && !input.videoUrl) errors.push("Instagram: зураг эсвэл Reel нэмнэ үү.");
  }
  return errors;
}
export function scheduleDate(raw: unknown, now = Date.now()): Date | null {
  if (raw === undefined || raw === null || raw === "") return null;
  const date = new Date(String(raw));
  if (!Number.isFinite(date.getTime()) || date.getTime() <= now + 30_000) throw new Error("Товлох цаг одоогоос дор хаяж 1 минутын дараа байх ёстой.");
  return date;
}
