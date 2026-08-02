import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import InfluencerCollab from "@/models/InfluencerCollab";

// GET — admin lists brand collaboration leads. Optional ?status= filter.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  try {
    await dbConnect();
    const status = req.nextUrl.searchParams.get("status");
    const q: Record<string, unknown> = {};
    if (status && status !== "all") q.status = status;
    const collabs = await InfluencerCollab.find(q)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
    const counts = await InfluencerCollab.aggregate([
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]);
    return NextResponse.json({ collabs, counts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
