// Контент агентын долоо хоногийн хуваарь. crontab-аас 5 минут тутам дуудагдана:
// идэвхтэй брэнд бүрийн ажиллах мөч (жишээ нь Даваа 09:00 УБ) болсон бол
// ирэх 7 хоногийн төлөвлөгөө эхлүүлнэ; тасарсан ажлыг (restart) үргэлжлүүлнэ.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { weeklyTick } from "@/lib/contentAgent";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get("secret") || "";
  let authed = Boolean(process.env.CRON_SECRET) && secret === process.env.CRON_SECRET;
  if (!authed) {
    const s = await getServerSession(authOptions);
    authed = Boolean(s?.user && isAdmin(s.user.email));
  }
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await weeklyTick()) });
}
