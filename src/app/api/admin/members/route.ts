import { NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const filter = searchParams.get("filter") || "all";

    const conditions: Record<string, unknown>[] = [];

    if (search) {
      conditions.push({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ],
      });
    }

    if (filter === "members") {
      conditions.push({ clan: { $ne: "" } });
    } else if (filter === "non-members") {
      conditions.push({ $or: [{ clan: "" }, { clan: null }, { clan: { $exists: false } }] });
    } else if (filter === "expired") {
      conditions.push({ clan: { $ne: "" } });
      conditions.push({ subscriptionExpiresAt: { $lt: new Date() } });
    }

    const query = conditions.length > 0 ? { $and: conditions } : {};

    const users = await User.find(query)
      .select("name email avatar bio clan clanJoinedAt subscriptionExpiresAt createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const totalUsers = await User.countDocuments();
    const totalMembers = await User.countDocuments({ clan: { $ne: "" } });

    return NextResponse.json({
      users,
      totalUsers,
      totalMembers,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Серверийн алдаа";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
