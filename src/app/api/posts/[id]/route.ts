import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { isActiveMember } from "@/lib/membership";
import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";
import Comment from "@/models/Comment";
import { purgeNotificationsFor } from "@/lib/notifications";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    const { id } = await params;

    const post = await Post.findById(id)
      .populate("author", "name avatar bio")
      .lean();

    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    /* Жагсаалтад хаасан зүйлийг ганцаарчилсан хаягаар нээж болохгүй.
       Урсгалаас нуугаад /posts/<id>-г нээлттэй үлдээх нь хаалт биш,
       зөвхөн холбоос мэдэхгүй хүнд зориулсан далдлалт. */
    if ((post as { visibility?: string }).visibility === "members") {
      const session = await getServerSession(authOptions);
      const viewerId = (session?.user as { id?: string } | undefined)?.id;
      const allowed =
        isAdmin(session?.user?.email) ||
        (!!viewerId && (await isActiveMember(viewerId, session?.user?.email)));
      if (!allowed) {
        return NextResponse.json(
          { error: "Энэ пост зөвхөн гишүүдэд нээлттэй", requiresMembership: true },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ post });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/* PATCH — одоогоор ганц зүйл: постыг дээр тогтоох/тайлах. Зөвхөн админ.
   Эзэмшигч өөрөө өөрийн постыг дээр тогтоож чадвал урсгалын эхний байр
   хэн түрүүлж дарснаар шийдэгдэх бөгөөд энэ нь редакцийн хэрэгсэл байхаа
   болино. */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }
  if (!isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Зөвшөөрөлгүй" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (typeof body?.pinned !== "boolean") {
    return NextResponse.json({ error: "pinned утга шаардлагатай" }, { status: 400 });
  }

  await dbConnect();
  const updated = await Post.findByIdAndUpdate(
    id,
    { pinned: body.pinned },
    { new: true }
  ).select("_id pinned").lean();

  if (!updated) {
    return NextResponse.json({ error: "Пост олдсонгүй" }, { status: 404 });
  }
  return NextResponse.json({ post: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { id } = await params;
    const userId = (session.user as { id: string }).id;
    const userIsAdmin = isAdmin(session.user.email);

    const post = await Post.findById(id);
    if (!post) {
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    if (post.author.toString() !== userId && !userIsAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await Comment.deleteMany({ post: id });
    await Post.findByIdAndDelete(id);

    /* ─── Мэдэгдлийг ХАМТ устгана ─────────────────────────────────────
       Пост устахад түүн рүү заасан мэдэгдэл үлдвэл хүн хонхоо нээж,
       дарж, 404 харна. 2026-08-25-нд хэмжихэд 37,494 мэдэгдлийн 34,614
       нь яг ийм — устгагдсан контент руу заасан байв. Тараалт нь нэг
       постод 651 мөр үүсгэдэг байсныг бодоход энэ мөр байхгүй бол
       коллекц зөвхөн хогоор л өснө. */
    purgeNotificationsFor(`/posts/${id}`).catch(() => {});

    return NextResponse.json({ message: "Post deleted" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
