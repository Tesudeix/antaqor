/* Контент агентын клиент төрлүүд (/api/admin/content-agent-ийн хариу) */
export type SlotStatus = "queued" | "writing" | "draft" | "scheduled" | "publishing" | "published" | "failed" | "skipped" | "error";
export type Slot = {
  id: string; at: string; platforms: string[]; format: "text" | "image"; pillar: string; title: string; angle: string; hook: string; cta: string; why: string;
  caption: string; alt: string; imagePrompt: string; imageUrl: string; imageState: "none" | "queued" | "working" | "done" | "error"; imageError: string;
  score: number; scoreWhy: string; status: SlotStatus; error: string; instruction: string;
  history: { caption: string; note: string; at: string }[]; imageHistory: string[]; socialPostId: string;
  results: { platform: string; status: string; permalink: string; externalId: string }[];
  metrics: { likes: number; comments: number; shares: number; views: number; score: number; syncedAt: string | null };
  edited: boolean; approvedAt: string | null;
};
export type Plan = {
  _id: string; brand: string; weekStart: string; status: "planning" | "writing" | "ready" | "failed" | "archived"; note: string;
  strategy: { theme: string; goal: string; summary: string; learned: string[]; pillars: { name: string; share: number; why: string }[] };
  context: { posts7d: number; avg7d: number; bestDay: string; bestHour: string; bestFormat: string; external: number; prevScore: number };
  slots: Slot[]; log: { at: string; step: string; ok: boolean; detail: string }[]; aiModel: string; usd: number; createdBy: string; error: string; createdAt: string; lockedUntil: string | null;
};
export type Pillar = { name: string; share: number; hint: string };
export type Brand = {
  _id: string; key: string; name: string; kind: "personal" | "product"; active: boolean; runWeekday: number; runHour: number; postsPerWeek: number; maxPerDay: number;
  hours: number[]; channels: string[]; metaAccount: string; threadsUserId: string; imageMode: "auto" | "manual" | "off"; imageShare: number; visualStyle: string; voiceNotes: string;
  pillars: Pillar[];
  product: { name: string; oneLiner: string; description: string; price: string; offer: string; link: string; cta: string; audience: string; usps: string[]; facts: string[]; banned: string[]; refImages: string[] };
  lastRunAt: string | null;
};
export type Ready = { ok: boolean; items: { label: string; ok: boolean }[] };
export type External = { _id: string; at: string; text: string; brief: string; platforms: string[]; state: string; imageUrl: string; permalink: string };
export type HistoryRow = { _id: string; weekStart: string; iso: number; label: string; status: string; theme: string; by: string; usd: number; total: number; approved: number; published: number; skipped: number; drafts: number; edited: number; score: number };
export type State = {
  now: string; brands: { key: string; name: string; kind: string; active: boolean; ready: Ready }[]; brand: Brand; ready: Ready; nextRun: string | null;
  week: { start: string; iso: number; label: string; isCurrent: boolean; isPast: boolean };
  plan: Plan | null; external: External[]; history: HistoryRow[];
  insight: { bestDay: string; bestHour: string; bestFormat: string; total: number; avgScore: number; ideas: string[]; learnedAt: string | null } | null;
  voice: { positioning: string; tagline: string; audience: string; values: string[] } | null;
};
export type Health = { ok: boolean; label: string; error: string };
export type Accounts = { targets: { key: string; label: string; facebook: Health; instagram: Health }[]; threads: { threadsUserId: string; username: string; ok: boolean; error: string }[] };

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: "no-store", ...init });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || (r.status === 401 ? "Нэвтрэлт дууссан — дахин нэвтэрнэ үү" : `Алдаа (${r.status})`));
  return d as T;
}
export const send = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
export const firstLine = (t: string) => (t || "").split("\n").map((l) => l.trim()).find(Boolean) || "";
export const PENDING = new Set(["queued", "writing"]);
