import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export async function GET() {
  try {
    await dbConnect();

    const members = await User.find({ clan: { $ne: "" } })
      .select("name avatar bio clan clanJoinedAt createdAt")
      .sort({ clanJoinedAt: -1 })
      .lean();

    const totalMembers = members.length;

    return NextResponse.json({ members, totalMembers });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch members";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
