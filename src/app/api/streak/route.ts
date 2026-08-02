import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { dailyCheckIn } from "@/lib/streak";

// POST — idempotent daily check-in. Client fires this on app load.
// Same-day calls are no-ops.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  const result = await dailyCheckIn(userId);
  return NextResponse.json(result);
}

export const dynamic = "force-dynamic";
