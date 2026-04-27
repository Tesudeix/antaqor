import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import CompanionMemory from "@/models/CompanionMemory";
import CompanionMessage from "@/models/CompanionMessage";
import { affectionBand } from "@/lib/companion";

const PAGE = 30;

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;
  await dbConnect();

  const [memDoc, messages] = await Promise.all([
    CompanionMemory.findOne({ user: userId }).lean(),
    CompanionMessage.find({ user: userId }).sort({ createdAt: -1 }).limit(PAGE).lean(),
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

  return NextResponse.json({
    memory: {
      affection,
      affectionLabel: band.label,
      preferredName: m?.preferredName || "",
      summary: m?.summary || "",
      facts: (m?.facts || []).slice(-10),
      importantEvents: (m?.importantEvents || []).slice(-5),
      totalMessages: m?.totalMessages || 0,
    },
    messages: messages
      .reverse()
      .map((mm) => ({
        _id: String((mm as unknown as { _id: unknown })._id),
        role: (mm as unknown as { role: "user" | "assistant" }).role,
        content: (mm as unknown as { content: string }).content,
        affectionDelta: (mm as unknown as { affectionDelta?: number }).affectionDelta || 0,
        affectionAfter: (mm as unknown as { affectionAfter?: number }).affectionAfter,
        createdAt: (mm as unknown as { createdAt: Date }).createdAt,
      })),
  });
}

export const dynamic = "force-dynamic";
