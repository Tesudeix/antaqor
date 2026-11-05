import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── САЙЖРУУЛАХ ДАВТАЛТЫН ТОХИРГОО (ганц бичлэг) ───────────────────────
   Давталт нь 20 минут тутам ҮНЭЛНЭ, гэхдээ 20 минут тутам НИЙТЛЭХГҮЙ.
   Шалтгаан нь санал биш, хэмжсэн баримт:
     · Threads API: 250 пост / 24 цаг (`threads_publishing_limit`-ээс уншсан)
     · Instagram Content Publishing: 50 / 24 цаг
     · Meta болон Threads хоёулаа ДАВХАРДСАН контентыг барьдаг —
       "бага зэрэг сайжруулсан" хувилбар нь яг тэр хэв загвар.
   Тиймээс `tickMinutes` (үнэлэх давтамж) ба `minGapMinutes` (нийтлэлт
   хоорондын доод зай) хоёр ТУСДАА. Хоёуланг нь дэлгэцээс өөрчилж болно. */

export interface IContentLoopSettings extends Document {
  enabled: boolean;
  /** Хэдэн минут тутам үнэлэх. */
  tickMinutes: number;
  /** Хоёр нийтлэлтийн хоорондох доод зай (минут). */
  minGapMinutes: number;
  /** Өдөрт хамгийн ихдээ хэдэн дахин нийтлэх. */
  maxPerDay: number;
  /** Эх пост ийм хэмжээний настай байж сая эрхтэй болно (цаг).
   *  Шинэ пост нь үзүүлэлтээ хурааж амжаагүй байдаг. */
  minAgeHours: number;
  /** Үүнээс доош оролцоотой постыг огт сонгохгүй. */
  minEngagement: number;
  /** Нэг эх постыг дахин ашиглахын өмнө хүлээх хоног. */
  cooldownDays: number;
  /** Эх хайх хугацааны цонх (хоног). Хэтэрхий хуучин пост нь өнөөдрийн
   *  байр суурьтай зөрөх эрсдэлтэй. */
  sourceWindowDays: number;
  /** Аль сувгууд руу нийтлэх. */
  networks: string[];
  /** Хэр хүчтэй дахин бичих. */
  rewriteStrength: "light" | "medium" | "rework";
  /** ҮНДСЭН ХАМГААЛАЛТ: хүн баталсны дараа л нийтэлнэ. */
  requireApproval: boolean;

  lastTickAt?: Date;
  lastPostAt?: Date;
  lastNote: string;

  createdAt: Date;
  updatedAt: Date;
}

const ContentLoopSettingsSchema = new Schema<IContentLoopSettings>({
  enabled: { type: Boolean, default: false },
  tickMinutes: { type: Number, default: 20 },
  minGapMinutes: { type: Number, default: 180 },
  maxPerDay: { type: Number, default: 4 },
  minAgeHours: { type: Number, default: 24 },
  minEngagement: { type: Number, default: 2 },
  cooldownDays: { type: Number, default: 14 },
  sourceWindowDays: { type: Number, default: 90 },
  networks: { type: [String], default: ["threads"] },
  rewriteStrength: { type: String, enum: ["light", "medium", "rework"], default: "rework" },
  /* Анхдагчаар ҮНЭН. Хүний зөвшөөрөлгүйгээр брэндийн нэрээр автоматаар
     нийтлэх нь буцаах боломжгүй үйлдэл — хүсвэл дэлгэцээс унтраана. */
  requireApproval: { type: Boolean, default: true },

  lastTickAt: { type: Date },
  lastPostAt: { type: Date },
  lastNote: { type: String, default: "" },
}, { timestamps: true });

const ContentLoopSettings: Model<IContentLoopSettings> =
  mongoose.models.ContentLoopSettings ||
  mongoose.model<IContentLoopSettings>("ContentLoopSettings", ContentLoopSettingsSchema);

export default ContentLoopSettings;
