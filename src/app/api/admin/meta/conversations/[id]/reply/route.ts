import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import MetaConversation from "@/models/MetaConversation";
import MetaMessage from "@/models/MetaMessage";
import { sendDm } from "@/lib/metaDm";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function POST(req: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as { text?: string };
  const text = (body.text || "").trim();
  if (!text) return NextResponse.json({ error: "Empty text" }, { status: 400 });

  await dbConnect();
  const conv = await MetaConversation.findById(id);
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const send = await sendDm(conv.platform, conv.partnerId, text);
  const message = await MetaMessage.create({
    conversationId: conv._id,
    platform: conv.platform,
    direction: "out",
    source: "manual",
    text,
    errorBody: send.ok ? "" : `${send.status} ${send.body}`.slice(0, 1000),
    manualSenderEmail: session.user.email || "",
  });

  if (send.ok) {
    conv.lastMessagePreview = text.slice(0, 200);
    conv.lastMessageDirection = "out";
    conv.lastMessageAt = new Date();
    await conv.save();
  }

  return NextResponse.json({
    ok: send.ok,
    sendStatus: send.status,
    error: send.ok ? null : send.body,
    message,
  });
}
