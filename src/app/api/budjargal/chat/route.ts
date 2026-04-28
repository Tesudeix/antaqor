import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import BudjargalMemory from "@/models/BudjargalMemory";
import BudjargalMessage from "@/models/BudjargalMessage";
import {
  buildSystemPrompt,
  callBudjargal,
  type BudjargalContextMessage,
  type BudjargalMemorySnapshot,
} from "@/lib/budjargal";
import {
  resolveCompanionSubject,
  subjectFilter,
  subjectInsert,
  subjectRateKey,
} from "@/lib/companionSession";

const MAX_INPUT_CHARS = 1500;
const RECENT_TURNS = 10;
const MAX_FACTS = 30;
const MAX_EVENTS = 20;
const USER_PER_MIN = { max: 12, windowMs: 60_000 };
const USER_PER_DAY = { max: 200, windowMs: 24 * 60 * 60_000 };
const GUEST_PER_MIN = { max: 4, windowMs: 60_000 };
const GUEST_PER_HOUR = { max: 10, windowMs: 60 * 60_000 };
const GUEST_LIFETIME = 30;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROK_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Companion service not configured" }, { status: 500 });

  const subject = await resolveCompanionSubject(req);
  if (!subject) return NextResponse.json({ error: "Танигдсангүй" }, { status: 401 });

  const subjKey = subjectRateKey(subject);
  if (subject.kind === "user") {
    const burst = rateLimit(`budjargal:burst:${subjKey}`, USER_PER_MIN);
    if (!burst.ok) return tooMany("Дэндүү хурдан бичлээ.", burst.resetInMs);
    const day = rateLimit(`budjargal:day:${subjKey}`, USER_PER_DAY);
    if (!day.ok) return tooMany(`Өдрийн чат хязгаар (${day.limit}) хүрлээ.`, day.resetInMs);
  } else {
    const burst = rateLimit(`budjargal:burst:${subjKey}`, GUEST_PER_MIN);
    if (!burst.ok) return tooMany("Хэдхэн секунд хүлээгээрэй.", burst.resetInMs);
    const hr = rateLimit(`budjargal:hour:${subjKey}`, GUEST_PER_HOUR);
    if (!hr.ok) return tooMany(`Зочин 1 цагт ${hr.limit} мессеж.`, hr.resetInMs);
  }

  const { message: rawMessage } = (await req.json().catch(() => ({}))) as { message?: string };
  const userInput = String(rawMessage || "").trim().slice(0, MAX_INPUT_CHARS);
  if (!userInput) return NextResponse.json({ error: "Мессеж бичнэ үү" }, { status: 400 });

  await dbConnect();
  const filter = subjectFilter(subject);
  const insert = subjectInsert(subject);

  const [memDoc, recentDocs, userDoc] = await Promise.all([
    BudjargalMemory.findOne(filter),
    BudjargalMessage.find(filter).sort({ createdAt: -1 }).limit(RECENT_TURNS).lean(),
    subject.kind === "user" ? User.findById(subject.userId).select("name").lean() : Promise.resolve(null),
  ]);

  const memory = memDoc || (await BudjargalMemory.create({ ...insert }));

  if (subject.kind === "guest" && (memory.totalMessages || 0) >= GUEST_LIFETIME) {
    return NextResponse.json(
      { error: `Зочин ${GUEST_LIFETIME} мессеж. Бүртгүүлбэл хязгааргүй.`, signupRequired: true },
      { status: 402 }
    );
  }

  const memorySnapshot: BudjargalMemorySnapshot = {
    affection: memory.affection,
    preferredName: memory.preferredName,
    summary: memory.summary,
    facts: memory.facts || [],
    importantEvents: memory.importantEvents || [],
    totalMessages: memory.totalMessages || 0,
  };

  const userDisplayName = (userDoc as unknown as { name?: string } | null)?.name || "";
  const systemPrompt = buildSystemPrompt(memorySnapshot, userDisplayName, subject.kind === "guest");

  const recent: BudjargalContextMessage[] = recentDocs
    .reverse()
    .map((m) => ({
      role: (m as unknown as { role: "user" | "assistant" }).role,
      content: (m as unknown as { content: string }).content,
    }));

  await BudjargalMessage.create({ ...insert, role: "user", content: userInput, affectionDelta: 0 });

  let turn;
  try {
    turn = await callBudjargal({ apiKey, systemPrompt, recent, userInput });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error("Budjargal Grok call failed:", raw);
    let friendly = "Буджаргал чимээгүй сууж байна. Хэсэг хүлээж дахин асуу.";
    let status = 502;
    if (/Grok 401/i.test(raw)) { friendly = "Үйлчилгээ тохируулагдаагүй байна. Админд хандана уу."; status = 503; }
    else if (/Grok 429|exhausted|spending limit|quota/i.test(raw)) { friendly = "Сарын кредит дууссан. Удахгүй сэргэнэ."; status = 503; }
    return NextResponse.json({ error: friendly }, { status });
  }

  const newAffection = clamp((memory.affection || 0) + turn.affectionDelta, 0, 100);
  memory.affection = newAffection;
  memory.totalMessages = (memory.totalMessages || 0) + 1;
  memory.lastInteractionAt = new Date();
  if (turn.summary) memory.summary = turn.summary.slice(0, 1000);
  if (turn.preferredName) memory.preferredName = turn.preferredName.slice(0, 60);
  if (turn.newFacts.length) {
    memory.facts = dedupTail([...(memory.facts || []), ...turn.newFacts], MAX_FACTS);
  }
  if (turn.newImportantEvent) {
    memory.importantEvents = [
      ...(memory.importantEvents || []),
      { at: new Date(), what: turn.newImportantEvent },
    ].slice(-MAX_EVENTS);
  }
  await memory.save();

  const assistantMsg = await BudjargalMessage.create({
    ...insert,
    role: "assistant",
    content: turn.message,
    affectionDelta: turn.affectionDelta,
    affectionAfter: newAffection,
    suggestedReplies: turn.suggestedReplies,
    actions: turn.actions,
  });

  return NextResponse.json({
    reply: {
      _id: String(assistantMsg._id),
      role: "assistant" as const,
      content: turn.message,
      affectionDelta: turn.affectionDelta,
      affectionAfter: newAffection,
      suggestedReplies: turn.suggestedReplies,
      actions: turn.actions,
      createdAt: assistantMsg.createdAt,
    },
    memory: {
      affection: newAffection,
      preferredName: memory.preferredName,
      totalMessages: memory.totalMessages,
    },
    isGuest: subject.kind === "guest",
    guestQuotaRemaining: subject.kind === "guest" ? Math.max(0, GUEST_LIFETIME - (memory.totalMessages || 0)) : null,
  });
}

function tooMany(message: string, resetInMs: number) {
  const sec = Math.max(1, Math.ceil(resetInMs / 1000));
  return NextResponse.json({ error: `${message} ${sec}с дараа.` }, { status: 429, headers: { "Retry-After": String(sec) } });
}
function clamp(n: number, min: number, max: number): number { return Math.max(min, Math.min(max, Math.round(n))); }
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
