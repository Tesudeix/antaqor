import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import NewsComment from "@/models/NewsComment";

// DELETE — comment author or admin
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await dbConnect();
    const { id } = await params;
    const comment = await NewsComment.findById(id);
    if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const userId = (session.user as { id: string }).id;
    const ownerId = comment.author.toString();
    if (ownerId !== userId && !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await comment.deleteOne();
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
