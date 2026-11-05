import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import ShopProduct from "@/models/ShopProduct";
import { toPublic } from "@/lib/shop";

/* GET /api/shop/products — нийтэд нээлттэй каталог (идэвхтэй бараа). */
export const dynamic = "force-dynamic";

export async function GET() {
  await dbConnect();
  const rows = await ShopProduct.find({ active: true }).sort({ sort: -1, createdAt: -1 }).lean();
  return NextResponse.json(
    { products: rows.map((r) => toPublic(r as never)) },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } }
  );
}
