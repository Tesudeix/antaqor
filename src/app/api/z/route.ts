import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { forget, state, turn } from "@/lib/z/agent";

/* ─── /z агент (2026-11-03) ───
   GET    → карт, санах ой, бизнесийн зураг, түүх, туршилтууд
   POST   {message} | {checkin:{testId,value}} → NDJSON stream: бөмбөлгүүд, эцэст шинэ төлөв.
   DELETE → «Мартуулах»: яриа, карт, туршилт, векторыг бүгдийг устгана.
   Хэт ашиглалтаас: минутад 5, өдөрт 40 мессеж (gpt-5.5 нэг дуудлага ≈ $0.02–0.05). */
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const minute = new Map<string, number[]>();
const day = new Map<string, number[]>();
async function me() {
  const s = await getServerSession(authOptions);
  return (s?.user as { id?: string } | undefined)?.id || null;
}

export async function GET() {
  const u = await me();
  if (!u) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  return NextResponse.json(await state(u));
}

export async function DELETE() {
  const u = await me();
  if (!u) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  return NextResponse.json(await forget(u));
}

export async function POST(req: NextRequest) {
  const u = await me();
  if (!u) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const now = Date.now();
  const m = (minute.get(u) || []).filter((t) => now - t < 60e3);
  const d = (day.get(u) || []).filter((t) => now - t < 86400e3);
  if (m.length >= 5) return NextResponse.json({ error: "Хэт хурдан байна — хэдэн секунд хүлээгээрэй" }, { status: 429 });
  if (d.length >= 40) return NextResponse.json({ error: "Өнөөдрийн хязгаар дууслаа. Маргааш үргэлжлүүлье — одоо туршилтаа хий." }, { status: 429 });
  minute.set(u, [...m, now]);
  day.set(u, [...d, now]);

  const b = (await req.json().catch(() => ({}))) as { message?: string; checkin?: { testId?: string; value?: string } };
  const checkin = b.checkin?.testId && String(b.checkin.value || "").trim()
    ? { testId: String(b.checkin.testId), value: String(b.checkin.value).trim().slice(0, 200) }
    : null;
  const message = checkin ? `7 хоногийн үр дүн: ${checkin.value}` : String(b.message || "").trim().slice(0, 4000);
  if (!message) return NextResponse.json({ error: "Хоосон мессеж" }, { status: 400 });

  /* NDJSON stream: {"t":"bubble","i","text"} бөмбөлөг бүр бэлэн болмогц → эцэст {"t":"state"} эсвэл {"t":"error"}. */
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => { try { controller.enqueue(enc.encode(`${JSON.stringify(o)}\n`)); } catch { /* хаагдсан */ } };
      try {
        const st = await turn({ user: u, message, checkin }, (text, i) => send({ t: "bubble", i, text }));
        send({ t: "state", state: st });
      } catch (e) {
        send({ t: "error", error: (e as Error).message || "Хариулт гарсангүй" });
      }
      try { controller.close(); } catch { /* хаагдсан */ }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
