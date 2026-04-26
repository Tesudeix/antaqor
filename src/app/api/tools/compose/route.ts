import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit, LIMITS } from "@/lib/rateLimit";
import { spendCredits, refundCredits } from "@/lib/credits";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const COST = 10;
const REASON = "AI_COMPOSE";
const MAX_BYTES = 5 * 1024 * 1024;
const MIN_IMAGES = 2;
const MAX_IMAGES = 5;
const MAX_PROMPT = 1000;
const MAX_LABEL = 40;

function detectImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return "image/gif";
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "image/webp";
  return null;
}

function safeLabel(s: string): string {
  return s.replace(/[^a-zA-Z0-9 _\-]/g, "").trim().slice(0, MAX_LABEL);
}

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

  const burst = rateLimit(`ai-tool:burst:${userId}`, LIMITS.AI_TOOL_PER_MINUTE);
  if (!burst.ok) {
    return NextResponse.json(
      { error: `Дэндүү олон. ${Math.ceil(burst.resetInMs / 1000)} секундийн дараа.` },
      { status: 429, headers: { "Retry-After": String(Math.ceil(burst.resetInMs / 1000)) } }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Файл хүлээж авч чадсангүй" }, { status: 400 });
  }

  // Collect images[] + labels[] in order. Browsers serialise multiple values
  // for the same key (FormData.append) in insertion order — we trust that.
  const files = formData.getAll("images").filter((v): v is File => v instanceof File);
  const labels = formData.getAll("labels").map((v) => safeLabel(String(v)));
  const userPrompt = String(formData.get("prompt") || "").trim();

  if (files.length < MIN_IMAGES || files.length > MAX_IMAGES) {
    return NextResponse.json(
      { error: `Зураг ${MIN_IMAGES}–${MAX_IMAGES} ширхэг байх ёстой` },
      { status: 400 }
    );
  }
  if (!userPrompt) {
    return NextResponse.json({ error: "Промпт оруулна уу" }, { status: 400 });
  }
  if (userPrompt.length > MAX_PROMPT) {
    return NextResponse.json(
      { error: `Промпт ${MAX_PROMPT} тэмдэгтээс бага байх ёстой` },
      { status: 400 }
    );
  }

  // Validate every image (size + magic bytes)
  const validatedImages: { buf: Buffer; mime: string; label: string; idx: number }[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (f.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `Зураг #${i + 1} дэндүү том. Max ${Math.floor(MAX_BYTES / 1024 / 1024)}MB.` },
        { status: 413 }
      );
    }
    const buf = Buffer.from(await f.arrayBuffer());
    const mime = detectImageMime(buf);
    if (!mime) {
      return NextResponse.json(
        { error: `Зураг #${i + 1} жинхэнэ зураг биш байна` },
        { status: 400 }
      );
    }
    validatedImages.push({ buf, mime, label: labels[i] || `image${i + 1}`, idx: i + 1 });
  }

  // Build the final prompt that names the inputs so the user can reference
  // them: "place {subject} on top of {background} holding {product}"
  const guidance =
    `You are given ${validatedImages.length} input images. ` +
    `Combine them into ONE final photograph following the user's instruction below. ` +
    `Keep coherent lighting, scale, and perspective. Output a single edited image, ` +
    `no text, no extra elements.\n\n` +
    `Inputs (in order):\n` +
    validatedImages.map((v) => `  ${v.idx}. {${v.label}}`).join("\n") +
    `\n\nUser instruction:\n${userPrompt}`;

  // Atomic credit deduction BEFORE the upstream call
  const charged = await spendCredits({
    userId,
    amount: COST,
    reason: REASON,
    meta: { tool: "compose", count: validatedImages.length },
  });
  if (!charged.ok) {
    return NextResponse.json(
      { error: `Кредит хүрэлцэхгүй. ${COST} кредит шаардлагатай.`, balance: charged.balance, required: COST },
      { status: 402 }
    );
  }

  // Build Gemini parts: [text guidance, image1 with label, image2 with label, ...]
  const parts: Array<
    | { text: string }
    | { inline_data: { mime_type: string; data: string } }
  > = [{ text: guidance }];
  for (const v of validatedImages) {
    parts.push({ text: `Image ${v.idx} ({${v.label}}):` });
    parts.push({ inline_data: { mime_type: v.mime, data: v.buf.toString("base64") } });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${encodeURIComponent(apiKey)}`;
  let geminiRes: Response;
  try {
    geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    });
  } catch {
    await refundCredits({ userId, amount: COST, reason: REASON });
    return NextResponse.json({ error: "AI үйлчилгээ түр ажиллахгүй байна" }, { status: 502 });
  }

  if (!geminiRes.ok) {
    const text = await geminiRes.text().catch(() => "");
    console.error("Gemini compose error", geminiRes.status, text.slice(0, 400));
    await refundCredits({ userId, amount: COST, reason: REASON });
    return NextResponse.json({ error: "AI зураг боловсруулахад алдаа гарлаа" }, { status: 502 });
  }

  type Part = { inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string }; text?: string };
  type Candidate = { content?: { parts?: Part[] } };
  type GeminiResponse = { candidates?: Candidate[]; promptFeedback?: { blockReason?: string } };
  const data = (await geminiRes.json()) as GeminiResponse;

  if (data.promptFeedback?.blockReason) {
    await refundCredits({ userId, amount: COST, reason: REASON });
    return NextResponse.json(
      { error: `AI хүсэлтийг хориглосон: ${data.promptFeedback.blockReason}` },
      { status: 400 }
    );
  }

  const respParts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = respParts.find((p) => p.inlineData?.data || p.inline_data?.data);
  const b64 = imagePart?.inlineData?.data || imagePart?.inline_data?.data;
  const outMime = imagePart?.inlineData?.mimeType || imagePart?.inline_data?.mime_type || "image/png";

  if (!b64) {
    await refundCredits({ userId, amount: COST, reason: REASON });
    return NextResponse.json({ error: "AI зураг буцаасангүй. Дахин оролдоно уу." }, { status: 502 });
  }

  const outBuf = Buffer.from(b64, "base64");
  const ext = outMime.includes("png") ? "png" : outMime.includes("jpeg") ? "jpg" : outMime.includes("webp") ? "webp" : "png";
  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `tool-compose-${randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), outBuf);

  return NextResponse.json({
    url: `/uploads/${filename}`,
    cost: COST,
    balance: charged.balance,
    inputCount: validatedImages.length,
  });
}

export const dynamic = "force-dynamic";
export const maxDuration = 90;
