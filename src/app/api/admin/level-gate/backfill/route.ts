import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import Post from "@/models/Post";
import User from "@/models/User";

// POST — stamp authorLevel on every post using the author's current level.
// Safe to re-run; idempotent when user levels haven't changed.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();

  // Pull all users' current levels
  const users = await User.find({}).select("_id level").lean();
  const levelMap = new Map<string, number>();
  for (const u of users as unknown as { _id: { toString(): string }; level?: number }[]) {
    levelMap.set(u._id.toString(), u.level || 1);
  }

  // Iterate posts in batches and bulk-write
  const batchSize = 500;
  let processed = 0;
  let updated = 0;
  let cursor = 0;

  while (true) {
    const batch = await Post.find({})
      .select("_id author authorLevel")
      .skip(cursor)
      .limit(batchSize)
      .lean();
    if (batch.length === 0) break;

    const ops: { updateOne: { filter: { _id: Types.ObjectId }; update: { $set: { authorLevel: number } } } }[] = [];
    for (const p of batch as unknown as { _id: Types.ObjectId; author: { toString(): string }; authorLevel?: number }[]) {
      const lvl = levelMap.get(p.author.toString()) || 1;
      if (p.authorLevel !== lvl) {
        ops.push({
          updateOne: {
            filter: { _id: p._id },
            update: { $set: { authorLevel: lvl } },
          },
        });
      }
    }

    if (ops.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const res = await Post.bulkWrite(ops as any);
      updated += res.modifiedCount || 0;
    }

    processed += batch.length;
    cursor += batchSize;
    if (batch.length < batchSize) break;
  }

  return NextResponse.json({ ok: true, processed, updated });
}

export const dynamic = "force-dynamic";
