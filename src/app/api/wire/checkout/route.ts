import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Payment from "@/models/Payment";
import User from "@/models/User";
import { createWireCheckoutForPayment, wireEnabled } from "@/lib/wire";

export const dynamic = "force-dynamic";

/**
 * Start a Wire hosted checkout for the user's latest pending plan payment
 * (created by /api/clan/join). Amount comes from the Payment record — the
 * client sends nothing. On success the pricing page's status poll (or the
 * user returning via success_url) flips the payment to paid automatically.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    if (!wireEnabled()) {
      return NextResponse.json({ error: "wire_disabled" }, { status: 503 });
    }
    const userId = (session.user as { id: string }).id;

    await dbConnect();
    /* Agent бизнес багц өөрийн checkout-тай (/api/content-agent/billing). */
    const payment = await Payment.findOne({ user: userId, status: "pending", kind: { $ne: "agent" } }).sort({
      createdAt: -1,
    });
    if (!payment) {
      return NextResponse.json({ error: "no_pending_payment" }, { status: 400 });
    }

    const buyer = (await User.findById(userId)
      .select("username phone email name")
      .lean()) as { username?: string; phone?: string; email?: string; name?: string } | null;
    const buyerTag =
      buyer?.username || buyer?.phone || buyer?.email || buyer?.name || userId;

    /* Энэ маршрут нь ХАМГИЙН СҮҮЛИЙН pending төлбөрийг олдог бөгөөд тэр
       нь гишүүнчлэл ч байж болно, кредит ч байж болно. Хоёуланд нь
       ажилладаг байсан — дутуу байсан зүйл нь зөвхөн ЗӨВ БУЦАХ ХУУДАС ба
       танигдахуйц тайлбар. Кредит худалдан авагчийг /pricing руу буцаавал
       тэр хүн юу болсныг ойлгохгүй. */
    const isCredits = payment.kind === "credits";
    const returnPath = isCredits ? "/credits/buy?wire=1" : "/pricing?wire=1";
    const label = isCredits
      ? `${payment.creditAmount || 0} кредит`
      : payment.plan || "plan";

    const { intentId, url, alreadyPaid } = await createWireCheckoutForPayment({
      paymentId: String(payment._id),
      amountTugrik: payment.amount,
      plan: payment.plan || "",
      userId,
      description: `Antaqor ${label} · ${buyerTag}`,
      /* NEXTAUTH_URL-ийг ЭНД ашиглаж БОЛОХГҮЙ: тэр нь одоо
         https://tesudeix.com (нэг апп, өөр домэйн). Түүгээр буцаавал
         antaqor.com дээр төлбөрөө эхлүүлсэн хүн гэнэт танихгүй домэйн
         дээр буун гарна — төлбөрийн урсгалд энэ нь залилан мэт харагдана.
         Гишүүнчлэлийн зам (wire.ts дэх SUCCESS_URL) аль хэдийн
         antaqor.com-ыг хатуу бичсэн; хоёулаа нэг дүрэмтэй байг. */
      successUrl: `${process.env.WIRE_RETURN_BASE || "https://antaqor.com"}${returnPath}`,
      /* Өмнөх intent-ийг дамжуулна. Үгүй бол `pi-<paymentId>` идемпотенси
         түлхүүр нь 10 минутын дараа үхсэн intent рүү үүрд зааж, худалдан
         авагч дахин хэзээ ч QPay нээж чадахгүй болдог байв. */
      existingIntentId: payment.wireIntentId || null,
    });

    if (intentId && intentId !== payment.wireIntentId) {
      payment.wireIntentId = intentId;
      await payment.save();
    }

    /* Wire дээр аль хэдийн төлөгдсөн байсан бол шинэ нэхэмжлэх УГ ЁСООР
       үүсгэхгүй — хоёр дахь удаагаа төлүүлэх эрсдэлтэй. Статусын асуулт
       (payment-status / credits purchase status) хэдхэн секундын дотор
       эрхийг нь өөрөө нээнэ. */
    if (alreadyPaid) {
      return NextResponse.json({ paid: true, url: null });
    }

    return NextResponse.json({ url });
  } catch (e) {
    console.error("[wire/checkout]", e);
    return NextResponse.json({ error: "provider_error" }, { status: 502 });
  }
}
