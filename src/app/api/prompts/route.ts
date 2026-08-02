import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import PromptPost from "@/models/PromptPost";

export const dynamic = "force-dynamic";

// Нийтэд нээлттэй жагсаалт — share хийхэд нэвтрэлт шаардахгүй.
export async function GET() {
  await dbConnect();
  const posts = await PromptPost.find({ published: true })
    .sort({ createdAt: -1 })
    .select("title slug description requiredPlan freeSlides slides copiesCount")
    .lean();
  return NextResponse.json({
    posts: posts.map((p) => ({
      slug: p.slug,
      title: p.title,
      description: p.description,
      requiredPlan: p.requiredPlan,
      slideCount: (p.slides as unknown[]).length,
      freeSlides: p.freeSlides,
      copiesCount: p.copiesCount,
    })),
  });
}
