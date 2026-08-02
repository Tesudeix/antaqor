import dbConnect from "@/lib/mongodb";
import Notification from "@/models/Notification";
import User from "@/models/User";
import { sendPushBroadcast } from "@/lib/push-server";

export async function broadcastNotification({
  type,
  title,
  message,
  link,
  excludeUserId,
}: {
  type: "new_post" | "new_course" | "new_lesson" | "system";
  title: string;
  message: string;
  link: string;
  excludeUserId?: string;
}) {
  await dbConnect();

  const query: Record<string, unknown> = {};
  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }

  const users = await User.find(query).select("_id").lean();

  if (users.length === 0) return;

  const notifications = users.map((user) => ({
    recipient: user._id,
    type,
    title,
    message,
    link,
    read: false,
  }));

  await Notification.insertMany(notifications);

  // Fire-and-forget push. Each subscribed device gets a system notification
  // matching the in-app DB record. Don't await — DB is source of truth and
  // shouldn't block on push transport.
  sendPushBroadcast(
    { title, body: message, url: link, tag: type },
    excludeUserId
  ).catch((e) => console.error("[notifications] push broadcast failed:", e));
}
