import mongoose, { Schema, Document, Model } from "mongoose";

// Yuki salon — a single service offering (haircut, color, etc.). Static
// catalog; admin curates via mongosh / future admin UI.
export interface IYukiService extends Document {
  _id: mongoose.Types.ObjectId;
  slug: string;
  name: string;
  description: string;
  durationMin: number;     // booking slot length
  priceMnt: number;        // price in MNT
  image: string;
  order: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const YukiServiceSchema = new Schema<IYukiService>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: "", maxlength: 600 },
    durationMin: { type: Number, default: 60, min: 15, max: 480 },
    priceMnt: { type: Number, default: 0, min: 0 },
    image: { type: String, default: "" },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

YukiServiceSchema.index({ active: 1, order: 1 });

const YukiService: Model<IYukiService> =
  mongoose.models.YukiService || mongoose.model<IYukiService>("YukiService", YukiServiceSchema);

export default YukiService;
