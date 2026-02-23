import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

const ADMIN_EMAILS = ["antaqor@gmail.com"];

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ isMember: false, isAdmin: false });
    }

    const userId = (session.user as { id?: string })?.id;
    const email = session.user.email || "";
    const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());

    if (isAdmin) {
      return NextResponse.json({
        isMember: true,
        isAdmin: true,
        clan: "antaqor",
        joinedAt: null,
        expiresAt: null,
      });
    }

    if (!userId) {
      return NextResponse.json({ isMember: false, isAdmin: false });
    }

    await dbConnect();

    const user = await User.findById(userId).select(
      "clan clanJoinedAt subscriptionExpiresAt"
    );

    const now = new Date();
    const hasClan = !!user?.clan;
    const isExpired =
      hasClan &&
      user?.subscriptionExpiresAt &&
      new Date(user.subscriptionExpiresAt) < now;

    return NextResponse.json({
      isMember: hasClan && !isExpired,
      isAdmin: false,
      clan: user?.clan || null,
      joinedAt: user?.clanJoinedAt || null,
      expiresAt: user?.subscriptionExpiresAt || null,
      expired: !!isExpired,
    });
  } catch {
    return NextResponse.json({ isMember: false, isAdmin: false });
  }
}
