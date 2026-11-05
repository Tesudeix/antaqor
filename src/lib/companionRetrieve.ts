import dbConnect from "@/lib/mongodb";
import CompanionDoc from "@/models/CompanionDoc";
import { embedQuery } from "@/lib/embeddings";
import { vectorSearch } from "@/lib/vectorIndex";

/* ─── Hybrid retrieval (2026-10-17) ──────────────────────────────────────
   1) вектор хайлт (утгаар) — top 12
   2) түлхүүр үгийн $text хайлт (нэр, код, тоо яг таарах) — top 12
   3) Reciprocal Rank Fusion: score = Σ 1/(60 + rank)
   4) шүүлтүүр: вектор ижил төстэй байдал < MIN_SIM БӨГӨӨД түлхүүр үгээр
      олдоогүй бол хаяна (хамааралгүй хэсэг AI-г төөрөгдүүлдэг)
   Embedding алдаа гарвал $text-ээр л ажиллана (чат хэзээ ч зогсохгүй). */

export const MIN_SIM = 0.3;
export type Hit = { id: string; source: string; text: string; sim: number | null; viaText: boolean; score: number };

function terms(q: string): string {
  return q.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length >= 3).slice(0, 12).join(" ");
}

export async function retrieve(query: string, kind: "knowledge" | "voice", k = 5): Promise<{ hits: Hit[]; mode: "hybrid" | "text" }> {
  await dbConnect();
  const t = terms(query);
  const textP = t
    ? (CompanionDoc.find({ kind, $text: { $search: t } }, { score: { $meta: "textScore" }, text: 1, source: 1 })
        .sort({ score: { $meta: "textScore" } }).limit(12).lean() as unknown as Promise<{ _id: unknown; text: string; source: string }[]>)
    : Promise.resolve([] as { _id: unknown; text: string; source: string }[]);
  let vec: { id: string; source: string; text: string; sim: number }[] = [];
  let mode: "hybrid" | "text" = "hybrid";
  try { vec = await vectorSearch(await embedQuery(query), kind, 12); } catch { mode = "text"; }
  const txt = await textP.catch(() => []);

  const m = new Map<string, Hit>();
  vec.forEach((v, r) => m.set(v.id, { id: v.id, source: v.source, text: v.text, sim: v.sim, viaText: false, score: 1 / (60 + r) }));
  txt.forEach((d, r) => {
    const id = String(d._id); const h = m.get(id);
    if (h) { h.viaText = true; h.score += 1 / (60 + r); }
    else m.set(id, { id, source: d.source, text: d.text, sim: null, viaText: true, score: 1 / (60 + r) });
  });
  const hits = [...m.values()]
    .filter((h) => h.viaText || (h.sim ?? 0) >= MIN_SIM)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
  return { hits, mode };
}
