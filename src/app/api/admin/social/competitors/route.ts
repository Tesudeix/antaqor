import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import { Competitor, CompetitorPost } from "@/models/Competitor";
import { SocialPlaybook } from "@/models/SocialInsight";
import { syncCompetitor, analyzePost, summarize, cleanHandle } from "@/lib/competitors";

/* /api/admin/social/competitors
   GET                         — жагсаалт + шилдэг постууд (ER-ээр) + дүгнэлт
   POST {action:"add",platform,handle}            — нэмээд шууд татна
   POST {action:"sync",id}                         — дахин татах
   POST {action:"manual",platform,handle,url,caption,likes,comments,followers} — гараар
   POST {action:"analyze",postId}                  — нэг постыг задлах
   POST {action:"summary"}                         — нийт дүгнэлт + зай (gap)
   DELETE ?id=                                     — өрсөлдөгч + постууд устгах */
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const PLATFORMS = ["instagram", "threads", "facebook"];

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  await dbConnect();
  const only = req.nextUrl.searchParams.get("competitor");
  const q = only && mongoose.isValidObjectId(only) ? { competitor: only } : {};
  const [list, posts, sum] = await Promise.all([
    Competitor.find({}).sort({ createdAt: 1 }).lean(),
    CompetitorPost.find(q).sort({ er: -1, score: -1 }).limit(36).lean(),
    SocialPlaybook.findOne({ key: "competitors" }).lean(),
  ]);
  const counts = await CompetitorPost.aggregate([{ $group: { _id: "$competitor", n: { $sum: 1 }, avgEr: { $avg: "$er" } } }]);
  const cm = new Map(counts.map((c) => [String(c._id), c]));
  return NextResponse.json({
    competitors: list.map((c) => ({ ...c, _id: String(c._id), posts: cm.get(String(c._id))?.n || 0, avgEr: Math.round((cm.get(String(c._id))?.avgEr || 0) * 10) / 10 })),
    posts: posts.map((p) => ({ ...p, _id: String(p._id), competitor: String(p.competitor) })),
    summary: sum,
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  await dbConnect();
  const b = await req.json().catch(() => ({}));
  try {
    if (b.action === "add") {
      const platform = String(b.platform), handle = cleanHandle(b.handle);
      if (!PLATFORMS.includes(platform) || !handle) return NextResponse.json({ error: "Платформ, хаяг шаардлагатай" }, { status: 400 });
      if ((await Competitor.countDocuments()) >= 20) return NextResponse.json({ error: "20 өрсөлдөгчөөс их нэмэх боломжгүй" }, { status: 400 });
      const c = await Competitor.findOneAndUpdate({ platform, handle }, { $setOnInsert: { platform, handle } }, { upsert: true, new: true });
      const error = await syncCompetitor(c);
      return NextResponse.json({ ok: true, error });
    }
    if (b.action === "sync") {
      const c = await Competitor.findById(String(b.id));
      if (!c) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
      return NextResponse.json({ ok: true, error: await syncCompetitor(c) });
    }
    if (b.action === "manual") {
      const platform = PLATFORMS.includes(String(b.platform)) ? String(b.platform) : "facebook";
      const handle = cleanHandle(b.handle) || "гараар";
      const caption = String(b.caption || "").slice(0, 4000);
      if (caption.length < 10) return NextResponse.json({ error: "Постын текстийг хуулж оруулна уу" }, { status: 400 });
      const c = await Competitor.findOneAndUpdate({ platform, handle }, { $setOnInsert: { platform, handle, name: handle } }, { upsert: true, new: true });
      const followers = Math.max(0, Number(b.followers) || c.followers || 0);
      if (followers && !c.followers) { c.followers = followers; await c.save(); }
      const likes = Math.max(0, Number(b.likes) || 0), comments = Math.max(0, Number(b.comments) || 0), s = likes + 2 * comments;
      const url = String(b.url || "").slice(0, 400);
      const p = await CompetitorPost.create({
        competitor: c._id, platform, handle, externalId: `man_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        caption, mediaType: String(b.mediaType || "").slice(0, 20), permalink: /^https?:\/\//.test(url) ? url : "", postedAt: new Date(),
        likes, comments, score: s, er: followers ? Math.round((s / followers) * 10000) / 10 : 0, manual: true,
      });
      const analysis = await analyzePost(String(p._id)).catch(() => null);
      return NextResponse.json({ ok: true, id: String(p._id), analysis });
    }
    if (b.action === "analyze") return NextResponse.json({ analysis: await analyzePost(String(b.postId)) });
    if (b.action === "summary") return NextResponse.json({ summary: await summarize() });
    return NextResponse.json({ error: "action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Алдаа" }, { status: 502 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  await dbConnect();
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!mongoose.isValidObjectId(id)) return NextResponse.json({ error: "id" }, { status: 400 });
  await Promise.all([Competitor.deleteOne({ _id: id }), CompetitorPost.deleteMany({ competitor: id })]);
  return NextResponse.json({ ok: true });
}
