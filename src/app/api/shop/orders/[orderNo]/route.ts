import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import ShopOrder from "@/models/ShopOrder";
import { markOrderPaid } from "@/lib/shop";
import { createWireCheckoutForPayment, getWireIntentStatus } from "@/lib/wire";

/* GET  /api/shop/orders/:orderNo — төлөв (pending бол Wire-ээс шалгаж paid болгоно).
   POST /api/shop/orders/:orderNo — pending захиалгын QPay холбоосыг дахин гаргана.
   Хувийн мэдээлэл (утас, хаяг) БУЦААХГҮЙ — orderNo мэдэх хэн ч асууж болно. */
export const dynamic = "force-dynamic";

function view(o: { orderNo: string; status: string; total: number; items: { name: string; size: string; color: string; qty: number; price: number; image: string }[] }) {
  return {
    orderNo: o.orderNo, status: o.status, total: o.total,
    items: o.items.map((i) => ({ name: i.name, size: i.size, color: i.color, qty: i.qty, price: i.price, image: i.image })),
  };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ orderNo: string }> }) {
  const { orderNo } = await ctx.params;
  if (!/^AQ-[A-Z0-9]{8}$/.test(orderNo)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await dbConnect();
  let o = await ShopOrder.findOne({ orderNo });
  if (!o) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (o.status === "pending" && o.wireIntentId) {
    const st = await getWireIntentStatus(o.wireIntentId).catch(() => "");
    if (st === "succeeded") { await markOrderPaid(orderNo); o = await ShopOrder.findOne({ orderNo }); }
  }
  return NextResponse.json(view(o!), { headers: { "Cache-Control": "no-store" } });
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ orderNo: string }> }) {
  const { orderNo } = await ctx.params;
  await dbConnect();
  const o = await ShopOrder.findOne({ orderNo, status: "pending" });
  if (!o) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const base = process.env.WIRE_RETURN_BASE || "https://antaqor.com";
    const w = await createWireCheckoutForPayment({
      paymentId: String(o._id), amountTugrik: o.total, plan: "shop", userId: o.user ? String(o.user) : "guest",
      description: `ANTAQOR SUPPLY ${o.orderNo}`, successUrl: `${base}/shop?order=${o.orderNo}`,
      existingIntentId: o.wireIntentId || null,
    });
    if (w.alreadyPaid) { await markOrderPaid(orderNo); return NextResponse.json({ paid: true }); }
    o.wireIntentId = w.intentId; await o.save();
    return NextResponse.json({ url: w.url });
  } catch {
    return NextResponse.json({ error: "QPay холбоос үүсгэж чадсангүй" }, { status: 502 });
  }
}
