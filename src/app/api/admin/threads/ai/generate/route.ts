/* ─── AI ноорог үүсгэгч ──────────────────────────────────────────────────
   Гаралт нь НООРОГ. Энэ маршрут юу ч нийтлэхгүй — нийтлэх ажил нь
   `/api/admin/social/publish` дээр аль хэдийн бий (товлолт, дахин
   оролдлого, түүх бүгд тэнд). Хоёр өөр газраас нийтлэдэг болбол аль нь
   ажилласныг хэн ч хэлж чадахгүй болно.

   Дуу хоолойн жишээг ЭНД, сервер дээр татна — клиентээс явуулбал хуурамч
   жишээ шургуулж, эзний нэрийн өмнөөс өөр өнгө аястай пост бичүүлэх зам
   нээгдэнэ.                                                              */

import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized, getThreadsClient } from "@/lib/adminAuth";
import { generateThreadsPosts } from "@/lib/threadsWriter";
import { CTA_LIBRARY, type VoicePost } from "@/lib/threadsVoice";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface RawPost {
  id: string;
  text?: string;
  timestamp?: string;
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const ctaIndex = Number(body.ctaIndex);
  const cta = CTA_LIBRARY[Number.isInteger(ctaIndex) ? ctaIndex : 0] || CTA_LIBRARY[0];
  const angle = typeof body.angle === "string" ? body.angle : "";
  const topic = typeof body.topic === "string" ? body.topic.slice(0, 600) : "";
  const count = Number(body.count) || 3;

  /* Threads холбогдоогүй байсан ч ноорог бичих боломжтой байх ёстой —
     тэр үед зөвхөн амьд жишээ дутна, тогтсон дүрэм хэвээр ажиллана.
     Холболт тасарсан өдөр контент бичих ажил зогсох ямар ч шалтгаан
     байхгүй. */
  let recent: VoicePost[] = [];
  try {
    const client = await getThreadsClient();
    if (client) {
      const feed = await client.getThreads(30);
      recent = ((feed?.data || []) as RawPost[])
        .filter((p) => (p.text || "").trim().length > 0)
        .map((p) => ({ id: p.id, text: p.text || "", timestamp: p.timestamp || "" }));
    }
  } catch {
    /* Жишээгүй ч үргэлжилнэ. */
  }

  const result = await generateThreadsPosts({ recent, cta, angle, topic, count });

  if (result.drafts.length === 0) {
    return NextResponse.json(
      {
        error: result.error || "Ноорог үүсгэж чадсангүй. Дахин оролдоно уу.",
        attempts: result.attempts,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    drafts: result.drafts,
    provider: result.provider,
    /* Амжилттай үед ч оролдлогуудыг буцаана: эхний нийлүүлэгч унасан
       атал хоёр дахь нь аварсан бол тэр нь ЧИМЭЭГҮЙ асуудал — дэлгэц
       дээр харагдахгүй бол хэн ч засахгүй. */
    attempts: result.attempts,
    cta: cta.text,
    sampledFrom: recent.length,
  });
}
