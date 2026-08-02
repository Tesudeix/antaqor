import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import dbConnect from "@/lib/mongodb";
import InfluencerApplication from "@/models/InfluencerApplication";

const resend = new Resend(process.env.RESEND_API_KEY);

function esc(s: string) {
  return String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
}

// POST — public. A creator applies to join the Antaqor roster.
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const name = (b.name || "").trim();
    const email = (b.email || "").trim();
    const handle = (b.handle || "").trim().replace(/^@/, "");
    const phone = (b.phone || "").trim();
    const niche = (b.niche || "").trim();
    const primaryPlatform = (b.primaryPlatform || "").trim();
    const followers = Number(b.followers) || 0;
    const portfolioUrl = (b.portfolioUrl || "").trim();
    const message = (b.message || "").trim();

    if (!name || !email) {
      return NextResponse.json({ error: "Нэр болон имэйл заавал." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Имэйл хаяг буруу байна." }, { status: 400 });
    }

    await dbConnect();
    await InfluencerApplication.create({
      name, handle, email, phone, niche, primaryPlatform, followers, portfolioUrl, message,
    });

    const adminTo = process.env.ADMIN_EMAIL || "cyberempire4444@gmail.com";
    try {
      await resend.emails.send({
        from: "Antaqor Influencers <onboarding@resend.dev>",
        to: adminTo,
        replyTo: email,
        subject: `Шинэ креатор өргөдөл — ${name}${handle ? ` @${handle}` : ""}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#161618;color:#F2F2F4;padding:40px;">
            <div style="font-size:22px;font-weight:bold;letter-spacing:4px;margin-bottom:8px;">ANTA<span style="color:#1080CA;">QOR</span></div>
            <p style="font-size:11px;color:#B4B4BA;letter-spacing:2px;text-transform:uppercase;margin-bottom:20px;">Шинэ инфлюенсер өргөдөл</p>
            <table style="width:100%;font-size:14px;color:#c8c8c0;line-height:1.9;">
              <tr><td style="color:#84848C;width:130px;">Нэр</td><td><strong>${esc(name)}</strong></td></tr>
              ${handle ? `<tr><td style="color:#84848C;">Handle</td><td>@${esc(handle)}</td></tr>` : ""}
              <tr><td style="color:#84848C;">Имэйл</td><td>${esc(email)}</td></tr>
              ${phone ? `<tr><td style="color:#84848C;">Утас</td><td>${esc(phone)}</td></tr>` : ""}
              ${niche ? `<tr><td style="color:#84848C;">Чиглэл</td><td>${esc(niche)}</td></tr>` : ""}
              ${primaryPlatform ? `<tr><td style="color:#84848C;">Платформ</td><td>${esc(primaryPlatform)}</td></tr>` : ""}
              ${followers ? `<tr><td style="color:#84848C;">Дагагч</td><td>${followers.toLocaleString()}</td></tr>` : ""}
              ${portfolioUrl ? `<tr><td style="color:#84848C;">Portfolio</td><td>${esc(portfolioUrl)}</td></tr>` : ""}
            </table>
            ${message ? `<div style="margin-top:18px;padding:16px;background:#1E1E21;font-size:14px;color:#c8c8c0;line-height:1.7;white-space:pre-wrap;">${esc(message)}</div>` : ""}
            <div style="margin-top:24px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.1);font-size:10px;color:#84848C;letter-spacing:2px;">ДИЖИТАЛ ҮНДЭСТЭН · ANTAQOR</div>
          </div>`,
      });
    } catch (mailErr) {
      console.error("Influencer application email failed (still saved):", mailErr);
    }

    return NextResponse.json({ message: "Өргөдөл хүлээн авлаа. Бид тун удахгүй холбогдоно." });
  } catch (e) {
    console.error("Influencer application error:", e);
    return NextResponse.json({ error: "Алдаа гарлаа. Дахин оролдоно уу." }, { status: 500 });
  }
}
