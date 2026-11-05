import dbConnect from "@/lib/mongodb";
import Payment from "@/models/Payment";
import User from "@/models/User";
import { generateUniqueRefCode } from "@/lib/paymentCode";
import { createWireCheckoutForPayment, getWireIntentStatus, wireEnabled } from "@/lib/wire";
import { activateBusiness, BUSINESS_DAYS, BUSINESS_PRICE } from "@/lib/agentWs";
import { pushToUser } from "@/lib/push";

/* ─── Antaqor Agent · Бизнес багц (99,000₮ / 30 хоног) ─────────────────────
   Төлбөр нь Payment(kind "agent") — QPay (Wire hosted checkout). Гүйцээх нь
   ГАНЦ газар (`fulfillAgentPurchase`): Wire-ийн буцалт, статусын асуулт,
   админы гар баталгаа, банкны auto-match бүгд үүнийг дуудна.
   `pending → paid` атомик findOneAndUpdate нь давхар сунгалтын цорын ганц хаалт. */

export type AgentGrantSource = "wire" | "admin-approve" | "auto-match";

export async function fulfillAgentPurchase(opts: { paymentId: string; source: AgentGrantSource; adminNote?: string }) {
  await dbConnect();
  const set: Record<string, unknown> = { status: "paid", paidAt: new Date() };
  if (opts.adminNote) set.adminNote = opts.adminNote;
  const payment = await Payment.findOneAndUpdate({ _id: opts.paymentId, kind: "agent", status: "pending" }, { $set: set }, { new: true });
  if (!payment) return null;
  const u = await User.findById(payment.user).select("email name username").lean<{ email?: string; name?: string; username?: string }>();
  const r = await activateBusiness(String(payment.user), Number(payment.periodDays) || BUSINESS_DAYS, { email: (u?.email || "").toLowerCase(), name: u?.name || u?.username || "" });
  pushToUser(String(payment.user), {
    title: "Antaqor Agent · Бизнес багц идэвхжлээ",
    body: `${new Date(r.paidUntil).toISOString().slice(0, 10)} хүртэл бүх боломж нээлттэй.`,
    url: "/content-agent",
    tag: `agent-paid-${payment._id}`,
  }).catch(() => {});
  return { ...r, source: opts.source };
}

/** QPay checkout эхлүүлэх — хүлээгдэж буй нэхэмжлэхийг дахин ашиглана. */
export async function startAgentCheckout(userId: string): Promise<{ url: string | null; paid?: boolean }> {
  if (!wireEnabled()) throw new Error("QPay түр ажиллахгүй байна — дараа дахин оролдоно уу");
  await dbConnect();
  const u = await User.findById(userId).select("email username phone name").lean<{ email?: string; username?: string; phone?: string; name?: string }>();
  let payment = await Payment.findOne({ user: userId, kind: "agent", status: "pending" }).sort({ createdAt: -1 });
  if (payment && payment.amount !== BUSINESS_PRICE) {
    await Payment.updateOne({ _id: payment._id, status: "pending" }, { $set: { status: "failed", adminNote: "Үнэ өөрчлөгдсөн — шинэ нэхэмжлэхээр солив" } });
    payment = null;
  }
  if (!payment) {
    payment = await Payment.create({
      user: userId,
      invoiceId: `AGT-${Date.now()}-${userId.slice(-4)}`,
      senderCode: u?.email || u?.username || userId,
      referenceCode: await generateUniqueRefCode(),
      amount: BUSINESS_PRICE,
      description: `Antaqor Agent · Бизнес багц (${BUSINESS_DAYS} хоног)`,
      kind: "agent",
      periodDays: BUSINESS_DAYS,
      status: "pending",
    });
  }
  const tag = u?.username || u?.phone || u?.email || u?.name || userId;
  const { intentId, url, alreadyPaid } = await createWireCheckoutForPayment({
    paymentId: String(payment._id),
    amountTugrik: payment.amount,
    plan: "agent",
    userId,
    description: `Antaqor Agent бизнес · ${tag}`,
    /* NEXTAUTH_URL биш — wire/checkout-ийн тайлбарыг үз (өөр домэйн руу буцаах эрсдэл). */
    successUrl: `${process.env.WIRE_RETURN_BASE || "https://antaqor.com"}/content-agent?paid=1`,
    existingIntentId: payment.wireIntentId || null,
  });
  if (intentId && intentId !== payment.wireIntentId) {
    payment.wireIntentId = intentId;
    await payment.save();
  }
  if (alreadyPaid) {
    await fulfillAgentPurchase({ paymentId: String(payment._id), source: "wire", adminNote: "Wire (QPay) автомат баталгаажуулалт" });
    return { url: null, paid: true };
  }
  return { url };
}

/** Сүүлийн бизнес төлбөрийн төлөв — Wire дээр төлөгдсөн бол энд гүйцээнэ. */
export async function checkAgentPayment(userId: string): Promise<{ status: "none" | "pending" | "paid"; at?: Date }> {
  await dbConnect();
  const p = await Payment.findOne({ user: userId, kind: "agent" }).sort({ createdAt: -1 }).lean<{ _id: unknown; status: string; wireIntentId?: string; paidAt?: Date }>();
  if (!p) return { status: "none" };
  if (p.status === "paid") return { status: "paid", at: p.paidAt };
  if (p.status !== "pending" || !p.wireIntentId || !wireEnabled()) return { status: "pending" };
  try {
    if ((await getWireIntentStatus(p.wireIntentId)) === "succeeded") {
      await fulfillAgentPurchase({ paymentId: String(p._id), source: "wire", adminNote: "Wire (QPay) автомат баталгаажуулалт" });
      return { status: "paid", at: new Date() };
    }
  } catch { /* Wire хүрэхгүй — дараагийн асуултаар */ }
  return { status: "pending" };
}
