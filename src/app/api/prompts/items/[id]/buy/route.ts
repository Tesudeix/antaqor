import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import PromptItem from "@/models/PromptItem";
import PromptOwnership from "@/models/PromptOwnership";
import { spendCredits } from "@/lib/credits";
import User from "@/models/User";
import CreditTx from "@/models/CreditTx";
import { pushToUser } from "@/lib/push";
import { getSetting } from "@/lib/siteSettings";

export const dynamic = "force-dynamic";

/* ─── ПРОМПТ ХУДАЛДАЖ АВАХ ────────────────────────────────────────────────

   Гишүүн гишүүнээсээ авдаг зах зээл. Antaqor нь худалдагч биш, ТАВЦАН:
   кредит нь зохиогч руу урсаж, тавцан хувь авна.

   ДӨРВӨН АЛХАМ, дараалал нь САНАМСАРГҮЙ БИШ. Алхам бүр өмнөхөө буцаах
   боломжтой байхаар бичигдсэн — дунд нь тасарвал хэн ч мөнгө, эрхээ
   алдахгүй:

     1. ХОМСДОЛ (atomic). `sold < editions` нөхцөлтэйгээр `sold`-ыг нэмнэ.
        Хоёр хүн сүүлийн хувийг зэрэг авах гэвэл MongoDB нэгийг нь л
        нэвтрүүлнэ. Энэ шалгалтыг код дээр (унших → шалгах → бичих) хийвэл
        хязгаарлагдмал цуврал ХЭТРҮҮЛЭН зарагдана — тэр нь ховордлыг
        худал болгож, IP-ийн үнэ цэнийг устгана.
     2. ЭЗЭМШИЛ (unique index). Давхар товшилт энд зогсоно.
     3. ХУДАЛДАН АВАГЧААС ХАСАХ. Амжилтгүй бол 1, 2-ыг буцаана.
     4. ЗОХИОГЧИД ОЛГОХ. Энэ алхам унасан ч худалдан авагч эрхээ авсан
        хэвээр — түүнийг буцаах нь илүү муу. Зөрүү нь логт үлдэнэ.

   ЯАГААД ЗОХИОГЧ ХУВЬ АВАХ ЁСТОЙ ВЭ: тавцан бүх мөнгийг авбал гишүүд
   промптоо энд БИШ, өөр газар тавина. Зохиогчийн хувь нь урамшуулал
   биш, нийлүүлэлтийн НӨХЦӨЛ. */

const DEFAULT_CREATOR_SHARE = 80; // %

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай", needAuth: true }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  await dbConnect();
  const item = await PromptItem.findById(id).select("author title price access editions sold").lean();
  const p = item as unknown as {
    _id: Types.ObjectId; author: Types.ObjectId; title: string;
    price?: number; access?: string; editions?: number; sold?: number;
  } | null;
  if (!p) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });

  if (p.access !== "premium") {
    return NextResponse.json({ error: "Энэ промпт үнэгүй" }, { status: 400 });
  }
  if (String(p.author) === userId) {
    return NextResponse.json({ error: "Өөрийн промптоо худалдаж авах шаардлагагүй" }, { status: 400 });
  }

  const already = await PromptOwnership.findOne({ user: userId, prompt: p._id }).lean();
  if (already) return NextResponse.json({ ok: true, already: true });

  const price = Math.max(1, Number(p.price) || 0);
  const editions = Math.max(0, Number(p.editions) || 0);

  // ── 1. Хомсдол — atomic ────────────────────────────────────────────
  const claimQuery: Record<string, unknown> = { _id: p._id };
  if (editions > 0) claimQuery.sold = { $lt: editions };
  const claimed = await PromptItem.findOneAndUpdate(claimQuery, { $inc: { sold: 1 } }, { new: true })
    .select("sold")
    .lean();
  if (!claimed) {
    return NextResponse.json({ error: "Бүх хувь зарагдсан", soldOut: true }, { status: 409 });
  }
  const edition = Number((claimed as unknown as { sold?: number }).sold) || 0;

  const rollbackSold = () => PromptItem.updateOne({ _id: p._id }, { $inc: { sold: -1 } }).catch(() => {});

  // ── 2. Эзэмшил — unique index ──────────────────────────────────────
  try {
    await PromptOwnership.create({ user: userId, prompt: p._id, spent: price, edition });
  } catch {
    await rollbackSold();
    return NextResponse.json({ ok: true, already: true });
  }

  // ── 3. Худалдан авагчаас хасах ─────────────────────────────────────
  const paid = await spendCredits({
    userId,
    amount: price,
    reason: "PROMPT_BUY",
    ref: String(p._id),
    meta: { title: p.title, edition },
  });
  if (!paid.ok) {
    await PromptOwnership.deleteOne({ user: userId, prompt: p._id }).catch(() => {});
    await rollbackSold();
    return NextResponse.json(
      {
        error: `Кредит хүрэлцэхгүй. ${price} шаардлагатай, танд ${paid.balance} байна.`,
        code: "INSUFFICIENT_CREDITS",
        balance: paid.balance,
        required: price,
        buyHref: "/credits/buy",
      },
      { status: 402 }
    );
  }

  // ── 4. Зохиогчид олгох ─────────────────────────────────────────────
  const sharePct = await getSetting("promptCreatorShare").catch(() => DEFAULT_CREATOR_SHARE);
  const pct = Number.isFinite(sharePct) && sharePct > 0 && sharePct <= 100 ? sharePct : DEFAULT_CREATOR_SHARE;
  const creatorCut = Math.max(1, Math.floor((price * pct) / 100));

  /* `awardCredits` ашиглаагүй ЗОРИУД: түүний `reason` нь хаалттай төрөл
     бөгөөд шагналын тогтмол хүснэгттэй холбоотой. Зарах үнэ нь хувьсах
     тул тэр хүснэгтэд багтахгүй. `refundCredits`-ийн адилаар шууд, атомик
     бичилт хийнэ — CreditTx-ийн `reason` нь чөлөөт мөр. */
  try {
    const updatedCreator = await User.findByIdAndUpdate(
      p.author,
      { $inc: { credits: creatorCut, creditsLifetime: creatorCut } },
      { new: true, projection: { credits: 1 } }
    ).lean();
    await CreditTx.create({
      user: p.author,
      kind: "earn",
      amount: creatorCut,
      reason: "PROMPT_SALE",
      xpAwarded: 0,
      ref: String(p._id),
      balanceAfter: (updatedCreator as unknown as { credits?: number } | null)?.credits || 0,
      meta: { title: p.title, buyer: userId, edition, price, sharePct: pct },
    });
  } catch {
    /* Зохиогчид олгох алхам унасан ч худалдан авагчийн эрх ҮЛДЭНЭ —
       түүнийг буцаах нь илүү муу. Зөрүү нь логт үлдэж, гараар засагдана. */
    console.error("[prompt/buy] creator payout failed", String(p._id));
  }
  await PromptItem.updateOne({ _id: p._id }, { $inc: { earnings: creatorCut } }).catch(() => {});

  pushToUser(String(p.author), {
    title: `+${creatorCut} кредит · промпт зарагдлаа`,
    body: `${p.title || "Промпт"} · ${editions > 0 ? `${edition}/${editions}` : `#${edition}`}`,
    url: "/prompts",
    tag: `prompt-sale-${p._id}`,
  }).catch(() => {});

  return NextResponse.json({
    ok: true,
    edition,
    balance: paid.balance,
    spent: price,
    remaining: editions > 0 ? Math.max(0, editions - edition) : null,
  });
}
