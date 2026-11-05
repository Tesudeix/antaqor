import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Event from "@/models/Event";
import Post from "@/models/Post";
import User from "@/models/User";
import { leaderboardHiddenMatch } from "@/lib/leaderboardHidden";
import { expandMany, type RecurringSource } from "@/lib/recurrence";

export const dynamic = "force-dynamic";

/* ─── Нүүрний зурвасын ГАНЦ эх сурвалж ────────────────────────────────────

   Нүүр хуудсан дээрх дөрвөн хавтан (Хуваарь · Бүтээл · Гишүүд · Тэргүүн)
   нь дөрвөн ӨӨР коллекцоос уншина. Хамгийн энгийн зам нь дөрвөн `fetch`
   боловч энэ нь сайтын хамгийн их зочилдог хуудсан дээр дөрвөн эргэлт,
   дөрвөн холболт, дөрвөн хүйтэн эхлэл гэсэн үг. Тиймээс НЭГ төгсгөл.

   Кэш: 60 секундын процесс доторх санах ой. Эдгээр тоо секунд тутам
   өөрчлөгддөггүй (гишүүдийн тоо өдөрт хэдэн удаа, XP цагт хэдэн удаа) тул
   зочин бүрд дөрвөн агрегац ажиллуулах нь ямар ч утгагүй. Droplet дээр
   2GB RAM байгаа — энэ кэш нь хэдхэн килобайт.

   ЧУХАЛ — НУУЦЛАЛ: энэ бол НИЙТИЙН төгсгөл. `visibility: "members"` пост
   бол зөвхөн ТООНД оролцоно, зураг нь ХЭЗЭЭ Ч гарахгүй. Урьдчилан
   харуулах зураг нь зөвхөн `visibility: "free"` бүтээлээс ирнэ.          */

const DAY = 24 * 60 * 60 * 1000;

/** Идэвхтэй байж БОЛОХ эвентүүд: давтагдах цуврал бүр (тэдгээрийн `date` нь
 *  хэдэн сарын өмнө байж болно) + сүүлийн нэг өдрөөс хойшхи нэг удаагийнх. */
const EVENT_WINDOW = (now: Date): Record<string, unknown> => ({
  $or: [
    { recurring: { $nin: [null, "none"] } },
    { date: { $gte: new Date(now.getTime() - DAY) } },
  ],
});
const TTL_MS = 60_000;

/** "Бүтээл" гэж юуг тоолох вэ: зураг, олон зураг, эсвэл видеотой пост. */
const MEDIA_OR: Record<string, unknown>[] = [
  { image: { $exists: true, $nin: ["", null] } },
  { images: { $exists: true, $not: { $size: 0 } } },
  { video: { $exists: true, $nin: ["", null] } },
];

type Rail = {
  schedule: {
    image: string;
    title: string;
    type: string;
    at: string | null;
    live: boolean;
    upcoming: number;
  };
  creations: { image: string; total: number; fresh24h: number; locked: number };
  members: { avatars: { name: string; avatar: string }[]; total: number; new7d: number };
  leaders: { name: string; avatar: string; xp: number; total: number };
};

let cache: { at: number; data: Rail } | null = null;

async function build(): Promise<Rail> {
  await dbConnect();
  const now = new Date();

  const [eventDocs, mediaTotal, freshCount, freePreview, lockedCount, memberRows, memberTotal, new7d, leaderRows, leaderTotal] =
    await Promise.all([
      /* Хуваарь. Давтагдах цуврал нь `date`-ээрээ хэдэн сарын өмнө байж
         болох тул огноогоор шүүхгүй — цувралыг бүхэлд нь татаад дэлгэнэ.
         Давтагдахгүй эвентийг л ирээдүйгээр хумина. */
      Event.find(EVENT_WINDOW(now))
        .select("title type date endDate image recurring recurringUntil status")
        .sort({ date: 1 })
        .limit(200)
        .lean(),

      Post.countDocuments({ $or: MEDIA_OR }),
      Post.countDocuments({ $and: [{ $or: MEDIA_OR }, { createdAt: { $gte: new Date(now.getTime() - DAY) } }] }),
      Post.findOne({ $and: [{ $or: MEDIA_OR }, { visibility: "free" }] })
        .select("image images video")
        .sort({ createdAt: -1 })
        .lean(),
      Post.countDocuments({ $and: [{ $or: MEDIA_OR }, { visibility: "members" }] }),

      /* Гишүүд. Хамгийн СҮҮЛД нэгдсэн 6 — зурвас дээр "амьд ургаж байгаа"
         мэдрэмж өгөх нь хамгийн эртний 6-аас хүчтэй. Аватартай хүнийг
         эхэнд нь тавьдаггүй: тэгвэл зурвас нь бодит байдлаас илүү дүүрэн
         харагдана. Аватаргүй бол эхний үсгээр нүүр зурна. */
      User.find({ subscriptionExpiresAt: { $gt: now } })
        .select("name avatar")
        .sort({ clanJoinedAt: -1, createdAt: -1 })
        .limit(6)
        .lean(),
      User.countDocuments({ subscriptionExpiresAt: { $gt: now } }),
      User.countDocuments({
        subscriptionExpiresAt: { $gt: now },
        createdAt: { $gte: new Date(now.getTime() - 7 * DAY) },
      }),

      /* Тэргүүн. `/api/leaderboard`-той ЯГ ижил дүрэм (7 хоногийн XP) —
         хоёр газар өөрөөр тоолж эхэлбэл нэг нь худал болно. */
      User.aggregate([
        leaderboardHiddenMatch,
        { $unwind: "$xpHistory" },
        { $match: { "xpHistory.date": { $gte: new Date(now.getTime() - 7 * DAY) } } },
        { $group: { _id: "$_id", w: { $sum: "$xpHistory.amount" }, name: { $first: "$name" }, avatar: { $first: "$avatar" } } },
        { $match: { w: { $gt: 0 } } },
        { $sort: { w: -1 } },
        { $limit: 1 },
      ]),
      User.aggregate([
        leaderboardHiddenMatch,
        { $unwind: "$xpHistory" },
        { $match: { "xpHistory.date": { $gte: new Date(now.getTime() - 7 * DAY) } } },
        { $group: { _id: "$_id", w: { $sum: "$xpHistory.amount" } } },
        { $match: { w: { $gt: 0 } } },
        { $count: "n" },
      ]),
    ]);

  // ── Хуваарь: одоо явж байгаа, эсвэл дараагийнх ──
  const occ = expandMany(
    eventDocs as unknown[],
    (d) => d as RecurringSource & { _id: unknown },
    { from: new Date(now.getTime() - DAY), to: new Date(now.getTime() + 90 * DAY), now, maxPerSeries: 20 }
  ).filter((r) => r.occ.status !== "ended");

  const live = occ.find((r) => r.occ.status === "live");
  const head = live ?? occ[0] ?? null;
  const headDoc = (head?.doc ?? {}) as Record<string, unknown>;

  const upcoming30 = occ.filter(
    (r) => r.occ.start.getTime() <= now.getTime() + 30 * DAY
  ).length;

  // ── Бүтээл: урьдчилан харуулах зураг ЗӨВХӨН нээлттэй постоос ──
  const fp = (freePreview ?? {}) as unknown as Record<string, unknown>;
  const previewImage =
    (typeof fp.image === "string" && fp.image) ||
    (Array.isArray(fp.images) && typeof fp.images[0] === "string" ? (fp.images[0] as string) : "") ||
    "";

  return {
    schedule: {
      image: typeof headDoc.image === "string" ? headDoc.image : "",
      title: typeof headDoc.title === "string" ? headDoc.title : "",
      type: typeof headDoc.type === "string" ? headDoc.type : "event",
      at: head ? head.occ.start.toISOString() : null,
      live: !!live,
      upcoming: upcoming30,
    },
    creations: {
      image: previewImage,
      total: mediaTotal,
      fresh24h: freshCount,
      locked: lockedCount,
    },
    members: {
      avatars: (memberRows as unknown as { name?: string; avatar?: string }[]).map((m) => ({
        name: m.name || "Гишүүн",
        avatar: m.avatar || "",
      })),
      total: memberTotal,
      new7d,
    },
    leaders: {
      name: (leaderRows as { name?: string }[])[0]?.name || "",
      avatar: (leaderRows as { avatar?: string }[])[0]?.avatar || "",
      xp: (leaderRows as { w?: number }[])[0]?.w || 0,
      total: (leaderTotal as { n?: number }[])[0]?.n || 0,
    },
  };
}

export async function GET() {
  try {
    if (cache && Date.now() - cache.at < TTL_MS) {
      return NextResponse.json(cache.data);
    }
    const data = await build();
    cache = { at: Date.now(), data };
    return NextResponse.json(data);
  } catch (e) {
    console.error("[home-rail]", e);
    /* Зурвас нь нүүрний ГОЛ агуулга биш — унасан ч хуудас үлдэх ёстой.
       Хоосон бүтэц буцаавал бүрэлдэхүүн нь өөрөө нуугдана. */
    if (cache) return NextResponse.json(cache.data);
    return NextResponse.json({
      schedule: { image: "", title: "", type: "event", at: null, live: false, upcoming: 0 },
      creations: { image: "", total: 0, fresh24h: 0, locked: 0 },
      members: { avatars: [], total: 0, new7d: 0 },
      leaders: { name: "", avatar: "", xp: 0, total: 0 },
    });
  }
}
