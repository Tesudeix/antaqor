import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── ANTAQOR SUPPLY захиалга (2026-10-16) ───────────────────────────────
   Үнийг КЛИЕНТЭЭС АВАХГҮЙ — сервер ShopProduct-оос дахин тооцно.
   pending → paid (Wire/QPay баталгаажсан, үлдэгдэл хасагдсан) →
   shipped → done; эсвэл cancelled. pending→paid шилжилт атомик
   (findOneAndUpdate) тул Wire-ийн буцалт ба статусын асуулт уралдсан ч
   үлдэгдэл хоёр удаа хасагдахгүй. */

export interface IShopOrderItem {
  product: mongoose.Types.ObjectId;
  name: string;
  slug: string;
  image: string;
  price: number;
  size: string;
  color: string;
  qty: number;
}

export interface IShopOrder extends Document {
  orderNo: string;
  items: IShopOrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  customer: { name: string; phone: string; address: string; note: string };
  user?: mongoose.Types.ObjectId;
  status: "pending" | "paid" | "shipped" | "done" | "cancelled";
  wireIntentId: string;
  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ShopOrderSchema = new Schema<IShopOrder>(
  {
    orderNo: { type: String, required: true, unique: true, index: true },
    items: [{
      product: { type: Schema.Types.ObjectId, ref: "ShopProduct" },
      name: String, slug: String, image: String,
      price: Number, size: String, color: String, qty: Number,
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
    status: { type: String, enum: ["pending", "paid", "shipped", "done", "cancelled"], default: "pending", index: true },
    wireIntentId: { type: String, default: "" },
    paidAt: Date,
  },
  { timestamps: true }
);

const ShopOrder: Model<IShopOrder> =
  mongoose.models.ShopOrder || mongoose.model<IShopOrder>("ShopOrder", ShopOrderSchema);
export default ShopOrder;
