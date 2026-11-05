import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import ShopProduct from "@/models/ShopProduct";
import ShopOrder from "@/models/ShopOrder";
import { newOrderNo, SHOP_DELIVERY_FEE } from "@/lib/shop";
import { createWireCheckoutForPayment, wireEnabled } from "@/lib/wire";
import { rateLimit, clientIp } from "@/lib/rateLimit";

/* POST /api/shop/orders — сагснаас захиалга үүсгээд QPay (Wire) холбоос буцаана.
   Нэвтрээгүй зочин ч захиалж болно (нэр + утас + хаяг заавал).
   Үнэ, нэр, зураг бүгд СЕРВЕРИЙН каталогоос — клиентийн үнэд итгэхгүй. */
export const dynamic = "force-dynamic";

type Line = { slug?: string; size?: string; color?: string; qty?: number };

export async function POST(req: NextRequest) {
  const rl = rateLimit(`shop-order:${clientIp(req.headers)}`, { max: 8, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) {
    return NextResponse.json({ error: "Хэт олон оролдлого. Түр хүлээгээд дахин оролдоно уу." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const lines: Line[] = Array.isArray(body.items) ? body.items.slice(0, 20) : [];
  const c = body.customer || {};
  const customer = {
    name: String(c.name || "").trim().slice(0, 80),
    phone: String(c.phone || "").replace(/[^\d+]/g, "").slice(0, 16),
    address: String(c.address || "").trim().slice(0, 400),
    note: String(c.note || "").trim().slice(0, 400),
  };
  if (!lines.length) return NextResponse.json({ error: "Сагс хоосон байна" }, { status: 400 });
  if (customer.name.length < 2 || customer.phone.replace(/\D/g, "").length < 8 || customer.address.length < 6) {
    return NextResponse.json({ error: "Нэр, утас (8 орон), хүргэлтийн хаягаа бүрэн бичнэ үү" }, { status: 400 });
  }

  await dbConnect();
  const slugs = [...new Set(lines.map((l) => String(l.slug || "")))];
  const prods = await ShopProduct.find({ slug: { $in: slugs }, active: true }).lean();
  const bySlug = new Map(prods.map((p) => [p.slug, p]));

  const items = [];
  for (const l of lines) {
    const p = bySlug.get(String(l.slug || ""));
    if (!p) return NextResponse.json({ error: "Сагсан дахь нэг бараа дууссан эсвэл хасагдсан байна" }, { status: 409 });
    const qty = Math.min(10, Math.max(1, Math.floor(Number(l.qty) || 1)));
    const size = String(l.size || "");
    if (p.sizes?.length) {
      const s = p.sizes.find((x) => x.label === size);
      if (!s) return NextResponse.json({ error: `${p.name}: хэмжээгээ сонгоно уу` }, { status: 400 });
      if ((s.stock || 0) < qty) return NextResponse.json({ error: `${p.name} (${size}) — үлдэгдэл ${Math.max(0, s.stock || 0)}` }, { status: 409 });
    }
    const color = p.colors?.length ? (p.colors.find((x) => x.name === l.color)?.name || p.colors[0].name) : "";
    items.push({ product: p._id as mongoose.Types.ObjectId, name: p.name, slug: p.slug, image: p.images?.[0] || "", price: p.price, size, color, qty });
  }

  const subtotal = items.reduce((a, it) => a + it.price * it.qty, 0);
  const total = subtotal + SHOP_DELIVERY_FEE;
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string } | undefined)?.id;

  const order = await ShopOrder.create({
    orderNo: newOrderNo(), items, subtotal, deliveryFee: SHOP_DELIVERY_FEE, total, customer,
    user: uid && mongoose.isValidObjectId(uid) ? uid : undefined,
  });

  if (!wireEnabled()) return NextResponse.json({ orderNo: order.orderNo, total, url: null, error: "Төлбөрийн систем түр ажиллахгүй байна" }, { status: 503 });
  try {
    const base = process.env.WIRE_RETURN_BASE || "https://antaqor.com";
    const w = await createWireCheckoutForPayment({
      paymentId: String(order._id), amountTugrik: total, plan: "shop", userId: uid || "guest",
      description: `ANTAQOR SUPPLY ${order.orderNo}`,
      successUrl: `${base}/shop?order=${order.orderNo}`,
    });
    order.wireIntentId = w.intentId;
    await order.save();
    return NextResponse.json({ orderNo: order.orderNo, total, url: w.url });
  } catch (e) {
    console.error("[shop/orders] wire", (e as Error).message);
    return NextResponse.json({ orderNo: order.orderNo, total, url: null, error: "QPay холбоос үүсгэж чадсангүй. Дахин оролдоно уу." }, { status: 502 });
  }
}
