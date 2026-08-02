import mongoose, { Schema, Document, Model } from "mongoose";

// A confirmed Yuki booking. We store both refs (service/stylist) and a
// `snapshot` of the price + duration at booking time so prices can change
// later without rewriting history. Status moves through pending →
// confirmed → completed/cancelled.
export type YukiBookingStatus = "pending" | "confirmed" | "completed" | "cancelled" | "no_show";

export interface IYukiBooking extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  service: mongoose.Types.ObjectId;
  stylist: mongoose.Types.ObjectId;
  location?: mongoose.Types.ObjectId;
  startsAt: Date;
  endsAt: Date;             // computed at create-time
  durationMin: number;
  priceMnt: number;
  status: YukiBookingStatus;
  notes: string;            // customer note for the stylist
  contactPhone: string;     // captured at booking
  customerName: string;     // captured at booking (may differ from User.name)
  createdAt: Date;
  updatedAt: Date;
}

const YukiBookingSchema = new Schema<IYukiBooking>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    service: { type: Schema.Types.ObjectId, ref: "YukiService", required: true },
    stylist: { type: Schema.Types.ObjectId, ref: "YukiStylist", required: true, index: true },
    location: { type: Schema.Types.ObjectId, ref: "YukiLocation", default: null },
    startsAt: { type: Date, required: true, index: true },
    endsAt: { type: Date, required: true },
    durationMin: { type: Number, required: true },
    priceMnt: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled", "no_show"],
      default: "confirmed",
      index: true,
    },
    notes: { type: String, default: "", maxlength: 500 },
    contactPhone: { type: String, default: "", maxlength: 40 },
    customerName: { type: String, default: "", maxlength: 120 },
  },
  { timestamps: true }
);

// Lookup pattern: stylist availability over a day window.
YukiBookingSchema.index({ stylist: 1, startsAt: 1 });

const YukiBooking: Model<IYukiBooking> =
  mongoose.models.YukiBooking || mongoose.model<IYukiBooking>("YukiBooking", YukiBookingSchema);

export default YukiBooking;
