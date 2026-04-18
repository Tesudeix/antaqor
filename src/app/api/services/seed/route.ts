import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Service from "@/models/Service";

const SEED_DATA = [
  {
    name: "Joy Billiard",
    slug: "joybilliard",
    description: "Биллиард, караоке, VIP өрөө захиалга. Улаанбаатарын шилдэг entertainment center.",
    logo: "",
    coverImage: "",
    category: "Зугаа цэнгэл",
    url: "https://joybilliard.mn",
    domain: "joybilliard.mn",
    status: "active",
    featured: true,
    order: 1,
    tags: ["billiard", "karaoke", "vip", "entertainment"],
    stats: { users: 0, rating: 4.8 },
  },
  {
    name: "Antaqor Academy",
    slug: "academy",
    description: "AI, програмчлал, дижитал бизнесийн онлайн сургалтын платформ.",
    logo: "",
    coverImage: "",
    category: "Боловсрол",
    url: "https://antaqor.com/classroom",
    domain: "antaqor.com",
    status: "active",
    featured: true,
    order: 2,
    tags: ["ai", "education", "coding", "business"],
    stats: { users: 0, rating: 4.9 },
  },
  {
    name: "Antaqor Chat",
    slug: "chat",
    description: "Гишүүдийн хоорондын шууд мессеж, групп чат.",
    logo: "",
    coverImage: "",
    category: "Технологи",
    url: "https://antaqor.com/chat",
    domain: "antaqor.com",
    status: "active",
    featured: false,
    order: 4,
    tags: ["messaging", "chat", "community"],
    stats: { users: 0 },
  },
  {
    name: "AI Tools Hub",
    slug: "ai-tools",
    description: "AI хэрэгслүүдийн цуглуулга. Prompt library, automation templates.",
    logo: "",
    coverImage: "",
    category: "AI & Automation",
    url: "#",
    domain: "",
    status: "coming_soon",
    featured: false,
    order: 5,
    tags: ["ai", "tools", "automation", "prompts"],
    stats: {},
  },
  {
    name: "Freelancer Market",
    slug: "freelance",
    description: "Гишүүдийн freelance ажил олох, захиалга авах marketplace.",
    logo: "",
    coverImage: "",
    category: "Бизнес",
    url: "#",
    domain: "",
    status: "coming_soon",
    featured: false,
    order: 6,
    tags: ["freelance", "marketplace", "jobs"],
    stats: {},
  },
];

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();

    let created = 0;
    for (const data of SEED_DATA) {
      const exists = await Service.findOne({ slug: data.slug });
      if (!exists) {
        await Service.create(data);
        created++;
      }
    }

    return NextResponse.json({ message: `Seeded ${created} services`, total: SEED_DATA.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
