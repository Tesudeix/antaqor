import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Долоо хоногийн эрх — нэг цувралын БҮХ түгжээтэй ангийг хугацаатай нээнэ.
 *
 * Хугацаа дуусахад мөрийг УСТГАХГҮЙ: хэн хэзээ юу худалдаж авсны түүх
 * орлогын тайланд хэрэгтэй бөгөөд маргаан гарвал энэ л баримт. Хаалга нь
 * `expiresAt > одоо` гэж шалгана.
 */
export interface ISeriesPass extends Document {
  userId: mongoose.Types.ObjectId;
  series: mongoose.Types.ObjectId;
  expiresAt: Date;
  spent: number;
  createdAt: Date;
  updatedAt: Date;
}

const SeriesPassSchema = new Schema<ISeriesPass>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    series: { type: Schema.Types.ObjectId, ref: "Series", required: true, index: true },
    expiresAt: { type: Date, required: true },
    spent: { type: Number, default: 0 },
  },
  { timestamps: true }
);

/* Нэг хүн нэг цувралыг дахин авбал ШИНЭ мөр биш, байгаагийнх нь хугацааг
   уртасгана (маршрут дээр). Тиймээс энд өвөрмөц индекс тавьж, хоёр идэвхтэй
   эрх зэрэг оршихыг бүрмөсөн хаав. */
SeriesPassSchema.index({ userId: 1, series: 1 }, { unique: true });

const SeriesPass: Model<ISeriesPass> =
  (mongoose.models.SeriesPass as Model<ISeriesPass>) ||
  mongoose.model<ISeriesPass>("SeriesPass", SeriesPassSchema);

export default SeriesPass;
