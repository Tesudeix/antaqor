import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized, getThreadsClient } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  const client = await getThreadsClient();
  if (!client) {
    return NextResponse.json({ error: "Not connected to Threads" }, { status: 400 });
  }

  try {
    const threadId = req.nextUrl.searchParams.get("threadId");
    const period =
      (req.nextUrl.searchParams.get("period") as "day" | "week" | "days_28") ||
      "days_28";

    if (threadId) {
      const data = await client.getThreadInsights(threadId);
      return NextResponse.json(data);
    }

    const data = await client.getUserInsights(period);
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch insights";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
