import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import MetaConversation from "@/models/MetaConversation";
import MetaMessage from "@/models/MetaMessage";
import User from "@/models/User";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }
  await dbConnect();
  const conversation = await MetaConversation.findById(id).lean();
  if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let linkedUser = null;
  if (conversation.linkedUserId) {
    const u = await User.findById(conversation.linkedUserId)
      .select("name email credits creditsLifetime subscriptionExpiresAt level streakDays xp clan")
      .lean();
    if (u) {
      const isGhost = (u.email || "").endsWith("@antaqor.dm");
      const daysLeft = u.subscriptionExpiresAt
        ? Math.max(
            0,
            Math.ceil((new Date(u.subscriptionExpiresAt).getTime() - Date.now()) / 86400_000)
          )
        : 0;
      linkedUser = {
        _id: u._id,
        name: u.name,
        email: isGhost ? null : u.email,
        ghost: isGhost,
        credits: u.credits || 0,
        creditsLifetime: u.creditsLifetime || 0,
        daysLeft,
        subscriptionExpiresAt: u.subscriptionExpiresAt,
        level: u.level || 0,
        xp: u.xp || 0,
        streakDays: u.streakDays || 0,
        clan: u.clan || "",
      };
    }
  }

  const messages = await MetaMessage.find({ conversationId: id })
    .sort({ createdAt: 1 })
    .limit(500)
    .lean();
  return NextResponse.json({ conversation, linkedUser, messages });
}

export async function PATCH(req: Request, { params }: { params: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    status?: "open" | "archived";
    aiDisabled?: boolean;
    internalNote?: string;
  };
  const update: Record<string, unknown> = {};
  if (body.status === "open" || body.status === "archived") update.status = body.status;
  if (typeof body.aiDisabled === "boolean") update.aiDisabled = body.aiDisabled;
  if (typeof body.internalNote === "string") update.internalNote = body.internalNote.slice(0, 1000);
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }
  await dbConnect();
  const conv = await MetaConversation.findByIdAndUpdate(id, update, { new: true }).lean();
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true, conversation: conv });
}
