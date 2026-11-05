import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export const dynamic = "force-dynamic";

/* ─── Борлуулалтын дуудлагын жагсаалт (.xlsx) ─────────────────────────────
   Яагаад CSV биш вэ: Excel нь CSV доторх утасны дугаарыг тогтмол эвддэг —
   `+976…`-г томъёо гэж үзэх, эхний тэгийг хаях, урт дугаарыг шинжлэх
   ухааны тэмдэглэгээ рүү хөрвүүлэх нь бүгд бодит тохиолдол. Жинхэнэ xlsx
   дээр нүдийг ТЕКСТ болгож тогтоовол дугаар яг хэвээрээ үлдэнэ. Кирилл
   нэрсийн кодчилол ч CSV дээр Excel-ийн хэлний тохиргооноос хамаардаг. */

/** Холимог форматыг нэг болгоно: `+97699112233`, `9911 2233` → `99112233`. */
function localPhone(raw: string): string {
  const d = String(raw || "").replace(/[^\d+]/g, "");
  const bare = d.replace(/^\+?976/, "").replace(/\D/g, "");
  return bare || d.replace(/\D/g, "");
}

/* Username-ээр бүртгүүлсэн хүнд и-мэйл ЗОХИОМЛООР үүсдэг. Тэрийг
   экспортлох нь борлуулагчийг байхгүй хаяг руу бичүүлнэ — хоосон
   үлдээх нь илүү үнэнч. */
const FAKE_EMAIL = /@(antaqor\.dm|users\.antaqor\.com|example\.com)$/i;

type Row = {
  name?: string; username?: string; phone?: string; email?: string;
  level?: number; xp?: number; createdAt?: Date; subscriptionExpiresAt?: Date;
};

export async function GET(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();

  try {
    const segment = req.nextUrl.searchParams.get("segment") || "all";
    const now = new Date();

    const filter: Record<string, unknown> =
      segment === "nonmember" ? { subscriptionExpiresAt: { $exists: false } }
      : segment === "expired" ? { subscriptionExpiresAt: { $lte: now, $exists: true } }
      : segment === "active" ? { subscriptionExpiresAt: { $gt: now } }
      : {};

    await dbConnect();
    const users = (await User.find(filter)
      .select("name username phone email level xp createdAt subscriptionExpiresAt")
      .sort({ createdAt: -1 })
      .lean()) as Row[];

    const wb = new ExcelJS.Workbook();
    wb.creator = "Antaqor";
    wb.created = new Date();
    const ws = wb.addWorksheet("Дуудлага", {
      views: [{ state: "frozen", ySplit: 1 }], // толгой мөр наалдана
    });

    ws.columns = [
      { header: "№", key: "n", width: 6 },
      { header: "Нэр", key: "name", width: 22 },
      { header: "Хэрэглэгч", key: "username", width: 18 },
      { header: "Утас", key: "phone", width: 14 },
      { header: "Гишүүнчлэл", key: "member", width: 14 },
      { header: "Түвшин", key: "level", width: 9 },
      { header: "XP", key: "xp", width: 9 },
      { header: "Бүртгүүлсэн", key: "joined", width: 13 },
      { header: "И-мэйл", key: "email", width: 26 },
      { header: "Тэмдэглэл", key: "note", width: 30 },
    ];

    users.forEach((u, i) => {
      const exp = u.subscriptionExpiresAt ? new Date(u.subscriptionExpiresAt) : null;
      const member = !exp ? "Аваагүй" : exp > now ? "Идэвхтэй" : "Дууссан";
      const email = u.email && !FAKE_EMAIL.test(u.email) ? u.email : "";
      ws.addRow({
        n: i + 1,
        name: u.name || "",
        username: u.username || "",
        phone: localPhone(u.phone || ""),
        member,
        level: u.level ?? 0,
        xp: u.xp ?? 0,
        joined: u.createdAt ? new Date(u.createdAt).toISOString().slice(0, 10) : "",
        email,
        note: "",
      });
    });

    /* Утас, бүртгүүлсэн огноог ТЕКСТ болгож тогтооно — эс бөгөөс Excel
       нээх үедээ тоо/огноо болгон "тусалж" хөрвүүлнэ. */
    ws.getColumn("phone").numFmt = "@";
    ws.getColumn("joined").numFmt = "@";
    ws.getColumn("phone").alignment = { horizontal: "left" };

    const head = ws.getRow(1);
    head.font = { bold: true, color: { argb: "FFFFFFFF" } };
    head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF00E5C7" } };
    head.alignment = { vertical: "middle" };
    head.height = 22;
    ws.autoFilter = { from: "A1", to: { row: 1, column: ws.columns.length } };

    const buf = await wb.xlsx.writeBuffer();
    const stamp = new Date().toISOString().slice(0, 10);
    const name = `antaqor-utas-${segment}-${stamp}.xlsx`;

    return new NextResponse(buf as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[admin/users/export]", e);
    return NextResponse.json({ error: "export_failed" }, { status: 500 });
  }
}
