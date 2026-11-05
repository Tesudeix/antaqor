import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import { ZVec } from "@/models/ZAgent";
import { embedMany } from "@/lib/embeddings";

/* ─── /z вектор санах ой (2026-11-04) ─────────────────────────────────────────
   Self-hosted Mongo-д $vectorSearch алга тул vectorIndex.ts-ийн аргаар процесс
   дотор cosine (нормчилсон → dot product). Гурван төрөл:
   voice   — 1% датасетийн пост (нэр, утас, линк арилгасан): монгол хэллэг,
             бодит нөхцөл. scripts/z-vec-import.cjs ачаална.
   outcome — хаагдсан 7 хоногийн туршилт (бүх гишүүн): юу ажилласан, юу үгүй.
   msg     — гишүүний өөрийн мессеж: хуучин яриагаа эргэн санах (зөвхөн өөрт нь).
   Бусдын бичвэрийг модель зөвхөн контекст болгон уншина — ишлэхгүй, нэрлэхгүй.

   ХОЁР орон зай (хооронд нь харьцуулж БОЛОХГҮЙ): OpenAI text-embedding-3-small@512
   (ref «voice:…») ба Gemini gemini-embedding-001@512 (ref «g:voice:…»). Асуултыг
   ажиллаж буй эхнийхээр векторжуулж, зөвхөн тэр орон зайн баримтуудаас хайна.
   2026-11-04: OpenAI кредит дууссан, Gemini үнэгүй түвшин (embed өдөрт 1000). */

type Space = { model: string; prefix: string; min: { voice: number; outcome: number; recall: number }; call: (t: string[], ms: number) => Promise<number[][]> };

function norm(v: number[]) {
  let s = 0; for (const x of v) s += x * x;
  const n = Math.sqrt(s) || 1;
  return v.map((x) => x / n);
}

/** Gemini-ийн OpenAI-нийцтэй embeddings (512 хэмжээс тасалсан тул заавал нормчилно). */
async function embedGemini(texts: string[], timeoutMs: number): Promise<number[][]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY алга");
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 64) {
    const batch = texts.slice(i, i + 64).map((t) => t.replace(/\s+/g, " ").slice(0, 6000) || " ");
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gemini-embedding-001", input: batch, dimensions: 512 }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`embedding ${r.status}: ${String(d?.error?.message || "алдаа").slice(0, 120)}`);
    for (const row of d.data as { embedding: number[] }[]) out.push(norm(row.embedding));
  }
  return out;
}

/* Босго орон зай бүрт өөр: OpenAI-д cosine өргөн тархсан, Gemini-д шахагдсан
   (хамааралгүй ≈0.54, ойрхон ≈0.65–0.75 — 2026-11-04 хэмжсэн). */
const SPACES: Space[] = [
  { model: "openai/text-embedding-3-small@512", prefix: "", min: { voice: 0.3, outcome: 0.35, recall: 0.4 }, call: (t, ms) => embedMany(t, ms) },
  { model: "google/gemini-embedding-001@512", prefix: "g:", min: { voice: 0.58, outcome: 0.62, recall: 0.66 }, call: embedGemini },
];
const down = new Map<string, number>();

/** Ажиллаж буй эхний орон зайгаар векторжуулна; төлбөр/квотын алдаатайг 10 мин алгасна. */
async function embedAny(texts: string[], timeoutMs = 8000): Promise<{ space: Space; vecs: number[][] } | null> {
  for (const space of SPACES) {
    if ((down.get(space.model) || 0) > Date.now()) continue;
    try {
      return { space, vecs: await space.call(texts, timeoutMs) };
    } catch (e) {
      if (/ 40[123]| 429|credit|quota|billing/i.test((e as Error).message)) down.set(space.model, Date.now() + 10 * 60e3);
    }
  }
  return null;
}

type Row = { _id: Types.ObjectId; kind: string; user?: Types.ObjectId | null; text: string; meta?: Record<string, unknown>; vector?: number[]; embModel?: string; createdAt?: Date };
type Item = { kind: string; model: string; user: string; text: string; meta: Record<string, unknown>; v: Float32Array };
export type Hit = { text: string; meta: Record<string, unknown>; sim: number };
export type Query = { space: Space; q: number[]; m: number[] };

let shared: Item[] | null = null;
let loadedAt = 0;
let loading: Promise<Item[]> | null = null;

/** Хувийн мэдээлэл арилгана: линк, имэйл, @нэр, утас (5–9-өөр эхэлсэн 8 орон — он «2025-2026» биш), данс/карт (10+ орон), «намайг X гэдэг». */
export function scrub(t: string) {
  return t
    .replace(/https?:\/\/\S+|www\.\S+/gi, "[линк]")
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[имэйл]")
    .replace(/(^|[^\w])@[\w.]{2,}/g, "$1[хаяг]")
    .replace(/\b\d{10,}\b/g, "[тоо]")
    .replace(/(\+?976[\s-]?)?\b[5-9]\d{3}[\s-]?\d{4}\b/g, "[утас]")
    .replace(/(намайг|миний нэрийг|миний нэр)\s+[А-ЯӨҮЁA-Z][\p{L}-]{1,20}/giu, "$1 [нэр]");
}

export function invalidate() { shared = null; }

async function loadShared(): Promise<Item[]> {
  if (shared && Date.now() - loadedAt < 30 * 60e3) return shared;
  if (loading) return loading;
  loading = (async () => {
    await dbConnect();
    const rows = await ZVec.find({ kind: { $in: ["voice", "outcome"] }, embModel: { $in: SPACES.map((s) => s.model) } }).select("+vector kind user text meta embModel").lean<Row[]>();
    shared = rows.filter((r) => r.vector?.length).map((r) => ({
      kind: r.kind, model: r.embModel || "", user: r.user ? String(r.user) : "", text: r.text, meta: r.meta || {}, v: Float32Array.from(r.vector!),
    }));
    loadedAt = Date.now(); loading = null;
    return shared;
  })().catch((e) => { loading = null; throw e; });
  return loading;
}

function dot(a: Float32Array, b: Float32Array) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

const BIZ = new Set(["business", "ecommerce", "content", "personal_brand", "affiliate"]);

/**
 * Нэг асуултын вектороор гурван санах ойгоос татна (зөвхөн асуултын орон зайд):
 * voice — ижил нөхцөлтэй гишүүдийн пост (бизнесийн сэдэвтэйг бага зэрэг дээшлүүлнэ),
 * outcome — бусдын туршилтын үр дүн, recalled — гишүүний өөрийн хуучин мессеж.
 */
export async function retrieve(user: string, query: Query, skip: Set<string>) {
  const { space } = query;
  const qv = Float32Array.from(query.q);
  const [all, mine] = await Promise.all([
    loadShared(),
    ZVec.find({ kind: "msg", user: new Types.ObjectId(user), embModel: space.model }).sort({ createdAt: -1 }).limit(1500).select("+vector text createdAt").lean<Row[]>(),
  ]);
  const voice: Hit[] = [];
  const outcome: Hit[] = [];
  for (const it of all) {
    if (it.model !== space.model) continue;
    if (it.kind === "voice") {
      const focus = Array.isArray(it.meta.focus) ? (it.meta.focus as string[]) : [];
      voice.push({ text: it.text, meta: it.meta, sim: dot(qv, it.v) + (focus.some((f) => BIZ.has(f)) ? 0.03 : 0) });
    } else if (it.kind === "outcome" && it.user !== user) outcome.push({ text: it.text, meta: it.meta, sim: dot(qv, it.v) });
  }
  const recalled: Hit[] = mine
    .filter((r) => r.vector?.length && !skip.has(r.text))
    .map((r) => ({ text: r.text, meta: { at: r.createdAt }, sim: dot(qv, Float32Array.from(r.vector!)) }));
  const top = (a: Hit[], k: number, min: number) => a.filter((h) => h.sim >= min).sort((x, y) => y.sim - x.sim).slice(0, k);
  return { voice: top(voice, 4, space.min.voice), outcome: top(outcome, 3, space.min.outcome), recalled: top(recalled, 4, space.min.recall) };
}

/** Асуултын болон хадгалах мессежийн векторыг нэг дуудлагаар авна. Аль ч орон зай ажиллахгүй бол null — яриа зогсохгүй. */
export async function embedPair(query: string, message: string): Promise<Query | null> {
  const r = await embedAny([query, message]);
  return r ? { space: r.space, q: r.vecs[0], m: r.vecs[1] } : null;
}

export async function rememberMsg(user: string, msgId: string, text: string, query: Query) {
  await ZVec.updateOne(
    { ref: `${query.space.prefix}msg:${msgId}` },
    { $set: { kind: "msg", user: new Types.ObjectId(user), text: text.slice(0, 2000), vector: query.m, embModel: query.space.model } },
    { upsert: true },
  );
}

/** Хаагдсан туршилт → бүх гишүүнд суралцах «юу ажилласан» мөр (хувийн мэдээлэлгүй). */
export async function rememberOutcome(user: string, testId: string, text: string, meta: Record<string, unknown>) {
  const clean = scrub(text).slice(0, 1200);
  const r = await embedAny([clean]);
  if (!r) return;
  await ZVec.updateOne(
    { ref: `${r.space.prefix}outcome:${testId}` },
    { $set: { kind: "outcome", user: new Types.ObjectId(user), text: clean, meta, vector: r.vecs[0], embModel: r.space.model } },
    { upsert: true },
  );
  invalidate();
}

export async function forgetUser(user: string) {
  await ZVec.deleteMany({ user: new Types.ObjectId(user) });
  invalidate();
}

export async function vecStats() {
  await dbConnect();
  const rows = await ZVec.aggregate([{ $group: { _id: { kind: "$kind", model: "$embModel" }, n: { $sum: 1 } } }]);
  return rows.map((r) => `${r._id.kind}@${String(r._id.model).split("/")[0]}: ${r.n}`);
}
