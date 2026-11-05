import { randomBytes } from "crypto";
import mongoose from "mongoose";
import ShopProduct, { type IShopProduct } from "@/models/ShopProduct";
import ShopOrder from "@/models/ShopOrder";

/* ANTAQOR SUPPLY — дундын туслахууд (2026-10-16). */

/** Хүргэлтийн төлбөр — одоохондоо үнэгүй. Өөрчлөх бол ЭНД л. */
export const SHOP_DELIVERY_FEE = 0;

export type PublicProduct = {
  _id: string; name: string; slug: string; kind: string; tagline: string; description: string;
  price: number; compareAtPrice: number; images: string[]; model3d: string;
  colors: { name: string; hex: string }[]; sizes: { label: string; stock: number }[];
  tone: "light" | "dark"; featured: boolean; soldOut: boolean;
};

export function toPublic(p: IShopProduct | (Record<string, unknown> & { _id: unknown })): PublicProduct {
  const x = p as unknown as IShopProduct;
  const sizes = (x.sizes || []).map((s) => ({ label: String(s.label), stock: Math.max(0, Number(s.stock) || 0) }));
  return {
    _id: String(x._id), name: x.name, slug: x.slug, kind: x.kind || "other", tagline: x.tagline || "",
    description: x.description || "", price: x.price, compareAtPrice: x.compareAtPrice || 0,
    images: x.images || [], model3d: x.model3d || "",
    colors: (x.colors || []).map((c) => ({ name: String(c.name || ""), hex: String(c.hex || "#111111") })),
    sizes, tone: x.tone === "dark" ? "dark" : "light", featured: !!x.featured,
    soldOut: sizes.length ? sizes.every((s) => s.stock <= 0) : false,
  };
}

/** AQ-7K2M9QXD — төөрөгдүүлэх тэмдэгтгүй (0/O, 1/I) 8 тэмдэгт. */
export function newOrderNo(): string {
  const A = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const b = randomBytes(8);
  return "AQ-" + Array.from(b, (v) => A[v % A.length]).join("");
}

export function slugify(s: string): string {
  const base = s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9а-яөүё]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60);
  return base || "item-" + randomBytes(3).toString("hex");
}

/**
 * pending → paid атомик шилжилт + үлдэгдэл хасах. Шилжилтийг ЗӨВХӨН
 * нэг дуудлага хийж чадна (findOneAndUpdate status:pending нөхцөлтэй),
 * тиймээс үлдэгдэл давхар хасагдахгүй.
 */
export async function markOrderPaid(orderNo: string): Promise<boolean> {
  const o = await ShopOrder.findOneAndUpdate(
    { orderNo, status: "pending" },
    { $set: { status: "paid", paidAt: new Date() } },
    { new: true }
  );
  if (!o) return false;
  for (const it of o.items) {
    if (!it.product || !mongoose.isValidObjectId(it.product)) continue;
    await ShopProduct.updateOne(
      { _id: it.product, "sizes.label": it.size },
      { $inc: { "sizes.$.stock": -Math.abs(it.qty) } }
    ).catch(() => {});
  }
  return true;
}
