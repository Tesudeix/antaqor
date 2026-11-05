import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── CompanionDoc — Antaqor AI-ийн "өөрийн материал" (2026-10-13) ─────────
   Эзний оруулсан өгөгдөл ХЭСЭГЛЭГДЭЖ (≤1200 тэмдэгт) энд хадгалагдана.
     kind "knowledge" — мэдлэг: тэмдэглэл, транскрипт, түүх, үзэл бодол
     kind "voice"     — хэв маяг: эзний бичсэн пост/текст (яг ингэж бич)
   Чат бүрд асуултаар $text хайж хамгийн хамааралтай хэсгүүдийг prompt-д
   оруулна (lib/companionLearn.ts). `source` = нэг оруулгын нэр — бүлгээр
   нь устгана. */
export interface ICompanionDoc extends Document {
  kind: "knowledge" | "voice";
  source: string;
  sourceId?: string;
  text: string;
  vector?: number[];
  embModel?: string;
  createdAt: Date;
}

const CompanionDocSchema = new Schema<ICompanionDoc>(
  {
    kind: { type: String, enum: ["knowledge", "voice"], default: "knowledge", index: true },
    source: { type: String, required: true, trim: true, maxlength: 120, index: true },
    sourceId: { type: String, default: "", index: true },
    text: { type: String, required: true, maxlength: 1500 },
    /* RAG (2026-10-17): нормчилсон embedding + аль загвараар үүссэн. select:false — жагсаалтад 2KB/мөр чирэхгүй. */
    vector: { type: [Number], select: false },
    embModel: { type: String, default: "", index: true },
  },
  { timestamps: true }
);
// Кирилл үгийг stem хийлгэхгүй — "none" хэл.
CompanionDocSchema.index({ text: "text", source: "text" }, { default_language: "none", weights: { text: 5, source: 1 } });

const CompanionDoc: Model<ICompanionDoc> =
  (mongoose.models.CompanionDoc as Model<ICompanionDoc>) || mongoose.model<ICompanionDoc>("CompanionDoc", CompanionDocSchema);
export default CompanionDoc;
