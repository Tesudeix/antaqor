import mongoose, { Schema, Document, Model } from "mongoose";

// Yuki salon location / branch. Customers pick a location during the booking
// flow; stylists belong to one location at a time (a master moves branches
// rarely enough that a single ref is enough). Bookings snapshot the location
// so future address moves don't rewrite history.
export interface IYukiLocation extends Document {
  _id: mongoose.Types.ObjectId;
  slug: string;
  name: string;          // "Yuki Sky · СБД салбар"
  address: string;       // street line
  city: string;          // "Улаанбаатар"
  district?: string;     // "СБД", "ХУД" etc.
  phone?: string;
  image?: string;
  mapUrl?: string;       // google maps / 2gis deep link
  order: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const YukiLocationSchema = new Schema<IYukiLocation>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    address: { type: String, required: true, trim: true, maxlength: 240 },
    city: { type: String, default: "Улаанбаатар" },
    district: { type: String, default: "" },
    phone: { type: String, default: "" },
    image: { type: String, default: "" },
    mapUrl: { type: String, default: "" },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

YukiLocationSchema.index({ active: 1, order: 1 });

const YukiLocation: Model<IYukiLocation> =
  mongoose.models.YukiLocation || mongoose.model<IYukiLocation>("YukiLocation", YukiLocationSchema);

export default YukiLocation;
