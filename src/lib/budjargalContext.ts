// Live Budjargal context: top admin-curated knowledge entries, cached so
// chat turns don't hammer the DB. Mirrors companionContext but scoped to
// Budjargal's collection.

import dbConnect from "@/lib/mongodb";
import BudjargalKnowledge from "@/models/BudjargalKnowledge";

interface FactBrief { topic: string; content: string; source?: string }

export interface BudjargalLiveContext {
  facts: FactBrief[];
  loadedAt: number;
}

let cache: BudjargalLiveContext | null = null;
const TTL_MS = 60_000;

export async function getBudjargalContext(): Promise<BudjargalLiveContext> {
  const now = Date.now();
  if (cache && now - cache.loadedAt < TTL_MS) return cache;

  await dbConnect();
  const factDocs = await BudjargalKnowledge.find({ active: true })
    .sort({ weight: -1, updatedAt: -1 })
    .limit(8)
    .select("topic content source")
    .lean();

  cache = {
    facts: factDocs.map((f) => ({
      topic: String((f as { topic?: string }).topic || ""),
      content: String((f as { content?: string }).content || ""),
      source: String((f as { source?: string }).source || ""),
    })),
    loadedAt: now,
  };
  return cache;
}

export function invalidateBudjargalContext() {
  cache = null;
}

export function buildBudjargalLiveBlock(ctx: BudjargalLiveContext): string {
  if (ctx.facts.length === 0) return "";
  const lines = ctx.facts.map((f) => {
    const src = f.source ? ` [${f.source}]` : "";
    return `• [${f.topic}] ${f.content}${src}`;
  }).join("\n");
  return `═══ ADMIN-CURATED LIVE CORPUS ═══
Эдгээрийг ярианд хамаатай үед reference хий, source-ыг тодорхойгүй гэвэл бүү дурд.
${lines}`;
}
