import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import PostReply from "@/models/PostReply";
import { listMetaTargets } from "@/lib/socialPublish";
import PromptPost from "@/models/PromptPost";

export const dynamic = "force-dynamic";

const FB = "https://graph.facebook.com/v21.0";

async function gate() {
  const s = await getServerSession(authOptions);
  return s?.user && isAdmin(s.user.email) ? s : null;
}

type J = Record<string, unknown>;

async function gj(url: string): Promise<J> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    return (await r.json()) as J;
  } catch (e) {
    return { error: { message: String(e) } };
  }
}

interface PostLite {
  id: string;
  network: "facebook" | "instagram";
  caption: string;
  image: string;
  permalink: string;
  at: string;
}

function firstLine(s: string, n = 90): string {
  const t = (s || "").split("\n").find((x) => x.trim()) || "";
  return t.length > n ? t.slice(0, n) + "…" : t;
}

/**
 * Recent posts from both networks for one connected page, newest first.
 * The ids returned here are exactly what the comment webhook reports
 * (`post_id` on Facebook, `media.id` on Instagram), so a PostReply keyed on
 * them matches without any translation.
 */
async function recentPosts(pageId: string, igId: string, token: string): Promise<PostLite[]> {
  const out: PostLite[] = [];

  if (pageId) {
    const fb = await gj(
      `${FB}/${pageId}/posts?limit=25&fields=id,message,created_time,full_picture,permalink_url&access_token=${encodeURIComponent(token)}`
    );
    for (const p of (fb.data as J[]) || []) {
      out.push({
        id: String(p.id || ""),
        network: "facebook",
        caption: firstLine(String(p.message || "")),
        image: String(p.full_picture || ""),
        permalink: String(p.permalink_url || ""),
        at: String(p.created_time || ""),
      });
    }
  }

  if (igId) {
    const ig = await gj(
      `${FB}/${igId}/media?limit=25&fields=id,caption,media_url,thumbnail_url,permalink,timestamp&access_token=${encodeURIComponent(token)}`
    );
    for (const m of (ig.data as J[]) || []) {
      out.push({
        id: String(m.id || ""),
        network: "instagram",
        caption: firstLine(String(m.caption || "")),
        image: String(m.thumbnail_url || m.media_url || ""),
        permalink: String(m.permalink || ""),
        at: String(m.timestamp || ""),
      });
    }
  }

  return out.sort((a, b) => (a.at < b.at ? 1 : -1));
}

export async function GET(req: NextRequest) {
  if (!(await gate())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await dbConnect();

  const targets = await listMetaTargets();
  const accounts = targets.map((t) => ({ key: t.key, label: t.label }));
  const account = req.nextUrl.searchParams.get("account") || accounts[0]?.key || "";
  const target = targets.find((t) => t.key === account);

  const [replies, posts, prompts] = await Promise.all([
    PostReply.find({ account }).sort({ updatedAt: -1 }).lean(),
    target ? recentPosts(target.pageId, target.igId, target.pageToken) : Promise.resolve([]),
    // The lead-magnet library. Picking from it beats pasting a URL: the admin
    // sees which magnet is free vs paywalled, and the slug gets stored for
    // attribution instead of being buried inside a link.
    PromptPost.find({ published: true })
      .select("title slug description requiredPlan freeSlides slides copiesCount")
      .sort({ updatedAt: -1 })
      .lean<{ title: string; slug: string; description?: string; requiredPlan?: string;
              freeSlides?: number; slides?: unknown[]; copiesCount?: number }[]>(),
  ]);

  return NextResponse.json({
    accounts,
    account,
    replies,
    posts,
    prompts: prompts.map((x) => ({
      slug: x.slug,
      title: x.title,
      description: x.description || "",
      requiredPlan: x.requiredPlan || "free",
      freeSlides: x.freeSlides ?? 0,
      slideCount: (x.slides || []).length,
      copies: x.copiesCount || 0,
    })),
  });
}

export async function PUT(req: NextRequest) {
  const s = await gate();
  if (!s) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as J;

  const account = String(b.account || "").trim();
  const postId = String(b.postId || "").trim();
  if (!account || !postId) {
    return NextResponse.json({ error: "account болон postId шаардлагатай" }, { status: 400 });
  }

  const buttons = Array.isArray(b.buttons)
    ? (b.buttons as J[])
        .map((x) => ({ label: String(x.label || "").slice(0, 20), url: String(x.url || "").trim() }))
        .filter((x) => x.label && /^https?:\/\//i.test(x.url))
        .slice(0, 3)
    : [];

  await dbConnect();
  const doc = await PostReply.findOneAndUpdate(
    { account, postId },
    {
      $set: {
        label: String(b.label || "").slice(0, 140),
        dmText: String(b.dmText || "").slice(0, 1800),
        imageUrl: String(b.imageUrl || "").trim(),
        commentReply: String(b.commentReply || "").slice(0, 300),
        promptSlug: String(b.promptSlug || "").trim(),
        buttons,
        enabled: b.enabled !== false,
        createdByEmail: s.user?.email || "",
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return NextResponse.json({ ok: true, reply: doc });
}

export async function DELETE(req: NextRequest) {
  if (!(await gate())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const account = req.nextUrl.searchParams.get("account") || "";
  const postId = req.nextUrl.searchParams.get("postId") || "";
  if (!account || !postId) return NextResponse.json({ error: "account/postId" }, { status: 400 });
  await dbConnect();
  await PostReply.deleteOne({ account, postId });
  return NextResponse.json({ ok: true });
}
