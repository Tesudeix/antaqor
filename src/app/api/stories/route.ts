import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Story from "@/models/Story";

export async function GET() {
  try {
    await dbConnect();
    const stories = await Story.find({ published: true })
      .sort({ createdAt: -1 })
      .lean();
    return NextResponse.json({ stories });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
