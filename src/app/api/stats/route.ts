import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

const GOAL = 10000;

export async function GET() {
  try {
    await dbConnect();

    const now = new Date();

    const [totalUsers, paidMembers] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({
        clan: { $ne: "" },
        $or: [
          { subscriptionExpiresAt: { $gte: now } },
          { subscriptionExpiresAt: { $exists: false } },
        ],
      }),
    ]);

    return NextResponse.json(
      {
        totalUsers,
        paidMembers,
        aiConquerors: paidMembers,
        goal: GOAL,
        progress: Math.min((paidMembers / GOAL) * 100, 100),
      },
      {
        headers: {
          "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
