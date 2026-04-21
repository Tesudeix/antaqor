import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { Resend } from "resend";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Имэйл хаяг шаардлагатай" },
        { status: 400 }
      );
    }

    await dbConnect();

    const user = await User.findOne({ email: email.toLowerCase() });

    // Always return success message to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        message: "Хэрэв бүртгэлтэй имэйл бол нууц үг сэргээх холбоос илгээгдлээ.",
      });
    }

    const resetToken = randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000);

    await User.updateOne(
      { _id: user._id },
      { resetToken, resetTokenExpiry }
    );

    const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${resetToken}`;

    const fromEmail = process.env.EMAIL_FROM || "Antaqor <onboarding@resend.dev>";

    await resend.emails.send({
      from: fromEmail,
      to: user.email,
      subject: "Нууц үг сэргээх — Antaqor",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; background: #0A0A0A; color: #E8E8E8; padding: 40px; border-radius: 8px;">
          <div style="font-size: 20px; font-weight: 800; letter-spacing: 4px; margin-bottom: 24px; color: #E8E8E8;">
            ANTAQOR
          </div>
          <p style="font-size: 14px; color: #999999; line-height: 1.8; margin-bottom: 24px;">
            Сайн байна уу, <strong style="color: #E8E8E8;">${user.name}</strong>. Та нууц үгээ сэргээх хүсэлт илгээсэн байна.
          </p>
          <a href="${resetUrl}" style="display: inline-block; background: #EF2C58; color: #ffffff; padding: 12px 32px; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 4px;">
            Нууц үг сэргээх
          </a>
          <p style="font-size: 11px; color: #666666; margin-top: 24px; line-height: 1.8;">
            Энэ холбоос 1 цагийн дотор хүчинтэй. Хэрэв та энэ хүсэлтийг илгээгээгүй бол энэ имэйлийг үл тоомсорлоно уу.
          </p>
          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 10px; color: #666666; letter-spacing: 2px;">
            ANTAQOR · CYBER EMPIRE
          </div>
        </div>
      `,
    });

    return NextResponse.json({
      message: "Хэрэв бүртгэлтэй имэйл бол нууц үг сэргээх холбоос илгээгдлээ.",
    });
  } catch (error: unknown) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Имэйл илгээхэд алдаа гарлаа. Дахин оролдоно уу." },
      { status: 500 }
    );
  }
}
