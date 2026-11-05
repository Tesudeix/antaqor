import { createHash } from "crypto";

/* ─── Embedding үйлчилгээ (2026-10-17) ───────────────────────────────────
   OpenAI text-embedding-3-small, 512 хэмжээс (Matryoshka — 1536-аас бага ч
   чанар бараг ижил, санах ой 3× бага: 50k хэсэг ≈ 100MB). Нэг төсөлд НЭГ
   загвар — өөр загварын векторыг хольж харьцуулж болохгүй, тиймээс
   EMB_MODEL-ийг баримт бүр дээр хадгална; солих бол бүгдийг дахин векторжуулна. */

export const EMB_MODEL = "openai/text-embedding-3-small@512";
const DIM = 512;
const cache = new Map<string, number[]>(); // асуултын кэш (давтагддаг асуулт)

function norm(v: number[]): number[] {
  let s = 0; for (const x of v) s += x * x;
  const n = Math.sqrt(s) || 1;
  return v.map((x) => x / n);
}

/** Олон текстийг нэг дуудлагаар (≤96 ширхэг/багц). Нормчилсон вектор буцаана. */
export async function embedMany(texts: string[], timeoutMs = 20000): Promise<number[][]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY алга");
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 96) {
    const batch = texts.slice(i, i + 96).map((t) => t.replace(/\s+/g, " ").slice(0, 6000) || " ");
    const r = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "text-embedding-3-small", input: batch, dimensions: DIM }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`embedding ${r.status}: ${d?.error?.message || "алдаа"}`);
    for (const row of d.data as { embedding: number[] }[]) out.push(norm(row.embedding));
  }
  return out;
}

export async function embedQuery(q: string): Promise<number[]> {
  const k = createHash("sha1").update(q.trim().toLowerCase()).digest("hex");
  const hit = cache.get(k);
  if (hit) return hit;
  const [v] = await embedMany([q], 4000);
  if (cache.size > 500) cache.clear();
  cache.set(k, v);
  return v;
}
