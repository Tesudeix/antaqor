import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit, LIMITS } from "@/lib/rateLimit";
import { spendCredits, refundCredits } from "@/lib/credits";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const COST_PER_IMAGE = 10; // credits
const REASON = "AI_IMAGE_GEN";

const MAX_PROMPT = 1000;

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
  }

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  // Burst rate limit (separate from credit cost — protects upstream)
  const burst = rateLimit(`ai-tool:burst:${userId}`, LIMITS.AI_TOOL_PER_MINUTE);
  if (!burst.ok) {
    return NextResponse.json(
      { error: `Дэндүү олон. ${Math.ceil(burst.resetInMs / 1000)} секундийн дараа.` },
      { status: 429, headers: { "Retry-After": String(Math.ceil(burst.resetInMs / 1000)) } }
    );
  }

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const promptRaw = String((body as { prompt?: unknown }).prompt || "").trim();
  if (!promptRaw) {
    return NextResponse.json({ error: "Промпт оруулна уу" }, { status: 400 });
  }
  if (promptRaw.length > MAX_PROMPT) {
    return NextResponse.json(
      { error: `Промпт ${MAX_PROMPT} тэмдэгтээс бага байх ёстой` },
      { status: 400 }
    );
  }
  const prompt = promptRaw;

  // Atomic credit deduction BEFORE the upstream call
  const charged = await spendCredits({
    userId,
    amount: COST_PER_IMAGE,
    reason: REASON,
    meta: { prompt: prompt.slice(0, 200) },
  });
  if (!charged.ok) {
    return NextResponse.json(
      {
        error: `Кредит хүрэлцэхгүй. ${COST_PER_IMAGE} кредит шаардлагатай.`,
        balance: charged.balance,
        required: COST_PER_IMAGE,
      },
      { status: 402 }
    );
  }

  // Call Gemini 2.5 Flash Image
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${encodeURIComponent(apiKey)}`;

  let geminiRes: Response;
  try {
    geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    });
  } catch {
    await refundCredits({ userId, amount: COST_PER_IMAGE, reason: REASON });
    return NextResponse.json({ error: "AI үйлчилгээ түр ажиллахгүй байна" }, { status: 502 });
  }

  if (!geminiRes.ok) {
    const text = await geminiRes.text().catch(() => "");
    console.error("Gemini gen-image error", geminiRes.status, text.slice(0, 400));
    await refundCredits({ userId, amount: COST_PER_IMAGE, reason: REASON });
    return NextResponse.json({ error: "AI зураг үүсгэхэд алдаа гарлаа" }, { status: 502 });
  }

  type Part = { inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string }; text?: string };
  type Candidate = { content?: { parts?: Part[] } };
  type GeminiResponse = { candidates?: Candidate[]; promptFeedback?: { blockReason?: string } };
  const data = (await geminiRes.json()) as GeminiResponse;

  if (data.promptFeedback?.blockReason) {
    await refundCredits({ userId, amount: COST_PER_IMAGE, reason: REASON });
    return NextResponse.json(
      { error: `AI хүсэлтийг хориглосон: ${data.promptFeedback.blockReason}` },
      { status: 400 }
    );
  }

  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
  const b64 = imagePart?.inlineData?.data || imagePart?.inline_data?.data;
  const outMime = imagePart?.inlineData?.mimeType || imagePart?.inline_data?.mime_type || "image/png";

  if (!b64) {
    await refundCredits({ userId, amount: COST_PER_IMAGE, reason: REASON });
    return NextResponse.json({ error: "AI зураг буцаасангүй. Дахин оролдоно уу." }, { status: 502 });
  }

  const outBuf = Buffer.from(b64, "base64");
  const ext = outMime.includes("png") ? "png" : outMime.includes("jpeg") ? "jpg" : outMime.includes("webp") ? "webp" : "png";
  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `tool-gen-${randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), outBuf);

  return NextResponse.json({
    url: `/uploads/${filename}`,
    cost: COST_PER_IMAGE,
    balance: charged.balance,
  });
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
