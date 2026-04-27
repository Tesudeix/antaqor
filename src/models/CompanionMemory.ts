import mongoose, { Schema, Document, Model } from "mongoose";

// Long-term per-user memory for the Antaqor AI companion. One row per user.
export interface ICompanionMemory extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;

  // Affection level 0–100. Persona warms up as this grows.
  affection: number;

  // What the user has told the companion to call them. May differ from User.name.
  preferredName: string;

  // Rolling free-text summary of the relationship and what's been discussed.
  // Kept under ~600 chars to stay cheap to inject in every prompt.
  summary: string;

  // Stable facts the user has shared ("Хан-Уул дүүрэгт амьдардаг", "AI startup
  // эхлэхийг хүсэж байна", "хүүтэй"). Capped at 30; oldest get evicted.
  facts: string[];

  // Light preference map (free-form key/value): favorite_color, mood, etc.
  preferences: Record<string, string>;

  // Important moments worth remembering forever (birthday, big launch).
  importantEvents: { at: Date; what: string }[];

  // In-jokes / shared references the companion can call back to.
  insideJokes: string[];

  totalMessages: number;
  lastInteractionAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const CompanionMemorySchema = new Schema<ICompanionMemory>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
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

const CompanionMemory: Model<ICompanionMemory> =
  mongoose.models.CompanionMemory ||
  mongoose.model<ICompanionMemory>("CompanionMemory", CompanionMemorySchema);

export default CompanionMemory;
