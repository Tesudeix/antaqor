import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * One person, one pack, bought with credits — permanent.
 *
 * Deliberately separate from the plan gate rather than folded into it: a plan
 * is a subscription that can lapse, an unlock is a purchase that must not. The
 * slide gate therefore opens on `plan access OR free slide OR unlock`, so a
 * lapsed subscriber never loses a pack they paid credits for.
 */
export interface IPromptUnlock extends Document {
  userId: mongoose.Types.ObjectId;
  slug: string;
  /** What it actually cost at purchase time — the price may change later. */
  spent: number;
  createdAt: Date;
  updatedAt: Date;
}

const PromptUnlockSchema = new Schema<IPromptUnlock>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    slug: { type: String, required: true, lowercase: true, trim: true, index: true },
    spent: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// The uniqueness that makes double-charging impossible: the insert fails
// before any credit is spent a second time.
PromptUnlockSchema.index({ userId: 1, slug: 1 }, { unique: true });

const PromptUnlock: Model<IPromptUnlock> =
  (mongoose.models.PromptUnlock as Model<IPromptUnlock>) ||
  mongoose.model<IPromptUnlock>("PromptUnlock", PromptUnlockSchema);

export default PromptUnlock;
