import dbConnect from "@/lib/mongodb";
import CompanionDoc from "@/models/CompanionDoc";
import { retrieve } from "@/lib/companionRetrieve";

/* ─── Antaqor AI сурах давхарга (2026-10-13) ──────────────────────────────
   chunkText — урт текстийг догол мөрөөр ≤1100 тэмдэгтийн хэсэг болгоно.
   getLearnedBlock(query) — асуултад хамгийн хамааралтай 5 мэдлэгийн хэсэг
   ($text score) + 6 хэв маягийн жишээ (хамааралтай нь эхэнд, үлдсэн нь
   санамсаргүй) → system prompt-ын блок. Хоосон бол "". */

export function chunkText(raw: string, max = 1100): string[] {
  const text = raw.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!text) return [];
  const paras = text.split(/\n\s*\n/);
  const out: string[] = [];
  let cur = "";
  for (const p0 of paras) {
    const p = p0.trim();
    if (!p) continue;
    if (p.length > max) {
      if (cur) { out.push(cur); cur = ""; }
      const sentences = p.split(/(?<=[.!?。…])\s+/);
      let buf = "";
      for (const s of sentences) {
        if ((buf + " " + s).length > max) { if (buf) out.push(buf.trim()); buf = s.slice(0, max); }
        else buf = buf ? `${buf} ${s}` : s;
      }
      if (buf) out.push(buf.trim());
      continue;
    }
    if ((cur + "\n\n" + p).length > max) { if (cur) out.push(cur); cur = p; }
    else cur = cur ? `${cur}\n\n${p}` : p;
  }
  if (cur) out.push(cur);
  return out.filter((c) => c.length >= 20);
}

function queryTerms(q: string): string {
  // $text-д утгагүй богино үгсийг хасна.
  return q.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length >= 3).slice(0, 12).join(" ");
}

export async function getLearnedBlock(query: string): Promise<string> {
  try {
    await dbConnect();
    const terms = queryTerms(query || "");
    type Row = { text: string; source: string };
    let know: Row[] = [];
    let voiceHit: Row[] = [];
    /* 2026-10-17: hybrid RAG (утга + түлхүүр үг). Алдаа гарвал доорх $text замаар. */
    let ragOk = false;
    if (query && query.trim().length >= 2) {
      try {
        const [k, v] = await Promise.all([retrieve(query, "knowledge", 5), retrieve(query, "voice", 3)]);
        know = k.hits; voiceHit = v.hits; ragOk = true;
      } catch { ragOk = false; }
    }
    if (!ragOk && terms) {
      [know, voiceHit] = await Promise.all([
        CompanionDoc.find({ kind: "knowledge", $text: { $search: terms } }, { score: { $meta: "textScore" }, text: 1, source: 1 })
          .sort({ score: { $meta: "textScore" } }).limit(5).lean() as unknown as Promise<Row[]>,
        CompanionDoc.find({ kind: "voice", $text: { $search: terms } }, { score: { $meta: "textScore" }, text: 1, source: 1 })
          .sort({ score: { $meta: "textScore" } }).limit(3).lean() as unknown as Promise<Row[]>,
      ]);
    }
    const voiceRand = (await CompanionDoc.aggregate([{ $match: { kind: "voice" } }, { $sample: { size: 6 } }, { $project: { text: 1, source: 1 } }])) as Row[];
    const seen = new Set<string>();
    const voice = [...voiceHit, ...voiceRand].filter((v) => { const k = v.text.slice(0, 80); if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 6);
    if (!know.length && !voice.length) return "";
    const parts: string[] = [];
    if (know.length) {
      parts.push(`═══ ЧИНИЙ ӨӨРИЙН МАТЕРИАЛ (энэ асуулттай хамааралтай — эндээс л баримт ав, зохиож болохгүй) ═══\n${know.map((k, i) => `[${i + 1}] (${k.source}) ${k.text}`).join("\n\n")}`);
    }
    if (voice.length) {
      parts.push(`═══ ЧИНИЙ БИЧИХ ХЭВ МАЯГ (жинхэнэ жишээ — үг хэллэг, хэмнэл, богино байдлыг ЯГ ингэж дуурай; агуулгыг нь хуулахгүй) ═══\n${voice.map((v) => `— ${v.text.slice(0, 400)}`).join("\n")}`);
    }
    return parts.join("\n\n");
  } catch (e) {
    console.error("[companionLearn]", e);
    return "";
  }
}
