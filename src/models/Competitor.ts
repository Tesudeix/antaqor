import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── Өрсөлдөгчийн аккаунт + пост (2026-10-17) ───────────────────────────
   IG: Business Discovery API (instagram_manage_insights эрх), Threads:
   profile_posts (threads_profile_discovery эрх). Facebook-ийн бусдын хуудсыг
   Meta зөвхөн "Page Public Content Access" review-тэй апп-д өгдөг тул FB (ба
   бусад) постыг гараар нэмнэ (`manual: true`). `er` = оноо / 1000 дагагч —
   өөр хэмжээтэй аккаунтуудыг шударга харьцуулна. */

export interface ICompetitor extends Document {
  platform: "instagram" | "threads" | "facebook";
  handle: string;
  name: string;
  followers: number;
  avatar: string;
  lastSyncAt?: Date;
  error: string;
  createdAt: Date;
}
const C = new Schema<ICompetitor>({
  platform: { type: String, enum: ["instagram", "threads", "facebook"], required: true },
  handle: { type: String, required: true },
  name: { type: String, default: "" },
  followers: { type: Number, default: 0 },
  avatar: { type: String, default: "" },
  lastSyncAt: Date,
  error: { type: String, default: "" },
}, { timestamps: true });
C.index({ platform: 1, handle: 1 }, { unique: true });
export const Competitor: Model<ICompetitor> = mongoose.models.Competitor || mongoose.model<ICompetitor>("Competitor", C);

export interface IBreakdown { hook: string; format: string; why: string; emotion: string; adapt: string }
export interface ICompetitorPost extends Document {
  competitor: mongoose.Types.ObjectId;
  platform: string;
  handle: string;
  externalId: string;
  caption: string;
  mediaType: string;
  thumb: string;
  permalink: string;
  postedAt: Date;
  likes: number;
  comments: number;
  score: number;
  er: number;
  manual: boolean;
  analysis?: IBreakdown;
}
const P = new Schema<ICompetitorPost>({
  competitor: { type: Schema.Types.ObjectId, ref: "Competitor", index: true },
  platform: String,
  handle: String,
  externalId: { type: String, required: true, unique: true },
  caption: { type: String, default: "" },
  mediaType: { type: String, default: "" },
  thumb: { type: String, default: "" },
  permalink: { type: String, default: "" },
  postedAt: { type: Date, index: true },
  likes: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  score: { type: Number, default: 0 },
  er: { type: Number, default: 0, index: true },
  manual: { type: Boolean, default: false },
  analysis: { hook: String, format: String, why: String, emotion: String, adapt: String },
});
export const CompetitorPost: Model<ICompetitorPost> = mongoose.models.CompetitorPost || mongoose.model<ICompetitorPost>("CompetitorPost", P);
