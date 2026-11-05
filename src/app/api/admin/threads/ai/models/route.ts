/* ─── Загварын жагсаалт ба сонголт ───────────────────────────────────────
   GET  — нийлүүлэгч бүрийн амьд каталог + одоогийн идэвхтэй сонголт.
   POST — сонголт хадгална ({ provider, model } эсвэл хоосон = автомат).

   Каталогийг сервер татна, клиент биш: гуравхан түлхүүр байгаа бөгөөд
   тэдгээр нь браузерт хэзээ ч гарах ёсгүй. */

import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import { listModels, getAiChoice, setAiChoice } from "@/lib/aiModels";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  const force = req.nextUrl.searchParams.get("refresh") === "1";
  const [catalog, choice] = await Promise.all([listModels(force), getAiChoice()]);

  /* Идэвхтэй нь юу вэ: сонгосон зүйл байвал тэр, үгүй бол дараалалд
     хамгийн түрүүнд ХҮРЭХ БОЛОМЖТОЙ нийлүүлэгчийн өгөгдмөл загвар.
     "Автомат" гэж бичээд орхивол эзэн юу ажиллахыг мэдэхгүй хэвээр. */
  const auto = catalog.find((p) => p.reachable) || catalog[0];
  const active = choice
    ? { provider: choice.provider, model: choice.model, pinned: true }
    : auto
      ? { provider: auto.name, model: auto.fallbackModel, pinned: false }
      : null;

  return NextResponse.json({ catalog, active });
}

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const provider = String(body.provider || "").trim();
  const model = String(body.model || "").trim();

  if (!provider || !model) {
    await setAiChoice(null);
    return NextResponse.json({ ok: true, active: null });
  }

  /* Сонголтыг каталогтой тулгана. Хүн байхгүй загварын нэр хадгалбал
     дараагийн удаа 404 авч, яагаад гэдгийг нь ойлгохгүй — алдааг ЭНД,
     сонгож байх мөчид нь барих нь хамаагүй хямд. */
  const catalog = await listModels();
  const p = catalog.find((x) => x.name === provider);
  if (!p) {
    return NextResponse.json({ error: "Тийм нийлүүлэгч тохируулагдаагүй байна." }, { status: 400 });
  }
  if (p.models.length > 0 && !p.models.some((m) => m.id === model)) {
    return NextResponse.json(
      { error: `«${model}» нь ${p.label}-ийн жагсаалтад алга.` },
      { status: 400 }
    );
  }

  await setAiChoice({ provider, model });
  return NextResponse.json({ ok: true, active: { provider, model, pinned: true } });
}
