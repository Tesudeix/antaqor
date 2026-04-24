import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import Payment from "@/models/Payment";
import { pushToUser } from "@/lib/push";

type Params = Promise<{ id: string }>;

// POST — reject payment with a note; fires explanation push so user can retry.
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
    const note = typeof body.note === "string" ? body.note.slice(0, 500) : "";

    await dbConnect();

    const payment = await Payment.findById(id);
    if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (payment.status === "paid") {
      return NextResponse.json({ error: "Already paid" }, { status: 409 });
    }

    payment.status = "failed";
    payment.adminNote = note;
    await payment.save();

    pushToUser(String(payment.user), {
      title: "Төлбөр шалгагдсангүй",
      body: note || "Дахин шилжүүлж баримт оруулна уу.",
      url: "/clan",
      tag: `payment-rejected-${payment._id}`,
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      payment: { _id: payment._id, status: payment.status, adminNote: payment.adminNote },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
