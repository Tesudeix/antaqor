import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Notification from "@/models/Notification";
import Post from "@/models/Post";

export const dynamic = "force-dynamic";

/* ─── Мэдэгдлийн цэвэрлэгээ ──────────────────────────────────────────────

   Энэ коллекцоос ӨМНӨ НЬ ЮУ Ч УСТДАГГҮЙ БАЙСАН. 2026-08-25-ны байдлаар
   37,494 мөр, түүний 34,614 нь (92%) АЛГА БОЛСОН контент руу заасан —
   устгагдсан пост, устгагдсан хичээл. Хүн хонхоо нээж, дарж, 404 хардаг.

   Хадгалах хугацаа нь төрлөөрөө өөр байх ёстой, учир нь тэдгээрийн үнэ
   цэнэ өөр:

     new_post / new_course / new_lesson — 45 хоног. Хоёр сарын өмнөх пост
       "шинэ" биш. Уншсан эсэхээс үл хамаарна.
     уншсан бүх төрөл — 30 хоног.
     payment — 180 хоног. Санхүүгийн ул мөр, хүн эргэж хайж болно.
     system — 365 хоног.

   Мөн ХОЛБООС нь үхсэн бол насаа хамаарахгүй устана: `/posts/<id>` руу
   заасан мэдэгдэл, тэр пост нь байхгүй бол утгагүй.

   Багцаар ажиллана — 2GB droplet дээр 30 мянган мөрийг нэг deleteMany-д
   өгөх нь санах ойн оргил үүсгэнэ.                                      */

const DAY = 24 * 60 * 60 * 1000;

const RETENTION_DAYS: Record<string, number> = {
  new_post: 45,
  new_course: 45,
  new_lesson: 45,
  payment: 180,
  system: 365,
};

/** Уншсан мэдэгдэл ямар ч төрлийн байсан энэ хугацааны дараа устана. */
const READ_DAYS = 30;

/** Нэг хүнд үлдэх дээд тоо (шинэ нь үлдэнэ). */
const PER_USER_CAP = 100;

/** Нэг ажиллагаанд устгах дээд хэмжээ. */
const BATCH = 8000;

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.nextUrl.searchParams.get("secret") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const dry = req.nextUrl.searchParams.get("dry") === "1";

  try {
    await dbConnect();
    const now = Date.now();
    const report: Record<string, number> = {};
    let budget = BATCH;

    const run = async (label: string, filter: Record<string, unknown>) => {
      if (budget <= 0) return;
      if (dry) {
        report[label] = await Notification.countDocuments(filter);
        return;
      }
      const ids = await Notification.find(filter).select("_id").limit(budget).lean();
      if (ids.length === 0) {
        report[label] = 0;
        return;
      }
      const res = await Notification.deleteMany({
        _id: { $in: ids.map((d) => String((d as unknown as { _id: unknown })._id)) },
      });
      report[label] = res.deletedCount || 0;
      budget -= report[label];
    };

    // ── 1. Насаар нь, төрөл тус бүрээр ──
    for (const [type, days] of Object.entries(RETENTION_DAYS)) {
      await run(`old_${type}`, { type, createdAt: { $lt: new Date(now - days * DAY) } });
    }

    // ── 2. Уншсан бөгөөд хуучирсан ──
    await run("read_old", { read: true, createdAt: { $lt: new Date(now - READ_DAYS * DAY) } });

    // ── 3. Үхсэн холбоос: /posts/<id> руу заасан, гэвч пост нь алга ──
    /* Хамгийн олон нь энд. Ялгаатай холбоосыг л шалгана — 25 мянган мөр
       ердөө хэдэн зуун ялгаатай пост руу заадаг тул нэг лавлагаагаар
       бүгдийг шийднэ. */
    if (budget > 0) {
      const links: string[] = await Notification.distinct("link", { link: { $regex: "^/posts/" } });
      const ids = links
        .map((l) => l.split("/")[2])
        .filter((x) => /^[a-f0-9]{24}$/i.test(x || ""));
      if (ids.length > 0) {
        const alive = new Set(
          (await Post.find({ _id: { $in: ids } }).select("_id").lean()).map((p) =>
            String((p as unknown as { _id: unknown })._id)
          )
        );
        const deadLinks = links.filter((l) => {
          const id = l.split("/")[2];
          return /^[a-f0-9]{24}$/i.test(id || "") && !alive.has(id);
        });
        if (deadLinks.length > 0) await run("dead_post_links", { link: { $in: deadLinks } });
        else report.dead_post_links = 0;
      }
    }

    // ── 4. Нэг хүнд ноогдох дээд хязгаар ──
    /* Дээрх дүрмүүд ажилласны дараа ч цөөн хэдэн хүн хэт их мэдэгдэлтэй
       үлдэж болно (жишээ нь маш идэвхтэй хүн). Хамгийн шинэ 100-г нь
       үлдээнэ — түүнээс цааш ямар ч хүн гүйлгэж хардаггүй. */
    if (!dry && budget > 0) {
      const heavy = (await Notification.aggregate([
        { $group: { _id: "$recipient", n: { $sum: 1 } } },
        { $match: { n: { $gt: PER_USER_CAP } } },
        { $sort: { n: -1 } },
        { $limit: 40 },
      ])) as { _id: unknown; n: number }[];
      let trimmed = 0;
      for (const h of heavy) {
        const rid = String(h._id);
        if (budget <= 0) break;
        const keep = await Notification.find({ recipient: rid })
          .sort({ createdAt: -1 })
          .limit(PER_USER_CAP)
          .select("_id")
          .lean();
        const res = await Notification.deleteMany({
          recipient: rid,
          _id: { $nin: keep.map((k) => String((k as unknown as { _id: unknown })._id)) },
        });
        trimmed += res.deletedCount || 0;
        budget -= res.deletedCount || 0;
      }
      report.per_user_cap = trimmed;
    }

    const remaining = await Notification.estimatedDocumentCount();
    return NextResponse.json({ ok: true, dry, report, remaining });
  } catch (e) {
    console.error("[notifications-prune]", e);
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
