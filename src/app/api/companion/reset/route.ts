import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import CompanionMemory from "@/models/CompanionMemory";
import CompanionMessage from "@/models/CompanionMessage";

// POST — wipe the user's companion memory and chat history. Affection resets
// to the default (30). The user keeps their account; only the relationship
// with Antaqor is reset.
export async function POST(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  await dbConnect();

  await Promise.all([
    CompanionMessage.deleteMany({ user: userId }),
    CompanionMemory.findOneAndUpdate(
      { user: userId },
      {
        $set: {
          affection: 30,
          preferredName: "",
          summary: "",
          facts: [],
          preferences: {},
          importantEvents: [],
          insideJokes: [],
          totalMessages: 0,
          lastInteractionAt: null,
        },
      },
      { upsert: true }
    ),
  ]);

  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
