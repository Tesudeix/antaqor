import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Notification from "@/models/Notification";
import { unreadByType } from "@/lib/notifications";

export const dynamic = "force-dynamic";

/* Хонх (limit=20) ба /notifications хуудас (хуудаслалт, шүүлтүүр) хоёулаа
   энэ төгсгөлөөс уншина. Хоёр тусдаа төгсгөл бичвэл уншаагүйн тоо хоёр
   өөрөөр тоологдож эхэлнэ. */

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as { id: string }).id;
    const sp = req.nextUrl.searchParams;
    const limit = Math.min(60, Math.max(1, parseInt(sp.get("limit") || "20")));
    const cursor = sp.get("cursor");
    const type = sp.get("type");
    const onlyUnread = sp.get("unread") === "1";

    await dbConnect();

    const q: Record<string, unknown> = { recipient: userId };
    if (type && type !== "all") q.type = type;
    if (onlyUnread) q.read = false;
    if (cursor) {
      const c = new Date(cursor);
      if (!Number.isNaN(c.getTime())) q.createdAt = { $lt: c };
    }

    const [rows, unreadCount, byType] = await Promise.all([
      Notification.find(q).sort({ createdAt: -1 }).limit(limit + 1).lean(),
      Notification.countDocuments({ recipient: userId, read: false }),
      unreadByType(userId),
    ]);

    const hasMore = rows.length > limit;
    const notifications = hasMore ? rows.slice(0, limit) : rows;

    return NextResponse.json({
      notifications,
      unreadCount,
      byType,
      nextCursor: hasMore
        ? new Date(
            (notifications[notifications.length - 1] as unknown as { createdAt: Date }).createdAt
          ).toISOString()
        : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to fetch notifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* DELETE — устгах нь уншсан болгохоос ӨӨР үйлдэл.
   `?id=…`      нэгийг
   `?scope=read` уншсан бүгдийг (өдөр тутмын цэвэрлэгээ)
   `?scope=all`  бүгдийг                                                */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as { id: string }).id;
    const sp = req.nextUrl.searchParams;
    const id = sp.get("id");
    const scope = sp.get("scope");

    await dbConnect();

    /* `recipient` нь шүүлтүүрт ҮРГЭЛЖ орно — id-гаар устгахдаа ч.
       Үүнгүй бол хэн ч дурын мэдэгдлийн id мэдчихвэл өөр хүнийхийг
       устгана. */
    if (id) {
      const res = await Notification.deleteOne({ _id: id, recipient: userId });
      return NextResponse.json({ ok: true, deleted: res.deletedCount || 0 });
    }
    if (scope === "read") {
      const res = await Notification.deleteMany({ recipient: userId, read: true });
      return NextResponse.json({ ok: true, deleted: res.deletedCount || 0 });
    }
    if (scope === "all") {
      const res = await Notification.deleteMany({ recipient: userId });
      return NextResponse.json({ ok: true, deleted: res.deletedCount || 0 });
    }
    return NextResponse.json({ error: "id эсвэл scope шаардлагатай" }, { status: 400 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
