import mongoose, { Schema, Document, Model } from "mongoose";

// ─────────────────────────────────────────────────────────────────────────
// Influencer — a creator on the Antaqor roster. Public directory at
// /influencers, fully admin-managed at /admin/influencers. Brands browse the
// roster and fire off collaboration requests (see InfluencerCollab). Contact
// fields are private and never leave the API on public reads.
// ─────────────────────────────────────────────────────────────────────────

export type Network =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "facebook"
  | "threads"
  | "x";

export type Tier = "nano" | "micro" | "macro" | "mega" | "celebrity";
export type InfluencerStatus = "active" | "hidden";

export interface IPlatform {
  network: Network;
  url: string;
  followers: number;
}

export interface IInfluencer extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  handle: string; // @handle, display only
  slug: string; // url key, unique
  avatar: string;
  cover: string;
  bio: string;
  location: string;
  niche: string; // primary category, e.g. "Гоо сайхан"
  tier: Tier;
  platforms: IPlatform[];
  totalFollowers: number; // auto-summed from platforms when not pinned
  engagementRate: number; // percent, e.g. 4.2
  tags: string[];
  rateFrom: number; // starting collab rate, ₮ (0 = "по запросу")
  contactEmail: string; // PRIVATE — admin only
  contactPhone: string; // PRIVATE — admin only
  verified: boolean;
  featured: boolean;
  status: InfluencerStatus;
  order: number;
  stats: { campaigns?: number; rating?: number };
  createdAt: Date;
  updatedAt: Date;
}

const PlatformSchema = new Schema<IPlatform>(
  {
    network: {
      type: String,
      enum: ["instagram", "tiktok", "youtube", "facebook", "threads", "x"],
      required: true,
    },
    url: { type: String, default: "", trim: true, maxlength: 500 },
    followers: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const InfluencerSchema = new Schema<IInfluencer>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120, index: true },
    handle: { type: String, default: "", trim: true, maxlength: 80 },
    slug: { type: String, required: true, trim: true, lowercase: true, maxlength: 120, unique: true },
    avatar: { type: String, default: "", trim: true, maxlength: 500 },
    cover: { type: String, default: "", trim: true, maxlength: 500 },
    bio: { type: String, default: "", trim: true, maxlength: 800 },
    location: { type: String, default: "", trim: true, maxlength: 120 },
    niche: { type: String, default: "", trim: true, maxlength: 80, index: true },
    tier: {
      type: String,
      enum: ["nano", "micro", "macro", "mega", "celebrity"],
      default: "micro",
      index: true,
    },
    platforms: { type: [PlatformSchema], default: [] },
    totalFollowers: { type: Number, default: 0, min: 0, index: true },
    engagementRate: { type: Number, default: 0, min: 0, max: 100 },
    tags: { type: [String], default: [] },
    rateFrom: { type: Number, default: 0, min: 0 },
    contactEmail: { type: String, default: "", trim: true, lowercase: true, maxlength: 200 },
    contactPhone: { type: String, default: "", trim: true, maxlength: 50 },
    verified: { type: Boolean, default: false },
    featured: { type: Boolean, default: false, index: true },
    status: { type: String, enum: ["active", "hidden"], default: "active", index: true },
    order: { type: Number, default: 0, index: true },
    stats: {
      campaigns: { type: Number, default: 0 },
      rating: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

// NOTE: totalFollowers is kept honest at write time by the API routes — when
// an admin leaves it at 0 we derive it from the per-platform numbers there so
// cards + sorting always have a real reach figure.
InfluencerSchema.index({ status: 1, featured: -1, order: 1, totalFollowers: -1 });
InfluencerSchema.index({ name: "text", handle: "text", niche: "text", tags: "text" });

const Influencer: Model<IInfluencer> =
  mongoose.models.Influencer || mongoose.model<IInfluencer>("Influencer", InfluencerSchema);

export default Influencer;
