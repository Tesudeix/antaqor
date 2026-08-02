import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Agent from "@/models/Agent";

const DEFAULT_AGENTS = [
  {
    slug: "antaqor",
    name: "Antaqor",
    description: "Антрепренёр",
    avatar: "/antaqor.png",
    cover: "",
    href: "/companion",
    order: 0,
  },
];

async function ensureDefaults() {
  for (const a of DEFAULT_AGENTS) {
    await Agent.updateOne(
      { slug: a.slug },
      { $setOnInsert: a },
      { upsert: true }
    );
  }
}

export async function GET() {
  try {
    await dbConnect();
    await ensureDefaults();
    const agents = await Agent.find({ slug: { $ne: "budjargal" } }).sort({ order: 1 }).lean();
    return NextResponse.json({ agents });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load agents";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
