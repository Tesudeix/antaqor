import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { isAdmin } from "@/lib/admin";
import type { PlanId } from "@/lib/plans";

// ─── Server-side effective plan of the current viewer ───
// Paid tier counts only while the subscription is active; admins get operator.
export async function effectivePlan(): Promise<{ plan: PlanId; userId: string | null }> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return { plan: "free", userId: null };
  const userId = (session.user as { id?: string }).id || null;
  if (isAdmin(session.user.email)) return { plan: "operator", userId };
  if (!userId) return { plan: "free", userId: null };
  await dbConnect();
  const u = await User.findById(userId).select("plan subscriptionExpiresAt role").lean();
  const uu = u as unknown as { plan?: PlanId; subscriptionExpiresAt?: Date; role?: string } | null;
  if (uu?.role === "admin") return { plan: "operator", userId };
  if (uu?.subscriptionExpiresAt && new Date(uu.subscriptionExpiresAt) > new Date()) {
    return { plan: uu.plan || "starter", userId };
  }
  return { plan: "free", userId };
}
