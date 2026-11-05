import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import ContentVariant from "@/models/ContentVariant";
import { publishVariant } from "@/lib/contentLoop";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/* ─── ХУВИЛБАР БАТЛАХ / ТАТГАЛЗАХ ───────────────────────────────────────
   Нийтлэх нь буцаах боломжгүй үйлдэл тул ЗӨВХӨН энэ замаар, зөвхөн
   хүний дарсан товчоор явна. Давталт нь өөрөө `requireApproval`
   унтраалттай үед л шууд нийтэлнэ. */

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return unauthorized();

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(b.id || "");
  const action = String(b.action || "");
  if (!/^[a-f0-9]{24}$/i.test(id)) return NextResponse.json({ error: "id буруу" }, { status: 400 });

  await dbConnect();
  const v = await ContentVariant.findById(id);
  if (!v) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });

  if (action === "reject") {
    v.status = "rejected";
    v.decidedByEmail = session.user?.email || "";
    await v.save();
    return NextResponse.json({ ok: true, status: v.status });
  }

  if (action === "edit") {
    if (v.status === "published") return NextResponse.json({ error: "Нийтлэгдсэн" }, { status: 409 });
    const text = String(b.text || "").trim();
    if (!text) return NextResponse.json({ error: "Текст хоосон" }, { status: 400 });
    v.text = text.slice(0, 2000);
    await v.save();
    return NextResponse.json({ ok: true });
  }

  if (action === "publish") {
    if (v.status === "published") return NextResponse.json({ error: "Аль хэдийн нийтлэгдсэн" }, { status: 409 });
    if (Array.isArray(b.platforms)) {
      const picked = (b.platforms as unknown[]).map(String)
        .filter((p) => ["threads", "instagram", "facebook"].includes(p));
      if (picked.length) v.platforms = picked;
    }
    v.decidedByEmail = session.user?.email || "";
    await v.save();
    const ok = await publishVariant(v, session.user?.email || "admin");
    return NextResponse.json({ ok, status: v.status, error: v.error });
  }

  return NextResponse.json({ error: "Үйлдэл буруу" }, { status: 400 });
}
