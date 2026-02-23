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
    const mode = req.nextUrl.searchParams.get("mode") || "replies";

    if (!threadId) {
      return NextResponse.json({ error: "threadId is required" }, { status: 400 });
    }

    const data =
      mode === "conversation"
        ? await client.getConversation(threadId)
        : await client.getReplies(threadId);

    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to fetch replies";
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
    const { threadId, text } = await req.json();
    if (!threadId || !text) {
      return NextResponse.json(
        { error: "threadId and text are required" },
        { status: 400 }
      );
    }
    const result = await client.createAndPublish(text.trim(), threadId);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to reply";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  const client = await getThreadsClient();
  if (!client) {
    return NextResponse.json({ error: "Not connected to Threads" }, { status: 400 });
  }

  try {
    const { replyId, hide } = await req.json();
    if (!replyId || typeof hide !== "boolean") {
      return NextResponse.json(
        { error: "replyId and hide (boolean) are required" },
        { status: 400 }
      );
    }
    const result = await client.manageReply(replyId, hide);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to manage reply";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
