/* ─── Threads-ийн AI зохиогч ─────────────────────────────────────────────
   Дуу хоолой (`threadsVoice`) + нийлүүлэгч (`scoutProvider`) хоёрыг нийлүүлж
   нийтлэхэд бэлэн ноорог гаргана.

   ГОЛ ШИЙДВЭР: энэ давхарга ХЭЗЭЭ Ч өөрөө нийтлэхгүй. Ноорог л буцаана.
   Шалтгаан нь техникийн биш, бизнесийн: нийтэлсэн пост бол буцаагдашгүй
   зүйл — брэнд нэрийн өмнөөс ярьж байна. Загвар 20 постын 19-ийг зөв
   бичээд нэгийг нь эзний хэлээгүй зүйл болгож бичихэд тэр нэг нь л
   санагдана. Тиймээс хүн ХАРААД баталгаажуулна. Автоматжуулалт нь
   "бичих" ажлыг авна, "шийдэх" ажлыг биш.

   Нийтлэх ажлыг аль хэдийн байгаа дэд бүтэц хийнэ: `SocialPost` мөр +
   `/api/cron/social-schedule`. Шинэ дараалал, шинэ cron ҮҮСГЭХГҮЙ — хоёр
   товчлуур нэг ажил хийж эхэлбэл аль нь ажилласныг хэн ч мэдэхгүй болно. */

import { providers, chatCompletion, type ChatMsg, type ProviderAttempt } from "@/lib/scoutProvider";
import { getAiChoice } from "@/lib/aiModels";
import {
  buildVoicePrompt,
  ANGLES,
  THREADS_MAX_CHARS,
  type CtaOption,
  type VoicePost,
} from "@/lib/threadsVoice";

export interface GeneratedDraft {
  text: string;
  angle: string;
  ctaKeyword: string;
  chars: number;
}

export interface GenerateArgs {
  recent: VoicePost[];
  cta: CtaOption;
  /** ANGLES-ийн key. Хоосон бол загвар өөрөө сонгоно. */
  angle?: string;
  /** Эзний өгсөн сэдэв/түүхий санаа. Хоосон байж болно. */
  topic?: string;
  count?: number;
}

export interface GenerateResult {
  drafts: GeneratedDraft[];
  provider: string | null;
  error?: string;
  /* Оролдсон нийлүүлэгч бүрийн үр дүн. Дэлгэц дээр гаргах зорилготой:
     "яагаад Gemini ажиллав?" гэдэг асуултын хариу нь ихэвчлэн техникийн
     биш — OpenAI-ийн төлбөр унтарсан гэх мэт эзний засах зүйл байдаг.
     Лог дотор нуувал хэзээ ч заслагдахгүй. */
  attempts: ProviderAttempt[];
}

/** Загварын гаралтаас JSON массивыг найдвартай сугалах.
 *  Загварууд ```json хашилт нэмэх, эсвэл тайлбар бичих дуртай — тэр бүхнийг
 *  тэвчих ёстой, эс бөгөөс амжилттай гаралт зүгээр л хаягдана. */
function parseDrafts(raw: string): { text: string; angle?: string }[] {
  const cleaned = raw
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return [];

  try {
    const arr = JSON.parse(cleaned.slice(start, end + 1));
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => {
        if (typeof x === "string") return { text: x };
        const o = x as { text?: unknown; angle?: unknown };
        return { text: typeof o.text === "string" ? o.text : "", angle: typeof o.angle === "string" ? o.angle : undefined };
      })
      .filter((x) => x.text.trim().length > 0);
  } catch {
    return [];
  }
}

/* Загвар зааврыг зөрчсөн үед гарах хамгийн түгээмэл гурван зүйлийг
   програмаар засна. Дахин дуудахаас хямд, мөн найдвартай. */
function tidy(text: string, cta: CtaOption): string {
  let t = text.replace(/\r/g, "").trim();

  // 1. Hashtag — заавал хориглосон ч заримдаа гарч ирдэг.
  t = t.replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "").trim();

  // 2. Жагсаалтын тэмдэг — мөр өөрөө жагсаалт байх ёстой.
  t = t
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-•*—]|\d+[.)])\s+/, "").trimEnd())
    .join("\n");

  // 3. Гурав ба түүнээс дээш хоосон мөрийг хоёр болгож хураана.
  t = t.replace(/\n{3,}/g, "\n\n").trim();

  /* 4. МӨРИЙН НЯГТРАЛ. Загвар мөр болгоны хооронд ХООСОН мөр тавих дуртай.
     Жинхэнэ постууд тийм биш: тэдгээр нь нягт бичигдсэн мөрийн багана
     бөгөөд хоосон мөр нь ЦЭГ ТАСЛАЛ шиг ажилладаг — санаа солигдох үед л
     гарна. Мөр болгоны хооронд хоосон зай байвал пост нь дэлгэц дүүрч,
     жагсаалт мэт болж, хэмнэл нь алдагдана.

     Дүрэм: блок бүр НЭГ богино мөр бөгөөд гурваас олон блок байвал энэ нь
     "багана" — хоосон мөрийг нь авна. Урт блок холилдсон бол зохиогч
     санаатай зай авсан гэж үзээд хэвээр үлдээнэ. */
  const blocks = t.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  const allSingleShortLines =
    blocks.length >= 3 &&
    blocks.every((b) => !b.includes("\n") && b.length <= 90);
  if (allSingleShortLines) t = blocks.join("\n");

  /* CTA нь ЯГ БАЙГААГААР нь сүүлийн мөр байх ёстой. Загвар түүнийг
     найруулж өөрчилвөл сэтгэгдэлд бичих түлхүүр үг алдагдаж, автомат
     хариу ажиллахаа болино — өөрөөр хэлбэл пост нь юүлүүргүй болно.
     Тиймээс энд таамаглахгүй: байхгүй бол наана, буруу бол сольно. */
  if (!t.endsWith(cta.text)) {
    // Загвар CTA-г ойролцоо хэлбэрээр бичсэн бол тэр сүүлийн мөрийг хаяна.
    const lines = t.split("\n");
    const last = (lines[lines.length - 1] || "").trim();
    if (/гэж\s+бич|зүрх\s+дараарай/iu.test(last)) lines.pop();
    t = lines.join("\n").trim();
    /* CTA-г ямар зайгаар залгах нь постын өөрийнх нь хэмнэлээс хамаарна:
       нягт багана бол нэг мөр, догол мөртэй бол хоосон мөр. Үргэлж
       `\n\n` тавивал нягт постын төгсгөлд ганцхан цоорхой үлдэж, гаднаас
       наасан мэт харагдана. */
    const dense = !/\n\n/.test(t);
    t = `${t}${dense ? "\n" : "\n\n"}${cta.text}`;
  }

  return t.trim();
}

/* ─── Зохиогчийн загвар нь Scout-ийнхаас ӨӨР ─────────────────────────────
   `SCOUT_OPENAI_MODEL` нь бүх дуудагчийн нийтлэг утга бөгөөд Scout агент
   нь зочны нүүр хуудсан дээр байнга ажилладаг, багаж дуудлагатай, олон
   эргэлттэй — тэнд хямд загвар зөв.

   Зохиол бол эсрэгээрээ: өдөрт хэдхэн удаа, гэхдээ гаралт нь эзний нэрийн
   өмнөөс нийтлэгдэнэ. Хоёр ажлын эдийн засаг өөр тул нэг тохиргоонд уяж
   болохгүй.

   ХЭМЖСЭН ЯЛГАА (2026-08-31, ижил prompt, ижил постууд):
   — gpt-5.4-mini → 101 ба 164 тэмдэгт. Хийсвэр, тоогүй, хэт хуурай.
   — gpt-5.4      → 238 ба 319 тэмдэгт. "27 настай founder", "7 хоног бүр
     18 цаг", "45 минутын дараа" — яг эзний бодит постуудын хэв маяг.
   Ялгаа нь уртад биш, ТОДОРХОЙ БАЙДАЛД. */
const WRITER_MODEL: Record<string, string | undefined> = {
  openai: process.env.THREADS_WRITER_MODEL || "gpt-5.4",
};

export async function generateThreadsPosts(args: GenerateArgs): Promise<GenerateResult> {
  const count = Math.min(6, Math.max(1, args.count || 3));
  let list = providers().map((p) => ({ ...p, model: WRITER_MODEL[p.name] || p.model }));

  /* ─── Админы сонголт ─────────────────────────────────────────────────
     Сонгосон нийлүүлэгчийг дараалалд ТЭРГҮҮНД тавина, бусдыг хасахгүй.
     Хатуу тогтоовол тэр загвар унасан өдөр ажил бүхэлдээ зогсоно; зөөлөн
     тавихад ажил үргэлжилж, `attempts` нь юу болсныг дэлгэц дээр хэлнэ.
     Тохиргоо унших нь бүтэлгүйтвэл (DB унтарсан) автомат дараалал
     хэвээр — сонголт бол тохь тух, шаардлага биш. */
  try {
    const choice = await getAiChoice();
    if (choice) {
      const picked = list.find((p) => p.name === choice.provider);
      if (picked) {
        list = [
          { ...picked, model: choice.model || picked.model },
          ...list.filter((p) => p.name !== choice.provider),
        ];
      }
    }
  } catch {
    /* сонголтгүйгээр үргэлжилнэ */
  }

  const attempts: ProviderAttempt[] = [];
  if (list.length === 0) {
    return { drafts: [], provider: null, attempts, error: "Ямар ч AI түлхүүр тохируулаагүй байна." };
  }

  const angle = ANGLES.find((a) => a.key === args.angle);
  const angleBrief = angle
    ? `\nӨНЦӨГ — "${angle.label}": ${angle.brief}`
    : `\nӨНЦӨГ: пост бүрийг ӨӨР өнцгөөс бич. Боломжит өнцгүүд:\n${ANGLES.map(
        (a) => `- ${a.label}: ${a.brief}`
      ).join("\n")}`;

  const topicBrief = args.topic?.trim()
    ? `\nСЭДЭВ (эзнээс): ${args.topic.trim()}\nЭнэ сэдвийг дээрх дуу хоолойгоор бич. Сэдвийг өөрчлөхгүй.`
    : "";

  const system = buildVoicePrompt(args.recent);

  const user = `${count} ширхэг Threads пост бич.
${angleBrief}${topicBrief}

ЗААВАЛ:
- Пост бүрийн ХАМГИЙН СҮҮЛИЙН мөр яг энэ байна (үг үсэг нь хэвээр):
${args.cta.text}
- Урт: CTA-гүйгээр 150-400 тэмдэгт. ЭНЭ БОЛ ДООД ХЯЗГААР.
  150-аас богино пост нь бодол биш, зүгээр хэдэн үг — уншигч юу ч
  аваагүй хэвээр гүйлгэж өнгөрнө. Санаагаа БҮРЭН гарга.
- 4-8 мөр байна (CTA-г тооцохгүй). Хоёр, гурван мөрөөр бүү зогс.
- Мөр бүр өмнөхөө УРАГШЛУУЛНА. Ижил санааг өөр үгээр давтсан мөр бол
  хаях мөр.
- Постууд хоорондоо ӨӨР байна — нэг санааг өөр үгээр давтахгүй.

ЗӨВХӨН JSON массив буцаа, өөр юу ч бичихгүй:
[{"angle":"<өнцгийн нэр>","text":"<постын бүтэн текст>"}]`;

  const messages: ChatMsg[] = [
    { role: "system", content: system },
    { role: "user", content: user },
  ];

  for (const p of list) {
    const choice = await chatCompletion(p, messages, {
      maxTokens: 1800,
      // Өндөр температур: зохиолын ажилд 0.4 нь дандаа нэг л хэвийг
      // давтуулдаг. 0.9 нь эрсдэлтэй сонсогдож болох ч ноорог хүнээр
      // шалгагдана — тиймээс энд алдах зардал бага, уйтгартай байх
      // зардал өндөр.
      temperature: 0.9,
      /* Богино зохиолын ажилд далд бодол хэрэггүй — харин 1800 токены
         төсвийг иддэг. gpt-5 гэр бүл, Gemini хоёулаа сэтгэх загварууд тул
         үүнгүйгээр хоосон хариу ирэх бодит эрсдэлтэй.

         "none" гэж яагаад "minimal" биш вэ: gpt-5.4-mini нь "minimal"-ыг
         ТАТГАЛЗДАГ (400, зөвшөөрөгдөх нь none/low/medium/high/xhigh).
         Хэмжсэн: "none" дээр reasoning_tokens = 0. Дэмжихгүй загвар
         тохиолдвол `chatCompletion` параметрийг хаяад дахин илгээнэ. */
      reasoning: "none",
      timeoutMs: 55_000,
      onAttempt: (a) => attempts.push(a),
    });
    const raw = choice?.message?.content?.trim();
    if (!raw) continue;

    const parsed = parseDrafts(raw);
    if (parsed.length === 0) continue;

    const drafts = parsed
      .slice(0, count)
      .map((d) => {
        const text = tidy(d.text, args.cta);
        return {
          text,
          angle: d.angle || angle?.label || "",
          ctaKeyword: args.cta.keyword,
          chars: text.length,
        };
      })
      /* Хязгаараас хэтэрсэн ноорог нь ноорог биш — Threads татгалзана.
         Хүнд харуулаад дараа нь алдаа заах нь цаг үрэх хэрэг. */
      .filter((d) => d.chars > 0 && d.chars <= THREADS_MAX_CHARS);

    if (drafts.length > 0) return { drafts, provider: p.name, attempts };
  }

  return {
    drafts: [],
    provider: null,
    attempts,
    error:
      "AI нийлүүлэгч бүр татгалзлаа. Түлхүүрийн төлбөр/кредитээ шалгана уу (OpenAI, xAI, Gemini).",
  };
}
