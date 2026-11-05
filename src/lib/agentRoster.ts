/* ─── Ажиллаж буй агентуудын ростер ──────────────────────────────────────
   Сайт дээр ХЭН харагдахыг ганц газар шийднэ.

   ХОЁР ЭХ СУРВАЛЖ, НЭГ ЖАГСААЛТ:
   1. КОДЫН агент — `empireAgents.ts`. Одоо ганц ANURA үлдсэн. Түүнийг
      кодод байлгах шалтгаан нь `anura.ts`-ийн вэб хайлттай тусгай
      зохиогч түүнийг `ANURA_SLUG`-аар дууддагт бий; DB-ээс устгагдвал
      тэр механизм дуугүй унтарна.
   2. АДМИНААС ҮҮСГЭСЭН агент — `Agent` коллекц. Эзэн `/admin/agents`
      дээрээс шинийг зохиож, устгаж чадна.

   Энэ файл хоёуланг НЭГ жагсаалт болгоно. Кодын агентад DB нь ЗАСВАР
   болж үйлчилнэ (хоосон биш талбар дарж бичнэ); DB-д л байгаа агент нь
   бүрэн эрхт гишүүн.

   `custom` талбар нь ялгааг хэлнэ: кодын агентыг УСТГАХ боломжгүй
   (зөвхөн унтраах), админы үүсгэснийг устгаж болно. */

import dbConnect from "@/lib/mongodb";
import Agent from "@/models/Agent";
import { EMPIRE_AGENTS, type EmpireAgent } from "@/lib/empireAgents";

/** Кодын агентуудаас DB мөргүй үед ажиллах ёстой нь. */
export const DEFAULT_ACTIVE = ["anura"] as const;

/** Кодын өгөгдмөл + DB-ийн засвар нийлсэн, дэлгэцэд бэлэн хэлбэр. */
export interface ResolvedAgent {
  slug: string;
  name: string;
  handle: string;
  role: string;
  desc: string;
  color: string;
  tools: string[];
  catchphrase: string;
  systemPrompt: string;
  model?: string;

  avatar: string;
  age: number | null;
  personality: string;
  mission: string;

  active: boolean;
  order: number;
  postEnabled: boolean;
  postHour: number;
  lastPostAt: string | null;
  /** Админаас үүсгэсэн эсэх — устгах товч зөвхөн эдгээрт гарна. */
  custom: boolean;
}

/** Хоосон мөр = "өөрчлөөгүй". Тиймээс `??` биш, урттай эсэхийг шалгана. */
function pickText(override: unknown, fallback: string): string {
  return typeof override === "string" && override.trim() ? override : fallback;
}

interface AgentRow {
  slug?: string;
  handle?: string;
  color?: string;
  desc?: string;
  name?: string;
  avatar?: string;
  role?: string;
  description?: string;
  age?: number | null;
  personality?: string;
  mission?: string;
  systemPrompt?: string;
  active?: boolean;
  order?: number;
  postEnabled?: boolean;
  postHour?: number;
  lastPostAt?: Date | null;
}

function merge(base: EmpireAgent, row: AgentRow | undefined, index: number): ResolvedAgent {
  const defaultActive = (DEFAULT_ACTIVE as readonly string[]).includes(base.slug);
  return {
    slug: base.slug,
    name: pickText(row?.name, base.name),
    handle: base.handle,
    role: pickText(row?.role, base.role),
    desc: pickText(row?.description, base.desc),
    color: base.color,
    tools: base.tools,
    catchphrase: base.catchphrase,
    systemPrompt: pickText(row?.systemPrompt, base.systemPrompt),
    model: base.model,

    avatar: pickText(row?.avatar, base.avatar || ""),
    /* Нас: DB-д `null` бол "кодынхыг ав". `0` нь хүчинтэй утга биш гэж
       үзэж болохгүй тул `|| ` хэрэглэхгүй, ил тод шалгана. */
    age: row?.age === null || row?.age === undefined ? base.age ?? null : row.age,
    personality: pickText(row?.personality, base.personality || ""),
    mission: pickText(row?.mission, base.mission || ""),

    /* `active` нь ЗААВАЛ boolean байвал л эзний шийдвэр гэж үзнэ.
       Талбар огт байхгүй бол (жишээ нь энэ схемээс ӨМНӨ үүссэн хуучин
       мөр) тэр нь "унтраа" гэсэн үг БИШ — эзэн тийм шийдвэр гаргаагүй.
       `!!undefined === false` гэж үзвэл хуучин `antaqor` мөр шинэ код
       ажилламагц чимээгүй унтарна. */
    active: typeof row?.active === "boolean" ? row.active : defaultActive,
    order: typeof row?.order === "number" ? row.order : index,
    postEnabled: !!row?.postEnabled,
    postHour: typeof row?.postHour === "number" ? row.postHour : 9,
    lastPostAt: row?.lastPostAt ? new Date(row.lastPostAt).toISOString() : null,
    custom: false,
  };
}

/* ─── Зөвхөн DB-д амьдардаг агент ────────────────────────────────────────
   Кодын түшиг байхгүй тул талбар бүр өөрөө утгатай байх ёстой. Хоосон
   үлдсэн зүйлд ойлгомжтой сайн утга өгнө — админ 12 талбар бөглөх
   шаардлагагүй, нэр л хангалттай байх ёстой. */
function fromRow(row: AgentRow, index: number): ResolvedAgent {
  const slug = String(row.slug || "");
  const name = pickText(row.name, slug.toUpperCase());
  return {
    slug,
    name,
    handle: pickText(row.handle, `@${slug}`),
    role: pickText(row.role, "AI Agent"),
    desc: pickText(row.desc, pickText(row.mission, "")),
    color: pickText(row.color, "#2E29FF"),
    tools: [],
    catchphrase: "",
    /* Заавар байхгүй агент нь дүргүй агент — юу ч асуувал ерөнхий
       туслах шиг хариулна. Тиймээс доод хэмжээний дүр өгнө. */
    systemPrompt: pickText(
      row.systemPrompt,
      `You are ${name}, an AI agent inside the Antaqor community — a Mongolian community of AI entrepreneurs.\nAnswer in the user's language (Mongolian Cyrillic if they write Mongolian). Be direct and concrete. Never say "as an AI".`
    ),
    model: undefined,
    avatar: pickText(row.avatar, ""),
    age: row.age === null || row.age === undefined ? null : row.age,
    personality: pickText(row.personality, ""),
    mission: pickText(row.mission, ""),
    active: typeof row.active === "boolean" ? row.active : true,
    order: typeof row.order === "number" ? row.order : 100 + index,
    postEnabled: !!row.postEnabled,
    postHour: typeof row.postHour === "number" ? row.postHour : 9,
    lastPostAt: row.lastPostAt ? new Date(row.lastPostAt).toISOString() : null,
    custom: true,
  };
}

/** БҮХ агент, нэгтгэсэн хэлбэрээр — админы засварлагчид зориулав. */
export async function resolveAll(): Promise<ResolvedAgent[]> {
  await dbConnect();
  const rows = (await Agent.find({}).lean()) as unknown as AgentRow[];
  const byslug = new Map(rows.map((r) => [String(r.slug), r]));
  const codeSlugs = new Set(EMPIRE_AGENTS.map((a) => a.slug));

  const fromCode = EMPIRE_AGENTS.map((a, i) => merge(a, byslug.get(a.slug), i));
  /* Кодод байхгүй мөр = админаас үүсгэсэн агент. Хуучин, устгасан
     агентуудын үлдэгдэл мөр ч энд орж ирнэ — тэднийг ЦЭВЭРЛЭХ нь энэ
     функцийн ажил биш; админаас устгана. */
  const fromDb = rows
    .filter((r) => r.slug && !codeSlugs.has(String(r.slug)))
    .map((r, i) => fromRow(r, i));

  return [...fromCode, ...fromDb].sort((a, b) => a.order - b.order);
}

/** Зөвхөн ажиллаж байгаа нь — сайтын нийтийн гадаргуунууд үүнийг уншина. */
export async function resolveRoster(): Promise<ResolvedAgent[]> {
  return (await resolveAll()).filter((a) => a.active);
}

export async function resolveOne(slug: string): Promise<ResolvedAgent | null> {
  const all = await resolveAll();
  return all.find((a) => a.slug === slug.toLowerCase()) || null;
}

/* ─── Улаанбаатарын цаг ──────────────────────────────────────────────────
   Сервер UTC-ээр явна, эзэн Улаанбаатарын цагаар боддог. Хөрвүүлэлтгүй
   бол "09:00-д нийтэл" гэж тохируулсан пост 17:00-д гарч, эзэн системийг
   эвдэрсэн гэж үзнэ. Монгол зусланы цагийн шилжилт хэрэглэдэггүй тул
   тогтмол +8 зөв. */
export const UB_OFFSET_HOURS = 8;

export function ubNow(now: Date = new Date()): { hour: number; dateKey: string } {
  const shifted = new Date(now.getTime() + UB_OFFSET_HOURS * 3600_000);
  return {
    hour: shifted.getUTCHours(),
    dateKey: shifted.toISOString().slice(0, 10),
  };
}
