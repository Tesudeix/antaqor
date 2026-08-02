import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// ─── Бүртгүүлсэн хүмүүс рүү email илгээх (Resend) ───
// audience: new7 | new30 | paid | all — нэг дуудлагад дээд тал нь 100 хаяг.

type Audience = "new7" | "new30" | "paid" | "all";
const MAX_PER_SEND = 100;

function audienceQuery(a: Audience): Record<string, unknown> {
  const now = new Date();
  switch (a) {
    case "new7":
      return { createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } };
    case "new30":
      return { createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } };
    case "paid":
      return {
        clan: { $ne: "" },
        $or: [{ subscriptionExpiresAt: { $gte: now } }, { subscriptionExpiresAt: { $exists: false } }],
      };
    case "all":
      return {};
  }
}

function isAudience(v: unknown): v is Audience {
  return v === "new7" || v === "new30" || v === "paid" || v === "all";
}

async function resolveRecipients(a: Audience): Promise<{ email: string; name: string }[]> {
  const users = await User.find(audienceQuery(a)).select("email name").limit(2000).lean();
  const seen = new Set<string>();
  const out: { email: string; name: string }[] = [];
  for (const u of users) {
    const email = (u.email || "").trim().toLowerCase();
    if (!email || !email.includes("@") || seen.has(email)) continue;
    seen.add(email);
    out.push({ email, name: u.name || "" });
  }
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Брэндтэй энгийн HTML — email клиентүүдэд найдвартай (inline style, зураггүй).
function buildHtml(message: string): string {
  const body = escapeHtml(message).replace(/\n/g, "<br/>");
  return `<!doctype html><html><body style="margin:0;padding:0;background:#161618;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="background:#1080CA;border-radius:4px;padding:14px 20px;">
      <span style="color:#1080CA;font-size:13px;font-weight:bold;letter-spacing:2px;">ANTAQOR///</span>
    </div>
    <div style="background:#1E1E21;border-radius:4px;padding:24px 20px;margin-top:8px;color:#F4F0E8;font-size:14px;line-height:1.7;">
      ${body}
    </div>
    <div style="padding:16px 4px;color:#8A8680;font-size:11px;">
      Antaqor — AI builder community ·
      <a href="https://antaqor.com" style="color:#1080CA;">antaqor.com</a>
    </div>
  </div>
</body></html>`;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const a = req.nextUrl.searchParams.get("audience");
  if (!isAudience(a)) return NextResponse.json({ error: "invalid_audience" }, { status: 400 });
  await dbConnect();
  const recipients = await resolveRecipients(a);
  return NextResponse.json({ audience: a, count: recipients.length, maxPerSend: MAX_PER_SEND });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.email)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const b = (await req.json().catch(() => null)) as {
    audience?: string;
    subject?: string;
    message?: string;
    testTo?: string;
  } | null;

  const subject = (b?.subject || "").trim();
  const message = (b?.message || "").trim();
  if (subject.length < 3 || message.length < 10) {
    return NextResponse.json({ error: "subject_or_message_too_short" }, { status: 400 });
  }
  const html = buildHtml(message);

  // Туршилтын илгээлт — зөвхөн нэг хаяг руу.
  if (b?.testTo && b.testTo.includes("@")) {
    try {
      await sendEmail({ to: b.testTo.trim(), subject, html, text: message });
      return NextResponse.json({ ok: true, test: true, sent: 1, failed: 0 });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "send_failed" },
        { status: 502 }
      );
    }
  }

  if (!isAudience(b?.audience)) {
    return NextResponse.json({ error: "invalid_audience" }, { status: 400 });
  }
  await dbConnect();
  const recipients = (await resolveRecipients(b.audience)).slice(0, MAX_PER_SEND);
  if (recipients.length === 0) {
    return NextResponse.json({ error: "no_recipients" }, { status: 400 });
  }

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  // 5 зэрэг — Resend-ийн rate limit-д эвтэйхэн багтана.
  for (let i = 0; i < recipients.length; i += 5) {
    const chunk = recipients.slice(i, i + 5);
    const results = await Promise.allSettled(
      chunk.map((r) => sendEmail({ to: r.email, subject, html, text: message }))
    );
    for (const [j, res] of results.entries()) {
      if (res.status === "fulfilled") sent++;
      else {
        failed++;
        if (errors.length < 5) errors.push(`${chunk[j].email}: ${res.reason?.message || "?"}`);
      }
    }
  }

  console.log(`[broadcast] audience=${b.audience} sent=${sent} failed=${failed} by=${session.user.email}`);
  return NextResponse.json({ ok: true, sent, failed, total: recipients.length, errors });
}
