import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import MetaConversation from "@/models/MetaConversation";
import User from "@/models/User";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const status = url.searchParams.get("status") || "open";
  const platform = url.searchParams.get("platform") || "";
  const intent = url.searchParams.get("intent") || ""; // hot|warm|cold|fan|support
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));

  await dbConnect();
  const filter: Record<string, unknown> = { status };
  if (platform === "instagram" || platform === "messenger") filter.platform = platform;
  if (intent === "hot") filter.intentScore = { $gte: 7 };
  else if (intent === "warm") filter.intentScore = { $gte: 5, $lt: 7 };
  else if (intent === "cold") filter.intentScore = { $gte: 3, $lt: 5 };
  else if (intent && ["fan", "support"].includes(intent)) filter.intentLabel = intent;

  const conversations = await MetaConversation.find(filter)
    .sort({ lastMessageAt: -1 })
    .limit(limit)
    .lean();

  // Populate linked user info (lightweight subset)
  const userIds = conversations
    .map((c) => c.linkedUserId)
    .filter(Boolean) as unknown as string[];
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select("name email credits subscriptionExpiresAt level streakDays")
        .lean()
    : [];
  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  const conversationsWithUser = conversations.map((c) => {
    const u = c.linkedUserId ? userMap.get(c.linkedUserId.toString()) : null;
    if (!u) return { ...c, linkedUser: null };
    const isGhost = (u.email || "").endsWith("@antaqor.dm");
    const daysLeft = u.subscriptionExpiresAt
      ? Math.max(
          0,
          Math.ceil((new Date(u.subscriptionExpiresAt).getTime() - Date.now()) / 86400_000)
        )
      : 0;
    return {
      ...c,
      linkedUser: {
        _id: u._id,
        name: u.name,
        ghost: isGhost,
        credits: u.credits || 0,
        daysLeft,
        level: u.level || 0,
        streakDays: u.streakDays || 0,
      },
    };
  });

  const totalUnread = await MetaConversation.aggregate([
    { $match: { status: "open" } },
    { $group: { _id: null, sum: { $sum: "$unreadCount" } } },
  ]);

  return NextResponse.json({
    conversations: conversationsWithUser,
    totalUnread: totalUnread[0]?.sum || 0,
  });
}
