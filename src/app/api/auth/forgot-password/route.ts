import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import nodemailer from "nodemailer";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

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

    await transporter.sendMail({
      from: `"Antaqor" <${process.env.SMTP_USER || "noreply@antaqor.com"}>`,
      to: user.email,
      subject: "Нууц үг сэргээх — Antaqor",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; background: #0A0A0A; color: #FAFAFA; padding: 40px; border-radius: 4px;">
          <div style="font-size: 20px; font-weight: 800; letter-spacing: 4px; margin-bottom: 24px; color: #FAFAFA;">
            ANTAQOR
          </div>
          <p style="font-size: 14px; color: #A3A3A3; line-height: 1.8; margin-bottom: 24px;">
            Сайн байна уу, <strong style="color: #FAFAFA;">${user.name}</strong>. Та нууц үгээ сэргээх хүсэлт илгээсэн байна.
          </p>
          <a href="${resetUrl}" style="display: inline-block; background: #FFFF01; color: #0A0A0A; padding: 12px 32px; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 4px;">
            Нууц үг сэргээх
          </a>
          <p style="font-size: 11px; color: #6B6B6B; margin-top: 24px; line-height: 1.8;">
            Энэ холбоос 1 цагийн дотор хүчинтэй. Хэрэв та энэ хүсэлтийг илгээгээгүй бол энэ имэйлийг үл тоомсорлоно уу.
          </p>
          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.06); font-size: 10px; color: #6B6B6B; letter-spacing: 2px;">
            ANTAQOR
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
