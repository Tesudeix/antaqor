import dbConnect from "@/lib/mongodb";
import Notification from "@/models/Notification";
import User from "@/models/User";
import { sendPushBroadcast } from "@/lib/push-server";
import { Types } from "mongoose";

/* ─── Мэдэгдэл — хэнд, хэзээ, хэдийг ──────────────────────────────────────

   ХЭМЖСЭН БАЙДАЛ 2026-08-25, засварын өмнө:

     нийт мэдэгдэл ................ 37,494
     уншаагүй ..................... 34,773  (93%)
     УСТСАН контент руу заасан .... 34,614  (92%)
     нэг хүнд ноогдох дээд .......... 194
     төрөл: new_post 27,907 · new_course 9,541 · system 29

   Өөрөөр хэлбэл хонх нь тав оронтой тоо харуулж, доторх холбоосын 92% нь
   404 руу хөтөлдөг байв. Тийм хонх бол мэдээлэл биш, дуу чимээ — хүн
   түүнийг харахаа болино, тэгээд ЖИНХЭНЭ мэдэгдэл (төлбөр баталгаажсан,
   гишүүнчлэл дуусах гэж байна) хамт живнэ.

   Гурван шалтгаан байсан бөгөөд гурвуулаа энд засагдана:

   1) ТАРААЛТ ХЯЗГААРГҮЙ. Пост бүр 651 мөр үүсгэдэг байсан — идэвхгүй,
      хэзээ ч нэвтэрдэггүй хүн ч гэсэн. Одоо: сүүлийн `ACTIVE_DAYS`-д
      идэвх үзүүлсэн хүн ба тохиргоогоороо зөвшөөрсөн хүн л авна.

   2) ДАВХАРДАЛ. Ижил төрлийн уншаагүй мэдэгдэл аль хэдийн байхад
      дахиад нэмдэг байв. Одоо: хүн уншаагүй байгаа бол дахиж овоолохгүй.

   3) ЦЭВЭРЛЭГЭЭ БАЙХГҮЙ. Юу ч устдаггүй байсан. Одоо
      `/api/cron/notifications-prune` хариуцна.                          */

export type NotificationType =
  | "new_post"
  | "new_course"
  | "new_lesson"
  | "system"
  | "payment";

/** Хүн өөрөө унтраах боломжтой төрлүүд. `payment` ба `system` энд БАЙХГҮЙ
 *  — төлбөр, эрхийн мэдэгдлийг унтраах нь хүнд өөрт нь хор хөнөөлтэй. */
export const OPTIONAL_TYPES = ["new_post", "new_course", "new_lesson"] as const;

/** Идэвхгүй болсонд тооцох хугацаа. Энэ хүмүүс мэдэгдлээ ХЭЗЭЭ Ч
 *  уншихгүй; тэдэнд бичих нь зөвхөн коллекцийг л томруулна. */
const ACTIVE_DAYS = 120;

/** Нэг тараалтад хамрах дээд хэмжээ — 2GB droplet дээрх insertMany. */
const FANOUT_CAP = 5000;

const PREF_KEY: Record<string, string> = {
  new_post: "newPosts",
  new_course: "newCourses",
  new_lesson: "newCourses",
};

/**
 * Бүх ТОХИРОХ хэрэглэгчид нэг мэдэгдэл. "Бүх" гэдэг нь бүртгэлтэй бүх хүн
 * гэсэн үг БИШ — идэвхтэй бөгөөд татгалзаагүй хүмүүс.
 */
export async function broadcastNotification({
  type,
  title,
  message,
  link,
  excludeUserId,
}: {
  type: NotificationType;
  title: string;
  message: string;
  link: string;
  excludeUserId?: string;
}) {
  await dbConnect();

  const query: Record<string, unknown> = {};
  if (excludeUserId) query._id = { $ne: excludeUserId };

  /* Идэвхийн шүүлтүүр. `updatedAt` нь нэвтрэх, XP авах, профайл засах
     бүрд шинэчлэгддэг тул "хамгийн сүүлд амьд байсан" гэдгийн хамгийн
     хямд ойролцоолол. Төлбөртэй гишүүнийг ХЭЗЭЭ Ч хасахгүй — тэд
     мөнгө төлсөн, мэдэгдэл нь тэдний эрхийн нэг хэсэг. */
  const cutoff = new Date(Date.now() - ACTIVE_DAYS * 24 * 60 * 60 * 1000);
  query.$or = [
    { updatedAt: { $gte: cutoff } },
    { subscriptionExpiresAt: { $gt: new Date() } },
  ];

  // Татгалзсан хүнийг хасна. Талбар байхгүй = зөвшөөрсөн (хуучин бүртгэл).
  const prefKey = PREF_KEY[type];
  if (prefKey) query[`notificationPrefs.${prefKey}`] = { $ne: false };

  const users = await User.find(query).select("_id").limit(FANOUT_CAP).lean();
  if (users.length === 0) return;

  /* ДАВХАРДЛЫГ ЗОГСООХ. Нэг хүн ижил төрлийн уншаагүй мэдэгдэлтэй байвал
     дахиад нэмэхгүй — тэр хүн эхнийхийг нь ч хараагүй байхад хоёр дахийг
     нэмэх нь зөвхөн тоог л өсгөнө. Пост бичдэг хүн олон байхад энэ нь
     194 мөрийг 1 болгож хумидаг гол механизм. */
  const already = await Notification.distinct("recipient", {
    recipient: { $in: users.map((u) => u._id) },
    type,
    read: false,
  });
  const skip = new Set(already.map((x) => String(x)));

  const targets = users.filter((u) => !skip.has(String(u._id)));
  if (targets.length === 0) return;

  await Notification.insertMany(
    targets.map((user) => ({
      recipient: user._id,
      type,
      title,
      message,
      link,
      read: false,
    })),
    { ordered: false }
  );

  /* Push нь DB-ээс хамаарахгүй, хүлээхгүй. Гэхдээ түүнийг ЗӨВХӨН
     жинхэнэ хүлээн авагч байвал явуулна. */
  sendPushBroadcast({ title, body: message, url: link, tag: type }, excludeUserId).catch((e) =>
    console.error("[notifications] push broadcast failed:", e)
  );
}

/**
 * Нэг хүнд нэг мэдэгдэл. `payment` / `system` энэ замаар явна — тараалтын
 * шүүлтүүр хамаарахгүй, учир нь эдгээр нь тухайн хүний ӨӨРИЙНХ нь хэрэг.
 */
export async function notifyUser(opts: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}) {
  await dbConnect();
  await Notification.create({
    recipient: opts.userId,
    type: opts.type,
    title: opts.title,
    message: opts.message,
    link: opts.link || "/",
    read: false,
  });
}

/**
 * Контент устахад түүн рүү заасан мэдэгдлийг ХАМТ устгана.
 *
 * Үүнгүй бол мэдэгдэл нь устсан зүйл рүү мөнхөд заасаар байна: хэмжсэн
 * үед 37,494 мэдэгдлийн 34,614 нь яг ийм байсан. Хүн хонхоо нээгээд
 * дарахад 404 гарвал хонх нь эвдэрсэн гэж ойлгоно — тэгээд зөв байсан.
 */
export async function purgeNotificationsFor(link: string) {
  if (!link) return;
  try {
    await dbConnect();
    await Notification.deleteMany({ link });
  } catch (e) {
    console.error("[notifications] purge failed", e);
  }
}

/** Нэг хэрэглэгчийн уншаагүй тоо, төрлөөр нь. Хонх, /notifications хоёулаа. */
export async function unreadByType(userId: string): Promise<Record<string, number>> {
  await dbConnect();
  const rows = await Notification.aggregate([
    { $match: { recipient: new Types.ObjectId(userId), read: false } },
    { $group: { _id: "$type", n: { $sum: 1 } } },
  ]);
  const out: Record<string, number> = {};
  for (const r of rows as { _id: string; n: number }[]) out[r._id] = r.n;
  return out;
}
