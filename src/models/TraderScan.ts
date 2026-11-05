import mongoose, { Schema, Document, Model, Types } from "mongoose";

/* Tesla Trader — нэг скан = нэг бичлэг. outcome-ийг дараа нь бодит ханшаар шалгаж
   (TP/SL аль нь түрүүлсэн) «бодит амжилтын хувь»-ийг тооцно. read/snap/decision/levels нь Mixed. */
export interface ITraderScan extends Document {
  user: Types.ObjectId; image: string; symbol: string; tf: string; kind: string;
  read: Record<string, unknown>; snap: Record<string, unknown> | null; decision: Record<string, unknown>;
  levels: Record<string, unknown> | null; text: Record<string, unknown>; warnings: string[];
  quoteUsd: number; contract: number; pip: number; digits: number; charged: number;
  outcome: { status: string; at?: Date; price?: number; r?: number }; evaluatedAt: Date | null;
  /** 2026-10-25: онцлог вектор, түүхэн тохиолдол, зураг дээрх үнийн тэнхлэг, хэрэглэгчийн үнэлгээ */
  feat: number[]; hist: Record<string, unknown> | null; overlay: { a: number; b: number } | null; feedback: { vote: string; note: string; at: Date } | null;
  createdAt: Date; updatedAt: Date;
}
const S = new Schema<ITraderScan>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  image: { type: String, default: "" }, symbol: { type: String, default: "" }, tf: { type: String, default: "" }, kind: { type: String, default: "" },
  read: { type: Schema.Types.Mixed, default: {} }, snap: { type: Schema.Types.Mixed, default: null }, decision: { type: Schema.Types.Mixed, default: {} },
  levels: { type: Schema.Types.Mixed, default: null }, text: { type: Schema.Types.Mixed, default: {} }, warnings: { type: [String], default: [] },
  quoteUsd: { type: Number, default: 0 }, contract: { type: Number, default: 0 }, pip: { type: Number, default: 0 }, digits: { type: Number, default: 5 }, charged: { type: Number, default: 0 },
  outcome: { type: Schema.Types.Mixed, default: { status: "open" } }, evaluatedAt: { type: Date, default: null },
  feat: { type: [Number], default: [] }, hist: { type: Schema.Types.Mixed, default: null }, overlay: { type: Schema.Types.Mixed, default: null }, feedback: { type: Schema.Types.Mixed, default: null },
}, { timestamps: true });
S.index({ user: 1, createdAt: -1 });
S.index({ "outcome.status": 1, evaluatedAt: 1 });

export const TraderScan: Model<ITraderScan> = (mongoose.models.TraderScan as Model<ITraderScan>) || mongoose.model<ITraderScan>("TraderScan", S);
