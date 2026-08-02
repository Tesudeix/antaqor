import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import SiteSettings from "@/models/SiteSettings";

export const dynamic = "force-dynamic";

// Footer-ийн сошиал линкүүд — админ /admin/hero дээрээс удирдана.
// SiteSettings key "social_links" = JSON [{label, href}].
export async function GET() {
  try {
    await dbConnect();
    const row = await SiteSettings.findOne({ key: "social_links" }).lean();
    let links: { label: string; href: string }[] = [];
    try {
      const parsed = JSON.parse(row?.value || "[]");
      if (Array.isArray(parsed)) {
        links = parsed
          .filter((l) => l && typeof l.label === "string" && typeof l.href === "string" && l.href.trim())
          .slice(0, 8)
          .map((l) => ({ label: String(l.label).slice(0, 30), href: String(l.href).slice(0, 300) }));
      }
    } catch {
      /* invalid JSON → defaults on the client */
    }
    return NextResponse.json(
      { links },
      { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch {
    return NextResponse.json({ links: [] });
  }
}
