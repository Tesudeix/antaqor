import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import KhuushuurItem from "@/models/KhuushuurItem";
import { ensureKhSeed, toPublicKh, KH_CATEGORIES, KH_DELIVERY_FEE, KH_FREE_OVER } from "@/lib/khuushuur";

/* GET /api/khuushuur/items — нийтэд нээлттэй цэс (идэвхтэй бараа) + хүргэлтийн нөхцөл. */
export const dynamic = "force-dynamic";

export async function GET() {
  await dbConnect();
  await ensureKhSeed();
  const rows = await KhuushuurItem.find({ active: true }).sort({ sort: -1, createdAt: 1 }).lean();
  return NextResponse.json(
    {
      categories: KH_CATEGORIES,
      items: rows.map((r) => toPublicKh(r as unknown as Record<string, unknown>)),
      delivery: { fee: KH_DELIVERY_FEE, freeOver: KH_FREE_OVER },
    },
    { headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=60" } }
  );
}
