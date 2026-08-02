import mongoose, { Schema, Document, Model } from "mongoose";

export const LANDING_CARD_ICONS = [
  "ai",
  "money",
  "community",
  "lightning",
  "target",
  "growth",
  "rocket",
  "tool",
  "shield",
  "spark",
] as const;

export type LandingCardIcon = (typeof LANDING_CARD_ICONS)[number];

export interface ILandingCard extends Document {
  title: string;
  description: string;
  icon: LandingCardIcon;
  order: number;
  enabled: boolean;
  ctaLabel?: string;
  ctaHref?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LandingCardSchema = new Schema<ILandingCard>(
  {
    title: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, required: true, trim: true, maxlength: 240 },
    icon: { type: String, enum: LANDING_CARD_ICONS, default: "ai" },
    order: { type: Number, default: 0, index: true },
    enabled: { type: Boolean, default: true },
    ctaLabel: { type: String, default: "", maxlength: 60 },
    ctaHref: { type: String, default: "", maxlength: 240 },
  },
  { timestamps: true }
);

LandingCardSchema.index({ enabled: 1, order: 1 });

const LandingCard: Model<ILandingCard> =
  mongoose.models.LandingCard ||
  mongoose.model<ILandingCard>("LandingCard", LandingCardSchema);

export default LandingCard;
