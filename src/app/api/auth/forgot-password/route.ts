import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { sendEmail } from "@/lib/email";

function buildEmailHtml(name: string, resetUrl: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 480px; margin: 0 auto; background: #ffffff; color: #0e1726; padding: 40px; border-radius: 8px;">
      <div style="font-size: 20px; font-weight: 800; letter-spacing: 4px; margin-bottom: 24px; color: #0e1726;">
        ANTAQOR
      </div>
      <p style="font-size: 14px; color: #E2E4E8; line-height: 1.8; margin-bottom: 24px;">
        Сайн байна уу, <strong style="color: #0e1726;">${name}</strong>. Та нууц үгээ сэргээх хүсэлт илгээсэн байна.
      </p>
      <a href="${resetUrl}" style="display: inline-block; background: #2E29FF; color: #ffffff; padding: 12px 32px; font-size: 13px; font-weight: 700; text-decoration: none; border-radius: 4px;">
        Нууц үг сэргээх
      </a>
      <p style="font-size: 11px; color: #E2E4E8; margin-top: 24px; line-height: 1.8;">
        Энэ холбоос 24 цагийн дотор хүчинтэй. Хэрэв та энэ хүсэлтийг илгээгээгүй бол энэ имэйлийг үл тоомсорлоно уу.
      </p>
      <p style="font-size: 11px; color: #E2E4E8; margin-top: 8px; line-height: 1.6;">
        Холбоос ажиллахгүй бол доорх линкийг хуулна уу:<br />
        <span style="color: #E2E4E8; word-break: break-all;">${resetUrl}</span>
      </p>
      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid rgba(15,23,38,0.08); font-size: 10px; color: #E2E4E8; letter-spacing: 2px;">
        ANTAQOR · ХҮРЭЭЛЭЛ
      </div>
    </div>
  `;
}

function buildEmailText(name: string, resetUrl: string) {
  return [
    `Сайн байна уу, ${name}.`,
    "",
    "Та нууц үгээ сэргээх хүсэлт илгээсэн байна. Дараах холбоосыг ашиглана уу:",
    resetUrl,
    "",
    "Энэ холбоос 24 цагийн дотор хүчинтэй. Хэрэв та хүсэлтийг илгээгээгүй бол энэ имэйлийг үл тоомсорлоно уу.",
    "",
    "— Antaqor",
  ].join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const { email } = (await req.json()) as { email?: string };

    if (!email || typeof email !== "string") {
      return NextResponse.json(
        { error: "Имэйл хаяг шаардлагатай" },
        { status: 400 }
      );
    }

    await dbConnect();

    /* Хүмүүс одоо username-ээр нэвтэрдэг тул ямар имэйлээр бүртгүүлснээ
       санахгүй байх нь энгийн. Аль алиныг нь хүлээж авна. */
    const raw = email.trim();
    const user = raw.includes("@")
      ? await User.findOne({ email: raw.toLowerCase() })
      : await User.findOne({ username: raw.toLowerCase().replace(/^@+/, "") });

    // Anti-enumeration — always return the same friendly message regardless
    // of whether the email exists.
    const successMessage = "Хэрэв бүртгэлтэй бол нууц үг сэргээх холбоос илгээгдлээ.";

    if (!user) {
      return NextResponse.json({ message: successMessage });
    }

    /* Зохиомол хаягтай бүртгэл (хуучин username-only үе) — захидал хүрэх
       газаргүй. "Илгээлээ" гэж худал хэлэхийн оронд шууд хэлнэ. */
    if (/@users\.antaqor\.com$/i.test(user.email || "")) {
      return NextResponse.json(
        {
          error:
            "Энэ бүртгэлд сэргээх имэйл хаяг бүртгэгдээгүй байна. Бидэнтэй холбогдож имэйлээ нэмүүлнэ үү.",
        },
        { status: 400 }
      );
    }

    const resetToken = randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await User.updateOne(
      { _id: user._id },
      { resetToken, resetTokenExpiry }
    );

    const baseUrl = process.env.NEXTAUTH_URL || "https://antaqor.com";
    const resetUrl = `${baseUrl}/auth/reset-password?token=${resetToken}`;

    try {
      const result = await sendEmail({
        to: user.email,
        subject: "Нууц үг сэргээх — Antaqor",
        html: buildEmailHtml(user.name || "", resetUrl),
        text: buildEmailText(user.name || "", resetUrl),
      });
      console.log(`[forgot-password] sent via ${result.via} → ${user.email}`);
    } catch (sendErr) {
      // Don't expose the failure to the public response; log + still claim
      // success to prevent enumeration. The token is invalidated below so a
      // bad actor can't reuse a half-generated state.
      console.error("[forgot-password] sendEmail failed:", sendErr);
      // Wipe the token so an unsent reset doesn't leave the account in an
      // inconsistent "reset pending but no email" state.
      await User.updateOne(
        { _id: user._id },
        { $unset: { resetToken: "", resetTokenExpiry: "" } }
      );
      return NextResponse.json(
        { error: "Имэйл илгээхэд алдаа гарлаа. Дахин оролдоно уу." },
        { status: 502 }
      );
    }

    return NextResponse.json({ message: successMessage });
  } catch (error: unknown) {
    console.error("[forgot-password] unhandled:", error);
    return NextResponse.json(
      { error: "Алдаа гарлаа. Дахин оролдоно уу." },
      { status: 500 }
    );
  }
}
