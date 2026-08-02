import mongoose, { Schema, Document, Model } from "mongoose";

// Inbound: a brand requesting a collaboration/campaign — either with a specific
// creator (influencerId set) or an open brief. Public POST from /influencers;
// managed as leads in /admin/influencers.
export type CollabStatus = "new" | "contacted" | "won" | "closed";

export interface IInfluencerCollab extends Document {
  _id: mongoose.Types.ObjectId;
  influencerId?: mongoose.Types.ObjectId;
  influencerName: string; // snapshot at request time ("" = open brief)
  brand: string;
  name: string;
  email: string;
  phone: string;
  budget: number; // ₮, 0 = unspecified
  goal: string; // awareness / launch / sales / ugc ...
  message: string;
  status: CollabStatus;
  adminNote: string;
  createdAt: Date;
  updatedAt: Date;
}

const InfluencerCollabSchema = new Schema<IInfluencerCollab>(
  {
    influencerId: { type: Schema.Types.ObjectId, ref: "Influencer", default: null },
    influencerName: { type: String, default: "", trim: true, maxlength: 120 },
    brand: { type: String, default: "", trim: true, maxlength: 200 },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, default: "", trim: true, maxlength: 50 },
    budget: { type: Number, default: 0, min: 0 },
    goal: { type: String, default: "", trim: true, maxlength: 60 },
    message: { type: String, required: true, trim: true, maxlength: 3000 },
    status: {
      type: String,
      enum: ["new", "contacted", "won", "closed"],
      default: "new",
    },
    adminNote: { type: String, default: "", trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

InfluencerCollabSchema.index({ status: 1, createdAt: -1 });

const InfluencerCollab: Model<IInfluencerCollab> =
  mongoose.models.InfluencerCollab ||
  mongoose.model<IInfluencerCollab>("InfluencerCollab", InfluencerCollabSchema);

export default InfluencerCollab;
