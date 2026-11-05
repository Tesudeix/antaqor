// Daily token-health alarm.
//
// Every silent outage this system has had looked the same from the outside:
// nothing. A page token stops working and messages simply stop being answered,
// with no error anywhere a human looks. This cron turns that silence into a
// message BEFORE the window closes.
//
// Note the trap it watches for: a page token can report expires_at: 0 ("never")
// and still go dark, because Meta's real limit is data_access_expires_at — a
// 90-day window that closes without warning.
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import { accountHealth, problems, type AccountHealth } from "@/lib/metaHealth";
import { sendEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const WARN_DAYS = 7;
const FIX_URL = "https://antaqor.com/admin/pages";
const DETAIL_URL = "https://antaqor.com/admin/health";

async function telegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chat) return false;
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    return r.ok;
  } catch {
    return false;
  }
}

function describe(h: AccountHealth): string {
  if (!h.hasToken) return `${h.label} — token байхгүй`;
  if (!h.valid) return `${h.label} — token үхсэн${h.error ? `: ${h.error.slice(0, 90)}` : ""}`;
  if (!h.webhookOk) return `${h.label} — webhook холбогдоогүй`;
  return `${h.label} — өгөгдлийн хандалт ${h.daysLeft} хоногийн дараа хаагдана`;
}

export async function GET(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get("secret") || "";
  let authed = Boolean(process.env.CRON_SECRET) && secret === process.env.CRON_SECRET;
  if (!authed) {
    const s = await getServerSession(authOptions);
    authed = Boolean(s?.user && isAdmin(s.user.email));
  }
  if (!authed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const all = await accountHealth();
  const bad = problems(all, WARN_DAYS);

  if (!bad.length) {
    return NextResponse.json({ ok: true, checked: all.length, problems: 0, notified: false, channel: "" });
  }

  const lines = bad.map(describe);
  const text = `Meta холболтын анхааруулга\n\n${lines.map((l) => "• " + l).join("\n")}\n\nЗасах: ${FIX_URL}\nДэлгэрэнгүй: ${DETAIL_URL}`;

  // Telegram first when configured, otherwise email — the alert has to reach a
  // human through whichever channel this server actually has.
  let notified = await telegram(
    `🔌 <b>Meta холболтын анхааруулга</b>\n\n${lines.map((l) => "• " + l).join("\n")}\n\nЗасах: ${FIX_URL}\nДэлгэрэнгүй: ${DETAIL_URL}`
  );
  let channel = notified ? "telegram" : "";

  if (!notified) {
    try {
      await sendEmail({
        to: process.env.ALERT_EMAIL || "antaqor@gmail.com",
        subject: `Meta холболт: ${bad.length} хуудас анхаарал шаардаж байна`,
        html:
          `<h2>Meta холболтын анхааруулга</h2><ul>` +
          lines.map((l) => `<li>${l}</li>`).join("") +
          `</ul><p><a href="${FIX_URL}">Хуудас дахин холбох</a> · <a href="${DETAIL_URL}">Дэлгэрэнгүй</a></p>`,
        text,
      });
      notified = true;
      channel = "email";
    } catch (e) {
      console.warn("[cron/token-health] alert failed", e instanceof Error ? e.message : e);
    }
  }
  if (!notified) console.warn("[cron/token-health]", lines.join(" | "));

  return NextResponse.json({
    ok: true,
    checked: all.length,
    problems: bad.length,
    notified,
    channel,
    accounts: bad.map((h) => ({ key: h.key, valid: h.valid, webhookOk: h.webhookOk, daysLeft: h.daysLeft })),
  });
}
