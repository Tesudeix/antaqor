import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── САЙЖРУУЛСАН ХУВИЛБАР ──────────────────────────────────────────────
   Давталт нь хамгийн сайн явсан постыг олоод, түүнээс ШИНЭ хувилбар
   бичнэ. Энэ бичлэг нь тэр хувилбар + хаанаас гарсан + юу болсныг
   хадгална.

   Чухал: хувилбар нь эх постыг ДАВТАХГҮЙ байх ёстой. Meta болон Threads
   хоёулаа ойролцоо давхардсан текстийг барьдаг тул "бага зэрэг
   өөрчилсөн" хувилбар нь хамгийн эрсдэлтэй. Тиймээс анхдагч
   `rewriteStrength` нь "rework" — санааг нь аваад шинээр бичнэ. */

export type VariantStatus = "pending" | "approved" | "published" | "rejected" | "failed";

export interface IContentVariant extends Document {
  sourcePlatform: string;
  sourceExternalId: string;
  sourceText: string;
  sourcePermalink: string;
  /** Эх постын тухайн үеийн оролцоо — яагаад сонгогдсоныг харуулна. */
  sourceEngagement: number;

  text: string;
  /** AI яагаад ингэж өөрчилснөө нэг өгүүлбэрээр. Хүн баталгаажуулахад. */
  rationale: string;
  /** Эх текстээс хэр өөр болсон (0–1). Хэт ойрхон бол анхааруулна. */
  novelty: number;

  platforms: string[];
  status: VariantStatus;
  error: string;

  socialPostId?: mongoose.Types.ObjectId;
  publishedAt?: Date;
  decidedByEmail: string;

  createdAt: Date;
  updatedAt: Date;
}

const ContentVariantSchema = new Schema<IContentVariant>({
  sourcePlatform: { type: String, default: "" },
  sourceExternalId: { type: String, default: "", index: true },
  sourceText: { type: String, default: "" },
  sourcePermalink: { type: String, default: "" },
  sourceEngagement: { type: Number, default: 0 },

  text: { type: String, default: "" },
  rationale: { type: String, default: "" },
  novelty: { type: Number, default: 0 },

  platforms: { type: [String], default: [] },
  status: { type: String, enum: ["pending", "approved", "published", "rejected", "failed"], default: "pending", index: true },
  error: { type: String, default: "" },

  socialPostId: { type: Schema.Types.ObjectId, ref: "SocialPost" },
  publishedAt: { type: Date },
  decidedByEmail: { type: String, default: "" },
}, { timestamps: true });

ContentVariantSchema.index({ createdAt: -1 });

const ContentVariant: Model<IContentVariant> =
  mongoose.models.ContentVariant || mongoose.model<IContentVariant>("ContentVariant", ContentVariantSchema);

export default ContentVariant;
