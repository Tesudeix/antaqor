import mongoose, { Schema, Document, Model } from "mongoose";

// Inbound: a creator applying to join the Antaqor roster. Public POST from the
// /influencers "Become a creator" flow; reviewed in /admin/influencers.
export type ApplicationStatus = "new" | "reviewing" | "approved" | "rejected";

export interface IInfluencerApplication extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  handle: string;
  email: string;
  phone: string;
  niche: string;
  primaryPlatform: string;
  followers: number;
  portfolioUrl: string;
  message: string;
  status: ApplicationStatus;
  adminNote: string;
  createdAt: Date;
  updatedAt: Date;
}

const InfluencerApplicationSchema = new Schema<IInfluencerApplication>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    handle: { type: String, default: "", trim: true, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, default: "", trim: true, maxlength: 50 },
    niche: { type: String, default: "", trim: true, maxlength: 80 },
    primaryPlatform: { type: String, default: "", trim: true, maxlength: 40 },
    followers: { type: Number, default: 0, min: 0 },
    portfolioUrl: { type: String, default: "", trim: true, maxlength: 500 },
    message: { type: String, default: "", trim: true, maxlength: 3000 },
    status: {
      type: String,
      enum: ["new", "reviewing", "approved", "rejected"],
      default: "new",
    },
    adminNote: { type: String, default: "", trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

InfluencerApplicationSchema.index({ status: 1, createdAt: -1 });

const InfluencerApplication: Model<IInfluencerApplication> =
  mongoose.models.InfluencerApplication ||
  mongoose.model<IInfluencerApplication>("InfluencerApplication", InfluencerApplicationSchema);

export default InfluencerApplication;
