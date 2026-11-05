import mongoose, { Schema, Model, Types } from "mongoose";

/* ─── Tesla Trader AI · суралцах давхарга (2026-10-25) ───
   TraderSample — арилжааны нөхцөлийн ТООН вектор + бодит үр дүн (backtest болон хаагдсан скан).
                  Шинэ скан хамгийн ойр 30-ыг олж «ийм нөхцөлд хэдэн % нь TP хүрсэн»-ийг тооцно.
   TraderMemory — ТЕКСТ embedding (text-embedding-3-small·512): хэрэглэгчийн сонголт/профайл,
                  чатын сургамж, хаагдсан арилжааны дүгнэлт. Чат хариулахад хамгийн ойрыг сэргээнэ.
                  user=null → нийтийн (зөвхөн арилжааны дүгнэлт; хэрэглэгчийн хувийн чат хэзээ ч нийтэд орохгүй).
   TraderMsg    — чатын түүх (скан бүрээр эсвэл ерөнхий). */
export interface ITraderSample { feat: number[]; dir: string; status: string; r: number; symbol: string; tf: string; kind: string; source: "backtest" | "live"; scan?: Types.ObjectId; t: Date }
const SampleS = new Schema<ITraderSample>({
  feat: { type: [Number], required: true }, dir: String, status: { type: String, index: true }, r: Number,
  symbol: String, tf: String, kind: String, source: { type: String, enum: ["backtest", "live"], index: true }, scan: { type: Schema.Types.ObjectId }, t: Date,
}, { timestamps: true });
SampleS.index({ scan: 1 }, { unique: true, sparse: true });
export const TraderSample: Model<ITraderSample> = (mongoose.models.TraderSample as Model<ITraderSample>) || mongoose.model<ITraderSample>("TraderSample", SampleS);

export interface ITraderMemory { user: Types.ObjectId | null; kind: "pref" | "chat" | "lesson" | "feedback"; text: string; emb: number[]; meta: Record<string, unknown>; createdAt: Date; updatedAt: Date }
const MemS = new Schema<ITraderMemory>({
  user: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
  kind: { type: String, enum: ["pref", "chat", "lesson", "feedback"], index: true },
  text: { type: String, required: true }, emb: { type: [Number], default: [] }, meta: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });
export const TraderMemory: Model<ITraderMemory> = (mongoose.models.TraderMemory as Model<ITraderMemory>) || mongoose.model<ITraderMemory>("TraderMemory", MemS);

export interface ITraderMsg { user: Types.ObjectId; scan: Types.ObjectId | null; role: "user" | "assistant"; text: string; meta: Record<string, unknown>; createdAt: Date }
const MsgS = new Schema<ITraderMsg>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true }, scan: { type: Schema.Types.ObjectId, default: null },
  role: { type: String, enum: ["user", "assistant"] }, text: { type: String, required: true }, meta: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });
MsgS.index({ user: 1, scan: 1, createdAt: -1 });
export const TraderMsg: Model<ITraderMsg> = (mongoose.models.TraderMsg as Model<ITraderMsg>) || mongoose.model<ITraderMsg>("TraderMsg", MsgS);
