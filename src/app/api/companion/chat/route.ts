import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import CompanionMemory from "@/models/CompanionMemory";
import CompanionMessage from "@/models/CompanionMessage";
import {
  buildSystemPrompt,
  callCompanion,
  type CompanionContextMessage,
  type CompanionMemorySnapshot,
} from "@/lib/companion";

const MAX_INPUT_CHARS = 1500;
const RECENT_TURNS = 12;          // last N (user+assistant) messages injected as context
const MAX_FACTS = 30;             // cap memory size — oldest facts evicted
const MAX_JOKES = 10;
const MAX_EVENTS = 20;

// Per-user / per-minute burst (separate from IP middleware floor)
const PER_USER_PER_MIN = { max: 12, windowMs: 60_000 };
const PER_USER_PER_DAY = { max: 200, windowMs: 24 * 60 * 60_000 };

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Companion service not configured" }, { status: 500 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const burst = rateLimit(`companion:burst:${userId}`, PER_USER_PER_MIN);
  if (!burst.ok) {
    return NextResponse.json(
      { error: `Дэндүү хурдан бичлээ. ${Math.ceil(burst.resetInMs / 1000)}с дараа дахин үзнэ үү.` },
      { status: 429, headers: { "Retry-After": String(Math.ceil(burst.resetInMs / 1000)) } }
    );
  }
  const day = rateLimit(`companion:day:${userId}`, PER_USER_PER_DAY);
  if (!day.ok) {
    const hours = Math.ceil(day.resetInMs / 3600_000);
    return NextResponse.json(
      { error: `Өнөөдрийн чат хязгаар (${day.limit}) хүрлээ. ~${hours}ц дараа сэргэнэ.` },
      { status: 429 }
    );
  }

  const { message: rawMessage } = (await req.json().catch(() => ({}))) as { message?: string };
  const userInput = String(rawMessage || "").trim().slice(0, MAX_INPUT_CHARS);
  if (!userInput) {
    return NextResponse.json({ error: "Мессеж бичнэ үү" }, { status: 400 });
  }

  await dbConnect();

  // ─── Load memory + recent messages in parallel ───
  const [memDoc, recentDocs, userDoc] = await Promise.all([
    CompanionMemory.findOne({ user: userId }),
    CompanionMessage.find({ user: userId }).sort({ createdAt: -1 }).limit(RECENT_TURNS).lean(),
    User.findById(userId).select("name").lean(),
  ]);

  const memory = memDoc || (await CompanionMemory.create({ user: userId }));

  const memorySnapshot: CompanionMemorySnapshot = {
    affection: memory.affection,
    preferredName: memory.preferredName,
    summary: memory.summary,
    facts: memory.facts || [],
    preferences: memory.preferences || {},
    importantEvents: memory.importantEvents || [],
    insideJokes: memory.insideJokes || [],
    totalMessages: memory.totalMessages || 0,
  };

  const userDisplayName = (userDoc as unknown as { name?: string } | null)?.name || "";
  const systemPrompt = buildSystemPrompt(memorySnapshot, userDisplayName);

  const recent: CompanionContextMessage[] = recentDocs
    .reverse()
    .map((m) => ({
      role: (m as unknown as { role: "user" | "assistant" }).role,
      content: (m as unknown as { content: string }).content,
    }));

  // ─── Persist the user's message FIRST so a Grok timeout doesn't lose it ───
  await CompanionMessage.create({
    user: userId,
    role: "user",
    content: userInput,
    affectionDelta: 0,
  });

  // ─── Single Grok call (function-calling returns reply + memory deltas) ───
  let turn;
  try {
    turn = await callCompanion({ apiKey, systemPrompt, recent, userInput });
  } catch (err) {
    console.error("Companion Grok call failed:", err);
    return NextResponse.json(
      { error: "Антаквор түр амарч байна. Дахин оролдоно уу." },
      { status: 502 }
    );
  }

  // ─── Apply updates ───
  const newAffection = clamp((memory.affection || 0) + turn.affectionDelta, 0, 100);
  memory.affection = newAffection;
  memory.totalMessages = (memory.totalMessages || 0) + 1;
  memory.lastInteractionAt = new Date();

  if (turn.summary) memory.summary = turn.summary.slice(0, 1000);
  if (turn.preferredName) memory.preferredName = turn.preferredName.slice(0, 60);

  if (turn.newFacts.length) {
    const merged = [...(memory.facts || []), ...turn.newFacts];
    memory.facts = dedupTail(merged, MAX_FACTS);
  }
  if (turn.newJokes.length) {
    const merged = [...(memory.insideJokes || []), ...turn.newJokes];
    memory.insideJokes = dedupTail(merged, MAX_JOKES);
  }
  if (turn.newImportantEvent) {
    memory.importantEvents = [
      ...(memory.importantEvents || []),
      { at: new Date(), what: turn.newImportantEvent },
    ].slice(-MAX_EVENTS);
  }

  await memory.save();

  // ─── Persist assistant reply with the affection it earned ───
  const assistantMsg = await CompanionMessage.create({
    user: userId,
    role: "assistant",
    content: turn.message,
    affectionDelta: turn.affectionDelta,
    affectionAfter: newAffection,
  });

  return NextResponse.json({
    reply: {
      _id: String(assistantMsg._id),
      role: "assistant" as const,
      content: turn.message,
      affectionDelta: turn.affectionDelta,
      affectionAfter: newAffection,
      createdAt: assistantMsg.createdAt,
    },
    memory: {
      affection: newAffection,
      preferredName: memory.preferredName,
      totalMessages: memory.totalMessages,
    },
  });
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

// Keep latest unique entries (case-insensitive) up to `max`.
function dedupTail(arr: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (let i = arr.length - 1; i >= 0; i--) {
    const k = arr[i].trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.unshift(arr[i].trim());
    if (out.length >= max) break;
  }
  return out;
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
