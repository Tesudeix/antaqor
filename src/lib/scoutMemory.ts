import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import ScoutMemory, { IScoutMemory } from "@/models/ScoutMemory";
import { providers, chatCompletion } from "@/lib/scoutProvider";

/* ─── Ой: агент харьцах тусам хувийн болдог механизм ───────────────────────

   ЯАГААД ЗАГВАРЫГ СУРГАДАГГҮЙ ВЭ. "AI маань миний дата дээр суралцана"
   гэдэг нь practice дээр загварын жинг өөрчлөх гэсэн үг БИШ — тэр нь үнэтэй,
   удаан, буцаах боломжгүй. Бодит хувийн туршлага нь загвараас биш, ЭНД
   хадгалагдаж буй хэдэн мөрөөс гарна: хүн хаана байдаг, хэдүүлээ явдаг,
   ямар төсөвтэй, юуг татгалздаг. Тэдгээрийг дараагийн ярианы эхэнд
   системийн зааварт цутгавал гуравдахь удаагийн асуулт нь эхнийхээсээ
   мэдэгдэхүйц ухаалаг болно.

   ЯАГААД ЗАДЛАХ АЛХАМ ХЭРЭГТЭЙ ВЭ. Ярианы бүтэн текстийг хадгалж
   prompt-д цутгах нь 20 ээлжийн дараа үнэтэй, удаан, бас гол зүйлийг
   дуу чимээнд булна. Тиймээс ээлж бүрийн дараа ЖИЖИГ дуудлага хийж
   "энэ ярианаас ТОГТВОРТОЙ юу мэдэгдэв" гэдгийг JSON болгон гаргаж авна.

   ЯАГААД ХАРИУЛТЫГ ХҮЛЭЭЛГЭДЭГГҮЙ ВЭ. Задлалт нь хэрэглэгчийн хариултад
   ХЭРЭГГҮЙ — тэр дараагийн асуултад л хэрэгтэй. pm2 доорх Node процесс
   удаан амьдардаг тул хариултаа буцаачихаад далд ажиллуулж болно. Ингэснээр
   "30 секунд" гэсэн амлалт хэвээрээ.                                      */

export interface ScoutProfile {
  district: string;
  area: string;
  budgetPerPerson: number;
  partySize: number;
  likes: string[];
  dislikes: string[];
  facts: string[];
  summary: string;
  totalQueries: number;
}

const EMPTY: ScoutProfile = {
  district: "", area: "", budgetPerPerson: 0, partySize: 0,
  likes: [], dislikes: [], facts: [], summary: "", totalQueries: 0,
};

export async function loadProfile(userId: string): Promise<ScoutProfile> {
  if (!mongoose.isValidObjectId(userId)) return { ...EMPTY };
  await dbConnect();
  const m = await ScoutMemory.findOne({ user: userId }).lean<IScoutMemory>();
  if (!m) return { ...EMPTY };
  return {
    district: m.district || "",
    area: m.area || "",
    budgetPerPerson: m.budgetPerPerson || 0,
    partySize: m.partySize || 0,
    likes: m.likes || [],
    dislikes: m.dislikes || [],
    facts: m.facts || [],
    summary: m.summary || "",
    totalQueries: m.totalQueries || 0,
  };
}

/** Профайлыг системийн зааварт оруулах блок болгоно. Хоосон бол хоосон
 *  мөр буцаана — "мэдэхгүй" гэдгээ хуурамч талбараар дүүргэхгүй. */
export function profileBlock(p: ScoutProfile): string {
  const lines: string[] = [];
  if (p.district) lines.push(`- Байнга хайдаг дүүрэг: ${p.district}${p.area ? ` (${p.area})` : ""}`);
  if (p.budgetPerPerson > 0) lines.push(`- Ердийн төсөв: ~${p.budgetPerPerson.toLocaleString("en-US")}₮ / хүн`);
  if (p.partySize > 0) lines.push(`- Ихэвчлэн ${p.partySize} хүнтэй явдаг`);
  if (p.likes.length) lines.push(`- Дуртай: ${p.likes.slice(0, 6).join(", ")}`);
  if (p.dislikes.length) lines.push(`- Дургүй: ${p.dislikes.slice(0, 6).join(", ")}`);
  if (p.facts.length) lines.push(`- Бусад: ${p.facts.slice(0, 5).join("; ")}`);
  if (p.summary) lines.push(`- Хураангуй: ${p.summary}`);
  if (lines.length === 0) return "";

  return `

ЭНЭ ХЭРЭГЛЭГЧИЙН ТУХАЙ (өмнөх яриануудаас):
${lines.join("\n")}
Эдгээрийг ДАХИН БҮҮ АСУУ — аль хэдийн мэдэж байгаа. Хэрэглэгч тодорхойгүй асуувал (жишээ нь "хаана идэх вэ") эдгээрийг АНХДАГЧ нөхцөл болгон шууд хай, дараа нь "${p.district || "таны дүүрэг"}-ээр хайлаа, өөрчлөх үү?" гэж НЭГ мөрөөр мэдэгд.`;
}

/** Хэрэглэгч UI дээрээс гараар өөрчилсөн талбарууд. */
export async function patchProfile(
  userId: string,
  patch: Partial<Pick<ScoutProfile, "district" | "area" | "budgetPerPerson" | "partySize">>
): Promise<ScoutProfile> {
  await dbConnect();
  const set: Record<string, unknown> = {};
  if (typeof patch.district === "string") set.district = patch.district.slice(0, 40);
  if (typeof patch.area === "string") set.area = patch.area.slice(0, 60);
  if (typeof patch.budgetPerPerson === "number") set.budgetPerPerson = Math.max(0, Math.round(patch.budgetPerPerson));
  if (typeof patch.partySize === "number") set.partySize = Math.min(50, Math.max(0, Math.round(patch.partySize)));
  await ScoutMemory.findOneAndUpdate(
    { user: userId },
    { $set: set, $setOnInsert: { user: userId } },
    { upsert: true, new: true }
  );
  return loadProfile(userId);
}

const EXTRACT_SYSTEM = `You extract STABLE preferences about a diner from one exchange with a restaurant-finding agent.

Return ONLY a JSON object, no prose, no markdown fence:
{"district":"","area":"","budgetPerPerson":0,"partySize":0,"likes":[],"dislikes":[],"facts":[],"summary":""}

Hard rules:
- Only fill a field if the USER stated or clearly implied it. Empty string / 0 / [] means "not stated". NEVER guess.
- district: one of Khan-Uul, Sukhbaatar, Bayanzurkh, Chingeltei, Bayangol, Songinokhairkhan, Nalaikh — Latin spelling. Only if the user said where THEY are or where they want to eat.
- budgetPerPerson: tugrik per person. If they said a total for N people, divide.
- likes/dislikes: short Mongolian phrases about food or atmosphere ("нүүрсэн грилл", "чимээгүй газар"). Max 3 each, only NEW durable ones. Not one-off requests.
- facts: durable non-food facts that change recommendations (e.g. "машинтай", "хүүхэдтэй явдаг"). Max 2.
- summary: max 20 Mongolian words describing this diner. Empty if nothing durable was learned.
- A one-time question ("өнөөдөр хямдхан газар") is NOT a durable preference. Prefer returning empty fields over inventing.`;

interface Extracted {
  district?: string; area?: string; budgetPerPerson?: number; partySize?: number;
  likes?: string[]; dislikes?: string[]; facts?: string[]; summary?: string;
}

function cleanList(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => String(x).trim()).filter((x) => x.length > 1 && x.length <= 60).slice(0, max);
}

/** Массивуудыг НЭГТГЭНЭ (солихгүй) — хүний амт хуримтлагддаг, солигддоггүй.
 *  Дээд хязгаар нь prompt хэтрэхээс сэргийлнэ; хамгийн сүүлийнх нь үлдэнэ. */
function mergeList(existing: string[], incoming: string[], cap: number): string[] {
  const seen = new Set(existing.map((x) => x.toLowerCase()));
  const add = incoming.filter((x) => !seen.has(x.toLowerCase()));
  return [...existing, ...add].slice(-cap);
}

/** Ээлж бүрийн дараа далд ажиллана. Алдаа гарвал ЧИМЭЭГҮЙ унана — ой
 *  шинэчлэгдэхгүй байх нь хэрэглэгчийн хариултыг унагахаас хамаагүй дээр. */
export async function learnFromTurn(args: {
  userId: string;
  question: string;
  reply: string;
}): Promise<void> {
  const { userId, question, reply } = args;
  if (!mongoose.isValidObjectId(userId)) return;

  await dbConnect();
  // Тоолуурыг эхэлж нэмнэ — задлалт унасан ч харьцсан тоо үнэн байх ёстой.
  await ScoutMemory.findOneAndUpdate(
    { user: userId },
    { $inc: { totalQueries: 1 }, $set: { lastAt: new Date() }, $setOnInsert: { user: userId } },
    { upsert: true }
  );

  const list = providers();
  if (list.length === 0) return;

  let raw = "";
  for (const p of list) {
    const choice = await chatCompletion(
      p,
      [
        { role: "system", content: EXTRACT_SYSTEM },
        { role: "user", content: `USER SAID:\n${question.slice(0, 600)}\n\nAGENT REPLIED:\n${reply.slice(0, 900)}` },
      ],
      { maxTokens: 300, temperature: 0, timeoutMs: 20_000 }
    );
    raw = (choice?.message?.content || "").trim();
    if (raw) break;
  }
  if (!raw) return;

  // Загвар заримдаа ```json хашилтаар ороодог — тайлж авна.
  const fence = /```(?:json)?\s*([\s\S]*?)```/.exec(raw);
  if (fence) raw = fence[1].trim();

  let data: Extracted;
  try {
    data = JSON.parse(raw) as Extracted;
  } catch {
    return;
  }

  const current = await ScoutMemory.findOne({ user: userId });
  if (!current) return;

  const set: Record<string, unknown> = {};
  if (typeof data.district === "string" && data.district.trim()) set.district = data.district.trim().slice(0, 40);
  if (typeof data.area === "string" && data.area.trim()) set.area = data.area.trim().slice(0, 60);
  if (Number(data.budgetPerPerson) > 0) set.budgetPerPerson = Math.round(Number(data.budgetPerPerson));
  if (Number(data.partySize) > 0) set.partySize = Math.min(50, Math.round(Number(data.partySize)));
  if (typeof data.summary === "string" && data.summary.trim()) set.summary = data.summary.trim().slice(0, 600);

  set.likes = mergeList(current.likes || [], cleanList(data.likes, 3), 10);
  set.dislikes = mergeList(current.dislikes || [], cleanList(data.dislikes, 3), 10);
  set.facts = mergeList(current.facts || [], cleanList(data.facts, 2), 8);

  await ScoutMemory.updateOne({ user: userId }, { $set: set });
}
