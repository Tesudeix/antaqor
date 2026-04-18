import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import SiteSettings from "@/models/SiteSettings";

// GET — check if token exists (admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const setting = await SiteSettings.findOne({ key: "instagram_token" });
    const hasToken = !!(setting?.value);
    const tokenPreview = hasToken
      ? setting!.value.slice(0, 8) + "..." + setting!.value.slice(-4)
      : null;

    return NextResponse.json({ hasToken, tokenPreview, updatedAt: setting?.updatedAt });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT — set or update token (admin only)
export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    // Validate token by calling Instagram API
    const testRes = await fetch(
      `https://graph.instagram.com/me?fields=id,username&access_token=${token}`
    );
    const testData = await testRes.json();

    if (!testRes.ok || !testData.id) {
      return NextResponse.json(
        { error: "Invalid token: " + (testData.error?.message || "Unknown error") },
        { status: 400 }
      );
    }

    // Save token
    await SiteSettings.findOneAndUpdate(
      { key: "instagram_token" },
      { key: "instagram_token", value: token },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      username: testData.username,
      igId: testData.id,
    });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE — remove token (admin only)
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || !isAdmin(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await dbConnect();
    await SiteSettings.findOneAndDelete({ key: "instagram_token" });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
