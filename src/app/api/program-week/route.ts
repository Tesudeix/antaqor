import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import SiteSettings from "@/models/SiteSettings";
import { PROGRAM_WEEK_DEFAULT, PROGRAM_WEEK_KEY, normalizeProgramWeek } from "@/lib/programWeek";

export const dynamic = "force-dynamic";

// Нэгдсэн хөтөлбөр («Day N / 7») — GET нээлттэй (нүүр), PUT зөвхөн админ.
// SiteSettings key: program_week (JSON мөр). Мөр байхгүй/эвдэрсэн бол код дахь
// анхдагч утга буцна — нүүр хэзээ ч хоосон карт харуулахгүй.

async function read() {
  await dbConnect();
  const row = await SiteSettings.findOne({ key: PROGRAM_WEEK_KEY }).lean();
  try {
    return row?.value ? normalizeProgramWeek(JSON.parse(row.value)) : PROGRAM_WEEK_DEFAULT;
  } catch {
    return PROGRAM_WEEK_DEFAULT;
  }
}

export async function GET() {
  try {
    return NextResponse.json(
      { program: await read() },
      { headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch {
    return NextResponse.json({ program: PROGRAM_WEEK_DEFAULT });
  }
}

export async function PUT(req: NextRequest) {
  const s = await getServerSession(authOptions);
  if (!s?.user || !isAdmin(s.user.email)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Буруу өгөгдөл" }, { status: 400 });
  const program = normalizeProgramWeek(body);
  await dbConnect();
  await SiteSettings.findOneAndUpdate(
    { key: PROGRAM_WEEK_KEY },
    { $set: { value: JSON.stringify(program) } },
    { upsert: true }
  );
  return NextResponse.json({ ok: true, program });
}
