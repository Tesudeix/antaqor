import type { Metadata } from "next";
import CircleRoom from "@/components/CircleRoom";
import dbConnect from "@/lib/mongodb";
import Circle from "@/models/Circle";

/* Хуваалцсан холбоос нь хүрээллийн нэрийг харуулна — өмнө нь бүх
   хүрээлэл ижил ерөнхий гарчигтай байв. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    await dbConnect();
    const c = await Circle.findOne({ slug, published: true }).select("name tagline desc").lean();
    if (!c) return { title: "Хүрээлэл" };
    const d = c as unknown as { name: string; tagline?: string; desc?: string };
    return { title: d.name, description: d.tagline || d.desc || undefined };
  } catch {
    return { title: "Хүрээлэл" };
  }
}

export default async function CirclePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <CircleRoom slug={slug} />;
}
