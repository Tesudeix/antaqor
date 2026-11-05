import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkAgentPayment, startAgentCheckout } from "@/lib/agentBilling";
import { BUSINESS_DAYS, BUSINESS_PRICE } from "@/lib/agentWs";

/* Antaqor Agent · Бизнес багц — GET: сүүлийн төлбөрийн төлөв (QPay-ээс буцахад асууна),
   POST: QPay checkout (Wire hosted) эхлүүлнэ. Дүнг сервер тогтооно — клиент юу ч илгээхгүй. */
export const dynamic = "force-dynamic";

async function uid() {
  const s = await getServerSession(authOptions);
  return (s?.user as { id?: string } | undefined)?.id || "";
}

export async function GET() {
  const id = await uid();
  if (!id) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });
  return NextResponse.json({ price: BUSINESS_PRICE, days: BUSINESS_DAYS, ...(await checkAgentPayment(id)) });
}

export async function POST() {
  const id = await uid();
  if (!id) return NextResponse.json({ error: "UNAUTH" }, { status: 401 });
  try {
    return NextResponse.json(await startAgentCheckout(id));
  } catch (e) {
    console.error("[content-agent/billing]", e);
    return NextResponse.json({ error: (e as Error).message?.startsWith("QPay") ? (e as Error).message : "QPay холбогдсонгүй — дахин оролдоно уу" }, { status: 502 });
  }
}
