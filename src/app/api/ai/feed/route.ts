import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import AiCreation from "@/models/AiCreation";

export const dynamic = "force-dynamic";

// Social feed of AI creations. Public "done" videos for everyone; your own
// (any status, incl. processing) are always in your feed.
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    let me: { _id: unknown; credits?: number } | null = null;
    if (session?.user?.email) {
      me = await User.findOne({ email: session.user.email.toLowerCase() }).select("credits").lean();
    }

    const sp = req.nextUrl.searchParams;
    const scope = sp.get("scope") === "mine" ? "mine" : "all";
    const before = sp.get("before");
    const limit = Math.min(30, Math.max(6, Number(sp.get("limit")) || 18));

    const query: Record<string, unknown> = {};
    if (scope === "mine") {
      if (!me) return NextResponse.json({ items: [], hasMore: false, credits: null });
      query.user = me._id;
    } else {
      query.$or = me
        ? [{ isPublic: true, status: "done" }, { user: me._id }]
        : [{ isPublic: true, status: "done" }];
    }
    if (before) query.createdAt = { $lt: new Date(before) };

    const docs = await AiCreation.find(query)
      .select("-fullPrompt -taskId")
      .sort({ createdAt: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = docs.length > limit;
    const myId = me ? String(me._id) : "";
    const items = docs.slice(0, limit).map((d) => ({
      ...d,
      likes: undefined,
      liked: myId ? (d.likes || []).includes(myId) : false,
      mine: myId ? String(d.user) === myId : false,
    }));

    return NextResponse.json({ items, hasMore, credits: me?.credits ?? null });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Серверийн алдаа";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
