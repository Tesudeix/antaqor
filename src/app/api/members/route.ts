import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export async function GET() {
  try {
    await dbConnect();

    const now = new Date();
    const members = await User.find({
      clan: { $ne: "" },
      subscriptionExpiresAt: { $gt: now },
    })
      .select("name avatar bio email clan clanJoinedAt createdAt xp level")
      .sort({ clanJoinedAt: -1 })
      .lean();

    const totalMembers = members.length;

    return NextResponse.json({ members, totalMembers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch members";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
