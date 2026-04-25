import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import News from "@/models/News";
import NewsComment from "@/models/NewsComment";
import User from "@/models/User";

const SUPER_ADMIN_EMAILS = ["antaqor@gmail.com"];

async function resolveNewsId(slugRaw: string) {
  let decoded = slugRaw;
  try { decoded = decodeURIComponent(slugRaw); } catch {}
  const candidates = Array.from(new Set([decoded.toLowerCase(), slugRaw.toLowerCase()]));
  return News.findOne({ slug: { $in: candidates }, published: true }).select("_id").lean();
}

// GET — public list of comments for an article
export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    await dbConnect();
    const news = await resolveNewsId(slug);
    if (!news) return NextResponse.json({ comments: [] });

    const comments = await NewsComment.find({ news: news._id })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("author", "name avatar clan")
      .lean();
    return NextResponse.json({ comments });
  } catch {
    return NextResponse.json({ comments: [] }, { status: 200 });
  }
}

// POST — members-only (paid clan member or admin)
export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });

    await dbConnect();
    const userId = (session.user as { id: string }).id;
    const email = (session.user.email || "").toLowerCase();
    const user = await User.findById(userId).select("clan role").lean();

    const isSuper = SUPER_ADMIN_EMAILS.includes(email);
    const isClan = !!user?.clan;
    const isUserAdmin = user?.role === "admin" || isSuper;
    if (!isClan && !isUserAdmin) {
      return NextResponse.json({ error: "Гишүүд л сэтгэгдэл бичих боломжтой" }, { status: 403 });
    }

    const { content } = await req.json();
    if (!content || typeof content !== "string" || !content.trim()) {
      return NextResponse.json({ error: "Сэтгэгдэл хоосон байж болохгүй" }, { status: 400 });
    }
    const trimmed = content.trim().slice(0, 1000);

    const { slug } = await params;
    const news = await resolveNewsId(slug);
    if (!news) return NextResponse.json({ error: "Нийтлэл олдсонгүй" }, { status: 404 });

    const created = await NewsComment.create({ news: news._id, author: userId, content: trimmed });
    const populated = await NewsComment.findById(created._id).populate("author", "name avatar clan").lean();
    return NextResponse.json({ comment: populated }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
