import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { statfs } from "fs/promises";
import path from "path";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { sharpSemaphore } from "@/lib/semaphore";

// GET — security dashboard payload
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();

  const uploadDir = path.join(process.cwd(), "public", "uploads");
  let disk = {
    freeBytes: 0,
    totalBytes: 0,
    usedBytes: 0,
    usedPct: 0,
  };
  try {
    const s = await statfs(uploadDir);
    const total = s.blocks * s.bsize;
    const free = s.bavail * s.bsize;
    const used = total - free;
    disk = { freeBytes: free, totalBytes: total, usedBytes: used, usedPct: Math.round((used / total) * 100) };
  } catch {
    /* ignore */
  }

  const [
    totalUsers,
    bannedUsers,
    topUploaders,
    recentBans,
    suspiciousSignups,
  ] = await Promise.all([
    User.countDocuments({}),
    User.countDocuments({ banned: true }),
    User.find({ uploadBytesMonth: { $gt: 0 } })
      .sort({ uploadBytesMonth: -1 })
      .limit(10)
      .select("name email avatar uploadBytesMonth uploadMonthResetAt subscriptionExpiresAt banned")
      .lean(),
    User.find({ banned: true })
      .sort({ bannedAt: -1 })
      .limit(10)
      .select("name email avatar banned bannedReason bannedAt")
      .lean(),
    User.find({})
      .sort({ createdAt: -1 })
      .limit(20)
      .select("name email avatar createdAt subscriptionExpiresAt xp level")
      .lean(),
  ]);

  return NextResponse.json({
    disk,
    sharp: sharpSemaphore.stats(),
    users: {
      total: totalUsers,
      banned: bannedUsers,
    },
    topUploaders,
    recentBans,
    recentSignups: suspiciousSignups,
  });
}

export const dynamic = "force-dynamic";
