import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── Холбосон сошиал аккаунтын пост бүрийн хэмжүүр (2026-10-17) ─────────
   /admin Content Studio "Тойм" + AI бичигч хоёр үүнээс суралцана.
   Instagram/Facebook Graph-аас татна (sync). `score` = likes + 2×comments
   + 3×shares + 3×saves — хадгалах/хуваалцах нь лайкаас илүү хүчтэй дохио. */

export interface ISocialInsight extends Document {
  platform: "instagram" | "facebook" | "threads";
  account: string;
  externalId: string;
  caption: string;
  mediaType: string;
  thumb: string;
  permalink: string;
  postedAt: Date;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
  reach: number;
  views: number;
  score: number;
  syncedAt: Date;
}

const S = new Schema<ISocialInsight>({
  platform: { type: String, enum: ["instagram", "facebook", "threads"], required: true },
  account: { type: String, default: "" },
  externalId: { type: String, required: true, unique: true },
  caption: { type: String, default: "" },
  mediaType: { type: String, default: "" },
  thumb: { type: String, default: "" },
  permalink: { type: String, default: "" },
  postedAt: { type: Date, index: true },
  likes: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  saves: { type: Number, default: 0 },
  reach: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  score: { type: Number, default: 0, index: true },
  syncedAt: { type: Date, default: Date.now },
});

const SocialInsight: Model<ISocialInsight> = mongoose.models.SocialInsight || mongoose.model<ISocialInsight>("SocialInsight", S);
export default SocialInsight;

/* AI-ийн гаргасан "playbook" — нэг баримт (key=account). */
export interface ISocialPlaybook extends Document {
  key: string;
  summary: string;
  hooks: string[];
  doList: string[];
  avoid: string[];
  ideas: string[];
  stats: Record<string, unknown>;
  learnedAt: Date;
}
const P = new Schema<ISocialPlaybook>({
  key: { type: String, unique: true },
  summary: { type: String, default: "" },
  hooks: { type: [String], default: [] },
  doList: { type: [String], default: [] },
  avoid: { type: [String], default: [] },
  ideas: { type: [String], default: [] },
  stats: { type: Schema.Types.Mixed, default: {} },
  learnedAt: Date,
});
export const SocialPlaybook: Model<ISocialPlaybook> = mongoose.models.SocialPlaybook || mongoose.model<ISocialPlaybook>("SocialPlaybook", P);
