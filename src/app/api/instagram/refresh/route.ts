import { NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import SiteSettings from "@/models/SiteSettings";

// GET /api/instagram/refresh — refresh the long-lived token
// Instagram long-lived tokens last 60 days but can be refreshed
// Call this periodically (e.g. weekly) to keep the token alive
export async function GET() {
  try {
    await dbConnect();

    const setting = await SiteSettings.findOne({ key: "instagram_token" });
    if (!setting?.value) {
      return NextResponse.json({ error: "No token configured" }, { status: 404 });
    }

    const res = await fetch(
      `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${setting.value}`
    );
    const data = await res.json();

    if (!res.ok || !data.access_token) {
      return NextResponse.json(
        { error: "Refresh failed: " + (data.error?.message || "Unknown") },
        { status: 400 }
      );
    }

    // Update stored token
    setting.value = data.access_token;
    await setting.save();

    return NextResponse.json({
      success: true,
      expiresIn: data.expires_in,
    });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
