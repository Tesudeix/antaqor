import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import dbConnect from "@/lib/mongodb";
import mongoose from "mongoose";
import InfluencerCollab from "@/models/InfluencerCollab";
import Influencer from "@/models/Influencer";

const resend = new Resend(process.env.RESEND_API_KEY);

function esc(s: string) {
  return String(s).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] || c));
}

// POST — public. A brand requests a collaboration (targeted or open brief).
export async function POST(req: NextRequest) {
  try {
    const b = await req.json();
    const name = (b.name || "").trim();
    const email = (b.email || "").trim();
    const brand = (b.brand || "").trim();
    const phone = (b.phone || "").trim();
    const budget = Number(b.budget) || 0;
    const goal = (b.goal || "").trim();
    const message = (b.message || "").trim();

    if (!name || !email || !message) {
      return NextResponse.json({ error: "Нэр, имэйл, зорилго заавал." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Имэйл хаяг буруу байна." }, { status: 400 });
    }

    await dbConnect();

    // Resolve the targeted creator (by id or slug) for a clean lead snapshot.
    let influencerId: mongoose.Types.ObjectId | undefined = undefined;
    let influencerName = "";
    const ref = (b.influencer || b.influencerId || "").toString().trim();
    if (ref) {
      const or: Record<string, unknown>[] = [{ slug: ref.toLowerCase() }];
      if (mongoose.isValidObjectId(ref)) or.push({ _id: ref });
      const inf = await Influencer.findOne({ $or: or }).select("name").lean();
      if (inf) {
        influencerId = (inf as { _id: mongoose.Types.ObjectId })._id;
        influencerName = (inf as { name: string }).name;
      }
    }

    await InfluencerCollab.create({
      influencerId, influencerName, brand, name, email, phone, budget, goal, message,
    });

    const adminTo = process.env.ADMIN_EMAIL || "cyberempire4444@gmail.com";
    try {
      await resend.emails.send({
        from: "Antaqor Influencers <onboarding@resend.dev>",
        to: adminTo,
        replyTo: email,
        subject: `Хамтын ажиллагааны хүсэлт${influencerName ? ` — ${influencerName}` : " (нээлттэй)"}${brand ? ` · ${brand}` : ""}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#161618;color:#F2F2F4;padding:40px;">
            <div style="font-size:22px;font-weight:bold;letter-spacing:4px;margin-bottom:8px;">ANTA<span style="color:#1080CA;">QOR</span></div>
            <p style="font-size:11px;color:#B4B4BA;letter-spacing:2px;text-transform:uppercase;margin-bottom:20px;">Брэндийн хамтын ажиллагаа</p>
            <table style="width:100%;font-size:14px;color:#c8c8c0;line-height:1.9;">
              <tr><td style="color:#84848C;width:130px;">Креатор</td><td><strong>${esc(influencerName || "Нээлттэй бриф")}</strong></td></tr>
              ${brand ? `<tr><td style="color:#84848C;">Брэнд</td><td>${esc(brand)}</td></tr>` : ""}
              <tr><td style="color:#84848C;">Хариуцагч</td><td>${esc(name)}</td></tr>
              <tr><td style="color:#84848C;">Имэйл</td><td>${esc(email)}</td></tr>
              ${phone ? `<tr><td style="color:#84848C;">Утас</td><td>${esc(phone)}</td></tr>` : ""}
              ${goal ? `<tr><td style="color:#84848C;">Зорилго</td><td>${esc(goal)}</td></tr>` : ""}
              ${budget ? `<tr><td style="color:#84848C;">Төсөв</td><td>₮${budget.toLocaleString()}</td></tr>` : ""}
            </table>
            <div style="margin-top:18px;padding:16px;background:#1E1E21;font-size:14px;color:#c8c8c0;line-height:1.7;white-space:pre-wrap;">${esc(message)}</div>
            <div style="margin-top:24px;padding-top:14px;border-top:1px solid rgba(255,255,255,0.1);font-size:10px;color:#84848C;letter-spacing:2px;">ДИЖИТАЛ ҮНДЭСТЭН · ANTAQOR</div>
          </div>`,
      });
    } catch (mailErr) {
      console.error("Collab email failed (still saved):", mailErr);
    }

    return NextResponse.json({ message: "Хүсэлт хүлээн авлаа. Бид удахгүй холбогдоно." });
  } catch (e) {
    console.error("Collab request error:", e);
    return NextResponse.json({ error: "Алдаа гарлаа. Дахин оролдоно уу." }, { status: 500 });
  }
}
