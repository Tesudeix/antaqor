import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";
import { rateLimit, LIMITS } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const XAI_ENDPOINT = "https://api.x.ai/v1/chat/completions";
const DEFAULT_MODEL = "grok-3-latest";

interface PostShape {
  _id: string;
  content?: string;
  aiPrompt?: string;
  createdAt?: Date | string;
  category?: string;
  author?: { name?: string } | null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
    }
    const userId = (session.user as { id: string }).id;

    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Grok API тохируулаагүй" }, { status: 500 });
    }

    // Burst rate limit — keep AI cost predictable
    const rl = rateLimit(`ai-tool:burst:${userId}`, LIMITS.AI_TOOL_PER_MINUTE);
    if (!rl.ok) {
      return NextResponse.json(
        { error: `Дэндүү олон. ${Math.ceil(rl.resetInMs / 1000)} секундийн дараа.` },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetInMs / 1000)) } }
      );
    }

    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const question = String(body.question || "").trim();
    if (question.length < 2) {
      return NextResponse.json({ error: "Асуулт хэт богино" }, { status: 400 });
    }
    if (question.length > 500) {
      return NextResponse.json({ error: "Асуулт 500 тэмдэгтээс бага" }, { status: 400 });
    }

    await dbConnect();
    const post = (await Post.findById(id)
      .populate("author", "name")
      .lean()) as unknown as PostShape | null;
    if (!post) {
      return NextResponse.json({ error: "Пост олдсонгүй" }, { status: 404 });
    }

    const dateStr = post.createdAt
      ? new Date(post.createdAt).toISOString().slice(0, 10)
      : "";
    const postContext = [
      post.author?.name ? `Зохиогч: ${post.author.name}` : null,
      dateStr ? `Огноо: ${dateStr}` : null,
      post.category ? `Ангилал: ${post.category}` : null,
      post.content ? `Агуулга:\n${post.content}` : null,
      post.aiPrompt ? `AI промпт: ${post.aiPrompt}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    const messages = [
      {
        role: "system",
        content:
          "Та бол хэрэглэгчид социал медиа постын талаар тусалдаг туслах AI. " +
          "Богино, тодорхой, ойлгомжтой хариулна уу. Хэрэглэгчийн асуултын хэлээр " +
          "(монгол асуувал монголоор) хариулна. Зохиогчийн талаар хувийн дүгнэлт " +
          "битгий гарга — зөвхөн постын агуулгад үндэслэ.",
      },
      {
        role: "user",
        content: `--- Пост ---\n${postContext}\n\n--- Асуулт ---\n${question}`,
      },
    ];

    const upstream = await fetch(XAI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.XAI_MODEL || DEFAULT_MODEL,
        messages,
        temperature: 0.5,
        max_tokens: 600,
      }),
    });

    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const msg = data?.error?.message || data?.error || `Grok API ${upstream.status}`;
      return NextResponse.json({ error: msg }, { status: 502 });
    }

    const answer = data?.choices?.[0]?.message?.content?.trim() || "";
    if (!answer) {
      return NextResponse.json({ error: "Grok хариу буцаасангүй" }, { status: 502 });
    }

    return NextResponse.json({ answer, model: data?.model || DEFAULT_MODEL });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Тодорхойгүй алдаа";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
