import mongoose, { Schema, Document } from "mongoose";

export type AIProvider = "grok" | "openai" | "claude";

export interface IMetaSettings extends Document {
  singleton: "main";
  automationEnabled: boolean;
  aiReplyEnabled: boolean;
  provider: AIProvider;
  aiModel: string;
  systemPromptOverride: string;
  fallbackMessage: string;
  blacklistWords: string[];
  businessHoursEnabled: boolean;
  businessHoursStartMin: number;
  businessHoursEndMin: number;
  businessHoursTz: string;
  businessHoursMessage: string;
  maxRepliesPerUserPerDay: number;
  updatedByEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

const MetaSettingsSchema = new Schema<IMetaSettings>(
  {
    singleton: { type: String, enum: ["main"], default: "main", unique: true, required: true },
    automationEnabled: { type: Boolean, default: true },
    aiReplyEnabled: { type: Boolean, default: true },
    provider: { type: String, enum: ["grok", "openai", "claude"], default: "grok" },
    aiModel: { type: String, default: "grok-3-mini" },
    systemPromptOverride: { type: String, default: "" },
    fallbackMessage: {
      type: String,
      default: "Сайн уу! Түр доголдол гарлаа. Хэсэг хүлээгээд дахин бичээрэй.",
    },
    blacklistWords: { type: [String], default: [] },
    businessHoursEnabled: { type: Boolean, default: false },
    businessHoursStartMin: { type: Number, default: 9 * 60 },
    businessHoursEndMin: { type: Number, default: 22 * 60 },
    businessHoursTz: { type: String, default: "Asia/Ulaanbaatar" },
    businessHoursMessage: {
      type: String,
      default: "Сайн уу! Бид одоо ажиллахгүй байна. 9:00–22:00 цагт холбогдоорой.",
    },
    maxRepliesPerUserPerDay: { type: Number, default: 50 },
    updatedByEmail: { type: String, default: "" },
  },
  { timestamps: true }
);

export default (mongoose.models.MetaSettings as mongoose.Model<IMetaSettings>) ||
  mongoose.model<IMetaSettings>("MetaSettings", MetaSettingsSchema);
