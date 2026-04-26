import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { isActiveMember } from "@/lib/membership";
import { rateLimit, LIMITS } from "@/lib/rateLimit";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const MAX_INPUT_BYTES = 5 * 1024 * 1024; // 5 MB input image cap (Gemini handles up to ~20MB but keep tight)

// Magic-byte image type check (don't trust Content-Type alone)
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

function buildPrompt(productLabel: string) {
  const safeLabel = (productLabel || "outfit").trim().slice(0, 80) || "outfit";
  return (
    `Extract ${safeLabel} from the image, isolate the outfit only, ` +
    `it should be look same, no model, no face, no body, plain white background, ` +
    `product image style, 1:1 aspect ratio, sharp details, clean edges, ` +
    `no other thing just the main product.`
  );
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
  const email = session.user.email || "";
  const admin = isAdmin(email);
  const allowed = admin || (await isActiveMember(userId, email));
  if (!allowed) {
    return NextResponse.json({ error: "Зөвхөн гишүүнчлэлтэй хэрэглэгч ашиглах боломжтой" }, { status: 403 });
  }

  // Rate limits — burst + daily
  if (!admin) {
    const burst = rateLimit(`ai-tool:burst:${userId}`, LIMITS.AI_TOOL_PER_MINUTE);
    if (!burst.ok) {
      return NextResponse.json(
        { error: `Дэндүү олон удаа дуудлаа. ${Math.ceil(burst.resetInMs / 1000)} секундийн дараа дахин үзнэ үү.` },
        { status: 429, headers: { "Retry-After": String(Math.ceil(burst.resetInMs / 1000)) } }
      );
    }
    const day = rateLimit(`ai-tool:day:${userId}`, LIMITS.AI_TOOL_PER_DAY);
    if (!day.ok) {
      const hours = Math.ceil(day.resetInMs / 3600_000);
      return NextResponse.json(
        { error: `Өдрийн хязгаар (${day.limit}) хүрлээ. ~${hours}ц-ийн дараа сэргэнэ.` },
        { status: 429 }
      );
    }
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Файл хүлээж авч чадсангүй" }, { status: 400 });
  }
  const file = formData.get("file") as File | null;
  const productLabel = String(formData.get("product") || "outfit");

  if (!file) {
    return NextResponse.json({ error: "Зураг сонгоно уу" }, { status: 400 });
  }
  if (file.size > MAX_INPUT_BYTES) {
    return NextResponse.json(
      { error: `Зураг дэндүү том. Max ${Math.floor(MAX_INPUT_BYTES / 1024 / 1024)}MB.` },
      { status: 413 }
    );
  }

  const inputBuf = Buffer.from(await file.arrayBuffer());
  const realMime = detectImageMime(inputBuf);
  if (!realMime) {
    return NextResponse.json({ error: "Файл жинхэнэ зураг биш байна" }, { status: 400 });
  }

  const prompt = buildPrompt(productLabel);

  // Call Gemini 2.5 Flash Image (Nano Banana)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${encodeURIComponent(apiKey)}`;

  let geminiRes: Response;
  try {
    geminiRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inline_data: { mime_type: realMime, data: inputBuf.toString("base64") } },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ["IMAGE"],
        },
      }),
    });
  } catch {
    return NextResponse.json({ error: "AI үйлчилгээ түр ажиллахгүй байна" }, { status: 502 });
  }

  if (!geminiRes.ok) {
    const text = await geminiRes.text().catch(() => "");
    console.error("Gemini error", geminiRes.status, text.slice(0, 400));
    return NextResponse.json({ error: "AI зураг боловсруулахад алдаа гарлаа" }, { status: 502 });
  }

  type Part = { inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string }; text?: string };
  type Candidate = { content?: { parts?: Part[] } };
  type GeminiResponse = { candidates?: Candidate[]; promptFeedback?: { blockReason?: string } };
  const data = (await geminiRes.json()) as GeminiResponse;

  if (data.promptFeedback?.blockReason) {
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
    return NextResponse.json({ error: "AI зураг буцаасангүй. Дахин оролдоно уу." }, { status: 502 });
  }

  // Save the result so the user gets a permanent URL they can share/download
  const outBuf = Buffer.from(b64, "base64");
  const ext = outMime.includes("png") ? "png" : outMime.includes("jpeg") ? "jpg" : outMime.includes("webp") ? "webp" : "png";
  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `tool-extract-${randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), outBuf);

  return NextResponse.json({
    url: `/uploads/${filename}`,
    promptUsed: prompt,
  });
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;
