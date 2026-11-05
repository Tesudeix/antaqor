import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import Payment from "@/models/Payment";
import User from "@/models/User";
import { activateMembership } from "@/lib/membershipGrant";
import { fulfillCreditPurchase } from "@/lib/creditGrant";
import { fulfillAgentPurchase } from "@/lib/agentBilling";

type Params = Promise<{ id: string }>;

// POST — one-click approve. Behaviour depends on Payment.kind:
//  - "membership" (default): grant/extend subscription, fire referral reward
//  - "credits":              atomically $inc user.credits, log a CreditTx
export async function POST(
  req: Request,
  { params }: { params: Params }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const { id } = await params;
    if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const days = Math.max(1, Math.min(365, Number(body.days) || 30));

    await dbConnect();

    const payment = await Payment.findById(id);
    if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (payment.status === "paid") {
      return NextResponse.json({ error: "Already approved" }, { status: 409 });
    }

    // ─── Branch: credits purchase ─────────────────────────────────
    /* Кредит нэмэх БҮХ логик `src/lib/creditGrant.ts`-д. Энд хуулбар
       байсан бөгөөд `auto-match` дээр бас нэг байв — Wire (QPay) нь
       гурав дахь дуудагч болох гэж байсан тул нэг лавлагаа болгов.
       ЖИЧ: `auto-match/route.ts` дээрх хуулбар ХЭВЭЭР байна — тэр нь
       банкны амьд тааруулагч тул тусад нь болгоомжтой шилжүүлнэ. */
    if (payment.kind === "credits") {
      const done = await fulfillCreditPurchase({
        paymentId: String(payment._id),
        source: "admin-approve",
      });
      /* null = өөр зам (Wire эсвэл өөр админ) хормын өмнө гүйцээчихсэн.
         Кредит хоёр дахин нэмэгдэхээс сэргийлж 409 буцаана. */
      if (!done) return NextResponse.json({ error: "Already approved" }, { status: 409 });
      return NextResponse.json({
        ok: true,
        kind: "credits",
        payment: { _id: payment._id, status: "paid", paidAt: new Date() },
        user: { _id: payment.user, credits: done.balance },
      });
    }

    // ─── Branch: Antaqor Agent бизнес багц ─────────────────────────
    if (payment.kind === "agent") {
      const done = await fulfillAgentPurchase({ paymentId: String(payment._id), source: "admin-approve" });
      if (!done) return NextResponse.json({ error: "Already approved" }, { status: 409 });
      return NextResponse.json({ ok: true, kind: "agent", payment: { _id: payment._id, status: "paid", paidAt: new Date() }, workspace: done });
    }

    payment.status = "paid";
    payment.paidAt = new Date();
    await payment.save();

    const user = await User.findById(payment.user);
    if (!user) return NextResponse.json({ error: "User gone" }, { status: 404 });

    // ─── Branch: membership (default) ─────────────────────────────────────
    /* Эрх нээх бүх логик `activateMembership`-д. Энд давхардуулж бичих нь
       яг тэр зөрүүг төрүүлдэг байсан: энэ файл `plan` тавьдаг байхад
       /admin/members-ийн grant тавьдаггүй байв. */
    const grant = await activateMembership({
      userId: String(user._id),
      days: Number(body.days) ? days : Number(payment.periodDays) || days,
      plan: payment.plan || undefined,
      paymentId: String(payment._id),
      source: "admin-approve",
    });

    return NextResponse.json({
      ok: true,
      kind: "membership",
      payment: { _id: payment._id, status: payment.status, paidAt: payment.paidAt },
      user: {
        _id: user._id,
        subscriptionExpiresAt: grant?.expiresAt ?? null,
        plan: grant?.plan ?? null,
        clan: "antaqor",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
