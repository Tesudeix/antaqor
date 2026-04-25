import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import LandingCard, { LANDING_CARD_ICONS } from "@/models/LandingCard";

const DEFAULTS = [
  {
    title: "AI Сургалт",
    description: "Промпт инженеринг, автоматжуулалт, AI бизнес",
    icon: "ai",
    order: 0,
  },
  {
    title: "Орлого олох",
    description: "Дижитал бүтээгдэхүүн, freelance, AI tool бизнес",
    icon: "money",
    order: 1,
  },
  {
    title: "Community",
    description: "Бүтээгчдийн нийгэмлэг, хамтын ажиллагаа",
    icon: "community",
    order: 2,
  },
];

// GET — public, returns enabled cards in order. Auto-seeds defaults on first call.
export async function GET() {
  try {
    await dbConnect();

    // Seed once if collection is empty so the homepage never goes blank.
    const total = await LandingCard.estimatedDocumentCount();
    if (total === 0) {
      await LandingCard.insertMany(DEFAULTS).catch(() => {});
    }

    const cards = await LandingCard.find({ enabled: true })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    return NextResponse.json({ cards });
  } catch {
    return NextResponse.json({ cards: [] }, { status: 200 });
  }
}

// POST — admin only, create card
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const body = await req.json();
    const { title, description, icon, order, enabled, ctaLabel, ctaHref } = body;

    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json({ error: "Title and description required" }, { status: 400 });
    }
    if (icon && !LANDING_CARD_ICONS.includes(icon)) {
      return NextResponse.json({ error: "Invalid icon" }, { status: 400 });
    }

    const last = await LandingCard.findOne().sort({ order: -1 }).select("order").lean();
    const nextOrder = typeof order === "number" ? order : ((last?.order ?? -1) + 1);

    const card = await LandingCard.create({
      title: title.trim(),
      description: description.trim(),
      icon: icon || "ai",
      order: nextOrder,
      enabled: enabled !== false,
      ctaLabel: (ctaLabel || "").trim(),
      ctaHref: (ctaHref || "").trim(),
    });

    return NextResponse.json({ card }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
