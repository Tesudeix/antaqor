import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessage = { role: "user" | "assistant" | "system"; content: string };

const XAI_KEY = process.env.XAI_API_KEY || process.env.GROK_API_KEY || "";
const XAI_MODEL = process.env.XAI_MODEL || "grok-2-latest";
const XAI_URL = "https://api.x.ai/v1/chat/completions";

const SITE_MAP = `
PAGES:
- /                 — Нүүр (нийтлэлийн фийд эсвэл хувийн ландинг)
- /classroom        — AI сургалтууд (Монгол хэлээр)
- /posts/new        — Шинэ пост үүсгэх (нэвтэрсэн бол)
- /posts/[id]       — Постын дэлгэрэнгүй
- /vpn              — Хувийн VPN үүсгэх (WireGuard)
- /chat             — Гишүүдтэй чат
- /clan             — Клан / нийгэмлэг
- /tasks            — Зорилго, даалгавар
- /video            — Видео бүтээх (AI)
- /members          — Гишүүдийн жагсаалт
- /profile          — Профайл
- /auth/signin      — Нэвтрэх / Бүртгүүлэх

ACTIONS the user can do via the agent:
- "go:/path"    — Хуудас руу шилжих
- "open:signup" — Бүртгэлийн хуудас нээх
- "compose"     — Шинэ пост бичих туслалцаа
`;

function buildSystemPrompt(pagePath: string, isAuthed: boolean) {
  return `Чи бол ANTAQOR — Монголын анхны live agentic AI империйн оператор.

Чиний зорилго:
- Хэрэглэгчийн хувийн брэнд, AI ажил, бүтээлд тусална.
- Монголоор, товч, тодорхой, эрчтэй яри. Дэндүү урт яриа битгий хий.
- "Trillionaire mindset" — өндөр зорилго, шууд алхам, тоо баримттай.
- Шаардлагатай үед хэрэглэгчид ХОЛБООС санал болго JSON форматтайгаар (доороос үз).

Платформын мэдээлэл:
${SITE_MAP}

Одоогийн контекст:
- Хуудас: ${pagePath}
- Хэрэглэгч ${isAuthed ? "нэвтэрсэн" : "нэвтрээгүй"}

Хариултын стиль:
- 2-4 өгүүлбэр. Тодорхой алхам өг.
- Боломжтой бол хариултын ТӨГСГӨЛД зөвхөн нэг мөрөнд тусгаарласан JSON блок нэм:
  \`\`\`actions
  {"actions":[{"label":"Сургалт үзэх","href":"/classroom"},{"label":"Бүртгүүлэх","href":"/auth/signin"}]}
  \`\`\`
- Хэрэв action хэрэггүй бол JSON блок огт битгий нэм.

ХОРИОТОЙ:
- Англиар бүү хариул (зөвхөн Монголоор).
- API key, нууц мэдээ битгий нээ.
- Болохгүй гэж бүү бичиж бай — өөр зам зөвлө.`;
}

function fallback(body: { messages: ChatMessage[]; pagePath: string }): string {
  const last = body.messages[body.messages.length - 1]?.content || "";
  if (/сургалт|курс|class/i.test(last))
    return "Antaqor сургалтууд /classroom хуудаснаас. Эхлээд үндсэн AI prompt-ийн модулиар ор.";
  if (/үнэ|төл|prising|price/i.test(last))
    return "Үнэ нь гишүүд нэмэгдэх тусам өснө. Эрт орох тусам хямд. Дэлгэрэнгүй нүүр хуудасны Pricing хэсэгт.";
  if (/бүртг|нэвтр|signup|signin/i.test(last))
    return "Бүртгүүлэх /auth/signin хуудаснаас. 30 секундэд орчмын ажил.";
  return "Сайн уу. AI key одоохондоо тохируулагдаагүй байна — XAI_API_KEY-г .env.local-д нэм. Үүнтэй адил бусад хуудсууд бэлэн.";
}

export async function POST(req: NextRequest) {
  let body: { messages: ChatMessage[]; pagePath?: string; isAuthed?: boolean };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  const pagePath = (body.pagePath || "/").slice(0, 80);
  const isAuthed = !!body.isAuthed;

  if (!XAI_KEY) {
    const text = fallback({ messages, pagePath });
    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        for (const ch of text) {
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ delta: ch })}\n\n`));
        }
        controller.enqueue(enc.encode(`data: [DONE]\n\n`));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "X-Antaqor-Mode": "fallback" },
    });
  }

  const upstream = await fetch(XAI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${XAI_KEY}` },
    body: JSON.stringify({
      model: XAI_MODEL,
      stream: true,
      temperature: 0.7,
      max_tokens: 600,
      messages: [{ role: "system", content: buildSystemPrompt(pagePath, isAuthed) }, ...messages],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => "");
    const stream = new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        controller.enqueue(
          enc.encode(`data: ${JSON.stringify({ delta: `[xAI алдаа: ${upstream.status}] ` + errText.slice(0, 200) })}\n\n`)
        );
        controller.enqueue(enc.encode(`data: [DONE]\n\n`));
        controller.close();
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  }

  // Convert xAI SSE → simplified {delta} SSE
  let buf = "";
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const transform = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      buf += dec.decode(chunk, { stream: true });
      const parts = buf.split("\n\n");
      buf = parts.pop() || "";
      for (const part of parts) {
        const lines = part.split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") {
            controller.enqueue(enc.encode(`data: [DONE]\n\n`));
            return;
          }
          try {
            const obj = JSON.parse(payload);
            const delta = obj?.choices?.[0]?.delta?.content;
            if (typeof delta === "string" && delta.length) {
              controller.enqueue(enc.encode(`data: ${JSON.stringify({ delta })}\n\n`));
            }
          } catch {
            // skip malformed
          }
        }
      }
    },
  });

  return new Response(upstream.body.pipeThrough(transform), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Antaqor-Mode": "grok",
    },
  });
}
