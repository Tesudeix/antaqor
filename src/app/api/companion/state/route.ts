import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import CompanionMemory from "@/models/CompanionMemory";
import CompanionMessage from "@/models/CompanionMessage";
import { affectionBand } from "@/lib/companion";
import { resolveCompanionSubject, subjectFilter } from "@/lib/companionSession";

const PAGE = 30;
const GUEST_LIFETIME = 30;

export async function GET(req: NextRequest) {
  const subject = await resolveCompanionSubject(req);
  if (!subject) {
    return NextResponse.json(
      { error: "Танигдсангүй", isGuest: false },
      { status: 401 }
    );
  }
  await dbConnect();

  const filter = subjectFilter(subject);
  const [memDoc, messages] = await Promise.all([
    CompanionMemory.findOne(filter).lean(),
    CompanionMessage.find(filter).sort({ createdAt: -1 }).limit(PAGE).lean(),
  ]);

  const m = memDoc as unknown as {
    affection?: number;
    preferredName?: string;
    summary?: string;
    facts?: string[];
    importantEvents?: { at: Date; what: string }[];
    totalMessages?: number;
  } | null;

  const affection = m?.affection ?? 30;
  const band = affectionBand(affection);

  const isGuest = subject.kind === "guest";
  const totalMessages = m?.totalMessages || 0;

  return NextResponse.json({
    isGuest,
    guestQuotaRemaining: isGuest ? Math.max(0, GUEST_LIFETIME - totalMessages) : null,
    memory: {
      affection,
      affectionLabel: band.label,
      preferredName: m?.preferredName || "",
      summary: m?.summary || "",
      facts: (m?.facts || []).slice(-10),
      importantEvents: (m?.importantEvents || []).slice(-5),
      totalMessages,
    },
    messages: messages
      .reverse()
      .map((mm) => ({
        _id: String((mm as unknown as { _id: unknown })._id),
        role: (mm as unknown as { role: "user" | "assistant" }).role,
        content: (mm as unknown as { content: string }).content,
        affectionDelta: (mm as unknown as { affectionDelta?: number }).affectionDelta || 0,
        affectionAfter: (mm as unknown as { affectionAfter?: number }).affectionAfter,
        suggestedReplies: (mm as unknown as { suggestedReplies?: string[] }).suggestedReplies || [],
        actions: (mm as unknown as { actions?: { label: string; href: string }[] }).actions || [],
        createdAt: (mm as unknown as { createdAt: Date }).createdAt,
      })),
  });
}

export const dynamic = "force-dynamic";
