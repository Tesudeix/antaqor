import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Comment from "@/models/Comment";
import "@/models/Post";

export const dynamic = "force-dynamic";

/* GET /api/users/[id]/replies — профайлын "Хариулт" таб (2026-10-11).
   Хэрэглэгчийн сүүлийн 30 сэтгэгдэл + аль постод бичсэн нь. Постууд
   гишүүдэд зориулагдсан тул нэвтрээгүй хүнд хоосон. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ replies: [] });
  const { id } = await params;
  if (!mongoose.Types.ObjectId.isValid(id)) return NextResponse.json({ replies: [] });
  await dbConnect();
  const rows = await Comment.find({ author: id })
    .sort({ createdAt: -1 })
    .limit(30)
    .populate({ path: "post", select: "content author", populate: { path: "author", select: "name username" } })
    .lean();
  const replies = rows
    .filter((c) => c.post)
    .map((c) => {
      const p = c.post as unknown as { _id: unknown; content?: string; author?: { name?: string; username?: string } };
      return {
        _id: String(c._id),
        content: c.content,
        createdAt: (c as unknown as { createdAt: Date }).createdAt,
        post: { _id: String(p._id), excerpt: (p.content || "").slice(0, 120), author: p.author?.username || p.author?.name || "" },
      };
    });
  return NextResponse.json({ replies });
}
