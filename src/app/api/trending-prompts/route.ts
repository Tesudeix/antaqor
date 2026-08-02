import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import TrendingPrompt from "@/models/TrendingPrompt";

export async function GET() {
  try {
    await dbConnect();
    const prompts = await TrendingPrompt.find({ active: true })
      .sort({ order: 1, createdAt: -1 })
      .limit(10)
      .select("label text order")
      .lean();
    return NextResponse.json({ prompts });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
