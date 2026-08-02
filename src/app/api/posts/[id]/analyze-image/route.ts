import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";
import { rateLimit, LIMITS } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

interface PostShape {
  _id: string;
  image?: string;
  images?: string[];
}

function absoluteUrl(u: string): string {
  if (!u) return u;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  const base = process.env.NEXTAUTH_URL || "https://antaqor.com";
  return `${base.replace(/\/+$/, "")}${u.startsWith("/") ? u : `/${u}`}`;
}

const SYSTEM_PROMPT = `You are an expert AI image-prompt engineer who analyzes existing photos/illustrations and produces a clean, structured English breakdown ready to feed back into image-generation models.

Return ONLY a JSON object with these exact keys:
{
  "description": "1-2 sentence English description of what's in the image",
  "subject": "the main subject in 2-6 words",
  "colorTone": "dominant palette + mood, e.g. 'warm sunset oranges with deep cyan shadows'",
  "lighting": "lighting setup, e.g. 'soft natural window light from camera-left'",
  "pose": "subject pose if applicable, else 'n/a'",
  "angle": "camera angle/framing, e.g. 'low-angle medium close-up'",
  "composition": "framing details, e.g. 'rule of thirds, subject left third, negative space right'",
  "style": "mood/genre, e.g. 'cinematic editorial portrait'",
  "prompt": "a single-paragraph English image-gen prompt that packs subject + color tone + lighting + pose + angle + composition + style"
}
No preamble, no markdown fences — just the JSON.`;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
    }
    const userId = (session.user as { id: string }).id;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OpenAI тохируулаагүй" }, { status: 500 });
    }

    const rl = rateLimit(`ai-tool:burst:${userId}`, LIMITS.AI_TOOL_PER_MINUTE);
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Дэндүү олон. ${Math.ceil(rl.resetInMs / 1000)} секунд.` },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetInMs / 1000)) } }
      );
    }

    const { id } = await params;
    await dbConnect();
    const post = (await Post.findById(id).lean()) as unknown as PostShape | null;
    if (!post) return NextResponse.json({ error: "Пост олдсонгүй" }, { status: 404 });

    const firstImage =
      (Array.isArray(post.images) && post.images[0]) ||
      post.image ||
      "";
    if (!firstImage) {
      return NextResponse.json({ error: "Энэ постонд зураг байхгүй" }, { status: 400 });
    }
    const imageUrl = absoluteUrl(firstImage);

    const upstream = await fetch(OPENAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || "gpt-4o-mini",
        response_format: { type: "json_object" },
        max_tokens: 700,
        temperature: 0.4,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Analyze this image:" },
              { type: "image_url", image_url: { url: imageUrl, detail: "auto" } },
            ],
          },
        ],
      }),
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const msg = data?.error?.message || `OpenAI ${upstream.status}`;
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const raw = data?.choices?.[0]?.message?.content?.trim() || "";
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // Fallback — find the first JSON object in case the model wrapped it
      const m = raw.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch { /* ignore */ }
      }
    }
    if (!parsed) {
      return NextResponse.json({ error: "Хариу JSON биш", raw }, { status: 502 });
    }

    return NextResponse.json({
      analysis: parsed,
      imageUrl: firstImage,
      model: data?.model,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Тодорхойгүй алдаа";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
