import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import Payment from "@/models/Payment";
import User from "@/models/User";
import { wireEnabled, getWireIntentStatus } from "@/lib/wire";
import { fulfillCreditPurchase } from "@/lib/creditGrant";

// GET ?id=<paymentId> — status of ONE of my credit purchases + live balance.
// Polled by /credits/buy so the screen advances itself the moment the admin
// (or the bank auto-matcher) approves.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const id = new URL(req.url).searchParams.get("id") || "";
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  await dbConnect();
  let [payment, user] = await Promise.all([
    Payment.findOne({ _id: id, user: userId, kind: "credits" })
      .select("status referenceCode amount creditAmount packageId receiptImage adminNote paidAt createdAt wireIntentId")
      .lean(),
    User.findById(userId).select("credits").lean(),
  ]);
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  /* ─── Wire (QPay) баталгаажуулалт ───────────────────────────────────
     Гишүүнчлэлийн тал (`/api/clan/payment-status`) үүнийг аль хэдийн
     хийдэг байсан; кредитийн тал хийдэггүй байв. Үр дүн нь: QPay-ээр
     төлсөн хүн буцаж ирээд "хүлээгдэж байна" дэлгэц хараад суудаг.
     Гүйцээх ажлыг `creditGrant` хийнэ — тэр нь атомик тул энэ асуулт
     хэдэн ч удаа давтагдсан кредит нэг л удаа нэмэгдэнэ. */
  const pw = payment as unknown as { status: string; wireIntentId?: string };
  if (pw.status === "pending" && pw.wireIntentId && wireEnabled()) {
    try {
      const wireStatus = await getWireIntentStatus(pw.wireIntentId);
      if (wireStatus === "succeeded") {
        const done = await fulfillCreditPurchase({
          paymentId: id,
          source: "wire",
          adminNote: "Wire (QPay) автомат баталгаажуулалт",
        });
        if (done) {
          [payment, user] = await Promise.all([
            Payment.findOne({ _id: id, user: userId, kind: "credits" })
              .select("status referenceCode amount creditAmount packageId receiptImage adminNote paidAt createdAt wireIntentId")
              .lean(),
            User.findById(userId).select("credits").lean(),
          ]);
        }
      }
    } catch {
      /* Wire хүрэхгүй байна — асуултаа үргэлжлүүлнэ, дансны зам бүрэн бүтэн. */
    }
  }

  const p = payment as unknown as {
    status: string; referenceCode: string; amount: number; creditAmount: number; packageId: string;
    receiptImage: string; adminNote: string; paidAt?: Date; createdAt: Date;
  };
  return NextResponse.json({
    status: p.status,
    referenceCode: p.referenceCode,
    amount: p.amount,
    credits: p.creditAmount,
    packageId: p.packageId,
    hasReceipt: !!p.receiptImage,
    adminNote: p.adminNote || "",
    paidAt: p.paidAt || null,
    createdAt: p.createdAt,
    balance: (user as unknown as { credits?: number } | null)?.credits || 0,
  });
}

export const dynamic = "force-dynamic";
