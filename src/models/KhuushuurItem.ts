import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── ТАЛ ХУУШУУР — /khuushuur цэсний бараа (2026-10-17) ──────────────────
   /shop (merch) болон /tumen-ээс ТУСДАА: хоол хүргэлтийн цэс. `category`
   нь src/lib/khuushuur.ts → KH_CATEGORIES-ийн id. `image` байвал зураг,
   байхгүй бол `art` төрлөөр код дээр зурсан SVG харагдана. Үлдэгдэл
   тоолохгүй — хоол дууссан бол админ `soldOut`-ыг асаана. */

export interface IKhuushuurItem extends Document {
  slug: string;
  category: string;
  name: string;
  kcal: string;
  description: string;
  price: number;
  image: string;
  art: string;
  tag: string;
  soldOut: boolean;
  active: boolean;
  sort: number;
  createdAt: Date;
  updatedAt: Date;
}

const KhuushuurItemSchema = new Schema<IKhuushuurItem>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    category: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    kcal: { type: String, default: "", maxlength: 30 },
    description: { type: String, default: "", maxlength: 400 },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, default: "" },
    art: { type: String, default: "one" },
    tag: { type: String, default: "", maxlength: 20 },
    soldOut: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    sort: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const KhuushuurItem: Model<IKhuushuurItem> =
  mongoose.models.KhuushuurItem || mongoose.model<IKhuushuurItem>("KhuushuurItem", KhuushuurItemSchema);
export default KhuushuurItem;
