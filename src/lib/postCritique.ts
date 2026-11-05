import { providers, chatCompletion } from "@/lib/scoutProvider";
import { VOICE_SPEC, THREADS_MAX_CHARS, voiceWarnings } from "@/lib/threadsVoice";
import { getBrand, brandPromptBlock, valueNames } from "@/lib/brandProfile";
import ContentMetric from "@/models/ContentMetric";
import dbConnect from "@/lib/mongodb";

/* ─── ПОСТЫГ ДҮГНЭХ ─────────────────────────────────────────────────────
   Хүний бичсэн ноорог дээр: дүрмийн шалгалт + AI-ийн дүгнэлт +
   сайжруулсан хувилбар.

   Хоёр давхарга байгаа нь санамсаргүй биш:
     · `voiceWarnings` нь ДЕТЕРМИНИСТ — догол мөр, "бид", hashtag зэрэг
       барьж болох зүйлийг AI-гүйгээр шууд барина. Үнэгүй, тогтвортой.
     · AI нь зөвхөн дүгнэж чадахгүй зүйлийг хийнэ — өнцөг, эхлэл, дуусгавар.
   AI унасан ч дүрмийн шалгалт үргэлж ажиллана. */

export interface CritiqueIssue {
  level: "bad" | "warn" | "tip";
  message: string;
}

export interface CritiqueResult {
  score: number;              // 0–100 — ерөнхий чанар
  /** Брэндийн нийцэл тусдаа: хэлбэр нь төгс ч байр суурьгүй пост нь
   *  хэнийх ч байж болно. Хоёрыг нэг тоонд нийлүүлбэл яг энэ ялгаа
   *  алга болно. */
  brandFit: number;           // 0–100
  /** Аль үнэт зүйлийг тээж байна. */
  valuesHit: string[];
  issues: CritiqueIssue[];
  rewrite: string;
  rationale: string;
  /** Хамгийн сайн явсан постуудтай харьцуулсан тэмдэглэл. */
  benchmark: string;
  aiUsed: boolean;
}

/* Сүүлийн үеийн хамгийн сайн постуудыг жишээ болгон өгнө — AI нь
   "ерөнхийдөө сайн" биш, "ЭНЭ хаяг дээр юу ажилладаг" гэдгээр дүгнэнэ. */
async function topExamples(limit = 3): Promise<{ text: string; engagement: number }[]> {
  await dbConnect();
  const rows = await ContentMetric.find({ engagement: { $gt: 0 }, text: { $ne: "" } })
    .sort({ engagement: -1 }).limit(limit)
    .select("text engagement").lean();
  return rows.map((r) => ({ text: String(r.text || "").slice(0, 400), engagement: r.engagement || 0 }));
}

export async function critiquePost(draft: string): Promise<CritiqueResult> {
  const text = String(draft || "").trim();
  const issues: CritiqueIssue[] = [];

  /* ── 1. Детерминист шалгалт ── */
  for (const w of voiceWarnings(text)) {
    issues.push({ level: "warn", message: String((w as { message?: string }).message || w) });
  }
  if (text.length > THREADS_MAX_CHARS) {
    issues.push({ level: "bad", message: `${text.length} тэмдэгт — Threads дээр ${THREADS_MAX_CHARS} хязгаартай.` });
  }
  if (/#\w/.test(text)) {
    issues.push({ level: "warn", message: "Hashtag байна — энэ хаягийн хэв маягт тохирохгүй." });
  }
  const lines = text.split("\n").filter((l) => l.trim());
  const longLines = lines.filter((l) => l.trim().split(/\s+/).length > 14);
  if (longLines.length) {
    issues.push({ level: "warn", message: `${longLines.length} мөр хэт урт (14+ үг). Нэг мөр = нэг бодол.` });
  }
  if (lines.length > 10) {
    issues.push({ level: "tip", message: `${lines.length} мөр — 3–8 мөр нь илүү уншигддаг.` });
  }

  const examples = await topExamples();
  const benchmark = examples.length
    ? `Энэ хаяг дээр хамгийн сайн явсан пост ${examples[0].engagement} оролцоотой.`
    : "Харьцуулах хэмжилт хараахан алга — эхлээд үзүүлэлт цуглуул.";

  /* ── 2. AI дүгнэлт — брэндийн цөмтэйгөөр ── */
  const brand = await getBrand();
  const names = valueNames(brand);

  const messages = [
    { role: "system" as const, content: VOICE_SPEC + brandPromptBlock(brand) },
    {
      role: "user" as const,
      content:
        `Доорх ноорог постыг дүгнэ.\n\n` +
        (examples.length
          ? `ЭНЭ ХАЯГ ДЭЭР САЙН АЖИЛЛАСАН ПОСТУУД (хэв маягийг нь жишиг болго):\n` +
            examples.map((e, i) => `${i + 1}. (${e.engagement} оролцоо)\n${e.text}`).join("\n\n") + `\n\n`
          : "") +
        `НООРОГ:\n"""${text.slice(0, 1500)}"""\n\n` +
        `Хариултаа ЯГ ийм JSON-оор буцаа, өөр юу ч бүү бич:\n` +
        `{"score": 0-100 (ерөнхий чанар), ` +
        `"brandFit": 0-100 (дээрх БАЙР СУУРЬ, ҮНЭТ ЗҮЙЛСТЭЙ хэр нийцэж байна), ` +
        `"valuesHit": [${names.map((n) => `"${n}"`).join(", ")} -ээс аль нь илэрч байгааг жагсаа], ` +
        `"issues": ["тодорхой засах зүйл", "..."], ` +
        `"rewrite": "сайжруулсан бүтэн пост (${THREADS_MAX_CHARS} тэмдэгтээс богино, байр суурийг хүчтэй илэрхийлсэн)", ` +
        `"rationale": "юуг яагаад өөрчилснөө нэг өгүүлбэрээр"}`,
    },
  ];

  let score = 0, brandFit = 0, rewrite = "", rationale = "", aiUsed = false;
  let valuesHit: string[] = [];

  for (const p of providers()) {
    let choice;
    try {
      choice = await chatCompletion(p, messages, { maxTokens: 1400, temperature: 0.6, reasoning: "none" });
    } catch { continue; }
    const raw = String(choice?.message?.content || "").trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1));
      score = Math.max(0, Math.min(100, Number(parsed.score) || 0));
      brandFit = Math.max(0, Math.min(100, Number(parsed.brandFit) || 0));
      /* Зөвхөн тодорхойлолтод байгаа үнэт зүйлийг хүлээж авна — AI
         зохиосон нэр нэмбэл дэлгэц дээр хуурамч итгэл төрүүлнэ. */
      valuesHit = (Array.isArray(parsed.valuesHit) ? parsed.valuesHit : [])
        .map(String).filter((v: string) => names.includes(v));
      rewrite = String(parsed.rewrite || "").trim();
      rationale = String(parsed.rationale || "").trim().slice(0, 300);
      for (const i of Array.isArray(parsed.issues) ? parsed.issues : []) {
        issues.push({ level: "tip", message: String(i).slice(0, 200) });
      }
      aiUsed = true;
      break;
    } catch { continue; }
  }

  if (!aiUsed) {
    /* AI байхгүй ч хоосон гарахгүй — дүрмийн шалгалтаас оноо гаргана. */
    const bad = issues.filter((i) => i.level === "bad").length;
    const warn = issues.filter((i) => i.level === "warn").length;
    score = Math.max(0, 100 - bad * 30 - warn * 12);
    issues.push({ level: "tip", message: "AI одоогоор хариу өгсөнгүй — зөвхөн дүрмийн шалгалт хийгдлээ." });
  }

  if (brandFit === 0 && aiUsed) brandFit = score;
  return { score, brandFit, valuesHit, issues, rewrite, rationale, benchmark, aiUsed };
}
