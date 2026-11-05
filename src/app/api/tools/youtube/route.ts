import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import YtJob from "@/models/YtJob";
import YtAgent from "@/models/YtAgent";
import { spendCredits } from "@/lib/credits";
import { checkUrl, HEIGHTS, MP3_KBPS, MP3_MIN_AGENT, agentVer, failStalled, sweepFiles, publicJob } from "@/lib/ytgrab";
import { loadYtPricing, costFor, tierFor } from "@/lib/ytPricing";
import { serverMode, pumpServer, SERVER_MAX_HEIGHT } from "@/lib/ytServer";

export const dynamic = "force-dynamic";

/* ─── ХЭРЭГЛЭГЧИЙН ТАЛ — POST /api/tools/youtube ─────────────────────────
   Урсгал: нэвтрэлт → холбоосын шалгуур → (fetch бол) КРЕДИТ ХАСАХ →
   ажил дараалалд. Татац нь энд гүйхгүй — хэрэглэгчийн ӨӨРИЙН машин дээрх
   agent татна.

   `probe` ҮНЭГҮЙ: хүн юу татахаа, ямар хэмжээтэйг харахаасаа өмнө төлөх
   шаардлагагүй. Төлбөр нь чанар сонгосны дараа л явна.

   Бүтэлгүйтвэл кредит БУЦНА — agent-ийн `result` эсвэл гацаалтын
   зохицуулга дээр (src/lib/ytgrab.ts → refundJob). */

const AGENT_ONLINE_MS = 25_000;
const REASON = "YT_DOWNLOAD";

async function me() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;
  return { id: (session.user as { id: string }).id, email: session.user.email || "" };
}

export async function GET() {
  const u = await me();
  if (!u) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });

  await dbConnect();
  await failStalled();
  void sweepFiles();
  void pumpServer();

  const [jobs, agent, user, pricing] = await Promise.all([
    YtJob.find({ user: u.id }).sort({ createdAt: -1 }).limit(25),
    YtAgent.findOne({ user: u.id }).lean(),
    User.findById(u.id).select("credits role email").lean(),
    loadYtPricing(),
  ]);

  const seen = agent?.lastSeen ? new Date(agent.lastSeen).getTime() : 0;
  const role = (user as { role?: string } | null)?.role;
  const email = String((user as { email?: string } | null)?.email || "").toLowerCase();
  /* House хаяг (админ) нь үнэгүй — spendCredits өөрөө ингэж авирладаг
     тул интерфейс дээр ч тэрийг л тусгана, эс тэгвээс "2 кредит"
     гэж хуурамч бичнэ. */
  const free = role === "admin" || ["antaqor@gmail.com", "cyberempire4444@gmail.com"].includes(email);

  return NextResponse.json({
    jobs: jobs.map(publicJob),
    agent: {
      exists: !!agent,
      online: Date.now() - seen < AGENT_ONLINE_MS,
      lastSeen: agent?.lastSeen || null,
      version: agent?.version || "",
      outDir: agent?.outDir || "",
    },
    credits: (user as { credits?: number } | null)?.credits ?? 0,
    pricing,
    free,
    /* true бол agent хэрэггүй — сервер өөрөө татна (WARP proxy) */
    server: serverMode(),
    maxHeight: serverMode() ? SERVER_MAX_HEIGHT : 4320,
  });
}

export async function POST(req: NextRequest) {
  const u = await me();
  if (!u) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  let url: string;
  try { url = checkUrl(body.url); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }

  const kind = body.kind === "fetch" ? "fetch" : "probe";
  await dbConnect();

  /* Дараалал хуримтлахаас сэргийлнэ. Agent унтарсан үед дарж дарж олон
     ажил үүсгэвэл кредит нь хасагдаад, бүгд гацаалтаар л дуусна. */
  const onServer = serverMode();
  const pending = await YtJob.countDocuments({ user: u.id, status: { $in: ["queued", "working"] }, runner: onServer ? "server" : { $ne: "server" } });
  if (pending >= 5) {
    return NextResponse.json(
      { error: onServer ? "Таны 5 татац явж байна — нэг нь дуусахыг хүлээгээд дахин дарна уу." : "Хүлээгдэж байгаа ажил хэт их. Өөрийн машин дээрх agent ажиллаж байгаа эсэхийг шалга." },
      { status: 429 },
    );
  }

  const mp3 = body.mode === "mp3";
  const server = onServer;
  const want = HEIGHTS.includes(Number(body.height)) ? Number(body.height) : 1080;
  const height = mp3 ? 0 : server ? Math.min(want, SERVER_MAX_HEIGHT) : want;
  const mode = mp3 ? "mp3" : body.mode === "best" ? "best" : "compat";
  const abr = mp3 ? (MP3_KBPS.includes(Number(body.kbps)) ? Number(body.kbps) : 192) : 0;

  /* ── Төлбөр: зөвхөн бодит татацад ── */
  let charged = 0;
  if (kind === "fetch") {
    /* Серверийн горимд agent шаардахгүй — сервер өөрөө татна. */
    if (!server) {
      const agent = await YtAgent.findOne({ user: u.id }).select("lastSeen version").lean();
      const seen = agent?.lastSeen ? new Date(agent.lastSeen).getTime() : 0;
      if (Date.now() - seen >= AGENT_ONLINE_MS) {
        /* Нэг ч кредит хасахаас ӨМНӨ шалгана — agent унтарсан бол ажил
           гацаж, дараа буцаалт хийх нь хүнд хэрэггүй эргэлзээ төрүүлнэ. */
        return NextResponse.json(
          { error: "Таны машин холбогдоогүй байна. Agent-ыг ажиллуулаад дахин үзээрэй.", code: "AGENT_OFFLINE" },
          { status: 409 },
        );
      }
      if (mp3 && agentVer(agent?.version) < MP3_MIN_AGENT) {
        return NextResponse.json(
          { error: "MP3 татахын тулд agent-аа шинэчил: файлаа дахин татаад (curl -O …) ахин ажиллуул.", code: "AGENT_OLD" },
          { status: 409 },
        );
      }
    }

    /* MP3 нь хамгийн хямд шат (sd) — зөвхөн дуу, хэдхэн MB. */
    const pricing = await loadYtPricing();
    const cost = costFor(pricing, height);
    const res = await spendCredits({
      userId: u.id,
      amount: cost,
      reason: REASON,
      meta: { height, mode, abr, tier: tierFor(height) },
    });
    if (!res.ok) {
      return NextResponse.json(
        {
          error: `Кредит хүрэлцэхгүй. ${cost} кредит шаардлагатай, танд ${res.balance} байна.`,
          code: "INSUFFICIENT_CREDITS",
          balance: res.balance,
          required: cost,
          buyHref: "/credits/buy",
        },
        { status: 402 },
      );
    }
    /* House хаяг required:0 буцаана → юу ч хасаагүй, буцаах юм ч алга. */
    charged = res.required > 0 ? cost : 0;
  }

  const job = await YtJob.create({
    user: u.id,
    kind, url, height, mode, abr,
    runner: server ? "server" : "agent",
    /* сервер өөрөө хадгална — хэрэглэгч хөтчөөрөө татна */
    wantUpload: server ? kind === "fetch" : kind === "fetch" && body.upload === true,
    title: typeof body.title === "string" ? body.title.slice(0, 300) : "",
    charged,
    by: u.email,
  });

  if (server) void pumpServer();
  return NextResponse.json({ job: publicJob(job) });
}
