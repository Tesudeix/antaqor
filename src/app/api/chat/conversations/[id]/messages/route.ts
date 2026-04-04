import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";

// GET — fetch messages for a conversation
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }

  const { id } = await params;
  const userId = (session.user as { id: string }).id;

  await dbConnect();

  // Verify user is participant
  const conversation = await Conversation.findOne({
    _id: id,
    participants: userId,
  });

  if (!conversation) {
    return NextResponse.json({ error: "Харилцан яриа олдсонгүй" }, { status: 404 });
  }

  const url = new URL(req.url);
  const before = url.searchParams.get("before");
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

  const query: Record<string, unknown> = { conversation: id };
  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("sender", "name avatar")
    .lean();

  // Mark unread messages as read
  await Message.updateMany(
    { conversation: id, sender: { $ne: userId }, read: false },
    { $set: { read: true } }
  );

  return NextResponse.json({ messages: messages.reverse() });
}

// POST — send a message
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }

  const { id } = await params;
  const userId = (session.user as { id: string }).id;
  const { content } = await req.json();

  if (!content || !content.trim()) {
    return NextResponse.json({ error: "Мессеж хоосон байна" }, { status: 400 });
  }

  if (content.length > 2000) {
    return NextResponse.json({ error: "Мессеж хэт урт байна" }, { status: 400 });
  }

  await dbConnect();

  // Verify user is participant
  const conversation = await Conversation.findOne({
    _id: id,
    participants: userId,
  });

  if (!conversation) {
    return NextResponse.json({ error: "Харилцан яриа олдсонгүй" }, { status: 404 });
  }

  const message = await Message.create({
    conversation: id,
    sender: userId,
    content: content.trim(),
  });

  // Update conversation's last message
  await Conversation.findByIdAndUpdate(id, {
    lastMessage: content.trim().slice(0, 100),
    lastMessageAt: new Date(),
  });

  const populated = await Message.findById(message._id)
    .populate("sender", "name avatar")
    .lean();

  return NextResponse.json({ message: populated }, { status: 201 });
}
