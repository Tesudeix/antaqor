import mongoose, { Schema, Document, Model } from "mongoose";

/* ─── ANTAQOR SUPPLY — /shop бараа (2026-10-16) ─────────────────────────
   /tumen (Tumen брэнд, өөр эзэмшигч) болон /prompts (дижитал) хоёроос
   ТУСДАА: Antaqor-ийн өөрийн merch. `tone` нь жагсаалтын аль хэсэгт
   (цагаан / хар) орохыг шийднэ. `model3d` (.glb) байвал hero-д жинхэнэ
   3D загвар, байхгүй бол код дээрх загвар (kind-аар) харагдана. */

export type ShopKind = "hoodie" | "tee" | "cap" | "other";

export interface IShopSize { label: string; stock: number }
export interface IShopColor { name: string; hex: string }

export interface IShopProduct extends Document {
  name: string;
  slug: string;
  kind: ShopKind;
  tagline: string;
  description: string;
  price: number;
  compareAtPrice: number;
  images: string[];
  model3d: string;
  colors: IShopColor[];
  sizes: IShopSize[];
  tone: "light" | "dark";
  featured: boolean;
  active: boolean;
  sort: number;
  createdAt: Date;
  updatedAt: Date;
}

const ShopProductSchema = new Schema<IShopProduct>(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, index: true },
    kind: { type: String, enum: ["hoodie", "tee", "cap", "other"], default: "other" },
    tagline: { type: String, default: "", maxlength: 160 },
    description: { type: String, default: "", maxlength: 4000 },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, default: 0 },
    images: { type: [String], default: [] },
    model3d: { type: String, default: "" },
    colors: { type: [{ name: String, hex: String }], default: [] },
    sizes: { type: [{ label: String, stock: { type: Number, default: 0 } }], default: [] },
    tone: { type: String, enum: ["light", "dark"], default: "light" },
    featured: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
    sort: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const ShopProduct: Model<IShopProduct> =
  mongoose.models.ShopProduct || mongoose.model<IShopProduct>("ShopProduct", ShopProductSchema);
export default ShopProduct;
