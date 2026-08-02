import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import AiCreation from "@/models/AiCreation";

// POST — toggle like on a creation.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
    const me = await User.findOne({ email: session.user.email.toLowerCase() }).select("_id").lean();
    if (!me) return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });

    const { id } = await params;
    const creation = await AiCreation.findById(id).select("likes likeCount isPublic user");
    if (!creation) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });

    const uid = String(me._id);
    const liked = creation.likes.includes(uid);
    if (liked) creation.likes = creation.likes.filter((x) => x !== uid);
    else creation.likes.push(uid);
    creation.likeCount = creation.likes.length;
    await creation.save();

    return NextResponse.json({ liked: !liked, likeCount: creation.likeCount });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Серверийн алдаа";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
