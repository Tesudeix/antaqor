import type { Metadata } from "next";
import PromptCarousel from "@/components/PromptCarousel";
import dbConnect from "@/lib/mongodb";
import PromptPost from "@/models/PromptPost";

const SITE = "https://antaqor.com";

/**
 * Per-pack share card.
 *
 * The generic title that used to sit here meant every shared prompt looked
 * identical in a feed — the whole point of a magnet is that the card sells the
 * specific thing. `coverImage` is authored at 1.91:1, the ratio Facebook,
 * LinkedIn and Threads all crop link previews to, so it survives every surface
 * uncropped.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const url = `${SITE}/prompts/${slug}`;

  let post: { title?: string; description?: string; coverImage?: string; slides?: unknown[] } | null = null;
  try {
    await dbConnect();
    post = await PromptPost.findOne({ slug: slug.toLowerCase(), published: true })
      .select("title description coverImage slides")
      .lean<{ title?: string; description?: string; coverImage?: string; slides?: unknown[] } | null>();
  } catch {
    // Metadata must never take the page down — fall through to the generic card.
  }

  if (!post) {
    return {
      title: "Prompt багц — Antaqor",
      description: "Хуулаад л ажиллуулах бэлэн prompt-ууд.",
      alternates: { canonical: url },
    };
  }

  const title = `${post.title} — Antaqor`;
  const description =
    (post.description || "").trim() ||
    `${(post.slides || []).length} бэлэн prompt. Хуулаад л ажиллуулна.`;
  const image = post.coverImage
    ? post.coverImage.startsWith("http")
      ? post.coverImage
      : `${SITE}${post.coverImage}`
    : `${SITE}/brand/cover`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title,
      description,
      siteName: "Antaqor",
      images: [{ url: image, width: 1200, height: 628, alt: post.title || "" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
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
