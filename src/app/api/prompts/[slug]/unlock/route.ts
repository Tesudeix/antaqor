import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import PromptPost from "@/models/PromptPost";
import PromptUnlock from "@/models/PromptUnlock";
import { spendCredits } from "@/lib/credits";

export const dynamic = "force-dynamic";

/**
 * Unlock a pack with credits.
 *
 * Order matters: the unlock row is written FIRST, and its unique index on
 * (userId, slug) is what makes a double-click or a retry harmless. Only once
 * that insert wins do we spend — and if the spend fails, the row is removed so
 * the person is not left holding an unpaid unlock.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Нэвтэрч орно уу.", needAuth: true }, { status: 401 });
  }
  const userId = (session.user as { id?: string }).id || "";
  if (!userId) return NextResponse.json({ error: "Хэрэглэгч танигдсангүй." }, { status: 401 });

  const { slug } = await params;
  await dbConnect();

  const post = await PromptPost.findOne({ slug: slug.toLowerCase(), published: true })
    .select("slug title creditPrice")
    .lean<{ slug: string; title: string; creditPrice?: number } | null>();
  if (!post) return NextResponse.json({ error: "Багц олдсонгүй." }, { status: 404 });

  const price = Number(post.creditPrice || 0);
  if (price <= 0) {
    return NextResponse.json({ error: "Энэ багц креditээр зарагддаггүй." }, { status: 400 });
  }

  const already = await PromptUnlock.findOne({ userId, slug: post.slug }).lean();
  if (already) {
    return NextResponse.json({ ok: true, already: true });
  }

  let claimed = false;
  try {
    await PromptUnlock.create({ userId, slug: post.slug, spent: price });
    claimed = true;
  } catch {
    // Unique index tripped — a parallel request already unlocked it. Nothing
    // to charge, nothing to undo.
    return NextResponse.json({ ok: true, already: true });
  }

  const res = await spendCredits({
    userId,
    amount: price,
    reason: "PROMPT_UNLOCK",
    ref: post.slug,
    meta: { title: post.title },
  });

  if (!res.ok) {
    if (claimed) await PromptUnlock.deleteOne({ userId, slug: post.slug }).catch(() => {});
    return NextResponse.json(
      { error: `Кредит хүрэлцэхгүй байна. Шаардлагатай: ${res.required}`, balance: res.balance, required: res.required },
      { status: 402 }
    );
  }

  return NextResponse.json({ ok: true, balance: res.balance, spent: price });
}
