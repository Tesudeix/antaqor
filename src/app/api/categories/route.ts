import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Category from "@/models/Category";

// Per-category icon SVG path (24×24 viewBox). Stored on the Category
// record so admins can add custom icons for new categories.
const DEFAULT_CATEGORIES = [
  {
    slug: "мэдээлэл", name: "мэдээлэл", color: "#2E29FF", order: 0,
    iconPath: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2M7 8h6M7 12h6M7 16h4",
  },
  {
    slug: "ялалт", name: "ялалт", color: "#2E29FF", order: 1,
    iconPath: "M12 15a4 4 0 004-4V4H8v7a4 4 0 004 4zm0 0v3m0 0H8m4 0h4M5 4h3m8 0h3m-3 3a3 3 0 003-3m-14 0a3 3 0 003 3",
  },
  {
    slug: "промт", name: "промт", color: "#2E29FF", order: 2,
    iconPath: "M8 9l-3 3 3 3m8-6l3 3-3 3M14 5l-4 14",
  },
  {
    slug: "бүтээл", name: "бүтээл", color: "#2E29FF", order: 3,
    iconPath: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  },
];

async function ensureDefaults() {
  for (const c of DEFAULT_CATEGORIES) {
    // Insert if missing.
    await Category.updateOne(
      { slug: c.slug },
      { $setOnInsert: c },
      { upsert: true }
    );
    // Backfill iconPath on existing rows that don't have one yet
    // (categories were seeded earlier without iconPath).
    await Category.updateOne(
      { slug: c.slug, $or: [{ iconPath: { $exists: false } }, { iconPath: "" }] },
      { $set: { iconPath: c.iconPath } }
    );
  }
}

export async function GET() {
  try {
    await dbConnect();
    await ensureDefaults();
    const rows = await Category.find().sort({ order: 1 }).lean();
    /* `.lean()` skips mongoose hydration, so schema defaults are NOT applied
       on read — a row written straight into Mongo without `color` comes back
       without it. The composer tinted its category chip from that value and
       crashed the whole page on a colourless category. Normalise here so no
       consumer has to defend against a half-filled row. */
    const categories = rows.map((c) => ({
      ...c,
      color: typeof c.color === "string" && c.color.trim() ? c.color : "#2E29FF",
      iconPath: typeof c.iconPath === "string" ? c.iconPath : "",
    }));
    return NextResponse.json({ categories });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load categories";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
