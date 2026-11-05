import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { accessState } from "@/lib/membership";

const SUPER_ADMIN_EMAILS = ["antaqor@gmail.com"];

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({
        isMember: false, isAdmin: false,
        hasAccess: false, inGrace: false, graceEndsAt: null, graceDaysLeft: 0,
      });
    }

    const userId = (session.user as { id?: string })?.id;
    const email = session.user.email || "";
    const isSuperAdmin = SUPER_ADMIN_EMAILS.includes(email.toLowerCase());

    if (isSuperAdmin) {
      return NextResponse.json({
        isMember: true,
        isAdmin: true,
        hasAccess: true,
        inGrace: false,
        graceEndsAt: null,
        graceDaysLeft: 0,
        plan: "operator",
        clan: "antaqor",
        joinedAt: null,
        expiresAt: null,
      });
    }

    if (!userId) {
      return NextResponse.json({
        isMember: false, isAdmin: false,
        hasAccess: false, inGrace: false, graceEndsAt: null, graceDaysLeft: 0,
      });
    }

    await dbConnect();

    const user = await User.findById(userId).select(
      "clan clanJoinedAt subscriptionExpiresAt role plan"
    );

    const now = new Date();
    const hasClan = !!user?.clan;
    const isExpired =
      hasClan &&
      user?.subscriptionExpiresAt &&
      new Date(user.subscriptionExpiresAt) < now;
    const isAdmin = user?.role === "admin";

    // Effective plan: paid tier only while the subscription is active.
    const subActive = !!(user?.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > now);
    const plan = isAdmin ? "operator" : subActive ? user?.plan || "starter" : "free";

    /* Эрхийг энд НЭГ УДАА тооцоолно. Хэрэв клиент "гишүүн үү + хугацаа
       дуусаагүй юу" гэж өөрөө дахин угсарвал хоёр газар өөр дүрэм үүсч,
       аль нэг нь эрт орой хэзээ нэгэн цагт зөрнө. */
    const access = await accessState(userId, email);

    return NextResponse.json({
      isMember: hasClan && !isExpired,
      isAdmin,
      hasAccess: access.ok,
      inGrace: access.inGrace,
      graceEndsAt: access.graceEndsAt,
      graceDaysLeft: access.graceDaysLeft,
      plan,
      clan: user?.clan || null,
      joinedAt: user?.clanJoinedAt || null,
      expiresAt: user?.subscriptionExpiresAt || null,
      expired: !!isExpired,
    });
  } catch {
    return NextResponse.json({
      isMember: false, isAdmin: false,
      hasAccess: false, inGrace: false, graceEndsAt: null, graceDaysLeft: 0,
    });
  }
}
