import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import AgentBrand from "@/models/AgentBrand";
import ContentPlan from "@/models/ContentPlan";
import { readiness } from "@/lib/contentAgent";

/* Брэндийн тохиргоо. Идэвхжүүлэхээс өмнө бэлэн байдлыг шалгана —
   бриф, суваг дутуу брэнд долоо хоног бүр хоосон ноорог үйлдвэрлэхгүй. */
export const dynamic = "force-dynamic";
const fail = (error: string, status = 400) => NextResponse.json({ error }, { status });
const str = (v: unknown, max = 2000) => String(v ?? "").slice(0, max);
const list = (v: unknown, max = 20) => (Array.isArray(v) ? v.map((x) => str(x, 400).trim()).filter(Boolean).slice(0, max) : []);
const CH = ["threads", "facebook", "instagram"];

export async function PUT(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const b = (await req.json().catch(() => ({}))).brand || {};
  await dbConnect();
  const cur = await AgentBrand.findOne({ key: str(b.key, 40) }).lean();
  if (!cur) return fail("Брэнд олдсонгүй", 404);
  const n = (v: unknown, lo: number, hi: number, d: number) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.max(lo, Math.min(hi, x)) : d; };
  const pillars = (Array.isArray(b.pillars) ? b.pillars : []).slice(0, 8).map((p: { name?: unknown; share?: unknown; hint?: unknown }) => ({ name: str(p.name, 40).trim(), share: n(p.share, 0, 100, 0), hint: str(p.hint, 300).trim() })).filter((p: { name: string }) => p.name);
  const set = {
    name: str(b.name, 60).trim() || cur.name,
    active: b.active === true,
    runWeekday: n(b.runWeekday, 1, 7, cur.runWeekday), runHour: n(b.runHour, 0, 23, cur.runHour),
    postsPerWeek: n(b.postsPerWeek, 1, 21, cur.postsPerWeek), maxPerDay: n(b.maxPerDay, 1, 4, cur.maxPerDay),
    hours: Array.from(new Set((Array.isArray(b.hours) ? b.hours : []).map((h: unknown) => n(h, 0, 23, -1)).filter((h: number) => h >= 0))).slice(0, 6) as number[],
    channels: (Array.isArray(b.channels) ? b.channels : []).filter((c: string) => CH.includes(c)),
    metaAccount: str(b.metaAccount, 80), threadsUserId: str(b.threadsUserId, 80),
    imageMode: ["auto", "manual", "off"].includes(b.imageMode) ? b.imageMode : cur.imageMode,
    imageShare: n(b.imageShare, 0, 100, cur.imageShare),
    visualStyle: str(b.visualStyle, 800), voiceNotes: str(b.voiceNotes, 1500),
    pillars,
    product: {
      name: str(b.product?.name, 80), oneLiner: str(b.product?.oneLiner, 200), description: str(b.product?.description, 2000),
      price: str(b.product?.price, 200), offer: str(b.product?.offer, 400), link: str(b.product?.link, 300), cta: str(b.product?.cta, 200),
      audience: str(b.product?.audience, 600), usps: list(b.product?.usps), facts: list(b.product?.facts, 30), banned: list(b.product?.banned),
      refImages: list(b.product?.refImages, 3).filter((u) => /^(\/uploads\/|https:\/\/(www\.)?antaqor\.com\/uploads\/)/.test(u)),
    },
  };
  const r = readiness({ ...set, kind: cur.kind });
  if (set.active && !r.ok) return fail(`Идэвхжүүлэхийн өмнө: ${r.items.filter((i) => !i.ok).map((i) => i.label).join(", ")}`);
  if (!set.hours.length) return fail("Ядаж нэг нийтлэх цаг сонгоно уу");
  await AgentBrand.updateOne({ key: cur.key }, { $set: set });
  return NextResponse.json({ ok: true, ready: r });
}

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const b = await req.json().catch(() => ({}));
  const name = str(b.name, 60).trim();
  const key = str(b.key || name, 40).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!name || !key) return fail("Нэр ба латин түлхүүр (жишээ нь hooji) оруулна уу");
  await dbConnect();
  if (await AgentBrand.exists({ key })) return fail("Ийм түлхүүртэй брэнд байна");
  const kind = b.kind === "personal" ? "personal" : "product";
  await AgentBrand.create({
    key, name, kind, active: false, postsPerWeek: 5, maxPerDay: 1, hours: [12, 20], channels: [], imageMode: "auto", imageShare: kind === "product" ? 70 : 30, lastRunAt: new Date(),
    pillars: kind === "product"
      ? [{ name: "Танилцуулга", share: 25, hint: "Бүтээгдэхүүн юу вэ, хэнд зориулсан" }, { name: "Асуудал → шийдэл", share: 25, hint: "Нэг бодит асуудал ба шийдэл" }, { name: "Хэрэглээ", share: 20, hint: "Яаж, хэзээ хэрэглэх" }, { name: "Итгэл", share: 15, hint: "Зөвхөн баталгаатай баримт" }, { name: "Санал", share: 15, hint: "Үнэ / урамшуулал / CTA" }]
      : [{ name: "Туршлага", share: 40, hint: "Бодит процесс, тоотой" }, { name: "Задлал", share: 30, hint: "Нэг санааг задлах" }, { name: "Урилга", share: 30, hint: "Шууд урих" }],
  });
  return NextResponse.json({ ok: true, key });
}

export async function DELETE(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const key = req.nextUrl.searchParams.get("key") || "";
  if (!key || key === "antaqor") return fail("Энэ брэндийг устгах боломжгүй");
  await dbConnect();
  /* Товлогдсон постууд SocialPost-д хэвээр үлдэнэ (Content Studio-д харагдана) */
  await ContentPlan.updateMany({ brand: key, active: true }, { $set: { active: false, status: "archived" } });
  const r = await AgentBrand.deleteOne({ key });
  return r.deletedCount ? NextResponse.json({ ok: true }) : fail("Олдсонгүй", 404);
}
