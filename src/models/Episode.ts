import mongoose, { Schema, Document, Model } from "mongoose";

/** Нэг анги — 2 орчим минут, дугаараар эрэмбэлэгдэнэ. */
export interface IEpisode extends Document {
  series: mongoose.Types.ObjectId;
  /** Цуврал дотор 1-ээс эхэлнэ. Эрэмбийн талбар ТУСДАА хэрэггүй: дугаар нь
      өөрөө эрэмбэ, хоёр тоо зэрэг байвал заавал зөрнө. */
  number: number;
  title: string;
  videoUrl: string;
  videoType: "link" | "upload";
  /** Ангийн эхний кадр. Хоосон бол цувралынхыг ашиглана. */
  poster: string;
  durationSec: number;
  /** Нээх үнэ. `Series.freeEpisodes`-оос доош ангид хамаарахгүй. */
  priceCoins: number;
  published: boolean;
  likes: number;
  createdAt: Date;
  updatedAt: Date;
}

const EpisodeSchema = new Schema<IEpisode>(
  {
    series: { type: Schema.Types.ObjectId, ref: "Series", required: true, index: true },
    number: { type: Number, required: true, min: 1 },
    title: { type: String, default: "", trim: true },
    videoUrl: { type: String, default: "" },
    videoType: { type: String, enum: ["link", "upload"], default: "upload" },
    poster: { type: String, default: "" },
    durationSec: { type: Number, default: 0, min: 0 },
    priceCoins: { type: Number, default: 30, min: 0 },
    published: { type: Boolean, default: true },
    likes: { type: Number, default: 0 },
  },
  { timestamps: true }
);

/* Нэг цувралд нэг дугаар ГАНЦ УДАА. Админ алдаанаас сэргийлэхээс гадна
   "дараагийн анги" логик хоёрдмол утгагүй болно. */
EpisodeSchema.index({ series: 1, number: 1 }, { unique: true });

const Episode: Model<IEpisode> =
  (mongoose.models.Episode as Model<IEpisode>) ||
  mongoose.model<IEpisode>("Episode", EpisodeSchema);

export default Episode;
