import type { Metadata } from "next";
import mongoose from "mongoose";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { isAdminEmail } from "@/lib/adminClient";
import { getLevelTitle } from "@/lib/xpClient";

interface UserShape {
  _id: mongoose.Types.ObjectId;
  name: string;
  email?: string;
  bio?: string;
  level?: number;
  clan?: string;
  clanJoinedAt?: Date;
  subscriptionExpiresAt?: Date;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;

  let user: UserShape | null = null;
  let mintNumber: number | null = null;
  let isConqueror = false;

  try {
    await dbConnect();
    user = (await User.findById(id)
      .select("name email bio level clan clanJoinedAt subscriptionExpiresAt")
      .lean()) as unknown as UserShape | null;

    if (user) {
      const now = new Date();
      const isPaid = !!(user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) > now);
      const inClan = !!(user.clan && user.clan.length > 0);
      isConqueror = isPaid && inClan;

      if (isConqueror) {
        const earlier = await User.countDocuments({
          clan: { $ne: "" },
          subscriptionExpiresAt: { $gt: now },
          $or: [
            { clanJoinedAt: { $lt: user.clanJoinedAt } },
            { clanJoinedAt: user.clanJoinedAt, _id: { $lt: user._id } },
          ],
        });
        mintNumber = earlier + 1;
      }
    }
  } catch {
    // fall through to generic metadata
  }

  if (!user) {
    return {
      title: "Profile not found · ANTAQOR",
      description: "Энэ профайл олдсонгүй.",
    };
  }

  const founder = isAdminEmail(user.email);
  const level = user.level || 1;
  const t = getLevelTitle(level);

  if (isConqueror && mintNumber !== null) {
    const mintStr = `#${String(mintNumber).padStart(3, "0")}`;
    const role = founder ? "FOUNDER" : t.titleEN.toUpperCase();
    const title = `${user.name} · ${mintStr} CONQUEROR · ANTAQOR`;
    const description =
      user.bio?.trim() ||
      `${mintStr} of 100 — ${role}, LV.${level} ${t.titleMN}. Antaqor хүрээлэлийн байлдан дагуулагч.`;
    return {
      title,
      description: description.slice(0, 200),
      openGraph: {
        title,
        description: description.slice(0, 200),
        type: "profile",
        siteName: "ANTAQOR",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description: description.slice(0, 200),
      },
    };
  }

  // Civilian fallback
  const title = `${user.name} · ANTAQOR`;
  const description =
    user.bio?.trim() ||
    `LV.${level} ${t.titleMN} — Antaqor хүрээлэлд нэгдэхээр бэлдэж байна.`;
  return {
    title,
    description: description.slice(0, 200),
    openGraph: {
      title,
      description: description.slice(0, 200),
      type: "profile",
      siteName: "ANTAQOR",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: description.slice(0, 200),
    },
  };
}

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
