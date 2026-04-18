import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Announcement from "@/models/Announcement";

// GET — public, returns published announcements
export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

    const announcements = await Announcement.find({ published: true })
      .sort({ pinned: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ announcements });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST — admin only, create announcement
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const body = await req.json();
    const { title, content, image, tag, pinned } = body;

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: "Title and content required" }, { status: 400 });
    }

    const announcement = await Announcement.create({
      title: title.trim(),
      content: content.trim(),
      image: image || "",
      tag: tag || "мэдэгдэл",
      pinned: !!pinned,
      published: true,
    });

    return NextResponse.json({ announcement }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
