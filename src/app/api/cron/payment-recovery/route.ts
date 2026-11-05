import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Payment from "@/models/Payment";
import User from "@/models/User";
import Notification from "@/models/Notification";
import { pushToUser } from "@/lib/push";
import { sendEmail } from "@/lib/email";
import { isRecoverableTag } from "@/lib/payTag";

export const dynamic = "force-dynamic";

/* ─── Хаягдсан нэхэмжлэхийг сэргээх ───────────────────────────────────────

   ЯАГААД ЭНЭ БАЙХ ЁСТОЙ ВЭ. 2026-08-24-ний өгөгдөл:

     · 359 төлбөрийн оролдлогын 337 нь бүртгүүлснээс хойш 5 МИНУТЫН дотор
     · 338 хүний 325 нь ганц удаа оролдоод ДАХИЖ ХЭЗЭЭ Ч эргэж ирээгүй
     · тэр хүмүүст илгээгдсэн мэдэгдэл: 0
       (37,477 мэдэгдлийн бүгд нь `new_post` ба `new_course`)

   Өөрөөр хэлбэл: хүн төлөх ГЭЖ бүртгүүлж, банкны апп руу гарч, буцаж
   ирэхээ мартаж, тэр чигээрээ алга болдог. Систем нь тэднийг санадаггүй.
   Хамгийн хямд засвар нь илүү сайн дизайн биш — САНАХ явдал.

   ШАТ. Төлбөр үүссэнээс хойш +1 цаг, +24 цаг, +72 цаг. Гурав л. Дөрөв дэх
   нь сануулга биш, дарамт.

   ХУУЧИН НЭХЭМЖЛЭХ. Анхдагчаар зөвхөн сүүлийн `MAX_AGE_DAYS` хоногийнхыг
   хөндөнө. Хэдэн сарын өмнөх 291 хаягдсан нэхэмжлэх рүү өнөөдөр гэнэт
   имэйл цацах нь сэргээлт биш, спам — Resend дээрх нэр хүндийг унагаана.
   Тэднийг сэргээх нь ТУСДАА шийдвэр: `?maxAgeDays=180` гэж нэг удаа
   гараар дуудаж болно (cron secret шаардлагатай хэвээр).                */

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Шатлал: сануулга №N-ийг төлбөр үүссэнээс хойш хэдийд илгээх вэ. */
const LADDER_MS = [1 * HOUR, 24 * HOUR, 72 * HOUR];

/* ─── ХОЁР ДАХЬ ХААЛГА: сануулга хоорондын ХАМГИЙН БОГИНО зай ─────────────
   Зөвхөн шатлалаар тооцвол ХУУЧИН нэхэмжлэх дээр гурвуулаа бараг зэрэг
   явна: 4 сарын өмнөх нэхэмжлэх нь эхний ажиллагаанд "1 цаг өнгөрсөн"
   ч, "24 цаг өнгөрсөн" ч, "72 цаг өнгөрсөн" ч мөрддөг. 2026-08-24-нд яг
   ийм болсон — нэг хүн 8 цагийн дотор гурван имэйл авав. Энэ нь сэргээлт
   биш, дарамт.

   Тиймээс шат ахих хоёр нөхцөлтэй: нэхэмжлэх хангалттай хуучин БАЙХ ба
   сүүлийн сануулгаас хойш дор хаяж энэ хугацаа өнгөрсөн байх. */
const MIN_GAP_MS = 20 * HOUR;

/** Анхдагчаар хөндөх хамгийн хуучин нэхэмжлэх. */
const MAX_AGE_DAYS = 14;

/** Нэг ажиллагаанд илгээх дээд хэмжээ — 2GB droplet ба имэйлийн квот. */
const BATCH = 40;

function fmtMNT(n: number) {
  return `${n.toLocaleString("en-US")}₮`;
}

function copyFor(step: number, tag: string, amount: number) {
  if (step === 0) {
    return {
      title: "Нэхэмжлэх нээлттэй байна",
      message: `${fmtMNT(amount)} — гүйлгээний утгад "${tag}" гэж бичээд шилжүүлнэ. Төлмөгц эрх шууд нээгдэнэ.`,
      subject: "Antaqor — гишүүнчлэл дуусгах",
      lead: "Та гишүүнчлэлээ сонгосон ч төлбөр хараахан ирээгүй байна.",
      cta: "Төлбөрөө дуусгах",
    };
  }
  if (step === 1) {
    return {
      title: "Төлбөр дээр асуудал гарсан уу?",
      message: `${fmtMNT(amount)}-ийн нэхэмжлэх хүлээгдэж байна. QPay-ээр бол нэг товшилтоор шууд идэвхжинэ.`,
      subject: "Antaqor — төлбөр дуусгахад тусалъя",
      lead: "Нэхэмжлэх тань нээлттэй хэвээр байна. Хэрэв банкны шилжүүлэг бэрх бол QPay-ээр нэг товшилтоор төлж болно.",
      cta: "QPay-ээр төлөх",
    };
  }
  return {
    title: "Сүүлийн сануулга",
    message: `${fmtMNT(amount)}-ийн нэхэмжлэх удахгүй хаагдана. Гүйлгээний утга: "${tag}".`,
    subject: "Antaqor — нэхэмжлэх удахгүй хаагдана",
    lead: "Энэ бол сүүлийн сануулга. Нэхэмжлэхээ дуусгах эсэхээ шийдээрэй — дараа нь дахин эхлүүлэх боломжтой.",
    cta: "Төлбөрөө дуусгах",
  };
}

function html(name: string, lead: string, tag: string, amount: number, cta: string) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#141414">
  <div style="font-size:11px;letter-spacing:2px;font-weight:700;color:#1E1E1E;margin-bottom:12px">ANTAQOR</div>
  <h1 style="font-size:22px;line-height:1.3;margin:0 0 16px">${cta}</h1>
  <p style="font-size:15px;line-height:1.6;margin:0 0 20px">Сайн байна уу, ${name}.</p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 24px">${lead}</p>
  <table style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:14px">
    <tr><td style="padding:10px 0;border-bottom:1px solid #E4E1DD;color:#55555C">Дүн</td><td style="padding:10px 0;border-bottom:1px solid #E4E1DD;text-align:right;font-weight:700">${fmtMNT(amount)}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #E4E1DD;color:#55555C">Гүйлгээний утга</td><td style="padding:10px 0;border-bottom:1px solid #E4E1DD;text-align:right;font-weight:700;font-family:ui-monospace,SFMono-Regular,Menlo,monospace">${tag}</td></tr>
  </table>
  <a href="https://antaqor.com/pricing" style="display:inline-block;background:#2E29FF;color:#141414;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:4px">${cta}</a>
  <p style="font-size:12px;line-height:1.6;color:#E2E4E8;margin:28px 0 0">
    Аль хэдийн шилжүүлсэн бол үл тоомсорлоно уу — баталгаажмагц бид өөрсдөө мэдэгдэнэ.
    Асуух зүйл байвал энэ имэйл рүү шууд хариулаарай.
  </p>
</div>`;
}

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.nextUrl.searchParams.get("secret") !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dry = req.nextUrl.searchParams.get("dry") === "1";
  const maxAgeDays = Math.max(
    1,
    Math.min(365, Number(req.nextUrl.searchParams.get("maxAgeDays")) || MAX_AGE_DAYS)
  );

  try {
    await dbConnect();
    const now = new Date();

    /* Хамгийн эрт нь: №1 сануулга хүрэхээр хангалттай хуучин. Хамгийн
       хожуу нь: цонхноос хэтрээгүй. */
    const candidates = await Payment.find({
      status: "pending",
      kind: { $in: ["membership", null] },
      createdAt: {
        $lte: new Date(now.getTime() - LADDER_MS[0]),
        $gte: new Date(now.getTime() - maxAgeDays * DAY),
      },
      $or: [{ remindersSent: { $lt: LADDER_MS.length } }, { remindersSent: { $exists: false } }],
    })
      .sort({ createdAt: -1 })
      .limit(BATCH * 4)
      .lean();

    const sent: { paymentId: string; step: number; user: string }[] = [];
    const skipped = { alreadyMember: 0, tooSoon: 0, noUser: 0 };

    for (const raw of candidates) {
      if (sent.length >= BATCH) break;
      /* `_id`/`user`-ийг `string` гэж зарлав: lean() нь ObjectId буцаана
         ч Mongoose нь шүүлтүүр болон ref дээр мөрийг өөрөө хөрвүүлдэг.
         `unknown` орхивол дуудлага бүр дээр давхар cast хэрэгтэй болно. */
      const p = raw as unknown as {
        _id: string;
        user: string;
        amount: number;
        referenceCode?: string;
        remindersSent?: number;
        lastReminderAt?: Date;
        createdAt: Date;
      };

      const step = Math.max(0, Math.min(LADDER_MS.length, p.remindersSent || 0));
      if (step >= LADDER_MS.length) continue;

      const age = now.getTime() - new Date(p.createdAt).getTime();
      if (age < LADDER_MS[step]) {
        skipped.tooSoon++;
        continue;
      }

      /* Өмнөх сануулгаас хойшхи зай. Эхний сануулга дээр `lastReminderAt`
         байхгүй тул энэ шалгуур нөлөөлөхгүй. */
      if (p.lastReminderAt && now.getTime() - new Date(p.lastReminderAt).getTime() < MIN_GAP_MS) {
        skipped.tooSoon++;
        continue;
      }

      const user = (await User.findById(p.user)
        .select("name email username subscriptionExpiresAt")
        .lean()) as unknown as {
        name?: string;
        email?: string;
        username?: string;
        subscriptionExpiresAt?: Date;
      } | null;

      if (!user) {
        skipped.noUser++;
        continue;
      }

      /* Аль хэдийн гишүүн болсон хүнд "төлбөрөө дуусга" гэж бичих нь
         хамгийн муу алдаа — тэр мөнгөө явуулсан байхад нь шоолж байгаа
         мэт сонсогдоно. Төлбөрийн бичлэг нь хоцрогдсон байж болох тул
         ЖИНХЭНЭ эрхээр шалгана. */
      if (user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > now) {
        skipped.alreadyMember++;
        continue;
      }

      const tag = isRecoverableTag(user.username) ? String(user.username) : String(p.referenceCode || "");
      if (!tag) continue;

      const c = copyFor(step, tag, p.amount);

      if (!dry) {
        await Payment.updateOne(
          { _id: p._id },
          { $set: { remindersSent: step + 1, lastReminderAt: now } }
        );

        Notification.create({
          recipient: p.user,
          type: "payment",
          title: c.title,
          message: c.message,
          link: "/pricing",
          read: false,
        }).catch((e) => console.error("[payment-recovery] notif", e));

        pushToUser(String(p.user), {
          title: c.title,
          body: c.message,
          url: "/pricing",
          tag: `payment-recovery-${String(p._id)}`,
        }).catch(() => {});

        const email = String(user.email || "");
        if (email.includes("@") && !/\.local$|@antaqor\.internal$/i.test(email)) {
          sendEmail({
            to: email,
            subject: c.subject,
            html: html(user.name || "гишүүн", c.lead, tag, p.amount, c.cta),
            text: `${c.lead}\n\nДүн: ${fmtMNT(p.amount)}\nГүйлгээний утга: ${tag}\n\nhttps://antaqor.com/pricing`,
          }).catch((e) => console.error("[payment-recovery] email", e));
        }
      }

      sent.push({ paymentId: String(p._id), step: step + 1, user: String(p.user) });
    }

    return NextResponse.json({
      ok: true,
      dry,
      maxAgeDays,
      considered: candidates.length,
      sent: sent.length,
      breakdown: sent.reduce<Record<string, number>>((a, s) => {
        a[`step${s.step}`] = (a[`step${s.step}`] || 0) + 1;
        return a;
      }, {}),
      skipped,
    });
  } catch (e) {
    console.error("[payment-recovery]", e);
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
