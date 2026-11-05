import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import mongoose from "mongoose";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import KhuushuurItem from "@/models/KhuushuurItem";
import KhuushuurOrder from "@/models/KhuushuurOrder";
import { khDeliveryFee, newKhOrderNo } from "@/lib/khuushuur";
import { createWireCheckoutForPayment, wireEnabled } from "@/lib/wire";
import { rateLimit, clientIp } from "@/lib/rateLimit";

/* POST /api/khuushuur/orders — сагснаас захиалга үүсгээд QPay (Wire) холбоос буцаана.
   Зочин ч захиална: нэр + утас заавал, хүргэлтээр бол хаяг заавал.
   Үнэ, нэр бүгд СЕРВЕРИЙН цэснээс — клиентийн үнэд итгэхгүй. */
export const dynamic = "force-dynamic";

type Line = { slug?: string; qty?: number };

export async function POST(req: NextRequest) {
  const rl = rateLimit(`kh-order:${clientIp(req.headers)}`, { max: 8, windowMs: 10 * 60 * 1000 });
  if (!rl.ok) return NextResponse.json({ error: "Хэт олон оролдлого. Түр хүлээгээд дахин оролдоно уу." }, { status: 429 });

  const body = await req.json().catch(() => ({}));
  const mode: "delivery" | "pickup" = body.mode === "pickup" ? "pickup" : "delivery";
  const lines: Line[] = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
  const c = body.customer || {};
  const customer = {
    name: String(c.name || "").trim().slice(0, 80),
    phone: String(c.phone || "").replace(/[^\d+]/g, "").slice(0, 16),
    address: String(c.address || "").trim().slice(0, 400),
    note: String(c.note || "").trim().slice(0, 400),
  };
  if (!lines.length) return NextResponse.json({ error: "Сагс хоосон байна" }, { status: 400 });
  if (customer.name.length < 2 || customer.phone.replace(/\D/g, "").length < 8) {
    return NextResponse.json({ error: "Нэр, утсаа (8 орон) бичнэ үү" }, { status: 400 });
  }
  if (mode === "delivery" && customer.address.length < 6) {
    return NextResponse.json({ error: "Хүргэлтийн хаягаа бүрэн бичнэ үү" }, { status: 400 });
  }

  await dbConnect();
  const slugs = [...new Set(lines.map((l) => String(l.slug || "")))];
  const rows = await KhuushuurItem.find({ slug: { $in: slugs }, active: true }).lean();
  const bySlug = new Map(rows.map((r) => [r.slug, r]));

  const merged = new Map<string, number>();
  for (const l of lines) {
    const slug = String(l.slug || "");
    const qty = Math.min(50, Math.max(1, Math.floor(Number(l.qty) || 1)));
    merged.set(slug, Math.min(50, (merged.get(slug) || 0) + qty));
  }
  const items = [];
  for (const [slug, qty] of merged) {
    const r = bySlug.get(slug);
    if (!r) return NextResponse.json({ error: "Сагсан дахь нэг хоол цэснээс хасагдсан байна. Сагсаа шинэчилнэ үү." }, { status: 409 });
    if (r.soldOut) return NextResponse.json({ error: `${r.name} өнөөдөр дууссан байна` }, { status: 409 });
    items.push({ item: r._id as mongoose.Types.ObjectId, slug: r.slug, name: r.name, price: r.price, qty });
  }

  const subtotal = items.reduce((a, it) => a + it.price * it.qty, 0);
  const deliveryFee = khDeliveryFee(mode, subtotal);
  const total = subtotal + deliveryFee;
  const session = await getServerSession(authOptions);
  const uid = (session?.user as { id?: string } | undefined)?.id;

  const order = await KhuushuurOrder.create({
    orderNo: newKhOrderNo(), mode, items, subtotal, deliveryFee, total, customer,
    user: uid && mongoose.isValidObjectId(uid) ? uid : undefined,
  });

  if (!wireEnabled()) return NextResponse.json({ orderNo: order.orderNo, total, url: null, error: "Төлбөрийн систем түр ажиллахгүй байна" }, { status: 503 });
  try {
    const base = process.env.WIRE_RETURN_BASE || "https://antaqor.com";
    const w = await createWireCheckoutForPayment({
      paymentId: String(order._id), amountTugrik: total, plan: "khuushuur", userId: uid || "guest",
      description: `Тал Хуушуур ${order.orderNo}`,
      successUrl: `${base}/khuushuur?order=${order.orderNo}`,
    });
    order.wireIntentId = w.intentId;
    await order.save();
    return NextResponse.json({ orderNo: order.orderNo, total, url: w.url });
  } catch (e) {
    console.error("[khuushuur/orders] wire", (e as Error).message);
    return NextResponse.json({ orderNo: order.orderNo, total, url: null, error: "QPay холбоос үүсгэж чадсангүй. Дахин оролдоно уу." }, { status: 502 });
  }
}
