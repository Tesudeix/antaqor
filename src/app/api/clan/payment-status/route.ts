import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Payment from "@/models/Payment";
import { activateMembership } from "@/lib/membershipGrant";
import { getWireIntentStatus, wireEnabled } from "@/lib/wire";

// GET — return the user's latest payment + subscription state.
// Polled by /pricing while waiting. When the payment has a Wire intent, the
// poll itself verifies Wire server-side and auto-approves on success — no
// admin action needed for instant payments.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ payment: null, isMember: false });
    }
    const userId = (session.user as { id: string }).id;

    await dbConnect();

    /* Зөвхөн ГИШҮҮНЧЛЭЛИЙН төлбөр. Өмнө нь төрлөөс үл хамааран хамгийн
       сүүлийнхийг авдаг байсан тул Wire-ээр төлөгдсөн кредит / Agent бизнес
       багцын (2026-10-26) төлбөрийг ч гишүүнчлэл болгон нээх эрсдэлтэй байв. */
    const payment = (await Payment.findOne({ user: userId, kind: { $in: ["membership", null] } })
      .sort({ createdAt: -1 })
      .select(
        "status amount plan referenceCode receiptImage receiptUploadedAt claimedAt adminNote paidAt createdAt wireIntentId"
      )
      .lean()) as { [k: string]: unknown } | null;

    if (
      payment &&
      payment.status === "pending" &&
      typeof payment.wireIntentId === "string" &&
      payment.wireIntentId &&
      wireEnabled()
    ) {
      try {
        const wireStatus = await getWireIntentStatus(payment.wireIntentId);
        if (wireStatus === "succeeded") {
          // Same fulfillment as admin approve (membership branch, 30 days).
          const doc = await Payment.findById(payment._id);
          if (doc && doc.status === "pending") {
            /* `activateMembership` нь төлбөрийг өөрөө `paid` болгоно —
               энд урьдчилж хааж болохгүй: хаачихвал доорх дуудлага
               "аль хэдийн төлөгдсөн" гэж үзээд шат/мэдэгдлийг алгасах
               эрсдэлтэй. Тэмдэглэлийг л урьдчилж бичив. */
            doc.adminNote = "Wire автомат баталгаажуулалт";
            await doc.save();

            await activateMembership({
              userId,
              days: Number(doc.periodDays) || 30,
              plan: doc.plan || undefined,
              paymentId: String(doc._id),
              source: "wire",
            });
          }
          payment.status = "paid";
          payment.paidAt = payment.paidAt ?? new Date();
        }
      } catch {
        // Wire unreachable — keep polling; bank transfer path still works.
      }
    }

    return NextResponse.json({ payment });
  } catch {
    return NextResponse.json({ payment: null });
  }
}

export const dynamic = "force-dynamic";
