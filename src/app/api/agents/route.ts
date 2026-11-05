/* Нийтийн ростер. Зочны нүүр, агентын лавлах хоёулаа үүнийг уншина —
   тиймээс нэвтрэлт шаардахгүй. Системийн prompt ЭНД БУЦААХГҮЙ: тэр нь
   агентын дотоод заавар бөгөөд браузарт гарах ямар ч шалтгаангүй. */
import { NextResponse } from "next/server";
import { resolveRoster } from "@/lib/agentRoster";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const roster = await resolveRoster();
    const agents = roster.map((a) => ({
      slug: a.slug,
      name: a.name,
      handle: a.handle,
      role: a.role,
      desc: a.desc,
      color: a.color,
      avatar: a.avatar,
      age: a.age,
      personality: a.personality,
      mission: a.mission,
      catchphrase: a.catchphrase,
      postEnabled: a.postEnabled,
      postHour: a.postHour,
    }));
    return NextResponse.json({ agents });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load agents";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
