import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { getAdminSession } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

/* ─── /api/presence — хэн онлайн байна (2026-10-13) ───────────────────────
   POST — нэвтэрсэн хүний "амьд" дохио (PresenceBeat, 60с тутам). Минутад
          нэгээс олон бичихгүй: нөхцөлтэй update (lastSeenAt < 50с өмнө).
   GET  — сүүлийн 5 минутад идэвхтэй байсан хүмүүс (нэр, аватар, гишүүн
          эсэх) — зочин ч харна: нүүрний "Онлайн" зурвас. */
const WINDOW_MS = 5 * 60 * 1000;

export async function POST() {
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id) return NextResponse.json({ ok: false }, { status: 401 });
  await dbConnect();
  const now = new Date();
  await User.updateOne(
    { _id: id, $or: [{ lastSeenAt: { $exists: false } }, { lastSeenAt: { $lt: new Date(now.getTime() - 50_000) } }] },
    { $set: { lastSeenAt: now } }
  );
  return NextResponse.json({ ok: true });
}

export async function GET() {
  /* 2026-10-23: «Одоо онлайн» UI хасагдсан — хэн онлайн байгааг нийтэд задлахгүй, зөвхөн админ. */
  if (!(await getAdminSession())) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await dbConnect();
  const since = new Date(Date.now() - WINDOW_MS);
  const rows = await User.find({ lastSeenAt: { $gte: since }, banned: { $ne: true } })
    .select("name username avatar subscriptionExpiresAt lastSeenAt")
    .sort({ lastSeenAt: -1 })
    .limit(40)
    .lean();
  const now = Date.now();
  return NextResponse.json({
    count: rows.length,
    users: rows.map((u) => ({
      _id: String(u._id),
      name: u.name,
      username: u.username || "",
      avatar: u.avatar || "",
      member: !!u.subscriptionExpiresAt && new Date(u.subscriptionExpiresAt).getTime() > now,
    })),
  });
}
