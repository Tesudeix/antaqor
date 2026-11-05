import mongoose, { Schema, Model, Types } from "mongoose";

/* Tesla Trader · Scalp (2026-11-04).
   ScalpStat — калибровк: загвар × хэрэгсэл (key "EURUSD:pullback") ба загвар × төрөл ("fx:pullback")-ийн
     сүүлийн 28 хоногийн backtest (spread хассан R). key "_meta" = сүүлийн ажилласан хугацаа.
   ScalpTrade — гишүүний «Авсан» арилжаа; үр дүнг бодит 1 мин лаагаар simulate()-ээр шалгана. */
export interface IScalpStat {
  key: string; sym: string; kind: string; play: string;
  n: number; tp1: number; win: number; sumR: number; sumNet: number; sumSq: number; bars: number;
  n14: number; net14: number; from: Date | null; to: Date | null; params: Record<string, number>; updatedAt: Date;
}
const StatS = new Schema<IScalpStat>({
  key: { type: String, required: true, unique: true }, sym: String, kind: String, play: String,
  n: Number, tp1: Number, win: Number, sumR: Number, sumNet: Number, sumSq: Number, bars: Number,
  n14: Number, net14: Number, from: Date, to: Date, params: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });
export const ScalpStat: Model<IScalpStat> = (mongoose.models.ScalpStat as Model<IScalpStat>) || mongoose.model<IScalpStat>("ScalpStat", StatS);

export interface IScalpTrade {
  user: Types.ObjectId; sym: string; play: string; dir: number; grade: string;
  entry: number; sl: number; tp1: number; tp2: number; risk: number; rr2: number; costR: number;
  takenAt: Date; outcome: { status: string; r?: number; net?: number; at?: Date; tp1?: boolean }; evaluatedAt: Date | null;
  createdAt: Date;
}
const TradeS = new Schema<IScalpTrade>({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true }, sym: String, play: String, dir: Number, grade: String,
  entry: Number, sl: Number, tp1: Number, tp2: Number, risk: Number, rr2: Number, costR: Number,
  takenAt: { type: Date, default: Date.now }, outcome: { type: Schema.Types.Mixed, default: { status: "open" } }, evaluatedAt: { type: Date, default: null },
}, { timestamps: true });
TradeS.index({ user: 1, takenAt: -1 });
export const ScalpTrade: Model<IScalpTrade> = (mongoose.models.ScalpTrade as Model<IScalpTrade>) || mongoose.model<IScalpTrade>("ScalpTrade", TradeS);
