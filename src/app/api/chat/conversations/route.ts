import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Conversation from "@/models/Conversation";
import Message from "@/models/Message";
import User from "@/models/User";

// GET — list conversations for current user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;

  await dbConnect();

  const conversations = await Conversation.find({ participants: userId })
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .populate("participants", "name avatar")
    .lean();

  // Get unread counts per conversation
  const withUnread = await Promise.all(
    conversations.map(async (conv) => {
      const unreadCount = await Message.countDocuments({
        conversation: conv._id,
        sender: { $ne: userId },
        read: false,
      });
      return { ...conv, unreadCount };
    })
  );

  return NextResponse.json({ conversations: withUnread });
}

// POST — create or get existing conversation
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }

  const userId = (session.user as { id: string }).id;
  const { recipientId } = await req.json();

  if (!recipientId || recipientId === userId) {
    return NextResponse.json({ error: "Буруу хүлээн авагч" }, { status: 400 });
  }

  await dbConnect();

  // Check recipient exists and is a clan member
  const recipient = await User.findById(recipientId).select("clan").lean();
  if (!recipient || !recipient.clan) {
    return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });
  }

  // Find existing conversation
  let conversation = await Conversation.findOne({
    participants: { $all: [userId, recipientId], $size: 2 },
  })
    .populate("participants", "name avatar")
    .lean();

  if (!conversation) {
    const created = await Conversation.create({
      participants: [userId, recipientId],
    });
    conversation = await Conversation.findById(created._id)
      .populate("participants", "name avatar")
      .lean();
  }

  return NextResponse.json({ conversation });
}
