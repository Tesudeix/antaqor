import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import SiteSettings from "@/models/SiteSettings";

export const dynamic = "force-dynamic";

// Хөтөлбөрийн тохиргоо — Day release цаг (УБ) админаас.
// SiteSettings key: journey_release_hour (0-23, default 18).

async function gate() {
  const s = await getServerSession(authOptions);
  return s?.user && isAdmin(s.user.email) ? s : null;
}

export async function GET() {
  if (!(await gate())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await dbConnect();
  const row = await SiteSettings.findOne({ key: "journey_release_hour" }).lean();
  const releaseHour = Math.min(23, Math.max(0, parseInt(row?.value || "18", 10) || 18));
  return NextResponse.json({ releaseHour });
}

export async function PUT(req: NextRequest) {
  if (!(await gate())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => null)) as { releaseHour?: number } | null;
  const h = Number(b?.releaseHour);
  if (!Number.isInteger(h) || h < 0 || h > 23) {
    return NextResponse.json({ error: "0-23 цаг оруулна уу" }, { status: 400 });
  }
  await dbConnect();
  await SiteSettings.findOneAndUpdate(
    { key: "journey_release_hour" },
    { $set: { value: String(h) } },
    { upsert: true }
  );
  return NextResponse.json({ ok: true, releaseHour: h });
}
