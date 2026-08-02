import mongoose, { Schema, Document, Model } from "mongoose";

// Singleton guardrail settings for the automation engine.
export interface IThreadsSettings extends Document {
  key: string; // always "global"
  killSwitch: boolean; // true → engine does nothing at all
  maxPerHour: number; // max actions per account per rolling hour
  createdAt: Date;
  updatedAt: Date;
}

const ThreadsSettingsSchema = new Schema<IThreadsSettings>(
  {
    key: { type: String, default: "global", unique: true },
    killSwitch: { type: Boolean, default: false },
    maxPerHour: { type: Number, default: 30, min: 1, max: 200 },
  },
  { timestamps: true }
);

const ThreadsSettings: Model<IThreadsSettings> =
  mongoose.models.ThreadsSettings ||
  mongoose.model<IThreadsSettings>("ThreadsSettings", ThreadsSettingsSchema);

export async function getThreadsSettings(): Promise<IThreadsSettings> {
  const existing = await ThreadsSettings.findOne({ key: "global" });
  if (existing) return existing;
  return ThreadsSettings.create({ key: "global" });
}

export default ThreadsSettings;
