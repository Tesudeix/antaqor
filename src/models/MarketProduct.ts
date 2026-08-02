import mongoose, { Schema, Document, Model } from "mongoose";

export type MarketCategory = "Prompt" | "Course" | "Template" | "Agent" | "Service" | "Digital";

export interface IMarketProduct extends Document {
  _id: mongoose.Types.ObjectId;
  title: string;
  slug: string;
  summary: string;
  description: string;
  coverImage: string;
  gallery: string[];
  category: MarketCategory;
  price: number;                 // MNT
  compareAtPrice: number;        // for discount badge (optional)
  currency: "MNT";
  tags: string[];
  sellerName: string;
  sellerAvatar: string;
  seller?: mongoose.Types.ObjectId; // ref User (optional — admin-seeded listings may omit)
  externalUrl: string;           // where the purchase happens (for redirect-based sales v1)
  featured: boolean;
  approved: boolean;
  published: boolean;
  views: number;
  clicks: number;                // external-url clicks
  createdAt: Date;
  updatedAt: Date;
}

const MarketProductSchema = new Schema<IMarketProduct>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    summary: { type: String, default: "", trim: true, maxlength: 300 },
    description: { type: String, default: "", trim: true, maxlength: 20000 },
    coverImage: { type: String, default: "" },
    gallery: [{ type: String }],
    category: {
      type: String,
      enum: ["Prompt", "Course", "Template", "Agent", "Service", "Digital"],
      default: "Prompt",
      index: true,
    },
    price: { type: Number, default: 0, min: 0 },
    compareAtPrice: { type: Number, default: 0, min: 0 },
    currency: { type: String, enum: ["MNT"], default: "MNT" },
    tags: [{ type: String, trim: true, maxlength: 40 }],
    sellerName: { type: String, default: "Antaqor", trim: true, maxlength: 100 },
    sellerAvatar: { type: String, default: "" },
    seller: { type: Schema.Types.ObjectId, ref: "User" },
    externalUrl: { type: String, default: "", trim: true, maxlength: 600 },
    featured: { type: Boolean, default: false },
    approved: { type: Boolean, default: true },
    published: { type: Boolean, default: true },
    views: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },
  },
  { timestamps: true }
);

MarketProductSchema.index({ published: 1, approved: 1, featured: -1, createdAt: -1 });
MarketProductSchema.index({ category: 1, createdAt: -1 });

const MarketProduct: Model<IMarketProduct> =
  mongoose.models.MarketProduct || mongoose.model<IMarketProduct>("MarketProduct", MarketProductSchema);

export default MarketProduct;
