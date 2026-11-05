import mongoose, { Schema, Document, Model } from "mongoose";

export type HomepageCardSection = "ai_solution" | "resource" | "tool";

export interface IHomepageCard extends Document {
  section: HomepageCardSection;
  title: string;
  desc: string;
  emoji: string;
  coverImage: string;
  href: string;
  order: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const HomepageCardSchema = new Schema<IHomepageCard>(
  {
    section: { type: String, enum: ["ai_solution", "resource", "tool"], required: true, index: true },
    title: { type: String, required: true },
    desc: { type: String, default: "" },
    emoji: { type: String, default: "✨" },
    coverImage: { type: String, default: "" },
    href: { type: String, required: true },
    order: { type: Number, default: 100, index: true },
    enabled: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

HomepageCardSchema.index({ section: 1, enabled: 1, order: 1 });

export default (mongoose.models.HomepageCard as Model<IHomepageCard>) ||
  mongoose.model<IHomepageCard>("HomepageCard", HomepageCardSchema);
