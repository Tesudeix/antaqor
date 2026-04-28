import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import BudjargalMemory from "@/models/BudjargalMemory";
import BudjargalMessage from "@/models/BudjargalMessage";
import { resolveCompanionSubject, subjectFilter, subjectInsert } from "@/lib/companionSession";

export async function POST(req: NextRequest) {
  const subject = await resolveCompanionSubject(req);
  if (!subject) return NextResponse.json({ error: "Танигдсангүй" }, { status: 401 });
  await dbConnect();

  const filter = subjectFilter(subject);
  await Promise.all([
    BudjargalMessage.deleteMany(filter),
    BudjargalMemory.findOneAndUpdate(
      filter,
      {
        $set: {
          affection: 30, preferredName: "", summary: "",
          facts: [], preferences: {}, importantEvents: [], insideJokes: [],
          totalMessages: 0, lastInteractionAt: null,
        },
        $setOnInsert: subjectInsert(subject),
      },
      { upsert: true }
    ),
  ]);
  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
