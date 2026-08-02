import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

// Public endpoint — Conqueror roster.
// Returns every clan-joined paid member, sorted ASC by clanJoinedAt so the
// `mintNumber` assigned here is stable (#001 = the earliest joiner).
export async function GET() {
  try {
    await dbConnect();

    const now = new Date();
    const rows = await User.find({
      clan: { $ne: "" },
      subscriptionExpiresAt: { $gt: now },
    })
      .select("name avatar bio email clan clanJoinedAt createdAt xp level")
      .sort({ clanJoinedAt: 1, createdAt: 1, _id: 1 })
      .lean();

    const members = rows.map((m, i) => ({
      ...m,
      mintNumber: i + 1,
    }));

    return NextResponse.json({
      members,
      totalMembers: members.length,
      totalMinted: members.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch members";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
