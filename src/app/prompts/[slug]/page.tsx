import type { Metadata } from "next";
import PromptCarousel from "@/components/PromptCarousel";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `Prompt багц — Antaqor`,
    description: "Хуулаад л ажиллуулах бэлэн prompt-ууд. Carousel хэлбэрээр.",
    alternates: { canonical: `https://antaqor.com/prompts/${slug}` },
  };
}

export default async function PromptPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <PromptCarousel slug={slug} />;
}
