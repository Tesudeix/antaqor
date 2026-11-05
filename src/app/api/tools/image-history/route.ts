import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Types } from "mongoose";
import { unlink } from "fs/promises";
import path from "path";
import dbConnect from "@/lib/mongodb";
import AiImage from "@/models/AiImage";

// GET — my image history (newest first). Failed attempts are excluded: the
// member already saw the error and got the refund; the gallery is for work.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "40", 10) || 40));
  const before = searchParams.get("before");

  await dbConnect();
  const q: Record<string, unknown> = { user: userId, status: "done", deletedAt: { $exists: false } };
  if (before && Types.ObjectId.isValid(before)) q._id = { $lt: new Types.ObjectId(before) };

  const [items, stats] = await Promise.all([
    AiImage.find(q)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("prompt modelId modelVersion aspectRatio resolution url cost createdAt sharedPostId refCount")
      .lean(),
    AiImage.aggregate([
      { $match: { user: new Types.ObjectId(userId), status: "done" } },
      { $group: { _id: null, count: { $sum: 1 }, credits: { $sum: "$cost" } } },
    ]),
  ]);

  return NextResponse.json({
    items: items.map((i) => ({
      _id: String(i._id),
      prompt: i.prompt,
      model: i.modelId,
      modelVersion: i.modelVersion,
      aspectRatio: i.aspectRatio,
      resolution: i.resolution,
      url: i.url,
      cost: i.cost,
      refCount: i.refCount,
      shared: !!i.sharedPostId,
      createdAt: i.createdAt,
    })),
    total: stats[0]?.count || 0,
    creditsSpent: stats[0]?.credits || 0,
    nextBefore: items.length === limit ? String(items[items.length - 1]._id) : null,
  });
}

// DELETE ?id= — remove one of MY images (soft-delete the row, unlink the file).
// The row stays (deletedAt) so admin cost reports still reconcile.
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const id = new URL(req.url).searchParams.get("id") || "";
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  await dbConnect();
  const img = await AiImage.findOne({ _id: id, user: userId });
  if (!img) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  if (img.deletedAt) return NextResponse.json({ ok: true });

  // Shared to the feed? Keep the file — the post still points at it.
  if (!img.sharedPostId && img.url.startsWith("/uploads/")) {
    const file = path.join(process.cwd(), "public", img.url.replace(/^\//, ""));
    await unlink(file).catch(() => {});
  }
  img.deletedAt = new Date();
  await img.save();
  return NextResponse.json({ ok: true });
}

// PATCH — mark an image as shared (called by the page after POST /api/posts).
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const body = (await req.json().catch(() => ({}))) as { id?: string; postId?: string };
  if (!Types.ObjectId.isValid(body.id || "") || !Types.ObjectId.isValid(body.postId || "")) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }
  await dbConnect();
  await AiImage.updateOne({ _id: body.id, user: userId }, { $set: { sharedPostId: body.postId } });
  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
