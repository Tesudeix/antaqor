import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Types } from "mongoose";
import dbConnect from "@/lib/mongodb";
import PromptItem, { PROMPT_CATEGORIES } from "@/models/PromptItem";
import { rateLimit, LIMITS } from "@/lib/rateLimit";
import { moderateText } from "@/lib/moderation";
import PromptOwnership from "@/models/PromptOwnership";
import { accessState } from "@/lib/membership";

const VALID = new Set(PROMPT_CATEGORIES.map((c) => c.id as string));

/* ─── GET — витрин, ГЭХДЭЭ промптын ТЕКСТ нь хаалттай ────────────────────
   Эхний хувилбарт энэ маршрут промптын бүтэн текстийг хэн ч дуудахад
   буцаадаг байв — өөрөөр хэлбэл `/api/ai-gallery`-д зориуд тогтоосон
   дүрмийг (промпт нь гишүүний эрх) URL-ээр тойрч гарах нүх байлаа.
   Одоо: ЗУРАГ, гарчиг, ангилал нь бүгдэд; ТЕКСТ нь зөвхөн нэвтэрсэн
   хүнд. Ажлыг нь харуул, жороо нь нуу. */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const viewerId = (session?.user as { id?: string } | undefined)?.id || "";
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || "";
  const limit = Math.min(48, Math.max(1, parseInt(searchParams.get("limit") || "24", 10) || 24));
  const before = searchParams.get("before");

  try {
    await dbConnect();
    const q: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (category && VALID.has(category)) q.category = category;
    if (before && Types.ObjectId.isValid(before)) q._id = { $lt: new Types.ObjectId(before) };

    const rows = await PromptItem.find(q)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("author", "name avatar")
      .select("title prompt image category copies likes createdAt author access price editions sold")
      .lean();

    /* ─── ЭРХИЙН ШАТЛАЛ ──────────────────────────────────────────────
         зочин          → зөвхөн ЗУРАГ (хуудас нь нийтэд нээлттэй)
         нэвтэрсэн      → зураг + үнэ + хомсдол
         ГИШҮҮН         → ҮНЭГҮЙ промптын текст
         ЭЗЭМШИГЧ       → тухайн premium промптын текст (үүрд)
         ЗОХИОГЧ/АДМИН  → өөрийн бүтээлээ үргэлж

       Текст нь СЕРВЕР дээр таслагдана. Клиент дээр нуувал энэ бол
       нууц биш, зөвхөн нуугдсан харагдац. */
    let isMember = false;
    if (viewerId) {
      try {
        const st = await accessState(viewerId, session?.user?.email || null);
        isMember = !!st.ok;
      } catch { /* эрх тодорхойлогдоогүй — гишүүн БИШ гэж үзнэ */ }
    }
    const ownedIds = new Set<string>();
    if (viewerId) {
      const owns = await PromptOwnership.find({
        user: viewerId,
        prompt: { $in: rows.map((r) => String((r as unknown as { _id: unknown })._id)) },
      }).select("prompt").lean();
      for (const o of owns) ownedIds.add(String((o as unknown as { prompt: unknown }).prompt));
    }

    const items = (rows as unknown as {
      _id: { toString(): string };
      title: string;
      prompt: string;
      image: string;
      category: string;
      copies?: number;
      likes?: unknown[];
      createdAt: Date;
      author?: { name?: string; avatar?: string } | null;
    }[]).map((p) => {
      const id = p._id.toString();
      const isCreator = !!viewerId && String((p as unknown as { author?: { _id?: unknown } }).author?._id || "") === viewerId;
      const premium = (p as unknown as { access?: string }).access === "premium";
      const owns = ownedIds.has(id);
      const canRead = isCreator || owns || (!premium && isMember);
      const ed = Number((p as unknown as { editions?: number }).editions) || 0;
      const sold = Number((p as unknown as { sold?: number }).sold) || 0;
      return ({
      _id: p._id.toString(),
      title: p.title || "",
      image: p.image,
      category: p.category,
      copies: p.copies || 0,
      likes: Array.isArray(p.likes) ? p.likes.length : 0,
      author: p.author?.name || "Гишүүн",
      avatar: p.author?.avatar || "",
      createdAt: p.createdAt,
      prompt: canRead ? p.prompt : "",
      locked: !canRead,
      access: premium ? "premium" : "free",
      price: premium ? Number((p as unknown as { price?: number }).price) || 0 : 0,
      editions: ed,
      sold,
      remaining: ed > 0 ? Math.max(0, ed - sold) : null,
      owned: owns,
      mine: isCreator,
      /* Яагаад хаалттай вэ — UI нь ТААМАГЛАХ ёсгүй. Гишүүнчлэл авах уу,
         кредитээр худалдаж авах уу гэдэг нь огт өөр хоёр үйлдэл. */
      lockReason: canRead ? null : premium ? "buy" : "member",
    });
    });

    // Ангилал тус бүрийн тоо — таб дээр харуулна. Хоосон ангиллыг
    // "0" гэж үзүүлэх нь тэр ангилал АЖИЛЛАХГҮЙ гэсэн сэтгэгдэл өгдөг
    // тул хуудас өөрөө шийднэ, энд зөвхөн үнэнийг өгнө.
    const counts = await PromptItem.aggregate([
      { $match: { deletedAt: { $exists: false } } },
      { $group: { _id: "$category", n: { $sum: 1 } } },
    ]);

    return NextResponse.json({
      items,
      counts: Object.fromEntries(counts.map((c) => [c._id, c.n])),
      nextBefore: items.length === limit ? items[items.length - 1]._id : null,
    });
  } catch {
    return NextResponse.json({ items: [], counts: {}, nextBefore: null });
  }
}

// ─── POST — промпт нэмэх ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  }
  const userId = (session.user as { id: string }).id;

  const burst = rateLimit(`prompt:add:${userId}`, LIMITS.AI_TOOL_PER_MINUTE);
  if (!burst.ok) {
    return NextResponse.json(
      { error: `Дэндүү олон. ${Math.ceil(burst.resetInMs / 1000)} секундийн дараа.` },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    prompt?: string; image?: string; title?: string; category?: string;
    access?: string; price?: number; editions?: number;
  };

  const prompt = String(body.prompt || "").trim();
  const image = String(body.image || "").trim();
  const title = String(body.title || "").trim().slice(0, 120);
  const category = VALID.has(String(body.category)) ? String(body.category) : "зураг";

  if (!prompt) return NextResponse.json({ error: "Промпт бичнэ үү" }, { status: 400 });
  if (prompt.length > 4000) {
    return NextResponse.json({ error: "Промпт 4000 тэмдэгтээс бага байх ёстой" }, { status: 400 });
  }
  /* ЗУРАГГҮЙГ ХҮЛЭЭЖ АВАХГҮЙ. Энэ бол UI-ийн тав тух биш, сангийн
     дүрэм: зураггүй промпт нь шалгагдаагүй мэдэгдэл. */
  if (!image.startsWith("/uploads/")) {
    return NextResponse.json({ error: "Зураг заавал оруулна" }, { status: 400 });
  }

  const mod = await moderateText(prompt);
  if (!mod.ok) {
    return NextResponse.json({ error: mod.reason || "Контент дүрэм зөрчиж байна." }, { status: 400 });
  }

  /* ─── ҮНЭ ба ХОМСДОЛ ──────────────────────────────────────────────
     `premium` бол үнэ нь ЗААВАЛ 1-ээс дээш: 0 кредитийн "premium" нь
     зөвхөн эргэлзээ төрүүлнэ. `editions` нь 0 (хязгааргүй) эсвэл 1..1000
     — дээд хязгаар нь ховордлыг утгатай байлгана, 100000 хувь бол
     хязгааргүйтэй ижил. */
  const access = body.access === "premium" ? "premium" : "free";
  const price = access === "premium" ? Math.max(1, Math.min(100000, Math.round(Number(body.price) || 0))) : 0;
  const editions = Math.max(0, Math.min(1000, Math.round(Number(body.editions) || 0)));
  if (access === "premium" && price < 1) {
    return NextResponse.json({ error: "Үнээ оруулна уу" }, { status: 400 });
  }

  await dbConnect();
  const row = await PromptItem.create({
    author: userId, title, prompt, image, category, access, price, editions,
  });

  return NextResponse.json({
    ok: true,
    item: {
      _id: String(row._id),
      title: row.title,
      prompt: row.prompt,
      image: row.image,
      category: row.category,
      access: row.access,
      price: row.price,
      editions: row.editions,
      sold: 0,
      remaining: row.editions > 0 ? row.editions : null,
      owned: true,
      mine: true,
      locked: false,
      lockReason: null,
      copies: 0,
      likes: 0,
      author: (session.user as { name?: string }).name || "Гишүүн",
      avatar: (session.user as { image?: string }).image || "",
      createdAt: row.createdAt,
    },
  });
}

// ─── PATCH — хуулалтын тоолуур ────────────────────────────────────────────
// Хуулалт нь ЖИНХЭНЭ эрэлтийн хэмжүүр: like нь эелдэг байдал, хуулалт нь
// хэрэглээ. Эрэмбэлэхэд аль нь илүү үнэн болохыг энэ тоо шийднэ.
export async function PATCH(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!Types.ObjectId.isValid(body.id || "")) {
    return NextResponse.json({ error: "Bad id" }, { status: 400 });
  }
  await dbConnect();
  await PromptItem.updateOne({ _id: body.id }, { $inc: { copies: 1 } });
  return NextResponse.json({ ok: true });
}

// ─── DELETE ?id= — өөрийн промптоо авах (админ бол алийг ч) ──────────────
export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "Нэвтрэх шаардлагатай" }, { status: 401 });
  const userId = (session.user as { id: string }).id;

  const id = new URL(req.url).searchParams.get("id") || "";
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Bad id" }, { status: 400 });

  await dbConnect();
  const row = await PromptItem.findById(id);
  if (!row) return NextResponse.json({ error: "Олдсонгүй" }, { status: 404 });
  if (String(row.author) !== userId) {
    return NextResponse.json({ error: "Эрх байхгүй" }, { status: 403 });
  }
  row.deletedAt = new Date();
  await row.save();
  return NextResponse.json({ ok: true });
}

export const dynamic = "force-dynamic";
