import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Notification from "@/models/Notification";

export const dynamic = "force-dynamic";

/* ─── Уншсан болгох ──────────────────────────────────────────────────────

   Өмнө нь энэ төгсгөл ГАНЦХАН зүйл хийдэг байсан: тухайн хүний БҮХ
   уншаагүйг уншсан болгох. Хонх нээгдэх бүрд автоматаар дуудагддаг байв.

   Яагаад тэр нь буруу вэ: 194 уншаагүй мэдэгдэлтэй хүн хонхоо ажигласнаар
   тэдгээрийн ДУНД байсан "төлбөр баталгаажлаа" эсвэл "гишүүнчлэл дуусах
   гэж байна" гэсэн мэдэгдлийг хамт устгана — уншилгүйгээр. Мэдэгдэл
   уншигдсанд тооцогдох цорын ганц шалтгаан нь хүн түүн рүү ХАНДСАН явдал
   байх ёстой.

   Одоо: `{ id }` — нэг, `{ ids }` — олон, `{ all: true }` эсвэл хоосон бие
   — бүгд (хуучин клиенттэй нийцтэй байхын тулд хоосон бие нь хэвээр
   "бүгд" гэсэн утгатай). */

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const body = await req.json().catch(() => ({} as Record<string, unknown>));

    await dbConnect();

    // `recipient` бүх салаанд байна — өөр хүний мэдэгдлийг хөндөх боломжгүй.
    const base: Record<string, unknown> = { recipient: userId, read: false };

    if (typeof body?.id === "string") {
      const r = await Notification.updateOne({ ...base, _id: body.id }, { $set: { read: true } });
      return NextResponse.json({ success: true, updated: r.modifiedCount || 0 });
    }

    if (Array.isArray(body?.ids) && body.ids.length > 0) {
      const ids = (body.ids as unknown[]).filter((x) => typeof x === "string").slice(0, 200);
      const r = await Notification.updateMany({ ...base, _id: { $in: ids } }, { $set: { read: true } });
      return NextResponse.json({ success: true, updated: r.modifiedCount || 0 });
    }

    if (typeof body?.type === "string" && body.type !== "all") {
      const r = await Notification.updateMany({ ...base, type: body.type }, { $set: { read: true } });
      return NextResponse.json({ success: true, updated: r.modifiedCount || 0 });
    }

    const r = await Notification.updateMany(base, { $set: { read: true } });
    return NextResponse.json({ success: true, updated: r.modifiedCount || 0 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to mark notifications as read";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
