import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/adminAuth";
import { tick } from "@/lib/contentLoop";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/* 20 минут тутам crontab-аас дуудагдана. Үзүүлэлтийг ҮРГЭЛЖ шинэчилж,
   давталт асаалттай бол л хувилбар үүсгэнэ. */
async function authorized(req: Request): Promise<boolean> {
  const url = new URL(req.url);
  const expected = process.env.CRON_SECRET;
  if (expected && url.searchParams.get("secret") === expected) return true;
  /* "Одоо ажиллуул" товчийг ажиллуулна. */
  return !!(await getAdminSession());
}

export async function GET(req: Request) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const r = await tick();
    return NextResponse.json(r);
  } catch (e) {
    /* Cron-ийн алдаа нь чимээгүй байж болохгүй — лог руу гаргана. */
    console.error("[content-loop]", e);
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
