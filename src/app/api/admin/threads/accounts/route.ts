import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import ThreadsToken from "@/models/ThreadsToken";
import ThreadsTrigger from "@/models/ThreadsTrigger";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  await dbConnect();
  const tokens = await ThreadsToken.find({})
    .select("threadsUserId username status backoffUntil failCount expiresAt createdAt")
    .sort({ createdAt: 1 })
    .lean();
  const accounts = await Promise.all(
    tokens.map(async (t) => ({
      threadsUserId: t.threadsUserId,
      username: t.username || "",
      status: t.status || "active",
      backoffUntil: t.backoffUntil || null,
      failCount: t.failCount || 0,
      expiresAt: t.expiresAt,
      connectedAt: t.createdAt,
      automations: await ThreadsTrigger.countDocuments({
        $or: [{ threadsUserId: t.threadsUserId }, { threadsUserId: "" }],
      }),
    }))
  );
  return NextResponse.json({ accounts });
}

// DELETE ?id=<threadsUserId> — disconnect an account (its automations stop matching).
export async function DELETE(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  await dbConnect();
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!id) return NextResponse.json({ error: "id шаардлагатай" }, { status: 400 });
  const deleted = await ThreadsToken.findOneAndDelete({ threadsUserId: id }).lean();
  if (!deleted) return NextResponse.json({ error: "Акаунт олдсонгүй" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
