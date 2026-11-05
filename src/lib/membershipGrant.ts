import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import Payment from "@/models/Payment";
import Notification from "@/models/Notification";
import { pushToUser } from "@/lib/push";
import { sendEmail } from "@/lib/email";
import { awardCredits, maybeAwardReferralPayment } from "@/lib/credits";
import CreditTx from "@/models/CreditTx";
import { getEcon } from "@/lib/creditEconomicsServer";

/* ─── Гишүүнчлэл нээх — ГАНЦ хэрэгжүүлэлт ─────────────────────────────────

   Өмнө нь эрх нээх ХОЁР зам байсан бөгөөд хоёулаа өөр өөр зүйл хийдэг байв:

     /api/admin/payments/[id]/approve  → төлбөрийг paid болгоно, plan тавина,
                                          push илгээнэ
     /api/admin/members/[id] (grant)   → ЗӨВХӨН subscriptionExpiresAt тавина

   Хоёр дахь зам нь бодит байдал дээр илүү их хэрэглэгдсэн: өнөөдөр идэвхтэй
   50 гишүүний 46-гийн төлбөр `pending` хэвээр өлгөөтэй байна. Үр дагавар нь
   зөвхөн эмх замбараагүй тайлан биш:

     · Хүн мөнгөө явуулсан ч "баталгаажлаа" гэсэн ямар ч мэдэгдэл аваагүй.
     · Сэргээх сануулга (payment-recovery cron) нь тэднийг "төлөөгүй" гэж
       үзээд дахин дахин мөшгих байсан — өөрөөр хэлбэл ТӨЛСӨН хүнд "төлбөрөө
       дуусгана уу" гэж бичих.
     · `plan` талбар тавигдаагүй тул PLAN_RANK-аар хаалттай контент нь
       төлсөн хүнд ч хаалттай хэвээр үлдэнэ.

   Тиймээс эрх нээх үйлдэл ЭНД, нэг л газар амьдарна. Аль ч дуудагч дуудсан
   бай — үр дүн нь адилхан бүрэн байна: эрх, шат, төлбөрийн бичлэг, хүнд
   очих мэдэгдэл. Хагас нээх боломж байхгүй болов.                        */

export type GrantSource =
  | "admin-approve"   // админ төлбөрийг баталсан
  | "admin-grant"     // админ гараар эрх олгосон (жагсаалтаас)
  | "admin-extend"    // сунгасан
  | "wire"            // Wire/QPay-ийн шууд төлөлт
  | "auto-match";     // банкны хуулга автоматаар таарсан

export interface GrantResult {
  expiresAt: Date;
  plan: string;
  /** Хаагдсан pending төлбөрийн id — байхгүй бол null. */
  closedPaymentId: string | null;
  days: number;
}

const PLAN_LABEL: Record<string, string> = {
  starter: "AI Creator",
  builder: "AI Engineer",
  operator: "AI Entrepreneur",
  founding: "Founding 100",
};

function fmtDate(d: Date) {
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

/** Имэйлийн их бие. Гадна CSS байхгүй — имэйл клиентүүд түүнийг хаядаг. */
function confirmHtml(name: string, planName: string, expiresAt: Date) {
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#141414">
  <div style="font-size:11px;letter-spacing:2px;font-weight:700;color:#1E1E1E;margin-bottom:12px">ANTAQOR</div>
  <h1 style="font-size:22px;line-height:1.3;margin:0 0 16px">Төлбөр баталгаажлаа ✓</h1>
  <p style="font-size:15px;line-height:1.6;margin:0 0 20px">Сайн байна уу, ${name}.</p>
  <p style="font-size:15px;line-height:1.6;margin:0 0 20px">
    Таны <b>${planName}</b> гишүүнчлэл идэвхжлээ. Хаалттай контент, гишүүдийн
    орчин бүгд нээгдсэн.
  </p>
  <table style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:14px">
    <tr><td style="padding:10px 0;border-bottom:1px solid #E4E1DD;color:#55555C">Багц</td><td style="padding:10px 0;border-bottom:1px solid #E4E1DD;text-align:right;font-weight:700">${planName}</td></tr>
    <tr><td style="padding:10px 0;border-bottom:1px solid #E4E1DD;color:#55555C">Дуусах огноо</td><td style="padding:10px 0;border-bottom:1px solid #E4E1DD;text-align:right;font-weight:700">${fmtDate(expiresAt)}</td></tr>
  </table>
  <a href="https://antaqor.com/" style="display:inline-block;background:#2E29FF;color:#141414;text-decoration:none;font-weight:700;font-size:14px;padding:14px 28px;border-radius:4px">Орох</a>
  <p style="font-size:12px;line-height:1.6;color:#E2E4E8;margin:28px 0 0">
    Асуух зүйл байвал энэ имэйл рүү шууд хариулаарай.
  </p>
</div>`;
}

/**
 * Эрх нээх / сунгах. Дуудагч нь `plan`-аа мэдэж байвал өгнө; эс бөгөөс
 * хаагдсан төлбөрөөс, тэр ч байхгүй бол одоогийн шатнаас (эсвэл starter)
 * тодорхойлно.
 *
 * Мэдэгдэл илгээх нь ЗААВАЛ БИШ (`notify: false`) — авто-тааруулагч нэг
 * дор 20 төлбөр батлахад 20 имэйл явуулах нь зөв ч, дуудагч өөрөө багцлан
 * илгээхийг хүсвэл боломж үлдээв.
 */
export async function activateMembership(opts: {
  userId: string;
  days: number;
  plan?: string;
  /** Энэ грант ЯМАР төлбөрөөс үүдэлтэй вэ. Өгвөл түүнийг хаана. */
  paymentId?: string;
  source: GrantSource;
  notify?: boolean;
}): Promise<GrantResult | null> {
  await dbConnect();

  const user = await User.findById(opts.userId);
  if (!user) return null;

  const now = new Date();
  const days = Math.max(1, Math.min(3650, Math.trunc(opts.days) || 30));

  /* Идэвхтэй гишүүнчлэл дээр нэмнэ — дарж бичихгүй. Хугацаа нь дуусчихсан
     бол өнөөдрөөс. Энэ нь хоёр дуудагчийн аль алинд нь адил байх ёстой
     дүрэм байсан бөгөөд өмнө нь хоёр тусдаа хуулбараар бичигдсэн байв. */
  const base =
    user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > now
      ? new Date(user.subscriptionExpiresAt)
      : now;
  const expiresAt = new Date(base);
  expiresAt.setDate(expiresAt.getDate() + days);

  /* ─── Аль pending төлбөрийг хаах вэ ───────────────────────────────────
     Тодорхой заасан бол түүнийг. Үгүй бол тухайн хэрэглэгчийн ХАМГИЙН
     СҮҮЛИЙН pending гишүүнчлэлийн төлбөр — админ гараар эрх нээж байгаа
     нь бараг үргэлж "энэ хүн мөнгөө явуулсан" гэсэн үг бөгөөд тэр мөнгө
     нь тэр нэхэмжлэхийнх юм. Хаахгүй орхивол сэргээх сануулга нь ТӨЛСӨН
     хүн рүү "төлбөрөө дуусгана уу" гэж бичнэ. */
  let closed: { _id: unknown; plan?: string } | null = null;
  if (opts.paymentId) {
    closed = await Payment.findById(opts.paymentId);
  } else {
    closed = await Payment.findOne({
      user: user._id,
      status: "pending",
      kind: { $in: ["membership", null] },
    }).sort({ createdAt: -1 });
  }

  /* `User.plan`-ийн enum нь ["free","starter","builder","operator"] —
     "founding" ТЭНД БАЙХГҮЙ. Founding төлбөрийг батлахад тэр утгыг шууд
     тавивал `user.save()` нь validation алдаа өгч, эрх нээгдэхгүй атал
     төлбөр нь аль хэдийн `paid` болчихсон байна: хамгийн муу хагас
     төлөв. PLAN_RANK дээр founding = 3 = operator тул тэр шат руу буулгав. */
  const rawPlan =
    opts.plan ||
    (closed?.plan && closed.plan !== "" ? closed.plan : "") ||
    (user.plan && user.plan !== "free" ? user.plan : "") ||
    "starter";
  const ALLOWED = ["starter", "builder", "operator"];
  const plan = rawPlan === "founding" ? "operator" : ALLOWED.includes(rawPlan) ? rawPlan : "starter";

  user.subscriptionExpiresAt = expiresAt;
  user.plan = plan as typeof user.plan;
  if (!user.clan) user.clan = "antaqor";
  if (!user.clanJoinedAt) user.clanJoinedAt = now;

  /* ─── ДАРААЛАЛ НЬ ЧУХАЛ: ЭХЛЭЭД ЭРХ, ДАРАА НЬ ТӨЛБӨР ───────────────────
     Өмнө нь энэ функц төлбөрийг ЭХЛЭЭД `paid` болгодог байсан. Тест яг тэр
     эрсдэлийг барив: `user.save()` унахад төлбөр нь аль хэдийн "төлөгдсөн"
     гэж тэмдэглэгдсэн атал хэрэглэгч юу ч аваагүй үлдэнэ — мөнгө нь
     хаагдсан, эрх нь нээгдээгүй. Хамгийн муу хагас төлөв, хэн ч анзаарахгүй.
     Одоо эрх нээгдэж ЧАДСАН тохиолдолд л төлбөр хаагдана.

     `validateModifiedOnly` нь өөр нэг бодит эрсдэлийг хаана: 650 бүртгэлийн
     дунд хуучин, схемийн шинэ дүрмийг давахгүй баримт (богино нууц үг,
     дутуу дэд талбар) байдаг. Тэднийг бүтнээр нь шалгавал ХОЛБОГДОХГҮЙ
     талбарын улмаас төлбөрөө төлсөн хүний эрх нээгдэхгүй болно. Бид энд
     зөвхөн гишүүнчлэлийн талбаруудыг өөрчилж байгаа тул зөвхөн тэднийг
     шалгах нь зөв. */
  await user.save({ validateModifiedOnly: true });

  if (closed) {
    await Payment.updateOne(
      { _id: String((closed as { _id: unknown })._id), status: { $ne: "paid" } },
      {
        $set: {
          status: "paid",
          paidAt: now,
          adminNote: `Closed by ${opts.source}`,
        },
      }
    );
  }

  maybeAwardReferralPayment(String(user._id)).catch(() => {});

  /* ─── Гишүүнчлэлийн бэлэг кредит (2026-10-26) ─────────────────────────
     Төлбөрөөс үүдсэн грант дээр л (хаасан Payment байх ёстой), НЭГ төлбөрт НЭГ
     удаа (CreditTx ref = paymentId). 30 хоног тутамд /admin/economics-ийн
     `starter[plan]` кредит — 1 кр = 1₮, AI Studio-д зарцуулна. */
  if (closed) {
    const pid = String((closed as { _id: unknown })._id);
    try {
      const e = await getEcon();
      const months = Math.max(1, Math.round(days / 30));
      const gift = (e.starter[plan as "starter" | "builder" | "operator"] || 0) * months;
      if (gift > 0 && !(await CreditTx.exists({ user: user._id, reason: "MEMBERSHIP_BONUS", ref: pid }))) {
        await awardCredits({ userId: String(user._id), reason: "MEMBERSHIP_BONUS", credits: gift, ref: pid, meta: { plan, days } });
        pushToUser(String(user._id), { title: `+${gift.toLocaleString("en-US")} кредит бэлэг`, body: "AI Studio-д зураг, AI ихэр бүтээхэд ашиглаарай (1 кр = 1₮).", url: "/content-agent", tag: `gift-${pid}` }).catch(() => {});
      }
    } catch (err) {
      console.error("[grant] membership credit gift failed", err);
    }
  }

  if (opts.notify !== false) {
    const planName = PLAN_LABEL[plan] || plan;
    const title = "Төлбөр баталгаажлаа ✓";
    const message = `${planName} гишүүнчлэл идэвхжлээ. ${fmtDate(expiresAt)} хүртэл хүчинтэй.`;

    /* Гурван суваг: аппын дотор, төхөөрөмж рүү, имэйл. Аль нэг нь унасан ч
       нөгөө хоёр нь очно. Аль нь ч ГОЛ сувгийг блоклохгүй — эрх аль хэдийн
       нээгдсэн, мэдэгдэл нь түүнийг цуцлах шалтгаан биш. */
    Notification.create({
      recipient: user._id,
      type: "payment",
      title,
      message,
      link: "/",
      read: false,
    }).catch((e) => console.error("[grant] notification failed", e));

    pushToUser(String(user._id), {
      title,
      body: message,
      url: "/",
      tag: `membership-activated-${String(user._id)}`,
    }).catch(() => {});

    /* Имэйл нь ЖИНХЭНЭ хаягтай хүнд л. username-ээс үүссэн дотоод хаяг
       (@antaqor.local гэх мэт) руу илгээвэл bounce болж Resend-ийн
       нэр хүнд унана. */
    const email = String(user.email || "");
    if (email.includes("@") && !/\.local$|@antaqor\.internal$/i.test(email)) {
      sendEmail({
        to: email,
        subject: "Antaqor — төлбөр баталгаажлаа",
        html: confirmHtml(user.name || "гишүүн", planName, expiresAt),
        text: `${planName} гишүүнчлэл идэвхжлээ. ${fmtDate(expiresAt)} хүртэл хүчинтэй. https://antaqor.com/`,
      }).catch((e) => console.error("[grant] email failed", e));
    }
  }

  return {
    expiresAt,
    plan,
    closedPaymentId: closed ? String((closed as { _id: unknown })._id) : null,
    days,
  };
}
