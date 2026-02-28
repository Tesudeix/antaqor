import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

const VALID_INTERESTS = [
  "ai_tools",
  "programming",
  "design",
  "business",
  "data_science",
  "robotics",
  "content_creation",
  "education",
  "finance",
  "health",
];

export async function POST(req: NextRequest) {
  try {
    const { name, username, email, phone, password, age, aiExperience, interests } =
      await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Нэр, имэйл, нууц үг шаардлагатай" },
        { status: 400 }
      );
    }

    if (username) {
      if (username.length < 3 || username.length > 30) {
        return NextResponse.json(
          { error: "Хэрэглэгчийн нэр 3-30 тэмдэгт байх ёстой" },
          { status: 400 }
        );
      }
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return NextResponse.json(
          { error: "Хэрэглэгчийн нэр зөвхөн үсэг, тоо, _ агуулна" },
          { status: 400 }
        );
      }
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой" },
        { status: 400 }
      );
    }

    if (age && (age < 13 || age > 120)) {
      return NextResponse.json(
        { error: "Нас 13-120 хооронд байх ёстой" },
        { status: 400 }
      );
    }

    const validExperience = ["beginner", "intermediate", "advanced", "expert", ""];
    if (aiExperience && !validExperience.includes(aiExperience)) {
      return NextResponse.json(
        { error: "AI туршлагын түвшин буруу байна" },
        { status: 400 }
      );
    }

    const safeInterests = Array.isArray(interests)
      ? interests.filter((i: string) => VALID_INTERESTS.includes(i))
      : [];

    await dbConnect();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json(
        { error: "Энэ имэйлээр бүртгэл аль хэдийн байна" },
        { status: 409 }
      );
    }

    if (username) {
      const existingUsername = await User.findOne({ username: username.toLowerCase() });
      if (existingUsername) {
        return NextResponse.json(
          { error: "Энэ хэрэглэгчийн нэр аль хэдийн бүртгэлтэй байна" },
          { status: 409 }
        );
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      username: username ? username.toLowerCase() : undefined,
      email,
      phone: phone || "",
      password: hashedPassword,
      age: age || undefined,
      aiExperience: aiExperience || "",
      interests: safeInterests,
    });

    return NextResponse.json(
      {
        message: "Бүртгэл амжилттай үүслээ",
        user: { id: user._id, name: user.name, email: user.email },
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Серверийн алдаа";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
