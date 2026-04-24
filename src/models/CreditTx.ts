import mongoose, { Schema, Document, Model } from "mongoose";

export type CreditTxKind = "earn" | "spend";

export interface ICreditTx extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  kind: CreditTxKind;
  amount: number; // always positive — kind tells you direction
  reason: string;
  xpAwarded: number;
  ref?: string; // post id, news slug, referee id, etc.
  balanceAfter: number;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const CreditTxSchema = new Schema<ICreditTx>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: ["earn", "spend"], required: true },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true, index: true },
    xpAwarded: { type: Number, default: 0 },
    ref: { type: String, default: "" },
    balanceAfter: { type: Number, required: true },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

CreditTxSchema.index({ user: 1, createdAt: -1 });
CreditTxSchema.index({ reason: 1, createdAt: -1 });

const CreditTx: Model<ICreditTx> =
  mongoose.models.CreditTx || mongoose.model<ICreditTx>("CreditTx", CreditTxSchema);

export default CreditTx;
