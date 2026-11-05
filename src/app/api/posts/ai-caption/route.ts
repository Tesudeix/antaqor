import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { randomUUID } from "crypto";
import { authOptions } from "@/lib/auth";
import { rateLimit, LIMITS } from "@/lib/rateLimit";
import { reelCategoryName } from "@/lib/reelCategories";

export const dynamic = "force-dynamic";

/* ─── POST /api/posts/ai-caption — reel-ийн caption-ыг AI бичнэ (2026-10-09) ─
   Видеоноос 3 кадр (15% · 50% · 85%) ffmpeg-ээр авч Gemini-д (OpenAI-нийцтэй
   endpoint, зураг хүлээж авдаг — шалгасан) хүний товч санаа + ангиллын
   хамт илгээнэ. Буцаах нь Instagram/Facebook/antaqor.com-д шууд тавих
   caption: hook мөр → 2-3 мөр үнэ цэнэ → CTA → hashtag.

   Видео байхгүй ч ажиллана (зөвхөн санаанаас). Оролтын замыг зөвхөн
   /uploads доторх vid-*.mp4-ээр хязгаарлана (shell-гүй spawn). */

const UPLOADS = path.join(process.cwd(), "public", "uploads");
const SAFE = /^\/uploads\/(?:videos\/)?((?:vid|poster)-[a-f0-9-]{8,64}\.mp4)$/;

function run(cmd: string, args: string[], timeoutMs = 20_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    const t = setTimeout(() => p.kill("SIGKILL"), timeoutMs);
    p.stdout?.on("data", (d) => { out += d.toString(); });
    p.on("error", (e) => { clearTimeout(t); reject(e); });
    p.on("close", (code) => { clearTimeout(t); code === 0 ? resolve(out) : reject(new Error(`${cmd} ${code}`)); });
  });
}

async function frames(file: string): Promise<string[]> {
  let dur = 10;
  try {
    dur = parseFloat(await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file])) || 10;
  } catch { /* дунджаар 10с гэж үзнэ */ }
  const out: string[] = [];
  for (const f of [0.15, 0.5, 0.85]) {
    const jpg = path.join(tmpdir(), `cap-${randomUUID()}.jpg`);
    try {
      await run("ffmpeg", ["-y", "-loglevel", "error", "-ss", (dur * f).toFixed(2), "-i", file, "-frames:v", "1", "-vf", "scale=512:-2", "-q:v", "5", jpg]);
      out.push((await readFile(jpg)).toString("base64"));
    } catch { /* нэг кадр алдвал бусдаар үргэлжилнэ */ }
    finally { await unlink(jpg).catch(() => {}); }
  }
  return out;
}

const SYSTEM = `Чи Antaqor — Монголын AI entrepreneur хүрээллийн reel caption бичигч.
Дүрэм:
- Монгол хэлээр. Энгийн, амьд, итгэлтэй — зар сурталчилгаа шиг биш.
- 1-р мөр: HOOK — гүйлгэж буй хүнийг зогсоох нэг өгүүлбэр (асуулт, зоримог санаа, тоо).
- Дараа нь 2-3 богино мөр: энэ reel-ээс юу авах вэ.
- Төгсгөлд нэг CTA (жишээ: "antaqor.com-д нэгдээрэй", "сэтгэгдэлд бич").
- Хамгийн сүүлд 4-6 hashtag, #antaqor заавал; монгол + англи холих.
- Emoji 0-3. Нийт 500 тэмдэгтээс бага.
- ЗӨВХӨН caption-ы текстийг буцаа — тайлбар, хашилт, "Caption:" гэх мэт угтвар бүү бич.`;

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });

  const rl = rateLimit(`ai-caption:${userId}`, LIMITS.AI_TOOL_PER_MINUTE);
  if (!rl.ok) return NextResponse.json({ error: "Дэндүү олон. Түр хүлээгээд дахин." }, { status: 429 });

  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "AI тохируулаагүй байна" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { video?: string; hint?: string; category?: string };
  const hint = String(body.hint || "").trim().slice(0, 600);
  const cat = reelCategoryName(body.category) || "";

  let images: string[] = [];
  const m = String(body.video || "").match(SAFE);
  if (m) {
    const file = [path.join(UPLOADS, m[1]), path.join(UPLOADS, "videos", m[1])].find((f) => existsSync(f));
    if (file) images = await frames(file);
  }
  if (!images.length && !hint) {
    return NextResponse.json({ error: "Видео эсвэл товч санаа хэрэгтэй" }, { status: 400 });
  }

  const userText = [
    images.length ? "Доорх нь reel-ийн 3 кадр (эхэн, дунд, төгсгөл)." : "Видеоны кадр алга — зөвхөн санаанаас бич.",
    cat && `Ангилал: ${cat}.`,
    hint && `Зохиогчийн санаа: ${hint}`,
    "Энэ reel-д caption бич.",
  ].filter(Boolean).join("\n");

  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(45_000),
      body: JSON.stringify({
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
        reasoning_effort: "none",
        max_tokens: 700,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: [
              { type: "text", text: userText },
              ...images.map((b) => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${b}` } })),
            ],
          },
        ],
      }),
    });
    const d = await res.json();
    const caption = String(d?.choices?.[0]?.message?.content || "").trim().replace(/^["“]|["”]$/g, "");
    if (!res.ok || !caption) {
      console.error("[ai-caption]", res.status, JSON.stringify(d).slice(0, 300));
      return NextResponse.json({ error: "AI caption бичиж чадсангүй. Дахин оролдоно уу." }, { status: 502 });
    }
    return NextResponse.json({ caption: caption.slice(0, 2000), frames: images.length });
  } catch (e) {
    console.error("[ai-caption]", e);
    return NextResponse.json({ error: "AI түр хариу өгсөнгүй. Дахин оролдоно уу." }, { status: 502 });
  }
}
