import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * "Үргэлжлүүлэх" цэг — нэг хүн, нэг цувралд НЭГ.
 *
 * Анги бүрээр хадгалвал "хаанаас үргэлжлүүлэх вэ" гэдэг нь хоёрдмол болно
 * (хүн 3-р анги дээр буцаж очоод орхивол аль нь сүүлийнх вэ?). Тиймээс
 * цуврал тус бүрд хамгийн сүүлд ҮЗСЭН цэгийг л барина.
 */
export interface IWatchProgress extends Document {
  userId: mongoose.Types.ObjectId;
  series: mongoose.Types.ObjectId;
  episode: mongoose.Types.ObjectId;
  episodeNumber: number;
  positionSec: number;
  updatedAt: Date;
  createdAt: Date;
}

const WatchProgressSchema = new Schema<IWatchProgress>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    series: { type: Schema.Types.ObjectId, ref: "Series", required: true, index: true },
    episode: { type: Schema.Types.ObjectId, ref: "Episode", required: true },
    episodeNumber: { type: Number, default: 1 },
    positionSec: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

WatchProgressSchema.index({ userId: 1, series: 1 }, { unique: true });
/* "Үргэлжлүүлэн үзэх" эгнээ — хамгийн сүүлд хөдөлсөн нь эхэнд. */
WatchProgressSchema.index({ userId: 1, updatedAt: -1 });

const WatchProgress: Model<IWatchProgress> =
  (mongoose.models.WatchProgress as Model<IWatchProgress>) ||
  mongoose.model<IWatchProgress>("WatchProgress", WatchProgressSchema);

export default WatchProgress;
