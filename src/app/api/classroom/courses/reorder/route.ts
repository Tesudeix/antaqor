import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import Course from "@/models/Course";

// POST — bulk reorder courses. Body: { ids: ["courseA", "courseB", ...] }.
// The first id gets order:0, the next 1, etc. One bulkWrite hits Mongo so
// the listing reorders atomically and the client doesn't see a half-applied
// state on slow networks.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(body.ids) ? body.ids : [];
  if (!ids.length) {
    return NextResponse.json({ error: "ids[] шаардлагатай" }, { status: 400 });
  }
  // Defensive: only valid ObjectIds, dedupe, ≤200 entries (sanity cap)
  const seen = new Set<string>();
  const cleanIds: string[] = [];
  for (const raw of ids) {
    const id = String(raw);
    if (!Types.ObjectId.isValid(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    cleanIds.push(id);
    if (cleanIds.length >= 200) break;
  }
  if (!cleanIds.length) {
    return NextResponse.json({ error: "Зөв id-уудыг дамжуулна уу" }, { status: 400 });
  }

  await dbConnect();
  await Course.bulkWrite(
    cleanIds.map((id, idx) => ({
      updateOne: {
        filter: { _id: new Types.ObjectId(id) },
        update: { $set: { order: idx } },
      },
    })),
    { ordered: false }
  );

  return NextResponse.json({ ok: true, count: cleanIds.length });
}

export const dynamic = "force-dynamic";
