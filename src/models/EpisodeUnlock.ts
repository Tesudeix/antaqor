import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Нэг хүн, нэг анги, зоосоор — БАЙНГА.
 *
 * `SeriesPass`-аас тусад нь байгаа шалтгаан: эрх нь ХУГАЦААТАЙ, нээлт нь
 * ҮҮРД. Долоо хоногийн эрх дуусахад хүн өөрийн зоосоор нээсэн ангиа
 * алдах ёсгүй. Тиймээс хаалга нь `үнэгүй анги ЭСВЭЛ нээлт ЭСВЭЛ идэвхтэй
 * эрх` гэсэн гурван нөхцөлөөр нээгдэнэ.
 */
export interface IEpisodeUnlock extends Document {
  userId: mongoose.Types.ObjectId;
  episode: mongoose.Types.ObjectId;
  /** Хайлтыг хурдасгахад — нэг цувралын бүх нээлтийг нэг асуултаар авна. */
  series: mongoose.Types.ObjectId;
  /** Худалдан авах үеийн ҮНЭ. Үнэ хожим өөрчлөгдөж болно. */
  spent: number;
  createdAt: Date;
  updatedAt: Date;
}

const EpisodeUnlockSchema = new Schema<IEpisodeUnlock>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    episode: { type: Schema.Types.ObjectId, ref: "Episode", required: true, index: true },
    series: { type: Schema.Types.ObjectId, ref: "Series", required: true, index: true },
    spent: { type: Number, default: 0 },
  },
  { timestamps: true }
);

/* Давхар төлбөрийг БОЛОМЖГҮЙ болгодог өвөрмөц байдал: хоёр дахь оролдлого
   зоос хасагдахаас ӨМНӨ insert дээр унана. */
EpisodeUnlockSchema.index({ userId: 1, episode: 1 }, { unique: true });
EpisodeUnlockSchema.index({ userId: 1, series: 1 });

const EpisodeUnlock: Model<IEpisodeUnlock> =
  (mongoose.models.EpisodeUnlock as Model<IEpisodeUnlock>) ||
  mongoose.model<IEpisodeUnlock>("EpisodeUnlock", EpisodeUnlockSchema);

export default EpisodeUnlock;
