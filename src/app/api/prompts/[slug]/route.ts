import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import PromptPost from "@/models/PromptPost";
import { effectivePlan } from "@/lib/planAccess";
import { hasPlanAccess, isPlanId, type PlanId } from "@/lib/plans";
import PromptUnlock from "@/models/PromptUnlock";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Нэг багцын слайдууд. freeSlides хүртэлх нь хэнд ч нээлттэй; цаашихыг
// requiredPlan-тай хэрэглэгчид л prompt текстээр нь авна — бусдад locked
// слайд (гарчиг + upgrade CTA) очно. Prompt текст server талд хамгаалагдана.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  await dbConnect();
  const post = await PromptPost.findOne({ slug: slug.toLowerCase(), published: true }).lean();
  if (!post) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { plan: viewerPlan } = await effectivePlan();
  const requiredPlan: PlanId = isPlanId(post.requiredPlan) ? post.requiredPlan : "free";

  // A credit unlock is a purchase, not a subscription: it outlives a lapsed
  // plan, so it is checked alongside plan access rather than inside it.
  const session = await getServerSession(authOptions);
  const viewerId = (session?.user as { id?: string } | undefined)?.id || "";
  const unlocked = viewerId
    ? Boolean(await PromptUnlock.findOne({ userId: viewerId, slug: post.slug }).lean())
    : false;

  const hasAccess = hasPlanAccess(viewerPlan, requiredPlan) || unlocked;

  const slides = (post.slides as { title?: string; prompt: string }[]).map((s, i) => {
    const open = hasAccess || i < post.freeSlides;
    return open
      ? { title: s.title ?? "", prompt: s.prompt, locked: false }
      : { title: s.title ?? "", prompt: null, locked: true };
  });

  return NextResponse.json({
    post: {
      slug: post.slug,
      title: post.title,
      description: post.description,
      requiredPlan,
      freeSlides: post.freeSlides,
      copiesCount: post.copiesCount,
      coverImage: post.coverImage || "",
      category: post.category || "text",
      tags: post.tags || [],
      creditPrice: Number(post.creditPrice || 0),
      slides,
    },
    viewerPlan,
    unlocked,
    signedIn: Boolean(viewerId),
  });
}

// Хөнгөн analytics: copy/share тоолуур.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const body = (await req.json().catch(() => null)) as { action?: string } | null;
  const field =
    body?.action === "share" ? "sharesCount" : body?.action === "copy" ? "copiesCount" : null;
  if (!field) return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  await dbConnect();
  await PromptPost.updateOne({ slug: slug.toLowerCase() }, { $inc: { [field]: 1 } });
  return NextResponse.json({ ok: true });
}
