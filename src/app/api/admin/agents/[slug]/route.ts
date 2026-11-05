/* Агентын засварлагчийн API.

   GET  — БҮХ агент нэгтгэсэн хэлбэрээр (идэвхгүй нь ч орно; эзэн унтраасан
          агентаа буцааж асаах боломжтой байх ёстой).
   PUT  — нэг агентын талбаруудыг хадгална.

   ХООСОН МӨР = "ҮЛДЭЭ". Админ зөвхөн нэрийг нь өөрчлөхөд бусад талбар
   хоосон явбал тэднийг арчих ёсгүй — тиймээс хоосон тэмдэгт мөрийг
   ХАДГАЛАХГҮЙ өнгөрөөнө. Талбарыг ҮНЭХЭЭР кодын өгөгдмөл рүү буцаах гэж
   байгаа бол `reset` талбарт нэрийг нь дамжуулна. */
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import Agent from "@/models/Agent";
import { resolveOne } from "@/lib/agentRoster";

export const dynamic = "force-dynamic";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  const { slug } = await params;
  const key = slug.toLowerCase();
  const current = await resolveOne(key);
  if (!current) return NextResponse.json({ error: "Ийм агент алга" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const set: Record<string, unknown> = {};
  const unset: Record<string, unknown> = {};

  /* Кодын өгөгдмөл рүү буцаах хүсэлт — талбарыг DB-ээс УСТГАНА (хоосон
     болгохгүй). Устгасны дараа нэгтгэгч давхарга кодын утгыг авна. */
  const reset = Array.isArray(body.reset) ? body.reset.map(String) : [];
  for (const f of reset) {
    if (["name", "role", "description", "personality", "mission", "systemPrompt", "avatar", "age"].includes(f)) {
      unset[f] = "";
    }
  }

  const text = (k: string, field = k) => {
    const v = body[k];
    if (typeof v === "string" && v.trim() && !reset.includes(field)) set[field] = v.trim();
  };
  text("name");
  text("role");
  text("desc", "description");
  text("personality");
  text("mission");
  text("systemPrompt");
  text("avatar");

  /* Нас: `null` нь "кодынхыг ав", тоо нь тогтоох. 0-ээс бага, 120-оос их
     утга бол оролт биш, алдаа. */
  if (!reset.includes("age") && body.age !== undefined) {
    if (body.age === null || body.age === "") unset.age = "";
    else {
      const n = Number(body.age);
      if (Number.isFinite(n) && n >= 0 && n <= 120) set.age = Math.round(n);
    }
  }

  if (typeof body.active === "boolean") set.active = body.active;
  if (typeof body.postEnabled === "boolean") set.postEnabled = body.postEnabled;
  if (typeof body.order === "number" && Number.isFinite(body.order)) set.order = Math.round(body.order);

  if (body.postHour !== undefined) {
    const h = Number(body.postHour);
    if (Number.isFinite(h) && h >= 0 && h <= 23) set.postHour = Math.round(h);
    else return NextResponse.json({ error: "Цаг 0–23 хооронд байна" }, { status: 400 });
  }

  await dbConnect();

  /* ⚠ `upsert` нь схемийн өгөгдмөлийг шургуулдаг: мөр байхгүй агентын
     ЗӨВХӨН нэрийг өөрчлөхөд Mongoose `active: false` гэсэн өгөгдмөлийг
     хамт хийж, агент чимээгүй алга болно. Тиймээс энэ хүсэлтэд ороогүй
     төлвийн талбаруудыг ОДООГИЙН хүчинтэй утгаар нь ҮҮСГЭХ үед бичнэ. */
  const setOnInsert: Record<string, unknown> = { slug: key };
  if (set.active === undefined) setOnInsert.active = current.active;
  if (set.postEnabled === undefined) setOnInsert.postEnabled = current.postEnabled;
  if (set.postHour === undefined) setOnInsert.postHour = current.postHour;

  const update: Record<string, unknown> = { $set: set, $setOnInsert: setOnInsert };
  if (Object.keys(unset).length) update.$unset = unset;

  await Agent.findOneAndUpdate({ slug: key }, update, { upsert: true, new: true });

  const agent = await resolveOne(key);
  return NextResponse.json({ ok: true, agent });
}
