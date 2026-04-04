import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Message from "@/models/Message";
import Conversation from "@/models/Conversation";

// GET — total unread count for current user
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ count: 0 });
  }

  const userId = (session.user as { id: string }).id;

  await dbConnect();

  const userConversations = await Conversation.find({ participants: userId }).select("_id").lean();
  const conversationIds = userConversations.map((c) => c._id);

  const count = await Message.countDocuments({
    conversation: { $in: conversationIds },
    sender: { $ne: userId },
    read: false,
  });

  return NextResponse.json({ count });
}
