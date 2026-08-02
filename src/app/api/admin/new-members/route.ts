import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export const dynamic = "force-dynamic";

// ─── Шинээр бүртгүүлсэн гишүүд — админ жагсаалт ───
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await dbConnect();

  const days = Math.min(90, Math.max(1, Number(req.nextUrl.searchParams.get("days")) || 7));
  const cutoff = new Date(Date.now() - days * 86400000);
  const now = new Date();

  const users = await User.find({ createdAt: { $gte: cutoff } })
    .sort({ createdAt: -1 })
    .limit(200)
    .select("name email phone avatar clan clanJoinedAt subscriptionExpiresAt plan createdAt")
    .lean();

  return NextResponse.json({
    days,
    count: users.length,
    members: users.map((u) => ({
      id: String(u._id),
      name: u.name || "—",
      email: u.email || "",
      phone: (u as { phone?: string }).phone || "",
      avatar: (u as { avatar?: string }).avatar || "",
      plan: (u as { plan?: string }).plan || "free",
      paid: Boolean(
        u.clan &&
          (u as { subscriptionExpiresAt?: Date }).subscriptionExpiresAt &&
          new Date((u as { subscriptionExpiresAt?: Date }).subscriptionExpiresAt as Date) >= now
      ),
      createdAt: u.createdAt,
    })),
  });
}
