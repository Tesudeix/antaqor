import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Post from "@/models/Post";
import Category from "@/models/Category";
import { rateLimit, LIMITS } from "@/lib/rateLimit";
import { broadcastSSE } from "@/lib/sseHub";

export const dynamic = "force-dynamic";

const REFINE_MODEL = process.env.OPENAI_INTRO_MODEL || "gpt-5-mini";

const REFINE_SYSTEM = `Чи Antaqor AI хүрээлэл-н entrepreneur intro-г бичдэг бичээч.
Хэрэглэгчийн 7 хариултыг авч, түүнийг ХУРЦ, өөртөө итгэлтэй, бизнесмэн entrepreneur танилцуулга болгон Монголоор дахин бичнэ үү.

Дүрэм:
- ЗӨВХӨН эцсийн танилцуулгыг буцаа. Урьдчилсан тайлбар, ишлэл, markdown БҮҮ нэм.
- 1-р биеэр бич ("Би …", "Миний …").
- Tone: cyberpunk-builder, founder, no-fluff. Илүү үг үгүй.
- Урт: 80–140 үг. Хэт богино биш, хэт урт биш.
- Бүтэц (paragraph биш, нэг урсгалаар):
  1) Нэр + нас + status (1 өгүүлбэр)
  2) Яагаад ЯГ энэ замаар (motivation, fire)
  3) Одоо юу дээр ажиллаж байна (current battlefield)
  4) 5-10 жилийн зорилгын мэдрэмж (vision)
  5) Community-аас юу авах ба өгөх (exchange)
- Hashtag, emoji БҮҮ нэм.
- Хэрэглэгчийн өгсөн фактуудыг л ашигла. Шинэ зүйл бүү зохио.`;

interface IntroBody {
  name?: string;
  age?: string;
  status?: string;
  why?: string;
  nowWorkingOn?: string;
  longTermGoal?: string;
  giveTake?: string;
  media?: string;
}

function clean(s: unknown, max = 600): string {
  if (typeof s !== "string") return "";
  return s.trim().slice(0, max);
}

async function refineWithOpenAI(answers: Required<IntroBody>): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return fallbackCompile(answers);
  }
  const userPayload = [
    `1. Нэр: ${answers.name}`,
    `2. Нас: ${answers.age}`,
    `3. Status: ${answers.status}`,
    `4. Яагаад ЯГ энэ замаар: ${answers.why}`,
    `5. Яг одоо ажиллаж байгаа зүйл: ${answers.nowWorkingOn}`,
    `6. 5-10 жилийн зорилгын мэдрэмж: ${answers.longTermGoal}`,
    `7. Community-аас авах / өгөх: ${answers.giveTake}`,
  ].join("\n");

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 22_000);
    const upstream = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: REFINE_MODEL,
        input: [
          { role: "system", content: REFINE_SYSTEM },
          { role: "user", content: userPayload },
        ],
        max_output_tokens: 700,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!upstream.ok) {
      console.error("[intro] openai", upstream.status);
      return fallbackCompile(answers);
    }
    const data = (await upstream.json()) as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };
    let text = "";
    if (typeof data.output_text === "string") text = data.output_text.trim();
    else if (Array.isArray(data.output)) {
      const parts: string[] = [];
      for (const b of data.output) for (const c of b.content || []) if (c.text) parts.push(c.text);
      text = parts.join("\n").trim();
    }
    if (!text) return fallbackCompile(answers);
    return text.slice(0, 1800);
  } catch (e) {
    console.error("[intro] refine err", (e as Error).message);
    return fallbackCompile(answers);
  }
}

function fallbackCompile(a: Required<IntroBody>): string {
  return [
    `Би ${a.name}, ${a.age} настай, ${a.status}.`,
    a.why,
    `Одоо ${a.nowWorkingOn} дээр ажиллаж байна.`,
    `Хүсэж буй зорилго: ${a.longTermGoal}.`,
    `Энэ community-аас ${a.giveTake}.`,
  ].join(" ");
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "auth" }, { status: 401 });
  await dbConnect();
  const userId = (session.user as { id: string }).id;
  const u = await User.findById(userId).select("intro introCompletedAt").lean();
  const user = u as unknown as { intro?: unknown; introCompletedAt?: Date } | null;
  return NextResponse.json({
    completed: !!user?.introCompletedAt,
    intro: user?.intro || null,
    completedAt: user?.introCompletedAt || null,
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "auth" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const rl = rateLimit(`intro:${userId}`, LIMITS.AI_TOOL_PER_MINUTE);
  if (!rl.ok) {
    return NextResponse.json({ error: "Дэндүү олон хүсэлт. Хэдхэн секундын дараа." }, { status: 429 });
  }

  const body = (await req.json().catch(() => ({}))) as IntroBody;
  const answers = {
    name: clean(body.name, 80),
    age: clean(body.age, 20),
    status: clean(body.status, 30),
    why: clean(body.why, 600),
    nowWorkingOn: clean(body.nowWorkingOn, 600),
    longTermGoal: clean(body.longTermGoal, 600),
    giveTake: clean(body.giveTake, 600),
    media: clean(body.media, 600),
  };

  const required = [
    answers.name, answers.age, answers.status,
    answers.why, answers.nowWorkingOn, answers.longTermGoal, answers.giveTake,
  ];
  if (required.some((v) => v.length < 1)) {
    return NextResponse.json({ error: "Бүх асуултанд хариулна уу" }, { status: 400 });
  }
  if (!answers.media) {
    return NextResponse.json({ error: "Зураг эсвэл видео хавсаргана уу" }, { status: 400 });
  }

  await dbConnect();

  const me = await User.findById(userId).select("introCompletedAt name avatar level subscriptionExpiresAt").lean();
  const meDoc = me as unknown as { introCompletedAt?: Date; level?: number } | null;
  if (meDoc?.introCompletedAt) {
    return NextResponse.json({ error: "Танилцуулга өмнө нь илгээгдсэн байна" }, { status: 409 });
  }

  const refined = await refineWithOpenAI(answers);

  // Ensure category exists (it does on this DB, but defensive)
  const cat = await Category.findOne({ slug: "танилцуулга" }).lean();
  const postCategory = cat ? "танилцуулга" : "пост";

  const isVideo = /\.(mp4|mov|webm|m4v)(\?|$)/i.test(answers.media);

  const postDoc = await Post.create({
    author: userId,
    content: refined,
    image: isVideo ? "" : answers.media,
    images: isVideo ? [] : [answers.media],
    video: isVideo ? answers.media : "",
    visibility: "free",
    category: postCategory,
    authorLevel: meDoc?.level || 1,
  });

  const introPayload = {
    name: answers.name,
    age: answers.age,
    status: answers.status,
    why: answers.why,
    nowWorkingOn: answers.nowWorkingOn,
    longTermGoal: answers.longTermGoal,
    giveTake: answers.giveTake,
    media: answers.media,
    refined,
    postId: postDoc._id,
  };

  const bioShort = refined.slice(0, 300);
  await User.findByIdAndUpdate(userId, {
    $set: {
      intro: introPayload,
      introCompletedAt: new Date(),
      bio: bioShort,
    },
  });

  try {
    broadcastSSE("post:new", { postId: String(postDoc._id) });
  } catch {}

  return NextResponse.json({
    ok: true,
    refined,
    post: { _id: String(postDoc._id) },
  });
}
