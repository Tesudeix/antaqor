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
const REASON = "AI_SWAP_PRODUCT";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per image

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

const SWAP_PROMPT =
  "Swap the product the subject is holding in image 1 with the product shown in image 2. " +
  "Keep the subject, their pose, hands, expression, lighting, perspective, and background " +
  "of image 1 exactly the same. Only replace the product in their hand with the product " +
  "from image 2. The replacement must look natural, scaled correctly, and held as if the " +
  "subject always held it. Preserve realistic shadows and reflections. Output a single " +
  "edited photograph, no text, no extra elements.";

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
  const subjectFile = formData.get("subject") as File | null;
  const productFile = formData.get("product") as File | null;
  if (!subjectFile || !productFile) {
    return NextResponse.json({ error: "2 зураг шаардлагатай (subject + product)" }, { status: 400 });
  }
  for (const [name, f] of [["subject", subjectFile], ["product", productFile]] as const) {
    if (f.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `${name} зураг дэндүү том. Max ${Math.floor(MAX_BYTES / 1024 / 1024)}MB.` },
        { status: 413 }
      );
    }
  }

  const subjectBuf = Buffer.from(await subjectFile.arrayBuffer());
  const productBuf = Buffer.from(await productFile.arrayBuffer());
  const subjectMime = detectImageMime(subjectBuf);
  const productMime = detectImageMime(productBuf);
  if (!subjectMime || !productMime) {
    return NextResponse.json({ error: "Файлуудын аль нэг нь жинхэнэ зураг биш" }, { status: 400 });
  }

  // Atomic credit deduction BEFORE the upstream call
  const charged = await spendCredits({
    userId,
    amount: COST,
    reason: REASON,
    meta: { tool: "swap-product" },
  });
  if (!charged.ok) {
    return NextResponse.json(
      { error: `Кредит хүрэлцэхгүй. ${COST} кредит шаардлагатай.`, balance: charged.balance, required: COST },
      { status: 402 }
    );
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${encodeURIComponent(apiKey)}`;
  let geminiRes: Response;
  try {
    geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: SWAP_PROMPT },
            { text: "Image 1 (subject holding the original product):" },
            { inline_data: { mime_type: subjectMime, data: subjectBuf.toString("base64") } },
            { text: "Image 2 (replacement product):" },
            { inline_data: { mime_type: productMime, data: productBuf.toString("base64") } },
          ],
        }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    });
  } catch {
    await refundCredits({ userId, amount: COST, reason: REASON });
    return NextResponse.json({ error: "AI үйлчилгээ түр ажиллахгүй байна" }, { status: 502 });
  }

  if (!geminiRes.ok) {
    const text = await geminiRes.text().catch(() => "");
    console.error("Gemini swap-product error", geminiRes.status, text.slice(0, 400));
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

  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p) => p.inlineData?.data || p.inline_data?.data);
  const b64 = imagePart?.inlineData?.data || imagePart?.inline_data?.data;
  const outMime = imagePart?.inlineData?.mimeType || imagePart?.inline_data?.mime_type || "image/png";

  if (!b64) {
    await refundCredits({ userId, amount: COST, reason: REASON });
    return NextResponse.json({ error: "AI зураг буцаасангүй. Дахин оролдоно уу." }, { status: 502 });
  }

  const outBuf = Buffer.from(b64, "base64");
  const ext = outMime.includes("png") ? "png" : outMime.includes("jpeg") ? "jpg" : outMime.includes("webp") ? "webp" : "png";
  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `tool-swap-${randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), outBuf);

  return NextResponse.json({
    url: `/uploads/${filename}`,
    cost: COST,
    balance: charged.balance,
  });
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
