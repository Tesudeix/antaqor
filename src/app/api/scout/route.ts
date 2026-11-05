import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { rateLimit } from "@/lib/rateLimit";
import { gateAiMessage } from "@/lib/aiCredits";
import { runScout, type ScoutInput } from "@/lib/koreanScout";
import { loadProfile, patchProfile, learnFromTurn } from "@/lib/scoutMemory";
import dbConnect from "@/lib/mongodb";
import Restaurant from "@/models/Restaurant";
import ScoutQuery from "@/models/ScoutQuery";

export const dynamic = "force-dynamic";

/* ─── /api/scout — нүүрний prompt хэсгийн ард ажиллах агент ────────────────
   БҮРТГЭЛТЭЙ ХҮНД. Зочин үр дүнг хараад л бүртгүүлдэг байсныг зориудаар
   өөрчиллөө: агент хүн бүрийн ой дээр суралцдаг болсон учир нэргүй
   хэрэглэгчид өгөх зүйл нь бүрэн бүтээгдэхүүн биш. Хэн нэгэн гуравдахь
   удаагаа асуухад л жинхэнэ үнэ цэн гарна, тэр нь бүртгэл шаардана.

   ХЯЗГААР: сайтын нэгдсэн AI хаалга (`gateAiMessage`) — 2026-08-26-наас
   хойш зөвхөн гишүүн (эсвэл шилжилтийн түр эрхтэй хуучин хэрэглэгч).
   Тусдаа тоолуур зохиосонгүй: хоёр өөр газар өөрөөр тоолж эхэлбэл нэг нь
   эрт орой хэзээ нэгэн цагт худал болно.                                  */

const BURST = { max: 10, windowMs: 60_000 };

/** Санд юу байгаа + (нэвтэрсэн бол) хэрэглэгчийн профайл.
 *  UI мэдлэгийн ХИЛИЙГ ил харуулна — бүхнийг мэдэгч дүр эсгэхээс дээр. */
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user ? (session.user as { id?: string }).id : undefined;

  try {
    await dbConnect();
    const [total, verified, districts, areas] = await Promise.all([
      Restaurant.countDocuments({ active: true }),
      Restaurant.countDocuments({ active: true, verified: true }),
      Restaurant.distinct("district", { active: true }),
      Restaurant.distinct("area", { active: true, area: { $nin: [null, ""] } }),
    ]);
    const profile = userId ? await loadProfile(userId) : null;
    return NextResponse.json({
      total,
      verified,
      districts: (districts as string[]).filter((d) => d && d !== "Unknown").sort(),
      areas: (areas as string[]).sort(),
      profile,
      isLoggedIn: !!userId,
    });
  } catch {
    return NextResponse.json({ total: 0, verified: 0, districts: [], areas: [], profile: null, isLoggedIn: !!userId });
  }
}

/** Хэрэглэгч байршил/төсвөө ГАРААР тохируулна. Агентын таамаг биш,
 *  хүний өөрийнх нь хэлсэн утга үргэлж давуу эрхтэй. */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Нэвтэрнэ үү", needsAuth: true }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const profile = await patchProfile(userId, {
    district: typeof body.district === "string" ? body.district : undefined,
    area: typeof body.area === "string" ? body.area : undefined,
    budgetPerPerson: typeof body.budgetPerPerson === "number" ? body.budgetPerPerson : undefined,
    partySize: typeof body.partySize === "number" ? body.partySize : undefined,
  });
  return NextResponse.json({ profile });
}

export async function POST(req: NextRequest) {
  const started = Date.now();

  // ─── 1. Бүртгэл ───
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { error: "AI Scout ашиглахын тулд нэвтэрнэ үү.", needsAuth: true },
      { status: 401 }
    );
  }
  const userId = (session.user as { id: string }).id;
  const email = session.user.email || "";

  // ─── 2. Хурдны хаалт (гүйлт/скрипт таслах) ───
  const burst = rateLimit(`scout:${userId}`, BURST);
  if (!burst.ok) {
    return NextResponse.json(
      { error: `Түр хүлээнэ үү — ${Math.ceil(burst.resetInMs / 1000)}с.` },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { messages?: ScoutInput[] };
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const last = messages[messages.length - 1];
  const question = String(last?.content || "").trim();
  if (!last || last.role !== "user" || !question) {
    return NextResponse.json({ error: "Асуултаа бичнэ үү" }, { status: 400 });
  }

  // ─── 3. Өдрийн хязгаар (сайтын нэгдсэн AI хаалга) ───
  const gate = await gateAiMessage({ userId, email, reason: "AI_SCOUT_MSG", ref: "scout" });
  if (!gate.ok) {
    return NextResponse.json(
      {
        error: "Гишүүнчлэл шаардлагатай.",
        needsMembership: true,
        freeRemainingToday: 0,
      },
      { status: 402 }
    );
  }

  // ─── 4. Ой → системийн заавар ───
  const profile = await loadProfile(userId);
  const out = await runScout(messages, profile);

  if ("error" in out) {
    return NextResponse.json({ error: out.error }, { status: 502 });
  }

  /* Бүсэлхий ба бүчний давхар бэхэлгээ. Системийн заавар "баталгаажаагүй
     үнийг ЗААВАЛ тэмдэглэ" гэж хэлдэг ч загвар үүнийг заримдаа алгасдаг.
     Загварын дуулгавартай байдал дээр итгэл тавьж болохгүй ганц зүйл нь
     энэ — буруу үнээр төлөвлүүлэх нь итгэлийг шууд алдуулна. */
  let reply = out.reply;
  if (out.cards.some((c) => !c.verified) && !/баталгаажаагүй/i.test(reply)) {
    reply += "\n\n≈ Эдгээр газрын үнэ, цэс бидний зүгээс баталгаажаагүй. Очихынхоо өмнө залгаж лавлаарай.";
  }

  const ms = Date.now() - started;

  /* ─── 5. Хоёр төрлийн сурах ───
     (a) ScoutQuery — БИЗНЕСИЙН сурах давхарга. "0 үр дүнтэй" асуултууд нь
         сангийн нүх яг хаана байгааг админд хэлнэ.
     (b) learnFromTurn — ХЭРЭГЛЭГЧИЙН сурах давхарга.
     Хоёулаа хариултыг ХҮЛЭЭЛГЭХГҮЙ: хэрэглэгчид хэрэггүй ажлыг түүний
     хүлээх хугацаанд оруулах нь "30 секунд" гэсэн амлалтыг зөрчинө.
     pm2 доорх процесс удаан амьдардаг тул далд promise дуустал ажиллана. */
  void ScoutQuery.create({
    user: userId,
    question: question.slice(0, 700),
    reply: reply.slice(0, 2000),
    toolsUsed: out.toolsUsed,
    resultCount: out.cards.length,
    provider: out.provider,
    ms,
  }).catch(() => {});

  void learnFromTurn({ userId, question, reply }).catch(() => {});

  return NextResponse.json({
    reply,
    cards: out.cards,
    toolsUsed: out.toolsUsed,
    provider: out.provider,
    ms,
    unlimited: gate.bypass,
    freeRemainingToday: gate.bypass ? null : gate.freeRemainingToday,
  });
}
