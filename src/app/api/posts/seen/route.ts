import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";

export const dynamic = "force-dynamic";

// Постын "үзсэн" тоолуур — feed дээр харагдмагц client нэг удаа илгээнэ.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { ids?: unknown } | null;
  const ids = Array.isArray(b?.ids)
    ? (b.ids as unknown[]).map(String).filter((s) => /^[a-f0-9]{24}$/.test(s)).slice(0, 30)
    : [];
  if (ids.length === 0) return NextResponse.json({ ok: true, counted: 0 });
  await dbConnect();
  await Post.updateMany({ _id: { $in: ids } }, { $inc: { viewsCount: 1 } });
  return NextResponse.json({ ok: true, counted: ids.length });
}
