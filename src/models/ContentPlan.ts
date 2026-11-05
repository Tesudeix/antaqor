import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── Контент агентын 7 хоногийн төлөвлөгөө (2026-10-23) ─────────────────
   Нэг брэнд × нэг 7 хоног = нэг идэвхтэй төлөвлөгөө (`active`).
   Слот бүр: бриф → агентын бичсэн ноорог → (зураг) → хүн батална →
   SocialPost (scheduled) → одоо байгаа /api/cron/social-schedule нийтэлнэ.
   Агент ӨӨРӨӨ юу ч нийтлэхгүй — батлах товч л SocialPost үүсгэнэ.
   Ажилчин (lib/contentAgent.advance) болон админ хоёр нэг баримтыг зэрэг
   засдаг тул бүх бичилт slot-оор онилсон атомик update (arrayFilters). */

export type SlotStatus = "queued" | "writing" | "draft" | "scheduled" | "publishing" | "published" | "failed" | "skipped" | "error";
export type ImageState = "none" | "queued" | "working" | "done" | "error";

export interface IPlanSlot {
  id: string;
  at: Date;
  platforms: string[];
  format: "text" | "image";
  pillar: string;
  title: string;
  angle: string;
  hook: string;
  cta: string;
  why: string;
  caption: string;
  alt: string;
  imagePrompt: string;
  imageUrl: string;
  imageState: ImageState;
  imageError: string;
  score: number;
  scoreWhy: string;
  status: SlotStatus;
  error: string;
  instruction: string;
  history: { caption: string; note: string; at: Date }[];
  imageHistory: string[];
  socialPostId: string;
  results: { platform: string; status: string; permalink: string; externalId: string }[];
  metrics: { likes: number; comments: number; shares: number; views: number; score: number; syncedAt: Date | null };
  edited: boolean;
  approvedAt: Date | null;
}

export interface IContentPlan extends Document {
  brand: string;
  weekStart: Date;
  active: boolean;
  status: "planning" | "writing" | "ready" | "failed" | "archived";
  note: string;
  strategy: { theme: string; goal: string; summary: string; learned: string[]; pillars: { name: string; share: number; why: string }[] };
  context: { posts7d: number; avg7d: number; bestDay: string; bestHour: string; bestFormat: string; external: number; prevScore: number };
  slots: IPlanSlot[];
  log: { at: Date; step: string; ok: boolean; detail: string }[];
  aiModel: string;
  usd: number;
  notified: boolean;
  lockedUntil: Date | null;
  createdBy: string;
  error: string;
  createdAt: Date;
  updatedAt: Date;
}

const SlotSchema = new Schema<IPlanSlot>({
  id: { type: String, required: true },
  at: { type: Date, required: true },
  platforms: { type: [String], default: [] },
  format: { type: String, enum: ["text", "image"], default: "text" },
  pillar: { type: String, default: "" },
  title: { type: String, default: "" },
  angle: { type: String, default: "" },
  hook: { type: String, default: "" },
  cta: { type: String, default: "" },
  why: { type: String, default: "" },
  caption: { type: String, default: "" },
  alt: { type: String, default: "" },
  imagePrompt: { type: String, default: "" },
  imageUrl: { type: String, default: "" },
  imageState: { type: String, enum: ["none", "queued", "working", "done", "error"], default: "none" },
  imageError: { type: String, default: "" },
  score: { type: Number, default: 0 },
  scoreWhy: { type: String, default: "" },
  status: { type: String, enum: ["queued", "writing", "draft", "scheduled", "publishing", "published", "failed", "skipped", "error"], default: "queued" },
  error: { type: String, default: "" },
  instruction: { type: String, default: "" },
  history: { type: [{ _id: false, caption: String, note: String, at: Date }], default: [] },
  imageHistory: { type: [String], default: [] },
  socialPostId: { type: String, default: "" },
  results: { type: [{ _id: false, platform: String, status: String, permalink: String, externalId: String }], default: [] },
  metrics: {
    likes: { type: Number, default: 0 }, comments: { type: Number, default: 0 }, shares: { type: Number, default: 0 },
    views: { type: Number, default: 0 }, score: { type: Number, default: 0 }, syncedAt: { type: Date, default: null },
  },
  edited: { type: Boolean, default: false },
  approvedAt: { type: Date, default: null },
}, { _id: false });

const PlanSchema = new Schema<IContentPlan>({
  brand: { type: String, required: true, index: true },
  weekStart: { type: Date, required: true },
  active: { type: Boolean, default: true },
  status: { type: String, enum: ["planning", "writing", "ready", "failed", "archived"], default: "planning", index: true },
  note: { type: String, default: "" },
  strategy: {
    theme: { type: String, default: "" }, goal: { type: String, default: "" }, summary: { type: String, default: "" },
    learned: { type: [String], default: [] },
    pillars: { type: [{ _id: false, name: String, share: Number, why: String }], default: [] },
  },
  context: {
    posts7d: { type: Number, default: 0 }, avg7d: { type: Number, default: 0 }, bestDay: { type: String, default: "" },
    bestHour: { type: String, default: "" }, bestFormat: { type: String, default: "" }, external: { type: Number, default: 0 },
    prevScore: { type: Number, default: 0 },
  },
  slots: { type: [SlotSchema], default: [] },
  log: { type: [{ _id: false, at: Date, step: String, ok: Boolean, detail: String }], default: [] },
  aiModel: { type: String, default: "" },
  usd: { type: Number, default: 0 },
  notified: { type: Boolean, default: false },
  lockedUntil: { type: Date, default: null },
  createdBy: { type: String, default: "" },
  error: { type: String, default: "" },
}, { timestamps: true });

// Нэг брэнд, нэг 7 хоногт ганц идэвхтэй төлөвлөгөө. Дахин төлөвлөхөд хуучин нь active:false болно.
PlanSchema.index({ brand: 1, weekStart: 1 }, { unique: true, partialFilterExpression: { active: true } });

const ContentPlan: Model<IContentPlan> =
  (mongoose.models.ContentPlan as Model<IContentPlan>) || mongoose.model<IContentPlan>("ContentPlan", PlanSchema);
export default ContentPlan;
