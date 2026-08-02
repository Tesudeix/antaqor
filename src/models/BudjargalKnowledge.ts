import mongoose, { Schema, Document, Model } from "mongoose";

// Admin-curated facts injected into Budjargal's system prompt as "LIVE
// CORPUS". Use to add new quotes / training principles without code changes.
// Mirrors CompanionKnowledge but scoped to Budjargal so the two AIs don't
// bleed material.
export interface IBudjargalKnowledge extends Document {
  _id: mongoose.Types.ObjectId;
  topic: string;          // "philosophy", "training", "diet", "story", "quote"
  content: string;        // ≤500 chars
  source?: string;        // "Гүйлтийн бясалгал 1, p.42" etc.
  weight: number;         // 1–10
  active: boolean;
  createdBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BudjargalKnowledgeSchema = new Schema<IBudjargalKnowledge>(
  {
    topic: { type: String, required: true, trim: true, maxlength: 60, index: true },
    content: { type: String, required: true, trim: true, maxlength: 500 },
    source: { type: String, trim: true, maxlength: 200, default: "" },
    weight: { type: Number, default: 5, min: 1, max: 10 },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

BudjargalKnowledgeSchema.index({ active: 1, weight: -1 });

const BudjargalKnowledge: Model<IBudjargalKnowledge> =
  mongoose.models.BudjargalKnowledge ||
  mongoose.model<IBudjargalKnowledge>("BudjargalKnowledge", BudjargalKnowledgeSchema);

export default BudjargalKnowledge;
