import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { awardCredits } from "@/lib/credits";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as { id: string }).id;

    const body = await req.json();
    const kind = body.kind === "news" ? "news" : "post";
    const resourceId = String(body.resourceId || "").trim();
    const channel = String(body.channel || "native").slice(0, 16);

    if (!resourceId) {
      return NextResponse.json({ error: "resourceId required" }, { status: 400 });
    }

    const result = await awardCredits({
      userId,
      reason: kind === "news" ? "SHARE_NEWS" : "SHARE_POST",
      ref: `${kind}:${resourceId}`,
      meta: { channel },
    });

    if (!result) {
      return NextResponse.json({ ok: true, awarded: 0, capped: false });
    }

    if (result.awarded <= 0) {
      return NextResponse.json({ ok: true, awarded: 0, capped: true, balance: result.balance });
    }

    return NextResponse.json({
      ok: true,
      awarded: result.awarded,
      xpAwarded: result.xpAwarded,
      balance: result.balance,
      capped: false,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
