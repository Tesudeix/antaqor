import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import MetaConversation from "@/models/MetaConversation";
import User from "@/models/User";
import LeadsBoard, { type LeanConv } from "./LeadsBoard";

export const dynamic = "force-dynamic";

export default async function MetaLeadsPage() {
  const session = await getAdminSession();
  if (!session) redirect("/login");

  await dbConnect();
  // Touch User model so the populate ref is registered.
  void User;

  const convsRaw = await MetaConversation.find({})
    .sort({ intentScore: -1, lastMessageAt: -1 })
    .limit(200)
    .populate(
      "linkedUserId",
      "name username email credits subscriptionExpiresAt level xp streakDays role"
    )
    .lean();

  const convs = JSON.parse(JSON.stringify(convsRaw)) as LeanConv[];

  return <LeadsBoard initialConvs={convs} />;
}
