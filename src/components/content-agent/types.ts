/* Antaqor Agent — клиент төрлүүд ба туслахууд */
export type Plat = "threads" | "facebook" | "instagram";
export type Post = {
  _id: string; day: string; at: string; text: string; format: "spark" | "value" | "offer"; source: string; idea: string; platforms: Plat[];
  status: "draft" | "scheduled" | "held" | "published" | "failed" | "deleted"; holdReason: string;
  pred: { score: number; novelty: number; base: number; nn: { text: string; score: number }[] };
  results: { platform: string; status: string; permalink: string; externalId: string }[];
  metrics: { likes: number; comments: number; shares: number; views: number; score: number; at: string | null };
  snaps?: { h1: number; h6: number; h24: number }; evaluated: boolean;
  kind: "text" | "infographic" | "image" | "video"; imageUrl: string; videoUrl?: string; mediaId?: string; mediaState?: "" | "rendering" | "ready" | "failed"; queued?: boolean; infographic: (IgSpec & { theme?: string }) | null; audience: string; variantGroup: string; angle: string;
  fixes: { from: string; to: string }[]; generic: string[]; origin: { src: string; sid: string }; metaAccount: string; threadsUserId: string; createdAt: string;
};
export type IgSpec = { template: "steps" | "list" | "compare" | "stat"; title: string; subtitle?: string; items: { title: string; text?: string }[]; cta?: string; left?: string; right?: string };
export type Note = { _id: string; title: string; body: string; tags: string[]; updatedAt: string; createdAt: string };
export type Audience = { _id: string; name: string; who: string; pains: string; desires: string; level: string; isDefault: boolean };
export type GalleryItem = { url: string; kind: "image" | "video"; label: string; mediaId: string; at: string };
export type DetectedItem = { mn: string; en: string; part: string };
export type Analysis = { src: string; category: string; summary: string; items: DetectedItem[]; hasPerson: boolean };
export type Product = { _id: string; name: string; pitch: string; price: string; link: string; cta: string; imageUrl: string; active: boolean; gallery?: GalleryItem[]; category?: string; analysis?: Analysis | null };
export type TwinProfile = { gender: string; age: string; eyeColor: string; hair: string; skin: string; build: string; dna: string };
export type Persona = {
  _id: string; name: string; photos: string[]; sheetUrl: string; status: "rendering" | "ready" | "failed"; error: string; isDefault: boolean;
  faces: string[]; bodies: string[]; hands: string[]; styleRef: string; profile: TwinProfile | null; style: string; palette: string; expr: string;
  outfit: string[]; outfitLabels: string[]; sheets: { kind: string; url: string; mediaId: string; label: string; at: string }[];
};
export type WardrobeItem = { url: string; label: string; part: string; source: "default" | "own" | "studio"; id: string };
export type Rule = { _id: string; name: string; active: boolean; days: number[]; hour: number; minute: number; format: "spark" | "value" | "offer" | "infographic" | "image" | "video"; source: "auto" | "notebook" | "top" | "product"; topic: string; audienceId: string; productId: string; platforms: Plat[]; lastRunDay: string };
export type Top = { key: string; text: string; score: number; likes: number; comments: number; views: number; postedAt: string; platform: string };
export type Other = { _id: string; at: string; text: string; brief: string; platforms: Plat[]; state: string };
export type Media = { _id: string; kind: "image" | "video"; modelId: string; prompt: string; idea: string; ratio: string; res: string; dur: number; status: "running" | "done" | "failed"; url: string; usd: number; error: string; postId: string; refs: string[]; createdAt: string; productId?: string; preset?: string; personaId?: string; batch?: string; q?: string; requestId?: string; endpoint?: string };
export type HfModel = { id: string; kind: "image" | "video" | "motion" | "edit"; label: string; note: string; ratios: string[]; res: string[]; durations: number[]; price: Record<string, number>; unit: "img" | "s"; epImage?: string };
export type MediaCfg = { imageModel: string; videoModel: string; videoRes: string; videoDur: number; ratio: string; dailyUsd: number };
export type Cognitive = { summary: string; beliefs: string[]; frames: string[]; vocabulary: string[]; tone: string; avoid: string[]; updatedAt: string | null };
export type Business = { name: string; about: string; audience: string; tone: string; brandColor: string; logoUrl: string; website: string; contact: string };
/* mode: business = бүх боломж (дууссан бол зөвхөн үзнэ); member = AI зураг + AI ихэр (Antaqor гишүүн); none = эрхгүй */
/** Кредит (2026-10-26): 1 кр = 1₮; үнэ = ceil10(өртөг$ × fx × markup). free = эзэн/админ. */
export type Credit = { balance: number; fx: number; markup: number; lowAt: number; free: boolean };
export type Me = { credit?: Credit; ws: string; plan: "owner" | "trial" | "active" | "expired" | "waitlist" | "member" | "none"; mode: "business" | "member" | "none"; isMember: boolean; daysLeft: number; superAdmin: boolean; name: string; email: string; viewingAs: boolean; business: Business | null; trialEndsAt: string | null; paidUntil: string | null; gensLeft: number | null; price: number; days: number };
export type Seats = { used: number; left: number };
export type State = {
  now: string; ask: string; me: Me; seats: Seats;
  cfg: { auto: boolean; channels: Plat[]; examples: string[]; generic: string[]; spellFix: boolean; runHour: number; cognitive: Cognitive | null; accounts: { metaAccount: string; threadsUserId: string }; lastHourlyAt: string | null; lastSyncAt: string | null; media: MediaCfg };
  posts: Post[]; others: Other[]; media: Media[]; personas: Persona[]; wardrobe: WardrobeItem[]; hf: { ready: boolean; spentToday: number; models: HfModel[]; google?: boolean }; notes: Note[]; audiences: Audience[]; products: Product[]; rules: Rule[]; top: Top[];
  stats: { vectors: number; published: number; avgActual: number; avgPred: number; evaluated: number }; learned: string[];
  accounts: { meta: { key: string; label: string; facebook: boolean; instagram: boolean; igUsername?: string }[]; threads: { id: string; username: string; ok: boolean }[] };
};
export type View = "home" | "create" | "image" | "media" | "planner" | "library" | "notebook" | "products" | "insights" | "settings" | "connect" | "admin" | "studio" | "twin" | "plans";
export type Ctx = { st: State; reload: () => Promise<void>; say: (m: string, bad?: boolean) => void; go: (v: View, params?: Record<string, string>) => void; params: Record<string, string> };

/** Супер админ ?as=<ws>-ээр түрээслэгчийн workspace-ийг нээсэн бол бүх хүсэлтэд дамжуулна */
/** studio.antaqor.com дээр апп "/" дээр, antaqor.com дээр /content-agent дээр амьдарна (2026-11-01) */
export function agentBase(): string {
  return typeof window !== "undefined" && window.location.hostname.startsWith("studio.") ? "/" : "/content-agent";
}

export function asParam(): string {
  if (typeof window === "undefined") return "";
  const as = new URLSearchParams(window.location.search).get("as");
  return as ? `as=${encodeURIComponent(as)}` : "";
}
export async function api<T = Record<string, unknown>>(body?: unknown, query = ""): Promise<T> {
  const q = [asParam(), query].filter(Boolean).join("&");
  const r = await fetch(`/api/content-agent${q ? `?${q}` : ""}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.error || (r.status === 401 ? "UNAUTH" : `Алдаа (${r.status})`)); throw e; }
  return d as T;
}
export const PL: Record<Plat, string> = { threads: "Threads", facebook: "Facebook", instagram: "Instagram" };
export const FMT: Record<string, string> = { spark: "Богино цочрол", value: "Задлал", offer: "Санал", infographic: "Infographic", image: "AI зураг", video: "AI видео" };
/** Higgsfield-ийн одоогийн үнэ ($) — сервер hfCost-той ижил томьёо */
export function costOf(models: HfModel[], id: string, res: string, dur: number) {
  const m = models.find((x) => x.id === id);
  if (!m) return 0;
  const u = m.price[res] ?? Object.values(m.price)[0] ?? 0;
  return m.unit === "img" ? u : u * Math.max(1, dur);
}
export const usd = (n: number) => (n < 0.1 ? `$${n.toFixed(3)}` : `$${n.toFixed(2)}`);
/** Зардлын шошго — бизнест доллар (≈ $0.05), гишүүнд бүтээлтийн тоо (гишүүн мөнгө төлдөггүй, өдөрт 10 бүтээлттэй). */
export const crFor = (usdEach: number, c: Pick<Credit, "fx" | "markup">) => Math.max(10, Math.ceil((Math.max(0, usdEach) * c.fx * c.markup) / 10) * 10);
export const fmtCr = (n: number) => `${Math.round(n).toLocaleString("en-US")} кр`;
/** Зардлын шошго — гишүүнд кредит (1 кр = 1₮), бизнес/эзэнд доллар. n = нийт $, gens = хэдэн бүтээлт. */
/* 2026-11-02: гишүүнд кредит/үнэ харуулахгүй — студи үнэгүй. */
export const fee = (me: Me, n: number, _gens = 1) => (me.mode === "member" ? "Үнэгүй" : `≈ ${usd(n)}`);
/** Одоо зарцуулж болох $ — эзэн хязгааргүй (2026-10-26), гишүүн кредитийн үлдэгдлээр,
    бизнес/туршилт өдрийн медиа хязгаараар. Эцсийн шийдвэрийг сервер гаргана. */
export function budgetLeft(st: State): number {
  if (st.me.ws === "main") return Infinity;
  /* 2026-11-02: кредитгүй — гишүүн ч өдрийн медиа хязгаараар (сервер ижил шалгана). */
  return st.cfg.media.dailyUsd - st.hf.spentToday;
}
/** 99000 → "99,000₮" */
export const mnt = (n: number) => `${Math.round(n).toLocaleString("en-US")}₮`;
/** Лавлах файл (зураг/видео) → /uploads/agent-ref-* */
export async function upload(file: File): Promise<{ url: string; kind: "image" | "video"; dur?: number }> {
  const fd = new FormData(); fd.append("file", file);
  const q = asParam();
  const r = await fetch(`/api/content-agent/upload${q ? `?${q}` : ""}`, { method: "POST", body: fd });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Алдаа (${r.status})`);
  return d;
}
export const SRC: Record<string, string> = { auto: "Өөрөө сонгоно", notebook: "Тэмдэглэлээс", top: "Сайн постоо сайжруулах", product: "Бүтээгдэхүүн" };
export const WD = ["Да", "Мя", "Лх", "Пү", "Ба", "Бя", "Ня"];
const UB = 8 * 3600e3;
export const p2 = (n: number) => String(n).padStart(2, "0");
const ubd = (d: string | number | Date) => new Date(+new Date(d) + UB);
export function when(at: string | Date) {
  const d = ubd(at), now = ubd(Date.now());
  const dd = Math.round((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) / 864e5);
  return { day: dd === 0 ? "Өнөөдөр" : dd === 1 ? "Маргааш" : dd === -1 ? "Өчигдөр" : `${p2(d.getUTCMonth() + 1)}/${p2(d.getUTCDate())}`, time: `${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`, wd: (d.getUTCDay() + 6) % 7 };
}
export const toLocal = (at: string | Date) => { const d = ubd(at); return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}T${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}`; };
export const fromLocal = (v: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) - UB).toISOString() : ""; };
/** УБ-ын Даваа 00:00 (ms) */
export function weekStart(t = Date.now()) { const d = ubd(t); const wd = (d.getUTCDay() + 6) % 7; return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - wd) - UB; }
export const ubDay = (t: number) => { const d = ubd(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - UB; };
/** Зургийг хөтөч дээр ≤1280px JPEG data URL болгоно (vision-д илгээхэд) */
export function shrink(file: File, max = 1280): Promise<string> {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); res(c.toDataURL("image/jpeg", 0.86)); };
    img.onerror = () => rej(new Error("Зураг уншиж чадсангүй")); img.src = url;
  });
}
