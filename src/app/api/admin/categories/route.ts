import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import Category from "@/models/Category";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 50) {
      return NextResponse.json({ error: "Нэр 1–50 тэмдэгт" }, { status: 400 });
    }
    const slug = (typeof body.slug === "string" ? body.slug : name).trim().toLowerCase();
    const color = typeof body.color === "string" ? body.color : "#1080CA";
    const iconPath = typeof body.iconPath === "string" ? body.iconPath.trim().slice(0, 2000) : "";
    const order = typeof body.order === "number" ? body.order : 999;

    await dbConnect();
    const existing = await Category.findOne({ $or: [{ slug }, { name }] }).lean();
    if (existing) {
      return NextResponse.json({ error: "Энэ категори бүртгэлтэй" }, { status: 409 });
    }
    const cat = await Category.create({ name, slug, color, iconPath, order });
    return NextResponse.json({ category: cat }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });

    await dbConnect();
    const r = await Category.deleteOne({ slug });
    return NextResponse.json({ deleted: r.deletedCount });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
