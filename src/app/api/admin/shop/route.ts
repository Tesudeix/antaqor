import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import ShopProduct from "@/models/ShopProduct";
import ShopOrder from "@/models/ShopOrder";
import { slugify } from "@/lib/shop";

/* /api/admin/shop — ANTAQOR SUPPLY бараа CRUD + захиалгын жагсаалт/төлөв. */
export const dynamic = "force-dynamic";

type Body = Record<string, unknown>;
const num = (v: unknown, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
const path = (v: unknown) => { const s = str(v, 400); return /^(\/uploads\/|https:\/\/)/.test(s) ? s : ""; };

function clean(b: Body) {
  const kinds = ["hoodie", "tee", "cap", "other"];
  return {
    name: str(b.name, 120),
    kind: kinds.includes(String(b.kind)) ? String(b.kind) : "other",
    tagline: str(b.tagline, 160),
    description: str(b.description, 4000),
    price: Math.max(0, num(b.price)),
    compareAtPrice: Math.max(0, num(b.compareAtPrice)),
    images: (Array.isArray(b.images) ? b.images : []).map(path).filter(Boolean).slice(0, 8),
    model3d: path(b.model3d),
    colors: (Array.isArray(b.colors) ? b.colors : []).slice(0, 8).map((c) => {
      const x = (c || {}) as Body; const hex = str(x.hex, 7);
      return { name: str(x.name, 30), hex: /^#[0-9a-f]{6}$/i.test(hex) ? hex : "#111111" };
    }).filter((c) => c.name),
    sizes: (Array.isArray(b.sizes) ? b.sizes : []).slice(0, 10).map((s) => {
      const x = (s || {}) as Body; return { label: str(x.label, 8), stock: Math.max(0, Math.floor(num(x.stock))) };
    }).filter((s) => s.label),
    tone: b.tone === "dark" ? "dark" : "light",
    featured: !!b.featured,
    active: b.active !== false,
    sort: num(b.sort),
  };
}

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  await dbConnect();
  if (req.nextUrl.searchParams.get("view") === "orders") {
    const orders = await ShopOrder.find({}).sort({ createdAt: -1 }).limit(300).lean();
    return NextResponse.json({ orders: orders.map((o) => ({ ...o, _id: String(o._id), user: o.user ? String(o.user) : null })) });
  }
  const products = await ShopProduct.find({}).sort({ sort: -1, createdAt: -1 }).lean();
  return NextResponse.json({ products: products.map((p) => ({ ...p, _id: String(p._id) })) });
}

export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as Body;
  const d = clean(b);
  if (!d.name || !d.price) return NextResponse.json({ error: "Нэр, үнэ шаардлагатай" }, { status: 400 });
  await dbConnect();
  let slug = slugify(str(b.slug, 60) || d.name);
  if (await ShopProduct.exists({ slug })) slug = slug + "-" + Date.now().toString(36).slice(-4);
  if (d.featured) await ShopProduct.updateMany({}, { $set: { featured: false } });
  const p = await ShopProduct.create({ ...d, slug });
  return NextResponse.json({ product: { ...p.toObject(), _id: String(p._id) } });
}

export async function PATCH(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const b = (await req.json().catch(() => ({}))) as Body;
  await dbConnect();
  /* захиалгын төлөв */
  if (b.orderId) {
    const st = String(b.status);
    if (!["pending", "paid", "shipped", "done", "cancelled"].includes(st)) return NextResponse.json({ error: "bad status" }, { status: 400 });
    await ShopOrder.updateOne({ _id: String(b.orderId) }, { $set: { status: st, ...(st === "paid" ? { paidAt: new Date() } : {}) } });
    return NextResponse.json({ ok: true });
  }
  const id = str(b._id, 40);
  const d = clean(b);
  if (!id || !d.name || !d.price) return NextResponse.json({ error: "Нэр, үнэ шаардлагатай" }, { status: 400 });
  if (d.featured) await ShopProduct.updateMany({ _id: { $ne: id } }, { $set: { featured: false } });
  await ShopProduct.updateOne({ _id: id }, { $set: d });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id" }, { status: 400 });
  await dbConnect();
  /* захиалгад орсон бараа бол устгахгүй, нуух — захиалгын түүх эвдрэхгүй */
  if (await ShopOrder.exists({ "items.product": id })) {
    await ShopProduct.updateOne({ _id: id }, { $set: { active: false } });
    return NextResponse.json({ ok: true, hidden: true });
  }
  await ShopProduct.deleteOne({ _id: id });
  return NextResponse.json({ ok: true });
}
