import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── VIEWING ЗАХИАЛГА ─────────────────────────────────────────────────
   Прототипт захиалга нь зөвхөн state дотор байсан тул хуудсаа сэргээхэд
   алга болдог байв. Байр үзэх цаг захиалах нь хүн цаг гаргаж очих
   амлалт — үүнийг санах ойд үлдээж болохгүй. */

export interface IRentBooking extends Document {
  listing: mongoose.Types.ObjectId;
  /* Зар нь дараа устаж болох тул агшин зуурын хуулбарыг үлдээнэ —
     захиалгын түүх өөрөө бүрэн утгатай байх ёстой. */
  listingTitle: string;
  listingLocation: string;
  user?: mongoose.Types.ObjectId;
  name: string;
  phone: string;
  /** "10/3 Ба" — харуулах хэлбэр. */
  dayLabel: string;
  /** ISO огноо — эрэмбэлэх, хуучирсныг шүүхэд. */
  date: Date;
  slot: string;
  /** "Биеэр" | "Видео" */
  mode: string;
  status: "pending" | "confirmed" | "cancelled";
  note: string;
  createdAt: Date;
  updatedAt: Date;
}

const RentBookingSchema = new Schema<IRentBooking>(
  {
    listing: { type: Schema.Types.ObjectId, ref: "RentListing", required: true, index: true },
    listingTitle: { type: String, default: "" },
    listingLocation: { type: String, default: "" },
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    name: { type: String, default: "", maxlength: 80 },
    phone: { type: String, default: "", maxlength: 24 },
    dayLabel: { type: String, default: "" },
    date: { type: Date, index: true },
    slot: { type: String, default: "" },
    mode: { type: String, default: "Биеэр" },
    status: { type: String, enum: ["pending", "confirmed", "cancelled"], default: "pending", index: true },
    note: { type: String, default: "", maxlength: 400 },
  },
  { timestamps: true }
);

/* Нэг байрны нэг цаг давхар захиалагдахаас сэргийлнэ — цуцлагдсаныг
   тооцохгүй тул тэр цаг дахин чөлөөтэй болно. */
RentBookingSchema.index(
  { listing: 1, date: 1, slot: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ["pending", "confirmed"] } } }
);

export default (mongoose.models.RentBooking as Model<IRentBooking>) ||
  mongoose.model<IRentBooking>("RentBooking", RentBookingSchema);
