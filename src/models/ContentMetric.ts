import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── НИЙТЛЭГДСЭН КОНТЕНТЫН ХЭМЖИЛТ ─────────────────────────────────────
   Threads, Instagram, Facebook — ОЛОН хаягаас татсан бодит үзүүлэлт.
   Нэг пост = нэг мөр, tick бүрт шинэчлэгдэнэ.

   Яагаад оноог ҮНЭМЛЭХҮЙ дүнгээр авсан бэ: хувь (engagement rate) нь
   онолын хувьд зөв ч, хүрэлт 10–240 байхад хоёр лайк нь 20% болж
   хувирдаг — шуугиан нь дохиогоо дарна. Хүрэлтийг зэрэг хадгалж байгаа
   нь дэлгэц дээр харуулах, дараа нь хувь руу шилжихэд бэлэн байхын тулд. */

export type MetricPlatform = "threads" | "instagram" | "facebook";

export interface IContentMetric extends Document {
  platform: MetricPlatform;
  /** Аль хаяг — олон хаягтай үед заавал. Threads: userId, Meta: page key. */
  account: string;
  /** Хүн уншихад зориулсан нэр (@antaqor гэх мэт). */
  accountLabel: string;

  externalId: string;
  permalink: string;
  text: string;
  publishedAt?: Date;

  views: number;
  likes: number;
  comments: number;
  shares: number;

  /** likes + 2×comments + 3×shares. Сэтгэгдэл, хуваалцалт нь лайкнаас
   *  илүү хүчтэй дохио учраас жинтэй. */
  engagement: number;

  reuseCount: number;
  lastReusedAt?: Date;

  fetchedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ContentMetricSchema = new Schema<IContentMetric>({
  platform: { type: String, enum: ["threads", "instagram", "facebook"], required: true },
  account: { type: String, default: "", index: true },
  accountLabel: { type: String, default: "" },

  externalId: { type: String, required: true },
  permalink: { type: String, default: "" },
  text: { type: String, default: "" },
  publishedAt: { type: Date, index: true },

  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  comments: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  engagement: { type: Number, default: 0, index: true },

  reuseCount: { type: Number, default: 0 },
  lastReusedAt: { type: Date },

  fetchedAt: { type: Date, default: Date.now },
}, { timestamps: true });

/* externalId нь платформ дотор давтагдахгүй тул хаягийг түлхүүрт
   оруулах шаардлагагүй — харин хаягаар шүүх нь байнгын тул индекстэй. */
ContentMetricSchema.index({ platform: 1, externalId: 1 }, { unique: true });
/* "Хугацааны цонх дотор хамгийн сайн" — гол хайлт. */
ContentMetricSchema.index({ publishedAt: -1, engagement: -1 });
ContentMetricSchema.index({ account: 1, publishedAt: -1 });

const ContentMetric: Model<IContentMetric> =
  mongoose.models.ContentMetric || mongoose.model<IContentMetric>("ContentMetric", ContentMetricSchema);

export default ContentMetric;
