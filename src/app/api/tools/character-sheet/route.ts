// Character Reference Sheet generator — Nano Banana / Gemini.
// User submits a tiny set of fields + 1-2 reference images; this route
// assembles the full studio-grade character-sheet prompt (the long template
// the team defined) and routes it to Gemini's image model. Charges credits
// via the same pipeline as /api/tools/generate-image.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit, LIMITS } from "@/lib/rateLimit";
import { spendCredits, refundCredits } from "@/lib/credits";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const REASON = "AI_IMAGE_GEN"; // reuse existing credit category
const COST = 25; // higher than nanoPro (15) — this is a premium output

// Sentinel string used in the template wherever the caller didn't supply
// the field. Reads naturally in the prompt: "Name : drawn from reference image"
const FROM_REF = "drawn from reference image";

interface CharFields {
  name: string;
  alias?: string;
  role: string;
  age?: string;
  heritage?: string;
  description: string;
  height?: string;
  build?: string;
  faceShape?: string;
  skinTone?: string;
  eyes?: string;
  hair?: string;
  wardrobe?: string;
  artifacts?: string;
  traits?: string;
}

function fillOrRef(v: string | undefined | null, fallback = FROM_REF): string {
  const s = (v || "").trim();
  return s || fallback;
}

// ─── Prompt assembly ────────────────────────────────────────────────────
// Mirrors the master template the team specified. Filled fields override the
// reference-image fallback. The whole sheet stays in one prompt so the model
// keeps identity locked across all panels.
function buildSheetPrompt(c: CharFields): string {
  const desc = (c.description || "").trim();
  return [
    "STUDIO-QUALITY CHARACTER REFERENCE SHEET — production grade.",
    "Editorial layout, identity locked across every panel, hyper-realistic rendering.",
    "",
    "═══ SECTION 01 — CHARACTER IDENTITY LOCK ═══",
    `Name        : ${fillOrRef(c.name)}`,
    `Alias       : ${fillOrRef(c.alias, "—")}`,
    `Role        : ${fillOrRef(c.role)}`,
    `Age         : ${fillOrRef(c.age)}`,
    `Heritage    : ${fillOrRef(c.heritage)}`,
    "",
    "PHYSICAL BUILD",
    `Height      : ${fillOrRef(c.height)}`,
    `Build       : ${fillOrRef(c.build)}`,
    "",
    "FACIAL ARCHITECTURE",
    `Face shape  : ${fillOrRef(c.faceShape)}`,
    `Skin tone   : ${fillOrRef(c.skinTone)}`,
    `Eyes        : ${fillOrRef(c.eyes)}`,
    "",
    "HAIR SYSTEM",
    `Hair        : ${fillOrRef(c.hair)}`,
    "",
    "WARDROBE — LOCKED OUTFIT",
    `Outfit      : ${fillOrRef(c.wardrobe)}`,
    "",
    "SIGNATURE ARTIFACTS",
    `Carry/items : ${fillOrRef(c.artifacts, "none")}`,
    "",
    "PSYCHOLOGICAL SIGNATURE",
    `Core traits : ${fillOrRef(c.traits)}`,
    "",
    desc && "FREEFORM DESCRIPTION (use as the authoritative source for anything ambiguous):",
    desc,
    "",
    "═══ SECTION 02 — CANVAS + LAYOUT ═══",
    "Canvas: pure white #FFFFFF studio cyclorama, 16:9 landscape, 4K equivalent.",
    "Strict orthogonal grid, 5% margins, 2% gutters, 1px #E5E5E5 hairline dividers.",
    "Header strip (top 6%): NAME · ALIAS · ROLE · AGE · HEIGHT in Inter / Helvetica Neue, charcoal #F2F2F4, 11pt headers, 9pt metadata.",
    "",
    "═══ SECTION 03 — ZONE LAYOUT (every zone populated, single composition) ═══",
    "ZONE A — TURNAROUND ROW (top 35%, full width):",
    "  Four full-body poses, equal spacing: FRONT 0°, THREE-QUARTER 45°, SIDE PROFILE 90°, BACK 180°.",
    "  Neutral A-stance, arms 15° from body, identical height across all four panels.",
    "  85mm lens equivalent, orthographic feel. Key light camera-left 45°, fill 30%, rim back-top.",
    "  Left edge: vertical height scale 0–6ft, monospace 8pt tick labels.",
    "",
    "ZONE B — EXPRESSION MATRIX (middle-right 30%, top half):",
    "  Label \"EXPRESSION PROGRESSION\". 2×4 headshot grid:",
    "  Row 1: NEUTRAL · CURIOUS · WORRIED · SURPRISED.",
    "  Row 2: ANGRY · SAD · DETERMINED · RELIEVED.",
    "  Identical chest-up framing, identical 3/4 head angle. Caps 9pt sans-serif labels centered below each cell.",
    "",
    "ZONE C — MICRO EXPRESSIONS (middle-right 30%, lower):",
    "  Label \"MICRO EXPRESSIONS\". Row of 4 macro face crops:",
    "  EYE TENSION · SLIGHT SMILE · JAW TENSION · CONTROLLED BREATH.",
    "",
    "ZONE D — HEAD ANGLE STUDY (middle-right 30%, bottom):",
    "  Label \"HEAD DETAIL SHEET\". Row of 5 head+shoulder crops:",
    "  THREE-QUARTER FRONT · SIDE PROFILE · TOP-DOWN 15° · LOW ANGLE 15° · BACK THREE-QUARTER.",
    "",
    "ZONE E — POSTURE LIBRARY (bottom-right 30%, top):",
    "  Label \"POSTURE VARIATION\". Baseline NEUTRAL + RELAXED · TENSE · COMBAT-READY full-body silhouettes.",
    "",
    "ZONE F — UPPER-BODY POSE CROPS (bottom-right 30%, lower):",
    "  Label \"CLOSE-UP POSE\". Row of 3 chest-up crops matching above: RELAXED · TENSE · COMBAT-READY.",
    "  Visible facial micro-tension in each.",
    "",
    "ZONE G — WARDROBE + ARTIFACT DETAILS (bottom-left 35%):",
    "  Label \"WARDROBE / ACCESSORIES DETAILS\". Macro close-up grid:",
    "  HAIR STYLE · SHIRT PATTERN · FOOTWEAR · WATCH · RINGS · HANDS RELAXED · HANDS TENSE.",
    "  100mm macro lens, product-photography quality, soft shadowless lighting.",
    "",
    "ZONE H — COLOR PALETTE (top-right corner, 15%):",
    "  Label \"COLOR SYSTEM\". Horizontal strip of 6 swatches:",
    "  Skin tone · Hair · Wardrobe primary · Wardrobe secondary · Accent · Metal/accessory.",
    "  HEX code labeled below each swatch in monospace 8pt.",
    "",
    "═══ SECTION 04 — IDENTITY CONSISTENCY ENFORCEMENT ═══",
    "Same face structure, same proportions, same wardrobe, same hair, same skin tone, same eye color across EVERY panel.",
    "Treat the entire sheet as ONE person photographed in ONE studio session in ONE day.",
    "Zero stylistic drift. Zero identity variation. Zero wardrobe variation.",
    "Only pose, expression, and crop change between panels.",
    "",
    "═══ SECTION 05 — STYLE LINEAGE ═══",
    "Hyper-realistic production reference photography.",
    "Pixar character design + Weta Workshop concept boards + Marvel Studios visual development standards.",
    "Matte non-glossy editorial finish. Neutral diffused studio three-point lighting throughout.",
    "Clinical, professional, documentary clarity. Neutral color grade, no LUT.",
    "Clean sans-serif labels, charcoal on white.",
    "",
    "═══ SECTION 06 — NEGATIVE CONSTRAINTS ═══",
    "No background scenery, no environmental props, no atmospheric effects, no cast shadows on backdrop.",
    "No lighting inconsistency, no stylistic drift, no identity drift, no varied face structure.",
    "No anime, no manga, no painterly brushwork, no oil paint, no watercolor, no illustrated look.",
    "No lens flare, no chromatic aberration, no film grain, no vignette, no color grading variation.",
    "No warped anatomy, no extra limbs, no fused fingers, no malformed hands, no duplicate characters.",
    "No watermarks, no signatures, no text artifacts, no gibberish text, no busy composition, no decorative flourishes.",
    "",
    "═══ SECTION 07 — OUTPUT SPECIFICATION ═══",
    "16:9 landscape composition, maximum resolution / 4K equivalent.",
    "White studio background throughout. All zones populated with locked-identity character.",
    "Editorial reference-sheet typography labels on every section. Production-grade clarity for studio handoff.",
  ].filter(Boolean).join("\n");
}

// ─── Gemini call (Nano Banana) ──────────────────────────────────────────
// Mirrors the call in /api/tools/generate-image. Duplicated rather than
// shared because the existing route is stable and we want this endpoint to
// own its own retry/fallback behavior.
async function callGemini(
  prompt: string,
  refImages: { mimeType: string; data: string }[]
): Promise<{ outBuf: Buffer; outMime: string }> {
  const apiKey = process.env.GEMINI_API_KEY!;
  const primary = process.env.GEMINI_PRO_IMAGE_MODEL || "gemini-2.5-flash-image";
  const candidates = Array.from(
    new Set([
      primary,
      "gemini-2.5-flash-image",
      "gemini-3.1-flash-image-preview",
      "gemini-3-pro-image-preview",
    ])
  );

  const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> =
    refImages.map((r) => ({ inlineData: { mimeType: r.mimeType, data: r.data } }));
  parts.push({ text: prompt });
  const body = JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: { responseModalities: ["IMAGE"] },
  });

  type Part = { inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string } };
  type GR = { candidates?: { content?: { parts?: Part[] } }[]; promptFeedback?: { blockReason?: string } };

  let lastErr: Error | null = null;
  for (const model of candidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const delays = [0, 1500, 4000];
    for (let attempt = 0; attempt < delays.length; attempt++) {
      if (delays[attempt] > 0) await new Promise((r) => setTimeout(r, delays[attempt]));
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      if (res.status === 429 || res.status >= 500) {
        if (attempt === delays.length - 1) { lastErr = new Error(`${model} ${res.status}`); break; }
        continue;
      }
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        const e = new Error(`Gemini зураг үүсгэхэд алдаа (${res.status}) ${t.slice(0, 200)}`);
        (e as { status?: number }).status = 400;
        throw e;
      }
      const data = (await res.json()) as GR;
      if (data.promptFeedback?.blockReason) {
        const e = new Error(`AI хүсэлтийг хориглосон: ${data.promptFeedback.blockReason}`);
        (e as { status?: number }).status = 400;
        throw e;
      }
      const respParts = data.candidates?.[0]?.content?.parts || [];
      const ip = respParts.find((p) => p.inlineData?.data || p.inline_data?.data);
      const b64 = ip?.inlineData?.data || ip?.inline_data?.data;
      const mime = ip?.inlineData?.mimeType || ip?.inline_data?.mime_type || "image/png";
      if (!b64) { lastErr = new Error("Gemini зураг буцаасангүй"); break; }
      return { outBuf: Buffer.from(b64, "base64"), outMime: mime };
    }
  }
  throw new Error(`AI үйлчилгээ түр ачаалалтай байна. (${lastErr?.message || "no models responded"})`);
}

// ─── POST handler ───────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
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

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ error: "Gemini тохируулаагүй" }, { status: 500 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const fields: CharFields = {
    name: String(body.name || "").trim(),
    alias: String(body.alias || "").trim(),
    role: String(body.role || "").trim(),
    age: String(body.age || "").trim(),
    heritage: String(body.heritage || "").trim(),
    description: String(body.description || "").trim(),
    height: String(body.height || "").trim(),
    build: String(body.build || "").trim(),
    faceShape: String(body.faceShape || "").trim(),
    skinTone: String(body.skinTone || "").trim(),
    eyes: String(body.eyes || "").trim(),
    hair: String(body.hair || "").trim(),
    wardrobe: String(body.wardrobe || "").trim(),
    artifacts: String(body.artifacts || "").trim(),
    traits: String(body.traits || "").trim(),
  };

  if (!fields.name || !fields.role || !fields.description) {
    return NextResponse.json(
      { error: "Нэр, role, тайлбар заавал шаардлагатай." },
      { status: 400 }
    );
  }

  // Reference images — required (the model needs an anchor for identity lock).
  const rawList: string[] = Array.isArray(body.inputImages)
    ? (body.inputImages as unknown[]).filter((s): s is string => typeof s === "string")
    : typeof body.inputImage === "string"
      ? [body.inputImage as string]
      : [];
  if (rawList.length === 0) {
    return NextResponse.json({ error: "Reference зураг шаардлагатай." }, { status: 400 });
  }
  if (rawList.length > 4) {
    return NextResponse.json({ error: "Хамгийн ихдээ 4 зураг." }, { status: 400 });
  }

  const refImages: { mimeType: string; data: string }[] = [];
  for (const raw of rawList) {
    const m = raw.match(/^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/);
    if (!m) return NextResponse.json({ error: "Зураг буруу формат" }, { status: 400 });
    const sizeBytes = Math.ceil((m[2].length * 3) / 4);
    if (sizeBytes > 8 * 1024 * 1024) {
      return NextResponse.json({ error: "Зураг 8MB-аас бага байх ёстой" }, { status: 400 });
    }
    refImages.push({ mimeType: m[1], data: m[2] });
  }

  const prompt = buildSheetPrompt(fields);

  // Charge credits up-front, refund on upstream failure.
  const charged = await spendCredits({
    userId,
    amount: COST,
    reason: REASON,
    meta: { tool: "character-sheet", name: fields.name, role: fields.role },
  });
  if (!charged.ok) {
    return NextResponse.json(
      { error: `Кредит хүрэлцэхгүй. ${COST} кредит шаардлагатай.`, balance: charged.balance, required: COST },
      { status: 402 }
    );
  }

  let outBuf: Buffer;
  let outMime: string;
  try {
    ({ outBuf, outMime } = await callGemini(prompt, refImages));
  } catch (err) {
    await refundCredits({ userId, amount: COST, reason: REASON });
    const msg = err instanceof Error ? err.message : "AI алдаа";
    const status = (err as { status?: number }).status === 400 ? 400 : 502;
    return NextResponse.json({ error: msg }, { status });
  }

  const ext = outMime.includes("jpeg") ? "jpg" : outMime.includes("webp") ? "webp" : "png";
  await mkdir(UPLOAD_DIR, { recursive: true });
  const filename = `char-sheet-${randomUUID()}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), outBuf);

  return NextResponse.json({
    url: `/uploads/${filename}`,
    cost: COST,
    balance: charged.balance,
    name: fields.name,
    role: fields.role,
  });
}

export const dynamic = "force-dynamic";
export const maxDuration = 90;
