import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import CompanionDoc from "@/models/CompanionDoc";
import Post from "@/models/Post";
import User from "@/models/User";
import { embedPending } from "@/lib/vectorIndex";

export const dynamic = "force-dynamic";

/* POST — эзний (нэвтэрсэн админы) өөрийн постуудыг "voice" жишээ болгон
   импортлоно. Давхардлыг sourceId (post id)-аар алгасна. */
export async function POST() {
  const s = await getServerSession(authOptions);
  if (!s?.user || !isAdmin(s.user.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await dbConnect();
  const me = await User.findOne({ email: s.user.email }).select("_id").lean();
  if (!me) return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });
  const posts = await Post.find({ author: me._id }).select("content").sort({ createdAt: -1 }).limit(400).lean();
  const have = new Set((await CompanionDoc.find({ kind: "voice", source: "Миний постууд" }).select("sourceId").lean()).map((d) => d.sourceId));
  const rows = posts
    .map((p) => ({ id: String(p._id), text: String((p as { content?: string }).content || "").trim() }))
    .filter((p) => p.text.length >= 40 && !have.has(p.id))
    .map((p) => ({ kind: "voice" as const, source: "Миний постууд", sourceId: p.id, text: p.text.slice(0, 1400) }));
  if (rows.length) { await CompanionDoc.insertMany(rows); await embedPending().catch(() => null); }
  return NextResponse.json({ ok: true, imported: rows.length, scanned: posts.length });
}
