import mongoose, { Schema, Document, Model } from "mongoose";

// Yuki salon stylist. Each stylist has weekly working hours (per-day
// open/close) and a set of services they perform. Bookings respect both.
export interface IDayHours {
  open: string;   // "HH:MM" 24h
  close: string;  // "HH:MM"
  closed?: boolean;
}

export interface IYukiStylist extends Document {
  _id: mongoose.Types.ObjectId;
  slug: string;
  name: string;
  role: string;
  bio: string;
  avatar: string;
  services: mongoose.Types.ObjectId[];   // YukiService refs they perform
  location?: mongoose.Types.ObjectId;    // YukiLocation — branch they work at
  // Weekly hours, index 0 = Sunday, ..., 6 = Saturday — keep simple.
  weeklyHours: IDayHours[];
  order: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const DayHoursSchema = new Schema<IDayHours>(
  {
    open: { type: String, default: "10:00" },
    close: { type: String, default: "20:00" },
    closed: { type: Boolean, default: false },
  },
  { _id: false }
);

const YukiStylistSchema = new Schema<IYukiStylist>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    role: { type: String, default: "", maxlength: 80 },
    bio: { type: String, default: "", maxlength: 600 },
    avatar: { type: String, default: "" },
    services: [{ type: Schema.Types.ObjectId, ref: "YukiService" }],
    location: { type: Schema.Types.ObjectId, ref: "YukiLocation", default: null, index: true },
    weeklyHours: {
      type: [DayHoursSchema],
      default: () => Array.from({ length: 7 }, () => ({ open: "10:00", close: "20:00", closed: false })),
      validate: (arr: IDayHours[]) => arr.length === 7,
    },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

YukiStylistSchema.index({ active: 1, order: 1 });

const YukiStylist: Model<IYukiStylist> =
  mongoose.models.YukiStylist || mongoose.model<IYukiStylist>("YukiStylist", YukiStylistSchema);

export default YukiStylist;
