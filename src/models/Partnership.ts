import mongoose, { Schema, Document, Model } from "mongoose";

export type PartnershipType = "brand" | "education" | "tech" | "community" | "other";
export type PartnershipStatus = "new" | "contacted" | "closed";

export interface IPartnership extends Document {
  _id: mongoose.Types.ObjectId;
  company: string;
  name: string;
  email: string;
  phone: string;
  type: PartnershipType;
  message: string;
  status: PartnershipStatus;
  adminNote: string;
  createdAt: Date;
  updatedAt: Date;
}

const PartnershipSchema = new Schema<IPartnership>(
  {
    company: { type: String, default: "", trim: true, maxlength: 200 },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 200 },
    phone: { type: String, default: "", trim: true, maxlength: 50 },
    type: {
      type: String,
      enum: ["brand", "education", "tech", "community", "other"],
      default: "other",
    },
    message: { type: String, required: true, trim: true, maxlength: 5000 },
    status: {
      type: String,
      enum: ["new", "contacted", "closed"],
      default: "new",
    },
    adminNote: { type: String, default: "", trim: true, maxlength: 2000 },
  },
  { timestamps: true }
);

PartnershipSchema.index({ status: 1, createdAt: -1 });

const Partnership: Model<IPartnership> =
  mongoose.models.Partnership ||
  mongoose.model<IPartnership>("Partnership", PartnershipSchema);

export default Partnership;
