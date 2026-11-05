import type { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import CompanionDoc from "@/models/CompanionDoc";
import { EMB_MODEL, embedMany } from "@/lib/embeddings";

/* ─── Санах ойн вектор индекс (2026-10-17) ───────────────────────────────
   Self-hosted Mongo 7-д $vectorSearch байхгүй (зөвхөн Atlas). Тиймээс
   векторууд Mongo-д хадгалагдаж, хайлт процесс дотор Float32Array дээр
   явагдана (нормчилсон тул cosine = dot product). Бичилт бүрийн дараа
   invalidate() дуудна; 5 мин тутам ч өөрөө шинэчлэгдэнэ. 10k хэсэгт
   нэг хайлт ~2мс. */

type Item = { id: string; kind: string; source: string; text: string; v: Float32Array };
let items: Item[] | null = null;
let loadedAt = 0;
let loading: Promise<Item[]> | null = null;

export function invalidate() { items = null; }

async function load(): Promise<Item[]> {
  if (items && Date.now() - loadedAt < 5 * 60e3) return items;
  if (loading) return loading;
  loading = (async () => {
    await dbConnect();
    const rows = await CompanionDoc.find({ embModel: EMB_MODEL }).select("+vector kind source text").lean<{ _id: unknown; kind: string; source: string; text: string; vector: number[] }[]>();
    items = rows.filter((r) => r.vector?.length).map((r) => ({ id: String(r._id), kind: r.kind, source: r.source, text: r.text, v: Float32Array.from(r.vector) }));
    loadedAt = Date.now(); loading = null;
    return items;
  })().catch((e) => { loading = null; throw e; });
  return loading;
}

export async function vectorSearch(q: number[], kind: string, k = 12): Promise<{ id: string; source: string; text: string; sim: number }[]> {
  const all = await load();
  const qv = Float32Array.from(q);
  const out: { it: Item; sim: number }[] = [];
  for (const it of all) {
    if (it.kind !== kind) continue;
    let s = 0; const v = it.v;
    for (let i = 0; i < v.length; i++) s += v[i] * qv[i];
    out.push({ it, sim: s });
  }
  out.sort((a, b) => b.sim - a.sim);
  return out.slice(0, k).map(({ it, sim }) => ({ id: it.id, source: it.source, text: it.text, sim: Math.round(sim * 1000) / 1000 }));
}

/** Вектор нь алга (эсвэл өөр загвартай) хэсгүүдийг векторжуулна. */
export async function embedPending(limit = 2000): Promise<{ embedded: number; remaining: number }> {
  await dbConnect();
  const q = { $or: [{ embModel: { $ne: EMB_MODEL } }, { vector: { $exists: false } }] };
  const rows = await CompanionDoc.find(q).select("_id text source").limit(limit).lean<{ _id: Types.ObjectId; text: string; source: string }[]>();
  let done = 0;
  for (let i = 0; i < rows.length; i += 96) {
    const batch = rows.slice(i, i + 96);
    /* эх сурвалжийн нэрийг хамт векторжуулна — "Үнийн жагсаалт" гарчигтай хэсэг "үнэ" асуултад ойртоно */
    const vecs = await embedMany(batch.map((r) => `${r.source}\n${r.text}`));
    await CompanionDoc.bulkWrite(batch.map((r, j) => ({ updateOne: { filter: { _id: r._id }, update: { $set: { vector: vecs[j], embModel: EMB_MODEL } } } })));
    done += batch.length;
  }
  if (done) invalidate();
  const remaining = await CompanionDoc.countDocuments(q);
  return { embedded: done, remaining };
}

export async function vectorStats() {
  await dbConnect();
  const [total, embedded] = await Promise.all([CompanionDoc.countDocuments(), CompanionDoc.countDocuments({ embModel: EMB_MODEL })]);
  return { total, embedded, model: EMB_MODEL };
}
