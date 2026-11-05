import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkTikTokUrl, probe, startFetch, userJobs, publicJob, sweep, Quality } from "@/lib/ttgrab";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* ─── /api/tools/tiktok ─────────────────────────────────────────────────
   GET  → миний сүүлийн татацууд (явц)
   POST {action:"probe", url}            → гарчиг, зураг, чанар (ҮНЭГҮЙ)
   POST {action:"fetch", url, quality}   → сервер дээр татаж эхэлнэ
   Бэлэн файл: /api/tools/tiktok/file/<id> (зөвхөн эзэнд). */

async function me(): Promise<string | null> {
  const session = await getServerSession(authOptions);
  return session?.user ? (session.user as { id: string }).id : null;
}

export async function GET() {
  const uid = await me();
  if (!uid) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  void sweep();
  return NextResponse.json({ jobs: userJobs(uid).slice(0, 30).map(publicJob) });
}

export async function POST(req: NextRequest) {
  const uid = await me();
  if (!uid) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  let url: string;
  try { url = checkTikTokUrl(body.url); }
  catch (e) { return NextResponse.json({ error: (e as Error).message }, { status: 400 }); }

  if (body.action === "fetch") {
    const quality: Quality = body.quality === "compat" ? "compat" : "best";
    try {
      const job = startFetch(uid, url, quality, typeof body.title === "string" ? body.title : "");
      return NextResponse.json({ job: publicJob(job) });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 429 });
    }
  }

  try {
    return NextResponse.json({ info: await probe(url) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}
