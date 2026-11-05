import mongoose, { QueryFilter } from "mongoose";
import dbConnect from "@/lib/mongodb";
import Restaurant, { IRestaurant, IMenuItem } from "@/models/Restaurant";

/* ─── Scout-ийн ХЭРЭГСЛҮҮД ─────────────────────────────────────────────────
   Агент = LLM + заавар + ХЭРЭГСЭЛ + өгөгдөл. Энэ файл нь "хэрэгсэл" ба
   "өгөгдөл" хоёрын хоорондох гүүр. LLM энд байгаа функцуудаас цааш ЮУ Ч
   уншиж чадахгүй — тиймээс хариултын үнэн зөв байдал загвараас биш,
   Mongo дахь мөрүүдээс шалтгаална.

   ЗАГВАР ЮУ Ч ЗОХИОХГҮЙ БАЙХ ЗАРЧИМ. Хэрэгсэл хоосон буцаавал агент
   "олдсонгүй" гэж хэлэх ёстой — өөрөө ресторан зохиох ёсгүй. Тиймээс бүх
   хэрэгсэл `count` талбар буцаана: 0 гэдэг нь загварт ил харагдах дохио. */

// ─── Дүүрэг: монгол/англи бичлэгийг нэг канон утга руу буулгана ───
// Хүн "Хан-Уул", "khan uul", "Khanuul" гэж бичнэ. Өгөгдөл нэг л хэлбэртэй.
const DISTRICT_CANON: Record<string, string> = {
  "khan-uul": "Khan-Uul", khanuul: "Khan-Uul", "khan uul": "Khan-Uul",
  "хан-уул": "Khan-Uul", "хануул": "Khan-Uul", "хан уул": "Khan-Uul", "ху": "Khan-Uul",
  sukhbaatar: "Sukhbaatar", "sukhbaatar district": "Sukhbaatar",
  "сүхбаатар": "Sukhbaatar", "сухбаатар": "Sukhbaatar", "сбд": "Sukhbaatar",
  bayanzurkh: "Bayanzurkh", "bayanzurkh district": "Bayanzurkh",
  "баянзүрх": "Bayanzurkh", "баянзурх": "Bayanzurkh", "бзд": "Bayanzurkh",
  chingeltei: "Chingeltei", "чингэлтэй": "Chingeltei", "чд": "Chingeltei",
  bayangol: "Bayangol", "баянгол": "Bayangol", "бгд": "Bayangol",
  songinokhairkhan: "Songinokhairkhan", "сонгинохайрхан": "Songinokhairkhan", "схд": "Songinokhairkhan",
  nalaikh: "Nalaikh", "налайх": "Nalaikh",
  unknown: "Unknown", "тодорхойгүй": "Unknown",
};

export function normalizeDistrict(input?: string | null): string | null {
  if (!input) return null;
  const key = String(input).trim().toLowerCase().replace(/\s*дүүрэг\s*$/, "").trim();
  if (DISTRICT_CANON[key]) return DISTRICT_CANON[key];
  // Хэсэгчилсэн таарал: "Хан-Уул дүүрэг, Зайсан" гэх мэт
  for (const [k, v] of Object.entries(DISTRICT_CANON)) {
    if (k.length >= 4 && key.includes(k)) return v;
  }
  return null;
}

/** Regex-д хэрэглэгчийн текстийг аюулгүй болгоно. */
function rx(s: string): RegExp {
  return new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
}

/** "22:30" → 1350 минут. Буруу оролт → null. */
function toMin(hhmm?: string | null): number | null {
  if (!hhmm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm).trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 24 || mi > 59) return null;
  return h * 60 + mi;
}

/** Тухайн цагт нээлттэй эсэх. Шөнө дундаас хойш хаадаг газрыг зөв тооцно. */
export function isOpenAt(hours: { open?: string; close?: string } | undefined, at: string): boolean {
  const t = toMin(at);
  const o = toMin(hours?.open);
  let c = toMin(hours?.close);
  if (t === null || o === null || c === null) return true; // мэдээлэлгүй бол шүүхгүй
  if (c <= o) c += 24 * 60; // 11:00 → 02:00
  const tt = t < o ? t + 24 * 60 : t;
  return tt >= o && tt <= c;
}

// ─── Загварт өгөх хэлбэр ───
// Бүтэн Mongo document биш. Токен хэмнэх ба загварыг хэрэггүй талбараар
// бүү сатааруул: id, нэр, үнэ, нөхцөл, баталгаа — шийдвэрт хэрэгтэй нь энэ.
type Lean = IRestaurant & { _id: mongoose.Types.ObjectId };

/* Байршил бол энэ бүтээгдэхүүний хамгийн практик талбар — хүн эцсийн эцэст
   ТЭР ГАЗАР РУУ явах ёстой. Админ холбоос гараар наахыг шаардвал ихэнх мөр
   холбоосгүй үлдэнэ; координат оруулсан бол холбоосыг өөрсдөө угсарна. */
function mapLink(r: Lean): string | undefined {
  if (r.mapUrl) return r.mapUrl;
  if (typeof r.lat === "number" && typeof r.lng === "number") {
    return `https://www.google.com/maps/search/?api=1&query=${r.lat},${r.lng}`;
  }
  return undefined;
}

/** Хүнд хэлэх байршлын нэг мөр. Юу мэдэхгүйгээ нуухгүй. */
function locationLine(r: Lean): string {
  if (r.district === UNKNOWN_DISTRICT && !r.address) return "Байршил бүртгэгдээгүй";
  const parts = [r.district === UNKNOWN_DISTRICT ? "" : r.district, r.area || "", r.address || ""];
  return parts.filter(Boolean).join(" · ");
}

/* "Unknown" гэдгийг ЭНГИЙН УТГА мэт буцаавал загвар түүнийг дүүргийн нэр
   гэж уншина. Бодит туршилт дээр яг ийм зүйл болсон: хэрэглэгч "Дархан
   хотод" гэж асуухад агент байршил нь бүртгэгдээгүй ресторанд "Дархан
   дүүрэгт байрладаг" гэсэн ЗОХИОСОН байршил наасан. Хэрэглэгчийн хэлсэн
   газрыг рестораны хаяг болгож хуулах нь хамгийн аюултай алдаа — хүн
   тэр хот руу явчихна.

   Тиймээс байршилгүй мөрийн `district`-ийг null болгоод, оронд нь загвар
   алгасах аргагүй ил тушаал тавина. */
const UNKNOWN_DISTRICT = "Unknown";

/* Дүүргийн канон утга нь ЛАТИН — тэр бол өгөгдлийн түлхүүр, өөрчлөгдөх
   ёсгүй. Гэхдээ загварт зөвхөн латинаар өгвөл хариултдаа "Khan-Uul-д
   олдсонгүй" гэж бичдэг нь монгол дэлгэц дээр эвгүй. Тиймээс ХОЁУЛАНГ нь
   өгнө: түлхүүрийг ажилдаа, монгол нэрийг хүнд хэлэхэд. */
const DISTRICT_MN: Record<string, string> = {
  "Khan-Uul": "Хан-Уул",
  Sukhbaatar: "Сүхбаатар",
  Bayanzurkh: "Баянзүрх",
  Chingeltei: "Чингэлтэй",
  Bayangol: "Баянгол",
  Songinokhairkhan: "Сонгинохайрхан",
  Nalaikh: "Налайх",
};

function brief(r: Lean) {
  const known = r.district !== UNKNOWN_DISTRICT;
  return {
    id: String(r._id),
    name: r.name,
    name_mn: r.nameMn || undefined,
    district: known ? r.district : null,
    district_mn: known ? DISTRICT_MN[r.district] || r.district : null,
    location_warning: known
      ? undefined
      : "Location NOT recorded. Never state a district, area or city for this restaurant — not even one the user mentioned.",
    area: r.area || undefined,
    address: r.address || undefined,
    location: locationLine(r),
    has_map: !!mapLink(r),
    cuisine: r.cuisine,
    tags: r.tags?.length ? r.tags : undefined,
    price_per_person: r.pricePerPerson,
    parking: r.parking,
    solo_friendly: r.soloFriendly,
    delivery: r.delivery,
    hours: `${r.hours?.open || "?"}–${r.hours?.close || "?"}`,
    rating: r.rating ?? undefined,
    note: r.note || undefined,
    verified: r.verified,
    last_verified: r.lastVerified ? new Date(r.lastVerified).toISOString().slice(0, 10) : null,
    cheapest_items: (r.menu || [])
      .slice()
      .sort((a, b) => a.price - b.price)
      .slice(0, 3)
      .map((m) => `${m.name} ${m.price.toLocaleString("en-US")}₮`),
  };
}

function full(r: Lean) {
  return {
    ...brief(r),
    phone: r.phone || undefined,
    map_url: mapLink(r),
    menu: (r.menu || []).slice(0, 40).map((m: IMenuItem) => ({
      name: m.name,
      name_mn: m.nameMn || undefined,
      price: m.price,
      category: m.category || undefined,
      serves_people: m.servesPeople || undefined,
      spicy: m.spicy || undefined,
    })),
  };
}

// ─── Хэрэгслийн тодорхойлолт (OpenAI/xAI function-calling схем) ───
export const SCOUT_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "search_restaurants",
      description:
        "Search the Ulaanbaatar restaurant database by district, budget, cuisine and facilities. Use this FIRST for almost every request. Returns [] if nothing matches — never invent a restaurant.",
      parameters: {
        type: "object",
        properties: {
          district: { type: "string", description: "District in Latin or Cyrillic, e.g. 'Khan-Uul' or 'Хан-Уул'." },
          area: { type: "string", description: "Neighbourhood inside a district, e.g. 'Зайсан', 'Сансар'. Narrower and more useful than district when the user names a landmark." },
          cuisine: { type: "string", description: "e.g. 'Korean', 'BBQ'." },
          max_price_per_person: { type: "number", description: "Max average spend per person in tugrik (₮)." },
          min_price_per_person: { type: "number" },
          parking: { type: "boolean" },
          solo_friendly: { type: "boolean", description: "true = comfortable to sit alone." },
          delivery: { type: "boolean" },
          open_at: { type: "string", description: "24h time 'HH:MM'. Only return places open at that time." },
          keyword: { type: "string", description: "Free-text match against name, tags and notes." },
          limit: { type: "number", description: "1-12, default 6." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "get_restaurant",
      description: "Full detail incl. the complete menu for one restaurant. Accepts the id from search_restaurants, or the exact name.",
      parameters: {
        type: "object",
        properties: {
          id: { type: "string", description: "Restaurant id from search_restaurants." },
          name: { type: "string", description: "Restaurant name, if you have no id." },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "search_menu",
      description:
        "Find a specific dish across every restaurant and see where it is cheapest. Use for questions like 'where is kimchi jjigae cheapest?'.",
      parameters: {
        type: "object",
        properties: {
          food: { type: "string", description: "Dish name, Latin or Cyrillic, e.g. 'kimchi jjigae' / 'Самгёпсаль'." },
          max_price: { type: "number", description: "Max price per item in tugrik." },
          district: { type: "string" },
          limit: { type: "number", description: "1-15, default 8." },
        },
        required: ["food"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "compare_restaurants",
      description:
        "Side-by-side comparison of 2-4 restaurants with budget maths. Give people + budget_total to find out what actually fits.",
      parameters: {
        type: "object",
        properties: {
          ids: { type: "array", items: { type: "string" }, description: "2-4 restaurant ids or exact names." },
          people: { type: "number", description: "Number of diners." },
          budget_total: { type: "number", description: "Total budget for the whole group in tugrik." },
        },
        required: ["ids"],
        additionalProperties: false,
      },
    },
  },
];

// ─── Гүйцэтгэгч ───
export interface ToolRun {
  result: unknown;
  touched: string[]; // хөндсөн рестораны id — UI карт үүсгэхэд
}

type Args = Record<string, unknown>;

const str = (a: Args, k: string): string | undefined => {
  const v = a[k];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};
const num = (a: Args, k: string): number | undefined => {
  const v = a[k];
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};
const bool = (a: Args, k: string): boolean | undefined =>
  typeof a[k] === "boolean" ? (a[k] as boolean) : undefined;

/** id эсвэл нэрээр нэг ресторан олох. */
async function resolveOne(idOrName: string): Promise<Lean | null> {
  const key = idOrName.trim();
  if (mongoose.isValidObjectId(key)) {
    const byId = await Restaurant.findOne({ _id: key, active: true }).lean<Lean>();
    if (byId) return byId;
  }
  return Restaurant.findOne({
    active: true,
    $or: [{ name: rx(key) }, { nameMn: rx(key) }, { slug: key.toLowerCase() }],
  }).lean<Lean>();
}

async function searchRestaurants(a: Args): Promise<ToolRun> {
  const q: QueryFilter<IRestaurant> = { active: true };

  const district = normalizeDistrict(str(a, "district"));
  if (district) q.district = district;

  /* Загвар "Korean BBQ" гэж НЭГ мөрөөр илгээдэг, гэтэл сан дээр энэ нь
     хоёр тусдаа утга (["Korean","BBQ"]). Бүтэн мөрөөр regex тавихад ЮУ Ч
     таарахгүй — эхний туршилт яг ийм шалтгаанаар хоосон буцсан.

     Тиймээс үг тус бүрд ЗАДЛААД, үг БҮР нь cuisine эсвэл tag-аас олдох
     ёстой (AND). Яагаад OR биш вэ: OR бол "Korean BBQ" гэсэн хүсэлтэд
     BBQ-гүй бүх солонгос газрыг оруулж ирнэ — шүүлт утгагүй болно. */
  /* `area` нь дүүргээс НАРИЙН. Хүн "Зайсан" гэж хэлэхэд Хан-Уул бүхэлд нь
     хайх нь буруу хариулт — 20 минутын зайд хоёр өөр газар байж болно.
     Хаяг дотор ч тохиолдож болох тул хоёуланг нь шалгана. */
  const area = str(a, "area");
  if (area) {
    q.$and = [...(Array.isArray(q.$and) ? q.$and : []), { $or: [{ area: rx(area) }, { address: rx(area) }] }];
  }

  const cuisine = str(a, "cuisine");
  if (cuisine) {
    const tokens = cuisine.split(/[\s,/&+]+/).map((x) => x.trim()).filter((x) => x.length >= 2).slice(0, 4);
    if (tokens.length > 0) {
      q.$and = tokens.map((tok) => ({ $or: [{ cuisine: rx(tok) }, { tags: rx(tok) }] }));
    }
  }

  const maxP = num(a, "max_price_per_person");
  const minP = num(a, "min_price_per_person");
  if (maxP !== undefined || minP !== undefined) {
    const range: Record<string, number> = {};
    if (maxP !== undefined) range.$lte = maxP;
    if (minP !== undefined) range.$gte = minP;
    q.pricePerPerson = range;
  }

  for (const k of ["parking", "delivery"] as const) {
    const v = bool(a, k);
    if (v === true) q[k] = true;
  }
  if (bool(a, "solo_friendly") === true) q.soloFriendly = true;

  /* `$or`-г ШУУД оноож болохгүй — cuisine аль хэдийн `$and` тавьсан бол
     дээд түвшний `$or` түүнтэй зөрчилдөнө. Хоёуланг нь `$and`-д хийнэ. */
  const keyword = str(a, "keyword");
  if (keyword) {
    const clause = { $or: [{ name: rx(keyword) }, { nameMn: rx(keyword) }, { tags: rx(keyword) }, { note: rx(keyword) }] };
    q.$and = [...(Array.isArray(q.$and) ? q.$and : []), clause];
  }

  const limit = Math.min(12, Math.max(1, num(a, "limit") ?? 6));
  // Цагийн шүүлт Mongo дээр биш JS дээр — шөнө дундыг давсан цагийн логик
  // хайлтын хэлээр бичихэд эмзэг. Тиймээс арай илүү татаад шүүнэ.
  const openAt = str(a, "open_at");
  const rows = await Restaurant.find(q)
    .sort({ verified: -1, rating: -1, pricePerPerson: 1 })
    .limit(openAt ? limit * 3 : limit)
    .lean<Lean[]>();

  const filtered = openAt ? rows.filter((r) => isOpenAt(r.hours, openAt)) : rows;
  const out = filtered.slice(0, limit);

  /* ─── Хоосон гараа хоосон бүү буц ────────────────────────────────────
     Санал болгогч бүтээгдэхүүний хамгийн муу хариулт бол "олдсонгүй" гэсэн
     ганц мөр. Бодит туршилт дээр яг ийм зүйл болсон: хэрэглэгч "Хан-Уул,
     нүүрсэн гал, машинтай" гэж асуухад агент гурван удаа хайж, гурвуулаа
     хоосон гараад "Манай сангаас олдсонгүй" гээд өнгөрсөн. Хүн юу ч аваагүй.

     Тиймээс хоосон үр дүнг ХЭРЭГСЭЛ өөрөө нөхнө: нарийн шүүлтүүдээ хаяад
     (зөвхөн дүүрэг, идэвхтэй эсэхийг үлдээгээд) хамгийн ойр сонголтуудыг
     ЗЭРЭГ буцаана. Ингэснээр загвар "яг таарах нь алга, гэхдээ эдгээр
     байна" гэж хэлэх боломжтой болно — үүнийг зааврын дуулгавартай байдалд
     найдалгүй, өгөгдлийн түвшинд баталгаажуулж байна.                    */
  let alternatives: ReturnType<typeof brief>[] = [];
  let altIds: string[] = [];
  const narrowed = !!(cuisine || keyword || area || openAt || maxP !== undefined || minP !== undefined);
  if (out.length === 0 && narrowed) {
    const relaxed: QueryFilter<IRestaurant> = { active: true };
    if (district) relaxed.district = district;
    const alt = await Restaurant.find(relaxed)
      .sort({ verified: -1, rating: -1, pricePerPerson: 1 })
      .limit(4)
      .lean<Lean[]>();
    alternatives = alt.map(brief);
    /* Хувилбаруудыг `touched`-д БАС оруулна. Эс тэгвээс агент тэдгээрийг
       санал болгосон ч UI дээр карт гарахгүй — хүн нэрийг нь хараад
       хаяг, үнэ, газрын зурагг нь олж чадахгүй үлдэнэ. */
    altIds = alt.map((r) => String(r._id));
  }

  return {
    result: {
      count: out.length,
      filters_applied: { district: district || undefined, area, cuisine, open_at: openAt, max_price_per_person: maxP },
      restaurants: out.map(brief),
      nearest_alternatives: alternatives.length ? alternatives : undefined,
      hint:
        out.length === 0
          ? alternatives.length
            ? "No EXACT match. Do NOT invent anything and do NOT reply with only 'not found'. Say in one short line which condition could not be met, then offer the nearest_alternatives above as real options — they come from the database and are safe to recommend. You may also retry once with fewer filters if a different angle looks promising."
            : "EMPTY, and nothing close exists either. Retry once with fewer filters (drop cuisine, then open_at, then district). If still empty, say plainly that the database has nothing for this — never invent a restaurant."
          : undefined,
    },
    touched: [...out.map((r) => String(r._id)), ...altIds],
  };
}

async function getRestaurant(a: Args): Promise<ToolRun> {
  const key = str(a, "id") || str(a, "name");
  if (!key) return { result: { error: "id or name required" }, touched: [] };
  const r = await resolveOne(key);
  if (!r) return { result: { count: 0, hint: "Not in the database. Do NOT invent details." }, touched: [] };
  return { result: { count: 1, restaurant: full(r) }, touched: [String(r._id)] };
}

async function searchMenu(a: Args): Promise<ToolRun> {
  const food = str(a, "food");
  if (!food) return { result: { error: "food required" }, touched: [] };
  const maxPrice = num(a, "max_price");
  const district = normalizeDistrict(str(a, "district"));
  const limit = Math.min(15, Math.max(1, num(a, "limit") ?? 8));

  const q: QueryFilter<IRestaurant> = { active: true };
  if (district) q.district = district;
  const rows = await Restaurant.find(q).lean<Lean[]>();

  const needle = rx(food);
  type Hit = { id: string; restaurant: string; district: string; item: string; price: number; verified: boolean; serves_people?: number };
  const hits: Hit[] = [];
  for (const r of rows) {
    for (const m of r.menu || []) {
      if (!needle.test(m.name) && !(m.nameMn && needle.test(m.nameMn))) continue;
      if (maxPrice !== undefined && m.price > maxPrice) continue;
      hits.push({
        id: String(r._id),
        restaurant: r.name,
        district: r.district,
        item: m.nameMn ? `${m.name} (${m.nameMn})` : m.name,
        price: m.price,
        verified: r.verified,
        serves_people: m.servesPeople,
      });
    }
  }
  hits.sort((x, y) => x.price - y.price);
  const out = hits.slice(0, limit);

  return {
    result: {
      count: out.length,
      cheapest: out[0] || null,
      matches: out,
      hint: out.length === 0 ? "That dish is not in any stored menu. Say so — do NOT guess a price." : undefined,
    },
    touched: [...new Set(out.map((h) => h.id))],
  };
}

async function compareRestaurants(a: Args): Promise<ToolRun> {
  const raw = Array.isArray(a.ids) ? (a.ids as unknown[]) : [];
  const keys = raw.map((x) => String(x)).filter(Boolean).slice(0, 4);
  if (keys.length < 2) return { result: { error: "at least 2 ids required" }, touched: [] };

  const people = Math.max(1, Math.round(num(a, "people") ?? 1));
  const budgetTotal = num(a, "budget_total");
  const perHead = budgetTotal !== undefined ? Math.floor(budgetTotal / people) : undefined;

  const found: Lean[] = [];
  for (const k of keys) {
    const r = await resolveOne(k);
    if (r) found.push(r);
  }
  if (found.length === 0) return { result: { count: 0, hint: "None of those ids exist." }, touched: [] };

  const rows = found.map((r) => {
    const est = r.pricePerPerson * people;
    return {
      ...brief(r),
      estimated_total: est,
      per_person_budget_available: perHead,
      fits_budget: budgetTotal === undefined ? undefined : est <= budgetTotal,
      headroom: budgetTotal === undefined ? undefined : budgetTotal - est,
      // Төсөвт багтах цэсийн зүйлс — "болохгүй" гэж хэлэхийн оронд
      // "энэ хоёрыг нь аваарай" гэж хэлэх боломж олгоно.
      affordable_items:
        perHead === undefined
          ? undefined
          : (r.menu || []).filter((m) => m.price <= perHead).sort((x, y) => y.price - x.price).slice(0, 4)
              .map((m) => `${m.name} ${m.price.toLocaleString("en-US")}₮`),
    };
  });

  const cheapest = rows.slice().sort((x, y) => x.estimated_total - y.estimated_total)[0];
  return {
    result: {
      count: rows.length,
      people,
      budget_total: budgetTotal,
      cheapest_option: cheapest?.name,
      comparison: rows,
    },
    touched: found.map((r) => String(r._id)),
  };
}

export async function runScoutTool(name: string, args: Args): Promise<ToolRun> {
  await dbConnect();
  switch (name) {
    case "search_restaurants": return searchRestaurants(args);
    case "get_restaurant": return getRestaurant(args);
    case "search_menu": return searchMenu(args);
    case "compare_restaurants": return compareRestaurants(args);
    default: return { result: { error: `unknown tool ${name}` }, touched: [] };
  }
}

/** UI картад зориулж хөндсөн рестораныг татна (агентын хариултын дэргэд харагдана). */
export async function loadCards(ids: string[]) {
  if (ids.length === 0) return [];
  await dbConnect();
  const valid = ids.filter((i) => mongoose.isValidObjectId(i)).slice(0, 6);
  if (valid.length === 0) return [];
  const rows = await Restaurant.find({ _id: { $in: valid } }).lean<Lean[]>();
  const order = new Map(valid.map((id, i) => [id, i]));
  return rows
    .sort((x, y) => (order.get(String(x._id)) ?? 99) - (order.get(String(y._id)) ?? 99))
    .map((r) => ({
      id: String(r._id),
      name: r.name,
      nameMn: r.nameMn || "",
      district: r.district,
      area: r.area || "",
      address: r.address || "",
      location: locationLine(r),
      pricePerPerson: r.pricePerPerson,
      hours: `${r.hours?.open || "?"}–${r.hours?.close || "?"}`,
      parking: r.parking,
      soloFriendly: r.soloFriendly,
      rating: r.rating ?? null,
      phone: r.phone || "",
      mapUrl: mapLink(r) || "",
      verified: r.verified,
      tags: r.tags || [],
    }));
}
