import mongoose, { Schema, Document, Model } from "mongoose";

export interface IService extends Document {
  name: string;
  slug: string;
  description: string;
  logo: string;
  coverImage: string;
  category: string;
  url: string;
  domain: string;
  status: "active" | "coming_soon" | "inactive";
  featured: boolean;
  order: number;
  tags: string[];
  stats: {
    users?: number;
    rating?: number;
  };
  createdAt: Date;
}

const ServiceSchema = new Schema<IService>(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
    logo: { type: String, default: "" },
    coverImage: { type: String, default: "" },
    category: { type: String, required: true, index: true },
    url: { type: String, required: true },
    domain: { type: String, default: "" },
    status: { type: String, enum: ["active", "coming_soon", "inactive"], default: "active" },
    featured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    tags: [{ type: String }],
    stats: {
      users: { type: Number, default: 0 },
      rating: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

ServiceSchema.index({ status: 1, order: 1 });
ServiceSchema.index({ featured: 1 });

export default (mongoose.models.Service as Model<IService>) ||
  mongoose.model<IService>("Service", ServiceSchema);
