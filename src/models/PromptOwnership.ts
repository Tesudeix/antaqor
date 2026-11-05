import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * НЭГ ХҮН, НЭГ ПРОМПТ, БАЙНГЫН ЭЗЭМШИЛ.
 *
 * `PromptUnlock` (багцын түгжээ) -тэй ижил зарчим, өөр объект. Тусад нь
 * байгаа шалтгаан: багц нь админы бүтээгдэхүүн, энэ нь ГИШҮҮНИЙ бүтээл.
 * Хоёрын мөнгөний урсгал өөр — багцын төлбөр Antaqor-т, промптын төлбөр
 * зохиогчид ногдоно.
 *
 * ГИШҮҮНЧЛЭЛ ДУУССАН Ч ЭЗЭМШИЛ ҮЛДЭНЭ. Захиалга бол түрээс, худалдан
 * авалт бол өмч. Хоёрыг хольж, эрхийг гишүүнчлэлээс хамааруулбал хүн
 * төлсөн зүйлээ алдана — тэр нэг тохиолдол л зах зээлийн итгэлийг устгана.
 */
export interface IPromptOwnership extends Document {
  user: mongoose.Types.ObjectId;
  prompt: mongoose.Types.ObjectId;
  /** Худалдан авах МӨЧИД төлсөн дүн — үнэ хожим өөрчлөгдөж болно. */
  spent: number;
  /** Хэддүгээр хувь вэ (1..editions). Хязгааргүй бол зүгээр дугаар. */
  edition: number;
  createdAt: Date;
}

const PromptOwnershipSchema = new Schema<IPromptOwnership>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    prompt: { type: Schema.Types.ObjectId, ref: "PromptItem", required: true, index: true },
    spent: { type: Number, default: 0 },
    edition: { type: Number, default: 0 },
  },
  { timestamps: true }
);

/* ДАВХАР ТӨЛӨЛТИЙГ БОЛОМЖГҮЙ БОЛГОДОГ МӨР. Хоёр дараалсан товшилт,
   сүлжээний давталт, хоёр таб — бүгд энэ индекс дээр мөргөж, кредит
   хоёр дахин хасагдахаас өмнө зогсоно. */
PromptOwnershipSchema.index({ user: 1, prompt: 1 }, { unique: true });
PromptOwnershipSchema.index({ prompt: 1, createdAt: -1 });

const PromptOwnership: Model<IPromptOwnership> =
  (mongoose.models.PromptOwnership as Model<IPromptOwnership>) ||
  mongoose.model<IPromptOwnership>("PromptOwnership", PromptOwnershipSchema);

export default PromptOwnership;
