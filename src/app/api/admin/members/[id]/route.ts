import { NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

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
      case "grant": {
        const duration = days || 30;
        const now = new Date();
        let expiresAt: Date;

        if (user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > now) {
          expiresAt = new Date(user.subscriptionExpiresAt);
          expiresAt.setDate(expiresAt.getDate() + duration);
        } else {
          expiresAt = new Date(now.getTime() + duration * 24 * 60 * 60 * 1000);
        }

        user.clan = "antaqor";
        if (!user.clanJoinedAt) {
          user.clanJoinedAt = now;
        }
        user.subscriptionExpiresAt = expiresAt;
        await user.save();

        return NextResponse.json({
          message: `${user.name}-д ${duration} хоногийн гишүүнчлэл олголоо`,
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

        const newExpiry = new Date(user.subscriptionExpiresAt);
        newExpiry.setDate(newExpiry.getDate() + extDays);
        user.subscriptionExpiresAt = newExpiry;
        await user.save();

        return NextResponse.json({
          message: `${user.name}-н гишүүнчлэлийг ${extDays} хоногоор сунгалаа`,
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

      default:
        return NextResponse.json({ error: "Буруу үйлдэл" }, { status: 400 });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Серверийн алдаа";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
