import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export async function GET() {
  try {
    await dbConnect();

    const topUsers = await User.find({ xp: { $gt: 0 } })
      .sort({ xp: -1 })
      .limit(10)
      .select("name avatar xp level")
      .lean();

    return NextResponse.json({ users: topUsers });
  } catch {
    return NextResponse.json({ users: [] });
  }
}

export const dynamic = "force-dynamic";
