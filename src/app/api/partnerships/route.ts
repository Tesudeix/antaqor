import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import dbConnect from "@/lib/mongodb";
import Partnership from "@/models/Partnership";

const resend = new Resend(process.env.RESEND_API_KEY);

const VALID_TYPES = ["brand", "education", "tech", "community", "other"];

const TYPE_LABELS: Record<string, string> = {
  brand: "Бренд / Ивээн тэтгэгч",
  education: "Боловсролын хамтрагч",
  tech: "Технологи / Affiliate",
  community: "Нийгэмлэг / Эвент",
  other: "Бусад",
};

function esc(s: string) {
  return String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const company = (body.company || "").trim();
    const name = (body.name || "").trim();
    const email = (body.email || "").trim();
    const phone = (body.phone || "").trim();
    const type = (body.type || "other").trim();
    const message = (body.message || "").trim();

    if (!name || !email || !message) {
      return NextResponse.json(
        { error: "Нэр, имэйл, мессеж заавал шаардлагатай." },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Имэйл хаяг буруу байна." }, { status: 400 });
    }

    const safeType = VALID_TYPES.includes(type) ? type : "other";
    const typeLabel = TYPE_LABELS[safeType] || TYPE_LABELS.other;
    const adminTo = process.env.ADMIN_EMAIL || "cyberempire4444@gmail.com";

    // Persist the inquiry so it shows up in the admin panel.
    await dbConnect();
    await Partnership.create({ company, name, email, phone, type: safeType, message });

    // Best-effort email notification — never fail the request if email errors.
    try {
      await resend.emails.send({
      from: "Antaqor Partnerships <onboarding@resend.dev>",
      to: adminTo,
      replyTo: email,
      subject: `Хамтрах хүсэлт — ${typeLabel}${company ? ` · ${company}` : ""}`,
      html: `
        <div style="font-family: sans-serif; max-width: 520px; margin: 0 auto; background: #f2f5f8; color: #ede8df; padding: 40px; border: 1px solid #F2F2F4;">
          <div style="font-size: 22px; font-weight: bold; letter-spacing: 4px; margin-bottom: 24px;">
            ANTA<span style="color: #2E29FF;">QOR</span>
          </div>
          <p style="font-size: 13px; color: #8a8a82; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 20px;">
            Шинэ хамтрах хүсэлт
          </p>
          <table style="width: 100%; font-size: 14px; color: #c8c8c0; line-height: 1.9;">
            <tr><td style="color:#5a5550; width:120px;">Төрөл</td><td><strong>${esc(typeLabel)}</strong></td></tr>
            ${company ? `<tr><td style="color:#5a5550;">Байгууллага</td><td>${esc(company)}</td></tr>` : ""}
            <tr><td style="color:#5a5550;">Нэр</td><td>${esc(name)}</td></tr>
            <tr><td style="color:#5a5550;">Имэйл</td><td>${esc(email)}</td></tr>
            ${phone ? `<tr><td style="color:#5a5550;">Утас</td><td>${esc(phone)}</td></tr>` : ""}
          </table>
          <div style="margin-top: 20px; padding: 16px; background: #eef2f6; border: 1px solid #F2F2F4; font-size: 14px; color: #c8c8c0; line-height: 1.7; white-space: pre-wrap;">${esc(message)}</div>
          <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #F2F2F4; font-size: 10px; color: #5a5550; letter-spacing: 2px;">
            ДИЖИТАЛ ҮНДЭСТЭН · ANTAQOR
          </div>
        </div>
      `,
      });
    } catch (mailErr) {
      console.error("Partnership email failed (inquiry still saved):", mailErr);
    }

    return NextResponse.json({ message: "Хүсэлт хүлээн авлаа. Бид удахгүй холбогдоно." });
  } catch (error: unknown) {
    console.error("Partnership inquiry error:", error);
    return NextResponse.json(
      { error: "Алдаа гарлаа. Дахин оролдоно уу." },
      { status: 500 }
    );
  }
}
