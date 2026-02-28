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

    // Always return success to prevent email enumeration
    if (!user) {
      return NextResponse.json({
        message: "Хэрэв бүртгэлтэй имэйл бол нууц үг сэргээх холбоос илгээгдлээ.",
      });
    }

    // Generate reset token
    const resetToken = randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await User.updateOne(
      { _id: user._id },
      { resetToken, resetTokenExpiry }
    );

    const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${resetToken}`;

    await resend.emails.send({
      from: "Antaqor <onboarding@resend.dev>",
      to: user.email,
      subject: "Нууц үг сэргээх — Antaqor",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; background: #0f0f0f; color: #ede8df; padding: 40px; border: 1px solid #1c1c1c;">
          <div style="font-size: 24px; font-weight: bold; letter-spacing: 4px; margin-bottom: 24px;">
            ANTA<span style="color: #cc2200;">QOR</span>
          </div>
          <p style="font-size: 14px; color: #c8c8c0; line-height: 1.8; margin-bottom: 24px;">
            Сайн байна уу, <strong>${user.name}</strong>. Та нууц үгээ сэргээх хүсэлт илгээсэн байна.
            Доорх товчийг дарж шинэ нууц үг тохируулна уу.
          </p>
          <a href="${resetUrl}" style="display: inline-block; background: #cc2200; color: #ede8df; padding: 12px 32px; font-size: 12px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; text-decoration: none;">
            Нууц үг сэргээх
          </a>
          <p style="font-size: 11px; color: #5a5550; margin-top: 24px; line-height: 1.8;">
            Энэ холбоос 1 цагийн дотор хүчинтэй. Хэрэв та энэ хүсэлтийг илгээгээгүй бол энэ имэйлийг үл тоомсорлоно уу.
          </p>
          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #1c1c1c; font-size: 10px; color: #5a5550; letter-spacing: 2px;">
            ДИЖИТАЛ ҮНДЭСТЭН · ANTAQOR
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
      { error: "Алдаа гарлаа. Дахин оролдоно уу." },
      { status: 500 }
    );
  }
}
