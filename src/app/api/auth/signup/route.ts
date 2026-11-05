import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { initializeReferral } from "@/lib/credits";
import { rateLimit, clientIp, LIMITS } from "@/lib/rateLimit";
import { deriveUsername } from "@/lib/usernameDerive";

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
    // IP-based rate limit — prevents signup farming
    const ip = clientIp(req.headers);
    const rl = rateLimit(`signup:ip:${ip}`, LIMITS.SIGNUP_PER_IP);
    if (!rl.ok) {
      const mins = Math.ceil(rl.resetInMs / 60_000);
      return NextResponse.json(
        { error: `Дэндүү олон бүртгэлийн оролдлого. ~${mins} минутын дараа дахин оролдоорой.` },
        { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetInMs / 1000)) } }
      );
    }

    const { name, username, email, phone, password, age, gender, aiExperience, creativeRole, interests, referralCode, instagram, program } =
      await req.json();

    // Per-field validation in Mongolian — the previous combined "Нэр, имэйл,
    // нууц үг шаардлагатай" message was firing when ANY of the three was
    // missing, so a user with a typed name + missing email was told "name
    // required." Be specific so the form points to the actual broken field.
    // ─── Username бол үндсэн таних тэмдэг ────────────────────
    // Бүртгэл нь одоо зөвхөн хэрэглэгчийн нэр + нууц үг. Нэр өгөөгүй бол
    // username нь нэрийн үүргийг гүйцэтгэнэ, имэйл өгөөгүй бол username-ээс
    // дотоод хаяг үүсгэнэ — ингэснээр User schema дээрх email: required +
    // unique-ийг хөндөхгүйгээр талбарын тоог хоёр болгож чадна.
    // Хуучин клиент username-гүй, зөвхөн нэр+имэйлээр ирвэл өмнөх
    // зан байдал хэвээр хадгалагдана.
    const trimmedUsername =
      typeof username === "string" ? username.trim().replace(/^@+/, "") : "";

    if (trimmedUsername) {
      if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
        return NextResponse.json(
          { error: "Хэрэглэгчийн нэр 3-30 тэмдэгт байх ёстой" },
          { status: 400 }
        );
      }
      if (!/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
        return NextResponse.json(
          { error: "Хэрэглэгчийн нэр зөвхөн үсэг, тоо, _ агуулна" },
          { status: 400 }
        );
      }
    }

    const rawEmail = typeof email === "string" ? email.trim() : "";
    const rawPhone = typeof phone === "string" ? phone.trim() : "";
    const trimmedName = (typeof name === "string" ? name.trim() : "") || trimmedUsername;

    /* ЖИНХЭНЭ имэйл заавал. Өмнө нь имэйлгүй бол username-ээс
       `<username>@users.antaqor.com` гэж зохиомол хаяг үүсгэдэг байсан —
       тэр нь зөвхөн өвөрмөц түлхүүрийн үүрэгтэй, хүлээн авах хайрцаг БИШ.
       Үр дүнд нь тэр хүмүүс нууц үгээ хэзээ ч сэргээж чадахгүй болсон.
       Одоо шинэ бүртгэлд зохиомол хаяг үүсгэхгүй.
       Зөвхөн username огт ирээгүй хуучин форматад л буцаж ажиллана. */
    const trimmedEmail = rawEmail || "";

    if (!trimmedUsername && !rawEmail) {
      return NextResponse.json({ error: "Хэрэглэгчийн нэрээ оруулна уу" }, { status: 400 });
    }
    if (!rawEmail) {
      return NextResponse.json(
        { error: "Имэйлээ оруулна уу — нууц үг сэргээхэд хэрэгтэй" },
        { status: 400 }
      );
    }
    if (!rawPhone) {
      return NextResponse.json({ error: "Утасны дугаараа оруулна уу" }, { status: 400 });
    }
    if (rawPhone.replace(/\D/g, "").length < 6) {
      return NextResponse.json({ error: "Утасны дугаар буруу байна" }, { status: 400 });
    }
    if (!trimmedName) {
      return NextResponse.json({ error: "Нэрээ оруулна уу" }, { status: 400 });
    }
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      return NextResponse.json({ error: "Нэр 2-50 тэмдэгт байх ёстой" }, { status: 400 });
    }
    if (!trimmedEmail) {
      return NextResponse.json({ error: "Имэйлээ оруулна уу" }, { status: 400 });
    }
    if (!/^\S+@\S+\.\S+$/.test(trimmedEmail)) {
      return NextResponse.json({ error: "Имэйл буруу байна" }, { status: 400 });
    }
    if (!password) {
      return NextResponse.json({ error: "Нууц үгээ оруулна уу" }, { status: 400 });
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

    /* Хүйс нь ЗААВАЛ БИШ — бүртгэлийн цонх өөрөө шаарддаг ч API нь
       шаардахгүй. Шалтгаан: энэ эндпойнтыг /auth/signup хуудас болон гадны
       клиентүүд ч дууддаг; сервер талд заавал болговол хүйсийн талбаргүй
       хуучин дуудлага бүр 400 болж, бүртгэл бүхэлдээ зогсоно. Утга ирвэл
       хатуу шалгана, ирээгүй бол "" — model-ийн default-той нэг. */
    const validGenders = ["male", "female", ""];
    const safeGender =
      typeof gender === "string" && validGenders.includes(gender) ? gender : "";
    if (gender !== undefined && gender !== null && !validGenders.includes(gender)) {
      return NextResponse.json({ error: "Хүйс буруу байна" }, { status: 400 });
    }

    const validExperience = ["beginner", "intermediate", "advanced", "expert", ""];
    if (aiExperience && !validExperience.includes(aiExperience)) {
      return NextResponse.json(
        { error: "AI туршлагын түвшин буруу байна" },
        { status: 400 }
      );
    }

    // Creative identity — Ахисан шат · Engineer · Creator. Legacy values
    // (entrepreneur/emperor) are still accepted so old clients don't break.
    const validRoles = ["ai_edgerunner", "ai_engineer", "ai_creator", "ai_entrepreneur", "ai_emperor"];
    const safeRole =
      typeof creativeRole === "string" && validRoles.includes(creativeRole)
        ? creativeRole
        : "ai_edgerunner";

    const safeInterests = Array.isArray(interests)
      ? interests.filter((i: string) => VALID_INTERESTS.includes(i))
      : [];

    await dbConnect();

    // Username-ийг эхэлж шалгана: имэйл нь username-ээс үүсдэг тул
    // давхцал гарвал шалтгааныг нь зөв хэлэх ёстой — "имэйл давхцлаа"
    // гэвэл хүн ойлгохгүй.
    if (trimmedUsername) {
      const existingUsername = await User.findOne({ username: trimmedUsername.toLowerCase() });
      if (existingUsername) {
        return NextResponse.json(
          { error: "Энэ хэрэглэгчийн нэр аль хэдийн бүртгэлтэй байна" },
          { status: 409 }
        );
      }
    }

    const existingUser = await User.findOne({ email: trimmedEmail.toLowerCase() });
    if (existingUser) {
      return NextResponse.json(
        { error: "Энэ имэйлээр бүртгэл аль хэдийн байна" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const normalizedInstagram = typeof instagram === "string"
      ? instagram.trim().replace(/^@+/, "").toLowerCase().slice(0, 60)
      : "";

    /* ─── username-гүй бүртгэл гаргахаа больсон ──────────────────────
       Энэ талбар нь ЗААВАЛ БИШ хэвээр — маягтад дахин нэг талбар нэмэх нь
       бүртгэлийн хувийг унагаадаг бөгөөд гуравдагч клиентүүдийг эвдэнэ.
       Оронд нь өгөгдсөн зүйлээс автоматаар гаргана.

       Яагаад энэ нь ЧУХАЛ вэ: /pricing нь худалдан авагчид гүйлгээний
       утганд бичих зүйлийг харуулдаг бөгөөд username байвал ТЭР, үгүй бол
       санамсаргүй 6 тэмдэгт код. 2026-08-24-ны байдлаар 650 бүртгэлийн
       571 нь username-гүй байсан — өөрөөр хэлбэл төлөгчдийн 88% нь
       банкны аппд `K7M3PQ` гэж гараар бичих ёстой байв. Буруу бичсэн
       утга нь автомат тааруулагчид танигдахгүй, мөнгө өлгөөтэй үлдэнэ.
       Хүн өөрийн нэрээ буруу бичдэггүй. */
    const finalUsername = trimmedUsername
      ? trimmedUsername.toLowerCase()
      : await deriveUsername({ email: trimmedEmail, name: trimmedName, phone: rawPhone });

    const user = await User.create({
      name: trimmedName,
      username: finalUsername || undefined,
      email: trimmedEmail,
      phone: phone || "",
      password: hashedPassword,
      age: age || undefined,
      gender: safeGender,
      aiExperience: aiExperience || "",
      creativeRole: safeRole,
      interests: safeInterests,
      /* Slug нь чөлөөт бичвэр тул уртыг нь хязгаарлав; байхгүй
         хөтөлбөрийн slug ирвэл зүгээр л тохирохгүй, хор хөнөөлгүй. */
      program: typeof program === "string" ? program.slice(0, 60) : "",
      instagram: normalizedInstagram,
    });

    // Fire referral + welcome bonus. Non-blocking if it errors.
    const ref = typeof referralCode === "string" ? referralCode.trim().toLowerCase() : null;
    let referrerId: string | null = null;
    try {
      const result = await initializeReferral(String(user._id), ref);
      referrerId = result.referrer;
    } catch {
      /* swallow — signup itself succeeded */
    }

    return NextResponse.json(
      {
        message: "Бүртгэл амжилттай үүслээ",
        user: { id: user._id, name: user.name, email: user.email },
        referral: referrerId ? { referrer: referrerId } : null,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Серверийн алдаа";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
