import dbConnect from "@/lib/mongodb";
import User from "@/models/User";
import EmailBroadcast, { BroadcastAudience } from "@/models/EmailBroadcast";
import { sendEmail } from "@/lib/email";

// ─── Бөөнөөр email илгээх цөм ───────────────────────────────────────
// Илгээлт нь HTTP хүсэлтээс ТУСДАА, арын ажлаар явна: 1000 гаруй хаяг
// хэдэн минут үргэлжилдэг тул нэг хүсэлтэд багтахгүй (nginx болон
// браузер аль нь ч тэр удаан хүлээхгүй). Явц нь Mongo-д бичигдэж
// байдаг учир хуудсаа сэргээх, эсвэл процесс унасны дараа
// үргэлжлүүлэх боломжтой.

/** Resend-ийн хурдны хязгаар. Анхдагч төлөвлөгөө нь 2 хүсэлт/сек. */
const RATE_PER_SEC = Math.max(1, Number(process.env.EMAIL_BROADCAST_RATE || 2));
/** Хурдны хязгаарт унасан хаягийг хэдэн удаа дахин оролдох. */
const MAX_RETRY = 3;
/** Энэ хугацаанд цохилт ирээгүй бол ажил унасан гэж үзнэ. */
export const STALL_MS = 90_000;

// Хэрэглэгчийн нэрээр бүртгүүлэхэд email нь зохиомлоор үүсдэг
// (username-only signup) — `@antaqor.dm` гэх мэт. Эдгээр нь хэнийх ч
// биш, MX бичлэггүй домэйнууд бөгөөд илгээвэл 100% bounce болно.
// Bounce-ийн хувь ~5%-иас хэтэрвэл Resend данс түдгэлзүүлдэг тул
// эдгээрийг хасахгүйгээр бөөн илгээлт хийх нь илгээгч домэйныг
// бүхэлд нь алдахад хүргэнэ.
const PLACEHOLDER_DOMAINS = new Set([
  "antaqor.dm",
  "users.antaqor.com",
  "example.com",
  "example.org",
  "example.net",
]);
const PLACEHOLDER_SUFFIXES = [".local", ".invalid", ".test", ".localhost", ".internal"];

export function isPlaceholderEmail(email: string): boolean {
  const at = email.lastIndexOf("@");
  if (at < 1) return true;
  const domain = email.slice(at + 1);
  if (!domain.includes(".")) return true;
  if (PLACEHOLDER_DOMAINS.has(domain)) return true;
  return PLACEHOLDER_SUFFIXES.some((s) => domain.endsWith(s));
}

export function audienceQuery(a: BroadcastAudience): Record<string, unknown> {
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

export function isAudience(v: unknown): v is BroadcastAudience {
  return v === "new7" || v === "new30" || v === "paid" || v === "all";
}

export interface ResolvedAudience {
  /** Илгээх боломжтой, давхардалгүй хаягууд — ХЯЗГААРГҮЙ. */
  emails: string[];
  /** Тухайн бүлэгт байгаа нийт хэрэглэгч. */
  total: number;
  /** Зохиомол домэйнтэй тул хасагдсан хаягийн тоо. */
  skipped: number;
}

export async function resolveAudience(a: BroadcastAudience): Promise<ResolvedAudience> {
  const users = await User.find(audienceQuery(a)).select("email").lean();
  const seen = new Set<string>();
  const emails: string[] = [];
  let skipped = 0;
  for (const u of users as { email?: string }[]) {
    const email = (u.email || "").trim().toLowerCase();
    if (!email || !email.includes("@") || seen.has(email)) continue;
    seen.add(email);
    if (isPlaceholderEmail(email)) {
      skipped++;
      continue;
    }
    emails.push(email);
  }
  return { emails, total: users.length, skipped };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Брэндтэй энгийн HTML — email клиентүүдэд найдвартай (inline style, зураггүй).
export function buildHtml(message: string): string {
  const body = escapeHtml(message).replace(/\n/g, "<br/>");
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0A0A0A;">
  <div style="max-width:560px;margin:0 auto;padding:24px 16px;font-family:Arial,Helvetica,sans-serif;">
    <div style="background:#2E29FF;border-radius:4px;padding:14px 20px;">
      <span style="color:#0A0A0A;font-size:13px;font-weight:bold;letter-spacing:2px;">ANTAQOR///</span>
    </div>
    <div style="background:#0A0A0A;border-radius:4px;padding:24px 20px;margin-top:8px;color:#F4F0E8;font-size:14px;line-height:1.7;">
      ${body}
    </div>
    <div style="padding:16px 4px;color:#8A8680;font-size:11px;">
      Antaqor — AI builder community ·
      <a href="https://antaqor.com" style="color:#2E29FF;">antaqor.com</a>
    </div>
  </div>
</body></html>`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRateLimit(e: unknown): boolean {
  const m = e instanceof Error ? e.message : String(e);
  return /rate.?limit|too many requests|\b429\b/i.test(m);
}

/** Нэг процесст нэг ажил хоёр удаа эхлэхээс сэргийлнэ. */
const inFlight = new Set<string>();

/**
 * Ажлыг арын дэвсгэрт гүйцээнэ. Алдаа нь дотроо баригдах тул
 * дуудагч нь `await` хийх шаардлагагүй (floating promise).
 */
export function startBroadcastWorker(jobId: string): void {
  if (inFlight.has(jobId)) return;
  inFlight.add(jobId);
  void runBroadcast(jobId).finally(() => inFlight.delete(jobId));
}

export function isWorkerRunning(jobId: string): boolean {
  return inFlight.has(jobId);
}

async function runBroadcast(jobId: string): Promise<void> {
  await dbConnect();
  const job = await EmailBroadcast.findById(jobId);
  if (!job || job.status !== "running") return;

  const html = buildHtml(job.message);
  const text = job.message;
  const subject = job.subject;
  const recipients = job.recipients;

  try {
    while (job.cursor < recipients.length) {
      // Цуцлах хүсэлтийг багц тутамд шалгана.
      const fresh = await EmailBroadcast.findById(jobId).select("status").lean();
      if (!fresh || (fresh as { status?: string }).status !== "running") return;

      const batchStart = Date.now();
      const chunk = recipients.slice(job.cursor, job.cursor + RATE_PER_SEC);

      const results = await Promise.allSettled(
        chunk.map(async (to) => {
          for (let attempt = 1; ; attempt++) {
            try {
              await sendEmail({ to, subject, html, text });
              return;
            } catch (e) {
              // Хурдны хязгаар бол хүлээгээд дахин оролдоно; бусад
              // алдаа (буруу хаяг гэх мэт) дахин оролдох утгагүй.
              if (attempt < MAX_RETRY && isRateLimit(e)) {
                await sleep(1000 * attempt);
                continue;
              }
              throw e;
            }
          }
        })
      );

      for (const [i, res] of results.entries()) {
        if (res.status === "fulfilled") job.sent++;
        else {
          job.failed++;
          if (job.errorSamples.length < 20) {
            const msg = res.reason instanceof Error ? res.reason.message : String(res.reason);
            job.errorSamples.push(`${chunk[i]}: ${msg}`);
          }
        }
      }

      job.cursor += chunk.length;
      job.heartbeatAt = new Date();
      await job.save();

      // Нэг секундэд RATE_PER_SEC-ээс хэтрэхгүй байх нөхөн хүлээлт.
      const elapsed = Date.now() - batchStart;
      if (job.cursor < recipients.length && elapsed < 1000) await sleep(1000 - elapsed);
    }

    job.status = "done";
    job.finishedAt = new Date();
    job.heartbeatAt = new Date();
    await job.save();
    console.log(
      `[broadcast] ${jobId} done · audience=${job.audience} sent=${job.sent} failed=${job.failed} skipped=${job.skipped}`
    );
  } catch (e) {
    job.status = "failed";
    job.finishedAt = new Date();
    if (job.errorSamples.length < 20) job.errorSamples.push(e instanceof Error ? e.message : String(e));
    await job.save().catch(() => {});
    console.error(`[broadcast] ${jobId} failed ·`, e);
  }
}
