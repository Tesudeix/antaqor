import mongoose, { Schema, Document, Model } from "mongoose";

// Admin-curated facts that get injected into Antaqor's system prompt as
// "LIVE PLATFORM CONTEXT". Updating one of these takes effect on the very
// next chat turn (after the in-memory cache TTL).
export interface ICompanionKnowledge extends Document {
  _id: mongoose.Types.ObjectId;
  topic: string;          // e.g. "membership", "founder", "launch", "policy"
  content: string;        // ≤500 chars; Antaqor draws from this
  weight: number;         // 1–10; higher = always included
  active: boolean;        // disable without deleting
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CompanionKnowledgeSchema = new Schema<ICompanionKnowledge>(
  {
    topic: { type: String, required: true, trim: true, maxlength: 60, index: true },
    content: { type: String, required: true, trim: true, maxlength: 500 },
    weight: { type: Number, default: 5, min: 1, max: 10 },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

CompanionKnowledgeSchema.index({ active: 1, weight: -1 });

const CompanionKnowledge: Model<ICompanionKnowledge> =
  mongoose.models.CompanionKnowledge ||
  mongoose.model<ICompanionKnowledge>("CompanionKnowledge", CompanionKnowledgeSchema);

export default CompanionKnowledge;
