import { NextResponse } from "next/server";
import { brandUrl, getBrand } from "@/lib/siteBrand";

/* /manifest.json — утсанд «Нүүр дэлгэцэнд нэмэх» үеийн апп-ын нэр, icon (2026-10-26:
   өмнө нь public/manifest.json статик байсан; одоо /admin/brand-аас засагдана). */
export const dynamic = "force-dynamic";

export async function GET() {
  const b = await getBrand();
  const icon = (name: string, sizes: string, purpose?: string) => ({ src: brandUrl(b, name), sizes, type: "image/png", ...(purpose ? { purpose } : {}) });
  return NextResponse.json(
    {
      id: "/",
      name: b.appName,
      short_name: b.shortName,
      description: b.description,
      start_url: "/",
      scope: "/",
      display: "standalone",
      background_color: "#F8F9FD",
      theme_color: "#F8F9FD",
      orientation: "portrait-primary",
      categories: ["social", "education", "productivity"],
      lang: "mn",
      icons: [
        icon("icon-32.png", "32x32"),
        icon("icon-192.png", "192x192", "any"),
        icon("maskable-192.png", "192x192", "maskable"),
        icon("icon-512.png", "512x512", "any"),
        icon("maskable-512.png", "512x512", "maskable"),
      ],
    },
    { headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=600" } }
  );
}
