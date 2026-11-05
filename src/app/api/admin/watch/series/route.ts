import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, unauthorized } from "@/lib/adminAuth";
import dbConnect from "@/lib/mongodb";
import Series from "@/models/Series";
import Episode from "@/models/Episode";

export const dynamic = "force-dynamic";

/** Нэрээс slug — кирилл үсгийг латинаар галиглана. */
function slugify(s: string): string {
  const MAP: Record<string, string> = {
    а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"yo",ж:"j",з:"z",и:"i",й:"i",к:"k",л:"l",
    м:"m",н:"n",о:"o",ө:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ү:"u",ф:"f",х:"h",ц:"ts",
    ч:"ch",ш:"sh",щ:"sh",ъ:"",ы:"y",ь:"",э:"e",ю:"yu",я:"ya",
  };
  return (s || "")
    .toLowerCase()
    .split("")
    .map((ch) => (ch in MAP ? MAP[ch] : ch))
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "series";
}

// GET — бүх цуврал, ангийн тоотой нь
export async function GET() {
  if (!(await getAdminSession())) return unauthorized();
  try {
    await dbConnect();
    const series = await Series.find({}).sort({ featuredRank: -1, createdAt: -1 }).lean();
    return NextResponse.json({ series });
  } catch (e) {
    console.error("[admin/watch/series] list", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// POST — шинэ цуврал
export async function POST(req: NextRequest) {
  if (!(await getAdminSession())) return unauthorized();
  try {
    const body = await req.json().catch(() => ({}));
    const title = String(body?.title || "").trim();
    if (!title) return NextResponse.json({ error: "title_required" }, { status: 400 });

    await dbConnect();

    /* Slug давхцвал ард нь тоо залгана. Админд алдаа шидэхийн оронд
       ажиллаж өгөх нь дээр — нэр давхцах нь бодит тохиолдол. */
    const base = slugify(body?.slug || title);
    let slug = base;
    for (let i = 2; await Series.exists({ slug }); i++) slug = `${base}-${i}`;

    const created = await Series.create({
      title,
      slug,
      synopsis: String(body?.synopsis || "").trim(),
      genres: Array.isArray(body?.genres) ? body.genres.slice(0, 6).map(String) : [],
      year: Number(body?.year) || new Date().getFullYear(),
      poster: String(body?.poster || ""),
      still: String(body?.still || ""),
      freeEpisodes: Number.isFinite(Number(body?.freeEpisodes)) ? Number(body.freeEpisodes) : 14,
      passPriceCoins: Number.isFinite(Number(body?.passPriceCoins)) ? Number(body.passPriceCoins) : 400,
      published: Boolean(body?.published),
    });
    return NextResponse.json({ series: created });
  } catch (e) {
    console.error("[admin/watch/series] create", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
