import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import SiteSettings from "@/models/SiteSettings";

// ─── Public maintenance notice ───
// Read by the banner in the root layout. It is its own tiny endpoint rather
// than a DB read inside layout.tsx on purpose: the root layout wraps every
// page on the site, and an await in there would opt the WHOLE app out of
// static rendering to show a strip that is switched off almost all the time.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await dbConnect();
    const rows = await SiteSettings.find({
      key: { $in: ["maintenance_on", "maintenance_text"] },
    }).lean();

    const map: Record<string, string> = {};
    for (const r of rows as unknown as { key: string; value: string }[]) {
      map[r.key] = r.value ?? "";
    }

    const on = map.maintenance_on === "1";
    const text = (map.maintenance_text || "").trim() ||
      "Сайт засвартай байна. Зарим хэсэг түр ажиллахгүй байж болно.";

    return NextResponse.json(
      { on, text },
      { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" } }
    );
  } catch {
    // A settings lookup failing must never take the site's banner slot down
    // with it — no notice is the correct fallback, not an error.
    return NextResponse.json({ on: false, text: "" });
  }
}
