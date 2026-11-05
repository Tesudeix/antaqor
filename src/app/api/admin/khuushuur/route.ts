import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import KhuushuurItem from "@/models/KhuushuurItem";
import KhuushuurOrder, { KH_STATUSES } from "@/models/KhuushuurOrder";
import { ensureKhSeed, KH_ARTS, KH_CATEGORY_IDS } from "@/lib/khuushuur";
import { slugify } from "@/lib/shop";

/* /api/admin/khuushuur — Тал Хуушуур цэс CRUD + захиалгын жагсаалт/төлөв. */
export const dynamic = "force-dynamic";

type Body = Record<string, unknown>;
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

function clean(b: Body) {
  const image = str(b.image, 400);
  return {
    category: KH_CATEGORY_IDS.includes(String(b.category)) ? String(b.category) : KH_CATEGORY_IDS[0],
    name: str(b.name, 80),
    kcal: str(b.kcal, 30),
    description: str(b.description, 400),
    price: Math.max(0, Math.round(num(b.price))),
    image: /^(\/uploads\/|https:\/\/)/.test(image) ? image : "",
    art: KH_ARTS.includes(String(b.art)) ? String(b.art) : "one",
    tag: str(b.tag, 20),
    soldOut: !!b.soldOut,
    active: b.active !== false,
    sort: num(b.sort),
  };
}

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  await dbConnect();
  if (req.nextUrl.searchParams.get("view") === "orders") {
    const orders = await KhuushuurOrder.find({}).sort({ createdAt: -1 }).limit(300).lean();
    return NextResponse.json({ orders: orders.map((o) => ({ ...o, _id: String(o._id), user: o.user ? String(o.user) : null })) });
  }
  await ensureKhSeed();
  const items = await KhuushuurItem.find({}).sort({ sort: -1, createdAt: 1 }).lean();
  return NextResponse.json({ items: items.map((p) => ({ ...p, _id: String(p._id) })) });
}

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as Body;
  const d = clean(b);
  if (!d.name || !d.price) return NextResponse.json({ error: "Нэр, үнэ шаардлагатай" }, { status: 400 });
  await dbConnect();
  let slug = "kh-" + slugify(d.name);
  if (await KhuushuurItem.exists({ slug })) slug = slug + "-" + Date.now().toString(36).slice(-4);
  const p = await KhuushuurItem.create({ ...d, slug });
  return NextResponse.json({ item: { ...p.toObject(), _id: String(p._id) } });
}

export async function PATCH(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as Body;
  await dbConnect();
  if (b.orderId) {
    const st = String(b.status);
    if (!(KH_STATUSES as string[]).includes(st)) return NextResponse.json({ error: "bad status" }, { status: 400 });
    await KhuushuurOrder.updateOne({ _id: String(b.orderId) }, { $set: { status: st, ...(st === "paid" ? { paidAt: new Date() } : {}) } });
    return NextResponse.json({ ok: true });
  }
  const id = str(b._id, 40);
  /* жагсаалтаас нэг товчоор "дууссан" асаах/унтраах */
  if (id && typeof b.soldOut === "boolean" && Object.keys(b).length === 2) {
    await KhuushuurItem.updateOne({ _id: id }, { $set: { soldOut: b.soldOut } });
    return NextResponse.json({ ok: true });
  }
  const d = clean(b);
  if (!id || !d.name || !d.price) return NextResponse.json({ error: "Нэр, үнэ шаардлагатай" }, { status: 400 });
  await KhuushuurItem.updateOne({ _id: id }, { $set: d });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id" }, { status: 400 });
  await dbConnect();
  /* захиалгад орсон бол устгахгүй, нуух — захиалгын түүх эвдрэхгүй.
     Сүүлийн барааг устгавал seed дахин орохгүйн тулд мөн нууна. */
  const total = await KhuushuurItem.estimatedDocumentCount();
  if (total <= 1 || (await KhuushuurOrder.exists({ "items.item": id }))) {
    await KhuushuurItem.updateOne({ _id: id }, { $set: { active: false } });
    return NextResponse.json({ ok: true, hidden: true });
  }
  await KhuushuurItem.deleteOne({ _id: id });
  return NextResponse.json({ ok: true });
}
