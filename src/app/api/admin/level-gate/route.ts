import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { DEFAULTS, getAllLevelSettings, setSetting } from "@/lib/siteSettings";

// GET — current level-gate config
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const settings = await getAllLevelSettings();
  return NextResponse.json({
    ...settings,
    defaults: DEFAULTS,
  });
}

// POST — update one or more settings
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const body = await req.json();

    const updates: { key: keyof typeof DEFAULTS; value: number }[] = [];
    if (typeof body.band === "number" && body.band >= 0 && body.band <= 10) {
      updates.push({ key: "feedLevelBand", value: Math.round(body.band) });
    }
    if (typeof body.cap === "number" && body.cap >= 1 && body.cap <= 100) {
      updates.push({ key: "freeLevelCap", value: Math.round(body.cap) });
    }
    if (typeof body.multiplier === "number" && body.multiplier >= 1 && body.multiplier <= 5) {
      updates.push({ key: "paidXpMultiplier", value: body.multiplier });
    }
    if (typeof body.enabled === "boolean") {
      updates.push({ key: "levelGateEnabled", value: body.enabled ? 1 : 0 });
    }

    for (const u of updates) await setSetting(u.key, u.value);

    const settings = await getAllLevelSettings();
    return NextResponse.json({ ok: true, ...settings });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
