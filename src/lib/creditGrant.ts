import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Payment from "@/models/Payment";
import CreditTx from "@/models/CreditTx";
import { pushToUser } from "@/lib/push";

/* ─── Кредит худалдан авалтыг гүйцээх — ГАНЦ хэрэгжүүлэлт ────────────────

   `membershipGrant.ts`-ийн яг тэр сургамж, зөвхөн кредит талдаа. Кредит
   нэмэх код өнөөдөр ХОЁР газар хуулбарлагдсан байсан:

     /api/admin/payments/[id]/approve  → админ гараар баталсан
     /api/admin/payments/auto-match    → банкны хуулга автоматаар таарсан

   Тэдэн дээр Wire (QPay) гурав дахь замыг нэмэх нь гурван хуулбар болно.
   Гурван хуулбар гэдэг нь: нэгийг нь засахад нөгөө хоёр нь хуучирна.
   Кредит бол МӨНГӨ — тэнд ийм зөрүү бол алдагдал.

   Тиймээс гүйцээх үйлдэл ЭНД амьдарна. Аль ч зам дуудсан бай, үр дүн нь
   ижил бүрэн байна: төлбөр хаагдана, кредит нэмэгдэнэ, гүйлгээ бичигдэнэ,
   хүнд мэдэгдэл очно.

   ДАВХАР ОЛГОХООС ХАМГААЛСАН НЬ: төлбөрийг `pending → paid` болгох
   findOneAndUpdate нь атомик. Хоёр хүсэлт зэрэг ирвэл ЗӨВХӨН нэг нь
   баримтыг гартаа авна, нөгөө нь `null` авч шууд буцна. Тэр нэг мөрөөс
   болж админ хоёр дарахад, эсвэл Wire-ийн эргэн ирэлт болон статусын
   асуулт зэрэг ажиллахад кредит хоёр дахин нэмэгдэхгүй.                */

export type CreditGrantSource =
  | "admin-approve"  // админ баталсан
  | "auto-match"     // банкны хуулга таарсан
  | "wire";          // Wire (QPay) шууд төлөлт

export interface CreditGrantResult {
  granted: number;
  balance: number;
  paymentId: string;
}

export async function fulfillCreditPurchase(opts: {
  paymentId: string;
  source: CreditGrantSource;
  adminNote?: string;
  notify?: boolean;
}): Promise<CreditGrantResult | null> {
  await dbConnect();

  /* Атомик шилжилт: зөвхөн ОДОО pending байгаа бол л paid болгоно.
     Энэ нь давхар олголтын цорын ганц бөгөөд хангалттай хаалт. */
  const set: Record<string, unknown> = { status: "paid", paidAt: new Date() };
  if (opts.adminNote) set.adminNote = opts.adminNote;

  const payment = await Payment.findOneAndUpdate(
    { _id: opts.paymentId, kind: "credits", status: "pending" },
    { $set: set },
    { new: true }
  );
  if (!payment) return null; // аль хэдийн гүйцээгдсэн, эсвэл кредит биш

  const grant = Math.max(1, Math.min(100_000, Number(payment.creditAmount) || 0));

  const updated = await User.findByIdAndUpdate(
    payment.user,
    { $inc: { credits: grant, creditsLifetime: grant } },
    { new: true, projection: { credits: 1 } }
  ).lean();
  const balanceAfter = (updated as unknown as { credits?: number } | null)?.credits || 0;

  await CreditTx.create({
    user: payment.user,
    kind: "earn",
    amount: grant,
    reason: "PURCHASE",
    xpAwarded: 0,
    ref: String(payment._id),
    balanceAfter,
    meta: { packageId: payment.packageId, amount: payment.amount, source: opts.source },
  });

  if (opts.notify !== false) {
    pushToUser(String(payment.user), {
      title: `+${grant} кредит нэмэгдлээ`,
      body: `Данс руу шилжлээ. Шинэ үлдэгдэл: ${balanceAfter} кредит.`,
      url: "/credits",
      tag: `credits-purchase-${payment._id}`,
    }).catch(() => {});
  }

  return { granted: grant, balance: balanceAfter, paymentId: String(payment._id) };
}
