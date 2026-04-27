import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import CompanionMemory from "@/models/CompanionMemory";
import CompanionMessage from "@/models/CompanionMessage";
import { resolveCompanionSubject, subjectFilter, subjectInsert } from "@/lib/companionSession";

export async function POST(req: NextRequest) {
  const subject = await resolveCompanionSubject(req);
  if (!subject) {
    return NextResponse.json({ error: "Танигдсангүй" }, { status: 401 });
  }
  await dbConnect();

  const filter = subjectFilter(subject);
  await Promise.all([
    CompanionMessage.deleteMany(filter),
    CompanionMemory.findOneAndUpdate(
      filter,
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
        $setOnInsert: subjectInsert(subject),
      },
      { upsert: true }
    ),
  ]);

  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
