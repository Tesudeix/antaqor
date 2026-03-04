import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Story from "@/models/Story";

export async function GET() {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const stories = await Story.find().sort({ date: -1 }).lean();
    return NextResponse.json({ stories });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await dbConnect();
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { title, content, image, date, category } = await req.json();
    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: "Title and content required" }, { status: 400 });
    }
    const story = await Story.create({
      title: title.trim(),
      content: content.trim(),
      image: image || "",
      date: date || new Date(),
      category: category?.trim() || "",
    });
    return NextResponse.json({ story }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
