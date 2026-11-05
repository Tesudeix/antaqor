import mongoose, { Schema, Document, Model } from "mongoose";

// Singleton guardrail settings for the automation engine.
export interface IThreadsSettings extends Document {
  key: string; // always "global"
  killSwitch: boolean; // true → engine does nothing at all
  maxPerHour: number; // max actions per account per rolling hour
  /* AI авто хариулт: түлхүүр үгийн ДҮРЭМД ТААРААГҮЙ хариултыг уншаад
     контекст хариулт бичнэ. Дүрмүүд нь тэргүүлэх эрхтэй хэвээр —
     тэд санаатай бичигдсэн, AI нь үлдсэнийг барина. */
  aiReplyEnabled: boolean;
  /* Тусдаа, илүү чанга төсөв: AI хариулт нь загвар хариултаас илүү
     эрсдэлтэй тул нэг хувааж өгөхгүй. */
  aiReplyMaxPerHour: number;
  createdAt: Date;
  updatedAt: Date;
}

const ThreadsSettingsSchema = new Schema<IThreadsSettings>(
  {
    key: { type: String, default: "global", unique: true },
    killSwitch: { type: Boolean, default: false },
    maxPerHour: { type: Number, default: 30, min: 1, max: 200 },
    aiReplyEnabled: { type: Boolean, default: false },
    aiReplyMaxPerHour: { type: Number, default: 10, min: 1, max: 60 },
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
