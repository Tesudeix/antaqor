import { NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { activateMembership } from "@/lib/membershipGrant";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  try {
    await dbConnect();
    const { id } = await params;
    const body = await req.json();
    const { action, days } = body;

    const user = await User.findById(id);
    if (!user) {
      return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });
    }

    switch (action) {
      /* /reels рүү видео оруулах эрхийг асаах/унтраах. */
      case "reel_upload": {
        user.canUploadReels = !user.canUploadReels;
        await user.save();
        return NextResponse.json({
          ok: true,
          canUploadReels: user.canUploadReels,
          message: user.canUploadReels ? "Reel оруулах эрх НЭЭГДЛЭЭ" : "Reel оруулах эрх хаагдлаа",
        });
      }
      /* ─── ЭНЭ САЛАА НЬ ХАМГИЙН ИХ ХЭРЭГЛЭГДДЭГ БӨГӨӨД ХАМГИЙН ДУТУУ
             БАЙСАН. 2026-08-24-нд идэвхтэй 50 гишүүний 46-гийн төлбөр
             `pending` хэвээр өлгөөтэй байв — өөрөөр хэлбэл админ энэ
             товчоор эрхийг нь нээж, төлбөрийн бичлэг нь хэзээ ч хаагдаагүй.
             Үр дагавар нь тайлан эмх замбараагүй болох төдий биш: сэргээх
             сануулга нь тэр хүмүүсийг "төлөөгүй" гэж үзэж, ТӨЛСӨН хүн рүү
             "төлбөрөө дуусгана уу" гэж бичих байсан. Одоо нээх үйлдэл
             бүхэлдээ `activateMembership`-д шилжсэн: эрх, шат, төлбөрийн
             бичлэг, мэдэгдэл дөрвүүлээ нэг дор. */
      case "grant": {
        const duration = days || 30;
        const res = await activateMembership({
          userId: String(user._id),
          days: duration,
          plan: typeof body.plan === "string" ? body.plan : undefined,
          source: "admin-grant",
        });
        if (!res) return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });

        return NextResponse.json({
          message: `${user.name}-д ${duration} хоногийн гишүүнчлэл олголоо`,
          closedPaymentId: res.closedPaymentId,
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            clan: "antaqor",
            clanJoinedAt: user.clanJoinedAt,
            subscriptionExpiresAt: res.expiresAt,
            plan: res.plan,
          },
        });
      }

      case "revoke": {
        user.clan = "";
        user.subscriptionExpiresAt = undefined;
        await user.save();

        return NextResponse.json({
          message: `${user.name}-н гишүүнчлэлийг цуцаллаа`,
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            clan: user.clan,
            clanJoinedAt: user.clanJoinedAt,
            subscriptionExpiresAt: user.subscriptionExpiresAt,
          },
        });
      }

      case "extend": {
        const extDays = days || 30;
        if (!user.subscriptionExpiresAt) {
          return NextResponse.json({ error: "Хэрэглэгч гишүүнчлэлгүй байна" }, { status: 400 });
        }

        const res = await activateMembership({
          userId: String(user._id),
          days: extDays,
          source: "admin-extend",
        });
        if (!res) return NextResponse.json({ error: "Хэрэглэгч олдсонгүй" }, { status: 404 });

        return NextResponse.json({
          message: `${user.name}-н гишүүнчлэлийг ${extDays} хоногоор сунгалаа`,
          user: {
            _id: user._id,
            name: user.name,
            email: user.email,
            clan: user.clan,
            clanJoinedAt: user.clanJoinedAt,
            subscriptionExpiresAt: res.expiresAt,
            plan: res.plan,
          },
        });
      }

      case "makeAdmin": {
        user.role = "admin";
        await user.save();
        return NextResponse.json({
          message: `${user.name}-г админ болголоо`,
          user: { _id: user._id, role: "admin" },
        });
      }

      case "removeAdmin": {
        user.role = "user";
        await user.save();
        return NextResponse.json({
          message: `${user.name}-н админ эрхийг хаслаа`,
          user: { _id: user._id, role: "user" },
        });
      }

      case "ban": {
        user.banned = true;
        user.bannedAt = new Date();
        user.bannedReason = (typeof body.reason === "string" ? body.reason : "").slice(0, 500);
        await user.save();
        return NextResponse.json({
          message: `${user.name}-г түр түдгэлзүүлсэн`,
          user: { _id: user._id, banned: true, bannedReason: user.bannedReason },
        });
      }

      case "unban": {
        user.banned = false;
        user.bannedAt = undefined;
        user.bannedReason = "";
        await user.save();
        return NextResponse.json({
          message: `${user.name}-н блокыг цуцаллаа`,
          user: { _id: user._id, banned: false },
        });
      }

      default:
        return NextResponse.json({ error: "Буруу үйлдэл" }, { status: 400 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Серверийн алдаа";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
