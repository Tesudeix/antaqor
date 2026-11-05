/* ─── Агентуудын нийтлэлийн хуваарь ──────────────────────────────────────
   Цаг тутам ажиллана. Тухайн ЦАГТ нийтлэхээр тохируулсан агентуудыг олж,
   тус бүрд нэг пост бичүүлнэ.

   ЯАГААД ЦАГ ТУТАМ ГҮЙДЭГ ХЭРНЭЭ ӨДӨРТ НЭГ БИЧДЭГ ВЭ: эзэн админаас
   "09 цагт" гэж сонгодог. Cron нь тэр цагийг мэдэхгүй тул цаг тутам сэрж,
   "одоо хэн бичих ёстой вэ" гэж асуух нь ганц найдвартай арга. Хуваарь
   өөрчлөгдөх бүрд crontab засах шаардлагагүй.

   ИДЭМПОТЕНТ — ХОЁР давхар хамгаалалт:
   1. `lastPostAt` нь өнөөдөр (УБ-ын хуанли) бол алгасна.
   2. Тэр өдрийн `agentSlug` бүхий пост DB-д байвал бас алгасна.
   Хоёр дахь нь илүүц мэт боловч биш: `lastPostAt` бичигдэхээс өмнө процесс
   унавал эхнийх нь хамгаалахгүй. Урсгал дээр давхардсан агент пост нь
   итгэлийг шууд алдагдуулна.

   Агент бүр ТУСДАА `try` дотор — нэгийх нь унасан нь бусдын постыг
   зогсоох ямар ч шалтгаан биш. */

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";
import Agent from "@/models/Agent";
import { resolveRoster, ubNow, UB_OFFSET_HOURS } from "@/lib/agentRoster";
import { writeCommunityPost, persistAgentPost } from "@/lib/agentPost";
import { writeDailyPost, ANURA_SLUG } from "@/lib/anura";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function postedToday(slug: string, dateKey: string): Promise<boolean> {
  await dbConnect();
  /* УБ-ын хоногийн эхлэл = UTC-ийн 16:00 (өмнөх өдрийн). Хайлтыг UTC-ээр
     хийх учир хилийг зөв тооцно, эс бөгөөс шөнө дунд орчим алдаа гарна. */
  const startUtc = new Date(`${dateKey}T00:00:00.000Z`).getTime() - UB_OFFSET_HOURS * 3600_000;
  const exists = await Post.findOne({
    agentSlug: slug,
    createdAt: { $gte: new Date(startUtc), $lt: new Date(startUtc + 24 * 3600_000) },
  })
    .select("_id")
    .lean();
  return !!exists;
}

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret") || "";
  let authed = Boolean(process.env.CRON_SECRET) && secret === process.env.CRON_SECRET;
  if (!authed) {
    const s = await getServerSession(authOptions);
    authed = Boolean(s?.user && isAdmin(s.user.email));
  }
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  /* `?force=<slug>` — админ хуваарь хүлээхгүйгээр туршиж үзэх зам.
     Идэмпотентын шалгалт хэвээр: туршилт гэж давхар пост гаргахгүй. */
  const force = (req.nextUrl.searchParams.get("force") || "").toLowerCase();

  const { hour, dateKey } = ubNow();
  const roster = await resolveRoster();
  const due = roster.filter(
    (a) => force ? a.slug === force : a.postEnabled && a.postHour === hour
  );

  const results: Array<Record<string, unknown>> = [];

  for (const agent of due) {
    try {
      if (await postedToday(agent.slug, dateKey)) {
        results.push({ slug: agent.slug, skipped: "already posted today" });
        continue;
      }

      /* ANURA нь гадаад мэдээ дээр ажилладаг тул өөрийн зохиогчтой —
         тэнд эх сурвалж баталгаажуулах бүхэл механизм байгаа. */
      let content: string;
      if (agent.slug === ANURA_SLUG) {
        const out = await writeDailyPost();
        content = out.content;
      } else {
        content = await writeCommunityPost(agent);
      }

      const post = await persistAgentPost(agent.slug, content);
      /* ⚠ `upsert` НЬ СХЕМИЙН ӨГӨГДМӨЛИЙГ ШУРГУУЛДАГ. Өмнө нь энд зөвхөн
         `lastPostAt` бичдэг байсан бөгөөд мөр байхгүй агентад Mongoose
         шинэ баримт үүсгэхдээ `active: false`, `postEnabled: false` гэсэн
         схемийн ӨГӨГДМӨЛИЙГ хамт хийдэг байв. Үр дүн нь: агент эхний
         постоо бичээд ӨӨРӨӨ УНТАРНА. Хэмжигдсэн — KAIRA нэг постын дараа
         ростероос алга болсон.

         Тиймээс шинээр үүсгэх үед одоо хүчинтэй байгаа шийдвэрийг ил
         бичнэ. `$setOnInsert` нь зөвхөн ҮҮСГЭХ үед л ажиллах тул эзний
         дараа хийсэн засварыг дарж бичихгүй. */
      await Agent.updateOne(
        { slug: agent.slug },
        {
          $set: { lastPostAt: new Date() },
          $setOnInsert: {
            slug: agent.slug,
            active: agent.active,
            postEnabled: agent.postEnabled,
            postHour: agent.postHour,
          },
        },
        { upsert: true }
      );

      results.push({
        slug: agent.slug,
        posted: true,
        postId: String(post._id),
        chars: content.length,
      });
    } catch (e) {
      console.error(`[agents-post] ${agent.slug} failed`, e);
      results.push({ slug: agent.slug, error: e instanceof Error ? e.message : "failed" });
    }
  }

  return NextResponse.json({ ok: true, ubHour: hour, dateKey, due: due.map((a) => a.slug), results });
}
