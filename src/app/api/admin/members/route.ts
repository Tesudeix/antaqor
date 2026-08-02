import { NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

// Social / system accounts are the "ghost" users auto-created from Meta DMs
// (Instagram / Messenger). They carry a placeholder email `<platform>_<psid>@antaqor.dm`
// and never set a real password. Everyone else is a registered member.
const SOCIAL_MATCH = { email: { $regex: "@antaqor\\.dm$", $options: "i" } };
const REGISTERED_MATCH = { email: { $not: { $regex: "@antaqor\\.dm$", $options: "i" } } };

export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const filter = searchParams.get("filter") || "all";
    const source = searchParams.get("source") || "registered"; // registered | social | all

    const conditions: Record<string, unknown>[] = [];

    // Registered vs social (system) separation — the primary split.
    if (source === "social") {
      conditions.push(SOCIAL_MATCH);
    } else if (source === "registered") {
      conditions.push(REGISTERED_MATCH);
    }

    if (search) {
      conditions.push({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
          { metaInstagramId: { $regex: search, $options: "i" } },
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
      .select("name email phone avatar bio age aiExperience interests clan clanJoinedAt subscriptionExpiresAt role createdAt credits metaInstagramId metaMessengerPsid")
      .sort({ createdAt: -1 })
      .lean();

    // Tag each row with its source so the UI can badge mixed ("all") views.
    const rows = users.map((u) => {
      const isSocial = typeof u.email === "string" && /@antaqor\.dm$/i.test(u.email);
      const platform = u.metaInstagramId ? "instagram" : u.metaMessengerPsid ? "messenger" : null;
      return { ...u, source: isSocial ? "social" : "registered", platform };
    });

    const totalUsers = await User.countDocuments();
    const totalSocial = await User.countDocuments(SOCIAL_MATCH);
    const totalRegistered = totalUsers - totalSocial;
    const totalMembers = await User.countDocuments({ clan: { $ne: "" }, subscriptionExpiresAt: { $gt: new Date() } });

    const aiLevelCounts = await User.aggregate([
      { $match: { ...REGISTERED_MATCH, aiExperience: { $ne: "" } } },
      { $group: { _id: "$aiExperience", count: { $sum: 1 } } },
    ]);

    const interestCounts = await User.aggregate([
      { $match: REGISTERED_MATCH },
      { $unwind: "$interests" },
      { $group: { _id: "$interests", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    return NextResponse.json({
      users: rows,
      totalUsers,
      totalRegistered,
      totalSocial,
      totalMembers,
      aiLevelCounts,
      interestCounts,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Серверийн алдаа";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
