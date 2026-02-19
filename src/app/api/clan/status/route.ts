import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ isMember: false });
    }

    const userId = (session.user as { id: string }).id;
    await dbConnect();

    const user = await User.findById(userId).select("clan clanJoinedAt");
    
    return NextResponse.json({
      isMember: !!user?.clan,
      clan: user?.clan || null,
      joinedAt: user?.clanJoinedAt || null,
    });
  } catch {
    return NextResponse.json({ isMember: false });
  }
}
