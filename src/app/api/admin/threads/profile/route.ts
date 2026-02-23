import { NextResponse } from "next/server";
import { getAdminSession, unauthorized, getThreadsClient } from "@/lib/adminAuth";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  const client = await getThreadsClient();
  if (!client) {
    return NextResponse.json({ error: "Not connected to Threads" }, { status: 400 });
  }

  try {
    const profile = await client.getProfile();
    return NextResponse.json(profile);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch profile";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
