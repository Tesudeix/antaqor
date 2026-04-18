import mongoose, { Schema, Document, Model } from "mongoose";

export interface IInfluencer extends Document {
  name: string;
  slug: string;
  bio: string;
  avatar: string;
  coverImage: string;
  category: string;
  socials: {
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    facebook?: string;
    twitter?: string;
  };
  stats: {
    followers: number;
    engagement: number;
    avgViews: number;
    avgLikes: number;
  };
  pricing: {
    story: number;
    post: number;
    reel: number;
    campaign: number;
  };
  tags: string[];
  status: "active" | "pending" | "inactive";
  featured: boolean;
  verified: boolean;
  order: number;
  contactEmail: string;
  contactPhone: string;
  portfolio: string[];
  createdAt: Date;
}

const InfluencerSchema = new Schema<IInfluencer>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    bio: { type: String, default: "" },
    avatar: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    category: { type: String, required: true, index: true },
    socials: {
      instagram: { type: String, default: "" },
      tiktok: { type: String, default: "" },
      youtube: { type: String, default: "" },
      facebook: { type: String, default: "" },
      twitter: { type: String, default: "" },
    },
    stats: {
      followers: { type: Number, default: 0 },
      engagement: { type: Number, default: 0 },
      avgViews: { type: Number, default: 0 },
      avgLikes: { type: Number, default: 0 },
    },
    pricing: {
      story: { type: Number, default: 0 },
      post: { type: Number, default: 0 },
      reel: { type: Number, default: 0 },
      campaign: { type: Number, default: 0 },
    },
    tags: [{ type: String }],
    status: { type: String, enum: ["active", "pending", "inactive"], default: "active" },
    featured: { type: Boolean, default: false },
    verified: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    contactEmail: { type: String, default: "" },
    contactPhone: { type: String, default: "" },
    portfolio: [{ type: String }],
  },
  { timestamps: true }
);

InfluencerSchema.index({ status: 1, order: 1 });
InfluencerSchema.index({ featured: 1 });
InfluencerSchema.index({ "stats.followers": -1 });

export default (mongoose.models.Influencer as Model<IInfluencer>) ||
  mongoose.model<IInfluencer>("Influencer", InfluencerSchema);
