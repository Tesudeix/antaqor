/* Агентын засварлагчийн API.

   GET  — БҮХ агент нэгтгэсэн хэлбэрээр (идэвхгүй нь ч орно; эзэн унтраасан
          агентаа буцааж асаах боломжтой байх ёстой).
   PUT  — нэг агентын талбаруудыг хадгална.

   ХООСОН МӨР = "ҮЛДЭЭ". Админ зөвхөн нэрийг нь өөрчлөхөд бусад талбар
   хоосон явбал тэднийг арчих ёсгүй — тиймээс хоосон тэмдэгт мөрийг
   ХАДГАЛАХГҮЙ өнгөрөөнө. Талбарыг ҮНЭХЭЭР кодын өгөгдмөл рүү буцаах гэж
   байгаа бол `reset` талбарт нэрийг нь дамжуулна. */
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import Agent from "@/models/Agent";
import { resolveAll, resolveOne, DEFAULT_ACTIVE } from "@/lib/agentRoster";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  const agents = await resolveAll();
  return NextResponse.json({ agents, defaultActive: DEFAULT_ACTIVE });
}

/* ─── POST — ШИНЭ АГЕНТ ҮҮСГЭХ ───────────────────────────────────────────
   Эзэн кодод хүрэлгүйгээр агент зохионо. Хамгийн бага шаардлага нь НЭР:
   бусад бүх зүйлд ажиллах утга өгнө. 12 талбар бөглөхийг шаардвал хүн
   агент үүсгэхээ болино.

   `slug` нь хаяг (`/agents/<slug>`) бөгөөд постын зохиогчийн түлхүүр тул
   ҮҮССЭНИЙ ДАРАА СОЛИГДОХГҮЙ — өөрчилвөл өмнөх бүх пост эзэнгүй болно.
   Тиймээс нэрнээс автоматаар үүсгээд, давхардвал тоо залгана. */
function slugify(raw: string): string {
  const map: Record<string, string> = {
    а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"j",з:"z",и:"i",й:"i",к:"k",л:"l",м:"m",
    н:"n",о:"o",ө:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ү:"u",ф:"f",х:"h",ц:"ts",ч:"ch",
    ш:"sh",щ:"sh",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya",
  };
  return raw
    .toLowerCase()
    .split("")
    .map((c) => (map[c] !== undefined ? map[c] : c))
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Нэр шаардлагатай" }, { status: 400 });

  const base = slugify(String(body.slug || name));
  if (!base) {
    return NextResponse.json(
      { error: "Нэрнээс хаяг үүсгэж чадсангүй — латин үсэг оруулна уу." },
      { status: 400 }
    );
  }

  await dbConnect();
  /* Давхардлыг ШАЛГААД алдаа буцаахын оронд шийднэ: эзний бодож олсон
     нэрийг татгалзах нь ажил нэмнэ, `-2` залгах нь асуудлыг шийднэ. */
  let slug = base;
  for (let n = 2; n < 50; n++) {
    const clash = await Agent.findOne({ slug }).select("_id").lean();
    const inCode = await resolveOne(slug);
    if (!clash && !inCode) break;
    slug = `${base}-${n}`;
  }

  await Agent.create({
    slug,
    name,
    handle: `@${slug}`,
    role: String(body.role || "AI Agent").trim(),
    desc: String(body.desc || "").trim(),
    mission: String(body.mission || "").trim(),
    personality: String(body.personality || "").trim(),
    systemPrompt: String(body.systemPrompt || "").trim(),
    color: /^#[0-9a-f]{6}$/i.test(String(body.color || "")) ? String(body.color) : "#2E29FF",
    avatar: String(body.avatar || "").trim(),
    active: true,
    postEnabled: false,
    postHour: 9,
  });

  const agent = await resolveOne(slug);
  return NextResponse.json({ ok: true, agent });
}

/* ─── DELETE — зөвхөн АДМИНААС ҮҮССЭН агентыг ────────────────────────────
   Кодын агент (ANURA) устгагдахгүй: түүнийг кодоос дуудаж байгаа тусгай
   зохиогч бий тул мөрийг нь арилгах нь зөвхөн төөрөгдөл үүсгэнэ. Кодын
   агентыг нуух гэж байвал `active: false` — тэр нь буцаах боломжтой. */
export async function DELETE(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  const slug = (req.nextUrl.searchParams.get("slug") || "").toLowerCase();
  if (!slug) return NextResponse.json({ error: "slug шаардлагатай" }, { status: 400 });

  const current = await resolveOne(slug);
  if (!current) return NextResponse.json({ error: "Ийм агент алга" }, { status: 404 });
  if (!current.custom) {
    return NextResponse.json(
      { error: "Кодын агентыг устгах боломжгүй. Унтраа." },
      { status: 400 }
    );
  }

  await dbConnect();
  await Agent.deleteOne({ slug });
  return NextResponse.json({ ok: true });
}
