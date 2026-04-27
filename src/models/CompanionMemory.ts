import mongoose, { Schema, Document, Model } from "mongoose";

// Long-term memory for the Antaqor AI companion.
// One row per VISITOR — either a logged-in user (`user`) OR an anonymous
// browser session (`guestKey`). Exactly one of them is set.
export interface ICompanionMemory extends Document {
  _id: mongoose.Types.ObjectId;
  user?: mongoose.Types.ObjectId;
  guestKey?: string;

  affection: number;
  preferredName: string;
  summary: string;
  facts: string[];
  preferences: Record<string, string>;
  importantEvents: { at: Date; what: string }[];
  insideJokes: string[];

  totalMessages: number;
  lastInteractionAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const CompanionMemorySchema = new Schema<ICompanionMemory>(
  {
    // No field-level index: true — the compound sparse-unique indexes
    // below are the source of truth.
    user: { type: Schema.Types.ObjectId, ref: "User" },
    guestKey: { type: String },
    affection: { type: Number, default: 30, min: 0, max: 100 },
    preferredName: { type: String, default: "", maxlength: 60 },
    summary: { type: String, default: "", maxlength: 1000 },
    facts: { type: [String], default: [] },
    preferences: { type: Schema.Types.Mixed, default: {} },
    importantEvents: {
      type: [{ at: Date, what: { type: String, maxlength: 240 }, _id: false }],
      default: [],
    },
    insideJokes: { type: [String], default: [] },
    totalMessages: { type: Number, default: 0 },
    lastInteractionAt: { type: Date },
  },
  { timestamps: true }
);

// Each subject (user OR guest) is unique. Sparse so the row can have only one.
CompanionMemorySchema.index({ user: 1 }, { unique: true, sparse: true });
CompanionMemorySchema.index({ guestKey: 1 }, { unique: true, sparse: true });

const CompanionMemory: Model<ICompanionMemory> =
  mongoose.models.CompanionMemory ||
  mongoose.model<ICompanionMemory>("CompanionMemory", CompanionMemorySchema);

export default CompanionMemory;
