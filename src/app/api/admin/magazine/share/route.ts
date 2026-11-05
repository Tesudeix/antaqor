import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import path from "path";
import sharp from "sharp";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import News from "@/models/News";
import SocialPost from "@/models/SocialPost";
import { publishToAll, type SocialPlatform } from "@/lib/socialPublish";

export const dynamic = "force-dynamic";

/* ─── POST /api/admin/magazine/share {slug, platforms} (2026-10-11) ──────
   Нийтлэгдсэн сэтгүүлийн нийтлэлийг Antaqor-ийн FB page / Instagram /
   Threads руу: гарчиг + товч + холбоос, cover-ийн хамт.
   Instagram WebP хүлээж авдаггүй (/api/upload нь WebP бичдэг) → cover-ийг
   JPEG болгож `/uploads/mag-<slug>.jpg` хадгална. Үр дүн SocialPost-д
   бичигдэнэ (/admin/social дээр харагдаж, давтан илгээж болно). */

const SITE = "https://antaqor.com";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  const body = (await req.json().catch(() => ({}))) as { slug?: string; platforms?: string[] };
  const platforms = (body.platforms || []).filter((p): p is SocialPlatform => p === "facebook" || p === "instagram" || p === "threads");
  if (!body.slug || !platforms.length) return NextResponse.json({ error: "slug ба суваг шаардлагатай" }, { status: 400 });

  await dbConnect();
  const a = (await News.findOne({ slug: String(body.slug).toLowerCase(), published: true }).lean()) as
    | { slug: string; title: string; excerpt?: string; coverImage?: string } | null;
  if (!a) return NextResponse.json({ error: "Нийтлэгдсэн нийтлэл олдсонгүй" }, { status: 404 });

  const link = `${SITE}/magazine/${encodeURIComponent(a.slug)}`;
  const text = [a.title, a.excerpt || "", `👉 ${link}`].filter(Boolean).join("\n\n");

  let imageUrl = "";
  if (a.coverImage?.startsWith("/uploads/")) {
    try {
      const safe = a.slug.replace(/[^a-z0-9-]/gi, "").slice(0, 60) || "cover";
      const out = path.join(process.cwd(), "public", "uploads", `mag-${safe}.jpg`);
      await sharp(path.join(process.cwd(), "public", a.coverImage)).resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 88 }).toFile(out);
      imageUrl = `${SITE}/uploads/mag-${safe}.jpg`;
    } catch (e) { console.warn("[magazine/share] cover→jpeg", e); }
  } else if (a.coverImage && /^https:\/\//.test(a.coverImage)) {
    imageUrl = a.coverImage;
  }
  const final = platforms.filter((p) => p !== "instagram" || !!imageUrl);

  const post = await SocialPost.create({
    text, imageUrl, platforms: final, state: "publishing",
    brief: `Magazine — ${link}`, createdByEmail: session.user.email || "",
  });
  try {
    const results = await publishToAll({ text, imageUrl: imageUrl || undefined, platforms: final, threads: { linkUrl: link } });
    const ok = results.some((r) => r.status === "ok");
    post.results = results.map((r) => ({ platform: r.platform, status: r.status, externalId: r.externalId || "", permalink: r.permalink || "", error: r.error || "", ms: r.ms, at: new Date() })) as never;
    post.state = ok ? "published" : "failed";
    post.lastError = ok ? "" : results.map((r) => r.error).filter(Boolean).join(" · ").slice(0, 400);
    await post.save();
    return NextResponse.json({
      ok,
      skipped: platforms.filter((p) => !final.includes(p)),
      results: results.map((r) => ({ platform: r.platform, status: r.status, error: r.error || "", permalink: r.permalink || "" })),
    });
  } catch (e) {
    post.state = "failed"; post.lastError = (e as Error).message?.slice(0, 400) || "алдаа";
    await post.save().catch(() => {});
    return NextResponse.json({ error: "Нийтэлж чадсангүй" }, { status: 502 });
  }
}
