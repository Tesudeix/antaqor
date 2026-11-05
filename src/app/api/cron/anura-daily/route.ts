/* ─── ANURA-гийн өдөр тутмын пост ────────────────────────────────────────
   Cron өдөрт нэг удаа дуудна. Гишүүн ирэх бүрд урсгал дээр нэг шинэ,
   БОДИТ эх сурвалж дээр тулгуурласан AI боломж байх ёстой.

   ИДЭМПОТЕНТ: өнөөдөр аль хэдийн бичсэн бол дахин бичихгүй. Cron давхар
   ажиллах (гар аргаар дуудах, дахин оролдох, серверийн цагийн зөрүү) нь
   ховор биш бөгөөд тэр үед урсгал дээр хоёр ижил пост гарах нь агентыг
   шууд итгэл алдагдуулна.

   ЭЗЭН БАЙХГҮЙ: пост нь хүний хяналтгүй нийтлэгдэнэ. Тиймээс худал
   мэдээллээс хамгаалах ажил бүхэлдээ `anura.ts` дотор — тэнд эх сурвалж
   баталгаажаагүй бол баримт мэдэгдэл огт гаргахгүй.                       */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";
import User from "@/models/User";
import { findAgent } from "@/lib/empireAgents";
import { writeDailyPost, ANURA_SLUG } from "@/lib/anura";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Агентын пост хэний нэрээр DB-д бичигдэх вэ. `Post.author` нь заавал
 *  хэрэглэгч байх ёстой; урсгал нь `agentSlug`-аар ANURA гэж зурдаг. */
async function ownerId(): Promise<string | null> {
  await dbConnect();
  const admin = await User.findOne({ role: "admin" }).select("_id").lean();
  if (admin) return String((admin as unknown as { _id: unknown })._id);
  const any = await User.findOne({}).sort({ createdAt: 1 }).select("_id").lean();
  return any ? String((any as unknown as { _id: unknown })._id) : null;
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret") || "";
  let authed = Boolean(process.env.CRON_SECRET) && secret === process.env.CRON_SECRET;
  if (!authed) {
    const s = await getServerSession(authOptions);
    authed = Boolean(s?.user && isAdmin(s.user.email));
  }
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const force = req.nextUrl.searchParams.get("force") === "1";

  await dbConnect();
  const agent = findAgent(ANURA_SLUG);
  if (!agent) return NextResponse.json({ error: "ANURA not registered" }, { status: 500 });

  // ── Өнөөдөр бичсэн үү ──
  const dayAgo = new Date(Date.now() - 22 * 60 * 60 * 1000);
  const already = await Post.findOne({ agentSlug: ANURA_SLUG, createdAt: { $gte: dayAgo } })
    .select("_id createdAt")
    .lean();
  if (already && !force) {
    return NextResponse.json({
      ok: true,
      skipped: "already posted",
      postId: String((already as unknown as { _id: unknown })._id),
    });
  }

  const author = await ownerId();
  if (!author) return NextResponse.json({ error: "No user to attribute the post to" }, { status: 500 });

  let written;
  try {
    written = await writeDailyPost();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[anura-daily] write failed", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const post = await Post.create({
    author,
    authorLevel: 5,
    content: written.content,
    image: "",
    images: [],
    /* Гишүүдэд нээлттэй: ANURA бол гишүүнчлэлийн үнэ цэнийн нэг хэсэг,
       зочны сурталчилгаа биш. */
    visibility: "members",
    category: "мэдээлэл",
    agentSlug: agent.slug,
    likes: [],
    commentsCount: 0,
  });

  return NextResponse.json({
    ok: true,
    postId: post._id.toString(),
    grounded: written.grounded,
    source: written.sourceUrl,
    chars: written.content.length,
  });
}
