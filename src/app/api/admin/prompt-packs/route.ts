import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import PromptPost, { PROMPT_CATEGORIES } from "@/models/PromptPost";
import PromptUnlock from "@/models/PromptUnlock";

export const dynamic = "force-dynamic";

async function gate() {
  const s = await getServerSession(authOptions);
  return s?.user && isAdmin(s.user.email) ? s : null;
}

type J = Record<string, unknown>;

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function GET() {
  if (!(await gate())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await dbConnect();

  const packs = await PromptPost.find({}).sort({ featured: -1, updatedAt: -1 }).lean();

  // Sales per pack, so the list answers "is this worth keeping" without a
  // separate analytics trip.
  const sold = await PromptUnlock.aggregate<{ _id: string; n: number; credits: number }>([
    { $group: { _id: "$slug", n: { $sum: 1 }, credits: { $sum: "$spent" } } },
  ]);
  const soldBy = Object.fromEntries(sold.map((x) => [x._id, { n: x.n, credits: x.credits }]));

  return NextResponse.json({
    categories: PROMPT_CATEGORIES,
    packs: packs.map((p) => ({
      _id: String(p._id),
      title: p.title,
      slug: p.slug,
      description: p.description || "",
      coverImage: p.coverImage || "",
      category: p.category || "text",
      featured: Boolean(p.featured),
      tags: p.tags || [],
      creditPrice: Number(p.creditPrice || 0),
      requiredPlan: p.requiredPlan || "free",
      freeSlides: p.freeSlides ?? 0,
      slides: p.slides || [],
      published: p.published !== false,
      copiesCount: p.copiesCount || 0,
      sold: soldBy[p.slug] || { n: 0, credits: 0 },
    })),
  });
}

export async function PUT(req: NextRequest) {
  if (!(await gate())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as J;

  const title = String(b.title || "").trim();
  if (!title) return NextResponse.json({ error: "Гарчиг шаардлагатай" }, { status: 400 });

  // The slug is the public URL and every share link already in the wild, so it
  // is derived once from the title and then never silently rewritten.
  const slug = slugify(String(b.slug || "") || title);
  if (!slug) return NextResponse.json({ error: "Slug гаргаж чадсангүй" }, { status: 400 });

  const slides = Array.isArray(b.slides)
    ? (b.slides as J[])
        .map((s) => ({ title: String(s.title || "").slice(0, 120), prompt: String(s.prompt || "").trim() }))
        .filter((s) => s.prompt)
    : [];
  if (!slides.length) return NextResponse.json({ error: "Дор хаяж нэг слайд хэрэгтэй" }, { status: 400 });

  const category = PROMPT_CATEGORIES.includes(b.category as never) ? (b.category as string) : "text";
  const freeSlides = Math.max(0, Math.min(Number(b.freeSlides ?? 2), slides.length));

  await dbConnect();

  // A different pack already owning this slug would silently hijack its URL.
  const clash = await PromptPost.findOne({ slug }).select("_id").lean<{ _id: unknown } | null>();
  if (clash && b._id && String(clash._id) !== String(b._id)) {
    return NextResponse.json({ error: `"${slug}" slug аль хэдийн ашиглагдсан байна` }, { status: 409 });
  }

  const doc = await PromptPost.findOneAndUpdate(
    { slug },
    {
      $set: {
        title,
        slug,
        description: String(b.description || "").slice(0, 500),
        coverImage: String(b.coverImage || "").trim(),
        category,
        featured: Boolean(b.featured),
        tags: Array.isArray(b.tags)
          ? (b.tags as unknown[]).map((t) => String(t).trim()).filter(Boolean).slice(0, 8)
          : String(b.tags || "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 8),
        creditPrice: Math.max(0, Number(b.creditPrice || 0)),
        requiredPlan: ["free", "starter", "builder", "operator"].includes(String(b.requiredPlan))
          ? String(b.requiredPlan)
          : "free",
        freeSlides,
        slides,
        published: b.published !== false,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return NextResponse.json({ ok: true, pack: { _id: String(doc._id), slug: doc.slug } });
}

export async function DELETE(req: NextRequest) {
  if (!(await gate())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ error: "slug" }, { status: 400 });
  await dbConnect();

  // Someone may have paid credits for this pack; deleting it outright would
  // take away what they bought. Unpublish instead.
  const sold = await PromptUnlock.countDocuments({ slug });
  if (sold > 0) {
    await PromptPost.updateOne({ slug }, { $set: { published: false } });
    return NextResponse.json({ ok: true, unpublished: true, sold });
  }
  await PromptPost.deleteOne({ slug });
  return NextResponse.json({ ok: true, deleted: true });
}
