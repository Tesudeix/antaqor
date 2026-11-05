import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── TUQOR — өөрөө ажилладаг контент агент (2026-10-23) ─────────────────
   TuqorConfig — ганц мөр (key "main"): автомат асаалттай эсэх, өдөрт хэдэн
                 пост, цагууд, санал (курс/үйлчилгээ), эзний жишээ постууд.
   TuqorPost   — Tuqor-ын бичсэн пост бүр: таамаг (vector тест), хамгаалалтын
                 шалтгаан, SocialPost холбоос, бодит хэмжүүр (тестийн үр дүн).
   TuqorVec    — өөрийн бүх постын embedding + хэмжүүр (vector санах ой).
                 Self-hosted Mongo-д $vectorSearch байхгүй тул хайлт процесс
                 дотор (lib/vectorIndex.ts-тэй ижил арга). */

export interface ITuqorConfig extends Document {
  key: string;
  auto: boolean;
  perDay: number;
  hours: number[];
  minGapMin: number;
  channels: string[];
  mix: string[];               // өдрийн форматын дараалал: spark / value / offer
  offers: { name: string; pitch: string; cta: string }[];
  examples: string[];          // эзний өөрийн жишээ постууд — өнгө аяс
  runHour: number;             // өдрийн автомат ажил (УБ)
  lastRunDay: string;
  lastAskDay: string;
  lastSyncAt: Date | null;
  lockedUntil: Date | null;
  cognitive: { summary: string; beliefs: string[]; frames: string[]; vocabulary: string[]; tone: string; avoid: string[]; updatedAt: Date | null };
  generic: string[];
  spellFix: boolean;
  lastHourlyAt: Date | null;
  accounts: { metaAccount: string; threadsUserId: string };
  /** Higgsfield медиа — анхдагч загвар ба өдрийн зардлын хязгаар ($) */
  media: { imageModel: string; videoModel: string; videoRes: string; videoDur: number; ratio: string; dailyUsd: number };
}
const ConfigSchema = new Schema<ITuqorConfig>({
  key: { type: String, unique: true, default: "main" },
  auto: { type: Boolean, default: true },
  perDay: { type: Number, default: 3, min: 0, max: 8 },
  hours: { type: [Number], default: [9, 18, 21] },
  minGapMin: { type: Number, default: 90 },
  channels: { type: [String], default: ["threads"] },
  mix: { type: [String], default: ["spark", "offer", "value"] },
  offers: { type: [{ _id: false, name: String, pitch: String, cta: String }], default: [] },
  examples: { type: [String], default: [] },
  runHour: { type: Number, default: 8, min: 0, max: 23 },
  lastRunDay: { type: String, default: "" },
  lastAskDay: { type: String, default: "" },
  lastSyncAt: { type: Date, default: null },
  lockedUntil: { type: Date, default: null },
  cognitive: {
    summary: { type: String, default: "" }, beliefs: { type: [String], default: [] }, frames: { type: [String], default: [] },
    vocabulary: { type: [String], default: [] }, tone: { type: String, default: "" }, avoid: { type: [String], default: [] }, updatedAt: { type: Date, default: null },
  },
  generic: { type: [String], default: [] },
  spellFix: { type: Boolean, default: true },
  lastHourlyAt: { type: Date, default: null },
  accounts: { metaAccount: { type: String, default: "antaqor" }, threadsUserId: { type: String, default: "" } },
  media: {
    imageModel: { type: String, default: "soul2" }, videoModel: { type: String, default: "wan3" }, videoRes: { type: String, default: "720p" },
    videoDur: { type: Number, default: 5 }, ratio: { type: String, default: "9:16" }, dailyUsd: { type: Number, default: 5 },
  },
}, { timestamps: true });

export type TuqorFormat = "spark" | "value" | "offer";
export type TuqorStatus = "draft" | "scheduled" | "held" | "published" | "failed" | "deleted";
export interface ITuqorPost extends Document {
  ws: string;
  day: string;
  at: Date;
  text: string;
  format: TuqorFormat;
  source: "auto" | "idea";
  idea: string;
  platforms: string[];
  status: TuqorStatus;
  holdReason: string;
  pred: { score: number; novelty: number; base: number; nn: { text: string; score: number }[] };
  socialPostId: string;
  results: { platform: string; status: string; permalink: string; externalId: string }[];
  metrics: { likes: number; comments: number; shares: number; views: number; score: number; at: Date | null };
  evaluated: boolean;
  aiModel: string;
  kind: "text" | "infographic" | "image" | "video";
  imageUrl: string;
  videoUrl: string;
  /** AgentMedia холбоос — "" | rendering | ready | failed */
  mediaId: string;
  mediaState: string;
  /** Медиа бэлэн болмогц автоматаар товлох */
  queued: boolean;
  infographic: Record<string, unknown> | null;
  audience: string;
  variantGroup: string;
  ruleId: string;
  angle: string;
  fixes: { from: string; to: string }[];
  generic: string[];
  origin: { src: string; sid: string };
  metaAccount: string;
  threadsUserId: string;
  snaps: { h1: number; h6: number; h24: number };
  doubled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
const PostSchema = new Schema<ITuqorPost>({
  ws: { type: String, default: "main", index: true },
  day: { type: String, index: true },
  at: { type: Date, index: true },
  text: { type: String, default: "" },
  format: { type: String, enum: ["spark", "value", "offer"], default: "value" },
  source: { type: String, enum: ["auto", "idea"], default: "auto" },
  idea: { type: String, default: "" },
  platforms: { type: [String], default: ["threads"] },
  status: { type: String, enum: ["draft", "scheduled", "held", "published", "failed", "deleted"], default: "draft", index: true },
  holdReason: { type: String, default: "" },
  pred: { score: { type: Number, default: 0 }, novelty: { type: Number, default: 1 }, base: { type: Number, default: 0 }, nn: { type: [{ _id: false, text: String, score: Number }], default: [] } },
  socialPostId: { type: String, default: "" },
  results: { type: [{ _id: false, platform: String, status: String, permalink: String, externalId: String }], default: [] },
  metrics: { likes: { type: Number, default: 0 }, comments: { type: Number, default: 0 }, shares: { type: Number, default: 0 }, views: { type: Number, default: 0 }, score: { type: Number, default: 0 }, at: { type: Date, default: null } },
  evaluated: { type: Boolean, default: false },
  aiModel: { type: String, default: "" },
  kind: { type: String, enum: ["text", "infographic", "image", "video"], default: "text" },
  imageUrl: { type: String, default: "" },
  videoUrl: { type: String, default: "" },
  mediaId: { type: String, default: "" },
  mediaState: { type: String, default: "" },
  queued: { type: Boolean, default: false },
  infographic: { type: Schema.Types.Mixed, default: null },
  audience: { type: String, default: "" },
  variantGroup: { type: String, default: "", index: true },
  ruleId: { type: String, default: "" },
  angle: { type: String, default: "" },
  fixes: { type: [{ _id: false, from: String, to: String }], default: [] },
  generic: { type: [String], default: [] },
  origin: { src: { type: String, default: "" }, sid: { type: String, default: "" } },
  metaAccount: { type: String, default: "" },
  threadsUserId: { type: String, default: "" },
  snaps: { h1: { type: Number, default: -1 }, h6: { type: Number, default: -1 }, h24: { type: Number, default: -1 } },
  doubled: { type: Boolean, default: false },
}, { timestamps: true });

export interface ITuqorVec extends Document {
  ws: string;
  key: string;
  text: string;
  v: number[];
  embModel: string;
  platform: string;
  score: number;
  likes: number;
  comments: number;
  views: number;
  postedAt: Date;
  source: "own" | "tuqor" | "note";
}
const VecSchema = new Schema<ITuqorVec>({
  ws: { type: String, default: "main", index: true },
  key: { type: String, unique: true },
  text: { type: String, default: "" },
  v: { type: [Number], select: false },
  embModel: { type: String, default: "" },
  platform: { type: String, default: "" },
  score: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  postedAt: { type: Date, index: true },
  source: { type: String, default: "own" },
});

export const TuqorConfig: Model<ITuqorConfig> = (mongoose.models.TuqorConfig as Model<ITuqorConfig>) || mongoose.model<ITuqorConfig>("TuqorConfig", ConfigSchema);
export const TuqorPost: Model<ITuqorPost> = (mongoose.models.TuqorPost as Model<ITuqorPost>) || mongoose.model<ITuqorPost>("TuqorPost", PostSchema);
export const TuqorVec: Model<ITuqorVec> = (mongoose.models.TuqorVec as Model<ITuqorVec>) || mongoose.model<ITuqorVec>("TuqorVec", VecSchema);
