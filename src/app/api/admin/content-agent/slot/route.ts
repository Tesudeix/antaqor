import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import { approveSlot, unapproveSlot, editSlot, rewriteSlot, regenImage, skipSlot } from "@/lib/contentAgent";

/* Нэг слот дээрх үйлдэл. Агент юу ч нийтлэхгүй — "approve" нь SocialPost-ыг
   товлосон төлөвт үүсгэдэг цорын ганц зам, нийтлэлтийг social-schedule cron хийнэ. */
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();
  const b = await req.json().catch(() => ({}));
  const planId = String(b.planId || ""), slotId = String(b.slotId || "");
  if (!/^[a-f0-9]{24}$/.test(planId) || !slotId) return NextResponse.json({ error: "Слот буруу" }, { status: 400 });
  try {
    switch (b.action) {
      case "save": await editSlot(planId, slotId, b.edit || {}); break;
      case "approve":
        if (b.edit && Object.keys(b.edit).length) await editSlot(planId, slotId, b.edit);
        await approveSlot(planId, slotId, session.user?.email || ""); break;
      case "unapprove": await unapproveSlot(planId, slotId); break;
      case "rewrite": await rewriteSlot(planId, slotId, String(b.instruction || "")); break;
      case "image": await regenImage(planId, slotId, typeof b.prompt === "string" ? b.prompt : undefined); break;
      case "skip": await skipSlot(planId, slotId, true); break;
      case "unskip": await skipSlot(planId, slotId, false); break;
      default: return NextResponse.json({ error: "Үйлдэл буруу" }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message || "Алдаа" }, { status: 400 });
  }
}
