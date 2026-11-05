import { NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

// Social / system accounts are the "ghost" users auto-created from Meta DMs
// (Instagram / Messenger). They carry a placeholder email `<platform>_<psid>@antaqor.dm`
// and never set a real password. Everyone else is a registered member.
const SOCIAL_MATCH = { email: { $regex: "@antaqor\\.dm$", $options: "i" } };
const REGISTERED_MATCH = { email: { $not: { $regex: "@antaqor\\.dm$", $options: "i" } } };

export async function GET(req: Request) {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  try {
    await dbConnect();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const filter = searchParams.get("filter") || "all";
    /* СОШИАЛ ХЭРЭГЛЭГЧИД ЭНЭ ЖАГСААЛТААС ГАРСАН (2026-09-04).
       Тэд бол Instagram/Messenger DM-ээс автоматаар үүссэн "сүүдэр"
       бүртгэлүүд — нэр нь psid, имэйл нь хиймэл, хэзээ ч нэвтэрч
       байгаагүй. Тэднийг жинхэнэ гишүүдтэй нэг хүснэгтэд тавих нь
       хоёр талдаа хор хөнөөлтэй байв:
         · жагсаалт нь хайхад хэрэггүй мөрөөр дүүрдэг;
         · ДЭЭД ТАЛЫН ТОО ХУДАЛ болдог — 778 "хэрэглэгч" гэдэг нь
           509 бүртгэлтэй + 269 сүүдэр байсан тул хөрвүүлэлт 9%
           гэж харагддаг байсан нь бодитоор 14% байв.
       Тэдгээр яриа `/admin/(social)/inbox` дээрээ бүтнээрээ байна. */
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const perPage = Math.min(100, Math.max(10, parseInt(searchParams.get("perPage") || "50", 10) || 50));
    const sort = searchParams.get("sort") || "new";

    const conditions: Record<string, unknown>[] = [];

    // ҮРГЭЛЖ зөвхөн бүртгэлтэй хүн. Сонголт байхгүй — сонголт байсан нь
    // сүүдэр бүртгэлүүдийг санамсаргүй үзэх боломж үлдээж байв.
    conditions.push(REGISTERED_MATCH);

    if (search) {
      conditions.push({
        $or: [
          { name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
          { metaInstagramId: { $regex: search, $options: "i" } },
        ],
      });
    }

    if (filter === "members") {
      conditions.push({ clan: { $ne: "" } });
    } else if (filter === "non-members") {
      conditions.push({ $or: [{ clan: "" }, { clan: null }, { clan: { $exists: false } }] });
    } else if (filter === "expired") {
      conditions.push({ clan: { $ne: "" } });
      conditions.push({ subscriptionExpiresAt: { $lt: new Date() } });
    }

    const query = conditions.length > 0 ? { $and: conditions } : {};

    /* ХУУДАСЛАЛТ. Өмнө нь энэ нь 509 баримтыг БҮГДИЙГ нь нэг дор татаж,
       клиент рүү илгээж, DOM-д зурдаг байв — админ хуудас нээх бүрд.
       Гишүүд нэмэгдэх тусам тэр нь шугаман байдлаар удааширна. */
    const SORTS: Record<string, Record<string, 1 | -1>> = {
      new: { createdAt: -1 },
      old: { createdAt: 1 },
      credits: { credits: -1 },
      expiring: { subscriptionExpiresAt: 1 },
      name: { name: 1 },
    };
    const sortSpec = SORTS[sort] || SORTS.new;

    const matchedCount = await User.countDocuments(query);
    const users = await User.find(query)
      .select("name email phone avatar bio age aiExperience interests clan clanJoinedAt subscriptionExpiresAt role createdAt credits metaInstagramId metaMessengerPsid")
      .sort(sortSpec)
      .skip((page - 1) * perPage)
      .limit(perPage)
      .lean();

    // Tag each row with its source so the UI can badge mixed ("all") views.
    const rows = users.map((u) => {
      const isSocial = typeof u.email === "string" && /@antaqor\.dm$/i.test(u.email);
      const platform = u.metaInstagramId ? "instagram" : u.metaMessengerPsid ? "messenger" : null;
      return { ...u, source: isSocial ? "social" : "registered", platform };
    });

    /* БҮХ ТОО ЗӨВХӨН БҮРТГЭЛТЭЙ ХҮНИЙ ДООР. Хольсон тоо нь хөрвүүлэлтийг
       худал бага харуулж, шийдвэрийг гажуудуулна. */
    const totalUsers = await User.countDocuments(REGISTERED_MATCH);
    const totalSocial = await User.countDocuments(SOCIAL_MATCH);
    const totalRegistered = totalUsers;
    const totalMembers = await User.countDocuments({
      ...REGISTERED_MATCH,
      clan: { $ne: "" },
      subscriptionExpiresAt: { $gt: new Date() },
    });

    const aiLevelCounts = await User.aggregate([
      { $match: { ...REGISTERED_MATCH, aiExperience: { $ne: "" } } },
      { $group: { _id: "$aiExperience", count: { $sum: 1 } } },
    ]);

    const interestCounts = await User.aggregate([
      { $match: REGISTERED_MATCH },
      { $unwind: "$interests" },
      { $group: { _id: "$interests", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    return NextResponse.json({
      users: rows,
      page,
      perPage,
      matchedCount,
      pageCount: Math.max(1, Math.ceil(matchedCount / perPage)),
      totalUsers,
      totalRegistered,
      totalSocial,
      totalMembers,
      aiLevelCounts,
      interestCounts,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Серверийн алдаа";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
