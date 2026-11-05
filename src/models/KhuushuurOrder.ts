import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── ТАЛ ХУУШУУР захиалга (2026-10-17) ──────────────────────────────────
   Үнийг КЛИЕНТЭЭС АВАХГҮЙ — сервер KhuushuurItem-ээс дахин тооцно.
   pending → paid (QPay баталгаажсан) → cooking → delivering → done;
   эсвэл cancelled. pending→paid шилжилт атомик (lib/khuushuur.ts). */

export type KhStatus = "pending" | "paid" | "cooking" | "delivering" | "done" | "cancelled";
export const KH_STATUSES: KhStatus[] = ["pending", "paid", "cooking", "delivering", "done", "cancelled"];

export interface IKhuushuurOrderItem {
  item: mongoose.Types.ObjectId;
  slug: string;
  name: string;
  price: number;
  qty: number;
}

export interface IKhuushuurOrder extends Document {
  orderNo: string;
  mode: "delivery" | "pickup";
  items: IKhuushuurOrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  customer: { name: string; phone: string; address: string; note: string };
  user?: mongoose.Types.ObjectId;
  status: KhStatus;
  wireIntentId: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const KhuushuurOrderSchema = new Schema<IKhuushuurOrder>(
  {
    orderNo: { type: String, required: true, unique: true, index: true },
    mode: { type: String, enum: ["delivery", "pickup"], default: "delivery" },
    items: [{
      item: { type: Schema.Types.ObjectId, ref: "KhuushuurItem" },
      slug: String, name: String, price: Number, qty: Number,
    }],
    subtotal: { type: Number, required: true },
    deliveryFee: { type: Number, default: 0 },
    total: { type: Number, required: true },
    customer: {
      name: { type: String, default: "" },
      phone: { type: String, default: "" },
      address: { type: String, default: "" },
      note: { type: String, default: "" },
    },
    user: { type: Schema.Types.ObjectId, ref: "User" },
    status: { type: String, enum: KH_STATUSES, default: "pending", index: true },
    wireIntentId: { type: String, default: "" },
    paidAt: Date,
  },
  { timestamps: true }
);

const KhuushuurOrder: Model<IKhuushuurOrder> =
  mongoose.models.KhuushuurOrder || mongoose.model<IKhuushuurOrder>("KhuushuurOrder", KhuushuurOrderSchema);
export default KhuushuurOrder;
