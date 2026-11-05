/* ─── Дансны шинжилгээ ───────────────────────────────────────────────────
   "Пост чинь хэр сайн бичигдсэн бэ" биш, "юүлүүр чинь ажиллаж байна уу"
   гэдгийг хэмжинэ.

   Хамгийн үнэтэй тоо нь `leaks`. Тайлбар: @antaqor.ai-ийн пост бүр
   сэтгэгдэлд ямар нэг үг бичихийг хүсдэг ("AI гэж бичээрэй"). Хүн тэр
   үгийг бичихэд `ThreadsTrigger`-т тохирох мөр байвал автомат хариу явж,
   хүн antaqor.com руу орно. Тохирох мөр БАЙХГҮЙ бол тэр хүн сэтгэгдэл
   бичээд юу ч болохгүй — сонирхол хамгийн өндөр байгаа яг тэр хормыг
   алдана. Энэ нь дуугүй бүтэлгүйтэл: хаана ч алдаа бичигдэхгүй, зөвхөн
   орлого дутуу ирнэ.                                                     */

import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized, getThreadsClient } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import ThreadsTrigger from "@/models/ThreadsTrigger";
import { analyzeVoice, type VoicePost, type TriggerLite } from "@/lib/threadsVoice";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Гүйцэтгэлийн мөр. Нэрлэсэн төрөл нь `Promise.allSettled`-ийн
 *  шүүлтүүрийг энгийн байлгана. */
interface TopRow {
  id: string;
  text: string;
  permalink: string;
  views: number;
  likes: number;
  replies: number;
}

interface RawPost {
  id: string;
  text?: string;
  timestamp?: string;
  permalink?: string;
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  const client = await getThreadsClient();
  if (!client) {
    return NextResponse.json({ error: "Threads холбогдоогүй байна." }, { status: 400 });
  }

  await dbConnect();

  try {
    const [feed, triggerDocs] = await Promise.all([
      client.getThreads(50),
      ThreadsTrigger.find({}).select("keywords matchMode enabled").lean(),
    ]);

    const posts: VoicePost[] = ((feed?.data || []) as RawPost[])
      .filter((p) => (p.text || "").trim().length > 0)
      .map((p) => ({
        id: p.id,
        text: p.text || "",
        timestamp: p.timestamp || "",
        permalink: p.permalink,
      }));

    const triggers: TriggerLite[] = (triggerDocs as unknown as TriggerLite[]).map((t) => ({
      keywords: Array.isArray(t.keywords) ? t.keywords : [],
      matchMode: t.matchMode || "contains",
      enabled: t.enabled !== false,
    }));

    const analysis = analyzeVoice(posts, triggers);

    /* Гүйцэтгэлийн тоо нэмэлт: пост тус бүрд НЭГ дуудлага тул зөвхөн
       хамгийн сүүлийн 12-г үзнэ. Бүх 50-г үзвэл 50 дуудлага болж хуудас
       удаашрахаас гадна Threads-ийн хязгаарыг дэмий иднэ. */
    let top: TopRow[] = [];
    if (req.nextUrl.searchParams.get("insights") === "1") {
      const settled = await Promise.allSettled(
        posts.slice(0, 12).map(async (p): Promise<TopRow> => {
          const ins = await client.getThreadInsights(p.id);
          const rows = (ins?.data || []) as { name?: string; values?: { value?: number }[]; total_value?: { value?: number } }[];
          const pick = (n: string) => {
            const row = rows.find((r) => r.name === n);
            return Number(row?.values?.[0]?.value ?? row?.total_value?.value ?? 0);
          };
          return {
            id: p.id,
            text: p.text.split("\n")[0].slice(0, 120),
            permalink: p.permalink || "",
            views: pick("views"),
            likes: pick("likes"),
            replies: pick("replies"),
          };
        })
      );
      /* `flatMap` нь төрлийн предикат бичихээс энгийн: `allSettled` нь
         татгалзсан мөрийг ч буцаадаг тул шүүх хэрэгтэй, гэхдээ предикат
         бичихэд заавал төрлийг үсэг үсгээр давтах болно. */
      top = settled
        .flatMap((r) => (r.status === "fulfilled" ? [r.value] : []))
        .sort((a, b) => b.views - a.views);
    }

    return NextResponse.json({
      username: "antaqor.ai",
      analysis,
      top,
      /* Ноорог үүсгэхэд дахин татахгүйн тулд эндээс хамт буцаана —
         нэг дэлгэц, нэг дуудлага. */
      recent: posts.slice(0, 25),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Шинжилгээ амжилтгүй";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
