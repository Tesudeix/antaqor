import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import PlanModel from "@/models/Plan";
import { getEditablePlans } from "@/lib/planStore";
import { PAID_PLANS } from "@/lib/plans";

export const dynamic = "force-dynamic";

/** Зөвхөн кодод байгаа id-г засна — шинэ id үүсгэх нь эрхийн системийг эвдэнэ. */
const EDITABLE_IDS = new Set(PAID_PLANS.map((p) => p.id));

async function guard() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) return false;
  return true;
}

export async function GET() {
  if (!(await guard())) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  // Идэвхгүй болгосныг нь ч харуулна — админ буцааж асаах боломжтой байх ёстой.
  const plans = await getEditablePlans();
  return NextResponse.json({ plans });
}

export async function PUT(req: NextRequest) {
  if (!(await guard())) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const planId = typeof body?.planId === "string" ? body.planId : "";
  if (!EDITABLE_IDS.has(planId as never)) {
    return NextResponse.json({ error: "Танигдахгүй тариф" }, { status: 400 });
  }

  const set: Record<string, unknown> = {};

  if (typeof body.name === "string") set.name = body.name.trim().slice(0, 40);
  if (typeof body.tagline === "string") set.tagline = body.tagline.trim().slice(0, 200);
  if (typeof body.cta === "string") set.cta = body.cta.trim().slice(0, 60);
  if (typeof body.accent === "string") set.accent = body.accent.trim().slice(0, 20);
  if (typeof body.highlight === "boolean") set.highlight = body.highlight;
  if (typeof body.active === "boolean") set.active = body.active;
  if (typeof body.order === "number" && Number.isFinite(body.order)) {
    set.order = Math.trunc(body.order);
  }

  /* Үнэ нь ЭНД шалгагдана. Сөрөг эсвэл тоо биш утга орвол төлбөрийн дүн
     эвдэрч, банкны автомат тааруулагч төлбөрийг хэзээ ч танихгүй болно. */
  if (body.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "Үнэ буруу" }, { status: 400 });
    }
    set.price = Math.round(price);
  }

  if (Array.isArray(body.benefits)) {
    set.benefits = body.benefits
      .map((b: unknown) => String(b).trim())
      .filter((b: string) => b.length > 0)
      .slice(0, 12);
  }

  await dbConnect();
  await PlanModel.updateOne({ planId }, { $set: set }, { upsert: true });

  const plans = await getEditablePlans();
  return NextResponse.json({ plans });
}
