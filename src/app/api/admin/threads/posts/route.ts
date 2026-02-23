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
    const limit = req.nextUrl.searchParams.get("limit") || "25";
    const after = req.nextUrl.searchParams.get("after") || undefined;
    const data = await client.getThreads(Number(limit), after);
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch posts";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  const client = await getThreadsClient();
  if (!client) {
    return NextResponse.json({ error: "Not connected to Threads" }, { status: 400 });
  }

  try {
    const { text } = await req.json();
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }
    if (text.length > 500) {
      return NextResponse.json({ error: "Text must be 500 characters or less" }, { status: 400 });
    }
    const result = await client.createAndPublish(text.trim());
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to publish";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  const client = await getThreadsClient();
  if (!client) {
    return NextResponse.json({ error: "Not connected to Threads" }, { status: 400 });
  }

  try {
    const { threadId } = await req.json();
    if (!threadId) {
      return NextResponse.json({ error: "threadId is required" }, { status: 400 });
    }
    const result = await client.deleteThread(threadId);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to delete";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
