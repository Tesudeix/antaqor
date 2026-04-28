import mongoose, { Schema, Document, Model } from "mongoose";

// Per-visitor long-term memory for the Budjargal AI companion.
// One row per visitor (logged-in user OR anonymous guest).
export interface IBudjargalMemory extends Document {
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

const BudjargalMemorySchema = new Schema<IBudjargalMemory>(
  {
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

BudjargalMemorySchema.index({ user: 1 }, { unique: true, sparse: true });
BudjargalMemorySchema.index({ guestKey: 1 }, { unique: true, sparse: true });

const BudjargalMemory: Model<IBudjargalMemory> =
  mongoose.models.BudjargalMemory ||
  mongoose.model<IBudjargalMemory>("BudjargalMemory", BudjargalMemorySchema);

export default BudjargalMemory;
