import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import KhuushuurOrder from "@/models/KhuushuurOrder";
import { markKhOrderPaid } from "@/lib/khuushuur";
import { createWireCheckoutForPayment, getWireIntentStatus } from "@/lib/wire";

/* GET  /api/khuushuur/orders/:orderNo — төлөв (pending бол Wire-ээс шалгаж paid болгоно).
   POST /api/khuushuur/orders/:orderNo — pending захиалгын QPay холбоосыг дахин гаргана.
   Хувийн мэдээлэл (утас, хаяг) БУЦААХГҮЙ — orderNo мэдэх хэн ч асууж болно. */
export const dynamic = "force-dynamic";

const RE = /^KH-[A-Z0-9]{8}$/;

export async function GET(_req: NextRequest, ctx: { params: Promise<{ orderNo: string }> }) {
  const { orderNo } = await ctx.params;
  if (!RE.test(orderNo)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await dbConnect();
  let o = await KhuushuurOrder.findOne({ orderNo });
  if (!o) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (o.status === "pending" && o.wireIntentId) {
    const st = await getWireIntentStatus(o.wireIntentId).catch(() => "");
    if (st === "succeeded") { await markKhOrderPaid(orderNo); o = await KhuushuurOrder.findOne({ orderNo }); }
  }
  return NextResponse.json(
    { orderNo: o!.orderNo, status: o!.status, mode: o!.mode, total: o!.total, items: o!.items.map((i) => ({ name: i.name, qty: i.qty, price: i.price })) },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(_req: NextRequest, ctx: { params: Promise<{ orderNo: string }> }) {
  const { orderNo } = await ctx.params;
  if (!RE.test(orderNo)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  await dbConnect();
  const o = await KhuushuurOrder.findOne({ orderNo, status: "pending" });
  if (!o) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    const base = process.env.WIRE_RETURN_BASE || "https://antaqor.com";
    const w = await createWireCheckoutForPayment({
      paymentId: String(o._id), amountTugrik: o.total, plan: "khuushuur", userId: o.user ? String(o.user) : "guest",
      description: `Тал Хуушуур ${o.orderNo}`, successUrl: `${base}/khuushuur?order=${o.orderNo}`,
      existingIntentId: o.wireIntentId || null,
    });
    if (w.alreadyPaid) { await markKhOrderPaid(orderNo); return NextResponse.json({ paid: true }); }
    o.wireIntentId = w.intentId; await o.save();
    return NextResponse.json({ url: w.url });
  } catch {
    return NextResponse.json({ error: "QPay холбоос үүсгэж чадсангүй" }, { status: 502 });
  }
}
