import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";

export const dynamic = "force-dynamic";

function genCode(): string {
  // 6-digit numeric, zero-padded
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const user = await User.findOne({ email: session.user.email.toLowerCase() });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const code = genCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min TTL
  user.metaLinkCode = code;
  user.metaLinkCodeExpiresAt = expiresAt;
  await user.save();

  return NextResponse.json({ code, expiresAt });
}

export async function GET() {
  // Return current code if not expired, else null
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const user = await User.findOne({ email: session.user.email.toLowerCase() });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const linked = Boolean(user.metaInstagramId || user.metaMessengerPsid);
  const valid =
    user.metaLinkCode && user.metaLinkCodeExpiresAt && user.metaLinkCodeExpiresAt > new Date();

  return NextResponse.json({
    linked,
    code: valid ? user.metaLinkCode : null,
    expiresAt: valid ? user.metaLinkCodeExpiresAt : null,
    metaInstagramId: user.metaInstagramId || null,
    metaMessengerPsid: user.metaMessengerPsid || null,
  });
}

export async function DELETE() {
  // Unlink (remove IG/FB association from current user)
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await dbConnect();
  const user = await User.findOne({ email: session.user.email.toLowerCase() });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  user.metaInstagramId = undefined;
  user.metaMessengerPsid = undefined;
  user.metaLinkCode = undefined;
  user.metaLinkCodeExpiresAt = undefined;
  await user.save();
  return NextResponse.json({ ok: true });
}
