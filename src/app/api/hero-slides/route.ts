import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import HeroSlide from "@/models/HeroSlide";

export const dynamic = "force-dynamic";

// Нүүрний идэвхтэй слайдууд — олон нийтэд нээлттэй, богино кэштэй.
export async function GET() {
  try {
    await dbConnect();
    const slides = await HeroSlide.find({ active: true }).sort({ order: 1, createdAt: 1 }).lean();
    return NextResponse.json(
      {
        slides: slides.map((s) => ({
          id: String(s._id),
          chrome: s.chrome,
          line1: s.line1,
          line2: s.line2,
          sub: s.sub,
          ctaLabel: s.ctaLabel,
          ctaHref: s.ctaHref,
          image: s.image,
          layout: s.layout || "split",
        })),
      },
      { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch {
    return NextResponse.json({ slides: [] });
  }
}
