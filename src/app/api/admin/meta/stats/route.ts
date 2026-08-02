import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import MetaConversation from "@/models/MetaConversation";
import MetaTrigger from "@/models/MetaTrigger";
import MetaPage from "@/models/MetaPage";

export const dynamic = "force-dynamic";

const ACCOUNTS = ["antaqor", "joymassage", "joybilliard"] as const;

export async function GET() {
  const s = await getServerSession(authOptions);
  if (!s?.user || !isAdmin(s.user.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await dbConnect();

  const triggerAgg = await MetaTrigger.aggregate<{ _id: string; fires: number; count: number }>([
    { $group: { _id: { $ifNull: ["$account", "antaqor"] }, fires: { $sum: "$hitCount" }, count: { $sum: 1 } } },
  ]);
  const tMap = new Map(triggerAgg.map((t) => [t._id, t]));

  const pages = await MetaPage.find({ enabled: true }).select("key").lean();
  const allKeys = [...new Set([...ACCOUNTS, ...pages.map((p) => p.key)])];
  const stats = await Promise.all(
    allKeys.map(async (account) => {
      const base =
        account === "antaqor"
          ? { $or: [{ account: "antaqor" }, { account: { $exists: false } }, { account: null }] }
          : { account };
      const [conversations, withMenu, bookings, humans] = await Promise.all([
        MetaConversation.countDocuments(base),
        MetaConversation.countDocuments({ ...base, welcomeMenuSent: true }),
        MetaConversation.countDocuments({ ...base, "profile.book": { $exists: true } }),
        MetaConversation.countDocuments({ ...base, escalatedToHuman: true }),
      ]);
      const t = tMap.get(account);
      return { account, conversations, withMenu, triggerFires: t?.fires || 0, triggers: t?.count || 0, bookings, humans };
    })
  );
  return NextResponse.json({ stats });
}
