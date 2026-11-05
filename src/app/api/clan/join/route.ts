import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { getSalePlans } from "@/lib/planStore";
import Payment from "@/models/Payment";
import User from "@/models/User";
import { isRecoverableTag } from "@/lib/payTag";
import { generateUniqueRefCode } from "@/lib/paymentCode";
import {
  PLANS,
  annualPrice,
  planPeriodDays,
} from "@/lib/plans";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const userEmail = session.user.email || "";

    /* ─── АЛЬ ТАРИФ ЗАРАГДАЖ БАЙГААГ АДМИН ШИЙДНЭ ─────────────────────
       Өмнө нь энэ шалгалт зөвхөн кодын `PAID_PLANS`-ыг хардаг байсан тул
       админаас УНТРААСАН тариф ч "худалдаж болно" гэж тооцогдоно.
       Түүнээс ноцтой нь: танигдаагүй `plan` ирэхэд чимээгүйхэн
       `PAID_PLANS[0]` (= `starter`, админ дээр active=false) руу шилждэг
       байв — өөрөөр хэлбэл хүн нэг тариф дараад ӨӨР тарифын, өөр дүнтэй
       төлбөр үүсэх боломжтой. Мөнгөний урсгалд чимээгүй орлуулалт байж
       БОЛОХГҮЙ: зарагдаагүй тарифыг одоо шууд буцаана.

       Үнэ нь /pricing-ийн харуулсан ЯГ ТЭР дүн байх ёстой тул жагсаалт
       нь `planStore`-оос ирнэ — дэлгэц ба төлбөр хоёр нэг эх сурвалжтай.
       Банкны авто-тааруулагч ДҮНГЭЭР таньдаг тул зөрвөл тэр төлбөр хэзээ
       ч баталгаажихгүй. */
    const salePlans = await getSalePlans();
    if (salePlans.length === 0) {
      return NextResponse.json({ error: "no_plans_on_sale" }, { status: 503 });
    }

    let requested: unknown;
    let period: "month" | "year" = "month";
    try {
      const body = await req.json();
      requested = body?.plan;
      if (body?.period === "year") period = "year";
    } catch {
      /* no body — legacy clan join */
    }

    /* Тариф нэрлэсэн бол тэр нь ЗААВАЛ зарагдаж байх ёстой. Нэрлээгүй
       (хуучин дуудлага) бол зарагдаж буй эхнийх — кодын өгөгдмөл биш,
       үнэхээр идэвхтэй нэг нь. */
    const effective =
      requested === undefined || requested === null
        ? salePlans[0]
        : salePlans.find((p) => p.id === requested);

    if (!effective) {
      return NextResponse.json({ error: "plan_unavailable" }, { status: 400 });
    }
    const plan = effective.id;

    if (effective.oneTime) period = "month";     // no annual on a fixed term
    const price = period === "year" ? annualPrice(effective) : effective.price;
    const periodDays = planPeriodDays(effective, period);

    await dbConnect();

    /* Гүйлгээний утганд бичих ЗҮЙЛ. Хүн санамсаргүй 6 тэмдэгт кодыг банкны
       аппд бичихээс илүү өөрийн нэрээ зөв бичнэ — тиймээс худалдан авагчид
       харуулах таних тэмдэг нь username болов. Код нь ҮГҮЙ БОЛООГҮЙ: DB-д
       хэвээр хадгалагдаж, админы жагсаалт болон авто-тааруулагчийн эхний
       дохио хэвээр үлдэнэ (auto-match/route.ts). */
    const payer = (await User.findById(userId).select("username").lean()) as
      | { username?: string }
      | null;
    /* ЗААВАЛ ШАЛГАНА: авто-тааруулагч банкны хуулгын мөрөөс сугалж чадах
       хэлбэртэй байж гэмээнэ харуулна. Богино (`dok`), тоогоор эхэлсэн
       (`4331_bulgan`), эсвэл банкны нийтлэг үгтэй давхацсан нэрийг
       харуулбал хүн түүнийг бичсэн ч систем нь буцааж таньж чадахгүй —
       тэр тохиолдолд /pricing нь ref код руу шилжинэ. */
    const username = isRecoverableTag(payer?.username) ? String(payer?.username) : "";

    // ─── Founding 100: the cap is real, and it is enforced here ───
    // The wall can say "37/100" all it likes; this is the only place that can
    // actually stop the 101st person from paying. Counted on PAID payments,
    // because a pending transfer is not a seat.
    if (PLANS[plan].cap) {
      const taken = await Payment.countDocuments({
        kind: "membership",
        plan,
        status: "paid",
      });
      if (taken >= (PLANS[plan].cap as number)) {
        return NextResponse.json(
          { error: "founding_full", message: "Founding 100 дүүрсэн байна." },
          { status: 409 }
        );
      }
    }

    // Reuse a pending payment for the SAME plan+amount; a pending payment for
    // a different selection gets superseded (marked failed) so the ref code
    // the user sees always matches the amount they're about to transfer.
    const existing = await Payment.findOne({
      user: userId,
      status: "pending",
      kind: "membership",
    }).sort({ createdAt: -1 });

    if (existing && existing.amount === price) {
      if (!existing.referenceCode) {
        existing.referenceCode = await generateUniqueRefCode();
      }
      if (!existing.plan) existing.plan = plan;
      if (!existing.periodDays) existing.periodDays = periodDays;
      await existing.save();
      return NextResponse.json({
        paymentId: existing._id,
        referenceCode: existing.referenceCode,
        username,
        referenceId: existing.senderCode,
        email: userEmail,
        amount: existing.amount,
        plan: existing.plan || plan,
        period,
        status: existing.status,
        hasReceipt: !!existing.receiptImage,
      });
    }

    if (existing) {
      existing.status = "failed";
      existing.adminNote = `Superseded by new ${plan}/${period} selection`;
      await existing.save();
    }

    const referenceCode = await generateUniqueRefCode();

    const payment = await Payment.create({
      user: userId,
      invoiceId: `INV-${Date.now()}`,
      senderCode: userEmail,
      referenceCode,
      amount: price,
      plan,
      periodDays,
      kind: "membership",
      description: `Antaqor ${effective.name} (${period === "year" ? "жил" : "сар"}) — ${userEmail}`,
      status: "pending",
    });

    return NextResponse.json({
      paymentId: payment._id,
      referenceCode: payment.referenceCode,
      username,
      referenceId: userEmail,
      email: userEmail,
      amount: payment.amount,
      plan,
      period,
      status: "pending",
      hasReceipt: false,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Payment failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
