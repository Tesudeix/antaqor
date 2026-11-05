import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── REEL — клиентэд хийж өгсөн AI видео ──────────────────────────────
   `/reels` нь 2026-10-01-нээс КЛИЕНТИЙН хүргэлт болов (өмнө нь хичээлийн
   reel байсан, тэр нь /classroom/reels руу нүүсэн).

   `AiVideo`-ОС ТУСДАА байгаа шалтгаан: тэр нь /tools/video студийн
   ХУВИЙН ажлын дэвтэр — кредит, даалгаврын төлөв, буцаан олголттой.
   Энэ нь БЭЛЭН БҮТЭЭГДЭХҮҮН: хэн нэгэнд хийж өгсөн, нийтэд харагддаг,
   татагддаг. Хоёрыг нэг хүснэгтэд шахвал аль аль нь эвдэрнэ. */

export interface IReel extends Document {
  title: string;
  /** Хэнд хийж өгсөн — чөлөөт бичвэр (брэндийн нэр). */
  client: string;
  caption: string;
  videoUrl: string;
  thumbnail: string;
  durationSec: number;
  mime: string;
  bytes: number;
  /** Оруулсан гишүүн. Админ байх албагүй. */
  uploader: mongoose.Types.ObjectId;
  uploaderName: string;
  views: number;
  downloads: number;
  /** Нуусан reel нь жагсаалтад гарахгүй, шууд хаягаар ч нээгдэхгүй. */
  published: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const ReelSchema = new Schema<IReel>(
  {
    title: { type: String, default: "", maxlength: 120 },
    client: { type: String, default: "", maxlength: 80, index: true },
    caption: { type: String, default: "", maxlength: 500 },
    videoUrl: { type: String, required: true },
    thumbnail: { type: String, default: "" },
    durationSec: { type: Number, default: 0 },
    mime: { type: String, default: "" },
    bytes: { type: Number, default: 0 },
    uploader: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    uploaderName: { type: String, default: "" },
    views: { type: Number, default: 0 },
    downloads: { type: Number, default: 0 },
    published: { type: Boolean, default: true, index: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

/* Тэжээл нь шинэхэн нь эхэндээ; `order` нь гараар дээш гаргах хөшүүрэг. */
ReelSchema.index({ published: 1, order: -1, createdAt: -1 });

export default (mongoose.models.Reel as Model<IReel>) ||
  mongoose.model<IReel>("Reel", ReelSchema);
