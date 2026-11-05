/* ─── Загварын каталог ба сонголт ────────────────────────────────────────
   Хоёр асуултад хариулна: "одоо ЮУ ажиллаж байна" ба "өөр юу байгаа вэ".

   ЖАГСААЛТЫГ ЯАГААД АМЬДААР ТАТАХ ВЭ. Кодод бичсэн жагсаалт нэг л сарын
   дараа худал болно — үүнийг энэ төсөл дээр ХОЁР удаа амссан:
   `gemini-2.0-flash` чимээгүй тэтгэвэрт гараад 404 болсон, `gpt-5-mini`
   гурван үеийн хоцрогдол болсон. Нийлүүлэгч бүр өөрөө жагсаалттай тул
   түүнийг л асууна: буруу утга сонгох боломж алга.

   СОНГОЛТ НЬ ЗӨӨЛӨН. Хүн загвар сонгоход тэр нь дараалалд ТЭРГҮҮНД ордог
   болохоос бусдыг УСТГАДАГГҮЙ. Сонгосон загвар унавал ажил зогсохын оронд
   дараагийнх руу шилжинэ, харин дэлгэц дээр "юу болсон" нь харагдана.
   Хатуу тогтоовол нэг өдөр эзэн "яагаад юу ч гарахгүй байна" гэж гайхна. */

import { getTextSetting, setTextSetting } from "@/lib/siteSettings";

export interface ModelOption {
  id: string;
  /** Хүн уншиж ойлгох тайлбар — байвал. */
  hint?: string;
}

export interface ProviderCatalog {
  name: string;
  label: string;
  /** Түлхүүр тохируулсан эсэх. Үгүй бол сонгох ч утгагүй. */
  configured: boolean;
  /** Жагсаалт татаж чадсан эсэх — кредит дууссан бол үгүй. */
  reachable: boolean;
  /** Яагаад хүрэхгүй байгааг хүнд хэлэх мөр. */
  problem?: string;
  models: ModelOption[];
  /** Юу ч сонгоогүй үед энэ нийлүүлэгч ямар загвар барих вэ. */
  fallbackModel: string;
}

export const AI_CHOICE_KEY = "threadsWriterChoice";

/** Хадгалсан сонголт: "provider:model". Хоосон бол автомат. */
export interface AiChoice {
  provider: string;
  model: string;
}

export async function getAiChoice(): Promise<AiChoice | null> {
  const raw = (await getTextSetting(AI_CHOICE_KEY, "")).trim();
  if (!raw) return null;
  const idx = raw.indexOf(":");
  if (idx <= 0) return null;
  const provider = raw.slice(0, idx).trim();
  const model = raw.slice(idx + 1).trim();
  return provider && model ? { provider, model } : null;
}

export async function setAiChoice(choice: AiChoice | null): Promise<void> {
  await setTextSetting(AI_CHOICE_KEY, choice ? `${choice.provider}:${choice.model}` : "");
}

/* ─── OpenAI-ийн шүүлтүүр ────────────────────────────────────────────────
   Данс 124 загвар буцаадаг ба тэдний ихэнх нь энэ ажилд хамаагүй: дуу,
   зураг, транскрипц, embedding, огноотой хувилбарууд. Бүгдийг харуулах нь
   сонголт өгсөн хэрэг биш — сонголтыг БОРООХ хэрэг.

   Огноотой хувилбарыг (`gpt-5.4-2026-03-05`) зориуд хасна: alias нь
   (`gpt-5.4`) үргэлж хамгийн сүүлийнх рүү заадаг тул огноог тогтоох нь
   зөвхөн тусгай тохиолдолд хэрэгтэй, харин жагсаалтыг гурав дахин
   уртасгана. */
const OPENAI_EXCLUDE =
  /(audio|realtime|transcribe|tts|search|image|embedding|moderation|codex|dall-e|whisper|omni-moderation|-\d{4}-\d{2}-\d{2}$)/i;

function filterOpenAI(ids: string[]): ModelOption[] {
  return ids
    .filter((id) => /^(gpt-|o[1345](-|$))/i.test(id))
    .filter((id) => !OPENAI_EXCLUDE.test(id))
    .sort((a, b) => b.localeCompare(a, "en", { numeric: true }))
    .map((id) => ({ id }));
}

/* `generateContent`-ыг дэмждэг нь текст ЧАТЫН загвар гэсэн үг биш:
   transcribe (дуу), robotics (биет удирдлага), image, tts бүгд тэр аргыг
   зарладаг. Шүүхгүй бол админ жагсаалтаас дуу хөрвүүлэгч сонгож, яагаад
   пост гарахгүй байгааг гайхна. */
const GEMINI_EXCLUDE =
  /(image|tts|embedding|aqa|customtools|nano-banana|omni|transcribe|robotics|live|native-audio|dialog)/i;

function filterGemini(ids: string[]): ModelOption[] {
  return ids
    .filter((id) => /^gemini-/i.test(id))
    .filter((id) => !GEMINI_EXCLUDE.test(id))
    .sort((a, b) => b.localeCompare(a, "en", { numeric: true }))
    .map((id) => ({ id }));
}

function filterXai(ids: string[]): ModelOption[] {
  return ids.filter((id) => /^grok/i.test(id)).sort().map((id) => ({ id }));
}

/* Жагсаалт нь минут тутамд өөрчлөгддөггүй тул богино хугацаанд хадгална —
   админ хуудас сэргээх болгонд гурван гадаад дуудлага хийх нь дэмий. */
let cache: { at: number; data: ProviderCatalog[] } | null = null;
const TTL_MS = 5 * 60_000;

async function fetchJson(url: string, headers: Record<string, string> = {}, timeoutMs = 12_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body: body as Record<string, unknown> };
  } catch (e) {
    return { ok: false, status: 0, body: { error: e instanceof Error ? e.message : "network" } };
  } finally {
    clearTimeout(t);
  }
}

/** Нийлүүлэгчийн алдааны биеэс хүн уншихаар мөр гаргана.
 *  OpenAI объект, xAI тэмдэгт мөр өгдөг — хоёуланг барина. */
function problemOf(body: Record<string, unknown>, status: number): string {
  const err = body.error as { message?: string } | string | undefined;
  const msg = typeof err === "string" ? err : err?.message;
  if (msg) return msg.slice(0, 160);
  return `HTTP ${status}`;
}

export async function listModels(force = false): Promise<ProviderCatalog[]> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.data;

  const openaiKey = process.env.OPENAI_SCOUT_KEY || process.env.OPENAI_API_KEY;
  const xaiKey = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  const [openai, xai, gemini] = await Promise.all([
    openaiKey
      ? fetchJson("https://api.openai.com/v1/models", { Authorization: `Bearer ${openaiKey}` })
      : null,
    xaiKey ? fetchJson("https://api.x.ai/v1/models", { Authorization: `Bearer ${xaiKey}` }) : null,
    geminiKey
      ? fetchJson(
          `https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${geminiKey}`
        )
      : null,
  ]);

  const data: ProviderCatalog[] = [
    {
      name: "openai",
      label: "OpenAI · ChatGPT",
      configured: !!openaiKey,
      reachable: !!openai?.ok,
      problem: openai && !openai.ok ? problemOf(openai.body, openai.status) : undefined,
      models: openai?.ok
        ? filterOpenAI(((openai.body.data as { id: string }[]) || []).map((m) => m.id))
        : [],
      fallbackModel: process.env.THREADS_WRITER_MODEL || "gpt-5.4",
    },
    {
      name: "xai",
      label: "xAI · Grok",
      configured: !!xaiKey,
      reachable: !!xai?.ok,
      problem: xai && !xai.ok ? problemOf(xai.body, xai.status) : undefined,
      models: xai?.ok ? filterXai(((xai.body.data as { id: string }[]) || []).map((m) => m.id)) : [],
      fallbackModel: process.env.SCOUT_XAI_MODEL || "grok-4-fast-non-reasoning",
    },
    {
      name: "gemini",
      label: "Google · Gemini",
      configured: !!geminiKey,
      reachable: !!gemini?.ok,
      problem: gemini && !gemini.ok ? problemOf(gemini.body, gemini.status) : undefined,
      models: gemini?.ok
        ? filterGemini(
            (
              (gemini.body.models as {
                name: string;
                supportedGenerationMethods?: string[];
              }[]) || []
            )
              .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
              .map((m) => m.name.replace(/^models\//, ""))
          )
        : [],
      fallbackModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    },
  ].filter((p) => p.configured);

  cache = { at: Date.now(), data };
  return data;
}
