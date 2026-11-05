import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import { SUPER_ADMIN_EMAILS } from "@/lib/adminAuth";
import User from "@/models/User";
import Conversation from "@/models/Conversation";

export const dynamic = "force-dynamic";

/**
 * Админтай шууд яриа нээх.
 *
 * Админы id-г клиент талд ХАТУУ БИЧИХГҮЙ: тэр нь хувь хүний баримтын id-г
 * нийтэд задлахаас гадна, админ солигдмогц чимээгүй эвдэрнэ (товч ажиллаж
 * байгаа мэт харагдаад хэн ч уншихгүй яриа үүсгэнэ). Тиймээс сервер дээр,
 * эрхийн ЖАГСААЛТААС нь олно — `adminAuth`-тай нэг эх сурвалж.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  try {
    await dbConnect();

    /* Эхлээд тогтсон супер админ. Түүнийг олдохгүй бол `role: "admin"`
       хэн нэгэн — админ баг өөрчлөгдсөн ч товч ажиллаж байх ёстой. */
    let admin = (await User.findOne({ email: { $in: SUPER_ADMIN_EMAILS } })
      .select("_id")
      .lean()) as { _id: unknown } | null;
    if (!admin) {
      admin = (await User.findOne({ role: "admin" }).select("_id").lean()) as
        | { _id: unknown }
        | null;
    }
    if (!admin) {
      return NextResponse.json({ error: "admin_unavailable" }, { status: 503 });
    }

    const adminId = String(admin._id);
    /* Админ өөрөө дарвал өөртэйгөө яриа нээх ёсгүй. */
    if (adminId === userId) {
      return NextResponse.json({ error: "self" }, { status: 400 });
    }

    /* Байгаа яриаг ДАХИН ашиглана — эс бөгөөс товч дарах бүрд шинэ хоосон
       яриа үүсч, inbox давхардана. */
    let conversation = (await Conversation.findOne({
      participants: { $all: [userId, adminId], $size: 2 },
    })
      .select("_id")
      .lean()) as { _id: unknown } | null;

    if (!conversation) {
      const created = await Conversation.create({ participants: [userId, adminId] });
      conversation = { _id: created._id };
    }

    return NextResponse.json({ conversationId: String(conversation._id) });
  } catch (e) {
    console.error("[chat/admin]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
